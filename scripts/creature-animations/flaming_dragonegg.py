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

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos):
* Risse: acht kleine Risse aus je 3 Pixeln (hier 3 statt 2, weil sie im kleinteiligen Raster sonst untergehen) erscheinen zeitversetzt an acht verschiedenen Stellen des Eis (alle 6 Frames einer, 1–3 gleichzeitig): erst 1 Pixel, dann 2, dann 3 Pixel, steht kurz, schrumpft wieder und verschwindet
  (Verlauf 1-1-2-2-3-3-3-3-2-2-1-1, 12 Frames = 0,9 s). ABWEICHUNG von den anderen Eiern: das Schuppenraster dieses Eis ist selbst schon dunkelbraun (A) und kleinteilig — ein dunkler Riss ginge darin unter (am Bild geprüft). Deshalb sind die Risse
  hier HELL: das Glühen aus dem Inneren des Feuereis — die ersten Pixel Cremeweiß C, das letzte Gelb B (auslaufende Spitze); sie liegen auf dunkelbraunen Fugenpixeln (A), die mindestens 2 Pixel vom Rand entfernt in dunklen Gruppen liegen. Frame 0 = Original (rissfrei).
  (Möchte der Nutzer dunkle Risse, steht `HELL_RISSE = False` bereit — sie liegen dann auf hellen Schuppen, sind aber im Raster kaum zu sehen.)
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben, kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 60, 75
PAD = 3

spr = L.lade('flaming-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
HELL_RISSE = True
CA, CB, CC = (48, 0, 0), (246, 231, 14), (247, 245, 184)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(c in _farben for c in (CA, CB, CC))


def _maske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & OPAK


# ── Risse (x, y im Sprite; Pixel 1 zuerst, dann 2) ──
if HELL_RISSE:
    _SITES = [[(23, 21), (23, 22), (23, 23)], [(12, 5), (12, 6), (12, 7)], [(8, 32), (9, 33), (9, 34)], [(2, 20), (2, 21), (3, 22)],
              [(22, 34), (22, 35), (21, 36)], [(25, 9), (25, 10), (25, 11)], [(7, 12), (6, 13), (6, 14)], [(11, 24), (12, 25), (11, 26)]]
    _ok = _maske(CA)                                                                     # helle Risse liegen auf dunklen Fugenpixeln
    _farbe, _spitze = CC, CB
else:
    _SITES = [[(18, 21), (19, 22)], [(8, 10), (8, 11)], [(4, 27), (4, 28)], [(23, 8), (22, 9)],
              [(16, 34), (16, 35)], [(28, 14), (28, 15)], [(26, 24), (26, 25)], [(7, 20), (6, 21)]]
    _ok = _maske(CB, CC)                                                                 # dunkle Risse liegen auf hellen Schuppen
    _farbe, _spitze = CA, None
_ORDER = [0, 4, 2, 6, 1, 5, 3, 7]
RISSE = [E.Riss(_SITES[j], start=2 + 6 * k, farbe=_farbe, spitze=_spitze, profil=E.PROFIL3 if HELL_RISSE else E.PROFIL) for k, j in enumerate(_ORDER)]
_rand = np.zeros((sh, sw), bool)
for _y in range(sh):
    for _x in range(sw):
        if OPAK[_y, _x] and not OPAK[max(_y - 2, 0):_y + 3, max(_x - 2, 0):_x + 3].all():
            _rand[_y, _x] = True
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert _ok[_y, _x] and not _rand[_y, _x], (_x, _y)
assert all(r.stufe(0, N) == 0 for r in RISSE) and E.gleichzeitig(RISSE, N)[0] <= 3

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, _farbe, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    mx, leer = E.gleichzeitig(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab | höchstens', mx, 'Risse gleichzeitig | Frames ohne Riss:', leer)
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('flaming-dragonegg', 'Flaming Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/flaming-dragonegg-strip.png', frames[::3], spalten=10, scale=6)
