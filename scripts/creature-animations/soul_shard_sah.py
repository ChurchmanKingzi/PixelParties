# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Sah“ (Creature).

PICK: [["MotiveEgypt", 217, 1]]   Ebene „Sah“ (MotiveEgypt.xcf, Ebene 217, 21×25 px, 18 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-sah.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Sah.png, 76×51) abgeglichen: die Ebene sitzt dort bei (26,20) mit 100 % Treffer.

Aufruf:   python3 soul_shard_sah.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-sah.png + .json

Was im Sprite ist (Koordinaten im Sprite 21×25, x/y ab 0):
* Ein verhüllter Seelenwächter mit Stab: Kapuze in Dunkelblau/Petrol (C, D, F, G, J, K; Zeilen 1–12) mit zwei weißen Augenpaaren N=(255,249,249) bei (9,5–6) und (14,5–6), links ein orangefarbener Stab
  (I, L, M; x 0–5, Zeilen 0–23), darunter Skelettkörper in Grau (Rippen E, H, B; Zeilen 13–24).
* Material: Knochen, Stoff, Fell/Schuppen — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Umriss, Kopfform, Gesicht, Gliedmaßen (der Körper streckt sich nur durch eingefügte Rippenzeilen unterhalb des Kopfes).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 18, in der Spitze zusätzlich 17; Zeilen gleicher Breite, keine Randstufe) — Kopf, Arme und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden.
* Kapuze lehnt sich (Frames 12–35): der Kopf rechts vom Stab (Quellzeilen 1–12, Spalten ≥ 5) rückt 1 px nach rechts — der Wächter neigt den Kopf; der Stab bleibt stehen.
* Blinzeln (zweimal je Schleife, Frames 19–21 und 43–45: halb – zu – halb): die weißen Augenpixel (je 1×2) werden zur Kapuzenfarbe. Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Farbe im Umkreis von 2–3 px, ohne Umriss und Augenfarbe).
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

spr = L.lade('soul-shard-sah')
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
POSEN = {0: {}, 1: {18: 1}, 2: {17: 1, 18: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes)
assert S[0] == 0
_ext = [(int(np.nonzero(OPAK[y])[0].min()), int(np.nonzero(OPAK[y])[0].max())) for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y] in (_ext[_y - 1], _ext[_y + 1]), ('Einfügezeile mit Randstufe', _y)

# ── Augen und Lidfarben ──
AUGEN = [(5, 9), (6, 9), (5, 14), (6, 14)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 249, 249), UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {19: 1, 20: 2, 21: 1, 43: 1, 44: 2, 45: 1}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)


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

# ── Kopfneigen: Kapuze (Quellzeilen 1–12, Spalten ≥ 5) rückt 1 px nach rechts ──
NEIGEN = set(range(12, 36))


def _neigen(fig, top):
    out = fig.copy()
    y0, y1 = top + 1, top + 12
    blk = fig[y0:y1 + 1, PAD_L + 5:].copy()
    out[y0:y1 + 1, PAD_L + 5:] = 0
    for y in range(blk.shape[0]):
        for x in np.nonzero(blk[y, :, 3])[0]:
            if PAD_L + 5 + x + 1 >= W:
                raise L.ClipError('Kopf aus der Leinwand')
            out[y0 + y, PAD_L + 5 + x + 1] = blk[y, x]
    return out


def figur(i):
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    if i in NEIGEN:
        fig = _neigen(fig, top)
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
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-sah')
    L.speichern('soul-shard-sah', 'Soul Shard Sah', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-sah-strip.png', frames[::2], spalten=12, scale=6)
