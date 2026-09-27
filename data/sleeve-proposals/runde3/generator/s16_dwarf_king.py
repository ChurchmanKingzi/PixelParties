# -*- coding: utf-8 -*-
"""Sleeve 16 – Hofporträt des Zwergenkönigs.

Güldefaber, der König der Zwerge, als Brustbild vor der Felswand seines Stollens; hinter ihm eine
dunkle Thronnische, daneben sein goldener Fass-Hammer, glitzernder Goldstaub und Fässer.
Seine Garde – Steam Dwarf Dragon Pilot und Steam Dwarf Engineer – hält links und rechts Wache,
ihr Dampf steigt in der Nische auf.

Quellen:
  Motive.xcf (Karte „Güldefaber, the King of Dwarfs“):
    König = Ebene 266 „Güldefaber“; Fass-Hammer + Holzfässer = Ebene 265; Glitzer = Ebene 264;
    Felswand = Ebene 874 (Stollen-/Felstextur)
  MotiveSteamDwarfs.xcf: Dragon Pilot = Ebene 429, Engineer = Ebene 419, Dampf = Ebene 415
"""
from c_util import *
from xcfkit import parts

M = 'Motive'
cv = Canvas(W, H)

# ---------- Felswand (Ebene 874), 2×, senkrecht gekachelt
rock = tex('c16_rock', M, 874, (112, 96, 240, 144))            # 128×48 (3 Perioden hoch)
tile_fill(cv, rock, 0, 0, W, H, k=2, ox=20)
shade_rows(cv, 0, H, 0.35, 0.55, (26, 14, 8))

# ---------- Thronnische: Rundbogen, dunkel mit Verlauf, Kante aus hellerem Fels
NX, NW_, NTOP, NBOT = W // 2, 74, 30, H
def in_niche(x, y, pad=0):
    r = NW_ + pad
    cy = NTOP + NW_
    if y >= cy: return abs(x + .5 - NX) < r
    return math.hypot(x + .5 - NX, y + .5 - cy) < r
for y in range(H):
    for x in range(W):
        if in_niche(x, y):
            t = min(1, max(0, (y - NTOP) / 220))
            c0, c1 = np.array((10, 6, 6)), np.array((52, 30, 16))
            q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
            cv.a[y, x] = (c0 * (1 - q) + c1 * q).astype(np.uint8)
        elif in_niche(x, y, 4):
            cv.a[y, x] = (cv.a[y, x].astype(int) * 1.35).clip(0, 255).astype(np.uint8)
        elif in_niche(x, y, 6):
            cv.a[y, x] = (30, 16, 8)

# ---------- Garde mit Dampf (in der Nische, halb im Dunkel)
pilot = sprite('c16_pilot', SD, [429])
eng = sprite('c15_eng', SD, [419])
steam1 = sprite('c14_steam1', SD, [415])
P = up(pilot, 3); E = up(eng, 3)
gy = 262
cv.paste(up(steam1, 2), NX - 88, gy - P.shape[0] - 120)
cv.paste(flip(up(steam1, 2)), NX + 26, gy - E.shape[0] - 110)
cv.paste(darken(P, 0.72), NX - 82, gy - P.shape[0])
cv.paste(darken(E, 0.72), NX + 82 - E.shape[1], gy - E.shape[0])

# ---------- Fass-Hammer, Fässer, König
p265 = parts(sprite('c16_items', M, [265]), dil=1)
hammer = [p for p in p265 if p.shape[:2] == (34, 23)][0]
barrel = [p for p in p265 if p.shape[:2] == (16, 14)][0]
king = sprite('c16_king', M, [266])
KK = 8
Kg = up(king, KK)
kx, ky = (W - Kg.shape[1]) // 2, H - Kg.shape[0]
Hm = up(hammer, 4)
cv.paste(silhouette(Hm, (12, 6, 4)), 20 + 4, ky - 64 + 4, alpha=0.5)
cv.paste(Hm, 20, ky - 64)
Bl = up(barrel, 3)
cv.paste(flip(Bl), W - Bl.shape[1] + 6, H - Bl.shape[0] + 4)
cv.paste(Bl, -8, H - Bl.shape[0] + 8)
cv.paste(silhouette(up(outline(king), KK), (10, 5, 3)), kx - KK + 4, ky - KK + 4, alpha=0.5)
cv.paste(up(outline(king, (30, 14, 6)), KK), kx - KK, ky - KK)
cv.paste(Kg, kx, ky)

# ---------- Glitzer (Ebene 264): wenige Funken an Krone und Hammer
spk = parts(sprite('c16_sparkle', M, [264]), dil=0)
big = [p for p in spk if p.shape[0] == 5]
for (x, y, k, i) in [(34, 70, 3, 0), (96, 120, 2, 1), (192, 150, 3, 2), (70, 196, 2, 3), (214, 94, 2, 0)]:
    cv.paste(up(big[i % len(big)], k), x, y)

print(save(cv, '16_dwarf_king.png'))
