# -*- coding: utf-8 -*-
"""Idle-Animation für „Criminal Monkee“ (Creature).

Quelle: src/criminal-monkee.png — der maskierte Äffchen-Dieb (15×21 px, 15 Farben, 230 px) aus der Ebene 294 „Criminal Monkee“ von MotiveIndia.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Criminal_Monkee.png: Mitte, vor den zwei Gemälden; Pixel für Pixel gleich) abgeglichen. Auf der Karte gehören zur Szene außerdem zwei gerahmte Affenbilder
(Ebenen 296/297, Staffelei), eine schräge Brechstange (Ebene 293 „Criminal Monkee #2“, 10×10, 23 px) und orange Bananen — Beiwerk, keine Figur, nicht verwendet. Die einzige Äffchen-Figur der Karte
(die beiden Affengesichter in den Rahmen sind Gemälde) ist dieses Äffchen; eine Alternative gibt es nicht.
PICK: [["MotiveIndia", 294, 1]]

Aufruf:   python3 criminal_monkee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/criminal-monkee.png + .json

Identifikation (Sprite 15×21, Äffchen von vorn mit Ganovenmaske und gestreiftem Hemd):
* Kopf (x 1–13, Zeilen 0–9): braunes Fell (H/K/L), Haut E/I/J; Ohren links (0–2, 7–8); darunter eine schwarze Räubermaske A (0,0,0) über die ganze Gesichtsbreite (Zeilen 5–6) mit zwei Augenschlitzen:
  links weiß F (6,6) + grau N (7,6), rechts weiß F (11,6) + grau N (12,6); darunter Nase/Mund-Bereich (Haut E/M).
* Rumpf (x 3–12, Zeilen 10–17): schwarz-weiß gestreiftes Hemd (A/D/F/G), oben ein Schal/Kragen (3–5,10–11).
* Arme: der rechte Arm hängt außen (x 11–14, Zeilen 14–18) mit Hand (12–13, 16–17); die linke Seite ist vom Rumpf nicht abgesetzt.
* Füße (Haut, braun umrandet): links (x 1–5, Zeilen 18–20), rechts (x 9–12, Zeilen 18–20).
* Kein Glanz (Fell/Stoff, Regel 14), keine Partikel; Weiß in den Augen sind Augen, kein Glanz.
Bleibt fest: Gesichtsmuster außer den Augen, Hemdstreifen.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Wippen (Periode 12, 4× pro Schleife): das ganze Äffchen hebt sich beim Abschlag um 1 px.
* Kopf wackelt (Periode 24, 2× pro Schleife): die Kopfzeilen 0–8 wandern waagerecht, je höher desto mehr (bis ±1 px); Hals/Hemd bleiben.
* Blinzeln (Frames 10–12 und 34–36): die Augen hinter der Maske schließen sich in der Maskenfarbe Schwarz (Lid = Körper-/Maskenfarbe).
* Blick (Frames 22–29 und 44–47): in beiden Schlitzen tauschen Weiß und Grau die Plätze (die Augen schauen zur Seite); nie während eines Blinzelns, ≥ 4 Frames Abstand.
* Hand wippt (Periode 16, 3× pro Schleife): die Handzeilen 16–18 am rechten Arm wandern waagerecht um höchstens 1 px (höchstens 1 px Unterschied zwischen benachbarten Zeilen).
* Fuß tippt (Frames 14–17 links, 38–41 rechts): der Fuß verkürzt sich um eine Zeile (der Fuß hebt sich 1 px), der andere bleibt.
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
PAD_L, PAD_R, PAD_T, PAD_B = 2, 3, 3, 3

spr = L.lade('criminal-monkee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

arm_r = vorhanden & (xx >= 12) & (yy >= 14) & (yy <= 18)
fuss_l = vorhanden & (xx <= 6) & (yy >= 18)
fuss_r = vorhanden & (xx >= 8) & (xx <= 11) & (yy >= 18)
koerper = vorhanden & ~arm_r & ~fuss_l & ~fuss_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

MASKE = (0, 0, 0)
AUGEN_L = [(6, 6), (7, 6)]                                       # weiß, grau
AUGEN_R = [(11, 6), (12, 6)]
BLINK = {10, 11, 12, 34, 35, 36}
BLICK = set(range(22, 30)) | set(range(44, 48))
FUSS_L, FUSS_R = {14, 15, 16, 17}, {38, 39, 40, 41}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def orig(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


def augen(k, i):
    if i in BLINK:
        for (x, y) in AUGEN_L + AUGEN_R:
            setze(k, x, y, MASKE)
    elif i in BLICK:
        for (a, b) in (AUGEN_L, AUGEN_R):                         # Weiß und Grau tauschen
            setze(k, a[0], a[1], orig(*b))
            setze(k, b[0], b[1], orig(*a))


def frame(i, nur=None):
    dy = 0                                                        # Nutzer-Feedback: Criminal Monkee schwebt nicht, er steht
    k = teil(koerper)
    augen(k, i)
    # (Nutzer-Feedback: nicht so viel seitwärts – das Kopfwackeln entfällt)
    ar = T.scherung_zeilen(teil(arm_r), PAD_T + 16, PAD_T + 18, PAD_T + 15, 1.2, math.sin(L.sinus(i, 16)))   # Hand wippt
    fl = teil(fuss_l)
    fr_ = teil(fuss_r)
    if i in FUSS_L:
        fl = L.heben_unten(fl, PAD_T + 18, 1)
    if i in FUSS_R:
        fr_ = L.heben_unten(fr_, PAD_T + 18, 1)
    ebenen = {'koerper': k, 'arm_r': ar, 'fuss_l': fl, 'fuss_r': fr_}
    wahl = nur or ('koerper', 'arm_r', 'fuss_l', 'fuss_r')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('criminal-monkee', 'Criminal Monkee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/criminal-monkee-strip.png', frames, spalten=12, scale=8)
