# -*- coding: utf-8 -*-
"""46 Fluffy Bulwark – geplanter Gegner „Bubbles“ (Deck-ID planned:bubbles, Fun-Fun-Circus-Archetyp),
Held/Hauptmotiv: Bubbles, the Bouncy Bunny (Base-Karte).

Idee (≠ Shop-Sleeve „Fun-Fun Circus“: dort Manege im rot-weißen Zelt mit Elefant, Clown, Director frontal):
Tag über den Wolken der Moe-Welt, wo der Fun-Fun Circus auf seiner schwebenden Insel spielt (Szenen der
Circus-Karten). Bubbles sitzt groß als weiche Schutzmauer auf dem Pflasterplatz der Insel – genau wie auf seiner
Karte mit dem schlafenden Mädchen samt Armbrust auf dem Bauch und dem kleinen Hasen an der Schulter; hinter und
neben ihm hält sich die Fun-Fun-Truppe in Sicherheit (Heldentext: er fängt den Schaden der Kreaturen ab):
links der Elephant und der Clown auf seinem Ball, rechts der Director und der Strongman. Am Himmel steigen Ballons
auf, Applaus-Feuerwerk (Clown-Karte) blüht; unter der Insel hängen die Ranken ins Blau.

Quellen:
  Motive.xcf (Held, gegen „Sichtbar #122“ = Ebene 23 geprüft, im Kartenfenster bis auf den Fensterrand
  pixelgleich): 593 „Bubbles the Bouncy Bunny“, 591 „Bubbles the Bulky Bunny #2“ (liegendes Mädchen),
  588 „… #3“ (Schatten des Mädchens, Ebenendeckkraft 50 %), 589 „… “ (kleiner Hase), Armbrust aus 585
  (Ausschnitt x248–268/y245–264).
  MotiveMoe.xcf: 36 Clown (Fun-Fun Circus Clown); 28+25+27 Director, 26 Hutschatten 50 %; 13+12+14+10+11 Elephant
  (gegen die Karten-Szenen 33/24/7 pixelgleich); 19+17+18+21 Strongman + aus 20 der Haarschopf mit dem
  1-t-Gewicht in der Hand (Aufschrift „1T“ übermalt – kein Text; die drei „10T“-Gewichte weggelassen);
  38 Feuerwerk (3 von 5 Sternen), 23 Ballons (Gruppe + Paar), 478 „Relic-Insel“ (alle acht Säulen und die
  Reliquienkiste entfernt: Gras aus einer 16×16-Graskachel der Insel, Pflaster aus 16–64 px daneben, Inselkante
  unter den hinteren Säulen zwischen den Nachbarspalten interpoliert), 553 „Hintergrund“ (Himmel mit Wolken,
  Ausschnitt x20–270/y160–510).
Selbst gezeichnet: nur die Schatten (Ellipsen, ganze Pixel mit Deckkraft).

Skalierung: alles in EINEM 1×-Raster (250×350 → 3 px je Sprite-Pixel), Originalgrößen beider xcf-Dateien:
Bubbles 116×123 → 348×369 px. Gemessen am PNG: Augen x 339–368 und 381–410 → Gesichtsmitte x = 375,0
(Mund 351–395, 373,5 – der Mund des Sprites sitzt einen halben Pixel links).
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
eleph = keep('o46_elephant', compose(MO, [13, 12, 14, 10, 11]))
st = compose(MO, [19, 17, 18, 21], crop=False)
mal = layer(MO, 20).copy(); mm = np.zeros(mal.shape[:2], bool); mm[95:117, 326:348] = True; mal[~mm] = 0
wh = (mal[..., 0] == 255) & (mal[..., 3] > 0); mal[wh, :3] = (74, 74, 74)        # Aufschrift entfernt (kein Text)
st = keep('o46_strongman', crop_alpha(over(st, mal)))
fw = parts(crop_alpha(layer(MO, 38)), dil=1)                                      # vier Feuerwerkssterne
print('troupe', clown.shape, dirc.shape, eleph.shape, st.shape, len(fw))

# ------------------------------------------------------------------ Hintergrund: Moe-Himmel, Relic-Insel
W, H = 250, 350
P = Plane(W, H, 1)
sky = layer(MO, 553)[160:510, 20:270]
P.paste(sky, 0, 0)

isl = crop_alpha(layer(MO, 478)).copy()                                 # 240×240
# alle acht Säulen und die Reliquienkiste entfernen (dort sitzt Bubbles): Säulenpixel (graue Steine in den
# Kästen) werden aus Gras bzw. Pflaster 16/32 px daneben ersetzt
import cv2
I_ = isl.astype(int); sat = I_[..., :3].max(-1) - I_[..., :3].min(-1)
isgrass = (I_[..., 1] > I_[..., 0] + 15) & (I_[..., 1] > I_[..., 2] + 15)
PM = np.zeros(sat.shape, bool)
for x0, y0, x1, y1 in [(46, 76, 65, 115), (79, 92, 97, 131), (110, 92, 129, 131), (143, 76, 163, 115), (94, 64, 114, 82),
                       (46, 12, 65, 50), (143, 12, 163, 50), (79, 0, 98, 36), (110, 0, 129, 36)]:
    PM[y0:y1, x0:x1] |= (sat[y0:y1, x0:x1] < 22) & (isl[y0:y1, x0:x1, 3] > 0)
PM = cv2.dilate(PM.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
src = isl.copy()
# Säulenschäfte, die über die hintere Inselkante in den Himmel ragen, werden durchsichtig; die Kante unter einer
# Säule wird zwischen den Nachbarspalten ohne Säule interpoliert
TOPS = np.full(isl.shape[1], -1)
for x in range(isl.shape[1]):
    if not PM[:60, x].any():
        col = np.nonzero(src[:, x, 3] > 0)[0]; TOPS[x] = col.min() if len(col) else -1
for x in range(isl.shape[1]):
    if TOPS[x] >= 0 or not PM[:60, x].any(): continue
    l = x - 1
    while l >= 0 and TOPS[l] < 0: l -= 1
    r = x + 1
    while r < isl.shape[1] and TOPS[r] < 0: r += 1
    t = int(round(TOPS[l] + (TOPS[r] - TOPS[l]) * (x - l) / (r - l)))
    isl[:t, x][PM[:t, x]] = 0; PM[:t, x] = False
T_GR = src[32:48, 176:192].copy()                                       # saubere 16×16-Graskachel
for y, x in zip(*np.nonzero(PM)):
    want_cobble = 30 <= y < 110 and 50 <= x < 158
    if not want_cobble:
        isl[y, x] = T_GR[(y - 32) % 16, (x - 176) % 16]; continue
    done = False
    for dy in (0, 16, -16, 32):
        for dx in (16, -16, 32, -32, 48, -48, 64, -64):
            yy, xx = y + dy, x + dx
            if 0 <= yy < isl.shape[0] and 0 <= xx < isl.shape[1] and not PM[yy, xx] and src[yy, xx, 3] > 0 \
                    and not isgrass[yy, xx]:
                isl[y, x] = src[yy, xx]; done = True; break
        if done: break
IX, IY = 20, 106
P.paste(isl, IX, IY)

# ------------------------------------------------------------------ Himmel: Ballons und Applaus-Feuerwerk
bal = crop_alpha(layer(MO, 23))                                          # 88×100, freie Ballons mit Schnüren
keep('o46_balloons', bal)
BP = parts(bal, dil=1, minpx=20)                                         # einzelne Ballons samt Schnur
for i_, (x, y) in zip((3, 0), [(188, 30), (36, 46)]):
    P.paste(BP[i_], x, y)                                                # vom Fest aufgestiegene Ballons
for f_, (x, y) in zip(fw, [(56, 14), (100, 36), (146, 16)]):
    P.paste(f_, x, y)


def shadow(cx, cy, rx, ry, a=110):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                P.px(x, y, (20, 40, 20), a)


# ------------------------------------------------------------------ Figuren (von hinten nach vorn)
FEET = IY + 116
BX = 125 - EYE_C
DY = IY - 118
TROUPE = [  # (Sprite, linke Kante x, Fußzeile y) – die Truppe drängt sich hinter Bubbles in Sicherheit
    (clown, 80, 156 + DY), (dirc, 166, 152 + DY),
    (eleph, 38, 194 + DY), (st, 182, 192 + DY),
]
for spr, x, fy in TROUPE:
    shadow(x + spr.shape[1] / 2, fy + 0.5, spr.shape[1] * 0.42, 2.2)
    P.paste(spr, x, fy - spr.shape[0] + 1)
shadow(125, FEET - 2, 56, 6, 120)
P.paste(bub, BX, FEET - bub.shape[0] + 1)

cv = compose_planes([P])
save(cv, '46_fluffy_bulwark.png')
