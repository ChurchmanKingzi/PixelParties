# -*- coding: utf-8 -*-
"""36 Blackport Nightfall – Gegner „Shadows over Blackport“, Held: Arthor, the King of Blackport.

Nacht vor dem Tor der Burg Blackport. Der alte König Arthor (Base: weißer Bart, dunkler Rock) steht groß und ruhig
vor seinem Burgtor; hinter und über ihm ragt die dunkle Fassade seiner Karte mit den zwei Rundtürmen, den violetten
Chevron-Bannern und dem Balkon, auf dem er auf seiner Karte sitzt. Heute Nacht ist der Balkon leer und die Nische
dahinter ganz schwarz: Aus diesem Schatten kriecht der Tentakel der Spawn Mother über die Brüstung, rote Augenringe
glimmen im Dunkel – „Shadows over Blackport“ (Arthors Deck beschwört die Spawn Mother; sein Decay-Zauber lässt den
Gegner Karten abwerfen).

Quellen (Motive.xcf):
  Ebene 951 „Arthor-Kopie“ – Base-Arthor (Karte „Arthor, the King of Blackport“ = Sichtbar #294, Ebene 103,
  Lage 247,169; Oberkörper pixelgleich, auf der Karte sitzt er hinter der Balkonbrüstung 950 mit den Stiefeln 949).
  Hier die ganze stehende Figur aus 951 (nur Arthor, x265–289/y186–212), keine Ascended-Version (910).
  Ebene 103 „Sichtbar #294“ – die Burgfassade der Karte als Hintergrund (Ausschnitt x222–347/y115–290), nachts
  umgefärbt; die drei Figuren auf dem Balkon liegen in der schwarzen Nische und verschwinden darin.
MotiveIndia.xcf: Ebene 399 „Ebene #60“ – nur der Tentakel oben links (x328–364/y312–335) = der Tentakel der Karte
  „The Spawn Mother“ (Sichtbar Ebene 3, Lage 328,317); sein ausgeblendetes Ende taucht ins Dunkel.
Selbst gezeichnet: Nachtfärbung mit Mondlicht von links oben, schwarze Nische, rote Augenringe (wie auf der
Spawn-Mother-Karte), Schatten.

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
sc = layer('Motive', 103)[CY0:CY0 + H2, CX0:CX0 + W2].copy()
bg = Plane(W2, H2, 2)
bg.a[:] = sc
bg.a[..., 3] = 255

# Nachtfärbung: Helligkeit gedämpft, ins Blaue verschoben; Banner behalten etwas Farbe
NIGHT = np.array((0.64, 0.68, 0.92))
for y in range(H2):
    for x in range(W2):
        c = bg.a[y, x, :3].astype(float)
        sat = c.max() - c.min()
        k = NIGHT if sat < 60 else np.array((0.70, 0.62, 0.85))
        L = 1.12 - 0.30 * (x / W2) - 0.40 * (y / H2)             # Mondlicht von links oben
        c = c * k * L + np.array((6, 8, 22))
        bg.a[y, x, :3] = np.clip(c, 0, 255)

# schwarze Nische: Öffnung + Balkon zwischen den Türmen (Original x252–318/y140–201 → Raster)
NX0, NX1, NY0, NY1 = 252 - CX0, 318 - CX0, 139 - CY0, 202 - CY0
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
EYES = [(43, 33), (51, 33), (77, 41), (85, 41), (60, 53), (68, 53)]      # linke obere Ecke je Auge
for ex, ey in EYES:
    for j, row in enumerate(EYE):
        for i, ch in enumerate(row):
            if ch == 'R': bg.a[ey + j, ex + i, :3] = RING
    bg.a[ey, ex + 1, :3] = GLINT

# Tentakel der Spawn Mother: aus dem Dunkel links über die Brüstung, Spitze nach unten gekrümmt
T = layer('MotiveIndia', 399)[312:336, 328:365].copy()
sprite('o36_tentacle', 'MotiveIndia', [399], box=(328, 312, 365, 336))
TX, TY = NX0 + 1, NY1 - 20                          # Wurzel im Dunkel, Bogen über der Brüstungskante
for y in range(T.shape[0]):
    for x in range(T.shape[1]):
        a = T[y, x, 3] / 255.0
        if a <= 0: continue
        c = np.array(T[y, x, :3], float) * np.array((0.92, 0.86, 1.0))        # nächtlich abgetönt
        q = dith(min(1.0, a * 1.15), TX + x, TY + y, 4)                       # ausgeblendetes Ende → Raster
        if q > 0: bg.blend(TX + x, TY + y, tuple(c), q)

# leichte Vignette (Nacht)
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - 62.5) / 62.5, (y + 0.5 - 100) / 100)
        q = dith(0.6 * max(0.0, d - 0.65) / 0.55, x, y, 4)
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
