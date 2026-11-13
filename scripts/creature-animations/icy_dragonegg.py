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
SCHUPPE = [c for c in sorted(_farben) if 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] >= 60]   # alles außer den dunkelvioletten Fugenfarben A/D und dem dunkelsten Blau (dort ginge ein dunkler Riss unter)
ERLAUBT = E.sicher(spr, SCHUPPE, sorted(_farben), rand_abstand=3)                        # mindestens 3 Pixel Abstand zur Silhouette; ein Riss läuft nie AUF einer Fuge entlang, er kreuzt sie nur
TOENE = E.toene_auto(sorted(_farben), quer=45)                                            # Zwischentöne beim Ausbleichen: Farben des Sprites zwischen Rissfarbe und der Schuppenfarbe an dieser Stelle

# ── Risse (x, y im Sprite): h = Hauptast in Wachstumsrichtung, z = Seitenäste, d = Pixel, die den Riss dort 2 px dick machen — mit E.wachse_riss entworfen und festgeschrieben ──
_SITES = [
    dict(h=[(21, 10), (21, 9), (21, 8), (20, 7), (19, 6), (18, 6), (17, 6), (16, 7), (15, 8), (14, 7), (13, 6), (12, 7), (12, 8)], z=[[(15, 9), (16, 10), (15, 11)]], d=[(20, 6), (19, 5), (18, 5), (17, 7)]),
    dict(h=[(20, 18), (21, 19), (22, 19), (23, 19), (24, 20), (25, 21), (25, 22), (24, 23), (25, 24), (26, 25), (27, 25)], z=[[(22, 18), (22, 17), (23, 16)], [(25, 19), (26, 19), (27, 18), (28, 18)]], d=[(24, 21), (25, 23), (24, 24)]),
    dict(h=[(19, 15), (18, 14), (17, 14), (16, 15), (15, 16), (15, 17), (14, 18), (13, 19), (12, 20), (12, 21), (11, 22), (10, 22)], z=[[(16, 18), (16, 19), (16, 20)]], d=[(19, 14), (18, 13), (17, 15)]),
    dict(h=[(18, 23), (19, 24), (20, 25), (20, 26), (21, 27), (22, 28), (23, 29), (24, 29), (25, 29)], z=[[(20, 23), (20, 22)]], d=[(21, 25), (21, 26), (22, 27)]),
    dict(h=[(12, 30), (13, 31), (13, 32), (14, 33), (15, 34), (16, 34), (17, 35)], z=[[(15, 32), (16, 31)]], d=[(12, 31)]),
    dict(h=[(6, 24), (7, 24), (8, 25), (8, 26), (9, 27), (10, 27), (11, 27)], z=[[(7, 23), (7, 22)]], d=[(9, 25), (9, 26), (9, 28)]),
    dict(h=[(9, 10), (10, 11), (10, 12), (11, 13), (11, 14)], z=[], d=[(9, 11)]),
    dict(h=[(15, 25), (16, 26), (15, 27), (15, 28)], z=[], d=[(15, 26)]),
    dict(h=[(6, 16), (7, 16), (8, 17), (8, 18), (9, 19)], z=[[(9, 17), (10, 17)]], d=[]),
    dict(h=[(21, 32), (22, 33), (22, 34), (21, 35)], z=[[(23, 32), (24, 32)]], d=[(21, 33)]),
]
_HALTEN = [4, 7, 5, 8, 4, 6, 5, 7]
_kw = [dict(haupt=f['h'] if k % 2 == 0 else list(reversed(f['h'])), zweige=f['z'], dick=f['d'], halten=_HALTEN[k % len(_HALTEN)], tempo=1 if len(f['h']) >= 6 else 2,
            stufen=4, stufe_frames=3) for k, f in enumerate(_SITES)]
_st = E.plane_starts([E.BleichRiss(start=0, **kw).leben for kw in _kw], N, basis=1, seed=3)
RISSE = [E.BleichRiss(start=s, **kw) for s, kw in zip(_st, _kw)]
E.pruefe_risse(RISSE, N, ERLAUBT)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.bleich_risse(REF, i, N, RISSE, DUNKEL, TOENE, PAD, PAD, gueltig=OPAK)


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
