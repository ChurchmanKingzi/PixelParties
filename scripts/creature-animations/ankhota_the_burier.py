# -*- coding: utf-8 -*-
"""Idle-Animation für „Ankhota, the Burier“ (Creature) — Sandwesen in Pyramidenform mit grauer Schädelmaske; es scharrt mit der Klaue und Sand rieselt die Flanken hinab.

PICK: [["MotiveGrailWar", 551, "Ebene „Ankhota“ (57×54 px, ganze Figur)"]]
Nicht verwendet: Ebene 552 (halbtransparenter Bodenschatten), 553 (Sandwellen-Hintergrund + dunkle Grube). Abgleich mit data/card-art/native/Ankhota_the_Burier.png: gleiche Figur
(dort vom Kartenrand unten/rechts beschnitten; die Ebene ist vollständig).

Identifikation (57×54): Pyramidenspitze = helle Sandkappe (y 0–12). Graue Schädelmaske (x 14–37, y 11–27) mit zwei Hörnchen (y 11–13), dunklen Augenhöhlen mit rosa Pupillen
(x 19–22 und 27–30, y 17–21), Nasenspitze (x 23–26, y 24–27), seitlichen Maskenlaschen mit hellen Nieten (x 14–16 und 34–36, y 21–26). Darunter im Sand: zwei rötliche Ovale
(x 17–19 und 30–32, y 24–27; Wangenmale oder zweites Augenpaar – unklar, bleiben fest), breiter Grinsemund mit Zunge (x 19–30, y 29–38). Linker Arm liegt flach am Boden
(x 0–15, y 38–47), rechter Arm greift nach vorn, Unterarm x 40–52 (y 44–46), Klauenhand mit vier dunklen Krallen (x 43–56, y 47–53). Dunkle Striche im Sand = Falten.
Maske blinzelt nicht (Regel), Augen bleiben fest. Kein Glanz (Sand/Knochen).

Ablauf (72 Frames à 75 ms = 5,4 s, schweres Wesen → langsam). Frame 0 = Original:
* Atmen (Periode 36): unterhalb des Mundes (Zeile 39) wird eine texturierte Zeile eingefügt (TX.streck_zeile); Pyramide, Maske, Schultern heben sich 1 px. Der Unterarm (x ≥ 40, y ≥ 44)
  und die Hand bleiben am Boden, ebenso die Unterkante des linken Arms.
* Scharren (Frames 14–25 und 50–61): der rechte Unterarm zieht 1 px, die Klauenhand 2 px nach innen (starr als Einheit, Zeilenversatz ≤ 1 px je Stufe) und greift wieder vor; zweimal kurz
  hintereinander. Dabei fliegen vor den Krallen 2×2-Sandkrümel auf.
* Sand rieselt: 2×2-Körner in Sandfarben gleiten hinter der Figur die beiden Pyramidenflanken hinab (je Flanke 3, versetzt; sie liegen HINTER dem Körper, treten also am Rand aus).
Ergänzungen: keine (es wird nichts freigelegt).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 72, 75
sz = N8.Szene('ankhota-the-burier', (6, 5, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
SAND, SAND2, HELL = (214, 201, 167), (192, 178, 131), (230, 217, 192)
M_HAND = (xx >= 40) & (yy >= 44)
HAND = sz.teil(M_HAND)
KOERPER = sz.teil(~M_HAND)
ATEMZEILE = 39
TEST_EBENEN = ('figur',)

# Sandkörner an den Flanken: linke Flanke läuft von (23,1) nach (1,38), rechte von (26,1) nach (48,40)
RIESEL = []
for k, (t0, off) in enumerate([(0.10, 2), (0.42, 26), (0.62, 47)]):
    x, y = 23 - 22 * t0, 1 + 37 * t0
    RIESEL.append(dict(x=PL + x - 2, y=PT + y - 1, dx=-7, dy=12, leben=24, periode=72, off=off, farbe=(SAND, SAND2, HELL)[k]))
for k, (t0, off) in enumerate([(0.22, 9), (0.50, 34), (0.05, 46)]):
    x, y = 26 + 22 * t0, 1 + 39 * t0
    RIESEL.append(dict(x=PL + x + 1, y=PT + y - 1, dx=7, dy=12, leben=24, periode=72, off=off, farbe=(SAND2, SAND, HELL)[k]))
# aufgeworfene Krümel vor den Krallen (nur beim Zurückziehen der Hand)
KRUEMEL = []
for s0 in (14, 20, 50, 56):
    KRUEMEL.append(dict(x=PL + 55, y=PT + 50, dx=2, dy=-5, fall=5, leben=8, periode=72, off=s0 + 2, farbe=SAND))
    KRUEMEL.append(dict(x=PL + 51, y=PT + 53, dx=3, dy=-3, fall=3, leben=7, periode=72, off=s0 + 3, farbe=SAND2))


def scharr(i):
    """Zug der Hand nach innen (0, 1 oder 2 px)."""
    for s0 in (14, 20, 50, 56):
        k = i - s0
        if 0 <= k < 6:
            return (1, 2, 2, 1, 0, 0)[k]
    return 0


def frame(i, nur=None):
    n = N8.stufe(i, 36, 6, 16)
    koerper = TX.streck_zeile(KOERPER, PT + ATEMZEILE, n)
    z = scharr(i)
    hand = HAND
    if z:
        hand = N8.zeilen_versatz(HAND, {PT + y: (-1 if y <= 46 or z == 1 else -2) for y in range(44, 54)})
    eb = []
    if not nur:
        eb.append((N8.koerner(sz.H, sz.W, i, RIESEL), 0, 0))
    eb += [(hand, 0, 0), (koerper, 0, 0)]
    if not nur:
        eb.append((N8.koerner(sz.H, sz.W, i, KRUEMEL), 0, 0))
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N8.fertig('ankhota-the-burier', 'Ankhota, the Burier', frame, N, MS, spr, check=[0, 10, 15, 16, 22, 40], zoom=8)
