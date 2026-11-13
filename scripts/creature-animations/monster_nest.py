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

# ── Risse je Ei (x, y im Sprite): h = Hauptast in Wachstumsrichtung, z = Seitenäste, d = Pixel, die den Riss dort 2 px dick machen — mit E.wachse_riss entworfen und festgeschrieben ──
EIER = [
    # 0 oben rechts
    [dict(h=[(33, 11), (34, 11), (35, 10), (36, 9), (36, 8), (35, 7), (34, 7)], z=[], d=[(34, 10), (35, 9)]),
     dict(h=[(26, 8), (26, 7), (27, 6), (28, 6)], z=[], d=[(26, 6)])],
    # 1 oben Mitte
    [dict(h=[(21, 11), (20, 10), (19, 10), (18, 9), (17, 8), (16, 7)], z=[], d=[(20, 11)]),
     dict(h=[(13, 9), (12, 9), (11, 9)], z=[], d=[])],
    # 2 links
    [dict(h=[(7, 13), (8, 13), (9, 14), (10, 15), (11, 16), (12, 17), (12, 18), (11, 19)], z=[], d=[(12, 16), (13, 17)]),
     dict(h=[(4, 16), (3, 17), (3, 18), (4, 19)], z=[], d=[(3, 16)])],
    # 3 Mitte rechts
    [dict(h=[(30, 17), (31, 18), (30, 19), (30, 20), (29, 21), (28, 22), (27, 23), (26, 23)], z=[], d=[(30, 18), (31, 19), (29, 20)]),
     dict(h=[(21, 17), (22, 16), (23, 16), (24, 15), (25, 14)], z=[], d=[(21, 16)])],
    # 4 unten
    [dict(h=[(21, 24), (21, 25), (22, 26), (21, 27), (20, 28), (19, 29), (18, 30), (17, 30)], z=[], d=[(22, 25), (21, 26)]),
     dict(h=[(13, 24), (12, 25), (12, 26), (13, 27)], z=[], d=[(12, 24)]),
     dict(h=[(16, 21), (17, 21), (18, 22)], z=[], d=[])],
]
# Zwischentöne beim Ausbleichen: Schwarz → Grau → Schale. Das Sprite hat dazwischen nur das Schattengrau F; damit das Ausbleichen mehrere Stufen hat, kommen vier Grautöne der
# Spielpalette (data/palette.json: #323232, #535353, #a8a8a8, #b9b9b9) dazu — bewusst freigegeben (L.pruefe(erlaubt=…)).
PAL_GRAU = [(50, 50, 50), (83, 83, 83), (168, 168, 168), (185, 185, 185)]
TOENE = E.toene_auto(PAL_GRAU + [GRAU], quer=8)
HALTEN = [3, 5, 4, 6, 3, 4, 5, 3, 6, 4]
RISSE, GRUPPEN, STELLE = [], [], []
_ev = []
for _g, _sites in enumerate(EIER):
    _ids = []
    for _k, _f in enumerate(_sites):
        for _rev in ((False, True) if len(_f['h']) <= 5 else (_g % 2 == 1,)):               # kleine Risse zweimal je Schleife (einmal von jeder Seite her wachsend), große einmal
            _ids.append(len(_ev))
            _ev.append((_g, _k, dict(haupt=list(reversed(_f['h'])) if _rev else _f['h'], zweige=_f['z'], dick=_f['d'], halten=HALTEN[(len(_ev) * 3 + _g) % len(HALTEN)],
                                     tempo=1 if len(_f['h']) >= 5 else 2, stufen=4, stufe_frames=2)))
    GRUPPEN.append(_ids)
_probe = [E.BleichRiss(start=0, **kw) for (_, _, kw) in _ev]
_st = E.plane_starts([r.leben for r in _probe], N, konflikt=lambda i, j: _ev[i][:2] == _ev[j][:2], basis=1, seed=4)
RISSE = [E.BleichRiss(start=s, **kw) for s, (_, _, kw) in zip(_st, _ev)]
STELLE = [e[:2] for e in _ev]
_sich = E.sicher(spr, HELL, [GRAU], rand_abstand=1)
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert _sich[_y, _x], ('Riss neben Umriss/Raute', _x, _y)                           # Schalenpixel, alle 4 Nachbarn Schale: nie über die Kante neben einem Umriss/der Raute
for _i in range(len(RISSE)):
    for _j in range(_i + 1, len(RISSE)):
        if STELLE[_i] == STELLE[_j]:                                                       # dieselbe Stelle zweimal: die Zeiträume dürfen sich nicht überlappen
            assert not any(RISSE[_i].stufe(f, N) and RISSE[_j].stufe(f, N) for f in range(N)), ('Stelle doppelt belegt', STELLE[_i])
        else:
            assert not E.beruehren(RISSE[_i].pix, RISSE[_j].pix), ('Risse berühren sich', STELLE[_i], STELLE[_j])
assert all(r.stufe(0, N) == 0 for r in RISSE) and all(r.start + r.leben <= N for r in RISSE)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.bleich_risse(REF, i, N, RISSE, SCHWARZ, TOENE, PAD, PAD, gueltig=OPAK)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N, GRUPPEN)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('je Ei (höchstens gleichzeitig, Mittel, Frames mit >= 2):', z['gruppen'])
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr, erlaubt=PAL_GRAU)
    L.speichern('monster-nest', 'Monster Nest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/monster-nest-strip.png', frames[::3], spalten=10, scale=6)
