# -*- coding: utf-8 -*-
"""Idle-Animation für „Splashy Slime“ (Creature).

PICK: [["Motive", 469, 1]]   Ebene „Splashy Slime“ (Motive.xcf, Ebene 469; Figur 1 = der blaue Schleim, 14×9 px, 11 Farben, nur Alpha 0/255) → src/splashy-slime.png.
Gegen die Kartenkunst (data/card-art/native/Splashy_Slime.png) abgeglichen: die Ebene sitzt dort pixelgenau (Treffer 100 %) bei (31,22). Nicht verwendet: die halbtransparenten Pfützen/Spritzer
der Karte (unter und neben dem Schleim; Alpha < 255, nicht pixelgenau mischbar — wie beim Slimy Slime). Deshalb ist die Unterkante des Sprites „offen“ (Zeile 7 mit einer Kerbe bei x 6, Zeile 8 nur
noch einzelne Tropfenfüße bei x 2–3, 11, 13): so steht sie in der Ebene, sie bleibt unverändert.

Aufruf:   python3 splashy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/splashy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 14×9, x/y ab 0):
* Ein blauer Schleim mit dunklem Umriss A=(9,50,74), Blaustufen B, C, G, F (Körper), E=(55,164,228) und H=(66,169,229) (Glanzlicht in der Stirnmitte x 5–8, y 1–3).
* Zwei Augen: je 3×2 px (links x 2–4, rechts x 9–11, y 5–6) aus dunklem Blau/Schwarz (I, D, J) mit weißem Glanzpunkt K=(242,253,239) bei (4,6)/(10,6); darüber ein dunkles Brauenband D in Zeile 3.
* Material: Gel/Wasser — KEIN Glanz und keine Glitzersterne (Regel 14); keine Flammen (Regel 15).
Fest bleiben: Umriss, Kuppelform, Unterkante, Brauen, Glanzlicht in der Stirn (sie wandern nur mit dem Gel).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 1–11 und 25–35: eine Körperzeile 4 mehr, in der Spitze 4–8 und 28–32 zusätzlich Zeile 2) wird der Schleim 1–2 px höher; beim Stauchen
  (Frames 14–22 und 38–46) wird Zeile 2 entfernt und jede Zeile in der Mitte um 1 Spalte je Seite breiter (die Mittelspalten x 5/8 werden verdoppelt, nie der Umriss) — die Augen rücken dabei auseinander.
  Die Unterkante sitzt fest am Boden.
* Blinzeln (zweimal je Schleife, Frames 13–15 und 37–39: halb – zu – halb): Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Körperfarbe im Umkreis von 2 px, ohne Umriss/Braue/Auge).
* Spritzer (Partikel): beim Strecken schnellt je ein Wassertropfen links und rechts neben dem Kopf nach oben und fällt außen am Schleim wieder herab (ganze Pixel, Parabelbahn, 13–15 Frames, 2 pro Periode).
  Jeder Tropfen ist ein 2×2-Wölkchen (Form „s“: Glanzpunkt E oben links, Körper C), nie ein einzelner Punkt, und berührt den Körper nie.
Ergänzungen: keine (der Umriss wird nie verändert; beim Verdoppeln bleibt jede Randstufe ≤ 1 px).
Frame: Sprite plus 5 px links/rechts (Tropfenbahn), 6 px oben (Strecken + Tropfen), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 2

spr = L.lade('splashy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
UMRISS = (9, 50, 74)
C_BRAUE = (3, 14, 28)
TROPFEN_FARBEN = {'c': (55, 164, 228), 'r': (31, 153, 224)}
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in TROPFEN_FARBEN.values():
    assert _c in _farben, _c


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Augen (Sprite-Koordinaten (y, x)); Zeile 5 = obere, Zeile 6 = untere Augenzeile ──
AUGEN_L = [(5, 2), (5, 3), (5, 4), (6, 2), (6, 3), (6, 4)]
AUGEN_R = [(5, 9), (5, 10), (5, 11), (6, 9), (6, 10), (6, 11)]
AUGEN = AUGEN_L + AUGEN_R
AUGEN_FARBEN = {_col(y, x) for (y, x) in AUGEN}
assert (242, 253, 239) in AUGEN_FARBEN and C_BRAUE in AUGEN_FARBEN
# Markierungsbild: dieselbe Körperumformung trägt die Augenpixel mit (Markierfarbe je Augenzeile)
_mark = spr.copy()
for (y, x) in AUGEN:
    _mark[y, x, :3] = (250, 1, y)

PAAR = ((5, 8),)                                                                      # Mittelspalten: werden beim Verbreitern verdoppelt (Umriss, Brauen und Augen bleiben unberührt)

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.3 else -1 if _v <= -0.5 else 0)
# s → (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite)
POSEN = {-1: ({2}, {}, 1), 0: ((), {}, 0), 1: ((), {4: 1}, 0), 2: ((), {2: 1, 4: 1}, 0)}
assert S[0] == 0
BLINK = {13: 1, 14: 2, 15: 1, 37: 1, 38: 2, 39: 1}

# ── Spritzer: 2×2-Tropfen, Parabelbahn neben dem Kopf (Sprite-Koordinaten der linken oberen Ecke) ──
TROPFEN = [
    dict(x0=-1, x1=-3, y0=-2, hoehe=2, ye=6, off=0, flug=14),                         # links
    dict(x0=13, x1=15, y0=-2, hoehe=2, ye=6, off=2, flug=12),                         # rechts
]


def _bahn(tr, t):
    """Position (x, y) des Tropfens bei t ∈ [0,1]: x linear, y Parabel mit Scheitel `hoehe` über dem Start, Ende bei ye."""
    ya, dy = tr['hoehe'], tr['ye'] - tr['y0']
    a = 2 * ya + math.sqrt(4 * ya * ya + 4 * ya * dy)
    b = a + dy
    return tr['x0'] + (tr['x1'] - tr['x0']) * t, tr['y0'] - a * t + b * t * t


def tropfen_ebene(i):
    e = L.leer(H, W)
    for tr in TROPFEN:
        k = (i - tr['off']) % 24
        if k >= tr['flug']:
            continue
        x, y = _bahn(tr, k / float(tr['flug'] - 1))
        cx, cy = PAD_L + int(round(x)), PAD_T + int(round(y))
        for (dx, dy, c) in L.PUFF_FORMEN['s']:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Tropfen bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = TROPFEN_FARBEN[c]
            e[Y, X, 3] = 255
    return e


def _lid(fig, marke, stufe):
    """Augen schließen: stufe 1 = obere Augenzeile, stufe 2 = beide. Lidfarbe je Pixel = häufigste Körperfarbe im Umkreis von 2 px (ohne Umriss, Braue, Augenfarben)."""
    h, w = fig.shape[:2]
    ist_auge = (marke[..., 3] > 0) & (marke[..., 0] == 250) & (marke[..., 1] == 1)
    ys, xs = np.nonzero(ist_auge)
    neu = fig.copy()
    for y, x in zip(ys, xs):
        if stufe == 1 and marke[y, x, 2] != 5:
            continue
        cnt, dist = {}, {}
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or not fig[yy, xx, 3] or ist_auge[yy, xx]:
                    continue
                c = tuple(int(v) for v in fig[yy, xx, :3])
                if c == UMRISS or c == C_BRAUE or c in AUGEN_FARBEN:
                    continue
                cnt[c] = cnt.get(c, 0) + 1
                dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
        c = max(cnt, key=lambda q: (cnt[q], -dist[q]))
        neu[y, x, :3] = c
    return neu


def figur(i):
    loeschen, doppeln, p = POSEN[S[i]]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loeschen, doppeln=doppeln, p=p, paare=PAAR, x0=PAD_L)
    m, _ = A.koerper_pose(A.zeilen_von(_mark, 0, sh - 1, H, W, PAD_L, PAD_T), loeschen=loeschen, doppeln=doppeln, p=p, paare=PAAR, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    marke, _ = A.auf_leinwand(m, H, BODEN, 0)
    # die Markierfarben sind keine Quellfarben: Augenpixel aus dem Markierungsbild wieder mit den echten Farben füllen
    ist_auge = (marke[..., 3] > 0) & (marke[..., 0] == 250) & (marke[..., 1] == 1)
    assert (fig[ist_auge][:, 3] > 0).all()
    if i in BLINK:
        fig = _lid(fig, marke, BLINK[i])
    return dict(fig=fig, top=top)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(tropfen_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    # Tropfen dürfen den Körper nie berühren (auch nicht über die Ecke)
    for i in range(N):
        t = tropfen_ebene(i)[..., 3] > 0
        k = figs[i][..., 3] > 0
        pk = np.pad(k, 1)
        nah = np.zeros_like(k)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nah |= pk[1 + dy:1 + dy + k.shape[0], 1 + dx:1 + dx + k.shape[1]]
        if (t & nah).any():
            print('Tropfen berührt den Körper in Frame', i, [(int(x), int(y)) for y, x in zip(*np.nonzero(t & nah))][:4])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'splashy-slime')
    L.speichern('splashy-slime', 'Splashy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/splashy-slime-strip.png', frames[::2], spalten=12, scale=8)
