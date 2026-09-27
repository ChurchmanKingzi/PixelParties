# -*- coding: utf-8 -*-
"""Sleeve 15 – Wappen der Dampfzwerge (heraldische Komposition ohne Text).

Schildfigur ist der goldene Dampf-Panzer des Steam Dwarf Engineer (6×), Schildhalter sind zwei
(gespiegelte) Zwergen-Mechaniker mit Schraubenschlüssel. Aus ihren Dampfrohren steigen Dampfsäulen als
Helmdecke auf; alle stehen auf einem Krustenufer über einem Lavastreifen, dahinter ein Strahlenkranz
in Glutfarben.

Quellen (MotiveSteamDwarfs.xcf, Karte „Steam Dwarf Engineer“):
  Panzer (Engineer)  = Ebene 419
  Mechaniker         = Ebenen 417 (Schraubenschlüssel) + 418
  Dampf              = Ebene 415 (Dampfsäule), 414 (Doppelsäule)
  Lava / Kruste      = Ebenen 444 / 445
"""
from c_util import *
from xcfkit import parts

cv = Canvas(W, H, (26, 8, 10))
CX, CY = W // 2, 150

# ---------- Strahlenkranz (selbst gezeichnet, Glutfarben, 24 Strahlen)
C_DARK, C_RAY, C_RAY2 = (34, 10, 12), (92, 22, 18), (140, 40, 22)
for y in range(H):
    for x in range(W):
        a = math.atan2(y + .5 - CY, x + .5 - CX)
        r = math.hypot(x + .5 - CX, y + .5 - CY)
        on = int((a / (2 * math.pi) * 24) % 2) == 0
        t = max(0.0, 1 - r / 230)
        if on:
            cv.a[y, x] = C_RAY2 if t > 0.62 + 0.12 * BAYER4[y % 4, x % 4] else (C_RAY if t > 0.25 else C_DARK)
        else:
            cv.a[y, x] = C_DARK if t < 0.7 else C_RAY if t > 0.78 + 0.1 * BAYER4[y % 4, x % 4] else C_DARK

# ---------- Sprites
eng = sprite('c15_eng', SD, [419])
comp = sprite('c15_comp', SD, [417, 418])
steam1 = sprite('c14_steam1', SD, [415])
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))

# ---------- Sockel: Lava + Krustenband
BASE = 300
tile_fill(cv, lava, 0, BASE, W, H, k=2)
shade_rows(cv, BASE, H, 0.3, 0.8, (120, 22, 12))
cv.rect(0, BASE, W, BASE + 1, (255, 246, 190))

# ---------- Positionen
GROUND = BASE - 14
K = 6
E = up(eng, K)
ex, ey = CX - E.shape[1] // 2, GROUND + 6 - E.shape[0]
Cm = up(comp, 3)
cy_ = GROUND + 8 - Cm.shape[0]                  # Mechaniker stehen auf dem Lavaufer
# Rohröffnungen des linken Mechanikers: Spalten 2–9, Zeile 0–4 (s. Maske) -> Dampf setzt dort an
P = up(steam1, 2)
tipx = 2 + 6 * 3                               # Spitze der Dampfsäule (Spalte ~12 der Säule) über dem Rohr
px, py = tipx - 12 * 2, cy_ + 6 - P.shape[0]

# ---------- Helmdecke aus Dampf (hinter allem): links + gespiegelt rechts
cv.paste(P, px, py)
cv.paste(flip(P), W - px - P.shape[1], py)

# ---------- Uferkruste als Standfläche
tile_fill(cv, crust, 0, GROUND, W, BASE, k=2)
shade_rows(cv, GROUND, BASE, 0.0, 0.4, (30, 6, 8))
cv.rect(0, GROUND, W, GROUND + 1, (255, 170, 90))

# ---------- Schildfigur mit Schlagschatten
cv.paste(silhouette(up(outline(eng, (0, 0, 0)), K), (12, 4, 6)), ex - K + 5, ey - K + 4, alpha=0.6)
cv.paste(up(outline(eng, (20, 8, 6)), K), ex - K, ey - K)
cv.paste(E, ex, ey)

# ---------- Schildhalter
cv.paste(Cm, 2, cy_)
cv.paste(flip(Cm), W - 2 - Cm.shape[1], cy_)

print(save(cv, '15_steam_crest.png'))
