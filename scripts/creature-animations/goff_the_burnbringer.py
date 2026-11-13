# -*- coding: utf-8 -*-
"""Idle-Animation für „Goff, the Burnbringer“ (Creature).

PICK: [["MotiveRussia", 198, 1], ["MotiveRussia", 197, 1], ["MotiveRussia", 194, 1], ["MotiveRussia", 196, 1], ["MotiveRussia", 195, 1]]   (von Hand aus dem Ebenen-Dump geholt; die Kartenkunst ist doppelt so groß und weichgezeichnet)
Quelle: src/goff-the-burnbringer.png (21×34 px) = Ebene 198 (Oberkörper, hinten) + Ebene 197 (große Flamme) + Ebene 194 (Kopf-/Schulterstück VOR der Flamme) + UNTERKÖRPER: Ebene 196 (Gürtel/Lendenschurz/Oberschenkel,
Zeilen 26–29, in der xcf mit Deckkraft 39 % = unter Wasser) + Ebene 195 (Füße, Zeilen 30–33, Deckkraft 15 %), beide hier voll deckend, Lage wie in der xcf (196 beginnt 1 px links vom Oberkörper → Sprite 1 Spalte breiter).
Die Teile liegen zusätzlich einzeln vor: src/goff-the-burnbringer-hinten.png (198 + 196 + 195) und -vorn.png (194), gleiche Leinwand. Nicht übernommen: Ebene 193 (Dunst, Alpha < 8).
Gegen die Kartenkunst abgeglichen (Figur im Maßstab 2; der Eisblock/das Wasser ist Szene; der Unterkörper schimmert dort dunkel durchs Wasser).

Was ist was (x/y im Sprite):
* Kleiner schwarz gepanzerter Kobold, Blick nach links: goldener Stachelschopf/Horn links oben (x 2–8, y 9–15), dunkler Kopf (x 4–13, y 13–20) mit einem Auge (weiß (6, 17), rot (7, 17)),
  goldene Akzente an Brust und Händen (y 19–25), graue Panzerplatten (y 21–25).
* Unterkörper (y 26–33): goldener Lendenschurz zwischen grauen Beinplatten, schwarze Füße mit goldenen Krallen links; steht fest am Boden.
* Große Flamme aus dem Rücken (x 9–20, y 0–19): dunkelroter Rand (167,48,26), Rot, Orange, Gelb (226,172,14), heller Kern (248,217,64) unten am Rücken.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Die Rückenflamme brennt (anim_feuer3, posen=16, halten=1): eine hohe Hauptzunge, eine kürzere Nebenzunge rechts und zwei ruhige Glutsockel am Rücken und hinter dem Schopf; Farben der Quelle in der Reihenfolge der Quelle.
  Sie liegt wie in der xcf zwischen Körper (hinten) und Kopf-/Schulterstück (vorn); der Flammenfuß sitzt lückenlos hinter dem Schulterstück. Die gemalte Flamme wird ersetzt → Frame 0 weicht dort ab (gewollt).
* Atmen: Panzerzeile 22 wird texturiert eingefügt (0–1 px, Periode 24); Kopf, Schopf und Flamme heben sich mit, Unterkörper und Füße bleiben stehen. Kopf nie seitlich.
* Blinzeln (Frames 20–22 und 41–43): Auge → dunkles Kopfgrau.
ERGÄNZUNG: (9, 10–13) rechter Umriss des Goldschopfs in dessen Umrissbraun (157,87,17) – in der Quelle von der Flamme verdeckt, sichtbar, wenn die Flamme dort gerade schmaler ist.
Keine Partikel außer den abreißenden Flammenfetzen von anim_feuer3. Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_feuer3 as F3
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 65
FIG = N2.Figur('goff-the-burnbringer', pad=(2, 3, 9, 2))
spr = FIG.spr
OFF = FIG.off
H, W = FIG.H, FIG.W
HINTEN, VORN = L.lade('goff-the-burnbringer-hinten'), L.lade('goff-the-burnbringer-vorn')
HINTEN[17, 7] = spr[17, 7]                                             # rotes Augenpixel (liegt in der xcf auf der Flammen-Ebene)

FARBEN = FIG.farbe((167, 48, 26), (216, 61, 41), (221, 114, 36), (226, 172, 14), (248, 217, 64))
DUNKEL = FIG.f(5, 18)
SCHOPFRAND = FIG.f(3, 9)
for _y in (10, 11, 12, 13):                                             # Ergänzung: rechter Umriss des Goldschopfs (in der Quelle von der Flamme verdeckt)
    HINTEN[_y, 9, :3] = SCHOPFRAND
    HINTEN[_y, 9, 3] = 255
_F = lambda x, y, l, b, **k: F3.Flamme(x + 1 + FIG.pl + 0.5, y + FIG.pt + 0.5, l, b, **k)
FEUER = F3.Feuer(H, W, [_F(13.2, 14.5, 17.0, 5.4, richtung=(-0.1, -1), phase=0.0, flug=0.3),
                        _F(16.0, 12.5, 9.0, 3.2, phase=0.45, flug=0.3, wiegen=0.3),
                        _F(14.0, 15.0, 6.0, 5.6, phase=0.7, bauch=0.2, schlag=0.3, puls=0.08, wiegen=0.1, baender=F3.SOCKEL + [(0.4, 0.2)]),
                        _F(10.6, 12.0, 6.5, 3.4, phase=0.2, bauch=0.2, schlag=0.3, puls=0.08, wiegen=0.1, flug=0.3)],
                 FARBEN, posen=16, halten=1)


def frame(i, nur=None):
    hi = L.platz(HINTEN, H, W, FIG.pl, FIG.pt)
    vo = L.platz(VORN, H, W, FIG.pl, FIG.pt)
    if N2.fenster(i, N, 20, [1, 1, 1]) or N2.fenster(i, N, 41, [1, 1, 1]):
        N2.setze(hi, OFF, {(6, 17): DUNKEL, (7, 17): DUNKEL})
    b = N2.hub(i, 24, 1)
    hi = TX.streck_zeile(hi, FIG.pt + 22, b)
    vo = TX.streck_zeile(vo, FIG.pt + 22, b)
    fl = FEUER.ebene(i, dy=-b)
    fr = L.zusammen(H, W, [(hi, 0, 0), (fl, 0, 0), (vo, 0, 0)])
    for (x, y) in N2.loecher(fr):                                    # 1-px-Lücke zwischen Flammenrand und Schopf schließen (Flammenrandfarbe)
        fr[y, x, :3] = FARBEN[0]
        fr[y, x, 3] = 255
    return fr


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Goff, the Burnbringer')
