# -*- coding: utf-8 -*-
"""Idle-Animation für Null, the Mage Slayer (MotiveArcanum.xcf).

Teile: Körper (Null-Kopie + rote Kerne + Kanonenarm), lila Klinge und die
Partikel um die Klinge (src/null-the-mage-slayer-{body,blade,particles}.png).
* Schweres Atmen: der Oberkörper samt Arm und Klinge hebt sich 1 px, die
  Füße bleiben stehen (die Zeile darüber wird gedehnt – keine Lücke).
* Die drei roten Kerne pulsieren nacheinander von oben nach unten.
* Über die lila Klinge läuft ein Energiestoß vom Heft zur Spitze.
* Partikel: lila Funken lösen sich von der Klinge, treiben davon und
  verglimmen (statt der festen Punkte des Sprites).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/null-the-mage-slayer-body.png').convert('RGBA')).astype(int)
BLADE = np.array(Image.open('src/null-the-mage-slayer-blade.png').convert('RGBA')).astype(int)
DOTS = np.array(Image.open('src/null-the-mage-slayer-particles.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT = 3, 3
H, W = SH + PT + 1, SW + 2 * P
N = 32
FEET = 22                                            # ab hier stehen die Füße
CORES = [(36, 9), (36, 14), (36, 19)]                # je 2x2
CORE_ON = [rgb('ff4040'), rgb('ffa0a0'), rgb('ff4040'), rgb('e01010')]
B_HI, B_WHITE = rgb('b86bff'), rgb('eed6ff')
MOTE = [rgb('d0a0ff'), rgb('7a00e6'), rgb('6700c1'), rgb('5600a2')]
SEEDS = [(x, y) for y, x in np.argwhere(DOTS[:, :, 3] > 0)]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def breath(i):
    return -1 if math.sin(2 * math.pi * i / 16) > 0 else 0


def frame(i):
    out = np.zeros((H, W, 4), int)
    b = breath(i)
    body = BODY.copy()
    k = (i // 4) % 4                                  # welcher Kern leuchtet
    if k < 3:
        cx, cy = CORES[k]
        for dx, dy, c in ((0, 0, 1), (1, 0, 0), (0, 1, 0), (1, 1, 3)):
            body[cy + dy, cx + dx] = CORE_ON[c]
    blade = BLADE.copy()
    pos = 19 - (i % 16) * 1.4                         # Energiestoß: Heft -> Spitze
    for y, x in np.argwhere(BLADE[:, :, 3] > 0):
        d = abs(x - pos)
        if d < 0.8:
            blade[y, x] = B_WHITE
        elif d < 2.2:
            blade[y, x] = B_HI
    for src in (blade, body):
        for y in range(SH):
            for x in range(SW):
                if src[y, x, 3]:
                    out[y + PT + (b if y < FEET else 0), x + P] = src[y, x]
    if b:                                             # Zeile über den Füßen dehnen
        y = FEET - 1
        for x in range(SW):
            if BODY[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = body[y, x]
    # Partikel: lösen sich von der Klinge und treiben davon
    for m in range(10):
        t = (i + m * 3) % 12
        gen = (i + m * 3) // 12
        sx, sy = SEEDS[int(rnd(m, gen) * len(SEEDS)) % len(SEEDS)]
        ang = rnd(m + 20, gen) * 2 * math.pi
        x = int(round(sx + P + math.cos(ang) * t * 0.45))
        y = int(round(sy + PT + b + math.sin(ang) * t * 0.35 - t * 0.25))
        if t >= 10 or not (1 <= x < W - 1 and 1 <= y < H - 1) or out[y, x, 3]:
            continue
        out[y, x] = MOTE[min(3, t // 3)]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'null_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6,
                 check_edges=True)
