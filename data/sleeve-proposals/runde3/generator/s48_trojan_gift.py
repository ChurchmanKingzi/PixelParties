# -*- coding: utf-8 -*-
"""48 Trojan Gift – das hölzerne Pferd rollt vor das Burgtor; ein Soldat klettert über die Leiter in den Bauch,
ein zweiter hält unten die Leiter. Zwei Torwachen starren ratlos („?“) auf das Geschenk, oben auf den Zinnen
schauen die Bogenschützen herab.

Quellen (MotiveDeri.xcf):
  Pferd mit Leiter und beiden Soldaten: „Masterpiece“ (i201, eine vollständige Ebene).
  Ratlose Torwachen mit Fragezeichen: aus „See throug the Ruse“ (i199) die beiden Wachen samt „?“ (Teilfigur).
  Burgmauer mit Banner, Holztor und Erdboden: „Hintergrund“ (i253), Ausschnitt x 318–443.
  Bogenschützen: „Archer“ (i184, nur die Figurenzeile über ihrem Mauerstück), gespiegelt → blicken zum Pferd.
  Himmel: eigener Abendverlauf (Bayer-Dithering, 1×, ganz hinten).

Skalierung: ALLES 2× (Mauer, Boden, Pferd, Soldaten, Wachen, Bogenschützen) – eine Bildebene; nur der Himmel 1×.
"""
from common import *
import numpy as np

B = 'MotiveDeri'
cv = Canvas(250, 350)
N = np.zeros((175, 125, 4), np.uint8)          # native Bildebene, wird 2× hochskaliert
WT = 50                                        # Oberkante der Mauer (native)

# --- Abendhimmel (1×) ----------------------------------------------------------------------------------------
cols = [np.array(c) for c in ((16, 18, 48), (34, 28, 72), (70, 40, 90), (128, 62, 88), (196, 104, 78))]
for y in range(2 * WT + 4):
    t = y / (2 * WT) * (len(cols) - 1)
    i = int(t); fr = t - i
    for x in range(250):
        cv.a[y, x] = cols[min(len(cols) - 1, i + (1 if fr > BAYER4[y % 4, x % 4] else 0))]
rng = np.random.default_rng(48)
for _ in range(12):
    x, y = rng.integers(2, 248), rng.integers(2, 40)
    cv.a[y, x] = (200, 190, 220)

def put(s, x, y):
    """Sprite in die native Ebene setzen (harte Alpha)."""
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if s[j, i, 3] > 0 and 0 <= X < 125 and 0 <= Y < 175:
                N[Y, X] = s[j, i]

# --- Bogenschützen hinter der Brustwehr (werden von der Mauer unten verdeckt) -----------------------------------
arch = compose(B, [184])[:21]
figs = parts(arch, dil=0)
for p, x in zip(figs[:3], (70, 86, 102)):
    put(flip(p), x, WT + 3 - p.shape[0])

# --- Mauer mit Tor + Boden (Hintergrund i253) ----------------------------------------------------------------
bg = compose(B, [253])
L0, X0 = 58, 318                                # Zinnenkante / linke Kante des Ausschnitts
wall = bg[L0:L0 + 175 - WT, X0:X0 + 125].copy()
GYn = 128 - L0                                   # Bodenlinie im Ausschnitt
dirt = bg[130:168, X0:X0 + 125]                  # sauberer Erdstreifen (ohne Steinbrocken), nach unten gekachelt
for j in range(GYn + 2, wall.shape[0]):
    wall[j] = dirt[(j - GYn - 2) % dirt.shape[0]]
wall[..., 3] = 255
# Mauer abendlich kühler, Boden wärmer-dunkel
wall[:GYn, :, :3] = (wall[:GYn, :, :3] * np.array([0.78, 0.76, 0.88])).astype(np.uint8)
for j in range(GYn, wall.shape[0]):
    f = 0.5 + 0.22 * (j - GYn) / (wall.shape[0] - GYn)
    wall[j, :, :3] = (wall[j, :, :3] * np.array([f, f * 0.95, f * 0.9])).astype(np.uint8)
put(wall, 0, WT)
GY = WT + GYn                                    # Bodenlinie native

# --- Schatten + Pferd ------------------------------------------------------------------------------------
horse = sprite('h48_horse', B, [201])
HX, HB = 6, 157                                  # Radunterkante (Zeile 83 im Sprite) bei HB
hy = HB - 83
for y in range(HB - 2, HB + 2):
    for x in range(HX + 2, HX + 70):
        if ((x - HX - 36) / 36) ** 2 + ((y - HB) / 2.5) ** 2 < 1:
            N[y, x, :3] = (N[y, x, :3] * 0.55).astype(np.uint8)
put(horse, HX, hy)

# --- ratlose Torwachen vor dem Tor ----------------------------------------------------------------------------
ruse = parts(compose(B, [199]), dil=1)[1]       # beide Wachen samt „?“ (hängen zusammen)
import cv2
lab = cv2.connectedComponentsWithStats((ruse[..., 3] > 0).astype(np.uint8), connectivity=8)[1]
q1 = np.isin(lab, [1, 2])                        # „?“ der oberen Wache
q2 = np.zeros_like(q1); q2[21:, 7:] = q1[:-21, :-7]   # gleiches „?“ der unteren Wache (liegt über der oberen)
g1 = ruse.copy(); g1[~(np.isin(lab, [1, 2, 3]) & ~q2)] = 0
g2 = ruse.copy(); g2[~(np.isin(lab, [4, 5]) | q2)] = 0
g1, g2 = trim(g1), trim(g2)
for g, x, feet in ((g1, 86, 150), (g2, 103, 156)):
    for y in (feet - 1, feet):
        for xx in range(x + 1, x + g.shape[1] - 1):
            N[y, xx, :3] = (N[y, xx, :3] * 0.6).astype(np.uint8)
    put(g, x, feet - g.shape[0])

cv.paste(up(N, 2), 0, 0)
vignette(cv, 0.4, 0.62)
save(cv, '48_trojan_gift.png')
