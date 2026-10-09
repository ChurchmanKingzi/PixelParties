# -*- coding: utf-8 -*-
"""47 Prophecy Fulfilled – Gegner „End of the World“ (sample-Structure Deck End of the World, Cover: Armageddon),
Held/Hauptmotiv: Damus, the Prophet of Apocalypse (Base-Karte, NICHT „Captain Commander Damus“).

Idee (≠ 45 „Spellstorm“: keine Sternexplosion, keine Kometen, kein Himmel): Die Prophezeiung hat sich erfüllt.
Draufsicht auf die nächtliche Dorfstraße seiner Karte (vor dem Pub): Armageddon hat das Dorf getroffen, Dächer,
Fassade und Baumkronen brennen, alles liegt im roten Widerschein. Mitten auf der Straße steht Damus groß und
unversehrt mit seinem Weltuntergangs-Schild (auf ihm das Armageddon-Bild seiner Karte) – solange er ein Ifrit
kontrolliert, trifft ihn Armageddon nicht (Heldentext). Links und rechts hinter ihm schweben als Wächter zwei
Ifrits auf ihren Feuerstrahlen (er setzt sie in seine Support Zones; sie verstärken Armageddon), ihr Feuer
beleuchtet den Boden unter ihnen.

Quellen (Motive.xcf):
  Damus:  Ebene 361 „Damos“ (16×25 samt Schild; gegen „Sichtbar #171“ = Ebene 357 pixelgleich, 0 Abweichungen).
  Ifrit:  Ebene 576 „Ifrit“ (16×35 mit Feuerstrahl; rechter gespiegelt).
  Dorf:   Ebene 362 „Ebene #680“ (Dorfkarte seiner Kartenszene, Ausschnitt x183–308/y128–303 – ohne die
          Texte „FPS: 60“ und „PUB“; der Passant auf der Straße mit Pflaster von 40 Zeilen darüber übermalt).
  Feuer:  Ebene 578 „Ebene #463“ (Flammen der Armageddon-Karte, vier Varianten, in Gruppen auf Dächern/Bäumen).
Selbst gezeichnet: Nachtfärbung, roter Widerschein, Feuerschein, Schatten.

Skalierung (Tiefenebenen):
  Dorf, Flammen, Feuerschein – 2×-Raster (125×175)
  Ifrits + ihre Schatten – 3×-Raster (84×117, um 2 px versetzt; spiegelgleich um x 125: Mitten 56/194)
  Damus + Schatten – 7×-Raster (35×50, um 6 px versetzt), 16×25 → 336×525 px.
  Gesichtsmitte: Augen auf Sprite-Spalten 6/9, Kopf 2–13 → Mitte 8,0 → 6 + 7·(9 + 8) = 125.
  Gemessen am PNG: Augen x 333–416, Kopfumriss x 249–500 → Gesichtsmitte x = 375,0.
"""
import math, random
import numpy as np
from kitI import *  # noqa

rnd = random.Random(47)
B = 'Motive'

# ------------------------------------------------------------------ Quellen
damus = keep('o47_damus', crop_alpha(layer(B, 361)))                    # 16×25 mit Schild, = Sichtbar #171 pixelgleich
ifrit = keep('o47_ifrit', crop_alpha(layer(B, 576)))                    # 16×35, schwebt auf seinem Feuerstrahl
FL = []                                                                  # Flammen der Armageddon-Karte (Ebene 578)
for p in parts(crop_alpha(layer(B, 578)), dil=0, minpx=10):
    if p.shape[0] <= 13 and p.shape[1] >= 9 and not any(p.shape == q.shape and (p == q).all() for q in FL):
        FL.append(p)
for i, f in enumerate(FL): keep('o47_flame%d' % i, f)
town = layer(B, 362)[128:303, 183:308].copy()                           # Dorfstraße seiner Karte (125×175)

# Passant auf der Straße entfernen: Pflaster 40 Zeilen weiter oben
FIGM = np.zeros(town.shape[:2], bool); FIGM[92:119, 69:88] = True
town[FIGM] = town[np.roll(FIGM, -40, axis=0)]

# ================================================================== Ebene 2× (125×175): brennendes Dorf bei Nacht
P = Plane(125, 175, 2)
t = town.astype(float)
lum = t[..., :3].mean(-1, keepdims=True)
night = t[..., :3] * np.array((0.42, 0.34, 0.46)) + lum * np.array((0.05, 0.02, 0.06))
P.a[..., :3] = np.clip(night, 0, 255); P.a[..., 3] = 255


def glow(cx, cy, r, col, a, ry=None):
    ry = ry or r
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot((x - cx) / r, (y - cy) / ry)
            if d < 1:
                q = dith(a * (1 - d) ** 1.5, x, y, 4)
                if q > 0: P.blend(x, y, col, q)


# rötlicher Widerschein des Weltenbrands über dem ganzen Dorf (oben stärker), geordnet gerastert
for y in range(175):
    for x in range(125):
        P.blend(x, y, (150, 40, 14), dith(0.30 - 0.18 * y / 175, x, y, 6))

# Brände: Armageddon hat das Dorf getroffen – Dach, Fassade und Baumkronen brennen
FIRES = [(4, 20, 0), (14, 16, 2), (24, 22, 1), (98, 10, 3), (108, 14, 0), (112, 24, 2), (8, 112, 1), (18, 108, 3), (100, 140, 0), (109, 146, 2)]
for (x, y, v) in FIRES:
    glow(x + 5, y + 6, 16, (230, 90, 20), 0.55, 12)
for (x, y, v) in FIRES:
    P.paste(FL[v % len(FL)], x, y)
# Feuerschein der Ifrit-Strahlen auf dem Boden unter ihnen (Mitten im 2×-Raster: 3·(gx+8)+2 → /2)
for gx in (10, 56):
    glow((3 * (gx + 8) + 2) / 2, (3 * (14 + 39) ) / 2, 14, (240, 120, 30), 0.40, 6)

# ================================================================== Ebene 3× (84×117, um 2 px versetzt): zwei Ifrits
# als Wächter, weiter hinten über dem Gras links und rechts der Straße schwebend (rechter gespiegelt, spiegelgleich
# um x 125: Mitten 56 / 194)
F3 = Plane(84, 117, 3, ox=2)
IFY = 14
for gx, spr in ((10, ifrit), (56, flip(ifrit))):
    F3.paste(spr, gx, IFY)
    # Schatten auf dem Boden, ein Stück unter der Flammenspitze (schwebt)
    cx, cy = gx + 8, IFY + 35 + 4
    for y in range(cy - 2, cy + 3):
        for x in range(cx - 8, cx + 9):
            if ((x + 0.5 - cx) / 6.5) ** 2 + ((y + 0.5 - cy) / 1.3) ** 2 <= 1:
                if F3.a[y, x, 3] == 0: F3.px(x, y, (10, 4, 6), 120)

# ================================================================== Ebene 7×: Damus
# Gesichtsmitte Sprite-Spalte 8,0 (Augen Spalten 6/9, Kopf 2–13) → 6 + 7·(9 + 8) = 125 → x 375
F7 = Plane(35, 50, 7, ox=6)
FEET = 44
for xx in range(-6, 6):
    for yy in (0, 1):
        if ((xx + 0.5) / 6.2) ** 2 + ((yy - 0.2) / 1.2) ** 2 <= 1:
            F7.px(17 + xx, FEET + yy, (8, 4, 6), 140)
F7.paste(damus, 9, FEET - damus.shape[0] + 1)

cv = compose_planes([P, F3, F7])
save(cv, '47_prophecy_fulfilled.png')
