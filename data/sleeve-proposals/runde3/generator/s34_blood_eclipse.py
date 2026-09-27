# -*- coding: utf-8 -*-
"""Sleeve 34 – „Blood Eclipse“: Null, der Magierjäger, als Silhouette vor einer blutroten Mondfinsternis.

Idee: Plakat-/Silhouetten-Motiv. Riesiger verfinsterter Mond mit rotem Korona-Ring (4×), davor dunkle Wolken,
ein Baumkamm am Horizont und ein Felsgipfel, auf dem Null (5×) steht – nur seine rote Augenlinse leuchtet,
die Kanten fängt das rote Mondlicht ein. Kahle Bäume rahmen das Bild.

Quellen:
  MotiveGN     236 „Ebene #196“ (Finsternis-Mond mit rotem Ring), 199 „Ebene #199“ (Wolken),
               354 „TsuKi #1“ (Sternenhimmel, nur Sterne), 353 „Klippe #1“ (Baumkamm), 106 „Ebene #318“ (Hügelkamm),
               413 „Ebene #110“ / 415 „Ebene #331“ (kahle Bäume)
  MotiveArcanum 8 „Null“ (Null, the Mage Slayer)
"""
from common import *
import numpy as np

G, A = 'MotiveGN', 'MotiveArcanum'
cv = Canvas(250, 350)
yy, xx = np.mgrid[0:350, 0:250]

# ---------- Himmel: Verlauf dunkelviolett -> dunkelrot (geordnetes Dithering) ----------
cols = [np.array(c) for c in [(8, 6, 16), (20, 10, 30), (44, 12, 30), (86, 18, 26)]]
t = np.clip((yy - 20) / 260, 0, 1) * (len(cols) - 1)
q = np.floor(t + BAYER4[yy % 4, xx % 4] * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    cv.a[q == k] = c

# Sterne aus TsuKi #1 (nur helle Pixel, Mond ausgespart)
st = layer(G, 354)[152:244, 149:309].copy()
v = st[..., :3].max(-1).astype(int)
stars = (v > 120) & (st[..., 3] > 0)
import cv2
n, lab, stt, _ = cv2.connectedComponentsWithStats(stars.astype(np.uint8), connectivity=8)
stars = np.isin(lab, [k for k in range(1, n) if stt[k, cv2.CC_STAT_AREA] <= 3])   # nur Einzelsterne, Mond raus
for oy, ox in [(0, 0), (0, 160), (92, -70), (92, 90), (184, 20)]:
    ys, xs = np.where(stars)
    for y, x in zip(ys + oy, xs + ox):
        if 0 <= x < 250 and y < 230 and cv.a[y, x].sum() < 150:
            cv.a[y, x] = st[y - oy, x - ox, :3]

# ---------- Mond ----------
ecl = sprite('f34_eclipse', G, [236])
ecl = max(parts(ecl, dil=1), key=lambda p: p.shape[0] * p.shape[1])   # Streupixel weg
E = up(ecl, 4)
EX, EY = 125 - E.shape[1] // 2, 22
# roter Schein um den Ring (gedithert)
d = np.sqrt((xx - 125) ** 2 + (yy - (EY + E.shape[0] // 2)) ** 2)
r0 = E.shape[0] / 2
gl = np.clip(1 - (d - r0) / 34, 0, 1) * (d > r0 - 4)
qq = np.floor(gl * 3 + BAYER4[yy % 4, xx % 4]) / 3 * 0.55
red = np.array([150, 20, 20])
cv.a[:] = (cv.a * (1 - qq[..., None]) + red * qq[..., None]).astype(np.uint8)
# Mondscheibe leicht rötlich aufhellen (Blutmond), damit die Silhouette davor absetzt
disc = (E[..., 3] > 0) & (E[..., 0].astype(int) - E[..., 1] < 40)
E[disc, :3] = (E[disc, :3] * np.array([1.9, 1.15, 1.15]) + np.array([14, 0, 0])).clip(0, 255).astype(np.uint8)
cv.paste(E, EX, EY)

# ---------- Wolken vor dem Mond ----------
cl = sprite('f34_clouds', G, [216])
clp = parts(cl, dil=1)
big = sorted(clp, key=lambda p: -p.shape[1])
c1 = tint(darken(up(big[0], 2), 0.7), (70, 10, 20), 0.35)
c2 = tint(darken(up(flip(big[1]), 2), 0.6), (70, 10, 20), 0.35)
c3 = tint(darken(up(big[2], 2), 0.8), (90, 16, 24), 0.3)
cv.paste(c3, 150, 60)
cv.paste(c1, -40, 170)
cv.paste(c2, 120, 200)

# ---------- Baumkamm am Horizont ----------
ridge = layer(G, 353)[190:260, 83:403].copy()
ridge[..., :3] = (30, 8, 18)
cv.paste(ridge[:, 20:270], 0, 262)

# ---------- Felsgipfel (Vordergrund) ----------
hill = layer(G, 106)[295:360, 96 + 100:96 + 250].copy()     # Gipfel mit Plateau
hill[..., :3] = (10, 4, 8)
m = hill[..., 3] > 0
edge = m & ~np.vstack([np.zeros((1, m.shape[1]), bool), m[:-1]])
edge |= m & ~np.hstack([np.zeros((m.shape[0], 1), bool), m[:, :-1]])   # linke Flanken
hill[edge, :3] = (110, 24, 26)
H2 = up(hill, 2)
top_row = int(np.argmax(m.any(1)))
hx = 125 - H2.shape[1] // 2 - 2
HY = 306
cv.paste(H2, hx, HY - 2 * top_row)
cv.rect(0, HY + 100, 250, 350, (10, 4, 8))

# ---------- kahle Bäume als Rahmen ----------
tr1 = silhouette(sprite('f34_tree1', G, [413]), (10, 4, 8))
tr2 = silhouette(sprite('f34_tree2', G, [415]), (10, 4, 8))
cv.paste(up(tr2, 4), -10, 352 - 120)
cv.paste(up(flip(tr1), 4), 250 - 58, 352 - 84)

# ---------- Null ----------
null = sprite('f34_null', A, [8])
N = null.copy()
rgb = N[..., :3].astype(float)
eye = (rgb[..., 0] > 150) & (rgb[..., 1] < 60)
N[..., :3] = np.where(eye[..., None], N[..., :3], (rgb * 0.3 + np.array([6, 1, 4])).clip(0, 255)).astype(np.uint8)
# rotes Kantenlicht (von oben/aus dem Mond): oberste deckende Pixel jeder Spalte + linke Kanten
m = N[..., 3] > 0
top = m & ~np.vstack([np.zeros((1, m.shape[1]), bool), m[:-1]])
N[top & ~eye, :3] = (170, 40, 36)
N = up(N, 5)
cv.paste(N, 125 - N.shape[1] // 2, HY + 3 - N.shape[0])

save(cv, '34_blood_eclipse.png')
