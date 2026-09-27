# -*- coding: utf-8 -*-
"""11 Stargazer – ein Sterndeuter im Sternenmantel steht nachts auf einem Hügelkamm an seinem
Messing-Fernrohr; das Rohr zielt in die leuchtenden Spiralarme einer riesigen Galaxie.

Quellen (MotiveGN.xcf):
  Ebene 103 „Ebene #325“ – Sterndeuter im Sternenmantel,
  Ebene 101 „Ebene #326“ – Fernrohr auf Dreibein + goldenes Monokel des Sterndeuters
      (beide geprüft gegen Szene 50 „Sichtbar #117“, 519/532 Pixel identisch, Rest vom Monokel verdeckt)
  Ebene 107 „Ebene #324“ – Spiralgalaxie: nur als Helligkeitsvorlage (waagerecht gespiegelt); daraus
      im 2×-Raster neu gerastert mit harter 8-Farben-Palette, Stufen mit geordnetem Dithering,
      Sterne als einzelne Rasterpixel
  Ebene 106 „Ebene #318“ – Sandboden (Textur für den Hügel)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Himmel/Galaxie + Funkelsterne 2× (Raster 125×175);
  Hügel + Sterndeuter + Fernrohr + Schatten 5× (Raster 50×70), Vordergrund.
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa
import cv2

D = 'MotiveGN'
W, H = 250, 350

# ---------------------------------------------------------------- Vordergrund-Geometrie (5×)
G = 5
fw, fh = 50, 70
FX = 5                                               # Gruppe x 25..205
def ridge(x):
    return int(round(60 + 4 * ((x - 14) / 30.0) ** 2))
FOOT = ridge(FX + 10)
TIPX, TIPY = (FX + 35) * G, (FOOT - 29) * G          # Rohrspitze (250er-Raster)

# ---------------------------------------------------------------- Himmel (2×): Galaxie posterisiert
g = layer(D, 107)[99:339, 100:420, :3][:, ::-1].astype(np.float32)   # gespiegelt: Arme fallen nach rechts ab
lum = g @ np.array([0.3, 0.55, 0.15], np.float32)
soft = cv2.GaussianBlur(lum, (0, 0), 1.4)
star = (lum - soft) > 38
CORE = (320 - 150, 120)                              # Kern im gespiegelten Bild
CX, CY = 78, 44                                      # Kernlage im 125×175-Raster (Bild: 156, 88)
x0, y0 = CORE[0] - CX, CORE[1] - CY
PAL = [(4, 5, 20), (9, 12, 40), (16, 24, 72), (28, 44, 112), (48, 80, 158), (86, 136, 200),
       (156, 206, 236), (240, 250, 255)]
TH = [0, 16, 28, 44, 68, 100, 150, 215]            # Helligkeitsstufen (0..255)
sky = Canvas(125, 175)
for y in range(175):
    for x in range(125):
        sy, sx = y + y0, x + x0
        if 0 <= sy < 240 and 0 <= sx < 320:
            v = float(soft[sy, sx]); st = star[sy, sx]
        else:
            v = 12 + 8 * (y / 175); st = False
        v = min(255, v * 0.9)
        i = 0
        while i < len(TH) - 1 and v >= TH[i + 1]: i += 1
        f = 0 if i == len(TH) - 1 else (v - TH[i]) / (TH[i + 1] - TH[i])
        if f > BAYER4[y % 4, x % 4] and i < len(PAL) - 1: i += 1
        sky.a[y, x] = PAL[i]
        if st: sky.a[y, x] = PAL[min(len(PAL) - 1, i + 3)]
# Funkelsterne (Kreuze) im 2×-Raster
for sx, sy, r in [(14, 16, 2), (46, 10, 1), (24, 52, 1), (112, 112, 1), (10, 92, 1), (116, 30, 2), (40, 118, 1)]:
    sky.px(sx, sy, (255, 255, 255))
    for d in range(1, r + 1):
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            sky.px(sx + dx, sy + dy, PAL[5] if d == r else PAL[6])
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([sky.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.45, 0.62, g=2)                   # Vignette nur auf dem 2×-Himmel

# ---------------------------------------------------------------- Vordergrund (5×)
fg = np.zeros((fh, fw, 4), np.uint8)
sand = layer(D, 106)[380:420, 160:220]              # Sandtextur
for x in range(fw):
    top = ridge(x)
    for y in range(top, fh):
        c = sand[(y * 3) % sand.shape[0], (x * 3) % sand.shape[1], :3].astype(float)
        f = 0.42 - 0.18 * (y - top) / max(1, fh - top)          # nachts abgedunkelt, nach unten dunkler
        c = c * f + np.array([10, 14, 50]) * 0.35               # bläuliches Nachtlicht
        fg[y, x, :3] = c.clip(0, 255); fg[y, x, 3] = 255
    fg[top, x, :3] = (120, 110, 150)                            # vom Galaxielicht gestreifte Kante
    if x % 2 == 0: fg[top + 1, x, :3] = (74, 66, 104)

fig = sprite('c11_star_scope', D, [101, 103])       # Sterndeuter + Monokel + Fernrohr (36×30)
fx, foot = FX, FOOT
for j in range(3):                                  # Schatten auf dem Hügel (Licht von rechts oben)
    for i in range(fig.shape[1] + 4):
        X, Y = fx - 3 + i, foot - 1 + j
        if 0 <= X < fw and Y < fh and (i + j) % 2 == 0 and fg[Y, X, 3]:
            fg[Y, X, :3] = (fg[Y, X, :3] * 0.45).astype(np.uint8)
h, w = fig.shape[:2]
for j in range(h):
    for i in range(w):
        if fig[j, i, 3]:
            fg[foot - h + 1 + j, fx + i] = fig[j, i]

cv.paste(up(fg, G)[:H, :W], 0, 0)
print(save(cv, '11_stargazer.png'), (TIPX, TIPY))
