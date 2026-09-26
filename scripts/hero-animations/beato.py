# -*- coding: utf-8 -*-
"""Idle-Animation für Beato, the Butterfly Witch (21x28 + je 3 px links/rechts = 27x28).

Elegante Hexe und Tänzerin:
* Sie hebt sich auf der Fußspitze (Standbein streckt sich, Fuß bleibt stehen).
* Die ausgestreckten Arme schweben wie beim Tanz im Wechsel auf und ab
  (Hände bis 2 px, an der Schulter fest).
* Der Rocksaum schwingt sanft mit.
* Goldene Schmetterlinge umkreisen sie flatternd und ziehen eine Glitzerspur.
* Das offene (türkise) Auge blinzelt ab und zu – das zwinkernde bleibt zu.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, wave, save_outputs

SRC = np.array(Image.open('src/beato-the-butterfly-witch.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL = PR = 3
BASE = np.zeros((SH, SW + PL + PR, 4), int)
BASE[:, PL:PL + SW] = SRC
H, W = BASE.shape[:2]
N = 48

SKIN, LASH = rgb('f7bc97'), rgb('000200')


def rise(i):
    """Auf die Fußspitze heben (0 / -1)."""
    return -1 if 6 <= i % 24 < 17 else 0


def is_arm(ox, oy):
    return 14 <= oy <= 18 and (ox <= 4 or ox >= 16)


def arm_lift(ox, i):
    if ox <= 4:
        reach, ph = (5 - ox) / 4, 0.0
    else:
        reach, ph = (ox - 15) / 4, math.pi
    lift = int(round(1 + wave(i, 24, ph)))                 # 0..2, im Wechsel
    return int(round(lift * min(1.0, reach)))


def is_foot(ox, oy):
    """Standbein (Fußspitze) bleibt stehen."""
    return oy >= 26 and 5 <= ox <= 10


def skirt_dx(oy, i):
    if not 20 <= oy <= 23:
        return 0
    return int(round(1.3 * (oy - 19) / 4 * wave(i, 24, 1.1)))


# ---------------------------------------------------------------- Schmetterlinge
GOLD = [rgb('d19745'), rgb('ffcc80'), rgb('ffd290')]
BODY = rgb('311800')
# (Mittelpunkt x, y, Radius x, y, Umläufe pro Loop, Phase, Flatter-Versatz)
BUTTERFLIES = [(13.5, 13.0, 12.0, 9.0, 1, 0.0, 0), (13.5, 17.0, 11.0, 6.0, -1, 2.2, 2)]


def butterfly_pos(b, i):
    cx, cy, rx, ry, laps, ph, _ = b
    a = 2 * math.pi * laps * i / N + ph
    x = cx + rx * math.cos(a)
    y = cy + ry * math.sin(a) + 1.2 * math.sin(4 * a)
    return x, y, math.sin(a) > 0                           # vorne, wenn unten im Kreis


WINGS = {                                                  # Flügelstellungen
    'offen': [((-2, -1), 1), ((-1, -1), 2), ((1, -1), 2), ((2, -1), 1),
              ((-1, 0), 1), ((1, 0), 1), ((-2, 0), 0), ((2, 0), 0), ((-1, 1), 0), ((1, 1), 0)],
    'halb': [((-1, -1), 1), ((1, -1), 1), ((-1, -2), 2), ((1, -2), 2), ((-1, 0), 0), ((1, 0), 0)],
    'zu': [((0, -1), 1), ((0, -2), 2), ((-1, -2), 0)],
}
FLAP = ['offen', 'halb', 'zu', 'halb']


def draw_butterfly(out, x, y, i, flap_off, front):
    x, y = int(round(x)), int(round(y))
    pix = [((dx, dy), GOLD[k]) for (dx, dy), k in WINGS[FLAP[(i + flap_off) % 4]]]
    pix += [((0, 0), BODY), ((0, -1), BODY)] if FLAP[(i + flap_off) % 4] != 'zu' else [((0, 0), BODY)]
    for (dx, dy), c in pix:
        xx, yy = x + dx, y + dy
        if 0 <= xx < W and 0 <= yy < H and (front or out[yy, xx, 3] == 0):
            out[yy, xx] = c


def frame(i):
    s = BASE.copy()
    if i % N in (30, 31, 44):                              # Blinzeln (türkises Auge)
        for x in (7, 8):
            s[12, x + PL] = SKIN
            s[13, x + PL] = LASH
    out = np.zeros_like(s)
    r = rise(i)
    # Standfuß fest, das Bein darüber streckt sich beim Anheben
    for oy in range(SH):
        for ox in range(SW):
            if s[oy, ox + PL, 3] and is_foot(ox, oy):
                out[oy, ox + PL] = s[oy, ox + PL]
    if r < 0:
        for ox in range(5, 11):
            if s[25, ox + PL, 3]:
                out[25, ox + PL] = s[25, ox + PL]
    # Körper (ohne Arme): hebt sich, der Rocksaum schwingt
    for oy in range(SH):
        for ox in range(SW):
            if not s[oy, ox + PL, 3] or is_foot(ox, oy) or is_arm(ox, oy):
                continue
            ty, tx = oy + r, ox + PL + skirt_dx(oy, i)
            if 0 <= ty < H and 0 <= tx < W:
                out[ty, tx] = s[oy, ox + PL]
    # Arme: schweben im Wechsel (als Ganzes, an der Schulter verbunden)
    for oy in range(14, 19):
        for ox in range(SW):
            if s[oy, ox + PL, 3] and is_arm(ox, oy):
                ty = oy + r - arm_lift(ox, i)
                if 0 <= ty < H:
                    out[ty, ox + PL] = s[oy, ox + PL]
    # Schmetterlinge mit Glitzerspur
    for b in BUTTERFLIES:
        x, y, front = butterfly_pos(b, i)
        px_, py_, _ = butterfly_pos(b, i - 1)
        tx, ty = int(round(px_)), int(round(py_))
        if 0 <= tx < W and 0 <= ty < H and out[ty, tx, 3] == 0:
            out[ty, tx] = (*GOLD[2][:3], 110)
        draw_butterfly(out, x, y, i, b[6], front)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'beato_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
