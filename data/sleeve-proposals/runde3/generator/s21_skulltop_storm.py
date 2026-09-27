# -*- coding: utf-8 -*-
"""Sleeve 21 – „Skulltop Storm“: Die Skulltop-Burg auf dem riesigen Gigantisaurier-Schädel in einer
Gewitternacht; ein Blitz schlägt in die goldene Hauptturmspitze, Schneeregen, vereister Grat dahinter.

Runde 3b: ALLES einheitlich 3× – Himmel, Grat, Schneefeld, Schädel, Burg, Blitz und Regen werden im
nativen Raster (84×117) komponiert und erst am Ende verdreifacht. Blitz und Regen sind selbst gezeichnet
(1 natives Pixel breit = gleiche Pixelgröße wie die Burg), statt des feinen 2×-Blitz-Sprites.

Quellen (MotiveGrailWar.xcf): Ebene 490 „Skulltop Castle“ und 496 „Gigantisaur Skull“ (in der Lage zueinander
wie im Kartenmotiv „Skulltop“), 476 „Ebene #139“ (Eisgrat + Schneefeld, nächtlich umgefärbt).
Himmel, Wolken, Blitz, Regen: selbst gezeichnet (geordnetes Dithering). Karten: Gigantisaur Skull, Skulltop Castle.
"""
import numpy as np
import cv2
from d_util import *  # noqa

K = 3
nc = native(K)                                   # 84×117
W, H = nc.w, nc.h
NIGHT = [(8, 6, 20), (18, 12, 40), (34, 24, 66), (52, 40, 90)]
dgrad(nc, 0, H, NIGHT)
yy, xx = np.mgrid[0:H, 0:W]

# Wolkenbänder (selbst gezeichnet, geditherte Aufhellung)
v = 0.5 + 0.5 * np.sin(xx / 9.0 + yy / 4.0) * np.sin(xx / 19.0 - yy / 7.0)
m = (v * np.clip(1 - yy / 60.0, 0, 1) * 0.9 > BAYER8[yy % 8, xx % 8] + 0.2)
nc.a[m] = np.clip(nc.a[m].astype(int) + (20, 16, 32), 0, 255)

# Lichtschein des Blitzes am Himmel
SPX, SPY = 44, 37                                # Spitze des goldenen Mittelturms (wird unten gesetzt)
d = np.hypot((xx - 36) / 1.2, yy - 12) / 45.0
t = np.clip(1 - d, 0, 1)
m = t > BAYER8[yy % 8, xx % 8] * 0.9 + 0.12
nc.a[m] = np.clip(nc.a[m].astype(int) + (22, 20, 40), 0, 255)

# --- ferner Eisgrat (Ebene 476), oberhalb der Eiskante freigestellt, nachtblau --------------------------
ice = region(B, [476], (196, 82, 196 + W, 82 + 64)).copy()
c = ice[..., :3].astype(int)
blue = (c[..., 2] - c[..., 0] > 60) & (c.max(-1) < 215)
for x in range(ice.shape[1]):
    ys = np.where(blue[:, x])[0]
    ice[:(ys.min() if len(ys) else ice.shape[0]), x, 3] = 0
ice = hsv_shift(ice, 8, 0.8, 0.45)
# Schneefläche unterhalb der Eiskante: als dunkler Berghang einfärben (geditherte Nachtfarbe)
iy, ix = np.mgrid[0:ice.shape[0], 0:ice.shape[1]]
slope = (ice[..., 3] > 0) & ~blue
ice[slope, :3] = np.where((BAYER8[iy % 8, ix % 8] > 0.5)[..., None], np.array((26, 30, 58)), np.array((34, 38, 70)))[slope]
nc.paste(ice, 0, 44)
nc.paste(flip(ice)[:, :40], 0, 52)               # zweiter, näherer Grat links

# --- Schneefeld unten: selbst gezeichneter, geditherter Nachtschnee mit heller Kante -----------------------
sm = np.zeros((H, W), bool)
for x in range(W):
    top = 94 + int(2 * np.sin(x / 9.0)) + (abs(x - 42) // 12)
    sm[top:, x] = True
tt = np.clip((yy - 92) / 25.0, 0, 1)
snowc = np.where((tt > BAYER8[yy % 8, xx % 8])[..., None], np.array((58, 58, 108)), np.array((96, 96, 156)))
nc.a[sm] = snowc[sm]
edge = sm & ~np.roll(sm, 1, 0)
nc.a[edge] = (150, 150, 204)
# Schneewehen: einige hellere Streifen
for (x0, y0, L) in [(4, 104, 9), (60, 108, 12), (22, 113, 7), (70, 99, 6)]:
    nc.a[y0, x0:x0 + L] = (120, 120, 180)

# --- Schädel + Burg (Lage wie im Kartenmotiv) ------------------------------------------------------------
skull = sprite('d21_skull', B, [496])            # nativ ab (238,127)
castle = sprite('d21_castle', B, [490])          # nativ ab (249,100)
sk = hsv_shift(skull, 0, 0.9, 0.9)
ca = hsv_shift(castle, 0, 0.95, 0.88)
SX, SY = 17, 69
blob(nc, SX + 26, SY + 35, 30, 4, (20, 18, 44), 1.0)          # Schatten im Schnee
nc.paste(sk, SX, SY)
CX, CY = SX + (249 - 238), SY + (100 - 127)
nc.paste(ca, CX, CY)
# Spitze des goldenen Mittelturms suchen (oberstes goldenes Pixel in der Mitte)
g = (ca[..., 0].astype(int) > ca[..., 2].astype(int) + 40) & (ca[..., 3] > 0)
gy, gx = np.where(g[:, 10:22]); i = gy.argmin()
SPX, SPY = CX + 10 + gx[i], CY + gy[i]

# --- Blitz (selbst gezeichnet, 1 natives Pixel) --------------------------------------------------------
def bolt(pts, core=(236, 240, 255), glow=(150, 140, 240)):
    mk = np.zeros((H, W), np.uint8)
    for a, b in zip(pts[:-1], pts[1:]):
        cv2.line(mk, a, b, 1, 1, lineType=4)
    gl = (cv2.dilate(mk, np.ones((3, 3), np.uint8)) > 0) & (mk == 0)
    nc.a[gl] = (nc.a[gl].astype(int) * 0.35 + np.array(glow) * 0.65).astype(np.uint8)
    nc.a[mk > 0] = core

bolt([(12, 0), (18, 7), (15, 11), (26, 17), (23, 22), (34, 27), (31, 30), (SPX, SPY - 1)])
bolt([(18, 7), (8, 13), (10, 17), (3, 22)])
bolt([(26, 17), (37, 14), (44, 17), (52, 12)])
bolt([(60, 0), (57, 5), (63, 9), (61, 12)], core=(200, 200, 250))
# Funkenkranz an der Einschlagstelle
for dx, dy in [(-2, -1), (2, -1), (-3, 1), (3, 1), (0, -3)]:
    nc.px(SPX + dx, SPY + dy, (236, 240, 255))

# --- Schneeregen: kurze schräge Striche, 1 natives Pixel -------------------------------------------------
rng = np.random.RandomState(3)
front = np.zeros((H, W), bool)          # kein Regenstrich auf Burg/Schädel (wirkt sonst wie Risse)
front[CY:CY + ca.shape[0], CX:CX + ca.shape[1]] |= ca[..., 3] > 0
front[SY:SY + sk.shape[0], SX:SX + sk.shape[1]] |= sk[..., 3] > 0
for _ in range(70):
    x, y = rng.randint(0, W), rng.randint(0, H)
    L = rng.randint(2, 4)
    col = (120, 130, 200) if rng.rand() < 0.6 else (170, 176, 230)
    for j in range(L):
        px_, py_ = x - j // 2, y + j
        if 0 <= px_ < W and 0 <= py_ < H and not front[py_, px_]:
            nc.a[py_, px_] = col

vignette(nc, 0.35, 0.7)
cv = finish(nc, K)
print(save(cv, '21_skulltop_storm.png'))
