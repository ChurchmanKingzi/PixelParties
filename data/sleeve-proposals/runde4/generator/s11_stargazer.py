# -*- coding: utf-8 -*-
"""11 Stargazer – ein Sterndeuter im Sternenmantel steht nachts auf einem Hügelkamm an seinem
Messing-Fernrohr; das Rohr zielt auf den leuchtenden Kern einer riesigen Spiralgalaxie.

Quellen (MotiveGN.xcf):
  Ebene 103 „Ebene #325“ – Sterndeuter im Sternenmantel,
  Ebene 101 „Ebene #326“ – Fernrohr auf Dreibein + goldenes Monokel des Sterndeuters
      (beide geprüft gegen Szene 50 „Sichtbar #117“, 519/532 Pixel identisch, Rest vom Monokel verdeckt)
  Ebene 107 „Ebene #324“ – Spiralgalaxie (Himmel)
  Ebene 106 „Ebene #318“ – Sandboden (Textur für den Hügel)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Himmel/Galaxie 2× (Raster 125×175), Funkelsterne selbst gezeichnet ebenfalls 2×,
  Hügel + Sterndeuter + Fernrohr + Schatten 4× (Raster 63×88).
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350

# ---------------------------------------------------------------- Himmel (2×)
g = layer(D, 107)[99:339, 100:420].copy()           # Galaxie 320×240, Kern bei (150, 120)
# Vordergrund-Geometrie (4×): Fußpunkt der Gruppe und Rohrspitze; der Galaxiekern liegt auf der
# Verlängerung des Fernrohrs (45° nach rechts oben)
G = 4
FX = 9
def ridge(x):
    return int(round(71 + 5 * ((x - 18) / 34.0) ** 2 + (1 if x > 40 else 0)))
FOOT = ridge(FX + 10)
TIPX, TIPY = (FX + 35) * G, (FOOT - 29) * G          # Rohrspitze in 250er-Pixeln
CXp = 206; CYp = TIPY - (CXp - TIPX)
CX, CY = CXp // 2, CYp // 2                          # Kernlage im 125×175-Raster
sky = Canvas(125, 175)
x0, y0 = 150 - CX, 120 - CY
sub = g[max(0, y0):y0 + 175, max(0, x0):x0 + 125, :3]
sky.a[:sub.shape[0], :sub.shape[1]] = sub
# unter der Galaxie (unterer Bildteil) dunkler Nachthimmel, gedithert weiter zum Horizont
if sub.shape[0] < 175:
    vgrad(sky, [(0, (6, 8, 40)), (1, (14, 18, 62))], y0=sub.shape[0])
# Funkelsterne (Kreuze) im 2×-Raster
for sx, sy, r in [(22, 20, 2), (60, 12, 1), (36, 52, 1), (112, 110, 1), (14, 88, 1), (74, 96, 2), (50, 128, 1)]:
    sky.px(sx, sy, (255, 255, 255))
    for d in range(1, r + 1):
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            sky.px(sx + dx, sy + dy, (150, 180, 255) if d == r else (220, 230, 255))
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([sky.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.5, 0.6, g=2)                    # Vignette nur auf dem 2×-Himmel

# ---------------------------------------------------------------- Vordergrund (4×)
fw, fh = 63, 88
fg = np.zeros((fh, fw, 4), np.uint8)
# Hügelkamm: sanfte Kuppe, links etwas höher
sand = layer(D, 106)[380:420, 160:220]              # Sandtextur
for x in range(fw):
    top = ridge(x)
    for y in range(top, fh):
        c = sand[(y * 3) % sand.shape[0], (x * 3) % sand.shape[1], :3].astype(float)
        f = 0.42 - 0.18 * (y - top) / max(1, fh - top)          # nachts abgedunkelt, nach unten dunkler
        c = c * f + np.array([10, 14, 50]) * 0.35               # bläuliches Nachtlicht
        fg[y, x, :3] = c.clip(0, 255); fg[y, x, 3] = 255
    # Kante vom Galaxielicht (rechts oben) gestreift
    fg[top, x, :3] = (120, 110, 150)
    if x % 2 == 0: fg[top + 1, x, :3] = (74, 66, 104)

fig = sprite('c11_star_scope', D, [101, 103])       # Sterndeuter + Monokel + Fernrohr (36×30)
fx, foot = FX, FOOT
# Schatten auf dem Hügel (nach links, Licht von rechts oben)
for j in range(3):
    for i in range(fig.shape[1] + 4):
        X, Y = fx - 3 + i, foot - 1 + j
        if 0 <= X < fw and (i + j) % 2 == 0 and fg[Y, X, 3]:
            fg[Y, X, :3] = (fg[Y, X, :3] * 0.45).astype(np.uint8)
def over_rgba(dst, s, x, y):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] and 0 <= x + i < dst.shape[1] and 0 <= y + j < dst.shape[0]:
                dst[y + j, x + i] = s[j, i]
over_rgba(fg, fig, fx, foot - fig.shape[0] + 1)

FG = up(fg, G)[:H, :W]
cv.paste(FG, 0, 0)
print(save(cv, '11_stargazer.png'))
