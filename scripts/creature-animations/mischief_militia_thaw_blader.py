# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Thaw Blader“ (Creature) — der Schneemann mit Fasshelm und der glühend roten Zackenklinge.

Quelle: src/mischief-militia-thaw-blader.png (23×34 px, 25 Farben, deckend) — aus DREI Ebenen zusammengesetzt (von Hand, creature_show.py findet nur den Schneemann):
PICK: [["MotiveRussia", 53, 2], ["MotiveRussia", 52, "ganze Ebene"], ["MotiveRussia", 51, "ganze Ebene"]]
  Ebene 53 (Figur 2 = Schneemann mit Fasshelm, Karte (19,29)) + Ebene 52 (graues Schwert mit Parierstange/Griff, Karte (29,11)) + Ebene 51 (rote Zackenklinge (255,0,0) über dem Schwert, Karte (33,11)).
  Die Lage der Ebenen zueinander ist per Abgleich mit data/card-art/native/Mischief_Militia_Thaw_Blader.png bestimmt (Ebene 51: 102 von 102 Pixeln deckungsgleich, Ebene 52 Griff 48 von 48).
  Nicht übernommen: Ebene 50 (großer roter, halbtransparenter Glutschein hinter der Klinge, Alpha < 255) und der Rotor-Schneemann rechts oben in der Ebene 53 (anderer Kartenteil).

Aufruf:   python3 mischief_militia_thaw_blader.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-thaw-blader.png + .json

Was im Sprite ist (x, y im 23×34-Sprite):
* KLINGE (x 14–22, y 0–19): rote (255,0,0) Zackenklinge wie ein Thermometer: Rücken x 14–16, kurze Zacken (6 px breit) und je Dreiergruppe eine lange Spitze bis x 22 bei y 5/9/13/17.
* PARIERSTANGE/GRIFF (x 11–21, y 20–29): sehr dunkle Brauntöne B/M/N/O/R (6,4,4)…(57,35,35), Knauf bei y 28–29.
* HELM (x 3–11, y 19–27): runder brauner Fasshelm F/J/L (134,62,22)/(175,97,51)/(189,115,68) mit dunklem Visierschlitz D/S/T/U/W/X/Y und zwei grauen Augenpunkten V (162,165,171) bei (6,24)/(10,24).
* SCHNEEMANN (y 25–33): Schneeball G/H/I/E/P mit blauem Umriss G (85,117,169); linker Zweigarm K (104,64,32): (0,25) (1,26) (2,27).
Material: Schnee, Holz-Helm, Klinge (rot, KEIN Glanz, kein Feuer — es ist eine heiße Klinge ohne Flammen), deshalb Dampf statt Flackern.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* Hitzeflimmern der Klinge (Periode 12, Wellenlauf von unten nach oben): die langen Zackenspitzen verlängern/verkürzen sich um 1 px (x 21…23), die kurzen Zacken (x 19) pulsieren gegenphasig um 1 px.
* Schwert wiegt sich (Periode 24): die Klingenzeilen y 0–19 neigen sich bis ±1 px, Griffbereich (y ≥ 20) bleibt in der Hand; Zeilenversatz ≤ 1 px je Zeile (Klinge bleibt zusammenhängend).
* Atmen (Periode 24): die Zeile 31 des Schneeballs wird einmal doppelt eingefügt — Helm, Schwert (in der Hand) und Zweigarm steigen 1 px mit.
* Linker Zweigarm schlenkert (Periode 32): Spitze zwischen y 21 und 27, Linie 4-verbunden von der Schulter (2,27).
* Dampf von der heißen Klinge: 4 Wölkchen ≥ 2×2 (Farben E/I des Sprites) steigen langsam über der Klingenspitze auf; kalter Dunst: 3 Wölkchen am Boden.
Ergänzungen: keine gemalten Pixel außer Zacken-Spitzen (Farbe A (255,0,0) der Klinge) und Zweigarm (K). Frame 0 = Original (Dampf/Dunst ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 8, 9, 14, 4
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-thaw-blader')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

ROT = (255, 0, 0)
ZWEIG = (104, 64, 32)
LANG = [5, 9, 13, 17]                                             # Zeilen der langen Zackenspitzen (x 14–22)
KURZ = [4, 6, 8, 10, 12, 14, 16, 18]                              # Zeilen der kurzen Zacken (x 14–19)
for y in LANG:
    assert all(tuple(spr[y, x, :3]) == ROT for x in range(14, 23))
for y in KURZ:
    assert all(tuple(spr[y, x, :3]) == ROT for x in range(14, 20)) and not spr[y, 20, 3]
ARM_L = [(0, 25), (1, 26)]
E_, I_ = (214, 213, 244), (204, 204, 242)


def lauf(i, y):
    """Wellenwert −1…1 der Zeile y (läuft nach oben), 0 in Frame 0 für alle Zeilen."""
    return math.sin(L.sinus(i, 12) + 0.5 * (19 - y)) - math.sin(0.5 * (19 - y))


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # Hitzeflimmern: lange Spitzen ±1 px (x 21…23), kurze Zacken x 19 ±1 gegenphasig
    for y in LANG:
        d = int(round(lauf(i, y) / 1.2))
        if d >= 1:
            Hm.setze(k, {(23, y): ROT}, OFF)
        elif d <= -1:
            Hm.setze(k, {(22, y): None}, OFF)
    for y in KURZ:
        d = int(round(-lauf(i, y) / 1.2))
        if d >= 1:
            Hm.setze(k, {(20, y): ROT}, OFF)
        elif d <= -1:
            Hm.setze(k, {(19, y): None}, OFF)
    # Schwert wiegt sich: Klingenzeilen kippen (Griff ab y 20 bleibt)
    amp = 1.5
    dx = {}
    for y in range(0, 20):
        f = (20 - y) / 20.0
        dx[y] = int(round(amp * f * math.sin(L.sinus(i, 24))))
    for y, d in dx.items():
        Y = y + OFF[1]
        xs = [x for x in range(W) if k[Y, x, 3]]
        if d and xs:
            row = k[Y].copy(); k[Y] = 0
            for x in xs:
                k[Y, x + d] = row[x]
    # Zweigarm
    ty = 25 + int(round(2.6 * math.sin(L.sinus(i, 32))))
    if ty != 25:
        E.zweig_loeschen(k, OFF, ARM_L)
        E.zweig_zeichnen(k, OFF, (2, 27), (0, ty), ZWEIG, nur_leer=False)
    k = Hm.atmen(k, PAD_T + 31, PAD_T + 22, E.verlauf3(i, 24, 0.0, 1), 0)
    Hm.kontur_schliessen(k, ERLAUBT, (85, 117, 169))
    return k


DAMPF = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-9, off=o, form=f, wackeln=1.0, ph=p) for (x, y, vx, o, f, p) in
         [(18, 1, 1.0, 0, 'm', 0.0), (21, 3, -1.0, 12, 'o', 0.3), (16, 0, 0.5, 24, 'o', 0.6), (20, 2, 1.0, 36, 'm', 0.1)]]
DUNST = [dict(x=PAD_L + x, y=PAD_T + 32, vx=vx, vy=-10, off=o, form=f, wackeln=1.0, ph=p) for (x, vx, o, f, p) in
         [(-2, -1.5, 5, 'm', 0.0), (25, 1.5, 21, 'o', 0.4), (1, -1.0, 37, 'm', 0.7)]]
DUNST_FARBEN = {'c': E_, 'r': I_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DAMPF + DUNST, DUNST_FARBEN), 0, 0))
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
    A.ausdruck_pruefen(ohne, spr, 'thaw-blader')
    L.speichern('mischief-militia-thaw-blader', 'Mischief Militia - Thaw Blader', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-thaw-blader-strip.png', frames[::2], spalten=12, scale=5)
