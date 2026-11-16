# -*- coding: utf-8 -*-
"""Idle-Animation für „500 Piranhas in a Monster Suit“ (Creature) — Monsterkostüm, in dem es von Piranhas wimmelt (Neubau Welle 3, Gruppe n3).

PICK: [["MotiveGrailWar", 545, 1]]   (Ebene „500 Piranhas“, einzige Figur, 21×25, vollständig)
Quelle: src/500-piranhas-in-a-monster-suit.png.

Identifikation (x, y): graubraunes Bären-/Wolfskostüm, frontal, steht auf zwei Beinen (y 21–24). Kopf y 0–11: zwei Ohren (x 5–8 und 13–16, y 0–2,
helles Innenohr), schwarze Augenhöhlen x 6–9 und 12–15, y 3–5; offenes Maul mit cremefarbener Schnauze x 7–14, y 6–11 und rosa Zunge (10–11, 8–9);
beidseits je vier cremefarbene, schräg abstehende Striche (x 1–6 und 14–20, y 7–12) = Schnurrhaare. Arme hängen seitlich (x 0–5 und 16–20, y 11–18).
Das Kostüm hat schwarze Löcher, aus denen Piranhas schauen: drei Fischaugen als 2×2/3×2-Schachmuster aus Weiß (255,255,255) und Orange (139,60,3)
bei (10–12, 3–4) (Stirn), (7–9, 14–15) (Brust) und (10–12, 17–18) (Bauch); dazu olivfarbene/weinrote Fischrücken in den Löchern von Brust und Bauch.

Ablauf (48 Frames à 75 ms = 3,6 s) — steht am Boden, kein Schweben, nichts wird gestreckt:
* Es wimmelt im Kostüm: die drei Fischaugen zucken einzeln (Schachmuster springt um = Fisch dreht sich) und tauchen kurz ab (Loch schwarz);
  die Fischrücken in den Löchern wechseln die Plätze (Oliv ↔ Weinrot).
* Ein Fisch drückt von innen gegen den Stoff: am rechten Bauch und an der linken Hüfte wölbt sich der Umriss für 3–4 Frames 1 px nach außen
  (handgesetzt, Umriss bleibt 1 px).
* Der Kopf sackt als Einheit 1 px ein und hebt sich wieder (das schlaffe Kostüm „atmet“; er schiebt sich nur über den Hals).
* Maul klappt zweimal kurz halb zu (untere Maulzeile in Schnauzenfarbe).
Starr: Beine, Arme; Schnurrhaare gehen mit dem Kopf. Nur ganze Pixel, nur Quellfarben.
"""
import sys

import numpy as np

import anim_lib as L
import anim_n3 as G

N, MS = 48, 75
SLUG = '500-piranhas-in-a-monster-suit'
spr = L.lade(SLUG)
B = G.Buehne(spr, 3, 3, 4, 3)
H, W = B.H, B.W
xx, yy = B.xx, B.yy
SCHWARZ, UMRISS, STOFF = (0, 0, 0), (31, 27, 21), (104, 91, 72)
WEISS, ORANGE = (255, 255, 255), (139, 60, 3)
OLIV, WEIN = (91, 73, 23), (66, 40, 41)
CREME, SCHNAUZE = (247, 247, 203), (212, 199, 180)
haare = L.farbmaske(spr, [CREME]) & ((xx <= 6) | (xx >= 14)) & (yy >= 7) & (yy <= 12) & ~((xx >= 7) & (xx <= 13))
kopf = B.da & ~haare & ((yy <= 10) | ((yy == 11) & (xx >= 6) & (xx <= 14)))
rumpf = B.da & ~haare & ~kopf
AUGEN = {'stirn': [(10, 3), (11, 3), (12, 3), (10, 4), (11, 4)], 'brust': [(7, 14), (8, 14), (9, 14), (7, 15), (8, 15)],
         'bauch': [(10, 17), (11, 17), (12, 17), (10, 18), (11, 18)]}
for _p in AUGEN.values():
    assert all(tuple(int(v) for v in spr[y, x, :3]) in (WEISS, ORANGE) for (x, y) in _p)
ZUCKEN = {'stirn': (4, 5, 6, 30, 31), 'brust': (14, 15, 16, 40, 41, 42), 'bauch': (22, 23, 24, 34, 35)}
TAUCHEN = {'stirn': (18, 19, 20), 'brust': (28, 29, 30), 'bauch': (8, 9, 10, 11)}
RUECKEN = set(range(10, 14)) | set(range(24, 27)) | set(range(36, 40))
BEULE_R = set(range(6, 10)) | set(range(38, 41))
BEULE_L = set(range(26, 30))
MAUL = {12, 13, 20, 21}


def auge(a, name, i, oy=0):
    for (x, y) in AUGEN[name]:
        c = tuple(int(v) for v in spr[y, x, :3])
        if i in TAUCHEN[name]:
            c = SCHWARZ
        elif i in ZUCKEN[name]:
            c = ORANGE if c == WEISS else WEISS
        a[B.pt + y + oy, B.pl + x, :3] = c


def frame(i):
    sack = 1 if (i % 24) in range(8, 18) else 0                          # Kopf: 10 Frames unten, 14 oben, zweimal je Schleife
    r = B.teil(rumpf)
    k = B.teil(kopf)
    auge(r, 'brust', i); auge(r, 'bauch', i); auge(k, 'stirn', i)
    if i in RUECKEN:
        r = L.tausche(r, {OLIV: WEIN, WEIN: OLIV})
    if i in BEULE_R:
        for (x, y, c) in ((15, 18, STOFF), (16, 18, UMRISS), (15, 19, STOFF), (16, 19, UMRISS)):
            B.setze(r, x, y, c)
    if i in BEULE_L:
        for (x, y, c) in ((3, 19, STOFF), (2, 19, UMRISS), (3, 20, UMRISS)):
            B.setze(r, x, y, c)
    if i in MAUL:
        for x in (10, 11):
            k[B.pt + 10, B.pl + x, :3] = SCHNAUZE
    return L.zusammen(H, W, [(r, 0, 0), (k, 0, sack), (B.teil(haare), 0, sack)])        # Schnurrhaare gehen starr mit dem Kopf


if __name__ == '__main__':
    G.fertig(SLUG, '500 Piranhas in a Monster Suit', frame, N, MS, spr, sys.argv)
