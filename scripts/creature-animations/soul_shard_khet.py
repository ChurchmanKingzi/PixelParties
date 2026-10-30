# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Khet“ (Creature).

PICK: [["MotiveEgypt", 214, 1]]   Ebene „Khet“ (MotiveEgypt.xcf, Ebene 214, 18×23 px, 12 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-khet.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Khet.png, 76×51) abgeglichen: die Ebene sitzt dort bei (29,15) mit 100 % Treffer.

Aufruf:   python3 soul_shard_khet.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-khet.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×23, x/y ab 0):
* Ein Skelett mit Schakalkopf (Anubis): schwarzer Kopf (A=(12,12,12), E, B) mit zwei Ohren (Zeilen 0–3, x 6–9 und x 11) und hellblauen Streifen J=(172,198,237), dunkelblauer Haube G/H/I links,
  einem weißen Augenschlitz K=(255,255,255) bei (10–11,9); darunter Brustkorb in Grautönen C, D, F mit Rippenbändern (Zeilen 14–19), Arme (links x 0–4, Zeilen 9–13) und Beine (Zeilen 20–22).
* Material: Knochen, Stoff, Fell/Schuppen — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Umriss, Kopfform, Gesicht, Gliedmaßen (der Körper streckt sich nur durch eingefügte Rippenzeilen unterhalb des Kopfes).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 15, in der Spitze zusätzlich 16; Zeilen gleicher Breite, keine Randstufe) — Kopf, Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Ohren (je 3 Frames, Frames 8–10 und 32–34 links, 20–22 und 44–46 rechts): die Ohrspitzen (Quellzeilen 0–2) kippen 1 px zur Kopfmitte und bleiben dabei am Kopf angeschlossen.
* Blinzeln (zweimal je Schleife, Frames 13–14 und 37–38, je 2 Frames zu): der weiße Augenschlitz wird zum Kopfschwarz (die Augen sind ein 2×1-Schlitz, kein halbes Lid möglich). Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Farbe im Umkreis von 2–3 px, ohne Umriss und Augenfarbe).
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

spr = L.lade('soul-shard-khet')
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
POSEN = {0: {}, 1: {15: 1}, 2: {15: 1, 16: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes)
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y] in (_ext[_y - 1], _ext[_y + 1]), ('Einfügezeile mit Randstufe', _y)

# ── Augen und Lidfarben ──
AUGEN = [(9, 10), (9, 11)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 255, 255), UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {13: 2, 14: 2, 37: 2, 38: 2}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


def _lid(fig, top, stufe):
    out = fig.copy()
    h, w = fig.shape[:2]
    ymin = min(y for (y, x) in AUGEN)
    pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if stufe == 2 or y == ymin]
    eigen = {(top + y, PAD_L + x) for (y, x) in AUGEN}
    for (y, x) in pix:
        for rad in (2, 3):
            cnt, dist = {}, {}
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    yy, xx = y + dy, x + dx
                    if not (0 <= yy < h and 0 <= xx < w) or not fig[yy, xx, 3] or (yy, xx) in eigen:
                        continue
                    c = tuple(int(v) for v in fig[yy, xx, :3])
                    if c in LID_AUS:
                        continue
                    cnt[c] = cnt.get(c, 0) + 1
                    dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
            if cnt:
                out[y, x, :3] = max(cnt, key=lambda q: (cnt[q], -dist[q]))
                break
    return out

# ── Ohren: Spitzen (Quellzeilen 0–2) kippen 1 px zur Kopfmitte ──
OHR_L = {8, 9, 10, 32, 33, 34}
OHR_R = {20, 21, 22, 44, 45, 46}
OHR_SPALTEN = {'l': (6, 9), 'r': (11, 11)}                                                                  # Seite → (erste, letzte Quellspalte)


def _ohr(fig, top, seite, dx):
    x0, x1 = OHR_SPALTEN[seite]
    out = fig.copy()
    a, b = PAD_L + x0 - 1, PAD_L + x1 + 1
    blk = fig[top + 0:top + 2 + 1, a:b + 1].copy()
    out[top + 0:top + 2 + 1, a:b + 1] = 0
    for y in range(blk.shape[0]):
        for x in np.nonzero(blk[y, :, 3])[0]:
            out[top + 0 + y, a + x + dx] = blk[y, x]
    return out


def figur(i):
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    if i in OHR_L:
        fig = _ohr(fig, top, 'l', 1)
    if i in OHR_R:
        fig = _ohr(fig, top, 'r', -1)
    if i in BLINK:
        fig = _lid(fig, top, BLINK[i])
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, top=top, quelle=quelle, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    return figur(i)['fig']


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
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-khet')
    L.speichern('soul-shard-khet', 'Soul Shard Khet', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-khet-strip.png', frames[::2], spalten=12, scale=6)
