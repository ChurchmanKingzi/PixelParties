# -*- coding: utf-8 -*-
"""Idle-Animation für „The Root of all Presents“ (Creature) — der böse Baum als Weihnachtsbaum: Nikolausmützen, bunte Lichterkette, Zähneklappern.

PICK: [["MotiveMoe", 183, "Ebene „The Root of all Presents“ (Baum mit Mützen und Lichterkette, 46×60)"], ["MotiveMoe", 184, "Ebene #153: der nackte Baum darunter (liefert nur verdeckte Pixel)"]]
Abgleich mit data/card-art/native/The_Root_of_all_Presents.png: Baum, drei Mützen und Lichter stimmen. Nicht verwendet: Ebene 181 (Geschenkestapel vor den Wurzeln = Beiwerk am Boden)
und Ebene 182 (weicher Regenbogenschein der Lichter, halbtransparent).

Identifikation (46×60): grauer toter Baum (Grautöne (24)(46)(66)(78)(88)), Wipfel x 20–24, y 0–22, Äste links/rechts, Stamm x 18–26, Wurzelballen y 52–59. Maul y 49–53, x 18–27
(dunkelrot, obere Zähne (19|21|23|25, 50), untere Zähne (20|22|24, 52), Weiß (255,255,255)). Drei Nikolausmützen (Rot (81,16,16)…(169,34,34), Krempe/Bommel weiß-grau): am Wipfel
(x 11–22, y 0–16), am linken Ast (x 0–18, y 30–38), am rechten Ast (x 33–45, y 31–47). Lichterkette: schwarzes Kabel (0,0,0) mit Lämpchen in vier Farbfamilien
(Rot (255,0,0)/(189,0,0)/(148,0,0), Gelb (255,243,0)/(255,178,0)/(206,113,0), Grün (0,255,0)/(0,174,0)/(0,109,0), Blau (49,146,255)/(41,113,198)/(24,69,123)).
Die roten Augen des Baums (Ebene 184) sind in dieser Fassung von Kette/Mütze überdeckt → kein Blinzeln.

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Lichterkette läuft: alle 8 Frames rückt jede Lampe eine Farbfamilie weiter (Rot → Gelb → Grün → Blau → Rot, je Helligkeitsstufe; nur Farben der Quelle, kein Schein).
* Der Baum wiegt sich langsam (Periode 64): Zeilen oberhalb der Wurzeln (y < 47) wandern waagerecht, je höher desto mehr (Wipfel ±2 px, höchstens 1 px Unterschied zwischen
  Nachbarzeilen); Mützen und Kette gehen mit ihren Ästen mit. Wurzeln, Maul bleiben stehen.
* Zähneklappern (Frames 20–27 und 52–59): das Maul schließt sich im 2-Frame-Wechsel (Zahnreihen greifen in der Mittelzeile y 51 ineinander, Weiß der Zähne).
Ergänzungen: keine.
"""
import math

import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('the-root-of-all-presents', (4, 4, 2, 2))
spr = sz.spr
FAM = [[(255, 0, 0), (189, 0, 0), (148, 0, 0)], [(255, 243, 0), (255, 178, 0), (206, 113, 0)], [(0, 255, 0), (0, 174, 0), (0, 109, 0)], [(49, 146, 255), (41, 113, 198), (24, 69, 123)]]
LAMPEN = sz.ist(*[c for f in FAM for c in f])
WEISS = (255, 255, 255)
PIVOT = 47


def lichter(a, s):
    if not s:
        return a
    out = a.copy()
    for k, fam in enumerate(FAM):
        for st, c in enumerate(fam):
            out[L.farbmaske(a, [c]) & LAMPEN] = FAM[(k + s) % 4][st] + (255,)
    return out


def wiegen(a, i):
    s = math.sin(2 * math.pi * i / N)
    out = np.zeros_like(a)
    for y in range(a.shape[0]):
        yy = y - sz.PT
        d = int(math.floor(2.3 * s * (max(0, PIVOT - yy) / PIVOT) ** 1.4 + 0.5)) if yy < PIVOT else 0
        out[y] = np.roll(a[y], d, axis=0)
    return out


def frame(i, nur=None):
    a = lichter(spr, (i // 8) % 4)
    k = i % 32
    if 20 <= k < 28 and (k // 2) % 2 == 0:
        a = a.copy()
        for x in range(20, 26):
            a[51, x, :3] = WEISS
    return wiegen(L.platz(a, sz.H, sz.W, sz.PL, sz.PT), i)


if __name__ == '__main__':
    N7.fertig('the-root-of-all-presents', 'The Root of all Presents', frame, N, MS, spr, check=[0, 8, 16, 20, 40, 48], zoom=7)
