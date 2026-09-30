# -*- coding: utf-8 -*-
"""28 Specimen Wing – Gegner „Mawstruck“ (sample-Structure Deck Mawstruck), Held: Nero Zira, the Mastermind.

Idee (Schaukasten/Labor): Nero Zira hängt – wie auf seiner Base-Karte – an seinen Kabeln mit erhobenen Händen
mitten in seinem Labor, direkt vor dem großen, stahlgerahmten Aquariumfenster der Laborwand (seine Hände
ragen vor den Rahmen). Hinter ihm schwimmen die
Greatmaws seines Decks: unten die Cover-Kreatur Infected Greatmaw, links unter seinem Arm ein Greatmaw Shark,
rechts ein Greatmaw Remora mit seinen angesaugten Kleinhaien (Kreaturen in seinen Support-Zonen machen ihn
stärker). Seine Kabel laufen vor der Wand hinauf in die Decke; blaues Wasserlicht fällt auf Wand und Laborboden.

Quellen:
  MotiveGN.xcf   Ebene 272 „Ebene #313“ = Nero Zira der Base-Karte (Robotergestalt, erhobene Hände, Kabel,
                 Brustplatte). Geprüft gegen die Kartenszene Sichtbar #111 (Ebene 54, Kartenausschnitt Lage 180,200)
                 und das Kartenbild (Graustufen-Korrelation; Karte ist foil-getönt): NICHT 285 „Normal Nero Zira“
                 (Anzug-Mensch) und nicht 287 (Arme waagrecht, Maske).
                 Ebene 559 „Hintergrund“ – Laborfliesen (Periode 16) für Wand (abgedunkelt) und Boden.
  MotiveDeepsea.xcf  Ebene 91 „Infected Greatmaw“ + 90 (rote Adern) – = Kartenszene Sichtbar (Ebene 59, Lage 241,207);
                 Ebene 93 „Greatmaw Shawk“ (Karte Greatmaw Shark, Szene 82); Ebenen 92 + 88 + 87 (Greatmaw Remora,
                 Szene 60: Hai mit zwei angesaugten Kleinhaien und roten Augen).
Selbst gezeichnet: Wasser mit Lichtfahnen, Sandgrund, Blasen, Glasreflexe, Stahlrahmen mit Nieten, Sims,
Wasserlicht auf Wand und Boden (die Kabel enden unter dem oberen Rahmen, keine Verlängerung nötig).

Skalierung:
  Hintergrund (Laborwand, Aquarium, Wasser, alle Greatmaws, Boden)      – 2× (Raster 125×175)
  Vordergrund (Nero Zira 69×67 → 207×201)                               – 3× (Raster 84×117)
"""
import math, random
import numpy as np
from ekit_25_30 import *  # noqa

rnd = random.Random(28)
GN, DS = 'MotiveGN', 'MotiveDeepsea'

# ------------------------------------------------------------------ Sprites
nero = sprite('o28_nero', GN, [272], box=(183, 199, 252, 266))            # 69×67 (ohne Streupixel)
maw = sprite('o28_infected_greatmaw', DS, [91, 90], box=(232, 206, 320, 262))
maw = part_at(maw, 60, 30, dil=2)
shark = sprite('o28_greatmaw_shark', DS, [93], box=(370, 299, 424, 332))
remora = sprite('o28_greatmaw_remora', DS, [92, 88, 87], box=(238, 270, 300, 306))
tile = layer(GN, 559)[256:272, 160:176].copy()                             # Laborfliese 16×16

# ================================================================== 2×-Ebene: Laborwand mit Aquariumfenster
bw, bh = grid(2)                     # 125×175
bg = rgba(bw, bh, (10, 14, 22))
GX0, GX1, GY0, GY1 = 15, 110, 18, 140   # Glasfläche (Raster 2×) = x 30–220, y 36–280
SILL, FLOOR = 140, 147
STEEL = [(18, 20, 26), (34, 37, 45), (58, 61, 70), (92, 95, 104)]

# Wand: Laborfliesen, stark abgedunkelt
for y in range(bh):
    for x in range(bw):
        c = tile[y % 16, (x + 5) % 16, :3].astype(float)
        bg[y, x, :3] = (c * .26 + np.array([6, 10, 18])).clip(0, 255)

# Wasser (dunkles Türkis → Tiefblau), gedithert
vgrad(bg, GX0, GY0, GX1, GY1, [(50, 128, 146), (34, 102, 130), (22, 76, 110), (14, 52, 86), (10, 36, 64)])
# Lichtfahnen von oben (schräg, gestufte Helligkeit)
for x0, wdt, st in ((20, 8, .16), (44, 6, .12), (66, 10, .18), (90, 6, .13)):
    for y in range(GY0, GY1):
        t = (y - GY0) / (GY1 - GY0)
        xs = x0 + int(t * 18)
        for x in range(xs, min(xs + wdt, GX1)):
            if (1 - t) * st * 3 > bay(x, y):
                bg[y, x, :3] = mix(bg[y, x, :3], (150, 220, 230), .22)
# Sandgrund mit Steinen
for y in range(GY1 - 10, GY1):
    for x in range(GX0, GX1):
        top = GY1 - 7 + 2.2 * math.sin(x * .19) + 1.3 * math.sin(x * .47 + 2)
        if y >= top:
            c = [(58, 72, 70), (74, 88, 82), (46, 58, 60)][(0 if bay(x, y) < .5 else 1) if y < top + 2 else 2]
            bg[y, x, :3] = c
for cx, cy, r in ((22, GY1 - 4, 4), (38, GY1 - 3, 3), (90, GY1 - 4, 5), (104, GY1 - 3, 3)):
    for y in range(cy - r, cy + 1):
        for x in range(cx - r - 1, cx + r + 2):
            if ((x - cx) / (r + 1)) ** 2 + ((y - cy) / r) ** 2 <= 1 and GX0 <= x < GX1:
                bg[y, x, :3] = (30, 40, 46) if y > cy - r / 2 or x > cx else (48, 62, 66)

# Greatmaws (2×) nur innerhalb des Glases: Cover-Kreatur unten, Hai links, Remora rechts
tank = rgba(bw, bh)
put(tank, darken_rgba(maw, .92, (10, 40, 70)), 21, 83)
put(tank, darken_rgba(shark, .95, (10, 36, 64)), 16, 68)
put(tank, darken_rgba(remora, .95, (10, 36, 64)), 48, 64)
inside = np.zeros((bh, bw), bool); inside[GY0:GY1, GX0:GX1] = True
tank[~inside] = 0
put(bg, tank, 0, 0)
# Blasen
for _ in range(14):
    x = rnd.randrange(GX0 + 3, GX1 - 3); y = rnd.randrange(GY0 + 4, GY1 - 14)
    setp(bg, x, y, (150, 210, 220)); setp(bg, x + 1, y - 2, (110, 180, 200))
# Glasreflexe (schräge helle Streifen, gedithert)
for x0, wdt in ((GX0 + 2, 3), (GX0 + 7, 1), (GX1 - 12, 2)):
    for y in range(GY0, GY1):
        for x in range(x0 + (y - GY0) // 6, x0 + (y - GY0) // 6 + wdt):
            if GX0 <= x < GX1 and bay(x, y) < .35:
                bg[y, x, :3] = mix(bg[y, x, :3], (210, 240, 245), .45)

# Stahlrahmen um das Glas (3 Pixel, oben/links heller) mit Nieten
for y in range(GY0 - 3, GY1 + 1):
    for x in range(GX0 - 3, GX1 + 3):
        if GX0 <= x < GX1 and GY0 <= y < GY1:
            continue
        d = min(x - (GX0 - 3), (GX1 + 2) - x, y - (GY0 - 3))
        bg[y, x, :3] = STEEL[3] if d == 0 else (STEEL[2] if d == 1 else STEEL[1])
for x in range(GX0 + 4, GX1 - 2, 9):
    setp(bg, x, GY0 - 2, STEEL[3]); setp(bg, x, GY0 - 1, STEEL[0])
for y in range(GY0 + 6, GY1, 12):
    for x in (GX0 - 2, GX1 + 1):
        setp(bg, x, y, STEEL[3]); setp(bg, x, y + 1, STEEL[0])
# Sims unter dem Fenster über die ganze Breite
bg[SILL:FLOOR, :, :3] = STEEL[1]
bg[SILL, :, :3] = STEEL[3]
bg[SILL + 1, :, :3] = STEEL[2]
bg[FLOOR - 1, :, :3] = STEEL[0]
for x in range(4, bw, 10):
    setp(bg, x, SILL + 4, STEEL[3]); setp(bg, x, SILL + 5, STEEL[0])
# Wasserlicht auf der Wand rings um das Fenster
wall = np.ones((bh, bw), bool); wall[GY0 - 3:GY1 + 1, GX0 - 3:GX1 + 3] = False; wall[SILL:] = False
glow(bg, 62.5, 80, 78, 90, (40, 120, 150), .3, mask=wall)

# Laborboden: Fliesen, dunkel, vom Aquarium blau beleuchtet (nach vorn dunkler)
for y in range(FLOOR, bh):
    for x in range(bw):
        c = tile[(y - FLOOR) % 16, (x + 3) % 16, :3].astype(float)
        t = (y - FLOOR) / (bh - FLOOR)
        c = c * (0.5 - 0.28 * t) + np.array([10, 40, 60]) * (1 - t) * .5
        bg[y, x, :3] = c.clip(0, 255)
glow(bg, 62, FLOOR + 1, 64, 14, (90, 190, 210), .3)

# ================================================================== 3×-Ebene: Nero Zira
fw, fh = grid(3)                     # 84×117
fg = rgba(fw, fh)
NX, NY = 7, 4                        # Kabel kommen oben aus der Decke (unter dem Rahmen), Hände vor dem Fensterrahmen
put(fg, nero, NX, NY)
print(finish([(bg, 2), (fg, 3)], '28_specimen_wing.png'))
