# -*- coding: utf-8 -*-
"""Idle-Animation für Kerthwack, the Reality Breaker (Hero, Ebene „KerThwack“)
und den Skin W. D. Kerthwack (Ebene „KerThwack-Kopie“), MotiveBoons.xcf.

Aufruf: python3 kerthwack.py <tag> [ms] [hero|wd]

* Die Figur besteht aus Bruchstücken (Kopfhälften, Kieferteile, Körper).
  Sie gehen im Loop auseinander – jedes Stück driftet strahlenförmig vom
  Schwerpunkt weg –, schweben kurz zerbrochen und setzen sich wieder
  zusammen.
* Zwischen den Bruchteilen knistern Partikel: weiße/hellgraue Splitter und
  einzelne Glitch-Pixel (Cyan/Magenta) auf den Verbindungen der Stücke, nur
  solange sie getrennt sind.
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs

VARIANT = 'wd' if 'wd' in sys.argv[2:] else 'hero'
SLUG = {'hero': 'kerthwack-the-reality-breaker', 'wd': 'w-d-kerthwack'}[VARIANT]
SRC = np.array(Image.open(f'src/{SLUG}.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 7
H, W = SH + 2 * P, SW + 2 * P
N = 40
MAXOFF = 5.5
NCOMP, LAB = cv2.connectedComponents((SRC[:, :, 3] > 0).astype(np.uint8), connectivity=8)
YS, XS = np.nonzero(SRC[:, :, 3])
G = (XS.mean(), YS.mean())
PIECES = []
for k in range(1, NCOMP):
    ys, xs = np.nonzero(LAB == k)
    cx, cy = xs.mean(), ys.mean()
    dx, dy = cx - G[0], cy - G[1]
    d = math.hypot(dx, dy) or 1.0
    PIECES.append((k, (cx, cy), (dx / d, dy / d)))
SPARK = [rgb('ffffff'), rgb('d8d8d8'), rgb('9aa0a8')]
GLITCH = [rgb('6ef2ff'), rgb('ff5ce1')]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def spread(i):
    """0 = zusammen, 1 = auseinander (weich ein- und ausgeblendet)."""
    t = i % N
    if t < 8 or t >= 36:
        return 0.0
    if t < 16:
        return 0.5 - 0.5 * math.cos(math.pi * (t - 8) / 8)
    if t < 28:
        return 1.0
    return 0.5 + 0.5 * math.cos(math.pi * (t - 28) / 8)


def frame(i):
    out = np.zeros((H, W, 4), int)
    s = spread(i)
    wob = math.sin(2 * math.pi * i / 10)
    offs = {}
    for k, (cx, cy), (ux, uy) in PIECES:
        f = s * MAXOFF * (1.0 + 0.12 * wob * (1 if k % 2 else -1))
        offs[k] = (int(round(ux * f)), int(round(uy * f)))
    for k, _, _ in PIECES:
        ox, oy = offs[k]
        m = LAB == k
        ys, xs = np.nonzero(m)
        out[ys + P + oy, xs + P + ox] = SRC[ys, xs]
    if s > 0.25:                                     # Partikel zwischen den Bruchteilen
        cents = [(cx + offs[k][0] + P, cy + offs[k][1] + P) for k, (cx, cy), _ in PIECES]
        for j in range(int(18 * s)):
            a, b = int(rnd(j, i) * len(cents)), int(rnd(j + 40, i) * len(cents))
            if a == b:
                continue
            u = 0.25 + 0.5 * rnd(j + 80, i)
            x = int(round(cents[a][0] + (cents[b][0] - cents[a][0]) * u + (rnd(j + 5, i) - 0.5) * 2))
            y = int(round(cents[a][1] + (cents[b][1] - cents[a][1]) * u + (rnd(j + 9, i) - 0.5) * 2))
            if 1 <= x < W - 1 and 1 <= y < H - 1 and out[y, x, 3] == 0:
                out[y, x] = GLITCH[j % 2] if rnd(j + 99, i) > 0.75 else SPARK[j % 3]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'kerthwack_{VARIANT}_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 80,
                 scale=8, check_edges=True)
