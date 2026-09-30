# -*- coding: utf-8 -*-
"""36 Blackport Nightfall – Gegner „Shadows over Blackport“, Held: Arthor, the King of Blackport.

Nacht vor dem Tor der Burg Blackport. Der alte König Arthor (Base: weißer Bart, dunkler Rock) steht groß und ruhig
vor seinem Burgtor; hinter und über ihm ragt die dunkle Fassade seiner Karte mit den zwei Rundtürmen, den violetten
Chevron-Bannern und dem Balkon, auf dem er auf seiner Karte sitzt. Heute Nacht ist der Balkon leer und die Öffnung
dahinter ganz schwarz: Aus diesem Schatten kriechen zwei Tentakel der Spawn Mother über den Balkon, rote Augenringe
glimmen im Dunkel – „Shadows over Blackport“ (Arthors Deck beschwört die Spawn Mother; sein Decay-Zauber lässt den
Gegner Karten abwerfen).

Quellen (Motive.xcf):
  Ebene 951 „Arthor-Kopie“ – Base-Arthor (Karte „Arthor, the King of Blackport“ = Sichtbar #294, Ebene 103,
  Lage 247,169; Oberkörper pixelgleich, auf der Karte sitzt er hinter der Balkonbrüstung 950 mit den Stiefeln 949).
  Hier die ganze stehende Figur aus 951 (nur Arthor, x265–289/y186–212), keine Ascended-Version (910).
  Ebene 103 „Sichtbar #294“ – die Burgfassade der Karte als Hintergrund (Ausschnitt x222–347/y115–290), nachts
  umgefärbt; die drei Figuren der Karte auf dem Balkon (Ebenen 948/951/949 als Masken) mit der Pflasterkachel
  des Balkons übermalt – Arthors Platz ist leer.
MotiveIndia.xcf: Ebene 399 „Ebene #60“ – nur der Tentakel oben links (x328–364/y312–335) = der Tentakel der Karte
  „The Spawn Mother“ (Sichtbar Ebene 3, Lage 328,317), zweimal (einmal gespiegelt); die ausgeblendeten Enden
  tauchen ins Dunkel.
Selbst gezeichnet: Nachtfärbung mit Mondlicht von links oben, schwarze Nische, rote Augenringe (wie auf der
Spawn-Mother-Karte) mit Schimmer, Schatten.

Skalierung (Tiefenebenen):
  Hintergrund (Burgfassade, Tor, Banner, Weg, Nische, Augen, Tentakel) – 2× (125×175)
  Vordergrund (Arthor 14×25 → 84×150 px, Schatten)                   – 6× (42×59, um 1 px versetzt)
"""
import math
import numpy as np
from gkit36_40 import *  # noqa

# ================================================================== Hintergrund 2× (125×175)
W2, H2 = 125, 175
CX0, CY0 = 222, 115
bg = Plane(W2, H2, 2)
# Die drei Figuren der Karte vom Balkon entfernen (Masken aus ihren Ebenen 948, 951, 949) und den Boden mit der
# Pflasterkachel zwischen ihnen (x278–294/y171–187, 16×16) phasengleich auffüllen – der Balkon ist leer.
import cv2
full = layer('Motive', 103).copy()
mask = np.zeros(full.shape[:2], np.uint8)
for i in (948, 951, 949):
    mask |= (layer('Motive', i)[..., 3] > 0).astype(np.uint8)
mask = cv2.dilate(mask, np.ones((3, 3), np.uint8)) > 0
mask[:, :250] = False; mask[:, 320:] = False; mask[:165] = False; mask[216:] = False
tile = full[171:187, 278:294].copy()
ys, xs = np.nonzero(mask)
for y, x in zip(ys, xs):
    if y < 203: full[y, x] = tile[(y - 171) % 16, (x - 278) % 16]
    else: full[y, x] = full[y, x - 16] if not mask[y, x - 16] else full[y, x - 32]   # Brüstungsstein
sc = full[CY0:CY0 + H2, CX0:CX0 + W2].copy()
bg.a[:] = sc
bg.a[..., 3] = 255

# Nachtfärbung: Helligkeit gedämpft, ins Blaue verschoben; Banner behalten etwas Farbe
NIGHT = np.array((0.74, 0.77, 0.98))
for y in range(H2):
    for x in range(W2):
        c = bg.a[y, x, :3].astype(float)
        sat = c.max() - c.min()
        k = NIGHT if sat < 60 else np.array((0.70, 0.62, 0.85))
        L = 1.15 - 0.35 * (x / W2) - 0.50 * (y / H2)             # Mondlicht von links oben
        c = 255 * (c / 255) ** 0.8 * k * L + np.array((6, 8, 22))        # etwas angehoben, damit die Türme lesbar bleiben
        bg.a[y, x, :3] = np.clip(c, 0, 255)

# schwarze Öffnung hinter dem Balkon (Original x262–309/y139–171 → Raster)
NX0, NX1, NY0, NY1 = 262 - CX0, 309 - CX0, 139 - CY0, 171 - CY0     # nur die Öffnung über dem Balkon
for y in range(NY0, NY1):
    for x in range(NX0, NX1):
        d = min(y - NY0, NY1 - 1 - y, x - NX0, NX1 - 1 - x)
        base = np.array((4, 4, 12))
        # innen ein kaum sichtbarer violetter Dunst, nach unten (zur Brüstung) etwas heller
        v = 0.18 * max(0.0, (y - NY0) / (NY1 - NY0)) ** 1.5
        inner = tuple(int(b) for b in base) if dith(v, x, y, 4) == 0 else (22, 12, 34)
        if d < 3:                                   # Rand: gerasterter Übergang in die Fassade
            q = dith(0.35 + 0.22 * d, x, y, 4)
            bg.blend(x, y, tuple(base), q)
        else:
            bg.a[y, x, :3] = inner

# rote Augenringe im Dunkel (Stil der Spawn-Mother-Karte: dunkelroter Ring, heller Glanz oben links)
RING, GLINT = (150, 18, 30), (224, 70, 70)
EYE = ['.RR.',
       'R..R',
       'R..R',
       '.RR.']
EYES = [(46, 30), (54, 30), (73, 36), (81, 36)]                            # linke obere Ecke je Auge
for ex, ey in EYES:
    for j, row in enumerate(EYE):
        for i, ch in enumerate(row):
            if ch == 'R': bg.a[ey + j, ex + i, :3] = RING
    bg.a[ey, ex + 1, :3] = GLINT

# Tentakel der Spawn Mother: aus dem Dunkel links über die Brüstung, Spitze nach unten gekrümmt
T = layer('MotiveIndia', 399)[312:336, 328:365].copy()
sprite('o36_tentacle', 'MotiveIndia', [399], box=(328, 312, 365, 336))
# zwei Tentakel (Original + Spiegelbild): Wurzeln nebeneinander im Dunkel, Spitzen hängen links und rechts über
# den Balkon – die Spawn Mother streckt sich aus ihrem Versteck
TY = NY1 - 17
for T_, TX in ((T, 60), (flip(T), 65 - T.shape[1])):
    for y in range(T_.shape[0]):
        for x in range(T_.shape[1]):
            a = T_[y, x, 3] / 255.0
            if a <= 0: continue
            c = np.array(T_[y, x, :3], float) * np.array((0.92, 0.86, 1.0))       # nächtlich abgetönt
            q = dith(min(1.0, a * 1.15), TX + x, TY + y, 4)                      # ausgeblendetes Ende → Raster
            if q > 0: bg.blend(TX + x, TY + y, tuple(c), q)
# schwacher roter Schimmer um die Augenpaare
for ex, ey in EYES[::2]:
    cx, cy = ex + 5.5, ey + 2
    for y in range(int(cy - 6), int(cy + 7)):
        for x in range(int(cx - 10), int(cx + 11)):
            d = math.hypot((x + 0.5 - cx) / 1.7, y + 0.5 - cy)
            v = 0.35 * max(0.0, 1 - d / 6)
            q = dith(v, x, y, 4)
            if q > 0 and tuple(bg.a[y, x, :3]) not in (RING, GLINT): bg.blend(x, y, (90, 8, 20), q)

# leichte Vignette (Nacht)
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - 62.5) / 62.5, (y + 0.5 - 100) / 100)
        q = dith(0.5 * max(0.0, d - 0.75) / 0.5, x, y, 4)
        if q > 0: bg.blend(x, y, (2, 2, 8), q)

# ================================================================== Vordergrund 6× (42×59)
W6, H6 = 42, 59
fg = Plane(W6, H6, 6, ox=-1)
art = sprite('o36_arthor', 'Motive', [951], box=(262, 183, 292, 214))
ah, aw = art.shape[:2]
FEET = 53
AX, AY = 21 - aw // 2, FEET - ah + 1
# Schatten auf dem Weg
for xx in range(-7, 8):
    for yy in (0, 1):
        if (xx / 7.5) ** 2 + ((yy - 0.3) / 1.3) ** 2 <= 1: fg.px(21 + xx, FEET + yy, (8, 8, 20), 150)
fg.paste(art, AX, AY)

cv = compose_planes([bg, fg])
save(cv, '36_blackport_nightfall.png')
print('ok', art.shape)
