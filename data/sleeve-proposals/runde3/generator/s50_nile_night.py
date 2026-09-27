# -*- coding: utf-8 -*-
"""50 Nile Night – die Pyramide ragt mit der Spitze vor den Vollmond, ihr ganzes Bild samt Mond und Sternen
spiegelt sich wellig im Nil; auf der steinernen Kaimauer im Vordergrund halten zwei Totenwächter Wache und
blicken über den Fluss.

Quellen:
  MotiveEgypt.xcf: Himmel mit Mond Ebene #13 (i235, Ausschnitt um den Mond); Wächter: Sah (i217, Schakal-Mumie
  mit Stab) und Khet (i214, Anubis-Mumie mit Klinge) – beide gegen ihre Szenen „Sichtbar #2“/„Sichtbar #3“
  geprüft, vollständig in je einer Ebene.
  MotiveIndia.xcf: „Pyramid“ (i186, Ziegelpyramide; dieselbe Grafik liegt in MotiveEgypt als i121 kopfüber).
  Spiegelung = das obere Bild (Himmel, Mond, Pyramide) gespiegelt, zeilenpaarweise wellig versetzt, blau
  abgedunkelt, mit Wellenlichtern; ferne Uferdüne, Kaimauer: selbst gezeichnet in Wüstenfarben.

Skalierung: Himmel/Mond, Pyramide, Ufer, Wasser samt Spiegelung 2× (hinten, jenseits des Flusses);
Wächter und Kaimauer 3× (Vordergrund).
"""
from common import *
import numpy as np

B = 'MotiveEgypt'
cv = Canvas(250, 350)
rng = np.random.default_rng(50)

# --- Himmel (2×) ------------------------------------------------------------------------------------------
sky = compose(B, [235])[..., :3]
MX, MY = 126, 52                                # Mondmitte auf dem Canvas (Ebene: 160,100)
sx0, sy0 = 160 - MX // 2, 100 - MY // 2
sk = up(sky[sy0:sy0 + 90, sx0:sx0 + 125], 2)
FB = 146                                         # Oberkante der fernen Uferdüne
cv.a[:FB + 12] = sk[:FB + 12, :250]

# --- Pyramide (2×), mondbeschienen ------------------------------------------------------------------------
P = up(flip(compose('MotiveIndia', [186])), 2)
P[..., :3] = (P[..., :3] * np.array([0.70, 0.64, 0.62]) + np.array([6, 10, 38])).clip(0, 255).astype(np.uint8)
PY = 26                                           # Spitze knapp unterhalb der Mondmitte
cv.paste(P, 126 - P.shape[1] // 2, PY)

# --- ferne Uferdüne (2×-Raster, gewellte Kante) --------------------------------------------------------------
WY = 158                                          # Wasserlinie
DUNE = [np.array(c) for c in ((40, 34, 52), (58, 48, 62))]
for x in range(0, 250, 2):
    top = FB + 2 * int(round(1.5 + 1.5 * np.sin(x * 0.035 + 0.8) + 0.8 * np.sin(x * 0.11)))
    for y in range(top, WY, 2):
        c = DUNE[1] if y == top else DUNE[0]
        cv.a[y:y + 2, x:x + 2] = c

# --- Nil: Spiegelbild des oberen Bildes, zeilenpaarweise wellig versetzt -------------------------------------
QY = 312                                          # Oberkante der Kaimauer
src = cv.a.copy()
WATER = np.array([10, 22, 60])
for y in range(WY, QY, 2):
    d = y - WY
    sy = WY - 2 - d                              # gespiegelte Quellzeile (2-px-Paar)
    t = d / (QY - WY)
    dx = 2 * int(round(np.sin(y * 0.37) * (0.6 + 2.2 * t) + np.sin(y * 0.11 + 1) * t))
    row = np.roll(src[max(sy, 0)], dx, axis=0).astype(float)
    f = 0.62 - 0.22 * t
    row = row * f * np.array([0.8, 0.9, 1.1]) + WATER * (1 - f)
    cv.a[y:y + 2] = row.clip(0, 255).astype(np.uint8)
# Wellenlichter (kurze helle Striche im 2×-Raster), dichter im Mondpfad
for y in range(WY + 4, QY - 2, 4):
    t = (y - WY) / (QY - WY)
    for x in range(0, 250, 2):
        inpath = abs(x + 1 - MX) < 10 + 26 * t
        p = 0.34 if inpath else 0.04
        if rng.random() < p and ((x // 2 + y // 4) % 2 == 0):
            L = 2 * rng.integers(1, 3 if inpath else 2)
            col = (206, 212, 170) if inpath else (60, 84, 130)
            cv.a[y:y + 2, x:x + L] = col
cv.a[WY:WY + 2] = (24, 30, 58)

# --- Kaimauer (3×-Raster: Sandsteinquader 8×4 Rasterpixel) ------------------------------------------------------
STONE = [np.array(c) for c in ((92, 76, 70), (110, 90, 78), (126, 104, 86))]
for y in range(QY, 350):
    r = (y - QY) // 12
    for x in range(250):
        off = 12 if r % 2 else 0
        jy = (y - QY) % 12 >= 9
        jx = (x + off) % 24 >= 21
        k = ((x + off) // 24 * 5 + r * 2) % 3
        col = STONE[k] * (1.0 - 0.25 * (y - QY) / 38)
        if (y - QY) < 3: col = np.array((150, 128, 104))      # Kante im Mondlicht
        elif jy or jx: col = np.array((40, 32, 36))
        cv.a[y, x] = col.astype(np.uint8)

# --- Wächter (3×), blicken über den Fluss ------------------------------------------------------------------
def guard(key, ids, cx, feet, fl=False):
    s = sprite('h50_' + key, B, ids)
    if fl: s = flip(s)
    s = up(s, 3)
    s = s.copy(); s[..., :3] = (s[..., :3] * np.array((0.82, 0.84, 0.98)) + np.array([4, 6, 18])).clip(0, 255).astype(np.uint8)
    h, w = s.shape[:2]
    x = cx - w // 2
    assert x >= 0 and x + w <= 250
    for yy in range(feet - 3, feet + 3, 3):             # Schatten auf dem Kai (3×-Raster)
        for xx in range(x + 3, x + w - 3, 3):
            cv.a[yy:yy + 3, xx:xx + 3] = (cv.a[yy:yy + 3, xx:xx + 3] * 0.5).astype(np.uint8)
    cv.paste(s, x, feet - h)

guard('sah', [217], 44, 336)
guard('khet', [214], 208, 336)

vignette(cv, 0.45, 0.62)
save(cv, '50_nile_night.png')
