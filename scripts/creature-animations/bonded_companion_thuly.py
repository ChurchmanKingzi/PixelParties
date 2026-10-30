# -*- coding: utf-8 -*-
"""Idle-Animation für „Bonded Companion Thuly“ (Creature).

Quelle: src/bonded-companion-thuly.png — Thuly, der dunkle Kapuzenschatten (13×20 px, 209 px) aus der Ebene 153 „Thuly“ von MotiveGrailWar.xcf, Figur 2; mit der Kartenkunst
(data/card-art/native/Bonded_Companion_Thuly.png: rechts neben dem Pentagramm, schaut nach links, Pixel für Pixel gleich) abgeglichen. Die Ebene (Figur 2, 28×25, 408 px) enthält ZUSÄTZLICH
die liegende Frau im Blut (x 14–27, Zeilen 12–23) und Blutspritzer, die Thulys rechte Unterseite überdecken; die Figur 1 derselben Ebene (16×24, braunes Haar) ist der Held. Beides gehört nicht zur Creature.
Von Hand ausgeschnitten: nur grau/schwarze Pixel (plus das weiße Kreuzauge und der rote Mund) mit x ≤ 12, y ≤ 19 (eine 8er-Komponente). Wo Blut Thulys rechte untere Kante überdeckt (x 8–10,
Zeilen 12–19), sind die rötlich getönten Pixel durch die nächstliegende Grauwert-Stufe des Sprites ersetzt (gleiche Helligkeit) und die rechte Kante ist an x = 11 (Zeilen 12–18) mit der Umrissfarbe (25,25,25)
geschlossen — Ergänzungen, siehe unten. Thuly ist sehr dunkel (Graustufen 24–68), die Kunst liegt auf einem grauen Steinboden.
PICK: [["MotiveGrailWar", 153, 2]]   (Figur 2 der Ebene, nur der Schatten links; die Datei in src/ ist dieser Ausschnitt mit Ergänzungen)

Aufruf:   python3 bonded_companion_thuly.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bonded-companion-thuly.png + .json

Identifikation (Sprite 13×20, dunkler Kapuzenschatten im Profil, schaut nach LINKS):
* Kapuze (x 1–10, Zeilen 0–6): gestufte Graustöne 24–68, oben dunkler Umriss.
* Gesicht (x 1–5, Zeilen 7–14): schwarz (0,0,0); Auge = weißes Kreuz: (3,7), (2–4,8), (3,9); Mund = rot (255,0,0): (4,10), (2–3,11).
* Körper/Umhang (x 1–12, Zeilen 7–19): dunkelgrau, rechts dunkler Umriss (x 11–12); unten zwei Füße/Zipfel: links (x 1–6, Zeilen 16–19), rechts (x 8–10, Zeilen 16–19), dazwischen Lücke bei x = 7.
* Kein Glanz, keine Partikel; Rot ist ein Mund (kein Feuer).
Bleibt fest: Gesichtsfläche, Kreuz (bis auf das Blinzeln), Umhangmuster.

Ablauf (48 Frames à 70 ms = 3,4 s), alle Bewegungen unabhängig:
* Schweben (Periode 16, 3× pro Schleife): der ganze Schatten hebt/senkt sich um 1 px.
* Umhangsaum weht (Periode 12, 4× pro Schleife): die Zeilen ab Zeile 12 wandern waagerecht, je weiter unten desto mehr (bis ±2 px); Zeile 11 und darüber bleiben, die Lücke zwischen den Füßen bleibt erhalten.
* Kapuze weht (Periode 16, gegenläufig zum Saum): die Zeilen 0–5 wandern, je höher desto mehr (bis ±1 px).
* Blinzeln (Frames 12–15 und 36–39): das weiße Kreuzauge schließt sich in der Gesichtsfarbe Schwarz — erst Ober-/Unterpixel, dann die ganze Mitte, dann wieder auf (Lid = Körperfarbe).
* Mund (Frames 22–24 und 44–46): die roten Mundpixel werden kurz schwarz (Mund geschlossen).
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen (im Sprite in src/): Blut-getönte Pixel (x 8–10, Zeilen 12–19) → nächste Grauwert-Stufe; rechte Kante x = 11, Zeilen 12–18 → Umrissfarbe (25,25,25). In der Animation selbst: Randpixel-Korrektur (Regel 16).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

spr = L.lade('bonded-companion-thuly')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

SCHWARZ = (0, 0, 0)
KREUZ = [(3, 7), (2, 8), (3, 8), (4, 8), (3, 9)]
BLINK = {12: 1, 13: 2, 14: 2, 15: 1, 36: 1, 37: 2, 38: 2, 39: 1}      # 1 = Ober-/Unterpixel zu, 2 = ganzes Kreuz zu
MUND = [(4, 10), (2, 11), (3, 11)]
MUND_ZU = {22, 23, 24, 44, 45, 46}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def gesicht(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        teile = [(3, 7), (3, 9)] if lid == 1 else KREUZ
        for (x, y) in teile:
            setze(k, x, y, SCHWARZ)
    if i in MUND_ZU:
        for (x, y) in MUND:
            setze(k, x, y, SCHWARZ)


def zeilen_scherung(a, y_lo, y_hi, pivot_y, amp, v):
    """Zeilen y_lo…y_hi wandern waagerecht um round(amp · f · v), f = |y − pivot|/größter Abstand (nur diese Zeilen); alle anderen bleiben."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max(abs(y - pivot_y) for y in range(y_lo, y_hi + 1)))
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = int(round(amp * (abs(y - pivot_y) / maxd) * v)) if y_lo <= y <= y_hi else 0
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def frame(i, nur=None):
    dy = int(round(-0.9 * math.sin(L.sinus(i, 16))))                    # Schweben
    s_saum = math.sin(L.sinus(i, 12))
    s_kapuze = -math.sin(L.sinus(i, 16))
    k = teil(vorhanden)
    gesicht(k, i)
    k = zeilen_scherung(k, PAD_T + 12, PAD_T + 19, PAD_T + 11, 2.2, s_saum)
    k = zeilen_scherung(k, PAD_T + 0, PAD_T + 5, PAD_T + 6, 1.5, s_kapuze)
    ebenen = {'figur': k}
    wahl = nur or ('figur',)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, dy) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bonded-companion-thuly', 'Bonded Companion Thuly', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bonded-companion-thuly-strip.png', frames, spalten=12, scale=8)
