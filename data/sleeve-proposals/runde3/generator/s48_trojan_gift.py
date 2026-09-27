# -*- coding: utf-8 -*-
"""48 Trojan Gift – das hölzerne Pferd steht vor dem Burgtor; ein Soldat klettert über die Leiter in den
Bauch, während die Bogenschützen auf der Mauer ratlos herunterstarren.

Quellen (MotiveDeri.xcf):
  Pferd mit Leiter und Soldat: „Masterpiece“ (i201), 3× (eine vollständige Ebene).
  Burgmauer mit Bannern und Holztor + Erdboden: „Hintergrund“ (i253), Ausschnitt 2×.
  Bogenschützen auf den Zinnen: „Archer“ (i184, nur die Figurenzeile über ihrem Mauerstück), 2×.
  Fragezeichen: aus „See throug the Ruse“ (i199) herausgelöst, 2×.
  Himmel: eigener Abendverlauf (Bayer-Dithering).
"""
from common import *
import numpy as np

B = 'MotiveDeri'
cv = Canvas(250, 350)

# --- Abendhimmel ------------------------------------------------------------------------------------------
cols = [np.array(c) for c in ((16, 18, 48), (34, 28, 72), (70, 40, 90), (128, 62, 88), (196, 104, 78))]
WT = 92                                           # Oberkante der Mauer
for y in range(WT + 2):
    t = y / WT * (len(cols) - 1)
    i = int(t); fr = t - i
    for x in range(250):
        cv.a[y, x] = cols[min(len(cols) - 1, i + (1 if fr > BAYER4[y % 4, x % 4] else 0))]

# --- Mauer mit Tor und Boden (Hintergrund i253, 2×) --------------------------------------------------------
bg = compose(B, [253])[..., :3]
X0 = 308                                          # Tor (x 369–431) rechts im Bild
L0 = 60                                           # Mauer ab Zeile 46 (Sims), Tor-Unterkante bei 128
wall = up(bg[L0:L0 + (350 - WT + 1) // 2 + 1, X0:X0 + 125], 2)
cv.a[WT:350] = wall[:350 - WT, :250]
GY = WT + (128 - L0) * 2                           # Bodenlinie auf dem Canvas
# Boden leicht abendlich abdunkeln, Mauer kühler
cv.a[WT:GY] = (cv.a[WT:GY] * np.array([0.78, 0.76, 0.88])).astype(np.uint8)
for y in range(GY, 350):
    f = 0.7 + 0.25 * (y - GY) / (350 - GY)
    cv.a[y] = (cv.a[y] * np.array([f, f * 0.95, f * 0.9])).astype(np.uint8)

# --- das Pferd (3×) vor dem Tor, der Kopf ragt über die Mauerkrone -------------------------------------
horse = sprite('h48_horse', B, [201])
h3 = up(horse, 3)
hx, hy = 128 - h3.shape[1] // 2, 349 - h3.shape[0]

# --- Bogenschützen auf der Mauer (nur die Figuren über ihrem Mauerstück), 2×, gespiegelt → blicken zum Pferd ------------
arch = compose(B, [184])[:21]
figs = parts(arch, dil=0)
AX = (20, 58, 96)
for p, cx in zip(figs[:3], AX):
    p2 = up(flip(darken(p, 0.85)), 2)
    cv.paste(p2, cx - p2.shape[1] // 2, WT + 2 - p2.shape[0])

cv.paste(h3, hx, hy)

# Fragezeichen / Ausrufezeichen aus „See throug the Ruse“ (i199) über den Schützen
from xcfkit import bbox as _bb
ruse = parts(compose(B, [199]), dil=1)
def trim_(q):
    b = _bb(q); return q[b[1]:b[3], b[0]:b[2]]
qm = trim_(ruse[1][0:11].copy())          # „?“ samt Punkt
for q, (cx, y0) in ((qm, (AX[0], 36)), (qm, (AX[2] + 4, 30))):
    q2 = up(q, 2)
    cv.paste(q2, cx - q2.shape[1] // 2 + 6, y0)

vignette(cv, 0.45, 0.62)
save(cv, '48_trojan_gift.png')
