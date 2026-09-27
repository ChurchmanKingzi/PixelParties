# -*- coding: utf-8 -*-
"""Idle-Animation für Teocuilatl, the Embodiment of Gods und den Skin
Teocuilatl the Platinum Star (MotiveSteamDwarfs.xcf).

Aufruf: python3 teocuilatl.py <tag> [ms] [hero|platinum]

* Die vier Glitzersterne sind im Sprite fest eingezeichnet. Sie werden
  entfernt (wo sie die Figur überdecken, wird mit der häufigsten
  Nachbarfarbe ergänzt) und neu gezeichnet – jeder eigenständig: eigener
  Takt, eigene Größe, er wächst auf, funkelt und vergeht.
* Er steht und atmet: der Oberkörper federt im 12er-Takt 1 px hoch und
  herunter, die Beine bleiben stehen (Steh-Idle).
* Die rechte Hand lag unter einem Stern und war nach dem Entfernen nur
  geschätzt; sie wird als Spiegelbild der vollständigen linken Hand
  ergänzt (die Figur ist symmetrisch um x = 11,5).
"""
import math
import sys
from collections import Counter
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12

V = next((v for v in sys.argv[2:] if v in ('hero', 'platinum')), 'hero')
SLUG, PREFIX = {'hero': ('teocuilatl-the-embodiment-of-gods', 'teocuilatl'),
                'platinum': ('teocuilatl-the-platinum-star', 'platinum_star')}[V]
SRC = np.array(Image.open(f'src/{SLUG}.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 3, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
STAR_COLS = {rgb(c) for c in ('ff883c', 'ffb179', 'fafafa', 'f3c042', 'ffef72')}
SMALL_COLS = {rgb(c) for c in ('c92d00', '941b00', 'ff883c', 'ffb179')}
# Bereiche der vier Sterne (x0, x1, y0, y1, Farben)
STAR_AREAS = [(17, 27, 6, 16, STAR_COLS), (0, 7, 12, 18, STAR_COLS), (17, 23, 23, 29, STAR_COLS),
              (0, 4, 27, 31, SMALL_COLS)]


def strip_stars(src):
    s = src.copy()
    star = {(x, y) for x0, x1, y0, y1, cols in STAR_AREAS for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)
            if s[y, x, 3] and tuple(s[y, x]) in cols}
    todo = set(star)
    while todo:                                      # von außen nach innen auffüllen
        done = set()
        for x, y in todo:
            nb = [tuple(int(v) for v in s[y + dy, x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                  if 0 <= x + dx < SW and 0 <= y + dy < SH and (x + dx, y + dy) not in todo and s[y + dy, x + dx, 3]]
            opaque_nb = len(nb)
            if opaque_nb >= 3:
                s[y, x] = Counter(nb).most_common(1)[0][0]
                done.add((x, y))
        if not done:                                 # Rest liegt außerhalb der Figur
            for x, y in todo:
                s[y, x] = 0
            break
        todo -= done
    return s


def mirror_hand(body):
    """Arm/Hand rechts (Zeilen 18–27) = Spiegelbild der linken (x <= 6), Achse x = 11,5."""
    b = body.copy()
    for y in range(18, 28):
        b[y, 18:] = 0
        for x in range(0, 7):
            if b[y, x, 3]:
                b[y, 23 - x] = b[y, x]
    return b


BODY = mirror_hand(strip_stars(SRC))
KNEE = 27                                            # ab hier stehen die Beine
WHITE, PEACH, ORANGE = rgb('fafafa'), rgb('ffb179'), rgb('ff883c')
YEL, YEL2 = rgb('ffef72'), rgb('f3c042')
RED, DARK = rgb('c92d00'), rgb('941b00')
# Sterne: (Mitte x, y, größte Armlänge, Periode, Phase, klein)
STARS = [(22, 11, 5, 24, 0, False), (4, 15, 3, 16, 6, False), (20, 26, 3, 12, 4, False), (2, 29, 1, 16, 11, True)]


def star_pixels(cx, cy, arm, small):
    """Pixel eines Sterns der Armlänge arm (0 = nur Mitte)."""
    px = {}
    if small:
        px[(cx, cy)] = PEACH if arm else ORANGE
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if arm:
                px[(cx + dx, cy + dy)] = ORANGE
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            if arm:
                px[(cx + dx, cy + dy)] = DARK
        return px
    px[(cx, cy)] = WHITE
    for d in range(1, arm + 1):
        c = WHITE if d < arm - 1 else (PEACH if d == arm - 1 else ORANGE)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            px[(cx + dx * d, cy + dy * d)] = c
    if arm >= 3:                                     # gelber Schimmer um die Mitte
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            px[(cx + dx, cy + dy)] = YEL
        if arm >= 4:
            for dx, dy in ((2, 1), (-2, 1), (2, -1), (-2, -1), (1, 2), (-1, 2), (1, -2), (-1, -2)):
                px[(cx + dx, cy + dy)] = YEL2
    return px


def star_arm(i, amax, period, phase):
    """Wächst auf, funkelt am größten Punkt, vergeht; dazwischen Pause."""
    t = (i + phase) % period
    life = [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]
    life = [min(v, amax) for v in life][:max(4, amax * 2 + 2)]
    if t >= len(life):
        return None
    return life[t]


def frame(i):
    s = BODY.copy()
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    draw_bounce(out, s, b, KNEE, PT, P)
    for cx, cy, amax, period, phase, small in STARS:
        arm = star_arm(i, amax, period, phase)
        if arm is None:
            continue
        for (x, y), c in star_pixels(cx + P, cy + PT + (b if cy < KNEE else 0), arm, small).items():
            assert 1 <= x < W - 1 and 1 <= y < H - 1, 'Stern ragt an den Rand'
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
