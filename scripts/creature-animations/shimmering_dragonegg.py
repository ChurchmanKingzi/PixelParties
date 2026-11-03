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

Nutzerwunsch (Runde 3): „gerne ein paar mehr Cracks, auch mehr als einen pro Ei zur Zeit. Das gilt für ALLE Eier.“ + Gold: Glitzer nur als kurze Sparkle-Partikel.
Ablauf (72 Frames à 65 ms = 4,7 s, nahtlos):
* Das Ei bleibt KOMPLETT STATISCH. Risse: 13 Risse (vorher 6) aus je 4 Pixeln in der dunkelsten Eifarbe F=(182,38,0), zackig (diagonal/senkrecht gemischt), erscheinen zeitversetzt über das ganze Ei verteilt:
  erst 1, dann 2, 3, 4 Pixel, steht 2–5 Frames, schrumpft wieder und verschwindet (16–19 Frames). Die Starts sind unregelmäßig (Goldener-Schnitt-Folge), sodass fast immer 3–5 Risse gleichzeitig sichtbar sind
  (mehrere nebeneinander auf dem einen Ei); Frame 0 und die ersten Frames sind rissfrei (= Original). Sie liegen nur auf Rasterpixeln, mindestens 3 Pixel vom Rand (kein Umriss wird dicker, nichts berührt den Randkranz)
  und nie auf den Armen eines Sparkles.
* Goldschimmer (Regel 12a, Gold): zweimal pro Schleife (Frames 4–19 und 40–55) läuft ein breites diagonales Lichtband über das Ei (eine Stufe heller auf der Gold-Rampe A→C→B→E, nur Innenpixel); das Ei selbst bewegt sich nicht.
  Das frühere Pixel-Funkeln (acht Gelbpixel je Frame kurz Weiß) ist entfernt: Glitzer gibt es jetzt NUR noch als Sparkle-Partikel.
* Sparkles (Regel 34, Gold): sieben kurze Sparkles je Schleife (4 Frames: Mitte → kleines Kreuz → großes Kreuz → kleines Kreuz, dann weg), immer nur eines zur Zeit, mit langen Pausen (≥ 5 Frames) dazwischen; vier sitzen auf dem Ei,
  drei in den freien Ecken des Sprite-Rechtecks (Farben E, B, C des Sprites).
Ergänzungen: keine (der Rand wird nie verändert).
Frame: Sprite plus 3 px Rand rundum — Figur zentriert; die Sterne liegen in den freien Ecken innerhalb des Sprite-Rechtecks.
Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_eier as E

N, MS = 72, 65
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
HELLER = {CA: CC, CC: CB, CB: CE}
STERN_FARBEN = {'m': CE, 'a': CB, 's': CC}
SWEEPS = [4, 40]
SWEEP_N = 16

# ── Sparkles: kurze Sterne (Regel 34), immer nur einer zur Zeit ──
STERN_LAUF = E.SPARKLE_LAUF
ORTE = {'e1': (6, 19), 'e2': (13, 37), 'e3': (19, 4), 'e4': (28, 28),                      # auf dem Ei (Rasterpixel; Arme ganz im Inneren, nie auf einem Riss)
        'c1': (4, 4), 'c2': (29, 5), 'c3': (3, 37), 'c4': (30, 37)}                       # in den Ecken (außerhalb des Eis)
for _k in ('e1', 'e2', 'e3', 'e4'):
    _x, _y = ORTE[_k]
    for (_dx, _dy) in [(d, 0) for d in range(-2, 3)] + [(0, d) for d in (-2, -1, 1, 2)]:
        assert INNEN[_y + _dy, _x + _dx], (_k, _dx, _dy)
for _k in ('c1', 'c2', 'c3', 'c4'):
    assert not OPAK[ORTE[_k][1], ORTE[_k][0]], _k
STERNE = [(3, 'c1'), (13, 'e1'), (23, 'c2'), (33, 'e3'), (43, 'e4'), (52, 'c3'), (62, 'e2')]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


# ── Risse (vier Pixel, F = dunkelste Eifarbe; nur auf Rasterpixeln, mindestens 3 Pixel vom Rand) — Stellen mit E.sicher/E.pfade ausgesucht und festgeschrieben ──
_SITES = [[(17, 16), (18, 16), (19, 17), (19, 18)], [(11, 28), (11, 29), (12, 30), (13, 30)], [(9, 16), (10, 17), (11, 17), (12, 16)], [(12, 8), (11, 9), (11, 10), (12, 11)],
          [(23, 30), (24, 31), (24, 32), (23, 33)], [(23, 13), (23, 14), (24, 15), (25, 15)], [(17, 27), (17, 28), (18, 29), (19, 29)], [(18, 7), (19, 8), (19, 9), (18, 10)],
          [(26, 23), (26, 24), (27, 25), (28, 25)], [(6, 23), (5, 24), (5, 25), (6, 26)], [(17, 33), (18, 34), (18, 35), (17, 36)], [(19, 23), (20, 22), (21, 22), (22, 23)],
          [(10, 23), (11, 24), (12, 24), (13, 23)]]
_ORD = [0, 7, 3, 10, 5, 12, 1, 8, 4, 11, 2, 9, 6]                                           # Reihenfolge der Starts (benachbarte Stellen nicht hintereinander)
_HALTEN = [3, 5, 2, 4, 3, 2, 5, 4]
_prof = [E.profil(4, _HALTEN[k % len(_HALTEN)]) for k in range(len(_SITES))]
_st = E.starts(len(_SITES), N, [len(q) for q in _prof], basis=2, versatz=0.45)
RISSE = [E.Riss(_SITES[j] if k % 2 == 0 else list(reversed(_SITES[j])), start=_st[k], profil=_prof[k]) for k, j in enumerate(_ORD)]
ERLAUBT = E.sicher(spr, [CA, CB, CC, CD, CE], sorted(_farben), rand_abstand=3)
E.pruefe_risse(RISSE, N, ERLAUBT)
for _r in RISSE:
    for (_x, _y) in _r.pix:
        for _k in ('e1', 'e2', 'e3', 'e4'):
            assert not ((_x == ORTE[_k][0] and abs(_y - ORTE[_k][1]) <= 2) or (_y == ORTE[_k][1] and abs(_x - ORTE[_k][0]) <= 2)), ('Riss auf einem Sparkle-Arm', _x, _y)
REF = L.platz(spr, H, W, PAD_L, PAD_T)


def sprite_mit_effekten(i):
    sp = spr.copy()
    if GLANZ:
        for s0 in SWEEPS:
            if 0 <= i - s0 < SWEEP_N:
                t = 5 * (i - s0) - 6
                sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 7))
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
    print('Farben:', len(_farben), '| Innenpixel:', int(INNEN.sum()), '| Gold-Rampe:', int(GOLD.sum()))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N)
    print('Frame 0 weicht vom Original in', int((figs[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('Sparkles gleichzeitig höchstens', max(len(aktive_sterne(i)) for i in range(N)), '| Frames mit Sparkle:', sum(1 for i in range(N) if aktive_sterne(i)), 'von', N)
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'shimmering-dragonegg')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('shimmering-dragonegg', 'Shimmering Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shimmering-dragonegg-strip.png', frames[::3], spalten=12, scale=4)
