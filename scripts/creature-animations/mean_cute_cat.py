# -*- coding: utf-8 -*-
"""Idle-Animation für „Mean Cute Cat“ (Creature).

Quelle: src/mean-cute-cat.png — Ebene „Mean Cute Cat“ (20×12 px, 15 Farben) aus MotiveMoe.xcf (Ebene 450). Die Ebene enthält drei
Exemplare (wie auf der Karte); zwei sind pixelgleich, das dritte unterscheidet sich nur in unsichtbaren (transparenten) Pixeln —
es gibt also keine zweite Pose als Vorlage. Verwendet wird das erste Exemplar.
PICK: [["MotiveMoe", 450, 1]]   (kein Treffer von creature_show.py; die Ebene wurde über den Ebenennamen gefunden)

WICHTIG — NICHT die Cute Cat: Die Mean Cute Cat ist ein eigener Sprite (schwarze Fledermauskatze von vorn, 20×12 px, rote Augen,
symmetrische Fledermausflügel), nicht die Cute Cat (weiß-lila, Dreiviertelansicht, 23×13, grüne Augen, gerader Schwanz). Ein Abgleich
der Silhouetten der Cute Cat gegen alle Ebenen fand nur weiße Cute-Cat-Ebenen, keine dunkle Variante. cute_cat.py dient nur als Vorbild
für die Flügel-Spaltenwelle.

Aufruf:   python3 mean_cute_cat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mean-cute-cat.png + .json

Identifikation (Sprite 20×12, schwarze Katze von vorn mit Fledermausflügeln):
* Kopf (x 6–13, Zeilen 0–6): schwarzer Umriss B, dunkelgraue Fläche C/G; zwei Ohren mit rosa Innenpixeln J (255,172,255) bei (8,1)/(11,1)
  und K (230,106,230) bei (8,2)/(11,2) (Ohrspitzen B bei (8,0)/(11,0)); zwei ROTE Augen als senkrechte 1×2-Pixel (links x 8, rechts x 11;
  oben L (255,0,0), unten M (152,0,0), je y 4–5); Nase N (43,43,43) bei (9–10, 6), Mund/Kinn O (31,31,31) bei (9–10, 7).
* Körper (Zeilen 7–10): dunkelgrau (C/G/H), schwarzer Umriss B, zwei Füße B bei (7–8, 11) und (11–12, 11).
* Flügel (links x 0–5/6, rechts x 14–19/13, Zeilen 1–9): zwei Lappen — oben (Zeilen 1–5) und unten (Zeilen 6–9) — mit dunkelgrauem Umriss A,
  hellen Rippen E/D (79,79,79) / (64,64,64), dunklen F und I-Rippenpixeln (4,6) (5,7) usw.
* Kein Schwanz, kein Mund-Detail — nichts erfunden.
Bleibt fest: Gesichtsfläche, Nase, Mund, Körperumriss, Füße.

Ablauf (48 Frames à 65 ms = 3,12 s), alle Bewegungen unabhängig:
* Flügelschlag (Periode 12, 4× pro Schleife): jede Flügelspalte wandert senkrecht, je weiter vom Körper desto mehr (Spitze etwa −3 … +3 px); die
  Innenkante bleibt am Körperumriss. Beide Flügel schlagen gleichzeitig.
* Schweben: der ganze Körper hebt sich beim Abschlag um 1 px (gegenläufig zum Flügel), Flügel gehen mit.
* Rote Augen glühen (Periode 16, 3× pro Schleife): beide Pixel hell (255,0,0) bzw. dunkel (152,0,0), dazwischen Original.
* Blinzeln (Frames 14–17 und 38–41, alle 24 Frames ≈ 1,6 s): das Rot verschwindet (Gesichtsfarbe C): erst das obere, dann beide, dann oben —
  sehr deutlich sichtbar auf dem glühenden Rot.
* Blick: nur die roten Augen wandern 1 px — Frames 6–11 nach rechts, 20–26 nach links, 30–35 nach rechts, 44–47 nach links.
* Ohrzucken: die Ohrspitzen (8,0) und (11,0) kippen 1 px nach außen (bleiben über dem Ohrumriss, 4-verbunden): links in Frames 3–4, 19–21, 33–34,
  rechts in 9–10, 26–27, 40–42.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 6, 6

spr = L.lade('mean-cute-cat')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
UMRISS_A = L.farbmaske(spr, [(37, 37, 37)])                       # Flügelumriss A (der Körperumriss B ist schwarz)

fl_l = vorhanden & ((xx <= 5) | ((xx == 6) & UMRISS_A))
fl_r = vorhanden & ((xx >= 14) | ((xx == 13) & UMRISS_A))
koerper = vorhanden & ~fl_l & ~fl_r

AUGE_HELL, AUGE_DUNKEL = (255, 0, 0), (152, 0, 0)                 # L / M
GESICHT = (56, 56, 56)                                            # C
AUGEN_X = (8, 11)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    ph = L.sinus(i, 12)
    sg = math.sin(L.sinus(i, 16))
    glueh = 2 if sg > 0.8 else (1 if sg > 0.3 else (-1 if sg < -0.5 else 0))
    blick = 1 if (6 <= i < 12 or 30 <= i < 36) else (-1 if (20 <= i < 27 or 44 <= i < 48) else 0)
    lid = 0
    for s in (14, 38):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    ohr_l = i in (3, 4, 19, 20, 21, 33, 34)
    ohr_r = i in (9, 10, 26, 27, 40, 41, 42)
    return ph, glueh, blick, lid, ohr_l, ohr_r


def frame(i, nur=None):
    ph, glueh, blick, lid, ohr_l, ohr_r = zustand(i)
    k = teil(koerper)
    # Augen: Glühen, Blick (nur die Augen), Blinzeln — alles auf dem Körper-Layer
    ex = [x + blick for x in AUGEN_X]
    if blick:
        for x0 in AUGEN_X:
            for y in (4, 5):
                k[PAD_T + y, PAD_L + x0, :3] = GESICHT
    top, bot = AUGE_HELL, AUGE_DUNKEL
    if glueh > 0:
        bot = AUGE_HELL
    elif glueh < 0:
        top = AUGE_DUNKEL
    for x in ex:
        k[PAD_T + 4, PAD_L + x, :3] = top
        k[PAD_T + 5, PAD_L + x, :3] = bot
        if lid:
            k[PAD_T + 4, PAD_L + x, :3] = GESICHT
            if lid == 2:
                k[PAD_T + 5, PAD_L + x, :3] = GESICHT
    # Ohrspitzen kippen nach außen (über dem Ohrumriss B bei (7,1) bzw. (12,1))
    if ohr_l:
        k[PAD_T + 0, PAD_L + 8] = 0
        k[PAD_T + 0, PAD_L + 7] = spr[0, 8]
    if ohr_r:
        k[PAD_T + 0, PAD_L + 11] = 0
        k[PAD_T + 0, PAD_L + 12] = spr[0, 11]
    dy = int(round(-0.9 * math.sin(ph)))                          # Schweben: Abschlag → Körper hebt sich
    fl = L.spalten_welle(teil(fl_l), PAD_L + 6.5, 3.2, ph, potenz=1.1, bias=0.4)
    fr_ = L.spalten_welle(teil(fl_r), PAD_L + 12.5, 3.2, ph, potenz=1.1, bias=0.4)
    ebenen = {'koerper': k, 'fl_l': fl, 'fl_r': fr_}
    wahl = nur or ('koerper', 'fl_l', 'fl_r')
    return L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('mean-cute-cat', 'Mean Cute Cat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/mean-cute-cat-strip.png', frames, spalten=12, scale=6)
