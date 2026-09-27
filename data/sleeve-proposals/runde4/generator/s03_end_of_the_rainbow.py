# -*- coding: utf-8 -*-
"""03 End of the Rainbow – Willy der Kobold balanciert oben auf dem Scheitel eines Regenbogens, der wie ein
Tor über der Frühlingswiese steht: das rechte Ende taucht in den Topf voll Gold, am linken Fuß wartet sein
Geldsack. Dahinter blauer Himmel, Wolken und sanfte Hügel.

Quellen:
  MotiveBritain.xcf Ebene 241 „Willy“ (Karte „Willy the Valiant Leprechaun“): Willy und ein Geldsack – 3×
  MotiveBritain.xcf Ebene 233 „Ebene #19“ (gleiche Karte, der Goldtopf rechts unten) – 3×
  Regenbogenfarben aus dem Regenbogen derselben Ebene 241 (Motive.xcf Ebene 354 ist derselbe Bogen).
Selbst gezeichnet (84×117-Raster = 3×): Regenbogen (1 Rasterpixel je Farbband wie im Original), Himmel,
Wolken, Hügel, Wiese, Schatten.
Skalierung: EINE Tiefenebene, alles 3× (Raster 84×117 → 252×351, auf 250×350 beschnitten).
"""
import math
import numpy as np
from common import *  # noqa

K = 3
GW, GH = 84, 117
g = Canvas(GW, GH)

P = parts(sprite('a03_willy_layer', 'MotiveBritain', [241]), dil=0)
willy = [p for p in P if p.shape[:2] == (25, 16)][0]
bag = [p for p in P if p.shape[:2] == (17, 18)][0]
pot = sprite('a03_pot', 'MotiveBritain', [233])
RB = [(248, 18, 20), (255, 167, 25), (255, 233, 25), (37, 237, 43), (34, 76, 236), (204, 36, 237)]

GROUND = 104
# ---- Himmel ----
SKY = [(70, 130, 230), (96, 156, 240), (130, 186, 248), (170, 214, 252)]
for y in range(GROUND):
    t = y / 92
    for x in range(GW):
        v = t * 3 + BAYER4[y % 4, x % 4] * 0.999
        g.a[y, x] = SKY[min(3, int(v))]
# ---- Wolken ----
def cloud(cx, cy, blobs):
    m = np.zeros((GH, GW), bool)
    for dx, dy, r in blobs:
        yy, xx = np.mgrid[0:GH, 0:GW]
        m |= ((xx + .5 - cx - dx) / 1.0) ** 2 + ((yy + .5 - cy - dy) / 0.8) ** 2 < r * r
    m[cy + 3:] = False                                      # flache Unterkante
    for y in range(GH):
        for x in range(GW):
            if not m[y, x]: continue
            below = y + 1 < GH and not m[y + 1, x]
            above = y > 0 and not m[y - 1, x]
            g.a[y, x] = (196, 214, 240) if below or (y >= cy + 1) else (255, 255, 255)
            if above: g.a[y, x] = (255, 255, 255)
cloud(16, 18, [(0, 0, 5), (5, -2, 4), (-5, 1, 4), (9, 1, 3)])
cloud(66, 30, [(0, 0, 5), (-5, 1, 4), (5, 0, 4), (-9, 2, 2)])
cloud(52, 8, [(0, 0, 3), (3, 0, 3), (-3, 1, 2)])
# ---- Hügel ----
def hill(base, amp, per, ph, col, dark):
    for x in range(GW):
        top = int(base - amp * (0.5 + 0.5 * math.sin(x / per + ph)))
        for y in range(top, GROUND + 2):
            g.a[y, x] = col
        g.a[top, x] = dark if False else tuple(min(255, c + 18) for c in col)
hill(88, 9, 9.0, 0.6, (120, 178, 150), None)
hill(96, 8, 7.0, 2.2, (84, 160, 96), None)
# ---- Wiese ----
for y in range(GROUND - 4, GH):
    for x in range(GW):
        top = GROUND - 4 + int(1.5 + 1.5 * math.sin(x / 5.0 + 1.3))
        if y < top: continue
        c = (60, 150, 60) if y < 108 else (52, 136, 52)
        h = ((x * 73856093) ^ (y * 19349663)) % 23
        if h == 0: c = (40, 110, 44)
        if h == 1 and y > top + 1: c = (92, 180, 80)
        if y == top: c = (100, 188, 84)
        g.a[y, x] = c
# kleine Blüten
for (x, y, c) in [(8, 109, (255, 255, 255)), (29, 111, (255, 233, 25)), (44, 108, (255, 255, 255)),
                  (57, 113, (255, 233, 25)), (76, 107, (255, 255, 255)), (15, 113, (255, 233, 25)),
                  (38, 114, (255, 255, 255)), (70, 112, (255, 255, 255))]:
    g.px(x, y, c)

# ---- Regenbogen: Bogen mit senkrechten Beinen (Form wie im Original), 6 Bänder à 1 Rasterpixel ----
CX, A, CY, B = 42.0, 27.0, 64.0, 20.0     # Außenbogen: Halbachsen A (waagrecht), B (senkrecht)
def inside_arch(x, y, k):
    """liegt Pixel innerhalb des um k verkleinerten Bogens (Ellipse oben, senkrechte Beine unten)?"""
    xx = x + .5 - CX
    if y + .5 >= CY:
        return abs(xx) < A - k
    yy = CY - (y + .5)
    return (xx / (A - k)) ** 2 + (yy / (B - k)) ** 2 < 1
def rb_band(x, y):
    for k in range(6):
        if inside_arch(x, y, k) and not inside_arch(x, y, k + 1):
            return k
    return None
LEG_BOTTOM = GROUND + 2
for y in range(0, LEG_BOTTOM):
    for x in range(GW):
        k = rb_band(x, y)
        if k is not None:
            g.a[y, x] = RB[k]

# ---- Figuren (alle 3× = 1 Rasterpixel) ----
def shadow(cx, cy, rx, ry):
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 1 and 0 <= y < GH and 0 <= x < GW:
                g.a[y, x] = (36, 96, 40)
# Goldtopf am rechten Fuß: der Bogen verschwindet in seiner Öffnung
ph, pw = pot.shape[:2]
PX = int(CX + A - 3) - pw // 2
PY = GROUND + 4 - ph
shadow(PX + pw / 2 + 1, GROUND + 3.5, pw / 2 + 1, 2.2)
# Bein oberhalb der Topföffnung abschneiden: nichts zu tun, Topf wird darübergelegt
g.paste(pot, PX, PY)
# Geldsack neben dem linken Fuß (innen)
bh, bw = bag.shape[:2]
BX = int(CX - A + 7)
BY = GROUND + 3 - bh
shadow(BX + bw / 2, GROUND + 2.5, bw / 2, 2)
g.paste(bag, BX, BY)
# Willy auf dem Scheitel
wh, ww = willy.shape[:2]
WX = int(CX - ww / 2)
WY = int(CY - B) - wh + 1
g.paste(willy, WX, WY)

cv = Canvas(250, 350)
cv.a[:] = up(np.dstack([g.a, np.full((GH, GW), 255, np.uint8)]), K)[1:351, 1:251, :3]
print(save(cv, '03_end_of_the_rainbow.png'))
