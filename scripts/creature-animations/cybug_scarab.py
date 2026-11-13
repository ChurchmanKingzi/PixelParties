# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug SCARAB“ (Creature) — Skarabäus-Drohne, die auf zwei Feuerstrahlen schwebt, darüber das goldene Ankh (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveEgypt", 148, 2], ["MotiveEgypt", 149, 1], ["MotiveEgypt", 149, 2], ["MotiveEgypt", 147, 1], ["MotiveEgypt", 144, "*"]]
Quelle: src/cybug-scarab.png (42×54) = Kartenkomposition: Körper (Ebene 148 „Ebene #65“, rechte Figur; identisch mit Motive/405 „Cybug SCARAB“,
src/cybug-scarab-koerper.png), dahinter die zwei Feuerkeile (Ebene 149, src/cybug-scarab-feuer.png – nur Farb- und Formvorlage), darüber das Ankh
(Ebene 147, src/cybug-scarab-ankh.png) und die weißen Funkel-Sterne (Ebene 144, src/cybug-scarab-funkeln.png – nur Lage und Form). Der gelbe Schein
(Ebene 146) und die Lichtstrahlen (145) sind halbtransparenter Hintergrund.

Identifikation (x, y): Ankh (Gold, 3 Töne) x 17–25, y 3–21. Körper: zwei erhobene Zangenarme x 7–15 und 26–33, y 16–23; Kopf x 16–25, y 21–30 mit
vier roten Augen (zwei Reihen, (255,0,0)/(150,0,0)) und schwarzem Maul (20–23, 31–32); gespreizte graue Flügeldecken x 0–13 und 28–41, y 24–30;
darunter je ein eingeklapptes Beinpaar/Krallen x 3–14 und 27–38, y 30–37 (durchbrochen: das Feuer scheint hindurch); Hinterbeine x 14–19 und 22–27, y 38–44.
Feuer: unter jeder Flügeldecke ein nach unten gerichteter Strahl (rot → orange → gelb → hell), Spitzen bei (7,53) und (34,53).

Ablauf (64 Frames à 65 ms ≈ 4,2 s):
* Schweben: Käfer samt Feuer hebt/senkt sich weich um 1 px (er fliegt auf den Strahlen), zwei Hübe je Schleife.
* Feuerstrahlen: anim_feuer3 (F3.Flamme, lebhafte Einstellung posen=16, halten=1), je Seite ein breiter ruhiger Sockel + zwei Zungen nach unten,
  Fuß lückenlos hinter der Flügeldecke; links und rechts phasenversetzt. Farben = die vier Farben des Quellfeuers.
* Hinterbeine baumeln (untere Zeilen ±1 px), Augen glühen kurz auf (nur Augenpixel).
* Ankh schwebt für sich (±1 px, langsamer, gegenläufig); kurzes Funkeln am Gold: die fünf Sterne der Quelle blitzen einzeln auf
  (Punkt → kleines Kreuz → Stern der Quelle → zurück, 6 Frames, lange Pausen).
Frame 0 = Original ohne Sterne (das Feuer ist von Frame 0 an der animierte Zyklus). Starr: Zangenarme, Flügeldecken. Nur ganze Pixel, nur Quellfarben.
"""
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_n3 as G
import anim_feuer3 as F3

N, MS = 64, 65
spr = L.lade('cybug-scarab')
koerper = L.lade('cybug-scarab-koerper')
ankh = L.lade('cybug-scarab-ankh')
funkeln = L.lade('cybug-scarab-funkeln')
QUELLE = np.concatenate([spr, koerper, ankh, funkeln, L.lade('cybug-scarab-feuer')], axis=0)
B = G.Buehne(spr, 5, 5, 4, 12)
BK = G.Buehne(koerper, 5, 5, 4, 12)
BA = G.Buehne(ankh, 5, 5, 4, 12)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
RAND = G.rand_farben(koerper)
UMRISS = (51, 51, 51)
WEISS = (255, 255, 255)
FARBEN = [(202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)]


def strahl(cx, ph):
    x, y = B.pl + cx, B.pt + 28.5
    return [F3.Flamme(x, y, 11, 7.6, richtung=(0, 1), fuss=0, bauch=0.2, schlag=0.3, phase=ph + 0.3, baender=F3.SOCKEL, puls=0.08, wiegen=0.1),
            F3.Flamme(x - 1.5, y, 25, 6.2, richtung=(0.02, 1), fuss=0, phase=ph, wiegen=0.35),
            F3.Flamme(x + 2.5, y, 17, 4.6, richtung=(-0.03, 1), fuss=0, phase=ph + 0.5, wiegen=0.35)]


FEUER = F3.Feuer(H, W, strahl(7.0, 0.0) + strahl(34.0, 0.37), FARBEN, posen=16, halten=1)
beine = BK.da & (yy >= 38)
rumpf = BK.da & ~beine
STERNE = []
_n, _lab, _st, _c = cv2.connectedComponentsWithStats((funkeln[..., 3] > 0).astype(np.uint8), connectivity=8)
for k in range(1, _n):
    pts = [(int(x), int(y)) for y, x in np.argwhere(_lab == k)]
    STERNE.append((int(round(_c[k][0])), int(round(_c[k][1])), pts))
STERNE.sort(key=lambda s: (s[1], s[0]))
START = [3, 17, 29, 42, 54]


def sterne(i, a):
    for k, (cx, cy, pts) in enumerate(STERNE[:len(START)]):
        t = i - START[k]
        if not 0 <= t < 6:
            continue
        stufe = [0, 1, 2, 2, 1, 0][t]
        form = [(cx, cy)] if stufe == 0 else ([(cx, cy), (cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)] if stufe == 1 else pts + [(cx, cy)])
        for (x, y) in form:
            a[B.pt + y, B.pl + x] = WEISS + (255,)
    return a


def frame(i, fx=True):
    bob = G.pose(i, N / 2, 1, scharf=1.0)
    bob = int(round(0.5 - 0.5 * np.cos(2 * np.pi * i / (N / 2)) - 1e-9)) if True else bob      # 0 → 1 px tiefer → 0 (weich, zwei Hübe)
    ab = -int(round(0.5 - 0.5 * np.cos(2 * np.pi * (i - 10) / N))) + int(round(0.5 - 0.5 * np.cos(2 * np.pi * (-10) / N)))
    r = BK.teil(rumpf)
    if i % 32 in (12, 13, 14, 15):
        r = L.tausche(r, {(150, 0, 0): (255, 0, 0)})
    bn = G.stufen_zeilen(BK.teil(beine), [B.pt + 42], G.pose(i, N / 2, 1, scharf=1.3))
    kaefer = G.umriss_flicken(L.zusammen(H, W, [(bn, 0, 0), (r, 0, 0)]), RAND, UMRISS)
    ebenen = [(FEUER.ebene(i), 0, bob)] if fx else []
    ebenen += [(kaefer, 0, bob), (BA.teil(BA.da), 0, ab)]
    f = L.zusammen(H, W, ebenen)
    return sterne(i, f) if fx else f


if __name__ == '__main__':
    G.fertig('cybug-scarab', 'Cybug SCARAB', frame, N, MS, QUELLE, sys.argv)
