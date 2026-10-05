# -*- coding: utf-8 -*-
"""46 Fluffy Bulwark – geplanter Gegner „Bubbles“ (Deck-ID planned:bubbles, Fun-Fun-Circus-Archetyp),
Held/Hauptmotiv: Bubbles, the Bouncy Bunny (Base-Karte).

Idee (≠ Shop-Sleeve „Fun-Fun Circus“: dort Manege im rot-weißen Zelt mit Elefant, Clown, Director frontal):
Nacht über der schwebenden Zirkusinsel der Moe-Welt, Abschlussfeuerwerk der Fun-Fun-Show. Bubbles sitzt groß und
nah (Brustbild, der Unterkörper verschwindet hinter dem unteren Rahmen) auf dem Gras der Insel – wie auf seiner
Karte mit dem schlafenden Mädchen samt Armbrust auf dem Bauch und dem kleinen Hasen an der Schulter; hinter seinen
Schultern spähen Clown (auf seinem Ball) und Director hervor, Bubbles schirmt sie ab (Heldentext: er fängt den
Schaden der Kreaturen ab). Über ihnen blüht Feuerwerk in vielen Farben und Größen, gestaffelt in zwei Tiefen.

Quellen:
  Motive.xcf (Held, gegen „Sichtbar #122“ = Ebene 23 geprüft, im Kartenfenster bis auf den Fensterrand
  pixelgleich): 593 „Bubbles the Bouncy Bunny“, 591 „Bubbles the Bulky Bunny #2“ (liegendes Mädchen),
  588 „… #3“ (Schatten des Mädchens, Ebenendeckkraft 50 %), 589 (kleiner Hase), Armbrust aus 585
  (Ausschnitt x248–268/y245–264).
  MotiveMoe.xcf: 36 Fun Circus Clown; 28+25+27 Director, 26 Hutschatten 50 % (gegen Karten-Szenen 33/24
  pixelgleich); 38 Feuerwerkssterne der Clown-Karte (zwei, fern); 553 „Hintergrund“ (Moe-Himmel mit Wolken,
  Ausschnitt x20–270/y160–510, nachtblau umgefärbt); 478 „Relic-Insel“ (16×16-Graskachel für die Inselkante).
Selbst gezeichnet: Nachtfärbung, Sterne, Feuerwerk (Speichen mit gepunkteten Enden im Stil und in den Farben der
Feuerwerkssterne aus 38, Radien 4–20 px, 8–16 Speichen, eine Leuchtspur), Inselkante, Schatten.

Skalierung (nach Nutzer-Feedback „Held deutlich größer“, reingezoomt):
  fern – 1×-Raster (250×350): Nachthimmel, Sterne, kleines Feuerwerk
  nah – 2×-Raster (125×175, um 1 px nach rechts versetzt): großes Feuerwerk, Inselkante, Clown, Director,
  Bubbles (116×123 → 696×738 px).
  Gemessen am PNG: Augen x 303–362 und 387–446 → Gesichtsmitte x = 375,0.
"""
import math, random
import numpy as np
from kitI import *  # noqa

rnd = random.Random(46)
M, MO = 'Motive', 'MotiveMoe'


def lay(base, i, alpha=1.0):
    a = layer(base, i).copy()
    if alpha < 1.0: a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a


# ------------------------------------------------------------------ Held: Bubbles mit dem schlafenden Mädchen
# Motive 593 Bubbles, 591 Mädchen (liegend), 588 Schatten des Mädchens (Ebenendeckkraft 50 %), 589 kleiner
# Hase, Armbrust aus Ebene 585 (Ausschnitt x248–268/y245–264) – Reihenfolge wie im Stapel, gegen Sichtbar #122
# (Ebene 23) geprüft
cb = layer(M, 585).copy(); m_ = np.zeros(cb.shape[:2], bool); m_[245:264, 248:268] = True; cb[~m_] = 0
g = lay(M, 593)
for a_ in (lay(M, 591), lay(M, 588, 0.5), lay(M, 589), cb):
    g = over(g, a_)
hb = bbox(lay(M, 593))
bub = keep('o46_bubbles', g[hb[1]:hb[3], hb[0]:hb[2]].copy())          # 116×123
EYE_C = 59                                                              # Augen x 47–70 → Mitte 59,0

# ------------------------------------------------------------------ Fun-Fun-Truppe (MotiveMoe)
clown = keep('o46_clown', compose(MO, [36]))
dirc = compose(MO, [28, 25, 27], crop=False); dirc = over(dirc, lay(MO, 26, 0.5))
dirc = keep('o46_director', crop_alpha(dirc))
fw = parts(crop_alpha(layer(MO, 38)), dil=1)                                      # Feuerwerkssterne (13×13)

# ================================================================== Ebene 1 (fern, 1×-Raster 250×350): Nachthimmel
W, H = 250, 350
P1 = Plane(W, H, 1)
sky = layer(MO, 553)[160:510, 20:270].astype(float)                      # Moe-Himmel mit Wolken
for y in range(H):
    t = y / H
    base = np.array(mix((6, 8, 26), (34, 26, 70), t ** 1.3))             # Nacht: oben fast schwarz, unten violett
    cl = np.clip((sky[y, :, 0] - 20) / 200.0, 0, 1)                      # Wolkenanteil (Himmelblau hat kaum Rot)
    P1.a[y, :, :3] = np.clip(base[None, :] * (1 - cl[:, None]) + np.array((58, 60, 96))[None, :] * cl[:, None], 0, 255)
    P1.a[y, :, 3] = 255
for i in range(60):                                                      # ein paar Sterne
    x, y = rnd.randrange(2, W - 2), rnd.randrange(2, 200)
    if sky[y, x, 0] < 40: P1.a[y, x, :3] = (200, 205, 235) if rnd.random() < 0.5 else (120, 120, 170)

# Feuerwerk: Sterne aus Speichen mit gepunkteten Enden wie die Sterne der Clown-Karte (Ebene 38), in mehreren
# Größen und Farben; ferne klein im 1×-Raster, nahe groß im 2×-Raster
PAL = {'gold': ((183, 138, 30), (255, 180, 0), (255, 222, 130)), 'green': ((125, 158, 78), (158, 212, 80), (210, 236, 170)),
       'cyan': ((75, 137, 164), (75, 177, 223), (170, 222, 245)), 'red': ((158, 71, 71), (212, 67, 67), (240, 160, 160)),
       'violet': ((117, 93, 158), (144, 104, 212), (200, 180, 235)), 'pink': ((170, 70, 130), (232, 96, 170), (250, 190, 225)),
       'white': ((150, 150, 170), (215, 215, 230), (255, 255, 255))}


def burst(pl, cx, cy, R, pal, n=12, seed=0, trail=None):
    r = random.Random(seed)
    dk, md, lt = PAL[pal]
    rot = r.random() * math.pi
    for i in range(n):
        ang = rot + 2 * math.pi * i / n
        L = R * (0.82 + 0.18 * r.random())
        step = 1 if R < 8 else 2
        k = 2 if R < 8 else 3
        while k <= L:
            f = k / L
            col = lt if f < 0.35 else (md if f < 0.8 else dk)
            pl.px(int(round(cx + math.cos(ang) * k)), int(round(cy + math.sin(ang) * k)), col)
            k += step if f < 0.8 else step + 1
        pl.px(int(round(cx + math.cos(ang) * (L + 2))), int(round(cy + math.sin(ang) * (L + 2))), dk)   # Funke
    pl.px(int(cx), int(cy), lt)
    if trail:                                                              # aufsteigende Leuchtspur
        for yy in range(int(cy) + int(R) + 3, trail, 2):
            pl.px(int(cx) + (1 if (yy // 2) % 3 == 0 else 0), yy, dk)


# ferne Sterne (1×): Originalsprites der Clown-Karte und kleine gezeichnete
for f_, (x, y) in zip([fw[0], fw[1]], [(30, 132), (204, 150)]):
    P1.paste(f_, x, y, alpha=0.8)
for (x, y, R, c, n, sd) in [(64, 160, 6, 'pink', 10, 1), (150, 140, 5, 'gold', 8, 2), (216, 196, 6, 'green', 10, 3),
                            (24, 200, 5, 'cyan', 8, 4), (92, 120, 4, 'white', 8, 5)]:
    burst(P1, x, y, R, c, n, sd)

# ================================================================== Ebene 2 (2×-Raster 125×175, um 1 px versetzt)
# Bubbles' Augenmitte (Sprite-Spalte 59,0) → 1 + 2·(3 + 59) = 125 → x 375
P2 = Plane(125, 175, 2, ox=1)
# nahe große Feuerwerkssterne, gestaffelt
for (x, y, R, c, n, sd, tr) in [(30, 26, 20, 'gold', 16, 11, None), (94, 20, 16, 'pink', 14, 12, None),
                                (66, 50, 11, 'cyan', 12, 13, 84), (108, 62, 9, 'green', 12, 14, None),
                                (16, 66, 8, 'violet', 10, 15, None)]:
    burst(P2, x, y, R, c, n, sd, tr)

# Rückkante der Insel (Relic-Insel-Gras) hinter Bubbles – darauf stehen er und die Truppe
isl = crop_alpha(layer(MO, 478))
T_GR = isl[32:48, 176:192].copy()                                       # 16×16-Graskachel der Insel
EDGE = 140
for x in range(125):
    e = EDGE + int(round(1.2 * math.sin(x * 0.21) + 0.8 * math.sin(x * 0.53 + 2)))
    P2.a[e - 1, x, :3] = (92, 62, 30); P2.a[e - 1, x, 3] = 255              # dunkle Erdkante wie am Inselrand
    for y in range(e, 175):
        P2.a[y, x, :3] = T_GR[y % 16, x % 16, :3] * (0.55 + 0.25 * (y - e) / 25); P2.a[y, x, 3] = 255

def shadow2(cx, cy, rx, ry, a=120):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                P2.px(x, y, (16, 30, 16), a)


# die Truppe späht hinter seinen Schultern hervor (Füße hinter seinen Armen verdeckt)
GX, GY = 3, 80
P2.paste(clown, 13, 153 - clown.shape[0] + 1)
shadow2(93 + dirc.shape[1] / 2, 150.5, 7, 1.3)
P2.paste(dirc, 93, 150 - dirc.shape[0] + 1)
P2.paste(bub, GX, GY)

cv = compose_planes([P1, P2])
save(cv, '46_fluffy_bulwark.png')
