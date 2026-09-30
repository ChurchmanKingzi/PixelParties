# -*- coding: utf-8 -*-
"""29 Knock at the Window – Gegner „Morph and Kill!“ (sample-Structure Deck Morph and Kill),
Held: Waflav, the Metamorphing Monstrosity.

Idee (Blick durch Fenster, Grusel-Ruhemoment): Nachts, von innen aus der Blockhütte „Cottage at the Forest's Edge“
(Deckkarte) durch das Fenster hinaus: Draußen schwebt Waflav, das Wald-Ungeheuer seiner Base-Karte, riesig und
dicht vor der Scheibe, seine flammenfarbenen Flügel glühen und werfen orangefarbenes Licht in die dunklen Bäume.
Drinnen brennt eine einzelne Kerze auf dem Fensterbrett, ihr Schein und das Glühen von draußen liegen auf den
Balken der Hüttenwand (Morph and Kill: das Monster jagt – jedes besiegte Ziel ist ein Evolution Counter).

Quellen (MotiveGrailWar.xcf):
  Ebene 423 „Waflav“ – Base-Karte „Waflav, the Metamorphing Monstrosity“, Kartenszene Sichtbar (Ebene 58,
      Kartenausschnitt Lage 36,129; einzige Heldenebene im Kartenausschnitt). NICHT 420 „WAFLAV-Kopie“ (Kostüm).
      Die zwei feinen Ringe (421) und Staubschwaden (422) der Kartenszene sind Umgebungs-/Zieleffekte und
      bleiben weg (s. Notizen).
  Ebene 596 „Cottage“ – Blockhütte der Karte „Cottage at the Forest's Edge“: Balkenwand ohne Efeu (x 200–232, y 105–113, kachelbar)
      als Wandtextur, Farben des Hüttenfensters für den Fensterrahmen, der umgebende Wald (x 96–181, y 150–262)
      stark abgedunkelt als Waldboden unter dem Waldrand.
  Ebene 159 „Ebene #423“ – Kerze aus dem Ritualkreis (wie in Runde 5 „Vials on the Vine“).
Selbst gezeichnet: Nachthimmel mit Sternen und fahlem Mond, Waldrand-Silhouette aus runden Baumkronen,
Fensterrahmen und Fensterbrett (in den Hüttenfenster-Farben), Licht der Kerze und der Flügel.

Skalierung:
  Hintergrund (Himmel, Mond, Waldrand, Wald, Flügelschein)                     – 2× (Raster 125×175)
  Vordergrund (Waflav 28×28 → 140×140, Hüttenwand, Fensterrahmen, Kerze)       – 5× (Raster 50×70)
  (Waflav und Fensterrahmen haben dieselbe Pixelgröße; der Rahmen liegt vor ihm.)
"""
import math, random
import numpy as np
from ekit_25_30 import *  # noqa

rnd = random.Random(29)
GW = 'MotiveGrailWar'
waflav = sprite('o29_waflav', GW, [423])                                  # 28×28
cab = layer(GW, 596)
logs = cab[105:113, 200:232].copy()                                     # Balkenwand (zwei Kacheln à 16, Balkenhöhe 8)
forest = cab[150:262, 96:181].copy()                                    # Wald um die Hütte 85×112
candle = compose(GW, [159], crop=False)[91:139, 271:319][3:14, 14:18].copy()
FR = [(57, 28, 8), (107, 65, 33), (140, 93, 49), (173, 125, 66), (198, 158, 99), (239, 203, 140)]

# Fensteröffnung im 5×-Raster (Canvas x 40–210, y 45–250)
WX0, WX1, WY0, WY1 = 8, 42, 9, 50

# ================================================================ 2×: Nacht vor dem Fenster
bw, bh = grid(2)
bg = rgba(bw, bh, (4, 8, 12))
vgrad(bg, 0, 0, bw, 100, [(6, 8, 22), (10, 14, 32), (16, 22, 44), (26, 36, 62), (40, 52, 80)])
for _ in range(14):                                  # Sterne
    setp(bg, rnd.randrange(20, 106), rnd.randrange(22, 70), (170, 180, 210))
# fahler Mond oben links in der Scheibe
MX, MY, MR = 30, 30, 7
glow(bg, MX, MY, 16, 16, (120, 130, 160), .3)
for y in range(MY - MR, MY + MR + 1):
    for x in range(MX - MR, MX + MR + 1):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d <= MR:
            sh = math.hypot(x + .5 - (MX + 3), y + .5 - (MY + 2)) > MR - 1
            setp(bg, x, y, (236, 232, 204) if not sh else (196, 196, 178))
# Waldrand: Silhouette aus runden Baumkronen (dunkel, Mondlicht-Saum), darunter Wald der Hüttenkarte (nachtdunkel)
fo = forest.copy(); fo[..., 3] = 255
put(bg, darken_rgba(fo, .22, (4, 10, 16)), 18, 96)
crowns = [(18, 84, 9), (30, 80, 8), (44, 86, 10), (58, 82, 8), (70, 88, 9), (84, 81, 10), (98, 86, 8), (110, 82, 9)]
for x in range(bw):
    for y in range(60, 110):
        inside = any(math.hypot(x + .5 - cx, (y + .5 - cy) * 1.15) <= r for cx, cy, r in crowns) or y >= 92
        if inside:
            above = not any(math.hypot(x + .5 - cx, (y - .5 - cy) * 1.15) <= r for cx, cy, r in crowns) and y < 92
            setp(bg, x, y, (34, 50, 58) if above else ((12, 22, 24) if bay(x, y) < .6 else (16, 28, 30)))
# Glühen der Flügel auf den Baumkronen
for gx in (40, 85):
    glow(bg, gx, 80, 22, 26, (230, 120, 40), .4)

# ================================================================ 5×: Waflav, Hütte, Fenster
fw, fh = grid(5)                       # 50×70
fg = rgba(fw, fh)
# Waflav mittig in der Öffnung
put(fg, waflav, (WX0 + WX1) // 2 - 14, 15)
wall = rgba(fw, fh)
for y in range(fh):
    for x in range(fw):
        wall[y, x] = logs[(y + 1) % logs.shape[0], (x + 5) % logs.shape[1]]
        wall[y, x, 3] = 255
wall[WY0:WY1, WX0:WX1] = 0
# Fensterrahmen (2 Pixel, Hüttenfenster-Farben), Fensterbrett
for y in range(WY0 - 2, WY1 + 1):
    for x in range(WX0 - 2, WX1 + 2):
        if WX0 <= x < WX1 and WY0 <= y < WY1:
            continue
        if y >= WY1: continue
        inner = (x in (WX0 - 1, WX1)) or (y == WY0 - 1)
        c = FR[3] if inner else FR[4]
        if x == WX0 - 2 or y == WY0 - 2: c = FR[5]
        if x == WX1 + 1: c = FR[2]
        setp(wall, x, y, c)
SY = WY1                                   # Fensterbrett: 3 Zeilen, seitlich überstehend
for x in range(WX0 - 4, WX1 + 4):
    setp(wall, x, SY, FR[5]); setp(wall, x, SY + 1, FR[3]); setp(wall, x, SY + 2, FR[1])
    setp(wall, x, SY + 3, FR[0])
for x in range(WX0 - 4, WX1 + 4):          # Schattenkante unter dem Brett
    if bay(x, SY + 4) < .5: setp(wall, x, SY + 4, (30, 16, 6))
# Wand im Dunkeln: abdunkeln, dann Kerzenschein (links am Brett) und Flügelglühen an der Laibung
L = wall[..., :3].astype(float)
for y in range(fh):
    for x in range(fw):
        if wall[y, x, 3] == 0: continue
        f = .42
        dc = math.hypot((x + .5 - 10) / 14, (y + .5 - 48) / 11)
        k = math.floor(max(0, 1 - dc) ** 1.2 * 4 + bay(x, y)) / 4
        f += .75 * k
        do = min(abs(x + .5 - WX0), abs(x + .5 - WX1), abs(y + .5 - WY0)) if y < WY1 else 99
        ko = math.floor(max(0, 1 - do / 3) * 2 + bay(x, y)) / 2
        col = L[y, x] * f + np.array([60, 26, 0]) * ko * .5
        wall[y, x, :3] = col.clip(0, 255)
# Kerze auf dem Brett (links), Flammenschein
put(wall, candle, 8, SY - candle.shape[0])

print(finish([(bg, 2), (fg, 5), (wall, 5)], '29_knock_at_the_window.png'))
