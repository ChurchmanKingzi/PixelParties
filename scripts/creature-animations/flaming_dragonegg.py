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
Nutzerwunsch (Runde 4): „Bei den ganzen Eiern sollten die Risse verschwinden, indem sie ausbleichen, statt indem sie sich einfach zurückbilden. Und die Risse sollten größer, auch dicker, werden können.“
→ STAND RUNDE 4 (ersetzt die Rissbeschreibung oben): 11 Glutrisse, Hauptast 4–14 Pixel, die größeren mit 1–2 Seitenästen (2–4 Pixel) und 1–4 Stellen, an denen der Riss 2 px dick ist; weiter hell (Cremeweiß C, Astenden Gelb B),
  jetzt auf Fugen (A) UND roten Schuppenrändern (E). Sie wachsen Pixel für Pixel, stehen 4–8 Frames in voller Form und BLEICHEN dann AUS (= die Glut kühlt ab): alle Pixel bleiben stehen, die Farbe geht in 4 Stufen à 3 Frames
  über Gelb → Orange → Rot zur Farbe darunter, letzte Stufe Schachbrett-Dither (kein Alpha, kein Schrumpfen; nur Farben des Sprites).
Nutzerwunsch (Runde 5): „Bei den Eiern verschwinden die Risse noch zu schnell, nachdem sie erschienen sind.“
→ STAND RUNDE 5 (nur die Zeiten; Rissformen, Wachstum unverändert): Schleife 144 Frames à 75 ms = 10,8 s (vorher 72 = 5,4 s). Jeder Riss steht nach dem vollständigen Wachsen 20–28 Frames (1,5–2,1 s; vorher 4–8 Frames) in voller Stärke und bleicht erst dann aus,
  und zwar langsamer: 5 Stufen (4 Farbstufen + Schachbrett-Dither) à 5 Frames = 1,9 s (vorher à 3 Frames = 1,1 s). Gleich viele Risse wie bisher, über die längere Schleife verteilt (im Mittel nicht mehr gleichzeitig sichtbar als vorher).
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben, kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 144, 75
PAD = 3

spr = L.lade('flaming-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
CA, CB, CC = (48, 0, 0), (246, 231, 14), (247, 245, 184)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(c in _farben for c in (CA, CB, CC))
CD, CE = (244, 123, 34), (202, 44, 41)
ERLAUBT = E.sicher(spr, [CA, CE], sorted(_farben), rand_abstand=2)                      # helle Risse liegen auf dunklen Fugenpixeln (A) und roten Schuppenrändern (E), mindestens 2 Pixel vom Rand
TOENE = E.toene_rampe([CA, CE, CD, CB, CC])                                              # Ausbleichen = Abkühlen der Glut: Cremeweiß → Gelb → Orange → Rot → Dunkelbraun (alles Farben des Sprites)

# ── Risse (x, y im Sprite): h = Hauptast in Wachstumsrichtung, z = Seitenäste, d = Pixel, die den Riss dort 2 px dick machen — mit E.wachse_riss entworfen und festgeschrieben ──
_SITES = [
    dict(h=[(22, 23), (21, 23), (20, 24), (20, 25), (20, 26), (20, 27), (20, 28), (21, 29), (21, 30), (22, 31), (22, 32), (23, 33), (24, 33), (25, 34)], z=[[(19, 29), (19, 30), (18, 31)]], d=[(22, 29), (22, 30), (23, 31), (23, 32)]),
    dict(h=[(12, 23), (11, 24), (11, 25), (10, 26), (9, 27), (8, 27), (7, 27), (6, 26), (5, 25), (5, 24), (6, 23)], z=[[(11, 27), (11, 28), (12, 29), (12, 30)], [(8, 28), (7, 29), (7, 30)]], d=[(8, 26), (7, 26), (6, 25), (4, 25)]),
    dict(h=[(16, 5), (16, 6), (17, 7), (18, 8), (19, 9), (19, 10), (19, 11), (19, 12), (18, 13), (17, 13), (16, 13), (15, 13), (14, 14)], z=[[(20, 11), (21, 12), (22, 11)]], d=[(17, 6), (18, 7), (19, 8)]),
    dict(h=[(26, 11), (25, 12), (25, 13), (24, 14), (24, 15), (24, 16), (23, 17), (22, 18), (21, 18)], z=[[(25, 16), (26, 16), (27, 17)]], d=[(25, 11), (26, 12)]),
    dict(h=[(27, 22), (28, 23), (29, 24), (29, 25), (28, 26), (28, 27), (27, 28), (26, 29), (27, 30)], z=[[(26, 27), (25, 27), (24, 26)]], d=[(28, 24), (29, 26)]),
    dict(h=[(6, 16), (7, 16), (8, 17), (9, 18), (9, 19), (10, 20), (11, 20)], z=[[(7, 15), (6, 14), (6, 13)]], d=[(9, 17), (10, 18)]),
    dict(h=[(11, 10), (12, 9), (12, 8), (12, 7), (13, 6), (13, 5), (13, 4)], z=[[(13, 9), (14, 9)]], d=[(12, 6)]),
    dict(h=[(17, 37), (17, 36), (18, 35), (19, 35)], z=[], d=[]),
    dict(h=[(14, 33), (14, 34), (13, 35), (12, 36)], z=[], d=[]),
    dict(h=[(17, 22), (16, 21), (15, 20), (16, 19)], z=[], d=[(16, 20)]),
    dict(h=[(16, 28), (15, 27), (15, 26), (16, 25)], z=[], d=[]),
]
_HALTEN = [20, 26, 22, 28, 21, 25, 23, 27]                                                # Frames in voller Stärke: 1,5–2,1 s (Runde 5)
_kw = [dict(haupt=f['h'], zweige=f['z'], dick=f['d'], halten=_HALTEN[k % len(_HALTEN)], tempo=1 if len(f['h']) >= 6 else 2,
            stufen=4, stufe_frames=5, farbe=CC, spitze=CB) for k, f in enumerate(_SITES)]
_st = E.plane_starts([E.BleichRiss(start=0, **kw).leben for kw in _kw], N, basis=1, seed=5)
RISSE = [E.BleichRiss(start=s, **kw) for s, kw in zip(_st, _kw)]
E.pruefe_risse(RISSE, N, ERLAUBT)

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.bleich_risse(REF, i, N, RISSE, CC, TOENE, PAD, PAD, gueltig=OPAK)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    z = E.zaehle(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab |', len(RISSE), 'Risse | gleichzeitig höchstens', z['max'], ', Mittel', z['mittel'], '| Frames ohne Riss:', z['leer'])
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('flaming-dragonegg', 'Flaming Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/flaming-dragonegg-strip.png', frames[::6], spalten=12, scale=6)
