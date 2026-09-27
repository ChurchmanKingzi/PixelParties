# -*- coding: utf-8 -*-
"""Sleeve 23 – „Generals' Duel“: Tharx steht oben in der Loggia des Tempels und zeigt herausfordernd auf
Garius (rechts); der römische Feldherr hält unten vor der Säulenhalle Schild und Speer bereit, vorn steht seine Legion
(von hinten, dem Tempel zugewandt) – dieselbe Anordnung Legion-vor-Garius wie auf seiner Karte.

Runde 3b: ALLES einheitlich 3× (natives Raster 84×117, am Ende verdreifacht). Vorher standen 5×-Generäle
hinter einer 3×-Legion (Vordergrund kleiner als Mittelgrund) – das ist behoben: Legion, Garius, Tharx,
Tempel und Himmel haben dieselbe Pixelgröße, die Staffelung entsteht nur durch Überdeckung.

Quellen (MotiveGrailWar.xcf): Ebene 226 „Ebene #304“ (Tempel mit Loggia; Dachziegel in Draufsicht entfernt,
damit der Giebel vor dem Himmel steht), 224 „Tharx-Kopie“ (Tharx mit Zeigearm, in seiner Original-Lage zur
Loggia aus der xcf, gespiegelt mit dem Tempel), 216 „Garius“ (mit Schild und Speer), 214 „Legionäre“,
228 „Ebene #298“ (Himmel mit Wolken). Karten: Garius the Great Reformer, Tharx the Never-Losing General.
"""
import numpy as np
import cv2
from d_util import *  # noqa

K = 3
nc = native(K)
W, H = nc.w, nc.h
TX0, TY0 = 302, 12                 # Tempel 226, native Ecke
OX, OY = -20, -20                  # Lage des Tempels: Loggia links der Mitte
yy, xx = np.mgrid[0:H, 0:W]

# --- Himmel: Verlauf + Wolken aus Ebene 228 -------------------------------------------------------------
dgrad(nc, 0, 70, [(0, 60, 180), (0, 82, 200), (40, 120, 220)])
sky = region(B, [228], (440, 196, 440 + W, 196 + 20))
cl = sky[..., :3].astype(int).min(-1) > 120                   # nur die Wolkenpixel
for (dx, dy) in [(-10, 0), (30, 12)]:
    ys, xs = np.where(cl)
    ok = (ys + dy >= 0) & (ys + dy < H) & (xs + dx >= 0) & (xs + dx < W)
    nc.a[ys[ok] + dy, xs[ok] + dx] = sky[ys[ok], xs[ok], :3]

# --- Tempel: Dachziegel (orange Draufsicht) entfernen → Giebel vor dem Himmel ---------------------------
temple = region(B, [226], (TX0, TY0, TX0 + 106, TY0 + 115)).copy()
hsv = cv2.cvtColor(temple[..., :3].reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(temple.shape[:2] + (3,))
roof = (hsv[..., 1] > 90) & (temple[..., 0].astype(int) > temple[..., 2].astype(int) + 30)
n, lab, st, _ = cv2.connectedComponentsWithStats(roof.astype(np.uint8), connectivity=8)
roofm = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] > 30])
roofm = cv2.morphologyEx(roofm.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)) > 0
# alles oberhalb der Giebelkante weg (auch dunkle Fugen)
for x in range(temple.shape[1]):
    ys = np.where(roofm[:, x])[0]
    if len(ys): temple[:ys.max() + 1, x, 3] = 0
keep('d23_temple_front', temple)
# Säulenhalle nach unten bis zum Platz verlängern ist nicht nötig: Unterkante liegt bei y = 115 + OY
nc.paste(temple, OX, OY)
# Pflaster-Platz unter der Säulenhalle (Ebene 228, Pflasterfläche)
pl = region(B, [228], (100, 108, 100 + W, 108 + 30))
py0 = OY + 115
nc.a[py0:, :] = pl[:H - py0, :, :3]
nc.a[py0, :] = (70, 60, 70)

# --- Tharx in der Loggia (Original-Lage 224 relativ zu 226) ---------------------------------------------
tharx = compose(B, [224], crop=False)[TY0:TY0 + 115, TX0:TX0 + 106].copy()
# Beine unterhalb der Brüstung (grauer Balken) verdeckt die Loggia-Brüstung → abschneiden
g = tharx[..., :3].astype(int)
bar = (tharx[..., 3] > 0) & (np.abs(g[..., 0] - g[..., 2]) < 12) & (g.max(-1) > 110)
bar_rows = np.where(bar.sum(1) >= 8)[0]
tharx[bar_rows.max() + 1:] = 0
keep('d23_tharx_loggia', tharx)
nc.paste(tharx, OX, OY)

# --- Garius vor der Säulenhalle, rechts; die Legion davor (von hinten) --------------------------------------
garius = sprite('d23_garius', B, [216])
gx, gy = W - 29, H - 36 - 22
blob(nc, gx + 13, gy + 33, 11, 2, (60, 52, 60), 1.0)
nc.paste(garius, gx, gy)
leg = sprite('d23_legion', B, [214])
nc.paste(leg, (W - leg.shape[1]) // 2, H - leg.shape[0])

vignette(nc, 0.3, 0.7)
cv = finish(nc, K)
print(save(cv, '23_generals_duel.png'))
