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
→ Die Eier bleiben KOMPLETT STATISCH (kein Squash & Stretch, kein Wackeln, kein Rucken, kein Dampf mehr). Das Einzige, was sich ändert, sind kleine Risse:

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos):
* Zehn Risse (zwei je Ei, an verschiedenen Stellen der hellen Schale), jeder aus 2 Pixeln in der Umrissfarbe A (schwarz): erst 1 Pixel, dann 2 Pixel (zackig, diagonal bzw. senkrecht),
  steht kurz, schrumpft wieder auf 1 Pixel, dann ist er weg (Verlauf 1-1-2-2-2-2-2-2-2-2-1-1 Frames, 12 Frames = 0,9 s; ein Riss mit kürzerem Verlauf 1-2-2-2-2-2-1).
  Die Risse starten reihum zeitversetzt (alle 5 Frames einer, Eier in der Reihenfolge links, oben rechts, unten, Mitte rechts, oben Mitte, dann zweite Runde) — es sind immer 1–3 Risse gleichzeitig sichtbar.
  Frame 0 ist rissfrei (= Original); die Risse liegen nur auf hellen Schalenpixeln (B/C), nie auf Raute, Umriss oder Rand.
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

# ── Risse (x, y im Sprite; Pixel 1 zuerst, dann 2) ──
RISSE = [
    E.Riss([(4, 15), (5, 16)], start=2),                    # links
    E.Riss([(35, 8), (36, 9)], start=7),                    # oben rechts
    E.Riss([(21, 25), (22, 26)], start=12),                 # unten
    E.Riss([(30, 18), (31, 19)], start=17),                 # Mitte rechts
    E.Riss([(20, 10), (21, 11)], start=22),                 # oben Mitte
    E.Riss([(22, 16), (23, 17)], start=27),                 # Mitte rechts, zweiter Riss
    E.Riss([(12, 9), (13, 10)], start=32, profil=E.PROFIL_KURZ),   # oben Mitte, zweiter Riss
    E.Riss([(12, 16), (12, 17)], start=37),                 # links, zweiter Riss
    E.Riss([(18, 30), (17, 29)], start=42),                 # unten, zweiter Riss
    E.Riss([(27, 6), (27, 7)], start=47, profil=E.PROFIL_KURZ),    # oben rechts, zweiter Riss
]
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert OPAK[_y, _x] and tuple(int(v) for v in spr[_y, _x, :3]) in HELL, (_x, _y)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, SCHWARZ, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    mx, leer = E.gleichzeitig(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab | höchstens', mx, 'Risse gleichzeitig | Frames ohne Riss:', leer)
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('monster-nest', 'Monster Nest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/monster-nest-strip.png', frames[::3], spalten=10, scale=6)
