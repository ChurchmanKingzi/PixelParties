"""Kontaktbögen der fertigen Karten nach Gruppen (liest out/cards/*.png, schreibt out/sheets/*.png).

Aufruf (nach cards.py):  cd art && python3 -I sheets.py
"""
from __future__ import annotations

import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(HERE, 'out', 'cards')
OUT = os.path.join(HERE, 'out', 'sheets')

# (Dateiname, Titel, Präfixe)
GROUPS = [
    ('units_artillery', 'Artillery', ['UA']),
    ('units_assault', 'Assault', ['US']),
    ('units_defenders', 'Defenders', ['UV']),
    ('units_civilians', 'Civilians', ['UZ']),
    ('buildings_walls_towers', 'Walls, Gates, Traps, Towers', ['BS', 'BT']),
    ('buildings_heal_workshop', 'Healing and Workshops', ['BH', 'BW']),
    ('buildings_unlock_platforms', 'Unlock Rooms and Platforms', ['BF', 'BP']),
    ('buildings_utility_chaos', 'Utility, Defense, Chaos', ['BU', 'BA', 'BC']),
]

SCALE = 2
COLS = 6
GAP = 12
BG = (40, 36, 60)


def main():
    os.makedirs(OUT, exist_ok=True)
    ids = [c['id'] if isinstance(c, dict) and 'id' in c else None
           for c in json.load(open(os.path.join(HERE, '..', 'daten', 'cards.json'), encoding='utf-8'))]
    ids = [i for i in ids if i]
    for fname, title, prefixes in GROUPS:
        group = sorted(i for i in ids if i.split('-')[0] in prefixes)
        if not group:
            continue
        imgs = [Image.open(os.path.join(CARDS, f'{i}.png')).convert('RGBA') for i in group]
        w, h = imgs[0].size
        w, h = w * SCALE, h * SCALE
        rows = (len(imgs) + COLS - 1) // COLS
        sheet = Image.new('RGB', (GAP + COLS * (w + GAP), GAP + rows * (h + GAP)), BG)
        for n, im in enumerate(imgs):
            im = im.resize((w, h), Image.NEAREST)
            x = GAP + (n % COLS) * (w + GAP)
            y = GAP + (n // COLS) * (h + GAP)
            sheet.paste(im, (x, y), im)
        sheet.save(os.path.join(OUT, fname + '.png'))
        print(f'{fname}.png: {len(group)} Karten ({title})')


if __name__ == '__main__':
    main()
