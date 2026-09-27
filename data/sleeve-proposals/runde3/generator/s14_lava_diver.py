# -*- coding: utf-8 -*-
"""Sleeve 14 – Tauchgang im Lavasee (Querschnitt).

Oben auf dem Felsvorsprung zapft der Steam Dwarf Brewer sein Fass, rechts bohrt sich der Steam Dwarf
Miner in den Fels; darunter, im Querschnitt durch den Lavasee, stapft der Steam Dwarf Diver über den
Grund. Aus seinem Dampfrohr steigt der Dampf als Dampfsäule durch die Lava bis zur
Oberfläche, wo er als Wolke hervorbricht und zwischen den Felsvorsprüngen aufsteigt.

Quellen (MotiveSteamDwarfs.xcf):
  Diver       = Ebenen 420 (nur Helm-Teil, Box), 421–424   (Karte „Steam Dwarf Diver“)
  Brewer      = Ebenen 440–442, Fässer aus Ebene 443      (Karte „Steam Dwarf Brewer“)
  Miner       = Ebenen 437–439                            (Karte „Steam Dwarf Miner“)
  Dampf       = Ebenen 414 (Doppelwolke) / 415 (Dampfsäule)
  Texturen    = Lava + Felsnadeln (Ebene 444), Krustengestein und Felswand (Ebene 445)
"""
from c_util import *
from xcfkit import parts

cv = Canvas(W, H)

# ---------- Texturen
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))          # 16×16 Lavakachel
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))          # 16×16 rote Kruste
cliff = tex('c14_cliff', SD, 445, (72, 216, 104, 280))         # 32×64 dunkle Felswand
sp = np.dstack([tex('c14_spike', SD, 444, (88, 448, 95, 462)), np.zeros((14, 7), np.uint8)])
spc = sp[..., :3].astype(int)
sp[..., 3] = np.where((spc.max(-1) - spc.min(-1)) < 30, 255, 0)  # graue Felsnadel freistellen
spike = trim(sp)

SURF = 122                       # Lavaoberfläche (Canvas-y)
FLOOR = 326                      # Seegrund
# Felswand hinten (oben), 2×, nach oben dunkler
tile_fill(cv, cliff, 0, 0, W, SURF, k=2, ox=6)
shade_rows(cv, 0, 70, 0.7, 0.0, (22, 8, 10))
# Lavasee im Querschnitt, 2×, nach unten dunkler und röter
tile_fill(cv, lava, 0, SURF, W, FLOOR, k=2)
shade_rows(cv, SURF + 14, FLOOR, 0.0, 0.9, (150, 30, 14))
shade_rows(cv, SURF + 120, FLOOR, 0.0, 0.5, (70, 10, 8))
cv.rect(0, SURF, W, SURF + 2, (255, 246, 190))                 # glühende Oberfläche
# Seegrund: Kruste 2× mit Felsnadeln
tile_fill(cv, crust, 0, FLOOR, W, H, k=2, oy=4)
shade_rows(cv, FLOOR, H, 0.25, 0.75, (30, 6, 8))
cv.rect(0, FLOOR, W, FLOOR + 1, (255, 200, 110))
for x, k in [(14, 3), (40, 2), (196, 3), (226, 2)]:
    S = up(spike, k)
    cv.paste(S, x, FLOOR - S.shape[0] + 4)

# ---------- Felsvorsprünge (Kruste, 2×)
def ledge(x0, y0, x1, y1):
    tile_fill(cv, crust, x0, y0, x1, y1, k=2)
    cv.rect(x0, y1, x1, y1 + 2, (40, 10, 12))
    cv.rect(x0, y0, x1, y0 + 1, (255, 170, 90))
LL = (0, 100, 146, SURF - 2)          # links: Brauer (liegt auf der Lava auf)
LR = (176, 82, 250, 104)             # rechts oben: Bergmann
tile_fill(cv, cliff, 190, LR[3], 250, SURF, k=2, ox=10)           # Felspfeiler unter dem rechten Vorsprung
shade_rows(cv, LR[3], SURF, 0.5, 0.1, (22, 8, 10), x0=190)

# ---------- Figuren / Dampf
diver = sprite('c14_diver', SD, [420, 421, 422, 423, 424], box=(266, 172, 294, 214))
brewer = sprite('c14_brewer', SD, [440, 441, 442], box=(250, 450, 292, 484))
miner = sprite('c14_miner', SD, [437, 438, 439])
barrels = parts(sprite('c14_barrels', SD, [443]), dil=1)
steam1 = sprite('c14_steam1', SD, [415])                   # einzelne Dampfsäule 31×80
steam2 = parts(sprite('c14_steam2', SD, [414]), dil=1)[1]  # Doppelsäule 42×80


# Taucher: aus seinem Rohr steigt eine Dampfsäule (1×, im Glutschein eingefärbt, dunkel umrandet)
# bis zur Oberfläche; dort bricht der Dampf als Doppelwolke (2×) hervor und quillt zwischen den
# Felsvorsprüngen nach oben
D = up(diver, 5)
dx, dy = 62, FLOOR - D.shape[0] + 6
pipe_x = dx + 18 * 5 + 2                                   # rechtes Rohr (Diver-Spalte 17–20)
col = outline(tint(steam1, (255, 200, 120), 0.3), (150, 40, 20))    # ganze Dampfsäule 1×, Spitze am Rohr
Dc = up(steam2, 2)
cv.paste(Dc, pipe_x - Dc.shape[1] // 2 + 2, SURF - Dc.shape[0] + 20)
cv.paste(col, pipe_x - 13, dy + 4 - col.shape[0])

ledge(*LL)
ledge(*LR)

B = up(brewer, 3)
cv.paste(B, 34, LL[1] - B.shape[0] + 3)
bar = up(barrels[2], 3); cv.paste(bar, 104, LL[1] - bar.shape[0] + 2)
bar = up(barrels[0], 3); cv.paste(bar, 2, LL[1] - bar.shape[0] + 2)

# Bergmann: Körper steht auf dem Vorsprung, der Bohrer steckt im Gestein (nur die obersten
# 3 Bohrer-Zeilen sichtbar, darunter das Bohrloch)
mb = 28                                                     # erste Bohrer-Zeile (unter dem Körper)
M = up(miner[:mb + 3], 3)
mx, my = 192, LR[1] - mb * 3 + 3
cv.rect(mx + 8 * 3 - 2, LR[1] + 3, mx + 14 * 3 + 2, LR[1] + 12, (40, 10, 10))   # Bohrloch
cv.paste(M, mx, my)

# Taucher mit dunkler Kontur vor der Lava
cv.paste(up(outline(diver, (40, 6, 6)), 5), dx - 5, dy - 5)
cv.paste(D, dx, dy)

print(save(cv, '14_lava_diver.png'))
