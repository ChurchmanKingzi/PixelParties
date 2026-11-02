#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motiv-Masken der Kartenkunst (Hauptmotiv vor dem Hintergrund) aus den freigestellten Ebenen in PixelPartiesSprites.

Wozu: Rarity-Effekte, die nur den Hintergrund des Bildes veraendern (Umbra Rare, Stained Rare), brauchen eine pixelgenaue Silhouette
des Motivs. Die Kartenkunst entsteht aus Ebenen der Motive-XCF-Dateien; die Ebenen liegen im Repo PixelPartiesSprites als PNG mit
hartem Alpha. Hier werden sie in der Kunst wiedergefunden (Position per Pixelvergleich) und ihr Alpha wird zur Maske.

Verfahren je Karte:
  1. Kandidaten: Sprites, deren Dateiname (oder Heldenordner) ein Wort des Kartennamens enthaelt (Woerter ab 4 Buchstaben).
  2. Jeder Kandidat wird in der Kunst gesucht (Massstab 1 und 2); Trefferquote = Anteil der deckenden Sprite-Pixel, deren Farbe in
     der Kunst innerhalb von 14 Summenstufen liegt. Ab 0,70 gilt er als Treffer.
  3. Maske = Vereinigung der Treffer-Ebenen. Kleine geschlossene Luecken (bis 2 % der Kunstflaeche) werden gefuellt, damit
     Luecken zwischen zwei Ebenen nicht als Hintergrund zaehlen.
  4. Guete: "hoch" (alle Ebenen >= 0,90), "mittel" (>= 0,80), "knapp" (>= 0,70). Karten ohne Treffer bekommen keine Maske.

Von Hand korrigierte Masken (Eintrag mit "manual": true) werden nie ueberschrieben.

Aufruf (aus dem Wurzelverzeichnis des Spiels):
  python3 scripts/subject-masks/build.py [--sprites ../pixelpartiessprites] [--jobs 4] [--only "Pyraga" "Fireball"] [--resume]

Ausgabe: data/subject-masks.json
  { "version": 1, "cards": { "<Kartenname>": { "w": 152, "h": 102, "rle": [...], "q": "hoch", "score": 0.83, "src": ["<Sprite>", ...] } } }
  w/h = Rastergroesse der Kunst im Atlas (public/cardgen/art.json, Schluessel "a"). rle = Lauflaengen abwechselnd Hintergrund /
  Motiv, zeilenweise, mit Hintergrund beginnend (ein Motiv in der ersten Zelle beginnt also mit 0).
Abhaengigkeiten: numpy, Pillow.
"""
import argparse
import json
import os
import re
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'data', 'subject-masks.json')
THRESHOLD = 0.70          # Mindest-Trefferquote einer Ebene
TOLERANCE = 14            # Farbabstand (Summe der Kanaele) fuer einen Pixeltreffer
HOLE_FRACTION = 0.02      # geschlossene Luecken bis zu diesem Anteil der Kunstflaeche werden gefuellt
STOP = {'the', 'of', 'and', 'a', 'an', 'to', 'in', 'on', 'for', 'with', 'from', 'by', 'lv', 'level'}

_atlas = None
_art_index = None
_sprites = None
_by_token = None
_sprite_dir = None
_cache = {}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def tokens(s):
    return {t for t in slug(s).split('-') if len(t) >= 3 and t not in STOP}


def init(sprite_dir):
    """Atlas und Sprite-Index laden (je Prozess einmal)."""
    global _atlas, _art_index, _sprites, _by_token, _sprite_dir
    _sprite_dir = sprite_dir
    _atlas = Image.open(os.path.join(ROOT, 'public', 'cardgen', 'art.png')).convert('RGBA')
    with open(os.path.join(ROOT, 'public', 'cardgen', 'art.json'), encoding='utf-8') as f:
        _art_index = json.load(f)
    _sprites = []
    for root, dirs, files in os.walk(sprite_dir):
        rel_root = os.path.relpath(root, sprite_dir)
        if rel_root.startswith('.git') or any(p in rel_root.split(os.sep) for p in ('idle_frames', 'views', 'rigs', 'animations', '_overview', 'death-animations', 'revive-animations', 'tools')):
            continue
        for fn in files:
            if not fn.endswith('.png'):
                continue
            stem = re.sub(r'^Motive[A-Za-z]*_L\d+_', '', fn[:-4])
            stem = re.sub(r'_\d+x\d+(_[0-9a-f]{6})?$', '', stem)
            rel = os.path.relpath(os.path.join(root, fn), sprite_dir).replace(os.sep, '/')
            parts = rel.split('/')
            tk = tokens(stem)
            if parts[0] in ('heroes', '_effects') and len(parts) > 2:
                tk |= tokens(parts[1])
            _sprites.append((rel, tk))
    _by_token = {}
    for i, (rel, tk) in enumerate(_sprites):
        for t in tk:
            _by_token.setdefault(t, []).append(i)


def load_sprite(rel):
    if rel not in _cache:
        _cache[rel] = np.array(Image.open(os.path.join(_sprite_dir, rel)).convert('RGBA'))
    return _cache[rel]


def art_of(name):
    x, y, w, h = _art_index['a'][name]
    return np.array(_atlas.crop((x, y, x + w, y + h)).convert('RGB'))


def best_match(art, spr):
    """Beste Lage (dx, dy) und Trefferquote eines Sprites in der Kunst."""
    opaque = spr[..., 3] > 128
    ys, xs = np.nonzero(opaque)
    if len(ys) < 25:
        return None
    h, w = opaque.shape
    H, W, _ = art.shape
    if h > H or w > W:
        return None
    col = spr[ys, xs, :3].astype(np.int16)
    best = (0.0, 0, 0)
    for dy in range(H - h + 1):
        for dx in range(W - w + 1):
            d = np.abs(art[ys + dy, xs + dx].astype(np.int16) - col).sum(1)
            f = float((d <= TOLERANCE).mean())
            if f > best[0]:
                best = (f, dx, dy)
    return best if best[0] > 0 else None


def fill_holes(mask, max_area):
    """Geschlossene Hintergrund-Luecken bis max_area Pixel fuellen (4er-Nachbarschaft, nicht am Rand)."""
    H, W = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = mask.copy()
    for y0 in range(H):
        for x0 in range(W):
            if mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            comp = []
            border = False
            while stack:
                y, x = stack.pop()
                comp.append((y, x))
                if y in (0, H - 1) or x in (0, W - 1):
                    border = True
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and not mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if not border and len(comp) <= max_area:
                for y, x in comp:
                    out[y, x] = True
    return out


def mask_for(name):
    """-> (maske | None, [(trefferquote, sprite), ...])"""
    art = art_of(name)
    H, W, _ = art.shape
    name_tokens = tokens(name)
    cand = set()
    for t in name_tokens:
        if len(t) >= 4 or len(name_tokens) == 1:
            cand.update(_by_token.get(t, []))
    found = []
    for ci in sorted(cand):
        rel = _sprites[ci][0]
        spr = load_sprite(rel)
        best = None
        for scale in (1, 2):
            s = spr if scale == 1 else np.array(Image.fromarray(spr).resize((spr.shape[1] * 2, spr.shape[0] * 2), Image.NEAREST))
            r = best_match(art, s)
            if r and (best is None or r[0] > best[0]):
                best = (r[0], r[1], r[2], s)
        if best and best[0] >= THRESHOLD:
            area = int((best[3][..., 3] > 128).sum())
            if 0.02 * H * W <= area <= 0.75 * H * W:
                found.append((best[0], rel, best))
    if not found:
        return None, []
    mask = np.zeros((H, W), bool)
    for _, _, (_, dx, dy, s) in found:
        a = s[..., 3] > 128
        h, w = a.shape
        mask[dy:dy + h, dx:dx + w] |= a
    mask = fill_holes(mask, max(4, int(HOLE_FRACTION * H * W)))
    if not (0.03 * H * W <= mask.sum() <= 0.70 * H * W):
        return None, []
    return mask, [(round(f, 3), rel) for f, rel, _ in found]


def rle_encode(mask):
    flat = mask.reshape(-1).astype(np.uint8)
    runs = []
    cur = 0
    n = 0
    for v in flat:
        if v == cur:
            n += 1
        else:
            runs.append(n)
            cur = int(v)
            n = 1
    runs.append(n)
    return runs


def quality(matches):
    m = min(f for f, _ in matches)
    return 'hoch' if m >= 0.90 else 'mittel' if m >= 0.80 else 'knapp'


def work(name):
    try:
        mask, matches = mask_for(name)
    except Exception as e:  # ein defektes Sprite darf den Lauf nicht beenden
        return name, None, [('Fehler: %s' % e, '')]
    if mask is None:
        return name, None, []
    entry = {'w': int(mask.shape[1]), 'h': int(mask.shape[0]), 'rle': rle_encode(mask),
             'q': quality(matches), 'score': min(f for f, _ in matches), 'src': [rel for _, rel in matches]}
    return name, entry, matches


def write(cards):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('{"version":1,"cards":{\n')
        names = sorted(cards)
        for i, n in enumerate(names):
            f.write(json.dumps(n, ensure_ascii=False) + ':' + json.dumps(cards[n], ensure_ascii=False, separators=(',', ':')) + (',\n' if i < len(names) - 1 else '\n'))
        f.write('}}\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sprites', default=os.environ.get('PP_SPRITES', os.path.join(ROOT, '..', 'pixelpartiessprites')))
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--only', nargs='*', help='nur diese Karten')
    ap.add_argument('--resume', action='store_true', help='schon vorhandene Karten ueberspringen')
    args = ap.parse_args()
    sprite_dir = os.path.abspath(args.sprites)
    if not os.path.isdir(sprite_dir):
        sys.exit('Sprite-Ordner nicht gefunden: %s (--sprites oder PP_SPRITES setzen)' % sprite_dir)
    with open(os.path.join(ROOT, 'data', 'cards.json'), encoding='utf-8') as f:
        card_names = [c['name'] for c in json.load(f)]
    with open(os.path.join(ROOT, 'public', 'cardgen', 'art.json'), encoding='utf-8') as f:
        have_art = set(json.load(f)['a'])
    names = [n for n in dict.fromkeys(card_names) if n in have_art]
    if args.only:
        names = [n for n in names if n in set(args.only)]
    cards = {}
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            cards = json.load(f)['cards']
    manual = {n for n, e in cards.items() if e.get('manual')}
    todo = [n for n in names if n not in manual and not (args.resume and n in cards)]
    print('%d Karten, davon %d von Hand gepflegt (bleiben), %d zu berechnen, %d Prozesse' % (len(names), len(manual & set(names)), len(todo), args.jobs), flush=True)
    t0 = time.time()
    done = 0
    with Pool(args.jobs, initializer=init, initargs=(sprite_dir,)) as pool:
        for name, entry, matches in pool.imap_unordered(work, todo, chunksize=4):
            done += 1
            if entry is not None:
                cards[name] = entry
            elif name in cards and name not in manual:
                del cards[name]
            if done % 50 == 0 or done == len(todo):
                write(cards)
                print('%d/%d  %d Masken  %.0f s' % (done, len(todo), len(cards), time.time() - t0), flush=True)
    write(cards)
    q = {}
    for e in cards.values():
        q[e.get('q', 'manuell')] = q.get(e.get('q', 'manuell'), 0) + 1
    print('fertig: %d Masken (%s) von %d Karten' % (len(cards), ', '.join('%s %d' % kv for kv in sorted(q.items())), len(names)))


if __name__ == '__main__':
    main()
