# -*- coding: utf-8 -*-
"""01 Open Lead – Luftbild aufs Packeis: Durch eine gewundene Rinne offenen Wassers gleitet der Narwal
nach oben, am rechten Eisrand rutscht Snobbit bäuchlings auf die Rinne zu und zieht eine lange Spur.

Quellen (Motive.xcf):
  Ebene 780 „Narw“ (Karte „Slippery Narw“, Draufsicht) – 4×, Schwanz taucht ab (zum Wasserblau umgefärbt)
  Ebene 783 „Snobbit“ (Karte „Slippery Snobbit“, Draufsicht) – 4×
  Farben von Eis und Wasser aus den Szenen „Sichtbar #48“ (782) und „Sichtbar #49“ (779).
Selbst gezeichnet (alles im 63×88-Raster = 4×): Eisfläche mit Diagonalschraffur, Wasser, Eiskanten,
Schatten, Eisschollen, Kielwasser, Rutschspur.
Skalierung: EINE Tiefenebene, alles 4× (Raster 63×88, auf 252×352 hochskaliert, auf 250×350 beschnitten).
"""
import math, random
import numpy as np
from common import *  # noqa

K = 4
GW, GH = 63, 88
g = Canvas(GW, GH)
rnd = random.Random(7)

ICE = [(140, 142, 239), (156, 158, 239), (165, 166, 247), (173, 174, 247), (214, 211, 255), (222, 223, 255),
       (247, 255, 255)]
WAT = [(0, 24, 181), (0, 40, 206), (0, 81, 247), (0, 117, 239)]
DEEP = (0, 16, 130)

# ---- Rinne: Mittellinie und Breite je Zeile (mit gezackten Rändern) ----
def center(y):
    # oben links, schwingt zur Mitte, unten wieder leicht nach links
    t = min(1.0, max(0.0, (y - 6) / 26.0))
    t = t * t * (3 - 2 * t)
    return 21 + 11 * t + 1.5 * math.sin(y / 5.3) - (3 * max(0, y - 76) / 12)

lx, rx = [], []
jl = jr = 0
for y in range(GH):
    if y % 2 == 0:
        jl = max(-2, min(2, jl + rnd.choice((-1, 0, 0, 1))))
        jr = max(-2, min(2, jr + rnd.choice((-1, 0, 0, 1))))
    hw = (10 if y < 20 else 10 + 5 * min(1, (y - 20) / 10)) + 1.2 * math.sin(y / 4.0)
    lx.append(int(round(center(y) - hw)) + jl)
    rx.append(int(round(center(y) + hw)) + jr)

water = np.zeros((GH, GW), bool)
for y in range(GH):
    water[y, max(0, lx[y]):min(GW, rx[y])] = True

# ---- Eis: Diagonalschraffur wie auf den Slippery-Karten ----
for y in range(GH):
    for x in range(GW):
        d = (x + y) % 12
        c = ICE[4] if d < 5 else (ICE[3] if d < 8 else ICE[5] if d < 10 else ICE[4])
        g.a[y, x] = c
# ein paar Schneewehen (hellere Flecken) und Risse
def crack(pts):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
            if 0 <= x < GW and 0 <= y < GH and not water[y, x]:
                g.a[y, x] = ICE[0]
                if x + 1 < GW and not water[y, x + 1]: g.a[y, x + 1] = ICE[6]
crack([(0, 40), (4, 42), (8, 41), (11, 44)])
crack([(GW - 1, 64), (58, 66), (54, 65), (50, 68)])

# ---- Wasser ----
for y in range(GH):
    for x in range(GW):
        if not water[y, x]: continue
        dl, dr = x - lx[y], rx[y] - 1 - x
        dist = min(dl, dr)
        c = WAT[1]                                   # ruhiges Wasser, zur Mitte tiefer
        if dist >= 4 and 0.5 > BAYER4[y % 4, x % 4]: c = WAT[0]
        if dist >= 7: c = WAT[0]
        h = ((x * 73856093) ^ (y * 19349663) ^ (x * y * 83492791)) % 37   # vereinzelte Glanzstriche
        if h in (0, 7) and y % 2 == 0: c = WAT[2]
        g.a[y, x] = c
        if h == 0 and x + 1 < rx[y] - 2: g.a[y, x + 1] = WAT[2]
# Unterwasser-Eisschelf: türkiser Saum an beiden Rändern (Eis ragt unter Wasser hinein)
for y in range(GH):
    for x in (lx[y], lx[y] + 1, rx[y] - 2, rx[y] - 1):
        if 0 <= x < GW:
            g.a[y, x] = (40, 150, 235) if (x in (lx[y], rx[y] - 1)) else WAT[3]
# Schatten der Eiskante (Licht von oben links): rechts neben dem linken Rand und unter Überhängen
for y in range(GH):
    x = lx[y] + 2
    if 0 <= x < GW and 0.6 > BAYER4[y % 4, x % 4]: g.a[y, x] = DEEP
# weiße Eiskante auf dem Eis (Bruchkante)
for y in range(GH):
    for x in (lx[y] - 1, rx[y]):
        if 0 <= x < GW: g.a[y, x] = ICE[6]
    x = rx[y] + 1
    if 0 <= x < GW: g.a[y, x] = ICE[2]
    x = lx[y] - 2
    if 0 <= x < GW: g.a[y, x] = ICE[5]

# ---- kleine treibende Schollen ----
def floe(cx, cy, w, h):
    pts = []
    for y in range(cy, cy + h):
        for x in range(cx, cx + w):
            ex = ((x + .5 - cx - w / 2) / (w / 2)) ** 2 + ((y + .5 - cy - h / 2) / (h / 2)) ** 2
            if ex < 1: pts.append((x, y))
    S = set(pts)
    for x, y in pts:                      # Schatten rechts unten
        for dx, dy in ((1, 1),):
            if (x + dx, y + dy) not in S and water[min(GH - 1, y + dy), min(GW - 1, x + dx)]:
                g.a[y + dy, x + dx] = DEEP
    for x, y in pts:
        edge = (x - 1, y) not in S or (x, y - 1) not in S
        g.a[y, x] = ICE[6] if edge else (ICE[4] if (x + y) % 5 else ICE[3])
floe(int(center(6)) - 4, 5, 5, 3)


# ---- Narwal (4× = 1 Rasterpixel), Kopf nach oben ----
narw = sprite('a01_narw', 'Motive', [780])[::-1].copy()           # senkrecht gespiegelt: schwimmt nach oben
nh, nw = narw.shape[:2]
NX = int(round(center(56))) - nw // 2
NY = 28
# Bugwelle: zwei helle Bögen vor dem Kopf (Stoßzahn durchbricht die Wasseroberfläche)
hx = NX + nw // 2
for i in range(-12, 13):
    for r0, a0, col in ((3, 9.0, (200, 215, 255)), (6, 13.0, WAT[3])):
        x = hx + i
        y = NY + 8 - r0 - int(round(8 * (1 - (i / 12.0) ** 2) * (a0 / 13.0)))
        if abs(i) >= 3 and 0 <= y < GH and 0 <= x < GW and water[y, x]:
            g.a[y, x] = col
# Unterwasser-Schatten des Körpers
sh = narw.copy(); sh[..., :3] = DEEP
for j in range(nh):
    for i in range(nw):
        if sh[j, i, 3] and water[min(GH - 1, NY + j + 2), min(GW - 1, NX + i + 2)] and 0.5 > BAYER4[(NY + j) % 4, (NX + i) % 4]:
            g.a[NY + j + 2, NX + i + 2] = DEEP
# Schwanz (untere 18 Zeilen) unter Wasser: gedithert
for j in range(nh):
    for i in range(nw):
        if not narw[j, i, 3]: continue
        X, Y = NX + i, NY + j
        c = narw[j, i, :3].astype(float)
        if j > nh - 13:                       # Schwanz taucht ab: zum Wasserblau hin umgefärbt
            t = 0.3 + 0.25 * (j - (nh - 13)) / 13
            c = c * (1 - t) + np.array(WAT[0]) * t
        g.a[Y, X] = c.astype(np.uint8)
# Stoßzahn: Punkte heller machen (liegt über Wasser, glänzt)
for j in range(nh):
    for i in range(nw):
        if narw[j, i, 3] and tuple(narw[j, i, :3]) in ((12, 17, 43),) and j < 8 and i in range(nw // 2 - 1, nw // 2 + 2):
            pass

# ---- Snobbit auf dem rechten Eis, rutscht nach unten; Spur dahinter ----
snob = sprite('a01_snobbit', 'Motive', [783])
sh_, sw_ = snob.shape[:2]
SX, SY = 41, 9
# Rutschspur: zwei parallele Rillen + Schneestaub, von oben bis zur Figur
for y in range(0, SY + 3):
    for x in (SX + 3, SX + sw_ - 4):
        if not water[y, x]:
            g.a[y, x] = ICE[1] if y % 3 else ICE[0]
    for x in range(SX + 4, SX + sw_ - 4):
        if not water[y, x]: g.a[y, x] = ICE[5] if (x + y) % 3 else ICE[6]
# Schneegischt vor der Figur
for (dx, dy) in [(-1, 16), (13, 16), (-2, 14), (14, 14), (1, 18), (11, 18), (6, 18)]:
    g.px(SX + dx, SY + dy, ICE[6])
# Schlagschatten
for j in range(sh_):
    for i in range(sw_):
        if snob[j, i, 3]:
            X, Y = SX + i + 1, SY + j + 1
            if 0.5 > BAYER4[Y % 4, X % 4]: g.a[Y, X] = ICE[0]
g.paste(snob, SX, SY)

# ---- hochskalieren (eine Ebene, 4×) ----
cv = Canvas(250, 350)
big = up(np.dstack([g.a, np.full((GH, GW), 255, np.uint8)]), K)
cv.a[:] = big[1:351, 1:251, :3]
print(save(cv, '01_open_lead.png'))
