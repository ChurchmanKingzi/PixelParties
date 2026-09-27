# -*- coding: utf-8 -*-
"""Sleeve 59 – „Qinglong Storm“ (Runde 3b, neu): Der Himmelsdrache Qinglong (Karte „Cardinal Beast Qinglong“)
windet sich aus einer schwarzen Gewitterwolke herab, um ihn zucken blaue Blitze, ein goldener Blitz schlägt neben
seinem Kopf ein; unten ein Wolkenmeer im Mondlicht.

Skalierung (Regel A): ALLES 3× – Drache, Gewitterwolke, Blitze, Wolkenmeer. Himmel Dither-Verlauf.

Vollständigkeit (Regel B): In der Kartenszene „Sichtbar #251“ [149] besteht der Drache aus Körper [1523] + Kopf [1524]
(match 1.0/0.97, Blitze [1522]/[1525] davor). Ebene „QINLONG #1“ [1526] ist derselbe Drache vollständig
(Kopf + Körper, mit geschlossener Kontur) und wird verwendet; der Schwanz verschwindet in der Wolke.

Quellen (Motive.xcf): 1526 „QINLONG #1“ (Drache), 1527 „QINLONG“ (Gewitterwolke), 1525 „QINLONG #5“ (blaue Blitze),
1522 „QINLONG #3“ (goldener Blitz), 1520 „Ebene #652“ / 1510 „Ebene #653“ (Wolken).
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
gold = lay(B, 1522)
wc1, wc2 = lay(B, 1520), lay(B, 1510)
for n, s in dict(dragon=drag, cloud=cloud, bolts=bolts, gold=gold).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g59_%s.png' % n))

# ---------------------------------------------------------------- Wolkenmeer unten (3×), vom Mond angestrahlt
for s, x, y in ((wc1, -40, 300), (flip(wc1), 90, 292), (wc2, -10, 316), (flip(wc2), 110, 324),
                (wc1, 30, 330), (flip(wc1), 150, 336)):
    u = up(s, K)
    cv.paste(tint(u, (150, 170, 220), 0.35), x, y)
cv.rect(0, 344, W2, H2, (150, 166, 210))

# ---------------------------------------------------------------- Blitze hinter dem Drachen (3×)
Bl = up(bolts, K)
cv.paste(Bl, 12, 70)
cv.paste(flip(Bl)[:, :120], 150, 120)

# ---------------------------------------------------------------- Drache (3×): Schwanz oben rechts in der Wolke
D = up(drag, K)
dx, dy = 20, 78
cv.paste(silhouette(D, (0, 0, 20)), dx + 4, dy + 4, alpha=0.4)
cv.paste(D, dx, dy)

# goldener Blitz: aus der Wolke herab, schlägt links neben dem Kopf ein
G = up(gold, K)
cv.paste(G, 4, 40)

# ---------------------------------------------------------------- Gewitterwolke oben (3×), verschluckt den Schwanz
C = up(cloud, K)                                   # 402×117
cv.paste(C, W2 - C.shape[1] + 110, -34)
cv.paste(flip(C), -150, -52)

vignette(cv, 0.35, 0.6)
print(save(cv, '59_qinglong_storm.png'))
