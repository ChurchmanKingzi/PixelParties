# -*- coding: utf-8 -*-
"""50 Great Wave – nach Hokusai: eine riesige, sich brechende Welle rollt von rechts heran und krümmt ihre
Gischtkrallen über das Bild; davor kämpft sich das Segelschiff über die Dünung, in der Ferne der Schneeberg.

Quellen (MotiveJapan.xcf):
  Ebene 11 „Ebene #168“ – Segelschiff (aus der Kranich-/Flussszene „Sichtbar #34/#36“), 3×
Selbst gezeichnet (Regel 2: Wasser, Himmel, Berg): Welle mit Gischt, Dünung, Himmel, Schneeberg, Gischttropfen.
Farben aus den Wasser- und Himmelsflächen der Japan-Karten.
Skalierung: Himmel, ferner Berg, ferne See 2× (125×175); große Welle, Dünung, Schiff, Tropfen 3× (84×117).
"""
import math, random
from j_util_46_50 import *  # noqa

J = 'MotiveJapan'
random.seed(50)

# ---------------- 2×: Himmel, Berg, ferne See ----------------
bg = Lay(2)
HOR = 126                                       # Horizont (→ 252 px)
bg.vgrad([(0, (176, 170, 150)), (0.3, (214, 200, 164)), (0.7, (236, 222, 184)), (1, (244, 234, 204))], y1=HOR)
# Schneeberg (Fuji-Form)
FX, FTOP, FW = 58, 100, 30
for y in range(FTOP, HOR):
    t = (y - FTOP) / (HOR - FTOP)
    half = 3 + t * FW + 2 * t * t * 4
    for x in range(int(FX - half), int(FX + half) + 1):
        snow = t < 0.38 + 0.08 * math.sin(x * 1.3)
        c = (250, 250, 252) if snow else ((96, 110, 150) if x < FX + half * 0.2 else (70, 82, 124))
        bg.px(x, y, c)
for y in range(HOR, bg.h):
    t = (y - HOR) / (bg.h - HOR)
    bg.px(0, y, (0, 0, 0))
bg.vgrad([(0, (120, 150, 190)), (1, (70, 100, 160))], y0=HOR, y1=bg.h)
for y in range(HOR + 2, bg.h, 3):
    for x in range(bg.w):
        if (x * 5 + y * 3) % 13 < 3: bg.px(x, y, (160, 186, 214))

# ---------------- 3×: große Welle ----------------
wv = Lay(3)
S = 3.0
CX, CY = 162 / S, 104 / S                       # Mittelpunkt der Rolle (in 3×-Rasterpixeln)
R1, R0 = 76 / S, 38 / S
A_END = math.radians(208)                       # Lippe reicht bis links unter die Waagerechte
DEEP, MIDB, LIGHT, PALE, FOAM = (18, 38, 88), (32, 70, 138), (70, 120, 186), (140, 184, 222), (246, 248, 252)


def ang(x, y):
    a = math.atan2(-(y - CY), x - CX)            # 0 = rechts, 90° = oben
    return a if a >= -math.radians(40) else a + 2 * math.pi


body = np.zeros((wv.h, wv.w), bool)
shade = np.zeros((wv.h, wv.w))
for y in range(wv.h):
    for x in range(wv.w):
        px, py = x + .5, y + .5
        d = math.hypot(px - CX, py - CY)
        a = ang(px, py)
        # Lippe verjüngt sich zur Spitze hin
        r0 = R0 + max(0.0, (a - math.radians(115)) / (A_END - math.radians(115))) * 6
        in_lip = r0 <= d <= R1 and -math.radians(40) <= a <= A_END
        # Wellenrücken rechts; die Vorderseite unter der Rolle läuft nach links unten aus
        face_x = CX + R0 - (py - CY) * 0.33
        in_back = py >= CY and px >= face_x
        # Rücken rechts oberhalb der Rollenmitte: fällt vom Kamm nach rechts ab
        in_back2 = py < CY and px > CX + R1 * 0.55 and d > R1 * 0.9 and py > (CY - R1 * 0.72) + (px - CX - R1 * 0.55) * 0.9
        if in_back2 and not in_lip:
            body[y, x] = True; shade[y, x] = 1.0
            continue
        if in_lip or in_back:
            body[y, x] = True
            shade[y, x] = (d - r0) / (R1 - r0) if in_lip else min(1.0, (px - face_x) / 16)
# Farbbänder: innen hell (Unterseite der Lippe), außen dunkel
for y in range(wv.h):
    for x in range(wv.w):
        if not body[y, x]: continue
        t = shade[y, x]
        c = PALE if t < 0.12 else (LIGHT if t < 0.4 else (MIDB if t < 0.75 else DEEP))
        wv.px(x, y, c)
# helle Strömungslinien parallel zur Rolle
for rr in (R0 + 4, R0 + 7.5):
    for k in range(260):
        a = -0.5 + k * (A_END + 0.4) / 260
        x, y = CX + rr * math.cos(a), CY - rr * math.sin(a)
        if (k // 9) % 3 != 2 and 0 <= int(x) < wv.w and 0 <= int(y) < wv.h and body[int(y), int(x)]:
            wv.px(x, y, PALE)
for i in range(4):                               # senkrechte Linien im Wellenrücken
    x0 = CX + R0 + 4 + i * 5
    for y in range(int(CY) + 2, wv.h):
        x = x0 - (y - CY) * 0.33 + 1.5 * math.sin(y / 5 + i)
        if (y // 6 + i) % 3 and 0 <= int(x) < wv.w and body[y, int(x)]: wv.px(x, y, LIGHT)
# Gischtkamm: weiße Kante außen an der Lippe, mit Krallen
for k in range(400):
    a = math.radians(40) + k * (A_END - math.radians(40)) / 400
    for dr in (0, 0.9, 1.8):
        x, y = CX + (R1 - dr) * math.cos(a), CY - (R1 - dr) * math.sin(a)
        wv.px(x, y, FOAM if dr < 1.5 else PALE)
# Krallen: kleine gekrümmte Finger, die nach außen/vorn greifen
for k in range(10):
    a = math.radians(70) + k * (A_END - math.radians(70)) / 9.5
    bx, by = CX + R1 * math.cos(a), CY - R1 * math.sin(a)
    nx, ny = math.cos(a), -math.sin(a)             # nach außen
    tx, ty = -math.sin(a), -math.cos(a)            # entlang der Lippe (Brechrichtung)
    L = 4 + (k % 3)
    for s in range(L):
        u = s / L
        x = bx + nx * (s * 0.8) + tx * (u * u * 3.5)
        y = by + ny * (s * 0.8) + ty * (u * u * 3.5)
        wv.px(x, y, FOAM)
        if s < L - 1: wv.px(x - nx * 0.9, y - ny * 0.9, FOAM)
# Spitze der Lippe: Gischt tropft
tipx, tipy = CX + R0 * math.cos(A_END), CY - R0 * math.sin(A_END)
for (dx, dy) in [(0, 1), (-1, 2), (1, 3), (-2, 5), (0, 6), (-1, 8), (2, 9), (-3, 11)]:
    wv.px(tipx + dx, tipy + dy, FOAM if dy < 7 else PALE)
# Gischtflocken in der Luft
for _ in range(30):
    a = random.uniform(math.radians(60), A_END)
    r = R1 + random.uniform(2, 9)
    wv.px(CX + r * math.cos(a), CY - r * math.sin(a), FOAM)

# Dünung im Vordergrund mit Schiff
SEA = 98                                         # Wasserlinie Schiff (→ 294 px)
for x in range(wv.w):
    top = SEA - 3 + int(2.5 * math.sin(x / 9.0 + 1)) + int(1.2 * math.sin(x / 3.7))
    for y in range(top, wv.h):
        t = (y - top) / 12
        c = LIGHT if y == top else (MIDB if t < 0.6 else DEEP)
        if y == top and (x // 3) % 2 == 0: c = FOAM
        if y > top + 2 and (x * 3 + y * 7) % 17 == 0: c = LIGHT
        wv.px(x, y, c)
ship = sprite('j50_ship', J, [11])
sw, sh = ship.shape[1], ship.shape[0]
SX = 18
wv.paste(ship, SX, SEA + 2 - sh)
# Wasser vor dem Rumpf + Bugwelle
for x in range(SX - 2, SX + sw + 3):
    top = SEA + 1 + int(1.2 * math.sin(x / 3.7))
    wv.px(x, top, FOAM if (x - SX) % 4 < 2 else PALE)
    wv.px(x, top + 1, LIGHT)
for (dx, dy) in [(sw + 1, -1), (sw + 3, -2), (sw + 2, -3), (-2, -1), (-3, -2)]:
    wv.px(SX + dx, SEA + dy, FOAM)

cv = flatten([bg, wv])
print(save(cv, '50_great_wave.png'))
