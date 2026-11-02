# -*- coding: utf-8 -*-
"""Idle-Animation für „Shadowy Slime“ (Creature) — Runde 2: mit der unteren Körperhälfte.

PICK: [["Motive", 553, 1], ["Motive", 552, 0]]
  Ebene „Darky Slime“ (Motive.xcf, Ebene 553, 15×13 px, Kopf + Oberkörper, voll deckend) UND die Ebene „Ebene #497“ (Ebene 552, 18×5 px, bbox (369,159)): das ist die UNTERE KÖRPERHÄLFTE
  (der breite, ausgefranste Schleimsockel). Sie liegt in der xcf auf einer eigenen Ebene mit Deckkraft 50 % (deshalb erscheint sie auf der Karte halbtransparent). Für die Animation wird sie
  voll deckend (Alpha 255) mit 553 zu EINER Figur vereinigt (Nutzerwunsch, Regel 22) → src/shadowy-slime.png (18×17 px, 16 Farben); gebaut mit anim_slime.py (`python3 anim_slime.py shadowy-slime`).
  Die Zeile y=159 liegt in beiden Ebenen und ergänzt sich schachbrettartig (553: x 372/373/376/378–380/383/385, 552: x 370/371/374/375/377/381/382/384) — zusammen eine geschlossene Zeile.
  Nicht verwendet: die halbtransparente Pfütze der Nachbarschleime (Ebene 551 gehört zum Infinitely Reproducing Slime), der violette Boden, die Nachbarschleime (550 Sparky, 554 Infinitely Reproducing).

Aufruf:   python3 shadowy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/shadowy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×17, x/y ab 0):
* Ein nachtvioletter Schleim mit sehr dunklem Umriss A=(10,0,41)/B=(18,1,43), oben zwei gerundete „Ohren“-Wülste (x 3–7 und x 10–14, y 0–4) mit hellen Lichtpunkten L=(165,84,212) bei (5, 1) und
  (12, 1) (Augenglanz), dazwischen ein hellviolettes „V“ (E=(143,41,203), F=(113,6,182)) bei (6–12, 2–7), darunter (Zeilen 8–11) der Oberkörper in dunklem Violett mit zwei helleren
  Lichtpunkten O=(139,75,171) bei (6, 9) und (11, 9); darunter (Zeilen 12–16) die untere Körperhälfte: ein breiter, nach unten ausladender Sockel (Zeile 13 ist die breiteste, x 0–17) mit
  dunkler Mulde in der Mitte (D/H) und unten ausgefranstem Rand (Zeile 15 mit helleren Stücken, Zeile 16 = Bodenumriss x 7–13).
* Zwei einzelne durchsichtige Pixel (6, 2) und (11, 2) zwischen Ohren und „V“ sind Lücken der Originalebene (die Kunst zeigt dort den Hintergrund) und bleiben unverändert.
* Augen sind im Sprite nicht eindeutig zu erkennen (zwei große dunkle Flächen, die wie Augenhöhlen aussehen könnten) — deshalb gibt es keine Augeneffekte (kein Blinzeln, kein Blick).
* Material: Schleim (Gel) — kein Metall/Gold/Edelstein: KEIN Glanz (Regel 14); kein Flammenfeuer (Regel 15 trifft nicht zu).
Fest bleiben: Umriss, Ohren, „V“ (die Kopfzeilen werden nie gegeneinander versetzt), Lichtpunkte der Ohren, Bodenumriss (Zeile 16: nur sein Umriss, die Unterkante sitzt am Boden).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 2–10 und 26–34) wird Körperzeile 10 (Frames 4–8 zusätzlich Zeile 8, das dunkle Band) verdoppelt (mit Texturmischung der
  Nachbarzeile, keine 1:1-Kopie), der Schleim wird 1–2 px höher; beim Stauchen (Frames 15–21 und 39–45) wird er je Zeile 1 Spalte je Seite breiter (am Körper die Spalte neben dem Umriss, im Kopf
  (Zeilen 2–6) zwei Spalten mitten im „V“ — nie der Umriss). Die Unterkante sitzt fest am Boden. Frame 0 = Original.
* Sockel wabbelt (Periode 16, 3 Zyklen je Schleife): die Sockelzeilen 13–15 schwanken um bis zu ±1 (Zeile 15: ±2) px seitlich (die unteren Zeilen kräftiger als die oberen, Gefälle ≤ 1 px je Zeile).
* Lichtpunkte im Körper: beim Strecken wandern die beiden hellen Punkte (6, 9) und (11, 9) 1 px nach innen und beim Entspannen zurück (Tausch mit dem Nachbarpixel, keine neue Farbe).
* Schattendunst (Partikel): kleine runde Violett-Punkte (Formen k/s) steigen links und rechts vom Schleim langsam auf (24 Frames Lebenszeit).
Ergänzungen: wo ein Randpixel durch Verbreitern/Wabbeln ohne Umriss frei liegt, bekommen die leeren Nachbarfelder den Umriss A=(10,0,41) (umriss_ergaenzen, Regel 16).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken + Dunst), 2 px unten — Figur zentriert. Alle Bewegungen laufen auf der vollen Leinwand. Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 5, 2

spr = L.lade('shadowy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (10, 0, 41)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
LICHT_K = (165, 84, 212)
TEST_EBENEN = ('fig',)


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

# Kopfzeilen 2–6: die Spalten werden in der Mitte (am „V“) verdoppelt statt am Rand, damit die Ohrränder und die dunklen Flächen beim Stauchen nicht dicker werden
for _y, _pr in ((2, (8, 9)), (3, (8, 9)), (4, (8, 9)), (5, (8, 10)), (6, (8, 9))):
    PAARE_ZEILE[_y] = [_pr]
    assert OPAK[_y, _pr[0]] and OPAK[_y, _pr[1]]

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.35 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ({}, 1), 0: ({}, 0), 1: ({10: 1}, 0), 2: ({8: 1, 10: 1}, 0)}               # s → (Zeilen verdoppeln, Spalten p je Seite)
assert S[0] == 0
LICHTPUNKTE = (((9, 6), (9, 7)), ((9, 11), (9, 10)))                                     # ((y, x) Punkt, (y, x) Nachbar nach innen)
for (_a, _b) in LICHTPUNKTE:
    assert _col(*_a) == (139, 75, 171)

SOCKEL0, SOCKEL1 = 12, 15                                                                  # Quellzeilen des wabbelnden Sockels
WABBEL_GEW = {12: 0.0, 13: 0.7, 14: 1.1, 15: 1.6}                                         # Amplitude je Quellzeile (Pixel)


def sockel_dx(i, quelle_zeile):
    """Seitlicher Versatz einer Sockelzeile (Quellzeile) im Frame i: der Sockel schwankt, unten kräftiger (Periode 16 = 3 Zyklen je 48 Frames);
    in Frame 0 überall 0 (Ruhepose = Original), Gefälle von Zeile zu Zeile ≤ 1 px."""
    return int(round(WABBEL_GEW.get(quelle_zeile, 0.0) * math.sin(2 * math.pi * i / 16)))


DUNST = {'c': (113, 6, 182), 'r': (89, 19, 130)}
for _c in DUNST.values():
    assert _c in _farben, _c
PUFFS = [
    dict(x=PAD_L + 0, y=PAD_T + 12, vx=-1, vy=-7, off=0, form='s', wackeln=0),
    dict(x=PAD_L + 17, y=PAD_T + 12, vx=1, vy=-7, off=3, form='s', wackeln=0),
    dict(x=PAD_L + 1, y=PAD_T + 9, vx=-1, vy=-6, off=6, form='s', wackeln=0),
    dict(x=PAD_L + 16, y=PAD_T + 9, vx=1, vy=-6, off=9, form='s', wackeln=0),
    dict(x=PAD_L + 0, y=PAD_T + 14, vx=-1, vy=-6, off=12, form='s', wackeln=0),
    dict(x=PAD_L + 17, y=PAD_T + 14, vx=1, vy=-6, off=15, form='s', wackeln=0),
    dict(x=PAD_L + 2, y=PAD_T + 5, vx=-1, vy=-5, off=18, form='s', wackeln=0),
    dict(x=PAD_L + 15, y=PAD_T + 5, vx=1, vy=-5, off=21, form='s', wackeln=0),
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
    dxs = [sockel_dx(i, q) if SOCKEL0 <= q <= SOCKEL1 else 0 for q in quelle]
    z = A.verschiebe_ausgabezeilen(z, dxs)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    dunst = L.puff_ebene(H, W, i, 24, PUFFS, DUNST)
    return L.zusammen(H, W, [(dunst, 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
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
