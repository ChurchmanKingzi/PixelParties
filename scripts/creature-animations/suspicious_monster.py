# -*- coding: utf-8 -*-
"""Idle-Animation für „Suspicious Monster“ (Creature).

PICK: [["MotiveGrailWar", 545, 1]]   Ebene „500 Piranhas“ (MotiveGrailWar.xcf, Ebene 545, 21×25 px, 15 Farben, nur Alpha 0/255) → src/suspicious-monster.png — mit 39 Korrekturpixeln:
Die Ebene gehört zur Karte „500 Piranhas in a Monster Suit“ und zeigt dort in Kopf, Brust und Bauch je ein leuchtendes Augenpaar (weiß/orange, 15 Pixel) und etwas anders getönte Fellpixel. Die Kartenkunst
von „Suspicious Monster“ (data/card-art/native/Suspicious_Monster.png) hat dieselbe Figur bei (27,17), aber an diesen 39 Stellen (Köpfmitte (9–12,3–4), Brust (6–12,12–15), Bauch (7–14,16–21)) schlichtes Fell
statt der Leuchtaugen. Diese 39 Pixel sind in der Quelle durch die jeweils nächste Farbe der Ebenenpalette zur Kartenfarbe ersetzt (nie Weiß/Orange/Gelb); alle übrigen Pixel sind die Ebene unverändert.
Nicht verwendet: das Fell-Rauschen und den Wald der Kartenkunst.

Aufruf:   python3 suspicious_monster.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/suspicious-monster.png + .json

Was im Sprite ist (Koordinaten im Sprite 21×25, x/y ab 0):
* Ein aufrecht stehendes, grau-braunes Fellwesen (Waschbär-/Wolfsgestalt): zwei Ohren (Zeilen 0–1, x 5–8 und 13–16), großer Kopf mit zwei schwarzen Augenhöhlen D=(0,0,0) und hellem Maul (Zeilen 2–11),
  Arme mit Pfoten seitlich (x 0–4 und 16–20, Zeilen 11–17), Rumpf, zwei Beine mit Füßen (Zeilen 21–24; links x 5–9, rechts x 12–16; Umriss A=(31,27,21)).
* 26 hellgelbe Pixel F=(247,247,203) als dünne Diagonalstriche links und rechts neben dem Kopf (Zeilen 7–12) — Fellbüschel/Strahlen der Figur, nur über Ecken verbunden; sie bleiben unverändert.
* Augen: nur schwarze Höhlen ohne Glanzpunkt (nicht eindeutig) → KEIN Blinzeln.
* Material: Fell/Tuch — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15).
Fest bleiben: Umriss, Kopf, Gesicht, Pfoten, Fellbüschel (sie wandern nur mit dem Körper).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): in der Hüfte (Quellzeile 19, in der Spitze zusätzlich 20) wird 1–2 Körperzeilen eingefügt — Kopf, Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Ohren (je 3 Frames, Frames 8–10, 20–22, 32–34, 44–46 abwechselnd links und rechts): das jeweilige Ohr (Zeilen 0–1) kippt um 1 px zur Kopfmitte — als lausche das Wesen misstrauisch.
* Füße (Frames 12–15/36–39 links, 24–27/44–47 rechts): der Fuß hebt sich 1 px (die unteren drei Beinzeilen rücken um eine Zeile nach oben), der andere bleibt am Boden.
Ergänzungen: Umrisspixel A nur wo eine Bewegung eine Kante freilegt (siehe `ergaenzt`); keine Partikel.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('suspicious-monster')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (31, 27, 21)


# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {19: 1}, 2: {19: 1, 20: 1}}
assert S[0] == 0
OHR_L = {8, 9, 10, 32, 33, 34}
OHR_R = {20, 21, 22, 44, 45, 46}
LIFT_L = {12, 13, 14, 15, 36, 37, 38, 39}
LIFT_R = {24, 25, 26, 27, 44, 45, 46, 47}
assert N % 24 == 0
OHR_SPALTEN = {'l': (5, 8), 'r': (13, 16)}                                         # Quellspalten der Ohren (Zeilen 0–1)
BEIN_SPALTEN = {'l': (5, 9), 'r': (12, 16)}                                        # Quellspalten der Beine (Zeilen 22–24)


def _ohr(fig, top, seite, dx):
    """Ohr (Zeilen 0–1 der Quelle) um dx Pixel versetzen."""
    if dx == 0:
        return fig
    x0, x1 = OHR_SPALTEN[seite]
    out = fig.copy()
    a, b = PAD_L + x0 - abs(dx), PAD_L + x1 + abs(dx)
    blk = fig[top:top + 2, a:b + 1].copy()
    out[top:top + 2, a:b + 1] = 0
    for y in range(2):
        for x in range(blk.shape[1]):
            if blk[y, x, 3]:
                X = a + x + dx
                if not 0 <= X < W:
                    raise L.ClipError('Ohr aus der Leinwand')
                out[top + y, X] = blk[y, x]
    return out


def _fuss(fig, seite):
    """Fuß heben: die Beinzeilen 22–24 (Quelle) um 1 Zeile nach oben setzen (der Fuß verliert eine Zeile Länge)."""
    x0, x1 = BEIN_SPALTEN[seite]
    a, b = PAD_L + x0, PAD_L + x1
    out = fig.copy()
    blk = fig[BODEN - 2:BODEN + 1, a:b + 1].copy()
    out[BODEN - 2:BODEN + 1, a:b + 1] = 0
    # die Hüftzeile (BODEN-3) wird nur dort überschrieben, wo der Block deckt; sonst bleibt sie
    out[BODEN - 3:BODEN, a:b + 1] = np.where((blk[..., 3] > 0)[..., None], blk, out[BODEN - 3:BODEN, a:b + 1])
    # die Zeile unter dem Block war leer — dort steht jetzt nichts mehr
    return out


def figur(i):
    doppeln = POSEN[S[i]]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=doppeln, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    if i in OHR_L:
        fig = _ohr(fig, top, 'l', 1)
    if i in OHR_R:
        fig = _ohr(fig, top, 'r', -1)
    if i in LIFT_L:
        fig = _fuss(fig, 'l')
    if i in LIFT_R:
        fig = _fuss(fig, 'r')
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    frames = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergaenzt (Umrisspixel je Frame):', [len(f['neu']) for f in fs])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(frames, spr, 'suspicious-monster')
    L.speichern('suspicious-monster', 'Suspicious Monster', frames, MS, prev)
    if prev:
        L.streifen(prev + '/suspicious-monster-strip.png', frames[::2], spalten=12, scale=8)
