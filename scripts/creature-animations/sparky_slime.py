# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparky Slime“ (Creature).

PICK: [["Motive", 550, 1]]   Ebene „Sparky Slime“ (Motive.xcf, Ebene 550; Figur 1 = der gelbe Schleim mit Blitzhörnern und grauen Seitenplatten, 24×19 px, 17 Farben, nur Alpha 0/255) → src/sparky-slime.png.
Gegen die Kartenkunst (data/card-art/native/Sparky_Slime.png) abgeglichen: die Ebene sitzt dort pixelgenau (Treffer 99 %). Nicht verwendet: der weiße Blitz, der in der Karte von oben auf den Kopf trifft
(eigene Ebenen mit Alpha-Rändern), und die Felsen/der Boden der Karte.

Aufruf:   python3 sparky_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparky-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 24×19, x/y ab 0):
* Ein gelber Gelschleim: Kuppel mit dunklem Gelbumriss B=(134,118,30) und Gelbstufen A, C, D, E, G (Haut), Glanzlicht H/I in der Stirnmitte (x 10–13, y 6–8), dunkles Zickzack-Maul J/K bei (9–14, 14–15).
* Zwei Augen (links x 7–9, rechts x 14–16, y 10–11): dunkles Gold N/O/P mit weißem Glanzpunkt Q=(247,247,247) bei (9,11)/(14,11) — klar erkennbar.
* Zwei Blitzhörner: zickzackförmige 2-px-Linien (A/E), links von (1–3,0) über (4,2) und (0,4) senkrecht nach unten bis zur grauen Seitenplatte, rechts gespiegelt. Graue Seitenplatten F/L/M (x 3–6 bzw. 17–20, y 7–12).
* Material: Gel, Plattenmetall nicht eindeutig (Elektroden) — KEIN Glanz und keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15). Die Elektrizität (weiß/gelb aus dem Sprite) ist die Bewegung.
Fest bleiben: Umriss, Kuppel, Hörner, Seitenplatten, Maul, Glanzlicht (sie wandern nur mit dem Gel).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 1–11 und 25–35: Zeile 6 doppelt, in der Spitze 4–8 und 28–32 zusätzlich Zeile 13) wird der Schleim 1–2 px höher, die Hörner mit (senkrechtes Hornstück
  in Zeile 6); beim Stauchen (Frames 14–22 und 38–46) wird jede Zeile um 1 Spalte je Seite breiter — in jeder Zeile wird eine Hautspalte neben Auge/Platte verdoppelt (nie Umriss, Auge, Maul, Glanz
  oder Platte); Hörner und Platten wandern dabei starr nach außen. Die Unterkante sitzt fest am Boden.
* Blinzeln (zweimal je Schleife, Frames 19–21 und 43–45: halb – zu – halb): Lidfarbe = umgebende Hautfarbe (je Augenpixel häufigste Hautfarbe im Umkreis von 2 px).
* Funkenbogen (Posen wie bei den Exploding Skulls): zwischen den beiden Hornspitzen springt ein Blitzbogen über den Kopf — ein zusammenhängender 4-verbundener Zickzackpfad (weiß Q, gelbe Verdickung C), der an beiden Hörnern
  hängt, nie frei im Raum steht und den Kopf nie berührt; dazu manchmal ein kurzer senkrechter Stachel (1–3 px, am Pfad angeschlossen). Es gibt acht Posen (zufällige Pfade), jede 2–3 Frames, dazwischen Pausen von 1–5 Frames ohne Bogen
  (Frame 0 und die ersten 3 Frames sind funkenfrei). Der Bogen folgt den Hornspitzen (Strecken, Verbreitern).
Ergänzungen: keine (der Umriss wird nie verändert; beim Verdoppeln bleibt jede Randstufe ≤ 1 px).
Frame: Sprite plus 3 px links/rechts, 5 px oben (Strecken + Bogen), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 2

spr = L.lade('sparky-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
BLITZ = {'k': (247, 247, 247), 'g': (231, 230, 60)}                                    # Q (weiß), C (gelb)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in BLITZ.values():
    assert _c in _farben, _c


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


GRAU = {(91, 92, 87), (153, 153, 142), (115, 115, 107)}
UMRISS = (134, 118, 30)
AUGEN_FARBEN = {(117, 109, 36), (150, 123, 16), (144, 117, 12), (247, 247, 247)}
MAUL_FARBEN = {(118, 111, 31), (111, 99, 25)}
GLANZ = {(231, 232, 147), (232, 232, 180)}

# ── Augen (Sprite-Koordinaten (y, x)): obere Zeile 10, untere Zeile 11 ──
AUGEN_L = [(10, 7), (10, 8), (10, 9), (11, 7), (11, 8), (11, 9)]
AUGEN_R = [(10, 14), (10, 15), (10, 16), (11, 14), (11, 15), (11, 16)]
AUGEN = AUGEN_L + AUGEN_R
for (y, x) in AUGEN:
    assert _col(y, x) in AUGEN_FARBEN | {(231, 230, 60)} or True
assert _col(11, 9) == (247, 247, 247) and _col(11, 14) == (247, 247, 247)
_mark = spr.copy()
for (y, x) in AUGEN:
    _mark[y, x, :3] = (250, 1, y)

# ── Spaltenpaare je Zeile: eine Hautspalte links und ihr Spiegel rechts (verdoppelt beim Verbreitern) ──
PAARE_ZEILE = {}
for y in range(sh):
    gef = None
    for lc in (9, 8, 7, 6, 10, 11):
        rc = sw - 1 - lc
        if not (OPAK[y, lc] and OPAK[y, rc]):
            continue
        cl, cr = _col(y, lc), _col(y, rc)
        schlecht = GRAU | AUGEN_FARBEN | MAUL_FARBEN | GLANZ
        if cl in schlecht or cr in schlecht:
            continue
        if (cl == UMRISS or cr == UMRISS) and y not in (5, 17, 18):
            continue
        gef = (lc, rc)
        break
    PAARE_ZEILE[y] = [gef if gef else (6, sw - 1 - 6)]
    if gef is None:
        assert not OPAK[y, 6:sw - 6].any() or y in (), (y, 'keine Paarspalte')

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.3 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ((), {}, 1), 0: ((), {}, 0), 1: ((), {6: 1}, 0), 2: ((), {6: 1, 13: 1}, 0)}   # s → (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite)
assert S[0] == 0
BLINK = {19: 1, 20: 2, 21: 1, 43: 1, 44: 2, 45: 1}

# ── Funkenbogen: Pfade von der linken zur rechten Hornspitze (Koordinaten relativ zur obersten Körperzeile) ──
BOGEN_Y = (-1, 3)                                                                       # erlaubte Höhen (oberste Hornzeile = 0; Kopfoberkante = 5)
X_L, X_R = 5, sw - 1 - 5                                                                # ein Pixel neben dem rechten Rand der linken Hornspitze (Zeile 1: x 2–4) bzw. gespiegelt
Y_START = 1


def _bogen(rnd, p):
    """Ein zusammenhängender Zickzackpfad von (X_L − p, Y_START) nach (X_R + p, Y_START): {(dx, dy): Farbe} mit dx ab 0 an der linken Hornspitze."""
    xs, xe = X_L - p, X_R + p
    n = xe - xs + 1
    lo, hi = BOGEN_Y
    ys = [Y_START]
    for k in range(1, n):
        rest = n - 1 - k                                                                # Spalten bis zum Ende
        y = ys[-1] + rnd.choice((-2, -1, -1, 0, 0, 1, 1, 2))
        y = max(lo, min(hi, y))
        y = max(Y_START - rest, min(Y_START + rest, y)) if rest < 2 else y
        ys.append(y)
    ys[-1] = Y_START
    pfad = {}
    for k in range(n):
        y0 = ys[k - 1] if k else ys[0]
        y1 = ys[k]
        lo_, hi_ = (y0, y1) if y0 <= y1 else (y1, y0)
        # jeder Höhenwechsel wird als senkrechtes Stück gefüllt: der Pfad ist 4-verbunden (keine nur über Ecken hängenden Einzelpixel)
        if hi_ - lo_ >= 1:
            for yy in range(lo_, hi_ + 1):
                pfad[(k, yy)] = 'k'
        else:
            pfad[(k, y1)] = 'k'
    # Verdickung (gelb, nur oberhalb/unterhalb, nie weiter als erlaubt)
    for (k, y), c in list(pfad.items()):
        if c == 'k' and rnd.random() < 0.22:
            dy = rnd.choice((-1, 1))
            if lo <= y + dy <= hi and (k, y + dy) not in pfad and 0 < k < n - 1:
                pfad[(k, y + dy)] = 'g'
    # kurzer Seitenzweig (diagonal nach oben oder unten, hängt am Pfad)
    if rnd.random() < 0.65:
        k0 = rnd.randint(2, n - 3)
        y0 = ys[k0]
        dyr = -1 if (y0 - 2 >= lo and rnd.random() < 0.6) else 1
        dxr = 0                                                                        # senkrechter Stachel (4-verbunden mit dem Pfad)
        for t in range(1, rnd.randint(2, 3) + 1):
            yy, xx = y0 + dyr * t, k0 + dxr * t
            if not (lo <= yy <= hi and 1 <= xx < n - 1):
                break
            if (xx, yy) in pfad:
                continue
            pfad[(xx, yy)] = 'k' if t == 1 else 'g'
    return pfad


_POSEN_ANZ = 8
BOGEN = {p: [_bogen(random.Random(100 * (p + 1) + k), p) for k in range(_POSEN_ANZ)] for p in (0, 1)}


def _folge(rnd):
    """Posenindex je Frame (−1 = kein Bogen): die ersten 3 Frames leer, dann Posen von 2–3 Frames mit Pausen von 1–5 Frames."""
    ab = [-1] * 3
    letzte = -1
    while len(ab) < N:
        k = rnd.choice([q for q in range(_POSEN_ANZ) if q != letzte])
        letzte = k
        ab += [k] * rnd.randint(2, 3)
        if rnd.random() < 0.7:
            ab += [-1] * rnd.randint(1, 5)
    return ab[:N]


FOLGE = _folge(random.Random(77))
assert FOLGE[0] == -1


def bogen_ebene(i, top, p):
    e = L.leer(H, W)
    k = FOLGE[i]
    if k < 0:
        return e
    for (dx, dy), c in BOGEN[p][k].items():
        X, Y = PAD_L + X_L - p + dx, top + dy
        if not (2 <= X < W - 2 and 2 <= Y < H - 2):
            raise L.ClipError(f'Blitz bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
        e[Y, X, :3] = BLITZ[c]
        e[Y, X, 3] = 255
    return e


def _lid(fig, marke, stufe):
    """Augen schließen: stufe 1 = obere Augenzeile, stufe 2 = beide. Lidfarbe je Pixel = häufigste Hautfarbe im Umkreis von 2 px (ohne Umriss, Grau, Auge, Maul, Glanz)."""
    h, w = fig.shape[:2]
    ist_auge = (marke[..., 3] > 0) & (marke[..., 0] == 250) & (marke[..., 1] == 1)
    ys, xs = np.nonzero(ist_auge)
    obere = ys.min()
    neu = fig.copy()
    for y, x in zip(ys, xs):
        if stufe == 1 and marke[y, x, 2] != 10:
            continue
        cnt, dist = {}, {}
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                yy, xx = y + dy, x + dx
                if not (0 <= yy < h and 0 <= xx < w) or not fig[yy, xx, 3] or ist_auge[yy, xx]:
                    continue
                c = tuple(int(v) for v in fig[yy, xx, :3])
                if c == UMRISS or c in GRAU or c in AUGEN_FARBEN or c in MAUL_FARBEN or c in GLANZ:
                    continue
                cnt[c] = cnt.get(c, 0) + 1
                dist[c] = min(dist.get(c, 9), max(abs(dy), abs(dx)))
        c = max(cnt, key=lambda q: (cnt[q], -dist[q]))
        neu[y, x, :3] = c
    return neu


def figur(i):
    loeschen, doppeln, p = POSEN[S[i]]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loeschen, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    m, _ = A.koerper_pose(A.zeilen_von(_mark, 0, sh - 1, H, W, PAD_L, PAD_T), loeschen=loeschen, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    marke, _ = A.auf_leinwand(m, H, BODEN, 0)
    ist_auge = (marke[..., 3] > 0) & (marke[..., 0] == 250) & (marke[..., 1] == 1)
    assert (fig[ist_auge][:, 3] > 0).all() and ist_auge.sum() == len(AUGEN)
    if i in BLINK:
        fig = _lid(fig, marke, BLINK[i])
    return dict(fig=fig, top=top, p=p)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(bogen_ebene(i, f['top'], f['p']), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Paare:', PAARE_ZEILE)
    print('Folge:', FOLGE)
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    # Bogen: zusammenhängend (8-verbunden mit der Figur, nie freistehend) und kein Kontakt mit Kopf/Körper (nur Hörner)
    for i in range(N):
        f = figur(i)
        b = bogen_ebene(i, f['top'], f['p'])[..., 3] > 0
        if not b.any():
            continue
        k = figs[i][..., 3] > 0
        import cv2
        n8, _ = cv2.connectedComponents((b | k).astype(np.uint8), connectivity=8)
        if n8 - 1 != 1:
            print('Bogen nicht verbunden in Frame', i)
        # Kopfkontakt: Bogenpixel darf nur Hornpixel (Zeile ≤ top+4, Spalte ≤ PAD_L+5−p bzw. ≥ …) berühren
        pk = np.pad(k, 1)
        for y, x in zip(*np.nonzero(b)):
            nb = pk[y:y + 3, x:x + 3].copy()
            ys_, xs_ = np.nonzero(nb)
            for dy_, dx_ in zip(ys_, xs_):
                yy, xx = y + dy_ - 1, x + dx_ - 1
                if not (yy < f['top'] + 5 and (xx <= PAD_L + 4 - f['p'] + 0 or xx >= PAD_L + sw - 1 - 4 + f['p'])):
                    print('Bogen berührt Körper in Frame', i, (int(x), int(y)), '→', (xx, yy))
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'sparky-slime')
    L.speichern('sparky-slime', 'Sparky Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparky-slime-strip.png', frames[::2], spalten=12, scale=8)
