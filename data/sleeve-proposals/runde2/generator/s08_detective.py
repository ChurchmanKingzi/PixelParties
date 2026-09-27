# -*- coding: utf-8 -*-
"""Sleeve: Ermittlungswand von Great Detective Doq – Fotos der Verdächtigen, verbunden mit rotem Faden
(Farben des Crimson-Skull-Spider-Fadens), Doqs Lupe vergrößert das maskierte Gesicht des Monkee-Diebs.

Runde 2b (technische Angleichung, Konzept/Anordnung unverändert):
- Tiefenebene „Wand“ (Ziegelwand, Polaroids, Fotos, Fäden, Nadeln, Schatten, Vignette) komplett auf einem
  125×175-Raster gebaut und 2× hochskaliert → alles 2× auf dem 250er-Raster (6 px in der Ausgabe).
  Fäden 1 px, Polaroid-Ränder 2 px (unten 8 px), Nadelköpfe 3×3 – alles im Raster der Fotos.
- Tiefenebene „Lupe“ (Vordergrund): Doqs Lupe (Ebene „Doq“, Motive.xcf #1437) 6× auf dem 250er-Raster.
  Ring vollständig nachgezogen (Kreis mit den drei Blautönen der Original-Lupe, Glanz oben links), Griff
  aus den Originalpixeln (Diagonale hell/blau/dunkel), das von Doqs Hand verdeckte Griffstück mit demselben
  Muster ergänzt. Die Linse zeigt die Wand 3× vergrößert → Linseninhalt hat dieselbe Pixelgröße (6) wie der Ring.
- Kein eigener Rahmen (kommt später per Skript).
Quellen: Fotos pixelgenau aus den „Sichtbar“-Szenen (Motive #109/#849, MotiveDeepsea #46, MotiveGrailWar #182,
MotiveIndia #26, MotiveMoe #590) der Karten Great Detective Doq, Kaito Sid the Phantom Thief, Rakah the Loan Shark,
Devlin the Masked Butcher, Criminal Monkee, Black Marketeer; Ziegelwand aus der Doq-Szene; Lupe Motive.xcf #1437."""
import numpy as np
from kit import *
from xcfkit import scene_sprite, sprite

# Karte -> (xcf-Datei, Szenen-Ebene, linke obere Ecke des Kartenbilds in der Szene)
SCENES = {
    'Great Detective Doq': ('Motive', 109, (100, 160)),
    'Kaito Sid the Phantom Thief': ('Motive', 849, (259, 98)),
    'Rakah the Loan Shark': ('MotiveDeepsea', 46, (204, 156)),
    'Devlin the Masked Butcher': ('MotiveGrailWar', 182, (207, 148)),
    'Criminal Monkee': ('MotiveIndia', 26, (122, 366)),
    'Black Marketeer': ('MotiveMoe', 590, (166, 277)),
}
def scene(card, box, key):
    b, s, loc = SCENES[card]
    return scene_sprite(key, b, s, loc, box)

def shade(cv, s, x, y, f=0.55):
    """Schlagschatten: Wand unter der Silhouette von s abdunkeln (ganze Pixel des jeweiligen Rasters)."""
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            X, Y = x + i, y + j
            if s[j, i, 3] and 0 <= X < cv.w and 0 <= Y < cv.h:
                cv.a[Y, X] = (cv.a[Y, X] * f).astype(np.uint8)

# ---------------------------------------------------------------- Wand-Ebene: 125×175, 1 px = 2 auf 250
BW, BH = 125, 175
bd = Canvas(BW, BH)
tile = scene('Great Detective Doq', (14, 2, 30, 10), 'r2_08_doq_wall')
fill_tiles(bd, hsv_shift(tile, 0, 0.9, 0.78))
vignette(bd, 0.55, 0.35)

PAPER = (236, 230, 214); PAPER_S = (190, 180, 160)
photos = [  # (Karte, Ausschnitt in Kartenpixeln, Position auf dem 125er-Raster, Cache-Key)
    ('Kaito Sid the Phantom Thief', (24, 2, 64, 36), (7, 7), 'r2_08_photo_kaito'),
    ('Rakah the Loan Shark', (12, 8, 58, 40), (70, 17), 'r2_08_photo_rakah'),
    ('Devlin the Masked Butcher', (24, 3, 68, 35), (5, 70), 'r2_08_photo_devlin'),
    ('Criminal Monkee', (8, 9, 52, 43), (71, 76), 'r2_08_photo_monkee'),
    ('Black Marketeer', (16, 10, 56, 44), (31, 125), 'r2_08_photo_marketeer'),
]
boxes = []
for n, b, (px, py), key in photos:
    img = scene(n, b, key)
    h, w = img.shape[:2]
    fw, fh = w + 4, h + 10                      # Polaroid: 2 px Rand, unten 8 px
    shade(bd, np.full((fh, fw, 4), 255, np.uint8), px + 1, py + 1)
    bd.rect(px, py, px + fw, py + fh, PAPER)
    bd.rect(px, py + fh - 1, px + fw, py + fh, PAPER_S); bd.rect(px + fw - 1, py, px + fw, py + fh, PAPER_S)
    bd.paste(img, px + 2, py + 2)
    boxes.append((px, py, fw, fh))

# rote Fäden (1 px, im Raster der Fotos) zwischen den Nadeln, Farben aus dem Crimson-Skull-Spider-Faden
TH = [(149, 5, 3), (112, 2, 0)]
pins = [(x + w // 2, y + 1) for (x, y, w, h) in boxes]
def line(p, q):
    (x0, y0), (x1, y1) = p, q
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        bd.px(x, y, TH[(i // 3) % 2])
# Fadenschatten zuerst (1 px versetzt, abgedunkelte Wand), dann die Fäden
EDGES = [(0, 1), (0, 2), (1, 3), (2, 3), (2, 4), (3, 4), (0, 3)]
sh = bd.a.copy()
for a, b in EDGES:
    (x0, y0), (x1, y1) = pins[a], pins[b]
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n) + 1; y = round(y0 + (y1 - y0) * i / n) + 1
        if 0 <= x < BW and 0 <= y < BH: sh[y, x] = (bd.a[y, x] * 0.6).astype(np.uint8)
bd.a[:] = sh
for a, b in EDGES:
    line(pins[a], pins[b])
# Nadeln: 3×3-Kopf (dunkler Rand unten rechts, Glanzpunkt oben links) + Schatten
PIN = {'d': (60, 0, 0), 'r': (190, 20, 10), 'h': (255, 170, 150)}
for (x, y) in pins:
    # Schatten
    for j, row in enumerate(['.##.', '####', '####', '.##.']):
        for i, c in enumerate(row):
            if c == '#' and 0 <= x - 1 + i + 1 < BW and 0 <= y - 1 + j + 1 < BH:
                bd.a[y + j, x + i] = (bd.a[y + j, x + i] * 0.55).astype(np.uint8)
    for j, row in enumerate(['.rr.', 'rhrd', 'rrrd', '.dd.']):
        for i, c in enumerate(row):
            if c != '.': bd.px(x - 1 + i, y - 1 + j, PIN[c])

cv = Canvas(W, H)
cv.a[:] = up(bd.a, 2)

# ---------------------------------------------------------------- Lupe (Vordergrund): 6 px auf 250
doq = sprite('r2_08_doq_layer', 'Motive', [1437])            # Ebene „Doq“ (zugeschnitten, Ursprung = (128,171))
def dpx(x, y):  # Pixel der Doq-Ebene in Motive-Koordinaten
    return tuple(int(v) for v in doq[y - 171, x - 128, :3])
RO = 7.6                                                   # Außenradius des Rings (Original Ø 13, hier auf Ø 15
#                                                            geweitet, damit die Linse das ganze Gesicht fasst)
N = 25                                                     # Lupe im Originalraster
lupe = np.zeros((N, N, 4), np.uint8)
CX = CY = 16                                               # Ringmitte (Pixel)
DARK, MID, BLUE, LIGHT = (0, 31, 94), (2, 60, 133), (3, 83, 184), (118, 183, 225)   # Blautöne der Original-Lupe
yy, xx = np.mgrid[:N, :N]
disc0 = np.hypot(xx - CX, yy - CY) <= RO                    # Linsenscheibe
def inner(m):  # 4er-Erosion: jeder Ring ist exakt 1 Pixel breit
    e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]; return e
disc1 = inner(disc0); glass = inner(disc1)
ang = np.degrees(np.arctan2(yy - CY, xx - CX))            # 0 = rechts, -90 = oben
outer_r, inner_r = disc0 & ~disc1, disc1 & ~glass
lupe[outer_r, :3] = DARK; lupe[outer_r & (ang > -170) & (ang < -80), :3] = MID           # Umriss, oben links heller
lupe[inner_r, :3] = MID; lupe[inner_r & (ang > -100) & (ang < 45), :3] = BLUE             # Blau oben rechts/rechts
lupe[inner_r & (ang > -165) & (ang < -100), :3] = LIGHT                                     # Glanz oben links
lupe[outer_r | inner_r, 3] = 255
# Griff aus den Originalpixeln: Diagonale dunkel | hell | blau (Original: x = y-46 hell, Zeilen 185–193),
# hier vom Ring nach links oben geführt (die Lupe wird von oben links gehalten), Endkappe wie im Original
HD, HL, HB = dpx(144, 191), dpx(145, 191), dpx(146, 191)
for t in range(6, 16):
    j = CY - t; i0 = CX - t
    for i, c in ((i0 - 1, HD), (i0, HL), (i0 + 1, HB)):
        if 0 <= i < N and np.hypot(i - CX, j - CY) > RO:
            lupe[j, i, :3] = c; lupe[j, i, 3] = 255
for (i, j) in ((0, 0), (1, 0), (0, 1), (1, 1)):
    lupe[j, i, :3] = dpx(147, 194); lupe[j, i, 3] = 255
lupe[0, 2, :3] = dpx(147, 194); lupe[0, 2, 3] = 255

K = 4                                                      # Pixelgröße der Lupe auf dem 250er-Raster (= 2 auf 125)
# Linse über dem maskierten Monkee-Gesicht (Wand-Raster 125: (tx, ty)); jedes Lupen-Pixel zeigt genau ein
# Wand-Pixel → 2× vergrößert, Linseninhalt in derselben Pixelgröße wie Ring und Griff
tx, ty = 100, 97
mx, my = 2 * tx - K * CX, 2 * ty - K * CY
for j in range(N):
    for i in range(N):
        if glass[j, i]:
            c = bd.a[ty + j - CY, tx + i - CX].astype(int)
            lupe[j, i, :3] = np.clip(c * 0.85 + np.array([200, 225, 255]) * 0.15, 0, 255)
            lupe[j, i, 3] = 255
for (i, j) in ((CX - 3, CY - 2), (CX - 2, CY - 3), (CX - 3, CY - 1), (CX - 1, CY - 3)):
    lupe[j, i, :3] = (224, 240, 250)                       # Glanz auf dem Glas
R = up(lupe, K)
shade(cv, R, mx + K, my + K, 0.5)
cv.paste(R, mx, my)
print(save(cv, '08_detective_board.png'))
