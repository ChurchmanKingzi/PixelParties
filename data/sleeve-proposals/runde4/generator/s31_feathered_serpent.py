# -*- coding: utf-8 -*-
"""Sleeve 31 – „Feathered Serpent“: Quetzahuitl, die gefiederte Schlange, senkt sich frontal mit ausgebreiteten
goldenen Schwingen über die Stufenpyramide, die aus dem Dschungel ragt. Hinter ihrem Kopf steht die Abendsonne
wie ein Heiligenschein, Strahlen fächern in den glühenden Himmel.

Skalierung: EINE Tiefenebene, alles im 125×175-Raster gebaut und einmal 2× hochskaliert
(Schlange, Pyramide, Dschungel, Himmel-Dithering, Sonne, Strahlen).

Quellen (MotiveSteamDwarfs.xcf):
  Quetzahuitl  = Ebene 218 „Attack of a God“ (Karte „Quetzahuitl, Receiver of Sacrifices“, Szene 213 „Sichtbar #44“:
                 dort vollständig, 1.0) – nur die linke, frontale Gestalt (x 0–100 der Ebene); die seitliche
                 Schlange rechts daneben wird weggeschnitten.
  Pyramide     = Ebene 305 „TEMPEL“ (Szene 88 „Sichtbar #72“: vollständig, eine Ebene)
  Dschungel    = Ebene 159 „Jungle Wall“ (Baumwand, abgedunkelt/abendlich getönt)
  Himmel, Sonne, Strahlen = selbst gezeichnet (Bayer-Dithering, Farben aus Schwingen und Pyramide)
  Schlangenleib = selbst ergänzt (in der Ebene nie gezeichnet), Querschnitt/Farben der seitlichen Quetzahuitl
                 derselben Ebene, gleiche Pixelgröße
"""
from common import *
import numpy as np

B = 'MotiveSteamDwarfs'
W, H = 125, 175
cv = Canvas(W, H)
yy, xx = np.mgrid[0:H, 0:W]
TH = BAYER4[yy % 4, xx % 4]

# ---------- Himmel: dunkles Violett oben -> Glut am Horizont ----------
cols = [(34, 18, 52), (62, 24, 66), (110, 36, 70), (170, 62, 58), (220, 112, 52), (244, 168, 78)]
t = np.clip((yy - 4) / 118, 0, 1) * (len(cols) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    cv.a[q == k] = c

SX, SY = 62, 48            # Sonnenmitte (hinter dem Kopf der Schlange)
d = np.sqrt((xx + .5 - SX) ** 2 + (yy + .5 - SY) ** 2)
ang = np.degrees(np.arctan2(yy + .5 - SY, xx + .5 - SX))
# Strahlen: 16 Sektoren, jeder zweite heller (gedithert, nach außen schwächer)
ray = (np.floor((ang + 360 + 5.625) / 11.25).astype(int) % 2 == 0)
f = np.clip(1 - (d - 26) / 60, 0, 1) * ray * (d > 24)
m = (f * 0.55 > TH) & (yy < 120)
cv.a[m] = (cv.a[m] * 0.55 + np.array([255, 196, 110]) * 0.45).astype(np.uint8)
# Sonnenscheibe mit Saum
cv.a[(d < 26) & (d >= 23)] = (252, 190, 96)
cv.a[d < 23] = (255, 226, 150)
cv.a[(d < 23) & (d >= 20) & (TH > 0.5)] = (252, 206, 120)

# ---------- Dschungel hinten (Horizont), Pyramide, Dschungel vorn ----------
jungle = sprite('g31_jungle', B, [159])
def jtint(s, dark, light):
    o = s.copy(); v = s[..., :3].astype(float).mean(-1, keepdims=True) / 255
    o[..., :3] = (np.array(dark) * (1 - v) + np.array(light) * v).clip(0, 255).astype(np.uint8)
    return o
back = jtint(jungle, (30, 14, 34), (96, 52, 60))           # ferne Baumlinie im Gegenlicht
cv.rect(0, 126, W, H, (30, 14, 34))                      # Boden hinter der Baumlinie (keine Himmelslücken)
for x0 in (-12, 88):
    cv.paste(back, x0, 112)

temple = sprite('g31_temple', B, [305])
TX = 62 - 58                # Achse der Pyramide (x≈58 in der Ebene) auf die Bildmitte
TY = 78
# Abendlicht: Pyramide leicht warm getönt, rechte Flanke dunkler
tp = temple.copy()
tp[..., :3] = (tp[..., :3].astype(float) * np.array([1.08, 0.92, 0.78])).clip(0, 255).astype(np.uint8)
cv.paste(tp, TX, TY)

def dusk(s, f, col, t):
    o = darken(s, f); return tint(o, col, t)
front = dusk(jungle, 0.62, (26, 20, 44), 0.22)
front2 = dusk(jungle, 0.42, (26, 16, 40), 0.3)
cv.paste(front2, -14, 140)
cv.paste(front, -4, 152)

# ---------- Quetzahuitl: Schlangenleib (in der Ebene nie gezeichnet) ----------
# Die frontale Gestalt der Ebene 218 besteht nur aus Kopf, Schwingen und Fühlern; der Leib hinter dem Kopf fehlt.
# Er wird hier ergänzt – im selben 125er-Raster und in den Farben der seitlichen Quetzahuitl derselben Ebene:
# vom Hinterkopf (verdeckt vom Scheitel) steigt der Leib mittig zwischen den Schwingenarmen auf, schwingt sich in
# einer S-Kurve vor der Sonne nach hinten oben und läuft perspektivisch schmaler in eine Schwanzspitze aus.
# Blick von unten auf den Leib: in der Mitte der goldene Bauch mit Querschuppen, rote Flankenlinien, außen der
# dunkelgrüne Rücken (Farben der seitlichen Figur).
PROFILE = [(0, 23, 4), (21, 56, 22), (16, 44, 17), (144, 33, 26), 'B', 'B', 'B', 'B', 'B', (144, 33, 26),
           (16, 44, 17), (21, 56, 22), (0, 23, 4)]
BELLY = [(195, 160, 65), (165, 136, 52)]                # Bauchschuppen im Wechsel (Farben der seitlichen Figur)
BELLY_LINE = (108, 83, 29)

def bez(p0, p1, p2, p3, n=200):
    t = np.linspace(0, 1, n)[:, None]
    return ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3

P = [np.array(v, float) for v in [(63, 64), (63, 42), (63, 38), (57, 31), (48, 24), (57, 16), (66, 16),
                                   (73, 16), (76, 13), (79, 13)]]
C = np.concatenate([bez(P[0], P[1], P[1], P[2], 80), bez(P[2], P[3], P[4], P[5], 120)[1:],
                    bez(P[5], P[6], P[7], P[8], 120)[1:], bez(P[8], P[8], P[9], P[9], 20)[1:]])
seg = np.diff(C, axis=0); arc = np.concatenate([[0], np.cumsum(np.hypot(*seg.T))])
tang = np.gradient(C, axis=0); tang /= np.hypot(*tang.T)[:, None]
nrm = np.stack([tang[:, 1], -tang[:, 0]], 1)
L = arc[-1]
rad = 7.4 - 6.4 * (arc / L) ** 0.8                      # 15 px am Kopf → ~2 px an der Schwanzspitze
px = np.stack([xx.ravel() + .5, yy.ravel() + .5], 1)
best = np.full(len(px), np.inf); bi = np.zeros(len(px), int)
for i in range(len(C)):                                  # nächster Mittellinienpunkt je Pixel
    d2 = ((px - C[i]) ** 2).sum(1) - rad[i] ** 2
    m = d2 < best; best[m] = d2[m]; bi[m] = i
inside = (best < 0).reshape(H, W)
bi = bi.reshape(H, W)
off = ((np.stack([xx + .5, yy + .5], -1) - C[bi]) * nrm[bi]).sum(-1) / rad[bi]      # −1 … 1 quer zum Leib
k = np.clip(((off + 1) / 2 * len(PROFILE)).astype(int), 0, len(PROFILE) - 1)
sc = (arc[bi] // 2).astype(int)                          # Schuppenreihen entlang des Leibs
body = np.zeros((H, W, 3), np.uint8)
for j, c in enumerate(PROFILE):
    m = k == j
    if c == 'B':
        body[m] = np.array(BELLY, np.uint8)[sc[m] % 2]
        body[m & (arc[bi] % 2 < 0.55)] = BELLY_LINE      # Fuge zwischen zwei Bauchschuppen
    else:
        body[m] = c
thin = rad[bi] < 3.2                                     # Schwanzende: nur noch Rücken und Flanke
body[thin & (k >= 3) & (k <= 9)] = (144, 33, 26)
body[thin & ((k == 5) | (k == 6) | (k == 7))] = (21, 56, 22)
edge = inside & ~(np.roll(inside, 1, 0) & np.roll(inside, -1, 0) & np.roll(inside, 1, 1) & np.roll(inside, -1, 1))
body[edge] = (0, 23, 4)
cv.a[inside] = body[inside]

# ---------- Quetzahuitl ----------
serp = sprite('g31_serpent', B, [218])
fr = serp[:, :100].copy()
fr = max(parts(fr, dil=1), key=lambda p: (p[..., 3] > 0).sum())   # Streupixel weg
cv.paste(fr, 62 - 49, 12)                         # Fühlerspitzen 24 px, Flügelspitzen 26/224 px vom Rand

out = Canvas(250, 350)
out.a[:] = up(np.dstack([cv.a, np.full((H, W), 255, np.uint8)]), 2)[..., :3]
print(save(out, '31_feathered_serpent.png'))
