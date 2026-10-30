# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Cat“ (Creature).

Quelle: src/cute-cat.png — die geflügelte Katze (23×13 px, 15 Farben) aus MotiveMoe.xcf,
Ebene 329 („Trial of Annoyance“), Figur 1; gefunden mit creature_scan.py.
PICK: [["MotiveMoe", 329, 1]]

Aufruf:   python3 cute_cat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-cat.png + .json

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht, je weiter vom Körper, desto mehr
  (Spitze ca. −1 … +3 px) — links und rechts gleichzeitig. Die Flügel liegen wie im Original vor dem Körper.
* Körper schaukelt gegenläufig (Abschlag → Katze hebt sich um 1 px).
* Hinterkörper ergänzt: Im Ausgangs-Sprite verdeckt der linke Flügel Hüfte, Hinterbein und Wangenumriss; diese
  Pixel sind fertiggezeichnet (ERGAENZUNG), damit die Katze auch bei hochgeschlagenem Flügel vollständig ist.
* Schwanz: Im Original-Sprite ragt unten links nur ein Haken (Balken + weiße Spitze nach oben) hinter dem Flügel hervor.
  Er ist durch einen geraden Schwanz ersetzt (TAIL): eine Röhre aus Umriss oben (Zeile 8), Fell (Zeile 9) und Umriss unten
  (Zeile 10), die waagerecht aus dem Hüftrücken nach links läuft (x 1–7) und mit einer weißen Spitze endet — durchgehend
  verbunden, kein Bogen. Die linken Spalten (Spitze) wippen um 1 px auf und ab, der Ansatz an der Hüfte bleibt stehen.
* Blinzeln (Frames 15–17): die grünen Augenpixel schließen sich über zwei Zwischenstufen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 3

GRAU = [(63, 62, 64), (163, 161, 166), (196, 201, 204), (132, 130, 134)]
AUGE_OBEN, AUGE_UNTEN = (41, 123, 0), (24, 65, 0)
WEISS, UMRISS = (255, 246, 255), (57, 8, 32)
FELL, SCHATTEN = (238, 213, 255), (197, 156, 246)

spr = L.lade('cute-cat')                                    # Original: Flügel liegen über dem Körper
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
xs = np.arange(sw)[None, :]
ys = np.arange(sh)[:, None]

fluegel = L.farbmaske(spr, GRAU)
links = fluegel & (xs <= 9)
rechts = fluegel & (xs >= 16)
rest = L.deckend(spr) & ~fluegel
haken = rest & (xs <= 4) & (ys <= 9)                        # alter Schwanz-Haken (2,8),(3,8),(2..4,9) — wird ersetzt
koerper = rest & ~haken

# Im Ausgangs-Sprite liegt der linke Flügel über Hüfte, Hinterbein und Wange: dort fehlen Körperpixel, sobald der
# Flügel wegschwingt. Fertiggezeichnet (nur Farben der Quelle; Fell lila-weiß, Umriss kastanienbraun).
# Rechts ist der Körper durch seine Umrisslinie (x 15/16) schon geschlossen.
ERGAENZUNG = {
    (8, 8): UMRISS, (9, 8): UMRISS,                         # Rücken-/Hüftkontur, setzt den Umriss (10,8) nach links fort
    (8, 9): FELL, (9, 9): WEISS,                            # Hüfte
    (7, 10): SCHATTEN, (8, 10): FELL, (9, 10): FELL,        # Oberschenkel (Umriss (6,10) steht schon)
    (9, 5): UMRISS, (9, 6): UMRISS,                         # Wangenumriss links (Gegenstück zu (17,6))
    (7, 8): UMRISS, (7, 9): FELL,                           # Ansatz des geraden Schwanzes: Röhre läuft ins Hüftfell
}
# Gerader Schwanz (ersetzt den Haken): Umriss oben (Zeile 8) und unten (Zeile 10), Fell in Zeile 9, weiße Spitze (2,9),
# Abschlusspixel (1,9). Spalten 1–6 gehören zur Schwanz-Ebene (wippt), Spalte 7 zum Körper (steht). Unten läuft der Umriss
# in den vorhandenen Hüftumriss (6,10), oben in (7,8)/(8,8): rundum 4-verbunden.
TAIL = {}
for x in range(1, 7):
    TAIL[(x, 8)] = UMRISS
for x in range(1, 6):
    TAIL[(x, 10)] = UMRISS
TAIL.update({(1, 9): UMRISS, (2, 9): WEISS, (3, 9): FELL, (4, 9): FELL, (5, 9): FELL, (6, 9): FELL})

spr_k = spr.copy()                                          # Körper-Kopie mit Ergänzungen; die Flügel bleiben unverändert
koerper_k = koerper.copy()
for (ex, ey), c in ERGAENZUNG.items():
    spr_k[ey, ex, :3] = c
    spr_k[ey, ex, 3] = 255
    koerper_k[ey, ex] = True
spr_t = L.leer(sh, sw)                                      # Schwanz-Ebene
for (ex, ey), c in TAIL.items():
    spr_t[ey, ex, :3] = c
    spr_t[ey, ex, 3] = 255
schwanz_k = L.deckend(spr_t)


def teil(quelle, maske):
    t, _ = L.trenne(quelle, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def frame(i):
    ph = L.sinus(i, N / 2)                                  # zwei Schläge pro Schleife
    fl = L.spalten_welle(teil(spr, links), PAD_L + 9.5, 2.2, ph, bias=0.8)
    fr = L.spalten_welle(teil(spr, rechts), PAD_L + 16.5, 2.2, ph, bias=0.8)
    kp = teil(spr_k, koerper_k)
    sz = L.spalten_welle(teil(spr_t, schwanz_k), PAD_L + 7, 1.2, L.sinus(i, N))   # Spitze wippt ±1 px, Ansatz (x ≥ 6) steht
    # Blinzeln
    if i in (15, 17):
        kp = L.tausche(kp, {AUGE_OBEN: WEISS})                  # halb zu
    if i == 16:
        kp = L.tausche(kp, {AUGE_OBEN: WEISS, AUGE_UNTEN: UMRISS})   # ganz zu
    koerper_dy = int(round(-0.8 * math.sin(ph)))
    # Reihenfolge: Schwanz, Körper, dann die Flügel obenauf (wie im Original)
    return L.zusammen(H, W, [(sz, 0, koerper_dy), (kp, 0, koerper_dy), (fl, 0, 0), (fr, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('cute-cat', 'Cute Cat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-cat-strip.png', frames)
