# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Snowman“ (Creature).

PICK: [["Motive", 818, 1]]   Ebene „Snowman“ (Motive.xcf, Ebene 818; Figur 1 = der Schneemann mit Zylinder und rotem Schal, 13×32 px, 13 Farben, nur Alpha 0/255) → src/slippery-snowman.png.
Gegen die Kartenkunst (data/card-art/native/Slippery_Snowman.png) abgeglichen: die Ebene sitzt dort pixelgenau (Treffer 100 %). Nicht verwendet: Ebene 819 (halbtransparenter heller Streifen/Schweif neben dem
Schneemann, Alpha < 255 — kein Teil der Figur) und der schräge Schneewehen-Schweif der Karte.

Aufruf:   python3 slippery_snowman.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-snowman.png + .json

Was im Sprite ist (Koordinaten im Sprite 13×32, x/y ab 0):
* Zylinder (Zeilen 0–8, schwarz D/F/H/I; Krempe in Zeile 7 x 1–11), Kopf (Zeilen 9–13, Schnee A/C, Nase L/M orange bei (7,10–11), Kohlestücke B in Zeile 12/13), roter Schal (Zeilen 13–19; Band quer über den Hals,
  Schalende hängt links diagonal herab bis (1–4,18), Rotstufen G, J, K), Hals (Zeile 22, dunkelgrau), Rumpf (Zeilen 23–31, Schnee A/C/E, Umriss B).
* Augen: im Sprite nicht eindeutig (nur einzelne dunkle Kohlestücke im Gesicht) → KEIN Blinzeln.
* Material: Schnee/Eis, Stoff, Filz — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15).
Fest bleiben: Umriss, Schneekugeln, Gesicht, Zylinderform (nur ganze Zeilen werden versetzt).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Wippen (Periode 24, zwei Schwünge je Schleife): der Schneemann kippt auf dem glatten Eis nach links und rechts — Zeilenversatz mit oben großem, unten kleinem Gewicht (Zylinder ±2 px, Kopf ±2…±1, Hals/Rumpf 0…±1,
  Boden fest). Der Umriss wird dabei nur an den Stufen zwischen Kopf, Hals und Rumpf um 1 Pixel ergänzt (Umrissfarbe B, höchstens ein Pixel je Stelle, siehe `ergaenzt`).
* Schal (Periode 12): das hängende Schalende (rote Pixel in Zeilen 17–19) flattert mit dem Wippen — es wird je Zeile um bis zu 1–2 px waagerecht versetzt, die frei werdenden Pixel werden mit Schnee (innen) bzw.
  Umrissfarbe B (am Rand) gefüllt.
Ergänzungen: Umrisspixel B nur wo der Versatz eine Kante frei legt (siehe oben); keine Partikel.
Frame: Sprite plus 4 px links/rechts (Wippen ±2 + 2 px Rand), 2 px oben, 2 px unten — Figur zentriert (die Höhe ändert sich nicht).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 2, 2

spr = L.lade('slippery-snowman')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (83, 83, 83)                                                                    # B: Umriss der Schneekugeln
ROT = {(116, 0, 0), (99, 0, 0), (135, 0, 0)}                                             # G, K, J
SCHNEE = {(230, 230, 230), (204, 204, 204), (255, 255, 255)}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Gewichte des Wippens je Quellzeile (Zylinder 1.0, Kopf 0.9…0.5, Hals/Rumpf klein, Boden 0) ──
GEWICHT = []
for _y in range(sh):
    if _y <= 8:
        g = 1.0
    elif _y <= 12:
        g = 0.9
    elif _y <= 17:
        g = 0.7
    elif _y <= 21:
        g = 0.5
    elif _y == 22:
        g = 0.35
    elif _y <= 25:
        g = 0.2
    else:
        g = 0.0
    GEWICHT.append(g)
AMP = 2.0
SCHAL_ZEILEN = {17: 0.45, 18: 0.9, 19: 1.0}                                              # Quellzeile → Gewicht des Schalendes
AMP_SCHAL = 1.6

# ── Zeitachsen ──
PHI_SCHAL = 1.1


def _schal_dx(i):
    """Versatz des Schalendes je Quellzeile: round(AMP_SCHAL · g · (sin(ph+φ) − sin(φ))) — in Frame 0 überall 0."""
    ph = 2 * math.pi * i / 12.0
    return {y: int(round(AMP_SCHAL * g * (math.sin(ph + PHI_SCHAL) - math.sin(PHI_SCHAL)) / 1.4)) for y, g in SCHAL_ZEILEN.items()}


def _sprite_mit_schal(i):
    """Quellsprite mit versetztem Schalende (rote Pixel der Zeilen 17–19)."""
    dxs = _schal_dx(i)
    if not any(dxs.values()):
        return spr.copy()
    out = spr.copy()
    moves = []
    for y, dx in dxs.items():
        for x in range(sw):
            if OPAK[y, x] and _col(y, x) in ROT:
                moves.append((y, x, dx))
    for (y, x, dx) in moves:
        out[y, x] = 0                                                                    # Schalpixel entfernen …
    for (y, x, dx) in moves:                                                             # … und versetzt wieder setzen
        t = x + dx
        if not 0 <= t + 2 < sw + 4:
            raise L.ClipError('Schal ragt aus dem Sprite-Streifen')
    # Leinwand um 2 px je Seite weiten, damit der Schal links hinausragen darf
    breit = np.zeros((sh, sw + 4, 4), np.uint8)
    breit[:, 2:2 + sw] = out
    # frei gewordene Pixel füllen (Schnee innen, Umriss B am Rand)
    for (y, x, dx) in moves:
        X = x + 2
        if breit[y, X, 3]:
            continue
        nb = []
        for (qx, qy) in ((X - 1, y), (X + 1, y), (X, y - 1), (X, y + 1)):
            if 0 <= qx < sw + 4 and 0 <= qy < sh and breit[qy, qx, 3] and tuple(int(v) for v in breit[qy, qx, :3]) in SCHNEE:
                nb.append(tuple(int(v) for v in breit[qy, qx, :3]))
        # Randlage: links/rechts leer (außerhalb des Körpers) → Umriss
        links_leer = not breit[y, X - 1, 3] if X - 1 >= 0 else True
        rechts_leer = not breit[y, X + 1, 3] if X + 1 < sw + 4 else True
        c = UMRISS if (links_leer or rechts_leer) and not nb else (max(set(nb), key=nb.count) if nb else UMRISS)
        breit[y, X, :3] = c
        breit[y, X, 3] = 255
    for (y, x, dx) in moves:
        breit[y, x + 2 + dx] = spr[y, x]
    return breit


def figur(i):
    ph = 2 * math.pi * i / 24.0
    dxs = A.dx_zeilen(GEWICHT, AMP, ph)
    quelle = _sprite_mit_schal(i)
    br = quelle.shape[1]
    rows = np.zeros((sh, W, 4), np.uint8)
    off = PAD_L - (br - sw) // 2
    for y in range(sh):
        for x in np.nonzero(quelle[y, :, 3])[0]:
            X = x + off + dxs[y]
            if not 0 <= X < W:
                raise L.ClipError(f'Zeile {y} ragt aus der Leinwand')
            rows[y, X] = quelle[y, x]
    fig, top = A.auf_leinwand(rows, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    frames = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergaenzt (Umrisspixel je Frame):', [len(f['neu']) for f in fs])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(frames, spr, 'slippery-snowman')
    L.speichern('slippery-snowman', 'Slippery Snowman', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-snowman-strip.png', frames[::2], spalten=12, scale=8)
