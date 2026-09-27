# -*- coding: utf-8 -*-
"""02 Night Watch – Der Candlestick Squire (Helm-Kerze + Fackel) steht auf nächtlicher Runde vor einem
stockdunklen Torbogen im Burggang. Nur sein eigenes Licht erhellt Mauer und Boden; hoch oben im Dunkel
des Bogens glimmen die gelben Augen eines Lauerers.

Quellen (Motive.xcf):
  Ebene 709 „Candlestick Squire“ (Karte „Candlestick Squire“) – 5×, Vordergrund
  Ebene 793 „Skeleton Bat“ (nur die Figur, ohne Bodenschatten) – 2×, als fast schwarze Silhouette im Bogen
  Ebene 723 „Ebene #400“ – Mauerwerk-Kachel (16×16), steingrau umgefärbt – 2×
  Ebene 510 „Ebene #524“ – Steinboden-Textur, umgefärbt – 2×
Selbst gezeichnet (125×175-Raster = 2×): Torbogen mit Keilsteinen, Lichtabfall (geordnet gedithert),
Bodenschatten.
Skalierung: Hintergrund (Mauer, Bogen, Boden, Licht, Lauerer) 2×; Squire 5× als klarer Vordergrund.
"""
import math
import numpy as np
from common import *  # noqa

W, H = 250, 350
GW, GH = 125, 175
bg = Canvas(GW, GH)

# ---- Mauer aus der Kachel von Ebene 723, steingrau ----
wall = compose('Motive', [723], crop=False)
b = bbox(layer('Motive', 723))
tile = wall[b[1]:b[1] + 16, b[0]:b[0] + 16, :3].copy()
MAP = {(123, 105, 148): (70, 64, 70), (140, 121, 156): (84, 77, 82), (156, 142, 173): (100, 92, 94),
       (189, 174, 198): (124, 114, 110)}
for k, v in MAP.items():
    tile[np.all(tile == k, -1)] = v
FLOOR_Y = 140
for y in range(GH):
    for x in range(GW):
        bg.a[y, x] = tile[y % 16, x % 16]
# ---- Boden (Ebene 510) ----
fl = compose('Motive', [510])[:, :, :3].astype(float)
lum = fl.mean(-1)
lo, hi = np.percentile(lum, 5), np.percentile(lum, 95)
for y in range(FLOOR_Y, GH):
    for x in range(GW):
        t = np.clip((lum[(y - FLOOR_Y) % fl.shape[0], x % fl.shape[1]] - lo) / (hi - lo), 0, 1)
        q = int(t * 3.99)
        bg.a[y, x] = [(52, 46, 46), (66, 59, 58), (80, 72, 70), (98, 88, 84)][q]
# Sockelkante
bg.rect(0, FLOOR_Y - 2, GW, FLOOR_Y, (56, 50, 52))
bg.rect(0, FLOOR_Y - 3, GW, FLOOR_Y - 2, (128, 118, 112))

# ---- Torbogen (Mitte) ----
AX, AW, AT = 62.5, 36, 44          # Mitte, halbe Breite, Scheitel-Höhe der Rundung
ARC_Y = AT + AW                    # Kämpferlinie
def inside(x, y, grow=0):
    if y >= FLOOR_Y - 2: return False
    if y >= ARC_Y: return abs(x + .5 - AX) < AW + grow
    return math.hypot(x + .5 - AX, (y + .5 - ARC_Y)) < AW + grow
# Keilsteine: Ring 6 px breit, radial geteilt
for y in range(GH):
    for x in range(GW):
        if inside(x, y, 6) and not inside(x, y):
            if y < ARC_Y:
                ang = math.degrees(math.atan2(ARC_Y - y - .5, x + .5 - AX))
                seg = int(ang // 12)
                edge = abs(ang - seg * 12) < 1.6
                d = math.hypot(x + .5 - AX, y + .5 - ARC_Y) - AW
            else:
                seg = (y - ARC_Y) // 7
                edge = (y - ARC_Y) % 7 == 0
                d = abs(x + .5 - AX) - AW
            c = (112, 104, 100) if seg % 2 else (104, 96, 92)
            if d < 1: c = (132, 122, 116)
            if d > 5: c = (58, 52, 54)
            if edge: c = (50, 45, 48)
            bg.a[y, x] = c
# Dunkel im Bogen: schwarz, nach unten ein Hauch Boden
for y in range(GH):
    for x in range(GW):
        if inside(x, y):
            bg.a[y, x] = (6, 5, 10) if y < FLOOR_Y - 14 or 0.3 > BAYER4[y % 4, x % 4] else (18, 15, 18)

# ---- Lauerer im Dunkel des Bogens (2×, fast schwarz, nur Augen leuchten) ----
bat = parts(sprite('a02_bat', 'Motive', [793]), dil=1)
bat = max(bat, key=lambda p: p.shape[0] * p.shape[1])
bh, bw = bat.shape[:2]
BX, BY = int(AX - bw / 2), 40
for j in range(bh):
    for i in range(bw):
        if not bat[j, i, 3]: continue
        r, g_, bl = (int(v) for v in bat[j, i, :3])
        if r > 150 and g_ > 150 and bl < 100:           # gelbe Augen bleiben
            c = (230, 200, 60)
        else:
            v = (r + g_ + bl) / 3
            c = (14, 12, 18) if v < 40 else (26, 22, 30)
        if inside(BX + i, BY + j): bg.a[BY + j, BX + i] = c

# ---- Licht der Flammen: gedithertes Abfallen, warm getönt ----
sq = sprite('a02_squire', 'Motive', [709])
K = 5
sh_, sw_ = sq.shape[:2]
SX = W // 2 - (sw_ * K) // 2 + 2
SY = 322 - sh_ * K
LX, LY = (SX + 15 * K) / 2, (SY + 8 * K) / 2        # Lichtmitte zwischen Helm- und Fackelflamme (Rastermaß)
out = bg.a.astype(float)
for y in range(GH):
    for x in range(GW):
        if inside(x, y) and y < FLOOR_Y - 14: continue
        d = math.hypot((x + .5 - LX), (y + .5 - LY) * 1.05) / 118.0
        t = max(0.0, 1 - d)
        lvl = t * 4 + BAYER4[y % 4, x % 4] * 0.999
        q = min(4, int(lvl)) / 4.0
        f = 0.16 + 1.12 * q
        warm = np.array([1.0, 0.86 + 0.02 * q, 0.62 + 0.08 * q])
        out[y, x] = out[y, x] * f * (warm if q > 0 else np.array([0.75, 0.8, 1.0]))
bg.a[:] = out.clip(0, 255).astype(np.uint8)
# Lichthof der Flammen im Dunkel des Bogens (nur dort sichtbar, zwei geditherte Stufen)
for y in range(GH):
    for x in range(GW):
        if not (inside(x, y) and y < FLOOR_Y - 14): continue
        d = math.hypot(x + .5 - LX, y + .5 - (LY - 4)) / 34.0
        t = max(0.0, 1 - d)
        if t * 1.6 > BAYER4[y % 4, x % 4] + 0.55: bg.a[y, x] = (58, 30, 16)
        elif t * 1.6 > BAYER4[y % 4, x % 4]: bg.a[y, x] = (30, 16, 12)

# ---- Bodenschatten (2×-Raster), Licht kommt von rechts oben ----
FOOT = 322 // 2
for y in range(FOOT - 4, FOOT + 3):
    for x in range(GW):
        e = ((x + .5 - (SX + 9 * K) / 2) / 20.0) ** 2 + ((y + .5 - FOOT) / 3.2) ** 2
        if e < 1 and 0.75 > BAYER4[y % 4, x % 4]:
            bg.a[y, x] = (bg.a[y, x] * 0.35).astype(np.uint8)

cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((GH, GW), 255, np.uint8)]), 2)[:, :, :3]
# ---- Squire (5×) ----
cv.paste(up(sq, K), SX, SY)
print(save(cv, '02_night_watch.png'))
