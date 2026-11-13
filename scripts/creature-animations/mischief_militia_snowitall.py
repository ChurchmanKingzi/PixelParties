# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - SnowItAll“ (Creature) — der Schneemann mit Doktorhut, Brille und roter Fliege.

Quelle: src/mischief-militia-snowitall.png (14×20 px, 17 Farben, deckend).
PICK: [["MotiveRussia", 85, 1]]      (Ebene „Ebene #131“, Figur 1; Karte Mischief_Militia_SnowItAll.png: unten Mitte; die Ebene 87 (Tafel, Schneemann links, Feuer) gehört zur Kartenszene)

Aufruf:   python3 mischief_militia_snowitall.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-snowitall.png + .json

Was im Sprite ist (x, y im 14×20-Sprite):
* DOKTORHUT / Mortarboard (y 0–8): schwarze Platte A/B/E/I (breit, y 1–5), darunter die Kappe; Quaste L (255,237,175) hängt links am Rand bei (0, 4–8).
* BRILLE (y 9–10): zwei runde Gläser K (221,247,248) mit weißem Punkt M bei x 4–5 und x 8–9, Nasenbrücke/Fassung A (schwarz) bei (6–7, 9); keine Augen sichtbar → KEIN Blinzeln (Brille blinzelt nicht).
* ROTE FLIEGE (y 13–15): N/O/P (225,2,13)/(148,2,29)/(250,5,42) mit weißer Mitte M/H.
* SCHAL C (blau) y 11–12; ZWEIGARME J (104,64,32): links (0,12)/(1,13), rechts (13,12)/(12,13); KÖRPER (y 11–19) Schneeball D/G/H/F mit blauem Umriss C.
Material: Schnee, Stoff, Glas — KEIN Glanz (Regel 14): Gläser und Hut glänzen nicht.

Ablauf (48 Frames à 68 ms = 3,26 s, nahtlos), alle Bewegungen unabhängig:
* Atmen (Periode 24, zwei je Schleife): Zeile 17 des Schneeballs wird einmal doppelt eingefügt (Mischtextur) — Hut, Kopf, Brille, Arme steigen 1 px, der Boden bleibt.
* Quaste pendelt (Periode 16): hängt zwischen links (x −1), Mitte und rechts (x 1); die Pose wird 4-verbunden gezeichnet (Aufhängung (0,4) fest).
* Zweigarme schlenkern (Perioden 24/32): die Spitze wandert links zwischen y 9 und 14, rechts zwischen y 10 und 14; Linie 4-verbunden (darf den Umriss an der Schulter überdecken).
* Fliege (Periode 24): die roten Flügel P (250,5,42) an (9,13) und O (148,2,29) an (4,14)/(9,15)… bleiben FEST (Stoff).
* Kalter Dunst: 5 Wölkchen ≥ 2×2 steigen langsam seitlich auf.
Ergänzungen: keine gemalten Pixel außer Quaste/Zweigen (Farben L / J des Sprites). Frame 0 = Original (Dunst ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)

N, MS = 48, 68
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 5, 3
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-snowitall')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

ZWEIG = (104, 64, 32)
QUASTE = (255, 237, 175)
TASSEL = {0: [(0, 4), (0, 5), (0, 6), (0, 7), (0, 8)],
          1: [(0, 4), (0, 5), (1, 5), (1, 6), (1, 7), (1, 8)],
          -1: [(0, 4), (0, 5), (0, 6), (-1, 6), (-1, 7), (-1, 8)]}
ARM_L = [(0, 12)]
ARM_R = [(13, 12)]
E_, D_ = (223, 224, 246), (204, 204, 242)


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # Quaste: Pose nach Pendelwinkel
    s = math.sin(L.sinus(i, 16))
    pose = 1 if s > 0.45 else -1 if s < -0.45 else 0
    if pose:
        Hm.setze(k, {p: None for p in TASSEL[0][2:]}, OFF)
        Hm.setze(k, {p: QUASTE for p in TASSEL[pose]}, OFF)
    # Arme
    tl = 12 + int(round(2.4 * math.sin(L.sinus(i, 24))))
    tr = 12 + int(round(2.2 * math.sin(L.sinus(i, 32))))
    if tl != 12:
        E.zweig_loeschen(k, OFF, ARM_L)
        E.zweig_zeichnen(k, OFF, (1, 13), (0, tl), ZWEIG, nur_leer=False)
    if tr != 12:
        E.zweig_loeschen(k, OFF, ARM_R)
        E.zweig_zeichnen(k, OFF, (12, 13), (13, tr), ZWEIG, nur_leer=False)
    k = TX.atmen(k, PAD_T + 17, PAD_T + 11, E.verlauf3(i, 24, 0.0, 1), 0)
    Hm.kontur_schliessen(k, ERLAUBT, (85, 117, 169))
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + 17 + dy, vx=vx, vy=-12, off=o, form=f, wackeln=1.0, ph=p) for (x, dy, vx, o, f, p) in
         [(-2, 0, -1.5, 0, 'm', 0.0), (15, 1, 1.5, 10, 'o', 0.3), (-3, -2, -1.0, 20, 'o', 0.6), (16, -1, 1.0, 29, 'm', 0.1), (-1, 2, -2.0, 39, 'm', 0.8)]]
DUNST_FARBEN = {'c': E_, 'r': D_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'snowitall')
    L.speichern('mischief-militia-snowitall', 'Mischief Militia - SnowItAll', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-snowitall-strip.png', frames[::2], spalten=12, scale=6)
