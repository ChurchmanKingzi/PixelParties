# -*- coding: utf-8 -*-
"""Idle-Animation für Zsos'Ssar, the Serpent Warlord (29x38 + Rand = 30x40).

* Der lange, biegsame Hals: der Kopf schwingt seitlich und wippt, der Hals
  biegt sich stetig bis zur Schulter (lückenloses Verschiebungsfeld).
* Die gespaltene Zunge schnellt neben dem Zahn heraus und zurück.
* Das Krönchen glänzt (Lichtschimmer + Glitzer auf den Edelsteinen).
* Der Speer wird mit der Hand langsam gehoben, gehalten und wieder aufgesetzt.
* Atmen, Blinzeln, Füße bleiben stehen.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, step, sweep_level, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/zsos-ssar-the-serpent-warlord.png').convert('RGBA')).astype(int)
PL, PT, PR = 0, 2, 1
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1] + PL + PR, 4), int)
BASE[PT:, PL:PL + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 48


def o(x, y):
    return x - PL, y - PT


GOLD = [rgb('b56700'), rgb('ff9100'), rgb('ffd700'), rgb('ffff00'), rgb('ffffff')]
GOLD_SET = set(GOLD[:-1])
TONGUE, TONGUE_D = rgb('742e2e'), rgb('441b1b')
EYE_LID = rgb('3f5d1d')


def zone(ox, oy):
    if (ox <= 12 and oy <= 18) or ox == 8:
        return 'SPEAR'                         # Dreizack + Schaft
    if 7 <= ox <= 16 and 19 <= oy <= 26:
        return 'ARM'                           # Hand + Arm bis zur Schulter
    if oy <= 20 and ox >= 13:
        return 'HEAD'
    if 21 <= oy <= 23 and 15 <= ox <= 21:
        return 'NECK'
    if oy >= 30:
        return 'LEGS'
    return 'BODY'


ZONE_PX = {}
for y in range(H):
    for x in range(W):
        if BASE[y, x, 3]:
            ZONE_PX.setdefault(zone(*o(x, y)), []).append((x, y))


def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 12 <= t < 36 else 0


def head_off(i):
    dx = int(round(1.8 * wave(i, N)))
    dy = int(round(0.9 * wave(i, N / 2, 0.8))) + breath(i, 1)
    return dx, dy


def neck_off(i):
    hx, hy = head_off(i - 3)                  # Hals folgt versetzt
    return int(round(hx * 0.5)), int(round(hy * 0.6))


LIFT = ([0] * 10 + [-1, -2, -2, -3, -3] + [-3] * 13 + [-2, -1, 0, 1, 0] + [0] * 15)


def spear_off(i):
    return 0, LIFT[i % N] + breath(i)


def arm_dy(ox, i):
    """Hubhöhe verteilt sich über den Arm: Hand voll, Schulter (x16) null."""
    w = max(0.0, min(1.0, (16 - ox) / 7))
    return int(round(LIFT[i % N] * w)) + breath(i)


SPARKS = [(22, 9 + PT, 2), (23, 10 + PT, 14), (24, 11 + PT, 26), (23, 7 + PT, 38)]


def tongue_len(i):
    t = i % 24
    return [0, 1, 2, 2, 1][t - 8] if 8 <= t < 13 else 0


def frame(i):
    s = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in GOLD_SET:
                lv = sweep_level(x, y, i, N / 2, speed=1.4, slope=0.6, offset=12)
                if lv:
                    s[y, x] = step(GOLD, c, lv)
            if c in (rgb('fcfe17'), rgb('fce003')) and i % N in (19, 20, 43):
                s[y, x] = EYE_LID                          # blinzeln
    out = np.zeros_like(s)
    hx, hy = head_off(i)
    b = breath(i)
    moving = set(ZONE_PX.get('SPEAR', [])) | set(ZONE_PX.get('ARM', []))
    # Körper, Hals, Kopf: stetiges Verschiebungsfeld (Rückwärts-Mapping, lückenlos).
    # Kopf voll ausgelenkt, Hals biegt sich, ab Schulterhöhe (Zeile 24) nur Atmen.
    for y in range(H):
        for x in range(W):
            ox, oy = o(x, y)
            if oy >= 30:
                dx, dy = 0, 0                                   # Beine
            else:
                w = max(0.0, min(1.0, (24 - oy) / 6))           # 1 am Kopf .. 0 an der Schulter
                dx = int(round(hx * w ** 0.8)) if ox >= 13 else 0
                dy = int(round((hy - b) * w)) + b
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3] and (sx, sy) not in moving:
                out[y, x] = s[sy, sx]
    # Arm und Speer vorne
    for z in ('ARM', 'SPEAR'):
        for x, y in ZONE_PX.get(z, []):
            dx, dy = (0, arm_dy(o(x, y)[0], i)) if z == 'ARM' else spear_off(i)
            if 0 <= x + dx < W and 0 <= y + dy < H:
                out[y + dy, x + dx] = s[y, x]
    # Zunge: schnellt neben dem Zahn heraus (gespalten)
    L = tongue_len(i)
    if L:
        w = (24 - 21) / 6
        tx = 19 + PL + int(round(hx * w ** 0.8))
        ty = 21 + PT + int(round((hy - b) * w)) + b
        for k in range(1, L + 1):
            if 0 <= ty + k < H:
                out[ty + k, tx] = TONGUE
        if L == 2 and ty + 3 < H:
            out[ty + 3, tx - 1] = TONGUE_D
            out[ty + 3, tx + 1] = TONGUE_D
    for (x, y), c in sparkle_pixels(i, N, SPARKS, rgb('ffff9a'), rgb('ffd700')).items():
        xx, yy = x + hx, y + hy
        if 0 <= xx < W and 0 <= yy < H:
            out[yy, xx] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zsos_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=10)
