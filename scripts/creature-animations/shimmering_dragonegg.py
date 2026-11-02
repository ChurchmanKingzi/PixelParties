# -*- coding: utf-8 -*-
"""Idle-Animation für „Shimmering Dragonegg“ (Creature) — Runde 2: statisches Ei, auf dem kleine Risse erscheinen und verschwinden (kein Squash & Stretch mehr).

PICK: [["Motive", 1100, 1]]   Ebene „Shimmering Dragonegg“ (Motive.xcf, Ebene 1100, 34×41 px, 6 Farben, nur Alpha 0/255) → src/shimmering-dragonegg.png (das ganze Ei, ein einziges 4-verbundenes Teil).
Nicht verwendet: die neun Glitzersterne der Kartenkunst (Ebene 1099 „Shimmering Dragonegg #3“), der halbtransparente Schein dahinter (Ebene 1102, Deckkraft 0–7) und der Hintergrund.

Aufruf:   python3 shimmering_dragonegg.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shimmering-dragonegg.png + .json

Was im Sprite ist (Koordinaten im Sprite 34×41, x/y ab 0):
* Ein eiförmiges Goldei (x 0–33, y 0–40) aus einem regelmäßigen Schachbrett-Raster in vier Goldtönen — Orange A=(242,154,62), Gelb C=(250,213,74), Blassgelb B=(247,247,173), Weiß E=(255,255,255) — mit
  eingestreutem dunklerem Orange D=(238,100,40); der Rand ist ein Orange-/Rotbraun-Kranz D und F=(182,38,0) (am Rand nur diese zwei Farben). Das Raster wiederholt sich alle 4 Spalten und 2 Zeilen.
* Gold → Glanz und Glitzer sind erlaubt: das ganze Ei ist Gold; der Rand (Umriss) glänzt nicht (nur Innenpixel).
Fest bleiben: das GANZE Ei (Form, Randkranz, Raster) — Nutzerwunsch: „genau wie Monster Nest eher über Risse als über Squash and Stretch animiert“.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Risse (neu): sechs kleine Risse aus je 3 Pixeln (das Ei ist mit 34×41 px groß; 2 Pixel gingen im Raster unter) in der dunkelsten Eifarbe F=(182,38,0) (diagonal gezackt) erscheinen zeitversetzt an sechs verschiedenen Stellen des Eis (alle ~7 Frames einer, immer 1–2 gleichzeitig):
  erst 1, dann 2, dann 3 Pixel, steht kurz, schrumpft wieder und verschwindet (Verlauf 1-1-2-2-3-3-3-3-2-2-1-1, 12 Frames). Sie liegen nur auf hellen Rasterpixeln (B/C/E), nie am Rand und nie auf den Armen der Sterne. Frame 0 = Original (rissfrei).
* Goldschimmer (Regel 14, Gold; bleibt aus der ersten Fassung, das Ei selbst bewegt sich nicht): zweimal pro Schleife (Frames 2–17 und 26–41) läuft ein breites diagonales Lichtband über das Ei (eine Stufe heller auf der Gold-Rampe A→C→B→E, nur Innenpixel);
  dazu funkeln einzelne Rasterpixel: in jedem Frame schalten acht Gelb-Pixel (C) für 2 Frames auf Weiß (E) (feste Zufallsfolge, nahtlos). Schalter `GLANZ = False` lässt Band, Funkeln und Sterne weg (dann bleiben nur die Risse).
* Glitzersterne (Gold): vierzackige Sterne (5 Frames Lauf, wachsen/schrumpfen) blitzen an vier Stellen auf dem Ei und an vier Ecken des Sprite-Rechtecks außerhalb des Eis auf (Farben E, B, C des Sprites).
Ergänzungen: keine (der Rand wird nie verändert).
Frame: Sprite plus 3 px Rand rundum — Figur zentriert; die Sterne liegen in den freien Ecken innerhalb des Sprite-Rechtecks.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_eier as E

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3
GLANZ = True

spr = L.lade('shimmering-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
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


# ── Risse (drei Pixel, F = dunkelste Eifarbe; nur auf hellen Rasterpixeln B/C/E, mindestens 2 Pixel vom Rand) ──
RISSE = [E.Riss(p, start=st, profil=E.PROFIL3) for p, st in (
    ([(24, 27), (25, 28), (26, 29)], 2), ([(13, 4), (14, 5), (15, 6)], 9), ([(2, 21), (3, 22), (3, 23)], 16),
    ([(11, 35), (12, 36), (13, 37)], 22), ([(25, 9), (24, 10), (23, 11)], 29), ([(16, 18), (16, 19), (17, 20)], 35))]
_hell = _maske(CB, CC, CE)
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert INNEN[_y, _x] and _hell[_y, _x], (_x, _y)
        for _k in ('e1', 'e2', 'e3', 'e4'):
            assert not ((_x == ORTE[_k][0] and abs(_y - ORTE[_k][1]) <= 2) or (_y == ORTE[_k][1] and abs(_x - ORTE[_k][0]) <= 2)), ('Riss auf einem Sternarm', _x, _y)
assert E.gleichzeitig(RISSE, N)[0] <= 2 and all(r.stufe(0, N) == 0 for r in RISSE)
assert not FUNKEL[0]
REF = L.platz(spr, H, W, PAD_L, PAD_T)


def sprite_mit_effekten(i):
    sp = spr.copy()
    if GLANZ:
        for s0 in SWEEPS:
            if 0 <= i - s0 < SWEEP_N:
                t = 5 * (i - s0) - 6
                sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 7))
        for (y, x) in FUNKEL[i]:
            sp[y, x, :3] = CE
    return sp


def figur(i):
    fig = L.platz(sprite_mit_effekten(i), H, W, PAD_L, PAD_T)
    return dict(fig=E.auf_figur(fig, E.risse_ebene(H, W, i, N, RISSE, CF, PAD_L, PAD_T, gueltig=OPAK)))


def sterne_ebene(i):
    e = L.leer(H, W)
    if GLANZ:
        for ort, stufe in aktive_sterne(i):
            x, y = ORTE[ort]
            A.stern(e, PAD_L + x, PAD_T + y, stufe, STERN_FARBEN)
    return e


TEST_EBENEN = 'figur'                                                                      # randtest.py: nur das Ei ohne Glitzersterne prüfen


def frame(i, nur=None):
    f = figur(i)
    if nur:
        return f['fig']
    return L.zusammen(H, W, [(f['fig'], 0, 0), (sterne_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Farben:', len(_farben), '| Innenpixel:', int(INNEN.sum()), '| Gold-Rampe:', int(GOLD.sum()), '| gelb (Funkeln):', int(GELB.sum()))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    print('Frame 0 weicht vom Original in', int((figs[0] != REF).any(axis=2).sum()), 'Pixeln ab | höchstens', E.gleichzeitig(RISSE, N)[0], 'Risse gleichzeitig')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'shimmering-dragonegg')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('shimmering-dragonegg', 'Shimmering Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shimmering-dragonegg-strip.png', frames[::2], spalten=12, scale=4)
