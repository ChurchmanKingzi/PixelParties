# -*- coding: utf-8 -*-
"""Sleeve 16 – Höhenflug: der Steam Dwarf Exterminator schießt auf seinem eigenen Flammenstrahl wie
eine Rakete aus dem Vulkankrater in den glühenden Abendhimmel und zieht eine Dampffahne hinter sich her.
Im Vordergrund schauen ihm Steam Dwarf Brewer und Steam Dwarf Miner als dunkle Silhouetten mit
Glut-Kontur nach.

Quellen (MotiveSteamDwarfs.xcf):
  Exterminator  = Ebenen 434 (Zwerg mit Gasmaske + Dampfrohren) + 433 (Flammenstrahl)
                  (Karte „Steam Dwarf Exterminator“)
  Zuschauer     = Brewer (Ebenen 440–442), Miner (Ebenen 437–439) als Silhouetten
  Himmel        = Ebene 413 (roter Wolkenhimmel)
  Dampffahne    = Ebene 415 (Dampfsäule, senkrecht gespiegelt)
  Vulkan        = Felswand + Kruste aus Ebene 445, Lava aus Ebene 444 (Form selbst gezeichnet)
"""
from c_util import *

cv = Canvas(W, H)

def shade_mask(m, col, f):
    """Maskierte Pixel mit Anteil f(y) zur Farbe col abdunkeln (4-stufiges Dithering)."""
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        q = min(1, max(0, math.floor(f(y) * 4 + BAYER4[y % 4, x % 4]) / 4))
        cv.a[y, x] = (cv.a[y, x] * (1 - q) + np.array(col) * q).astype(np.uint8)

# ---------- Himmel: Ebene 413, 2×, oben nachtdunkel, zum Horizont glühend
sky = tex('c16_sky', SD, 413, (0, 25, 236, 265))
S2 = up(np.dstack([sky, np.full(sky.shape[:2], 255, np.uint8)]), 2)[..., :3]
cv.a[:] = S2[40:40 + H, 120:120 + W]
shade_rows(cv, 0, 160, 0.85, 0.0, (20, 5, 14))
shade_rows(cv, 190, 290, 0.0, 0.5, (255, 180, 90))

# ---------- Exterminator (4×) und Dampffahne
K = 4
ext = sprite('c16_ext', SD, [433, 434])
X = up(ext, K)
xx, yy = (W - X.shape[1]) // 2 - 2, 14
steam1 = sprite('c14_steam1', SD, [415])
trail = up(steam1[::-1], 2)                                 # schmal an der Flamme, breit am Krater
tip_x, tip_y = xx + 11 * K + 2, yy + X.shape[0] - 3 * K
cv.paste(trail, tip_x - 18 * 2 - 1, tip_y)

# ---------- Vulkan in der Ferne
cliff = tex('c14_cliff', SD, 445, (72, 216, 104, 280))
crust = tex('c14_crust', SD, 445, (80, 280, 96, 296))
lava = tex('c14_lava', SD, 444, (100, 400, 116, 416))
CRX, CRY, CRW = tip_x, 258, 22
def top(x):
    d = abs(x + .5 - CRX)
    return CRY + (d - CRW) * 0.62 if d > CRW else CRY + 4
vm = np.zeros((H, W), bool)
for x in range(W):
    vm[int(math.ceil(top(x))):, x] = True
tile_fill(cv, cliff, 0, 200, W, H, k=1, mask=lambda x, y: vm[y, x])
shade_mask(vm, (30, 8, 12), lambda y: 0.35 + 0.4 * (y - CRY) / 90)
for x in range(W):
    t = int(math.ceil(top(x)))
    if abs(x + .5 - CRX) <= CRW - 1:            # Kraterschlund: Lava
        for y in range(t, t + 3): cv.a[y, x] = lava[y % 16, x % 16]
        cv.px(x, t, (255, 246, 190))
    else:
        cv.px(x, t, (255, 150, 80))
        for y in range(t + 1, min(H, t + 3)): cv.a[y, x] = crust[y % 16, x % 16]

# ---------- Vordergrund: dunkler Felsgrat mit Zuschauer-Silhouetten (Glutkontur oben/außen)
FG = (14, 4, 8)
def gy(x):                                  # Oberkante des Vordergrundgrats
    return 318 - 10 * math.cos((x - W / 2) / W * 2 * math.pi) + 3 * math.sin(x / 7)
for x in range(W):
    for y in range(int(gy(x)), H): cv.a[y, x] = FG
    cv.px(x, int(gy(x)), (120, 36, 20))

def rimlit(s, col_body=FG, col_rim=(230, 110, 50), side=1):
    """Silhouette mit Streiflicht: Pixel mit transparentem Nachbarn oben bzw. zur Seite side leuchten."""
    m = s[..., 3] > 0
    out = silhouette(s, col_body)
    up_ = np.zeros_like(m); up_[1:] = m[:-1]
    sd = np.zeros_like(m)
    if side > 0: sd[:, :-1] = m[:, 1:]
    else: sd[:, 1:] = m[:, :-1]
    rim = m & (~up_ | ~sd)
    out[rim, :3] = col_rim
    return out

brewer = sprite('c14_brewer', SD, [440, 441, 442], box=(250, 450, 292, 484))
miner = sprite('c14_miner', SD, [437, 438, 439])
Bs = up(rimlit(brewer, side=1), 4)                  # Licht kommt von der Bildmitte
cv.paste(Bs, -6, int(gy(40)) + 8 - Bs.shape[0])
Ms = up(rimlit(flip(miner)[:29], side=-1), 4)          # Bohrer steckt im Grat
cv.paste(Ms, W - Ms.shape[1] + 4, int(gy(210)) + 6 - Ms.shape[0])

# ---------- Exterminator mit Kontur
cv.paste(up(outline(ext, (40, 8, 8)), K), xx - K, yy - K)
cv.paste(X, xx, yy)

print(save(cv, '16_flame_flight.png'))
