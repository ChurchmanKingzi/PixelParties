# -*- coding: utf-8 -*-
"""Idle-Animation für „Burning Skeleton“ (Creature).

Quelle: src/burning-skeleton.png — Ebene „Burning Skele“ (20×30 px, 16 Farben) aus Motive.xcf.
PICK: [["Motive", 814, 1]]
  Die Ebene hat unten halbtransparente Beine (Alpha 204 = Skelett steht in Lava, Zeilen 24–29: 38 Pixel). `creature_show.py extract` übernimmt nur Alpha ≥ 250
  (Zeilen 0–24); ich habe die Beinpixel der Ebene in src/ als DECKEND ergänzt (Farben alle aus dem Sprite, (48,48,48) → (38,38,38)) und blende sie im
  Skript per Dither (75 % sichtbar) wieder aus: Ruhepose = Muster 0 (jedes Pixel mit ungeradem x UND ungeradem y entfällt). Ohne diese Zeilen endete die Figur
  abrupt über den Hüften.

Aufruf:   python3 burning_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/burning-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Flamme y 0–8 auf dem Schädel: Flammenrampe M (150,0,0) < E rot (202,44,41) < G orange (244,123,34) < P gelb (246,231,14). Heißer Kern P bei (9,8), Zungen
  rot bei (9,4–6), (11,6), (8/10/12,7); die drei roten Pixel (11,0) (12,1) (12,2) sind ein losgelöster Funke über der Flamme.
* Schädel y 9–15: schwarz/dunkelbraun (A, B, C, D, F); Augenhöhlen F schwarz bei (7,13/14) und (12,13/14); rote Glutaugen M bei (8,14) und (11,14).
* Rumpf: Schultern y 16–18, Rippen y 17–20 (dunkelrote Muster B/C/D/L/N), Becken y 21–23.
* Arme: oben an den Schultern (x 2–5, y 16–18), dann frei hängend: Unterarm x 1–3 y 19–20, graue Hände/Handschuhe H/I/O/K bei y 21–23, Spitze y 24.
* Beine y 24–29 (halbtransparent in der Kunst, hier als Dither; „Halbpixel“ = alle Beinpixel ab y 25 und (8–11, 24)): dunkel A/D/B/C mit grauen Knöcheln.
Fest bleiben: Schädel, Rippenmuster, Beine, Hände.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original mit Bein-Dither 0, Funken/Glut/Sterne ausgenommen):
* Lava-Flimmern: die halbtransparenten Beine wechseln alle 3 Frames zwischen vier Dither-Mustern (je ein Viertel der Pixel fehlt, die Lücken wandern
  kriechend: ungerade/ungerade → gerade/ungerade → gerade/gerade → ungerade/gerade), Hitzeflimmern der Lava.
* Flamme züngelt: 7 handgezeichnete Flammenposen (Ruhepose = Original), gemischt nach einem unregelmäßigen Takt (2–3 Frames je Pose); Zungen wachsen/schrumpfen,
  lehnen sich links/rechts, ein Funke löst sich oben. Alle Pixel in E/G/P. Hitzewelle (Lichtband in der Flammenrampe): alle 24 Frames wandert ein
  heißeres Band (E → G, G → P) von der Flammenbasis (y 8) bis zur Spitze (y 0).
* Atmen zweistufig (Periode 48, 0-1-2-1-0 px): im Rumpf-Layer wird Zeile y 20 eingefügt; Brust (Rippen, Schultern) und Arme steigen zuerst, Becken/Beine
  bleiben. Der Schädel samt Flamme folgt 2 Frames später, nie höher als die Brust (sinkt höchstens 1 px in die Schultern, nie ein Spalt).
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 2,5 px, wächst von der Schulter y 18 zur Hand); Schulterzeilen y 16–18 bleiben am Rumpf.
* Rote Augen glühen (Periode 12: M → E → G → E → M, G = orangefarbenes Auflodern), Blinzeln Frame 18–20 und 42–44; Glitzerstern (Mitte G, Arme E) am
  linken Auge Frame 6–8, am rechten Frame 30–32 (Regel 12: Augen-Glanzpunkte).
* Glut-Partikel (hinter der Figur, 10 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, Formen k, o): Funken über der Flamme,
  runde Glutkugeln neben Kopf und Schultern, Lavafunken rechts/links der Beine. Farben aus der Flammenrampe (P/G/E).
ERGÄNZUNG: die Beinzeilen 24–29 (38 Halbpixel, deckend in src, siehe oben). Sonst nichts gemalt; die Flammenposen sind Neuzeichnungen derselben Pixelfarben (Ruhepose = Original).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 18, 5

spr = L.lade('burning-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

M_, E_, G_, P_ = (150, 0, 0), (202, 44, 41), (244, 123, 34), (246, 231, 14)
B_ = (47, 18, 18)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (M_, E_, G_, P_, B_))
FARBE = {'E': E_, 'G': G_, 'P': P_}
HEISSER = {E_: G_, G_: P_}                        # Flammenrampe: eine Stufe heißer

flamme = vorhanden & (yy <= 8)
kopf = vorhanden & (yy >= 9) & (yy <= 15)
arm_l = vorhanden & (xx <= 4) & (yy >= 19) & (yy <= 24)
arm_r = vorhanden & (xx >= 15) & (yy >= 19) & (yy <= 24)
rumpf = vorhanden & (yy >= 16) & (yy <= 23) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 24) & ~arm_l & ~arm_r
halb = vorhanden & (((yy >= 25)) | ((yy == 24) & (xx >= 8) & (xx <= 11)))      # in der Kunst halbtransparente Beinpixel (Alpha 204)
assert (flamme | kopf | arm_l | arm_r | rumpf | beine).sum() == vorhanden.sum()

# Flammenposen: x = 6..14 (9 Zeichen), y = 0..8; E rot, G orange, P gelb. Pose 0 = Original.
POSEN = [
    [".....E...", "......E..", "......E..", ".........", "...E.....", "...E.....", "...E.E...", "..EGEGE..", ".EGPGGE.."],   # 0 Original
    [".........", "....E....", "....E....", ".........", "..E......", "..E.E....", "..E.E.E..", "..EGEGE..", ".EGPGGE.."],   # 1 lehnt links
    ["...E.....", ".........", "...E.....", "...E.....", "...E.....", "...E.E...", "...E.E...", "..EGEGE..", ".EGPGGE.."],   # 2 hohe Mitte
    [".........", ".........", ".........", ".........", "...E.....", "...E.E...", "..EGEG...", "..GGGGE..", ".EGPPGE.."],   # 3 Aufflackern (heiß)
    [".........", "......E..", "......E..", ".........", ".........", ".........", "...E.....", "..EGEGE..", ".EGPGGE.."],   # 4 niedrig
    [".........", ".......E.", ".......E.", "......E..", "......E..", "...E..E..", "...E.EE..", "..EGEGE..", ".EGPGGE.."],   # 5 lehnt rechts
    [".........", ".........", "......E..", "..E...E..", "..E.E.E..", "..E.E.E..", "..E.E.E..", "..EGEGE..", ".EGPGGE.."],   # 6 drei Zungen
]
PLAN = [0, 0, 1, 1, 2, 2, 5, 3, 3, 1, 4, 4, 6, 2, 2, 5, 5, 1, 3, 3, 2, 4, 0, 1,
        0, 1, 5, 5, 2, 3, 3, 4, 6, 6, 1, 2, 2, 5, 1, 3, 4, 4, 0, 1, 2, 5, 3, 0]
assert len(PLAN) == N


def flammenpixel(pose):
    return [(6 + xi, y, FARBE[ch]) for y, zeile in enumerate(POSEN[pose]) for xi, ch in enumerate(zeile) if ch != '.']


# Ruhepose muss dem Sprite entsprechen
_orig = {(x, y): tuple(int(v) for v in spr[y, x, :3]) for y in range(9) for x in range(sw) if spr[y, x, 3]}
assert {(x, y): col for x, y, col in flammenpixel(0)} == _orig, 'Flammenpose 0 weicht vom Sprite ab'

GLOW12 = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0]       # Augenglühen (Periode 12), 0 = Original (M)
AUGEN = [(8, 14), (11, 14)]
AUGENFARBE = [M_, E_, G_]

HEISS = {'c': P_, 'r': G_}                          # heiße Funken/Kugeln: Kern gelb, Rand orange
GLUT = {'c': G_, 'r': E_}                           # Glut: Kern orange, Rand rot
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_HEISS = [
    dict(x=P(9, 2)[0], y=P(9, 2)[1], vx=1, vy=-12, off=0, form='k', wackeln=1),          # Funken über der Flamme
    dict(x=P(12, 1)[0], y=P(12, 1)[1], vx=1, vy=-12, off=16, form='k', wackeln=1),
    dict(x=P(7, 4)[0], y=P(7, 4)[1], vx=-2, vy=-11, off=32, form='k', wackeln=1),
    dict(x=P(4, 10)[0], y=P(4, 10)[1], vx=-2, vy=-13, off=8, form='o', wackeln=1),       # runde Glut neben dem Kopf
    dict(x=P(15, 10)[0], y=P(15, 10)[1], vx=2, vy=-13, off=28, form='o', wackeln=1),
]
PUFFS_GLUT = [
    dict(x=P(1, 17)[0], y=P(1, 17)[1], vx=-2, vy=-12, off=20, form='k', wackeln=1),      # an den Schultern
    dict(x=P(18, 17)[0], y=P(18, 17)[1], vx=2, vy=-12, off=40, form='k', wackeln=1),
    dict(x=P(3, 28)[0], y=P(3, 28)[1], vx=-2, vy=-15, off=4, form='o', wackeln=1),       # Lavafunken neben den Beinen
    dict(x=P(16, 28)[0], y=P(16, 28)[1], vx=2, vy=-15, off=24, form='o', wackeln=1),
    dict(x=P(10, 29)[0], y=P(10, 29)[1], vx=0, vy=-10, off=44, form='k', wackeln=1),
]


def flimmern(i):
    """Dithermuster der Halbpixel: (ungerade x, ungerade y) fällt im Ruhebild aus (Muster 0); alle 3 Frames wandern die Lücken weiter."""
    p = (i // 3) % 4
    return (xx % 2 == (1, 0, 0, 1)[p]) & (yy % 2 == (1, 1, 0, 0)[p]) & halb


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def frame(i):
    r_b = stufe2(i)
    r_k = max(min(r_b, stufe2(i - 2)), r_b - 1)                   # Schädel + Flamme folgen der Brust, nie höher
    aus = 2.5 * U.buckel(i, 0, 24, n=24)
    k = i % 24
    glut = GLOW12[i % 12]
    blink = {18: 1, 19: 2, 20: 1, 42: 1, 43: 2, 44: 1}.get(i, 0)

    # --- Flamme (neu gezeichnet aus Posen; Hitzewelle als Lichtband in der Flammenrampe) ---
    fl = L.leer(H, W)
    for (x, y, col) in flammenpixel(PLAN[i]):
        if 9 - k <= y < 11 - k and col in HEISSER:                # Welle: Zeilen y ∈ [9−k, 11−k)
            col = HEISSER[col]
        fl[PAD_T + y, PAD_L + x, :3] = col
        fl[PAD_T + y, PAD_L + x, 3] = 255
    # --- Schädel mit Glutaugen ---
    kp = teil(kopf)
    for (x, y) in AUGEN:
        kp[PAD_T + y, PAD_L + x, :3] = B_ if blink == 2 else (AUGENFARBE[0] if blink == 1 else AUGENFARBE[glut])
    # --- Rumpf, Arme, Beine ---
    rp = L.streck_zeile(teil(rumpf), PAD_T + 20, r_b)
    al = U.haengen(teil(arm_l), PAD_T + 18, -aus)
    ar = U.haengen(teil(arm_r), PAD_T + 18, aus)
    bn = teil(beine & ~flimmern(i))
    heiss = U.glut_ebene(H, W, i, N, PUFFS_HEISS, HEISS)
    kalt = U.glut_ebene(H, W, i, N, PUFFS_GLUT, GLUT)

    # --- Glitzersterne an den Augen (nach der Figur; bleiben am Auge) ---
    sterne = L.leer(H, W)
    for ((ex, ey), start) in ((AUGEN[0], 6), (AUGEN[1], 30)):
        st = {0: 1, 1: 2, 2: 1}.get(i - start, 0)
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + ex, PAD_T + ey - r_k, st, G_, E_))
    return L.zusammen(H, W, [(kalt, 0, 0), (heiss, 0, 0), (bn, 0, 0), (rp, 0, 0), (al, 0, -r_b), (ar, 0, -r_b), (kp, 0, -r_k), (fl, 0, -r_k), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('burning-skeleton', 'Burning Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/burning-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=7)
