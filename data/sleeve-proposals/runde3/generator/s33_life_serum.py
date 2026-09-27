# -*- coding: utf-8 -*-
"""Sleeve 33 – „Life Serum“: Blick über die Schulter des Genies Heinz auf seinen größten Versuch.

Idee: Heinz (jubelnd, Arme hoch, 5×) steht im Vordergrund neben dem riesigen rosa Lebensserum-Tank (4×), in dem
Chibi-Monia schläft; Blitze schlagen in den Tank, links und rechts weitere Tanks – dazu Batterie und roter Knopf.
Labor-Wand (Mäander-Paneele) und gestreifter Boden aus dem Labor-Hintergrund.

Quellen (MotiveGN):
  - 559 „Hintergrund“: Laborwand (Mäander, y 202–246) und Bodenfliese (16×16)
  - 551 „Life Serum“: Tanks (rosa x161–190, grau x129–158)
  - 547 „Chibi-Monia“: Mädchen im Tank (Karte Life Serum)
  - 500 „Ebene #45“: Heinz jubelnd
  - 374 „Ebene #118“: Blitze
  - 555/556 „Ebene #24/#25“: Zahnräder, 504 „Ebene #22“: Laborgeräte (roter Knopf, Batterie)
"""
from common import *
import numpy as np

B = 'MotiveGN'
cv = Canvas(250, 350)

# ---------- Hintergrund ----------
bg = layer(B, 559)
wall = bg[202:246, 136:136 + 64, :3]           # 2 Perioden Mäander
floor = bg[272:288, 176:192, :3]               # eine Bodenfliese 16×16
wall3 = up(np.dstack([wall, np.full(wall.shape[:2], 255, np.uint8)]), 3)
floor3 = up(np.dstack([floor, np.full(floor.shape[:2], 255, np.uint8)]), 3)
FLOOR_Y = 236
# Wand: zwei Paneelreihen übereinander (oben abgedunkelt)
for r, y0 in enumerate([FLOOR_Y - 132 * 2, FLOOR_Y - 132]):
    for x0 in range(-20, 250, wall3.shape[1]):
        cv.paste(darken(wall3, 0.55 if r == 0 else 0.8), x0, y0)
# dunkle Fußleiste
cv.rect(0, FLOOR_Y - 3, 250, FLOOR_Y, (40, 40, 44))
for y0 in range(FLOOR_Y, 350, 48):
    for x0 in range(-8, 250, 48):
        cv.paste(darken(floor3, 0.85), x0, y0)

# rosa Schein des Tanks auf Wand/Boden (Dithering)
CX, CY = 125, 200
glow = np.array([255, 160, 185])
yy, xx = np.mgrid[0:350, 0:250]
d = np.sqrt(((xx - CX) / 1.0) ** 2 + ((yy - CY) / 1.6) ** 2)
t = np.clip(1 - d / 115, 0, 1) ** 1.5 * 0.5
q = (np.floor(t * 4 + BAYER4[yy % 4, xx % 4]) / 4)
cv.a[:] = (cv.a * (1 - q[..., None]) + glow * q[..., None]).clip(0, 255).astype(np.uint8)

# Zahnräder an der Wand
gears = sprite('f33_gears', B, [555])
cv.paste(up(darken(gears, 0.75), 2), 196, 60)
g2 = sprite('f33_gears2', B, [556])
cv.paste(up(darken(parts(g2)[0], 0.75), 2), 6, 70)

# ---------- Tanks ----------
tanks = layer(B, 551)
def tube(x0):
    t = tanks[150:270, x0:x0 + 30].copy()
    ys, xs = np.where(t[..., 3] > 0)
    return t[ys.min():ys.max() + 1, xs.min():xs.max() + 1], ys.min()
pink, top = tube(161); grey, _ = tube(129)
GLASS0, GLASS1 = 74 - top, 101 - top          # rosa Glasbereich (Zeilen im zugeschnittenen Tank)
# Seitentanks (3×, weiter hinten, abgedunkelt)
gL = up(darken(grey, 0.72), 3)
cv.paste(gL, -30, FLOOR_Y + 14 - gL.shape[0])
gR = up(darken(flip(grey), 0.72), 3)
cv.paste(gR, 250 - gR.shape[1] + 30, FLOOR_Y + 14 - gR.shape[0])

vignette(cv, 0.6, 0.45)   # nur Hintergrund + Seitentanks

# ---------- Blitze (schlagen oben in die Leitung) ----------
b2 = sprite('f33_bolt2', B, [374])
cv.paste(up(b2, 2), 125 - 44 - 70 + 30, 8)
cv.paste(up(flip(b2), 2), 125 + 44 - 30, 0)

# Haupttank 4× mit Mädchen
K = 4
T = up(pink, K)
TX = 125 - T.shape[1] // 2; TY = 300 - T.shape[0]
cv.paste(T, TX, TY)
girl = sprite('f33_girl', B, [547])
G = up(girl, K)
gx = 125 - G.shape[1] // 2
gy = TY + K * (GLASS0 + GLASS1) // 2 - G.shape[0] // 2
# Mädchen hinter Glas: mit Tankfarbe mischen (harte Maske, keine Halbtransparenz an den Kanten)
sub = cv.a[gy:gy + G.shape[0], gx:gx + G.shape[1]].astype(float)
m = G[..., 3] > 0
mix = G[..., :3] * 0.62 + sub * 0.38
cv.a[gy:gy + G.shape[0], gx:gx + G.shape[1]][m] = mix[m].astype(np.uint8)

# ---------- Laborgeräte rechts vorn ----------
tl = parts(sprite('f33_tools', B, [504]), dil=0)
btn, bat = tl[1], tl[4]
cv.paste(up(bat, 4), 192, 236)
cv.paste(up(btn, 4), 170, 290)

# ---------- Heinz von hinten (Vordergrund) ----------
heinz = sprite('f33_heinz', B, [500])        # jubelnd, Arme hoch
Hs = up(heinz, 5)
cv.paste(silhouette(Hs, (20, 16, 20)), 8 + 3, 342 - Hs.shape[0] + 3, alpha=0.5)
cv.paste(Hs, 8, 342 - Hs.shape[0])

save(cv, '33_life_serum.png')
