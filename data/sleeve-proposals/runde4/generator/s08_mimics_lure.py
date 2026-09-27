# -*- coding: utf-8 -*-
"""08 Mimic's Lure – Blick über die Schulter: Ein Mädchen (von hinten, Arme erschrocken hochgerissen) steht im
Kellergewölbe vor einer Truhe, auf die ein Lichtschacht fällt – doch die Truhe reißt das Maul auf: ein Mimic.

Quellen:
  MotiveArcanum 55 „Ebene #91“ (Mädchen von hinten mit erhobenen Armen, Szene „Sichtbar #22“), 6×
  Motive 914 „Mimic“ (Karte „Mimic“), 4×
  MotiveArcanum 127 „Keller Flur“ – Ziegelwand- und Kopfsteinpflaster-Textur (gekachelt), 2×
Selbst gezeichnet: Lichtschacht, Lichtkegel am Boden, Schatten, Staubkörnchen, Dunkelheit (geordnetes Dithering).

Skalierung (Tiefenstaffelung):
  Hintergrund (Wand, Boden, Licht, Staub): 2× (Raster 125×175)
  Mittelgrund (Mimic + sein Schatten + Glanzpunkte): 4× (Raster 63×88, beschnitten)
  Vordergrund (Mädchen): 6× (Raster 42×59, beschnitten)
"""
from common import *  # noqa
import numpy as np, math

M, A = 'Motive', 'MotiveArcanum'
BW, BH = 125, 175
yy, xx = np.mgrid[0:BH, 0:BW]
th = BAYER4[yy % 4, xx % 4]

# ---------------- Texturen ----------------
L = layer(A, 127); X0, Y0 = 548, 321
wall_t = L[Y0 + 35:Y0 + 51, X0 + 64:X0 + 80, :3].copy()          # 16×16 Ziegel
wall_band = L[Y0 + 35:Y0 + 58, X0 + 64:X0 + 80, :3].copy()       # inkl. dunkler Sockelzeilen
floor_t = L[Y0 + 64:Y0 + 80, X0 + 64:X0 + 80, :3].copy()         # 16×16 Pflaster

bg = Canvas(BW, BH)
FLOOR_Y = 84                                                    # Wand/Boden-Kante (2×-Raster)
for y in range(FLOOR_Y):
    # Sockel: die letzten 7 Zeilen aus dem Band (dunkler Übergang zum Boden)
    k = y - (FLOOR_Y - 7)
    for x in range(BW):
        bg.a[y, x] = wall_band[16 + k, x % 16] if k >= 0 else wall_t[(y + 3) % 16, x % 16]
for y in range(FLOOR_Y, BH):
    for x in range(BW):
        bg.a[y, x] = floor_t[(y - FLOOR_Y) % 16, x % 16]

# Beleuchtung: alles dunkel, Lichtschacht in der Mitte-rechts, Lichtfleck am Boden
LX = 76                                                          # Mitte des Lichtschachts
lum = np.full((BH, BW), 0.30)
# Schacht (oben schmal, unten breiter)
for y in range(BH):
    half = 12 + 0.10 * y
    d = np.abs(xx[y] + 0.5 - LX)
    lum[y] = np.maximum(lum[y], np.where(d < half, 0.62, 0.62 - (d - half) / 26).clip(0.30, 1))
# Lichtfleck (Ellipse) am Boden um den Mimic
fx, fy = LX, 112
e = ((xx + 0.5 - fx) / 34) ** 2 + ((yy + 0.5 - fy) / 12) ** 2
lum = np.maximum(lum, np.where(e < 1, 1.0, np.clip(1.0 - (e - 1) * 0.9, 0.3, 1)))
# nach oben (Decke) und zu den Rändern dunkler
lum *= np.clip(0.55 + yy / 120, 0, 1.05)
lvl = np.clip(np.round(lum * 6) / 6, 0.2, 1)                      # 6 harte Helligkeitsstufen
bg.a[:] = np.clip(bg.a * lvl[..., None] * np.array([0.92, 0.95, 1.08]), 0, 255).astype(np.uint8)
# warmer Schimmer im Lichtfleck
m = (e < 1) & (th < 0.5)
bg.a[m] = np.clip(bg.a[m].astype(int) + (26, 18, 0), 0, 255).astype(np.uint8)
# Lichtschacht selbst (sichtbarer Strahl, dünn gedithert)
for y in range(0, fy):
    half = 10 + 0.10 * y
    for x in range(BW):
        d = abs(x + 0.5 - LX)
        if d < half - 3:
            bg.a[y, x] = np.clip(bg.a[y, x].astype(int) + (22, 20, 12), 0, 255)
# Staubkörnchen im Licht
rng = np.random.RandomState(8)
for _ in range(14):
    y = rng.randint(6, 100); x = int(LX + rng.uniform(-1, 1) * (8 + 0.1 * y))
    bg.px(x, y, (236, 226, 190))
vignette(bg, 0.6, 0.5)

cv = Canvas(250, 350)
cv.a[:] = up(bg.a, 2)

# ---------------- Mittelgrund 4×: Mimic ----------------
MW, MH = 63, 88
mid = np.zeros((MH, MW, 4), np.uint8)
mim = sprite('b08_mimic', M, [914])                              # 16×24
mx = int(round(LX * 2 / 4)) - 8
my = int(round(fy * 2 / 4)) - 24 + 1                              # Unterkante im Lichtfleck
# Schlagschatten (2 Zeilen, halbtransparent durch Muster)
for j in (0, 1):
    for i in range(-1, 17):
        X, Y = mx + i, my + 23 + j
        if 0 <= X < MW and 0 <= Y < MH and (j == 0 or (i + j) % 2 == 0) and -1 + j <= i <= 16 - j:
            mid[Y, X] = (22, 18, 24, 170)
for j in range(24):
    for i in range(16):
        if mim[j, i, 3] >= 128:
            mid[my + j, mx + i] = mim[j, i]
# Glanzpunkte auf dem Metall (lockt!)
for (i, j) in [(3, 1), (12, 2)]:
    mid[my + j, mx + i] = (255, 246, 210, 255)
M4 = up(mid, 4)[:350, :250]
cv.paste(M4, 0, 0)

# ---------------- Vordergrund 6×: Mädchen ----------------
girl = sprite('b08_girl_back', A, [55])                          # 17×27
G6 = up(girl, 6)
gx, gy = 28, 350 - G6.shape[0] + 6                               # Füße unterhalb der Bildkante
# Randlicht vom Lichtschacht auf der rechten Seite (oberste/rechte Kante heller) – auf 6×-Raster
gl = girl.copy()
mm = gl[..., 3] > 0
right = mm & ~np.hstack([mm[:, 1:], np.zeros((mm.shape[0], 1), bool)])
gl[right, :3] = np.clip(gl[right, :3].astype(int) + (40, 34, 20), 0, 255).astype(np.uint8)
gl = darken(gl, 0.92)
cv.paste(up(gl, 6), gx, gy)

print(save(cv, '08_mimics_lure.png'))
