# -*- coding: utf-8 -*-
"""Skin-Sprite „Classmate Hel“ (Sayo Aisaka, Negima) für Hel, the Bound Specter.

Von Hand gezeichnet: die linke Hälfte jeder Zeile (12 Zeichen, x 0-11), die rechte entsteht per
Spiegelung. Die Möbel (schwebende Schulstühle, ein Pult) sind eigene Ebenen, damit die Animation
sie einzeln kreisen lassen kann.
Erzeugt src/classmate-hel-{body,chair,desk}.png und src/classmate-hel.png (Vorschau).
Aufruf (aus scripts/hero-animations):  python3 classmate_hel_sprite.py
"""
import numpy as np
from PIL import Image
from anim_common import rgb

PAL = {
    'K': '1c1530', 'W': 'f4f2ff', 'H': 'd6d2f0', 'h': 'aba6d4', 's': 'fbe4d6', 'S': 'e8bfae',
    'e': '3b2f6e', 'E': '9a8ee6', 'p': 'f4b0b8', 'm': 'b8454f', 'c': 'ffffff', 'C': 'cdd0e2',
    'T': '3a3d57', 'U': '4c4f6c', 'u': '34364e', 'V': '6e7294', 'R': 'd9505f', 'r': 'a02f45',
    'L': 'f6f6ff', 'l': 'c4c4dc', 'B': '5a3e34', 'b': '3a281f',
    'w': 'c99560', 'd': '8a5c36',                      # helles Schulholz (Möbel)
}

# linke Hälfte (x 0-11); die rechte Hälfte ist das Spiegelbild
BODY = [
    "........KKKK",   # 0  Haarspitze
    "......KKWWWW",   # 1
    ".....KWWWWWW",   # 2
    "....KWWWWHWW",   # 3
    "....KWWWWWWW",   # 4
    "...KWWWHWWWW",   # 5
    "...KWWWWWWWW",   # 6  Pony (gerade geschnitten)
    "...KWWWHHHHH",   # 7  Pony-Schatten
    "...KWWHsssss",   # 8
    "...KWWHseess",   # 9  Augen (dunkel)
    "...KWWHsEEss",   # 10 Augen (lavendel)
    "...KWWHspsss",   # 11 Wange
    "...KWWHssssm",   # 12 Lächeln
    "...KWWhKSsss",   # 13 Kinn
    "...KWWhKKKss",   # 14 Hals
    "..KWWHKcccsR",   # 15 Matrosenkragen + Schleifenknoten
    "..KWWHKTcccR",   # 16
    ".KWWWHKUTccR",   # 17
    ".KWWHhKUUTcr",   # 18
    ".KWWHhKUUUuu",   # 19
    ".KWWHhKUUuuu",   # 20
    ".KWWHhKVUuss",   # 21  Hände vor dem Bauch
    ".KWWHhKUUuSS",   # 22
    ".KWWHhKuuuuu",   # 23  Rock beginnt
    ".KWWHhKUuuUU",   # 24
    ".KWWHKUUuuUU",   # 25
    ".KWWHKUUuuUU",   # 26
    ".KWWKUUUuuUU",   # 27
    ".KWhKUUUuuUU",   # 28  Rocksaum
    "..KKKKKKKKKK",   # 29
    "......KLLLK.",   # 30  Beine (Kniestrümpfe), in der Mitte eine Lücke
    "......KLllK.",   # 31
    "....KBBBBBK.",   # 32  Schuhe
    "....KKKKKKK.",   # 33
]


def mirror(rows):
    out = np.zeros((len(rows), 24, 4), int)
    for y, r in enumerate(rows):
        assert len(r) == 12, (y, r, len(r))
        full = r + r[::-1]
        for x, ch in enumerate(full):
            if ch != '.':
                out[y, x] = rgb(PAL[ch])
    return out


# Schulstuhl von der Seite (7x9): Rückenlehne, Sitz, Beine
CHAIR = [
    "KKK....",
    "KwwK...",
    "KwdK...",
    "KwwK...",
    "KwwKKKK",
    "KKKwwwK",
    ".KddddK",
    ".K.KK.K",
    ".K.K..K",
]
# kleines Pult mit Buch (9x7)
DESK = [
    "..KKKKK..",
    ".KRRRRRK.",
    "KwwwwwwwK",
    "KdddddddK",
    ".K.....K.",
    ".K.....K.",
    ".KK...KK.",
]


def grid(rows):
    out = np.zeros((len(rows), max(map(len, rows)), 4), int)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                out[y, x] = rgb(PAL[ch])
    return out


def save(a, n):
    Image.fromarray(a.astype(np.uint8)).save(f'src/{n}.png')


if __name__ == '__main__':
    b = mirror(BODY)
    save(b, 'classmate-hel-body')
    save(grid(CHAIR), 'classmate-hel-chair')
    save(grid(DESK), 'classmate-hel-desk')
    save(b, 'classmate-hel')
    im = Image.fromarray(b.astype(np.uint8))
    bg = Image.new('RGBA', im.size, (60, 50, 90, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 14, im.height * 14), Image.NEAREST).save('classmate_preview.png')
