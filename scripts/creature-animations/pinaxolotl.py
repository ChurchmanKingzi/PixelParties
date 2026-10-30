# -*- coding: utf-8 -*-
"""Idle-Animation für „Pinaxolotl“ (Creature).

Quelle: src/pinaxolotl.png — der Ananas-Axolotl (40×16 px, 12 Farben) aus MotiveGrailWar.xcf, Ebene 417 „Pineaxolotl“, Figur 3 (die Figur 2 derselben Ebene ist der
Mann mit Hut, der zur Kartenszene gehört und nicht zur Creature).
PICK: [["MotiveGrailWar", 417, 3]]

Aufruf:   python3 pinaxolotl.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/pinaxolotl.png + .json

Identifikation (Sprite 40×16, gelbweißer Axolotl im Profil, nach links blickend, mit grünen Ananas-Blättern):
* Kopf (x 3–14, Zeilen 7–12): hellgelb C (244,253,188), olivfarbener Umriss B (62,64,0); Auge = weiße Fläche (5–6, 8) mit zwei olivfarbenen Pupillenpixeln L (137,142,0) an den Enden
  (4,8) und (7,8); weißer Stirnglanz H (8–9, 7); Mund = graue Linie K (77,77,77) bei (4–7, 11).
* Kiemen-/Blattkrone (x 0–15, Zeilen 1–5): drei dunkelgrüne Wedel (Umriss A (47,85,64), Rippen E (147,198,132) / D (101,159,111)), die schräg aus dem Kopf wachsen; Ansatz in Zeile 6.
  Dazu seitliche Kiemenblätter an der rechten Kopfseite (x 10–14, Zeilen 7–12), die fest bleiben.
* Rumpf (x 13–25, Zeilen 6–13): hellgelb C/F (219,230,96) mit weißen Glanzstreifen H und olivgelber Schattierung G (179,188,79) / J (164,172,71).
* Unten ein schuppiges Fußband (x 12–27, Zeilen 12–15) aus Olivtönen B/G/J (die Muster-Pixel sind keine einzelnen Beine, daher fest).
* Schwanz (x 26–39, Zeilen 0–13): ein großes grünes Blatt (A/D/E/I) nach rechts oben gebogen, am Rumpf (x 26–28) angewachsen; die Blattspitze (38–39, 0–1) liegt oben rechts als eigenes Stück.
* Kein Glanz außer den schon gezeichneten weißen Streifen (Pflanze/Tier, Regel 14), keine Partikel.
Bleibt fest: Kopf (bis auf Auge), Rumpf, Fußband, seitliche Kiemenblätter.

Ablauf (60 Frames à 64 ms = 3,84 s), alle Bewegungen unabhängig:
* Atmen (Periode 30, 2× pro Schleife; oben in Frames 4–17 und 34–47): Zeile 10 wird eingefügt — Kopf, Krone und Schwanzansatz heben sich 1 px, das Fußband bleibt am Boden.
* Blattkrone wiegt sich: die drei Wedel (Zeilen 1–5) neigen sich als wandernde Welle bis ±2 px nach links/rechts (3 Wellen pro Schleife), die Spitzen mehr als der Ansatz.
* Schwanzblatt schlägt: die Spalten x 26–39 wandern senkrecht (je weiter vom Rumpf, desto mehr; Spitze etwa ±2 px; 4 Wellen pro Schleife), der Ansatz am Rumpf bleibt.
* Blinzeln (Frames 14–17 und 41–44): die vier Augenpixel (4–7, 8) verschwinden in der Kopffarbe C: erst die Pupillen, dann die weiße Fläche, dann wieder auf (Lid = Körperfarbe).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16): wo Krone und Schwanzblatt eine Füllfarbe an den Rand schieben, wird ein Umrisspixel (Farbe aus dem Original) ergänzt (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 60, 64
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 5, 2

spr = L.lade('pinaxolotl')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

GRUEN = [(47, 85, 64), (101, 159, 111), (147, 198, 132), (73, 148, 91)]     # A, D, E, I (Blätter)
gruen = vorhanden & L.farbmaske(spr, GRUEN)
krone = gruen & (yy <= 5) & (xx <= 15)
blatt = gruen & (xx >= 26)
koerper = vorhanden & ~krone & ~blatt

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
KOPF = (244, 253, 188)                                             # C: Kopffarbe (Lid)
AUGEN = [(4, 8), (7, 8), (5, 8), (6, 8)]                           # Pupillen zuerst, dann die weiße Fläche
ZEILE = 10                                                         # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    atem = 1 if (i % 30) in range(4, 18) else 0
    lid = 0
    for s in (14, 41):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    return atem, lid


def krone_wiegen(t, i):
    """Wedel (Zeilen 1–5) neigen sich als wandernde Welle: Zeile y wandert um round(1,6 · f · sin(φ − 0,6 · f)), f = Höhe über der Zeile 6 / 5 (Frame 0 = Original)."""
    out = L.leer(H, W)
    ph = 2 * math.pi * i / 20.0 + 0.3
    for y in range(0, 6):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = (6 - y) / 5.0
        dx = int(round(1.6 * f * math.sin(ph - 0.6 * f)))
        if xs_.min() + dx < 0 or xs_.max() + dx >= W:
            raise L.ClipError(f'Kronenzeile {y} würde aus der Leinwand geschoben')
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    atem, lid = zustand(i)
    k = teil(koerper)
    if lid:
        for (x, y) in AUGEN[:2] if lid == 1 else AUGEN:
            k[PAD_T + y, PAD_L + x, :3] = KOPF
    kr = krone_wiegen(teil(krone), i)
    bl = L.spalten_welle(teil(blatt), PAD_L + 26, 2.4, 2 * math.pi * i / 15.0 + 0.2, potenz=1.0, nur_rechts=True, lauf=0.4)
    ebenen = {'koerper': k, 'krone': kr, 'blatt': bl}
    wahl = nur or ('koerper', 'krone', 'blatt')
    teile = [(L.streck_zeile(ebenen[n], PAD_T + ZEILE, atem), 0, 0) for n in wahl]
    ganz = L.zusammen(H, W, teile)
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('pinaxolotl', 'Pinaxolotl', frames, MS, prev)
    if prev:
        L.streifen(prev + '/pinaxolotl-strip.png', frames, spalten=12, scale=6)
