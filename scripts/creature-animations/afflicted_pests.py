# -*- coding: utf-8 -*-
"""Idle-Animation für „Afflicted Pests“ (Creature) — ein dunkler, brodelnder Schwarm aus Hunderten Schädlingen mit roten Augenpaaren.

Quelle: src/afflicted-pests.png (100×59 px, 3 Farben).
PICK: [["MotiveEgypt", 49, "ganze Ebene #45"]]   (über Farbsuche gefunden – die Kartenkunst ist verrauscht, daher kein Treffer im automatischen Abgleich; die Ebene ist
  genau die Schwarmwolke der Karte, Alpha nur 0/255, nichts fehlt). Die Ebene ist bereits als Dither-Raster gezeichnet (Schachbrett-Lücken am Rand gehören zur Figur).

Was im Sprite ist:
* SCHWARMKÖRPER: Schwarz (0,0,0) und Dunkelviolett (78,42,72), unregelmäßig gemischt; der Rand franst als Schachbrett-Dither aus (einzelne Tiere am Schwarmrand).
* AUGEN: 53 rote Augenpaare (190,0,0), je zwei Pixel mit einem Körperpixel dazwischen („C·C“) – die einzelnen Schädlinge.
Kein Metall, kein Feuer, keine Partikel (die „Partikel“ sind die Randtiere des Schwarms selbst).

Idee: Der Schwarm fliegt und wimmelt – Wellen laufen durch die Wolke, die Tiere am Rand schwirren, die Augenpaare krabbeln umher und blinzeln durcheinander.
Ablauf (48 Frames à 70 ms = 3,4 s, nahtlos):
* Schwirren: eine schräge Welle (Periode 12 Frames, Wellenlänge 40 px) läuft durch den Schwarm. Wo sie gerade ist, rückt jedes EINZELN stehende Pixel (links und rechts
  ein anderes Material: Randtier im Dither-Raster bzw. einzelnes schwarzes Tier im Violett) um 1 px nach rechts – das Raster kippt in die Gegenphase und wieder zurück.
  Es werden nur Pixel getauscht (Pixelzahl bleibt gleich), nichts gestreckt. Die Welle wird am Schleifenanfang/-ende über 6 Frames ein-/ausgeblendet (Frame 0 = Original).
* Augenpaare: jedes Paar wandert als starre Einheit (beide Augen zusammen) nach eigenem Takt 1 px nach links/rechts/oben/unten und zurück (nur auf Schwarmkörper,
  nie ins Leere) und blinzelt einmal je Schleife 3 Frames (Augen → Körperfarbe Violett). Glühen/Farbspiel gibt es nicht.
* Flug: der ganze Schwarm hebt und senkt sich als Ganzes um ±1 px (Periode = Schleife) – er fliegt (Kartenkunst: Wolke am Nachthimmel über der Wüste).
"""
import math
import random
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4

N, MS = 48, 70
G = N4.Figur('afflicted-pests', 3, 4, 4, 4)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
SH, SW = spr.shape[:2]
SCHWARZ, VIOLETT, ROT = (0, 0, 0), (78, 42, 72), (190, 0, 0)

rot = L.farbmaske(spr, [ROT])
PAARE = [(x, y) for y in range(SH) for x in range(SW - 2) if rot[y, x] and rot[y, x + 2]]
_r = random.Random(49)
PLAN = [dict(blinzel=_r.randrange(1, N - 3), start=_r.randrange(N), dauer=_r.choice([6, 8, 10]), periode=_r.choice([16, 24, 48]),
             weg=_r.choice([(1, 0), (-1, 0), (0, -1), (0, 1)])) for _ in PAARE]
nahe_auge = np.zeros((SH, SW), bool)
for (x, y) in PAARE:
    nahe_auge[max(0, y - 1):y + 2, max(0, x - 2):x + 5] = True

op = L.deckend(spr)
links = np.zeros_like(op); links[:, 1:] = op[:, :-1]
rechts = np.zeros_like(op); rechts[:, :-1] = op[:, 1:]
EINZEL_RAND = op & ~links & ~rechts & ~nahe_auge                                  # Dither-Pixel: links und rechts leer
sw = L.farbmaske(spr, [SCHWARZ]); vi = L.farbmaske(spr, [VIOLETT])
vl = np.zeros_like(op); vl[:, 1:] = vi[:, :-1]
vr = np.zeros_like(op); vr[:, :-1] = vi[:, 1:]
EINZEL_INNEN = sw & vl & vr & ~nahe_auge                                           # einzelnes schwarzes Tier zwischen zwei violetten
vr_frei = np.zeros_like(op); vr_frei[:, :-1] = EINZEL_INNEN[:, 1:]                 # rechter Nachbar ist selbst so ein Pixel → nicht tauschen
EINZEL_INNEN &= ~vr_frei


def welle(i, x, y):
    k = min(i, N - i)
    schwelle = 1.01 if k == 0 else max(-0.2, 1.0 - 0.25 * k)
    return math.sin(2 * math.pi * (i / 12.0 - (x + 0.6 * y) / 40.0)) > schwelle


def frame(i):
    s = np.zeros((SH, SW + 1, 4), np.uint8)
    s[:, :SW] = spr
    for y, x in zip(*np.nonzero(EINZEL_RAND)):
        if welle(i, x, y):
            s[y, x + 1] = s[y, x]; s[y, x] = 0
    for y, x in zip(*np.nonzero(EINZEL_INNEN)):
        if welle(i, x, y) and s[y, x + 1, 3] and tuple(s[y, x + 1, :3]) == VIOLETT:
            s[y, x, :3] = VIOLETT; s[y, x + 1, :3] = SCHWARZ
    for (x, y), p in zip(PAARE, PLAN):
        zu = (i - p['blinzel']) % N < 3
        dx, dy = p['weg'] if (i - p['start']) % p['periode'] < p['dauer'] and i not in (0,) else (0, 0)
        ziel = [(x + dx, y + dy), (x + 1 + dx, y + dy), (x + 2 + dx, y + dy)]
        if (dx or dy) and not all(0 <= yy < SH and 0 <= xx < SW and s[yy, xx, 3] and not (rot[yy, xx] and (xx, yy) not in ((x, y), (x + 2, y)))
                                  for xx, yy in ziel):
            dx = dy = 0
        if dx or dy or zu:
            s[y, x, :3] = VIOLETT; s[y, x + 2, :3] = VIOLETT
        if not zu and (dx or dy):
            s[y + dy, x + dx, :3] = ROT; s[y + dy, x + 2 + dx, :3] = ROT
            s[y + dy, x + 1 + dx, :3] = VIOLETT
    dy = int(round(math.sin(L.sinus(i, N))))
    return L.platz(s, H, W, G.PL, G.PT + dy)


if __name__ == '__main__':
    N4.abschluss(G, 'Afflicted Pests', [frame(i) for i in range(N)], MS, sys.argv, scale=3, spalten=8)
