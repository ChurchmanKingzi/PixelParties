# -*- coding: utf-8 -*-
"""Aus den Treffern (creature_scan.py + creature_review.py merge) die Figuren wählen, die zusammen
die Creature einer Karte bilden, und daraus src/<slug>.png bauen.

    python3 creature_pick.py overview <merged.json> <dump-ordner> <ausgabe-ordner> [--from N] [--count M]
        -> Prüfübersichten (je 8 Karten): Kunst mit Rahmen der gewählten Figuren | zusammengesetzter Sprite.
    python3 creature_pick.py build <merged.json> <dump-ordner> [Kartenname ...]
        -> schreibt src/<slug>.png (alle oder die genannten Karten) und picks.json (Auswahl je Karte).

Die Auswahl ist ein Vorschlag (größte, namensgleiche, wenig verbreitete Figur + angrenzende Teile);
Korrekturen stehen in `picks_override.json`:  { "Kartenname": [["MotiveMoe", 329, 1], ...] }
(Datei, Ebenenindex, Figurnummer — wie in den Treffern), oder { "Kartenname": null } = Karte überspringen.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from creature_extract import assemble  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
STOP = {'the', 'of', 'a', 'an', 'in', 'and', 'to', 'creature', 'token', 'b', 'w'}


def slug(n):
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))


def toks(s):
    return {t for t in re.findall(r'[a-z]+', s.lower()) if t not in STOP and len(t) > 2}


def ids(h):
    return [h['file'], h['i'], h['k']]


def kasten(h):
    sc = h.get('scale', 1)
    return h['at'][0], h['at'][1], h['at'][0] + h['box'][2] * sc, h['at'][1] + h['box'][3] * sc


def beruehrt(a, b, rand=2):
    ax0, ay0, ax1, ay1 = kasten(a); bx0, by0, bx1, by1 = kasten(b)
    return ax0 - rand < bx1 and bx0 - rand < ax1 and ay0 - rand < by1 and by0 - rand < ay1


def enthalten(a, b):
    """Kasten von a liegt ganz in b."""
    ax0, ay0, ax1, ay1 = kasten(a); bx0, by0, bx1, by1 = kasten(b)
    return ax0 >= bx0 and ay0 >= by0 and ax1 <= bx1 and ay1 <= by1


def pick(hs, card, override=None):
    if override is not None:
        want = {tuple(o) for o in override}
        return [h for h in hs if tuple(ids(h)) in want]
    cand = [h for h in hs if h['same'] >= 0.75 and h['px'] >= 30 and h['fill'] < 0.97 and h['cards'] <= 12]
    if not cand:
        cand = [h for h in hs if h['same'] >= 0.7 and h['px'] >= 12 and h['cards'] <= 30]
    if not cand:
        return []
    ct = toks(card)

    def wert(h):
        name = 1.6 if toks(re.sub(r'#\d+', '', h['name'])) & ct else 1.0
        return (h['px'] ** 0.5) * h['same'] * name / (1 + 0.12 * (h['cards'] - 1))
    haupt = max(cand, key=wert)
    gruppe = [haupt]
    # angrenzende Teile (Flügel, Waffen …) anhängen; Teile, die ganz in einem anderen stecken, nicht doppelt
    wachs = True
    while wachs and len(gruppe) < 8:
        wachs = False
        for h in sorted(cand, key=lambda e: -e['px']):
            if h in gruppe or h['px'] > haupt['px'] * 1.6:
                continue
            if any(enthalten(h, g) and g['px'] >= h['px'] for g in gruppe):
                continue
            if any(beruehrt(h, g) for g in gruppe) and h.get('scale', 1) == haupt.get('scale', 1):
                gruppe.append(h); wachs = True
    return gruppe


def laden(merged, override_pfad):
    res = json.load(open(merged, encoding='utf-8'))
    ov = json.load(open(override_pfad, encoding='utf-8')) if os.path.exists(override_pfad) else {}
    return res, ov


def sprite_fuer(res, ov, dump, n):
    hs = res[n]
    if n in ov and ov[n] is None:
        return None, []
    teile = pick(hs, n, ov.get(n))
    if not teile:
        return None, []
    can, sc = assemble(dump, teile)
    ys, xs = np.nonzero(can[..., 3])
    return can[ys.min():ys.max() + 1, xs.min():xs.max() + 1], teile


def overview(merged, dump, ziel, von=0, anzahl=8):
    res, ov = laden(merged, os.path.join(HERE, 'picks_override.json'))
    os.makedirs(ziel, exist_ok=True)
    namen = sorted(res)[von:von + anzahl]
    idx = json.load(open('data/card-art/index.json', encoding='utf-8'))
    zeilen = []
    for n in namen:
        art = Image.open(f"data/card-art/native/{idx[n]['id']}.png").convert('RGB').resize((76 * 3, 51 * 3), Image.NEAREST)
        d = ImageDraw.Draw(art)
        spr, teile = sprite_fuer(res, ov, dump, n)
        for t in teile:
            x0, y0, x1, y1 = kasten(t)
            d.rectangle([x0 * 3, y0 * 3, x1 * 3 - 1, y1 * 3 - 1], outline=(255, 70, 70))
        if spr is None:
            tile = Image.new('RGB', (140, 60), (60, 20, 20)); ImageDraw.Draw(tile).text((6, 6), 'kein Sprite', fill='white')
            info = ''
        else:
            im = Image.fromarray(spr)
            s = max(1, min(6, 150 // max(im.size)))
            bg = Image.new('RGBA', im.size, (45, 35, 75, 255)); bg.alpha_composite(im)
            tile = bg.resize((im.width * s, im.height * s), Image.NEAREST).convert('RGB')
            info = f"{im.width}x{im.height}  {len(teile)} Teil(e): " + ', '.join(f"{t['file'][6:]}{t['i']}" for t in teile[:3])
        zeilen.append((n, art, tile, info))
    W = 76 * 3 + 12 + 330
    H = sum(max(a.height, t.height) + 20 for _, a, t, _ in zeilen)
    sh = Image.new('RGB', (W, H), (12, 10, 20)); dd = ImageDraw.Draw(sh); y = 0
    for n, a, t, info in zeilen:
        dd.text((2, y + 2), n + '   ' + info, fill='white')
        sh.paste(a, (0, y + 16)); sh.paste(t, (76 * 3 + 12, y + 16)); y += max(a.height, t.height) + 20
    out = os.path.join(ziel, f'overview_{von:03d}.png')
    sh.save(out); print(out)


def build(merged, dump, namen):
    res, ov = laden(merged, os.path.join(HERE, 'picks_override.json'))
    os.makedirs(SRC, exist_ok=True)
    picks_pfad = os.path.join(HERE, 'picks.json')
    picks = json.load(open(picks_pfad, encoding='utf-8')) if os.path.exists(picks_pfad) else {}
    for n in (namen or sorted(res)):
        spr, teile = sprite_fuer(res, ov, dump, n)
        if spr is None:
            continue
        Image.fromarray(spr).save(os.path.join(SRC, slug(n) + '.png'))
        picks[n] = [ids(t) for t in teile]
    json.dump(picks, open(picks_pfad, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(picks), 'Auswahlen in', picks_pfad)


if __name__ == '__main__':
    cmd = sys.argv[1]
    args = sys.argv[2:]
    if cmd == 'overview':
        von = int(args[args.index('--from') + 1]) if '--from' in args else 0
        anzahl = int(args[args.index('--count') + 1]) if '--count' in args else 8
        overview(args[0], args[1], args[2], von, anzahl)
    elif cmd == 'build':
        build(args[0], args[1], set(args[2:]) or None)
