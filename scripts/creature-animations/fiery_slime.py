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
Fest bleiben: Mund, Pfützenkontur, die Fußpunkte der Flammenzungen und die Kuppel (Zeilen 10–13).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Feuer (Regel 15), ganz neu gezeichnet mit dem wiederverwendbaren Modul anim_feuer.py (Schnittstelle im Kopf dieser Datei):
  neun Flammenzungen (Fuß wie im Original, Höhe 9–14 px, unten 3–5 px breit), jede aus fünf verschachtelten Farbschichten — dunkelrote Außenhaut A,
  rote Haut C, oranger Körper B, gelb-orange G, gelber Kern I. JEDE Schicht hat in jeder Pose eigene Höhe, Breite und seitliche Verschiebung:
  die Kerne wandern auf und ab und hin und her, die Farbgrenzen steigen und fallen (auch in den unteren Flammenzeilen 6–13), die Zungen biegen
  sich nach links/rechts (mäßige Neigung + S-Kurve), wachsen und schrumpfen; breite Zungen spalten selten kurz ihre Spitze.
  Kompakte Formen (Nutzerwunsch): alles, was dünner als 2 px ist, wird abgeschnitten (anim_feuer `faden`): die dunkelrote Außenhaut ist nie
  ein 1-px-Faden länger als 2 px (geprüft über alle 48 Frames: längster Faden 2), die Zungen laufen oben spitz zu.
  Jede Zunge hat eine eigene Folge aus 12 Posen zu je 2–3 Frames (Zufallsfolge, gegeneinander versetzt, nahtlos über 48 Frames).
  Die Basis steht fest: die Fußpunkte der Zungen und die orange Schleimkuppel (feste Pixel, Zeilen 10–13 des Sprites) ändern sich nicht.
  Beim Strecken des Körpers werden alle Zungen etwas länger, beim Stauchen kürzer.
* Funken: Fällt eine hohe Zunge um ≥ 4 px zurück, reißt ihre Spitze ab und steigt als runder Funke (1 px) langsam auf (12 Frames,
  leicht pendelnd); er kühlt ab: gelb → gelb-orange → orange → rot (Farben I, G, B, A des Sprites).
* Körper (Gel): Zeile 17 (zwischen Augen und Mund) und Zeile 14 werden verdoppelt/entfernt, dazu Spalten in der Mitte verdoppelt
  (Stauchung breiter); beim Strecken bleibt die Breite (das Feuer darüber ist so breit wie der Körper). Atmen im 12-Frame-Takt, kleiner Hüpfer (Frames 24–31), großer
  Hüpfer (32–47, 3 px) mit Anlauf-Stauchung, gestrecktem Absprung/Fallen und Aufprall.
* Blinzeln: Frames 19–21 und 44–46 (Augenflecken füllen sich mit dem Körperrot, dunkle Lidlinie).
* Kein Lichtband, keine Glitzersterne (Regel 14: Feuer glänzt nicht, es flackert).
Ergänzungen: Brückenpixel in Außenhautfarbe A, wo eine schräg gestellte dünne Spitze nur über eine Pixelecke hängt (anim_feuer). Hinweis: Das
Feuer wird neu gezeichnet und weicht deshalb schon in Frame 0 vom Original ab; der Körper (Zeilen 14–22) ist in Frame 0 exakt das Original.
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


# ── Feuer: verschachtelte Flammenzungen (anim_feuer) ──
import anim_feuer as FEU

# Zungen in Sprite-Koordinaten (x, Fußzeile, Höhe, Halbbreite am Fuß); Höhe/Lage entsprechen den Zungen des Originals
ZUNGEN_SPRITE = [(1.2, 12, 11, 2.0), (3.4, 12, 14, 2.0), (4.8, 11, 11, 1.6), (6.8, 10, 11, 2.0), (9.0, 10, 10, 2.0),
                 (11.2, 10, 12, 2.0), (13.2, 11, 13.5, 2.0), (15.2, 12, 14, 2.0), (16.9, 12, 9, 1.6)]
yy_, xx_ = np.mgrid[0:sh, 0:sw]
KUPPEL = (((yy_ >= 11) & (yy_ <= 12) & (xx_ >= 4) & (xx_ <= 13)) | ((yy_ == 10) & (xx_ >= 6) & (xx_ <= 11)) | (yy_ == 13)) & (spr[..., 3] > 0)   # feste Schleimkuppel im Feuer (Zeile 13 ganz)
KUPPEL_C = np.zeros((H, W), bool)
KUPPEL_C[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = KUPPEL
RAMPE = {'rand': FA, 'rot': FC, 'orange': FB, 'gelb': FG, 'hell': FI}
FEUER = FEU.Feuer(H, W, [FEU.Zunge(x + PAD_L, b + PAD_T, h, w) for (x, b, h, w) in ZUNGEN_SPRITE], RAMPE, n=N, seed=11, posen=12,
                  amplitude=1.0, sperre=KUPPEL_C)


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
    dy = top - KOERPER_Y0 - PAD_T
    flamme = FEUER.ebene(i, hoehen_bonus=int(round(0.6 * s)))
    kuppel = L.platz(np.where(KUPPEL[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    fe = L.versetze(L.zusammen(H, W, [(flamme, 0, 0), (kuppel, 0, 0)]), 0, dy)
    fig = L.zusammen(H, W, [(kb, 0, 0), (fe, 0, 0)])
    return dict(fig=fig, fe=fe, top=top, kb=kb)


def frame(i):
    f = figur(i)
    funken = FEUER.funken(i, dy=koerper_dy)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (funken, 0, 0)])


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
    k0 = figs[0][PAD_T + KOERPER_Y0:] == ref[PAD_T + KOERPER_Y0:]
    print('Körper in Frame 0 = Original:', bool(k0.all()), '(das Feuer wird neu gezeichnet und weicht ab)')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = [(i, koerper_offen(fs[i])) for i in range(N) if koerper_offen(fs[i])]
    print('offene Körperkanten (Frame, [(x, y, Farbe)]):', offen if offen else 'keine')
    print('Zungen:', len(FEUER.zungen), '| Funken pro Schleife:', len(FEUER.ereignisse))
    A.ausdruck_pruefen(figs, spr, 'fiery-slime')
    L.speichern('fiery-slime', 'Fiery Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/fiery-slime-strip.png', frames[::2], spalten=12, scale=4)
