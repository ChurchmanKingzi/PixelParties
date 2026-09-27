# -*- coding: utf-8 -*-
"""Sleeve 33 – „Life Serum“: Es lebt! – Heinz' größter Versuch.

Idee: Frankenstein-Moment im Labor. In der Mitte der rosa Lebensserum-Tank, in dem Chibi-Monia schläft; Strom
knistert an seiner Leitung hinab (selbst gezeichnete Entladungen im 4×-Raster). Links und rechts angeschnittene
graue Tanks derselben Reihe. Vorn links jubelt Heinz mit erhobenen Armen, vorn rechts Batterie und roter Knopf.
Rosa Schein des Tanks auf dem Laborboden, Ränder dunkel.

Skalierung: alles 4× (Wand-/Bodenfliesen, Mäanderfries, alle drei Tanks, Monia, Heinz, Batterie, Knopf, Blitze).
Heinz steht auf demselben Boden etwas vor der Tankreihe (Füße tiefer), nicht daneben in anderer Größe.

Quellen (MotiveGN):
  559 „Hintergrund“ (Laborfliese 16×16 bei x176/y272, Mäanderfries y206–222), 551 „Life Serum“ (rosa Tank x274–303,
  grauer Tank x129–158), 547 „Chibi-Monia“ (liegt im rosa Tank x274, vgl. Karte Life Serum), 500 „Ebene #45“ (Heinz
  jubelnd), 504 „Ebene #22“ (Laborgeräte: roter Knopf, Batterie)
"""
from common import *
from f_util import *
import numpy as np

G = 'MotiveGN'
K = 4
cv = Canvas(W, H)
bg = layer(G, 559)

# ---------- Wand + Boden (4×) ----------
tile = up(rgba(bg[272:288, 176:192]), K)
FLOOR = 262                                    # Unterkante der Tanksockel
WALL = FLOOR - 44                              # Wandfuß (Tanks stehen davor auf dem Boden)
for y0 in range(WALL, H, 64):
    for x0 in range(-2, W, 64):
        cv.paste(darken(tile, 0.62), x0, y0)
# Wand: ruhige dunkle Laborpaneele (Farbe aus der Fliese), Fugen im 4×-Raster
cv.rect(0, 0, W, WALL, (44, 44, 50))
for x0 in range(30, W, 64):
    cv.rect(x0, 0, x0 + K, WALL, (30, 30, 35))
    cv.rect(x0 + K, 0, x0 + 2 * K, WALL, (58, 58, 64))
# Mäanderfries als Wandband (4×)
frieze = up(rgba(bg[206:222, 136:136 + 32]), K)
FY = 130
for x0 in range(-10, W, frieze.shape[1]):
    cv.paste(darken(frieze, 0.5), x0, FY)
cv.rect(0, FY - K, W, FY, (24, 24, 28)); cv.rect(0, FY + frieze.shape[0], W, FY + frieze.shape[0] + K, (24, 24, 28))
cv.rect(0, WALL - K, W, WALL, (22, 22, 26))

# ---------- Tanks (4×) ----------
tanks = layer(G, 551)
def tank(x0, x1):
    t = tanks[161:266, x0:x1].copy()
    b = bbox(t); return t[b[1]:b[3], b[0]:b[2]]
pink = tank(274, 304)
grey = tank(129, 159)
P = up(pink, K)
PX, PY = 125 - P.shape[1] // 2, FLOOR - P.shape[0]
Gr = up(darken(grey, 0.8), K)
cv.paste(Gr, PX - Gr.shape[1] - 14, FLOOR - Gr.shape[0])
cv.paste(up(darken(flip(grey), 0.8), K), PX + P.shape[1] + 14, FLOOR - Gr.shape[0])

# rosa Schein (auf dem 4×-Raster gedithert) auf Wand und Boden
cx, cy, th = grid(K, ox=PX % K, oy=PY % K)
d = np.sqrt(((cx - 125) / 1.0) ** 2 + ((cy - 180) / 1.4) ** 2)
shade(cv, np.clip(1 - d / 125, 0, 1) ** 1.2 * 0.4, th * 0 + 0.5, col=(255, 140, 175), levels=6)

cv.paste(P, PX, PY)
# Monia im Tank (hinter dem Glas: mit Tankfarbe gemischt, harte Maske)
girl = sprite('f33_girl', G, [547])
Gm = up(girl, K)
gx, gy = PX + (282 - 274) * K, PY + (230 - 161) * K - 2 * K
sub = cv.a[gy:gy + Gm.shape[0], gx:gx + Gm.shape[1]].astype(float)
m = Gm[..., 3] > 0
mix = Gm[..., :3] * 0.66 + sub * 0.34
cv.a[gy:gy + Gm.shape[0], gx:gx + Gm.shape[1]][m] = mix[m].astype(np.uint8)

# ---------- Strom an der Leitung (selbst gezeichnet, 4×-Raster) ----------
rng = np.random.default_rng(11)
def cells_line(a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0))
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)] if n else [a]
def bolt(x0, y0, x1, y1, amp=3, branch=True):
    """Zickzack-Blitz aus ganzen 4×-Pixeln von (x0,y0) nach (x1,y1): heller Kern, cyanfarbener Saum."""
    A_, B_ = (x0 // K, y0 // K), (x1 // K, y1 // K)
    n = max(2, (B_[1] - A_[1]) // 4)
    way = [A_]
    for i in range(1, n):
        t = i / n
        way.append((round(A_[0] + (B_[0] - A_[0]) * t + (amp if i % 2 else -amp) * rng.uniform(0.5, 1.0)),
                    round(A_[1] + (B_[1] - A_[1]) * t)))
    way.append(B_)
    pts = []
    for p0, p1 in zip(way, way[1:]): pts += cells_line(p0, p1)
    if branch:
        bx, by = way[n // 2]
        side = 1 if B_[0] > A_[0] else -1
        pts_b = cells_line((bx, by), (bx - side * 4, by + 3)) + cells_line((bx - side * 4, by + 3), (bx - side * 3, by + 6))
        pts += pts_b
    for (px, py) in pts:
        for ddx, ddy in [(-1, 0), (1, 0)]:
            cv.rect((px + ddx) * K, (py + ddy) * K, (px + ddx + 1) * K, (py + ddy + 1) * K, (60, 190, 215))
    for (px, py) in pts:
        cv.rect(px * K, py * K, (px + 1) * K, (py + 1) * K, (235, 255, 255))
CAP = PY + 57 * K                                # Oberkante der Tankkappe (Leitungsanschluss)
bolt(4, 0, PX + 5 * K, CAP - 2 * K)
bolt(W - 8, 0, PX + P.shape[1] - 6 * K, CAP - 2 * K)

# ---------- Rand dunkel ----------
cx, cy, th = grid(K)
dd = np.sqrt(((cx - 125) / 1.0) ** 2 + ((cy - 200) / 1.35) ** 2)
shade(cv, np.clip((dd - 110) / 110, 0, 1) * 0.7, th)

# ---------- Vordergrund: Heinz (4×) und Laborgeräte (4×) ----------
tl = parts(sprite('f33_tools', G, [504]), dil=0)
btn, bat = tl[1], tl[4]
B = up(bat, K); ellipse_shadow(cv, 206, 322, 30, 6, K, alpha=0.45); cv.paste(B, 180, 322 - B.shape[0])
Bt = up(btn, K); ellipse_shadow(cv, 206, 342, 30, 6, K, alpha=0.45)
put(cv, btn, 176, 344, K, 'bl')
heinz = sprite('f33_heinz', G, [500])
Hs = up(heinz, K)
HX = 20
ellipse_shadow(cv, HX + Hs.shape[1] / 2, 338, 34, 7, K, alpha=0.45)
cv.paste(Hs, HX, 340 - Hs.shape[0])

save(cv, '33_life_serum.png')
