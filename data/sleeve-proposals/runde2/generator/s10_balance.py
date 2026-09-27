# -*- coding: utf-8 -*-
"""Sleeve 10: Göttliches Gleichgewicht – die goldene Waage aus „Divine Gift of Balance“ vor Strahlenkranz und
Sternennebel; links wiegt die Sonne, rechts der Mond.

Quellen:
  - Waage: MotiveEgypt.xcf, Ebene „Ebene #113“ (#83) – vollständig, unverändert
  - Nebel: MotiveEgypt.xcf, Galaxie-Ebene „Ebene #112“ (#84), Ausschnitt wie im Kartenbild; auf eine Palette
    aus 7 Farben in harte Stufen posterisiert, nur der Rand geordnet gedithert (Grundraster)
  - Mond: MotiveBoons.xcf, Szene „Sichtbar #20“ (#6, Kartenbild „The Cosmic Depths“), Mond pixelgenau ausgeschnitten
  - Strahlenkranz: Strahlwinkel aus dem Kartenbild „Divine Awakening“, links/rechts gespiegelt, selbst gezeichnet
  - Sonne, Sterne, Himmelsverlauf: selbst gezeichnet (Pixel-Art, harte Kanten, begrenzte Palette)

Skalierung: ALLES 3× auf dem 250×350-Raster (Grundraster 84×117, 3× = 252×351, mittig auf 250×350 beschnitten):
Waage, Strahlen, Nebel, Sonne, Mond, Sterne, Himmel und alle Dither-Übergänge – kein Element feiner als 1 Grundpixel.
"""
import math
import numpy as np
from kit import *
import xcfkit as XK

NW, NH = 84, 117
cv = Canvas(NW, NH)
B4 = BAYER4
HAVE = lambda base: os.path.exists(os.path.join(XK.EXP, base, 'layers.json'))

# --- Himmel: flaches Nachtblau
SKY = (9, 13, 54)
cv.a[:] = SKY

# --- Sterne (1 Grundpixel, einige als kleines Kreuz)
rng = np.random.default_rng(7)
STAR = [(150, 170, 230), (210, 220, 255), (255, 255, 255)]
for _ in range(46):
    x, y = int(rng.integers(1, NW - 1)), int(rng.integers(1, NH - 1))
    cv.a[y, x] = STAR[int(rng.integers(0, 2))]
for (x, y) in [(9, 9), (74, 13), (13, 101), (71, 97), (42, 110), (6, 55), (79, 60)]:
    cv.a[y, x] = STAR[2]
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        cv.px(x + dx, y + dy, STAR[0])

# --- Strahlenkranz (Winkel aus „Divine Awakening“), Mittelpunkt hinter dem Drehpunkt der Waage
da = nat('Divine Awakening').astype(int)
dcx, dcy = 37.5, 27.5
hd = hsv_of(da)
rayish = (da.max(-1) > 200) & (hd[..., 1] < 120) & (hd[..., 0] > 25) & (hd[..., 0] < 60)
bins = np.zeros(360); cnt = np.zeros(360)
for y in range(da.shape[0]):
    for x in range(da.shape[1]):
        r = math.hypot(x + .5 - dcx, y + .5 - dcy)
        if 12 <= r <= 24:
            t = int(math.degrees(math.atan2(y + .5 - dcy, x + .5 - dcx))) % 360
            cnt[t] += 1; bins[t] += rayish[y, x]
ray = np.array([bins[t] / cnt[t] if cnt[t] else 0 for t in range(360)])
for t in range(360):
    if cnt[t] == 0: ray[t] = ray[(t - 1) % 360]
on = ray > 0.5
lab = np.zeros(360, int); k = 0
for t in range(360):
    if on[t] and not on[t - 1]: k += 1
    lab[t] = k if on[t] else 0
if on[0] and on[-1]: lab[lab == lab[0]] = lab[-1]
for v in set(lab) - {0}:
    if (lab == v).sum() < 5: on[lab == v] = False

RAYC = [(255, 244, 170), (214, 190, 110), (130, 116, 84), (58, 54, 72)]
rcx, rcy = NW / 2, 58.5
for y in range(NH):
    for x in range(NW):
        t = int(math.degrees(math.atan2(y + .5 - rcy, x + .5 - rcx))) % 360
        tm = (180 - t) % 360
        if on[t] or on[tm]:
            r = math.hypot(x + .5 - rcx, y + .5 - rcy)
            a = max(0.0, 1 - r / 78)
            if a > 0.55: cv.a[y, x] = RAYC[0]
            elif a > 0.36: cv.a[y, x] = RAYC[1]
            elif a > 0.17: cv.a[y, x] = RAYC[2]
            elif a > B4[y % 4, x % 4] * 0.15 + 0.03: cv.a[y, x] = RAYC[3]

# --- Waage (vollständige Ebene) und Lage
E = 'MotiveEgypt'
scale = XK.sprite('r2_10_scale', E, [83])                     # 60×39
sh, sw = scale.shape[:2]
sx, sy = (NW - sw) // 2, 56

# --- Nebel: Galaxie-Ebene im Kartenausschnitt, posterisiert (7 Farben), Rand radial geordnet gedithert
CARD = (174, 333)
p = os.path.join(XK.CACHE, 'r2_10_nebula.png')
if HAVE(E):
    g = XK.layer(E, 84)[CARD[1] - 6:CARD[1] + 56, CARD[0] - 6:CARD[0] + 82, :3].copy()
    Image.fromarray(g).save(p)
neb = np.array(Image.open(p).convert('RGB')).astype(float)
nh, nw = neb.shape[:2]
lum = neb @ np.array([0.3, 0.5, 0.2])
PAL = np.array([(10, 16, 64), (22, 36, 116), (36, 66, 170), (62, 108, 206), (110, 160, 226), (176, 212, 240),
                (240, 248, 255)], float)
levels = np.array([0, 28, 55, 85, 125, 175, 225], float)       # Helligkeitsstufen der Palette
ncx, ncy = sx + sw / 2, sy + 22
for y in range(nh):
    for x in range(nw):
        X, Y = int(ncx - nw / 2 + x), int(ncy - nh / 2 + y)
        if not (0 <= X < NW and 0 <= Y < NH): continue
        d = math.hypot((x + .5 - nw / 2) / (nw / 2), (y + .5 - nh / 2) / (nh / 2))
        a = min(1.0, max(0.0, (1 - d) * 3.2))
        if a <= B4[Y % 4, X % 4]: continue
        L = lum[y, x]
        i = int(np.searchsorted(levels, L) - 1)
        i = max(0, min(i, len(PAL) - 2))
        j = i + 1 if L - levels[i] > (levels[i + 1] - levels[i]) / 2 else i   # harte Stufen, kein Binnen-Dither
        if j == 0: continue                                      # dunkelste Stufe = Himmel bleibt stehen
        cv.a[Y, X] = PAL[j].astype(np.uint8)

# --- Sonne (selbst gezeichnet, 11 px) und Mond (Cosmic Depths, pixelgenau)
SUN = [(255, 252, 226), (255, 232, 120), (248, 188, 40), (206, 128, 18)]
sun = np.zeros((11, 11, 4), np.uint8)
for y in range(11):
    for x in range(11):
        r = math.hypot(x - 5, y - 5)
        hl = math.hypot(x - 4, y - 4)
        if r <= 5.3:
            c = SUN[0] if hl < 1.6 else SUN[1] if hl < 3.4 else SUN[2] if r < 4.4 else SUN[3]
            sun[y, x, :3] = c; sun[y, x, 3] = 255
pm = os.path.join(XK.CACHE, 'r2_10_moon.png')
if HAVE('MotiveBoons'):
    m = XK.layer('MotiveBoons', 6)[286:303, 283:300].copy()
    c = m[..., :3].astype(int)
    mk = (c.max(-1) > 80) & ((c[..., 2] - c[..., 0]) < 40)
    import pp
    mk = pp.keep_largest(mk, 1)
    m[..., 3] = mk * 255
    m = trim(fill_holes(m))
    Image.fromarray(m).save(pm)
moon = np.array(Image.open(pm).convert('RGBA'))

# Schalen: Mitte links x≈6, rechts x≈53 im Waagen-Sprite, Schalenboden innen y≈26
panl, panr, pany = sx + 6, sx + 53, sy + 26
cv.paste(sun, panl - 5, pany - 10)
cv.paste(moon, panr - moon.shape[1] // 2, pany - moon.shape[0])
cv.paste(scale, sx, sy)

big = Canvas(W, H)
u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 3)[..., :3]   # 252×351
big.a[:] = u[:H, 1:W + 1]
print(save(big, '10_divine_balance.png'))
