# -*- coding: utf-8 -*-
"""Sleeve 36 – „Vanitas“: Alchemisten-Stillleben im Kellergewölbe.

Idee: Stillleben wie ein altes Gemälde – auf einem Holztisch stehen große Trankflaschen (6×), eine
Giftflasche mit Totenkopf, ein Mörser mit Stößel, ein aufgeschlagenes Buch und ein Explosionsschädel mit
brennender Lunte. Dahinter ein Weinkeller-Regal (3×) vor der
Steinwand, Licht fällt von vorn auf den Tisch, die Ränder versinken im Dunkel.

Quellen:
  Motive        1217 „Alchemy #2“ (Trankflaschen, Mörser), 979 „Elixir of Mana #2“ (Tischplatte)
  MotiveArcanum 172 „WEINKELLER“ (Regale, Steinwand), 65 „Ebene #73“ (Giftflasche), 180 „Ebene #4“ (Buch),
                105 „Ebene #46“ (Explosionsschädel mit Lunte)
"""
from common import *
import numpy as np

M, A = 'Motive', 'MotiveArcanum'
cv = Canvas(250, 350)
yy, xx = np.mgrid[0:350, 0:250]

def rgba(a):
    return np.dstack([a[..., :3], np.full(a.shape[:2], 255, np.uint8)])

cel = layer(A, 172)
# ---------- Steinwand (Kacheln 3×) ----------
brick = up(rgba(cel[252:268, 494:510]), 3)
for y0 in range(-6, 350, 48):
    for x0 in range(-10, 250, 48):
        cv.paste(darken(brick, 0.7), x0, y0)
# ---------- Weinregal (3×) ----------
shelf = rgba(np.concatenate([cel[166:198, 296:360], cel[166:198, 380:420], cel[166:198, 296:360]], 1))  # Steinpfeiler ausgespart
S3 = up(shelf, 3)
cv.paste(darken(S3, 0.85), -60, 22)

TABLE_Y = 224
# Licht: heller Fleck auf dem Tisch, Ränder dunkel
d = np.sqrt(((xx - 125) / 1.0) ** 2 + ((yy - 230) / 1.4) ** 2)
t = np.clip((d - 90) / 120, 0, 1) * 0.8
q = np.floor(t * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - q[..., None])).astype(np.uint8)

# ---------- Tisch: Platte (4×) + Vorderseite ----------
tab = compose(M, [979])
plank = tab[1:10, 4:30]                       # Holzplatte ohne Rand
P = up(plank, 4)
for r in range(2):                             # tiefe Tischplatte (2 Plankenreihen)
    for x0 in range(-8 - 52 * r, 250, P.shape[1]):
        cv.paste(darken(P, 0.8 + 0.2 * r), x0, TABLE_Y + r * P.shape[0])
cv.rect(0, TABLE_Y - 3, 250, TABLE_Y, (40, 26, 14))          # hintere Kante
TOP1 = TABLE_Y + 2 * P.shape[0]                               # Vorderkante der Platte
# Vorderseite: dunkle Planken, Kante oben hell
for r, f in enumerate([0.5, 0.36, 0.26, 0.2]):
    for x0 in range(-8 - 30 * r, 250, P.shape[1]):
        cv.paste(darken(P, f), x0, TOP1 + r * P.shape[0])
cv.rect(0, TOP1, 250, TOP1 + 3, (120, 84, 44))
cv.rect(0, TOP1 + 3, 250, TOP1 + 5, (30, 18, 8))
# warmes Licht auf der Szene (gedithert)
d = np.sqrt(((xx - 125) / 1.0) ** 2 + ((yy - 215) / 1.3) ** 2)
t2 = np.clip(1 - d / 110, 0, 1) * 0.22 * (yy < TOP1)
q2 = np.floor(t2 * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - q2[..., None]) + np.array([255, 200, 120]) * q2[..., None]).clip(0, 255).astype(np.uint8)

# ---------- Gegenstände ----------
al = parts(sprite('f36_alchemy', M, [1217]), dil=0)
flasks = [p for p in al if p.shape == (12, 10, 4)]
big = [p for p in al if p.shape[0] >= 13]
blue, green, teal, orange, pink, dred = flasks
pair_rg, pair_to, tubes, mortar, trio = big
poison = sprite('f36_poison', A, [65])
book = sprite('f36_book', A, [180])
skull = sprite('f36_skull', A, [105]).copy()
# Rauchschweif links vom Schädel entfernen (bräunlich-graue Pixel links der Schädelkontur)
c = skull[..., :3].astype(int)
trail = (np.arange(skull.shape[1])[None, :] <= 9) & (c[..., 0] >= 0x58) & (c[..., 0] <= 0x90) & (c[..., 0] - c[..., 2] >= 0x18)
skull[trail, 3] = 0

def stand(s, k, x, bottom, dark=1.0, shadow=True):
    S = up(s, k)
    if dark != 1.0: S = darken(S, dark)
    if shadow:
        cv.paste(silhouette(S, (12, 7, 4)), x + k, bottom - S.shape[0] + k // 2, alpha=0.5)
    cv.paste(S, x, bottom - S.shape[0])
    return S

# hintere Reihe: Buch mit Schädel, Giftflasche, Mörser
stand(book, 6, -2, TABLE_Y + 34)
stand(skull, 6, 8, TABLE_Y + 34 - 34)
stand(poison, 7, 94, TABLE_Y + 32)
stand(mortar, 6, 158, TABLE_Y + 36)
# vordere Reihe: große Tränke
stand(orange, 7, 12, TOP1 - 4)
stand(blue, 5, 102, TOP1)
stand(green, 7, 166, TOP1 - 2)

save(cv, '36_vanitas.png')
