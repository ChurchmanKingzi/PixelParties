# -*- coding: utf-8 -*-
"""Idle-Animation für Zwei, the Lucky Thief (38x29 + 1 px oben = 38x30).

Er rennt mit dem geklauten pinken Glas-Dreizack davon:
* Laufzyklus (4 Frames pro Schritt): Beine wechseln (Kontakt / Flugphase),
  der Körper federt im Schritttakt, Staubwölkchen an den Füßen.
* Haare wippen verzögert, der Hoodie schlackert an den Seiten.
* Glanz huscht über den Glas-Dreizack und über die Brillengläser.
* Tempo-Linien ziehen hinter ihm vorbei.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/zwei-the-lucky-thief.png').convert('RGBA')).astype(int)
PT = 1
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 32

GLASS = [rgb('e247e3'), rgb('fd51fe'), rgb('f7a5fe'), rgb('f9c0fe'), rgb('fbd8fe'), rgb('ffffff')]
GLASS_SET = set(GLASS[:-1])
LENS = {rgb('d5e9ff'), rgb('c2e4ff'), rgb('faffff')}


def o(y):
    return y - PT


# ---------------------------------------------------------------- Laufzyklus
#            Kontakt A, Flug A, Kontakt B, Flug B
BODY = [0, -1, 0, -1]
LEG_L = [0, 0, 1, 1]        # linkes Bein: oben (Original) <-> unten
LEG_R = [0, 0, -1, -1]      # rechtes Bein: unten (Original) <-> oben


def phase(i):
    return i % 4


def body_dy(i, lag=0):
    return BODY[(i - lag) % 4]


def is_leg(x, oy):
    return 22 <= oy <= 25 and 13 <= x <= 20


def offset(x, y, i):
    oy = o(y)
    if is_leg(x, oy):
        p = phase(i)
        return 0, (LEG_L[p] if x <= 16 else LEG_R[p])
    if oy <= 8:
        return 0, body_dy(i, 1)                      # Haare wippen nach
    dx = 0
    if 15 <= oy <= 19 and (x <= 11 or x >= 22):      # Hoodie schlackert
        dx = [1, 0, -1, 0][(i + (0 if x < 16 else 2)) % 4]
    return dx, body_dy(i)


# ---------------------------------------------------------------- Glanz
def glass_shine(x, y, i):
    """Glanzband huscht über den Dreizack (von rechts nach links)."""
    pos = 38 - (i % 16) * 3.2
    d = abs((x + (y - 20) * 0.5) - pos)
    return 2 if d < 1 else 1 if d < 2.2 else 0


def lens_glint(i):
    return i % N in (6, 7, 22)


SPEED = [(11, 0), (16, 3), (22, 6), (18, 1)]         # (Zeile, Versatz)
SPEED_COL = (235, 235, 245)
DUST = [rgb('b8b8b8', 200), rgb('848484', 150), rgb('848484', 80)]


def frame(i):
    s = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in GLASS_SET:
                lv = glass_shine(x, o(y), i)
                if lv:
                    s[y, x] = GLASS[min(len(GLASS) - 1, GLASS.index(c) + lv)]
            elif c in LENS and lens_glint(i):
                s[y, x] = rgb('ffffff')
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
            # gestrecktes Bein: Lücke oben mit dem Bein selbst füllen
            if out[y, x, 3] == 0 and is_leg(x, o(y)) and dy > 0 and s[y, x, 3]:
                out[y, x] = s[y, x]
    # Tempo-Linien links hinter ihm (ziehen nach links weg)
    for row, off in SPEED:
        t = (i + off * 2) % 8
        x0 = 9 - t * 2
        for k in range(4):
            xx = x0 - k
            if 0 <= xx < W and out[row + PT, xx, 3] == 0:
                out[row + PT, xx] = (*SPEED_COL, 170 - k * 40)
    # Staubwölkchen beim Aufsetzen
    p = phase(i)
    if p in (0, 1):
        fx, fy = (12, 25) if (i // 4) % 2 else (16, 25)
        for k, (dx, dy) in enumerate(((0, 0), (-1, 0), (-2, -1))):
            xx, yy = fx + dx - p, fy + dy + PT
            if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                out[yy, xx] = DUST[k]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zwei_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=10)
