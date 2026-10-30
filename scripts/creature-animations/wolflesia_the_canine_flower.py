# -*- coding: utf-8 -*-
"""Idle-Animation für „Wolflesia, the Canine Flower“ (Creature).

PICK: [["MotiveRussia", 228, 1]]   Ebene „RAFFLESIA“ (MotiveRussia.xcf, Ebene 228, 20×28 px, 17 Farben, nur Alpha 0/255) → src/wolflesia-the-canine-flower.png (die ganze Figur).
Die Ebene heißt nach der Schwesterkarte „Rafflesia“, zeigt aber den Wolfskopf mit Blütenmähne: per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Wolflesia_the_Canine_Flower.png, 76×51)
abgeglichen — sie sitzt dort bei (28,13) mit 100 % Treffer. Nicht verwendet: der rosa Lichtschein um die Figur (halbtransparent, Alpha < 255), der Eisfelsen-Hintergrund und der Stein unten rechts.

Aufruf:   python3 wolflesia_the_canine_flower.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/wolflesia-the-canine-flower.png + .json

Was im Sprite ist (Koordinaten im Sprite 20×28, x/y ab 0):
* Eine Blütenmähne aus rosa/braunen Blütenblättern (A=(63,43,45), C, E=(203,120,132), F; Zeilen 0–8, rundherum bis Zeile 19 mit kleinen Seitenblättern x 0–3 und 16–19), darin ein blaugrauer Wolfskopf
  (G, M, N, D; Zeilen 8–15) mit zwei roten Augen O=(116,0,0) (links (7,10)+(8,11), rechts (12,10)+(11,11), schräg gestellt), dunkler Nase/Schnauze und zwei Reißzähnen P=(192,188,166) bei (8–9,14)/(10–11,14),
  darunter ein grüner Blattkörper (H, I, J, K, L, B; Zeilen 16–27). 8-verbunden (ein Teil); 4-verbunden 5 Teile (Hauptkörper und 4 kleine Seitenblättchen) — die Mähne hängt an vielen Stellen nur über Pixelecken.
* Material: Blüte, Fell, Blätter — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15).
Fest bleiben: Umriss, Gesicht, Kopf, Körper, Seitenblättchen (sie wandern nur mit dem Körper).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): im Blattkörper (Quellzeile 23, in der Spitze zusätzlich 22 — unterhalb des Gesichts; beide Zeilen haben dieselbe Breite x 4–15, keine Randstufe) wird 1–2 Zeilen eingefügt: Kopf und Mähne
  heben sich um 1–2 px, die Füße (Blattspitzen) bleiben fest am Boden.
* Mähne rascheln (Periode 24): der obere Teil der Blütenmähne (Quellzeilen 0–8, nach unten abnehmendes Gewicht) wird zeilenweise ±1 px hin und her versetzt — die Blütenblätter wiegen sich im Wind.
* Blinzeln (zweimal je Schleife, Frames 19–21 und 43–45: halb – zu – halb): die vier roten Augenpixel nehmen die umgebende Fellfarbe an (je Pixel häufigste Farbe im Umkreis von 2 px, ohne Rot/Zahnweiß/Umriss).
* Giftpollen (Partikel): je ein rosa 2×2-Wölkchen (Form „s“: Glanzpunkt E oben links, Körper F) steigt links und rechts neben der Mähne langsam auf (20 Frames, versetzt, senkrecht) und
  löst sich oben auf. Nie ein einzelner Punkt, berührt den Körper nie (das Skript prüft es in jedem Frame).
Ergänzungen: Umrisspixel A nur wo das Rascheln eine Kante freilegt (siehe `ergaenzt`); keine Brückenpixel nötig.
Frame: Sprite plus 5 px links/rechts (Pollen), 4 px oben (Atmen), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 4, 2

spr = L.lade('wolflesia-the-canine-flower')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (63, 43, 45)                                                               # A
POLLEN_FARBEN = {'c': (203, 120, 132), 'r': (124, 78, 83)}                          # E, F
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in POLLEN_FARBEN.values():
    assert _c in _farben, _c


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


ROT = (116, 0, 0)
ZAHN = (192, 188, 166)
AUGEN_PX = [(10, 7), (11, 8), (10, 12), (11, 11)]                                   # (y, x): linkes Auge, rechtes Auge
for (y, x) in AUGEN_PX:
    assert _col(y, x) == ROT, (y, x)

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {23: 1}, 2: {22: 1, 23: 1}}
assert S[0] == 0
assert all(np.nonzero(OPAK[y])[0].min() == 4 and np.nonzero(OPAK[y])[0].max() == 15 for y in (22, 23))
BLINK = {19: 1, 20: 2, 21: 1, 43: 1, 44: 2, 45: 1}
GEWICHT = [1.0 if y <= 6 else 0.5 if y <= 8 else 0.0 for y in range(sh)]
AMP = 1.4

# ── Pollen: 2×2-Wölkchen links/rechts neben der Mähne (Sprite-Koordinaten der linken oberen Ecke) ──
POLLEN = [
    dict(x0=-3, x1=-3, y0=16, y1=2, off=0, flug=20),                                # links
    dict(x0=21, x1=21, y0=16, y1=2, off=12, flug=20),                               # rechts
]


def pollen_ebene(i):
    e = L.leer(H, W)
    for p in POLLEN:
        k = (i - p['off']) % 24
        if k >= p['flug']:
            continue
        t = k / float(p['flug'] - 1)
        cx = PAD_L + p['x0'] + int(round((p['x1'] - p['x0']) * t))
        cy = PAD_T + p['y0'] + int(round((p['y1'] - p['y0']) * t))
        for (dx, dy, c) in L.PUFF_FORMEN['s']:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Pollen bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = POLLEN_FARBEN[c]
            e[Y, X, 3] = 255
    return e


def _lid(fig, top, stufe):
    """Rote Augenpixel durch die umgebende Fellfarbe ersetzen (stufe 1: obere Augenzeile, 2: beide)."""
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
                if c == ROT or c == ZAHN or c == UMRISS or c == (32, 24, 0):
                    continue
                cnt[c] = cnt.get(c, 0) + 1
                dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
        c = max(cnt, key=lambda q: (cnt[q], -dist[q]))
        out[y, x, :3] = c
    return out


def figur(i):
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], x0=PAD_L)
    dxq = A.dx_zeilen(GEWICHT, AMP, 2 * math.pi * i / 24)
    z = A.verschiebe_zeilen(z, quelle, dxq)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    if i in BLINK:
        fig = _lid(fig, top, BLINK[i])
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, pfad, offen = A.verbinde_luecken8(fig, 3)
    return dict(fig=fig, top=top, neu=neu, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(pollen_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergaenzt (Umrisspixel je Frame):', [len(f['neu']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    # Pollen dürfen die Figur nie berühren (auch nicht über die Ecke)
    for i in range(N):
        t = pollen_ebene(i)[..., 3] > 0
        k = np.pad(figs[i][..., 3] > 0, 1)
        nah = np.zeros_like(t)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nah |= k[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]
        if (t & nah).any():
            print('Pollen berührt die Figur in Frame', i)
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'wolflesia')
    L.speichern('wolflesia-the-canine-flower', 'Wolflesia, the Canine Flower', frames, MS, prev)
    if prev:
        L.streifen(prev + '/wolflesia-strip.png', frames[::2], spalten=12, scale=6)
