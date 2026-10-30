# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Healer“ (Creature).

Quelle: src/skeleton-healer.png — drei Ebenen aus Motive.xcf, die in der Kartenkunst zusammen die Gruppe bilden (alle drei heißen „Healer Skele“):
  A = Ebene 64 „Healer Skele #2“ (20×24 px, 255 px): stehendes Skelett mit rotem Federbusch, grünen Augen, Handschuhen und Stiefeln — der Heiler,
  B = Ebene 63 „Healer Skele #1“ (14×18 px, 152 px): Totenkopf mit olivgrünem Stahlhelm und grünem Blatt, liegt in der Kunst vor dem Heiler (obenauf),
  C = Ebene 65, Figur 2 (25×17 px, 178 px): liegendes Skelett (der Patient) mit grünen Handschuhen und einem kleinen braunen Häufchen unten links.
Gesamt 40×35 px, 553 Pixel, 38 Farben (src/skeleton-healer.png = Komposit; die Teile liegen einzeln in src/skeleton-healer-a.png / -b.png / -c.png auf derselben Leinwand,
mit ihren verdeckten Pixeln — A hat 32 Pixel unter dem Helmkopf B).
PICK: [["Motive", 64, 1], ["Motive", 63, 1], ["Motive", 65, 2]]  (Deutung der Gruppe unsicher: Heiler + Patient oder nur Heiler; ich animiere alle drei Teile)

Aufruf:   python3 skeleton_healer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-healer.png + .json

Was ist was (x/y im Sprite):
* A (Heiler, x 0–19, y 8–31): roter Federbusch (x 7–12, y 8–11; die Spitze (9–10, 8–9) ist 2×2 hell), Schädel y 12–17 mit grünen Augen (8,15) (7–8,16) und (12,15) (11–12,16),
  Rippen y 18–22, Becken y 23–26, Beine y 27–29, grüne Stiefel (4–6,30–31) und (12–15,28–31); grüner Handschuh unten links (0–3, 23–25) und ein erhobener grüner Handschuh rechts
  (16–19, 13–16) in Kopfhöhe.
* B (Helmkopf, x 10–23, y 0–17): Stahlhelm (Olivtöne (39,43,28), (53,68,47), helle Bänder (148,162,145)/(224,255,245) bei y 3 und y 7), grünes Blatt oben rechts (20–22, 0–3),
  darunter der Schädel mit schwarzen Augenhöhlen und Kiefer.
* C (Patient, x 15–39, y 18–30): liegendes Skelett aus Rippen und Armen (hell/dunkel), grüne Handschuhe bei (21–24, 23–27) und (36–39, 26–29); braunes Häufchen (17–21, 30–34).
Fest bleiben: Helmform, Federbuschform, Handschuhe, Stiefel, das braune Häufchen.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel ausgenommen):
* Heiler A atmet zweistufig 0-1-2-1-0 px (Periode 24): die Rippenzeile y 21 wird 1–2× eingefügt, Kopf und Federbusch heben sich, Becken, Beine und Stiefel bleiben am Boden.
  Der Federbuschspitze (2×2 bei (9–10, 8–9)) wippt seitlich −1/0/+1 px (Periode 16, bleibt an der Buschbasis hängen).
* Blinzeln des Heilers (Lidfarbe = umgebendes Knochenweiß (246,255,255)): die grünen Augenpixel werden 3 Frames weiß, zweimal pro Schleife (Frame 13–15 und 37–39).
* Helmkopf B wippt starr: Hub 0/1 px (Periode 16, dreimal pro Schleife) und langsames Treiben −1/0/+1 px seitlich (Periode 48); das Blatt wippt (die Spitze (22,0) springt für 4 Frames
  nach (21,0), Frame 10–13 und 34–37). B liegt über A; die unter B verdeckten Pixel von A sind aus der Ebene vorhanden (nichts neu gemalt).
* Patient C atmet: die Brustzeile y 25 wird 1× eingefügt (Periode 24, 0/1 px), die obere Brust hebt sich 1 px, unten bleibt alles liegen.
* Heilfunken (Partikel, hinter den Figuren, 8 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen k, o): grüne Kugeln und Funken
  (Farben der Handschuhe/Stiefel) steigen aus der Brust des Patienten auf und treiben zur erhobenen Hand des Heilers, dazu zwei an den Handschuhen unten. Alle bleiben nah an der Figur.
Kein Glanz (Regel 14: Knochen/Stoff sind kein Metall), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` setzt in jeder Pose fehlende Umrisspixel; im Ruhebild nichts.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Figurenrand hinaus, dazu 1 px leerer Rand).
ERGÄNZUNG: keine gemalten Pixel. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 8, 6

spr = L.lade('skeleton-healer')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
A_SP, B_SP, C_SP = L.lade('skeleton-healer-a'), L.lade('skeleton-healer-b'), L.lade('skeleton-healer-c')
_komp = np.zeros_like(spr)
for _t in (C_SP, A_SP, B_SP):
    _m = _t[..., 3] > 0
    _komp[_m] = _t[_m]
assert np.array_equal(_komp, spr), 'Teile ergeben nicht den Sprite'
UMRISS = U.umrissfarben(spr)
col = lambda a, x, y: tuple(int(v) for v in a[y, x, :3])

WEISS = (246, 255, 255)
AUGEN = [(8, 15), (7, 16), (8, 16), (12, 15), (11, 16), (12, 16)]
assert col(A_SP, 8, 15) == (20, 130, 17) and col(A_SP, 7, 16) == (8, 56, 7)
BLATT = (22, 0)
assert col(B_SP, *BLATT) == (0, 90, 0)
BLINZ = {13, 14, 15, 37, 38, 39}
BLATT_FRAMES = {10, 11, 12, 13, 34, 35, 36, 37}
SCHWARZ_AUSSEN = (26, 26, 26)
assert SCHWARZ_AUSSEN in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}

GRUEN1 = {'c': (0, 135, 0), 'r': (0, 90, 0)}          # Kugeln: Kern Handschuhgrün, Rand dunkles Blattgrün
GRUEN2 = {'c': (26, 169, 22), 'r': (20, 130, 17)}     # Funken: helles Grün
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(28, 19)[0], y=P(28, 19)[1], vx=-8, vy=-8, off=0, form='o', wackeln=1),      # aus der Brust des Patienten zur Hand des Heilers
    dict(x=P(24, 19)[0], y=P(24, 19)[1], vx=-5, vy=-6, off=24, form='o', wackeln=1),
    dict(x=P(18, 13)[0], y=P(18, 13)[1], vx=2, vy=-9, off=6, form='o', wackeln=1),       # von der erhobenen Hand
    dict(x=P(1, 22)[0], y=P(1, 22)[1], vx=-1, vy=-7, off=30, form='o', wackeln=1),       # vom Handschuh unten links
]
PUFFS2 = [
    dict(x=P(32, 19)[0], y=P(32, 19)[1], vx=-6, vy=-9, off=12, form='k', wackeln=1),
    dict(x=P(36, 18)[0], y=P(36, 18)[1], vx=-4, vy=-10, off=36, form='k', wackeln=1),
    dict(x=P(20, 15)[0], y=P(20, 15)[1], vx=1, vy=-7, off=18, form='k', wackeln=1),
    dict(x=P(3, 21)[0], y=P(3, 21)[1], vx=-1, vy=-8, off=42, form='k', wackeln=1),
]


def teil(a):
    return L.platz(a, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n_a = U.stufe(i, 24, 2)                                      # Heiler atmet 0-1-2-1-0
    n_c = int(round(U.buckel(i, 0, 24, n=24)))                    # Patient atmet 0/1
    dy_b = -int(round(U.buckel(i, 0, 16, n=16)))                  # Helmkopf wippt 0/1 px (Periode 16)
    dx_b = U.stufe(i, N, 2, form='sin') - 1                       # langsames Treiben −1/0/+1
    tip = U.stufe(i, 16, 2, form='sin') - 1                       # Federbuschspitze −1/0/+1

    # --- A: Heiler ---
    pa = teil(A_SP)
    if tip:                                                      # Spitze (2×2 bei (9–10, 8–9)) seitlich, bleibt an Zeile y 10 (x 7–12) hängen
        for y in (8, 9):
            row = pa[GPT + y].copy()
            pa[GPT + y] = 0
            for x in range(W):
                if row[x, 3]:
                    pa[GPT + y, x + tip] = row[x]
    if i in BLINZ:
        for (x, y) in AUGEN:
            pa[GPT + y, GPL + x, :3] = WEISS
    if n_a:
        pa = L.streck_zeile(pa, GPT + 21, n_a)
    # --- B: Helmkopf (Blatt-Spitze springt für ein paar Frames) ---
    pb = teil(B_SP)
    if i in BLATT_FRAMES:
        pb[GPT + BLATT[1], GPL + BLATT[0] - 1] = pb[GPT + BLATT[1], GPL + BLATT[0]]
        pb[GPT + BLATT[1], GPL + BLATT[0]] = 0
    # --- C: Patient atmet ---
    pc = teil(C_SP)
    if n_c:
        pc = L.streck_zeile(pc, GPT + 25, n_c)
    koerper = L.zusammen(H, W, [(pc, 0, 0), (pa, 0, 0), (pb, dx_b, dy_b)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ_AUSSEN)
    if nur == 'koerper':
        return koerper
    k1 = _glut(H, W, i, N, PUFFS1, GRUEN1)
    k2 = _glut(H, W, i, N, PUFFS2, GRUEN2)
    return L.zusammen(H, W, [(k1, 0, 0), (k2, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('skeleton-healer', 'Skeleton Healer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-healer-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
