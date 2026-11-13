# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Polar“ (Creature) — Runde 3: der Eisbär RUTSCHT leicht hin und her (keine Lauf-/Pfotenbewegung mehr).

Nutzerkorrektur (wörtlich): „Slippery Polar *rutscht* durch die Gegend, keine seltsame Laufbewegung. Stattdessen leicht hin und her rutschen lassen.“

Quelle: src/slippery-polar.png — der Eisbär (44×23 px, 16 Farben) aus Motive.xcf, Ebene 803 „Polar“ (die Ebene enthält nur diesen Bären; die graue Wischspur
hinter ihm im Kartenbild ist eine eigene, geteilte Ebene und gehört nicht zur Creature).
PICK: [["Motive", 803, 1]]

Aufruf:   python3 slippery_polar.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-polar.png + .json

Identifikation (Sprite 44×23, weißer Eisbär im Profil, nach links blickend; Farben A (85,83,84) Rückenlinie, B (7,6,1) Nase, C (255,255,255) Fell weiß, E/F creme, G/H/J dunkle Augen-/Nasenpartie,
I/D/N/K/L Grautöne des Schattenfells, M (51,50,50) Umriss, O (38,35,36)/P (28,28,28) Pfotenschwarz):
* Kopf (x 0–12, Zeilen 0–11): Nase = schwarzer 2×2-Block (0–1, 5–6), Auge = dunkler 2×2-Block (6–7, 4–5), zwei Ohren oben (x 6–12, Zeilen 0–2) mit dunklem Ohrinneren, unten ein geöffneter Mund (grauer Unterkiefer).
* Körper (x 8–43, Zeilen 4–15): weiß mit grauer Oberlinie (Rücken), gerundete Hüfte rechts, grau schattierter Bauch (x 25–31, Zeilen 15–19, unten Umrisszeile 19).
* ZWEI PFOTEN (nicht Räder): vordere Pfote x 16–24 und hintere Pfote x 32–40, je Zeilen 18–22: schwarze, oben abgerundete Ballen O/P mit einem weißen Fellbogen C (Zehenfell). Sie bleiben jetzt FEST am Körper.
* Kein Fell-Glanz, kein Metall im Bild (Regel 14). Keine Partikel.

Ablauf (64 Frames à 66 ms = 4,2 s, nahtlos), alle Bewegungen unabhängig:
* RUTSCHEN (neu, ersetzt Pfotentreten und Einsacken): der GANZE Bär gleitet ganzzahlig und sanft über das Eis — Frames 0–13 nach rechts bis +3 px (anfahrend und bremsend, Kosinus-Ease), Halt (14–17),
  dann Frames 18–45 nach links bis −3 px, Halt (46–49), Frames 50–63 zurück zur Mitte. Er bleibt dabei starr (alle Teile verschieben sich gemeinsam), blickt weiter nach links, wird nicht gespiegelt und
  macht keine Gehbewegung; leicht = nur ±3 px (≈ 7 % seiner Länge). Frame 0 = Original.
* Ohrzucken: die Ohrspitzen (Zeilen 0–1) schnippen 1 px nach hinten (rechts), 3× pro Schleife (Frames 6, 28, 50).
* Blinzeln (Frames 12–15 und 40–43): das Auge (6–7, 4–5) wird erst oben, dann ganz zur Fellfarbe A (247,240,230) des Kopfes, dann wieder offen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel außer der Randpixel-Korrektur (Regel 16): wo der Ohrschnipser eine Füllfarbe an den Rand schiebt, wird ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen).
"""
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_rutsch as R
import anim_tiere as T

N, MS = 64, 66
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 3, 3            # ±3 px Rutschweg + Randabstand

spr = L.lade('slippery-polar')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (yy <= 1) & (xx >= 6) & (xx <= 12)
koerper = vorhanden & ~ohr                                          # Körper samt Pfoten: ein starres Teil
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

FELL = (247, 240, 230)                                             # A: Kopffarbe (Lid)
AUGE = [(6, 4), (7, 4), (6, 5), (7, 5)]
TEST_EBENEN = ['koerper', 'ohr']

# Rutschen: 0 → +3, Halt, +3 → −3, Halt, −3 → 0 (kein Spiegeln: der Bär blickt weiter nach links)
BAHN, _SPIEGEL = R.pfad(N, [('fahrt', 3, 14), ('halt', 4), ('fahrt', -3, 28), ('halt', 4), ('fahrt', 0, 14)])


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    lid = 0
    for s in (12, 40):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    ohr_h = max(T.huellkurve(i, N, s, 6) for s in (6, 28, 50))
    return lid, ohr_h


def frame(i, nur=None):
    lid, ohr_h = zustand(i)
    k = teil(koerper)
    if lid:
        for (x, y) in (AUGE[:2] if lid == 1 else AUGE):
            k[PAD_T + y, PAD_L + x, :3] = FELL
    ohr_t = T.zucken_zeilen(teil(ohr), PAD_T + 2, 1.2 * ohr_h, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='links')
    ebenen = {'koerper': k, 'ohr': ohr_t}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)
    return R.verschieben(ganz, BAHN[i], False)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    print('Position je Frame:', BAHN)
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('slippery-polar', 'Slippery Polar', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-polar-strip.png', frames, spalten=12, scale=5)
