# -*- coding: utf-8 -*-
"""Sleeve 38 – „Class Photo“: Klassenfoto in der Eingangshalle – mit ungebetenem Gast.

Idee: Gruppenbild der Schüler aus dem Arcanum-Anwesen vor Eingangstür, Standuhr und Gemälden. Hintere Reihe 4×,
vordere Reihe 5×. Hinter der Klasse, genau vor der Tür, steht die verhüllte Gestalt mit roten Augen – nur Tobi
hat etwas bemerkt (sein „?“). Blitzlicht-Look: Klasse hell, Halle dunkel.

Quellen (MotiveArcanum):
  49 „EINGANGSRAUM“ (Wand mit Tür und Uhr, zwei Gemälde, Teppich), 32 „Ebene #55“ (verhüllte Gestalt),
  hintere Reihe: 140 „Wendy“, 126 „Tobi“ (mit ?), 176 „Ebene #7“ (blondes Mädchen), 182 „Ebene #2“,
  vordere Reihe: 146 „Ebene #98“, 12 „Ebene #35“ (Celia), 158 „Albrecht“
"""
from common import *
import numpy as np

A = 'MotiveArcanum'
cv = Canvas(250, 350)
yy, xx = np.mgrid[0:350, 0:250]
hall = layer(A, 49)

def rgba(a):
    return np.dstack([a[..., :3], np.full(a.shape[:2], 255, np.uint8)])

FLOOR = 214
# Teppich (Boden)
carpet = up(rgba(hall[110:126, 600:616]), 3)
for y0 in range(FLOOR, 350, 48):
    for x0 in range(0, 250, 48):
        cv.paste(carpet, x0, y0)
# Wand mit Tür / Uhr (4×)
WX0 = 580
wall = rgba(hall[70:101, WX0:WX0 + 63])
W3 = up(wall, 4)
cv.paste(W3, 0, FLOOR - W3.shape[0])
# darüber: obere Mauerreihen dunkel wiederholt
bricks = up(rgba(hall[86:94, 570:596]), 4)
for y0 in range(FLOOR - W3.shape[0] - 32, -32, -32):
    for x0 in range(-(y0 // 32 % 2) * 24, 250, bricks.shape[1]):
        cv.paste(darken(bricks, 0.7), x0, y0)
cv.rect(0, FLOOR - W3.shape[0] - 4, 250, FLOOR - W3.shape[0], (16, 18, 16))
# Ahnengalerie: die beiden Gemälde der Halle (rechteckig ausgeschnitten), höher gehängt
p1 = up(rgba(hall[72:85, 556:570]), 4)
p2 = up(rgba(hall[72:85, 652:666]), 4)
for pimg, x0 in [(p1, 16), (p2, 250 - 16 - p2.shape[1])]:
    cv.paste(silhouette(pimg, (6, 6, 6)), x0 + 4, 30 + 4, alpha=0.6)
    cv.paste(pimg, x0, 30)
cv.rect(0, FLOOR, 250, FLOOR + 2, (10, 14, 14))

# Halle abdunkeln, Blitzlicht auf die Klasse
d = np.sqrt(((xx - 125) / 1.3) ** 2 + ((yy - 250) / 1.0) ** 2)
t = np.clip((d - 60) / 150, 0, 1) * 0.7
q = np.floor(t * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - q[..., None])).astype(np.uint8)

# ---------- der ungebetene Gast vor der Tür ----------
door_x = (611 - WX0) * 4                     # Türmitte in Canvas-Koordinaten
hood = sprite('f38_hood', A, [32])
Hd = up(hood, 5)
cv.paste(Hd, door_x - Hd.shape[1] // 2, FLOOR + 8 - Hd.shape[0])

def person(idx, key, k, x, bottom):
    s = sprite(key, A, [idx])
    S = up(s, k)
    cv.paste(S, x, bottom - S.shape[0])
    return S

# ---------- hintere Reihe (4×) ----------
BACK = 268
person(140, 'f38_wendy', 4, 2, BACK)
person(126, 'f38_tobi', 4, 58, BACK)
person(176, 'f38_blonde', 4, 128, BACK)
person(182, 'f38_boy', 4, 186, BACK)
# ---------- vordere Reihe (5×) ----------
FRONT = 350
person(146, 'f38_brown', 5, -2, FRONT)
person(12, 'f38_celia', 5, 80, FRONT)
person(158, 'f38_albrecht', 5, 168, FRONT)

save(cv, '38_class_photo.png')
