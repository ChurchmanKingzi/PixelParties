# -*- coding: utf-8 -*-
"""Idle-Animation für „Undurdle“ (Creature).

Quelle: src/undurdle.png — eines der zwei untoten Schädel-Schildkrötchen (19×11 px, 8 Farben, 137 px) aus der Ebene 345 „Undurdle“ von MotiveDeepsea.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Undurdle.png: oben links, schaut nach rechts; Pixel für Pixel gleich) abgeglichen. Auf der Karte schwebt unten rechts ein zweites, fast gleiches Exemplar (Figur 2 derselben Ebene,
20×11, 124 px, schaut nach links); die Fledermäuse (Ebene 346 „Bats“) gehören zu anderen Creatures. Gewählt: das obere, vollständige Exemplar (Figur 1); Alternative: Figur 2.
PICK: [["MotiveDeepsea", 345, 1]]

Aufruf:   python3 undurdle.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/undurdle.png + .json

Identifikation (Sprite 19×11, weißes Schädel-Schildkrötchen auf dunklem Hintergrund, grau/weiß/schwarz, 8 Farben):
* Schildkrötenpanzer = weißer Schädel (x 5–14, Zeilen 1–8): zwei schwarze Augenhöhlen — links groß (9–10, 2–6), rechts (13–14, 3–5); Zähne/Knochenstufen B/D/E/F.
* Kopf links (x 0–4, Zeilen 0–5): Knochenhals mit Schnabel und schwarzem Augenpixel (2–3,1) — die Schildkröte schaut nach LINKS (auf der Karte zeigt der Kopf vom Betrachter nach links oben).
* Schwanz rechts (x 15–18, Zeilen 2–6): kurzes Knochenende mit dunklen Umrissen A und weißen Pixeln (15,4) (17,4), grauen G (13,3) (15,3) (17,5).
* Beine unten: links (x 6–9, Zeilen 8–10), rechts (x 12–15, Zeilen 8–10).
* Kein Glanz (Knochen, Regel 14), keine Partikel. Die schwarzen Augenhöhlen sind Löcher, kein Blinzeln möglich.
Bleibt fest: Schädelpanzer, Augenhöhlen.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Schweben (Periode 12): das ganze Wesen hebt/senkt sich um 1 px.
* Kopf nickt (Periode 12, 4× pro Schleife): die Kopfspalten x ≤ 4 wandern senkrecht, je weiter vom Panzer desto mehr (Schnabelspitze bis ±2 px); der Ansatz am Panzer bleibt.
* Schwanz wippt (Periode 16, 3× pro Schleife): die Schwanzspalten x ≥ 15 wandern senkrecht, je weiter vom Panzer desto mehr (Spitze bis ±1 px); der Panzer bleibt.
* Beine tippen (Frames 10–13 links, 34–37 rechts): das Bein verkürzt sich um eine Zeile (hebt sich 1 px), das andere bleibt.
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

spr = L.lade('undurdle')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

kopf = vorhanden & (xx <= 4) & (yy <= 5)
schwanz = vorhanden & (xx >= 15) & (yy <= 6)
bein_l = vorhanden & (xx <= 9) & (yy >= 9)
bein_r = vorhanden & (xx >= 12) & (yy >= 9)
koerper = vorhanden & ~kopf & ~schwanz & ~bein_l & ~bein_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

BEIN_L, BEIN_R = {10, 11, 12, 13}, {34, 35, 36, 37}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    dy = int(round(-1.0 * math.sin(ph)))                         # Schweben
    k = teil(koerper)
    ko = T.biegen_spalten(teil(kopf), PAD_L + 5, 2.6, ph)
    sw_ = T.biegen_spalten(teil(schwanz), PAD_L + 14, 1.5, L.sinus(i, 16))
    bl, br = teil(bein_l), teil(bein_r)
    if i in BEIN_L:
        bl = L.heben_unten(bl, PAD_T + 9, 1)
    if i in BEIN_R:
        br = L.heben_unten(br, PAD_T + 9, 1)
    ebenen = {'koerper': k, 'kopf': ko, 'schwanz': sw_, 'bein_l': bl, 'bein_r': br}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('undurdle', 'Undurdle', frames, MS, prev)
    if prev:
        L.streifen(prev + '/undurdle-strip.png', frames, spalten=12, scale=8)
