# -*- coding: utf-8 -*-
"""Sleeve 37 – „Traveler's Portal“: ein Portal zwischen zwei Welten.

Idee: Mitten im nächtlichen Wald (der Wald aus der Szene des „Traveler from the Future“) reißt ein goldenes
Wirbel-Portal (5×) auf. Im Portal liegt eine andere Welt – die Galaxie aus dem All –, und der Reisende aus der
Zukunft (4×) tritt gerade heraus. Das Gold des Portals färbt Waldboden und Bäume.

Quellen:
  MotiveGN      339 „Traveler from the Future“ (Reisender), 107 „Ebene #324“ (Galaxie), 353 „Klippe #1“ (Wald bei Nacht),
                354 „TsuKi #1“ (Sterne)
  MotiveArcanum 102 „Ebene #81“ (goldener Wirbelring)
"""
from common import *
import numpy as np, cv2

G, A = 'MotiveGN', 'MotiveArcanum'
cv = Canvas(250, 350)
yy, xx = np.mgrid[0:350, 0:250]

# ---------- Nachthimmel ----------
cols = [np.array(c) for c in [(6, 8, 22), (12, 16, 40), (20, 26, 58)]]
t = np.clip(yy / 160, 0, 1) * (len(cols) - 1)
q = np.floor(t + BAYER4[yy % 4, xx % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    cv.a[q == k] = c
st = layer(G, 354)[152:244, 149:309]
v = st[..., :3].max(-1).astype(int)
stars = (v > 120) & (st[..., 3] > 0)
n, lab, stt, _ = cv2.connectedComponentsWithStats(stars.astype(np.uint8), connectivity=8)
stars = np.isin(lab, [k for k in range(1, n) if stt[k, cv2.CC_STAT_AREA] <= 3])
for oy, ox in [(0, 0), (0, 160), (80, 80), (80, -80)]:
    ys, xs = np.where(stars)
    for y, x in zip(ys + oy, xs + ox):
        if 0 <= x < 250 and y < 170: cv.a[y, x] = st[y - oy, x - ox, :3]

# ---------- Wald (2×) ----------
forest = layer(G, 353)[148:388, 83:403].copy()
F = up(forest, 2)
F = darken(F, 0.62)
F = tint(F, (20, 30, 70), 0.25)
FX, FY = -150, 40
cv.paste(F, FX, FY)

# ---------- Portal ----------
ring = sprite('f37_ring', A, [102])
K = 5
ring = hsv_shift(ring, -5, 1.35, 1.0)       # satteres Gold
R = up(ring, K)
RX, RY = 125 - R.shape[1] // 2, 22
# goldener Schein auf dem Wald (gedithert), stärker am Boden
cx, cy = 125, RY + R.shape[0] // 2
d = np.sqrt(((xx - cx) / 1.0) ** 2 + ((yy - cy) / 1.25) ** 2)
r_out = R.shape[0] / 2 / 1.25
gl = np.clip(1 - np.abs(d - r_out) / 26, 0, 1) * 0.5
qq = np.floor(gl * 4 + BAYER4[yy % 4, xx % 4]) / 4
gold = np.array([255, 220, 120])
cv.a[:] = (cv.a * (1 - qq[..., None]) + gold * qq[..., None]).clip(0, 255).astype(np.uint8)

# Innenraum des Rings = andere Welt (Galaxie)
m = ring[..., 3] > 0
h, w = m.shape
pad = np.zeros((h + 2, w + 2), np.uint8); pad[1:-1, 1:-1] = m
ff = pad.copy(); msk = np.zeros((h + 4, w + 4), np.uint8)
cv2.floodFill(ff, msk, (0, 0), 2)
inner = (ff[1:-1, 1:-1] == 0)
IN = up(inner[..., None].astype(np.uint8), K)[..., 0] > 0
gal = layer(G, 107)[99:339, 100:420, :3]
gy0, gx0 = 219 - 99, 250 - 100          # Galaxie-Kern
ys, xs = np.where(IN)
iy, ix = ys.mean(), xs.mean()
for y, x in zip(ys, xs):
    sy = int(gy0 + (y - iy) * 0.9); sx = int(gx0 + (x - ix) * 0.9)
    sy = min(max(sy, 0), gal.shape[0] - 1); sx = min(max(sx, 0), gal.shape[1] - 1)
    if 0 <= RY + y < 350 and 0 <= RX + x < 250:
        cv.a[RY + y, RX + x] = gal[sy, sx]
cv.paste(R, RX, RY)

# ---------- Reisender tritt heraus ----------
trav = sprite('f37_traveler', G, [339])
T = up(trav, 4)
TX, TY = 125 - T.shape[1] // 2, 334 - T.shape[0]
# Schatten auf dem Boden
sh = np.zeros((6, 22, 4), np.uint8); sh[..., 3] = 255
sh[0, :3] = 0; sh[0, -3:] = 0; sh[-1, :3] = 0; sh[-1, -3:] = 0
cv.paste(silhouette(up(sh, 4), (10, 8, 6)), 125 - 44, TY + T.shape[0] - 12, alpha=0.5)
# goldene Kantenbeleuchtung von hinten (Portallicht): Umriss in Gold
Tl = outline(T, (255, 214, 110), 2)
cv.paste(Tl, TX - 2, TY - 2)
cv.paste(T, TX, TY)

vignette(cv, 0.45, 0.6)
save(cv, '37_travelers_portal.png')
