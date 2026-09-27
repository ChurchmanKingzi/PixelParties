# -*- coding: utf-8 -*-
"""Idle-Animation für Cute Starlet Megu (Sprite aus MotiveMoe.xcf).

Ebenen: Flügel („Megu #2“), Körper („Megu“), winkender Arm („Megu #1“) –
deckungsgleich in src/cute-starlet-megu-{wings,body,arm}.png.
* Sie winkt: der erhobene Arm wird um die Schulter hin- und hergeschert
  (jede Zeile als Ganzes – der Arm bleibt pixelgenau), dreimal pro Loop,
  danach eine kurze Pause.
* Die rosa Flügel schlagen sanft (Drehung ums Schultergelenk,
  flap_common.rotate_part, Spitzen schwingen nach), sie schwebt mit.
* Idol-Glitzer: kleine Sterne blitzen um sie herum auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import rotate_part, over

WINGS = np.array(Image.open('src/cute-starlet-megu-wings.png').convert('RGBA')).astype(int)
BODY = np.array(Image.open('src/cute-starlet-megu-body.png').convert('RGBA')).astype(int)
ARM = np.array(Image.open('src/cute-starlet-megu-arm.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT = 4, 6
H, W = SH + PT + 2, SW + 2 * P
N = 32
MID_X = 25
PIVOT = {-1: (21.0, 15.0), 1: (28.0, 15.0)}
SHOULDER_Y = 20


def wave_k(i):
    """Scherung des Arms: 3 Winker (je 8 Frames), dann Pause."""
    if i >= 24:
        return 0.0
    return -0.2 + 0.65 * (0.5 - 0.5 * math.cos(2 * math.pi * i / 8))


def bob(i):
    return -1 if math.sin(2 * math.pi * i / 16 - 1.2) > 0 else 0


SPARKLES = [(2, 4, 0), (SW + 3, 6, 7), (4, SH - 2, 14), (SW + 1, SH, 21), (SW // 2 + 9, 0, 26)]


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = (WINGS[:, :, 3] > 0) & ((cols < MID_X) if side < 0 else (cols >= MID_X))
        ang = lambda r, s=side: s * 0.16 * math.sin(2 * math.pi * i / 16 - 0.025 * r)
        over(out, rotate_part(WINGS, m, PIVOT[side], ang, (H, W), (P, PT + dy)))
    mb = BODY[:, :, 3] > 0
    out[PT + dy:PT + dy + SH, P:P + SW][mb] = BODY[mb]
    k = wave_k(i)
    for y in range(SH):
        sh = int(round(k * (SHOULDER_Y - y)))
        for x in range(SW):
            if ARM[y, x, 3]:
                out[y + PT + dy, x + P + sh] = ARM[y, x]
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, rgb('ffaad2'), rgb('ff63d2')).items():
        if 0 <= x < W and 0 <= y < H and out[y, x, 3] == 0:
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'megu_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6)
