# -*- coding: utf-8 -*-
"""Idle-Animation für „Luna Kiai“ (Creature) — steinerner Wächter mit roten Glutaugen und seitlichen Federkränzen; die Federspitzen wippen, die Augen verlöschen und glimmen wieder auf.

PICK: [["MotiveHawaii", 254, "Ebene „Ebene #1“ (32×33 px, ganze Ebene)"]]
Abgleich mit data/card-art/native/Luna_Kiai.png: Die Figur steht dort in der Lava (unterer Teil von Lava überdeckt = Ebenen 252/253, Szene); der Steinsockel mit Blumenkranz
über ihr stammt aus einer zusammengefassten Szenenebene und ist nicht Teil des Sprites. Die Ebene 254 selbst ist vollständig (kein angeschnittener Rand).
UNSICHER: Was die Figur genau darstellt (kopfüber hängendes Fledermaus-/Eulenwesen oder Steinidol), ist aus Kunst und Ebene nicht eindeutig. Deshalb bewegt sich nur,
was eindeutig ist; Rumpf und der T-förmige Aufsatz oben (x 3–28, y 0–8) bleiben fest.

Identifikation (32×33): T-förmiger Aufsatz oben (y 0–8), runder Rumpf (x 7–24, y 9–32, dunkler Umriss (68,63,73)), zwei rote Augen 2×3 ((12–13,18–20) und (18–19,18–20)),
je Seite drei helle Federbüschel ohne Umriss (links x 0–8: y 11–18, y 19–24, y 25–28; rechts gespiegelt).

Ablauf (60 Frames à 80 ms = 4,8 s; Stein = langsam). Frame 0 = Original:
* Federwelle (Periode 15): die Spitzen der drei Federbüschel senken sich nacheinander von oben nach unten je 3 Frames lang 1 px (links und rechts gleichzeitig; nur die
  äußersten zwei Spalten jedes Büschels, als Einheit).
* Augen (Frames 26–35): die Glut verlischt von oben nach unten (Augenzeilen nehmen die Steinfarbe an) und glimmt wieder auf – bleibt innerhalb der Augenpixel, keine neue Farbe.
Kein Atmen (Stein), kein Schweben. Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_n9 as N9

N, MS = 60, 80
sz = N9.Szene('luna-kiai', (3, 3, 3, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
SPITZEN_M = [((xx <= 1) | (xx >= 30)) & (yy >= 11) & (yy <= 12),
             ((xx <= 1) | (xx >= 30)) & (yy >= 19) & (yy <= 20),
             ((xx <= 3) | (xx >= 28)) & (yy >= 25) & (yy <= 26)]
SPITZEN = [sz.teil(m) for m in SPITZEN_M]
REST = sz.teil(sz.da & ~(SPITZEN_M[0] | SPITZEN_M[1] | SPITZEN_M[2]))
STEIN = (98, 92, 103)
AUGE_ZU = {26: 1, 27: 1, 28: 2, 29: 3, 30: 3, 31: 3, 32: 2, 33: 2, 34: 1, 35: 1}
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    j = i % 15
    r = REST.copy()
    zu = AUGE_ZU.get(i, 0)
    for k in range(zu):
        for x in (12, 13, 18, 19):
            r[sz.PT + 18 + k, sz.PL + x, :3] = STEIN
    eb = [(r, 0, 0)]
    for t in range(3):
        eb.append((SPITZEN[t], 0, 1 if 3 + 3 * t <= j < 6 + 3 * t else 0))
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N9.fertig('luna-kiai', 'Luna Kiai', frame, N, MS, spr, check=[0, 4, 7, 10, 28, 30], zoom=9)
