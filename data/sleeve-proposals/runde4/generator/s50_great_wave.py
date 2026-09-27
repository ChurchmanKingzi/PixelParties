# -*- coding: utf-8 -*-
"""50 Great Wave – nach Hokusai: eine riesige, sich brechende Welle rollt von rechts heran und krümmt ihre
Gischtkrallen über das Bild; davor kämpft sich das Segelschiff über die Dünung, in der Ferne der Schneeberg.

Quellen (MotiveJapan.xcf):
  Ebene 11 „Ebene #168“ – Segelschiff (aus der Kranich-/Flussszene „Sichtbar #34/#36“), 4×
Selbst gezeichnet (Regel 2: Wasser, Himmel, Berg): Welle mit Gischt, Dünung, Himmel, Schneeberg, Gischttropfen.
Farben aus den Wasser- und Himmelsflächen der Japan-Karten.
Skalierung: Himmel, ferner Berg, ferne See 2× (125×175); große Welle mit Gischt 3× (84×117);
Schiff + vordere Dünung (klar im Vordergrund, unten) 4× (63×88).
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
# Strömungsstreifen parallel zur Rolle (wie Hokusais helle Linien): gestrichelt, abwechselnd hell/mittel
for n, rr in enumerate([R0 + 2.2, R0 + 4.4, R0 + 6.6, R0 + 8.8, R0 + 11.0]):
    ph = random.randint(0, 20)
    for k in range(320):
        a = -0.6 + k * (A_END + 0.6) / 320
        r0k = R0 + max(0.0, (a - math.radians(115)) / (A_END - math.radians(115))) * 6
        r = r0k + (rr - R0) * (R1 - r0k) / (R1 - R0)          # folgt der Verjüngung
        x, y = CX + r * math.cos(a), CY - r * math.sin(a)
        if ((k + ph) // (7 + n)) % 3 == 2: continue
        if 0 <= int(x) < wv.w and 0 <= int(y) < wv.h and body[int(y), int(x)]:
            wv.px(x, y, PALE if n < 2 else (LIGHT if n < 4 else MIDB))
# Streifen im Wellenrücken/-hang: folgen dem Hang nach unten links
for i in range(9):
    x0 = CX + R0 + 2 + i * 3.2
    ph = random.randint(0, 9)
    for y in range(int(CY) - 6, wv.h):
        x = x0 - (y - CY) * 0.33 + 1.3 * math.sin(y / 5 + i)
        if ((y + ph) // 5) % 3 == 2: continue
        if 0 <= int(x) < wv.w and 0 <= y < wv.h and body[y, int(x)] and ang(x, y + .5) > -0.7 and math.hypot(x - CX, y - CY) > R0:
            wv.px(x, y, LIGHT if i % 2 == 0 else MIDB)
# dunkle Schattenkante direkt unter der Lippe (Innenseite der Rolle)
for k in range(300):
    a = math.radians(-10) + k * (A_END - math.radians(-10)) / 300
    r0k = R0 + max(0.0, (a - math.radians(115)) / (A_END - math.radians(115))) * 6
    x, y = CX + (r0k + 0.4) * math.cos(a), CY - (r0k + 0.4) * math.sin(a)
    if a > math.radians(20): wv.px(x, y, LIGHT)
# Gischtkamm: weiße Kante außen an der Lippe, mit Krallen
for k in range(400):
    a = math.radians(40) + k * (A_END - math.radians(40)) / 400
    for dr in (0, 0.9, 1.8):
        x, y = CX + (R1 - dr) * math.cos(a), CY - (R1 - dr) * math.sin(a)
        wv.px(x, y, FOAM if dr < 1.5 else PALE)
# Krallen: kleine gekrümmte Finger, die nach außen/vorn greifen
for k in range(17):
    a = math.radians(60) + k * (A_END - math.radians(60)) / 16.5
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
        if s == L - 2 and k % 2: wv.px(x + tx * 1.2, y + ty * 1.2, FOAM)      # Nebenfinger
    wv.px(bx - nx * 2.6, by - ny * 2.6, PALE)                                  # Schaumwurzel
# Spitze der Lippe: Gischt tropft
tipx, tipy = CX + R0 * math.cos(A_END), CY - R0 * math.sin(A_END)
for (dx, dy) in [(0, 1), (-1, 2), (1, 3), (-2, 5), (0, 6), (-1, 8), (2, 9), (-3, 11)]:
    wv.px(tipx + dx, tipy + dy, FOAM if dy < 7 else PALE)
# Gischtflocken in der Luft
for _ in range(30):
    a = random.uniform(math.radians(60), A_END)
    r = R1 + random.uniform(2, 9)
    wv.px(CX + r * math.cos(a), CY - r * math.sin(a), FOAM)

# Wellental hinter dem Schiff (3×)
SEA = 96                                         # Wasserspiegel im Wellental (→ 288 px)
for x in range(wv.w):
    top = SEA - 3 + int(2.5 * math.sin(x / 9.0 + 1)) + int(1.2 * math.sin(x / 3.7))
    for y in range(top, wv.h):
        t = (y - top) / 12
        c = LIGHT if y == top else (MIDB if t < 0.6 else DEEP)
        if y == top and (x // 3) % 2 == 0: c = FOAM
        if y > top + 2 and (x * 3 + y * 7) % 17 == 0: c = LIGHT
        wv.px(x, y, c)
# Schiff im Vordergrund (eigene, nähere Ebene 4×) im Wellental, vorne von einer Dünung mit Gischt überspült
sp = Lay(4)
ship = sprite('j50_ship', J, [11])
sw, sh = ship.shape[1], ship.shape[0]
SX, SEA4 = 12, 78                                 # Wasserlinie im 4×-Raster (→ 312 px)
sp.paste(ship, SX, SEA4 - sh + 2)
for x in range(sp.w):
    top = SEA4 + int(1.6 * math.sin(x / 5.0 + 0.5)) - (2 if SX + sw - 2 < x < SX + sw + 6 else 0)
    for y in range(top, sp.h):
        c = FOAM if y == top and (x // 2) % 3 else (LIGHT if y <= top + 1 else (MIDB if y < top + 5 else DEEP))
        if y > top + 2 and (x * 3 + y * 7) % 13 == 0: c = LIGHT
        sp.px(x, y, c)
# Bugwelle und Gischt am Bug (rechts) und Heck
for (dx, dy) in [(sw, -4), (sw + 1, -5), (sw + 2, -3), (sw - 1, -6), (sw + 3, -6), (sw + 1, -8), (-1, -2), (-2, -3), (0, -4)]:
    sp.px(SX + dx, SEA4 + dy, FOAM)
for (dx, dy) in [(sw + 4, -9), (sw + 2, -11), (-3, -6)]:
    sp.px(SX + dx, SEA4 + dy, PALE)

cv = flatten([bg, wv, sp])
print(save(cv, '50_great_wave.png'))
