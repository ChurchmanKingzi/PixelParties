# -*- coding: utf-8 -*-
"""Idle-Animation für „Race Boat Captain“ (Creature) — muskulöser Kapitän mit Totenkopf-Hut und verschränkten Armen; die Hutbänder pendeln.

PICK: [["MotiveIndia", 231, "Ebene „Race Boat Captain“ (18×25 px, ganze Ebene)"]]
Quelle vollständig (eine Figur). Für die Karte liegt keine Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (18×25): schwarzer Kapitänshut mit weißem Totenkopf (x 3–14, y 0–6), an beiden Hutseiten hängt je ein weiß-graues Band mit Querstück am Ende (x 0–2 und 15–17, y 3–11),
braungebranntes Gesicht (y 7–11; Augen: Weiß (7,8) (7,9), Pupillen (8,8) (8,9) (11,8) (11,9)), schwarzer Bart/Haare seitlich, nackter Oberkörper mit vor der Brust verschränkten Armen
(y 12–17), weiße Hose (y 18–21), Beine und schwarze Stiefel (y 22–24).
Humanoid: Kopf bleibt gerade, nichts schwebt; die verschränkten Arme sind eine starre Einheit (werden nicht gestreckt).

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Atmen (Periode 32): in der Hose (y 19) wird eine texturierte Zeile eingefügt (TX.streck_zeile), Oberkörper, Arme, Kopf und Hut heben sich als Ganzes 1 px; Stiefel stehen.
* Hutbänder pendeln (Periode 32): die unteren vier Zeilen jedes Bandes (y 8–11, samt Querstück) schwingen starr 1 px nach links, zurück, 1 px nach rechts – beide Bänder gleichsinnig.
* Blinzeln (Frames 22–24 und 54–55): Augenpixel → Hautfarbe (205,115,57).
Kein Glanz (kein Metall erkennbar). Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('race-boat-captain', (3, 3, 3, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
BAND_M = ((xx <= 2) | (xx >= 15)) & (yy >= 8) & (yy <= 11)
BAND, REST = sz.teil(BAND_M), sz.teil(~BAND_M)
HAUT = (205, 115, 57)
AUGEN = [(7, 8), (8, 8), (11, 8), (7, 9), (8, 9), (11, 9)]


def frame(i, nur=None):
    n = N7.stufe(i, 32, 6, 13)
    rest = REST.copy()
    if i in (22, 23, 24, 54, 55):
        for x, y in AUGEN:
            rest[sz.PT + y, sz.PL + x, :3] = HAUT
    f = L.zusammen(sz.H, sz.W, [(rest, 0, 0), (BAND, N7.sinus_px(i, 32, 1), 0)])
    return TX.streck_zeile(f, sz.PT + 19, n)


if __name__ == '__main__':
    N7.fertig('race-boat-captain', 'Race Boat Captain', frame, N, MS, spr, check=[0, 8, 23, 24, 40], zoom=13)
