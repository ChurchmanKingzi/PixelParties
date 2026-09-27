# -*- coding: utf-8 -*-
"""Sleeve 53 – Dragon Pilot im Höhlenmund (neu in Runde 3b).

Der Steam Dwarf Dragon Pilot – ein Zwerg im goldenen Drachen-Dampfanzug – steht breitbeinig im
Mund einer Lavahöhle, aus dem Drachenkopf steigt Dampf. Durch die dunkle Felsöffnung geht der Blick
weit hinaus und hinab auf den glühenden Lavasee mit Krusteninseln und Felsnadeln. Die Felskanten der
Öffnung werden vom Glutschein angestrahlt.

Skalierung / Tiefenstaffelung (wie „Count of the Deep“):
  Vordergrund 4×: Dragon Pilot, Dampfwölkchen, Höhlenfels (Kachel), Höhlenboden, Glutkanten
  Hintergrund 2×: Glutdunst, ferne Felsrücken, Lavasee mit Felsnadel-Silhouetten (weit entfernt,
                  durch die Höhlenöffnung gesehen; Dithering ebenfalls im 2×-Raster)

Quellen (MotiveSteamDwarfs.xcf, Karte „Steam Dwarf Dragon Pilot“, Szene 402):
  Dragon Pilot = Ebene 429 „Ebene #9“ (fig_check: keine weiteren Figurebenen; auf der Karte liegt die
                 Dampfsäule 427 halbtransparent über dem Kopf; bei 4× wäre sie ein riesiger Klecks, daher
                 kleine Dampfwölkchen, die aus dem Kopf aufsteigen)
  Dampf        = selbst gezeichnete Wölkchen in den zwei Farben der Dampfebene 427 (4×)
  Lavasee      = Lavakachel + Felsnadel aus Ebene 444 „Ebene #32“; Dunst/Felsrücken selbst gezeichnet
  Höhlenfels   = Ebene 445 „Ebene #1“ (dunkle Felswand), Boden = Kruste aus 445
"""
from c_util import *

KF, KB = 4, 2
cv = Canvas(W, H)
GW, GH = -(-W // KF), -(-H // KF)

# ---------- Hintergrund 2× (weit hinten): Glutdunst über dem Lavasee, Felsnadeln als Silhouetten
HOR = 236                                                     # Horizont (Canvas-y)
HZ = [(46, 10, 12), (86, 20, 16), (140, 40, 20), (196, 80, 30), (236, 136, 50)]
dither_fill(cv, 0, 0, W, HOR, lambda x, y: (y / HOR) ** 1.3, HZ, k=KB)
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))         # 16×16 Lavakachel
tile_fill(cv, lava, 0, HOR, W, H, k=KB)
shade_rows(cv, HOR + 2 * KB, H, 0.0, 0.5, (150, 36, 14), k=KB)
cv.rect(0, HOR, W, HOR + KB, (255, 240, 170))
# ferne Felsrücken (selbst gezeichnet, 2×): gezackte dunkle Silhouette am Horizont
rr = np.random.RandomState(7)
hgt = 0
for x in range(0, W, KB):
    hgt = int(np.clip(hgt + rr.randint(-1, 2), 0, 6))
    cv.rect(x, HOR - hgt * KB, x + KB, HOR, (70, 18, 16))
# Felsnadeln (Ebene 444) als dunkle Silhouetten im See, 2×
sp = np.dstack([tex('c14_spike', SD, 444, (88, 448, 95, 462)), np.zeros((14, 7), np.uint8)])
spc = sp[..., :3].astype(int)
sp[..., 3] = np.where((spc.max(-1) - spc.min(-1)) < 30, 255, 0)
spike = silhouette(trim(sp), (60, 16, 14))
for x, y in [(22, HOR + 18), (60, HOR + 8), (176, HOR + 12), (214, HOR + 26), (120, HOR + 4)]:
    S = up(spike, KB)
    cv.paste(S, x, y - S.shape[0])

# ---------- Höhlenöffnung (4×-Zellen): Bogen mit unregelmäßigem Rand, Boden unten
FLOOR = 78                                                    # Zellenzeile des Höhlenbodens
rng = np.random.RandomState(53)
jag = rng.randint(0, 3, 80)                                  # Zacken im Rand (0..2 Zellen)


def opening(i, j):
    if j >= FLOOR: return False
    cx, cy, rx, ry = W / KF / 2, 48, 25, 44
    u, v = (i + 0.5 - cx) / rx, (j + 0.5 - cy) / ry
    if v > 0: v = v * 0.35                                   # unten fast senkrechte Wände
    r = u * u + v * v
    a = int((math.atan2(v, u) + math.pi) / (2 * math.pi) * 79)
    return r < 1 - jag[a] * 0.05


rock = tex('c14_cliff', SD, 445, (72, 216, 104, 280))        # 32×64 dunkle Felswand
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))        # 16×16 Kruste
R5 = up(np.dstack([rock, np.full(rock.shape[:2], 255, np.uint8)]), KF)[..., :3]
C5 = up(np.dstack([crust, np.full(crust.shape[:2], 255, np.uint8)]), KF)[..., :3]
RIM, RIM2 = (232, 110, 40), (150, 52, 26)
for j in range(GH + 1):
    for i in range(GW):
        x, y = i * KF, j * KF
        if y >= H: continue
        if j >= FLOOR:                                       # Höhlenboden: Kruste, dunkel
            T, f = C5, 0.5 - 0.04 * (j - FLOOR)
        elif not opening(i, j):
            T, f = R5, 0.42
        else:
            continue
        blk = T[y % T.shape[0]:y % T.shape[0] + KF, x % T.shape[1]:x % T.shape[1] + KF].astype(float) * f
        cv.a[y:y + KF, x:x + KF] = blk[:H - y, :W - x].astype(np.uint8)
        # Glutkante: Felszellen, die an die Öffnung grenzen
        if j < FLOOR and any(opening(i + di, j + dj) for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            cv.rect(x, y, x + KF, y + KF, RIM)
        elif j < FLOOR and any(opening(i + di, j + dj) for di, dj in ((2, 0), (-2, 0), (0, 2), (1, 1), (-1, 1))):
            cv.rect(x, y, x + KF, y + KF, RIM2)
cv.rect(0, FLOOR * KF, W, FLOOR * KF + KF, (200, 90, 40))     # vorderste Bodenkante im Glutschein
for i in range(0, GW, 3):
    cv.rect(i * KF, FLOOR * KF + KF, i * KF + KF, FLOOR * KF + 2 * KF, RIM2)

# ---------- Dragon Pilot 4× mit Dampf aus dem Drachenkopf (Dampf hinter dem Kopf)
pilot = figure('c53_pilot', SD, [429])
PX0, PY0 = 335, 307                                          # native Lage des Piloten
Pw, Ph = pilot.shape[1] * KF, pilot.shape[0] * KF
px, py = (W - Pw) // 2, (FLOOR + 1) * KF - Ph
# Dampfwölkchen aus dem Drachenkopf (4×, selbst gezeichnet in den zwei Dampftönen der Ebene 427):
# die große Dampfsäule der Karte würde bei 4× das halbe Bild füllen
ST_L, ST_D = (217, 217, 217), (125, 125, 125)
def puff(ci, cj, r):
    for j in range(-r, r + 1):
        for i in range(-r, r + 1):
            d = math.hypot(i, j)
            if d <= r + 0.3:
                col = ST_D if (i - j * 0.3) < -r * 0.45 or (d > r - 0.7 and j > 0) else ST_L
                cv.rect(px + (ci + i) * KF, py + (cj + j) * KF, px + (ci + i + 1) * KF, py + (cj + j + 1) * KF, col)
hc = pilot.shape[1] // 2
for ci, cj, r in [(hc + 6, -21, 4), (hc + 1, -14, 3), (hc - 2, -8, 2), (hc, -3, 1)]:
    puff(ci, cj, r)
# Schlagschatten auf dem Boden (flach, 4×)
for k_ in range(2):
    cv.rect(px + (3 + k_) * KF, py + Ph - KF + k_ * KF, px + Pw - (3 + k_) * KF, py + Ph + k_ * KF, (30, 8, 8))
put(cv, pilot, px, py, KF, ol=(26, 10, 6))

print(save(cv, '53_dragon_pilot.png'))
