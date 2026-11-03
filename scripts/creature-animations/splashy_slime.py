# -*- coding: utf-8 -*-
"""Idle-Animation für „Splashy Slime“ (Creature) — Runde 3: er HÜPFT (Hocke → Absprung → Flug → Landung mit Spritzern) statt breiter zu werden.

Nutzerkorrektur (wörtlich): „Splashy [sollte lieber hüpfen statt breiter zu werden]“ — Maßstab: Hardy/Rocky/Infinitely Reproducing Slime.

PICK: [["Motive", 469, 1], ["Motive", 470, 1]]
  Ebene „Splashy Slime“ (Motive.xcf, Ebene 469, 14×9 px: Kopf/Oberkörper, Deckkraft 98 %) UND der größte Teil der Ebene „Ebene #588“ (Ebene 470, bbox (334,118), Deckkraft 60 %): das ist die UNTERE
  KÖRPERHÄLFTE (der breite Wassersockel, x 335–352, y 127–131 der xcf). Sie liegt auf einer eigenen, halbtransparenten Ebene (deshalb erscheint sie auf der Karte durchscheinend). Für die Animation
  wird sie voll deckend (Alpha 255) mit 469 (liegt darüber) zu EINER Figur vereinigt (Regel 22) → src/splashy-slime.png (18×14 px, 12 Farben), gebaut mit anim_slime.py
  (`python3 anim_slime.py splashy-slime`). Die kleinen Wasserspritzer derselben Ebene (sechs Tropfen links/rechts, je 2–4 px) sind keine Körperteile: sie bleiben weg, das Skript zeichnet seine eigenen.
Gegen die Kartenkunst (data/card-art/native/Splashy_Slime.png) abgeglichen: die Ebene 469 sitzt dort pixelgenau (Treffer 100 %) bei (31,22).

Aufruf:   python3 splashy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/splashy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×14, x/y ab 0):
* Ein blauer Schleim mit dunklem Umriss A=(9,50,74), Blaustufen B, C, D, F (Körper), E=(55,164,228) und H=(66,169,229) (Glanzlicht in der Stirnmitte x 7–10, y 1–3).
* Zwei Augen: je 3×2 px (links x 4–6, rechts x 11–13, y 5–6) aus dunklem Blau/Schwarz mit weißem Glanzpunkt L=(242,253,239) bei (6,6)/(12,6); darüber ein dunkles Brauenband G in Zeile 3–4.
* Mund: das dunkle Band I/J (x 7–12, y 8–11) unter den Augen (liegt im Original so; bleibt fest bis auf die Körperbewegung).
* Untere Körperhälfte (Zeilen 9–13): ein breiter Wassersockel (Zeile 10 am breitesten, x 0–17) mit hellen Glanzstreifen (H/E) und einer Bodenlinie (Zeile 13, x 7–13).
* Material: Gel/Wasser — KEIN Glanz und keine Glitzersterne (Regel 14); keine Flammen (Regel 15).
Fest bleiben: Umriss, Kuppelform, Brauen, Mund, Glanzlicht in der Stirn (sie wandern nur mit dem Gel); der Sockel (Zeilen 9–13) wird nie verformt.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos; Frame 0 = Original), Hüpfen wie bei Hardy/Rocky/Infinitely Reproducing Slime (anim_hupf.py):
* Großer Sprung (Frames 3–22, 5 px hoch): Hocke (Zeilen 7 und 2 — Wangen und Stirn, nie Augen/Brauen/Mund — werden entfernt, der Schleim wird 2 Zeilen niedriger, aber NICHT breiter), Absprung (gestreckt:
  Zeilen 7 und 2 werden mit Texturmischung der Nachbarzeile eingefügt, bis +3 Zeilen), Flug (1–5 px über dem Boden, Parabel, Scheitel 3 Frames), Aufprall (tiefste Hocke), Nachfedern.
  Kleiner Sprung (Frames 27–38, 3 px hoch). Dazwischen Ruhe mit einem kurzen Einatmen (Wangenzeile 7 einmal doppelt).
* Spritzer (Partikel): bei jeder Landung (Frame 17 und 35) schleudert der Aufprall je einen 2×2-Wassertropfen links und rechts vom Sockel nach außen und oben, sie fallen außen am Sockel wieder herab
  (ganze Pixel, Parabelbahn, 7–11 Frames; Glanzpunkt E oben links, Körper C); nie ein einzelner Punkt; die Tropfen berühren den Körper nie.
* Blinzeln (zweimal je Schleife, Frames 24–26 und 42–44: halb – zu – halb, in der Ruhe am Boden): Lidfarbe = umgebende Körperfarbe (je Augenpixel häufigste Körperfarbe im Umkreis von 2 px, ohne Umriss/Braue/Auge).
Ergänzungen: wo ein Randpixel durch Stauchen/Strecken ohne Umriss frei liegt, bekommen die leeren Nachbarfelder den Umriss A (umriss_ergaenzen, Regel 16).
Frame: Sprite plus Platz für Sprung, Streckung und Tropfen (aus dem Ablauf berechnet), ≥ 2 px Rand — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_hupf as Hu

N, MS = 48, 65

spr = L.lade('splashy-slime')
sh, sw = spr.shape[:2]
OPAK = spr[..., 3] > 0
UMRISS = (9, 50, 74)
RAND_FARBEN = A.umrissfarben(spr)
TEST_EBENEN = ('fig',)
C_BRAUE = (3, 14, 28)
TROPFEN_FARBEN = {'c': (55, 164, 228), 'r': (31, 153, 224)}
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in TROPFEN_FARBEN.values():
    assert _c in _farben, _c


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Augen (Sprite-Koordinaten (y, x)); Zeile 5 = obere, Zeile 6 = untere Augenzeile ──
AUGEN_L = [(5, 4), (5, 5), (5, 6), (6, 4), (6, 5), (6, 6)]
AUGEN_R = [(5, 11), (5, 12), (5, 13), (6, 11), (6, 12), (6, 13)]
AUGEN = AUGEN_L + AUGEN_R
AUGEN_FARBEN = {_col(y, x) for (y, x) in AUGEN}
assert (242, 253, 239) in AUGEN_FARBEN and C_BRAUE in AUGEN_FARBEN
# Markierungsbild: dieselbe Körperumformung trägt die Augenpixel mit (Markierfarbe je Augenzeile)
_mark = spr.copy()
for (y, x) in AUGEN:
    _mark[y, x, :3] = (250, 1, y)

# ── Posen (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite): nur Zeilen 2 (Stirn) und 7 (Wangen) ändern sich, Breite nie ──
POSEN = {
    'R': ((), {}, 0),
    'D1': ({7}, {}, 0),
    'D2': ({7, 2}, {}, 0),
    'D3': ({7, 2}, {}, 0),
    'T1': ((), {7: 1}, 0),
    'T2': ((), {7: 1, 2: 1}, 0),
    'T3': ((), {7: 2, 2: 1}, 0),
}
# Spaltenpaare (nur für p ≠ 0 nötig; hier unbenutzt, aber koerper_pose verlangt Angaben): Mittelspalten bzw. Randspalten neben dem Umriss
PAARE_ZEILE = {y: [(7, 10)] for y in range(9)}
PAARE_ZEILE.update({9: [(4, 13)], 10: [(3, 14)], 11: [(4, 13)], 12: [(4, 13)], 13: [(9, 11)]})
SPERRE = tuple(AUGEN_FARBEN | {(9, 48, 70), (13, 69, 102)})                            # Augen-, Brauen-, Mundfarben: nie in eingefügte Zeilen mischen
ABLAUF = Hu.ablauf(N, gross=5, klein=3)
assert ABLAUF[0] == ('R', 0)
LANDUNG = Hu.landungen(ABLAUF)                                                           # Frames des Aufpralls (Spritzer)
BLINK = {24: 1, 25: 2, 26: 1, 42: 1, 43: 2, 44: 1}


def _zeilen(pose):
    lo, do, _ = POSEN[pose]
    return sh - len(lo) + sum(do.values())


# ── Spritzer: 2×2-Tropfen (Sprite-Koordinaten der linken oberen Ecke), Parabel links/rechts neben dem Sockel ──
TROPFEN = [
    dict(x0=-3, x1=-4, y0=10, hoehe=7, ye=11, flug=11),                                 # links, großer Aufprall
    dict(x0=19, x1=20, y0=10, hoehe=6, ye=11, flug=10),                                 # rechts, großer Aufprall
    dict(x0=-3, x1=-4, y0=10, hoehe=4, ye=11, flug=8),                                  # links, kleiner Aufprall
    dict(x0=19, x1=20, y0=10, hoehe=4, ye=11, flug=7),                                  # rechts, kleiner Aufprall
]
START = {0: LANDUNG[0], 1: LANDUNG[0] + 1, 2: LANDUNG[1], 3: LANDUNG[1] + 1}            # Startframe je Tropfen
PAD_L, PAD_R = 6, 6
PAD_T = max(_zeilen(p) + d for p, d in ABLAUF) - sh + 3
PAD_B = 2
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1


def _bahn(tr, t):
    """Position (x, y) des Tropfens bei t ∈ [0,1]: x linear, y Parabel mit Scheitel `hoehe` über dem Start, Ende bei ye."""
    ya, dy = tr['hoehe'], tr['ye'] - tr['y0']
    a = 2 * ya + math.sqrt(4 * ya * ya + 4 * ya * dy)
    b = a + dy
    return tr['x0'] + (tr['x1'] - tr['x0']) * t, tr['y0'] - a * t + b * t * t


def tropfen_ebene(i):
    e = L.leer(H, W)
    for k, tr in enumerate(TROPFEN):
        t0 = (i - START[k]) % N
        if t0 >= tr['flug']:
            continue
        x, y = _bahn(tr, t0 / float(tr['flug'] - 1))
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
    pose, dy = ABLAUF[i]
    fig, top, quelle = Hu.hupf_figur(spr, pose, dy, POSEN, PAARE_ZEILE, SPERRE, H, W, PAD_L, PAD_T, BODEN)
    marke, _, _ = Hu.hupf_figur(_mark, pose, dy, POSEN, PAARE_ZEILE, SPERRE, H, W, PAD_L, PAD_T, BODEN)
    # die Markierfarben sind keine Quellfarben: Augenpixel aus dem Markierungsbild sind in `fig` echte Farben (gleiche Umformung)
    ist_auge = (marke[..., 3] > 0) & (marke[..., 0] == 250) & (marke[..., 1] == 1)
    assert (fig[ist_auge][:, 3] > 0).all()
    if i in BLINK:
        fig = _lid(fig, marke, BLINK[i])
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
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
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    schlecht = A.ausdruck_pruefen(figs, spr, 'splashy-slime')
    L.speichern('splashy-slime', 'Splashy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/splashy-slime-strip.png', frames[::2], spalten=12, scale=8)
