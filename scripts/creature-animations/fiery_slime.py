# -*- coding: utf-8 -*-
"""Idle-Animation für „Fiery Slime“ (Creature).

PICK: [["Motive", 484, 1]]
Quelle: src/fiery-slime.png — Ebene „Fiery Slime“ (18×23 px, 13 Farben) aus Motive.xcf.
Nicht verwendet: die einzelnen Flammenbüschel der Ebene 483 („Ebene #545“), die in der Kartenkunst frei um den Schleim stehen
(Kunst-Beiwerk, keine Creature); der Sprite 484 trägt sein Feuer schon selbst.

Aufruf:   python3 fiery_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fiery-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Feuer (Zeilen 0–13): Flammenzungen mit dunkelrotem Rand A=(165,9,10), orangem Körper B/J/K, gelb-orangen Lichtern G und gelbem Kern
  I=(231,255,15) (Kerne bei (3–4,9–10), (3,10–12), (8–10,9), (13–15,10–12)); hohe dünne Spitze bei (4,0–3) und (14,1–2); seitlich
  laufen die Flammen links (0–3) und rechts (14–17) bis zur Zeile 14 herunter. Die orange glühende „Kuppel“ (J, K, E) bei
  (4–13, 11–13) ist die Oberseite des Schleims im Feuer.
* Schleimkörper (Zeilen 14–22): roter Gelkörper mit sehr dunklem Umriss F=(31,15,15); Augen = zwei dunkle 3×2-Flecken (5–7, 15–16) und
  (10–12, 15–16) ohne Lichtpunkt; Mund = breites dunkles Band (6–13, 18–19); orange Glanzlichter K bei (4–6, 20) und (9–11, 21); unten
  die breite Pfütze (Zeilen 19–22).
Fest bleiben: Mund, Pfützenkontur, Kuppelglühen unterhalb der Flammenbasis (Zeilen 10–13 werden nur eingefärbt, nicht verschoben).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Flammen züngeln: jede Flammenspalte wächst/schrumpft an der Spitze um bis zu ±2 px (zwei überlagerte Wellen, Perioden 12 und 8
  Frames, benachbarte Spalten phasenverschoben) und die Spitzen lehnen sich seitlich bis ±2 px (Periode 24); die Basis (ab Zeile 10) steht fest,
  jede Spalte bleibt mit der Basis verbunden. Beim Strecken des Körpers werden die Flammen länger, beim Stauchen kürzer.
* Glut-Fluss: ein Helligkeitsmuster läuft nach oben durch die Flammen (Periode 16 Frames): einzelne Pixel rücken eine Stufe auf der
  Flammenrampe E→J→B→G→I heller bzw. I→G→B→J→E dunkler.
* Lichtband: zweimal pro Schleife (Frames 2–12 und 26–36) zieht ein diagonales Glutband über Feuer und Körper (1–2 Stufen heller).
* Körper (Gel): Zeile 17 (zwischen Augen und Mund) und Zeile 14 werden verdoppelt/entfernt, dazu Spalten in der Mitte verdoppelt
  (Stauchung breiter) bzw. am Wangenrand entfernt (Streckung schmaler). Atmen in 12-Frame-Takt, kleiner Hüpfer (Frames 24–31),
  großer Hüpfer (32–47, 3 px) mit Anlauf-Stauchung, gestrecktem Absprung/Fallen und Aufprall.
* Blinzeln: Frames 19–21 und 44–46 (Augenflecken füllen sich mit dem Körperrot, dunkle Lidlinie).
* Glut-Partikel: zehn runde Funken/Kügelchen (1 px, 2×2, 4×4; gelb/orange) lösen sich aus den Flammenspitzen und steigen langsam auf.
Ergänzungen: keine gezeichnet. Hinweis: Frame 0 weicht in den Flammen vom Original ab (Züngeln und Glut-Fluss laufen von Anfang an); der
Körper (Zeilen 14–22) entspricht in Frame 0 exakt dem Original.
Nähte (Regel 11): Feuer und Körper liegen auf Zeile 13/14 vertikal 4-verbunden; jede Flammenspalte bleibt mit der festen Basis verbunden;
je Frame prüft das Skript, dass die Figur aus genau einem 4-zusammenhängenden Teil besteht und kein Körperrandpixel ohne Umrissfarbe frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 14, 3

spr = L.lade('fiery-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
KOERPER_Y0 = 14                              # erste Körperzeile; darüber (0–13) das Feuer
BASIS = 10                                   # ab dieser Zeile steht die Flamme starr

# ── Farben der Quelle ──
FA, FB, FC, FD, FE, FF, FG, FH, FI, FJ, FK, FL, FM = (165, 9, 10), (212, 89, 9), (181, 25, 26), (150, 6, 5), (195, 57, 31), (31, 15, 15), \
    (231, 156, 15), (57, 18, 19), (231, 255, 15), (206, 78, 3), (220, 94, 17), (100, 4, 5), (58, 19, 20)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for c in (FA, FB, FC, FD, FE, FF, FG, FH, FI, FJ, FK, FL, FM):
    assert c in _farben
FLAMME_HELL = {FE: FJ, FJ: FB, FB: FG, FK: FG, FG: FI}       # eine Stufe heller auf der Flammenrampe
FLAMME_DUNKEL = {FI: FG, FG: FB, FB: FJ, FK: FJ, FJ: FE}
KOERPER_HELL = {FD: FC, FC: FE, FE: FJ, FJ: FB}              # Körperrot glüht auf
GLUT_C, GLUT_R = FI, FG
UMRISS_KOERPER = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(A.randpixel(spr))) if y >= KOERPER_Y0}

AUGEN = [(5, 15), (6, 15), (7, 15), (5, 16), (6, 16), (7, 16), (10, 15), (11, 15), (12, 15), (10, 16), (11, 16), (12, 16)]

# ── Zeitachsen (Frame → Wert), N = 48 ──
S = [0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 0,                                    # 0–11 Atmen
     0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0,                                    # 12–23 Atmen (versetzt)
     -1, -1, 1, 1, -1, 1, 0, 0,                                                # 24–31 kleiner Hüpfer
     -1, -2, -2, 2, 2, 1, 0, 1, 2, 2, -2, -1, 1, 0, 0, 0]                      # 32–47 großer Hüpfer
LIFT = {26: 1, 27: 1, 35: 1, 36: 2, 37: 3, 38: 3, 39: 3, 40: 2, 41: 1}
BLINZELN = {19: 1, 20: 2, 21: 1, 44: 1, 45: 2, 46: 1}
SWEEPS = [2, 26]
assert len(S) == N

POSEN = {                                                                       # s → (löschen, doppeln, p)
    -2: ({0, 3}, (), 1), -1: ({3}, (), 1), 0: ((), (), 0), 1: ((), {3}, 0), 2: ((), {0: 1, 3: 1}, -1),
}
PAARE_BREIT = ((8, 9), (7, 10))
PAARE_SCHMAL = ((3, 14),)


def flammenhoehe(x, i, s):
    """Zusatzhöhe der Flammenspalte x in Frame i (Pixel, −2…+3): zwei Wellen, benachbarte Spalten phasenverschoben."""
    v = 1.5 * math.sin(2 * math.pi * i / 12 - 0.9 * x) + 0.8 * math.sin(2 * math.pi * i / 8 + 1.7 * x) + 0.7 * s
    return int(round(v))


def neigung(i):
    return 1.9 * math.sin(2 * math.pi * i / 24)


def sprite_mit_effekten(i):
    """Sprite (Quellkoordinaten) mit Glut-Fluss in den Flammen, Lichtband, Blinzeln."""
    sp = spr.copy()
    yy, xx = np.mgrid[0:sh, 0:sw]
    feuer = yy < KOERPER_Y0
    v = np.sin(2 * math.pi * i / 16 + 0.95 * yy + 0.45 * xx)                    # läuft nach oben
    sp = A.farb_schritt(sp, FLAMME_HELL, feuer & (v > 0.55))
    sp = A.farb_schritt(sp, FLAMME_DUNKEL, feuer & (v < -0.55))
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 10:
            t = 2 + 3 * (i - s0)
            band = (xx + yy >= t) & (xx + yy < t + 4)
            kern = (xx + yy >= t + 1) & (xx + yy < t + 3)
            sp = A.farb_schritt(sp, FLAMME_HELL, feuer & band)
            sp = A.farb_schritt(sp, FLAMME_HELL, feuer & kern)
            sp = A.farb_schritt(sp, KOERPER_HELL, ~feuer & band)
            sp = A.farb_schritt(sp, KOERPER_HELL, ~feuer & kern)
    b = BLINZELN.get(i, 0)
    if b:
        for (x, y) in AUGEN:
            if y == 15:
                sp[y, x, :3] = FD
            else:
                sp[y, x, :3] = FD if b == 1 else FH
    return sp


def feuer_ebene(sp, i, s, dy):
    """Feuer (Zeilen 0–13): Spalten wachsen/schrumpfen an der Spitze, Spitzen lehnen sich; Basis ab Zeile BASIS starr."""
    f = L.platz(np.where((np.arange(sh)[:, None, None] < KOERPER_Y0), sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    out = L.leer(H, W)
    b = PAD_T + BASIS
    for x in range(W):
        col = f[:, x, 3]
        if not col.any():
            continue
        ys = np.nonzero(col)[0]
        t0 = int(ys.min())
        out[b:, x] = f[b:, x]
        if t0 >= b:
            continue
        n = b - t0
        d = flammenhoehe(x - PAD_L, i, s)
        n2 = max(2, n + d)
        y0 = b - n2
        for y in range(y0, b):
            src = t0 + (y - y0) * n // n2
            out[y, x] = f[src, x]
    # Spitzen lehnen sich: Zeilen oberhalb der Basis wandern mit Abstand zur Basis
    lean = neigung(i)
    res = L.leer(H, W)
    for y in range(H):
        xs = np.nonzero(out[y, :, 3])[0]
        if not len(xs):
            continue
        dx = 0 if y >= b else int(round(lean * ((b - y) / float(BASIS)) ** 1.0))
        if y < b:
            dx = max(-2, min(2, dx))
        if xs.min() + dx < 0 or xs.max() + dx >= W:
            raise L.ClipError(f'Feuerzeile {y} würde um {dx} aus der Leinwand')
        for x in xs:
            res[y, x + dx] = out[y, x]
    return L.versetze(res, 0, dy)


def figur(i):
    sp = sprite_mit_effekten(i)
    s = S[i]
    loesch, dopp, p = POSEN[s]
    koerper = A.zeilen_von(sp, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    if p >= 0:
        z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p, paare=PAARE_BREIT, x0=PAD_L)
    else:
        z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p, paare=PAARE_SCHMAL, x0=PAD_L)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    fe = feuer_ebene(sp, i, s, top - KOERPER_Y0 - PAD_T)
    fig = L.zusammen(H, W, [(kb, 0, 0), (fe, 0, 0)])
    return dict(fig=fig, fe=fe, top=top, kb=kb)


EMBERS = [
    dict(x=PAD_L + 3, y=PAD_T + 4, vx=-2, vy=-12, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 14, y=PAD_T + 2, vx=2, vy=-12, off=2, form='s', wackeln=1),
    dict(x=PAD_L + 8, y=PAD_T + 3, vx=-1, vy=-13, off=5, form='o', wackeln=2),
    dict(x=PAD_L + 11, y=PAD_T + 4, vx=1, vy=-11, off=7, form='k', wackeln=1),
    dict(x=PAD_L + 1, y=PAD_T + 8, vx=-3, vy=-10, off=9, form='k', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 9, vx=3, vy=-10, off=11, form='s', wackeln=1),
    dict(x=PAD_L + 5, y=PAD_T + 2, vx=1, vy=-12, off=14, form='k', wackeln=1),
    dict(x=PAD_L + 12, y=PAD_T + 3, vx=-1, vy=-13, off=16, form='o', wackeln=2),
    dict(x=PAD_L + 7, y=PAD_T + 5, vx=1, vy=-10, off=19, form='k', wackeln=1),
    dict(x=PAD_L + 15, y=PAD_T + 5, vx=2, vy=-11, off=21, form='k', wackeln=1),
]
EMBERFARBEN = {'c': GLUT_C, 'r': GLUT_R}


def frame(i):
    f = figur(i)
    glut = L.puff_ebene(H, W, i, 24, EMBERS, EMBERFARBEN)
    return L.zusammen(H, W, [(glut, 0, 0), (f['fig'], 0, 0)])


def koerper_offen(f):
    """Körper-Randpixel (ohne Feuerpixel) mit einer Farbe, die am Körper der Quelle nie am Rand liegt."""
    r = A.randpixel(f['fig'])
    out = []
    for y, x in zip(*np.nonzero(r)):
        if f['fe'][y, x, 3] or y < f['top']:
            continue
        c = tuple(int(v) for v in f['fig'][y, x, :3])
        if c not in UMRISS_KOERPER and c not in KOERPER_HELL.values():
            out.append((int(x), int(y), c))
    return out


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    k0 = figs[0][PAD_T + KOERPER_Y0:] == ref[PAD_T + KOERPER_Y0:]
    print('Körper in Frame 0 = Original:', bool(k0.all()), '| Flammen weichen in', int((figs[0][:PAD_T + KOERPER_Y0] != ref[:PAD_T + KOERPER_Y0]).any(axis=2).sum()), 'Pixeln ab (Züngeln)')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = [(i, koerper_offen(fs[i])) for i in range(N) if koerper_offen(fs[i])]
    print('offene Körperkanten (Frame, [(x, y, Farbe)]):', offen if offen else 'keine')
    A.ausdruck_pruefen(figs, spr, 'fiery-slime', erlaubt=list(FLAMME_HELL.values()) + list(FLAMME_DUNKEL.values()) + list(KOERPER_HELL.values()))
    L.speichern('fiery-slime', 'Fiery Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/fiery-slime-strip.png', frames[::2], spalten=12, scale=4)
