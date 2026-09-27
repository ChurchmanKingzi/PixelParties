# -*- coding: utf-8 -*-
"""Sleeve 17 – Duell im Schneesturm (Blick über die Schulter), überarbeitet für Runde 3b.

Der Mischief-Militia-Bärenreiter steht – von hinten gesehen – auf der verschneiten Eiskante des
Nordmeers; vor ihm erhebt sich die dreiköpfige Nothern Hydra aus dem dunklen Wasser. Schneeflocken
treiben quer durchs Bild.

Skalierung / Tiefenstaffelung (zwei klar getrennte Ebenen):
  Vordergrund 4×: Bärenreiter, Eiskante (Schraffur), Schneefeld, Schneeflocken
  Mittelgrund 3×: Nothern Hydra, Meer (Wellenkacheln), Schaumkranz an der Wasserlinie
  Die frühere 2×-Uferkulisse mit Tannen neben dem 4×-Bären ist entfallen (Regel A).

Quellen (MotiveRussia.xcf):
  Bärenreiter von hinten = Ebene 76 „Ebene #109“ (Karte „Mischief Invasion“, Szene 40: vollständig)
  Nothern Hydra          = Ebene 9 „Nothern Hydra“ (Szene 1: vollständig inkl. Hörnerbögen)
  Meer / Eiskante / Schnee = Ebene 221 „Ebene #6“ (Kulisse der Hydra-Karte), Kacheln daraus
  Schaumkranz, Flocken   = selbst gezeichnet in den Farben der Eiskante
"""
from c_util import *

cv = Canvas(W, H)
KF, KM = 4, 3                                   # Vorder- / Mittelgrund

dark = tex('c17_sea_dark', RU, 221, (380, 330, 396, 346))     # 16×16 dunkles Meer
bright = tex('c17_sea_bright', RU, 221, (392, 382, 408, 398))  # 16×16 helles Meer
snow = tex('c17_snow', RU, 221, (520, 374, 564, 386))          # 44×12 Schneefeld
snow = np.concatenate([snow, snow[:, ::-1]], 1)                 # gespiegelt gekachelt (nahtlos)
hatch = tex('c17_hatch', RU, 221, (506, 358, 570, 368))        # 64×10 schraffierte Eiskante

SHORE = 236                                     # Oberkante der Eiskante (Vordergrund)

# ---------- Meer (3×): oben dunkel, zur Küste hin heller, geordnet übergeblendet im 3×-Raster
def tiled(t, k):
    T = up(np.dstack([t, np.full(t.shape[:2], 255, np.uint8)]), k)[..., :3]
    return np.tile(T, (H // T.shape[0] + 1, W // T.shape[1] + 1, 1))[:H, :W]
D3, B3 = tiled(dark, KM), tiled(bright, KM)
yy, xx = np.mgrid[0:H, 0:W]
tb = (yy // KM * KM - 90) / 110
useb = tb > BAYER4[(yy // KM) % 4, (xx // KM) % 4]
sea = np.where(useb[..., None], B3, D3)
cv.a[:SHORE + KM] = sea[:SHORE + KM]
shade_rows(cv, 0, 120, 0.6, 0.0, (8, 12, 40), k=KM)            # Sturmdunkel

# ---------- Hydra (3×), steigt hinter der Eiskante aus dem Wasser
hydra = figure('c17_hydra', RU, [9])
Hy = up(hydra, KM)
WL = SHORE - 5 * KM                                             # Wasserlinie (knapp vor der Kante sichtbar)
hx, hy = (W - Hy.shape[1]) // 2 + 3, WL + 4 * KM - Hy.shape[0]
vis = Hy[:WL - hy].copy()
cv.paste(silhouette(vis, (10, 16, 50)), hx + KM, hy + 2 * KM, alpha=0.5)
cv.paste(vis, hx, hy)
# Schaumkranz an der Wasserlinie (3×)
cols = np.nonzero(Hy[WL - hy - 1, :, 3] > 0)[0]
FOAM, FOAM2 = (236, 240, 255), (150, 176, 250)
c0, c1 = (hx + cols.min()) // KM * KM, (hx + cols.max()) // KM * KM
for x in range(c0 - 2 * KM, c1 + 3 * KM, KM):
    cv.rect(x, WL, x + KM, WL + KM, FOAM)
    cv.rect(x, WL + KM, x + KM, WL + 2 * KM, FOAM if (x // KM) % 3 else FOAM2)
for (x0, x1, dy) in [(c0 - 12 * KM, c0 - 4 * KM, 2), (c1 + 5 * KM, c1 + 12 * KM, 2), (c0 + 6 * KM, c0 + 14 * KM, 3)]:
    for x in range(x0, x1, KM):
        cv.rect(x, WL + dy * KM, x + KM, WL + (dy + 1) * KM, FOAM2 if (x // KM) % 3 == 0 else FOAM)

# ---------- Eiskante + Schneefeld (4×)
tile_fill(cv, hatch, 0, SHORE, W, SHORE + 10 * KF, k=KF, ox=8)
cv.rect(0, SHORE, W, SHORE + KF, (250, 252, 255))
tile_fill(cv, snow, 0, SHORE + 9 * KF, W, H, k=KF)
cv.rect(0, SHORE + 9 * KF, W, SHORE + 10 * KF, (196, 196, 236))

# ---------- Bärenreiter von hinten (4×), steht auf dem Schneefeld
bear = figure('c17_bear_back', RU, [76])
Bw, Bh = bear.shape[1] * KF, bear.shape[0] * KF
bx, by = (W - Bw) // 2, H - Bh - 2 * KF
# Schatten im Schnee (flache Ellipse, 4×)
for j in range(3):
    w_ = (bear.shape[1] // 2 - 2 * j) * KF
    cv.rect(bx + Bw // 2 - w_, by + Bh - KF + j * KF, bx + Bw // 2 + w_, by + Bh + j * KF, (170, 170, 214))
put(cv, bear, bx, by, KF, ol=(24, 22, 40))

# ---------- Schneeflocken (4×, einzelne Pixel und kleine Kreuze), deterministisch verteilt
rng = np.random.RandomState(17)
for n in range(34):
    x = rng.randint(0, W // KF) * KF; y = rng.randint(0, H // KF) * KF
    if bx - 4 < x < bx + Bw and y > by: continue
    cv.rect(x, y, x + KF, y + KF, (244, 246, 255))
    if n % 6 == 0:
        for dx_, dy_ in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            cv.rect(x + dx_ * KF, y + dy_ * KF, x + (dx_ + 1) * KF, y + (dy_ + 1) * KF, (200, 206, 250))

print(save(cv, '17_hydra_duel.png'))
