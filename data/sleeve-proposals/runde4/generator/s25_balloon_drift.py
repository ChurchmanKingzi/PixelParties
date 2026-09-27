# -*- coding: utf-8 -*-
"""25 Balloon Drift – der Creepy Clown schwebt an seiner Traube aus Clownsgesicht-Ballons vor der großen,
untergehenden Sonne über ein rosa Wolkenmeer; alle Ballonschnüre laufen in seiner linken Faust zusammen.

Quellen (MotiveMoe.xcf):
  Ebene 389 „Creepy Clown“ – Clown mit Ballons (geprüft gegen „Sichtbar #145“ / „#32“: vollständig;
             halbtransparenter Bodenschatten fällt beim Zusammensetzen weg). Zerlegt in drei Teile:
             Ballontraube (5 Gesichtsballons), roter Ballon, Clown (Körper + Mütze). Die alten Schnüre
             (schwarz) sind entfernt bis auf den Knoten über der linken Faust; Ballons höher gesetzt, 4×
  Ebene 122 „Ebene #64“ – Wolke, mehrfach gespiegelt, abendlich umgefärbt (Helligkeit -> Farbverlauf), 2×
Selbst gezeichnet: Abendhimmel, Sonne mit Schein, Sterne (2×-Raster); Ballonschnüre als 1-Pixel-Fäden im
Raster des Clowns (4×), hell/dunkel Pixel für Pixel abwechselnd, alle enden am Knoten in der linken Faust.

Tiefenebenen / Skalierung:
  Himmel, Sonne, Wolkenmeer, Wolken ........ 125×175-Raster, 2×
  Clown, Ballons, Schnüre (Vordergrund) .... 63×88-Raster, 4×
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import vgrad, radial, lum_tint  # noqa
import math
import numpy as np

M = 'MotiveMoe'
W, H = 250, 350


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(L, s, x, y):
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(L.shape[1], x + w), min(L.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] > 127
    L[Y0:Y1, X0:X1][m] = sub[m]


def lift(L, k):
    return up(L, k)[:H, :W]


# ---------- Clown zerlegen (Koordinaten im zugeschnittenen 37×44-Sprite) ----------
cl = sprite('e25_clown_raw', M, [389])
C = max(parts(cl, dil=1), key=lambda p: p.shape[0] * p.shape[1]).copy()
h, w = C.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
al = C[..., 3] > 0
blk = np.all(C[..., :3] == 0, -1)
m_bunch = al & (((yy <= 18) & (xx < 26)) | ((yy >= 19) & (yy <= 24) & (xx <= 14)) | ((yy == 19) & (xx <= 16)))
bluish = (C[..., 2].astype(int) > C[..., 0].astype(int) + 40)          # Mützenblau gehört zum Körper
m_red = al & (yy >= 13) & (yy <= 25) & (xx >= 26) & ~bluish & ~((yy == 25) & (xx < 29))  # ohne Mützenkrempe
m_rstr = al & blk & (xx >= 27) & (yy >= 25) & (yy <= 34)          # alte Schnur des roten Ballons
m_lstr = al & blk & (xx >= 10) & (xx <= 11) & (yy >= 25) & (yy <= 26)  # dünnes Schnurstück unter der Traube
m_body = al & ~m_bunch & ~m_red & ~m_rstr & ~m_lstr


def only(m):
    s = C.copy(); s[~m] = 0
    return s


BUNCH, RED, BODY = only(m_bunch), only(m_red), only(m_body)
# rechte Hand: das Schnurende in der Faust (Zeile 34, Spalte 27) mit Handumriss-Farbe schließen
if BODY[34, 27, 3] == 0 and C[34, 27, 3] > 0:
    BODY[34, 27] = (49, 24, 0, 255)
KNOT = (12, 26)                                               # Schnurknoten über der linken Faust

# Platzierung im 63×88-Raster: Clown mittig, Füße auf Zeile 80; Ballons 16 Zeilen höher
BX, BY = 12, 36                                               # Versatz des Körpers
UX, UY = 17, 36 - 26                                          # Versatz der Traube
RX, RY = 14, 36 - 30                                      # Versatz des roten Ballons
knot = (KNOT[0] + BX, KNOT[1] + BY)
starts = [((12, 5), (UX, UY)), ((3, 11), (UX, UY)), ((9, 9), (UX, UY)), ((16, 14), (UX, UY)),
          ((10, 21), (UX, UY)), ((31, 22), (RX, RY))]           # Ballonmitten/-knoten (Sprite-Koord.)

# ---------- Ebene 1 (2×) ----------
g = Canvas(125, 175)
vgrad(g, [(0, (26, 16, 56)), (0.25, (60, 26, 88)), (0.5, (128, 44, 110)), (0.68, (206, 86, 116)),
          (0.8, (242, 146, 112)), (1, (250, 196, 128))])
rng = np.random.RandomState(25)
for _ in range(26):
    x, y = rng.randint(0, 125), rng.randint(0, 40)
    g.px(x, y, (220, 200, 255) if rng.rand() < .4 else (140, 110, 190))
# Sonne zentriert hinter dem Clown, unten im Wolkenmeer versinkend
SX, SY, SR = 62.5, 124, 30
radial(g, SX, SY, SR + 30, (240, 140, 112), 0.7, power=1.2)
radial(g, SX, SY, SR + 13, (252, 196, 120), 0.8, power=1.0)
for y in range(int(SY - SR - 1), int(SY + SR + 1)):
    for x in range(int(SX - SR - 1), int(SX + SR + 1)):
        d = math.hypot(x + .5 - SX, y + .5 - SY)
        if d < SR and 0 <= y < 175:
            g.a[y, x] = (255, 224, 116) if d < SR - 3 or (SR - d) * 0.4 > BAYER4[y % 4, x % 4] else (252, 176, 88)

CLOUD = sprite('e25_cloud', M, [122])                         # 133×36
cvb = Canvas(125, 175); cvb.a[:] = g.a
cvb.rect(0, 156, 125, 175, (120, 50, 104))                    # geschlossene Wolkendecke ganz unten
cvb.paste(lum_tint(flip(CLOUD), (70, 34, 96), (150, 90, 160)), -52, 34)
cvb.paste(lum_tint(CLOUD, (80, 36, 100), (170, 100, 170)), 78, 48)
cvb.paste(lum_tint(CLOUD, (206, 108, 122), (250, 204, 186)), -30, 128)
cvb.paste(lum_tint(flip(CLOUD), (206, 108, 122), (250, 204, 186)), 30, 126)
cvb.paste(lum_tint(CLOUD, (178, 82, 116), (246, 172, 160)), -60, 140)
cvb.paste(lum_tint(flip(CLOUD), (178, 82, 116), (246, 172, 160)), 50, 142)
cvb.paste(lum_tint(CLOUD, (120, 50, 104), (220, 128, 146)), -20, 154)
cvb.paste(lum_tint(flip(CLOUD), (120, 50, 104), (220, 128, 146)), 20, 158)
g = cvb

# ---------- Ebene 2 (4×): Schnüre, Ballons, Clown ----------
L = rgba(63, 88)
LIGHT, DARK = (238, 228, 222, 255), (58, 36, 52, 255)


def thread(L, p0, p1):
    """1-Pixel-Faden (Bresenham), Pixel für Pixel hell/dunkel abwechselnd."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err, i = dx + dy, 0
    while True:
        if 0 <= x0 < L.shape[1] and 0 <= y0 < L.shape[0]:
            L[y0, x0] = LIGHT if i % 2 == 0 else DARK
        if (x0, y0) == (x1, y1): break
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy
        i += 1


for (sx_, sy_), (ox, oy) in starts:
    thread(L, (sx_ + ox, sy_ + oy), knot)                    # Schnüre zuerst: liegen hinter Ballons/Körper
put(L, BUNCH, UX, UY)
put(L, RED, RX, RY)
put(L, BODY, BX, BY)

out = Canvas(W, H)
out.a[:] = lift(g.a, 2)
out.paste(lift(L, 4), 0, 0)
print(save(out, '25_balloon_drift.png'))
