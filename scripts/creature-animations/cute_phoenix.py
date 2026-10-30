# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Phoenix“ (Creature).

PICK: [["MotiveMoe", 354, 1]]   (Ebene „Final Trial #7“, Figur 1; Figur 1 der Ebenen 368 = identisch, 224/414 = andere Gesichter)
Quelle: src/cute-phoenix.png — Feuervogel (36×32 px, nur 6 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 cute_phoenix.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-phoenix.png + .json

Identifikation (x, y):
* Farbrampe der Flamme: Rot (202,44,41) = äußerer Rand, Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184) = glühender Kern;
  Dunkelrot (159,35,32) = Gesichtsumriss, Pink (255,139,255) = Wangen.
* Schwanz-/Flammenfächer (x 10–25, y 0–22): hohe rote Flammenzungen oben, nach unten orange → gelb → creme Kern.
* Flügel (links x 0–9, rechts x 26–35, y 10–27): waagerecht gespreizt, oben gezackte rote Federflammen (Zacken bei y 10–16), darunter
  gelbe/orange Federn und ein breites cremefarbenes Band (y 23–27), das in der Mitte in den Körper übergeht.
* Gesicht (Mitte unten, x 14–21, y 26–31): Augen je 2×2 px ((15–16, 27–28) und (19–20, 27–28): dunkelrot/rot mit cremefarbenem Glanzpixel
  (16,28) und (19,28)), pinke Wangen (15,29) und (20,29), orangefarbene Stirn (17–18, 26), Schnabel/Kinn gelb–rot (17–18, 28–31).
* Die Kunst enthält zwei weitere Gesichter (Ebenen 224 und 414); sie werden nicht verwendet (anderes Gesicht ≠ Blinzeln).

Ablauf (24 Frames à 70 ms = 1,68 s):
* Flügelschlag: zweimal pro Schleife; jede Flügelspalte wandert senkrecht (Spitze etwa −3 … +5 px), je weiter außen, desto mehr, die
  Spitze hinkt leicht nach (Wellenlauf, F.fluegel_welle). Die Spalten am Körperrand (links x ≥ 10, rechts x ≤ 25) bleiben stehen, erst
  weiter außen biegt sich der Flügel (keine Tasche zwischen Flügel und Fächer). Beide Flügel gleichzeitig.
* Schwebe-Bob: die ganze Figur hebt sich beim Abschlag um 1 px.
* Flammenzungen züngeln: die roten Flammenspitzen von Fächer und Flügelrand werden 0…2 px länger/kürzer, jede Zunge mit eigener Phase
  (Periode 12 Frames), nur an den Spaltenenden — Figur bleibt 4-verbunden.
* Blinzeln (Frames 17–19): die Augen schließen sich über einen Zwischenschritt (Lid gelb, Strich rot).
* Aufsteigende Glut (Partikel): kleine gelbe/orange Funken und Klekse steigen langsam von Fächerspitzen und Flügelrändern auf (hinter der Figur).

Ergänzungen: keine nötig — Flügel und Fächer überlappen sich im Original nirgends, es gibt keine verdeckten Teile.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 24, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 12, 8

spr = L.lade('cute-phoenix')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
DUNKELROT = (159, 35, 32)

wing_l = vorhanden & (xx <= 9)
wing_r = vorhanden & (xx >= 26)
koerper = vorhanden & ~wing_l & ~wing_r

AUG_L = [(15, 27), (16, 27), (15, 28), (16, 28)]
AUG_R = [(19, 27), (20, 27), (19, 28), (20, 28)]


def px(x, y):
    return PAD_L + x, PAD_T + y


GLUT = {'c': GELB, 'r': ORANGE}
PUFFS = [
    dict(x=px(13, 0)[0], y=px(13, 0)[1], vx=0, vy=-9, off=0, form='k', wackeln=1),      # von den Fächerspitzen
    dict(x=px(18, 2)[0], y=px(18, 2)[1], vx=0, vy=-9, off=8, form='s', wackeln=1),
    dict(x=px(23, 1)[0], y=px(23, 1)[1], vx=0, vy=-9, off=16, form='k', wackeln=1),
    dict(x=px(2, 12)[0], y=px(2, 12)[1], vx=0, vy=-8, off=4, form='k', wackeln=1),      # vom Flügelrand
    dict(x=px(33, 12)[0], y=px(33, 12)[1], vx=0, vy=-8, off=12, form='s', wackeln=1),
    dict(x=px(7, 13)[0], y=px(7, 13)[1], vx=0, vy=-7, off=20, form='k', wackeln=1),
]


def frame(i, partikel=True):
    ph = L.sinus(i, N / 2)                                    # Flügelschlag: zweimal pro Schleife
    bob = int(round(-0.8 * math.sin(ph)))                     # Abschlag → Figur hebt sich
    zunge = L.sinus(i, N / 2)                                 # Flammenzungen: eigene Periode (12 Frames), je Spalte versetzt

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    if i in (17, 19):                                         # Blinzeln: Oberlid zu
        F.setze(kp, PAD_L, PAD_T, {p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])})
    if i == 18:                                               # zu: Lid gelb, Strich rot
        F.setze(kp, PAD_L, PAD_T, {**{p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])},
                                   **{p: ROT for p in (AUG_L[2], AUG_L[3], AUG_R[2], AUG_R[3])}})
    kp = F.flammen_spitzen(kp, zunge, ROT, lauf=1.3)

    fl_amp, fl_pot, lauf = 3.8, 1.3, 0.3
    wl = F.flammen_spitzen(F.ebene(spr, wing_l, H, W, PAD_L, PAD_T), zunge + 0.8, ROT, lauf=1.1)
    wr = F.flammen_spitzen(F.ebene(spr, wing_r, H, W, PAD_L, PAD_T), zunge + 2.1, ROT, lauf=1.1)
    wl = F.fluegel_welle(wl, PAD_L + 10, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf)
    wr = F.fluegel_welle(wr, PAD_L + 25, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf)

    glut = L.puff_ebene(H, W, i, N, PUFFS, GLUT) if partikel else L.leer(H, W)
    return L.zusammen(H, W, [(glut, 0, 0), (kp, 0, bob), (wl, 0, bob), (wr, 0, bob)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-phoenix', 'Cute Phoenix', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-phoenix-strip.png', frames, spalten=6, scale=6)
