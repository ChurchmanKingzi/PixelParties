# -*- coding: utf-8 -*-
"""Idle-Animation für „Haressassin“ (Creature) — der weiße Hasen-Assassine mit dem roten Auge, dem blauen Halstuch und dem langen, waagerecht vorgestreckten Schwert.

Quelle: src/haressassin.png (40×27 px, 26 Farben).
PICK: [["Motive", 617, 1]]     (Ebene „Haressassin #4“, Figur 1; 100 % Treffer, nur in dieser Karte; Figur samt Schwert vollständig. Ebene 78 „Attack #3“ ist dieselbe Figur mit 1 px Leerrand.
  Die Frau/der Schatten dahinter in der Kartenkunst sind Kulisse.)

Aufruf:   python3 haressassin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/haressassin.png + .json

Was im Sprite ist (x, y im 40×27-Sprite; Blick nach rechts):
* OHREN: linkes Ohr schräg nach oben links (x 0–6, y 0–6), rechtes Ohr waagerecht nach rechts (x 9–16, y 2–5); weißgrau (215)/(172), brauner Umriss (49,24,0).
* KOPF (x 3–12, y 6–12): weißes Fell; schwarze Brauen/Fellzeichnung (4–5,8), (6,9), (10–11,9) [Spalten laut Pixelkarte]; das OFFENE Auge (6–7, 10–11): hellblau (172,213,255)/weiß (246,255,255) links, dunkelrot/rot (255,0,0) rechts;
  das zweite Auge (10–11, 11) ist ein schwarzer Strich (zugekniffen/im Schatten) → es blinzelt nur das offene Auge (Regel 21).
* HALSTUCH (y 13–14) blau (26,26,204)/(32,32,255). RUMPF (y 15–23): graue/olivfarbene Rüstung mit blauem Gürtel (y 19); linker Arm hängt (x 0–4, y 14–21, Hand (1–2,20)).
* SCHWERTARM (x 12–15, y 14–17) waagerecht nach rechts; Griff/Parierstange weinrot (x 16–19, y 14–17), KLINGE (x 20–39, y 15–16): oben hell (204,204,196), unten Stahlgrau (122,121,117).
* BEINE/STIEFEL (y 20–26) mit blauen Stulpen (y 25).
Metall: nur die Klinge → Lichtband läuft die Klinge entlang (Regel 12/14). Kein Feuer, keine Partikel.

Idee: Der Assassine lauert mit vorgehaltenem Schwert – die Klinge wippt als starre Einheit mit dem Arm leicht auf und ab, ein Lichtreflex läuft die Klinge entlang, die Hasenohren zucken.
Ablauf (64 Frames à 70 ms = 4,5 s, nahtlos):
* Schwertarm (Arm + Griff + Klinge, alles x ≥ 12 in y 14–17) als STARRE Einheit: 1 px hoch (Frames 3–13), Ruhe, 1 px tief (Frames 19–29), Ruhe … (Periode 32). Nichts wird gestreckt; die Schulter (x ≤ 11) bleibt.
* Atmen (Periode 32, um 8 Frames versetzt): Beinzeile 22 wird einmal texturiert eingefügt (anim_textur) – Rumpf, Arme, Schwert und Kopf steigen 1 px, Stiefel bleiben.
* Lichtband: läuft in den Frames 36–47 von der Parierstange zur Spitze über die Klinge (obere Zeile (204,204,196) → Weiß (240,240,240), untere (122,121,117) → (204,204,196)).
* Ohrzucken: rechtes Ohr (Spalten x 11–16) knickt in den Frames 8–10 und 50–52 an der Spitze 1 px nach unten (Spaltenversatz mit dem Abstand zum Ansatz, Ansatz fest); linkes Ohr (Zeilen 0–3) zuckt in den Frames
  22–24 um 1 px nach rechts (Zeilenversatz, Ansatz fest).
* Blinzeln (Frames 30–32 und 58–60): nur das offene Auge (6–7, 10–11) nimmt die Fellfarbe (198,198,198)/(172,172,172) an.
Frame 0 = Original. Ergänzungen: keine (der Arm schiebt sich nur vor freiem Hintergrund).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 64, 70
G = N4.Figur('haressassin', 2, 2, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
FELL, FELL_D, UMRISS = f(5, 9), f(4, 9), f(0, 0)
KL_H, KL_D, KL_W = f(20, 15), f(20, 16), f(8, 11)          # (204,204,196), (122,121,117), (240,240,240)
G.erlaubt = G.erlaubt | {KL_W}                             # der Lichtreflex liegt an der Klingenoberkante (kein Umrissfehler)
arm = G.da & (G.xx >= 12) & (G.yy >= 13) & (G.yy <= 18)
klinge = G.da & (G.xx >= 20) & (G.yy >= 14)
ohr_r = G.da & (G.xx >= 11) & (G.yy <= 5)
ohr_l = G.da & (G.yy <= 3) & (G.xx <= 7)
rumpf = G.da & ~arm & ~ohr_r & ~ohr_l


def frame(i):
    k = G.ebene(rumpf)
    if Hm.folge(i, 30, [1] * 3, N) or Hm.folge(i, 58, [1] * 3, N):
        Hm.setze(k, {(6, 10): FELL, (7, 10): FELL, (6, 11): FELL_D, (7, 11): FELL_D}, OFF)
    o_r = G.ebene(ohr_r)
    if Hm.folge(i, 8, [1] * 3, N) or Hm.folge(i, 50, [1] * 3, N):
        o_r = L.spalten_welle(o_r, G.PL + 10, 1.0, math.pi / 2)
    o_l = G.ebene(ohr_l)
    if Hm.folge(i, 22, [1] * 3, N):
        Hm.zeilen_versatz(o_l, OFF, {0: 1, 1: 1})
    a = G.ebene(arm)
    j = (i - 36) % N
    if j < 12:
        xm = 20 + j * 2
        for x in range(xm - 1, xm + 2):
            if 20 <= x <= 39:
                for y in (15, 16):
                    if spr[y, x, 3]:
                        c = f(x, y)
                        Hm.setze(a, {(x, y): KL_W if c == KL_H else KL_H if c == KL_D else c}, OFF)
    dy = -int(round(math.sin(L.sinus(i, 32))))
    fig = L.zusammen(H, W, [(o_l, 0, 0), (o_r, 0, 0), (k, 0, 0), (a, 0, dy)])
    if Hm.stufe(i - 8, 32, 1):
        fig = TX.streck_zeile(fig, G.PT + 22, 1)
    return G.schliessen(fig, lambda x, y: UMRISS)


if __name__ == '__main__':
    N4.abschluss(G, 'Haressassin', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
