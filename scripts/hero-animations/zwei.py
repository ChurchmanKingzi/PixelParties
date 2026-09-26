# -*- coding: utf-8 -*-
"""Idle-Animation für Zwei, the Lucky Thief (38x29).

Er rennt mit dem geklauten pinken Glas-Dreizack davon:
* Laufzyklus mit 8 Phasen pro Doppelschritt, die Beine werden pro Frame neu
  gezeichnet: Aufsetzen mit beiden Füßen am Boden -> Abdruck -> Durchschwingen.
* Der Oberkörper federt ruhig (1 px, nach dem Aufsetzen), der Kopf verzögert.
* Der Hoodie schlackert hinten, Staubwölkchen beim Aufsetzen.
* Glanz huscht über den Glas-Dreizack und über die Brillengläser.
* Tempo-Linien ziehen hinter ihm vorbei.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/zwei-the-lucky-thief.png').convert('RGBA')).astype(int)
PT = 0
BASE = SRC.copy()
H, W = BASE.shape[:2]
N = 32
CYCLE = 8

GLASS = [rgb('e247e3'), rgb('fd51fe'), rgb('f7a5fe'), rgb('f9c0fe'), rgb('fbd8fe'), rgb('ffffff')]
GLASS_SET = set(GLASS[:-1])
LENS = {rgb('d5e9ff'), rgb('c2e4ff'), rgb('faffff')}


def o(y):
    return y - PT


# ---------------------------------------------------------------- Laufzyklus
# Fußposition (x relativ zur Hüfte, Zeile) je Phase; das zweite Bein läuft
# um 4 Phasen versetzt. Phase 0/4: Aufsetzen, beide Füße am Boden.
GROUND = 25
HIP_X, HIP_Y = 16, 22
FOOT = [(3, 25), (1, 25), (-1, 25), (-2, 25), (-4, 25), (-4, 24), (-2, 23), (1, 24)]
BOB = [1, 1, 0, 0, 1, 1, 0, 0]          # Oberkörper sackt nach dem Aufsetzen ein


def phase(i):
    return i % CYCLE


def body_dy(i, lag=0):
    return BOB[(i - lag) % CYCLE]


LEG_ZONE = (11, 22)                     # hier werden die Original-Beine entfernt
PANTS_NEAR, PANTS_FAR = rgb('000000'), rgb('1a1a1a')
SHOE_NEAR = [rgb('331a00'), rgb('5e2f00'), rgb('331a00')]
SHOE_FAR = [rgb('331a00'), rgb('331a00'), rgb('311800')]


def draw_leg(out, p, bob, near):
    fx, fy = FOOT[p]
    fx += HIP_X
    hx, hy = HIP_X + (0 if near else -1), HIP_Y + bob
    pants = PANTS_NEAR if near else PANTS_FAR
    shoe = SHOE_NEAR if near else SHOE_FAR
    rows = list(range(hy, fy))
    for k, y in enumerate(rows):
        t = (k + 1) / (len(rows) + 1) if rows else 1
        x = int(round(hx + (fx - hx) * t))
        for xx in (x, x + 1):
            out[y + PT, xx] = pants
    for k, c in enumerate(shoe):
        out[fy + PT, fx + k] = c


def is_leg(x, oy):
    return oy >= 22 and LEG_ZONE[0] <= x <= LEG_ZONE[1]


def offset(x, y, i):
    oy = o(y)
    if oy <= 8:
        return 0, body_dy(i, 1)                      # Haare wippen nach
    dx = 0
    if 15 <= oy <= 19 and x <= 11:                   # Hoodie schlackert hinten
        dx = [0, -1, -1, 0][(i // 2) % 4]
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
            if not (0 <= sx < W and 0 <= sy < H) or not s[sy, sx, 3]:
                continue
            if is_leg(sx, o(sy)) and px(BASE, sx, sy) not in GLASS_SET:
                continue                             # Original-Beine weg
            if dx and px(BASE, sx, sy) in GLASS_SET:
                continue                             # Dreizack schlackert nicht mit
            out[y, x] = s[sy, sx]
    # Dreizack-Pixel, die beim Hoodie-Schlackern ausgespart wurden
    for y in range(H):
        for x in range(W):
            dy = body_dy(i)
            if 15 <= o(y) <= 19 and x <= 11 and px(BASE, x, y) in GLASS_SET and 0 <= y + dy < H:
                out[y + dy, x] = s[y, x]
    p = phase(i)
    bob = body_dy(i)
    draw_leg(out, (p + 4) % CYCLE, bob, near=False)
    draw_leg(out, p, bob, near=True)
    # Tempo-Linien links hinter ihm (ziehen nach links weg)
    for row, off in SPEED:
        t = (i + off * 2) % 8
        x0 = 9 - t * 2
        for k in range(4):
            xx = x0 - k
            if 0 <= xx < W and out[row + PT, xx, 3] == 0:
                out[row + PT, xx] = (*SPEED_COL, 170 - k * 40)
    # Staubwölkchen hinter dem abdrückenden Fuß
    for q in (p, (p + 4) % CYCLE):
        if q in (4, 5):
            fx = HIP_X + FOOT[4][0] - 1 - (q - 4)
            for k, (dx, dy) in enumerate(((0, 0), (-1, -1), (-2, 0))):
                xx, yy = fx + dx, GROUND + dy + PT
                if 0 <= xx < W and out[yy, xx, 3] == 0:
                    out[yy, xx] = DUST[min(2, k + (q - 4))]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zwei_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 100, scale=10)
