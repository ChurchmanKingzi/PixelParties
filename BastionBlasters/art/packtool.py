"""Prüft ein Karten-Pack (pack_*.py) und schreibt eine Kontaktbogen-Vorschau.

Aufruf (aus art/):  python3 -I packtool.py pack_units_1
Ein Pack registriert Kartenbilder mit @cards_art.card_art('ID'); jede Funktion liefert ein RGBA-Bild 144 x 96.
Geprüft werden: Größe, Palette (nur Master-Palette), Determinismus (zweimal rendern = gleiche Pixel), Laufzeit.
Ausgabe: out/packs/<name>.png (Kontaktbogen x3, mit ID und englischem Namen) und je Karte ein Einzelbild x4.
"""
from __future__ import annotations

import importlib
import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pixl import palette_violations, label_font, hexrgb


def main(name: str) -> int:
    import cards_art
    before = set(cards_art.ART)
    mod = importlib.import_module(name)
    ids = sorted(set(cards_art.ART) - before, key=lambda c: (c[:2], c))
    if not ids:
        print(f'FEHLER: {name} registriert keine Kartenbilder (@card_art).')
        return 1
    cards = {c['id']: c for c in json.load(open(os.path.join(HERE, '..', 'daten', 'cards.json'), encoding='utf-8'))}
    out = os.path.join(HERE, 'out', 'packs')
    os.makedirs(os.path.join(out, name), exist_ok=True)
    problems = []
    tiles = []
    for cid in ids:
        t0 = time.time()
        a = cards_art.ART[cid]()
        dt = time.time() - t0
        b = cards_art.ART[cid]()
        if a.size != (cards_art.WIN_W, cards_art.WIN_H):
            problems.append(f'{cid}: Größe {a.size}, erwartet {(cards_art.WIN_W, cards_art.WIN_H)}')
        if palette_violations(a):
            problems.append(f'{cid}: {palette_violations(a)} Farben außerhalb der Master-Palette')
        if not np.array_equal(np.array(a.convert('RGBA')), np.array(b.convert('RGBA'))):
            problems.append(f'{cid}: nicht deterministisch (zwei Läufe unterscheiden sich; random.Random(seed) benutzen)')
        if dt > 20:
            problems.append(f'{cid}: Rendern dauert {dt:.0f}s')
        a.resize((a.width * 4, a.height * 4), Image.NEAREST).save(os.path.join(out, name, f'{cid}.png'))
        tiles.append((cid, a))
    cols = 3
    rows = (len(tiles) + cols - 1) // cols
    sc, pad, lab = 3, 10, 16
    W = cols * (cards_art.WIN_W * sc + pad) + pad
    H = rows * (cards_art.WIN_H * sc + pad + lab) + pad
    sheet = Image.new('RGB', (W, H), hexrgb('#2b2540'))
    dr = ImageDraw.Draw(sheet)
    font = label_font(12)
    for k, (cid, im) in enumerate(tiles):
        x = pad + (k % cols) * (cards_art.WIN_W * sc + pad)
        y = pad + (k // cols) * (cards_art.WIN_H * sc + pad + lab)
        dr.text((x, y), f"{cid}  {cards.get(cid, {}).get('name_en', '?')}", fill=(240, 235, 250), font=font)
        sheet.paste(im.convert('RGB').resize((im.width * sc, im.height * sc), Image.NEAREST), (x, y + lab))
    sheet.save(os.path.join(out, f'{name}.png'))
    print(f'{name}: {len(ids)} Kartenbilder -> out/packs/{name}.png')
    if problems:
        print('PROBLEME:')
        for p in problems:
            print(' -', p)
        return 1
    print('OK')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
