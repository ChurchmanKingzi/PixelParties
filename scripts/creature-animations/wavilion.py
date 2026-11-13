# -*- coding: utf-8 -*-
"""Idle-Animation für „Wavilion“ (Creature) — rosa Rüsselfisch, schwimmt auf der Stelle.

PICK: [["MotiveDeepsea", 160, "Ebene #124, Figur 1 (53×22 px, ganze Ebene)"]]
Abgleich mit data/card-art/native/Wavilion.png: 100 % (Fisch vor rotem Fels; Fels, Blasen und Wasser gehören zur Szene). Ebene 159 (#180) ist eine ältere, kleinere Fassung desselben Fischs.

Identifikation (53×22): Schwanzflosse links (x 0–9, y 3–21, zweilappig, dunkler unterer Lappen), Rumpf x 9–25 mit Bauchschatten, Auge = senkrechter grauer Schlitz (x 21–23, y 6–11:
Weiß (240,241,240), Grau (98,96,99)/(191,190,194), Pupille (62,62,64) bei (23,8) (23,9)), langer Rüssel nach rechts, der sich am Ende nach unten einrollt (x 24–52, y 0–16; Spitze x 38–41, y 10–15).
Kein Metall, kein Glanz. Er schwimmt (Unterwasserwesen) → sanftes Auf und Ab des ganzen Körpers ist erlaubt.

Ablauf (48 Frames à 70 ms = 3,4 s). Frame 0 = Original:
* Schwimmen: ganzer Fisch ±1 px (Periode 48).
* Schwanzflosse schlägt (Periode 24): Spalten x < 10 wandern senkrecht, zur Flossenspitze hin bis ±2 px (ganze Flosse ab Rumpfansatz).
* Rüssel wiegt als Ganzes (Periode 48): Spalten x > 26 wandern senkrecht, das gerade Stück x 27–40 neigt sich (Nachbarspalten höchstens 1 px Unterschied), die eingerollte Spitze (x ≥ 40) geht als starre Einheit ±2 px mit; nichts wird gestreckt.
* Blinzeln (Frames 20–22): Augenschlitz nimmt die Körperfarbe an, in der Mitte ein dunkler Lidstrich.
Ergänzungen: keine (Rumpf und Anhänge bleiben über die Gelenkspalte verbunden).
"""
import math

import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 48, 70
sz = N7.Szene('wavilion', (3, 3, 6, 6))
spr = sz.spr
xx, yy = sz.xx, sz.yy
SCHWANZ = sz.teil(xx < 10)
RUMPF = sz.teil((xx >= 10) & (xx <= 26))
RUESSEL = sz.teil(xx > 26)
C, E = (194, 127, 166), (133, 81, 130)
AUGE = [(x, y) for y in range(6, 12) for x in range(21, 24) if sz.farbe(x, y) in ((240, 241, 240), (98, 96, 99), (191, 190, 194), (62, 62, 64))]


def stufen(v):
    a = int(math.floor(abs(v) + 0.5)) * (1 if v >= 0 else -1)
    return (a // 2 if a > 0 else -((-a) // 2)), a


def spalten(a, fn):
    out = L.leer(sz.H, sz.W)
    for x in range(sz.W):
        ys = np.nonzero(a[:, x, 3])[0]
        if len(ys):
            d = int(math.floor(fn(x - sz.PL) + 0.5))
            out[ys + d, x] = a[ys, x]
    return out


def frame(i, nur=None):
    bob = N7.sinus_px(i, 48, 1)
    # Stufen des Versatzes liegen genau auf den Treppenstufen des Umrisses (Rüssel x 29 und x 33, Flosse x 9 und x 6) → keine Zacken/Kerben
    t1, t2 = stufen(2.0 * math.sin(L.sinus(i, 24)))
    schwanz = spalten(SCHWANZ, lambda x: 0 if x >= 9 else t1 if x >= 6 else t2)
    r1, r2 = stufen(2.0 * math.sin(L.sinus(i, 48)))
    ruessel = spalten(RUESSEL, lambda x: 0 if x < 29 else r1 if x < 33 else r2)
    rumpf = RUMPF
    if 20 <= i <= 22:
        rumpf = rumpf.copy()
        for x, y in AUGE:
            rumpf[sz.PT + y, sz.PL + x, :3] = E if y in (8, 9) and x >= 22 else C
    f = L.zusammen(sz.H, sz.W, [(schwanz, 0, 0), (ruessel, 0, 0), (rumpf, 0, 0)])
    return N7.starr(f, 0, bob)


if __name__ == '__main__':
    N7.fertig('wavilion', 'Wavilion', frame, N, MS, spr, check=[0, 6, 12, 18, 21, 36], zoom=9)
