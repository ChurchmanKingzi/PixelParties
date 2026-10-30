# -*- coding: utf-8 -*-
"""Idle-Animation für „Sandy Blob“ (Creature).

PICK: [["MotiveEgypt", 57, 1]]   Ebene „Ebene #133“ (MotiveEgypt.xcf, Ebene 57, 18×17 px, nur Alpha 0/255) → src/sandy-blob.png (77 Farben: ein Sandklumpen mit
vielen eng benachbarten Sandtönen; beim Randtest zählt nur der braune Umriss). Nicht verwendet: der Sandboden, der Kugelkaktus und die Wüstenwellen der Karte.

Aufruf:   python3 sandy_blob.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sandy-blob.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×17, x/y ab 0):
* Körper: ein runder Sandklumpen (Zeilen 0–16) mit braunem Umriss A=(125,99,45)/D=(120,97,43) (am Rand immer nur diese zwei Farben) und gemustertem Sand in rund 70 Gelb-/Braun-Tönen.
* Augen: zwei schwarze Pixel bei (6, 3) und (11, 3), je mit einer weißen Ecke bei (5, 2) und (12, 2).
* Maul (x 5–12, y 5–12): weit aufgerissener, dunkelroter Rachen (Lippen (91,21,23), Innenraum (31,7,8)/(13,3,3)) mit sechs weißen Reißzähnen (255,255,255): oben (7, 5), (10, 5),
  an den Seiten (6–7, 6–7) und (10–11, 6–7), unten (7, 12), (10, 12) usw.
* Material: Sand — kein Metall/Gold/Edelstein: KEIN Glanz, keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15 trifft nicht zu).
Fest bleiben: Umrissfarben, Zahnform, Augenform.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 2–10 und 26–34) werden Körperzeile 8 (mitten im Rachen, ohne Zahn) und Zeile 13 (unten) verdoppelt — der Rachen
  öffnet sich um 1–2 px weiter, der Kopf wächst nach oben; beim Stauchen (Frames 15–21 und 39–45) wird der Klumpen je Zeile 1 Spalte je Seite breiter (die Spalte neben dem Umriss wird
  verdoppelt, nie der Umriss, nie Augen/Zähne). Der Klumpen sitzt am Boden (Unterkante fest). Die Augen sitzen oberhalb der verdoppelten Zeilen und bleiben starr.
* Blinzeln: beide Augen (Frames 15–16 und 39–40, das rechte einen Frame später): das schwarze Pixel wird für 2 Frames zur umgebenden Sandfarbe (je Pixel die häufigste Sandstufe im
  2-px-Umkreis außerhalb der Augen), die weißen Ecken bleiben. Blick: die beiden Pupillen rutschen gemeinsam 1 px nach rechts (Frames 6–10) bzw. links (28–32).
* Sandkörner (Partikel): acht kleine runde Sandpunkte (Formen k/s, Farben des Sprites) rieseln vom Rand des Klumpens 3–6 px nach unten/außen und verschwinden vor dem Boden.
Ergänzungen: keine (der Umriss wird nie verändert; beim Verdoppeln bleibt jede Randstufe ≤ 1 px).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken), 3 px unten (Sandkörner) — Figur zentriert; Körner liegen in der 2–3-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 3

spr = L.lade('sandy-blob')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
UMRISS = {(125, 99, 45), (120, 97, 43)}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


def _klasse(c):
    r, g, b = c
    if r >= 250 and g >= 250 and b >= 250:
        return 'w'
    if r < 30 and g < 30 and b < 30:
        return 'k'
    if r < 110 and g < 40:
        return 'r'
    if c in UMRISS:
        return 'o'
    return 's'


KL = np.full((sh, sw), '.', dtype='<U1')
for _y in range(sh):
    for _x in range(sw):
        if OPAK[_y, _x]:
            KL[_y, _x] = _klasse(_col(_y, _x))
assert set(_col(y, x) for y, x in zip(*np.nonzero(RAND0))) <= UMRISS, 'Randfarben'

# ── Augen ──
AUGEN = [(3, 6), (3, 11)]                                                            # (y, x) der schwarzen Pupillen
for (y, x) in AUGEN:
    assert KL[y, x] == 'k'
LID = {}
for (y, x) in AUGEN:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in AUGEN or not (0 <= q[0] < sh and 0 <= q[1] < sw) or KL[q] != 's':
                continue
            c = _col(*q)
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Spaltenpaare je Zeile: reine Sandpixel neben dem Umriss (nie Umriss, Augen, Zähne, Rachen) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    if r - l < 5:
        PAARE_ZEILE[y] = [(l + 1, r - 1)]
        continue
    links = [x for x in (l + 2, l + 1, l + 3, l + 4) if KL[y, x] == 's' and x < r - 3]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4) if KL[y, x] == 's' and x > l + 3]
    if not links or not rechts:                                                      # reine Umrisszeilen (Zeile 0, 16): beliebige Spalten im Inneren
        links, rechts = [l + 2], [r - 2]
    PAARE_ZEILE[y] = [(links[0], rechts[0])]
    assert PAARE_ZEILE[y][0][0] < PAARE_ZEILE[y][0][1]

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.35 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ({}, 1), 0: ({}, 0), 1: ({8: 1}, 0), 2: ({8: 1, 13: 1}, 0)}               # s → (Zeilen verdoppeln {Zeile: Kopien}, Spalten p je Seite)
BLINZELN_L = {15, 16, 39, 40}
BLINZELN_R = {16, 17, 40, 41}
BLICK = {i: 1 for i in range(6, 11)}
BLICK.update({i: -1 for i in range(28, 33)})
assert S[0] == 0 and 0 not in BLICK

KORN_FARBEN = {'c': (215, 192, 116), 'r': (177, 157, 85)}
for _c in KORN_FARBEN.values():
    assert _c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, _c
PUFFS = [
    dict(x=PAD_L + 1, y=PAD_T + 8, vx=-2, vy=5, off=0, form='k', wackeln=0),
    dict(x=PAD_L + 16, y=PAD_T + 9, vx=2, vy=5, off=3, form='k', wackeln=0),
    dict(x=PAD_L + 1, y=PAD_T + 11, vx=-1, vy=4, off=6, form='s', wackeln=0),
    dict(x=PAD_L + 16, y=PAD_T + 11, vx=1, vy=4, off=9, form='s', wackeln=0),
    dict(x=PAD_L + 2, y=PAD_T + 6, vx=-1, vy=6, off=12, form='k', wackeln=0),
    dict(x=PAD_L + 15, y=PAD_T + 7, vx=1, vy=6, off=15, form='k', wackeln=0),
    dict(x=PAD_L + 1, y=PAD_T + 13, vx=-2, vy=3, off=18, form='k', wackeln=0),
    dict(x=PAD_L + 16, y=PAD_T + 13, vx=2, vy=3, off=21, form='k', wackeln=0),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    b_l, b_r = i in BLINZELN_L, i in BLINZELN_R
    blick = BLICK.get(i, 0)
    for k, (y, x) in enumerate(AUGEN):
        if (b_l, b_r)[k]:
            sp[y, x, :3] = LID[(y, x)]
        elif blick:
            nx = x + blick
            if 0 <= nx < sw and KL[y, nx] == 's' and (y, nx) not in AUGEN:
                sp[y, x, :3] = LID[(y, x)]
                sp[y, nx, :3] = (0, 0, 0)
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    doppeln, p = POSEN[S[i]]
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=doppeln, p=p, paare_je_zeile={k: v for k, v in PAARE_ZEILE.items()}, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    return dict(fig=fig, top=top)


def frame(i):
    f = figur(i)
    koerner = L.puff_ebene(H, W, i, 24, PUFFS, KORN_FARBEN)
    return L.zusammen(H, W, [(koerner, 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Augen:', AUGEN, '| Lidfarben:', sorted(set(LID.values())), '| Farben im Sprite:', len({_col(y, x) for y in range(sh) for x in range(sw) if OPAK[y, x]}))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'sandy-blob')
    print('Frames mit Befund (Teile ≠ 1 oder offene Randpixel):', [(k, n_) for (k, n_, offen) in schlecht])
    L.speichern('sandy-blob', 'Sandy Blob', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sandy-blob-strip.png', frames[::2], spalten=12, scale=8)
