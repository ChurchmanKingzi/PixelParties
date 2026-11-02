# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Sah“ (Creature).

PICK: [["MotiveEgypt", 217, 1]]   Ebene „Sah“ (MotiveEgypt.xcf, Ebene 217, 21×25 px, 18 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-sah.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Sah.png, 76×51) abgeglichen: die Ebene sitzt dort bei (26,20) mit 100 % Treffer.

Aufruf:   python3 soul_shard_sah.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-sah.png + .json

Was im Sprite ist (Koordinaten im Sprite 21×25, x/y ab 0):
* Ein verhüllter Seelenwächter mit Stab: Kapuze in Dunkelblau/Petrol (C, D, F, G, J, K; Zeilen 1–12) mit zwei weißen Augenpaaren N=(255,249,249) bei (9,5–6) und (14,5–6), links ein orangefarbener Stab
  (I, L, M; x 0–3, Zeilen 0–23), darunter Skelettkörper in Grau (E, H, B; Zeilen 13–24).
* Der „Schnabel“/Rüssel (Nutzer: „der lange Schnabel“): ein schmaler Streifen in der Mitte der Kapuze (G dunkelpetrol, K/Q hell, schwarzer Umriss C) von Zeile 8 bis 14, der unter dem Kapuzensaum (Zeile 13)
  weiter auf den Brustkorb herabreicht (Zeilen 13–14 als Gabel C-G-C-G) und in einer schwarzen Spitze (11,15) endet. Er ist ein eigenes Teil — wird er bewegt, dann nur starr als Ganzes (alle Pixel gleich).
* Material: Knochen, Stoff, Holz — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Umriss, Kopf-/Kapuzenform, Gesicht (kein seitliches Kopfneigen mehr — Nutzer-Feedback), Gliedmaßen; der Stab steht starr am Boden (er wird nicht gestreckt: die Hand rutscht beim Atmen daran entlang).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Kopfes werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 18, in der Spitze zusätzlich 17; Zeilen gleicher Breite, keine Randstufe, die eingefügten Zeilen mischen die Textur
  der Nachbarzeile ein) — Kopf und Rumpf heben sich um 1–2 px, die Füße bleiben fest am Boden. Der Stab (x ≤ 3) ist eine eigene starre Ebene und bleibt stehen.
* Schnabel-Pendel (Frames 5–10: 1 px nach rechts, Frames 29–34: 1 px nach links): der Schnabel inklusive Gabel und Spitze wird als Ganzes verschoben; das freigelegte Feld bekommt die Farbe der Nachbarzelle
  (schwarze Gesichtsleere, Kapuzensaum bzw. Rippenfarbe), die Kapuze selbst bewegt sich nicht.
* Blinzeln (zweimal je Schleife, Frames 19–21 und 43–45: halb – zu – halb): die weißen Augenpixel (je 1×2) werden zur Kapuzenfarbe. Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Farbe im Umkreis von
  2–3 px, ohne Umriss und Augenfarbe).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten, Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_shard as SH

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('soul-shard-sah')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (12, 12, 12)

# ── Ebenen: Stab (x ≤ 3, starr) und Körper (alles andere, atmet) ──
STAB_X = 3
STAB_EXTRA = [(0, 4), (0, 5), (1, 4), (17, 4)]                                                              # (y, x): Haken oben (M) und schwarzer Stabumriss (4,17) gehören zum Stab
STAB = spr.copy(); STAB[:, STAB_X + 1:] = 0
KOERPER = spr.copy(); KOERPER[:, :STAB_X + 1] = 0
for _y, _x in STAB_EXTRA:
    STAB[_y, _x] = spr[_y, _x]
    KOERPER[_y, _x] = 0

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {19: 1}, 2: {18: 1, 19: 1}}                                                                      # s → eingefügte Zeilen (Rippen, unterhalb des Kopfes)
assert S[0] == 0
_ext = [(int(np.nonzero(KOERPER[y, :, 3])[0].min()), int(np.nonzero(KOERPER[y, :, 3])[0].max())) if KOERPER[y, :, 3].any() else None for y in range(sh)]
for _s, _d in POSEN.items():
    for _y in _d:
        assert _ext[_y][1] in (_ext[_y - 1][1], _ext[_y + 1][1]) and abs(_ext[_y][0] - _ext[_y - 1][0]) <= 1, ('Einfügezeile mit Randstufe', _y, _ext[_y - 1:_y + 2])

# ── Augen und Lidfarben ──
AUGEN = [(5, 9), (6, 9), (5, 14), (6, 14)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 249, 249), UMRISS}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {19: 1, 20: 2, 21: 1, 43: 1, 44: 2, 45: 1}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)

# ── Schnabel: starr als Ganzes ──
BK = {8: (11, 12), 9: (11, 12), 10: (11, 12), 11: (11, 12), 12: (10, 13), 13: (10, 13), 14: (10, 13), 15: (11, 11)}      # Zeile → (x von, x bis) in Sprite-Koordinaten
SCHNABEL = [(y, x) for y, (a, b) in BK.items() for x in range(a, b + 1)]
SWAY = {i: 1 for i in range(5, 11)}
SWAY.update({i: -1 for i in range(29, 35)})


def _schnabel(fig, top, dx):
    """Alle Schnabelpixel starr um dx versetzen; das freigelegte Feld auf der Rückseite füllt die Farbe der Zelle dahinter."""
    out = fig.copy()
    pix = [(top + y, PAD_L + x) for (y, x) in SCHNABEL]
    cols = {p: fig[p].copy() for p in pix}
    # freigelegt: Randzelle auf der Rückseite; Füllfarbe = Zelle unmittelbar dahinter (Original-Frame)
    for y_s, (a, b) in BK.items():
        y = top + y_s
        x_back = PAD_L + (a if dx > 0 else b)
        x_beyond = x_back - 1 if dx > 0 else x_back + 1
        out[y, x_back] = fig[y, x_beyond]
    for (y_s, (a, b)) in BK.items():
        y = top + y_s
        for x_s in range(a, b + 1):
            out[y, PAD_L + x_s + dx] = cols[(y, PAD_L + x_s)]
    return out


def figur(i):
    ebene, top, quelle = SH.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    fig = L.zusammen(H, W, [(L.platz(STAB, H, W, PAD_L, PAD_T), 0, 0), (ebene, 0, 0)])
    if i in SWAY:
        fig = _schnabel(fig, top, SWAY[i])
    if i in BLINK:
        ymin = min(y for (y, x) in AUGEN)
        pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if BLINK[i] == 2 or y == ymin]
        fig = SH.lid(fig, pix, LID_AUS, eigen={(top + y, PAD_L + x) for (y, x) in AUGEN})
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
