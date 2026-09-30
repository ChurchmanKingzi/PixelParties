# -*- coding: utf-8 -*-
"""10 Wowhalla Watch – Gegner „Cool Gang“ (Structure Deck Cool Gang), Held: Thorad, Strength of Coolness.

Bildidee (nach Nutzer-Feedback 1+2): Thorad steht groß und frontal im Schnee vor Wowhalla, dem Schloss der Coolness
(Cover-Karte „Wowhalla, the Hall of the Cool“) – der Wächter vor seiner Halle. Hinter ihm das ganze Schloss mit den
grünen Stachel-Dächern (dieselben Dächer, auf denen er auf seiner Karte steht), darüber spannt sich vollständig der
Regenbogen der Coolness, auf den Wowkyrie (Wowkyrie, Bringer of Coolness) zureitet. Vor dem Schloss im Schnee zwei
Kreaturen der Coolness: links Swagdri, der Schmied mit erhobenem Hammer, rechts der Roboter Phatnir.
Schloss und Regenbogen haben eine Textur bekommen (Feedback 2): Ziegelfugen auf den Wänden, Schindelreihen auf den
Dächern, Licht-/Schattenkante je Regenbogenband – nur mit den vorhandenen Palettenfarben, leicht abgedunkelt/aufgehellt.

Quellen (MotiveCoolhalla.xcf, gemeinsames Koordinatensystem, Ausschnitt x 122–372, y 30–380):
  Ebene 221 „Ebene #16“  – Base-Thorad (rechte Figur; Szene „Sichtbar #5“ = Ebene 264, Lage 173,50; 0 px Abweichung).
  Ebene 253 „Ebene #11“  – Wowhalla-Schloss; 254 – Zahnräder; 251 – Eissaum am Schlossfuß.
  Ebene 257 „Ebene #12“  – Himmel mit Wolken; 255/256 – Schneehügel (diagonale Streifen, nach unten fortgesetzt).
  Ebene 207 „Ebene #32“  – Regenbogen: Bandfarben/-stärke (7×3 px) übernommen, als vollständiger Bogen hinter dem
                           Schloss bis zum Boden fortgeführt (Feedback 3).
  Ebenen 215+214         – Wowkyrie auf dem Einhorn mit Regenbogenspur (Karte Wowkyrie, Szene Ebene 262).
  Ebenen 125+124+123     – Swagdri mit erhobenem Hammer (Karte „Swagdri, Forger of Coolness“, Szene Ebene 122).
  Ebene 201 „Ebene #84“  – Phatnir, Roboter mit Goldkette (Karte „Phatnir, Prototype of Coolness“).
  (Die weiche Rauchsäule 252 bleibt weg – weichgezeichnet, keine Pixelgrafik.)
Selbst gezeichnet: Wand-/Dach-/Regenbogen-Textur (Fugen, Schindeln, Kanten), Schatten.

Skalierung (Tiefenebenen):
  Hintergrund 1× (250×350): Himmel, Regenbogen, Wowkyrie, ganzes Wowhalla-Schloss (326 px breit), Schnee
  Mittelgrund 2× (125×175): Swagdri und Phatnir im Schnee vor dem Schloss
  Vordergrund 6× (42×59):   Thorad (132×156 px), Gesichtsmitte auf x = 375 (von 750)
"""
import math
import numpy as np
from common import *  # noqa

B = 'MotiveCoolhalla'
thorad = parts(layer(B, 221)[50:95, 170:230], dil=1)[-1]            # 26×22 (rechte Figur = Thorad)
rainbow = sprite('o10_rainbow', B, [207]).copy()                    # 37×134
wowkyrie = sprite('o10_c215', B, [215, 214])                         # 30×81 mit Regenbogenspur
swagdri = sprite('o10_c125', B, [125, 124, 123])                     # 22×18 mit Hammer
phatnir = sprite('o10_c201', B, [201])                               # 34×33
X0, Y0 = 122, 30


def put(dst, s, x, y, f=1.0):
    h, w = s.shape[:2]
    for j in range(h):
        for i in range(w):
            if s[j, i, 3] == 0: continue
            yy, xx = y + j, x + i
            if 0 <= yy < dst.shape[0] and 0 <= xx < dst.shape[1]:
                dst[yy, xx, :3] = np.clip(s[j, i, :3].astype(float) * f, 0, 255); dst[yy, xx, 3] = 255


def shade(c, f):
    return tuple(int(max(0, min(255, v * f))) for v in c)


# ------------------------------------------------------------------ Texturen
castle = compose(B, [253], crop=False).copy()
WALL_L, WALL_S, WALL_D = (243, 187, 90), (143, 121, 58), (86, 63, 21)
ROOF_L, ROOF_M, ROOF_D2 = (59, 82, 66), (39, 65, 54), (37, 54, 43)
H_, W_ = castle.shape[:2]
rgb = castle[..., :3]
for y in range(H_):
    for x in range(W_):
        if castle[y, x, 3] == 0: continue
        c = tuple(int(v) for v in rgb[y, x])
        if c in (WALL_L, WALL_S, WALL_D):
            # Ziegel: 3 Zeilen hoch, 6 breit, versetzt; Fuge etwas dunkler
            row = y // 3
            joint = (y % 3 == 2) or ((x + (3 if row % 2 else 0)) % 6 == 0)
            if joint: rgb[y, x] = shade(c, 0.86)
            elif (x + y) % 7 == 0 and c == WALL_L: rgb[y, x] = shade(c, 1.04)
        elif c in (ROOF_L, ROOF_M, ROOF_D2):
            # Schindeln: Reihen alle 3 Zeilen, versetzte Bögen alle 4 Pixel
            if y % 3 == 2: rgb[y, x] = shade(c, 0.78)
            elif y % 3 == 0 and (x + (2 if (y // 3) % 2 else 0)) % 4 == 0: rgb[y, x] = shade(c, 1.22)
# Regenbogen: je Band oben eine hellere, unten eine dunklere Kante
rb = rainbow[..., :3].astype(int).copy()
al = rainbow[..., 3] > 0
out = rainbow.copy()
for y in range(rainbow.shape[0]):
    for x in range(rainbow.shape[1]):
        if not al[y, x]: continue
        up_ = rb[y - 1, x] if y > 0 and al[y - 1, x] else None
        dn_ = rb[y + 1, x] if y + 1 < rainbow.shape[0] and al[y + 1, x] else None
        c = tuple(rb[y, x])
        if up_ is None or tuple(up_) != c: out[y, x, :3] = [min(255, int(v * 1.0 + (255 - v) * 0.35)) for v in c]
        elif dn_ is None or tuple(dn_) != c: out[y, x, :3] = shade(c, 0.8)
rainbow = out

# ================================================================== Hintergrund 1× (250×350)
W1, H1 = 250, 350
sky = compose(B, [257], crop=False)
rest = compose(B, [251, 254, 255, 256], crop=False)
bg = np.zeros((H1, W1, 4), np.uint8); bg[..., 3] = 255
SH = sky.shape[0]
yy = np.clip(np.arange(H1) + Y0, 0, SH - 1)
bg[..., :3] = sky[yy][:, X0:X0 + W1, :3]
# Regenbogen als vollständiger, logischer Bogen hinter dem Schloss: dieselben 7 Bänder à 3 px und Farben wie Ebene 207
# (Mitte), dieselben Kanten (oberste Bandzeile heller, unterste dunkler); die Schenkel laufen hinter den Seitentürmen
# und dem Schnee bis zum Boden hinab und enden nirgends im Himmel.
BANDS = [tuple(int(v) for v in sprite('o10_rainbow', B, [207])[y, 67, :3]) for y in range(0, 21, 3)]
RCX, RCY, ROUT = 125, 128, 112                                      # Mittelpunkt/Außenradius (Canvas-Pixel)
for y in range(0, RCY + 60):
    for x in range(W1):
        d = math.hypot(x + 0.5 - RCX, y + 0.5 - RCY)
        k = ROUT - d
        if 0 <= k < 21 and y < 300:
            b_, r_ = int(k // 3), int(k) % 3
            c = BANDS[b_]
            if r_ == 0: c = tuple(min(255, int(v + (255 - v) * 0.35)) for v in c)
            elif r_ == 2: c = shade(c, 0.8)
            bg[y, x, :3] = c
put(bg, wowkyrie, 14, 58)                                            # Wowkyrie reitet von links heran
full = rest.copy()
cm = castle[..., 3] > 0
full[cm] = castle[cm]
sub = full[Y0:Y0 + H1, X0:X0 + W1]
m = sub[..., 3] > 0
bg[:sub.shape[0]][m, :3] = sub[m, :3]
last = sub.shape[0] - 1                                             # Szene endet: Schneestreifen diagonal fortsetzen
for y in range(last - 1, H1):
    bg[y, :, :3] = np.roll(bg[y - 1, :, :3], -1, axis=0)

# ================================================================== Mittelgrund 2× (125×175)
mid = np.zeros((175, 125, 4), np.uint8)
for s, cx, fy in [(swagdri, 24, 124), (phatnir, 99, 125)]:
    for i in range(-s.shape[1] // 2 + 2, s.shape[1] // 2 - 1):
        mid[fy + 1, cx + i, :3] = (150, 186, 220); mid[fy + 1, cx + i, 3] = 255
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
cv.paste(bg, 0, 0)
cv.paste(up(mid, 2), 0, 0)
cv.paste(up(fg, 6), 2, 0)                         # Gesichtsmitte (Sprite-Spalte 10,5) auf x = 125 → 375 von 750
save(cv, '10_wowhalla_watch.png')
print('ok')
