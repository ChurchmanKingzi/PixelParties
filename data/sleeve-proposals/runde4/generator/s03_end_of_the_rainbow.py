# -*- coding: utf-8 -*-
"""03 End of the Rainbow – Am Ende des Regenbogens: Der Bogen spannt sich als runder Kreisbogen über Willy
den Kobold und taucht rechts genau in die Öffnung seines Goldtopfs. Willy steht stolz daneben auf der
Frühlingswiese; dahinter Himmel, Wolken und sanfte Hügel.

Quellen:
  MotiveBritain.xcf Ebene 241 „Willy“ (Karte „Willy the Valiant Leprechaun“): nur Willy – 5×
  MotiveBritain.xcf Ebene 233 „Ebene #19“ (Goldtopf derselben Karte) – 5×
  Regenbogenfarben aus dem Regenbogen der Ebene 241 (6 Bänder, je 1 Pixel breit wie im Original).
Selbst gezeichnet (50×70-Raster = 5×): Regenbogen als Kreisbogen, Himmel, Wolken, Hügel, Wiese, Schatten.
Skalierung: EINE Tiefenebene, alles 5× (Raster 50×70 = 250×350).
"""
import math
import numpy as np
from common import *  # noqa

K = 5
GW, GH = 50, 70
g = Canvas(GW, GH)

P = parts(sprite('a03_willy_layer', 'MotiveBritain', [241]), dil=0)
willy = [p for p in P if p.shape[:2] == (25, 16)][0]
pot = sprite('a03_pot', 'MotiveBritain', [233])
RB = [(248, 18, 20), (255, 167, 25), (255, 233, 25), (37, 237, 43), (34, 76, 236), (204, 36, 237)]

GROUND = 61
# ---- Himmel: drei Farbstufen mit je einer geditherten Übergangszone ----
SKY = [(84, 144, 236), (112, 170, 244), (150, 200, 250)]
for y in range(GROUND):
    for x in range(GW):
        t = y / 44.0 * 2
        k = int(t); f = t - k
        k = min(k, 2)
        c = SKY[k]
        if k < 2 and f > 0.7 and (f - 0.7) / 0.3 > BAYER4[y % 4, x % 4]: c = SKY[k + 1]
        g.a[y, x] = c
# ---- Wolken ----
def cloud(cx, cy, blobs):
    yy, xx = np.mgrid[0:GH, 0:GW]
    m = np.zeros((GH, GW), bool)
    for dx, dy, r in blobs:
        m |= (xx + .5 - cx - dx) ** 2 + ((yy + .5 - cy - dy) / 0.85) ** 2 < r * r
    m[cy + 2:] = False
    for y in range(GH):
        for x in range(GW):
            if m[y, x]:
                g.a[y, x] = (206, 222, 246) if (y + 1 < GH and not m[y + 1, x]) or y == cy + 1 else (255, 255, 255)
cloud(38, 9, [(0, 0, 3.5), (3.5, -1, 3), (-3.5, 0.5, 2.6), (6.5, 0.8, 2)])
cloud(9, 7, [(0, 0, 2.6), (2.8, 0.4, 2.2), (-2.6, 0.6, 1.8)])
cloud(44, 30, [(0, 0, 2.4), (-2.6, 0.6, 2.0), (2.2, 0.6, 1.6)])
# ---- Hügel ----
for x in range(GW):
    top = int(round(47 - 4 * math.sin(x / 7.0 + 0.4) - 1.5 * math.sin(x / 3.1)))
    for y in range(top, GROUND): g.a[y, x] = (118, 176, 152)
    g.a[top, x] = (140, 192, 166)
for x in range(GW):
    top = int(round(54 - 3 * math.sin(x / 5.5 + 2.4)))
    for y in range(top, GROUND): g.a[y, x] = (82, 158, 96)
    g.a[top, x] = (102, 176, 108)
# ---- Wiese mit klarer Bodenlinie ----
for y in range(GROUND, GH):
    for x in range(GW):
        c = (64, 152, 62) if y < GROUND + 5 else (54, 138, 54)
        h = ((x * 73856093) ^ (y * 19349663)) % 17
        if h == 0: c = (40, 112, 44)
        elif h == 1: c = (96, 182, 82)
        if y == GROUND: c = (112, 196, 92)
        g.a[y, x] = c
for (x, y, c) in [(4, 66, (255, 255, 255)), (21, 67, (255, 233, 25)), (47, 64, (255, 255, 255)),
                  (29, 68, (255, 255, 255)), (13, 64, (255, 233, 25))]:
    g.px(x, y, c)

# ---- Lage von Topf und Willy ----
ph, pw = pot.shape[:2]
PX, PY = 27, GROUND - 16          # Topfboden (Zeile 16 des Sprites) auf der Bodenlinie
MOUTH = PY + 6                    # Goldoberfläche in der Topföffnung
wh, ww = willy.shape[:2]
WX, WY = 8, GROUND - wh + 1

# ---- Regenbogen: Kreisbogen, dessen rechtes Ende senkrecht in die Topföffnung (Spalten 5–11) fällt ----
CX, CY, R = PX + 11.5 - 28 + 1, MOUTH, 28.0      # Außenradius 28, Bänder nach innen
def band(x, y):
    d = math.hypot(x + .5 - CX, y + .5 - CY)
    k = int(R - d)
    return k if 0 <= k < 6 and y + .5 <= CY else None
def draw_rainbow():
    for y in range(GH):
        for x in range(GW):
            k = band(x, y)
            if k is not None and y < MOUTH: g.a[y, x] = RB[k]

# Schatten auf der Wiese
def shadow(cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if 0 <= y < GH and 0 <= x < GW and ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 1:
                g.a[y, x] = (38, 100, 40)
shadow(WX + ww / 2, GROUND + 0.5, ww / 2 + 1, 1.3)
shadow(PX + pw / 2, GROUND + 1.0, pw / 2 + 1, 1.6)
draw_rainbow()
g.paste(pot, PX, PY)
# Bogen vor dem hinteren Topfrand bis auf die Goldoberfläche
for y in range(PY, MOUTH):
    for x in range(PX, PX + pw):
        k = band(x, y)
        if k is not None: g.a[y, x] = RB[k]
g.paste(willy, WX, WY)

cv = Canvas(250, 350)
cv.a[:] = up(np.dstack([g.a, np.full((GH, GW), 255, np.uint8)]), K)[:, :, :3]
print(save(cv, '03_end_of_the_rainbow.png'))
