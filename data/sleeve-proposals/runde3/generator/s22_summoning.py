# -*- coding: utf-8 -*-
"""Sleeve 22 – „The Summoning“: Im dunklen Kellergewölbe glüht der Beschwörungskreis auf dem Holzpodest,
magentafarbene Entladungen springen von den Kerzen zur Mitte, darüber schwebt der beschworene Geist des
Super-Killing-Messers. Vorn am Podestrand steht Kohta mit der Beschwörungsanleitung und dem Messer.

Runde 3b: ALLES einheitlich 3× – Kellerboden, Podest, Geist, Kohta, Funken und Entladungen werden im nativen
Raster (84×117) komponiert und erst am Ende verdreifacht (vorher: Raum 2×, Figuren 4×).

Quellen (MotiveGrailWar.xcf): Ebene 697 „Beschwörungsraum Keller“ (Steinboden, Podest mit Kreis und Kerzen;
abgedunkelt, Kreislinien magenta umgefärbt), 664 „Knife Spirit“, 565 „Summoning Instructions“
(Kohta mit Anleitung und Messer), 482 „Zi #4“ (Funkeln).
Lichtschein und Entladungen: selbst gezeichnet (1 natives Pixel, geordnetes Dithering).
Karten: Summoning Instructions, Spirit of the Super-Killing Knife, Kohta Master of Super-Killing.
"""
import numpy as np
import cv2
from d_util import *  # noqa

K = 3
nc = native(K)
W, H = nc.w, nc.h
RX, RY = 196, 198
room = region(B, [697], (RX, RY, RX + W, RY + H))
nc.a[:] = room[..., :3]
CX, CY = 238 - RX, 250 - RY                         # Mitte des Beschwörungskreises
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot(xx - CX, yy - CY)

# Kreis-/Pentagrammlinien (dunkelrot) → leuchtendes Magenta; Kerzenflammen bleiben
a = nc.a.astype(int)
lines = (a[..., 0] > 30) & (a[..., 1] < 20) & (a[..., 2] < 20) & (r < 30)   # Linienfarbe (52,0,0)
# Raum abdunkeln (Lichtabfall zur Mitte hin schwächer, geditherte Stufen)
lit = np.clip(1 - r / 70.0, 0, 1)
f = 0.32 + 0.5 * np.floor((lit * 3 + BAYER8[yy % 8, xx % 8]) ) / 3.0
nc.a[:] = np.clip(a * np.clip(f, 0, 1)[..., None], 0, 255).astype(np.uint8)
# magentafarbener Schein auf dem Podest
glow = np.clip(1 - r / 34.0, 0, 1)
m1 = glow * 1.3 > BAYER8[yy % 8, xx % 8] + 0.35
nc.a[m1] = np.clip(nc.a[m1].astype(int) * 0.7 + np.array((90, 20, 90)) * 0.5, 0, 255).astype(np.uint8)
nc.a[lines] = (240, 96, 226)
halo = (cv2.dilate(lines.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~lines
nc.a[halo] = np.clip(nc.a[halo].astype(int) * 0.5 + np.array((150, 40, 140)) * 0.5, 0, 255).astype(np.uint8)

# --- Entladungen: von den Kerzen zur Kreismitte (selbst gezeichnet) -------------------------------------
rng = np.random.RandomState(5)
def arc(p0, p1, n=4, jit=2):
    pts = [p0]
    for i in range(1, n):
        t = i / n
        pts.append((int(p0[0] + (p1[0] - p0[0]) * t + rng.randint(-jit, jit + 1)),
                    int(p0[1] + (p1[1] - p0[1]) * t + rng.randint(-jit, jit + 1))))
    pts.append(p1)
    mk = np.zeros((H, W), np.uint8)
    for u, v in zip(pts[:-1], pts[1:]):
        cv2.line(mk, u, v, 1, 1, lineType=4)
    return mk > 0

# Kerzen: helle Pixel (Flammen) innerhalb des Kreises
c = room[..., :3].astype(int)
fl = (c[..., 0] > 240) & (c[..., 1] > 100) & (c[..., 2] < 130) & (r < 30)
n, lab, st, cen = cv2.connectedComponentsWithStats(fl.astype(np.uint8), connectivity=8)
candles = [tuple(int(v) for v in cen[i]) for i in range(1, n)]
bolt = np.zeros((H, W), bool)
for p in candles:
    bolt |= arc(p, (CX, CY - 1), n=3, jit=2)
bh = (cv2.dilate(bolt.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~bolt
nc.a[bh] = np.clip(nc.a[bh].astype(int) * 0.4 + np.array((200, 60, 190)) * 0.6, 0, 255).astype(np.uint8)
nc.a[bolt] = (255, 200, 250)
nc.a[fl] = room[..., :3][fl]                                   # Kerzenflammen in voller Helligkeit
# Energiekern in der Kreismitte
blob(nc, CX, CY - 1, 7, 3, (230, 110, 220), 1.0)
blob(nc, CX, CY - 1, 4, 2, (255, 214, 250), 1.0)

# --- beschworener Geist über der Kreismitte -------------------------------------------------------------
spirit = sprite('d22_knife_spirit', B, [664])
sx, sy, sw, sh = put(nc, spirit, CX, CY - 7, anchor='b')      # schwebt über dem Kern
spark = sprite('d22_sparkles', B, [482])
nc.paste(spark[:24], CX - 18, 2)

# --- Kohta mit der Anleitung vorn am Podestrand -------------------------------------------------------
kohta = sprite('d22_kohta', B, [565])
blob(nc, 44, 115, 12, 2, (14, 10, 16), 1.0)
put(nc, kohta, 44, 115, anchor='b')

vignette(nc, 0.4, 0.6)
cv = finish(nc, K)
print(save(cv, '22_summoning.png'))
