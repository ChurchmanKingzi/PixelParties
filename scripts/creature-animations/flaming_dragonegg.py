# -*- coding: utf-8 -*-
"""Idle-Animation für „Flaming Dragonegg“ (Creature) — nach Vorlage von Monster Nest / Shimmering Dragonegg: statisches Ei, auf dem kleine Risse erscheinen und verschwinden.

PICK: [["Motive", 12, 1]]   Ebene „Flaming Dragonegg“ (Motive.xcf, Ebene 12, 34×41 px, 5 Farben, nur Alpha 0/255, voll deckend) → src/flaming-dragonegg.png (das ganze Ei, ein 4-verbundenes Teil; Ebene unverändert übernommen).
Die Kartenkunst (data/card-art/native/Flaming_Dragonegg.png) zeigt dieselbe Figur bei ca. (21,8), aber farblich überarbeitet (kein exakter Pixelvergleich möglich).
Nicht verwendet: die Lava-/Mauerwerks-Hintergrundebenen und die verschwommene Spiegelung unter dem Ei in der Kartenkunst (halbtransparent, andere Ebene).

Aufruf:   python3 flaming_dragonegg.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/flaming-dragonegg.png + .json

Was im Sprite ist (Koordinaten im Sprite 34×41, x/y ab 0):
* Ein eiförmiges Feuerei (x 0–33, y 0–40) aus einem unregelmäßigen Schuppenraster: Dunkelbraun A=(48,0,0) (Fugen und Rand), Rot E=(202,44,41), Orange D=(244,123,34), Gelb B=(246,231,14) und Cremeweiß C=(247,245,184)
  (Schuppen heller in der Mitte, dunkler am Rand). Kein Gesicht, keine Flamme außerhalb der Eiform — das Muster IST die Schale; kein Glanz/Glitzer (Regel 14), kein Flammenfeuer (Regel 15: die Schale bleibt fest).
Fest bleiben: das GANZE Ei (Form, Rand, Schuppenraster).

Nutzerwunsch (Runde 3): „gerne ein paar mehr Cracks, auch mehr als einen pro Ei zur Zeit. Das gilt für ALLE Eier.“
Ablauf (72 Frames à 75 ms = 5,4 s, nahtlos):
* Das Ei bleibt KOMPLETT STATISCH. Risse: 16 Risse (vorher 8) aus je 5 Pixeln, zackig (diagonal/senkrecht gemischt), erscheinen zeitversetzt über das ganze Ei verteilt: erst 1, dann 2, 3, 4, 5 Pixel, steht 2–5 Frames,
  schrumpft wieder und verschwindet (20–23 Frames). Die Starts sind unregelmäßig (Goldener-Schnitt-Folge), sodass fast immer 3–6 Risse gleichzeitig sichtbar sind (mehrere nebeneinander auf dem einen Ei); Frame 0 und
  die ersten Frames sind rissfrei (= Original).
* Wie bisher HELL: das Schuppenraster dieses Eis ist selbst schon dunkelbraun (A) und kleinteilig — ein dunkler Riss ginge darin unter. Deshalb ist es das Glühen aus dem Inneren: die ersten Pixel Cremeweiß C, das letzte Gelb B
  (auslaufende Spitze); sie liegen auf dunkelbraunen Fugenpixeln (A) mindestens 2 Pixel vom Rand entfernt. Sie liegen dort, wo das Umfeld besonders dunkel ist (dichte dunkle Fugenhaufen), damit das helle Glühen lesbar bleibt. Die Risse ersetzen nur dunkle Fugenpixel durch helle (nie umgekehrt) — kein Umriss wird dadurch dicker,
  der Außenrand (Silhouette, 2 Pixel breit) bleibt unberührt.
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben, kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 72, 75
PAD = 3

spr = L.lade('flaming-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
CA, CB, CC = (48, 0, 0), (246, 231, 14), (247, 245, 184)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(c in _farben for c in (CA, CB, CC))
ERLAUBT = E.sicher(spr, [CA], sorted(_farben), rand_abstand=2)                          # helle Risse liegen auf dunklen Fugenpixeln, mindestens 2 Pixel vom Rand

# ── Risse (x, y im Sprite; Pixel 1 wächst zuerst) — Stellen mit E.sicher/E.pfade ausgesucht und festgeschrieben ──
_SITES = [[(22, 19), (22, 20), (22, 21), (23, 22), (24, 22)], [(3, 22), (4, 23), (5, 24), (6, 24), (7, 25)], [(9, 12), (10, 12), (11, 13), (12, 14), (13, 15)],
          [(16, 5), (17, 6), (18, 7), (19, 8), (19, 9)], [(20, 28), (21, 29), (22, 30), (23, 31), (23, 32)], [(24, 9), (25, 10), (25, 11), (25, 12), (24, 13)],
          [(24, 26), (25, 27), (26, 27), (27, 28), (27, 29)], [(10, 26), (11, 25), (12, 25), (13, 26), (14, 27)], [(12, 5), (12, 6), (12, 7), (13, 8), (14, 9)],
          [(18, 35), (19, 35), (20, 36), (21, 36), (22, 35)], [(6, 13), (6, 14), (7, 15), (7, 16), (8, 17)], [(9, 34), (9, 33), (10, 32), (11, 31), (12, 30)],
          [(27, 21), (28, 22), (29, 23), (29, 24), (29, 25)], [(12, 21), (13, 21), (14, 20), (14, 19), (15, 18)], [(12, 36), (13, 35), (14, 34), (14, 33), (15, 32)],
          [(19, 12), (20, 13), (20, 14), (20, 15), (19, 16)]]
_ORD = [0, 8, 3, 12, 6, 14, 1, 10, 4, 15, 9, 2, 13, 5, 11, 7]                              # Reihenfolge der Starts (benachbarte Stellen nicht hintereinander)
_HALTEN = [3, 5, 2, 4, 3, 2, 5, 4]
_prof = [E.profil(5, _HALTEN[k % len(_HALTEN)]) for k in range(len(_SITES))]
_st = E.starts(len(_SITES), N, [len(q) for q in _prof], basis=2, versatz=0.3)
RISSE = [E.Riss(_SITES[j], start=_st[k], profil=_prof[k], farbe=CC, spitze=CB) for k, j in enumerate(_ORD)]
E.pruefe_risse(RISSE, N, ERLAUBT)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, CC, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('flaming-dragonegg', 'Flaming Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/flaming-dragonegg-strip.png', frames[::3], spalten=10, scale=6)
