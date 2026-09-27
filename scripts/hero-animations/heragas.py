# -*- coding: utf-8 -*-
"""Idle-Animation für Heragas, the Monster Slayer (MotiveSteamDwarfs.xcf:
„Ebene #64“ + der blutige Hydrakopf „Ebene #66“).

Teile: src/heragas-the-monster-slayer-{body,hydra}.png (deckungsgleich).
* Heragas federt in den Knien (Füße bleiben stehen) und blinzelt.
* Er präsentiert seine Beute: zweimal pro Loop hebt er den Arm mit dem
  abgeschlagenen Hydrakopf (Drehung um die Schulter), hält ihn oben mit
  einem stolzen Rucken und senkt ihn wieder. Der Kopf zuckt ab und zu noch.
* Das grüne Blut fließt: die Ströme vom Hals zur Lache am Boden dehnen sich
  mit, wenn er den Kopf hebt (die Lache liegt fest), ein heller Schimmer
  läuft sie hinunter; aus dem Hals lösen sich Tropfen, fallen in die Lache
  und spritzen dort kurz auf. Zwei Lücken, die im Sprite in der Lache
  stecken, werden grün gefüllt.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12
from flap_common import rotate_part, fill_pinholes

BODY = np.array(Image.open('src/heragas-the-monster-slayer-body.png').convert('RGBA')).astype(int)
HYDRA = np.array(Image.open('src/heragas-the-monster-slayer-hydra.png').convert('RGBA')).astype(int)
for _x, _y in ((36, 24), (35, 25)):                  # Lücken in der Lache (schon im Sprite)
    HYDRA[_y, _x] = (0x25, 0xb3, 0x00, 255)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 6, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 24
SKIN, LASH = rgb('f6bd7b'), rgb('190c00')
BLINK = {30: 'halb', 31: 'zu', 32: 'zu', 33: 'halb'}
EYES = [(9, 10), (10, 10), (9, 11), (10, 11), (13, 10), (14, 10), (13, 11), (14, 11)]
BLOOD = [rgb('25b300'), rgb('2ede00'), rgb('34f900')]
BLOOD_HI = rgb('9dff6a')
NECK_Y, POOL_Y = 19, 26                              # Hals-Unterkante / Lache (fest)
SHOULDER = (19.5, 14.5)
HAND = (23.5, 14.0)
ARM = np.array([[bool(BODY[y, x, 3]) and x >= 20 and 11 <= y <= 17 for x in range(SW)] for y in range(SH)])
TWITCH = {20, 44}
DROP_X = [33, 36, 35]


def present(i):
    """Winkel des Arms (negativ = gehoben): heben, oben rucken, senken, Pause."""
    t = i % 24
    if t < 6:
        return -0.7 * (0.5 - 0.5 * math.cos(math.pi * t / 6))
    if t < 12:
        return -0.7 - (0.12 if t in (7, 8) else 0.0)
    if t < 18:
        return -0.7 * (0.5 + 0.5 * math.cos(math.pi * (t - 12) / 6))
    return 0.0


def hand_offset(ang):
    vx, vy = HAND[0] - SHOULDER[0], HAND[1] - SHOULDER[1]
    c, s = math.cos(ang), math.sin(ang)
    return int(round(vx * c - vy * s - vx)), int(round(vx * s + vy * c - vy))


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
    for y in range(SH):                              # Schimmer läuft die Ströme hinunter
        for x in range(SW):
            if hy[y, x, 3] and tuple(hy[y, x]) in BLOOD and (y - i // 2) % 5 == 0:
                hy[y, x] = BLOOD_HI
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    ang = present(i)
    hdx, hdy = hand_offset(ang)
    hdy += b - (1 if i in TWITCH else 0)
    # Lache (fest) und Kopf (in der Hand)
    for y in range(SH):
        for x in range(SW):
            if not hy[y, x, 3]:
                continue
            if y >= POOL_Y:
                out[y + PT, x + P] = hy[y, x]
            elif y < NECK_Y:
                out[y + PT + hdy, x + P + hdx] = hy[y, x]
    # Blutströme: zwischen Hals (bewegt) und Lache (fest) gedehnt
    for x in range(SW):
        col = [y for y in range(NECK_Y, POOL_Y) if hy[y, x, 3]]
        if not col:
            continue
        top_new = NECK_Y + hdy
        pts = []
        for y in col:
            f = (POOL_Y - y) / (POOL_Y - NECK_Y)          # 1 am Hals, 0 an der Lache
            pts.append((int(round(y + hdy * f)), x + int(round(hdx * f)), hy[y, x]))
        pts.sort(key=lambda p: p[0])
        for (y0, x0, c0), (y1, x1, _) in zip(pts, pts[1:] + [(pts[-1][0], pts[-1][1], None)]):
            for yy in range(y0, max(y0, y1 - 1) + 1):
                if not out[yy + PT, x0 + P, 3]:
                    out[yy + PT, x0 + P] = c0
    # Tropfen fallen aus dem Hals in die Lache und spritzen auf
    for k, x in enumerate(DROP_X):
        t = (i + k * 5) % 12
        y0 = NECK_Y + 1 + hdy
        y = y0 + t
        xx = x + P + (hdx if t < 2 else 0)
        if y < POOL_Y:
            for yy, c in ((y, BLOOD[2]), (y - 1, BLOOD[1])):
                if yy >= y0 and not out[yy + PT, xx, 3]:
                    out[yy + PT, xx] = c
        elif y == POOL_Y:                            # Aufspritzen
            for dx in (-1, 1):
                if not out[POOL_Y - 1 + PT, xx + dx, 3]:
                    out[POOL_Y - 1 + PT, xx + dx] = BLOOD_HI
    # Heragas: Körper federt, der Arm wird um die Schulter gehoben
    body = b_.copy()
    body[ARM] = 0
    draw_bounce(out, body, b, KNEE, PT, P)
    arm = rotate_part(b_, ARM, SHOULDER, ang, (H, W), (P, PT + b))
    m = arm[:, :, 3] > 0
    out[m] = arm[m]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'heragas_idle_{tag}', frames, ms, scale=8, check_edges=True)
