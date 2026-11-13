# -*- coding: utf-8 -*-
"""Idle-Animation für „Time Tyrant“ (Creature) — das schädelköpfige Wesen mit dem rosa-braunen Haarwulst, den großen dunkelblauen Augenhöhlen, dem dunklen Stab und dem Fragezeichen über dem Kopf.

Quelle: src/time-tyrant.png (27×39 px, 24 Farben).
PICK: [["MotiveMoe", 293, 1]] (Ebene „Time Tyrant“, komplett inkl. Fragezeichen). Die Nachbarebene 294 („Ebene #78“) ist die violette Zeitblase hinter der Figur (teils halbtransparent,
      Hintergrund-Effekt der Karte) und wurde bewusst NICHT übernommen. Abgleich mit Time_Tyrant.png: Figur stimmt überein.

Was im Sprite ist (x, y im 27×39-Sprite):
* FRAGEZEICHEN (y 0–12, x 14–21): weiß mit schwarzem Umriss; Comic-Zeichen, kein Körperteil (die Karte lässt die oberste Karte des Decks aufdecken).
* HAARWULST (y 12–20, rechts bis y 27): rosa/braun (191,135,138)/(138,88,89)/(74,33,31)/(59,25,15); zwei braune Spitzen (16,12) und (19,12).
* SCHÄDEL (y 20–31, x 11–23): beige (208,195,142)/(142,119,78); zwei große dunkelblaue AUGENHÖHLEN (x 11–14 und 17–20, y 21–24) mit je einem 2×2-Lichtfleck
  (hell (100,115,152) oben rechts, dunkel (45,53,77) unten links); darunter blaue Schattenpartien (y 25–30) und die Zahnreihe (y 28–30, hell (172,170,147)/(216,214,193)).
  Die blauen Partien unter den Augen sind nicht sicher deutbar (Wangen-/Kieferschatten) → bleiben fest.
* BEINE (y 31–37): zwei dünne braune Beine (48,28,3)/(142,119,78).
* ARM + STAB (x 0–13, y 25–38): rosa Arm (x 7–10) hält den dunkelblauen Stab (30,31,52)/(77,86,115) schräg; das Stabende (12–13, 38) ist der tiefste Punkt → der Stab steht auf dem Boden
  und bleibt samt Arm völlig still (Regel 44).
Kein Metall/Gold → kein Glanz; keine Partikel.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos, bewusst ruhig); Idee: der Zeit-Tyrann tickt — die Lichtflecken in den Augenhöhlen wandern wie Uhrzeiger im Kreis.
* Augen-Ticken: der 2×2-Lichtfleck jeder Augenhöhle dreht sich alle 6 Frames eine Vierteldrehung im Uhrzeigersinn (nur die vier Pixel der Höhle, nur deren drei Quellfarben).
* Atmen (Periode 24): Beinzeile 34 wird einmal texturiert eingefügt (TX, nur in der Körperebene) — Schädel und Haar heben sich 1 px; Arm und Stab bleiben stehen (Schulter bleibt verbunden).
* Fragezeichen: wippt 1 px (Periode 12), verschwindet in Frame 22 über den Punkt (2 Frames nur der Punkt) und taucht ab Frame 40 ebenso wieder auf.
Frame 0 = Original. Ergänzungen: keine.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 80
F = G.Figur('time-tyrant', (2, 2, 3, 2))
spr = F.spr
STAB = L.farbmaske(spr, [(30, 31, 52), (77, 86, 115), (40, 46, 69), (53, 62, 86)])
frage = F.box(14, 0, 21, 11) | F.punkte([(17, 12), (18, 12)])
punkt = F.box(16, 9, 19, 11) | F.punkte([(17, 12), (18, 12)])
arm = (F.box(0, 25, 10, 38) | STAB) & ~frage
rumpf = F.da & ~frage & ~arm
TEST_EBENEN = ('koerper',)
RING = [(1, 0), (1, 1), (0, 1), (0, 0)]                             # Uhrzeigersinn ab oben rechts


def augen(k, s):
    for x0 in (12, 18):
        farben = [F.f(x0 + dx, 22 + dy) for dx, dy in RING]
        F.setze(k, {(x0 + RING[(j + s) % 4][0], 22 + RING[(j + s) % 4][1]): farben[j] for j in range(4)})


def frame(i, nur=None):
    k = F.ebene(rumpf)
    augen(k, (i // 6) % 4)
    k = F.streck(k, 34, Hm.stufe(i, 24, 1))
    fig = G.ueber(F.ebene(arm), k)
    if nur:
        return fig
    if i < 22 or i >= 42:
        fig = G.ueber(fig, F.ebene(frage, 0, -Hm.stufe(i, 12, 1)))
    elif i < 24 or i >= 40:
        fig = G.ueber(fig, F.ebene(punkt))
    return fig


if __name__ == '__main__':
    G.abschluss(F, 'Time Tyrant', [frame(i) for i in range(N)], MS, rand=False)
