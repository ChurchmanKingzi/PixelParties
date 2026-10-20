#!/usr/bin/env python3
"""Reels für alle Heroes mit eigenem Musikstück.

    python3 scripts/social-posts/build-batch.py            # alle fehlenden Reels
    python3 scripts/social-posts/build-batch.py --force    # alle neu
    python3 scripts/social-posts/build-batch.py --only nao-the-barrier-priestess,bomb-berserker-bartas
    python3 scripts/social-posts/build-batch.py --list     # nur die Liste zeigen

Zuordnung Held → Musik wie im Spiel (server.js `bgmSlugForHero`): längste zusammenhängende Wortfolge des Namens,
für die `public/music/bgm_<slug>.ogg` existiert. Ausgeschlossen ist „Rubin, the Dragoneer Champion": er bekäme nur wegen
des Worts „Champion" das Stück von „Champion, the Stormbringer".

Ergebnis in out/reels/: <slug>.mp4, <slug>.png (Cover), übersicht.png und liste.md.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'out'
REELS = OUT / 'reels'
GENERIC = {'battle', 'battle1', 'battle2', 'battle3', 'menu', 'menu_diamond', 'shop', 'shop_diamond', 'login', 'puzzle'}
EXCLUDE = {'Rubin, the Dragoneer Champion',                     # Fehltreffer bei der Musik (nur wegen des Worts „Champion“)
           'Definitely not Andras, the Human Weapon',           # keine Kartenkunst, Karte lässt sich nicht zeichnen
           'Champion, the Eye of the Storm'}                    # dito


def slugify(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def bgm_slugs():
    out = set()
    for f in (ROOT / 'public' / 'music').iterdir():
        m = re.match(r'^bgm_(.+)\.(ogg|mp3|wav)$', f.name, re.I)
        if m and m.group(1).lower() not in GENERIC:
            out.add(m.group(1).lower())
    return out


def bgm_for(name, slugs):
    toks = [t for t in re.split(r'[^a-z0-9]+', name.lower()) if t]
    best = None
    for i in range(len(toks)):
        for j in range(i + 1, len(toks) + 1):
            c = ''.join(toks[i:j])
            if c in slugs and (not best or len(c) > len(best)):
                best = c
    return best


def heroes_with_music():
    cards = json.loads((ROOT / 'data' / 'cards.json').read_text(encoding='utf-8'))
    slugs = bgm_slugs()
    rows = []
    for c in cards:
        if c['cardType'] in ('Hero', 'Ascended Hero') and c['name'] not in EXCLUDE:
            b = bgm_for(c['name'], slugs)
            sl = slugify(c['name'])
            if b and (ROOT / 'data' / 'hero-animations' / f'{sl}.json').exists():
                rows.append(dict(name=c['name'], slug=sl, music=b, kind=c['cardType']))
    return rows


def render(row, force):
    slug = row['slug']
    mp4, cover = REELS / f'{slug}.mp4', REELS / f'{slug}.png'
    if mp4.exists() and cover.exists() and not force:
        return row, 'vorhanden', 0.0
    log = REELS / 'logs' / f'{slug}.log'
    t0 = time.time()
    with open(log, 'w', encoding='utf-8') as lf:
        r = subprocess.run([sys.executable, str(HERE / 'build-post.py'), slug, '--format', 'reel', '--clean'],
                           stdout=lf, stderr=subprocess.STDOUT, cwd=ROOT)
    src_mp4, src_cover = OUT / slug / 'reel.mp4', OUT / slug / 'reel-cover.png'
    if r.returncode != 0 or not src_mp4.exists():
        return row, 'FEHLER (siehe logs/%s.log)' % slug, time.time() - t0
    shutil.copy2(src_mp4, mp4)
    shutil.copy2(src_cover, cover)
    return row, 'ok', time.time() - t0


def contact_sheet(rows):
    cols, cw, ch, lab = 8, 216, 384, 34
    have = [r for r in rows if (REELS / f"{r['slug']}.png").exists()]
    rws = -(-len(have) // cols)
    sheet = Image.new('RGB', (cols * cw, rws * (ch + lab)), (14, 10, 28))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype(str(ROOT / 'data' / 'Pixel Intv.otf'), 12)
    except Exception:
        font = ImageFont.load_default()
    for i, r in enumerate(have):
        im = Image.open(REELS / f"{r['slug']}.png").convert('RGB').resize((cw, ch), Image.LANCZOS)
        x, y = (i % cols) * cw, (i // cols) * (ch + lab)
        sheet.paste(im, (x, y))
        d.text((x + 4, y + ch + 6), r['name'].split(',')[0][:26], fill=(230, 230, 230), font=font)
    sheet.save(REELS / 'übersicht.png')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--only')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--workers', type=int, default=3)
    args = ap.parse_args()
    rows = heroes_with_music()
    if args.only:
        want = set(args.only.split(','))
        rows = [r for r in rows if r['slug'] in want]
    if args.list:
        for r in rows:
            print(f"{r['slug']:48s} bgm_{r['music']}  ({r['kind']})")
        print(len(rows), 'Heroes')
        return
    (REELS / 'logs').mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for row, status, secs in ex.map(lambda r: render(r, args.force), rows):
            done += 1
            print(f"[{done}/{len(rows)}] {row['name']}: {status} ({secs:.0f}s)", flush=True)
    contact_sheet(rows)
    lines = ['# Reels für Heroes mit eigenem Musikstück', '', '| Held | Musik | Datei |', '|---|---|---|']
    for r in rows:
        lines.append(f"| {r['name']} | bgm_{r['music']}.ogg | {r['slug']}.mp4 |")
    (REELS / 'liste.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'fertig in {(time.time() - t0) / 60:.1f} min')


if __name__ == '__main__':
    main()
