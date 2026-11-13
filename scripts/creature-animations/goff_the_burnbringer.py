# -*- coding: utf-8 -*-
"""Idle-Animation für „Goff, the Burnbringer“ (Creature).

PICK: [["MotiveRussia", 198, 1], ["MotiveRussia", 197, 1], ["MotiveRussia", 194, 1]]   (von Hand aus dem Ebenen-Dump geholt; die Kartenkunst ist doppelt so groß und weichgezeichnet, daher kein Treffer im Abgleich)
Quelle: src/goff-the-burnbringer.png (20×26 px, 18 Farben) = Ebene 198 (Körper, hinten) + Ebene 197 (große Flamme) + Ebene 194 (Kopf-/Schulterstück VOR der Flamme), Lage und Stapelung wie in der xcf.
Die Teile liegen zusätzlich einzeln vor: src/goff-the-burnbringer-hinten.png (198) und -vorn.png (194), gleiche Leinwand. Nicht übernommen: Ebene 193 (Schatten/Dunst, Alpha < 8), 195/196 (Spiegelung im
Eis, Deckkraft 15–39 %). Gegen die Kartenkunst abgeglichen (Figur im Maßstab 2 bei etwa (62, 34); der Eisblock/das Wasser ist Szene). ACHTUNG: Die Figur ist in der Quelle an der Wasserlinie gerade
abgeschnitten (unterste Zeile 25 ist kein Umriss) – Beine gibt es in keiner Ebene; nichts dazuerfunden.

Was ist was (x/y im Sprite):
* Kleiner schwarz gepanzerter Kobold, Blick nach links: goldener Stachelschopf/Horn links oben (x 1–7, y 9–15), dunkler Kopf (x 3–12, y 13–20) mit einem Auge (weiß (5, 17), rot (6, 17)),
  goldene Akzente an Brust und Händen (y 19–25), graue Panzerplatten (y 21–25).
* Große Flamme aus dem Rücken (x 8–19, y 0–19): dunkelroter Rand (167,48,26), Rot, Orange, Gelb (226,172,14), heller Kern (248,217,64) unten am Rücken.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Die Rückenflamme brennt (anim_feuer3, posen=16, halten=1): eine hohe Hauptzunge, eine kürzere Nebenzunge rechts und zwei ruhige Glutsockel am Rücken und hinter dem Schopf; Farben der Quelle in der Reihenfolge der Quelle.
  Sie liegt wie in der xcf zwischen Körper (hinten) und Kopf-/Schulterstück (vorn); der Flammenfuß sitzt lückenlos hinter dem Schulterstück. Die gemalte Flamme wird ersetzt → Frame 0 weicht dort ab (gewollt).
* Atmen: Panzerzeile 22 wird texturiert eingefügt (0–1 px, Periode 24); Kopf, Schopf und Flamme heben sich mit. Kopf nie seitlich.
* Blinzeln (Frames 20–22 und 41–43): Auge → dunkles Kopfgrau.
ERGÄNZUNG: (8, 10–13) rechter Umriss des Goldschopfs in dessen Umrissbraun (157,87,17) – in der Quelle von der Flamme verdeckt, sichtbar, wenn die Flamme dort gerade schmaler ist.
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
HINTEN[17, 6] = spr[17, 6]                                             # rotes Augenpixel (liegt in der xcf auf der Flammen-Ebene)

FARBEN = FIG.farbe((167, 48, 26), (216, 61, 41), (221, 114, 36), (226, 172, 14), (248, 217, 64))
DUNKEL = FIG.f(4, 18)
SCHOPFRAND = FIG.f(2, 9)
for _y in (10, 11, 12, 13):                                             # Ergänzung: rechter Umriss des Goldschopfs (in der Quelle von der Flamme verdeckt)
    HINTEN[_y, 8, :3] = SCHOPFRAND
    HINTEN[_y, 8, 3] = 255
_F = lambda x, y, l, b, **k: F3.Flamme(x + FIG.pl + 0.5, y + FIG.pt + 0.5, l, b, **k)
FEUER = F3.Feuer(H, W, [_F(13.2, 14.5, 17.0, 5.4, richtung=(-0.1, -1), phase=0.0, flug=0.3),
                        _F(16.0, 12.5, 9.0, 3.2, phase=0.45, flug=0.3, wiegen=0.3),
                        _F(14.0, 15.0, 6.0, 5.6, phase=0.7, bauch=0.2, schlag=0.3, puls=0.08, wiegen=0.1, baender=F3.SOCKEL + [(0.4, 0.2)]),
                        _F(10.6, 12.0, 6.5, 3.4, phase=0.2, bauch=0.2, schlag=0.3, puls=0.08, wiegen=0.1, flug=0.3)],
                 FARBEN, posen=16, halten=1)


def frame(i, nur=None):
    hi = L.platz(HINTEN, H, W, FIG.pl, FIG.pt)
    vo = L.platz(VORN, H, W, FIG.pl, FIG.pt)
    if N2.fenster(i, N, 20, [1, 1, 1]) or N2.fenster(i, N, 41, [1, 1, 1]):
        N2.setze(hi, OFF, {(5, 17): DUNKEL, (6, 17): DUNKEL})
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
