# -*- coding: utf-8 -*-
"""Idle-Animation für „Slimy Slime“ (Creature) — der grüne Schleim.

Quelle: src/slimy-slime.png (18×14 px, 11 Farben, deckend).
PICK: [["Motive", 471, "ganze Ebene (Pfütze)"], ["Motive", 472, "Figur 1"]]   Ebene 472 „Slimy Slime“ (16×11, Kopf/Oberkörper) + Ebene 471 „Ebene #551“ (18×5, die untere Körperhälfte/Pfützensaum;
im Spiel halbtransparent) — zusammengesetzt mit anim_slime.ebenen_sprite([(471, None), (472, None)], 'slimy-slime'): die Pfütze liegt unten, der Kopf darüber, beide hier voll deckend (Regel 22).
Die Kartenkunst Slimy_Slime.png zeigt die Figur auf Maßstab 2.

Aufruf:   python3 slimy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slimy-slime.png + .json

Was im Sprite ist (x, y im 18×14-Sprite):
* Körper: grüner Schleim in Stufen B/C/D/E/F/G (Rampe (106,167,87)…(160,204,147)), dunkelgrüner Umriss A (41,65,0), schwacher Aufheller G/J oben Mitte (7–10, 2–4) und am Saum G unten.
* Augen: je 2×2 dunkles H/J (45,50,44) mit weißem Lichtpunkt K (242,253,239): links (5,5)(6,5)(5,6)+K(6,6), rechts (11,5)(12,5)(12,6)+K(11,6); Mund: dunkles I/H (21,66,9)/(46,89,33) y 8–9 (x 6–12).
* Saum/Pfütze (y 10–13): breiter Fuß, zwei Randzipfel A bei (0,10) und (17,10).
Material: Schleim — KEIN Glanz (Regel 14).

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* Squash & Stretch (Periode 24, ±2 Stufen): Zeilen 3 und 11 (über den Augen / unter dem Mund) werden doppelt eingefügt (Strecken, ab 2 Stufen schmaler) bzw. entfernt (Stauchen, ab 2 Stufen breiter) — anim_slime.koerper_pose (Mischtextur, Gesichtsfarben gesperrt); die Unterkante bleibt am Boden.
* Wabbeln (Periode 16): oben bis ±1 px waagerecht, unten 0 (Zeilenversatz mit Gefälle ≤ 1 px/Zeile).
* Blinzeln (alle 2,3 s, 2 Frames): die dunklen Augen werden zu Körpergrün D (97,163,76) (Lid in Körperfarbe).
* 3 Schleimbläschen (Wölkchen ≥ 2×2, Farben G/E des Sprites) steigen über dem Kopf auf und zerplatzen.
Ergänzungen: keine gemalten Pixel außer den Augenlidern (Quellfarbe D). Frame 0 = Original.
"""
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 14, 3
TEST_EBENEN = ('koerper',)

spr = L.lade('slimy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)
BODEN = PAD_T + sh - 1
AUGEN = [(5, 5), (6, 5), (5, 6), (6, 6), (11, 5), (12, 5), (11, 6), (12, 6)]
SPERRE = [(45, 50, 44), (242, 253, 239), (21, 66, 9), (46, 89, 33)]
D_ = (97, 163, 76)
G_, E_ = (160, 204, 147), (136, 204, 118)


def koerper(i):
    k = E.schleim_koerper(spr, i, 24, PAD_L, W, H, BODEN, [3, 11], paare=((8, 9),), sperre=SPERRE, stufen=2, wabbel=1.0, wabbel_n=16)
    return k


def koerper_mit_blinzeln(i):
    k = koerper(i)
    if Hm.folge(i, 33, [1, 1], N):
        # Augen suchen (Pixel mit Augenfarben) und mit Körpergrün überdecken
        for y in range(H):
            for x in range(W):
                if k[y, x, 3] and tuple(int(v) for v in k[y, x, :3]) in [tuple(c) for c in SPERRE[:2]]:
                    k[y, x, :3] = D_
    Hm.kontur_schliessen(k, ERLAUBT, (41, 65, 0))
    return k


BLASEN = [dict(x=PAD_L + x, y=PAD_T - 3, vx=vx, vy=-9, off=o, form='o', wackeln=1.0, ph=p) for (x, vx, o, p) in [(7, -2.0, 0, 0.0), (11, 2.0, 16, 0.4), (9, 0.0, 32, 0.7)]]
DUNST_FARBEN = {'c': G_, 'r': E_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, BLASEN, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper_mit_blinzeln(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'slimy-slime')
    L.speichern('slimy-slime', 'Slimy Slime', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slimy-slime-strip.png', frames[::2], spalten=12, scale=6)
