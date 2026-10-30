# -*- coding: utf-8 -*-
"""Idle-Animation für „Vinepire“ (Creature).

PICK: [["MotiveGN", 248, 1]]   Ebene „Ebene #195“ (MotiveGN.xcf, Ebene 248, 16×22 px, 10 Farben, nur Alpha 0/255) → src/vinepire.png (Figur 1 = das ganze Wesen, nur diese Karte benutzt die Ebene).
Gegen die Kartenkunst (data/card-art/native/Vinepire.png, 152×102 = Pixelart in doppelter Auflösung, leicht geglättet und abgedunkelt) per Pixelvergleich abgeglichen: das Wesen steht dort bei
(58,42) in 2×-Größe (32×44) — Treffer 79 % (Rest = Glättung/Abdunklung der Karte, Form und Farbtöne stimmen). Die Ebene selbst ist pixelsauber (143 deckende Pixel, kein Halbtransparentes); es wird die Ebene
in Originalgröße (1×) verwendet. Nicht verwendet: Hintergrund, Baum, Blumen, die rote Sonne der Karte.

Aufruf:   python3 vinepire.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/vinepire.png + .json

Was im Sprite ist (Koordinaten im Sprite 16×22, x/y ab 0):
* Ein rotes Dornen-/Rankenwesen (Rottöne A=(51,1,11), B, C, D=(153,3,33)): gebogener Blattfühler oben (x 5–9, y 0–3; über (10,4) mit dem Kopf verbunden), Kopf mit Gesicht (y 5–11), zwei gespreizte Arme
  (links x 0–4, y 7–10; rechts x 11–15, y 8–11), schlanker Rumpf (y 12–16) und eine Blattrosette als Fuß (y 17–21). Das Wesen ist nur über Pixelecken verbunden (8-verbunden, ein Teil; 4-verbunden 3 Teile: Fühlerblatt,
  Wesen, linker Arm).
* Gesicht: zwei Augen — je 1×2 px leuchtendes Violett G=(70,0,102) über H=(113,0,164) bei (7,10–11) und (9,10–11), darüber/dazwischen schwarze Höhlen E=(0,0,0); leuchtend rote Punkte I=(236,28,36) bei (8,14) und (8,17).
* Material: Pflanze/Ranke — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Rot ist hier Laub, keine Flamme.
Fest bleiben: Umriss, Gesicht, Rosette (der Rumpf streckt sich nur durch eine eingefügte Zeile unterhalb des Gesichts).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb des Gesichts im Rumpf (Quellzeile 16, in der Spitze zusätzlich 15; Mund und Augen werden nie verdoppelt) wird 1–2 Zeilen eingefügt — Kopf, Arme und Fühler heben sich um 1–2 px,
  die Rosette bleibt fest am Boden.
* Armewiegen (Periode 24, gegenläufig): die Arme schwingen — Spaltenversatz je Armspalte (bis ±2 px an den Armspitzen, die Spitze hinkt nach), Armgelenke an Kopf bzw. Rumpf fest.
* Fühlerblatt (Frames 8–19 und 32–43): das Blatt (Zeilen 0–3) lehnt sich 1 px nach rechts (wird dabei fest mit dem Stiel verbunden).
* Blinzeln (zweimal je Schleife, Frames 19–21 und 43–45: halb – zu – halb): die violetten Augenpixel (je 2) nehmen die umgebende Körperfarbe an (häufigste Rotstufe im Umkreis von 2 px, ohne Schwarz/Violett).
Ergänzungen: kurze 4-verbundene Brücken (Farbe des Reststücks) nur dort, wo der Armversatz eine Ecke löst (siehe `pfad` je Frame); der Umriss bleibt sonst unverändert.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Atmen), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('vinepire')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


UMRISS = (51, 1, 11)                                                               # A: dunkelstes Rot, Umriss der Ranken
SCHWARZ = (0, 0, 0)
VIOLETT = {(70, 0, 102), (113, 0, 164)}
HELLROT = (236, 28, 36)
AUGEN_PX = [(10, 7), (10, 9), (11, 7), (11, 9)]                                     # (y, x) der violetten Augenpixel
for (y, x) in AUGEN_PX:
    assert _col(y, x) in VIOLETT, (y, x)

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {16: 1}, 2: {16: 1, 15: 1}}                                    # unterhalb des Gesichts (Mund y 12–14): Rumpfzeilen 15/16 (gleiche Breite x 5–10)
assert S[0] == 0
BLINK = {19: 1, 20: 2, 21: 1, 43: 1, 44: 2, 45: 1}
LEAF = set(range(8, 20)) | set(range(32, 44))
ARM_LINKS = (0, 4, 5)                                                              # Spalten x0..x1 (Sprite) und Schulterspalte
ARM_RECHTS = (11, 15, 10)
LAG = 0.9
AMP = 2.0


def _arm_dy(i, seite):
    """Spaltenversatz je Armspalte (Sprite-Spalte → dy). Arm-Gelenkspalte = 0 (frame 0 überall 0)."""
    if seite == 'l':
        c0, c1, piv = ARM_LINKS
        phi = 0.0
    else:
        c0, c1, piv = ARM_RECHTS
        phi = math.pi
    maxd = max(abs(c0 - piv), abs(c1 - piv))
    ph = 2 * math.pi * i / 24
    out = {}
    for x in range(c0, c1 + 1):
        frac = abs(x - piv) / float(maxd)
        out[x] = int(round(AMP * frac * (math.sin(ph + phi - LAG * frac) - math.sin(phi - LAG * frac)) / 1.0))
    return out


ARM_ZEILEN = (7, 11)                                                               # Quellzeilen der Arme (Spalten 0–4 bzw. 11–15 enthalten darüber/darunter Stiel und Rosette)


def _arm(fig, top, dys):
    out = fig.copy()
    y0, y1 = top + ARM_ZEILEN[0], top + ARM_ZEILEN[1]
    for x, dy in dys.items():
        X = PAD_L + x
        col = fig[:, X].copy()
        out[y0:y1 + 1, X] = 0
        for y in np.nonzero(col[:, 3])[0]:
            if not y0 <= y <= y1:
                continue
            Y = y + dy
            if not 0 <= Y < H:
                raise L.ClipError('Arm aus der Leinwand')
            out[Y, X] = col[y]
    return out


def _fuehler(fig, top, dx):
    """Fühlerblatt (Quellzeilen 0–3, Spalten 5–9) um dx Pixel waagerecht versetzen."""
    out = fig.copy()
    a, b = PAD_L + 5, PAD_L + 9
    blk = fig[top:top + 4, a:b + 1].copy()
    out[top:top + 4, a:b + 1] = 0
    for y in range(4):
        for x in np.nonzero(blk[y, :, 3])[0]:
            out[top + y, a + x + dx] = blk[y, x]
    return out


def _lid(fig, top, stufe):
    """Violette Augenpixel durch die umgebende Körperfarbe ersetzen (stufe 1: obere Augenzeile, 2: beide)."""
    out = fig.copy()
    h, w = fig.shape[:2]
    pix = [(top + y, PAD_L + x) for (y, x) in AUGEN_PX if stufe == 2 or y == 10]
    for (y, x) in pix:
        cnt, dist = {}, {}
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or not fig[yy, xx, 3]:
                    continue
                c = tuple(int(v) for v in fig[yy, xx, :3])
                if c == SCHWARZ or c in VIOLETT or c == HELLROT:
                    continue
                cnt[c] = cnt.get(c, 0) + 1
                dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
        c = max(cnt, key=lambda q: (cnt[q], -dist[q]))
        out[y, x, :3] = c
    return out


def figur(i):
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    if i in BLINK:
        fig = _lid(fig, top, BLINK[i])
    fig = _arm(fig, top, _arm_dy(i, 'l'))
    fig = _arm(fig, top, _arm_dy(i, 'r'))
    if i in LEAF:
        fig = _fuehler(fig, top, 1)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, pfad, offen = A.verbinde_luecken8(fig, 3)
    return dict(fig=fig, top=top, pfad=pfad, offen=offen, neu=neu)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    frames = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(frames, spr, 'vinepire')
    L.speichern('vinepire', 'Vinepire', frames, MS, prev)
    if prev:
        L.streifen(prev + '/vinepire-strip.png', frames[::2], spalten=12, scale=8)
