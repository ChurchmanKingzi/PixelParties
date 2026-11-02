# -*- coding: utf-8 -*-
"""Idle-Animation für „Jumper Spider“ (Creature).

Quelle: src/jumper-spider.png — Ebene „Ebene #308“ (17×13 px, 5 Farben) aus MotiveGN.xcf (Ebene 278): die schwarze Springspinne von vorn mit zwei roten Augen. Auf der Karte
liegt dahinter eine große, unscharfe, halbtransparente Sprungspur („Motion Blur“, Ebene 281, 20×32 px mit 187 Alphastufen, weiche Verläufe) — sie ist kein Pixelart und kein
Teil des Sprites (Regel „Alpha nur 0/255“) und wurde nicht übernommen. Das ist die vollständige, saubere Figur; die zweite Kopie in der Ebene „SPODDERS“ (Ebene 280, Figur 4) ist dasselbe Bild.
PICK: [["MotiveGN", 278, "ganze Ebene"]]

Aufruf:   python3 jumper_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/jumper-spider.png + .json

Identifikation (Sprite 17×13, Spinne von vorn, im Wesentlichen symmetrisch um x = 8):
* Körper (x 5–11, Zeilen 0–6): dunkelgraue Platten A (40,41,39) / B (31,32,30) / D (65,66,64); oben bei (8,0) ein einzelnes Pixel (Haarbüschel/Stirn).
* Augen: zwei rote Pixel E (255,2,0) bei (7,5) und (9,5) (Zeile 5).
* Beine: je Seite vier einpixelige Linien (links schwarz C (0,0,0) / B, rechts grau D / A, wie vom Künstler gezeichnet): zwei nach oben geknickte Vorderbeine (Wurzeln (4,1) und (4,3) bzw.
  (12,1) und (12,3), Knie bei (0,5) bzw. (16,5)) und zwei nach unten stehende Hinterbeine (Wurzeln (4,6) (5,7) (6,7) bzw. (12,6) (11,7) (10,7), Füße bei (1,11) (3,12) bzw. (15,11) (13,12)).
  Die Beine berühren sich diagonal — sie werden je Seite als ein Gelenkgeflecht bewegt (Pfade ab dem Körper, 8er-Linien zwischen verschobenen Gelenken).
* Keine Edelsteine/Metall → kein Glanz/Glitzer (Regel 14). Kein Schwanz, kein Mund.
Bleibt fest: Füße am Boden (Regel 18: kein Hüpfen/Schweben — „Jumper“ duckt sich nur), Augenfarbe.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Sprungbereit ducken: zweimal pro Schleife (Frames 6–16 und 30–40) senkt sich der Körper in drei Stufen um bis zu 2 px, die Beine knicken dabei ein (die Wurzeln gehen mit dem Körper
  nach unten, die Füße bleiben am Boden, die Knie spreizen nach außen) und strecken sich wieder — die Beine werden als Pfad neu gezeichnet, nichts wird dupliziert oder gestreckt.
* Fußtippeln: alternierend zieht je Seite die Fußspitze für 3 Frames an (links Frames 20–22 und 44–46, rechts 24–26 und 2–4 … je 2× pro Schleife).
* Blinzeln: beide Augen schließen sich 2× pro Schleife (Frames 12–13 mitten im Ducken und 36–37); Lid = Körperfarbe B; zusätzlich blinzelt das linke Auge allein in Frames 28–29.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel — nur die Bein-Gelenklinien (8er-Linien zwischen verschobenen Gelenken) übernehmen die Farbe des jeweiligen Beinpixels.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_spinne as S

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 3

spr = L.lade('jumper-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
KOERPER_ZEILEN = {0: (8, 8), 1: (5, 11), 2: (6, 10), 3: (5, 11), 4: (6, 10), 5: (5, 11), 6: (6, 10)}
koerper_maske = np.zeros_like(vor)
for y, (a, b) in KOERPER_ZEILEN.items():
    koerper_maske[y, a:b + 1] = True
koerper_maske &= vor
beine = S.zerlege_beine(spr, vor & ~koerper_maske, koerper_maske, mitte_x=8)
AUGEN = {'l': (7, 5), 'r': (9, 5)}
LID = (31, 32, 30)
STUFEN = [0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0]           # Ducken: 11 Frames


def zustand(i):
    duck = 0
    for s in (6, 30):
        if 0 <= i - s < len(STUFEN):
            duck = STUFEN[i - s]
    fuss_l = any(0 <= (i - s) % N < 3 for s in (20,) ) or 0 <= (i - 44) % N < 3
    fuss_r = 0 <= (i - 24) % N < 3 or 0 <= (i - 2) % N < 3
    lid_beide = any(0 <= i - s < 2 for s in (12, 36))
    lid_l = 0 <= i - 28 < 2
    return duck, fuss_l, fuss_r, lid_beide, lid_l


def frame(i, nur=None):
    duck, fuss_l, fuss_r, lid_b, lid_l = zustand(i)
    k, _ = L.trenne(spr, koerper_maske)
    k = L.platz(k, H, W, PAD_L, PAD_T + duck)
    if lid_b or lid_l:
        for key in ('l', 'r'):
            if lid_b or key == 'l':
                x, y = AUGEN[key]
                k[PAD_T + duck + y, PAD_L + x, :3] = LID
    bl = L.leer(H, W)
    for b in beine:
        sg = -1 if b['seite'] == 'l' else 1

        def wirk(n, sg=sg):
            dy = round(duck * (1 - n['anteil']))
            dx = round(sg * (duck / 2.0) * math.sin(math.pi * n['anteil']))
            return dx, dy
        kuerz = 1 if ((fuss_l and b['seite'] == 'l') or (fuss_r and b['seite'] == 'r')) else 0
        S.zeichne_bein(bl, b, wirk, PAD_L, PAD_T, kuerzen=kuerz)
    ebenen = {'koerper': k, 'beine': bl}
    wahl = nur or ('koerper', 'beine')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('jumper-spider', 'Jumper Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/jumper-spider-strip.png', frames, spalten=12, scale=10)
