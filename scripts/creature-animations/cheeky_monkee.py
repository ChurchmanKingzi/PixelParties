# -*- coding: utf-8 -*-
"""Idle-Animation für „Cheeky Monkee“ (Creature).

Quelle: src/cheeky-monkee.png — das springende Äffchen (17×22 px, 13 Farben, 204 px) aus der Ebene 298 „Monkee“ von MotiveIndia.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Cheeky_Monkee.png: das Äffchen links oben mit ausgestreckten Armen, daneben ein kleiner grauer Stein; Pixel für Pixel gleich) abgeglichen. Auf der Karte steht rechts ein zweites,
stehendes Äffchen (Figur 3 derselben Ebene, 16×22) — ein zweites Exemplar, nicht verwendet (eine Figur pro Karte; die springende ist die „freche“, die Wurfpose).
PICK: [["MotiveIndia", 298, 1]]

Aufruf:   python3 cheeky_monkee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cheeky-monkee.png + .json

Identifikation (Sprite 17×22, Äffchen von vorn im Sprung, Arme zu den Seiten ausgestreckt):
* Kopf (x 2–14, Zeilen 0–9): braunes Fell (B/E/F), Gesicht hell (D/I, Haut), Umriss A (65,25,5); Ohren = je zwei Hautpixel D (2,5)–(2,6) / (13,5)–(13,6) mit Umriss.
  Augen: je ein schwarzes Pixel-Paar G (6–7,6) / (10–11,6) mit schwarzem Pixel darunter (7,7) / (11,7) und weißem Sklera-Pixel L (6,7) / (10,7); darüber je eine schwarze Braue G (6–7,4) / (10–11,4).
* Arme: links waagerecht ausgestreckt (x 0–5, Zeilen 10–12; Hand hell (1,11) I); rechts schräg nach oben (x 12–16, Zeilen 8–11; Hand (14,9) I / (15,9) H).
* Rumpf und Beine (x 5–12, Zeilen 10–21): braun, Bauch heller (I/D), unten die Füße (x 5–8, Zeilen 17–21).
* Kein Glanz (Fell, Regel 14). Kein Schwanz sichtbar. Der Stein der Karte ist nicht Teil der Figur.
Bleibt fest: Gesichtsmuster außer den Lidern, Rumpf.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Arme schwingen (Periode 12, 4× pro Schleife, gegenläufig): jede Armspalte wandert senkrecht, je weiter von der Schulter desto mehr (Handspitze bis ±2 px); die Schulter bleibt am Rumpf.
* Hüpfen/Bob (Periode 12): das ganze Äffchen hebt sich beim Abschlag um 1 px.
* Beine baumeln (Periode 16, 3× pro Schleife): die Zeilen ab Zeile 16 (Füße) wandern waagerecht, je weiter unten desto mehr (bis ±2 px).
* Kopfwackeln (Periode 24, 2× pro Schleife): die Kopfzeilen 0–8 wandern waagerecht, je höher desto mehr (bis ±1 px) — frech; Hals und Rumpf bleiben.
* Blinzeln (Frames 8–11 und 30–33): die Augen schließen sich in der Hautfarbe D (Lid = Körperfarbe), erst die untere Zeile, dann beide, dann wieder auf.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16); sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 3

spr = L.lade('cheeky-monkee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

arm_l = vorhanden & (xx <= 4) & (yy >= 10) & (yy <= 12)
arm_r = vorhanden & (((xx >= 12) & (yy >= 8) & (yy <= 10)) | ((xx >= 13) & (yy == 11)))
koerper = vorhanden & ~arm_l & ~arm_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HAUT = (224, 179, 125)                                           # D
AUGEN = [(6, 6), (7, 6), (10, 6), (11, 6), (6, 7), (7, 7), (10, 7), (11, 7)]
BLINK = {8: 1, 9: 2, 10: 2, 11: 1, 30: 1, 31: 2, 32: 2, 33: 1}    # 1 = untere Augenzeile zu, 2 = beide Zeilen zu


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def gesicht(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        for (x, y) in AUGEN:
            if lid == 2 or y == 7:
                setze(k, x, y, HAUT)


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = int(round(-1.0 * math.sin(ph)))                         # Bob: Abschlag → Körper hebt sich
    k = teil(koerper)
    gesicht(k, i)
    k = T.scherung_zeilen(k, PAD_T + 16, PAD_T + 21, PAD_T + 15, 2.2, math.sin(L.sinus(i, 16)))   # Beine baumeln
    k = T.scherung_zeilen(k, PAD_T + 0, PAD_T + 8, PAD_T + 9, 1.4, math.sin(L.sinus(i, 24)))      # Kopfwackeln
    al = T.biegen_spalten(teil(arm_l), PAD_L + 5, 2.6, ph, potenz=1.0)
    ar = T.biegen_spalten(teil(arm_r), PAD_L + 11, 2.6, ph + math.pi, potenz=1.0)
    ebenen = {'koerper': k, 'arm_l': al, 'arm_r': ar}
    wahl = nur or ('koerper', 'arm_l', 'arm_r')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cheeky-monkee', 'Cheeky Monkee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cheeky-monkee-strip.png', frames, spalten=12, scale=8)
