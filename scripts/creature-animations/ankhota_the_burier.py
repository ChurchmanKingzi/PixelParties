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
* Hand heben und fallen lassen (Periode 36, also zweimal je Schleife): der rechte Unterarm mit der Klauenhand (x ≥ 40, y ≥ 44) hebt sich als EINE starre Einheit langsam um 5 px
  (1 px je 3 Bilder), verharrt und fällt in zwei Bildern schwer zu Boden (Aufprall Bild 26 der Periode). Beim Aufprall: vier Staubwölkchen (2×2 → 5×3 → 2×2, Sandfarben) und
  kurzes Nachbeben – der Körper sackt zweimal 1 px zusammen (Zeile 39 entfällt, TX.streck_zeile mit −1). Kein Streicheln/Scharren mehr.
* Sand rieselt: 2×2-Körner in Sandfarben gleiten hinter der Figur die beiden Pyramidenflanken hinab (je Flanke 3, versetzt; sie liegen HINTER dem Körper, treten also am Rand aus).
Ergänzungen: bei gehobenem Arm bekommen die frei werdende Körperunterkante (y 43, x 40–49) und die Oberkante des Arms die Umrissfarbe (80,66,27).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 72, 75
sz = N8.Szene('ankhota-the-burier', (6, 10, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
UMRISS = (80, 66, 27)
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
# Hand heben und fallen lassen (Periode 36): langsam 5 px hoch (1 px je 3 Bilder), kurz halten, in zwei Bildern herunterfallen, Aufprall bei Bild 26 der Periode.
#        0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35
HEBEN = (0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
AUFPRALL = 26
BEBEN = {26: -1, 27: -1, 28: 0, 29: -1}                                    # Nachbeben: der Körper sackt 1 px zusammen (Zeile entfällt), federt, sackt nochmals
STAUB_F = {'c': SAND, 'r': SAND2}
STAUB = [dict(x=PL + 41, y=PT + 51, vx=-5, vy=-4, leben=9), dict(x=PL + 57, y=PT + 50, vx=4, vy=-5, leben=9),
         dict(x=PL + 47, y=PT + 46, vx=-1, vy=-6, leben=8, start=1), dict(x=PL + 53, y=PT + 47, vx=2, vy=-6, leben=10, start=1)]
RAND_F = [UMRISS]


def staub(i):
    """Staubwölkchen beim Aufprall: 2×2 → 5×3 → 2×2 → weg (nie 1 px), treiben von der Hand weg nach oben."""
    e = L.leer(sz.H, sz.W)
    for pf in STAUB:
        k = (i % 36) - AUFPRALL - pf.get('start', 0)
        if not 0 <= k < pf['leben']:
            continue
        t = k / pf['leben']
        cx, cy = int(round(pf['x'] + pf['vx'] * t)), int(round(pf['y'] + pf['vy'] * t))
        for dx, dy, f in L.PUFF_FORMEN['m' if 0.2 <= t < 0.7 else 's']:
            e[cy + dy, cx + dx, :3] = STAUB_F[f]; e[cy + dy, cx + dx, 3] = 255
    return e


def frame(i, nur=None):
    n = N8.stufe(i, 36, 6, 16)
    n = BEBEN.get(i % 36, n)
    koerper = TX.streck_zeile(KOERPER, PT + ATEMZEILE, n)
    k = HEBEN[i % 36]
    eb = []
    if not nur:
        eb.append((N8.koerner(sz.H, sz.W, i, RIESEL), 0, 0))
    figur = L.zusammen(sz.H, sz.W, [(koerper, 0, 0), (HAND, 0, -k)])       # Arm + Klauenhand starr als Einheit, vor dem Körper
    if k:                                           # Umriss schließen: frei gewordene Körperunterkante und Oberkante des gehobenen Arms (die Hand selbst bleibt unverändert)
        hand = L.versetze(HAND, 0, -k)[..., 3] > 0
        m = (~hand & sz.voll((xx >= 38) & (yy >= 40))) | (hand & (np.arange(sz.H)[:, None] == PT + 44 - k))
        figur = N8.kontur_schliessen(figur, RAND_F, UMRISS, maske=m)
    eb.append((figur, 0, 0))
    if not nur:
        eb.append((staub(i), 0, 0))
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N8.fertig('ankhota-the-burier', 'Ankhota, the Burier', frame, N, MS, spr, check=[0, 10, 22, 25, 26, 29], zoom=8)
