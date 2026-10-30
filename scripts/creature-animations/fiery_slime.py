# -*- coding: utf-8 -*-
"""Idle-Animation für „Fiery Slime“ (Creature).

PICK: [["Motive", 484, 1]]
Quelle: src/fiery-slime.png — Ebene „Fiery Slime“ (18×23 px, 13 Farben) aus Motive.xcf.
Nicht verwendet: die einzelnen Flammenbüschel der Ebene 483 („Ebene #545“), die in der Kartenkunst frei um den Schleim stehen
(Kunst-Beiwerk, keine Creature); der Sprite 484 trägt sein Feuer schon selbst.

Aufruf:   python3 fiery_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fiery-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Feuer (Zeilen 0–13): zehn Flammenzungen als senkrechte Streifen — dunkelroter Rand A=(165,9,10) oben/seitlich, darunter oranger Körper
  B/J/K, gelb-orange Lichter G, gelber Kern I=(231,255,15) am Fuß der Zungen (Kerne bei (3–4, 9–10), (3, 10–12), (13–15, 10–12));
  die hohe dünne Spitze bei (4, 0–3) und (14, 1–2); seitlich laufen die Flammen links (0–3) und rechts (14–17) bis Zeile 14 herunter.
  Die orange glühende „Kuppel“ (J, K, E) bei (4–13, 11–13) ist die Oberseite des Schleims im Feuer.
* Schleimkörper (Zeilen 14–22): roter Gelkörper mit sehr dunklem Umriss F=(31,15,15); Augen = zwei dunkle 3×2-Flecken (5–7, 15–16) und
  (10–12, 15–16) ohne Lichtpunkt; Mund = breites dunkles Band (6–13, 18–19); orange Glanzlichter K bei (4–6, 20) und (9–11, 21) (nasse
  Schleimlichter, kein Metallglanz); unten die breite Pfütze (Zeilen 19–22).
Fest bleiben: Mund, Pfützenkontur, die Basis des Feuers ab Zeile 10 und die Kuppel (Zeilen 10–13: breit und ruhig).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Feuer (Regel 15): Die Basis (ab Zeile 10) steht breit und ruhig; zehn Zungen steigen daraus spitz nach oben und flackern unregelmäßig:
  jede Zunge hat ihre eigene Folge von etwa 18 Höhenposen (−3 … +4 px gegenüber dem Original) zu je 2–3 Frames, gegeneinander versetzt
  und mit festem Zufallsstart (Frame 0 = Original). Jede Spalte wird dabei nur gestreckt oder gestaucht (Pixel nahe der Basis bleiben),
  so wandern Farben mit der Zunge: gelber Kern unten, oranger Körper, roter Rand an der Spitze. Beim Strecken des Körpers werden alle
  Zungen etwas länger, beim Stauchen kürzer.
* Funken: Fällt eine hohe Zunge (≥ +2 px) um ≥ 3 px zurück, reißt ihre Spitze ab und steigt als runder Funke (1 px) langsam auf (12 Frames, leicht pendelnd);
  er kühlt dabei ab: gelb → gelb-orange → orange → rot (Farben I, G, B, A des Sprites).
* Körper (Gel): Zeile 17 (zwischen Augen und Mund) und Zeile 14 werden verdoppelt/entfernt, dazu Spalten in der Mitte verdoppelt
  (Stauchung breiter); beim Strecken bleibt die Breite (das Feuer darüber ist so breit wie der Körper). Atmen im 12-Frame-Takt, kleiner Hüpfer (Frames 24–31), großer
  Hüpfer (32–47, 3 px) mit Anlauf-Stauchung, gestrecktem Absprung/Fallen und Aufprall.
* Blinzeln: Frames 19–21 und 44–46 (Augenflecken füllen sich mit dem Körperrot, dunkle Lidlinie).
* Kein Lichtband, keine Glitzersterne (Regel 14: Feuer glänzt nicht, es flackert).
Ergänzungen: keine gezeichnet. Hinweis: Das Feuer weicht ab Frame 2 vom Original ab (Zungen flackern), Frame 0 ist das Original.
Nähte (Regel 11): Feuer und Körper liegen auf Zeile 13/14 vertikal 4-verbunden; jede Flammenspalte bleibt mit der festen Basis verbunden;
je Frame prüft das Skript, dass die Figur aus genau einem 4-zusammenhängenden Teil besteht und kein Körperrandpixel ohne Umrissfarbe frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 18, 3

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
FUNKEN_FARBEN = [FI, FG, FB, FA]                          # Funke kühlt ab: gelb → gelb-orange → orange → rot
UMRISS_KOERPER = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(A.randpixel(spr))) if y >= KOERPER_Y0}

AUGEN = [(5, 15), (6, 15), (7, 15), (5, 16), (6, 16), (7, 16), (10, 15), (11, 15), (12, 15), (10, 16), (11, 16), (12, 16)]

# ── Zeitachsen (Frame → Wert), N = 48 ──
S = [0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0, 0,                                    # 0–11 Atmen
     0, 0, 1, 1, 1, 0, 0, -1, -1, -1, 0, 0,                                    # 12–23 Atmen (versetzt)
     -1, -1, 1, 1, -1, 1, 0, 0,                                                # 24–31 kleiner Hüpfer
     -1, -2, -2, 2, 2, 1, 0, 1, 2, 2, -2, -1, 1, 0, 0, 0]                      # 32–47 großer Hüpfer
LIFT = {26: 1, 27: 1, 35: 1, 36: 2, 37: 3, 38: 3, 39: 3, 40: 2, 41: 1}
BLINZELN = {19: 1, 20: 2, 21: 1, 44: 1, 45: 2, 46: 1}
assert len(S) == N

POSEN = {                                                                       # s → (löschen, doppeln, p)
    -2: ({0, 3}, (), 1), -1: ({3}, (), 1), 0: ((), (), 0), 1: ((), {3}, 0), 2: ((), {0: 1, 3: 1}, 0),
}
PAARE_BREIT = ((8, 9), (7, 10))
PAARE_SCHMAL = ((3, 14),)


def koerper_dy(i):
    """Verschiebung des Körperkopfes (Zeile 14) gegenüber dem Original — das Feuer sitzt darauf."""
    loesch, dopp, p = POSEN[S[i]]
    n = (sh - KOERPER_Y0) - len(loesch) + (sum(dopp.values()) if isinstance(dopp, dict) else len(dopp))
    top = BODEN - LIFT.get(i, 0) - n + 1
    return top - KOERPER_Y0 - PAD_T


# ── Flammenzungen: Spaltengruppen, jede mit eigener unregelmäßiger Höhenfolge ──
ZUNGEN = [(0, 1), (2, 3), (4, 4), (5, 6), (7, 8), (9, 10), (11, 12), (13, 13), (14, 15), (16, 17)]
SPITZ = {2}                                                                     # die hohe dünne Spitze: größerer Ausschlag


def _hoehenfolge(g):
    """48 Frames Höhenversatz (Pixel gegenüber dem Original) für Zunge g: Posen zu je 2–3 Frames, Start (Frame 0) = Original."""
    rnd = random.Random(1000 + 37 * g)
    werte = [-3, -2, -1, 0, 0, 1, 1, 2, 2, 3, 4] if g in SPITZ else [-2, -1, -1, 0, 0, 1, 1, 2, 2, 3]
    folge, posen = [], []
    d, dauer = 0, 2 + (g % 2)                                                   # Frame 0: Originalhöhe
    while len(folge) < N:
        posen.append((len(folge), d))
        folge += [d] * dauer
        neu = d
        while neu == d or abs(neu - d) > 3:                                     # kein Sprung über 3 px
            neu = rnd.choice(werte)
        d = neu
        dauer = rnd.choice((2, 3))
    return folge[:N], posen


ZUNGENFOLGE = [_hoehenfolge(g) for g in range(len(ZUNGEN))]
ZUNGE_VON_SPALTE = {x: g for g, (x0, x1) in enumerate(ZUNGEN) for x in range(x0, x1 + 1)}


def zungenhoehe(x, i, s):
    """Höhenversatz der Flammenspalte x in Frame i (−3 … +5 px)."""
    return ZUNGENFOLGE[ZUNGE_VON_SPALTE[x]][0][i] + int(round(0.6 * s))


def sprite_mit_effekten(i):
    sp = spr.copy()
    b = BLINZELN.get(i, 0)
    if b:
        for (x, y) in AUGEN:
            if y == 15:
                sp[y, x, :3] = FD
            else:
                sp[y, x, :3] = FD if b == 1 else FH
    return sp


def spaltenkopf(x, i, s):
    """(Oberkante der Flammenspalte x in Quellkoordinaten, neue Länge der Spitzenzone) oder None."""
    ys = np.nonzero(spr[:KOERPER_Y0, x, 3])[0]
    t0 = int(ys.min())
    if t0 >= BASIS:
        return None
    n = BASIS - t0
    return t0, n, max(2, n + zungenhoehe(x, i, s))


def feuer_ebene(sp, i, s, dy):
    """Feuer (Zeilen 0–13): jede Spalte wird in der Spitzenzone (über Zeile BASIS) gestreckt/gestaucht, die Basis steht starr."""
    f = L.platz(np.where((np.arange(sh)[:, None, None] < KOERPER_Y0), sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    out = L.leer(H, W)
    b = PAD_T + BASIS
    for xs_ in range(sw):
        x = PAD_L + xs_
        out[b:, x] = f[b:, x]
        k = spaltenkopf(xs_, i, s)
        if k is None:
            continue
        t0, n, n2 = k
        t0c = PAD_T + t0
        y0 = b - n2
        for y in range(y0, b):
            out[y, x] = f[t0c + (y - y0) * n // n2, x]
    out, brueck = A.verbinde4(out)
    BRUECKEN[i_aktuell[0]] = brueck
    # Zungenrand: freiliegende Füllpixel der Spitzenzone bekommen den dunkelroten Flammenrand (wie in der Quelle: Rand A, innen Orange/Gelb)
    for y, x in zip(*np.nonzero(A.randpixel(out))):
        if y < b and tuple(int(v) for v in out[y, x, :3]) not in (FA, FC, FD):
            out[y, x, :3] = FA
    return L.versetze(out, 0, dy)


BRUECKEN = {}
i_aktuell = [0]


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
    i_aktuell[0] = i
    fe = feuer_ebene(sp, i, s, top - KOERPER_Y0 - PAD_T)
    fig = L.zusammen(H, W, [(kb, 0, 0), (fe, 0, 0)])
    return dict(fig=fig, fe=fe, top=top, kb=kb)


# ── Funken: abgerissene Zungenspitzen ──
FUNKEN_LEBEN = 12


def _funken():
    """[(Startframe, x, y, Drift)]: Fällt eine hohe Zunge (≥ +2 px) um ≥ 3 px, reißt ihre (alte) Spitze ab."""
    ev = []
    for g, (x0, x1) in enumerate(ZUNGEN):
        folge, posen = ZUNGENFOLGE[g]
        for k in range(1, len(posen)):
            f, d_neu = posen[k]
            d_alt = folge[f - 1]
            if d_alt >= 2 and d_alt - d_neu >= 3:                                # eine hohe Zunge verliert 3 px: Spitze reißt ab
                i = f - 1
                s = S[i]
                best = min((spaltenkopf(x, i, s) for x in range(x0, x1 + 1) if spaltenkopf(x, i, s)), key=lambda q: q[1] - q[2], default=None)
                if best is None:
                    continue
                xs_ = max((x for x in range(x0, x1 + 1) if spaltenkopf(x, i, s)), key=lambda x: spaltenkopf(x, i, s)[2] - spaltenkopf(x, i, s)[1])
                t0, n, n2 = spaltenkopf(xs_, i, s)
                y = PAD_T + BASIS - n2 + koerper_dy(i) - 1
                ev.append((f, PAD_L + xs_, y, [-1, 0, 1][(g + f) % 3]))
    return ev


FUNKEN = _funken()


def funken_ebene(i):
    e = L.leer(H, W)
    for (f, x0, y0, drift) in FUNKEN:
        a = (i - f) % N
        if a >= FUNKEN_LEBEN:
            continue
        x = x0 + int(round(drift * a / 4.0)) + int(round(0.8 * math.sin(2 * math.pi * a / 8.0)))
        y = y0 - int(round(0.55 * a))
        farbe = FUNKEN_FARBEN[min(3, a * 4 // FUNKEN_LEBEN)]
        pix = [(0, 0)]                                                              # runder Funke (1 px)
        for dx, dy in pix:
            if not (0 <= y + dy < H and 0 <= x + dx < W):
                raise L.ClipError(f'Funke bei ({x + dx},{y + dy}) außerhalb der Leinwand {W}×{H}')
            e[y + dy, x + dx, :3] = farbe
            e[y + dy, x + dx, 3] = 255
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


def koerper_offen(f):
    """Körper-Randpixel (ohne Feuerpixel) mit einer Farbe, die am Körper der Quelle nie am Rand liegt."""
    r = A.randpixel(f['fig'])
    out = []
    for y, x in zip(*np.nonzero(r)):
        if f['fe'][y, x, 3] or y < f['top']:
            continue
        c = tuple(int(v) for v in f['fig'][y, x, :3])
        if c not in UMRISS_KOERPER:
            out.append((int(x), int(y), c))
    return out


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 = Original:', bool((figs[0] == ref).all()))
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = [(i, koerper_offen(fs[i])) for i in range(N) if koerper_offen(fs[i])]
    print('offene Körperkanten (Frame, [(x, y, Farbe)]):', offen if offen else 'keine')
    print('Posen je Zunge:', [len(p[1]) for p in ZUNGENFOLGE], '| Funken pro Schleife:', len(FUNKEN), '| Brückenpixel:', sum(len(v) for v in BRUECKEN.values()))
    A.ausdruck_pruefen(figs, spr, 'fiery-slime')
    L.speichern('fiery-slime', 'Fiery Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/fiery-slime-strip.png', frames[::2], spalten=12, scale=4)
