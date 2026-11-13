# -*- coding: utf-8 -*-
"""Idle-Animation für „Weapon Collecting Wight“ (Creature) — schwebender Kapuzengeist mit rotem Glühauge, blauen Ektoplasma-Armen und einem Schwert, das er am Griff hält.

Quelle: src/weapon-collecting-wight.png (50×39 px, 31 Farben; vorbereitet aus MotiveGrailWar).
PICK: [["MotiveGrailWar", 396, 1]] (Kapuzenkörper „Ebene #13“) + die Nachbarebenen mit Ektoplasma-Armen/-Schweif und dem Schwert (in src/ bereits zusammengesetzt; Lage wie in der Kartenkunst
Weapon_Collecting_Wight.png: Geist links, Schwert waagerecht rechts, Griff zum Geist). Die zweite Figur der Kunst (roter Ritter rechts unten) ist das Opfer/Beiwerk und gehört nicht dazu.

Was im Sprite ist (x, y):
* KAPUZE/UMHANG (x 6–19, y 0–21): Grautöne (25..82), Saum unten gezackt (y 18–21). Im Kapuzenschatten das ROTE GLÜHAUGE (x 13–16, y 7–10): Kern (221,21,21) bei (15,8), (179,17,17) bei (14,8),(14,9),(15,9),
  Hof (111,11,11). Kein Lid → kein Blinzeln; das Glühen pulsiert nur innerhalb dieser Pixel.
* LINKER EKTOPLASMA-ARM (x 0–7, y 15–26; (47,70,200)/(123,173,236)/(198,235,254)): hängt als Ranke nach links unten, endet in losen hellen Tropfen (x 0–5, y 21–26).
* RECHTER EKTOPLASMA-ARM (x 18–27, y 9–17): steigt von der Schulter schräg nach rechts oben, die „Hand“ (x 24–27, y 9–13) fasst den Schwertknauf.
* SCHWERT (x 28–49, y 7–18): Knauf (28,11–14), Griff rot (x 31–33), Parierstange senkrecht (x 34–36, y 7–18), Klinge (x 37–48, y 11–14; (222,222,222)/(191,191,191)/(150,150,150)), blutige Spitze (57,9,12) + ein Blutpixel (49,8).
  Metall → kurzer Sparkle. Das Schwert ist starr und folgt exakt der Hand.
* GEISTERSCHWEIF (x 7–18, y 23–38): blaues Ektoplasma unter dem Umhang, läuft nach unten spitz aus; die Figur hat keine Beine → sie SCHWEBT (Flieger: Schweben erlaubt).

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos, Frame 0 = Original):
* SCHWEBEN: die ganze Figur hebt/senkt sich 1 px (Periode 48).
* SCHWERT WIEGEN (Idle-Idee: er wägt seine Beute): rechter Arm + Schwert als Pose — die Armspalten schwenken um die Schulter (x 19; Gefälle ≤ 1 px je 4 Spalten), das Schwert geht starr mit der Hand ±2 px (Periode 24).
* SCHWEIF weht: Zeilen laufen als Welle nach unten (≤ 2 px an der Spitze, Periode 16); LINKER ARM pendelt als Ranke (≤ 1 px, Periode 24). Beides Ektoplasma (kein starrer Gegenstand).
* GLÜHAUGE pulsiert (Periode 12: Kern eine Stufe dunkler / Nachbarn heller, nur Augenpixel).
* SPARKLE auf der Klinge (Frames 20–23), sonst Pause.
Ergänzungen: keine (Arme und Schweif überdecken nichts). Keine neuen Farben.
"""
import math

import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1

N, MS = 48, 75
spr = L.lade('weapon-collecting-wight')
S = N1.Szene(spr, (5, 6, 5, 5))
H, W, OFF = S.H, S.W, S.OFF
xx, yy = S.xx, S.yy
BLAU = L.farbmaske(spr, [(47, 70, 200), (123, 173, 236), (198, 235, 254)])
SCHWERT = S.da & (xx >= 28)
ARM_R = BLAU & (xx >= 18) & (yy <= 17)
SCHWEIF = BLAU & (yy >= 23) & (xx >= 6)
ARM_L = BLAU & ~ARM_R & ~SCHWEIF
KOERPER = S.da & ~SCHWERT & ~ARM_R & ~SCHWEIF & ~ARM_L
assert not (KOERPER & BLAU).any()
E_K, E_SW, E_AR, E_SF, E_AL = (S.ebene(m) for m in (KOERPER, SCHWERT, ARM_R, SCHWEIF, ARM_L))
ROT_K, ROT_M, ROT_D = (221, 21, 21), (179, 17, 17), (111, 11, 11)
assert S.col(15, 8) == ROT_K and S.col(14, 8) == ROT_M and S.col(15, 9) == ROT_M
WEISS, HELL = (222, 222, 222), (191, 191, 191)
TEST_EBENEN = 'koerper'


def env(i):
    return min(1.0, 6 * math.sin(math.pi * i / N) ** 2)


def frame(i, nur=None):
    kb = E_K.copy()
    ph = i % 12
    if ph in (5, 6, 7):                                    # Glühen: Kern dunkler, dann heller Hof
        kb[OFF[1] + 8, OFF[0] + 15, :3] = ROT_M
    if ph in (9, 10):
        for (x, y) in ((14, 8), (15, 9)):
            kb[OFF[1] + y, OFF[0] + x, :3] = ROT_K
    k = int(round(2 * math.sin(L.sinus(i, 24))))          # Hand/Schwert
    arm = N1.spalten_dy(E_AR, lambda x: int(round(k * min(1.0, max(0, x - OFF[0] - 19) / 7.0))))
    schwert = L.versetze(E_SW, 0, k)
    e = env(i)
    schweif = N1.zeilen_dx(E_SF, lambda y: int(round(e * (0.4 + 1.8 * (y - OFF[1] - 23) / 15.0) * math.sin(L.sinus(i, 16) - (y - OFF[1] - 23) * 0.45))))
    arml = N1.zeilen_dx(E_AL, lambda y: int(round(e * 1.3 * max(0, y - OFF[1] - 16) / 10.0 * math.sin(L.sinus(i, 24) - (y - OFF[1] - 16) * 0.3))))
    f = L.zusammen(H, W, [(schweif, 0, 0), (kb, 0, 0), (arml, 0, 0), (arm, 0, 0), (schwert, 0, 0)])
    fk = {20: 0, 21: 1, 22: 1, 23: 0}.get(i)
    if fk is not None and nur != 'koerper':
        px, py = S.P(40, 12)
        N1.funkel(f, px, py + k, fk, WEISS, WEISS, nur_leer=False)
    dy = -int(round(0.5 - 0.5 * math.cos(L.sinus(i, N)) + 0.0)) if True else 0
    return L.versetze(f, 0, dy)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('weapon-collecting-wight', 'Weapon Collecting Wight', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
