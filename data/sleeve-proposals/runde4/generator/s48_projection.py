# -*- coding: utf-8 -*-
"""48 Projection – Nachts steht der Idej Projector auf dem Dachfirst von Todugawins violetter Pagode und wirft
einen Lichtkegel in den Himmel; darin schwebt riesig und halbtransparent das Hologramm des vermummten Idej.

Quellen (MotiveJapan.xcf):
  Ebene 232 „Idej Projector #1“ – projizierte Figur (Karte „Idej Projector“), als Hologramm umgefärbt, 5×
  Ebene 233 „Idej Projector“ – Projektor (gleiche Karte, Szene „Sichtbar #37“), 3×
  Ebene 236 „House Todugawin“ – violette Pagode, beide Dächer + oberes Stockwerk, 3×
  Ebene 246 „Ebene #137“ – violetter Wolkenhimmel der Karte, abgedunkelt, 2×
Selbst gezeichnet: Lichtkegel, Leuchten, Scanlinien, Sterne.
Skalierung: Himmel/Wolken/Sterne und Lichtkegel (Licht im Himmel) 2× (125×175); Pagode + Projektor 3× (84×117);
Hologramm als Erscheinung im Lichtkegel auf eigener Ebene 5× (50×70), steht über allem und neben keiner Figur.
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
pl = Lay(3)                        # Pagode + Projektor
houses = parts(sprite('j48_houses', J, [236]), dil=1)
pag = [p for p in houses if p.shape[:2] == (83, 80)][0]


def ridge_row(p):
    """Firstlinie des oberen Daches: erste Zeile mit breitem deckenden Lauf (ohne die Zierhörner)."""
    for j in range(p.shape[0]):
        if (p[j, :, 3] > 0).sum() > 20: return j


RR = ridge_row(pag)
PX = (pl.w - pag.shape[1]) // 2
RIDGE = 66                        # Firstlinie im 3×-Raster (→ 198 px)
PY = RIDGE - RR
# Pagode nachts: Wände/Pfosten abgedunkelt, Dächer violett; Mondlicht-Kanten oben auf jedem Dach
P = darken(pag, 0.8)
pl.paste(P, PX, PY)
ROOF_HI, ROOF_HI2 = (176, 120, 232), (126, 80, 190)
for x in range(pl.w):
    for y in range(1, pl.h):
        c = pl.get(x, y)
        if c is None or not c[3]: continue
        up_ = pl.get(x, y - 1)
        if up_ is not None and not up_[3]:
            r, g, b = [int(v) for v in c[:3]]
            if b > r and b > g:                  # Dachfläche (violett): Oberkante aufhellen
                pl.px(x, y, ROOF_HI if abs(x - pl.w / 2) < 22 else ROOF_HI2)
# warm erleuchtete Fenster im oberen Stockwerk (Wandfelder zwischen den roten Pfosten)
for x in range(pl.w):
    for y in range(RIDGE, pl.h):
        c = pl.get(x, y)
        if c is not None and c[3] and min(c[:3]) > 130:            # helle Papierwand
            pl.px(x, y, (236, 196, 120) if (y - RIDGE) % 7 < 5 else (200, 150, 90))

proj = sprite('j48_proj', J, [233])
pw, ph = proj.shape[1], proj.shape[0]
PRX = (pl.w - pw) // 2
TOPY = RIDGE - ph                  # Oberkante Projektor
slit = [i for i in range(pw) if proj[0:2, i, 2].max() > 180 and proj[0:2, i, 0].max() < 220]
SL0, SL1 = PRX + min(slit or [4]), PRX + max(slit or [pw - 5])

# Hologramm als Erscheinung im Lichtkegel auf eigener Ebene (5×)
hl = Lay(5)
holo = sprite('j48_holo', J, [232])
hw, hh = holo.shape[1], holo.shape[0]
HX = (hl.w - hw) // 2
HY = 7                              # → 35..150 px

# Lichtkegel als Himmelslicht im 2×-Raster: vom Projektorschlitz nach oben aufgefächert, weich gedithert
k2 = pl.k / sky.k
bx0, bx1, by = SL0 * k2, (SL1 + 1) * k2, TOPY * k2
BEAM = [(52, 34, 104), (84, 52, 150), (130, 90, 206), (190, 150, 240)]
for y in range(0, int(by)):
    t = (by - y) / by                                  # 0 unten, 1 oben
    xl = bx0 - t * 30; xr = bx1 + t * 30
    fade = 1 - max(0.0, (t - 0.6) / 0.4) ** 1.5         # oben ausblenden
    for x in range(int(xl) - 1, int(xr) + 2):
        u = (x + .5 - xl) / max(1, xr - xl)
        if not 0 <= u <= 1: continue
        core = 1 - abs(u - 0.5) * 2                     # 0 Rand .. 1 Mitte
        lvl = (0.3 + 0.55 * core) * fade * 3.2
        base = int(lvl); frac = lvl - base
        if frac > B4[y % 4, x % 4]: base += 1
        if base >= 1: sky.px(x, y, BEAM[min(3, base - 1)])
pl.paste(proj, PRX, TOPY)

# Hologramm: Originalfarben aufgehellt und Richtung Lichtviolett getönt; jede dritte Zeile fehlt
# (Scanline = durchsichtige ganze Pixel), klare dunkle Kontur bleibt erhalten.
Hh = recolor(holo, lambda a: (a * 1.35) * 0.62 + np.array([236, 206, 255]) * 0.38)
dark = holo[..., :3].astype(int).sum(-1) < 150
Hh[dark, :3] = (58, 20, 110)
for j in range(hh):
    if j % 3 == 2:
        for i in range(hw):
            if Hh[j, i, 3] and not dark[j, i]: Hh[j, i, :3] = (150, 110, 226)
hl.paste(Hh, HX, HY)

cv = flatten([sky, pl, hl])
print(save(cv, '48_projection.png'))
