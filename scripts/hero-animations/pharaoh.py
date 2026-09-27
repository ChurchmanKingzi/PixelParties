# -*- coding: utf-8 -*-
"""Idle-Animation für Pharaoh, the Lone Living Being und den Skin Gamer
Champion Pharaoh (MotiveEgypt.xcf: „Pharaoh“ bzw. „Yugi“).

Aufruf: python3 pharaoh.py <tag> [ms] [hero|gamer]

* Er wippt auf und ab: der Oberkörper federt im 12er-Takt 1 px hoch und
  1 px herunter (die Beine bleiben stehen; beim Strecken wird die Zeile
  über den Beinen gedehnt).
* Er blinzelt einmal pro Loop (halb -> zu -> halb); beide Augen sind 2 px
  breit (Weiß + Iris) und schließen sich ganz.
* hero:  das Kopftuch schimmert nicht, nur das goldene Schmuckstück in der
  Mitte glitzert (hellt auf, ein Glitzerstern blitzt darauf).
* gamer: das goldene Puzzle um seinen Hals funkelt – ein Glanz läuft darüber,
  dazu blitzen nacheinander kleine Glitzerkreuze auf dem Gold auf. Seine
  Haare wehen leicht: die Seitenzacken wippen auf und ab (links und rechts
  versetzt, zur Spitze hin stärker), die obere Spitze pendelt.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels, BOUNCE12
from flap_common import fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'gamer')), 'hero')
CFG = {
    'hero': dict(slug='pharaoh-the-lone-living-being', prefix='pharaoh', feet=20,
                 eyes=[((5, 6), 8, 9), ((9, 10), 8, 9)], skin='a76e28', lash='000000',
                 shine_cols=(), shine_y=(0, 0), jewel=[(7, 2), (8, 2), (7, 3), (8, 3), (7, 4), (8, 4)],
                 jewel_star=(7, 3)),
    'gamer': dict(slug='gamer-champion-pharaoh', prefix='gamer_pharaoh', feet=27,
                  eyes=[((9, 10), 15, 16), ((13, 14), 15, 16)], skin='d09961', lash='000000',
                  shine_cols=('ccab37', 'ebcd49', 'fff4a3', '583e00'), shine_y=(23, 27)),
}[V]
SRC = np.array(Image.open(f"src/{CFG['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
FEET = CFG['feet']
SKIN, LASH = rgb(CFG['skin']), rgb(CFG['lash'])
BLINK = {20: 'halb', 21: 'zu', 22: 'zu', 23: 'halb'}
GOLD = {rgb(c) for c in CFG['shine_cols']}
WHITE = np.array([255, 250, 225])
# Glitzerkreuze auf dem Puzzle (gamer): (Frame-Start, x, y)
GLINTS = [(4, 11, 24), (14, 13, 26), (28, 10, 25), (38, 12, 28)]
GL_WHITE, GL_YEL = rgb('ffffff'), rgb('fff4a3')


JEWEL_RAMP = {6: 0.3, 7: 0.6, 8: 0.6, 9: 0.3}


def hair(x, y, i):
    """gamer: (dx, dy) der Haarzacken."""
    if V != 'gamer':
        return 0, 0
    ph = 2 * math.pi * i / 12
    if y <= 3:                                       # obere Spitze pendelt
        return int(round(0.9 * math.sin(ph))), 0
    if 5 <= y <= 10 and (x <= 5 or x >= SW - 6):     # Seitenzacken wippen
        sv = math.sin(ph + (0.8 if x <= 5 else 0.8 + math.pi / 2))
        if x <= 3 or x >= SW - 4:
            return 0, int(round(sv))
        return 0, (1 if sv > 0.85 else (-1 if sv < -0.85 else 0))
    return 0, 0


def breath(i):
    return BOUNCE12[i % 12]


def shine(c, x, y, i):
    """Schräger Glanz (einmal pro Loop) auf den Goldfarben."""
    lo, hi = CFG['shine_y']
    if tuple(c) not in GOLD or not lo <= y <= hi:
        return c
    g = (i % 24) * 1.6 - 6 if V == 'gamer' else i * 0.8 - 6
    d = abs(x - (hi - y) * 0.6 - g)
    if d > 1.2:
        return c
    f = 0.65 if d < 0.6 else 0.35
    return np.array([*(np.array(c[:3]) * (1 - f) + WHITE * f).astype(int), 255])


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for xs, yt, yb in CFG['eyes']:
            for x in xs:
                s[yt, x] = LASH if st == 'halb' else SKIN
                if st == 'zu':
                    s[yb, x] = LASH
    jewel_a = JEWEL_RAMP.get(i % 24, 0)
    for x, y in CFG.get('jewel', ()):                # goldenes Schmuckstück glitzert
        if jewel_a:
            s[y, x, :3] = (s[y, x, :3] * (1 - jewel_a) + WHITE * jewel_a).astype(int)
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                hx, hy = hair(x, y, i)
                out[y + PT + hy + (b if y < FEET else 0), x + P + hx] = shine(s[y, x], x, y, i)
    if b < 0:                                        # Zeile über den Beinen dehnen
        y = FEET - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = shine(s[y, x], x, y, i)
    fill_pinholes(out)
    if 'jewel_star' in CFG:                          # Glitzerstern auf dem Schmuckstück
        jx, jy = CFG['jewel_star']
        for (x, y), c in sparkle_pixels(i % 24, 24, [(jx + P, jy + PT + b, 6)],
                                        rgb('fff4a3'), rgb('e6c42b')).items():
            out[y, x] = c
    if V == 'gamer':
        for t0, gx, gy in GLINTS:
            t = i - t0
            if 0 <= t < 3:
                cx, cy = gx + P, gy + PT + b
                out[cy, cx] = GL_WHITE
                if t == 1:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        out[cy + dy, cx + dx] = GL_YEL
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=10, check_edges=True)
