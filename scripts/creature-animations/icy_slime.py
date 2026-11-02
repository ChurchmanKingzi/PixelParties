# -*- coding: utf-8 -*-
"""Idle-Animation für „Icy Slime“ (Creature) — der türkisfarbene Eiskristall-Schleim.

Quelle: src/icy-slime.png (18×18 px, 10 Farben, deckend).
PICK: [["Motive", 487, 1]]      Ebene „Icy Slime“ (xcf Motive, 18×18, Karte Icy_Slime.png zeigt ihn auf Maßstab 2 in der Mitte; keine Nachbarebene gehört zur Figur — die Ebenen 486/488 sind
Hintergrund/Nebel der Karte, Alpha < 255 bzw. 77×75). Die Quelle ist voll deckend (kein Alpha), es ist nichts umzurechnen.
(creature_show.py findet sie unter „Slime Rancher“, Treffer 14.)

Aufruf:   python3 icy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/icy-slime.png + .json

Was im Sprite ist (x, y im 18×18-Sprite):
* Körper: Eisklumpen aus Türkis in Stufen A (5,114,121) Umriss, F/H/D/C/B/E/G (Rampe bis (227,249,255)); die oberen Zipfel (y 0–6) sind gezackte Kristalle, unten (y 14–17) kleine Eisfüße.
* Gesicht: Augen = dunkle Blöcke F (29,141,145) bei (4–5, 7–9) und (12–13, 7–9) mit hellen Lichtpunkten I/J (86,179,184)/(202,249,255); Mund H (21,126,130) y 12 (x 6–11) und F y 13 (x 7–10).
  Die Augen lassen sich nicht sicher von Eiskanten trennen → KEIN Blinzeln.
Material: Eis — KEIN Glanz (Regel 14), kein Lichtband, keine Glitzersterne.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* Squash & Stretch (Periode 24, ±2 Stufen): Zeilen 4 und 10 werden doppelt eingefügt (Strecken, gleich breit) bzw. entfernt (Stauchen, ab 2 Stufen breiter) — anim_slime.koerper_pose (Mischtextur,
  Gesichtsfarben gesperrt), die Unterkante bleibt am Boden.
* Wabbeln (Periode 20): oben bis ±1 px waagerecht, unten 0 (Gefälle ≤ 1 px/Zeile).
* Kalter Dunst: 6 Wölkchen ≥ 2×2 (Farben E/B des Sprites) steigen langsam seitlich und über dem Schleim auf.
Ergänzungen: keine gemalten Pixel. Frame 0 = Original (Dunst ausgenommen).
"""
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 15, 3
TEST_EBENEN = ('koerper',)

spr = L.lade('icy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)
BODEN = PAD_T + sh - 1
SPERRE = [(29, 141, 145), (21, 126, 130), (86, 179, 184), (202, 249, 255)]
E_, B_ = (201, 251, 252), (166, 250, 252)


def koerper(i):
    k = E.schleim_koerper(spr, i, 24, PAD_L, W, H, BODEN, [4, 10], paare=((8, 9),), sperre=SPERRE, stufen=2, wabbel=1.0, wabbel_n=20)
    Hm.kontur_schliessen(k, ERLAUBT, (5, 114, 121))
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-12, off=o, form=f, wackeln=1.2, ph=p) for (x, y, vx, o, f, p) in
         [(-3, 14, -1.5, 0, 'm', 0.0), (20, 15, 1.5, 8, 'o', 0.3), (6, 0, -1.0, 16, 'o', 0.6), (13, 0, 1.0, 24, 'm', 0.1),
          (-2, 8, -2.0, 32, 'm', 0.8), (21, 9, 1.5, 40, 'o', 0.5)]]
DUNST_FARBEN = {'c': E_, 'r': B_}


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
    A.ausdruck_pruefen(ohne, spr, 'icy-slime')
    L.speichern('icy-slime', 'Icy Slime', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/icy-slime-strip.png', frames[::2], spalten=12, scale=5)
