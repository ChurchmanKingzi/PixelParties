# -*- coding: utf-8 -*-
"""12 Afterburner – Andras, die menschliche Waffe, steigt nachts über einem Wolkenmeer auf: seine beiden
Armkanonen zeigen schräg nach unten und feuern als Triebwerke zwei Schubflammen senkrecht nach unten,
die Wolkenkämme direkt darunter glühen orange.

Quellen (MotiveGN.xcf):
  Ebene 448 „Andras“ – Andras mit Armkanonen (Karte „Andras, the Human Weapon“)
  Ebene 445 „Andras #2“ – nur die Farbpalette der Kanonenflammen (Weiß/Gelb/Orange); die senkrechten
      Schubflammen sind selbst gezeichnet (der seitliche Flammen-Sprite passt nicht zum Aufsteigen)
      (geprüft gegen Szene 7 „Sichtbar #145“: Andras + Flammen vollständig; die Rakete 446/447 der Szene
       ist ein eigenes Geschoss und bleibt weg – Szene 5 „Sichtbar #147“ zeigt Andras ebenfalls ohne sie)
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Himmel, Sterne, Feuerschein am Himmel 2× (Raster 125×175);
  Andras + Schubflammen + Wolkenbank 4× (Raster 63×88) – in einer Ebene gebaut und einmal hochskaliert.
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
        for cx, cy, r in [(36, 118, 44), (89, 118, 44)]:
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
        g = 1 - math.hypot(x + .5 - 62.5, (y + .5 - 56) * 1.15) / 34
        if g <= 0: continue
        t = g * len(HALO); i = int(t); f = t - i
        if f > BAYER4[y % 4, x % 4]: i += 1
        if i > 0: bg.a[y, x] = HALO[min(i, len(HALO)) - 1]
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.5, 0.6, g=2)

# ---------------------------------------------------------------- Vordergrund (4×)
G = 4
fw, fh = 63, 88
andras = sprite('c12_andras_body', D, [448])          # 28×32, Armkanonen unten links/rechts
AX, AY = (fw - 32) // 2, 16                           # Andras: x 60..188, y 64..176
yy, xx = np.mgrid[0:fh, 0:fw]
out = np.zeros((fh, fw, 4), np.uint8)
# Schubflammen: selbst gezeichnet im 4×-Raster, Palette der Kanonenflammen (Ebene 445)
FW, FY, FO, FR = (255, 255, 255), (255, 255, 0), (255, 167, 24), (214, 84, 22)
L = 26
NOZ = [(AX + 2.5, AY + 25, -1), (AX + 29.5, AY + 25, 1)]     # Mündungen der Armkanonen, Seite
PL = (NOZ[0][0] - 3, NOZ[0][1] + L)
PR = (NOZ[1][0] + 3, NOZ[1][1] + L)
rngf = np.random.RandomState(12)
flick = rngf.uniform(-0.55, 0.55, (2, L + 2))
def jets(o):
    for k, (nx, ny, sd) in enumerate(NOZ):
        for t in range(L + 1):
            u = t / L
            w = 1.3 + 3.1 * math.sin(math.pi * min(u, 1) * 0.86) ** 0.8 + flick[k, t] * (0.3 + u)
            cx = nx + sd * 0.12 * t
            y = int(ny + t)
            for x in range(int(cx - w - 1), int(cx + w + 2)):
                r = abs(x + .5 - cx) / max(w, 0.5)
                if r >= 1 or not (0 <= x < fw and 0 <= y < fh): continue
                if u < 0.72:
                    c = FW if r < 0.38 else (FY if r < 0.7 else FO)
                else:
                    c = FY if r < 0.4 else (FO if r < 0.8 else FR)
                o[y, x] = c + (255,)
# Wolkenbank: Vereinigung von Kreisen, von oben angestrahlt; direkt unter den Flammen glühend
puffs = [(-4, 72, 13), (10, 68, 11), (25, 71, 10), (38, 70, 10), (52, 68, 11), (66, 72, 13),
         (2, 84, 12), (18, 81, 11), (32, 83, 11), (46, 81, 11), (62, 84, 12)]
smoke = np.zeros((fh, fw), bool)
light = np.zeros((fh, fw))
for cx, cy, r in puffs:
    d = np.hypot(xx + .5 - cx, (yy + .5 - cy) * 1.1)
    m = d < r
    smoke |= m
    l = np.clip(((cy - (yy + .5)) / r) * 0.8 + 0.18 - 0.2 * (d / r) - 0.006 * (yy - 62), 0, 1)
    light = np.where(m, np.maximum(light, l), light)
for (px, py) in (PL, PR):                             # Glut direkt unter den Flammen
    d = np.hypot(xx + .5 - px, (yy + .5 - py) * 1.4) / 16
    light = np.maximum(light, np.where(smoke, np.clip(1.2 - d, 0, 1), 0))
light = light ** 1.1
SM = [(24, 18, 38), (44, 36, 62), (72, 58, 88), (116, 84, 98), (190, 120, 82), (244, 180, 100), (255, 226, 150)]
for y in range(fh):
    for x in range(fw):
        if smoke[y, x]:
            t = light[y, x] * (len(SM) - 1)
            i = int(t); f = t - i
            if i < len(SM) - 1 and f > BAYER4[y % 4, x % 4]: i += 1
            out[y, x] = SM[i] + (255,)
def put(s, x0, y0):
    for j in range(s.shape[0]):
        for i in range(s.shape[1]):
            if s[j, i, 3] and 0 <= x0 + i < fw and 0 <= y0 + j < fh:
                out[y0 + j, x0 + i] = s[j, i]
jets(out)
put(andras, AX, AY)

FG = up(out, G)
cv.paste(FG[:H, 1:W + 1], 0, 0)
print(save(cv, '12_afterburner.png'))
