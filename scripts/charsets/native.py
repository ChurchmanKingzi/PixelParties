# -*- coding: utf-8 -*-
"""Lädt die Kampagnen-Sprites (public/campaign/sprites/*.png, 10-fach vergrößerte Pixelart) als Raster in
nativer Auflösung. Aufruf zum Ablesen der Palette einer Figur:  python3 native.py Tobi"""
import os
import sys
import string
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITE_DIR = os.path.join(HERE, '..', '..', 'public', 'campaign', 'sprites')
UNIT = 10                                    # laut public/campaign/scenes/00-welt.js: assets.spriteUnit


def load(name):
    """RGBA-Feld (h, w, 4) in nativer Auflösung. Jeder 10x10-Block muss einfarbig sein (sonst wäre das
    Sprite nicht ganzzahlig vergrößert und ein 1:1-Übertrag unmöglich)."""
    a = np.array(Image.open(os.path.join(SPRITE_DIR, f'{name}.png')).convert('RGBA'))
    h, w = a.shape[:2]
    if h % UNIT or w % UNIT:
        raise ValueError(f'{name}: {w}x{h} ist kein Vielfaches von {UNIT}')
    blocks = a.reshape(h // UNIT, UNIT, w // UNIT, UNIT, 4)
    nat = blocks[:, UNIT // 2, :, UNIT // 2, :]
    if not (blocks == nat[:, None, :, None, :]).all():
        raise ValueError(f'{name}: Blöcke sind nicht einfarbig')
    return nat


def to_rows(nat, pal):
    """Raster aus Buchstaben. pal: Buchstabe -> 'rrggbb'. Jede Farbe des Sprites muss in pal stehen."""
    rev = {v.lower(): k for k, v in pal.items()}
    rows = []
    for y in range(nat.shape[0]):
        r = ''
        for x in range(nat.shape[1]):
            if nat[y, x, 3] == 0:
                r += '.'
                continue
            hx = '%02x%02x%02x' % tuple(int(v) for v in nat[y, x, :3])
            if hx not in rev:
                raise KeyError(f'Farbe #{hx} an ({x},{y}) fehlt in der Palette')
            r += rev[hx]
        rows.append(r)
    return rows


def dump(name):
    nat = load(name)
    sym = string.ascii_letters + string.digits
    cols = {}
    rows = []
    for y in range(nat.shape[0]):
        r = ''
        for x in range(nat.shape[1]):
            if nat[y, x, 3] == 0:
                r += '.'
                continue
            c = '%02x%02x%02x' % tuple(int(v) for v in nat[y, x, :3])
            if c not in cols:
                cols[c] = sym[len(cols)]
            r += cols[c]
        rows.append(r)
    print(f'# {name}: {nat.shape[1]}x{nat.shape[0]}')
    print('     ' + ''.join(str(i % 10) for i in range(nat.shape[1])))
    for i, r in enumerate(rows):
        print(f'{i:3d}  {r}')
    print('PAL = {' + ', '.join(f"'{s}': '{c}'" for c, s in cols.items()) + '}')


if __name__ == '__main__':
    for n in sys.argv[1:] or ['Tobi']:
        dump(n)
        print()
