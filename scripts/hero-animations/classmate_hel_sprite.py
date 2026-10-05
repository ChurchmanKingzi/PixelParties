# -*- coding: utf-8 -*-
"""Skin-Sprite „Classmate Hel“ (Sayo Aisaka, Negima) für Hel, the Bound Specter.

Maßstab und Stil wie Hel und die anderen Mädchen-Heroes (Alice, Mirjam …): ca. 16 px breit,
schwarze 1-px-Kontur, mehrstufig schattierte Flächen statt flacher Blöcke.
Von Hand gezeichnet: die linke Hälfte jeder Zeile (9 Zeichen, x 0-8, x 8 = Mitte), die rechte entsteht per
Spiegelung, außen eine Stufe dunkler (Licht von links). Die Möbel (schwebende Schulstühle,
ein Pult) sind eigene Ebenen, damit die Animation sie einzeln kreisen lassen kann.
Erzeugt src/classmate-hel-{body,chair,desk}.png und src/classmate-hel.png.
Aufruf (aus scripts/hero-animations):  python3 classmate_hel_sprite.py
"""
import numpy as np
from PIL import Image
from anim_common import rgb

PAL = {
    '#': '000000',
    'W': 'f4f2ff', 'H': 'd4d0ee', 'h': 'aaa5d2', 'g': '827dae',      # Haar (hell -> Schatten)
    's': 'fbe4d6', 'S': 'e6b9a8', 'p': 'f2a8b4', 'm': 'cf6470',     # Haut, Wange, Mund
    'e': '3b2f6e', 'E': '9a8ee6', 'x': 'ffffff', 'V': '64698c',                                    # Augen (dunkel / lavendel)
    'c': 'ffffff', 'C': 'cfd2e4', 'T': '3a3d57',                     # Matrosenkragen, Streifen
    'U': '484c6a', 'u': '31344e', 'v': '22243a',                     # Uniform
    'R': 'd9505f', 'r': '9a2f45',                                    # Schleife
    'L': 'f6f6ff', 'l': 'c4c4dc', 'B': '6a4636', 'b': '46291e',      # Strümpfe, Schuhe
    'w': 'd2a06a', 'd': '94653a', 'y': 'b07f4c',                     # Schulholz (Möbel)
}
DARKER = {'W': 'H', 'H': 'h', 'h': 'g', 'U': 'u', 'u': 'v', 'c': 'C', 'L': 'l', 's': 'S'}

# linke Hälfte (x 0-7); die rechte Hälfte ist das Spiegelbild (eine Stufe dunkler)
BODY = [
    "......###",   # 0  Haarkrone
    "....##WWW",   # 1
    "...#WWWHW",   # 2
    "..#WWWWWH",   # 3
    "..#WWHWWW",   # 4
    "..#WWWWHW",   # 5
    "..#WWHHHH",   # 6  Pony (gerade geschnitten), Schatten darunter
    "..#WHSSSS",   # 7
    "..#WHsees",   # 8  Augen (dunkel)
    "..#WHsExs",   # 9  Augen (lavendel, innen ein weißer Glanzpunkt)
    "..#WHspss",   # 10 Wange
    "..#WHspms",   # 11 Lächeln (Mundwinkel)
    "..#WW#ssm",   # 12 Kinn, Mitte des Lächelns
    "..#WH##ss",   # 13 Hals
    ".#WW#ccRR",   # 14 Matrosenkragen, Schleifenknoten
    ".#WH#TccR",   # 15
    ".#WW#VUUR",   # 16
    ".#Wh#VUUr",   # 17
    ".#WH#VUSs",   # 18 Hände vor dem Bauch
    ".#Wh#uuUu",   # 19
    "..#W#UUuU",   # 20 Rock, die Haarsträhne wird schmaler
    "..#h#uUuU",   # 21
    "..#WUUuUu",   # 22
    "...#UuUuU",   # 23 Saum
    "..#######",   # 24
    "....#LL#.",   # 25 Beine (Kniestrümpfe)
    "...#BBB#.",   # 26 Schuhe
    "...#####.",   # 27
]


def mirror(rows):
    """Rechte Hälfte spiegeln (Mittelspalte x 8 nur einmal); nur die äußersten Spalten (Haar, Rock)
    eine Stufe dunkler (Licht von links)."""
    out = np.zeros((len(rows), 17, 4), int)
    for y, r in enumerate(rows):
        assert len(r) == 9, (y, r, len(r))
        for x, ch in enumerate(r):
            if ch != '.':
                out[y, x] = rgb(PAL[ch])
                out[y, 16 - x] = rgb(PAL[DARKER.get(ch, ch) if x <= 3 and ch in 'WHhUu' else ch])
    return out


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
    b = mirror(BODY)
    save(b, 'classmate-hel-body')
    save(grid(CHAIR), 'classmate-hel-chair')
    save(grid(DESK), 'classmate-hel-desk')
    save(b, 'classmate-hel')
    im = Image.fromarray(b.astype(np.uint8))
    bg = Image.new('RGBA', im.size, (110, 110, 110, 255))
    bg.alpha_composite(im)
    bg.resize((im.width * 18, im.height * 18), Image.NEAREST).save('classmate_preview.png')
