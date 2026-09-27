# -*- coding: utf-8 -*-
"""Sleeve 37 – „Traveler's Portal“: ein Portal zwischen zwei Welten.

Idee: Nachts auf einer Lichtung reißt ein goldenes Wirbel-Portal auf; durch Ring und Wirbel sieht man die Galaxie
einer anderen Welt. Der Reisende aus der Zukunft ist gerade herausgetreten und steht vorn im Gegenlicht –
dunkle Silhouette mit goldenem Kantenlicht, sein langer Schatten fällt zum Betrachter. Ruhiger Nachthimmel,
flacher Hügelkamm als Horizont.

Skalierung: Portal 4× (Mittelgrund, steht auf der Lichtung), Reisender 5× (klar davor im Vordergrund, überdeckt den
Portalfuß), Hügelkamm 2× als flache Silhouette weit hinten; Himmel/Boden-Verläufe und Lichtschein fein gedithert.

Quellen:
  MotiveGN      339 „Traveler from the Future #1“ + 341 „Grasp the Future #2“ (Klinge hinter der Schulter, vgl. Szene
                „Sichtbar #150“), 107 „Ebene #324“ (Galaxie), 353 „Klippe #1“ (Hügelkamm), 354 „TsuKi #1“ (Sterne)
  MotiveArcanum 102 „Ebene #81“ (goldener Wirbelring)
"""
from common import *
from f_util import *
import numpy as np, cv2

G, A = 'MotiveGN', 'MotiveArcanum'
cv = Canvas(W, H)
yy, xx = np.mgrid[0:H, 0:W]
HOR = 214                                       # Horizont / Beginn der Lichtung

# ---------- Nachthimmel + Sterne ----------
cols = [(6, 8, 22), (10, 14, 34), (16, 22, 50), (24, 30, 64)]
t = np.clip(yy / HOR, 0, 1) * (len(cols) - 1)
q = np.floor(t + BAYER4[yy % 4, xx % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    cv.a[q == k] = c
st = layer(G, 354)[152:244, 149:309]
v = st[..., :3].max(-1).astype(int)
stars = (v > 120) & (st[..., 3] > 0)
n, lab, stt, _ = cv2.connectedComponentsWithStats(stars.astype(np.uint8), connectivity=8)
stars = np.isin(lab, [k for k in range(1, n) if stt[k, cv2.CC_STAT_AREA] <= 3])
for oy, ox in [(0, 0), (0, 160), (80, 80), (80, -80), (150, 20)]:
    ys, xs = np.where(stars)
    for y, x in zip(ys + oy, xs + ox):
        if 0 <= x < W and y < HOR - 30: cv.a[y, x] = st[y - oy, x - ox, :3]

# ---------- Hügelkamm (2×, flache Silhouette weit hinten) ----------
ridge = layer(G, 353)[190:260, 83:403].copy()
ridge[..., :3] = (14, 26, 34)
R2 = up(ridge[:, 30:160], 2)
cv.paste(R2, 0, HOR - 36)
cv.rect(0, HOR + R2.shape[0] - 36, W, H, (12, 22, 26))

# ---------- Lichtung: Boden-Verlauf ----------
gcols = [(10, 20, 18), (14, 28, 22), (18, 36, 26)]
t = np.clip((yy - HOR) / 120, 0, 1) * (len(gcols) - 1)
q = np.floor(t + BAYER4[yy % 4, xx % 4] * 0.999).clip(0, len(gcols) - 1).astype(int)
for k, c in enumerate(gcols):
    cv.a[(q == k) & (yy >= HOR)] = c

# ---------- Portal (4×) ----------
K = 4
ring = sprite('f37_ring', A, [102])
ring = hsv_shift(ring, -5, 1.3, 1.0)            # satteres Gold
h, w = ring.shape[:2]
RW, RH = w * K, h * K
RX, RY = 125 - RW // 2, HOR + 44 - RH           # Portalfuß steht auf der Lichtung
# goldener Schein um das Portal und auf dem Boden davor (fein gedithert)
pcx, pcy = 125, RY + RH // 2
d = np.sqrt(((xx - pcx) / 1.0) ** 2 + ((yy - pcy) / 1.3) ** 2)
gl = np.clip(1 - np.abs(d - RW * 0.5) / 22, 0, 1) * 0.35
gd = np.sqrt(((xx - 125) / 1.0) ** 2 + ((yy - (HOR + 44)) / 0.35) ** 2)
gl = np.maximum(gl, np.clip(1 - gd / 120, 0, 1) * 0.55 * (yy > HOR))
qq = np.floor(gl * 4 + BAYER4[yy % 4, xx % 4]) / 4
cv.a[:] = (cv.a * (1 - qq[..., None]) + np.array([240, 200, 100]) * qq[..., None]).clip(0, 255).astype(np.uint8)

# Innenraum + Ringfläche = andere Welt (Galaxie), dann die Wirbelarme darüber
m = ring[..., 3] > 0
pad = np.zeros((h + 2, w + 2), np.uint8); pad[1:-1, 1:-1] = m
ff = pad.copy(); msk = np.zeros((h + 4, w + 4), np.uint8)
cv2.floodFill(ff, msk, (0, 0), 2)
inside = (ff[1:-1, 1:-1] != 2)                   # Ring + Loch
IN = up(inside[..., None].astype(np.uint8), K)[..., 0] > 0
gal = layer(G, 107)[99:339, 100:420, :3]
gy0, gx0 = 219 - 99, 250 - 100                  # Galaxie-Kern
ys, xs = np.where(IN)
iy, ix = ys.mean(), xs.mean()
for y, x in zip(ys, xs):
    sy = int(gy0 + (y - iy) * 0.75); sx = int(gx0 + (x - ix) * 0.75)
    sy = min(max(sy, 0), gal.shape[0] - 1); sx = min(max(sx, 0), gal.shape[1] - 1)
    if 0 <= RY + y < H and 0 <= RX + x < W:
        cv.a[RY + y, RX + x] = gal[sy, sx]
# Wirbel: goldene Arme deckend, die blasse Energiefläche halbtransparent (ganze 4×-Pixel) – Tiefe statt Fläche
pale = (ring[..., 0] > 225) & (ring[..., 1] > 225) & (ring[..., 2] > 150)
arms = ring.copy(); arms[pale, 3] = 0
glow = ring.copy(); glow[~pale, 3] = 0
cv.paste(up(glow, K), RX, RY, alpha=0.55)
cv.paste(up(arms, K), RX, RY)

# ---------- Reisender (5×, Gegenlicht) ----------
K5 = 5
trav = sprite('f37_traveler', G, [339, 341])
N = trav.copy()
rgb = N[..., :3].astype(float)
eye = (rgb[..., 0] > 120) & (rgb[..., 1] < 60)
N[..., :3] = np.where(eye[..., None], N[..., :3], (rgb * 0.45 + np.array([4, 4, 10])).clip(0, 255)).astype(np.uint8)
mm = N[..., 3] > 0
top = mm & ~np.vstack([np.zeros((1, mm.shape[1]), bool), mm[:-1]])
lft = mm & ~np.hstack([np.zeros((mm.shape[0], 1), bool), mm[:, :-1]])
rgt = mm & ~np.hstack([mm[:, 1:], np.zeros((mm.shape[0], 1), bool)])
N[(top | lft | rgt) & ~eye, :3] = (235, 190, 90)
T = up(N, K5)
FEET = 336
TX = 125 - T.shape[1] // 2
# langer Schatten zum Betrachter (senkrecht gespiegelt, halbe Höhe, im 5×-Raster)
sh = silhouette(trav[::-1][::2], (6, 10, 8))
S = up(sh, K5)
cv.paste(S, TX, FEET, alpha=0.6)
cv.paste(T, TX, FEET - T.shape[0])

save(cv, '37_travelers_portal.png')
