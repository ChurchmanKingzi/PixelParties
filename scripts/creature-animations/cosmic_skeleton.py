# -*- coding: utf-8 -*-
"""Idle-Animation für „Cosmic Skeleton“ (Creature) — Fassung 2 (ohne Glanz: Kosmos-Fläche ist kein Metall, Regel 14).

Quelle: src/cosmic-skeleton.png — Ebene „Cosmic Skele“ (20×21 px, 7 Farben) aus Motive.xcf. Die Ebene ist vollständig deckend (Alpha nur 0/255,
nichts fehlt). Der große sternförmige Violett-Schein, der helle Lila-Schädel links oben und die vielen gelben Sternpunkte der Karte sind eigene Ebenen
und NICHT Teil dieses Sprites (nur drei Sternpixel gehören dazu; sie bleiben fest).
PICK: [["Motive", 805, 1]]

Aufruf:   python3 cosmic_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cosmic-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Farben: violette Rampe A (21,0,33) < D (46,0,74) < C (77,0,122) < B (111,0,176); drei gelbe Sternpixel E (255,255,9) bei (6,6), F (255,255,99) bei (16,9),
  G (255,255,164) bei (3,13) (feste Sterne im Körper).
* Kopf y 0–6, x 5–14: dunkler Schädel mit zwei hellvioletten Flecken oben (B bei (7–9,1) und (11–12,1), Deutung unsicher), linke Gesichtshälfte D,
  Loch (transparent) bei (11–12, 4–5) = vermutlich Augenhöhle. Augen werden NICHT animiert (Deutung unsicher).
* Rumpf y 7–15 (Schulterzeile y 7–9, Rippenmuster aus B/C auf A, Becken y 15), Arme: oben an den Schultern (y 7–9), darunter frei hängend
  (x 1–3 links, x 16–18 rechts, y 10–15), Hände bei y 12–14.
* Beine y 16–20 (x 4–8 und 11–15), Füße y 19–20.
Fest bleiben: Schädelform, Rippenmuster, Umrisse A, die drei Sternpixel.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Staub ausgenommen) — kein Lichtband, kein Funkeln, keine Glitzersterne (Regel 14):
* Schweben (Periode 48, zweistufig 0-1-2-1-0 px): die ganze Figur steigt starr; der Schädel folgt 2 Frames später und liegt nie höher als der Rumpf
  (er sinkt höchstens 1 px in die Schultern, nie entsteht ein Spalt).
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 3 px, wächst von der Schulter y 9 zur Hand), die Unterarme pendeln zusätzlich
  mit einer Welle (Periode 12, Spitze hinkt hinterher, ±1 px, nur während der Schwingung).
* Beine baumeln: beide Beine pendeln gleichgerichtet (Periode 16, ±1,6 px, wächst vom Becken y 15 zum Fuß); die Naht zum Becken bleibt über Kanten verbunden.
* Atmen (Periode 24, 0/1 px): im Rumpf-Layer wird Zeile y 12 einmal eingefügt; Schultern, Kopf und Arme heben sich 1 px über Becken und Beine. Kopf und Rumpf
  bleiben sonst starr (kein Wallen/Scheren mehr, das hatte den Kopf neben die Schultern gekippt).
* Sternenstaub (Partikel, hinter der Figur, 12 Stück, Lebensdauer 48 Frames, langsam aufsteigend, Formen k, o): gelbe Funken (Kern F, Rand E) und
  violette Kugeln (Kern B, Rand C) rund um die Figur. Alle Farben aus dem Sprite.
ERGÄNZUNG: keine gemalten Pixel (Kopf sinkt nur über Rumpfpixel; Arme/Beine lösen sich nur seitlich bei überlappender Naht).
Randpixel-Test (Regel 16): `U.kontur_schliessen` ergänzt in jeder Pose fehlende Umrisspixel (Schwarzviolett A) an Armen, Beinen und Wallkanten; im Ruhebild
ändert es nichts.
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

UMRISS = U.umrissfarben(spr)
arm_l = vorhanden & (xx <= 4) & (yy >= 10) & (yy <= 15)
arm_r = vorhanden & (xx >= 15) & (yy >= 10) & (yy <= 15)
kopf = vorhanden & (yy <= 6)
rumpf = vorhanden & (yy >= 7) & (yy <= 15) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 16)
assert (arm_l | arm_r | kopf | rumpf | beine).sum() == vorhanden.sum()

STAUB = {'c': GF_, 'r': GE_}                          # Sternenstaub gelb
PURPUR = {'c': B_, 'r': C_}                           # violette Kugeln
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_GELB = [
    dict(x=P(1, 8)[0], y=P(1, 8)[1], vx=-2, vy=-11, off=0, form='k', wackeln=1),
    dict(x=P(18, 12)[0], y=P(18, 12)[1], vx=2, vy=-12, off=14, form='k', wackeln=1),
    dict(x=P(9, 0)[0], y=P(9, 0)[1], vx=1, vy=-10, off=27, form='k', wackeln=1),
    dict(x=P(5, 18)[0], y=P(5, 18)[1], vx=-2, vy=-12, off=36, form='o', wackeln=1),
    dict(x=P(14, 19)[0], y=P(14, 19)[1], vx=2, vy=-12, off=8, form='k', wackeln=1),
    dict(x=P(12, 8)[0], y=P(12, 8)[1], vx=3, vy=-9, off=21, form='k', wackeln=1),
]
PUFFS_PURPUR = [
    dict(x=P(0, 14)[0], y=P(0, 14)[1], vx=-3, vy=-13, off=20, form='o', wackeln=1),
    dict(x=P(19, 15)[0], y=P(19, 15)[1], vx=3, vy=-13, off=40, form='o', wackeln=1),
    dict(x=P(6, 2)[0], y=P(6, 2)[1], vx=-2, vy=-10, off=32, form='o', wackeln=1),
    dict(x=P(13, 2)[0], y=P(13, 2)[1], vx=2, vy=-10, off=6, form='o', wackeln=1),
    dict(x=P(10, 20)[0], y=P(10, 20)[1], vx=0, vy=-11, off=44, form='o', wackeln=1),
    dict(x=P(3, 6)[0], y=P(3, 6)[1], vx=-3, vy=-8, off=12, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def frame(i):
    r_b = stufe2(i)
    r_k = max(min(r_b, stufe2(i - 2)), r_b - 1)                   # Schädel folgt dem Rumpf, nie höher
    hump = U.buckel(i, 0, 24, n=24)
    aus = 3.0 * hump
    bein = 1.6 * math.sin(L.sinus(i, 16))
    ph = L.sinus(i, 12)

    atem = U.stufe(i, N / 2, 1)                                  # Atmen: 0/1 px (Periode 24)
    kp = teil(kopf)
    rp = L.streck_zeile(teil(rumpf), PAD_T + 12, atem)           # Zeile y 12 wird eingefügt: Schultern/Kopf heben sich über Becken und Beine
    al, ar = teil(arm_l), teil(arm_r)
    al = L.spalten_welle(al, PAD_L + 4, 1.0 * hump, ph, lauf=1.0, nur_rechts=False)     # Unterarmwelle (Periode 12)
    ar = L.spalten_welle(ar, PAD_L + 15, 1.0 * hump, ph, lauf=1.0, nur_rechts=True)
    al = U.haengen(al, PAD_T + 9, -aus)
    ar = U.haengen(ar, PAD_T + 9, aus)
    bn = U.haengen(teil(beine), PAD_T + 15, bein)
    koerper = L.zusammen(H, W, [(bn, 0, -r_b), (rp, 0, -r_b), (al, 0, -r_b - atem), (ar, 0, -r_b - atem), (kp, 0, -r_k - atem)])
    koerper = U.kontur_schliessen(koerper, UMRISS, A_)             # Regel 16: Umriss an allen bewegten Kanten in jeder Pose geschlossen
    gelb = U.glut_ebene(H, W, i, N, PUFFS_GELB, STAUB)
    purpur = U.glut_ebene(H, W, i, N, PUFFS_PURPUR, PURPUR)
    return L.zusammen(H, W, [(purpur, 0, 0), (gelb, 0, 0), (koerper, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('cosmic-skeleton', 'Cosmic Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cosmic-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
