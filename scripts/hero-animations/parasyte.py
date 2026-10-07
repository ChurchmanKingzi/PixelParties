# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „Parasytic ???“ (Parasyte) von ???, the Shapeshifter.

Sprite und Teile: parasyte_sprite.py (src/parasytic-shapeshifter{,-tent,-blades}.png). Frame 0 ist die
Ruhepose (der Sprite genau wie gezeichnet).
* Die Fleischwaffen schlackern wie die Tentakel des normalen Shapeshifters (weiches Verschiebungsfeld,
  rückwärts abgetastet; am Körper fest, zur Spitze hin stärker, peitschend).
* Die Klingen sitzen starr an den Tentakelspitzen und schwingen als Ganzes mit (ganzzahlige
  Verschiebung, nichts wird verzerrt oder neu gerastert).
* Die hellen Muskelfasern kriechen langsam an den Strängen entlang.
* Das weiße Monsterauge glimmt; ab und zu blitzt der Stahl einer Klinge auf.
Aufruf (aus scripts/hero-animations):  python3 parasyte.py final 90
"""
import math
import sys
from PIL import Image
import numpy as np
import cv2
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes
import parasyte_sprite as PS

SRC = np.array(Image.open('src/parasytic-shapeshifter.png').convert('RGBA')).astype(int)
TENTL = np.array(Image.open('src/parasytic-shapeshifter-tent.png').convert('RGBA')).astype(int)
BLADEL = np.array(Image.open('src/parasytic-shapeshifter-blades.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
N = 48
PL = PR = 3
PT, PB = 4, 2
H, W = SH + PT + PB, SW + PL + PR
_ys, _xs = np.mgrid[0:SH, 0:SW]
OPAQUE = SRC[:, :, 3] > 0
BLADE = BLADEL[:, :, 3] > 0
TENT = (TENTL[:, :, 3] > 0) & ~BLADE                      # schwingende Stränge (ohne Klingen)
_body = (OPAQUE & ~TENT & ~BLADE).astype(np.uint8)
DIST = cv2.distanceTransform((1 - _body).astype(np.uint8), cv2.DIST_L2, 5)
STRENGTH = np.clip((DIST - 1) / 12.0, 0, 1)
CENTER = (30.0 + PS.OX, 21.0 + PS.OY)                      # Körpermitte (wie beim normalen Shapeshifter)
SWING = 1.1
FLESH = [tuple(rgb(c)) for c in ('8e2a35', 'b8454d', 'd9696f', 'efb0a8')]
FLESH_SET = {c for c in FLESH}
OUTLINE = tuple(PS.OUTLINE)
EYE = [(26 + PS.OX, 18 + PS.OY), (27 + PS.OX, 18 + PS.OY), (26 + PS.OX, 19 + PS.OY), (27 + PS.OX, 19 + PS.OY)]

# Jede Klinge gehört zu der Tentakelspitze, an der sie sitzt (Anker = Spitze in Leinwandkoordinaten)
_n, _lab = cv2.connectedComponents(BLADE.astype(np.uint8), connectivity=8)
def _orig_holes():
    """Lücken, die schon im Sprite selbst vorkommen (Stellen, die fill_pinholes sonst zumalen würde)."""
    tmp = np.zeros((H, W, 4), int)
    tmp[PT:PT + SH, PL:PL + SW] = SRC
    filled = tmp.copy()
    fill_pinholes(filled)
    return (filled[:, :, 3] > 0) & (tmp[:, :, 3] == 0)


ORIG_HOLES = _orig_holes()
BLADE_PARTS = []
for k in range(1, _n):
    m = _lab == k
    ys, xs = np.nonzero(m)
    cx, cy = xs.mean(), ys.mean()
    name, tip = min(((nm, (t[0] + PS.OX, t[1] + PS.OY)) for nm, t, *_ in PS.BLADES),
                    key=lambda it: (it[1][0] - cx) ** 2 + (it[1][1] - cy) ** 2)
    BLADE_PARTS.append((name, tip, m))
GLINT = {'top': 6, 'bottom': 22, 'left': 38, 'arm': 14}   # Blitz je Klinge: Startframe


def offset(x, y, i):
    """Verschiebung (dx, dy) an (x, y): die Stränge schwingen quer zur Richtung vom Körper weg, als Welle,
    die zur Spitze hinausläuft (peitschend); Frame 0 = Ruhelage."""
    f = STRENGTH[y, x]
    if not f:
        return 0.0, 0.0
    cx, cy = CENTER
    rx, ry = x + 0.5 - cx, y + 0.5 - cy
    r = math.hypot(rx, ry) or 1.0
    ph = 2 * math.pi * i / 24
    amp = SWING * f * (math.sin(ph - 0.2 * r) + math.sin(0.2 * r))
    return -ry / r * amp, rx / r * amp


def fibers(s, i):
    """Helle Muskelfasern wandern langsam: das Streifenmuster der Füllung rückt alle 8 Frames einen Schritt."""
    shift = (i // 8) % 6
    out = s.copy()
    for y, x in zip(*np.nonzero(TENT)):
        if tuple(s[y, x, :3]) in {c[:3] for c in FLESH}:
            band = ((x - PS.OX) + 2 * (y - PS.OY) + shift) % 6          # wie im Bau (Koordinaten des Original-Sprites)
            tone = {0: 1, 1: 1, 2: 3, 3: 1, 4: 2, 5: 1}[band]
            out[y, x] = FLESH[tone]
    return out


def frame(i):
    s = fibers(SRC, i)
    glow = rgb(['ffffff', 'eef8ff', 'd4eaff', 'eef8ff'][((i + 1) // 2) % 4])      # Monsterauge glimmt
    for x, y in EYE:
        s[y, x] = glow
    out = np.zeros((H, W, 4), int)
    for y, x in zip(*np.nonzero(OPAQUE & ~TENT & ~BLADE)):                  # Mensch und Auswuchs: fest
        out[y + PT, x + PL] = s[y, x]
    # Stränge: rückwärts abtasten (keine Löcher, dünne Linien reißen nicht)
    ys, xs = np.nonzero(TENT)
    for qy in range(max(0, ys.min() - 3), min(SH, ys.max() + 4)):
        for qx in range(max(0, xs.min() - 3), min(SW, xs.max() + 4)):
            dx, dy = offset(qx, qy, i)
            px, py = int(round(qx - dx)), int(round(qy - dy))
            if 0 <= px < SW and 0 <= py < SH and TENT[py, px]:
                out[qy + PT, qx + PL] = s[py, px]
    # Klingen: starr mit der Spitze mitbewegt
    shifts = {}
    for name, (ax, ay), m in BLADE_PARTS:
        dx, dy = offset(ax, ay, i)
        sx, sy = int(round(dx)), int(round(dy))
        shifts[name] = (sx, sy)
        for y, x in zip(*np.nonzero(m)):
            out[y + sy + PT, x + sx + PL] = s[y, x]
    before = out[:, :, 3] > 0
    fill_pinholes(out)
    out[ORIG_HOLES & ~before] = 0                                         # Lücken des Sprites bleiben Lücken
    for name, start in GLINT.items():                                       # Stahl blitzt auf
        for nm, (ax, ay), m in BLADE_PARTS:
            if nm != name:
                continue
            ys, xs = np.nonzero(m)
            hi = [(x, y) for y, x in zip(ys, xs) if tuple(SRC[y, x, :3]) == (255, 255, 255)]
            gx, gy = hi[0] if hi else (int(xs.mean()), int(ys.mean()))      # der weiße Glanzpunkt der Klinge
            sx, sy = shifts[name]
            for (px, py), c in sparkle_pixels(i, N, [(gx + sx + PL, gy + sy + PT, start)], rgb('e8f4ff'), rgb('ffffff')).items():
                if 0 < px < W - 1 and 0 < py < H - 1:
                    out[py, px] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'parasyte_idle_{tag}', frames, ms, scale=6, check_edges=True)
