# -*- coding: utf-8 -*-
"""Sleeve 23 – „Generals' Duel“: Spiegelkomposition – Garius (Rom) und Tharx (Sparta) stehen sich vor dem
Tempel gegenüber, Tharx fordert mit ausgestrecktem Arm heraus; im Vordergrund sieht man die Legion von hinten.

Quellen (MotiveGrailWar.xcf): Ebene 228 „Ebene #298“ (Himmel mit Wolken und Pflasterplateau, 2×),
227 „Ebene #301“ (Tempel, 2×), 216 „Garius“ (5×), 224 „Tharx-Kopie“ (Tharx mit ausgestrecktem Arm; die
Zeilen mit dem grauen Sockelbalken durch die Füße aus 225 „Tharx“ ersetzt, gespiegelt, 5×),
214 „Legionäre“ (von hinten, 3×). Karten: Garius the Great Reformer, Tharx the Never-Losing General.
"""
import numpy as np
from d_util import *  # noqa

cv = Canvas(250, 350)
sky = region(B, [228], (408, 200, 533, 375))
fill_bg(cv, sky, 2)
# Pflaster-Plateau als Boden
floor = region(B, [228], (95, 100, 220, 200))
fill_bg(cv, floor, 2, 0, 190)
# Kante zwischen Tempelstufe und Platz: dunkle Linie
cv.a[190:192, :] = (70, 60, 70)

temple = sprite('d23_temple', B, [227]).copy()
# Dachziegel (Draufsicht) entfernen → nur Giebel + Säulenhalle als Frontansicht vor dem Himmel
import cv2
hsv = cv2.cvtColor(temple[..., :3].reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(temple.shape[:2] + (3,))
roof = (hsv[..., 1] > 90) & (temple[..., 0].astype(int) > temple[..., 2].astype(int) + 30)
n, lab, st, _ = cv2.connectedComponentsWithStats(roof.astype(np.uint8), connectivity=8)
big = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 30]
roofm = np.isin(lab, big)
# auch die dunklen Fugen zwischen den Ziegeln (umschlossen von Dach) entfernen
roofm = cv2.morphologyEx(roofm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
temple[roofm, 3] = 0
temple = hsv_shift(temple, 0, 0.9, 0.95)
keep('d23_temple_front', temple)
put(cv, temple, 125, 200, 2, anchor='b')

# Tharx: Oberkörper mit Zeigearm (224), Beine ohne Sockelbalken (225)
L224 = compose(B, [224], crop=False); L225 = compose(B, [225], crop=False)
th = L224.copy(); th[92:] = L225[92:]
th = th[60:99, 343:370]
th = th[:, np.where(th[..., 3].any(0))[0].min():np.where(th[..., 3].any(0))[0].max() + 1]
keep('d23_tharx', th)
garius = sprite('d23_garius', B, [216])

k = 5
GY = 300                                          # Standlinie
put(cv, garius, 0, GY - garius.shape[0] * k, k, shadow=(40, 34, 40), sh_off=(2, 1), sh_alpha=0.45)
tx = 250 - th.shape[1] * k + 6
put(cv, th, tx, GY - th.shape[0] * k, k, fl=True, shadow=(40, 34, 40), sh_off=(-2, 1), sh_alpha=0.45)

# Legion von hinten als Vordergrund-Reihe (symmetrisch zugeschnitten)
leg = sprite('d23_legion', B, [214])
L = up(leg, 3)
off = (L.shape[1] - 250) // 2
cv.paste(L[:, off:off + 250], 0, 350 - 74)

vignette(cv, 0.35, 0.65)
frame(cv, [(40, 10, 10), (220, 180, 70), (150, 30, 30)])
print(save(cv, '23_generals_duel.png'))
