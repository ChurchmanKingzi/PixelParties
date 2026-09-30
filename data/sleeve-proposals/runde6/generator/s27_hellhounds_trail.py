# -*- coding: utf-8 -*-
"""27 Hellhound's Trail – Gegner „Man's Best Friends“ (sample-Structure Deck Mans Best Friends),
Held: Orthos, the Loyal Guard Dog.

Idee (Reise/Nachtmarsch): Orthos, der zweiköpfige Wachhund mit brennenden Köpfen (Base-Karte), kommt groß auf den
Betrachter zu. Hinter ihm windet sich ein Aschepfad durch das glühende Feuerfeld seiner Karte bis zum Horizont,
und auf dem Pfad folgt ihm im Gänsemarsch seine Loyal-Meute: vorn die Cover-Karte Loyal Pinpom und der Rottweiler,
weiter hinten Terrier, Shepherd und Hountriever (Kartentext: ein „Loyal“ ruft den nächsten herbei).

Quellen:
  MotiveGN.xcf  Ebene 155 „Orthos“: Orthos mit Flammenköpfen (Box x 168–186, y 330–353; die darüber anstoßende
                Flamme des Feuerfelds abgeschnitten), geprüft gegen Kartenszene Sichtbar #87 (Ebene 149,
                Kartenausschnitt Lage 139,314); aus derselben Ebene die Feuerfeld-Flamme (x 158–167, y 336–347).
                Loyal-Hunde (je Kartenbild-Ebene, geprüft per scenes_with gegen ihre Sichtbar-Szenen 158/162/160/166/168):
                159 „Pinpom“, 163 „Rottweiler“, 161 „Terrier“, 167 „Shepherd“, 169 „Hountriever“.
Selbst gezeichnet: Nachthimmel mit rotem Horizontschein, Hügelsilhouetten, Glutfunken, Aschefeld (Sprenkel),
Aschepfad, Lichtschein der Flammen und der Flammenköpfe auf dem Boden, Bodenschatten.

Skalierung:
  Hintergrund (Himmel, Hügel, Boden, Pfad, ferne Flammen, Terrier/Shepherd/Hountriever) – 2× (Raster 125×175)
  Mittelgrund (Pinpom, Rottweiler, nahe Flammen, ihre Schatten)                          – 3× (Raster 84×117)
  Vordergrund (Orthos 18×23 → 108×138, Schatten)                                         – 6× (Raster 42×59)
"""
import math, random
import numpy as np
from ekit_25_30 import *  # noqa

rnd = random.Random(27)
GN = 'MotiveGN'

orthos = sprite('o27_orthos', GN, [155], box=(168, 330, 186, 353))
flame = sprite('o27_flame', GN, [155], box=(158, 336, 167, 347))
dog = {n: sprite('o27_' + n, GN, [i], box=b) for n, i, b in (
    ('pinpom', 159, (131, 289, 144, 302)), ('rottweiler', 163, (177, 289, 191, 307)),
    ('terrier', 161, (204, 241, 217, 256)), ('shepherd', 167, (195, 287, 211, 306)),
    ('hountriever', 169, (155, 328, 169, 345)))}

HOR = 118                                        # Horizont (Canvas-Pixel)

# ---------------------------------------------------------------- Pfad (Canvas-Koordinaten, Catmull-Rom)
PTS = [(116, HOR), (98, 130), (146, 146), (160, 158), (112, 172), (62, 196), (56, 228), (150, 250), (196, 270), (190, 290), (125, 330), (125, 360)]


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
    best = min(CURVE, key=lambda p: abs(p[1] - y))
    return best[0]


# ================================================================ 2×-Ebene
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
h2 = HOR // 2
vgrad(bg, 0, 0, bw, h2, [(10, 6, 14), (18, 8, 20), (34, 10, 22), (62, 16, 20), (104, 30, 20)])
# ferne Hügel (zwei Schichten)
for x in range(bw):
    t1 = h2 - 7 - 4 * math.sin(x * .07 + 1) - 2 * math.sin(x * .19)
    t2 = h2 - 3 - 2.5 * math.sin(x * .11 + 3) - 1.5 * math.sin(x * .31)
    for y in range(int(t1), h2):
        bg[y, x, :3] = (40, 14, 20) if y > t1 + .5 else (86, 28, 24)
    for y in range(int(t2), h2):
        bg[y, x, :3] = (24, 10, 14) if y > t2 + .5 else (60, 20, 20)
# Aschefeld (Sprenkel in der Farbe der Kartenszene), nach vorn etwas heller
G = [(26, 16, 18), (34, 22, 22), (42, 27, 26), (54, 33, 30)]
for y in range(h2, bh):
    t = (y - h2) / (bh - h2)
    for x in range(bw):
        r = rnd.random()
        i = 1 if r < .55 else (0 if r < .8 else 2)
        if t > .45 and r > .93: i = 3
        bg[y, x, :3] = G[i]
# Pfad: Breite wächst nach vorn, dunkle Kante
PC = [(66, 54, 52), (84, 70, 64), (100, 86, 78)]
for y in range(h2, bh):
    cy = y * 2 + 1
    cx = path_x(cy) / 2
    wdt = 1.5 + 17 * ((cy - HOR) / (350 - HOR)) ** 1.3
    for x in range(bw):
        d = abs(x + .5 - cx)
        if d < wdt:
            r = rnd.random()
            bg[y, x, :3] = PC[1] if r < .6 else (PC[0] if r < .85 else PC[2])
        elif d < wdt + 1:
            bg[y, x, :3] = (28, 18, 18)
# Horizontschein
glow(bg, 62, h2, 90, 26, (150, 40, 20), .35, mask=np.arange(bh)[:, None].repeat(bw, 1) < h2)
# ferne Flammen des Feuerfelds (2×) mit Glutschein
FAR = [(20, 70), (104, 64), (12, 100), (36, 82)]
for fx, fy in FAR:
    glow(bg, fx + 4.5, fy + 10, 11, 5, (200, 60, 20), .45)
for fx, fy in FAR:
    put(bg, flame, fx, fy)
# Funken am Himmel
for _ in range(10):
    x = rnd.randrange(8, bw - 8); y = rnd.randrange(14, h2 - 8)
    setp(bg, x, y, (230, 110, 40) if rnd.random() < .6 else (250, 190, 80))
# Lichtschein der Flammenköpfe rund um Orthos auf dem Boden
glow(bg, 62.5, 150, 58, 30, (190, 70, 24), .38)


def dog_at(layer_, s, cx, feet):
    """Hund mittig über dem Fußpunkt, mit kleinem Schatten."""
    h, w = s.shape[:2]
    for x in range(int(cx - w / 2) - 1, int(cx + w / 2) + 1):
        for dy in (0, 1):
            if bay(x, feet + dy) < (.8 if dy == 0 else .4):
                setp(layer_, x, feet + dy - 1, (10, 6, 8), 170)
    put(layer_, s, int(round(cx - w / 2)), feet - h)


# ferne Meute (2×)
for n, feet in (('hountriever', 66), ('shepherd', 76), ('terrier', 86)):
    cy = feet * 2
    dog_at(bg, dog[n], path_x(cy) / 2, feet)

# ================================================================ 3×-Ebene
mw, mh = grid(3)
mid = rgba(mw, mh)
for n, feet in (('rottweiler', 76), ('pinpom', 90)):
    cy = feet * 3
    dog_at(mid, dog[n], path_x(cy) / 3, feet)
NEAR = [(4, 88), (66, 62)]
for fx, fy in NEAR:
    put(mid, flame, fx, fy)

# ================================================================ 6×-Ebene: Orthos
fw, fh = grid(6)                     # 42×59
fg = rgba(fw, fh)
OX, OF = 12, 54                      # linke Kante, Fußzeile (Canvas y 324)
for x in range(OX + 3, OX + 16):
    setp(fg, x, OF, (8, 4, 6), 190)
put(fg, orthos, OX, OF - orthos.shape[0])

print(finish([(bg, 2), (mid, 3), (fg, 6)], '27_hellhounds_trail.png'))
