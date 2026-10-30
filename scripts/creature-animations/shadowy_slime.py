# -*- coding: utf-8 -*-
"""Idle-Animation für „Shadowy Slime“ (Creature).

PICK: [["Motive", 553, 1]]   Ebene „Darky Slime“ (Motive.xcf, Ebene 553, 15×13 px, 14 Farben, nur Alpha 0/255) → src/shadowy-slime.png (ganzes Sprite).
Nicht verwendet: die zwei halbtransparenten Pfützen-Ebenen darunter (551/552, Ebenendeckkraft 50 %, nicht pixelgenau mischbar — wie beim Slimy Slime bleiben sie unberührt), der violette Boden
und die Nachbarschleime der Karte (Ebene 550 Sparky Slime, Ebene 554 Infinitely Reproducing Slime).

Aufruf:   python3 shadowy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shadowy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 15×13, x/y ab 0):
* Ein nachtvioletter Schleim mit sehr dunklem Umriss A=(10,0,41)/B=(18,1,43), oben zwei gerundete „Ohren“-Wülste (x 1–5 und x 8–12, y 0–4) mit hellen Lichtpunkten K=(165,84,212) bei (3, 1) und
  (10, 1), dazwischen ein hellviolettes „V“ (C=(143,41,203), D=(113,6,182)) bei (4–10, 2–7), darunter der Körper (Zeilen 7–12) in dunklem Violett (E, F, G, I, J, M) mit zwei helleren
  Lichtpunkten N=(139,75,171) bei (4, 9) und (9, 9); unten ausgefranste Füße (Zeile 12).
* Augen sind im Sprite nicht eindeutig zu erkennen — deshalb gibt es keine Augeneffekte (kein Blinzeln, kein Blick).
* Material: Schleim (Gel) — kein Metall/Gold/Edelstein: KEIN Glanz (Regel 14); kein Flammenfeuer (Regel 15 trifft nicht zu).
Fest bleiben: Umriss, Kopfform samt Ohren und „V“ (die Kopfzeilen werden nie gegeneinander versetzt), Lichtpunkte der Ohren.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 2–10 und 26–34) wird Körperzeile 10 (Frames 4–8 zusätzlich Zeile 8, das dunkle Band) verdoppelt, der Schleim wird 1–2 px höher;
  beim Stauchen (Frames 15–21 und 39–45) wird er je Zeile 1 Spalte je Seite breiter (die Spalte neben dem Umriss wird verdoppelt, nie der Umriss). Die Unterkante sitzt fest am Boden. Frame 0 = Original.
* Lichtpunkte im Körper: beim Strecken (im Takt der Atmung) wandern die beiden hellen Punkte (4, 9) und (9, 9) 1 px nach innen — (4, 9) → (5, 9) und (9, 9) → (8, 9) — und beim Entspannen zurück
  (Tausch mit dem Nachbarpixel, keine neue Farbe).
* Schattendunst (Partikel): acht kleine runde Violett-Punkte (Formen k/s) steigen links und rechts vom Schleim langsam auf (24 Frames Lebenszeit).
Ergänzungen: keine (der Umriss wird nie verändert; beim Verdoppeln bleibt jede Randstufe ≤ 1 px).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken + Dunst), 2 px unten — Figur zentriert; Dunst liegt in der 2-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('shadowy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
LICHT_K = (165, 84, 212)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


def _lum(c):
    return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


# ── Spaltenpaare je Zeile: je ein Pixel neben dem Umriss (nie der Umriss selbst, kein Lichtpunkt) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    links = [x for x in (l + 2, l + 1, l + 3, l + 4) if OPAK[y, x] and _lum(_col(y, x)) > 20 and x < r - 3 and _col(y, x) != LICHT_K]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4) if OPAK[y, x] and _lum(_col(y, x)) > 20 and x > l + 3 and _col(y, x) != LICHT_K]
    PAARE_ZEILE[y] = [(links[0] if links else l + 2, rechts[0] if rechts else r - 2)]
    if PAARE_ZEILE[y][0][0] >= PAARE_ZEILE[y][0][1]:
        PAARE_ZEILE[y] = [(l + 1, r - 1)]

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.35 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ({}, 1), 0: ({}, 0), 1: ({10: 1}, 0), 2: ({8: 1, 10: 1}, 0)}               # s → (Zeilen verdoppeln, Spalten p je Seite)
assert S[0] == 0
LICHTPUNKTE = (((9, 4), (9, 5)), ((9, 9), (9, 8)))                                       # ((y, x) Punkt, (y, x) Nachbar nach innen)
for (_a, _b) in LICHTPUNKTE:
    assert _col(*_a) == (139, 75, 171)

DUNST = {'c': (113, 6, 182), 'r': (89, 19, 130)}
for _c in DUNST.values():
    assert _c in _farben, _c
PUFFS = [
    dict(x=PAD_L + 1, y=PAD_T + 9, vx=-1, vy=-6, off=0, form='s', wackeln=0),
    dict(x=PAD_L + 13, y=PAD_T + 9, vx=1, vy=-6, off=3, form='k', wackeln=0),
    dict(x=PAD_L + 2, y=PAD_T + 7, vx=-1, vy=-6, off=6, form='k', wackeln=0),
    dict(x=PAD_L + 12, y=PAD_T + 7, vx=1, vy=-6, off=9, form='s', wackeln=0),
    dict(x=PAD_L + 1, y=PAD_T + 11, vx=-1, vy=-5, off=12, form='k', wackeln=0),
    dict(x=PAD_L + 13, y=PAD_T + 11, vx=1, vy=-5, off=15, form='k', wackeln=0),
    dict(x=PAD_L + 3, y=PAD_T + 4, vx=-1, vy=-5, off=18, form='k', wackeln=0),
    dict(x=PAD_L + 11, y=PAD_T + 4, vx=1, vy=-5, off=21, form='k', wackeln=0),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    if S[i] >= 1:                                                                    # Lichtpunkte wandern beim Strecken 1 px nach innen (Tausch mit dem Nachbarpixel)
        for (a, b) in LICHTPUNKTE:
            ca, cb = sp[a[0], a[1], :3].copy(), sp[b[0], b[1], :3].copy()
            sp[a[0], a[1], :3], sp[b[0], b[1], :3] = cb, ca
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    doppeln, p = POSEN[S[i]]
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    return dict(fig=fig, top=top)


def frame(i):
    f = figur(i)
    dunst = L.puff_ebene(H, W, i, 24, PUFFS, DUNST)
    return L.zusammen(H, W, [(dunst, 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Paare:', PAARE_ZEILE)
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, 'shadowy-slime')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('shadowy-slime', 'Shadowy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/shadowy-slime-strip.png', frames[::2], spalten=12, scale=8)
