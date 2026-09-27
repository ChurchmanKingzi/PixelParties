# -*- coding: utf-8 -*-
"""Idle-Animation für Heragas, the Monster Slayer (MotiveSteamDwarfs.xcf:
„Ebene #64“ + der blutige Hydrakopf „Ebene #66“).

Teile: src/heragas-the-monster-slayer-{body,hydra}.png (deckungsgleich).
* Heragas federt in den Knien (Füße bleiben stehen) und blinzelt.
* In der erhobenen Hand hält er den abgeschlagenen Hydrakopf; der federt mit
  ihm mit und zuckt ab und zu noch (1 px). Das grüne Blut fließt: ein heller
  Schimmer läuft die Blutströme vom Hals hinunter in die Lache am Boden (die
  liegt fest; die Ströme dehnen sich mit), einzelne Tropfen fallen hinein.
  Zwei Lücken, die im Sprite in der Lache stecken, werden grün gefüllt.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12

BODY = np.array(Image.open('src/heragas-the-monster-slayer-body.png').convert('RGBA')).astype(int)
HYDRA = np.array(Image.open('src/heragas-the-monster-slayer-hydra.png').convert('RGBA')).astype(int)
for _x, _y in ((36, 24), (35, 25)):                  # Lücken in der Lache (schon im Sprite)
    HYDRA[_y, _x] = (0x25, 0xb3, 0x00, 255)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 3, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 24
SKIN, LASH = rgb('f6bd7b'), rgb('190c00')
BLINK = {30: 'halb', 31: 'zu', 32: 'zu', 33: 'halb'}
EYES = [(9, 10), (10, 10), (9, 11), (10, 11), (13, 10), (14, 10), (13, 11), (14, 11)]
BLOOD = [rgb('25b300'), rgb('2ede00'), rgb('34f900')]
BLOOD_HI = rgb('9dff6a')
TWITCH = {18, 19, 42}
POOL_Y = 24                                          # ab hier: Lache am Boden
NECK_Y = 19                                          # darüber: der Kopf selbst
DROPS = [(33, 20, 0), (36, 20, 16), (34, 20, 32)]   # (x, Startzeile, Startframe)


def frame(i):
    b_ = BODY.copy()
    st = BLINK.get(i)
    if st:
        for x, y in EYES:
            if y == 10:
                b_[y, x] = LASH if st == 'halb' else SKIN
            elif st == 'zu':
                b_[y, x] = LASH
    hy = HYDRA.copy()
    for y in range(SH):                              # Blut fließt: Schimmer läuft nach unten
        for x in range(SW):
            if hy[y, x, 3] and tuple(hy[y, x]) in BLOOD and (y - i // 2) % 6 == 0:
                hy[y, x] = BLOOD_HI
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    head = b - (1 if i in TWITCH else 0)             # Kopf in der Hand: federt mit, zuckt
    for y in range(SH):
        for x in range(SW):
            if not hy[y, x, 3]:
                continue
            if y >= POOL_Y:
                out[y + PT, x + P] = hy[y, x]        # Lache liegt fest
            elif y >= NECK_Y:                        # Blutströme dehnen sich zwischen Hals und Lache
                for yy in range(min(y, y + head), max(y, y + head) + 1):
                    if not out[yy + PT, x + P, 3]:
                        out[yy + PT, x + P] = hy[y, x]
            else:
                out[y + PT + head, x + P] = hy[y, x]
    for x, y0, t0 in DROPS:                          # Tropfen fallen in die Lache
        t = (i - t0) % 16
        y = y0 + t
        if t < 7 and not HYDRA[y, x, 3]:
            out[y + PT, x + P] = BLOOD[2] if t < 5 else BLOOD[1]
    draw_bounce(out, b_, b, KNEE, PT, P)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'heragas_idle_{tag}', frames, ms, scale=8, check_edges=True)
