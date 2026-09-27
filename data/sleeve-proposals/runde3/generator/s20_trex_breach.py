# -*- coding: utf-8 -*-
"""Sleeve 20 – „Trex Breach“: Der Gigantisaurier-König (T-Rex mit Flammenkrone) bricht durch das Burgtor.
Der hintere Körper steckt noch im zertrümmerten Torbogen, Kopf und Brust sind schon vor dem rechten Turm,
Torbretter und Mauersteine fliegen, unten fliehen Stadtwache und Bürger über den Weg.

Runde 3b: ALLES in einheitlicher Skalierung 2× – die Szene wird im nativen Raster (125×175) der Burgkarte
komponiert und erst am Ende verdoppelt. Kein Element hat eine andere Pixelgröße.

Quellen (MotiveGrailWar.xcf): Ebene 706 „Schloss Front“ (Burgfassade mit Türmen, Tor, Bannern, Weg, Wiese;
auch Quelle der Trümmerstücke), 513 „Trex“ + 512 „Ebene #335“ (Flammenkrone – gehört laut Szene
„Sichtbar #120“ zur Figur), 676 „Doomed Town Guard“, 593 „Ebene #52“ (Bürger).
Loch/Bruchkante, Innendunkel und Schatten: selbst gezeichnet (geordnetes Dithering im nativen Raster).
Karten: Gigantisaur King Trex, Doomed Town Guard.
"""
import numpy as np
import cv2
from d_util import *  # noqa

K = 2
BX, BY = 203, 140                                   # native linke obere Ecke des Burgausschnitts
nc = native(K)
wall = region(B, [706], (BX, BY, BX + nc.w, BY + nc.h))
nc.a[:] = wall[..., :3]

# --- Bruch im Torbogen (natives Raster, gezackt) ------------------------------------------------------
rng = np.random.RandomState(11)
hole = np.zeros((nc.h, nc.w), bool)
X0, X1 = 238 - BX, 294 - BX
for x in range(X0, X1):
    d = min(x - X0, X1 - 1 - x)
    top = 212 - BY + max(0, 8 - d) + rng.randint(0, 3)       # oben gezackt, an den Rändern tiefer
    if d < 2: top += 6 + rng.randint(0, 5)
    hole[top:279 - BY, x] = True
yy, xx = np.mgrid[0:nc.h, 0:nc.w]
# Innendunkel des Torgangs: nach unten etwas heller (Staub, Fackelschein aus dem Hof)
t = np.clip((yy - (212 - BY)) / 70.0, 0, 1)
dark = np.where((t * 0.8 > BAYER8[yy % 8, xx % 8])[..., None], np.array((44, 28, 22)), np.array((18, 12, 16)))
nc.a[hole] = dark[hole]
# Reste der Torflügel: an den Seiten stehen gesplitterte Bretter
door = region(B, [706], (BX, BY, BX + nc.w, BY + nc.h))[..., :3]
for x, h in [(X0 + 3, 16), (X0 + 4, 11), (X0 + 5, 7), (X1 - 4, 14), (X1 - 5, 18), (X1 - 6, 9)]:
    nc.a[279 - BY - h:279 - BY, x] = door[279 - BY - h:279 - BY, x]
# Bruchkante: 1 px dunkle Fuge + darüber hellere, abgesplitterte Steinkante
hm = hole.astype(np.uint8)
r1 = (cv2.dilate(hm, np.ones((3, 3), np.uint8)) > 0) & ~hole
r2 = (cv2.dilate(hm, np.ones((5, 5), np.uint8)) > 0) & ~hole & ~r1
r1[279 - BY:] = False; r2[279 - BY:] = False
nc.a[r2] = np.clip(nc.a[r2].astype(int) + 26, 0, 255)
nc.a[r1] = (40, 30, 50)

# --- T-Rex mit Krone: hinterer Körper noch im Tor, Kopf schon draußen -----------------------------------
trex = keep('d20_trex_king', compose(B, [512, 513]))          # bbox nativ ab (165, 233)
TX, TY = 230 - BX, 233 - 15 - BY                               # Füße auf dem Weg vor der Schwelle
th, tw = trex.shape[:2]
# Schatten auf dem Weg
blob(nc, TX + 40, TY + th - 1, 30, 4, (58, 50, 62), 1.0)
vis = hole | (xx >= 266 - BX) | (yy >= 279 - BY)
mask_paste(nc, trex, TX, TY, vis)

# --- Trümmer: Torbretter und Mauersteine fliegen aus dem Loch (gleiche Pixelgröße) -------------------
def chunk(x0, y0, w, h, col=(40, 30, 52)):
    c = region(B, [706], (x0, y0, x0 + w, y0 + h)).copy()
    c[0, 0, 3] = c[-1, -1, 3] = 0
    return outline(c, col)

planks = [chunk(252, 236, 2, 9, (40, 22, 10)), chunk(262, 240, 2, 7, (40, 22, 10)),
          chunk(275, 238, 3, 6, (40, 22, 10))]
stones = [chunk(241, 199, 7, 6), chunk(249, 199, 6, 5), chunk(258, 199, 5, 6)]  # Zinnenquader über dem Tor
S = dict(shadow=(20, 14, 24), sh_off=(1, 1), sh_alpha=0.5)
put(nc, rot90(planks[0]), 18, 62, **S)
put(nc, planks[1], 100, 56, **S)
put(nc, rot90(planks[2], 3), 30, 150, **S)
put(nc, stones[0], 38, 56, **S)
put(nc, rot90(stones[1]), 90, 60, **S)
put(nc, stones[0], 112, 100, fl=True, **S)
put(nc, rot90(stones[2]), 96, 160, **S)
# Staubwolken um die Füße (selbst gezeichnet, gleiche Pixelgröße)
for cx, cy, rx, ry in [(40, 146, 8, 3), (84, 146, 9, 3), (26, 143, 5, 2)]:
    blob(nc, cx, cy, rx, ry, (150, 140, 150), 0.55)

# --- Fliehende: Stadtwache links, Bürger rechts, auf dem Weg vorn ---------------------------------------
guard = sprite('d20_guard', B, [676])
man = sprite('d20_townsman', B, [593])
blob(nc, 17, 173, 8, 2, (30, 44, 24), 1.0)
put(nc, guard, 17, 173, anchor='b')
blob(nc, 106, 172, 9, 2, (30, 44, 24), 1.0)
put(nc, man, 106, 172, anchor='b', fl=True)

vignette(nc, 0.45, 0.6)
cv = finish(nc, K)
print(save(cv, '20_trex_breach.png'))
