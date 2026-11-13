# -*- coding: utf-8 -*-
"""Idle-Animation für „Cannon Tower“ (Creature) — der runde Wehrturm mit der Kanone auf der Plattform.

PICK: [["MotiveDeri", 187, "Szene"], ["MotiveDeri", 186, 1]]
Quelle: src/cannon-tower.png (32×76 px, 24 Farben).
* Der Turm ist in der Szenen-Ebene „Ebene #29“ (MotiveDeri 187, Burghof) eingebacken: Ebenen-Fenster x 304–335, y 84–239 (32×156 px). Er wurde geometrisch freigestellt (Schaft = Spalten 304–335; Krone:
  Zeilen 84–85 nur die beiden Zinnenspitzen x 308–314 und x 324–330, Zeilen 86–87 x 308–330, Zeile 88 x 307–332, ab Zeile 89 volle Breite; Fuß: alles, was nicht Sandfarbe ist).
* Die Kanone samt den beiden Glutbecken und dem schwarzen Plattformring ist die eigene Ebene 186 „Cannon Toweer“ (32×34), die in der xcf genau auf der Turmkrone liegt (Sprite-Versatz (0,1)).
* GEKÜRZT (Annahme, siehe Bericht): Der Turm der Szene ist 156 px hoch; die Kartenkunst (public/cardgen/art/Cannon_Tower.webp, Raster 96×63) zeigt nur die Krone mit Kanone bis zur ersten Schießscharte und
  schneidet den Schaft ab. Für den Sprite wurden die Mauerwerkszeilen 60–139 des Turms (ein Vielfaches der Steinlagen, inkl. der zweiten Schießscharte) herausgenommen: Sprite-Zeilen 0–59 = Krone, Kanone,
  erste Schießscharte; Sprite-Zeilen 60–75 = der originale Turmfuß. Kein Pixel wurde neu gezeichnet.

Was ist was (x/y im Sprite):
* KRONE (y 0–20): Zinnen (hell (198,186,189)/(173,158,148)), Plattform; schwarzer Ring y 15–23 (Plattformrand).
* KANONE (x 10–21, y 2–14): blaugraues Rohr von vorn/oben gesehen, heller Rand (86,95,126), dunkle Mündung mit Gittermuster (y 4–10), graue Lafette (y 12–14); brauner Pixel (15,1) = Korn/Zündloch oben am Rohr.
* GLUTBECKEN links (11, 15–18) und rechts (20–21, 15–18): Orange (254,120,33) → (188,74,47) → (113,63,52) auf grauen Sockeln (y 19).
* SCHAFT (y 21–75): Bruchsteinmauerwerk, Schießscharte (x 12–19, y 43–54), dunkler Fuß.
Metall: das Kanonenrohr (nur dort ein kurzer Sparkle).

Idle-Idee: Der Turm steht völlig starr (Gebäude) – es leben nur Glut und Pulverdampf. Ablauf (64 Frames à 80 ms = 5,1 s, langsam, nahtlos; Frame 0 = Original):
* Glutbecken flackern unregelmäßig (16-Frame-Muster, links und rechts versetzt): die drei Glutfarben wandern innerhalb der Beckenpixel eine Stufe auf/ab (kein Pixel außerhalb der Becken; so klein, dass
  keine Flamme aus anim_feuer3 passt – es ist Glut, keine Zunge).
* Pulverdampf: drei graue Wölkchen (Grautöne der Lafette) quellen nacheinander aus der Mündung, steigen langsam 12 px auf und pendeln leicht (2×2 → Kreis → Wölkchen 5×3 → Kreis → 2×2, nie Einzelpixel).
* Rohr glänzt kurz (Frames 54–56): kleiner Sparkle am linken oberen Rohrrand (Mitte → Kreuz → weg).
Ergänzungen: keine.
"""
import math

import anim_lib as L
import anim_n2 as N2

N, MS = 64, 80
FIG = N2.Figur('cannon-tower', pad=(3, 3, 13, 2))
spr = FIG.spr
OFF = FIG.off
TEST_EBENEN = 'figur'

G3, G2, G1 = FIG.farbe((254, 120, 33), (188, 74, 47), (113, 63, 52))
RAUCH_K, RAUCH_R = FIG.farbe((154, 154, 154), (117, 117, 117))
ROHR_H = FIG.f(12, 3)
# Glutzustände: Farben der vier Zeilen y 15–18 (links eine Spalte x 11; rechts zwei Spalten x 20, 21)
LINKS = {0: (G2, G2, G1, G1), 1: (G3, G2, G2, G1), 2: (G2, G1, G1, G1)}
RECHTS = {0: ((G3, G3), (G2, G3), (G2, G2), (G1, G1)), 1: ((G3, G3), (G3, G3), (G2, G3), (G2, G1)), 2: ((G2, G3), (G2, G2), (G1, G2), (G1, G1)), 3: ((G3, G2), (G3, G2), (G2, G2), (G1, G1))}
FL_L = [0, 0, 1, 1, 0, 2, 2, 0, 1, 0, 0, 2, 1, 1, 0, 2]
FL_R = [0, 1, 1, 3, 0, 0, 2, 2, 3, 1, 0, 0, 3, 2, 1, 0]
# Dampf: (Startframe, Lebensdauer, Pendel)
DAMPF = [(3, 24, 1), (22, 24, -1), (38, 24, 1)]
FORMEN = ['s', 'o', 'm', 'm', 'o', 's']


def dampf(i):
    e = L.leer(FIG.H, FIG.W)
    for start, leb, pendel in DAMPF:
        k = (i - start) % N
        if k >= leb:
            continue
        t = k / float(leb)
        form = FORMEN[min(len(FORMEN) - 1, int(t * len(FORMEN)))]
        cx = 15 + int(round(pendel * 1.5 * math.sin(math.pi * t)))
        cy = 4 - int(round(12 * t))
        for dx, dy, art in L.PUFF_FORMEN[form]:
            X, Y = cx + dx + OFF[0], cy + dy + OFF[1]
            e[Y, X, :3] = RAUCH_K if art == 'c' else RAUCH_R
            e[Y, X, 3] = 255
    return e


def frame(i, nur=None):
    a = FIG.platz()
    zl, zr = FL_L[(i // 2) % 16], FL_R[(i // 2) % 16]
    for r in range(4):
        N2.setze(a, OFF, {(11, 15 + r): LINKS[zl][r], (20, 15 + r): RECHTS[zr][r][0], (21, 15 + r): RECHTS[zr][r][1]})
    g = N2.fenster(i, N, 54, [0, 1, 1])
    if g is not None:
        N2.funke(a, OFF, 12, 3, g, RAUCH_K, ROHR_H)
    if nur == 'figur':
        return a
    return L.zusammen(FIG.H, FIG.W, [(a, 0, 0), (dampf(i), 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Cannon Tower', zoom=4, spalten=16)
