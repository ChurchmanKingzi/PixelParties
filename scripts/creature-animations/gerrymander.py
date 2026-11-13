# -*- coding: utf-8 -*-
"""Idle-Animation für „Gerrymander“ (Creature) — der grüne Salamander, der (von oben gesehen) mit gespreizten Beinen an der Holzwand klebt und züngelt.

Quelle: src/gerrymander.png (32×21 px, 6 Farben).
PICK: [["MotiveGrailWar", 277, 1]]     (Ebene „Gerrymander“, Figur 1; 100 % Treffer, nur in dieser Karte; vollständig. Ebene 284 „Ebene #239“ ist die Holzwand = Kulisse.)

Aufruf:   python3 gerrymander.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gerrymander.png + .json

Was im Sprite ist (x, y im 32×21-Sprite; der Kopf zeigt nach RECHTS):
* SCHWANZ (x 0–11, y 9–14): läuft nach links dünn aus, Spitze bei (0–3, 12).
* RUMPF (x 12–22, y 8–12): grün (110,141,107)/(87,112,83) mit hellen Rückenflecken (177,200,174) in zwei Reihen (y 9 und y 11).
* VIER BEINE: vorn (x 19–27) nach oben (y 0–8) und unten (y 12–20), hinten (x 10–17) ebenso; je zwei Zehen an den Enden. Sie kleben an der Wand → bleiben völlig fest.
* KOPF (x 23–27, y 8–12) mit zwei gelben AUGEN (251,213,44) bei (26,9) und (26,11).
* ZUNGE (199,93,80): (28–29,10), (30,11), (31,12–13) – hängt aus dem Maul und biegt nach unten.
Kein Metall → kein Glanz. Keine Partikel.

Idee: Der Salamander klebt reglos an der Wand – nur die ZUNGE schnellt immer wieder heraus (züngeln) und der SCHWANZ schlängelt träge.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Züngeln (zweimal je Schleife, ab Frame 8 und ab Frame 38): Zunge zieht sich ein (nur noch (28,10)) → weg → schnellt gerade heraus (28–31,10) → biegt nach oben ((30,9), (31,8), (31,7)) → gerade → zurück
  in die Ruheform (Original, nach unten gebogen). Die Zunge wird in jeder Pose als Ganzes neu gesetzt (nur Zungenfarbe), nie gedehnt.
* Schwanz (x ≤ 11): schlängelt als laufende Welle senkrecht (L.spalten_welle, Gelenk am Rumpf x 12, Ausschlag ±2 px an der Spitze, Periode 30, Gefälle ≤ 1 px je Spalte) – der Ansatz am Rumpf bleibt stehen.
* Blinzeln (Frames 24–26 und 54–56): beide Augen nehmen das Kopfgrün (110,141,107) an.
Frame 0 = Original. Ergänzungen: keine.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4

N, MS = 60, 70
G = N4.Figur('gerrymander', 2, 2, 2, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
GRUEN, ZUNGE_F, SCHWARZ = f(25, 10), f(28, 10), (0, 0, 0)
zunge = L.farbmaske(spr, [ZUNGE_F])
schwanz = G.da & (G.xx <= 11)
rumpf = G.da & ~zunge & ~schwanz
ZUNGE = {
    'ruhe': [(28, 10), (29, 10), (30, 11), (31, 12), (31, 13)],
    'kurz': [(28, 10)],
    'weg': [],
    'gerade': [(28, 10), (29, 10), (30, 10), (31, 10)],
    'hoch': [(28, 10), (29, 10), (30, 9), (31, 8), (31, 7)],
}
FLICK = ['kurz', 'weg', 'weg', 'gerade', 'gerade', 'hoch', 'hoch', 'gerade', 'kurz', 'gerade', 'hoch', 'hoch', 'gerade']


def frame(i):
    k = G.ebene(rumpf)
    if Hm.folge(i, 24, [1] * 3, N) or Hm.folge(i, 54, [1] * 3, N):
        Hm.setze(k, {(26, 9): GRUEN, (26, 11): GRUEN}, OFF)
    z = Hm.folge(i, 8, FLICK, N) or Hm.folge(i, 38, FLICK, N) or 'ruhe'
    Hm.setze(k, {p: ZUNGE_F for p in ZUNGE[z]}, OFF)
    s = G.ebene(schwanz)
    env = math.sin(math.pi * i / N) ** 2                           # Frame 0 = Ruhe
    s = L.spalten_welle(s, G.PL + 12, 2.2 * min(1.0, 3 * env), L.sinus(i, N / 2), potenz=1.3, lauf=1.6)
    fig = L.zusammen(H, W, [(s, 0, 0), (k, 0, 0)])
    return G.schliessen(fig, lambda x, y: SCHWARZ)


if __name__ == '__main__':
    N4.abschluss(G, 'Gerrymander', [frame(i) for i in range(N)], MS, sys.argv, scale=5)
