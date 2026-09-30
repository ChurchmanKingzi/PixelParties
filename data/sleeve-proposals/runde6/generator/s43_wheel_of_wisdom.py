# -*- coding: utf-8 -*-
"""43 Wheel of Wisdom – Gegner „To Attain Divinity“ (Structure Deck), Held: Archibald, the Archmage.

Neues Motiv (Nutzer-Feedback: aus den Elementen seiner eigenen Karte gebaut): Archibald steht in seiner
dämmrigen Halle vor der großen Glasrosette seiner Base-Karte. Die fünf farbigen Felder zeigen – wie auf der Karte –
die fünf Gestalten des Kartenmotivs (Schattengestalt mit rotem Auge, rothaarige Kämpferin, braunhaarige Schützin,
Mann mit Hut und Pelzkragen, Hexe mit Spitzhut). Das Licht fällt bunt durch die Rosette auf den
Parkettboden der Halle, auf dem der Erzmagier mit Stab und violetten Funkelsternen steht.

Quellen (alle Motive.xcf, Szene der Karte „Archibald, the Archmage“ = Sichtbar #43, Ebene 98, Lage 247,117):
  Ebene 436 „ARCHMAGE“ + 435 „Archmage #9“ (Archibald mit Funkelsternen; Komposit pixelgleich mit der Szene,
            354 deckende Pixel, 0 Abweichungen). NICHT Ebene 434 „Gandalf“ (graue Variante).
  Ebene 441 „Archmage #3“ (farbige Glasfelder), 440 „Archmage #4“ (Bleiruten-Netz), 444 „Archmage“ (Ring),
            439 „Archmage #1“ (Ring mit fünf Speichen) – die Rosette.
  Ebene 438 „Archmage #6“ – die fünf Gestalten, die auf der Karte (vergrößert, halbtransparent) in den fünf
            Feldern erscheinen; hier im Raster der Rosette, zu 85 % über das Glas gemalt.
  Sichtbar #43 (Ebene 98), Ausschnitt x 240–256, y 184–200: Parkettkachel der Halle (16×16, periodisch).
Selbst gezeichnet: Mauer der Halle, steinerne Fensterlaibung, Lichtschein, farbiger Lichtfleck am Boden,
Hinterleuchtung der Glasfelder, Kontaktschatten.

Skalierung (Tiefenebenen):
  Hintergrund (Mauer, Rosette 76×76 → 152×152, fünf Gestalten, Lichtschein)    – 2×-Raster (125×175)
  Vordergrund (Archibald 25×31 → 125×155, Parkett, Lichtfleck)                 – 5×-Raster (50×70)
"""
import math
import numpy as np
from kitH import *  # noqa

BM = 'Motive'
arch = sprite('o43_archibald', BM, [435, 436])                       # 25×31 inkl. Funkeln
ros_box = (246, 106, 322, 182)
glass = raw_cached('o43_glass', BM, 441, ros_box)                   # Farbfelder (Ausschnitte deckungsgleich)
net = raw_cached('o43_mesh440', BM, 440, ros_box)                    # Bleiruten-Netz
frame_lines = np.zeros_like(glass)
for i in (439, 444):                                                 # Ring mit fünf Speichen, äußerer Ring
    part = raw_cached('o43_mesh%d' % i, BM, i, ros_box)
    m = part[..., 3] >= 128
    frame_lines[m] = part[m]
# Die fünf Gestalten (Ebene 438), einzeln ausgeschnitten: (Schlüssel, Box in Leinwandkoordinaten)
FIG_BOX = {'shadow': (259, 112, 281, 138), 'red': (286, 112, 309, 138), 'girl': (247, 138, 273, 165),
           'hat': (295, 139, 320, 167), 'witch': (274, 150, 294, 181)}
figs = {k: sprite('o43_fig_' + k, BM, [438], box=b) for k, b in FIG_BOX.items()}
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
put(bg, net, GX, GY)                         # Bleiruten-Netz unter den Bildern
# Die fünf Gestalten mittig in ihren Feldern (Anordnung wie auf der Karte), zu 85 % über das Glas gemalt
FIG_CEN = {'shadow': (-15, -18), 'red': (14, -18), 'girl': (-22, 6), 'hat': (20, 5), 'witch': (-1, 21)}
for k, (dx, dy) in FIG_CEN.items():
    f = figs[k]
    fx, fy = int(round(RCX + dx - f.shape[1] / 2)), int(round(RCY + dy - f.shape[0] / 2))
    for j in range(f.shape[0]):
        for i in range(f.shape[1]):
            if f[j, i, 3]:
                X, Y = fx + i, fy + j
                if math.hypot(X + .5 - RCX, Y + .5 - RCY) < R - 1.5:
                    c = np.clip(f[j, i, :3].astype(float) * 1.15 + 14, 0, 255)
                    bg[Y, X, :3] = (bg[Y, X, :3] * 0.15 + c * 0.85).astype(np.uint8)
put(bg, frame_lines, GX, GY)                 # Speichen und Ring obenauf
dark_vignette(bg, strength=0.55, r0=0.3, cx=RCX, cy=RCY + 20)

# Farben der fünf Felder (für den Lichtfleck am Boden)
BEAMS = [((200, 200, 210), 0), ((230, 120, 60), 0), ((220, 70, 50), 0), ((70, 110, 200), 0), ((110, 200, 150), 0)]
# weicher Lichtschein des Glases auf der Wand darunter
glow(bg, RCX, RCY + R + 6, 34, (150, 120, 190), 0.25, ry=14, steps=2)

# ================================================================== Vordergrund 5× (50×70)
w5, h5 = grid(5)
fg = rgba(w5, h5)
FLOOR = 60                                   # Oberkante des Bodens (y 300)
T = np.clip(tile[..., :3].astype(float) * 0.85, 0, 255).astype(np.uint8)   # Parkett, im Dämmer der Halle
for y in range(FLOOR, h5):
    for x in range(w5):
        fg[y, x, :3] = T[(y - FLOOR) % 16, (x + 5) % 16]
        fg[y, x, 3] = 255
for x in range(w5):                          # Übergang Wand/Boden: Sockelleiste
    fg[FLOOR, x, :3] = (22, 16, 30)
# farbiger Lichtfleck der Rosette auf Parkett und Teppich (zwei Stufen, gedithert)
for y in range(FLOOR + 1, h5):
    for x in range(w5):
        d = math.hypot((x + .5 - 25) / 22, (y + .5 - (FLOOR + 5)) / 6)
        if d < 1:
            seg = int(((math.atan2(y - FLOOR - 5, x - 25) + math.pi) / (2 * math.pi)) * 5) % 5
            col = np.array(BEAMS[seg][0], float)
            q = 0.30 if d < 0.6 else 0.16
            if BAY[y % 4, x % 4] < 0.8:
                fg[y, x, :3] = (fg[y, x, :3] * (1 - q) + col * q).astype(np.uint8)
ah, aw = arch.shape[:2]
AX = w5 // 2 - aw // 2
AFEET = FLOOR + 4                            # steht auf dem Parkett (y 320–325)
for x in range(AX + 5, AX + aw - 3):
    setp(fg, x, AFEET, (26, 10, 44))         # Kontaktschatten
put(fg, arch, AX, AFEET - ah)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 5)
print(save(cv, '43_wheel_of_wisdom.png'))
