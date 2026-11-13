# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Spikeblock“ („Iceblock“) (Creature) — der gleitende Eisblock mit Stacheln. Runde 4: vom Nutzer gelieferter Sprite, gleitet hin und her OHNE Spiegeln.

Nutzerkorrektur (wörtlich): „Für Spikeblock habe ich eine korrekte Version ohne Smear angehängt. Generell die Slipperies nicht spiegeln, sondern einfach hin und her sliden lassen.“

Quelle: src/slippery-spikeblock.png (26×23 px) = die vom Nutzer gelieferte Fassung ohne Speed Lines, unverändert bis auf binäres Alpha (16 Pixel mit Alpha 4–21 = Reste neben den
Nadeln entfernt, Alpha 247–254 → 255). Die frühere Nachzeichnung (--quelle-neu aus src/slippery-spikeblock-roh.png) entfällt.
PICK: [["Nutzer", "img6_spikeblock-korrekt.png", "ganzes Bild, Alpha binär"]]

Aufruf:   python3 slippery_spikeblock.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-spikeblock.png + .json

Was im Sprite ist (x, y im 26×23-Sprite):
* BLOCK: Deckfläche (y 3–6, perspektivisch) und Front (x 2–22, y 7–22) in Lavendelstufen mit vier dunklen Rautenmustern; rechte Seitenfläche (x 20–25) dunkler.
* STACHELN OBEN: Eisnadeln bei x = 5 (y 1–3), 9 (y 0–3), 12 (y 0–3), 16 (y 1–3), 20 (y 0–3). STACHELN SEITLICH: links x 0–1 und rechts x 24–25 in den Zeilen 7, 12, 17 (bleiben fest).
Material: Eis — KEIN Glanz (Regel 14).

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos):
* RUTSCHEN: der GANZE Block samt Nadeln gleitet ganzzahlig 0 → +6 px, Halt, +6 → −6 px, Halt, −6 → 0 (sanft anfahrend/bremsend). KEINE Spiegelung (Regel 47). Frame 0 = Original.
* Nadeln oben fahren aus und ein (Perioden 12/16, versetzt): Spitze ±1 px (Spitzenpixel in der Farbe der Nadel).
* Eisdunst (mit dem Block mitgeführt): 5 Wölkchen ≥ 2×2 (hellste Lavendelstufen) steigen links und rechts neben dem Block langsam auf (symmetrisch, weil nicht mehr gespiegelt wird).
* Entfallen: das frühere „Atmen“ per Zeileneinfügen (starrer Eisblock mit regelmäßigem Rautenmuster und Seitenstacheln – eine eingefügte Zeile würde das Muster verzerren, Regel 44).
"""
import math
import sys

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L
import anim_rutsch as R

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 17, 17, 6, 2          # Rutschweg ±6 px + Eisdunst neben dem Block
TEST_EBENEN = ('koerper',)

spr = L.lade('slippery-spikeblock')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)

NADELN = {5: 3, 9: 4, 12: 4, 16: 3, 20: 4}                 # Spalte → Länge (y 3 aufwärts)
for x, ln in NADELN.items():
    assert all(spr[y, x, 3] for y in range(4 - ln, 4)), x
    assert 3 - ln < 0 or not spr[3 - ln, x, 3]
PERIODE = {5: 12, 9: 16, 12: 12, 16: 16, 20: 12}
VERSATZ = {5: 0.6, 9: 1.2, 12: 2.4, 16: 3.6, 20: 4.8}

# hellste Lavendelstufen für den Dunst
_farben = {}
for p in spr.reshape(-1, 4):
    if p[3]:
        c = tuple(int(v) for v in p[:3]); _farben[c] = _farben.get(c, 0) + 1
_hell = sorted([c for c in _farben if sum(c) / 3 > 195], key=lambda c: -_farben[c])
KERN, RAND = _hell[0], _hell[1]


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    for x, ln in NADELN.items():
        d = int(round(1.0 * (math.sin(L.sinus(i, PERIODE[x], VERSATZ[x])) - math.sin(VERSATZ[x]))))   # 0 in Frame 0
        d = max(-1, min(1, d))
        top = 4 - ln
        if d > 0:
            Hm.setze(k, {(x, top - 1): tuple(int(v) for v in spr[top, x, :3])}, OFF)
        elif d < 0 and ln >= 3:
            Hm.setze(k, {(x, top): None}, OFF)
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=vy, off=o, form=f, wackeln=0.8, ph=p) for (x, y, vx, vy, o, f, p) in
         [(-2, 19, -4.0, -6.0, 0, 'm', 0.0), (25, 15, 4.0, -6.0, 10, 'o', 0.3), (-3, 12, -3.0, -5.0, 20, 'o', 0.6),
          (26, 20, 4.0, -5.0, 29, 'm', 0.1), (-1, 21, -5.0, -4.0, 39, 'm', 0.8)]]
DUNST_FARBEN = {'c': KERN, 'r': RAND}


# Rutschen ohne Spiegeln: 0 → +6, Halt, +6 → −6, Halt, −6 → 0
BAHN, _SPIEGEL = R.pfad(N, [('fahrt', 6, 13), ('halt', 2), ('fahrt', -6, 17), ('halt', 2), ('fahrt', 0, 14)])


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return R.verschieben(L.zusammen(H, W, ebenen), BAHN[i], False)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    print('Position je Frame:', BAHN)
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    L.speichern('slippery-spikeblock', 'Slippery Spikeblock', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slippery-spikeblock-strip.png', frames[::2], spalten=8, scale=6)
