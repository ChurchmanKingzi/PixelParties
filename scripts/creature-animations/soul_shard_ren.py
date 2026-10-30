# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ren“ (Creature).

PICK: [["MotiveEgypt", 188, 1]]   Ebene „Ren“ (MotiveEgypt.xcf, Ebene 188, 44×37 px, 27 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ren.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ren.png, 76×51) abgeglichen: die Ebene sitzt dort bei (16,6) mit 99,7 % Treffer. (Die 3 abweichenden Pixel sind Farbtönungen der Karte.) Nicht verwendet: der gelbe Lichtschein hinter der Figur, Wellen und Sand der Kartenkunst.

Aufruf:   python3 soul_shard_ren.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ren.png + .json

Was im Sprite ist (Koordinaten im Sprite 44×37, x/y ab 0):
* Ein Pharao-Skelett: großes blau-goldenes Kopftuch (Nemes; Gold A, B, F, H, I, N, V, X; Blau C, D, G, K, O, P, W, Z; Zeilen 0–27) mit Gesichtsmaske (Zeilen 15–27; weiße/rote Augenpunkte S, R, a) und Skelettkörper (J, L, M, E; Zeilen 26–36).
* Material: Gold (Kopftuch) → Glanz und Glitzer erlaubt (Regel 14); Blau/Knochen glänzen nicht. Augen: unklar (Maske) → KEIN Blinzeln. Kein Feuer (Regel 15).
Fest bleiben: Umriss, Kopfform, Gesicht, Gliedmaßen (der Körper streckt sich nur durch eingefügte Rippenzeilen unterhalb des Kopfes).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 33, in der Spitze zusätzlich 34; Zeilen gleicher Breite, keine Randstufe) — Kopf, Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Goldschimmer (zweimal je Schleife, Frames 2–18 und 26–42): ein diagonales Lichtband (x+y, 8 px) läuft über die goldenen Innenpixel des Kopftuchs (eine Stufe heller auf der Rampe H→I→N→B→A→F und V→X; Umrisspixel bleiben).
* Glitzersterne (Gold): vierzackige Sterne blitzen an drei Stellen ganz im Inneren des Kopftuchs (Lauf 0-1-2-1-0 über 5 Frames) und in den beiden freien oberen Ecken außerhalb der Figur (Lauf 1-2-1, nie ein einzelner Punkt) auf (Farben weiß, F, A des Sprites).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten, Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('soul-shard-ren')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (12, 12, 12)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {33: 1}, 2: {33: 1, 34: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes)
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y] in (_ext[_y - 1], _ext[_y + 1]), ('Einfügezeile mit Randstufe', _y)

# ── Gold: das Kopftuch (Nemes) glänzt (Regel 14, Gold) ──
yy, xx = np.mgrid[0:sh, 0:sw]
RAND0 = A.randpixel(spr)
INNEN = OPAK & ~RAND0


def _maske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & OPAK


GOLDFARBEN = [(253, 223, 111), (203, 168, 52), (245, 239, 153), (112, 64, 16), (144, 100, 37), (172, 137, 83), (255, 199, 0), (255, 232, 0)]   # A, B, F, H, I, N, V, X
for _c in GOLDFARBEN:
    assert _c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, _c
GOLD = INNEN & _maske(*GOLDFARBEN)
HELLER = {(112, 64, 16): (144, 100, 37), (144, 100, 37): (172, 137, 83), (172, 137, 83): (203, 168, 52), (203, 168, 52): (253, 223, 111), (253, 223, 111): (245, 239, 153), (255, 199, 0): (255, 232, 0)}
STERN_FARBEN = {'m': (255, 255, 255), 'a': (245, 239, 153), 's': (253, 223, 111)}
SWEEPS = [2, 26]
SWEEP_N = 17
STERN_LAUF = [0, 1, 2, 1, 0]
ORTE = {'e1': (12, 16), 'e2': (29, 16), 'e3': (18, 13), 'c1': (4, 2), 'c2': (39, 2)}        # auf dem Kopftuch (ganz im Inneren) und in den beiden freien oberen Ecken
for _k in ('e1', 'e2', 'e3'):
    _x, _y = ORTE[_k]
    for (_dx, _dy) in [(d, 0) for d in range(-2, 3)] + [(0, d) for d in (-2, -1, 1, 2)]:
        assert GOLD[_y + _dy, _x + _dx], (_k, _dx, _dy)
for _k in ('c1', 'c2'):
    _x, _y = ORTE[_k]
    for (_dx, _dy) in [(d, 0) for d in range(-2, 3)] + [(0, d) for d in (-2, -1, 1, 2)]:
        for _a in (-1, 0, 1):
            for _b in (-1, 0, 1):
                _X, _Y = _x + _dx + _a, _y + _dy + _b
                assert not (0 <= _Y < sh and 0 <= _X < sw and OPAK[_Y, _X]), (_k, _dx, _dy)
STERNE = [(3, 'c1'), (9, 'e1'), (15, 'c2'), (20, 'e2'), (27, 'c1'), (33, 'e3'), (38, 'c2'), (13, 'e3'), (40, 'e1'), (30, 'e2')]


def aktive_sterne(i):
    out = []
    for (s, o) in STERNE:
        lauf = [1, 2, 1] if o.startswith('c') else STERN_LAUF
        if (i - s) % N < len(lauf):
            out.append((o, lauf[(i - s) % N]))
    return out


def sprite_mit_effekten(i):
    sp = spr.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 < SWEEP_N:
            t = 4 * (i - s0) - 4
            sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 8))
    return sp


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        yo = f['top'] - PAD_T + f['quelle'].index(y) if ort.startswith('e') else y
        A.stern(e, PAD_L + x, PAD_T + yo, stufe, STERN_FARBEN)
    return e


def figur(i):
    koerper = A.zeilen_von(sprite_mit_effekten(i), 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, top=top, quelle=quelle, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs], '| Pfadpixel:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-ren')
    L.speichern('soul-shard-ren', 'Soul Shard Ren', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-ren-strip.png', frames[::2], spalten=12, scale=6)
