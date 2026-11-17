# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Bunny“ (Creature).

Quelle: src/cute-bunny.png — Ebene „Cute Bunny #1“ (36×18 px, 15 Farben) aus MotiveMoe.xcf (Ebene 434). Die Ebene enthält drei Exemplare (wie auf der
Karte): ein liegendes (links oben), ein vorderes unten in der Mitte und das vordere rechts oben — verwendet wird das rechte obere (Komponente 2 der Ebene,
von creature_show.py nicht gelistet, daher von Hand ausgeschnitten): es ist das größte, sauberste und streng symmetrische.
PICK: [["MotiveMoe", 434, 2]]   (Komponente 2 = rechtes oberes Exemplar, bbox (34,0)–(69,17) der Ebene)

Aufruf:   python3 cute_bunny.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-bunny.png + .json

Identifikation (Sprite 36×18, weißes Hasenköpfchen von vorn mit schwarzen Fledermausflügeln, symmetrisch um x = 17,5):
* Ohren (links x 12–16, rechts x 19–23, Zeilen 4–7): dunkelblauer Umriss B (31,36,57), weiße Fläche E/G, rosa Innenpixel J (215,115,158) / K (255,179,212);
  zwischen den Ohren ein Stück Kopfumriss (17–18, 7).
* Kopf (x 13–22, Zeilen 8–14): weiß (E), Wangen/Schatten G (214,220,243) / L / H; Augen = je ein kleines schwarzes „^“ (0,1,0): links Spitze (14,10) mit Armen
  (13,11) (15,11), rechts Spitze (19,10) mit Armen (18,11) (20,11) — lächelnde Augen, in der Mitte darunter bleibt weißes E; rosa Wangenpunkte K bei (13,13) (20,13);
  Nase/Mund = zwei schwarze Pixel (16,13) (17,13).
* Kinn (Zeilen 15–17): blaugraue Schattenpixel M/L/I links und rechts, zwei Schneidezähne N (204,204,204) / O (255,255,255) bei (17–18, 15–16), darunter frei.
* Flügel (links x 0–12, rechts x 23–35, Zeilen 0–11): Fledermausflügel mit schwarzem Umriss A, Rippen A, Flächen C (51,51,51) / D (38,38,38) / F (64,64,64);
  Spitzen bei (6,0) und (29,0). Kein Schwanz, keine Füße im Bild.
* Kein Glanz (Fell/Stoff, Regel 14).
Bleibt fest: Gesichtsfläche, Wangenpunkte, Ohrinneres, Kinnschatten.

Ablauf (56 Frames à 66 ms = 3,7 s), alle Bewegungen unabhängig:
* Flügelschlag (Periode 14, 4× pro Schleife): jede Flügelspalte wandert senkrecht, je weiter vom Körper desto mehr (Spitze etwa −4 … +4 px); die Innenkante bleibt am
  Körper. Beide Flügel schlagen gleichzeitig; die Spalten werden danach mit dem Flügelumriss nachgezogen (siehe unten).
* Schweben: der ganze Hase hebt sich beim Abschlag um 1 px, die Flügel gehen mit.
* Ohrzucken: jedes Ohr 4× pro Schleife (links Frames 3/19/33/47, rechts 10/26/40/51, je 6 Frames): die oberen zwei Zeilen (4–5) schnippen 1 px nach außen und zurück,
  der innere Randpixel der Zeile 5 bleibt stehen (Umriss geschlossen).
* Blinzeln (Frames 8–11 und 33–36): die schwarzen „^“-Augen verschwinden in der Gesichtsfarbe E — erst die Spitzen, dann ganz, dann wieder die Spitzen.
* Blick: beide Augen wandern 1 px nach rechts (Frames 22–28 und 43–49) — nach links ist kein Platz, die linke Augenspitze säße am Kopfumriss; deshalb nur nach rechts.
* Nasenzucken & Nagen (Frames 15–21 und 39–45): die beiden Nasenpixel hüpfen eine Zeile tiefer und zurück (Zuckmuster 1-0-1-0-1-0), die Zähne werden dabei kurz
  1 px länger (die untere Zahnzeile wird dupliziert) — nur vorhandene Pixel, nichts erfunden.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Randpixel-Korrektur (Regel 16): Die Spaltenverschiebung der Flügel legt an den Außenkanten stellenweise graue Füllpixel frei. Dort wird ein Umrisspixel ergänzt
(anim_tiere.umriss_schliessen; Farbe aus dem Original: Füllfarbe → Flügelumriss A). Nur Umrisspixel kommen hinzu.

Ergänzungen: keine gemalten Pixel außer den ergänzten Flügel-Umrisspixeln (siehe oben) und der Zahnverlängerung (Duplikat der vorhandenen Zahnpixel).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 66
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

spr = L.lade('cute-bunny')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

FLUEGEL_FARBEN = [(0, 0, 0), (51, 51, 51), (38, 38, 38), (64, 64, 64)]       # A, C, D, F
fluegel = vorhanden & L.farbmaske(spr, FLUEGEL_FARBEN)
fl_l = fluegel & (xx < 18)
fl_r = fluegel & (xx >= 18)
koerper = vorhanden & ~fluegel
ohr_l = koerper & (xx >= 12) & (xx <= 16) & (yy >= 4) & (yy <= 5)
ohr_r = koerper & (xx >= 19) & (xx <= 23) & (yy >= 4) & (yy <= 5)
koerper = koerper & ~ohr_l & ~ohr_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

AUGE = (0, 1, 0)                                                   # H
GESICHT = (240, 243, 251)                                          # E
WANGE = (214, 220, 243)                                            # G
AUGEN = {'l': [(14, 10), (13, 11), (15, 11)], 'r': [(19, 10), (18, 11), (20, 11)]}   # Spitze zuerst, dann die Arme
NASE = [(16, 13), (17, 13)]
ZAHN_UNTEN = [((17, 16), (17, 17)), ((18, 16), (18, 17))]          # untere Zahnzeile → eine Zeile tiefer duplizieren


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def zustand(i):
    ph = L.sinus(i, 14)
    blick = 1 if (22 <= i < 29 or 43 <= i < 50) else 0
    lid = 0
    for s in (8, 33):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    nase = zahn = 0
    for s in (15, 39):
        if 0 <= i - s < 7:
            nase = (1, 0, 1, 0, 1, 0, 0)[i - s]
            zahn = (0, 1, 1, 0, 1, 1, 0)[i - s]
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (3, 19, 33, 47))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (10, 26, 40, 51))
    return ph, blick, lid, nase, zahn, ohr_li, ohr_re


def frame(i, nur=None):
    ph, blick, lid, nase, zahn, ohr_li, ohr_re = zustand(i)
    k = teil(koerper)
    # Augen: Blick (beide 1 px nach rechts) und Blinzeln (Lid = Gesichtsfarbe)
    if blick:
        for seite in ('l', 'r'):
            for (x, y) in AUGEN[seite]:
                setze(k, x, y, WANGE if (x, y) == (13, 11) else GESICHT)
        for seite in ('l', 'r'):
            for (x, y) in AUGEN[seite]:
                setze(k, x + 1, y, AUGE)
    if lid:
        for seite in ('l', 'r'):
            teile = AUGEN[seite][:1] if lid == 1 else AUGEN[seite]
            for (x, y) in teile:
                setze(k, x + blick, y, GESICHT)
    if nase:
        for (x, y) in NASE:
            setze(k, x, y, GESICHT)
            setze(k, x, y + 1, AUGE)
    if zahn:
        for (x, y), (x2, y2) in ZAHN_UNTEN:
            setze(k, x2, y2, tuple(int(v) for v in spr[y, x, :3]))
    dy = int(round(-0.9 * math.sin(ph)))                          # Schweben: Abschlag → Körper hebt sich
    fl = L.spalten_welle(teil(fl_l), PAD_L + 13, 4.6, ph, potenz=1.1, bias=0.45)
    fr_ = L.spalten_welle(teil(fl_r), PAD_L + 22, 4.6, ph, potenz=1.1, bias=0.45)
    ol = T.zucken_zeilen(teil(ohr_l), PAD_T + 6, -1.2 * ohr_li, {PAD_T + 4: 1.0, PAD_T + 5: 1.0}, innen='rechts')
    orr = T.zucken_zeilen(teil(ohr_r), PAD_T + 6, 1.2 * ohr_re, {PAD_T + 4: 1.0, PAD_T + 5: 1.0}, innen='links')
    ebenen = {'koerper': k, 'ohr_l': ol, 'ohr_r': orr, 'fl_l': fl, 'fl_r': fr_}
    wahl = nur or ('koerper', 'ohr_l', 'ohr_r', 'fl_l', 'fl_r')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Flügelumriss nachziehen, wo die Spaltenverschiebung eine Füllfarbe freilegt


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-bunny', 'Cute Bunny', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-bunny-strip.png', frames, spalten=14, scale=6)
