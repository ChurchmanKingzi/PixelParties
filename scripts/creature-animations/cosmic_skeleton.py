# -*- coding: utf-8 -*-
"""Idle-Animation für „Cosmic Skeleton“ (Creature).

Quelle: src/cosmic-skeleton.png — Ebene „Cosmic Skele“ (20×21 px, 7 Farben) aus Motive.xcf. Die Ebene ist vollständig deckend (Alpha nur 0/255,
nichts fehlt). Der große sternförmige Violett-Schein, der helle Lila-Schädel links oben und die vielen gelben Sternpunkte der Karte sind eigene Ebenen
und NICHT Teil dieses Sprites (nur drei Sternpixel gehören dazu).
PICK: [["Motive", 805, 1]]

Aufruf:   python3 cosmic_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cosmic-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Farben: violette Rampe A (21,0,33) < D (46,0,74) < C (77,0,122) < B (111,0,176); drei gelbe Sternpixel E (255,255,9) bei (6,6), F (255,255,99) bei (16,9),
  G (255,255,164) bei (3,13) (Rampe E < F < G).
* Kopf y 0–6, x 5–14: dunkler Schädel mit zwei hellvioletten Flecken oben (B bei (7–9,1) und (11–12,1), vermutlich Augen/Krone — unsicher), linke
  Gesichtshälfte D, Loch (transparent) bei (11–12, 4–5) = Augenhöhle.
* Rumpf y 7–15 (Schulterzeile y 7–9, Rippenmuster aus B/C auf A, Becken y 15), Arme: oben an den Schultern (y 7–9), darunter frei hängend
  (x 1–3 links, x 16–18 rechts, y 10–15), Hände bei y 12–14 (B, bei (3,13) der Sternpixel G).
* Beine y 16–20 (x 4–8 und 11–15), Füße y 19–20.
Fest bleiben: Schädelform, Rippenmuster, Hände (nur Glanz), alle Umrisse A.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Funken/Sterne ausgenommen):
* Schweben (Periode 48, zweistufig 0-1-2-1-0 px): die ganze Figur steigt starr; der Schädel folgt 2 Frames später und liegt nie höher als der Rumpf
  (er sinkt höchstens 1 px in die Schultern, nie entsteht ein Spalt).
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 2,5 px, wächst von der Schulter y 9 zur Hand).
* Beine baumeln: beide Beine pendeln gleichgerichtet (Periode 16, ±1,6 px, wächst vom Becken y 15 zum Fuß); die Naht zum Becken bleibt über Kanten verbunden.
* Glanz (Regel 12): Lichtband (Rampe A → D → C → B, Mitte zwei Stufen, Rand eine) läuft alle 24 Frames diagonal über die ganze Figur; die hellen B-Flächen
  funkeln jede in eigenem Takt (B → C), C-Flächen blitzen auf (C → B).
* Die drei Sternpixel pulsieren in der Gelbrampe (Perioden 8, 12, 6) und blitzen in vierzackigen Glitzersternen auf (Stufe 1 → 2 → 3 → 2 → 1, Mitte G,
  Arme F): bei (6,6) Frame 4–8, (16,9) Frame 20–24, (3,13) Frame 36–40; kleine Sterne an den hellen Kopfflecken (8,1) Frame 12–14, (12,1) Frame 28–30, (7,1) Frame 44–46.
* Sternenstaub (Partikel, hinter der Figur, 10 Stück, Lebensdauer 48 Frames, langsam aufsteigend, Formen k, o): gelbe Funken (Kern F, Rand E) und
  violette Kugeln (Kern B, Rand C) rund um die Figur. Alle Farben aus dem Sprite.
ERGÄNZUNG: keine gemalten Pixel (Kopf sinkt nur über Rumpfpixel; Arme/Beine lösen sich nur seitlich bei überlappender Naht).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 16, 4

spr = L.lade('cosmic-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, D_, C_, B_ = (21, 0, 33), (46, 0, 74), (77, 0, 122), (111, 0, 176)
GE_, GF_, GG_ = (255, 255, 9), (255, 255, 99), (255, 255, 164)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (A_, D_, C_, B_, GE_, GF_, GG_))
RAMPE = {A_: D_, D_: C_, C_: B_}                      # Violettrampe: eine Stufe heller
STERNE_PIX = [((6, 6), [GE_, GF_, GG_], 0, 8), ((16, 9), [GE_, GF_, GG_], 1, 12), ((3, 13), [GE_, GF_, GG_], 2, 6)]   # (Pos, Rampe, Ruhestufe, Periode)

arm_l = vorhanden & (xx <= 4) & (yy >= 10) & (yy <= 15)
arm_r = vorhanden & (xx >= 15) & (yy >= 10) & (yy <= 15)
kopf = vorhanden & (yy <= 6)
rumpf = vorhanden & (yy >= 7) & (yy <= 15) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 16)
assert (arm_l | arm_r | kopf | rumpf | beine).sum() == vorhanden.sum()
STERN_MASK = np.zeros_like(vorhanden)
for (x, y), _, _, _ in STERNE_PIX:
    STERN_MASK[y, x] = True
farbig = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and not STERN_MASK[y, x]]
D_MAX = max(x + y for x, y in farbig)

STAUB = {'c': GF_, 'r': GE_}                          # Sternenstaub gelb
PURPUR = {'c': B_, 'r': C_}                           # violette Kugeln
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_GELB = [
    dict(x=P(1, 8)[0], y=P(1, 8)[1], vx=-2, vy=-11, off=0, form='k', wackeln=1),
    dict(x=P(18, 12)[0], y=P(18, 12)[1], vx=2, vy=-12, off=14, form='k', wackeln=1),
    dict(x=P(9, 0)[0], y=P(9, 0)[1], vx=1, vy=-10, off=27, form='k', wackeln=1),
    dict(x=P(5, 18)[0], y=P(5, 18)[1], vx=-2, vy=-12, off=36, form='o', wackeln=1),
    dict(x=P(14, 19)[0], y=P(14, 19)[1], vx=2, vy=-12, off=8, form='k', wackeln=1),
]
PUFFS_PURPUR = [
    dict(x=P(0, 14)[0], y=P(0, 14)[1], vx=-3, vy=-13, off=20, form='o', wackeln=1),
    dict(x=P(19, 15)[0], y=P(19, 15)[1], vx=3, vy=-13, off=40, form='o', wackeln=1),
    dict(x=P(6, 2)[0], y=P(6, 2)[1], vx=-2, vy=-10, off=32, form='o', wackeln=1),
    dict(x=P(13, 2)[0], y=P(13, 2)[1], vx=2, vy=-10, off=6, form='o', wackeln=1),
    dict(x=P(10, 20)[0], y=P(10, 20)[1], vx=0, vy=-11, off=44, form='o', wackeln=1),
]
STERNE = [((6, 6), 'kopf', 4), ((16, 9), 'rumpf', 20), ((3, 13), 'arm_l', 36)]            # große Sterne an den Sternpixeln (5 Frames)
KLEIN = [((8, 1), 'kopf', 12), ((12, 1), 'kopf', 28), ((7, 1), 'kopf', 44)]               # kleine Sterne an den Kopfflecken (3 Frames)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def glanz(layer, punkte, k, i):
    """Lichtband (Mitte zwei, Rand eine Stufe) + Funkeln der B-/C-Flächen auf einer Ebene in Sprite-Koordinaten."""
    U.band_diagonal(layer, punkte, RAMPE, -3 + 2 * k, 3, PAD_L, PAD_T)
    U.band_diagonal(layer, punkte, RAMPE, -2 + 2 * k, 1, PAD_L, PAD_T)
    if i % N:
        for (x, y) in punkte:
            col = tuple(layer[PAD_T + y, PAD_L + x, :3])
            if col == B_ and (i + 3 * x + 5 * y) % 12 < 2:
                layer[PAD_T + y, PAD_L + x, :3] = C_
            elif col == C_ and (i + 7 * x + 3 * y) % 16 < 2:
                layer[PAD_T + y, PAD_L + x, :3] = B_
    return layer


def frame(i):
    r_b = stufe2(i)
    r_k = max(min(r_b, stufe2(i - 2)), r_b - 1)                   # Schädel folgt dem Rumpf, nie höher
    aus = 2.5 * U.buckel(i, 0, 24, n=24)
    bein = 1.6 * math.sin(L.sinus(i, 16))
    k = i % 24

    kp = teil(kopf)
    glanz(kp, [p for p in farbig if p[1] <= 6], k, i)
    rp = teil(rumpf)
    glanz(rp, [p for p in farbig if 7 <= p[1] <= 15 and not (p[0] <= 4 and p[1] >= 10) and not (p[0] >= 15 and p[1] >= 10)], k, i)
    al, ar = teil(arm_l), teil(arm_r)
    glanz(al, [p for p in farbig if p[0] <= 4 and 10 <= p[1] <= 15], k, i)
    glanz(ar, [p for p in farbig if p[0] >= 15 and 10 <= p[1] <= 15], k, i)
    bn = teil(beine)
    glanz(bn, [p for p in farbig if p[1] >= 16], k, i)
    # Sternpixel pulsieren in der Gelbrampe (Ruhestufe bei Frame 0)
    for ((x, y), rampe, ruhe, per) in STERNE_PIX:
        ph = L.sinus(i, per)
        if ruhe == 1:
            stufe = 1 + int(round(math.sin(ph)))                  # 0 … 2 um die Ruhestufe 1
        elif ruhe == 0:
            stufe = int(round(1 - math.cos(ph)))                  # 0 … 2
        else:
            stufe = 2 - int(round(1 - math.cos(ph)))              # 2 … 0
        ziel = {'kopf': kp, 'rumpf': rp, 'arm_l': al, 'arm_r': ar}['kopf' if y <= 6 else ('rumpf' if x >= 5 else 'arm_l')]
        ziel[PAD_T + y, PAD_L + x, :3] = rampe[stufe]
    al = U.haengen(al, PAD_T + 9, -aus)
    ar = U.haengen(ar, PAD_T + 9, aus)
    bn = U.haengen(bn, PAD_T + 15, bein)
    gelb = U.glut_ebene(H, W, i, N, PUFFS_GELB, STAUB)
    purpur = U.glut_ebene(H, W, i, N, PUFFS_PURPUR, PURPUR)

    # --- Glitzersterne (nach der Figur; bleiben am Objekt) ---
    sterne = L.leer(H, W)
    for (px, py), ebene, start in STERNE:
        st = {0: 1, 1: 2, 2: 3, 3: 2, 4: 1}.get(i - start, 0)
        if st:
            dy = -r_k if ebene == 'kopf' else -r_b
            dx = int(round((-aus if ebene == 'arm_l' else 0) * (py - 9) / 6.0)) if ebene == 'arm_l' else 0
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + px + dx, PAD_T + py + dy, st, GG_, GF_))
    for (px, py), ebene, start in KLEIN:
        st = {0: 1, 1: 2, 2: 1}.get(i - start, 0)
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + px, PAD_T + py - r_k, st, GG_, GF_))
    return L.zusammen(H, W, [(purpur, 0, 0), (gelb, 0, 0), (bn, 0, -r_b), (rp, 0, -r_b), (al, 0, -r_b), (ar, 0, -r_b), (kp, 0, -r_k), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('cosmic-skeleton', 'Cosmic Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cosmic-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
