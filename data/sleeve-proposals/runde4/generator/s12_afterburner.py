# -*- coding: utf-8 -*-
"""12 Afterburner – Andras, die menschliche Waffe, steigt nachts in den Himmel auf: seine beiden
Armkanonen feuern als Triebwerke schräg nach unten, unter ihm quillt eine Rauchbank, die vom
Feuerschein orange angestrahlt wird.

Quellen (MotiveGN.xcf):
  Ebene 448 „Andras“ – Andras mit Armkanonen (Karte „Andras, the Human Weapon“)
  Ebene 445 „Andras #2“ – die beiden Triebwerksflammen der Armkanonen
      (geprüft gegen Szene 7 „Sichtbar #145“: Andras + Flammen vollständig; die Rakete 446/447 der Szene
       ist ein eigenes Geschoss und bleibt weg – Szene 5 „Sichtbar #147“ zeigt Andras ebenfalls ohne sie)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Himmel, Sterne, Feuerschein am Himmel 2× (Raster 125×175);
  Andras + Flammen, Rauchbank 3× (Raster 84×117) – in einer Ebene gebaut und einmal hochskaliert.
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350

# ---------------------------------------------------------------- Hintergrund (2×)
bg = Canvas(125, 175)
vgrad(bg, [(0, (4, 4, 18)), (0.45, (14, 12, 44)), (0.8, (40, 22, 60)), (1, (70, 34, 52))])
rng = np.random.RandomState(7)
for _ in range(38):
    x, y = rng.randint(0, 125), rng.randint(0, 95)
    bg.px(x, y, (200, 200, 235) if rng.rand() < 0.7 else (255, 240, 200))
# Feuerschein der beiden Triebwerke am Himmel (2×, gestufte Farben mit geordnetem Dithering)
GLOW = [(40, 22, 60), (72, 34, 62), (112, 50, 56), (150, 72, 52)]
for y in range(175):
    for x in range(125):
        g = 0
        for cx, cy, r in [(18, 80, 50), (107, 80, 50)]:
            g = max(g, 1 - math.hypot(x + .5 - cx, (y + .5 - cy) * 1.2) / r)
        if g <= 0: continue
        t = g ** 1.2 * len(GLOW)
        i = int(t); f = t - i
        if f > BAYER4[y % 4, x % 4]: i += 1
        if i > 0: bg.a[y, x] = GLOW[min(i, len(GLOW)) - 1]
# heller Schein hinter Kopf und Schultern, damit das dunkle Haar sich vom Nachthimmel abhebt
HALO = [(30, 26, 70), (48, 38, 96), (66, 52, 120)]
for y in range(175):
    for x in range(125):
        g = 1 - math.hypot(x + .5 - 62.5, (y + .5 - 50) * 1.15) / 30
        if g <= 0: continue
        t = g * len(HALO); i = int(t); f = t - i
        if f > BAYER4[y % 4, x % 4]: i += 1
        if i > 0: bg.a[y, x] = HALO[min(i, len(HALO)) - 1]
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.5, 0.6, g=2)

# ---------------------------------------------------------------- Vordergrund (3×)
G = 3
fw, fh = 84, 117

andras = sprite('c12_andras', D, [445, 448])          # 84×49, Kopfmitte bei x=42
AX, AY = 0, 22                                        # linke obere Ecke im 84er-Raster

yy, xx = np.mgrid[0:fh, 0:fw]

# Rauchbank: Vereinigung von Kreisen (Wolkenpuffs), von oben angestrahlt
puffs = [(-6, 98, 18), (14, 93, 14), (34, 97, 13), (50, 95, 13), (70, 93, 14), (90, 98, 18),
         (4, 114, 16), (26, 110, 15), (46, 112, 15), (66, 110, 15), (86, 114, 16),
         (6, 82, 10), (78, 82, 10)]
smoke = np.zeros((fh, fw), bool)
for cx, cy, r in puffs:
    smoke |= np.hypot(xx + .5 - cx, (yy + .5 - cy) * 1.1) < r
light = np.zeros((fh, fw))
for cx, cy, r in puffs:
    d = np.hypot(xx + .5 - cx, (yy + .5 - cy) * 1.1)
    m = d < r
    side = 0.25 * abs(xx + .5 - 42) / 42         # nahe den Flammen stärker angestrahlt
    l = np.clip(((cy - (yy + .5)) / r) * 0.85 + 0.28 + side - 0.2 * (d / r) - 0.006 * (yy - 80), 0, 1) ** 1.2
    light = np.where(m, np.maximum(light, l), light)
SM = [(24, 18, 38), (44, 36, 62), (72, 58, 88), (116, 84, 98), (190, 120, 82), (244, 180, 100)]

out = np.zeros((fh, fw, 4), np.uint8)
for y in range(fh):
    for x in range(fw):
        th = BAYER4[y % 4, x % 4]
        if smoke[y, x]:
            t = light[y, x] * (len(SM) - 1)
            i = int(t); f = t - i
            if i < len(SM) - 1 and f > th: i += 1
            out[y, x] = SM[i] + (255,)
# Figur über den Rauch (die Flammen ragen seitlich über die Rauchbank)
h, w = andras.shape[:2]
for j in range(h):
    for i in range(w):
        if andras[j, i, 3]:
            X, Y = AX + i, AY + j
            if 0 <= X < fw and 0 <= Y < fh: out[Y, X] = andras[j, i]

FG = up(out, G)
cv.paste(FG[:H, 1:W + 1], 0, 0)                    # 1 px nach links, damit Kopfmitte = Bildmitte

print(save(cv, '12_afterburner.png'))
