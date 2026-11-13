# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Barbarian Sword“ (Creature).

PICK: [["MotiveGrailWar", 698, 1]]
Quelle: src/spirit-of-the-barbarian-sword.png (24×36 px, 34 Farben) = Ebene 698 „Sword Spirit“, vollständig. Gegen die Kartenkunst abgeglichen (Steinboden/Mauern sind Szene).

Was ist was (x/y im Sprite):
* Flammenschopf (x 7–14, y 0–12): hohe Flamme aus dem Helm (Rot außen, Orange, Gelb, heller Kern).
* Roter Helm/Kapuze (x 5–16, y 13–19) mit dunklem Sehschlitz und hellblauen Augen (y 17–18) – Helm → kein Blinzeln. Flammen-Emblem in der Helmmitte (x 9–12, y 13–15) bleibt fest.
* Flammenbart (x 5–16, y 20–28): zwei nach unten züngelnde Flammen links und rechts (gelber Kern), dazwischen/dahinter die grüne Tunika, graue Gürtelschnalle (11–12, y 26–27).
* Grüne Tunika (y 22–31), linker Arm (x 0–5, y 22–29) mit dunklem Handschuh/Faust (x 0–4, y 26–29), braune Stiefel (y 32–35).
* Rechte Hand (x 16, y 23–25) hält das Barbarenschwert senkrecht (x 17–23, y 5–25): breite cremefarbene Klinge mit roter Hohlkehle, brauner Parierbalken (y 24) – starr.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Flammenschopf brennt (anim_feuer3, posen=16, halten=1): eine hohe Zunge + zwei kürzere Nebenzungen mit flachem Fuß lückenlos auf der Helmkante; Farben der Quelle (Rot, Orange, Gelb, Hellgelb).
  Der gemalte Schopf (Zeilen 0–11; Zeile 12 bleibt als ruhiger Flammenfuß stehen) wird dadurch ersetzt → Frame 0 weicht dort vom Original ab (gewollt, Feuer steht nie still).
* Flammenbart flackert in sich: die gelben Kerne der beiden Bartflammen pulsieren (Kern ↔ Orange, je Seite versetzt, 8-Frame-Takt) – der Umriss des Barts bleibt (er liegt auf der Tunika).
* Atmen: Tunikazeile 30 wird texturiert eingefügt (0–1 px, Periode 24) – Rumpf, Kopf, Arm und Schwert heben sich starr mit, Stiefel bleiben stehen; Kopf nie seitlich. Die Flamme sitzt auf dem Helm und geht mit.
* Schwertarm: das Schwert (Klinge + Parierbalken, starre Einheit) wird langsam 0–2 px angehoben und gesenkt (Periode 48), die Hand bleibt am Parierbalken.
* Klinge (Metall): einmal je Schleife ein diagonales Lichtband über die Klinge (Frames 30–41, eine Stufe heller auf der Klingen-Rampe); kein Sparkle.
ERGÄNZUNG: Handkante (16, 24–25) wird Umrissgrün (8,41,0), sobald der angehobene Parierbalken sie freigibt. Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_feuer3 as F3
import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 65
FIG = N2.Figur('spirit-of-the-barbarian-sword', pad=(2, 2, 4, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

ROT, ORANGE, GELB, HELL = FIG.farbe((202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184))
RAND = FIG.farbe((8, 41, 0))
KLINGE = sorted(FIG.farbe((128, 113, 56), (156, 141, 86), (186, 167, 125), (223, 199, 173), FIG.f(20, 8)), key=sum)

SCHOPF = FIG.op & (yy <= 11) & (xx <= 15)
SCHWERT = FIG.op & (xx >= 17) & (yy <= 25)
KOERPER = FIG.op & ~SCHOPF & ~SCHWERT
M_KLINGE = SCHWERT & (yy <= 23) & FIG.maske(KLINGE) & ~Hm.kantenmaske(spr)

_F = lambda x, y, l, b, **k: F3.Flamme(x + FIG.pl + 0.5, y + FIG.pt + 0.5, l, b, fuss=0, **k)
FEUER = F3.Feuer(H, W, [_F(11.0, 12.0, 13.0, 3.6, phase=0.0, flug=0.3),
                        _F(8.6, 12.0, 6.0, 2.0, phase=0.4, flug=0.3, wiegen=0.3),
                        _F(13.2, 12.0, 7.0, 2.0, phase=0.7, flug=0.3, wiegen=0.3)],
                 [ROT, ORANGE, GELB, HELL], posen=16, halten=1)
BART_L = [(x, y) for y in range(20, 26) for x in range(6, 11) if FIG.op[y, x] and FIG.f(x, y) in (GELB, HELL)]
BART_R = [(x, y) for y in range(20, 26) for x in range(11, 16) if FIG.op[y, x] and FIG.f(x, y) in (GELB, HELL)]


def bart(a, punkte, stufe):
    """stufe 0 = Original; 1 = Kern eine Stufe kühler (Hell → Gelb); 2 = zusätzlich die oberste und unterste Kernzeile Orange."""
    if not stufe:
        return
    ys = [y for _, y in punkte]
    for (x, y) in punkte:
        c = FIG.f(x, y)
        if c == HELL:
            c = GELB
        if stufe == 2 and y in (min(ys), max(ys)):
            c = ORANGE
        N2.setze(a, OFF, {(x, y): c})


BARTTAKT = [0, 0, 1, 1, 2, 2, 1, 1]


def frame(i, nur=None):
    ko = FIG.platz(KOERPER)
    sw_ = FIG.platz(SCHWERT)
    bart(ko, BART_L, BARTTAKT[i % 8])
    bart(ko, BART_R, BARTTAKT[(i + 4) % 8])
    Hm.lichtband(sw_, M_KLINGE, OFF, i, N, 30, 12, KLINGE, stufen=1, breite=3.0, achse=(1.0, 1.0))
    b = N2.hub(i, 24, 1)
    k = N2.hub(i, 48, 2)
    if k >= 1:                                                     # Hand: frei werdende Außenkante in Umrissgrün schließen
        N2.setze(ko, OFF, {(16, 25): RAND})
    if k >= 2:
        N2.setze(ko, OFF, {(16, 24): RAND})
    ko = TX.streck_zeile(ko, FIG.pt + 30, b)
    sw_ = L.versetze(sw_, 0, -b - k)
    fl = FEUER.ebene(i, dy=-b)
    return L.zusammen(H, W, [(fl, 0, 0), (sw_, 0, 0), (ko, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Barbarian Sword')
