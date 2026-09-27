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

SX, SY = 62, 46            # Sonnenmitte (hinter dem Kopf der Schlange)
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
TY = 76
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

# ---------- Quetzahuitl ----------
serp = sprite('g31_serpent', B, [218])
fr = serp[:, :100].copy()
fr = max(parts(fr, dil=1), key=lambda p: (p[..., 3] > 0).sum())   # Streupixel weg
cv.paste(fr, 62 - 49, 10)

out = Canvas(250, 350)
out.a[:] = up(np.dstack([cv.a, np.full((H, W), 255, np.uint8)]), 2)[..., :3]
print(save(out, '31_feathered_serpent.png'))
