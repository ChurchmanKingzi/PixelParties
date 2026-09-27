# -*- coding: utf-8 -*-
"""Idle-Animation für Pharaoh, the Lone Living Being und den Skin Gamer
Champion Pharaoh (MotiveEgypt.xcf: „Pharaoh“ bzw. „Yugi“).

Aufruf: python3 pharaoh.py <tag> [ms] [hero|gamer]

* Er atmet: der Oberkörper hebt sich im Rhythmus um 1 px (die Beine bleiben
  stehen, die Zeile über den Beinen wird gedehnt).
* Er blinzelt einmal pro Loop (halb -> zu -> halb).
* hero:  ein Glanz läuft einmal pro Loop schräg über das goldene Kopftuch.
* gamer: das goldene Puzzle um seinen Hals funkelt – ein Glanz läuft darüber,
  dazu blitzen nacheinander kleine Glitzerkreuze auf dem Gold auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

V = next((v for v in sys.argv[2:] if v in ('hero', 'gamer')), 'hero')
CFG = {
    'hero': dict(slug='pharaoh-the-lone-living-being', prefix='pharaoh', feet=20,
                 eyes=[(5, 8, 9), (10, 8, 9)], skin='a76e28', lash='000000',
                 shine_cols=('968325', 'd7aa28', 'd3bc7b', 'e6c42b', 'c6a925'), shine_y=(0, 6)),
    'gamer': dict(slug='gamer-champion-pharaoh', prefix='gamer_pharaoh', feet=27,
                  eyes=[(9, 15, 16), (14, 15, 16)], skin='d09961', lash='000000',
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


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


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
        for x, yt, yb in CFG['eyes']:
            s[yt, x] = LASH if st == 'halb' else SKIN
            if st == 'zu':
                s[yb, x] = LASH
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                out[y + PT + (b if y < FEET else 0), x + P] = shine(s[y, x], x, y, i)
    if b:                                            # Zeile über den Beinen dehnen
        y = FEET - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = shine(s[y, x], x, y, i)
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
