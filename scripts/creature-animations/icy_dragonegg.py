# -*- coding: utf-8 -*-
"""Idle-Animation für „Icy Dragonegg“ (Creature) — nach Vorlage von Monster Nest / Shimmering Dragonegg: statisches Ei, auf dem kleine Risse erscheinen und verschwinden.

PICK: [["MotiveCoolhalla", 3, 1]]   Ebene „Icy Dragonegg“ (MotiveCoolhalla.xcf, Ebene 3, 34×41 px, 17 Farben, nur Alpha 0/255, voll deckend) → src/icy-dragonegg.png (das ganze Ei, ein 4-verbundenes Teil; Ebene unverändert übernommen, bis auf
den Zuschnitt auf die deckenden Pixel). Die Kartenkunst (data/card-art/native/Icy_Dragonegg.png) zeigt dieselbe Figur bei ca. (20,6), aber farblich überarbeitet (kein exakter Pixelvergleich möglich).
Nicht verwendet: der dunkle Schlagschatten („Icy Dragonegg #1“, Ebene 4, halbtransparent), der Schein („Icy Dragonegg #3“, Ebene 2, 1 Farbe mit Alpha-Verlauf) und der Hintergrund (andere Ebenen).

Aufruf:   python3 icy_dragonegg.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/icy-dragonegg.png + .json

Was im Sprite ist (Koordinaten im Sprite 34×41, x/y ab 0):
* Ein eiförmiges Eisei (x 0–33, y 0–40) aus runden Schuppen in Eisblau-/Türkis-Stufen (hell oben rechts: F=(110,177,203), G=(153,200,218), L, N, P, Q; mittel C, E, I, J; dunkel unten links B, H, K), getrennt durch ein
  dunkelviolettes Fugenraster A=(58,46,86); Rand und Fugen in A und dem Dunkelviolett D=(25,20,37) (oberste/unterste Zeile und die tiefsten Fugenpunkte).
* Material: Eis — kein Glanz, keine Sterne (Regel 14: bei Eis im Zweifel weglassen), kein Feuer.
Fest bleiben: das GANZE Ei (Form, Rand, Schuppenraster).

Nutzerwunsch (Runde 3): „gerne ein paar mehr Cracks, auch mehr als einen pro Ei zur Zeit. Das gilt für ALLE Eier.“
Ablauf (72 Frames à 75 ms = 5,4 s, nahtlos):
* Das Ei bleibt KOMPLETT STATISCH. Risse: 16 Risse (vorher 8) aus je 4 Pixeln in der dunkelsten Eifarbe D=(25,20,37), zackig (diagonal/senkrecht gemischt), erscheinen zeitversetzt über das ganze Ei verteilt:
  erst 1, dann 2, 3, 4 Pixel, steht 2–5 Frames, schrumpft wieder und verschwindet (16–19 Frames je Riss). Die Starts sind unregelmäßig (Goldener-Schnitt-Folge), sodass fast immer 3–6 Risse gleichzeitig sichtbar sind
  (mehrere nebeneinander auf dem einen Ei); Frame 0 und die ersten Frames sind rissfrei (= Original).
* Umrisse werden NIE dicker: Risse liegen nur auf den Schuppenpixeln (nie auf den dunkelvioletten Fugen A/D und nie auf den dunklen Blautönen), mindestens 2 Pixel von der Silhouette entfernt, nie auf dem Rand;
  zwei Risse berühren sich nie gleichzeitig (das Skript prüft es).
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben, kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 72, 75
PAD = 3

spr = L.lade('icy-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
DUNKEL = (25, 20, 37)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert DUNKEL in _farben
SCHUPPE = [c for c in sorted(_farben) if 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] >= 100]  # nur helle/mittelhelle Schuppen (Helligkeit >= 100), auf denen ein dunkler Riss gut sichtbar ist
ERLAUBT = E.sicher(spr, SCHUPPE, sorted(_farben), rand_abstand=2)

# ── Risse (x, y im Sprite; Pixel 1 wächst zuerst) — Stellen mit E.sicher/E.pfade ausgesucht und festgeschrieben ──
_SITES = [[(10, 11), (11, 11), (12, 12), (12, 13)], [(21, 24), (20, 25), (20, 26), (21, 27)], [(20, 12), (19, 13), (19, 14), (20, 15)], [(16, 6), (17, 6), (18, 7), (18, 8)],
          [(26, 18), (27, 19), (28, 19), (29, 18)], [(24, 12), (24, 13), (25, 14), (26, 14)], [(12, 21), (12, 20), (13, 19), (14, 19)], [(9, 25), (9, 26), (10, 27), (11, 27)],
          [(19, 19), (20, 20), (21, 20), (22, 19)], [(26, 26), (27, 26), (28, 27), (28, 28)], [(6, 13), (6, 14), (7, 15), (8, 15)], [(15, 33), (15, 34), (16, 35), (17, 35)],
          [(16, 25), (15, 26), (15, 27), (16, 28)], [(21, 33), (21, 34), (22, 35), (23, 35)], [(10, 7), (11, 7), (12, 6), (12, 5)], [(22, 6), (22, 7), (23, 8), (24, 8)]]
_ORD = [0, 8, 3, 12, 6, 14, 1, 10, 4, 15, 9, 2, 13, 5, 11, 7]                              # Reihenfolge der Starts (benachbarte Stellen nicht hintereinander)
_HALTEN = [3, 5, 2, 4, 3, 2, 5, 4]
_prof = [E.profil(4, _HALTEN[k % len(_HALTEN)]) for k in range(len(_SITES))]
_st = E.starts(len(_SITES), N, [len(q) for q in _prof], basis=2, versatz=0.15)
RISSE = [E.Riss(_SITES[j] if k % 2 == 0 else list(reversed(_SITES[j])), start=_st[k], profil=_prof[k]) for k, j in enumerate(_ORD)]
E.pruefe_risse(RISSE, N, ERLAUBT)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, DUNKEL, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('icy-dragonegg', 'Icy Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/icy-dragonegg-strip.png', frames[::3], spalten=10, scale=6)
