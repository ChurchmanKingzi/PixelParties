# -*- coding: utf-8 -*-
"""Idle-Animation für „Treasure Skeleton“ (Creature).

Quelle: src/treasure-skeleton.png — Ebene „Treasure Skeleton“ (20×26 px, 11 Farben) aus MotiveSteamDwarfs.xcf (die Karte ist blau/grün
getönt, die Ebene hat die Originalfarben Gold/Orange/Rot + Smaragdgrün; verwendet werden die Ebenenfarben).
PICK: [["MotiveSteamDwarfs", 272, 1]]   (die anderen Treffer sind Fremdfiguren: „Adventurousness“ 4×9, „Guardian Angel“ 7×12)

Aufruf:   python3 treasure_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/treasure-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y; symmetrisch um x = 9,5):
* Ganze Figur = goldenes Gitterskelett: dunkelrotes Gitter/Umriss A (182,38,0), Gold in fünf Stufen C (238,100,40) < F (242,154,62) <
  E (250,213,74) < D (247,247,96) < B (247,247,173). Rampe des Sprites für alle Glanzeffekte.
* Kopf y 0–12: Krone/Stirn mit vier goldenen Spitzen (E) bei (4,1) (7,1) (12,1) (15,1); darunter Stirnfeld (y 2–8).
  Seitliche Nieten/Edelsteine je Seite bei y 5, 7, 9, 11: rechts E E (16/17,y), links dunkel (G (117,0,0) bei (2,y), F bei (3,5)/(3,7), grau I (72,72,72)
  bei (3,9)/(3,11)) — dieselben Nieten, links im Schatten (Licht von rechts). Augen = zwei Smaragde (grüne Rampe K (0,125,43) < H (0,187,64) < J (0,255,88)):
  links H(7,9) J(8,9) K(7,10) H(8,10), rechts H(11,9) J(12,9) K(11,10) H(12,10); dazwischen helle Nase D/B.
* Rumpf: Schultern y 13–14 (Goldschulterstücke D/B bei (3/4,13) und (15/16,13)), Rippen/Brust y 14–16 (C D B-Muster), Becken y 17–20.
* Arme: x 1–3 (links) und x 16–18 (rechts), y 14–20 — hängen an den Schultern (y 14); Hände (goldene Fäuste D/F/E) bei y 17–19, x 0–4 / x 15–19.
* Beine y 21–25 mit Füßen y 24–25.
Fest bleiben: Gitter/Umriss, Beine/Füße (nur Glanz), die grauen Nieten.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Funken und Sterne ausgenommen):
* Atmen zweistufig (Periode 48, 0-1-2-1-0 px): Brust (Rippen, Schultern, Arme) steigt zuerst — im Rumpf-Layer wird Zeile y 16 eingefügt, Becken/Beine
  bleiben —, der Kopf folgt 2 Frames später und liegt nie höher als die Brust (er sinkt höchstens 1 px in die Schultern, nie entsteht ein Spalt).
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 2,5 px, wächst von der Schulter zur Hand); die Schulterzeile y 14 bleibt am Rumpf.
* Smaragdaugen glühen (Periode 12: J → H → K und zurück), Blinzeln Frame 20–22 und 44–46.
* Gold glänzt (Regel 12): ein Lichtband (Farbrampe C → F → E → D → B, Mitte zwei Stufen, Rand eine) läuft alle 24 Frames diagonal über die ganze Figur;
  jeder Goldpunkt E funkelt in eigenem Takt (E → D, Periode 12); die seitlichen Nieten leuchten als Lauflicht von oben nach unten (Periode 12);
  Glitzersterne (Mitte B, Arme B; an den Augen Mitte B, Arme J) blitzen für 3 Frames an Krone, Schultern, Händen, Füßen und Augen auf und bleiben am Objekt.
* Goldstaub (Partikel, hinter der Figur, 9 Stück, Lebensdauer 48 Frames, langsam aufsteigend, Formen o, k): über der Krone, an den Kopfseiten und an
  den Händen. Kern B, Rand E (Farben des Sprites).
ERGÄNZUNG: keine gemalten Pixel (Kopf sinkt nur über Rumpfpixel, Arme lösen sich nur nach außen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 20, 4

spr = L.lade('treasure-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, B_, C_, D_, E_, F_ = (182, 38, 0), (247, 247, 173), (238, 100, 40), (247, 247, 96), (250, 213, 74), (242, 154, 62)
# A Gitter/Umriss, B hellstes Gold, C orangerot, D gelb, E Gold, F orange
G_ = (117, 0, 0)
J_, H_, K_ = (0, 255, 88), (0, 187, 64), (0, 125, 43)          # Smaragd: hell, mittel, dunkel
RAMPE = {C_: F_, F_: E_, E_: D_, D_: B_}                       # Goldrampe: eine Stufe heller
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (A_, B_, C_, D_, E_, F_, G_, J_, H_, K_)), 'Farbkonstante nicht im Sprite'

arm_l = vorhanden & (xx <= 4) & (yy >= 15) & (yy <= 20)
arm_r = vorhanden & (xx >= 15) & (yy >= 15) & (yy <= 20)
kopf = vorhanden & (yy <= 12)
rumpf = vorhanden & (yy >= 13) & (yy <= 20) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 21)
assert (arm_l | arm_r | kopf | rumpf | beine).sum() == vorhanden.sum()

gold = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and tuple(spr[y, x, :3]) in RAMPE]
gold_e = [(x, y) for (x, y) in gold if tuple(spr[y, x, :3]) == E_ and not (x in (16, 17) and y in (5, 7, 9, 11))]
D_MIN, D_MAX = min(x + y for x, y in gold), max(x + y for x, y in gold)

# Seitliche Nieten (Lauflicht von oben nach unten), je Zeile ein Paar: (links, rechts)
NIETEN = [([(2, 5), (3, 5)], [(16, 5), (17, 5)]), ([(2, 7), (3, 7)], [(16, 7), (17, 7)]),
          ([(2, 9)], [(16, 9), (17, 9)]), ([(2, 11)], [(16, 11), (17, 11)])]
LINKS_HELLER = {G_: A_, F_: E_}                 # links im Schatten: eine Stufe auf ihrer Rampe
AUGEN_L = dict(hell=[(7, 9), (8, 9), (7, 10), (8, 10)])
AUGEN_R = dict(hell=[(11, 9), (12, 9), (11, 10), (12, 10)])
GLOW12 = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0]   # Augenglühen (Periode 12), 0 = Original

STAUB = {'c': B_, 'r': E_}
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS = [
    dict(x=P(9, -2)[0], y=P(9, -2)[1], vx=0, vy=-12, off=0, form='o', wackeln=1),      # über der Krone
    dict(x=P(4, -1)[0], y=P(4, -1)[1], vx=-2, vy=-11, off=17, form='k', wackeln=1),
    dict(x=P(15, -1)[0], y=P(15, -1)[1], vx=2, vy=-11, off=33, form='k', wackeln=1),
    dict(x=P(0, 8)[0], y=P(0, 8)[1], vx=-3, vy=-10, off=8, form='o', wackeln=1),       # an den Kopfseiten
    dict(x=P(19, 8)[0], y=P(19, 8)[1], vx=3, vy=-10, off=26, form='o', wackeln=1),
    dict(x=P(0, 19)[0], y=P(0, 19)[1], vx=-3, vy=-12, off=12, form='o', wackeln=1),    # an den Händen
    dict(x=P(19, 19)[0], y=P(19, 19)[1], vx=3, vy=-12, off=36, form='o', wackeln=1),
    dict(x=P(6, 25)[0], y=P(6, 25)[1], vx=-2, vy=-9, off=22, form='k', wackeln=1),     # an den Füßen
    dict(x=P(13, 25)[0], y=P(13, 25)[1], vx=2, vy=-9, off=44, form='k', wackeln=1),
]
# Glitzersterne: (Pos im Sprite, Ebene, Startframe, Stufen)
STERNE = [((4, 1), 'kopf', 3, (2, 3, 2)), ((15, 1), 'kopf', 15, (2, 3, 2)),
          ((16, 13), 'rumpf', 9, (2, 3, 2)), ((3, 13), 'rumpf', 21, (2, 3, 2)),
          ((3, 18), 'arm_l', 27, (2, 3, 2)), ((16, 18), 'arm_r', 39, (2, 3, 2)),
          ((5, 24), 'bein', 33, (2, 3, 2)), ((14, 24), 'bein', 45, (2, 3, 2)),
          ((8, 9), 'kopf', 6, (1, 2, 1)), ((12, 9), 'kopf', 30, (1, 2, 1))]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def glanz(layer, punkte, k):
    """Lichtband (Mitte zwei, Rand eine Stufe) + funkelnde Goldpunkte (E → D) auf einer Ebene mit Sprite-Koordinaten."""
    U.band_diagonal(layer, punkte, RAMPE, -3 + 2 * k, 3, PAD_L, PAD_T)
    U.band_diagonal(layer, punkte, RAMPE, -2 + 2 * k, 1, PAD_L, PAD_T)
    return layer


def frame(i):
    r_b = stufe2(i)
    r_k = max(min(r_b, stufe2(i - 2)), r_b - 1)                   # Kopf folgt der Brust, nie höher, höchstens 1 px tiefer
    hump = U.buckel(i, 0, 24, n=24)
    aus = 2.5 * hump
    k = i % 24
    glut = GLOW12[i % 12]
    blink = {20: 1, 21: 2, 22: 1, 44: 1, 45: 2, 46: 1}.get(i, 0)

    def pixel(lay, punkte, farbe):
        for (x, y) in punkte:
            lay[PAD_T + y, PAD_L + x, :3] = farbe
        return lay

    # --- Kopf ---
    kp = teil(kopf)
    for g in (AUGEN_L, AUGEN_R):
        if blink:
            # halb zu: Smaragd dunkel; zu: obere Reihe wird Haut (B), untere Reihe Gitterstrich (A)
            for (x, y) in g['hell']:
                kp[PAD_T + y, PAD_L + x, :3] = K_ if blink == 1 else (B_ if y == 9 else A_)
        elif glut:
            for (x, y) in g['hell']:
                cur = tuple(kp[PAD_T + y, PAD_L + x, :3])
                kp[PAD_T + y, PAD_L + x, :3] = {J_: H_ if glut == 1 else K_, H_: K_ if glut == 2 else H_}.get(cur, cur)
    glanz(kp, [p for p in gold if p[1] <= 12], k)
    for gi, (links, rechts) in enumerate(NIETEN):                 # Lauflicht der seitlichen Nieten (Periode 12)
        if i % N and (i + 3 * gi) % 12 < 3:                       # Frame 0 bleibt das Original
            for (x, y) in rechts:
                if tuple(kp[PAD_T + y, PAD_L + x, :3]) in RAMPE:
                    kp[PAD_T + y, PAD_L + x, :3] = RAMPE[tuple(kp[PAD_T + y, PAD_L + x, :3])]
            for (x, y) in links:
                cur = tuple(kp[PAD_T + y, PAD_L + x, :3])
                if cur in LINKS_HELLER:
                    kp[PAD_T + y, PAD_L + x, :3] = LINKS_HELLER[cur]
    for (x, y) in gold_e:                                         # jedes Gold-E funkelt im eigenen Takt
        if i % N and y <= 12 and (i + (3 * x + 5 * y)) % 12 < 2 and tuple(kp[PAD_T + y, PAD_L + x, :3]) == E_:
            kp[PAD_T + y, PAD_L + x, :3] = D_
    # --- Rumpf, Arme, Beine ---
    rp = teil(rumpf)
    glanz(rp, [p for p in gold if 13 <= p[1] <= 20 and not (p[0] <= 4 and p[1] >= 15) and not (p[0] >= 15 and p[1] >= 15)], k)
    for (x, y) in gold_e:
        if i % N and 13 <= y <= 20 and (i + (3 * x + 5 * y)) % 12 < 2 and tuple(rp[PAD_T + y, PAD_L + x, :3]) == E_:
            rp[PAD_T + y, PAD_L + x, :3] = D_
    rp = L.streck_zeile(rp, PAD_T + 16, r_b)
    al, ar = teil(arm_l), teil(arm_r)
    glanz(al, [p for p in gold if p[0] <= 4 and p[1] >= 15], k)
    glanz(ar, [p for p in gold if p[0] >= 15 and p[1] >= 15], k)
    al = U.haengen(al, PAD_T + 14, -aus)
    ar = U.haengen(ar, PAD_T + 14, aus)
    bn = teil(beine)
    glanz(bn, [p for p in gold if p[1] >= 21], k)
    staub = U.glut_ebene(H, W, i, N, PUFFS, STAUB)

    # --- Glitzersterne (nach der Figur; bleiben am Objekt) ---
    sterne = L.leer(H, W)
    for (px, py), ebene, start, stufen in STERNE:
        kk = i - start
        if 0 <= kk < len(stufen):
            dy = {'kopf': -r_k, 'rumpf': -r_b, 'arm_l': -r_b, 'arm_r': -r_b, 'bein': 0}[ebene]
            dx = 0
            if ebene in ('arm_l', 'arm_r'):
                f = (py - 14) / 6.0
                dx = int(round((-aus if ebene == 'arm_l' else aus) * f))
            augen = (py == 9)
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + px + dx, PAD_T + py + dy, stufen[kk], B_, J_ if augen else B_))
    return L.zusammen(H, W, [(staub, 0, 0), (bn, 0, 0), (rp, 0, 0), (al, 0, -r_b), (ar, 0, -r_b), (kp, 0, -r_k), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('treasure-skeleton', 'Treasure Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/treasure-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=7)
