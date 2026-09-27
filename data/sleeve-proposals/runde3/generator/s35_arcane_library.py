# -*- coding: utf-8 -*-
"""Sleeve 35 – „Arcane Library“: Atta, Sprecherin der Wünsche, lässt in der Bibliothek die Bücher kreisen.

Idee: Nahaufnahme der Karte „Atta, Speaker of Desires“: Atta (6×) steht zwischen hohen Bücherregalen (3×),
um sie herum schweben aufgeschlagene Bücher auf einer Spirale (4× vorn, 3× hinten) mit Funkeln;
unter den vorderen Büchern liegen ihre Schatten auf dem Teppich.

Quellen (MotiveArcanum):
  166 „BIBLIOTHEK“ (Regalwand x177–352/y112–167, Teppichboden), 163 „Atta“, 164 „Ebene #32“ (4 schwebende
  Bücher + Schatten), 157 „Dangerous Knowledge“ (Buch mit Seiten), 180 „Ebene #4“ (offenes Buch),
  11 „Ebene #95“ (Funkeln)
"""
from common import *
import numpy as np

A = 'MotiveArcanum'
cv = Canvas(250, 350)
yy, xx = np.mgrid[0:350, 0:250]
lib = layer(A, 166)

def rgba(a):
    return np.dstack([a[..., :3], np.full(a.shape[:2], 255, np.uint8)])

# ---------- Boden: Teppich (8×8-Muster, 3×) mit Lichtkegel ----------
tile = up(rgba(lib[184:192, 288:296]), 3)
for y0 in range(0, 350, 24):
    for x0 in range(0, 250, 24):
        cv.paste(tile, x0, y0)
# ---------- Regalwand ----------
FLOOR = 222
strip = rgba(lib[106:167, 177:352])          # Gesims + Regal + Lampe + Regal + Schrank + Regal
S3 = up(strip, 3)
# hintere, obere Regalreihe (dunkler)
cv.paste(darken(S3, 0.45), -150, FLOOR - 2 * S3.shape[0] + 30)
# Hauptreihe
cv.paste(darken(S3, 0.9), -140, FLOOR - S3.shape[0])
cv.rect(0, FLOOR, 250, FLOOR + 2, (20, 26, 24))

# Licht: heller Kegel um Atta, Rand dunkel (Dithering)
d = np.sqrt(((xx - 125) / 1.0) ** 2 + ((yy - 230) / 1.25) ** 2)
t = np.clip((d - 60) / 150, 0, 1) * 0.75
q = np.floor(t * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - q[..., None])).astype(np.uint8)
warm = np.array([230, 210, 150])
t2 = np.clip(1 - d / 80, 0, 1) * 0.25
q2 = np.floor(t2 * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - q2[..., None]) + warm * q2[..., None]).astype(np.uint8)

# ---------- Bücher ----------
raw = layer(A, 164)
bk = parts(sprite('f35_books', A, [164]), dil=0)        # 4 Bücher (rot, orange, grün, blau)
dk = sprite('f35_dk', A, [157])
ob = sprite('f35_openbook', A, [180])
shadow_m = (raw[..., 3] > 0) & (raw[..., 3] < 128)
sb = bbox(np.dstack([raw[..., :3], shadow_m.astype(np.uint8) * 255]))
shadow = shadow_m[sb[1]:sb[3], sb[0]:sb[2]]
# erste Schattenform (links) als Vorlage
from xcfkit import parts as _p
sh = np.zeros(shadow.shape + (4,), np.uint8); sh[shadow, 3] = 255
sh1 = _p(sh, dil=0)[0][..., 3] > 0

def shade(x, y, k):
    m = up(sh1[..., None].astype(np.uint8), k)[..., 0] > 0
    h, w = m.shape
    sub = cv.a[y:y + h, x:x + w]
    mm = m[:sub.shape[0], :sub.shape[1]]
    sub[mm] = (sub[mm] * 0.55).astype(np.uint8)

import math
K_ATTA = 6
atta = sprite('f35_atta', A, [163])
At = up(atta, K_ATTA)
AX, AY = 125 - At.shape[1] // 2, 330 - At.shape[0]
CX, CY, RX, RY = 125, 232, 98, 64           # Umlaufbahn der Bücher (Ellipse um Attas Brust)
orbit = [(bk[2], 196), (flip(bk[1]), 246), (ob, 294), (bk[3], 344),   # hinten
         (bk[0], 150), (dk, 30)]                                        # vorn
def pos(ang, s, k):
    x = CX + RX * math.cos(math.radians(ang)); y = CY + RY * math.sin(math.radians(ang))
    return int(x - s.shape[1] * k / 2), int(y - s.shape[0] * k / 2)

# ferne Bücher weiter oben vor den Regalen (klein, dunkler)
for s_, x, y in [(bk[1], 34, 58), (flip(bk[2]), 176, 40), (bk[3], 112, 16)]:
    cv.paste(darken(up(s_, 2), 0.75), x, y)

back = [(s_, a_) for s_, a_ in orbit if math.sin(math.radians(a_)) < 0]
front = [(s_, a_) for s_, a_ in orbit if math.sin(math.radians(a_)) >= 0]
for s_, a_ in back:
    x, y = pos(a_, s_, 3); cv.paste(darken(up(s_, 3), 0.85), x, y)
# Schatten auf dem Teppich (unter Atta und unter den vorderen Büchern)
cv.paste(silhouette(up(sh1[..., None].repeat(4, -1).astype(np.uint8) * 255, 7), (0, 0, 0)), 125 - 56, 318, alpha=0.45)
for s_, a_ in front:
    x, y = pos(a_, s_, 4); shade(x + 4, y + s_.shape[0] * 4 + 26, 4)
cv.paste(At, AX, AY)
for s_, a_ in front:
    x, y = pos(a_, s_, 4); cv.paste(up(s_, 4), x, y)

# Funkeln entlang der Bahn
sp = sprite('f35_sparkle', A, [11])
for (x, y, k) in [(22, 196, 2), (196, 206, 2), (60, 128, 1), (180, 118, 1), (150, 70, 1), (84, 96, 1)]:
    cv.paste(up(sp, k), x, y)

save(cv, '35_arcane_library.png')
