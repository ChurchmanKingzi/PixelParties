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
P = up(pilot, 2); E = up(eng, 2)
gy = 250                                           # Standlinie der Garde (weiter hinten in der Nische)
px_, ex_ = 0, W - E.shape[1]
S = up(steam1, 2)
# Dampf steigt aus den Köpfen der Mechs (wie auf den Karten), Säulenspitze Spalte ~12
cv.paste(S, px_ + P.shape[1] // 2 - 24, gy - P.shape[0] + 10 - S.shape[0])
cv.paste(flip(S), ex_ + E.shape[1] // 2 - (S.shape[1] - 24), gy - E.shape[0] + 10 - S.shape[0])
# Felssimse, auf denen die Garde steht (Felstextur aufgehellt, Kante + Schatten)
for x0, x1 in ((0, 66), (W - 64, W)):
    tile_fill(cv, rock, x0, gy - 3, x1, gy + 9, k=1, ox=x0)
    for y in range(gy - 3, gy + 9):
        for x in range(x0, x1):
            cv.a[y, x] = (cv.a[y, x].astype(int) * 1.25).clip(0, 255).astype(np.uint8)
    cv.rect(x0, gy - 3, x1, gy - 2, (190, 140, 90))
    cv.rect(x0, gy + 9, x1, gy + 12, (20, 10, 6))
cv.paste(darken(P, 0.8), px_, gy - P.shape[0])
cv.paste(darken(flip(E), 0.8), ex_, gy - E.shape[0])

# ---------- Fass-Hammer, Fässer, König
p265 = parts(sprite('c16_items', M, [265]), dil=1)
hammer = [p for p in p265 if p.shape[:2] == (34, 23)][0]
barrel = [p for p in p265 if p.shape[:2] == (16, 14)][0]
king = sprite('c16_king', M, [266])
KK = 7
Kg = up(king, KK)
kx, ky = (W - Kg.shape[1]) // 2, H - Kg.shape[0]
Hm = up(hammer, 4)                                 # Fass-Hammer als Wahrzeichen in der Nische
hx, hy = NX - Hm.shape[1] // 2, NTOP + 18
cv.paste(silhouette(Hm, (4, 2, 2)), hx + 4, hy + 4, alpha=0.6)
cv.paste(Hm, hx, hy)
Bl = up(barrel, 3)
cv.paste(flip(Bl), W - Bl.shape[1] + 6, H - Bl.shape[0] + 4)
cv.paste(Bl, -8, H - Bl.shape[0] + 8)
cv.paste(silhouette(up(outline(king), KK), (10, 5, 3)), kx - KK + 4, ky - KK + 4, alpha=0.5)
cv.paste(up(outline(king, (30, 14, 6)), KK), kx - KK, ky - KK)
cv.paste(Kg, kx, ky)

# ---------- Glitzer (Ebene 264): wenige Funken an Krone und Hammer
spk = parts(sprite('c16_sparkle', M, [264]), dil=0)
big = [p for p in spk if p.shape[0] == 5]
for (x, y, k, i) in [(hx - 12, hy + 6, 3, 0), (hx + Hm.shape[1] - 2, hy + 40, 2, 1), (hx + 70, hy + 104, 3, 2), (hx + 2, hy + 86, 2, 3)]:
    cv.paste(up(big[i % len(big)], k), x, y)

print(save(cv, '16_dwarf_king.png'))
