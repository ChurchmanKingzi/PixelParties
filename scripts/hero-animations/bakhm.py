# -*- coding: utf-8 -*-
"""Idle-Animation für Bakhm, the Desert Digger und den Skin World Eater Bakhm
(MotiveEgypt.xcf: „Bakhm #4“ + „Bakhm #1“ bzw. „Ebene #82“).

Aufruf: python3 bakhm.py <tag> [ms] [hero|worm]

Beide kommen „aus dem Boden“: die untersten Zeilen laufen in die Transparenz
aus. Der Übergang ist am Bild fest (der Boden bewegt sich nicht), so taucht
beim Heben etwas mehr von ihnen auf.
* Der Körper wiegt sich hin und her: je höher, desto stärker, der Teil im
  Boden bleibt stehen.
* Er hebt und senkt sich um 1 px (taucht ein Stück auf und wieder ein).
* Der Unterkiefer klappt zweimal pro Loop auf und zu (vorne weiter als am
  Gelenk).
* worm: das Auge blinzelt einmal pro Loop.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'worm')), 'hero')
CFG = {
    'hero': dict(slug='bakhm-the-desert-digger', prefix='bakhm', sway=2.0,
                 jaw=lambda x, y: 17 <= y <= 23 and x <= 22, hinge=22),
    'worm': dict(slug='world-eater-bakhm', prefix='world_eater_bakhm', sway=2.0,
                 jaw=lambda x, y: 13 <= y <= 22 and x <= 24, hinge=24),
}[V]
SRC = np.array(Image.open(f"src/{CFG['slug']}.png").convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 3, 1
H, W = SH + PT + PB, SW + 2 * P
N = 48
FADE = 8                                             # so viele Zeilen laufen unten aus
GROUND = PT + SH                                     # Bodenlinie im Bild (fest)
# worm: Auge (x10–15, Zeilen 4–8) – Lid in Hautfarbe, Wimpernlinie dunkel
EYE_COLS = {rgb(c) for c in ('707c26', '393f19', '2e321b', '141416')}
EYE = [(x, y) for y in range(4, 9) for x in range(9, 16) if SRC[y, x, 3] and tuple(SRC[y, x]) in EYE_COLS]
LID, LID_LINE = rgb('755f62'), rgb('1f0d0d')
BLINK = {30: 'halb', 31: 'zu', 32: 'zu', 33: 'halb'}


def sway(y, i):
    h = max(0.0, (SH - y) / SH)
    return int(round(CFG['sway'] * h ** 1.3 * math.sin(2 * math.pi * i / 24)))


def rise(i):
    return -1 if (i % 24) in range(6, 18) else 0


def jaw_open(i):
    t = i % 24
    return (0, 0.5, 1, 1, 1, 0.5)[t - 8] if 8 <= t < 14 else 0


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i) if V == 'worm' else None
    if st:
        top = min(y for _, y in EYE)
        for x, y in EYE:
            if st == 'zu' or y <= top + 1:
                s[y, x] = LID_LINE if (st == 'halb' and y == top + 1) or (st == 'zu' and y == 7) else LID
    out = np.zeros((H, W, 4), int)
    oy = PT + rise(i)
    op = jaw_open(i)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = int(round(op * 2 * (CFG['hinge'] - x) / CFG['hinge'])) if CFG['jaw'](x, y) else 0
            out[y + oy + dy, x + P + sway(y, i)] = s[y, x]
    fill_pinholes(out)
    for y in range(GROUND - FADE, GROUND):           # unten in den Boden auslaufen lassen
        f = (GROUND - y) / (FADE + 1)
        out[y, :, 3] = (out[y, :, 3] * f).astype(int)
    out[GROUND:, :, :] = 0
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f"{CFG['prefix']}_idle_{tag}", frames, ms, scale=6, check_edges=True)
