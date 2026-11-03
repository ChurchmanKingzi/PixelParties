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

Nutzerwunsch (Runde 3): „gerne ein paar mehr Cracks, auch mehr als einen pro Ei zur Zeit. Das gilt für ALLE Eier.“ + Gold: Glitzer nur als kurze Sparkle-Partikel.
Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Das Ei bleibt KOMPLETT STATISCH. Risse: 8 Risse (vorher 5) aus je 2–3 Pixeln in der Umrissfarbe D=(122,18,0), zackig, erscheinen zeitversetzt über das ganze Ei verteilt: erst 1, dann 2, dann 3 Pixel, steht 2–5 Frames,
  schrumpft wieder und verschwindet (12–17 Frames; die zwei 2-Pixel-Risse entsprechend kürzer). Die Starts sind unregelmäßig (Goldener-Schnitt-Folge), sodass fast immer 2–4 Risse gleichzeitig sichtbar sind; Frame 0 und die ersten
  Frames sind rissfrei (= Original). Sie liegen nur auf Goldpixeln (A/B/C/H), mindestens 3 Pixel vom Rand (kein Umriss wird dicker, nichts berührt den Rand), nie im Lichtband und nie unter einem gerade sichtbaren Sparkle
  (das Skript prüft es in jedem Frame).
* Goldschimmer (Regel 12a, Gold; bleibt aus der ersten Fassung, das Ei selbst bewegt sich nicht): zweimal pro Schleife (Frames 2–16 und 26–40) läuft ein breites diagonales Lichtband (x+y, 7 px breit) über das Ei (eine Stufe heller auf der Gold-Rampe C→B→A→H→I, nur Innenpixel).
* Sparkles (Regel 34, Gold): fünf kurze Sparkles je Schleife (4 Frames: Mitte → kleines Kreuz → großes Kreuz → kleines Kreuz, dann weg), immer nur eines zur Zeit, mit Pausen (≥ 4 Frames) dazwischen; drei sitzen auf dem Ei
  (ganz im Inneren), zwei in den freien oberen Ecken außerhalb des Eis (Farben G, K, J des Sprites; die Eck-Sparkles berühren das Ei nie — das Skript prüft es in jedem Frame). Schalter `GLANZ = False` lässt Band und Sparkles weg.
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
STERN_LAUF = E.SPARKLE_LAUF                                                            # kurzer Sparkle: Mitte → Kreuz → großes Kreuz → Kreuz, dann weg
STERN_LAUF_ECKE = E.SPARKLE_LAUF
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
STERNE = [(3, 'c1'), (17, 'e1'), (26, 'c2'), (35, 'e2'), (43, 'e3')]


def aktive_sterne(i):
    out = []
    for (s, o) in STERNE:
        lauf = STERN_LAUF if o.startswith('e') else STERN_LAUF_ECKE
        if (i - s) % N < len(lauf):
            out.append((o, lauf[(i - s) % N]))
    return out


# ── Risse (zwei bis drei Pixel in der Umrissfarbe D; nur auf Goldpixeln, ≥ 3 Pixel vom Rand) — Stellen mit E.sicher/E.pfade ausgesucht und festgeschrieben ──
CD = (122, 18, 0)
assert CD in _farben
_SITES = [[(8, 10), (8, 11), (9, 12)], [(4, 10), (5, 9), (5, 8)], [(12, 14), (13, 13), (13, 12)], [(8, 15), (8, 16), (9, 17)], [(10, 7), (11, 8), (11, 9)],
          [(4, 13), (4, 14), (5, 15)], [(7, 6), (7, 7)], [(6, 12), (7, 13)]]
_ORD = [0, 4, 2, 6, 5, 1, 7, 3]
_HALTEN = [3, 5, 2, 4]
_prof = [E.profil(len(_SITES[j]), _HALTEN[k % len(_HALTEN)]) for k, j in enumerate(_ORD)]
_st = E.starts(len(_SITES), N, [len(q) for q in _prof], basis=2, versatz=0.1)
RISSE = [E.Riss(_SITES[j] if k % 2 == 0 else list(reversed(_SITES[j])), start=_st[k], profil=_prof[k]) for k, j in enumerate(_ORD)]
ERLAUBT = E.sicher(spr, [CA, CB, CC, CH], sorted(_farben), rand_abstand=3)
E.pruefe_risse(RISSE, N, ERLAUBT)
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
    z = E.zaehle(RISSE, N)
    print('Frame 0 weicht vom Original in', int((figs[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('Sparkles gleichzeitig höchstens', max(len(aktive_sterne(i)) for i in range(N)), '| Frames mit Sparkle:', sum(1 for i in range(N) if aktive_sterne(i)), 'von', N)
    for i in range(N):                                                                     # ein Sparkle darf nie auf einem gerade sichtbaren Riss liegen
        rm = E.risse_ebene(H, W, i, N, RISSE, CD, PAD_L, PAD_T)[..., 3] > 0
        e = L.leer(H, W)
        for ort, stufe in aktive_sterne(i):
            A.stern(e, PAD_L + ORTE[ort][0], PAD_T + ORTE[ort][1], stufe, STERN_FARBEN)
        assert not (rm & (e[..., 3] > 0)).any(), ('Sparkle auf Riss in Frame', i)
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
