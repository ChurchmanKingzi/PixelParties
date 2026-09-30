# -*- coding: utf-8 -*-
"""10 Wowhalla Watch – Gegner „Cool Gang“ (Structure Deck Cool Gang), Held: Thorad, Strength of Coolness.

Bildidee (nach Nutzer-Feedback 1+2): Thorad steht groß und frontal im Schnee vor Wowhalla, dem Schloss der Coolness
(Cover-Karte „Wowhalla, the Hall of the Cool“) – der Wächter vor seiner Halle. Hinter ihm ragt der Hauptturm mit den
grünen Stachel-Dächern auf (dieselben Dächer, auf denen er auf seiner Karte steht); über dem Schloss spannt sich
vollständig der Regenbogen der Coolness, auf dem Wowkyrie (Wowkyrie, Bringer of Coolness) heranreitet. Am Schlossfuß
stehen zwei Kreaturen der Coolness: links Swagdri, der Schmied mit erhobenem Hammer, rechts der Roboter Phatnir.

Quellen (MotiveCoolhalla.xcf):
  Ebene 221 „Ebene #16“  – Base-Thorad (rechte Figur; Szene „Sichtbar #5“ = Ebene 264, Lage 173,50; 0 px Abweichung).
  Ebene 253 „Ebene #11“  – Wowhalla-Schloss (Ausschnitt x 150–275 um den Hauptturm, 2×), 254 – Zahnräder.
  Ebene 257 „Ebene #12“  – Himmel mit Wolken; 255/256 – Schnee-Textur (diagonale Streifen).
  Ebene 207 „Ebene #32“  – Regenbogen (vollständig, 134×37).
  Ebenen 215+214         – Wowkyrie auf dem Einhorn mit Regenbogenspur (Karte Wowkyrie, Szene Sichtbar #3/Ebene 262).
  Ebenen 125+124+123     – Swagdri mit Hammer (Karte „Swagdri, Forger of Coolness“, Szene Ebene 122).
  Ebene 201 „Ebene #84“  – Phatnir, Roboter mit Goldkette (Karte „Phatnir, Prototype of Coolness“).
Selbst gezeichnet: Schneehang vor dem Schlossfuß (Kante), Schatten, Luftperspektive (Schloss leicht aufgehellt).

Skalierung (Tiefenebenen):
  Himmel 1× (250×350):    Himmel/Wolken, vollständiger Regenbogen, Wowkyrie (weit entfernt)
  Mittelgrund 2× (125×175): Wowhalla-Ausschnitt mit Zahnrädern, Schneehang, Swagdri, Phatnir (am Schlossfuß)
  Vordergrund 6× (42×59):   Thorad (132×156 px), Gesichtsmitte auf x = 375 (von 750)
"""
import math
import numpy as np
from common import *  # noqa

B = 'MotiveCoolhalla'
BAY = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32.0
thorad = parts(layer(B, 221)[50:95, 170:230], dil=1)[-1]            # 26×22 (rechte Figur = Thorad)
rainbow = sprite('o10_rainbow', B, [207])                            # 37×134
wowkyrie = sprite('o10_c215', B, [215, 214])                          # 30×81 mit Regenbogenspur
swagdri = sprite('o10_c125', B, [125, 124, 123])                      # 22×18 mit Hammer
phatnir = sprite('o10_c201', B, [201])                                # 34×33


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


# ================================================================== Himmel 1× (250×350)
sky = compose(B, [257], crop=False)
bg1 = np.zeros((350, 250, 4), np.uint8); bg1[..., 3] = 255
bg1[:257, :, :3] = sky[0:257, 100:350, :3]
bg1[257:, :, :3] = sky[256, 100:350, :3]
put(bg1, rainbow, 125 - rainbow.shape[1] // 2, 26)                  # ganzer Bogen über dem Schloss
put(bg1, wowkyrie, 26, 72)                                           # Wowkyrie reitet links heran

# ================================================================== Mittelgrund 2× (125×175)
W2, H2 = 125, 175
mid = np.zeros((H2, W2, 4), np.uint8)
castle = compose(B, [253, 254], crop=False)
CX0, CY0 = 150, 44                                                  # Ausschnitt um den Hauptturm
sub = castle[CY0:CY0 + H2, CX0:CX0 + W2]
m = sub[..., 3] > 0
TOPY = 26                                                           # Schloss-Oberkante im 2×-Raster (Canvas 52)
for y, x in zip(*np.nonzero(m)):
    Y = y + TOPY
    if Y < H2:
        c = sub[y, x, :3].astype(float)
        c = c * 0.9 + np.array((150, 200, 225)) * 0.1                # leichte Luftperspektive
        mid[Y, x, :3] = np.clip(c, 0, 255); mid[Y, x, 3] = 255
# Schneehang vor dem Schlossfuß (Schneestreifen der Szene), sanft gewölbte Kante
snow = compose(B, [255, 256], crop=False)
ST = snow[215:245, 60:390, :3]
HILL = 118
for x in range(W2):
    top = int(HILL - 4 * math.cos((x - W2 / 2) / W2 * math.pi) + 1.2 * math.sin(x * 0.5))
    for y in range(top, H2):
        c = ST[(y - top) % ST.shape[0], (x + (y - top)) % ST.shape[1]]
        mid[y, x, :3] = c; mid[y, x, 3] = 255
    mid[top, x, :3] = (236, 246, 255)
# Kreaturen der Coolness am Schlossfuß, auf dem Hang
for s, cx, fy in [(swagdri, 17, HILL + 6), (phatnir, 106, HILL + 8)]:
    for i in range(-s.shape[1] // 2 + 2, s.shape[1] // 2 - 1):
        mid[fy + 1, cx + i, :3] = (150, 186, 214)
    put(mid, s, cx - s.shape[1] // 2, fy + 1 - s.shape[0])

# ================================================================== Vordergrund 6× (42×59)
W6, H6 = 42, 59
fg = np.zeros((H6, W6, 4), np.uint8)
TX = 21 - thorad.shape[1] // 2
FEET = 54
for i in range(-10, 11):
    for d in (0, 1):
        if abs(i) <= 10 - d * 2:
            fg[FEET + 1 + d, 21 + i, :3] = (120, 150, 196); fg[FEET + 1 + d, 21 + i, 3] = 150
mm = thorad[..., 3] > 0
fg[FEET + 1 - thorad.shape[0]:FEET + 1, TX:TX + thorad.shape[1]][mm] = thorad[mm]

cv = Canvas(250, 350)
cv.paste(bg1, 0, 0)
cv.paste(up(mid, 2), 0, 0)
cv.paste(up(fg, 6), -1, 0)
save(cv, '10_wowhalla_watch.png')
print('ok')
