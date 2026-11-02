# -*- coding: utf-8 -*-
"""Idle-Animation für „The Egg of God“ (Creature) — Runde 2: statisches Ei, auf dem kleine Risse erscheinen und verschwinden (kein Squash & Stretch/Hüpfen mehr).

PICK: [["MotiveSteamDwarfs", 215, 1]]   Ebene „Egg of God“ (MotiveSteamDwarfs.xcf, Ebene 215, 18×21 px, 12 Farben, nur Alpha 0/255) → src/the-egg-of-god.png (das ganze Ei, ein einziges 4-verbundenes Teil).
Gegen die Kartenkunst (data/card-art/native/The_Egg_of_God.png) per Pixelvergleich abgeglichen: die Ebene sitzt dort bei (29,15) (Treffer 90 %). Die 31 abweichenden Pixel sind zwei kleine Glitzersterne der
Kartenkunst, die über das Ei gelegt sind (oben um (6–10,0–4), unten um (4–10,14–19); eigene Ebenen mit weiß/orangen Strahlen) — nicht Teil des Eis. Nicht verwendet: diese Sterne, die vier weiteren Sterne
und der Dschungel-Hintergrund der Kartenkunst.

Aufruf:   python3 the_egg_of_god.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/the-egg-of-god.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×21, x/y ab 0):
* Ein goldenes Ei (x 0–17, y 0–20): Körper in Orange/Gold A=(255,174,0), B=(209,143,13), C=(209,96,13) (links und unten dunkler), Umriss D=(122,18,0) und E=(201,45,0) (am Rand nur diese zwei Farben),
  ein diagonales Lichtband von links oben (6,1) nach rechts unten (15,13) aus Hellgelb/Creme F, G, H, I, J, K, L.
* Gold → Glanz und Glitzer sind erlaubt (Regel 14): das ganze Ei ist Gold; der Umriss glänzt nicht (nur Innenpixel). Keine Augen (kein Blinzeln); kein Feuer (Regel 15).
Fest bleiben: das GANZE Ei (Form, Umriss, Lichtband) — Nutzerwunsch: „gilt dasselbe wie für Monster Nest“ (statische Eier, kleine Risse, die erscheinen und verschwinden).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Risse (neu): fünf kleine Risse aus je 2 Pixeln in der Umrissfarbe D=(122,18,0) (senkrecht bzw. diagonal gezackt) erscheinen zeitversetzt an fünf verschiedenen Stellen der Schale (alle 8 Frames einer, 1–2 gleichzeitig):
  erst 1 Pixel, dann 2 Pixel, steht kurz, schrumpft wieder und verschwindet (Verlauf 1-1-2-2-2-2-2-2-2-2-1-1). Sie liegen nur auf Goldpixeln (A/B/C/H) mindestens 2 Pixel vom Rand, nicht in den Sternzonen. Frame 0 = Original (rissfrei).
* Goldschimmer (Regel 14; bleibt aus der ersten Fassung, das Ei selbst bewegt sich nicht): zweimal pro Schleife (Frames 2–16 und 26–40) läuft ein breites diagonales Lichtband (x+y, 7 px breit) über das Ei (eine Stufe heller auf der Gold-Rampe C→B→A→H→I, nur Innenpixel).
* Glitzersterne (Gold): vierzackige Sterne blitzen an drei Stellen auf dem Ei (ganz im Inneren; Lauf 0–1–2–1–0 über 5 Frames, wachsen/schrumpfen) und in den beiden freien oberen Ecken außerhalb des Eis
  (Lauf 1–2–1 über 3 Frames, nie ein einzelner Punkt) auf (Farben G, K, J des Sprites; die Eck-Sterne berühren das Ei nie — das Skript prüft es in jedem Frame). Schalter `GLANZ = False` lässt Band und Sterne weg.
Ergänzungen: keine (der Rand wird nie verändert).
Frame: Sprite plus 4 px links/rechts, 5 px oben/unten (Eck-Sterne) — Figur zentriert.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_eier as E

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 5
GLANZ = True

spr = L.lade('the-egg-of-god')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
INNEN = OPAK & ~RAND0

CA, CB, CC = (255, 174, 0), (209, 143, 13), (209, 96, 13)
CH, CI = (251, 210, 86), (251, 242, 143)
CG, CK, CJ = (255, 246, 184), (255, 255, 127), (255, 214, 127)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CH, CI, CG, CK, CJ):
    assert _c in _farben, _c


def _maske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & OPAK


GOLD = INNEN & _maske(CA, CB, CC, CH)
HELLER = {CC: CB, CB: CA, CA: CH, CH: CI}
STERN_FARBEN = {'m': CG, 'a': CK, 's': CJ}
SWEEPS = [2, 26]
SWEEP_N = 15

# ── Sterne ──
STERN_LAUF = [0, 1, 2, 1, 0]                                                           # auf dem Ei (Oberflächenfunkeln)
STERN_LAUF_ECKE = [1, 2, 1]                                                            # in den Ecken: nie ein einzelner Punkt (kleinster Stern = Plus aus 5 Pixeln)
ORTE = {'e1': (7, 9), 'e2': (10, 12), 'e3': (5, 15),                                    # auf dem Ei (ganz im Inneren)
        'c1': (0, -1), 'c2': (17, -1)}                                                    # freie obere Ecken (außerhalb des Eis)
for _k in ('e1', 'e2', 'e3'):
    _x, _y = ORTE[_k]
    for (_dx, _dy) in [(d, 0) for d in range(-2, 3)] + [(0, d) for d in (-2, -1, 1, 2)]:
        assert INNEN[_y + _dy, _x + _dx], (_k, _dx, _dy)
for _k in ('c1', 'c2'):
    _x, _y = ORTE[_k]
    for (_dx, _dy) in [(d, 0) for d in range(-2, 3)] + [(0, d) for d in (-2, -1, 1, 2)]:
        _X, _Y = _x + _dx, _y + _dy
        assert not (0 <= _Y < sh and 0 <= _X < sw and OPAK[_Y, _X]), (_k, _dx, _dy)
STERNE = [(3, 'c1'), (9, 'e1'), (15, 'c2'), (20, 'e2'), (27, 'c1'), (33, 'e3'), (38, 'c2'), (40, 'e1'), (13, 'e3'), (30, 'e2')]


def aktive_sterne(i):
    out = []
    for (s, o) in STERNE:
        lauf = STERN_LAUF if o.startswith('e') else STERN_LAUF_ECKE
        if (i - s) % N < len(lauf):
            out.append((o, lauf[(i - s) % N]))
    return out


# ── Risse (zwei Pixel in der Umrissfarbe D; nur auf Goldpixeln, ≥ 2 Pixel vom Rand, nicht auf den Armen der Eisterne e1–e3) ──
CD = (122, 18, 0)
assert CD in _farben
RISSE = [E.Riss(p, start=st) for p, st in (
    ([(13, 16), (12, 17)], 2), ([(4, 7), (4, 8)], 10), ([(15, 12), (15, 13)], 18),
    ([(2, 13), (3, 14)], 26), ([(12, 9), (12, 10)], 34))]
_gold_alle = _maske(CA, CB, CC, CH)
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert INNEN[_y, _x] and _gold_alle[_y, _x], (_x, _y)
        for _k in ('e1', 'e2', 'e3'):
            assert not ((_x == ORTE[_k][0] and abs(_y - ORTE[_k][1]) <= 2) or (_y == ORTE[_k][1] and abs(_x - ORTE[_k][0]) <= 2)), ('Riss in der Sternzone', _x, _y)
assert E.gleichzeitig(RISSE, N)[0] <= 2 and all(r.stufe(0, N) == 0 for r in RISSE)
REF = L.platz(spr, H, W, PAD_L, PAD_T)


def sprite_mit_effekten(i):
    sp = spr.copy()
    if GLANZ:
        for s0 in SWEEPS:
            if 0 <= i - s0 < SWEEP_N:
                t = 3 * (i - s0) - 5
                sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 7))
    return sp


def figur(i):
    fig = L.platz(sprite_mit_effekten(i), H, W, PAD_L, PAD_T)
    return dict(fig=E.auf_figur(fig, E.risse_ebene(H, W, i, N, RISSE, CD, PAD_L, PAD_T, gueltig=OPAK)))


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
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    print('Frame 0 weicht vom Original in', int((figs[0] != REF).any(axis=2).sum()), 'Pixeln ab | höchstens', E.gleichzeitig(RISSE, N)[0], 'Risse gleichzeitig')
    # Eck-Sterne dürfen das Ei nie berühren (auch nicht über die Ecke)
    for i in range(N):
        e = L.leer(H, W)
        for ort, stufe in aktive_sterne(i):
            if ort.startswith('c'):
                A.stern(e, PAD_L + ORTE[ort][0], PAD_T + ORTE[ort][1], stufe, STERN_FARBEN)
        st = e[..., 3] > 0
        k = np.pad(figs[i][..., 3] > 0, 1)
        nah = np.zeros_like(st)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nah |= k[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
        if (st & nah).any():
            print('Eck-Stern berührt das Ei in Frame', i)
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'the-egg-of-god')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('the-egg-of-god', 'The Egg of God', frames, MS, prev)
    if prev:
        L.streifen(prev + '/the-egg-of-god-strip.png', frames[::2], spalten=12, scale=6)
