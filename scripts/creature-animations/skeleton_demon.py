# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Demon“ (Creature).

Quelle: src/skeleton-demon.png (20×24 px, 11 Farben) — die Figur ist die UMGEFÄRBTE Ebene „Winged Skele“ (Motive.xcf, Ebene 297, 20×24 px, spiegelsymmetrisch um x = 9,5),
also derselbe Körper wie beim „Winged Skeleton“. Die schwarz-rote Fassung selbst liegt in keiner Ebene der xcf-Dateien (Suche über alle 18 xcf-Dumps und die Tönungs-Suche
ohne Treffer); sie ist nur in der Kartenkunst data/card-art/native/Skeleton_Demon.png (drei Exemplare, verlustbehaftet, Farbrauschen) vorhanden. Ich habe sie daraus
REKONSTRUIERT: die Silhouette ist die der Ebene 297 (Alpha 0/255, 346 Pixel); die Farbe jedes Pixels ist der Median aus den drei Kopien in der Kunst (Versatz (4,23), (28,12), (52,21),
1 Pixel = 1 Sprite-Pixel) UND seines Spiegelpixels (also 6 Stichproben), danach auf 11 Farben zusammengefasst (Abstand ≤ 24); das Ergebnis ist exakt spiegelsymmetrisch.
PICK: [["Motive", 297, 1]] (Silhouette) + Farben aus data/card-art/native/Skeleton_Demon.png

Aufruf:   python3 skeleton_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-demon.png + .json

Was ist was (x/y im Sprite, linke Seite; die rechte ist gespiegelt x ↔ 19 − x; Deutung nach der Beschreibung des Winged Skeleton, gleicher Körper):
* Hörner/Krallen oben (x 4–7, y 0–6): gebogene mauvefarbene Knochenspitzen (176,151,152) / (145,112,112) mit schwarzem Umriss — fest am Schädel.
* Schädel (x 6–13, y 3–9): schwarz (9,9,9). Schräge ROTE AUGEN: (7,4) (7,5) (7,6) (8,6) (8,7) bzw. (12,4) (12,5) (12,6) (11,6) (11,7); darunter je zwei graue Wangenknochen-
  pixel (7,7) (7,8) / (12,7) (12,8). Kiefer/Zähne als rotes Band y 8–9 (x 6–13).
* Rippenkorb y 10–14 (rote Rippen auf Schwarz), Becken y 15–18, Beine y 19–23, dunkelbraune Füße (47,27,6) bei (5–6,22) und (13–14,22).
* ARME (vorn, rot umrandet): schräge Röhre von der Schulter (4, 10–12) nach unten-außen, Ende = HAND x 0–4, y 15–18 mit rosaroten Fingern (207,64,64) bei (2–3,17).
* FLÜGEL (hinten, dunkelgrau (31,33,33) auf Schwarz): senkrechte Streben x 1–4 / 15–18 neben dem Schädel, y 3–19; hinter dem Arm verdeckt.
Fest bleiben: Schädelform, Hörner, Beine/Füße, Rippenmuster, Umrisse.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel ausgenommen):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, also zweimal pro Schleife): erst wird die Rumpfzeile y 12 einmal eingefügt, in der zweiten Stufe zusätzlich y 14; alles oberhalb (Schädel samt Hörnern, Schultern, Flügel) hebt
  sich starr, Becken, Beine, Füße und Hände bleiben am Boden.
* Blinzeln (Regel „Lidfarbe = umgebende Körperfarbe“): die roten Augenpixel werden für 4 Frames schwarz (9,9,9, die Schädelfarbe) — erst die oberen zwei Pixel, dann alle, dann
  wieder die oberen —, zweimal pro Schleife (Frame 15–18 und 38–41). Sonst KEIN Farbwechsel/Glühen der Augen.
* Hände schwingen unabhängig nach außen (links Periode 16, rechts Periode 24, 0-1-2-1-0 px) und zucken (die Hand hebt sich 1 px; links Frame 19–21, rechts 9–11 und 34–36).
  Hinter der Hand bleibt schwarzes Körperstück stehen (ERGÄNZUNG, s. u.), die Röhre des Arms bleibt an der Schulter.
* Flügel rascheln: die äußeren Strebenspalten (x 1–2 / 17–18, y ≤ 10) wippen senkrecht, außen stärker (x 1: ±2 px, x 2: ±1 px, links Periode 16, rechts 24, die zweite Spalte
  1 Frame später); wandert eine Spalte nach oben, wird die Lücke zum unteren Flügel mit dem untersten Strebenpixel gefüllt (ERGÄNZUNG).
* Glut-Partikel (hinter der Figur, 9 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen k, o): rosarote Funken (Kern (207,64,64),
  Rand (172,2,3)) an Hörnern und Schultern, dunkelrote Rauchkugeln (Kern (114,2,2), Rand (82,3,4)) an den Seiten und über dem Schädel; alle Farben aus dem Sprite. Sie bleiben nah
  an der Figur (Zuschnitt, s. u.).
Kein Glanz, kein Funkeln (Regel 14: Knochen/Schädel sind kein Metall; die grauen Wangenpixel sind Knochen). Kein Feuer (Regel 15 entfällt).
Randpixel-Test (Regel 16): `U.kontur_schliessen` setzt in jeder Pose fehlende Umrisspixel (Schwarz) an Flügelspalten und Händen; im Ruhebild ändert es nichts.
ERGÄNZUNG: (1) schwarzes Körperstück (9,9,9) hinter der Hand bei x 2–4, y 15–18 (soweit die Hand dort Pixel hat) und bei (1,18), sichtbar sobald die Hand nach außen schwingt;
(2) Streckungspixel der Flügelstreben (Kopie des untersten Strebenpixels), wenn die Spalten steigen. Sonst nichts gemalt.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Körperrand hinaus, dazu 1 px leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 8, 8, 12, 5

spr = L.lade('skeleton-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])

SCHWARZ = (9, 9, 9)
ROT, DUNKELROT, ROSA, ROSTROT = (172, 2, 3), (82, 3, 4), (207, 64, 64), (114, 2, 2)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(c in _vorh for c in (SCHWARZ, ROT, DUNKELROT, ROSA, ROSTROT))
UMRISS = U.umrissfarben(spr)
assert all(np.array_equal(spr[y, x], spr[y, sw - 1 - x]) for y in range(sh) for x in range(sw)), 'Sprite nicht spiegelsymmetrisch'

# --- Teile ---
HAND_L = vorhanden & (xx <= 4) & (yy >= 15) & (yy <= 18)
HAND_R = vorhanden & (xx >= sw - 5) & (yy >= 15) & (yy <= 18)
FLUEGEL_L = vorhanden & (xx >= 1) & (xx <= 2) & (yy <= 10)           # äußere Strebenspalten oben (links)
FLUEGEL_R = vorhanden & (xx >= sw - 3) & (xx <= sw - 2) & (yy <= 10)
AUGE_L = [(7, 4), (7, 5), (7, 6), (8, 6), (8, 7)]
AUGE_R = [(sw - 1 - x, y) for (x, y) in AUGE_L]
assert all(col(x, y) in (ROT, DUNKELROT) or col(x, y) == (36, 7, 4) for (x, y) in AUGE_L)
FUSS_L = [(x, y) for y in range(15, 19) for x in range(2, 5) if HAND_L[y, x]] + [(1, 18)]   # Körperstück hinter der Hand ((1,18) hält die Flügelspitze (1,19) fest)
FUSS_R = [(sw - 1 - x, y) for (x, y) in FUSS_L]
BLINZ = {15: 1, 16: 2, 17: 2, 18: 1, 38: 1, 39: 2, 40: 2, 41: 1}                   # 1 = halb (obere zwei Augenpixel), 2 = zu
ZUCK_L, ZUCK_R = {19, 20, 21}, {9, 10, 11, 34, 35, 36}

GLUT = {'c': ROSA, 'r': ROT}                           # rosarote Funken
RAUCH = {'c': ROSTROT, 'r': DUNKELROT}                 # dunkelrote Rauchkugeln
P = lambda x, y: (GPL + x, GPT + y)
PUFFS_GLUT = [
    dict(x=P(7, 1)[0], y=P(7, 1)[1], vx=-2, vy=-4, off=0, form='k', wackeln=1),            # von den Hornspitzen
    dict(x=P(12, 1)[0], y=P(12, 1)[1], vx=2, vy=-4, off=24, form='k', wackeln=1),
    dict(x=P(3, 12)[0], y=P(3, 12)[1], vx=-2, vy=-8, off=12, form='k', wackeln=1),         # von den Schultern
    dict(x=P(16, 12)[0], y=P(16, 12)[1], vx=2, vy=-8, off=36, form='k', wackeln=1),
    dict(x=P(1, 9)[0], y=P(1, 9)[1], vx=-1, vy=-8, off=8, form='k', wackeln=1),
    dict(x=P(18, 9)[0], y=P(18, 9)[1], vx=1, vy=-8, off=30, form='k', wackeln=1),
]
PUFFS_RAUCH = [
    dict(x=P(1, 17)[0], y=P(1, 17)[1], vx=-1, vy=-9, off=4, form='o', wackeln=1),           # aufsteigend an den Händen
    dict(x=P(18, 17)[0], y=P(18, 17)[1], vx=1, vy=-9, off=28, form='o', wackeln=1),
    dict(x=P(9, 2)[0], y=P(9, 2)[1], vx=0, vy=-5, off=16, form='o', wackeln=1),             # über dem Schädel zwischen den Hörnern
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def fluegel(maske, spalten, amp, per, lag, i, rechts):
    """Äußere Strebenspalten oben wippen senkrecht; Lücke zum unteren Flügel wird mit dem untersten Strebenpixel gefüllt."""
    lay = L.leer(H, W)
    for k, x in enumerate(spalten):                              # spalten: (äußerste, innere)
        dy = int(round(amp[k] * math.sin(2 * math.pi * (i - lag[k]) / per)))
        ys = [y for y in range(sh) if maske[y, x]]
        yb = max(ys)
        for y in ys:
            lay[GPT + y + dy, GPL + x] = spr[y, x]
        for y in range(yb + dy + 1, yb + 1):                      # steigt die Spalte, füllt die Verlängerung die Lücke
            lay[GPT + y, GPL + x] = spr[yb, x]
    return lay


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0 (Periode 24): Oberkörper hebt sich
    # Basis (alles außer Händen und äußeren Flügelspalten), Körperstück hinter den Händen schwarz
    basis = teil(vorhanden & ~HAND_L & ~HAND_R & ~FLUEGEL_L & ~FLUEGEL_R)
    for (x, y) in FUSS_L + FUSS_R:
        basis[GPT + y, GPL + x, :3] = SCHWARZ
        basis[GPT + y, GPL + x, 3] = 255
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in (AUGE_L + AUGE_R):
            if bl == 2 or y <= 5:
                basis[GPT + y, GPL + x, :3] = SCHWARZ
    fl = L.zusammen(H, W, [(fluegel(FLUEGEL_L, (1, 2), (2.0, 1.0), 16, (0, 1), i, False), 0, 0),
                          (fluegel(FLUEGEL_R, (sw - 2, sw - 3), (2.0, 1.0), 24, (0, 1), i, True), 0, 0)])
    # Hände: eigene Perioden, 0-1-2-1-0 px nach außen, Zucken = 1 px hoch
    hl = teil(HAND_L)
    hr = teil(HAND_R)
    dxl, dxr = -U.stufe(i, 16, 2), U.stufe(i, 24, 2)
    dyl, dyr = (-1 if i in ZUCK_L else 0), (-1 if i in ZUCK_R else 0)
    # Atmen: erste Stufe = Zeile y 12 doppelt, zweite Stufe zusätzlich Zeile y 14 doppelt (verteilt die Streckung, keine Dreifach-Zeile im Rippenkorb)
    if n >= 2:
        basis, fl = L.streck_zeile(basis, GPT + 14, 1), L.streck_zeile(fl, GPT + 14, 1)
    if n >= 1:
        z = GPT + (11 if n >= 2 else 12)
        basis, fl = L.streck_zeile(basis, z, 1), L.streck_zeile(fl, z, 1)
    koerper = L.zusammen(H, W, [(fl, 0, 0), (basis, 0, 0), (hl, dxl, dyl), (hr, dxr, dyr)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ)       # Regel 16: Umriss an Flügelspalten und Händen in jeder Pose geschlossen
    if nur == 'koerper':
        return koerper
    rauch = U.glut_ebene(H, W, i, N, PUFFS_RAUCH, RAUCH)
    glut = U.glut_ebene(H, W, i, N, PUFFS_GLUT, GLUT)
    return L.zusammen(H, W, [(rauch, 0, 0), (glut, 0, 0), (koerper, 0, 0)])


# Zuschnitt auf die Figur (Nutzerwunsch): symmetrisch um die Ruhefigur, Effekte höchstens +2 px über den Körperrand hinaus
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('skeleton-demon', 'Skeleton Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
