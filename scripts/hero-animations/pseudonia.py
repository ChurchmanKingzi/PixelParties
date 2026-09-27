# -*- coding: utf-8 -*-
"""Idle-Animation für Pseudonia, the Skill Devourer und den Skin Imperfect
Pseudonia (MotiveSteamDwarfs.xcf).

Aufruf: python3 pseudonia.py <tag> [ms] [hero|imperfect]

Pseudonia hält ihr Opfer und hat sich in seinen Hals verbissen.
* Sie frisst: viermal pro Loop beißt sie nach (ihr Kopf stößt 1 px ins
  Opfer), das Opfer zuckt zurück, die Bisswunde leuchtet auf und Blut spritzt
  in kleinen Tropfen heraus (nur ins Freie, einzelne Pixel).
* Ihre Flügel schlagen langsam (spaltentreu geschert).
* imperfect: der grüne Schwanzring (liegt vor ihr) pendelt sachte hin und her.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import shear_flap, fill_pinholes

V = next((v for v in sys.argv[2:] if v in ('hero', 'imperfect')), 'hero')
if V == 'hero':
    BODY = np.array(Image.open('src/pseudonia-the-skill-devourer.png').convert('RGBA')).astype(int)
    RING = TIP = None
    OY = 0                                           # Lage der Figur im Sprite
    PREFIX = 'pseudonia'
else:
    BODY = np.array(Image.open('src/imperfect-pseudonia-body.png').convert('RGBA')).astype(int)
    RING = np.array(Image.open('src/imperfect-pseudonia-ring.png').convert('RGBA')).astype(int)
    TIP = np.array(Image.open('src/imperfect-pseudonia-tip.png').convert('RGBA')).astype(int)
    OY = 7
    PREFIX = 'imperfect_pseudonia'
SH, SW = BODY.shape[:2]
P, PT, PB = 4, 4, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
WING_COLS = {rgb(c) for c in ('1f1f1f', 'f6ffff', '7c7c7c', 'bdbdbd', '363636', '6e6e6e', '888888', '434343',
                              '0f0f0f', '666666', '000000', '000200', '383838')}
_xs = np.arange(SW)[None, :].repeat(SH, 0)
_ys = np.arange(SH)[:, None].repeat(SW, 1)
_cols = np.array([[tuple(BODY[y, x]) in WING_COLS for x in range(SW)] for y in range(SH)])
WING_L = (BODY[:, :, 3] > 0) & _cols & (_xs <= 7) & (_ys - OY <= 12)
WING_R = (BODY[:, :, 3] > 0) & _cols & (_xs >= 19) & (_ys - OY <= 14)
HEAD = [(x, y) for y in range(OY + 2, OY + 9) for x in range(8, 14) if BODY[y, x, 3] and not WING_L[y, x]]
VICTIM = [(x, y) for y in range(OY + 2, OY + 9) for x in range(14, 19) if BODY[y, x, 3]]
HEAD_SET, VICTIM_SET = set(HEAD), set(VICTIM)
BITE = (14, OY + 5)                                  # Bisswunde
BLOOD = [rgb('930200'), rgb('b30000'), rgb('ff3030')]
SPRAY = [(1, -2), (2, -3), (-1, -3), (3, -2)]        # Flugbahnen der Tropfen (Endpunkte)


def bite(i):
    """(Kopfstoß, Zucken des Opfers, Frame im Biss)"""
    t = i % 12
    return (1 if t in (0, 1) else 0), (1 if t in (1, 2) else 0), t


def frame(i):
    out = np.zeros((H, W, 4), int)
    head_dx, vic_dx, t = bite(i)
    ph = 2 * math.pi * i / 16
    lift, sq = 0.28 * math.sin(ph), 0.88 + 0.12 * math.cos(ph)
    shear_flap(BODY, WING_L, 7.5, -1, lift, sq, out, (P, PT))
    shear_flap(BODY, WING_R, 19.0, 1, lift, sq, out, (P, PT))
    for y in range(SH):
        for x in range(SW):
            if not BODY[y, x, 3] or WING_L[y, x] or WING_R[y, x]:
                continue
            dx = head_dx if (x, y) in HEAD_SET else (vic_dx if (x, y) in VICTIM_SET else 0)
            out[y + PT, x + P + dx] = BODY[y, x]
    fill_pinholes(out)
    bx, by = BITE[0] + P, BITE[1] + PT
    if t in (0, 1, 2):                               # Bisswunde leuchtet
        out[by, bx] = BLOOD[2] if t == 1 else BLOOD[1]
    if 1 <= t <= 4:                                  # Blut spritzt
        f = (t - 1) / 3
        for k, (ex, ey) in enumerate(SPRAY[(i // 12) % 2::2]):
            x, y = bx + int(round(ex * f)) + 1, by + int(round(ey * f))
            if 1 <= x < W - 1 and 1 <= y < H - 1 and not out[y, x, 3]:
                out[y, x] = BLOOD[1] if t < 4 else BLOOD[0]
    if RING is not None:                             # Schwanzring pendelt, liegt vor ihr
        rdx = int(round(math.sin(2 * math.pi * i / 24)))
        for part in (TIP, RING):
            for y, x in zip(*np.nonzero(part[:, :, 3])):
                out[y + PT, x + P + rdx] = part[y, x]
        fill_pinholes(out)                           # Spalten zwischen Ring und Figur
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
