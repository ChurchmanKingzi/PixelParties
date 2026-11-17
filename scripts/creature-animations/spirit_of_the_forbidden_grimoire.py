# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Forbidden Grimoire“ (Creature).

PICK: [["MotiveGrailWar", 687, 1]]   (von Hand aus dem Ebenen-Dump geholt: die Ebene liegt direkt über dem Bibliotheks-Hintergrund 688 und ist halbtransparent gemalt, deshalb fand der Abgleich sie nicht)
Quelle: src/spirit-of-the-forbidden-grimoire.png (35×46 px, 19 Farben) = Ebene 687 „Ebene #19“, vollständig. Die Ebene enthält Pixel mit Alpha 204 (Flügel) und 255; für die Animation sind alle deckend
(Regel 22), Farben unverändert. Gegen die Kartenkunst abgeglichen (Bücherregale und Teppich sind Szene; auf der Karte scheint die Figur leicht durch – das ist die Ebenendeckkraft, nicht Teil des Sprites).

Was ist was (x/y im Sprite):
* Gehörnter Dämon in dunkelvioletter Kapuzenrobe (x 9–25, y 8–45): zwei Hörner (x 13–14 und 20–21, y 8–13), Kapuze/Kopf (y 11–17, violett), kein lesbares Gesicht → kein Blinzeln.
* Brust: Rippen (x 15–19, y 17–23; rosa-graue Rippenbögen, dazwischen rot glühende Zeilen y 19 und 21), darunter das Grimoire vor dem Bauch (x 15–19, y 26–31: rosa-graue Seiten, rote Mittelspalte).
* Robe mit senkrechten Falten (y 31–44), Saumzipfel/Füße (y 43–45).
* Vier Fledermausflügel (Knochen rosa-grau, Häute dunkelrot): oben links x 0–12, y 0–20 und rechts gespiegelt; unten links x 3–10, y 21–42 und rechts gespiegelt. Sie sitzen frei neben dem Rumpf
  (in der Quelle 1 px Abstand zum Körper).

Ablauf (60 Frames à 80 ms = 4,8 s, nahtlos, unheimlich-langsam; Frame 0 = Original):
* Flügelschlag (Periode 30): die oberen Flügel schlagen als Ganzes um ihr Gelenk am Rumpf (Spitzen ±2 px), die unteren gegenläufig und kleiner (±1 px) – Spaltenversatz wächst vom Ansatz zur Spitze,
  kein Knick, nichts wird gestreckt. Die Figur steht (Robe bis zum Boden), sie schwebt nicht.
* Atmen: Robenzeile 38 (gleichförmige Falten) wird eingefügt (0–1 px, Periode 30, 6 Frames Nachlauf); Rumpf, Kopf und Hörner heben sich starr, die Flügel gehen mit dem Rumpf mit. Kopf nie seitlich.
* Glut zwischen den Rippen: die zwei roten Zeilen wechseln ihr Rot-Muster (hell/dunkel tauschen, alle 5 Frames) – nur die Rottöne der Quelle, nur in diesen Pixeln.
* Grimoire: die rote Mittelspalte des Buchs pulsiert gegenläufig dazu (dunkel ↔ hell, alle 10 Frames).
Keine Ergänzungen nötig (Flügel und Rumpf berühren sich nicht). Kein Glanz, keine Partikel. Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 60, 80
FIG = N2.Figur('spirit-of-the-forbidden-grimoire', pad=(2, 2, 5, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

ROBE = FIG.maske([(26, 5, 25), (69, 14, 68), (85, 14, 107), (113, 36, 136)])
KOERPER = FIG.op & (ROBE | ((xx >= 13) & (xx <= 21)))
FLUEGEL = FIG.op & ~KOERPER
OL, OR_ = FLUEGEL & (xx < 17) & (yy <= 20), FLUEGEL & (xx > 17) & (yy <= 20)
UL, UR = FLUEGEL & (xx < 17) & (yy >= 21), FLUEGEL & (xx > 17) & (yy >= 21)
ERLAUBT = Hm.umrissfarben(spr)
RAND = FIG.farbe((53, 14, 31))
ROT_H, ROT_D = FIG.f(16, 19), FIG.f(17, 19)
RIPPEN = [(x, y) for y in (19, 21) for x in (16, 17, 18)]
BUCH = [(x, y) for y in range(26, 32) for x in range(15, 20) if FIG.op[y, x] and FIG.f(x, y)[0] in (99, 100, 101) and FIG.f(x, y)[1] == 14]


def frame(i, nur=None):
    ko = FIG.platz(KOERPER)
    if (i // 5) % 2:
        N2.setze(ko, OFF, {p: (ROT_D if FIG.f(*p)[0] > 120 else ROT_H) for p in RIPPEN})
    if (i // 10) % 2:
        N2.setze(ko, OFF, {p: ROT_H for p in BUCH})
    b = N2.hub(i, 30, 1, versatz=6)
    ko = TX.streck_zeile(ko, FIG.pt + 38, b)
    s = math.sin(2 * math.pi * i / 30)
    teile = [(ko, 0, 0)]
    for maske, gelenk, amp, maxd in ((OL, 12, 2.0, 11), (OR_, 22, 2.0, 11), (UL, 11, -1.0, 6), (UR, 23, -1.0, 6)):
        fl = N2.schwenk(FIG.platz(maske), gelenk + FIG.pl, amp * s, maxd)
        Hm.kontur_schliessen(fl, ERLAUBT, RAND)                          # an den Versatzstufen bleibt die Außenkante in Umrissfarbe (Regel 16)
        teile.append((fl, 0, -b))
    return L.zusammen(H, W, teile)


if __name__ == '__main__':
    print('Rot:', ROT_H, ROT_D, 'Buch:', BUCH)
    N2.haupt(__import__(__name__), 'Spirit of the Forbidden Grimoire')
