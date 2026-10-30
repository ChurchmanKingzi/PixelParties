# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ib“ (Creature).

PICK: [["MotiveEgypt", 230, 1]]   Ebene „Ebene #1“ (MotiveEgypt.xcf, Ebene 230, 23×32 px, 24 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ib.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ib.png, 76×51) abgeglichen: die Ebene sitzt dort bei (26,6) mit 99 % Treffer. (Die 4 abweichenden Pixel sind Farbtönungen der Karte.)

Aufruf:   python3 soul_shard_ib.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ib.png + .json

Was im Sprite ist (Koordinaten im Sprite 23×32, x/y ab 0):
* Ein Skelett mit Krokodilskopf: grüner Echsenkopf (B, C, D; Zeilen 10–19) mit gelb-orangen Augen T/V bei (10,10), (13,10), (11–12,11), darüber eine weiße Feder/Axt (G, I, J; Zeilen 0–10, x 9–19),
  goldenes Stirnband R/S, links ein goldenes Henkelkreuz (Ankh: K, N, Q, R, S, T, V; x 0–5, Zeilen 14–24; hängt über Pixelecken am Rumpf: 4-verbunden 3 Teile) und ein Skelettkörper (Zeilen 19–31).
* Material: Gold (Henkelkreuz, Stirnband) → Glanz und Glitzer erlaubt (Regel 14); alles andere (Knochen, Schuppen, Feder) glänzt nicht. Augen: unklar → KEIN Blinzeln. Kein Feuer (Regel 15).
Fest bleiben: Umriss, Kopfform, Gesicht, Gliedmaßen (der Körper streckt sich nur durch eingefügte Rippenzeilen unterhalb des Kopfes).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 22, in der Spitze zusätzlich 23; Zeilen gleicher Breite, keine Randstufe) — Kopf, Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Goldschimmer (zweimal je Schleife, Frames 2–18 und 26–42): ein diagonales Lichtband (x+y, 6 px) läuft über die goldenen Innenpixel (eine Stufe heller auf der Gold-Rampe R→S→K→N und Q→V→T→K; Umrisspixel bleiben).
* Glitzersterne (Gold): vierzackige Sterne (Lauf 0-1-2-1-0 über 5 Frames) blitzen im Henkel und auf dem Querbalken des Henkelkreuzes auf (Farben N, K, T des Sprites; Frames 6–10, 14–18, 30–34, 38–42).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten, Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('soul-shard-ib')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (12, 12, 12)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {22: 1}, 2: {22: 1, 23: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes)
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y] in (_ext[_y - 1], _ext[_y + 1]), ('Einfügezeile mit Randstufe', _y)

# ── Gold: Henkelkreuz und Stirnband glänzen (Regel 14, Gold) ──
yy, xx = np.mgrid[0:sh, 0:sw]
RAND0 = A.randpixel(spr)
INNEN = OPAK & ~RAND0


def _maske(*cs):
    m = np.zeros((sh, sw), bool)
    for c in cs:
        m |= (spr[..., :3] == np.array(c)).all(axis=2)
    return m & OPAK


GOLDFARBEN = [(169, 123, 48), (224, 174, 75), (255, 226, 98), (255, 245, 201), (217, 122, 0), (255, 153, 0), (255, 217, 0)]    # R, S, K, N, Q, V, T
for _c in GOLDFARBEN:
    assert _c in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}, _c
GOLD = INNEN & _maske(*GOLDFARBEN)
HELLER = {(169, 123, 48): (224, 174, 75), (224, 174, 75): (255, 226, 98), (255, 226, 98): (255, 245, 201), (217, 122, 0): (255, 153, 0), (255, 153, 0): (255, 217, 0), (255, 217, 0): (255, 226, 98)}
STERN_FARBEN = {'m': (255, 245, 201), 'a': (255, 226, 98), 's': (255, 217, 0)}
SWEEPS = [2, 26]
SWEEP_N = 17
STERN_LAUF = [0, 1, 2, 1, 0]
ORTE = {'a1': (2, 16), 'a2': (2, 20)}                                                  # im Henkel und auf dem Querbalken des Henkelkreuzes
STERNE = [(6, 'a1'), (14, 'a2'), (30, 'a1'), (38, 'a2')]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


def sprite_mit_effekten(i):
    sp = spr.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 < SWEEP_N:
            t = 3 * (i - s0) - 5
            sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 6))
    return sp


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        yo = f['top'] - PAD_T + f['quelle'].index(y)
        A.stern(e, PAD_L + x, PAD_T + yo, stufe, STERN_FARBEN)
    return e


def figur(i):
    koerper = A.zeilen_von(sprite_mit_effekten(i), 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    brueck, pfad, offen = [], [], []
    return dict(fig=fig, top=top, quelle=quelle, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs], '| Pfadpixel:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-ib')
    L.speichern('soul-shard-ib', 'Soul Shard Ib', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-ib-strip.png', frames[::2], spalten=12, scale=6)
