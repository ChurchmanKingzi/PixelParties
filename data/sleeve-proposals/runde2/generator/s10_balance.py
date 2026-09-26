# -*- coding: utf-8 -*-
"""Sleeve: Göttliches Gleichgewicht – die goldene Waage aus „Divine Gift of Balance“ (samt Nebel-Leuchten)
im Sternenhimmel aus „The Cosmic Depths“; links wiegt die Sonne („Light Ball“), rechts der Mond
(aus „The Cosmic Depths“)."""
import math, numpy as np
from kit import *

NW, NH = 84, 117
cv = Canvas(NW, NH)
# --- Sternenhimmel: Cosmic Depths ohne Mond/Planet/Auge (Inpainting), gespiegelt gekachelt
cd = nat('The Cosmic Depths')
hole = np.zeros(cd.shape[:2], np.uint8)
hole[1:16, 34:49] = 255; hole[17:39, 48:70] = 255; hole[27:39, 20:28] = 255
hole[:, 0:2] = 255; hole[:, -2:] = 255; hole[0:2] = 255; hole[-2:] = 255
hole[(cd[..., 0].astype(int) > cd[..., 2].astype(int) + 40)] = 255
sky = cv2.inpaint(cd, hole, 4, cv2.INPAINT_TELEA)[2:-2, 2:-2]
t = np.concatenate([sky, sky[:, ::-1]], 1); t = np.concatenate([t, t[::-1]], 0)
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = t[(y + 20) % t.shape[0], (x + 30) % t.shape[1]]

# --- Strahlenkranz aus „Divine Awakening“: Strahlfarbe je Winkel (Ring r=14..22 um die Figur), radial übertragen
da = nat('Divine Awakening').astype(int)
dcx, dcy = 37.5, 27.5
hd = hsv_of(da)
rayish = (da.max(-1) > 200) & (hd[..., 1] < 120) & (hd[..., 0] > 25) & (hd[..., 0] < 60)
bins = np.zeros(360); cnt = np.zeros(360); colsum = np.zeros((360, 3))
for y in range(da.shape[0]):
    for x in range(da.shape[1]):
        r = math.hypot(x + .5 - dcx, y + .5 - dcy)
        if 12 <= r <= 24:
            t = int(math.degrees(math.atan2(y + .5 - dcy, x + .5 - dcx))) % 360
            cnt[t] += 1; bins[t] += rayish[y, x]
            if rayish[y, x]: colsum[t] += da[y, x]
ray = np.array([bins[t] / cnt[t] if cnt[t] else 0 for t in range(360)])
# Lücken im Winkel-Histogramm schließen
for t in range(360):
    if cnt[t] == 0: ray[t] = ray[(t - 1) % 360]
RC = (255, 244, 170)
rcx, rcy = NW // 2, 48
on = ray > 0.5
# kurze Winkel-Läufe (<5°) entfernen
lab = np.zeros(360, int); k = 0
for t in range(360):
    if on[t] and not on[t - 1]: k += 1
    lab[t] = k if on[t] else 0
if on[0] and on[-1]: lab[lab == lab[0]] = lab[-1]
for v in set(lab) - {0}:
    if (lab == v).sum() < 5: on[lab == v] = False
ray = on.astype(float)
for y in range(NH):
    for x in range(NW):
        t = int(math.degrees(math.atan2(y + .5 - rcy, x + .5 - rcx))) % 360
        tm = (180 - t) % 360          # links/rechts gespiegelt -> symmetrischer Kranz
        r = math.hypot(x + .5 - rcx, y + .5 - rcy)
        if max(ray[t], ray[tm]) > 0.5:
            a = max(0.0, 1 - r / 75)
            if a > 0.55: cv.a[y, x] = RC
            elif a > 0.35: cv.a[y, x] = (214, 190, 110)
            elif a > 0.15: cv.a[y, x] = (120, 108, 80)
            elif a > BAYER4[y % 4, x % 4] * 0.15 + 0.05: cv.a[y, x] = (60, 56, 70)

# --- Waage und Nebel aus Divine Gift of Balance
bal = nat('Divine Gift of Balance')
hb = hsv_of(bal.astype(int))
vb = bal.max(-1)
gold = (hb[..., 0] > 15) & (hb[..., 0] < 60) & (vb > 150) & ((hb[..., 1] > 140) | (vb > 215))
blue = bal[..., 2].astype(int) > bal[..., 0].astype(int) + 10
gold |= cv2.morphologyEx(gold.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8)).astype(bool) & ~blue
grey = ((bal.max(-1).astype(int) - bal.min(-1)) < 30) & (bal.max(-1) > 50) & (bal.max(-1) < 215)
chains = np.zeros_like(grey); chains[10:32, 7:22] = True; chains[10:32, 54:70] = True
scale_m = gold | (grey & chains)
neb = cv2.inpaint(bal, cv2.dilate(scale_m.astype(np.uint8) * 255, np.ones((3, 3), np.uint8)), 3, cv2.INPAINT_TELEA)
neb = neb[1:49, 1:74]
N2 = np.dstack([neb, np.full(neb.shape[:2], 255, np.uint8)])
nh, nw = N2.shape[:2]
ncx, ncy = NW // 2, 68
for y in range(nh):
    for x in range(nw):
        X, Y = ncx - nw // 2 + x, ncy - nh // 2 + y
        if 0 <= X < NW and 0 <= Y < NH:
            d = math.hypot((x - nw / 2) / (nw / 2), (y - nh / 2) / (nh / 2))
            a = max(0.0, 1 - d) ** 0.8 * 1.25
            if a > BAYER4[Y % 4, X % 4]:
                cv.a[Y, X] = N2[y, x, :3]

scale = np.zeros(bal.shape[:2] + (4,), np.uint8); scale[..., :3] = bal; scale[..., 3] = scale_m * 255
ys, xs = np.where(scale_m); ox, oy = xs.min(), ys.min()
scale = trim(scale)
S2 = scale
sx, sy = (NW - S2.shape[1]) // 2, ncy - S2.shape[0] // 2 - 4

# --- Sonne (Light Ball, auf 13 px verkleinert) und Mond (Cosmic Depths)
sun_full = cutrule('Light Ball', (30, 14, 68, 50),
                   lambda c: ((c[..., 0] > 200) & (c[..., 1] > 200) & (c[..., 2] < 200)) | (c.min(-1) > 235), largest=1)
sun = np.array(Image.fromarray(sun_full).resize((11, 11), Image.NEAREST))
moon = fill_holes(cutrule('The Cosmic Depths', (34, 1, 50, 17), lambda c: (c.max(-1) > 90) & ((c.max(-1) - c.min(-1)) < 70), largest=1))
lpx, rpx = sx + (14 - ox), sx + (61 - ox)
pany = sy + (31 - oy)
SU, MO = sun, moon
cv.paste(SU, lpx - SU.shape[1] // 2, pany - SU.shape[0] + 2)
cv.paste(MO, rpx - MO.shape[1] // 2, pany - MO.shape[0] + 2)
cv.paste(silhouette(S2, (5, 10, 40)), sx + 1, sy + 1, alpha=0.5)
cv.paste(S2, sx, sy)

big = Canvas(W, H)
u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 3)[..., :3]
big.a[:] = u[:H, :W]
for i, c in enumerate([(40, 25, 0), (230, 160, 20), (255, 230, 120), (40, 25, 0)]):
    big.a[i, :] = c; big.a[-1 - i, :] = c; big.a[:, i] = c; big.a[:, -1 - i] = c
print(save(big, '10_divine_balance.png'))
