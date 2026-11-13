# -*- coding: utf-8 -*-
"""Idle-Animation für „Winged Haressassin“ (Creature) — der Hasen-Assassine von vorn, mit zwei roten Augen und weit gespreizten weißen Schwingen; er FLIEGT (Kartenkunst: über den Baumkronen).

Quelle: src/winged-haressassin.png (40×28 px, 36 Farben).
PICK: [["MotiveSteamDwarfs", 266, 1]]     (Ebene „Winged Haressassin“, Figur 1; 100 % Treffer, nur in dieser Karte; vollständig – Flügel, Ohren, Körper in einer Ebene.
  Treffer 0 „Sichtbar #64“ ist ein Stück Mauer, die übrigen sind Bäume/Kulisse.)

Aufruf:   python3 winged_haressassin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/winged-haressassin.png + .json

Was im Sprite ist (x, y im 40×28-Sprite; Frontalansicht):
* OHREN: linkes Ohr schräg (x 12–18, y 0–5), rechtes Ohr waagerecht (x 21–28, y 2–5).
* KOPF (x 15–24, y 6–12): weißes Fell, schwarze Stirnzeichnung (y 8); zwei offene AUGEN je 2×2: links (17–18, 9–10) hellblau/weiß außen, dunkelrot/rot innen; rechts (21–22, 9–10) gespiegelt.
* FLÜGEL: zwei dreieckige weiße Schwingen, Oberkante waagerecht in y 8, Spitzen bei (0,8) und (39,8), Unterkante läuft schräg zum Körper (bis y 17); der innere Teil (x 10–13 bzw. 26–29) liegt HINTER den Armen.
* ARME (x 10–15 und 24–29, y 10–17): seitlich abgespreizt, blaue Stulpen (11, 12–15)/(28, 12–15), dunkelroter Umriss. RUMPF (y 12–19) mit blauem Halstuch und Gürtel (y 19), BEINE (y 20–27) hängen frei.
Kein blankes Metall sichtbar (kein Schwert in dieser Ansicht) → kein Glanz. Keine Partikel.

Idee: Er hält sich mit ruhigen Flügelschlägen in der Luft – beide Schwingen schlagen als Ganzes um den Ansatz am Körper, der Körper hebt und senkt sich im Gegentakt, die Ohren zucken.
Ablauf (64 Frames à 70 ms = 4,5 s, nahtlos; 4 Flügelschläge):
* Flügelschlag (Periode 16): der ganze sichtbare Flügel außerhalb der Arme (x ≤ 9 bzw. x ≥ 30) schert um das Gelenk am Körperansatz (x 9 bzw. x 30, direkt am Arm): jede Spalte wandert senkrecht
  proportional zum Abstand (L.spalten_welle, Spitze ±3 px, Gefälle ≤ 1 px je 3 Spalten) – kein Knick in der Flügelmitte, keine Streckung, der Ansatz bleibt am Arm. Erst abwärts, dann aufwärts.
* Körper (alles): 1 px auf/ab im Gegentakt zum Flügel (Flügel unten → Körper oben). Er fliegt – Schweben ist hier richtig.
* Ohrzucken: rechtes Ohr (x ≥ 23) knickt in den Frames 20–22 an der Spitze 1 px nach unten; linkes Ohr (Zeilen 0–2) in den Frames 44–46 um 1 px nach rechts.
* Blinzeln (Frames 28–30 und 58–60): beide Augen nehmen die Fellfarbe (198,198,198)/(172,172,172) an.
Frame 0 = Original. Ergänzungen: keine (hinter den Flügeln ist nur Luft).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4

N, MS = 64, 70
G = N4.Figur('winged-haressassin', 2, 2, 5, 5)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
FELL, FELL_D, UMRISS = f(18, 7), f(16, 10), f(12, 0)
fl_l = G.da & (G.xx <= 9)
fl_r = G.da & (G.xx >= 30)
ohr_r = G.da & (G.xx >= 23) & (G.yy <= 5)
ohr_l = G.da & (G.yy <= 2) & (G.xx <= 18)
rumpf = G.da & ~fl_l & ~fl_r & ~ohr_r & ~ohr_l
AUGEN_O, AUGEN_U = [(17, 9), (18, 9), (21, 9), (22, 9)], [(17, 10), (18, 10), (21, 10), (22, 10)]


def frame(i):
    k = G.ebene(rumpf)
    if Hm.folge(i, 28, [1] * 3, N) or Hm.folge(i, 58, [1] * 3, N):
        Hm.setze(k, {p: FELL for p in AUGEN_O}, OFF)
        Hm.setze(k, {p: FELL_D for p in AUGEN_U}, OFF)
    o_r = G.ebene(ohr_r)
    if Hm.folge(i, 20, [1] * 3, N):
        o_r = L.spalten_welle(o_r, G.PL + 22, 1.0, math.pi / 2)
    o_l = G.ebene(ohr_l)
    if Hm.folge(i, 44, [1] * 3, N):
        Hm.zeilen_versatz(o_l, OFF, {0: 1, 1: 1})
    ph = L.sinus(i, 16)
    wl = L.spalten_welle(G.ebene(fl_l), G.PL + 9, 3.0, ph)
    wr = L.spalten_welle(G.ebene(fl_r), G.PL + 30, 3.0, ph)
    dy = -int(round(0.8 * math.sin(ph - 0.5)))
    return L.zusammen(H, W, [(wl, 0, dy), (wr, 0, dy), (o_l, 0, dy), (o_r, 0, dy), (k, 0, dy)])


if __name__ == '__main__':
    N4.abschluss(G, 'Winged Haressassin', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
