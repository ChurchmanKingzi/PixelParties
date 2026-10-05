# -*- coding: utf-8 -*-
"""Möbel für den Skin „Classmate Hel“ (Sayo Aisaka, Negima) von Hel, the Bound Specter.

Der Körper (src/classmate-hel-body.png) ist der vom Nutzer gezeichnete Sprite. Hier entstehen nur die
schwebenden Schulmöbel (Stuhl, Pult) als eigene Ebenen, damit die Animation sie einzeln kreisen lassen kann:
src/classmate-hel-{chair,desk}.png, Kontur in der Sprite-Konturfarbe.
Aufruf (aus scripts/hero-animations):  python3 classmate_hel_sprite.py
"""
import numpy as np
from PIL import Image
from anim_common import rgb

PAL = {
    '#': '4c4966',                                                   # Kontur wie im Sprite
    'R': 'd9505f', 'r': '9a2f45',                                    # Buch
    'w': 'd2a06a', 'd': '94653a', 'y': 'b07f4c',                     # Schulholz
}

# Schulstuhl von der Seite (7x9): Rückenlehne links, Sitz rechts, Beine
CHAIR = [
    "##.....",
    "#w#....",
    "#d#....",
    "#w#....",
    "#w#####",
    "###yyw#.",
    ".#dddd#",
    ".#.##.#",
    ".#.#..#",
]
# kleines Pult mit rotem Buch (8x7)
DESK = [
    "..####..",
    ".#RRrR#.",
    "#wwwwww#",
    "#dddddd#",
    ".#....#.",
    ".#....#.",
    ".##..##.",
]


def grid(rows):
    w = max(map(len, rows))
    out = np.zeros((len(rows), w, 4), int)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                out[y, x] = rgb(PAL[ch])
    return out


def save(a, n):
    Image.fromarray(a.astype(np.uint8)).save(f'src/{n}.png')


if __name__ == '__main__':
    save(grid(CHAIR), 'classmate-hel-chair')
    save(grid(DESK), 'classmate-hel-desk')
