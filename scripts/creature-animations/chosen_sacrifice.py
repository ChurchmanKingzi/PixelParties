# -*- coding: utf-8 -*-
"""Idle-Animation für „Chosen Sacrifice“ (Creature).

Quelle: src/chosen-sacrifice.png — Ebene „Chosen Sacrifice“ (14×29 px, 327 Pixel, 23 Farben, alle deckend) aus MotiveSteamDwarfs.xcf (Ebene 180). Der Treffer-Suchlauf führt die Ebene nicht als
Figur; ich habe sie direkt aus dem Dump genommen. Das Feuer unter der Figur, die Glitzersterne und die zwei Steinfiguren daneben in der Kartenkunst sind andere Ebenen und NICHT Teil dieses Sprites.
PICK: [["MotiveSteamDwarfs", 180, 1]]

Aufruf:   python3 chosen_sacrifice.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chosen-sacrifice.png + .json

Was ist was (x/y im Sprite):
* Goldener Kopfschmuck/Helm (x 0–13, y 0–10): Gold (228,178,30)/(190,148,25)/(179,119,0)/(147,98,0) mit hellen Lichtern (251,242,120) bei (8–9,2), (11,2), (1,3), (7–8,3), (12,3), (8,4), (7,7–8), (8,9), (9,10).
  Links und rechts darin je ein blau-schwarzer Block (x 1–4 und 9–13, y 7–10; Blau (0,32,123)/(0,8,74) mit schwarzem Rahmen) — die AUGEN der Figur.
* Rumpf (x 1–12, y 11–21): hölzerne Säule in Braun (164,98,41)/(180,123,49)/(205,156,82) mit dunklem Umriss (49,24,0), Bauchmitte hell (6–7, 12–15); ein goldener Gürtel (6–7, 19–20) mit hellen Spitzen (6,19) (7,20).
* Blätterrock (x 2–11, y 22–26): grün (65,115,0)/(97,155,0)/(41,65,0); Füße (x 2–11, y 27–28) braun, zwei schwarze Pixel (6–7, 27) dazwischen.
Fest bleiben: Helmform, Rumpfform, Rock- und Fußform.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel und Glanz ausgenommen):
* Schweben zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die ganze Figur steigt starr (die Figur schwebt über dem Feuer der Karte); der Kopf treibt zusätzlich langsam −1/0/+1 px seitlich (Periode 48).
* Blätterrock weht (Zeilen y 22–28): Zeilenversatz bis 1,5 px nach rechts/links, unten stärker, mit Nachlauf (Periode 12, Hüllkurve zweimal pro Schleife), die Aufhängung bei y 21 steht fest.
* Blinzeln (Lid = umgebendes Gold): die blauen Augenpixel werden 3 Frames lang zu Gold, zweimal pro Schleife (Frame 15–17 und 39–41). Kein Glühen, kein Farbtausch sonst.
* Glanz auf dem Gold (Regel 12/14: Gold glänzt): ein diagonales Lichtband (x + y, 3 px) läuft zweimal pro Schleife über den Helm (Start Frame 4 und 28, 12 Frames, jede Goldfarbe zwei Stufen heller), dazu blitzen
  vierzackige Glitzersterne (Mitte (251,242,120), Arme (228,178,30); 3 Frames, Arme 1 → 2 → 1 px) an den Helmlichtern (8,3) und (1,3) (Frame 10–12 / 14–16 und 34–36 / 38–40) und am Gürtel (7,20) (Frame 22–24 und 43–45); sie gehen mit dem Schweben mit.
* Goldstaub (Partikel, hinter der Figur, 7 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Form k = 1-px-Funke): goldene (228,178,30) und helle (251,242,120) Funken umschweben die Figur
  (keine größeren Kugeln, damit nichts wie ein schwebender Ball wirkt).
Regel 15 entfällt (das Feuer der Karte ist nicht im Sprite). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (49,24,0)) in jeder Pose; im Ruhebild nichts. ERGÄNZUNG: keine gemalten Pixel.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel und Sterne vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der
vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 7, 9, 4

spr = L.lade('chosen-sacrifice')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (49, 24, 0)
assert KONTUR in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

helm = vorhanden & (yy <= 10)
rest = vorhanden & (yy >= 11) & (yy <= 21)
rock = vorhanden & (yy >= 22)
BLAU = {(0, 32, 123), (0, 8, 74), (0, 0, 1)}
AUGEN = [(x, y) for y in range(7, 11) for x in range(sw) if vorhanden[y, x] and col(x, y) in BLAU]
assert len(AUGEN) == 14
# Lid = häufigste Goldfarbe der Nachbarn (3×3), nicht blau/schwarz
LID = {}
for (x, y) in AUGEN:
    cnt = {}
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            q = (x + dx, y + dy)
            if 0 <= q[0] < sw and 0 <= q[1] < sh and vorhanden[q[1], q[0]] and q not in AUGEN and sum(col(*q)) > 150 and col(*q)[2] < 80:
                cnt[col(*q)] = cnt.get(col(*q), 0) + 1
    LID[(x, y)] = max(cnt, key=cnt.get) if cnt else (190, 148, 25)
BLINZ = {15, 16, 17, 39, 40, 41}

GOLD = sorted({col(x, y) for y in range(sh) for x in range(sw) if helm[y, x] and col(x, y) not in BLAU and col(x, y) not in {(0, 0, 0), (0, 1, 0), (0, 0, 1)} and col(x, y)[0] > 100}, key=lambda c: sum(c))
RAMPE = {c: GOLD[min(len(GOLD) - 1, k + 2)] for k, c in enumerate(GOLD)}
STERN_MITTE, STERN_ARM = (251, 242, 120), (228, 178, 30)
assert col(8, 3) == STERN_MITTE and col(1, 3) == STERN_MITTE and col(7, 20) == STERN_MITTE
STERNE = [((8, 3), (10, 34)), ((1, 3), (14, 38)), ((7, 20), (22, 43))]      # (Position, (Start 1, Start 2))

GOLD1 = {'c': (228, 178, 30), 'r': (179, 119, 0)}
GOLD2 = {'c': (251, 242, 120), 'r': (251, 242, 120)}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(0, 14)[0], y=P(0, 14)[1], vx=-1, vy=-9, off=0, form='k', wackeln=1),
    dict(x=P(13, 18)[0], y=P(13, 18)[1], vx=1, vy=-9, off=22, form='k', wackeln=1),
    dict(x=P(3, 4)[0], y=P(3, 4)[1], vx=-1, vy=-5, off=36, form='k', wackeln=1),
]
PUFFS2 = [
    dict(x=P(11, 5)[0], y=P(11, 5)[1], vx=1, vy=-6, off=8, form='k', wackeln=1),
    dict(x=P(-1, 22)[0], y=P(-1, 22)[1], vx=-1, vy=-10, off=18, form='k', wackeln=1),
    dict(x=P(14, 10)[0], y=P(14, 10)[1], vx=1, vy=-8, off=30, form='k', wackeln=1),
    dict(x=P(7, 1)[0], y=P(7, 1)[1], vx=0, vy=-4, off=42, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Schweben 0-1-2-1-0
    hump = U.buckel(i, 0, 24, n=24)                              # Hüllkurve des Rockwehens (0 bei Frame 0)
    drift = U.stufe(i, N, 2, form='sin') - 1                     # Kopf treibt −1/0/+1 seitlich
    hp = teil(helm)
    if i in BLINZ:
        for (x, y) in AUGEN:
            hp[GPT + y, GPL + x, :3] = LID[(x, y)]
    for start in (4, 28):                                         # Lichtband über das Gold
        j = i - start
        if 0 <= j <= 11:
            d = 2 + 2 * j
            for y in range(sh):
                for x in range(sw):
                    if helm[y, x] and d <= x + y < d + 3 and col(x, y) in RAMPE:
                        hp[GPT + y, GPL + x, :3] = RAMPE[col(x, y)]
    rk = teil(rock)
    # Rock weht: Zeilenversatz wächst mit dem Abstand zur Aufhängung y 21, mit Nachlauf
    ausschlag = 1.5 * hump * math.sin(2 * math.pi * i / 12)
    rk = U.haengen(rk, GPT + 21, ausschlag)
    koerper = L.zusammen(H, W, [(rk, 0, -n), (teil(rest), 0, -n), (hp, drift, -n)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    sterne = L.leer(H, W)
    for ((px, py), starts) in STERNE:
        for s in starts:
            k = i - s
            if 0 <= k <= 2:
                dx = drift if py <= 10 else 0
                L.einsetzen(sterne, U.stern_ebene(H, W, GPL + px + dx, GPT + py - n, (2, 3, 2)[k], STERN_MITTE, STERN_ARM))
    g1 = _glut(H, W, i, N, PUFFS1, GOLD1)
    g2 = _glut(H, W, i, N, PUFFS2, GOLD2)
    return L.zusammen(H, W, [(g1, 0, 0), (g2, 0, 0), (koerper, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel und Sterne dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('chosen-sacrifice', 'Chosen Sacrifice', frames, MS, prev)
    if prev:
        L.streifen(prev + '/chosen-sacrifice-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
