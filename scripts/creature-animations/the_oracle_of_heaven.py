# -*- coding: utf-8 -*-
"""Idle-Animation für „The Oracle of Heaven“ (Creature) — kahler Seher in violetter Robe, hält einen leuchtenden Kristall vor der Brust.

PICK: [["MotiveMoe", 400, "Ebene „Oracle of Heaven“ (20×24 px, ganze Ebene)"]]
Abgleich mit data/card-art/native/The_Oracle_of_Heaven.png: Figur stimmt (83 %, Rest ist der gelbe Strahlenkranz darüber). Nicht verwendet: Ebene 399 (Strahlenkranz, Deckkraft 20 %),
Ebene 401 (vier Wasserspeier-Statuen = Szene).

Identifikation (20×24): kahler Kopf (x 4–15, y 0–9, Hauttöne), Augen y 6–7 (weiß (246,255,255)/(213,213,213), graue Iris (123,123,123), gelber Lichtpunkt), breite Schulterflügel der Robe
(y 10–13, Dunkelviolett mit rosa Saum (255,175,255)), vor der Brust ein violetter Kristall (x 8–11, y 14–17; (162,96,255) (208,175,255) (96,38,178)), den beide Hände (Haut, y 16–17)
halten; Robe bis y 23 (Zackensaum).
Humanoid: Kopf bleibt gerade, nichts schwebt. Der Kristall ist ein Edelstein → Pulsieren/Sparkle erlaubt.

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Atmen (Periode 32): in der Robe (y 19) wird eine texturierte Zeile eingefügt (TX.streck_zeile), Oberkörper samt Kristall und Kopf heben sich 1 px; der Saum bleibt am Boden.
* Blinzeln (Frames 26–28 und 58–59): Augen → Hautfarbe, Lidstrich in der dunkleren Hautfarbe (180,123,49).
* Kristall pulsiert (Periode 16): die drei Violetttöne wandern eine Stufe heller und zurück (Facetten), dazu ein kurzes Sparkle (Frames 12–16 und 44–48) an der oberen Kristallkante.
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('the-oracle-of-heaven', (3, 3, 4, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
FIG = sz.teil(sz.da)
V1, V2, V3, WEISS = (96, 38, 178), (162, 96, 255), (208, 175, 255), (246, 255, 255)
KRISTALL = sz.voll(sz.ist(V1, V2, V3) & (yy >= 14) & (yy <= 17))
HAUT, LID = (213, 164, 98), (180, 123, 49)
AUGEN = [(x, y) for y in (6, 7) for x in (6, 7, 8, 11, 12, 13)]
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = N7.stufe(i, 32, 6, 13)
    f = FIG
    if N7.stufe(i, 16, 6, 5):
        f = N7.farbtausch(f, KRISTALL, {V1: V2, V2: V3})
    f = f.copy()
    if i in (26, 27, 28, 58, 59):
        for x, y in AUGEN:
            f[sz.PT + y, sz.PL + x, :3] = LID if y == 7 else HAUT
    f = TX.streck_zeile(f, sz.PT + 19, n)
    if not nur:
        st = N7.funkel_folge(i % 32, 32, 12, (1, 2, 2, 1))
        if st:
            N7.funkel(f, sz.PL + 10, sz.PT + 14 - n, st, WEISS)
    return f


if __name__ == '__main__':
    N7.fertig('the-oracle-of-heaven', 'The Oracle of Heaven', frame, N, MS, spr, check=[0, 8, 13, 27], zoom=13)
