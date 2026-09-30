# -*- coding: utf-8 -*-
"""27 Hellhound's Trail – Gegner „Man's Best Friends“ (sample-Structure Deck Mans Best Friends),
Held: Orthos, the Loyal Guard Dog.

Idee (Reise/Nachtmarsch, ruhig): Orthos, der zweiköpfige Wachhund mit brennenden Köpfen (Base-Karte), kommt groß
auf dem Aschepfad auf den Betrachter zu. Dicht hinter ihm folgt als geschlossene Gruppe seine Loyal-Meute – vorn
in der Mitte die Cover-Karte Loyal Pinpom, links der Rottweiler, rechts der Shepherd, dahinter in einer zweiten Reihe
Terrier, Labradoodle, Hountriever und Loyal Bone Dog (Kartentext: ein „Loyal“ ruft den nächsten herbei). Hinter ihnen liegt das dunkle Aschefeld seiner Karte, am Horizont steht die Glut des
Feuerfelds als roter Schein hinter den Hügeln; der Schein seiner Flammenköpfe liegt auf Boden und Meute.

Quellen:
  MotiveGN.xcf  Ebene 155 „Orthos“: Orthos mit Flammenköpfen (Box x 168–186, y 330–353; die darüber anstoßende
                Flamme des Feuerfelds abgeschnitten), geprüft gegen Kartenszene Sichtbar #87 (Ebene 149,
                Kartenausschnitt Lage 139,314; Form gleich, Karte nur rötlich abgedunkelt).
                Loyal-Hunde (Kartenbild-Ebenen, geprüft per scenes_with gegen ihre Sichtbar-Szenen 158/162/166):
                159 „Pinpom“, 163 „Rottweiler“, 167 „Shepherd“, 161 „Terrier“, 165 „Labradoodle“, 169 „Hountriever“.
  Motive.xcf    Ebene 558 „Bone Dog“ (Box x 342–356, y 223–240), Szene Sichtbar #102.
Selbst gezeichnet: Nachthimmel mit Glutschein am Horizont, Hügelsilhouetten mit glühenden Kanten, wenige
Funken, Aschefeld (Sprenkel), Aschepfad, Lichtschein der Flammenköpfe, Bodenschatten.

Skalierung:
  Hintergrund (Himmel, Horizontglut, Hügel, Boden, Pfad, Licht)        – 2× (Raster 125×175)
  hintere Reihe (Terrier, Labradoodle, Hountriever, Bone Dog + Schatten) – 3× (Raster 84×117)
  vordere Reihe (Rottweiler, Pinpom, Shepherd + Schatten)               – 4× (Raster 63×88)
  Vordergrund (Orthos 18×23 → 108×138, Schatten)                       – 6× (Raster 42×59)
"""
import math, random
import numpy as np
from ekit_25_30 import *  # noqa

rnd = random.Random(27)
GN = 'MotiveGN'

orthos = sprite('o27_orthos', GN, [155], box=(168, 330, 186, 353))
dog = {n: sprite('o27_' + n, GN, [i], box=b) for n, i, b in (
    ('pinpom', 159, (131, 289, 144, 302)), ('rottweiler', 163, (177, 289, 191, 307)),
    ('shepherd', 167, (195, 287, 211, 306)), ('terrier', 161, (204, 241, 217, 256)),
    ('labradoodle', 165, (341, 350, 357, 368)), ('hountriever', 169, (155, 328, 169, 345)))}
dog['bonedog'] = sprite('o27_bonedog', 'Motive', [558], box=(342, 223, 356, 240))

HOR = 100                                        # Horizont (Canvas-Pixel)

# ---------------------------------------------------------------- Pfad (Canvas-Koordinaten, Catmull-Rom)
PTS = [(124, 150), (124, 205), (125, 300), (125, 360)]   # Pfad beginnt unter der Meute (hinten verdeckt)


def catmull(pts, n=40):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(p, float) for p in P[i - 1:i + 3]]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return out


CURVE = catmull(PTS)


def path_x(y):
    return min(CURVE, key=lambda p: abs(p[1] - y))[0]


# ================================================================ 2×-Ebene
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
h2 = HOR // 2
vgrad(bg, 0, 0, bw, h2, [(8, 5, 12), (14, 7, 18), (26, 9, 20), (48, 13, 18), (84, 24, 18)])
# Glut des Feuerfelds hinter dem Horizont (breiter, gestufter Schein)
sky = np.zeros((bh, bw), bool); sky[:h2] = True
glow(bg, 62, h2 + 2, 110, 22, (230, 90, 30), .55, mask=sky)
glow(bg, 62, h2 + 2, 70, 12, (255, 160, 60), .35, mask=sky)
# ferne Hügel mit glühender Kante
for x in range(bw):
    t1 = h2 - 6 - 3.5 * math.sin(x * .07 + 1) - 1.5 * math.sin(x * .19)
    t2 = h2 - 2.5 - 2 * math.sin(x * .11 + 3) - 1.2 * math.sin(x * .31)
    for y in range(int(t1), h2):
        bg[y, x, :3] = (38, 12, 18) if y > t1 + .5 else (150, 52, 26)
    for y in range(int(t2), h2):
        bg[y, x, :3] = (22, 9, 13) if y > t2 + .5 else (110, 36, 22)
for _ in range(6):                                # wenige Funken über der Glut
    setp(bg, rnd.randrange(12, bw - 12), rnd.randrange(h2 - 22, h2 - 8), (250, 170, 70))
# Aschefeld (ruhige Sprenkel in den Farben der Kartenszene)
G = [(26, 16, 18), (32, 21, 21), (40, 26, 25)]
for y in range(h2, bh):
    for x in range(bw):
        r = rnd.random()
        bg[y, x, :3] = G[1] if r < .6 else (G[0] if r < .85 else G[2])
# Pfad
PC = [(64, 52, 50), (80, 66, 60), (94, 80, 72)]
for y in range(76, bh):
    cy = y * 2 + 1
    cx = path_x(cy) / 2
    wdt = 1.5 + 17 * ((cy - HOR) / (350 - HOR)) ** 1.3
    for x in range(bw):
        d = abs(x + .5 - cx)
        if d < wdt:
            r = rnd.random()
            bg[y, x, :3] = PC[1] if r < .6 else (PC[0] if r < .85 else PC[2])
        elif d < wdt + 1:
            bg[y, x, :3] = (24, 15, 16)
# Lichtschein der Flammenköpfe (auf Boden und Meute)
glow(bg, 62.5, 96, 56, 34, (190, 70, 24), .3)

# ================================================================ 3×-Ebene: hintere Reihe der Meute
bk = rgba(*grid(3))


def dog_at(layer_, s_, cx, feet):
    h, w = s_.shape[:2]
    for x in range(int(cx - w / 2) - 1, int(cx + w / 2) + 1):
        for dy in (0, 1):
            if bay(x, feet + dy) < (.85 if dy == 0 else .45):
                setp(layer_, x, feet + dy - 1, (10, 5, 7), 190)
    put(layer_, s_, int(round(cx - w / 2)), feet - h)


# Canvas-Fußpunkte: Terrier 60/123, Labradoodle 102/120, Hountriever 147/120, Bone Dog 189/123
for n, cx, feet in (('terrier', 20, 41), ('labradoodle', 34, 40), ('hountriever', 49, 40), ('bonedog', 63, 41)):
    dog_at(bk, dog[n], cx, feet)

# ================================================================ 4×-Ebene: vordere Reihe, Pinpom vorn in der Mitte
mid = rgba(*grid(4))
# Canvas-Fußpunkte: Rottweiler 88/176, Shepherd 162/180, Pinpom 125/184
dog_at(mid, dog['rottweiler'], 22, 44)
dog_at(mid, dog['shepherd'], 40.5, 45)
dog_at(mid, dog['pinpom'], 31.25, 46)

# ================================================================ 6×-Ebene: Orthos
fw, fh = grid(6)                     # 42×59
fg = rgba(fw, fh)
OX, OF = 12, 54                      # linke Kante, Fußzeile (Canvas y 324)
for x in range(OX + 3, OX + 16):
    setp(fg, x, OF, (8, 4, 6), 190)
put(fg, orthos, OX, OF - orthos.shape[0])

print(finish([(bg, 2), (bk, 3), (mid, 4), (fg, 6)], '27_hellhounds_trail.png'))
