# -*- coding: utf-8 -*-
"""Idle-Animation für „Nimble Monkee“ (Creature).

Quelle: src/nimble-monkee.png — das obere, vollständige Äffchen (16×22 px, 14 Farben, 221 px) aus der Ebene 288 „Monkee-Kopie“ von MotiveIndia.xcf, Figur 2; mit der Kartenkunst
(data/card-art/native/Nimble_Monkee.png: oben, mit erhobenem rechten Arm und großen schwarzen Augen; Pixel für Pixel gleich) abgeglichen. Auf der Karte steht darunter ein zweites Äffchen (gleiche
Figur, unten vom Kartenrand abgeschnitten, mit geschlossenen „^“-Augen) — ein zweites Exemplar, nicht verwendet (die obere ist die vollständige Hauptfigur).
PICK: [["MotiveIndia", 288, 2]]

Aufruf:   python3 nimble_monkee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/nimble-monkee.png + .json

Identifikation (Sprite 16×22, Äffchen von vorn im Stand, rechter Arm winkend):
* Kopf (x 1–13, Zeilen 0–9): braunes Fell (B/E/G), Gesicht hell (D/H, Haut), Umriss A (65,25,5); Ohren = je zwei Hautpixel (0–1, 5–6) und (12–13, 5–6).
* Augen: große schwarze 2×2-Blöcke I (0,0,0) links (5–6, 5–6), rechts (9–10, 5–6), jeweils mit einem weißen Glanzpixel L (6,5) / (10,5) oben (Augenglanz im Auge, kein Metall).
* Arme: rechter Arm erhoben (x 11–15, Zeilen 8–10, Hand (13–14, 9–10) hell); linker Arm hängt außen (x 1–4, Zeilen 11–18) mit Hand (2–3, 16–17).
* Rumpf (x 4–12, Zeilen 11–19) braun mit hellem Bauch; Beine/Füße unten (x 5–11, Zeilen 17–21).
* Kein Glanz (Fell, Regel 14), kein Schwanz sichtbar, keine Partikel.
Bleibt fest: Rumpf, Beine, Gesichtsmuster außer Lidern.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Winken (Periode 12, 4× pro Schleife): die Spalten des erhobenen Arms wandern senkrecht, je weiter von der Schulter desto mehr (Handspitze bis ±2 px); die Schulter bleibt am Rumpf (äußerste Spalte nimmt den Anteil ihrer Nachbarin).
* Wippen (Periode 12): das ganze Äffchen hebt sich beim Abschlag um 1 px.
* Linker Arm pendelt (Periode 16, 3× pro Schleife): die Zeilen 14–18 des hängenden Arms wandern waagerecht um höchstens 1 px (benachbarte Zeilen höchstens 1 px Unterschied); Schulter bleibt.
* Kopfwackeln (Periode 24, 2× pro Schleife): die Kopfzeilen 0–8 wandern waagerecht, je höher desto mehr (bis ±1 px); Hals und Rumpf bleiben.
* Blinzeln (Frames 8–11 und 30–33): die schwarzen Augenblöcke schließen sich in der Hautfarbe D (Lid = Körperfarbe), erst die untere Zeile, dann beide, dann wieder auf.
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
PAD_L, PAD_R, PAD_T, PAD_B = 3, 2, 3, 3

spr = L.lade('nimble-monkee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

arm_r = vorhanden & (((xx >= 12) & (yy >= 8) & (yy <= 10)) | ((xx == 11) & (yy == 9)))
arm_l = vorhanden & (xx <= 4) & (yy >= 14) & (yy <= 18)
koerper = vorhanden & ~arm_r & ~arm_l

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HAUT = (224, 179, 125)                                           # D
AUGEN = [(5, 5), (6, 5), (9, 5), (10, 5), (5, 6), (6, 6), (9, 6), (10, 6)]
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
            if lid == 2 or y == 6:
                setze(k, x, y, HAUT)


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = int(round(-1.0 * math.sin(ph)))                         # Bob: Abschlag → Körper hebt sich
    k = teil(koerper)
    gesicht(k, i)
    k = T.scherung_zeilen(k, PAD_T + 0, PAD_T + 8, PAD_T + 9, 1.4, math.sin(L.sinus(i, 24)))      # Kopfwackeln
    ar = T.biegen_spalten(teil(arm_r), PAD_L + 11, 2.4, ph)                                      # Winken
    al = T.scherung_zeilen(teil(arm_l), PAD_T + 14, PAD_T + 18, PAD_T + 13, 1.2, math.sin(L.sinus(i, 16)))   # linker Arm pendelt
    ebenen = {'koerper': k, 'arm_r': ar, 'arm_l': al}
    wahl = nur or ('koerper', 'arm_r', 'arm_l')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('nimble-monkee', 'Nimble Monkee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/nimble-monkee-strip.png', frames, spalten=12, scale=8)
