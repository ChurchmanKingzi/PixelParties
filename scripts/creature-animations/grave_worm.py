# -*- coding: utf-8 -*-
"""Idle-Animation für „Grave Worm“ (Creature) — bleicher Ringelwurm, der aus einem Erdloch am Grab ragt und den Kopf nach links senkt.

Quelle: src/grave-worm.png (24×29 px, 9 Farben) — Ebene „Grave Worm“ (Motive.xcf, Ebene 677, 66×51), Figur 2 (der Wurm samt seinem schwarzen Erdloch). Die Ebene enthält außerdem vier weitere schwarze
Löcher (Kulisse, ohne Wurm) — sie gehören nicht zur Figur. Die Quelle ist vollständig (alles deckend).
PICK: [["Motive", 677, 2]]

Aufruf:   python3 grave_worm.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/grave-worm.png + .json

Was ist was (x, y im 24×29-Sprite):
* KOPF (x 0–13, y 0–9): runder Wurmkopf, hellgrau (195,195,195)/(118,118,118) mit weißen Lichtern (255,255,255) und dunklem Umriss (26,26,26); AUGE (x 1–4, y 5–8): brauner Augapfel (136,95,93)/(72,44,46)
  mit schwarzer Pupille (3,1,1) und weißen Glanzpixeln (255,255,255) bei (3,5), (4,6), (1,7), (2,8). Einen Mund zeigt der Sprite nicht.
* KÖRPER (x 8–23, y 8–24): schräg nach rechts unten laufende Röhre aus Ringen (Ringfarben (195,195,195) hell, (118,118,118) mittel, (82,82,82) dunkel, weißes Licht (255,255,255) an der Kante) mit dunklem Umriss
  (26,26,26); knapp 8 Pixel dick.
* ERDLOCH (x 12–23, y 25–28): schwarzes Oval (0,0,0), in dem der Wurmfuß verschwindet; bleibt fest.
Knochen/Haut: kein Metall → kein Glanz. Kein Feuer.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* WINDEN (Hauptbewegung, Periode 24 → zwei Wellen je Schleife, die Welle wandert vom Loch zum Kopf, Wellenlänge 20 Zeilen): jede Zeile des Wurms (y 0–24) wird waagerecht verschoben, am Loch 0, am Kopf bis ±3 px;
  das Gefälle zwischen benachbarten Zeilen ist ≤ 1 px, so bleibt der Wurm in jeder Pose ein einziger 4-verbundener Körper (für alle 48 Frames geprüft: 4er-Flecken = Original). Das Loch bleibt stehen.
* ATMEN/Ringe (Periode 12): die hellen Ringzeilen pulsieren nicht (Farben bleiben), stattdessen wandert eine zweite, kleinere Welle (Wellenlänge 9 Zeilen, ±1 px) mit etwas anderer Geschwindigkeit (Periode 16) über den Körper, sodass sich der Wurm unregelmäßig windet.
* AUGE blinzelt (Frames 18–20 und 41–43): die Augenpixel nehmen die Kopffarbe (118,118,118) an.
* ERDBROCKEN: kleine Erdwölkchen (2×2 → 3×3 → 2×2, Farben (118,118,118)/(82,82,82)) steigen langsam neben dem Loch auf (Lebensdauer 24 Frames, 4 Stück, 5 px Hub).
Ruhepose = Original (die Wellen werden bei Frame 0 abgezogen). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 7, 5, 8

spr = L.lade('grave-worm')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KOPF = (118, 118, 118)
AUGE = [(x, y) for y in range(5, 9) for x in range(1, 5) if vorhanden[y, x] and col(x, y) in {(136, 95, 93), (72, 44, 46), (3, 1, 1), (255, 255, 255)}]
KOMP0 = V.komp4(spr)
WURM_Y = list(range(24, -1, -1))                  # Fuß (y 24) → Kopf (y 0)
EBENE_Y = [OFF[1] + y for y in WURM_Y]
TEST_EBENEN = 'koerper'


def offs(i):
    a = V.wellen_offs(EBENE_Y, 3.0, i, 24, 20.0, 0.0, 1.2)
    b = V.wellen_offs(EBENE_Y, 1.0, i, 16, 9.0, 1.3, 1.0)
    res = {y: a[y] + b[y] for y in EBENE_Y}
    return V.glatt(res, EBENE_Y)


# Erdbrocken
STAUB = {'c': (118, 118, 118), 'r': (82, 82, 82)}
P = lambda x, y: (OFF[0] + x, OFF[1] + y)
PUFFS = [dict(x=P(10, 24)[0], y=P(10, 24)[1], vx=-2, vy=-6, off=0, wackeln=1), dict(x=P(22, 24)[0], y=P(22, 24)[1], vx=2, vy=-6, off=12, wackeln=1),
         dict(x=P(14, 26)[0], y=P(14, 26)[1], vx=-1, vy=-5, off=6, wackeln=1), dict(x=P(21, 26)[0], y=P(21, 26)[1], vx=1, vy=-5, off=18, wackeln=1)]


def frame(i, nur=None):
    k = L.platz(spr.copy(), H, W, OFF[0], OFF[1])
    if V.fenster(i, N, 18, 3) or V.fenster(i, N, 41, 3):                     # Blinzeln
        V.setze(k, {p: KOPF for p in AUGE}, OFF)
    # Wurmkörper (Zeilen 0–24) windet sich, Loch (ab Zeile 25) bleibt
    wurm = k.copy(); wurm[OFF[1] + 25:] = 0
    boden = k.copy(); boden[:OFF[1] + 25] = 0
    wurm = V.zeilen_versatz4(wurm, offs(i))
    f = L.zusammen(H, W, [(boden, 0, 0), (wurm, 0, 0)])
    f = U.kontur_schliessen(f, UMRISS, (26, 26, 26))
    if nur is None:
        staub = U.wolke_ebene(H, W, i, 24, PUFFS, STAUB)
        f = L.zusammen(H, W, [(staub, 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    for i in range(N):
        assert V.komp4(frame(i, nur='k')) == KOMP0, f'Frame {i}: Wurm zerrissen'
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('grave-worm', 'Grave Worm', frames, MS, prev)
    if prev:
        L.streifen(prev + '/grave-worm-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
