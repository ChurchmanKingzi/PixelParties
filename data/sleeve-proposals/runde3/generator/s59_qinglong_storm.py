# -*- coding: utf-8 -*-
"""Sleeve 59 – „Qinglong Storm“ (Runde 3b, neu): Der Himmelsdrache Qinglong (Karte „Cardinal Beast Qinglong“)
windet sich aus einer schwarzen Gewitterwolke herab, die blauen Blitze seiner Aura zucken bis hinab ins aufgewühlte Meer.

Skalierung (Regel A): ALLES 3× – Drache, Gewitterwolke, Blitze, Meer (selbst gezeichnet im 3×-Raster). Himmel Dither-Verlauf.

Vollständigkeit (Regel B): In der Kartenszene „Sichtbar #251“ [149] besteht der Drache aus Körper [1523] + Kopf [1524]
(match 1.0/0.97, Blitze [1522]/[1525] davor). Ebene „QINLONG #1“ [1526] ist derselbe Drache vollständig
(Kopf + Körper, mit geschlossener Kontur) und wird verwendet; der Schwanz verschwindet in der Wolke.

Quellen (Motive.xcf): 1526 „QINLONG #1“ (Drache), 1527 „QINLONG“ (Gewitterwolke), 1525 „QINLONG #5“ (blaue Blitze).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 3
cv = Canvas(W2, H2)
rng = np.random.RandomState(59)

# ---------------------------------------------------------------- Nachthimmel (wie in der Kartenszene: Marineblau)
c0, c1 = np.array((4, 10, 40)), np.array((20, 44, 110))
for y in range(H2):
    t = min(1.0, y / 300)
    for x in range(W2):
        lv = math.floor(t * 5 + BAYER4[y % 4, x % 4]) / 5
        cv.a[y, x] = (c0 * (1 - lv) + c1 * lv).astype(np.uint8)

drag = lay(B, 1526)
cloud = lay(B, 1527)
bolts = lay(B, 1525)
for n, s in dict(dragon=drag, cloud=cloud, bolts=bolts).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g59_%s.png' % n))

# ---------------------------------------------------------------- aufgewühltes Meer unten (selbst gezeichnet, 3×-Raster)
SEA = 292
for by in range(SEA // K, H2 // K + 1):
    d = (by * K - SEA) / (H2 - SEA)
    for bx in range(W2 // K + 1):
        ph = bx * (0.55 - 0.25 * d) + by * 1.7
        v = math.sin(ph) + 0.5 * math.sin(bx * 0.23 - by * 0.9)
        c = (8, 22, 60) if v < 0.3 else (18, 48, 100) if v < 1.0 else (120, 170, 220) if v < 1.35 else (220, 236, 250)
        cv.rect(bx * K, by * K, bx * K + K, by * K + K, c)
cv.rect(0, SEA, W2, SEA + K, (30, 60, 120))

# ---------------------------------------------------------------- Blitze hinter dem Drachen (3×)
Bl = up(bolts, K)
cv.paste(flip(Bl), 30, 92)

for gx in (54, 136):                                # Gischt an den Einschlagstellen
    for i, w in enumerate((4, 8, 4)):
        cv.rect(gx - w * K // 2, SEA + i * K, gx + w * K // 2, SEA + i * K + K, (190, 250, 255) if i == 0 else (220, 236, 250))

# ---------------------------------------------------------------- Drache (3×): Schwanz oben rechts in der Wolke
D = up(drag, K)
dx, dy = 22, 40
cv.paste(silhouette(D, (0, 0, 20)), dx + 4, dy + 4, alpha=0.4)
cv.paste(D, dx, dy)

# ---------------------------------------------------------------- Gewitterwolke oben (3×), verschluckt den Schwanz
C = up(cloud, K)                                   # 402×117
cv.paste(C, W2 - C.shape[1] + 110, -34)
cv.paste(flip(C), -150, -52)

vignette(cv, 0.35, 0.6)
print(save(cv, '59_qinglong_storm.png'))
