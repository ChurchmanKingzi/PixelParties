# -*- coding: utf-8 -*-
"""16 „Rift over Earth“ – Gegner „Depths of the Cosmos“, Held: Argos, the Eye of the Cosmos (Base).

Bildidee (Überarbeitung, klare Achse oben–unten): Argos’ rote Schlitzpupille steht groß und mittig über der Erde, deren
Rund unten ins Bild ragt. Ein schwacher roter Blickkegel fällt aus der Pupille auf den Planeten und färbt dessen
oberen Rand rötlich – das Auge hat die Welt im Visier. Genau zwei Begleiter ziehen mit erkennbarer Bewegung vom Riss
zur Erde: links sinkt ein Life-Searcher mit grünem Suchstrahl auf die Erde herab, rechts schießt ein Analyzer-Sichel-
schiff mit Bewegungsspur abwärts (Argos beschwört „Cosmic Depths“-Kreaturen). Kein reines Riesenauge, keine Reihe
gleicher Schiffe, keine Asteroiden (≠ Close Encounter/Earthrise: keine Invader-Untertasse, kein Mond/Würfel).

Quellen (MotiveBoons.xcf):
  Argos (Base)    = Ebene 38 „Argos“ (23×54; identisch mit 36, Pupillenmitte offen)
  Analyzer        = Ebene 34 (Sichelschiff der Karte „Analyzer from the Cosmic Depths“, Sichtbar #13 Lage 170,293),
                    um 90° gedreht (Flugrichtung nach unten)
  Life-Searcher   = Ebene 22 + Suchstrahl 23 (halbtransparent 45 % auf ganzen 2×-Pixeln), Karte Sichtbar #19
  Erde            = Ebene 80 „Hintergrund“ (Erdkugel, runder Ausschnitt r=50 um 280,325)
Selbst gezeichnet: Allverlauf, Sterne, dunkelroter Schein um das Auge, roter Blickkegel (gedithert), roter
Randschein auf der Erde, Bewegungsspur des Analyzers.

Skalierung (Ausgabe = 250×350-Raster × 3):
  All, Sterne                                        – 1×
  Erde, Blickkegel, Augenschein, Life-Searcher, Strahl, Analyzer + Spur – 2× (125×175)
  Argos                                              – 4× (63×88)
"""
import math, random
from c_util import *  # noqa
import numpy as np

B = 'MotiveBoons'
rnd = random.Random(16)
argos = sprite('o16_argos', B, [38])                                   # 23×54
anal = [p for p in parts(compose(B, [34]), dil=1) if p.shape == (17, 18, 4)][0]   # Analyzer-Sichelschiff (fliegt →)
anal_down = rot90(anal, 3)                                             # Spitze nach unten
search = parts(compose(B, [22]), dil=1)[0]                             # Life-Searcher 19×34
beam = [p for p in parts(compose(B, [23]), dil=1) if p.shape[0] == 29][0]        # grüner Suchstrahl 9×29
earth = disc(layer(B, 80)[..., :3], 280, 325, 50)                      # Erdkugel 100×100

# ---------- 1×: All, Sterne ----------
cv = Canvas(250, 350)
SP = [(4, 4, 22), (6, 8, 34), (10, 12, 48), (14, 18, 64), (18, 24, 78)]
for y in range(350):
    for x in range(250):
        cv.a[y, x] = grad_pick(SP, 0.8 - 0.6 * math.hypot((x - 125) / 250, (y - 150) / 350), x, y)
for _ in range(70):
    x, y = rnd.randrange(250), rnd.randrange(260)
    cv.a[y, x] = rnd.choice([(200, 210, 255), (120, 130, 200), (255, 255, 255)])
for (x, y) in [(40, 40), (212, 70), (30, 190), (222, 214)]:
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)): cv.px(x + dx, y + dy, (170, 190, 255) if (dx or dy) else (255, 255, 255))

# ---------- 2×: Erde, Blickkegel, Begleiter ----------
p2 = rgba(125, 175)
AX4, AY4 = 20, 4                                     # Argos im 4×-Raster (63×88): x80–172, y16–232 im 250er-Raster
ECX, ECY = (AX4 + 11.5) * 2, (AY4 + 27) * 2          # Augenmitte im 2×-Raster
TIP = (AY4 + 54) * 2                                 # Augenspitze unten (2×)
EX, EY = 62, 128 + 50                                # Erdmittelpunkt im 2×-Raster (Oberkante y128 → 256 im 250er-Raster)
# dunkelroter Schein um das Auge (außen gedithert, Pupille frei)
for y in range(175):
    for x in range(125):
        d = math.hypot((x + 0.5 - ECX) / 32, (y + 0.5 - ECY) / 62)
        if 0.34 < d < 1:
            lv = int((1 - d) * 3 + bayer(x, y))
            if lv:
                c = tuple(int(v) for v in cv.a[min(349, y * 2), min(249, x * 2)])
                p2[y, x] = list(mix(c, (110, 14, 34), (0, 0.16, 0.3, 0.42)[min(3, lv)])) + [255]
# roter Blickkegel von der Augenspitze zur Erde (nach unten breiter, schwach, gedithert)
for y in range(TIP - 6, EY - 44):
    t = (y - (TIP - 6)) / max(1, (EY - 44) - (TIP - 6))
    half = 3 + 20 * t
    for x in range(int(ECX - half), int(ECX + half) + 1):
        if 0 <= x < 125 and p2[y, x, 3] == 0:
            f = 1 - abs(x + 0.5 - ECX) / half
            lv = int(f * 2.6 + bayer(x, y))
            if lv:
                c = tuple(int(v) for v in cv.a[y * 2, x * 2])
                p2[y, x] = list(mix(c, (160, 26, 48), (0, 0.22, 0.36, 0.48)[min(3, lv)])) + [255]
# Erde, oberer Rand vom Blick rötlich angestrahlt
put(p2, earth, EX - 50, EY - 50)
for y in range(EY - 50, EY - 24):
    for x in range(EX - 36, EX + 37):
        if 0 <= y < 175 and p2[y, x, 3]:
            g = (1 - (y - (EY - 50)) / 26) * (1 - abs(x - EX) / 37)      # Lichtfleck oben mittig, auslaufend
            lv = int(g * 3 + bayer(x, y))
            if lv: p2[y, x, :3] = mix(tuple(int(v) for v in p2[y, x, :3]), (210, 50, 70), (0, 0.18, 0.3, 0.42)[min(3, lv)])
# Life-Searcher links, sinkt mit Suchstrahl auf die Erde
SX, SY = 20, 88
put(p2, search, SX, SY)
# Analyzer rechts, schießt mit Bewegungsspur abwärts
QX, QY = 90, 76
for k in range(1, 12):                                   # Spur: kurze helle Striche hinter dem Schiff, nach oben ausdünnend
    y = QY - k * 2
    if bayer(QX, y) * 11 < 12 - k:
        for dx in (6, 10):
            p2[y, QX + dx] = list(mix(tuple(int(v) for v in cv.a[y * 2, (QX + dx) * 2]), (140, 230, 200), 0.6 - k * 0.04)) + [255]
put(p2, anal_down, QX, QY)
blit(cv, p2, 2)
cv.paste(up(beam, 2), (SX + 5) * 2, (SY + 33) * 2, alpha=0.45)

# ---------- 4×: Argos ----------
p4 = rgba(63, 88)
put(p4, argos, AX4, AY4)
blit(cv, p4, 4)
print(save(cv, '16_rift_over_earth.png'))
