# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Polar“ (Creature).

Quelle: src/slippery-polar.png — der Eisbär auf Rädern (44×23 px, 16 Farben) aus Motive.xcf, Ebene 803 „Polar“ (die Ebene enthält nur diesen Bären; die graue Wischspur
hinter ihm im Kartenbild ist eine eigene, geteilte Ebene und gehört nicht zur Creature).
PICK: [["Motive", 803, 1]]

Aufruf:   python3 slippery_polar.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-polar.png + .json

Identifikation (Sprite 44×23, weißer Eisbär im Profil, nach links blickend, auf zwei schwarzen Rädern):
* Kopf (x 0–12, Zeilen 0–11): weiß/cremefarben, Nase = schwarzer 2×2-Block K (0–1, 5–6), Auge = dunkler 2×2-Block N/O/P/K (6–7, 4–5), zwei Ohren oben (x 6–12, Zeilen 0–2) mit dunklem
  Ohrinneren K (7–8, 1–2) und weißer Ohrfläche B; unten ein geöffneter Mund (graue Unterkiefer-Schattierung H/D, dunkle Umrisse E, x 2–10, Zeilen 7–11).
* Körper (x 8–43, Zeilen 4–15): weiß A/C mit grauer Oberlinie F/B (Rücken, x 18–34, Zeile 5) und cremefarbenem Schatten I/L/H; rechts die gerundete Hüfte (35–43, 5–14).
* Zwei schwarze Räder (Reifen G/J (38,35,36)/(28,28,28)), vorn Mitte (20,20), hinten Mitte (36,20), je 6 px hoch (Zeilen 17–22); im Rad ein weißer Lichtbogen B (255,255,255) oben
  (19–21,18) mit zwei Seitenpixeln (18,19) (22,19) bzw. (35–37,18) (34,19) (38,19).
* Kein Fell-Glanz, kein Metall im Bild: die Räder glänzen nicht (der weiße Bogen ist schon gezeichnet und dreht nur mit).
Bleibt fest: Kopfform, Nase, Mundumriss, Rückenlinie, Hüfte, Reifenränder.

Ablauf (60 Frames à 66 ms = 3,96 s), alle Bewegungen unabhängig:
* Räder drehen: der weiße Lichtbogen wandert Position für Position um den Radring (10 Positionen, 1 Schritt alle 2 Frames = 3 Umdrehungen pro Schleife), beide Räder gegen den
  Uhrzeigersinn (der Bär rollt nach links). Nur die Ringpixel wechseln zwischen Weiß und Reifenschwarz.
* Holpern: der Bär hebt sich ruckartig 1 px über den Rädern (Zeile 15 wird eingefügt, 4× pro Schleife, Frames 2–8 + 15 k), die Räder bleiben am Boden.
* Ohrzucken: die Ohrspitzen (Zeilen 0–1) schnippen 1 px nach hinten (rechts), 3× pro Schleife (Frames 6, 26, 47).
* Blinzeln (Frames 12–15 und 37–40): das Auge (6–7, 4–5) wird erst oben, dann ganz zur Fellfarbe A (247,240,230) des Kopfes, dann wieder offen.
* Schneestaub: vier kleine runde Schneewölkchen (Fellfarben) stieben hinter dem hinteren Rad auf (entstehen am Radboden, steigen schräg nach rechts oben und vergehen); sie liegen
  hinter dem Bären. Der Rahmen ist dafür nur 2 px breiter als der Bär allein.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: der Schneestaub ist eine Zutat (keine Vorlage im Bild); Randpixel-Korrektur (Regel 16): wo das Holpern oder der Ohrschnipser eine Füllfarbe an den Rand schiebt, wird ein
Umrisspixel ergänzt (anim_tiere.umriss_schliessen).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 60, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 3, 3, 2

spr = L.lade('slippery-polar')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (yy <= 1) & (xx >= 6) & (xx <= 12)
koerper = vorhanden & ~ohr
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

REIFEN = (38, 35, 36)                                              # G: Reifenschwarz
WEISS = (255, 255, 255)                                            # B: Lichtbogen im Rad
FELL = (247, 240, 230)                                             # A: Kopffarbe (Lid)
RING = [(-1, -2), (0, -2), (1, -2), (2, -1), (2, 0), (1, 1), (0, 1), (-1, 1), (-2, 0), (-2, -1)]   # Radring im Uhrzeigersinn, Mitte (cx, 20)
RAEDER_X = (20, 36)
AUGE = [(6, 4), (7, 4), (6, 5), (7, 5)]
ZEILE = 15                                                         # hier wird beim Holpern eine Zeile eingefügt
STAUB = {'schnee': ((250, 247, 238), (228, 221, 205))}             # C (Kern) / I (Rand)
STAUBFLOCKEN = [dict(x=PAD_L + 41, y=PAD_T + 21, vx=2.8, vy=-2.4, off=0, form='s', farbe='schnee', wackeln=0.0),
                dict(x=PAD_L + 41, y=PAD_T + 21, vx=2.2, vy=-3.0, off=15, form='s', farbe='schnee', wackeln=0.0),
                dict(x=PAD_L + 41, y=PAD_T + 21, vx=2.6, vy=-2.0, off=30, form='s', farbe='schnee', wackeln=0.0),
                dict(x=PAD_L + 41, y=PAD_T + 21, vx=2.4, vy=-2.8, off=45, form='s', farbe='schnee', wackeln=0.0)]
TEST_EBENEN = ['koerper', 'ohr']


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    dreh = (i // 2) % 10
    holper = 1 if (i % 15) in range(2, 9) else 0
    lid = 0
    for s in (12, 37):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    ohr_h = max(T.huellkurve(i, N, s, 6) for s in (6, 26, 47))
    return dreh, holper, lid, ohr_h


def frame(i, nur=None):
    dreh, holper, lid, ohr_h = zustand(i)
    k = teil(koerper)
    # Räder: der Lichtbogen (5 aufeinanderfolgende Ringpositionen) wandert gegen den Uhrzeigersinn
    start = (9 - dreh) % 10
    marken = {(start + j) % 10 for j in range(5)}
    for cx in RAEDER_X:
        for n, (dx, dy) in enumerate(RING):
            k[PAD_T + 20 + dy, PAD_L + cx + dx, :3] = WEISS if n in marken else REIFEN
    # Blinzeln: Augenblock → Kopffarbe
    if lid:
        for (x, y) in (AUGE[:2] if lid == 1 else AUGE):
            k[PAD_T + y, PAD_L + x, :3] = FELL
    ohr_t = T.zucken_zeilen(teil(ohr), PAD_T + 2, 1.2 * ohr_h, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='links')
    k = L.streck_zeile(k, PAD_T + ZEILE, holper)
    ohr_t = L.streck_zeile(ohr_t, PAD_T + ZEILE, holper)
    staub = T.funken_ebene(H, W, i, N, STAUBFLOCKEN, STAUB)
    ebenen = {'staub': staub, 'koerper': k, 'ohr': ohr_t}
    wahl = nur or ('staub', 'koerper', 'ohr')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl if n != 'staub'])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)
    if 'staub' in wahl:
        ganz = L.zusammen(H, W, [(ebenen['staub'], 0, 0), (ganz, 0, 0)])
    return ganz


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('slippery-polar', 'Slippery Polar', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-polar-strip.png', frames, spalten=12, scale=5)
