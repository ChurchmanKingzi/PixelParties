# -*- coding: utf-8 -*-
"""Idle-Animation für Cute Annoyance Mini (Sprite aus MotiveMoe.xcf).

* Acht Flügel (vier je Seite): die hinteren drei je Seite (Ebene „Mini“) und
  das vordere Paar (graue Pixel in „Mini #2“) schlagen schnell auf und ab,
  spaltentreu geschert und gestaucht (flap_common.shear_flap – bei so kleinen
  Flügeln bleibt die Pixelstruktur so erhalten), das vordere Paar leicht
  versetzt. Beim Abschlag hebt sie sich ein Stück.
* Fieser Blick: verengte Augen, V-förmige Brauen.
* Sie lacht in der zweiten Loop-Hälfte: der weiße Strich im Gesicht (ihr
  zahniges Grinsen) wird breiter und öffnet sich stoßweise („hehehe“), der
  Kopf ruckt dabei mit.
* Der Rock flattert: die Seitenbahnen schwingen abwechselnd nach außen,
  die Säume zipfeln.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import shear_flap

BODY = np.array(Image.open('src/cute-annoyance-mini-body.png').convert('RGBA')).astype(int)
BACK = np.array(Image.open('src/cute-annoyance-mini-wings.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
GREY = {rgb(c) for c in ('3f3e40', '848286', 'a3a1a6', 'c4c9cc')}
FRONT_MASK = np.zeros((SH, SW), bool)
for y in range(SH):
    for x in range(SW):
        if BODY[y, x, 3] and (x <= 7 or x >= 26) and tuple(BODY[y, x]) in GREY:
            FRONT_MASK[y, x] = True
FIG = BODY.copy()
FIG[FRONT_MASK] = 0
BACK_MASK = BACK[:, :, 3] > 0
MID_X = 17
PIV_BACK = {-1: 11, 1: 22}
PIV_FRONT = {-1: 8, 1: 25}

P = 5
H, W = SH + 2 * P, SW + 2 * P
N = 32
FLAP = 8


def wing_pose(i, lag=0.0):
    """(lift, squeeze): Spitzen hoch + leicht angelegt / runter + gespreizt."""
    p = 2 * math.pi * (i % FLAP) / FLAP - lag
    s = math.sin(p)
    lift = 0.55 * s if s > 0 else 0.4 * s
    squeeze = 0.8 + 0.2 * math.cos(p)
    return lift, squeeze


def body_dy(i):
    return -1 if math.sin(2 * math.pi * (i % FLAP) / FLAP - 2.0) > 0.2 else 0


L = rgb('241313')
HAIR = rgb('976047')
WHITE = rgb('ffffff')
MOUTH, MOUTH_IN = rgb('410003'), rgb('7a0a10')


def face(s, i):
    """Fieser Blick + Lachen (Koordinaten im Figurenbild)."""
    s[9, 14] = s[9, 15] = s[9, 18] = s[9, 19] = L      # verengte Augen
    s[7, 14] = s[7, 19] = L                             # Brauen außen hoch …
    s[8, 15] = s[8, 18] = L                             # … innen tief (V)
    s[8, 14] = s[8, 19] = HAIR
    t = i - N // 2
    if t < 0:
        return 0
    # Lachen: breites Grinsen, Mund geht stoßweise auf
    for x in (15, 16, 17, 18):
        s[12, x] = WHITE
    open_ = (t % 4) < 2 and t < 14
    if open_:
        s[13, 15], s[13, 16], s[13, 17], s[13, 18] = MOUTH, MOUTH_IN, MOUTH_IN, MOUTH
    return -1 if open_ else 0                           # Kopf ruckt beim „he“


SKIRT = {rgb(c) for c in ('07071a', '2e1f83', '452ec4', '0a0a27')}
SK_OUT, SK_FILL = rgb('07071a'), rgb('2e1f83')


def skirt(s, i):
    """Seitenbahnen flattern: eine Kontur nach außen, alte Kontur wird Stoff."""
    for y in range(19, 25):
        for side in (-1, 1):
            xs = [x for x in range(SW) if s[y, x, 3] and tuple(s[y, x]) in SKIRT
                  and ((x <= 13) if side < 0 else (x >= 20))]
            if not xs:
                continue
            ph = 2 * math.pi * i / 12 - 0.9 * (y - 19) + (0 if side < 0 else math.pi)
            if math.sin(ph) > 0.25:
                edge = min(xs) if side < 0 else max(xs)
                nx = edge + side
                if 0 <= nx < SW and not s[y, nx, 3]:
                    s[y, edge] = SK_FILL if y < 24 else SK_OUT
                    s[y, nx] = SK_OUT
    # Saumzipfel unten
    if (i // 3) % 2:
        for x in (12, 21):
            if not s[24, x, 3]:
                s[24, x] = SK_OUT


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = body_dy(i)
    off = (P, P + dy)
    cols = np.arange(SW)[None, :]
    for src, mask, piv, lag in ((BACK, BACK_MASK, PIV_BACK, 0.0), (BODY, FRONT_MASK, PIV_FRONT, 1.0)):
        lift, sq = wing_pose(i, lag)
        for side in (-1, 1):
            m = mask & ((cols < MID_X) if side < 0 else (cols >= MID_X))
            shear_flap(src, m, piv[side], side, lift, sq, out, off, curve=1.3)
    s = FIG.copy()
    head = face(s, i)
    skirt(s, i)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                yy = y + P + dy + (head if y <= 14 else 0)
                out[yy, x + P] = s[y, x]
    if head:                                            # Hals-Lücke schließen
        for x in range(SW):
            if s[14, x, 3] and not out[14 + P + dy, x + P, 3]:
                out[14 + P + dy, x + P] = s[14, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mini_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=8)
