# -*- coding: utf-8 -*-
"""Idle-Animation für „Monster Nest“ (Creature) — Runde 2: statische Eier, auf denen kleine Risse erscheinen und verschwinden.

PICK: [["Motive", 831, 1]]   Ebene „Monster Nest“ (Motive.xcf, Ebene 831, 39×33 px, 8 Farben, nur Alpha 0/255) → src/monster-nest.png (ganzes Sprite, ein einziges 4-verbundenes Teil).
Nicht verwendet: die Lava und das Mauerwerk der Karte (andere Ebenen).

Aufruf:   python3 monster_nest.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/monster-nest.png + .json

Was im Sprite ist (Koordinaten im Sprite 39×33, x/y ab 0):
* Ein Haufen aus fünf würfelförmigen, weiß-grauen Eiern/Kapseln (B=(208,208,208), C=(237,237,237), F=(129,129,129), schwarzer Umriss A=(0,0,0)), jede mit einer roten, achteckigen Raute in der Mitte
  (D=(170,74,76), E=(158,52,55), G=(87,31,32)) und zwei roten Eckmarken oben; die Rautenmitten liegen bei (30.5, 8.5) (oben rechts), (15.5, 11.5) (oben Mitte), (7.5, 17.5) (links), (25.5, 18.5)
  (Mitte rechts) und (16.5, 25.5) (unten). Die Eier berühren sich und teilen ihre schwarzen Umrisslinien. Ein einzelnes gelbes Pixel H=(250,213,74) bei (0, 22) und die dunkelroten
  Pixel daneben gehören zum Original (Lavaschimmer/Schatten der Kunst) und bleiben fest.
* Material: Ei-/Kapselschale — kein Edelstein/Gold/Metall: KEIN Glanz (Regel 14), kein Flammenfeuer (Regel 15).

Nutzerwunsch (Runde 2): „soll anders animiert werden – kleine Risse auf den einzelnen statischen Eiern, die erscheinen und verschwinden“.
Nutzerwunsch (Runde 3): „gerne ein paar mehr Cracks, auch mehr als einen pro Ei zur Zeit. Das gilt für ALLE Eier.“
→ Die Eier bleiben KOMPLETT STATISCH (kein Squash & Stretch, kein Wackeln, kein Rucken, kein Dampf). Das Einzige, was sich ändert, sind Risse:

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos):
* 26 Risse (vorher 10) auf allen fünf Eiern, je Ei 4–6 Stellen (Stellen mit wenig Platz kommen ein zweites Mal dran, dann von der anderen Seite her wachsend), jeder aus 2–3 Pixeln in der Umrissfarbe A (schwarz),
  zackig (diagonal/senkrecht gemischt): erst 1 Pixel, dann 2, dann 3, steht 2–5 Frames, schrumpft wieder und ist weg (12–15 Frames). Die Starts sind je Ei unregelmäßig (Goldener-Schnitt-Folge, je Ei versetzt)
  verteilt, sodass auf jedem Ei immer wieder ZWEI (zeitweise drei) Risse gleichzeitig sichtbar sind; im ganzen Haufen meist 4–7. Frame 0 und die ersten Frames sind rissfrei (= Original).
* Umrisse werden NIE dicker: jedes Rissspixel liegt mit allen vier Nachbarn (oben/unten/links/rechts) auf Schalenpixeln (B/C bzw. grauer Schatten F) — nie neben einem schwarzen Umriss, nie neben der roten Raute und
  mindestens 2 Pixel von der Silhouette; ein Riss berührt höchstens über die Ecke (nie über die Kante) eine Linie, und zwei Risse berühren sich nie (das Skript prüft alles).
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben (Risse = Umrissschwarz A des Sprites), kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 60, 75
PAD = 3

spr = L.lade('monster-nest')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
SCHWARZ = (0, 0, 0)
HELL = [(208, 208, 208), (237, 237, 237)]                                                # Schalenfarben B, C (nur dort liegen Risse)
GRAU = (129, 129, 129)                                                                   # Schattenstreifen F (darf neben einem Riss liegen)

# ── Risse je Ei (x, y im Sprite; Pixel 1 wächst zuerst) — Stellen mit der Skript-Hilfe E.sicher/E.pfade ausgesucht und hier festgeschrieben ──
EIER = [
    # 0 oben rechts
    [[(29, 5), (30, 4), (31, 4)], [(34, 7), (35, 8), (35, 9)], [(26, 8), (27, 7), (27, 6)], [(33, 11), (34, 11)]],
    # 1 oben Mitte
    [[(18, 15), (18, 14), (19, 13)], [(14, 8), (15, 7), (16, 7)], [(19, 10), (20, 11), (21, 11)], [(12, 9), (12, 10)]],
    # 2 links
    [[(7, 13), (8, 13), (9, 14)], [(11, 16), (12, 17), (13, 17)], [(3, 17), (3, 18), (4, 19)], [(4, 15), (5, 15)], [(10, 20), (11, 19)]],
    # 3 Mitte rechts
    [[(27, 22), (28, 21), (29, 21)], [(22, 16), (23, 16), (24, 15)], [(30, 18), (30, 19), (31, 20)], [(26, 14), (27, 15), (28, 16)], [(24, 22), (25, 23)]],
    # 4 unten
    [[(21, 27), (21, 26), (22, 25)], [(12, 26), (12, 25), (13, 24)], [(15, 22), (16, 21), (17, 21)], [(18, 29), (19, 28)], [(13, 28), (14, 28)], [(19, 23), (20, 24)]],
]
HALTEN = [2, 4, 3, 5, 2, 3, 4, 2, 5, 3]
RISSE, GRUPPEN, STELLE = [], [], []
for _g, _sites in enumerate(EIER):
    _ev = [(list(p) if (k % 2 == 0) else list(reversed(p))) for k, p in enumerate(_sites)]
    _stelle = list(range(len(_ev)))
    while len(_ev) < 5:                                                                    # Eier mit wenig Platz: erste Stelle ein zweites Mal, von der anderen Seite her
        _stelle.append(len(_ev) - len(_sites))
        _ev.append(list(reversed(_sites[len(_ev) - len(_sites)])))
    _pr = [E.profil(len(p), HALTEN[(_g * 3 + k) % len(HALTEN)]) for k, p in enumerate(_ev)]
    _st = E.starts(len(_ev), N, [len(q) for q in _pr], basis=1 + _g, versatz=_g * 0.37 + 0.2)
    GRUPPEN.append(list(range(len(RISSE), len(RISSE) + len(_ev))))
    STELLE += [(_g, k) for k in _stelle]
    RISSE += [E.Riss(p, start=st, profil=q) for p, st, q in zip(_ev, _st, _pr)]
_sich = E.sicher(spr, HELL, [GRAU], rand_abstand=1)
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert OPAK[_y, _x] and tuple(int(v) for v in spr[_y, _x, :3]) in HELL, (_x, _y)
        for (_dx, _dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):                              # nie über die Kante neben einem Umriss/der Raute
            _q = spr[_y + _dy, _x + _dx]
            assert _q[3] and tuple(int(v) for v in _q[:3]) in HELL + [GRAU], ('Riss neben Umriss', _x, _y)
_pix = [(i, p) for i, r in enumerate(RISSE) for p in r.pix]
for _a in range(len(_pix)):
    for _b in range(_a + 1, len(_pix)):
        (_i, _p), (_j, _q) = _pix[_a], _pix[_b]
        if STELLE[_i] == STELLE[_j]:                                                       # dieselbe Stelle zweimal: die Zeiträume dürfen sich nicht überlappen
            if _i != _j:
                assert not any(RISSE[_i].stufe(f, N) and RISSE[_j].stufe(f, N) for f in range(N)), ('Stelle doppelt belegt', STELLE[_i])
        else:
            assert max(abs(_p[0] - _q[0]), abs(_p[1] - _q[1])) > 1, ('Risse berühren sich', _p, _q)
assert all(r.stufe(0, N) == 0 for r in RISSE) and all(r.start + len(r.profil) <= N for r in RISSE)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, SCHWARZ, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N, GRUPPEN)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('je Ei (höchstens gleichzeitig, Mittel, Frames mit >= 2):', z['gruppen'])
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('monster-nest', 'Monster Nest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/monster-nest-strip.png', frames[::3], spalten=10, scale=6)
