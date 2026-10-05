# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin Captain-Commander Damus (Teile aus assemble_damus_skin.py).

Aufruf: python3 damus_skin.py <tag> [ms]

Frame 0 ist die Ruhepose.
* Die Flammen auf Haar und Schwert lodern: jede Flammenspalte züngelt unabhängig nach oben (wächst und
  sinkt zurück, unten bleibt sie verankert), die Glut im Inneren flackert zwischen den vier Feuerfarben, und
  über beiden Feuern steigen Funken auf.
* Er redet ununterbrochen (der Mund unter dem Schnurrbart geht auf und zu) und gestikuliert mit der freien
  Hand: zweimal je Loop hebt er sie (der Ärmel staucht sich, nichts wird gedehnt) und unterstreicht seine
  Worte mit kleinen Schlägen; der weiße Mantel füllt den Raum zwischen Körper und Arm (keine Lücke).
  Bei den Betonungen nickt er.
* Der ganze Oberkörper atmet (sackt ein, ohne Dehnung); Schwert, Flammen und Mantel gehen mit.
* Die Kopfflammen züngeln besonders hoch, ihre Spitzen wehen seitlich, Fetzen reißen ab.
"""
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import rgb, save_outputs

N = 48
OUT = os.environ.get('DA_OUT', '.')
SLUG = 'captain-commander-damus'
PL, PR, PT, PB = 3, 3, 12, 1


def load(part):
    return np.array(Image.open(f'src/{SLUG}-{part}.png').convert('RGBA')).astype(int)


BODY, FIRE = load('body'), load('flames')
SH, SW = BODY.shape[:2]
H, W = SH + PT + PB, SW + PL + PR
CORE = [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')]   # heiß -> kühl
HEAD_ROW = 13                       # Kopf (mit Schnurrbart) bis hier, nickt bei Betonungen
SWORD_X = 4                         # Flammen links davon gehören zum Schwert, rechts zum Haar
ARM_X, ARM_Y0, ARM_Y1 = 16, 15, 24  # die freie Hand: Ärmel ab Zeile 15, Hand bis Zeile 24
COAT_X, COAT_Y0, COAT_Y1 = 15, 19, 25   # weiße Mantelkante neben der freien Hand
MOUTH = [(11, 13), (12, 13), (11, 14), (12, 14)]
TALK = [0, 1, 1, 0, 1, 2, 1, 0, 1, 1, 0, 0, 1, 2, 2, 1, 0, 1, 0, 1, 1, 0, 0, 1,
        1, 0, 1, 2, 1, 0, 0, 1, 1, 0, 1, 1, 2, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0]   # 0 zu, 1 auf, 2 weit auf
NOD = {9: 1, 10: 1, 33: 1, 34: 1, 21: 1}


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def lift(i):
    """Wie weit die freie Hand gehoben ist (0..2): zwei Gesten je Loop, oben kleine Betonungsschläge."""
    for a, e in ((4, 18), (26, 40)):
        if a <= i < e:
            u = (i - a) / (e - a)
            base = 2.4 * math.sin(math.pi * u)
            beat = -0.9 if (i - a) % 4 == 2 and 0.2 < u < 0.8 else 0.0
            return max(0, min(2, round(base + beat)))
    return 0


def dot(out, x, y, c):
    if 0 <= y < out.shape[0] and 0 <= x < out.shape[1]:
        out[y, x] = c


KNEE = 25                           # ab hier (Beine) bleibt er stehen


SWORD_HAND_X = 5                    # Schwert samt Hand und Griff (Spalten bis hier) bewegen sich als Ganzes


def body_shift(i, y, x=None):
    """Der ganze Oberkörper atmet: alle 12 Frames sackt er 1 px ein (die Zeilen rücken an der Hüfte zusammen,
    nichts wird gedehnt); seitlich lehnt er sich nicht. Schwert, Hand und Griff sacken als starres Stück mit."""
    b = 1 if (i % 12) in (5, 6, 7, 8) else 0
    if x is not None and x <= SWORD_HAND_X:
        return 0, b
    if y >= KNEE:
        return 0, 0
    return 0, b


def frame(i):
    s = BODY.copy()
    st = TALK[i]
    if st:                                                # Mund auf (2x2 dunkel), weit auf: innen rot
        for x, y in MOUTH:
            s[y, x] = rgb('311800' if y == 13 or st == 1 else '6b1a10')
    nod = NOD.get(i, 0)
    L = lift(i)
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(s[:, :, 3])):
        bx, by = body_shift(i, y, x)
        dx = dy = 0
        if y <= HEAD_ROW and x > SWORD_X:
            dy = nod
        if x >= ARM_X and ARM_Y0 <= y <= ARM_Y1 + 1:       # freie Hand hebt sich, der Ärmel staucht
            dy = -round(L * (y - ARM_Y0) / (ARM_Y1 - ARM_Y0))
            if y >= 20 and L == 2:
                dx = 1                                    # oben weist die Hand leicht nach außen
        dot(out, x + PL + dx + bx, y + PT + dy + by, s[y, x])
    for y in range(COAT_Y0, COAT_Y1 + 1):                 # hebt er die Hand, geht der weiße Mantel weiter
        bx, by = body_shift(i, y)
        coat_x, yy = COAT_X + PL + bx, y + PT + by
        if not (out[yy, coat_x, 3] and BODY[y, COAT_X, 3] and min(BODY[y, COAT_X, :3]) > 150):
            continue
        right = [x for x in range(coat_x + 1, coat_x + 5) if out[yy, x, 3]]
        if right:                                         # Lücke zwischen Mantel und Arm: Mantel füllt sie
            for x in range(coat_x + 1, right[0]):
                out[yy, x] = BODY[y, COAT_X]
        elif L:                                           # unter der gehobenen Hand: Mantel mit Kontur
            out[yy, coat_x + 1] = BODY[y, COAT_X]
            out[yy, coat_x + 2] = rgb('030303')
    for x in range(SW):                                   # Flammen lodern spaltenweise
        col = [y for y in range(SH) if FIRE[y, x, 3]]
        if not col:
            continue
        y0, y1 = min(col), max(col)
        n = y1 - y0 + 1
        head = x > SWORD_X
        if head:                                          # am Kopf züngeln die Flammen hoch hinaus
            grow = 1.0 + 0.95 * rnd(x, i) ** 1.5 + 0.35 * rnd(x + 50, i // 2)
        else:
            grow = 1.0 + 0.5 * rnd(x, i) + 0.2 * rnd(x + 50, i // 2)
        m = min(n + (7 if head else 4), max(n, int(round(n * grow))))
        bx, by = body_shift(i, y1, x)
        oy = PT + by + (nod if head else 0)
        for j in range(m):
            sy = y0 + min(n - 1, int(j * n / m))
            if not FIRE[sy, x, 3]:
                continue
            c = tuple(FIRE[sy, x])
            k = CORE.index(c) if c in CORE else 2
            r = rnd(x * 13 + sy, i)
            if r > 0.6:                                   # Glut flackert
                k = max(0, k - 1) if rnd(x + sy, i + 7) > 0.5 else min(3, k + 1)
            tip = m - 1 - j                               # Abstand von unten
            yy = y1 - tip + oy
            sway = 0
            if j < m - n // 2:                            # die Zungenspitzen wehen seitlich
                sway = round((1.2 if head else 0.7) * math.sin(0.9 * i + 1.7 * x) * (1 - j / (m - n // 2)))
            if j < m - n:                                 # die neu hinzugekommene Spitze ist kühler
                k = max(k, 2 if j > (m - n) // 2 else 3)
            dot(out, x + PL + bx + sway, yy, CORE[k])
        if head and rnd(x + 99, i) > 0.7:                 # abreißende Flammenfetzen über der Spitze
            ty = y1 - m + oy - 1 - int(2 * rnd(x + 7, i))
            if ty >= 1:
                dot(out, x + PL + bx + round(math.sin(1.3 * i + x)), ty, CORE[2 if rnd(x, i + 3) > 0.4 else 3])
    for k in range(7):                                    # Funken steigen über den Feuern auf
        a = (i * 2 + k * 7) % 14
        sx = [1, 3, 6, 9, 12, 15, 2][k]
        top = min((y for y in range(SH) if FIRE[y, sx, 3]), default=0)
        x = sx + PL + round(0.8 * math.sin(0.9 * a + k))
        y = top + PT - 4 - a
        if y >= 1 and not out[y, x, 3]:
            dot(out, x, y, CORE[1] if a < 6 else rgb('f47b22', 200))
    return out

if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{OUT}/damus_skin_idle_{tag}', frames, ms, scale=8, check_edges=True)
