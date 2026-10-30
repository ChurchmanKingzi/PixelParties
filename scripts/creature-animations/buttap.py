# -*- coding: utf-8 -*-
"""Idle-Animation für „Buttap“ (Creature).

PICK: [["MotiveDeepsea", 153, 2]]   (Sprite 31×36 px, 22 Farben, nur Alpha 0/255, src/buttap.png)
Nicht verwendet: der Mann mit dem roten Stab (Figur 1 derselben Ebene) und der blaue Strudel hinter Buttap (Hintergrund der Karte).

Aufruf:   python3 buttap.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/buttap.png + .json   (Frame 41×46 px, 48 Frames)

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Körper: ein rosa-violetter Gelklumpen (x 7–21, y 8–23, 180 px) mit dunkelviolettem Umriss B=(51,27,51) und fünf Violettstufen
  (C, D, F, H, M), heller auf der rechten Seite. Vier Augen als senkrechte Ovale (3 px breit, 4 px hoch, Spitze oben und unten) aus
  hellblauen Rändern (N, O, P, T, U) mit dunklem Pupillenschlitz (R, S, V): oben links (10–12, 12–15), oben rechts (15–17, 11–14),
  unten links (10–12, 17–20), unten rechts (15–17, 16–19). Die Augen werden aus dem Sprite erkannt als die nicht-violetten Pixel IM Körper
  (Löcher der Violett-Maske), alle vier haben dieselbe Form.
* Vier Kettenarme aus dunkelblauem Umriss A=(41,49,86) mit grauen Gliedern (E, G, L, Q), jeder endet in einem blaugrauen Metallgewicht
  (I, K, J = (74,98,132), (109,128,168), (127,146,188)): oben links (hängt am Körper bei (5–7, 15–17), die Kette läuft links hoch zum Gewicht
  bei (2–7, 4–8), darüber dünne Kettenreste bis Zeile 0), oben rechts (Ansatz (21–23, 11–13), läuft rechts nach unten zum Gewicht bei
  (26–30, 22–26)), unten links (Ansatz (9–10, 22–23), hängt zum Gewicht bei (6–10, 31–35)), unten rechts (Ansatz (18–21, 21–23), hängt zum
  Gewicht bei (20–24, 30–34)). Die Arme sind per 8-Verbund-Komponenten (Sprite ohne Körpermaske) getrennt.
Fest bleiben: Augenform samt Lichtpunkten (die Augen sind starre Auflagen auf dem Gel), Umrissfarben.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Schweben: der ganze Buttap hebt und senkt sich um ±2 px (Periode 24).
* Gel-Körper (Squash & Stretch, an das Schweben gekoppelt): beim Steigen streckt er sich (1–2 zusätzliche Zeilen in der Mitte), beim Sinken
  stampft er breiter (je Zeile 1 Spalte je Seite dazu, ohne Zeile zu verlieren). Verdoppelt werden nur Körperzeilen 15/16 (ohne Details) bzw.
  je Zeile die zwei Füllpixel neben dem Umriss — der Umriss selbst wird nie gedoppelt oder entfernt (keine offene Kante). Die Augen sind
  starr: die oberen wandern mit dem oberen Körper, die unteren mit dem unteren; beim Verbreitern rücken die linken/rechten Augen je 1 px
  nach außen. Die Arme hängen an ihrem Ansatz und gehen mit.
* Kettenarme: jede Kette pendelt als Ganzes seitlich (Zeilenversatz wächst mit dem Abstand zum Ansatz, bis ±3 px an den Gewichten);
  vier verschiedene Takte/Phasen (Perioden 24 und 16), Frame 0 = Original (Versatz der Phase abgezogen).
* Blinzeln: alle vier Augen, Frames 16–18 und 40–42 (Oberlid → zu → Oberlid): die Lidfarbe ist die jeweils umgebende Körperfarbe (je Pixel
  die häufigste Violettstufe in 2 px Umkreis außerhalb des Auges).
* Metallglanz (Regel 14: nur Ketten und Gewichte sind Metall): zweimal pro Schleife (Frames 4–15 und 28–39) zieht ein diagonales Lichtband
  (zwei Stufen auf der Stahlrampe) über die Ketten und Gewichte, danach blitzen vierzackige Glitzersterne an den vier Gewichten auf.
  Der Gelkörper glänzt nicht, Umrisse bleiben.
* Dunst (Partikel): acht kleine runde Violett-Punkte (Formen k/s) steigen hinter dem Körper langsam auf (24 Frames Lebenszeit).
Ergänzungen (Koordinaten im Sprite):
* Verdeckter Körperumriss: unter dem Kettenansatz links liegt der Körperumriss bei (7, 15–17), im Sprite von den Kettenpixeln verdeckt —
  er wird als B ergänzt (hinter dem Arm), damit der Körper beim Gleiten des Arms nicht offen liegt.
* Beim Pendeln können Kettenstücke nur über eine Pixelecke hängen: Brückenpixel in der Farbe des loslösenden Pixels (verbinde4) — das
  gilt auch für die dünnen diagonalen Kettenreste oben links, die im Sprite selbst nur über Ecken hängen (daher weicht Frame 0 an wenigen
  Pixeln vom Original ab, siehe Konsolenausgabe). Frei liegende Kettenfüllpixel bekommen den Umriss A (umriss_ergaenzen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 4

spr = L.lade('buttap')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
ORB_Y0, ORB_Y1 = 8, 23
BODEN = PAD_T + ORB_Y1                       # Leinwandzeile der Körper-Unterkante im Ruhezustand


def _c(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Körper, Augen, Arme aus dem Sprite ableiten ──
PURPLE = {(51, 27, 51), (107, 57, 108), (118, 61, 112), (88, 47, 89), (129, 86, 139), (134, 107, 162)}
_pm = np.zeros((sh, sw), np.uint8)
for _y in range(sh):
    for _x in range(sw):
        if spr[_y, _x, 3] and _c(_x, _y) in PURPLE:
            _pm[_y, _x] = 1
_ff = _pm.copy()
cv2.floodFill(_ff, np.zeros((sh + 2, sw + 2), np.uint8), (0, 0), 2)
ORB = (_ff != 2) & (spr[..., 3] > 0)                                            # Körper samt Augen (Löcher im Violett)
assert int(ORB.sum()) == 180
AUGENMASKE = ORB & (_pm == 0)
_n, _lab = cv2.connectedComponents(AUGENMASKE.astype(np.uint8), connectivity=8)
AUGEN = sorted([[(int(y), int(x)) for y, x in np.argwhere(_lab == k)] for k in range(1, _n)],
               key=lambda pix: (min(y for y, x in pix) // 6, min(x for y, x in pix)))     # oben links, oben rechts, unten links, unten rechts
ARME_ROH = (spr[..., 3] > 0) & ~ORB
_n2, _lab2 = cv2.connectedComponents(ARME_ROH.astype(np.uint8), connectivity=8)
assert _n2 - 1 == 4, 'vier Arme erwartet'
_info = []
for _k in range(1, _n2):
    ys, xs = np.nonzero(_lab2 == _k)
    _info.append((_k, int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())))
_ol = [a for a in _info if a[2] <= 12 and a[3] <= 2][0]
_or = [a for a in _info if a[1] >= 20 and 10 <= a[3] <= 12][0]
_ul = [a for a in _info if a[3] >= 20 and a[2] <= 12][0]
_ur = [a for a in _info if a[3] >= 18 and 17 <= a[1] <= 20][0]
ARM = {'ol': _lab2 == _ol[0], 'or': _lab2 == _or[0], 'ul': _lab2 == _ul[0], 'ur': _lab2 == _ur[0]}
ARMENALLE = ARM['ol'] | ARM['or'] | ARM['ul'] | ARM['ur']
# Ansatzzeile = Pivot des Pendels, Seite (−1 links / +1 rechts), Takt, Phase, Amplitude
ARMDATA = {'ol': dict(pivot=16, seite=-1, P=24, phi=0.0, amp=2.8, attach=16),
           'or': dict(pivot=12, seite=1, P=16, phi=1.3, amp=2.8, attach=12),
           'ul': dict(pivot=22, seite=-1, P=24, phi=2.4, amp=2.8, attach=22),
           'ur': dict(pivot=21, seite=1, P=16, phi=3.6, amp=2.8, attach=21)}
ARMMAXD = {k: max(abs(int(y) - ARMDATA[k]['pivot']) for y in np.nonzero(ARM[k].any(axis=1))[0]) for k in ARM}
RAND0 = A.randpixel(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

# ── Lidfarben: je Augenpixel die häufigste Körperfarbe im Umkreis (außerhalb der Augen) ──
_augenpix = {p for a in AUGEN for p in a}
LID = {}
for (y, x) in _augenpix:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in _augenpix or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not ORB[q] or _c(q[1], q[0]) not in PURPLE:
                continue
            c = _c(q[1], q[0])
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Körperebene (ohne Augen, mit verdecktem Umriss) ──
UMRISS_B = (51, 27, 51)
UMRISS_A = (41, 49, 86)
KOERPER = np.where(ORB[..., None], spr, 0).astype(np.uint8)
for (y, x), c in LID.items():
    KOERPER[y, x, :3] = c
for y in (15, 16, 17):                                                           # verdeckter Körperumriss links unter dem Kettenansatz
    assert not KOERPER[y, 7, 3] and ARM['ol'][y, 7]
    KOERPER[y, 7, :3] = UMRISS_B
    KOERPER[y, 7, 3] = 255
KMASK = KOERPER[..., 3] > 0
PAARE_ZEILE = {}
for k, y in enumerate(range(ORB_Y0, ORB_Y1 + 1)):
    xs = np.nonzero(KMASK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    PAARE_ZEILE[k] = [(l + 2, r - 2)] if r - l >= 5 else [(l + 1, r - 1)]     # Füllpixel neben dem Umriss (nie der Umriss selbst)
    assert PAARE_ZEILE[k][0][0] < PAARE_ZEILE[k][0][1]

# ── Metallrampe (Ketten + Gewichte), Glitzersterne ──
STAHL = {(48, 66, 90): (76, 96, 121), (76, 96, 121): (74, 98, 132), (74, 98, 132): (109, 128, 168), (109, 128, 168): (127, 146, 188),
         (112, 123, 127): (124, 132, 143), (124, 132, 143): (127, 146, 188)}
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(a in _farben and b in _farben for a, b in STAHL.items())
STERN_FARBEN = {'m': (170, 189, 228), 'a': (127, 146, 188), 's': (109, 128, 168)}
STAUBFARBEN = {'c': (134, 107, 162), 'r': (129, 86, 139)}
SWEEPS = [4, 28]
ORTE = {'ol': (5, 5), 'ul': (7, 32), 'or': (29, 23), 'ur': (23, 31)}             # Glitzersterne an den Gewichten (helle J-Pixel)
STERN_LAUF = [0, 1, 2, 1, 0]
STERNE = [(s0 + d, o) for s0 in SWEEPS for (o, d) in (('ol', 0), ('ul', 4), ('or', 6), ('ur', 7))]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


# ── Zeitachsen ──
BOB = [0] * N                                                                    # Nutzer-Feedback: Buttap steht und schwebt nicht (Gel-Körper wächst/staucht vom Boden aus)
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.35 else -1 if _v <= -0.5 else 0)
BLINZELN = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
POSEN = {-1: ((), 1), 0: ((), 0), 1: ({7}, 0), 2: ({7, 8}, 0)}                   # s → (Körperzeilen doppeln (7/8 = Sprite 15/16), Spalten p je Seite)
assert BOB[0] == 0 and S[0] == 0

PUFFS = [
    dict(x=PAD_L + 2, y=PAD_T + 30, vx=-1, vy=-9, off=0, form='s', wackeln=1),
    dict(x=PAD_L + 12, y=PAD_T + 28, vx=1, vy=-9, off=3, form='k', wackeln=1),
    dict(x=PAD_L + 27, y=PAD_T + 28, vx=1, vy=-9, off=6, form='s', wackeln=1),
    dict(x=PAD_L + 5, y=PAD_T + 24, vx=-2, vy=-9, off=9, form='k', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 29, vx=-1, vy=-9, off=12, form='s', wackeln=1),
    dict(x=PAD_L + 25, y=PAD_T + 20, vx=2, vy=-8, off=15, form='k', wackeln=1),
    dict(x=PAD_L + 9, y=PAD_T + 28, vx=1, vy=-9, off=18, form='k', wackeln=1),
    dict(x=PAD_L + 20, y=PAD_T + 27, vx=-1, vy=-9, off=21, form='s', wackeln=1),
]


def armdx(name, y, i):
    """Seitlicher Versatz der Kettenzeile y (Sprite-Koordinate) in Frame i: Pendel, wächst mit dem Abstand zum Ansatz; Frame 0 = Quellform."""
    d = ARMDATA[name]
    frac = abs(y - d['pivot']) / float(ARMMAXD[name])
    ph = 2 * math.pi * i / d['P']
    return int(round(d['amp'] * frac * (math.sin(ph + d['phi']) - math.sin(d['phi']))))


def sprite_mit_effekten(i):
    sp = spr.copy()
    # Lichtband nur auf Metall (Ketten/Gewichte); Umrisse bleiben
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 11:
            t = 6 * (i - s0) - 2
            m = ARMENALLE & ~RAND0
            sp = A.farb_schritt(sp, STAHL, m & (xx + yy >= t) & (xx + yy < t + 5))
            sp = A.farb_schritt(sp, STAHL, m & (xx + yy >= t + 1) & (xx + yy < t + 4))
    return sp


def _arm_dy(f_top, quelle, d, i):
    """Vertikaler Versatz des Arms in Frame i: Ansatz im Körper → folgt dessen Zeilenabbildung; sonst nur das Schweben."""
    if ORB_Y0 <= d['attach'] <= ORB_Y1:
        return f_top + quelle.index(d['attach'] - ORB_Y0) - (PAD_T + d['attach'])
    return -BOB[i]


def figur(i):
    sp = sprite_mit_effekten(i)
    doppeln, p = POSEN[S[i]]
    korper = A.zeilen_von(KOERPER, ORB_Y0, ORB_Y1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(korper, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    kb, top = A.auf_leinwand(z, H, BODEN, BOB[i])

    def pos(row):
        return top + quelle.index(row - ORB_Y0)

    teile = [(kb, 0, 0)]
    # Augen: starre Auflagen; obere Augen wandern mit Zeile 12, untere mit Zeile 17; links/rechts rücken beim Verbreitern je p nach außen
    b = BLINZELN.get(i, 0)
    for k, pix in enumerate(AUGEN):
        cx = sum(x for y, x in pix) / float(len(pix))
        ys = sorted({y for y, x in pix})
        zu = set(ys[:len(ys) // 2]) if b == 1 else set(ys) if b == 2 else set()
        e = L.leer(H, W)
        for (y, x) in pix:
            e[PAD_T + y, PAD_L + x, :3] = LID[(y, x)] if y in zu else spr[y, x, :3]
            e[PAD_T + y, PAD_L + x, 3] = 255
        anker = 12 if k < 2 else 17
        teile.append((e, (-p if cx < 13.5 else p), pos(anker) - (PAD_T + anker)))
    # Arme: starre Aufhängung am Körper (Ansatzzeile), Versatz nach außen um p, Pendel als Zeilenversatz
    armm = np.zeros((H, W), bool)
    for name, d in ARMDATA.items():
        out = L.leer(H, W)
        dxk = -p if d['seite'] < 0 else p
        dyk = _arm_dy(top, quelle, d, i)
        for y, x in zip(*np.nonzero(ARM[name])):
            X, Y = PAD_L + x + armdx(name, y, i) + dxk, PAD_T + y + dyk
            if not (0 <= X < W and 0 <= Y < H):
                raise L.ClipError(f'Armpixel {name} ({X},{Y}) außerhalb der Leinwand {W}×{H}')
            out[Y, X] = sp[y, x]
        armm |= out[..., 3] > 0
        teile.append((out, 0, 0))
    fig = L.zusammen(H, W, teile)
    # Brückenpixel gegen Eck-Kontakte, danach Umriss für frei liegende Füllpixel (Regel 11 / 16)
    fig, brueck = A.verbinde4(fig)
    erlaubt = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(RAND0))}
    fig, neu = A.umriss_ergaenzen(fig, erlaubt, lambda x, y: UMRISS_A if armm[y, x] else UMRISS_B)
    fig, brueck2 = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, top=top, kb=kb, armm=armm, neu=neu, brueck=brueck + brueck2, pfad=pfad, offen=offen, p=p, quelle=quelle)


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        d = ARMDATA[ort]
        dxk = -f['p'] if d['seite'] < 0 else f['p']
        dyk = _arm_dy(f['top'], f['quelle'], d, i)
        A.stern(e, PAD_L + x + armdx(ort, y, i) + dxk, PAD_T + y + dyk, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    dunst = L.puff_ebene(H, W, i, 24, PUFFS, STAUBFARBEN)
    return L.zusammen(H, W, [(dunst, 0, 0), (f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())), '| Arme:', {k: int(v.sum()) for k, v in ARM.items()})
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab; Brückenpixel Frame 0:', fs[0]['brueck'])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs])
    print('Pfadpixel (Lücken) je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    A.ausdruck_pruefen(figs, spr, 'buttap')
    L.speichern('buttap', 'Buttap', frames, MS, prev)
    if prev:
        L.streifen(prev + '/buttap-strip.png', frames[::2], spalten=12, scale=4)
