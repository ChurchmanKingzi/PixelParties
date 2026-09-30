# -*- coding: utf-8 -*-
"""36 Blackport Nightfall – Gegner „Shadows over Blackport“, Held: Arthor, the King of Blackport.

Mondnacht vor dem Torhaus der Burg Blackport. Der alte König Arthor (Base: weißer Bart, dunkler Rock) steht groß
auf dem Pflaster vor seinem Tor; hinter ihm ragen die zwei Rundtürme und die Brüstung des Balkons (auf dem er auf
seiner Karte sitzt) als dunkle Silhouette in den hellen Mondhimmel. Am linken Turm hängt das violette Chevron-Banner
von Blackport, am rechten Turm – wie auf seiner Karte an der Burgmauer – das Legendary Sword of a Barbarian King,
das Arthor zum „Inheritor of the Barbarian Sword“ (Cover-Karte) macht. Die einzige Bedrohung kommt von hinten
links: ein Tentakel der Spawn Mother schiebt sich hinter dem linken Turm in den Mondschein.

Quellen (Motive.xcf):
  Ebene 951 „Arthor-Kopie“ – Base-Arthor (Karte „Arthor, the King of Blackport“ = Sichtbar #294, Ebene 103,
  Lage 247,169; Oberkörper pixelgleich, auf der Karte sitzt er hinter der Balkonbrüstung). Hier die ganze stehende
  Figur aus 951 (nur Arthor, x262–292/y183–214), keine Ascended-Version (910).
  Ebene 103 „Sichtbar #294“ – Torhaus der Karte (Ausschnitt x222–347/y150–325): alles oberhalb der Turmkronen und
  der Balkonbrüstung durch Himmel ersetzt; die drei Balkonfiguren (Masken 948/951/949) mit Nachbarsteinen übermalt;
  das Banner (x280–293/y219–237) an den linken Turm versetzt.
  Ebene 911 „Legendary Sword“ – Karte „Legendary Sword of a Barbarian King“ (waagrecht an der Wand wie dort).
MotiveIndia.xcf: Ebene 399 „Ebene #60“ – nur der Tentakel oben links (x328–364/y312–335), Tentakel der Karte
  „The Spawn Mother“ (Sichtbar Ebene 3, Lage 328,317); das ausgeblendete Ende verschwindet hinter dem Turm.
Selbst gezeichnet: Himmel, Mond, Sterne, Zinnen auf den Turmkronen (Farben der Brüstungssteine), Mondlicht auf der
Fassade, Schatten.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Mond, Torhaus, Banner, Schwert, Tentakel) – 2× (125×175)
  Vordergrund (Arthor 14×25 → 84×150 px, Schatten)               – 6× (42×59, um 1 px versetzt)
"""
import math, random
import numpy as np
import cv2
from gkit36_40 import *  # noqa

rnd = random.Random(36)
W2, H2 = 125, 175
CX0, CY0 = 222, 150                   # Ausschnitt aus Ebene 103 (Torhaus)
SHIFT = 30                            # Torhaus im Raster um 30 Zeilen nach unten → Himmel darüber

# ------------------------------------------------------------------ Torhaus vorbereiten (Figuren entfernen)
full = layer('Motive', 103).copy()
mask = np.zeros(full.shape[:2], np.uint8)
for i in (948, 951, 949):
    mask |= (layer('Motive', i)[..., 3] > 0).astype(np.uint8)
mask = cv2.dilate(mask, np.ones((3, 3), np.uint8)) > 0
mask[:, :250] = False; mask[:, 320:] = False; mask[:160] = False; mask[218:] = False
for y, x in zip(*np.nonzero(mask)):
    for dx in (16, -16, 32, -32):
        if not mask[y, x + dx]: full[y, x] = full[y, x + dx]; break
# Banner über dem Tor → an den linken Turm; an seine alte Stelle Mauer aus 16 px Entfernung
banner = full[219:238, 280:294].copy()
brgb = banner[..., :3].astype(int)
banner[..., 3] = np.where(((brgb[..., 0] > brgb[..., 1] + 25) | (brgb[..., 0] > 150)), 255, 0).astype(np.uint8)
for y in range(219, 238):
    for x in range(280, 294):
        if banner[y - 219, x - 280, 3]: full[y, x] = full[y, x - 16]
gate = full[CY0:CY0 + H2 - SHIFT, CX0:CX0 + W2].copy()
gate[..., 3] = 255

# Silhouette: Himmel über den Turmkronen (Türme x229–261 / x309–341, Krone y178), über der Brüstung (y203) und
# über der Außenmauer (y206)
TOWERS = [(229 - CX0, 262 - CX0), (309 - CX0, 342 - CX0)]


def top_of(x):
    X = x + CX0
    if 229 <= X < 262 or 309 <= X < 342: return 178 - CY0
    if 262 <= X < 309: return 203 - CY0
    return 206 - CY0


for x in range(W2):
    gate[:top_of(x), x, 3] = 0

# ------------------------------------------------------------------ Himmel 2×
bg = Plane(W2, H2, 2)
TOP, BOT = (10, 14, 40), (70, 92, 150)
HOR = SHIFT + 60
for y in range(H2):
    t = min(1.0, y / HOR)
    for x in range(W2):
        bg.a[y, x, :3] = mix(TOP, BOT, dith(t, x, y, 6)); bg.a[y, x, 3] = 255
# Mond oben rechts mit Hof
MX, MY, MR = 92, 26, 12
for y in range(H2):
    for x in range(W2):
        d = math.hypot(x + 0.5 - MX, y + 0.5 - MY)
        if d < MR:
            c = (236, 236, 214)
            if math.hypot(x + 0.5 - MX - 4, y + 0.5 - MY + 3) < 3 or math.hypot(x + 0.5 - MX + 3, y + 0.5 - MY - 4) < 2:
                c = (210, 212, 196)                          # zwei flache Krater
            bg.a[y, x, :3] = c
        elif d < MR + 14:
            q = dith(0.45 * (1 - (d - MR) / 14) ** 1.5, x, y, 4)
            if q > 0: bg.blend(x, y, (150, 172, 214), q)
# Sterne
for _ in range(34):
    x, y = rnd.randrange(3, W2 - 3), rnd.randrange(2, HOR - 12)
    if math.hypot(x - MX, y - MY) > MR + 10: bg.a[y, x, :3] = (200, 206, 230) if rnd.random() < 0.6 else (130, 140, 190)

# Tentakel der Spawn Mother hinter dem linken Turm (2×, gleiche Ebene wie das Torhaus)
T = layer('MotiveIndia', 399)[312:336, 328:365].copy()
sprite('o36_tentacle', 'MotiveIndia', [399], box=(328, 312, 365, 336))
T = flip(T)                                                   # Spitze nach links, Wurzel rechts hinter dem Turm
TX, TY = 2, SHIFT + (178 - CY0) - 22
for y in range(T.shape[0]):
    for x in range(T.shape[1]):
        a = T[y, x, 3] / 255.0
        if a <= 0: continue
        c = np.array(T[y, x, :3], float) * np.array((0.78, 0.74, 0.92))
        q = dith(min(1.0, a * 1.15), TX + x, TY + y, 4)
        if q > 0: bg.blend(TX + x, TY + y, tuple(c), q)

# Torhaus nachts: dunkel, kühl, Mondlicht von rechts oben hellt rechte Turmhälften leicht auf
g = gate.astype(float)
for y in range(g.shape[0]):
    for x in range(W2):
        if gate[y, x, 3] == 0: continue
        c = g[y, x, :3]
        sat = c.max() - c.min()
        k = np.array((0.50, 0.54, 0.74)) if sat < 60 else np.array((0.62, 0.55, 0.78))
        lit = 0.0
        for (a0, a1) in TOWERS:
            if a0 <= x < a1: lit = 0.25 * max(0.0, (x - a0) / (a1 - a0) - 0.35)
        L = 1.0 + lit - 0.35 * (y / g.shape[0])
        g[y, x, :3] = np.clip(c * k * L + np.array((4, 6, 18)), 0, 255)
gate[..., :3] = g[..., :3].astype(np.uint8)
bg.paste(gate, 0, SHIFT)

# Zinnen auf den Turmkronen (Merlons 3 breit, 3 hoch, Lücke 2; Steinfarben der Brüstung, nachts)
MER_D, MER_L = (40, 42, 62), (78, 82, 108)
for (a0, a1) in TOWERS:
    y0 = SHIFT + (178 - CY0)
    x = a0
    while x + 3 <= a1:
        for dx in range(3):
            for dy in range(1, 4):
                bg.a[y0 - dy, x + dx, :3] = MER_L if (dy == 3 or dx == 2) else MER_D
        x += 5
# Kante der Brüstung und Außenmauer mit hellem Mondsaum
for x in range(W2):
    y = SHIFT + top_of(x)
    if 0 <= y < H2: bg.a[y, x, :3] = mix(tuple(bg.a[y, x, :3]), (120, 130, 170), 0.5)

# Banner am linken Turm, Schwert am rechten Turm
b_ = banner.copy(); b_[..., :3] = np.clip(b_[..., :3].astype(float) * np.array((0.75, 0.7, 0.9)), 0, 255)
bg.paste(b_, (TOWERS[0][0] + TOWERS[0][1]) // 2 - b_.shape[1] // 2, SHIFT + (186 - CY0))
sw = sprite('o36_sword', 'Motive', [911])
sw2 = sw.copy(); sw2[..., :3] = np.clip(sw2[..., :3].astype(float) * np.array((0.85, 0.85, 0.98)), 0, 255)
SWX = (TOWERS[1][0] + TOWERS[1][1]) // 2 - sw.shape[1] // 2
bg.paste(sw2, SWX, SHIFT + (192 - CY0))

# ================================================================== Vordergrund 6× (42×59)
W6, H6 = 42, 59
fg = Plane(W6, H6, 6, ox=-1)
art = sprite('o36_arthor', 'Motive', [951], box=(262, 183, 292, 214))
ah, aw = art.shape[:2]
FEET = 53
AX, AY = 21 - aw // 2, FEET - ah + 1
for xx in range(-7, 8):
    for yy in (0, 1):
        if (xx / 7.5) ** 2 + ((yy - 0.3) / 1.3) ** 2 <= 1: fg.px(21 + xx - 1, FEET + yy, (6, 6, 16), 160)
fg.paste(art, AX, AY)

cv = compose_planes([bg, fg])
save(cv, '36_blackport_nightfall.png')
print('ok', art.shape, 'gate bottom row (canvas):', 2 * (SHIFT + 287 - CY0), 'feet:', 6 * (FEET + 1))
