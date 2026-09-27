# -*- coding: utf-8 -*-
"""Sleeve 36 – „Vanitas“: Alchemisten-Stillleben – memento mori mit brennender Lunte.

Idee: Stillleben wie ein altes Vanitas-Gemälde, ruhig und dunkel. Auf einem Holztisch liegt ein aufgeschlagenes
Buch, darauf ein Explosionsschädel, dessen Lunte schon brennt (statt der üblichen Kerze: die Zeit läuft ab).
Dahinter eine Giftflasche, vorn ein Heiltrank – wenige große Gegenstände statt Gedränge. Licht fällt von links
oben (Lunte), Schlagschatten nach rechts, der Hintergrund versinkt im warmen Dunkel.

Skalierung: alles 8× (Tischplanken, Buch, Schädel, Giftflasche, Trank); nur der Licht-Verlauf des dunklen Hintergrunds\nist fein gedithert.

Quellen:
  Motive        1217 „Alchemy #2“ (Heiltrank), 979 „Elixir of Mana #2“ (Holzplanke der Tischplatte)
  MotiveArcanum 65 „Ebene #73“ (Giftflasche), 180 „Ebene #4“ (aufgeschlagenes Buch),
                105 „Ebene #46“ (Explosionsschädel mit Lunte; Bewegungsschlieren entfernt, linke Hälfte gespiegelt)
"""
from common import *
from f_util import *
import numpy as np

M, A = 'Motive', 'MotiveArcanum'
K = 8
cv = Canvas(W, H)

# ---------- Hintergrund: warmes Dunkel, Licht von links oben (feines Dithering nur für das Licht) ----------
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - 70) / 1.0) ** 2 + ((yy - 120) / 1.25) ** 2)
t = np.clip(1 - d / 230, 0, 1)
cols = [(14, 9, 7), (24, 16, 12), (36, 25, 18), (50, 35, 24)]
q = np.floor(t * (len(cols) - 1) + BAYER4[yy % 4, xx % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for i, c_ in enumerate(cols):
    cv.a[q == i] = c_

# ---------- Tisch (8×) ----------
tab = compose(M, [979])
plank = tab[1:10, 4:30]
P = up(plank, K)
TOP = 180                                       # hintere Tischkante
FRONT = 260                                     # Vorderkante der Platte
for y0 in (TOP, FRONT - P.shape[0]):
    for x0 in range(-3 * K - (y0 - TOP), W, P.shape[1]):
        cv.paste(P, x0, y0)
cv.rect(0, TOP, W, TOP + K, (46, 32, 18))                     # hintere Kante im Schatten
cv.rect(0, FRONT, W, FRONT + K, (150, 108, 60))               # Lichtkante vorn
for r, f in enumerate([0.45, 0.32, 0.24]):
    for x0 in range(-7 * K - 6 * K * r, W, P.shape[1]):
        cv.paste(darken(P, f), x0, FRONT + K + r * P.shape[0])
cv.rect(0, FRONT + K, W, FRONT + 2 * K, (30, 20, 11))
# Licht auf der Tischplatte: links hell, nach rechts dunkler (in 8×-Pixelspalten gestuft)
for i, x0 in enumerate(range(0, W, K)):
    f = 1 - min(0.5, max(0, (x0 - 60) / 360))
    cv.a[TOP:FRONT, x0:x0 + K] = (cv.a[TOP:FRONT, x0:x0 + K] * f).astype(np.uint8)

# ---------- Gegenstände (alle 8×) ----------
al = parts(sprite('f36_alchemy', M, [1217]), dil=0)
flasks = [p for p in al if p.shape == (12, 10, 4)]
big = [p for p in al if p.shape[0] >= 13]
blue, green, teal, orange, pink, dred = flasks
poison = sprite('f36_poison', A, [65])
book = sprite('f36_book', A, [180])
skull = sprite('f36_skull', A, [105]).copy()
# Der Schädel fliegt in der Vorlage (Bewegungsschlieren links). Für das Stillleben: Schlieren entfernen und die
# linke Schädelhälfte aus der rechten spiegeln (Mittelachse Spalte 14); Lunte und Funke bleiben erhalten.
body = skull[3:15].copy()
for c_ in range(10, 14):
    body[:, c_] = body[:, 28 - c_]
spark = body[:, :10].copy()
yl = (spark[..., 0].astype(int) > 200) & (spark[..., 1].astype(int) > 200)
body[:, :10] = 0
body[:, :10][yl] = spark[yl]
skull[3:15] = body
skull = trim(skull)

def stand(s, x, bottom, dark=1.0):
    """Gegenstand auf den Tisch stellen; Schlagschatten nach rechts (Licht von links oben)."""
    S = up(s, K)
    if dark != 1.0: S = darken(S, dark)
    y = bottom - S.shape[0]
    sh = silhouette(S, (14, 9, 5))
    # Schatten: um 1 Pixel nach rechts, flach auf die Platte gelegt (nur die unteren 2 Pixelreihen)
    cv.paste(sh[-2 * K:], x + 2 * K, bottom - 2 * K + K // 2, alpha=0.55)
    cv.paste(S, x, y)
    return x, y, S


# hinten: Giftflasche
stand(poison, 172, 212, dark=0.82)
# Mitte links: Buch, darauf der Schädel
bx, by, Bk = stand(book, 4, 238)
stand(skull, bx + 3 * K, by + 3 * K)
# vorn rechts: Heiltrank
stand(pink, 112, 256)

save(cv, '36_vanitas.png')
