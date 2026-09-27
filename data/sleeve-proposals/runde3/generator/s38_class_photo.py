# -*- coding: utf-8 -*-
"""Sleeve 38 – „Class Photo“: Klassenfoto in der Eingangshalle – mit ungebetenem Gast.

Idee: Gruppenbild der Schüler des Arcanum-Anwesens vor der großen Eingangstür. Zwei Reihen, beide 4× (die hintere
Reihe steht weiter hinten/höher, die vordere verdeckt ihre Beine – klare Staffelung bei gleicher Pixelgröße).
Über der Klasse schwebt vor der Tür Hel, der Schulgeist, halbtransparent (Alpha auf ganze 4×-Pixel, nach unten
gedithert auslaufend), nur die roten Augen leuchten voll. Nur Tobi hat's bemerkt (sein „?“).
Blitzlicht-Look: Klasse hell, Halle nach außen dunkel (Licht auf dem 4×-Raster gedithert).

Skalierung: alles 4× (Wand, Tür, Standuhr, Gemälde, Teppich, alle Schüler, Hel).

Quellen (MotiveArcanum):
  49 „EINGANGSRAUM“ (Mauer mit Doppeltür x580–643/y70–101, Standuhr x636–650, Gemälde, Teppich),
  32 „Ebene #55“ + 31 „Ebene #112“ (Hel, the Bound Specter – Körper + Brustteil, vgl. Szene „Sichtbar #34“),
  hintere Reihe: 182 „Ebene #2“, 126 „Tobi“ (mit ?), 176 „Ebene #7“, 140 „Wendy“,
  vordere Reihe: 146 „Ebene #98“, 12 „Ebene #35“ (Celia), 158 „Albrecht“
"""
from common import *
from f_util import *
import numpy as np

A = 'MotiveArcanum'
K = 4
cv = Canvas(W, H)
hall = layer(A, 49)

# ---------- Boden: Teppich ----------
FLOOR = 212                                   # Unterkante der Mauer
carpet = up(rgba(hall[112:128, 600:616]), K)
for y0 in range(FLOOR, H, carpet.shape[0]):
    for x0 in range(-8, W, carpet.shape[1]):
        cv.paste(carpet, x0, y0)

# ---------- Mauer mit Tür (Tür mittig) ----------
WX0 = 580
wall = rgba(hall[70:101, WX0:WX0 + 63])
Wl = up(wall, K)
WY = FLOOR - Wl.shape[0]
cv.paste(Wl, 0, WY)
# rechts neben der Tür: Mauerstück von links gespiegelt (statt halber Uhr), dann die ganze Standuhr davor
right = up(rgba(flip(hall[70:101, WX0:WX0 + 15])), K)
cv.paste(right, W - right.shape[1] + 2, WY)
clock = hall[70:102, 636:651].copy()
cl = clock[..., :3].astype(int)
mx, mn = cl.max(-1), cl.min(-1)
cmask = (mx - mn > 22) | (mx > 150)            # Holz/Messing/Zifferblatt statt grauer Mauer
cmask[31:] = cmask[31:] & (mx[31:] - mn[31:] > 30)
clock = rgba(clock); clock[~cmask, 3] = 0
from xcfkit import parts as _parts
clock = max(_parts(clock, dil=0), key=lambda p: (p[..., 3] > 0).sum())
# Ziffernblatt: seine grauen Pixel fallen durch die Farbmaske – alle vom Uhrgehäuse umschlossenen Löcher
# werden mit den Originalpixeln wieder aufgefüllt
import cv2 as _cv2
src = rgba(hall[70:102, 636:651])
ys, xs = np.where(clock[..., 3] > 0)
fullm = np.zeros(src.shape[:2], np.uint8)
oy, ox = None, None
for dy in range(src.shape[0] - clock.shape[0] + 1):          # Lage des Teilstücks im Ausschnitt suchen
    for dx in range(src.shape[1] - clock.shape[1] + 1):
        sub = src[dy:dy + clock.shape[0], dx:dx + clock.shape[1]]
        m = clock[..., 3] > 0
        if (sub[m][:, :3] == clock[m][:, :3]).all(): oy, ox = dy, dx; break
    if oy is not None: break
fullm[oy:oy + clock.shape[0], ox:ox + clock.shape[1]] = (clock[..., 3] > 0).astype(np.uint8)
ff = fullm.copy(); pad = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
_cv2.floodFill(ff, pad, (0, 0), 2)                             # Außenraum markieren
holes = ff == 0
fullm[holes] = 1
clock = src.copy(); clock[fullm == 0, 3] = 0
ys, xs = np.where(fullm > 0)
clock = clock[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
put(cv, clock, 196, FLOOR, K, 'bl')
# obere Mauer: Steinreihen der Wand, dunkler
bricks = up(rgba(hall[86:94, 570:594]), K)
for r, y0 in enumerate(range(WY - bricks.shape[0], -bricks.shape[0], -bricks.shape[0])):
    for x0 in range(-(r % 2) * 48 - 8, W, bricks.shape[1]):
        cv.paste(darken(bricks, 0.62), x0, y0)
cv.rect(0, WY - K, W, WY, (18, 20, 18))
# Gemälde (Ahnengalerie) oben links/rechts
p1 = up(rgba(hall[72:85, 556:570]), K)
p2 = up(rgba(hall[72:85, 652:666]), K)
for pimg, x0 in [(p1, 12), (p2, W - 12 - p2.shape[1])]:
    drop(cv, pimg, x0, 20, K, alpha=0.5)
    cv.paste(pimg, x0, 20)
cv.rect(0, FLOOR, W, FLOOR + K, (12, 16, 16))   # Sockelschatten

# ---------- Licht: Blitzlicht auf die Klasse, Halle dunkel (4×-Raster) ----------
cx, cy, th = grid(K)
d = np.sqrt(((cx - 125) / 1.3) ** 2 + ((cy - 230) / 1.1) ** 2)
shade(cv, np.clip((d - 80) / 140, 0, 1) * 0.6, th)

# ---------- Hel, der Schulgeist (halbtransparent, schwebt vor der Tür) ----------
hel = sprite('f38_hel', A, [31, 32])
He = up(hel, K)
HX, HY = 125 - He.shape[1] // 2, 78
rgb = He[..., :3].astype(int)
eyes = (rgb[..., 0] > 150) & (rgb[..., 1] < 60) & (np.arange(He.shape[0])[:, None] < 16 * K)
ghost(cv, He, HX, HY, K, alpha=0.6, fade_from=0.62, tint_col=(170, 210, 220), tint_t=0.2, keep=eyes)


def person(idx, key, x, bottom):
    s = sprite(key, A, [idx])
    S = up(s, K)
    y = bottom - S.shape[0]
    ellipse_shadow(cv, x + S.shape[1] / 2, bottom - K, S.shape[1] * 0.42, 6, K, alpha=0.4)
    cv.paste(S, x, y)
    return S


# ---------- hintere Reihe (4×, weiter hinten) ----------
BACK = 290
person(182, 'f38_boy', 0, BACK)
person(126, 'f38_tobi', 58, BACK)
person(176, 'f38_blonde', 126, BACK)
person(140, 'f38_wendy', 196, BACK)
# ---------- vordere Reihe (4×) ----------
FRONT = 346
person(146, 'f38_brown', 22, FRONT)
person(12, 'f38_celia', 92, FRONT)
person(158, 'f38_albrecht', 166, FRONT)

save(cv, '38_class_photo.png')
