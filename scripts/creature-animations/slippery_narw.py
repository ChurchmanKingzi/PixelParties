# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Narw“ (Creature).

Quelle: src/slippery-narw.png — der Narwal von oben gesehen (23×53 px, 12 Farben, 507 px, vollständig deckend) aus der Ebene 798 „Narw“ von Motive.xcf; mit der Kartenkunst
(data/card-art/native/Slippery_Narw.png: Mitte, Kopf nach unten schwimmend, Wasser; Pixel für Pixel gleich) abgeglichen. Die Ebene 799 „Ebene #361“ (26×129, über 1400 halbtransparente Pixel)
ist nur der weiche Schatten/Fahrtschlieren hinter dem Narwal (in der Karte als Verlauf über ihm) und gehört nicht zum Sprite; creature_show.py findet die Ebene 798 nicht von selbst, deshalb von Hand
aus der Ebene gelöst (keine Beschneidung nötig, alle Pixel sind 255-deckend).
PICK: [["Motive", 798, 1]]   (die ganze Ebene ist die Figur; Datei in src/ = die Ebene auf ihre Bounding-Box zugeschnitten)

Aufruf:   python3 slippery_narw.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-narw.png + .json

Identifikation (Sprite 23×53, Narwal von oben, Kopf unten, Schwanz oben, dunkelblau-grau):
* Schwanzflosse (x 1–21, Zeilen 0–5): zwei breite Fluken links/rechts (D/E/B/F) um einen schmalen Stiel (10–12); dunkler Umriss A (12,17,43).
* Schwanzstiel (x 10–12, Zeilen 6–9) und Rumpf (x 5–17, Zeilen 10–43): grau/blau (B (129,129,129), C (61,68,84), E (21,30,56), F (146,152,182) als Aufheller rechts), Rückenmitte mit dunklen Punkten G.
* Seitenflossen (x 0–7 und x 15–22, Zeilen 18–23): breit, blau (D/H).
* Kopf (Zeilen 38–43): unten abgerundet, weiße Zähne I (255,255,255) (7,40) (15,40) (8,41) (14,41) u. ä.; darunter Stoßzahn: gepunktete Linie J/L (11, 44–52).
* Kein Glanz (Haut, Regel 14; die weißen Pixel sind Zähne), keine Partikel.
Bleibt fest: Rumpfmuster, Kopf, Stoßzahn.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Schwimmschlag (Periode 8 für den Schlag, Hüllkurve sin²(π·i/24): 2 Schübe pro Schleife mit Gleitphase dazwischen): jede Zeile des Körpers oberhalb des Kopfes wandert waagerecht um round(2,6 · Hüll · f^1,2 ·
  sin(φ − 0,9 f)), f = Abstand vom Kopf / größter Abstand (Schwanz am stärksten, Kopf und Stoßzahn bleiben); die Fluken und Flossen gehen mit.
* Fluken schlagen (Periode 12, 4× pro Schleife): die Flukenspalten (Zeilen 0–5) wandern senkrecht, je weiter vom Stiel desto mehr (Spitzen bis ±2 px).
* Seitenflossen rudern (Periode 12, gegenläufig zu den Fluken, gleiche Seite gleichzeitig): die Flossenspalten wandern senkrecht, je weiter vom Körper desto mehr (Spitzen bis ±2 px).
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
PAD_L, PAD_R, PAD_T, PAD_B = 3, 4, 3, 2

spr = L.lade('slippery-narw')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

fluke = vorhanden & (yy <= 5)
flosse_l = vorhanden & (xx <= 7) & (yy >= 18) & (yy <= 23)
flosse_r = vorhanden & (xx >= 15) & (yy >= 18) & (yy <= 23)
koerper = vorhanden & ~fluke & ~flosse_l & ~flosse_r

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

KOPF_Y = 43                                                      # ab hier (Kopfunterkante, Stoßzahn) keine Seitenbewegung


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def schwimmen(a, i):
    """Zeilenscherung des ganzen Körpers: Schwanz am stärksten, Kopf (ab Zeile 43) und Stoßzahn fest. Schub-Hüllkurve sin²(π i/24) → Frame 0 = Original."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    env = math.sin(math.pi * i / 24.0) ** 2
    ph = 2 * math.pi * i / 8.0
    ky = PAD_T + KOPF_Y
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        f = max(0.0, (ky - y) / float(ky - PAD_T))
        dx = int(round(2.6 * env * f ** 1.2 * math.sin(ph - 0.9 * f)))
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def frame(i, nur=None):
    ph = L.sinus(i, 12)
    fl = T.biegen_spalten(teil(fluke), PAD_L + 11, 2.4, ph)
    fll = T.biegen_spalten(teil(flosse_l), PAD_L + 8, 2.2, ph + math.pi)
    flr = T.biegen_spalten(teil(flosse_r), PAD_L + 14, 2.2, ph + math.pi)
    ebenen = {'koerper': teil(koerper), 'fluke': fl, 'flosse_l': fll, 'flosse_r': flr}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    ganz = schwimmen(ganz, i)
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('slippery-narw', 'Slippery Narw', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-narw-strip.png', frames, spalten=12, scale=4)
