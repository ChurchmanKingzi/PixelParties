# -*- coding: utf-8 -*-
"""Idle-Animation für „Infinitely Reproducing Slime“ (Creature).

PICK: [["Motive", 554, 4]]   Ebene „Infinitely Reproducing Slime“ (Motive.xcf, Ebene 554; die Ebene zeigt vier Schleime in verschiedenen Zuständen — Figur 4 = der glockenförmige Schleim unten links der
Karte, 17×16 px, 8 Farben, nur Alpha 0/255) → src/infinitely-reproducing-slime.png. Nicht verwendet: die anderen drei Schleime der Ebene (hoher Schleim oben, runder Schleim rechts, „M“-förmiger
Schleim in der Mitte — der ist der Shadowy Slime) samt ihren halbtransparenten Pfützen (Alpha 102, nicht pixelgenau mischbar, wie beim Slimy Slime).

Aufruf:   python3 infinitely_reproducing_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/infinitely-reproducing-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 17×16, x/y ab 0):
* Ein violetter Glockenschleim: Kuppel (Zeilen 0–8, x 1–12) mit dunklem Umriss A=(31,9,74) (am Rand nur diese Farbe), Violettstufen B=(64,20,153), C=(87,27,208), D=(106,46,227), E=(44,14,105),
  F=(125,73,230), hellen Glanzlichtern G=(165,129,238), H=(154,113,236) oben links bei (3–5, 1–3) und am Fuß; unten breitet sich der Schleim als Fuß nach rechts aus (Zeilen 9–13, bis x 16).
* Keine Augen im Sprite (kein Blinzeln). Material: Gel — kein Metall/Gold/Edelstein: KEIN Glanz und keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15).
Fest bleiben: Umriss, Kuppelform, Fußform, Lichter (sie wandern nur mit dem Gel).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 2–10 und 26–34 eine Körperzeile 6 mehr, in der Spitze 4–8 und 28–32 zusätzlich Zeile 7) wird der Schleim 1–2 px höher; beim Stauchen (Frames 15–21
  und 39–45) wird er je Zeile 1 Spalte je Seite breiter (die Spalte neben dem Umriss wird verdoppelt, nie der Umriss). Die Unterkante sitzt fest am Boden.
* Schleimperlen (Partikel): zwei runde Wölkchen (2×2 → 4×4 → 2×2, nie einzelne Punkte; Farben D und C des Sprites, immer nur eines sichtbar groß) quellen aus dem Schleim und steigen 8 px in der freien oberen rechten Ecke des Sprite-Rechtecks
  langsam auf — der Schleim „vermehrt“ sich in kleinen Perlen.
Ergänzungen: keine (der Umriss wird nie verändert; beim Verdoppeln bleibt jede Randstufe ≤ 1 px).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken), 2 px unten — Figur zentriert; die Perlen liegen innerhalb des Sprite-Rechtecks (keine zusätzliche Frame-Vergrößerung).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('infinitely-reproducing-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
UMRISS = (31, 9, 74)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
PERLEN_FARBEN = {'c': (87, 27, 208), 'r': (106, 46, 227)}
for _c in PERLEN_FARBEN.values():
    assert _c in _farben, _c
assert {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(RAND0))} == {UMRISS}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Spaltenpaare je Zeile: je ein Pixel neben dem Umriss (nie der Umriss, nie ein Glanzlicht G/H) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    ok = lambda x: OPAK[y, x] and _col(y, x) not in (UMRISS, (165, 129, 238), (154, 113, 236))
    links = [x for x in (l + 2, l + 1, l + 3, l + 4) if ok(x) and x < r - 3]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4) if ok(x) and x > l + 3]
    PAARE_ZEILE[y] = [(links[0] if links else l + 1, rechts[0] if rechts else r - 1)]
    if PAARE_ZEILE[y][0][0] >= PAARE_ZEILE[y][0][1]:
        PAARE_ZEILE[y] = [(l + 1, r - 1)]

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.3 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ({}, 1), 0: ({}, 0), 1: ({6: 1}, 0), 2: ({6: 1, 7: 1}, 0)}                 # s → (Zeilen verdoppeln, Spalten p je Seite)
assert S[0] == 0

# ── Perlen (nur 2×2 / 4×4) in der freien Ecke oben rechts im Sprite-Rechteck (x 13–16, y 0–8) ──
PERLEN = [
    dict(x=15, y=9, vx=0, vy=-8, off=0), dict(x=14, y=9, vx=1, vy=-8, off=12),
]


def perlen_ebene(i):
    e = L.leer(H, W)
    for w in PERLEN:
        t = ((i + w['off']) % 24) / 24.0
        if t > 0.92:
            continue
        form = 's' if (t < 0.25 or t > 0.7) else 'o'
        cx = PAD_L + w['x'] + int(round(w['vx'] * t))
        cy = PAD_T + w['y'] + int(round(w['vy'] * t))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Perle bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = PERLEN_FARBEN[k]
            e[Y, X, 3] = 255
    return e


def figur(i):
    doppeln, p = POSEN[S[i]]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    return dict(fig=fig, top=top)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(perlen_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Paare:', PAARE_ZEILE)
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'infinitely-reproducing-slime')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('infinitely-reproducing-slime', 'Infinitely Reproducing Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/infinitely-reproducing-slime-strip.png', frames[::2], spalten=12, scale=8)
