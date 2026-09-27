# -*- coding: utf-8 -*-
"""Sleeve: Kreislauf der Cycling Demons – Pentagramm aus „Summoning Circle“ (Kerzen und Kopfsteinpflaster),
an den fünf Spitzen Medaillons der fünf Cycling Demons (Bouldor, Herbithorn, Hydrogen, Infernous, Serpentous).
Pentagramm samt Kerzen sowie Bouldor, Herbithorn und Infernous stammen aus den xcf-Ebenen (Repo PixelPartiesSprites);
Hydrogen und Serpentous gibt es dort nicht, sie kommen weiter aus den Kartenbildern."""
import math, numpy as np
from kit import *
from xcfkit import sprite, parts

cv = Canvas(W, H)
sc = nat('Summoning Circle')          # 94×64, feineres Raster (p≈6,35)
cob = sc[1:63, 1:21]
t2 = np.concatenate([cob, cob[:, ::-1]], 1)
tile = up(np.dstack([t2, np.full(t2.shape[:2], 255, np.uint8)]), 2)
fill_tiles(cv, hsv_shift(tile, 0, 1.0, 0.55))
vignette(cv, 0.85, 0.2)

CX, CY = 125, 178
# Pentagramm aus der Ebene „Summoning Circle“ (Motive.xcf), 4×: dunkle Linien glühend rot nachgezogen,
# Kerzen und Blutflecken in Originalfarben
K = 4
pent = sprite('mo_summoning_circle', 'Motive', [913])
pa = pent[..., 3] > 0
lines = pa & (pent[..., :3].max(-1) < 70)
ys, xs = np.where(lines)
pcx, pcy = (xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2   # Kreismitte
glow = cv2.dilate(lines.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~pa
for (mk, col) in ((glow, (90, 8, 8)), (lines, (225, 40, 25))):
    for y, x in zip(*np.where(mk)):
        X = int(CX + (x - pcx) * K); Y = int(CY + (y - pcy) * K)
        if mk is glow:
            ordered(cv, X, Y, X + K, Y + K, cv.a[min(Y, H - 1), min(X, W - 1)].tolist(), col, lambda a, b: 0.6)
        else:
            cv.rect(X, Y, X + K, Y + K, col)
pc = pent[..., :3].astype(int)
blood = pa & ~lines & (pc[..., 0] > 2 * pc[..., 1] + 20) & (pc[..., 0] < 200)   # Blutflecken weglassen
for y, x in zip(*np.where(pa & ~lines & ~blood)):
    X = int(CX + (x - pcx) * K); Y = int(CY + (y - pcy) * K)
    cv.rect(X, Y, X + K, Y + K, pent[y, x, :3])

# Dämonen aus den xcf-Ebenen (wo vorhanden)
bouldor = max(parts(sprite('de_bouldor', 'MotiveDeri', [151]), dil=0), key=lambda p: p.size)
herbi_full = sprite('gw_herbithorne', 'MotiveGrailWar', [550])
herbi = herbi_full[:, 22:56]
infern = sprite('mo_infernal_demon', 'Motive', [816])
XCF = {'Bouldor Demon': bouldor, 'Herbithorn Demon': herbi, 'Infernous Demon': infern}
# Lage der xcf-Sprites im Kartenbild (Bildabgleich mit Maske), damit sie exakt über der Kartenfigur liegen
LOC = {}
for n, s_ in XCF.items():
    a = nat(n).astype(np.float32); t = s_[..., :3].astype(np.float32)
    msk = (s_[..., 3:] > 0).astype(np.float32).repeat(3, 2)
    r = cv2.matchTemplate(a, t, cv2.TM_SQDIFF, mask=msk)
    LOC[n] = cv2.minMaxLoc(r)[2]

demons = [('Infernous Demon', 38, 26), ('Herbithorn Demon', 38, 27), ('Hydrogen Demon', 38, 24),
          ('Serpentous Demon', 37, 23), ('Bouldor Demon', 36, 27)]
R = 13
for i, (n, bx, by) in enumerate(demons):
    th = math.radians(36 + i * 72)
    px = CX + 94 * math.sin(th); py = CY - 124 * math.cos(th)
    a = nat(n)
    d = disc(a, bx, by, R)
    if n in XCF:                                    # scharfes xcf-Sprite an seiner Kartenposition einsetzen
        s_ = XCF[n]; lx, ly = LOC[n]
        lay = np.zeros_like(d); ox, oy = lx - (bx - R), ly - (by - R)
        for yy in range(s_.shape[0]):
            for xx in range(s_.shape[1]):
                Y, X_ = oy + yy, ox + xx
                if 0 <= Y < 2 * R and 0 <= X_ < 2 * R and s_[yy, xx, 3] and d[Y, X_, 3]:
                    d[Y, X_, :3] = s_[yy, xx, :3]
        m = up(d, 2)
    else:
        m = up(hsv_shift(d, 0, 1.45, 1.08), 2)
    ring(cv, px, py, 0, 2 * R + 4, (30, 5, 5))
    ring(cv, px, py, 0, 2 * R + 3, (150, 25, 20))
    ring(cv, px, py, 0, 2 * R + 1, (70, 10, 10))
    paste(cv, m, int(px) - 2 * R, int(py) - 2 * R)

for i, c in enumerate([(30, 5, 5), (150, 25, 20), (70, 10, 10), (30, 5, 5)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '09_cycling_demons.png'))
