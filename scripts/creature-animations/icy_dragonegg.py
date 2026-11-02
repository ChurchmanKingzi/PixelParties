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

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos):
* Risse: acht kleine Risse aus je 3 Pixeln (das Ei ist mit 34×41 px groß; 2 Pixel gingen im Schuppenraster unter) in der dunkelsten Eifarbe D=(25,20,37) (diagonal bzw. senkrecht gezackt) erscheinen zeitversetzt an acht verschiedenen Stellen des Eis (alle 6 Frames einer, 1–3 gleichzeitig):
  erst 1, dann 2, dann 3 Pixel, steht kurz, schrumpft wieder und verschwindet (Verlauf 1-1-2-2-3-3-3-3-2-2-1-1, 12 Frames = 0,9 s). Sie liegen nur auf hellen Schuppenpixeln (F, G, L, N, P, Q, I), mindestens 2 Pixel vom Rand. Frame 0 = Original (rissfrei).
Ergänzungen: keine. Nur ganze Pixel, nur Quellfarben, kein Alpha.
Frame: Sprite plus 3 px Rand rundum — Figur zentriert.
"""
import sys

import numpy as np

import anim_lib as L
import anim_eier as E

N, MS = 60, 75
PAD = 3

spr = L.lade('icy-dragonegg')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
OPAK = spr[..., 3] > 0
DUNKEL = (25, 20, 37)
HELL = [(110, 177, 203), (153, 200, 218), (144, 198, 208), (177, 214, 222), (200, 234, 237), (177, 226, 230), (114, 164, 202)]
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert DUNKEL in _farben and all(c in _farben for c in HELL)

# ── Risse (x, y im Sprite; Pixel 1 zuerst, dann 2) — Reihenfolge der Starts so, dass benachbarte Risse nie gleichzeitig laufen ──
_SITES = [[(16, 18), (15, 19), (16, 20)], [(25, 22), (24, 23), (25, 24)], [(12, 5), (12, 6), (13, 7)], [(15, 25), (16, 26), (17, 27)],
          [(28, 18), (28, 19), (28, 20)], [(11, 14), (12, 15), (13, 16)], [(22, 10), (21, 11), (22, 12)], [(25, 14), (26, 15), (25, 16)]]
RISSE = [E.Riss(p, start=2 + 6 * k, profil=E.PROFIL3) for k, p in enumerate(_SITES)]
_hm = np.zeros((sh, sw), bool)
for _c in HELL:
    _hm |= (spr[..., :3] == np.array(_c)).all(axis=2)
_rand = np.zeros((sh, sw), bool)
for _y in range(sh):
    for _x in range(sw):
        if OPAK[_y, _x] and not OPAK[max(_y - 2, 0):_y + 3, max(_x - 2, 0):_x + 3].all():
            _rand[_y, _x] = True
for _r in RISSE:
    for (_x, _y) in _r.pix:
        assert _hm[_y, _x] and not _rand[_y, _x], (_x, _y)
assert all(r.stufe(0, N) == 0 for r in RISSE) and E.gleichzeitig(RISSE, N)[0] <= 3

REF = L.platz(spr, H, W, PAD, PAD)


def frame(i):
    return E.auf_figur(REF, E.risse_ebene(H, W, i, N, RISSE, DUNKEL, PAD, PAD, gueltig=OPAK))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    mx, leer = E.gleichzeitig(RISSE, N)
    print('Frame 0 weicht vom Original in', int((frames[0] != REF).any(axis=2).sum()), 'Pixeln ab | höchstens', mx, 'Risse gleichzeitig | Frames ohne Riss:', leer)
    print('Pixel, die sich je Frame vom Original unterscheiden:', [int((f != REF).any(axis=2).sum()) for f in frames])
    n = L.pruefe(frames, quelle=spr)
    L.speichern('icy-dragonegg', 'Icy Dragonegg', frames, MS, prev)
    if prev:
        L.streifen(prev + '/icy-dragonegg-strip.png', frames[::3], spalten=10, scale=6)
