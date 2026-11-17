# -*- coding: utf-8 -*-
"""Idle-Animation für „Resilient Monkee“ (Creature).

Quelle: src/resilient-monkee.png — das Äffchen mit rotem Fez (16×20 px, 15 Farben, 214 px) aus der Ebene 288 „Monkee-Kopie“ von MotiveIndia.xcf, Figur 3; mit der Kartenkunst
(data/card-art/native/Resilient_Monkee.png: rechts, mit Fez, grimmigem Blick und den Händen an den Kopfseiten; Pixel für Pixel gleich) abgeglichen. Auf der Karte steht links ein zweites Äffchen
(Figur 1 derselben Ebene, 19×23, mit ausgestreckten Armen und rotem, offenem Mund, daneben gelbe Treffer-Striche) — ein anderes Exemplar, nicht verwendet. Gewählt wurde das Äffchen mit Fez: Es kommt nur auf
dieser Karte vor (das linke ist ein von mehreren Karten genutztes Äffchen) und ist die „widerstandsfähige“ Pose.
PICK: [["MotiveIndia", 288, 3]]

Aufruf:   python3 resilient_monkee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/resilient-monkee.png + .json

Identifikation (Sprite 16×20, Äffchen von vorn, die Hände an den Kopfseiten):
* Fez (x 6–11, Zeilen 0–2): dunkelrot K/M/N (62,13,13) (113,24,24) (170,36,36), oben Quaste/Rand.
* Kopf (x 1–14, Zeilen 3–10): braunes Fell (C/E/G), Gesicht hell (D/J, Haut), Umriss A (65,25,5); grimmige Brauen (4,4) (5,5) / (9,4) (8,5).
* Augen: links (4,6) schwarz + (4,7) weiß + (5,7) schwarz; rechts (9,6) schwarz + (9,7) weiß + (8,7) schwarz (die Pupillen schauen zur Mitte).
* Arme: je ein Arm winkelt zum Kopf an (links x 0–3, rechts x 12–15, Zeilen 6–11); die Hände (Haut J/F) liegen bei (1–2, 8–9) und (13–14, 8–9).
* Rumpf (x 3–12, Zeilen 11–16): braun mit Bauchschatten H; unten zwei Beine/Füße (x 3–5 und 10–12, Zeilen 16–19).
* Kein Glanz (Fell/Stoff, Regel 14), kein Schwanz, keine Partikel.
Bleibt fest: Rumpf, Beine (außer Fußtippen).

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Arme pumpen (Periode 12, 4× pro Schleife, gleichzeitig): jede Armspalte wandert senkrecht, je weiter von der Schulter desto mehr (Hände bis ±2 px); die Schultern bleiben am Rumpf (äußerste Spalte nimmt den Anteil der Nachbarin).
* Wippen (Periode 12): das ganze Äffchen hebt sich beim Abschlag um 1 px.
* Kopf mit Fez wackelt (Periode 24, 2× pro Schleife): die Zeilen 0–9 wandern waagerecht, je höher desto mehr (bis ±1 px); Hals und Rumpf bleiben.
* Blinzeln (Frames 8–11 und 30–33): die Augen (schwarze Pupille + weißer Rand) schließen sich in der Hautfarbe D (Lid = Körperfarbe), erst die untere Zeile, dann beide, dann wieder auf.
* Blick (Frames 18–23 rechts, 40–45 links): nur das jeweilige Auge tauscht Weiß und Schwarz (Pupille nach außen) — der Blick wandert zur Seite; nie während eines Blinzelns (≥ 4 Frames Abstand).
* Fußtippen (Frames 14–17 links, 36–39 rechts): der Fuß verkürzt sich um eine Zeile (hebt sich 1 px), der andere bleibt.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Scherung an den Beinen.

Ergänzungen: Randpixel-Korrektur (Regel 16); sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 3

spr = L.lade('resilient-monkee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

arm_l = vorhanden & (xx <= 3) & (yy >= 6) & (yy <= 11)
arm_r = vorhanden & (xx >= 12) & (yy >= 6) & (yy <= 11)
fuss_l = vorhanden & (xx <= 5) & (yy >= 17)
fuss_r = vorhanden & (xx >= 10) & (yy >= 17)
koerper = vorhanden & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HAUT = (224, 179, 125)                                           # D
AUGE_L = [(4, 6), (4, 7), (5, 7)]
AUGE_R = [(9, 6), (9, 7), (8, 7)]
BLINK = {8: 1, 9: 2, 10: 2, 11: 1, 30: 1, 31: 2, 32: 2, 33: 1}    # 1 = untere Augenzeile zu, 2 = beide Zeilen zu
BLICK_R = set(range(18, 24))                                     # rechtes Auge tauscht → Blick nach rechts
BLICK_L = set(range(40, 46))                                     # linkes Auge tauscht → Blick nach links
FUSS_L, FUSS_R = {14, 15, 16, 17}, {36, 37, 38, 39}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def orig(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def augen(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        for (x, y) in AUGE_L + AUGE_R:
            if lid == 2 or y == 7:
                setze(k, x, y, HAUT)
        return
    for sel, (a, b) in ((BLICK_R, ((8, 7), (9, 7))), (BLICK_L, ((4, 7), (5, 7)))):
        if i in sel:                                               # Weiß und Schwarz im Auge tauschen
            ca, cb = orig(*a), orig(*b)
            setze(k, a[0], a[1], cb)
            setze(k, b[0], b[1], ca)


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = 0                                                       # Nutzer-Feedback: steht am Boden, kein Hüpfen
    k = teil(koerper)
    augen(k, i)
    # (Nutzer-Feedback: der Kopf bewegt sich nicht nach links/rechts)
    al = T.biegen_spalten(teil(arm_l), PAD_L + 4, 2.4, ph)                                       # Arme pumpen
    ar = T.biegen_spalten(teil(arm_r), PAD_L + 11, 2.4, ph)
    fl = teil(fuss_l)
    fr_ = teil(fuss_r)
    if i in FUSS_L:
        fl = L.heben_unten(fl, PAD_T + 17, 1)
    if i in FUSS_R:
        fr_ = L.heben_unten(fr_, PAD_T + 17, 1)
    ebenen = {'koerper': k, 'arm_l': al, 'arm_r': ar, 'fuss_l': fl, 'fuss_r': fr_}
    wahl = nur or ('koerper', 'arm_l', 'arm_r', 'fuss_l', 'fuss_r')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('resilient-monkee', 'Resilient Monkee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/resilient-monkee-strip.png', frames, spalten=12, scale=8)
