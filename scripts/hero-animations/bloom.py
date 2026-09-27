# -*- coding: utf-8 -*-
"""Idle-Animation für Bloom, the Maniacal Botanist (MotiveSteamDwarfs.xcf:
„Bloom-Kopie #1“ + Blutblumen „Ebene #37“).

Teile: src/bloom-the-maniacal-botanist-{body,roses}.png (deckungsgleich).
* Die Blutblumen wiegen sich: oben 1 px, zum Stiel hin weniger (zeilenweise,
  so reißt nichts auf); aus den Blüten tropft Blut.
* Bloom atmet (der Oberkörper hebt sich im Rhythmus um 1 px) und blinzelt
  zweimal pro Loop mit dem Auge unter der Kapuze.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce
from flap_common import fill_pinholes

BODY = np.array(Image.open('src/bloom-the-maniacal-botanist-body.png').convert('RGBA')).astype(int)
ROSES = np.array(Image.open('src/bloom-the-maniacal-botanist-roses.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 3, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 20
BLOOD = [rgb('b30000'), rgb('7a0000')]
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
EYE_TOP, EYE_BOT = (15, 8), (15, 9)                 # rotes Auge unter der Kapuze
LID, LASH = rgb('cc9d7c'), rgb('000000')


def rose_dx(y, i):
    s = math.sin(2 * math.pi * i / 24 - y * 0.25)
    if y <= 6:
        return int(round(1.2 * s))
    if y <= 12:
        return 1 if s > 0.8 else (-1 if s < -0.8 else 0)
    return 0


def breath(i):
    return -1 if (i % 16) in range(5, 12) else 0


# Tropfstellen: unterste Pixel der Blüten (x, y) + Startframe
DRIPS = [(9, 9, 0), (20, 8, 16), (23, 12, 32)]


def frame(i):
    body = BODY.copy()
    st = BLINK.get(i)
    if st:
        body[EYE_TOP[1], EYE_TOP[0]] = LASH if st == 'halb' else LID
        if st == 'zu':
            body[EYE_BOT[1], EYE_BOT[0]] = LASH
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, body, breath(i), KNEE, PT, P)
    for y in range(SH):
        for x in range(SW):
            if ROSES[y, x, 3]:
                out[y + PT, x + P + rose_dx(y, i)] = ROSES[y, x]
    fill_pinholes(out)
    for x, y0, t0 in DRIPS:                          # Blut tropft aus den Blüten
        t = (i - t0) % 16
        if t >= 8:
            continue
        x_, y_ = x + P + rose_dx(y0, i), y0 + PT + 1 + t
        if y_ < H - 1 and not out[y_, x_, 3]:
            out[y_, x_] = BLOOD[0] if t < 6 else BLOOD[1]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'bloom_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
