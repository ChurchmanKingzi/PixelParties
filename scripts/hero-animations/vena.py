# -*- coding: utf-8 -*-
"""Idle-Animation für Vena, the Bounty Huntress (Sprite aus MotiveMoe.xcf).

Ebenen: Körper („Vena“) und die abgefeuerte Raketenfaust („Ebene #59“),
deckungsgleich in src/vena-the-bounty-huntress-{body,fist}.png.
* Die Raketenfaust schießt stoßweise nach vorn (unten) und fängt sich wieder;
  ihr Düsenfeuer wird dabei in die Länge gezogen und flackert jedes Frame,
  Rauchwölkchen steigen auf.
* Beim Stoß ruckt Vena 1 px zurück (nach oben), ihr Cyborg-Auge glüht auf.
* Die orangen Stulpen glimmen (einzelne Pixel flackern heller).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/vena-the-bounty-huntress-body.png').convert('RGBA')).astype(int)
FIST = np.array(Image.open('src/vena-the-bounty-huntress-fist.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PT, PB, P = 4, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 36
PERIOD = 12
FLAME_ROWS = range(15, 19)                           # Feuer der Faust (Zeilen 15–18)
FIST_TOP = 19


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def thrust(i):
    t = i % PERIOD
    return [0, 1, 3, 4, 4, 3, 3, 2, 2, 1, 1, 0][t]


EYE = {rgb('de4b4b'): rgb('ff8a7a'), rgb('ba2121'): rgb('ff4b4b')}
FIRE = [rgb('ff6800'), rgb('ff9100'), rgb('ffa500'), rgb('ffd84a')]
GAUNTLET = {rgb('ff9100'), rgb('ff6800')}


def frame(i):
    out = np.zeros((H, W, 4), int)
    d = thrust(i)
    recoil = -1 if d >= 3 else 0
    glow = d >= 3
    # Körper
    for y in range(SH):
        for x in range(SW):
            if BODY[y, x, 3]:
                c = tuple(BODY[y, x])
                if glow and c in EYE:
                    c = EYE[c]
                elif c in GAUNTLET and rnd(x * 31 + y, i) > 0.9:
                    c = rgb('ffa500')
                out[y + PT + recoil, x + P] = c
    # Faust: Körper der Faust wandert um d nach unten
    for y in range(FIST_TOP, SH):
        for x in range(SW):
            if FIST[y, x, 3]:
                out[y + PT + d, x + P] = FIST[y, x]
    # Feuer: oben fest, unten an der Faust -> Mittelzeile wird gedehnt
    rows = list(FLAME_ROWS)
    stretched = rows[:2] + [rows[2]] * (1 + d // 2) + [rows[3]] * (1 + (d + 1) // 2)
    top = FLAME_ROWS[0] + d - (len(stretched) - len(rows))
    for j, sy in enumerate(stretched):
        for x in range(SW):
            if FIST[sy, x, 3]:
                c = tuple(FIST[sy, x])
                if c in FIRE[:3] and rnd(x + 7 * j, i) > 0.55:
                    c = FIRE[min(3, FIRE.index(c) + 1)] if rnd(x, i + 50) > 0.3 else FIRE[max(0, FIRE.index(c) - 1)]
                out[top + j + PT, x + P] = c
    # flackernde Spitze
    tx = 8 + P
    ty = top + PT - 1
    if rnd(3, i) > 0.35 and out[ty, tx, 3] == 0:
        out[ty, tx] = rgb('a85e00')
    # Rauch
    for k in range(4):
        t = (i + k * 4) % 16
        if t >= 12:
            continue
        sx = int(round(tx + math.sin(t * 0.6 + k * 2) * 1.2 + (k % 2) - 0.5))
        sy = ty - 1 - t // 2
        a = int(160 * (1 - t / 12))
        for dx in range(1 if t < 4 else 2):
            if 0 <= sx + dx < W and 0 <= sy < H and out[sy, sx + dx, 3] == 0:
                out[sy, sx + dx] = (150, 150, 150, a)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'vena_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8)
