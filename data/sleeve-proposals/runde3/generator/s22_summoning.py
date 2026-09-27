# -*- coding: utf-8 -*-
"""Sleeve 22 – „The Summoning“: Kohta liest im Kellergewölbe die Beschwörungsanleitung vor, magische Blitze
schlagen im Beschwörungskreis zusammen und der Geist des Super-Killing-Messers erscheint.

Quellen (MotiveGrailWar.xcf): Ebene 697 „Beschwörungsraum Keller“ (Boden mit Kreis, 2×, abgedunkelt),
598 „Core Explosion“ (nur die Blitze, per Farbfilter von den Figuren getrennt, magenta umgefärbt, 2×),
664 „Knife Spirit“ (4×, schwebt über dem Kreis), 565 „Summoning Instructions“ (Kohta mit Anleitung, 4×), 482 „Zi #4“ (Funkeln, 2×).
Karten: Summoning Instructions, Spirit of the Super-Killing Knife, Kohta Master of Super-Killing.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
RX, RY = 176, 163
room = region(B, [697], (RX, RY, RX + 125, RY + 175))
room = hsv_shift(room, 0, 1.0, 0.5)
fill_bg(cv, room, 2)
CX, CY = (238 - RX) * 2, (250 - RY) * 2           # Mitte des Beschwörungskreises

# Kreis-Linien zum Leuchten bringen: dunkelrote Pixel des Kreises → Magenta
a = cv.a.astype(int)
red = (a[..., 0] > a[..., 1] + 25) & (a[..., 0] > a[..., 2] + 20) & (a.max(-1) < 110)
yy, xx = np.mgrid[0:350, 0:250]
inc = np.hypot(xx - CX, yy - CY) < 56
ring = red & inc
cv.a[ring] = (236, 90, 220)
import cv2 as _c
halo = (_c.dilate(ring.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~ring
cv.a[halo] = np.clip(cv.a[halo].astype(int) * 0.5 + np.array((150, 50, 140)) * 0.5, 0, 255).astype(np.uint8)

# Lichtschein um den Kreis (geditherter Radialverlauf)
d = np.hypot((xx - CX) / 1.1, yy - CY) / 110.0
t = np.clip(1 - d, 0, 1)
lit = t * 0.9 > BAYER8[yy % 8, xx % 8] + 0.1
cv.a[lit] = np.clip(cv.a[lit].astype(int) + (40, 10, 46), 0, 255)
lit2 = t * 1.6 > BAYER8[yy % 8, xx % 8] + 0.9
cv.a[lit2] = np.clip(cv.a[lit2].astype(int) + (30, 8, 34), 0, 255)

# --- Blitze der Core Explosion: nur türkis/weiße Pixel ------------------------------------------------
ce = compose(B, [598], crop=False)[122:276, 65:238].copy()
c = ce[..., :3].astype(int)
bolt_m = (c[..., 1] > 150) & (c[..., 2] > 150) & (c[..., 0] < c[..., 1] - 10) | (c.min(-1) > 225)
ce[~bolt_m, 3] = 0
# die kleinen Spitzen der pinken Kreaturen / Figuren liegen nicht auf Blitzlinien: nur große Teile behalten
import cv2
n, lab, st, _ = cv2.connectedComponentsWithStats((ce[..., 3] > 0).astype(np.uint8), connectivity=8)
big_parts = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 40]
ce[~np.isin(lab, big_parts), 3] = 0
ce = hsv_shift(ce, 120, 1.0, 1.0)                  # türkis → magenta
keep('d22_bolts', ce)
bx, by = CX - (131 - 65) * 2, CY - (213 - 122) * 2
cv.paste(outline(up(ce, 2), (120, 30, 120)), bx - 1, by - 1, alpha=0.6)
put(cv, ce, bx, by, 2)

# --- beschworener Geist im Kreis ---------------------------------------------------------------------
spirit = sprite('d22_knife_spirit', B, [664])
put(cv, spirit, CX, CY - 2, 4, anchor='b', shadow=(40, 10, 50), sh_off=(0, 1), sh_alpha=0.6)
spark = sprite('d22_sparkles', B, [482])
put(cv, spark, 190, 24, 2)
put(cv, flip(spark), 8, 60, 2)

# --- Kohta mit der Anleitung im Vordergrund ------------------------------------------------------------
kohta = sprite('d22_kohta', B, [565])
put(cv, kohta, 172, 348, 4, anchor='b', shadow=(10, 6, 14), sh_off=(1, 0), sh_alpha=0.6)

vignette(cv, 0.6, 0.5)
frame(cv, [(14, 6, 18), (200, 80, 190), (80, 30, 80)])
print(save(cv, '22_summoning.png'))
