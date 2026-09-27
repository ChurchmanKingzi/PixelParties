# -*- coding: utf-8 -*-
"""48 Projection – Nachts steht der Idej Projector auf dem Dachfirst von Todugawins violetter Pagode und wirft
einen Lichtkegel in den Himmel; darin schwebt riesig und halbtransparent das Hologramm des vermummten Idej.

Quellen (MotiveJapan.xcf):
  Ebene 232 „Idej Projector #1“ – projizierte Figur (Karte „Idej Projector“), als Hologramm umgefärbt, 6×
  Ebene 233 „Idej Projector“ – Projektor (gleiche Karte, Szene „Sichtbar #37“), 6×
  Ebene 236 „House Todugawin“ – violette Pagode (oberes Dach + Teil des unteren), 6×
  Ebene 246 „Ebene #137“ – violetter Wolkenhimmel der Karte, abgedunkelt, 2×
Selbst gezeichnet: Lichtkegel, Leuchten, Scanlinien, Sterne.
Skalierung: Himmel/Wolken/Sterne und Lichtkegel (Licht im Himmel) 2× (125×175); Pagode, Projektor, Hologramm 6× (42×59).
"""
import math, random
from j_util_46_50 import *  # noqa

J = 'MotiveJapan'
random.seed(48)

# ---------------- 2×: Nachthimmel mit Wolken ----------------
sky = Lay(2)
clouds = hsv_shift(sprite('j48_sky', J, [246]), dh=-40, ds=0.7)
ch, cw = clouds.shape[:2]
ox, oy = (cw - sky.w) // 2 + 10, 20
for y in range(sky.h):
    for x in range(sky.w):
        c = clouds[(y + oy) % ch, (x + ox) % cw, :3].astype(float)
        f = 0.30 + 0.12 * (y / sky.h)
        sky.px(x, y, tuple(int(v * f) for v in c))
for _ in range(50):
    x, y = random.randrange(4, sky.w - 4), random.randrange(4, 120)
    c = sky.get(x, y)
    if c is not None and c[:3].astype(int).sum() < 110:
        sky.px(x, y, (220, 220, 255) if random.random() < 0.4 else (130, 130, 200))

# ---------------- 5×: Pagode, Projektor, Kegel, Hologramm ----------------
fg = Lay(6)
houses = parts(sprite('j48_houses', J, [236]), dil=1)
pag = [p for p in houses if p.shape[:2] == (83, 80)][0]


def ridge_row(p):
    """Firstlinie des oberen Daches: erste Zeile mit breitem deckenden Lauf (ohne die Zierhörner)."""
    for j in range(p.shape[0]):
        if (p[j, :, 3] > 0).sum() > 20: return j


RR = ridge_row(pag)
PX = (fg.w - pag.shape[1]) // 2
RIDGE = 44                        # Firstlinie im 6×-Raster (→ 264 px)
PY = RIDGE - RR
# Pagode nachts: abgedunkelt, Dachkanten vom Lichtkegel aufgehellt
P = darken(pag, 0.72)
fg.paste(P, PX, PY)
for x in range(fg.w):
    for y in range(fg.h):
        if fg.a[y, x, 3] and (y == 0 or not fg.a[y - 1, x, 3]) and y >= RIDGE - 1:
            d = abs(x - fg.w / 2)
            if d < 14: fg.px(x, y, (150, 96, 210) if d < 7 else (104, 60, 160))

proj = sprite('j48_proj', J, [233])
pw, ph = proj.shape[1], proj.shape[0]
PRX = (fg.w - pw) // 2
TOPY = RIDGE - ph                  # Oberkante Projektor
slit = [i for i in range(pw) if proj[0:2, i, 2].max() > 180 and proj[0:2, i, 0].max() < 220]
SL0, SL1 = PRX + min(slit or [4]), PRX + max(slit or [pw - 5])

holo = sprite('j48_holo', J, [232])
hw, hh = holo.shape[1], holo.shape[0]
HX = (fg.w - hw) // 2
HY = 8

# Lichtkegel als Himmelslicht im 2×-Raster: vom Projektorschlitz nach oben aufgefächert, weich gedithert
k2 = fg.k / sky.k
bx0, bx1, by = SL0 * k2, (SL1 + 1) * k2, TOPY * k2
BEAM = [(52, 34, 104), (84, 52, 150), (130, 90, 206), (190, 150, 240)]
for y in range(0, int(by)):
    t = (by - y) / by                                  # 0 unten, 1 oben
    xl = bx0 - t * 22; xr = bx1 + t * 22
    fade = 1 - max(0.0, (t - 0.55) / 0.45) ** 1.5       # oben ausblenden
    for x in range(int(xl) - 1, int(xr) + 2):
        u = (x + .5 - xl) / max(1, xr - xl)
        if not 0 <= u <= 1: continue
        core = 1 - abs(u - 0.5) * 2                     # 0 Rand .. 1 Mitte
        lvl = (0.35 + 0.65 * core) * fade * 3.2
        base = int(lvl); frac = lvl - base
        if frac > B4[y % 4, x % 4]: base += 1
        if base >= 1: sky.px(x, y, BEAM[min(3, base - 1)])
# Leuchten um das Hologramm
sky.radial((HX + hw / 2) * k2, (HY + hh / 2) * k2, 38, (150, 110, 226), 0.5, 1.4, only_opaque=True)
fg.paste(proj, PRX, TOPY)

# Hologramm: violett-weiß umgefärbt, Scanlinien, heller Saum
Hh = lum_tint(holo, (70, 26, 136), (255, 240, 255))
for j in range(hh):
    if j % 3 == 2: Hh[j, :, :3] = (Hh[j, :, :3].astype(int) * 0.78).astype(np.uint8)
fg.paste(Hh, HX, HY)

cv = flatten([sky, fg], crop=None)
print(save(cv, '48_projection.png'))
