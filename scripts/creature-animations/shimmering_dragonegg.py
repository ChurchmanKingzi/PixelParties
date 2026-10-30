# -*- coding: utf-8 -*-
"""Idle-Animation für „Shimmering Dragonegg“ (Creature).

PICK: [["Motive", 1100, 1]]   Ebene „Shimmering Dragonegg“ (Motive.xcf, Ebene 1100, 34×41 px, 6 Farben, nur Alpha 0/255) → src/shimmering-dragonegg.png (das ganze Ei, ein einziges 4-verbundenes Teil).
Nicht verwendet: die neun Glitzersterne der Kartenkunst (Ebene 1099 „Shimmering Dragonegg #3“), der halbtransparente Schein dahinter (Ebene 1102, Deckkraft 0–7) und der Hintergrund.

Aufruf:   python3 shimmering_dragonegg.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shimmering-dragonegg.png + .json

Was im Sprite ist (Koordinaten im Sprite 34×41, x/y ab 0):
* Ein eiförmiges Goldei (x 0–33, y 0–40) aus einem regelmäßigen Schachbrett-Raster in vier Goldtönen — Orange A=(242,154,62), Gelb C=(250,213,74), Blassgelb B=(247,247,173), Weiß E=(255,255,255) — mit
  eingestreutem dunklerem Orange D=(238,100,40); der Rand ist ein Orange-/Rotbraun-Kranz D und F=(182,38,0) (am Rand nur diese zwei Farben). Das Raster wiederholt sich alle 4 Spalten und 2 Zeilen.
* Gold → Glanz und Glitzer sind erlaubt: das ganze Ei ist Gold; der Rand (Umriss) glänzt nicht (nur Innenpixel).
Fest bleiben: Eiform, Randkranz und das Raster (das Raster wird nie verschoben).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): das Ei streckt sich 2 px (Frames 2–10 und 26–34 werden die Zeilen 20 und 21 verdoppelt — zwei Zeilen = eine Rasterperiode, das Raster bleibt lückenlos; beide Zeilen haben die volle Breite
  (0–33), es entsteht keine Randstufe) und hüpft in der Spitze (Frames 4–8 und 28–32) 1 px nach oben; unten bleibt der Boden fest. Frame 0 = Original.
* Goldschimmer (Regel 14, Gold): zweimal pro Schleife (Frames 2–17 und 26–41) läuft ein breites diagonales Lichtband über das Ei (eine Stufe heller auf der Gold-Rampe A→C→B→E, nur Innenpixel);
  dazu funkeln einzelne Rasterpixel: in jedem Frame schalten acht Gelb-Pixel (C) für 2 Frames auf Weiß (E) (feste Zufallsfolge, nahtlos).
* Glitzersterne (Gold): vierzackige Sterne (5 Frames Lauf, wachsen/schrumpfen) blitzen an vier Stellen auf dem Ei und an vier Ecken des Sprite-Rechtecks außerhalb des Eis auf (Farben E, B, C des Sprites).
Ergänzungen: keine (der Rand wird nie verändert).
Frame: Sprite plus 3 px links/rechts, 5 px oben (Strecken + Hüpfer), 2 px unten — Figur zentriert; die Sterne liegen in den freien Ecken innerhalb des Sprite-Rechtecks.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 2

spr = L.lade('shimmering-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)

CA, CB, CC, CD, CE, CF = (242, 154, 62), (247, 247, 173), (250, 213, 74), (238, 100, 40), (255, 255, 255), (182, 38, 0)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF):
    assert _c in _farben, _c


def _maske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & OPAK


INNEN = OPAK & ~RAND0
GOLD = INNEN & _maske(CA, CC, CB)                                                       # Rampe A→C→B→E (Weiß E bleibt)
GELB = INNEN & _maske(CC)
HELLER = {CA: CC, CC: CB, CB: CE}
STERN_FARBEN = {'m': CE, 'a': CB, 's': CC}
SWEEPS = [2, 26]
SWEEP_N = 16

# ── Funkeln einzelner Rasterpixel (feste Zufallsfolge, 2 Frames je Pixel) ──
_rnd = random.Random(5)
_gelb_pix = [(int(y), int(x)) for y, x in zip(*np.nonzero(GELB))]
FUNKEL = {}
for _i in range(N):
    FUNKEL[_i] = set()
for _k in range(8 * N // 2):
    _f = _k * 2 % N
    _p = _rnd.choice(_gelb_pix)
    for _d in range(2):
        FUNKEL[(_f + _d) % N].add(_p)
# Frame 0 = Original: kein Funkeln
FUNKEL[0] = set()

# ── Sterne ──
STERN_LAUF = [0, 1, 2, 1, 0]
ORTE = {'e1': (10, 12), 'e2': (24, 16), 'e3': (13, 28), 'e4': (22, 31),                    # auf dem Ei (Rasterpixel)
        'c1': (4, 4), 'c2': (29, 5), 'c3': (3, 37), 'c4': (30, 37)}                       # in den Ecken (außerhalb des Eis)
for _k in ('e1', 'e2', 'e3', 'e4'):
    assert INNEN[ORTE[_k][1], ORTE[_k][0]], _k
for _k in ('c1', 'c2', 'c3', 'c4'):
    assert not OPAK[ORTE[_k][1], ORTE[_k][0]], _k
STERNE = [(s, o) for s, o in ((3, 'c1'), (9, 'e1'), (14, 'c2'), (20, 'e2'), (27, 'c3'), (33, 'e3'), (38, 'c4'), (44, 'e4'), (5, 'e3'), (30, 'e1'))]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(1 if _v >= 0.3 else 0)
HOP = [(1 if math.sin(2 * math.pi * i / 24) >= 0.85 else 0) for i in range(N)]            # + = hoch
assert S[0] == 0 and HOP[0] == 0 and not FUNKEL[0]


def sprite_mit_effekten(i):
    sp = spr.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 < SWEEP_N:
            t = 5 * (i - s0) - 6
            sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 7))
    for (y, x) in FUNKEL[i]:
        sp[y, x, :3] = CE
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln={20: 1, 21: 1} if S[i] else {}, p=0, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, HOP[i])
    return dict(fig=fig, top=top, quelle=quelle)


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        if ort.startswith('e'):
            yo = f['top'] - PAD_T + f['quelle'].index(y)
        else:
            yo = y                                                                        # Eck-Sterne stehen fest im Sprite-Rechteck
        A.stern(e, PAD_L + x, PAD_T + yo, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    print('Farben:', len(_farben), '| Innenpixel:', int(INNEN.sum()), '| Gold-Rampe:', int(GOLD.sum()), '| gelb (Funkeln):', int(GELB.sum()))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'shimmering-dragonegg')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('shimmering-dragonegg', 'Shimmering Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shimmering-dragonegg-strip.png', frames[::2], spalten=12, scale=4)
