# -*- coding: utf-8 -*-
"""43 Wheel of Wisdom – Gegner „To Attain Divinity“ (Structure Deck), Held: Archibald, the Archmage.

Neues Motiv (Nutzer-Feedback: aus den Elementen seiner eigenen Karte gebaut): Archibald steht in seiner
dämmrigen Halle vor der großen Glasrosette seiner Base-Karte. Die fünf farbigen Felder zeigen – wie auf der Karte –
die fünf Gestalten des Kartenmotivs (Schattengestalt mit rotem Auge, rothaarige Kämpferin, braunhaarige Schützin,
Mann mit Hut und Pelzkragen, Hexe mit Spitzhut). Das Licht fällt in bunten Bahnen durch die Rosette auf den
Parkettboden, auf dem der Erzmagier mit Stab und violetten Funkelsternen steht; zu seinen Füßen der violette
Sternenstoff aus seinem Kartenmotiv.

Quellen (alle Motive.xcf, Szene der Karte „Archibald, the Archmage“ = Sichtbar #43, Ebene 98, Lage 247,117):
  Ebene 436 „ARCHMAGE“ + 435 „Archmage #9“ (Archibald mit Funkelsternen; Komposit pixelgleich mit der Szene,
            354 deckende Pixel, 0 Abweichungen). NICHT Ebene 434 „Gandalf“ (graue Variante).
  Ebene 444 „Archmage“ (farbige Glasfelder), 440 „Archmage #4“ (Bleiruten-Netz), 441 „Archmage #3“ (Ring),
            439 „Archmage #1“ (Ring mit fünf Speichen) – die Rosette.
  Ebene 438 „Archmage #6“ – die fünf Gestalten, die auf der Karte (vergrößert, halbtransparent) in den fünf
            Feldern erscheinen; hier im Raster der Rosette, zu 75 % ins Glas gemischt.
  Ebene 442 „Archmage #7“ – violetter Sternenstoff (Teppich zu Archibalds Füßen).
  Sichtbar #43 (Ebene 98), Ausschnitt x 240–256, y 184–200: Parkettkachel der Halle (16×16, periodisch).
Selbst gezeichnet: Mauer der Halle, steinerne Fensterlaibung, Lichtbahnen und farbiger Lichtfleck am Boden,
Hinterleuchtung der Glasfelder, Kontaktschatten.

Skalierung (Tiefenebenen):
  Hintergrund (Mauer, Rosette 76×76 → 152×152, fünf Gestalten, Lichtbahnen)   – 2×-Raster (125×175)
  Vordergrund (Archibald 25×31 → 125×155, Parkett, Sternenteppich, Lichtfleck)  – 5×-Raster (50×70)
"""
import math
import numpy as np
from kitH import *  # noqa

BM = 'Motive'
arch = sprite('o43_archibald', BM, [435, 436])                       # 25×31 inkl. Funkeln
ros_box = (246, 106, 322, 182)
glass = sprite('o43_glass', BM, [444], box=ros_box)                  # Farbfelder (nicht zugeschnitten: gleicher Ausschnitt)
mesh = sprite('o43_mesh', BM, [440, 441, 439], box=ros_box)          # Bleiruten, Ring, Speichen
# Die fünf Gestalten (Ebene 438), einzeln ausgeschnitten: (Schlüssel, Box in Leinwandkoordinaten)
FIG_BOX = {'shadow': (259, 112, 281, 138), 'red': (286, 112, 309, 138), 'girl': (247, 138, 273, 165),
           'hat': (295, 139, 320, 167), 'witch': (274, 150, 294, 181)}
figs = {k: sprite('o43_fig_' + k, BM, [438], box=b) for k, b in FIG_BOX.items()}
cloth = sprite('o43_cloth', BM, [442])                               # 128×77 Sternenstoff
tile = sprite('o43_parquet', BM, [98], box=(240, 184, 256, 200))     # 16×16 Parkett (in der Szene abgedunkelt)

# ================================================================== Hintergrund 2× (125×175)
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
# Mauer: große Quader in dunklem Violett, versetzte Fugen
WALL = [(34, 24, 46), (42, 30, 56), (26, 18, 36)]
for y in range(h2):
    for x in range(w2):
        row = y // 6
        off = 5 if row % 2 else 0
        joint = (y % 6 == 5) or ((x + off) % 11 == 10)
        c = WALL[2] if joint else (WALL[1] if (y % 6 == 0 or (x + off) % 11 == 0) else WALL[0])
        bg[y, x, :3] = c
RCX, RCY = 62.5, 50.0                        # Mitte der Rosette (y 100)
R = 38.0
# Fensterlaibung: zwei Steinringe um das Glas
for y in range(h2):
    for x in range(w2):
        d = math.hypot(x + .5 - RCX, y + .5 - RCY)
        if R - 0.5 <= d < R + 2.5:
            bg[y, x, :3] = (96, 80, 104) if d < R + 1 else (70, 56, 80)
        elif R + 2.5 <= d < R + 3.5:
            bg[y, x, :3] = (18, 12, 26)
# Hinterleuchtetes Glas: Farben aufgehellt
gh, gw = glass.shape[:2]
GX, GY = int(RCX - gw / 2), int(RCY - gh / 2)
lit = glass.copy()
lit[..., :3] = np.clip(glass[..., :3].astype(float) * 1.08 + 18, 0, 255).astype(np.uint8)
put(bg, lit, GX, GY)
# Die fünf Gestalten in ihren Feldern (Lage wie auf der Karte), 75 % ins Glas gemischt
FIG_POS = {'shadow': (-17, -26), 'red': (7, -26), 'girl': (-27, 0), 'hat': (4, 1), 'witch': (-9, 8)}
for k, (dx, dy) in FIG_POS.items():
    f = figs[k]
    fx, fy = int(RCX + dx), int(RCY + dy)
    for j in range(f.shape[0]):
        for i in range(f.shape[1]):
            if f[j, i, 3]:
                X, Y = fx + i, fy + j
                if math.hypot(X + .5 - RCX, Y + .5 - RCY) < R - 1:
                    bg[Y, X, :3] = (bg[Y, X, :3] * 0.25 + f[j, i, :3] * 0.75).astype(np.uint8)
put(bg, mesh, GX, GY)                        # Bleiruten über allem
dark_vignette(bg, strength=0.55, r0=0.3, cx=RCX, cy=RCY + 20)

# Lichtbahnen: fünf breite, farbige, geditherte Bahnen vom Fenster schräg nach unten auf den Boden
BEAMS = [((200, 200, 210), -0.55), ((230, 120, 60), 0.5), ((220, 70, 50), -0.9), ((70, 110, 200), 0.85),
         ((110, 200, 150), 0.0)]
for col, slope in BEAMS:
    col = np.array(col, float)
    for y in range(int(RCY + R * 0.6), h2):
        t = (y - (RCY + R * 0.6)) / (h2 - RCY - R * 0.6)
        cx = RCX + slope * R * 0.55 + slope * 30 * t
        half = 5 + 7 * t
        for x in range(int(cx - half), int(cx + half) + 1):
            if 0 <= x < w2:
                e = 1 - abs(x + .5 - cx) / half
                a = 0.16 * e * (1 - 0.4 * t)
                if a > BAY[y % 4, x % 4] * 0.35:
                    bg[y, x, :3] = (bg[y, x, :3] * (1 - 0.22) + col * 0.22).astype(np.uint8)

# ================================================================== Vordergrund 5× (50×70)
w5, h5 = grid(5)
fg = rgba(w5, h5)
FLOOR = 60                                   # Oberkante des Bodens (y 300)
T = np.clip(tile[..., :3].astype(float) * 1.35, 0, 255).astype(np.uint8)   # Parkett, etwas aufgehellt
for y in range(FLOOR, h5):
    for x in range(w5):
        fg[y, x, :3] = T[(y - FLOOR) % 16, (x + 5) % 16]
        fg[y, x, 3] = 255
for x in range(w5):                          # Übergang Wand/Boden: Sockelleiste
    fg[FLOOR, x, :3] = (22, 16, 30)
# Sternenteppich (Ausschnitt aus dem Sternenstoff) als Läufer unter Archibald
RUG = cloth[20:29, 40:70]
rx0 = w5 // 2 - RUG.shape[1] // 2
for j in range(RUG.shape[0]):
    for i in range(RUG.shape[1]):
        X, Y = rx0 + i, FLOOR + 2 + j
        if 0 <= X < w5 and Y < h5 and RUG[j, i, 3]:
            edge = i in (0, RUG.shape[1] - 1)
            fg[Y, X, :3] = (40, 16, 70) if edge else RUG[j, i, :3]
# farbiger Lichtfleck der Rosette auf Parkett und Teppich (zwei Stufen, gedithert)
for y in range(FLOOR + 1, h5):
    for x in range(w5):
        d = math.hypot((x + .5 - 25) / 22, (y + .5 - (FLOOR + 5)) / 6)
        if d < 1:
            seg = int(((math.atan2(y - FLOOR - 5, x - 25) + math.pi) / (2 * math.pi)) * 5) % 5
            col = np.array(BEAMS[seg][0], float)
            q = 0.22 if d < 0.6 else 0.12
            if BAY[y % 4, x % 4] < 0.8:
                fg[y, x, :3] = (fg[y, x, :3] * (1 - q) + col * q).astype(np.uint8)
ah, aw = arch.shape[:2]
AX = w5 // 2 - aw // 2
AFEET = FLOOR + 4                            # steht auf dem Teppich (y 320–325)
for x in range(AX + 5, AX + aw - 3):
    setp(fg, x, AFEET, (26, 10, 44))         # Kontaktschatten
put(fg, arch, AX, AFEET - ah)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 5)
print(save(cv, '43_wheel_of_wisdom.png'))
