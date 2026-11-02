# -*- coding: utf-8 -*-
"""Idle-Animation für „Baby Spider“ (Creature).

Quelle: src/baby-spider.png — das winzige Spinnenbaby mit blauen Augen (11×6 px, 9 Farben) aus MotiveGN.xcf (Ebene 148, Figur 4 „Ebene #242“, 30×15 px). Die Figur der Ebene enthält
außer der Spinne eine bogenförmige Perlenkette aus weißen/grauen 2×2-Perlen (Dekor über der Spinne, Farben (217,217,217) / (179,179,179) / (253,253,253)) und rechts daneben eine
rotäugige Lochspinne (anderes Dekor-Sprite). Beides gehört nicht zur Creature und wurde aus dem Sprite entfernt (src/baby-spider.png = nur die Spinne; 38 Pixel).
PICK: [["MotiveGN", 148, 4]]   (davon nur die Spinne: Ebenenpixel x 7–17, y 5–10 der extrahierten Figur, ohne die grauen/weißen Perlenpixel)

Aufruf:   python3 baby_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/baby-spider.png + .json

Identifikation (Sprite 11×6, Koordinaten im zugeschnittenen Sprite; die Spinne ist wie alle Dekor-Spinnen dieser Ebene aus einzelnen Diagonalpixeln „gerastert“):
* Körper: dunkelgrau o (40,41,39) / g (31,32,30) / h (39,40,38) / n (64,65,63) / F (65,66,64) — Kopf-/Rückenfläche x 2–9, Zeilen 0–4.
* Augen: zwei blaue Pupillen b (65,117,166) / (66,117,166) bei (4,3) und (6,3), mit je einem weißen Pixel W (253,253,253) daneben (3,3) bzw. (7,3) und je einem weißen Glanzpunkt
  darüber (4,2) bzw. (6,2) (Teil der Augen, keine Partikel).
* Beine: schwarze Diagonalpixel (0,0,0): links (2,0) (1,1) (0,3) (1,4) (3,4) (4,4) (0,5) (2,5), rechts dunkelgraue Pixel (8,0) (9,1) (9,2) (10,3) (9,4) (8,5) — einzeln gerasterte Beinlinien,
  nicht zusammenhängend gezeichnet; sie werden deshalb nur an den äußersten Pixeln bewegt.
* Keine Edelsteine/Metall → kein Glanz/Glitzer.
Bleibt fest: Körper, Augen (außer Blinzeln), Beinansätze.

Ablauf (40 Frames à 80 ms = 3,2 s), Frame 0 = Original:
* Vorderbeine winken: die Spitzen der beiden oberen Beine ((2,0) links, (8,0) rechts) schwingen 1 px nach außen und zurück (je 2× pro Schleife, links und rechts versetzt) — bleiben mit dem
  Beinpixel darunter 4er-verbunden.
* Krabbelschritt: die Fußpixel knicken wechselweise für 3 Frames 1 px nach oben (Gruppe A (0,3) (2,5) (10,3), Gruppe B (0,5) (8,5) (9,4); jede Gruppe 3× pro Schleife), jeweils an einen
  Nachbarpixel desselben Beins angeschlossen.
* Trippeln: zweimal pro Schleife (Frames 10–13 und 30–33) huscht die ganze Spinne 1 px zur Seite (erst rechts, dann links), die Füße zucken dabei mit.
* Blinzeln: zweimal pro Schleife (Frames 17–19 und 35–37): erst werden die Pupillen dunkel, dann auch die weißen Augenpixel (Lid = Körperfarbe g).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L

N, MS = 40, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 3

spr = L.lade('baby-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
LID = (31, 32, 30)
PUPILLEN = [(4, 3), (6, 3)]
WEISS = [(3, 3), (7, 3), (4, 2), (6, 2)]
VORDERBEIN = {'l': ((2, 0), (1, 0)), 'r': ((8, 0), (9, 0))}                 # Spitze → ausgelenkte Position
FUSS_A = [((0, 3), (0, 2)), ((2, 5), (2, 4)), ((10, 3), (10, 2))]
FUSS_B = [((0, 5), (0, 4)), ((8, 5), (8, 4)), ((9, 4), (9, 3))]


def in_fenster(i, starts, laenge):
    return any(0 <= i - s < laenge for s in starts)


def zustand(i):
    dx = 1 if in_fenster(i, (10,), 4) else (-1 if in_fenster(i, (30,), 4) else 0)
    wl = any(0 <= i - st < 4 and (i - st) % 2 == 0 for st in (6, 26))
    wr = any(0 <= i - st < 4 and (i - st) % 2 == 0 for st in (14, 34))
    fa = in_fenster(i, (2, 14, 26), 3)
    fb = in_fenster(i, (8, 20, 32), 3)
    lid = 0
    for st in (17, 35):
        if 0 <= i - st < 3:
            lid = (1, 2, 1)[i - st]
    return dx, wl, wr, fa, fb, lid


def frame(i, nur=None):
    dx, wl, wr, fa, fb, lid = zustand(i)
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    off = (PAD_L, PAD_T)
    paare = []
    if wl:
        paare.append(VORDERBEIN['l'])
    if wr:
        paare.append(VORDERBEIN['r'])
    if fa:
        paare += FUSS_A
    if fb:
        paare += FUSS_B
    # Beinspitzen zuerst an ihre neue Stelle (die alte wird frei)
    cache = {p: k[off[1] + p[1], off[0] + p[0]].copy() for p, _ in paare}
    for (vx, vy), _ in paare:
        k[off[1] + vy, off[0] + vx] = 0
    for (vx, vy), (nx, ny) in paare:
        k[off[1] + ny, off[0] + nx] = cache[(vx, vy)]
    if lid:
        for (x, y) in PUPILLEN + (WEISS if lid == 2 else []):
            k[off[1] + y, off[0] + x, :3] = LID
    return L.versetze(k, dx, 0) if dx else k


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('baby-spider', 'Baby Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/baby-spider-strip.png', frames, spalten=10, scale=14)
