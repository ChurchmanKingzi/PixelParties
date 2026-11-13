# -*- coding: utf-8 -*-
"""Idle-Animation für „Bonded Companion Mellvy“ (Creature) — kleiner orangefarbener Fledermausdämon mit Geweih, der einen blauen Trank herbeiträgt:
flattert auf der Stelle (ganze Flügel ab dem Ansatz am Kopf), schwebt dabei leicht auf und ab, blinzelt, die Schwanzquaste zuckt.

PICK: [["MotiveGrailWar", 119, "zusammengefasste Szenen-Ebene (565×392, deckend); der Dämon steht dort rauschfrei bei (153+13 … , 104+8 …) – freigestellt mit der
        Motiv-Maske der Karte (Kunst x 15–60, y 8–32)"]]
Die Kartenkunst selbst ist verrauscht (Dither), deshalb die Pixel aus der Ebene, die Maske nur als Schablone. Aus der Maske WEGGELASSEN: Theke mit den vier
Trankkugeln und Tischbeinen (Kunst y 0–10) und das Spinnennetz unten (y 36–50). BEHALTEN: die blaue Trankflasche in seinen Händen (er trägt sie, sie verdeckt
Bauch und Hände – ohne sie müsste der halbe Leib erfunden werden; Annahme, siehe Bericht).
ERGÄNZT: Geweihspitzen, die in der Kunst hinter den Tischbeinen verschwinden – rechts ein Pixel (30,0) über den zwei sichtbaren (29,1–2), links gespiegelt
(16,1), (16,2), (15,0); Farbe Geweihgrau (120,107,90).

Identifikation (46×25; Sprite-x = Kunst-x − 15): Kopf (x 17–28, y 4–13) mit Geweih (grau-braun, x 15–19 und x 26–30, y 0–6), grüne Schlitzaugen
((20,9), (20–21,10) und (25,9), (24–25,10)), Maul mit zwei hellen Fangzähnen (21,12), (24,12); Fledermausflügel links (x 0–16, y 3–13) und rechts (x 30–45)
mit dunklen Fingerstreben; kleiner Leib mit zwei Armen (x 17–28, y 13–20), die die Flasche halten: gelber Korken (22–23,14), heller Flaschenrand (y 15–16),
blauer Bauch (x 19–27, y 17–24). Schwanz bildlinks (x 13–17, y 15–21) mit Quaste oben (x 13–16, y 15–16).

Ablauf (48 Frames à 70 ms = 3,4 s; vier Flügelschläge). Frame 0 = Original:
* Flügelschlag (Periode 12): beide Flügel schlagen als Ganzes um den Ansatz am Kopf (Spaltenversatz wächst zum Flügelende bis ±3 px; Gelenkspalten bleiben).
* Flattern: die ganze Figur hebt sich beim Abschlag 1 px und sinkt beim Aufschlag zurück.
* Blinzeln (Frames 20–21): das Grün der Augen wird Fellorange.
* Schwanzquaste zuckt 1 px nach bildlinks (Frames 7–10 und 31–34); das Umrisspixel (17,16) zwischen Quaste und Arm bleibt stehen.
Bewusst fest: Geweih (starr), Flasche und Arme (er hält sie ruhig), Kopf.
"""
import math

import numpy as np

import anim_lib as L
import anim_n11 as G

N, MS = 48, 70
sz = G.Szene("bonded-companion-mellvy", (3, 3, 6, 5))
spr = sz.spr
xx, yy = sz.xx, sz.yy
GEWEIH = sz.ist((120, 107, 90), (87, 70, 50), (58, 41, 23))
FL_L_M = sz.da & (xx <= 16) & (yy <= 13) & ~GEWEIH
FL_R_M = sz.da & (xx >= 30) & (yy <= 13) & ~GEWEIH
QUASTE_M = sz.da & (xx >= 13) & (xx <= 17) & (yy >= 15) & (yy <= 16)
FL_L, FL_R, QUASTE = sz.teil(FL_L_M), sz.teil(FL_R_M), sz.teil(QUASTE_M)
RUMPF = sz.teil(sz.da & ~FL_L_M & ~FL_R_M & ~(QUASTE_M & (xx <= 16)))
GRUEN = [(57, 116, 0), (120, 200, 51)]
FELL = (206, 84, 9)
AUGEN = sz.voll(sz.ist(*GRUEN))


def frame(i, nur=None):
    s = math.sin(2 * math.pi * i / 12)
    tip = int(round(3 * s))                                   # + = Flügelspitze unten
    heb = -1 if s > 0.5 else 0
    fl_l = G.spalten_schub(FL_L, lambda x: int(round(tip * max(0, (sz.PL + 16 - x)) / 16.0)))
    fl_r = G.spalten_schub(FL_R, lambda x: int(round(tip * max(0, (x - sz.PL - 30)) / 15.0)))
    rumpf = RUMPF
    if i in (20, 21):
        rumpf = G.farbtausch(rumpf, AUGEN, {GRUEN[0]: FELL, GRUEN[1]: FELL})
    q = -1 if (7 <= i <= 10 or 31 <= i <= 34) else 0
    f = L.zusammen(sz.H, sz.W, [(fl_l, 0, 0), (fl_r, 0, 0), (G.starr(QUASTE, q, 0), 0, 0), (rumpf, 0, 0)])
    return G.starr(f, 0, heb)


if __name__ == '__main__':
    G.fertig('bonded-companion-mellvy', 'Bonded Companion Mellvy', frame, N, MS, spr, check=[0, 3, 9, 20], zoom=10)
