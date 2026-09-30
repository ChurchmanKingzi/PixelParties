# -*- coding: utf-8 -*-
"""14 – Gegner „Dance of the Butterflies“, Held: Beato, the Butterfly Witch (Base). Entwurf."""
import math, random
from c_util import *  # noqa
import numpy as np

M = 'Motive'
rnd = random.Random(14)

# --- Beato (Base): Figur + Schmetterlingsringe aus 648, goldene Flügel aus 649 (nur Teil x274–304/y299–321) ---
a = layer(M, 648).copy(); a[:, 336:] = 0              # großer türkiser Schmetterling (x338) gehört nicht dazu
b = layer(M, 649).copy(); keep = np.zeros(b.shape[:2], bool); keep[299:321, 274:304] = True; b[~keep] = 0
import xcfkit as X
acc = X.over(b, a); acc[..., 3] = np.where(acc[..., 3] >= 128, 255, 0)
bx0, by0, bx1, by1 = bbox(acc)
full = acc[by0:by1, bx0:bx1]                         # 63×45, = Sichtbar #120 (Ebene 25), 0 px Abweichung
# Figur mit Flügeln (zusammenhängend) und die kleinen türkisen Schmetterlinge ihres Kartenbilds trennen
fig = part_at(full, 279 + 10 - bx0, 298 + 12 - by0, dil=0)
small = [p for p in parts(full, dil=0) if p.shape[0] <= 5]
print('Beato', fig.shape, 'Schmetterlinge', len(small))

# --- Garten: Blütenbusch und Blumengruppe aus Ebene 651 „Schachbrett“ (vom Rasen freigestellt) ---
g = layer(M, 651)
bush = g[176:196, 191:211].copy()
yy, xx = np.mgrid[0:20, 0:20]
bush[((xx + 0.5 - 10) / 7.5) ** 2 + ((yy + 0.5 - 10) / 7.0) ** 2 > 1, 3] = 0
bush = bush[bbox(bush)[1]:bbox(bush)[3], bbox(bush)[0]:bbox(bush)[2]]
fl = g[191:210, 191:211].copy()
r_, g_, b_ = [fl[..., k].astype(int) for k in range(3)]
fl[~((r_ > g_ + 10) | (b_ > g_ + 10) | ((r_ > 170) & (g_ > 170))), 3] = 0
fl = fl[bbox(fl)[1]:bbox(fl)[3], bbox(fl)[0]:bbox(fl)[2]]
moon = parts(compose('MotiveBoons', [73]), dil=1)[0]   # 22×22 Mond
mbut = [p for p in parts(compose(M, [625]), dil=1) if p.shape == (20, 21, 4)][0]   # Moonlight Butterfly

WL = 194                     # Wasserlinie im 250er-Raster
# ---------- 1×: Nachthimmel ----------
cv = Canvas(250, 350)
SKY = [(10, 16, 40), (14, 26, 58), (18, 40, 74), (22, 58, 88), (30, 80, 100), (46, 104, 112)]
for y in range(WL):
    for x in range(250):
        cv.a[y, x] = grad_pick(SKY, y / WL, x, y)
for _ in range(40):
    x, y = rnd.randrange(250), rnd.randrange(WL - 40)
    cv.a[y, x] = (220, 240, 250) if rnd.random() < 0.4 else (140, 190, 210)
# ---------- 2×: Mond, Ufer, Wasser ----------
W2, WL2 = 125, WL // 2
p2 = rgba(125, 175)
MX, MY = 88, 14
put(p2, moon, MX, MY)
# Mondschein (Hof): ein weicher Ring, gedithert
for y in range(0, WL2):
    for x in range(W2):
        d = math.hypot(x + 0.5 - (MX + 11), y + 0.5 - (MY + 11))
        if p2[y, x, 3] == 0 and d < 19 and (19 - d) / 8 > bayer(x, y):
            c = tuple(int(v) for v in cv.a[y * 2, x * 2])
            p2[y, x] = list(mix(c, (150, 200, 205), 0.22)) + [255]
put(p2, mbut, 20, 22)
# Heckenkante: dunkle Silhouette mit Blütenbüschen
HED = (12, 34, 30)
for x in range(W2):
    h = 5 + int(2.2 * math.sin(x / 4.3) + 1.5 * math.sin(x / 1.7 + 1))
    for y in range(WL2 - h, WL2):
        p2[y, x] = list(HED) + [255]
for bx in (4, 22, 88, 106):
    put(p2, bush, bx, WL2 - 13)
for fx in (40, 70):
    put(p2, fl, fx, WL2 - 12)
# Wasser
WAT = [(16, 44, 64), (12, 36, 56), (10, 28, 48), (8, 22, 40)]
for y in range(WL2, 175):
    for x in range(W2):
        p2[y, x] = list(grad_pick(WAT, (y - WL2) / (175 - WL2), x, y)) + [255]
# Spiegelung der Uferkante (gespiegelt, abgedunkelt)
for y in range(WL2 - 14, WL2):
    ry = 2 * WL2 - 1 - y
    for x in range(W2):
        if p2[y, x, 3] and (ry + x) % 2 == 0:
            p2[ry, x, :3] = mix(tuple(int(v) for v in p2[y, x, :3]), WAT[0], 0.6)
# Mond-Glitzerbahn: kurze helle Wellenstriche unter dem Mond (nach unten breiter, dunkler)
for y in range(WL2 + 2, 172, 3):
    t = (y - WL2) / (172 - WL2)
    cx = MX + 11
    for seg in range(2):
        L = rnd.randint(2, 4 + int(4 * t))
        x0 = cx + rnd.randint(-3 - int(6 * t), 2 + int(4 * t)) - L // 2
        for x in range(x0, x0 + L):
            if 0 <= x < W2: p2[y, x] = list(mix((150, 205, 210), WAT[0], 0.2 + t * 0.5)) + [255]
# ruhige Wellenlinien quer
for y in range(WL2 + 5, 175, 7):
    x = rnd.randint(0, 20)
    while x < W2:
        L = rnd.randint(5, 12)
        for i in range(L):
            if 0 <= x + i < W2 and p2[y, x + i, 0] < 100: p2[y, x + i, :3] = (26, 62, 80)
        x += L + rnd.randint(8, 20)
blit(cv, p2, 2)

# ---------- 4×: Beato, Schmetterlingsring, Spiegelung ----------
G4W, G4H = 63, 88
p4 = rgba(G4W, G4H)
FX, FY = (G4W - fig.shape[1]) // 2, 16
ring = []
CX, CY = G4W / 2, FY + 14
for k in range(8):
    ang = k / 8 * 2 * math.pi + 0.35
    ring.append((int(round(CX + 24 * math.cos(ang))) - 2, int(round(CY + 12 * math.sin(ang))) - 2, small[k % len(small)], math.sin(ang)))
for x, y, s_, z in ring:
    if z < 0: put(p4, s_, x, y)
put(p4, fig, FX, FY)
for x, y, s_, z in ring:
    if z >= 0: put(p4, s_, x, y)
# Spiegelung: senkrecht gespiegelt um die Wasserlinie, türkis abgedunkelt, halbtransparent (Schachbrett im 4×-Raster),
# nach unten ausdünnend, jede 3. Zeile um einen Rasterpunkt versetzt (Wellen)
WL4 = WL / 4
refl = rgba(G4W, G4H)
for y in range(G4H):
    for x in range(G4W):
        if p4[y, x, 3]:
            ry = int(2 * WL4 - y - 1)
            if not 0 <= ry < G4H: continue
            depth = (ry - WL4) / (G4H - WL4)
            if ry % 4 == 3: continue                     # dünne Wasserlinien zwischen den Spiegelzeilen
            if depth > 0.7 and bayer(x, ry) < (depth - 0.7) * 3.3: continue
            sh = 1 if ry % 3 == 1 else 0
            if 0 <= x + sh < G4W:
                refl[ry, x + sh] = list(mix(tuple(int(v) for v in p4[y, x, :3]), (16, 50, 70), 0.62)) + [255]
blit(cv, refl, 4, -1, 0)
blit(cv, p4, 4, -1, 0)
print(save(cv, '14_moonlit_waltz.png'))
