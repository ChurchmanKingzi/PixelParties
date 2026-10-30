# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Mage“ (Creature).

Quelle: src/skeleton-mage.png — Ebene „Skele Mage #1“ (22×23 px, 22 Farben) aus Motive.xcf.
PICK: [["Motive", 68, 1]]   (die Ebene enthält als zweite Pose eine Seitenansicht; die Karte benutzt die Frontansicht)

Aufruf:   python3 skeleton_mage.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-mage.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Kapuze: gewölbter Bogen y 0–9, x 4–17, Umriss B/M, außen Fellbesatz-Braun (H tan, E braun, F dunkelbraun innen).
* Schädel im Kapuzenausschnitt: Stirn O/P (y 5–6), Augenhöhlen G (schwarz) bei (8,6/7) und (13,6/7); blaue Augenpunkte U (46,0,172)
  bei (9,7) und (12,7), dazwischen weißes Nasenbein D (10/11,7), Nase P (10/11,8), Wangenknochen D/I (y 8).
* Mund: offenes „O“ — obere Zähne D (10/11,9), seitlich V (9/12,10) und D (9/12,11), untere Zähne D (10/11,12); Mundinneres G schwarz
  (10/11, 10/11); dunkler Rand R.
* Ärmel: links x 0–5, rechts x 16–21, y 9–13 — violette Stoffzipfel (C Umriss, N/Q Violett), vermutlich die Ärmel der seitlich ausgestreckten
  Arme (in der Seitenpose hängt an so einem Ärmel eine Knochenhand). Hände sind in der Frontpose nicht zu sehen.
* Robe/Kragen: y 10–14, dunkel (K, S, R, B, A); Schulterknochen J/I bei (5/6,13) und (15/16,13).
* Rippen/Becken: y 15–17 (I, J, L, D); Beine y 18–22 (Knochen L/D/I auf A-Umriss), Füße y 21–22.
Fest bleiben: Kapuze samt Besatz, Schädel (außer Mund/Augen), Schulterknochen, Rippen/Becken, Beine/Füße.

Ablauf (48 Frames à 75 ms = 3,6 s; Frame 0 = Original, die Funken ausgenommen):
* Schweben (zweimal pro Schleife, Periode 24): Kapuze, Kopf, Robe und Ärmel heben sich 1 px; dazu wird im Oberkörper-Layer die Zeile y 14
  einmal eingefügt (Rippen/Beine bleiben am Boden). Die Ärmel steigen starr mit.
* Ärmel flattern: Spaltenversatz wächst von der Schulter (x 5 / x 16) zur Spitze bis ±2 px, Wellenlauf (Spitze hinkt hinterher);
  links Periode 16, rechts Periode 24 — unabhängig; eine Böe (sin² über die Schleife) lässt sie bei Frame 0 ruhen und in der Mitte voll schwingen. Die Ärmel liegen frei, an der Schulter bleibt Stoff stehen (Versatz 0).
* Augenglimmen: blaue Augenpunkte werden dunkelviolett (N), zweimal pro Schleife kurz (Frame 26–35); Blinzeln Frame 14–16 (N → schwarz → N).
* Kiefer klappert: die vier weißen Zahnpixel (9,11) (12,11) (10,12) (11,12) rutschen 1 px nach unten (der Mund öffnet sich weiter,
  das frei werdende Mundinnere ist schwarz G); Frame 6–11 dreimal, Frame 34–37 zweimal.
* Zauberfunken (Partikel, hinter der Figur): 5 runde Funken/Klekse aus den Farben des Sprites (Kern weiß D, Rand Augenblau U) steigen
  langsam auf: von beiden Ärmelspitzen (driften nach außen) und über der Kapuze.
ERGÄNZUNG: keine gemalten Pixel; Mundinneres nutzt die vorhandene Farbe G (0,0,0).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 17, 4

spr = L.lade('skeleton-mage')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

c = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
C, N_, Q = c(0, 9), c(3, 10), c(1, 10)           # Ärmel: Umriss, dunkles Violett, helles Violett
BLAU = c(9, 7)                                    # U (46,0,172)
DUNKEL_VIOLETT = N_                               # (55,41,86)
SCHWARZ = c(8, 6)                                 # G (0,0,0)
WEISS = c(10, 7)                                  # D (246,255,255)

ins = L.farbmaske(spr, [C, N_, Q])
aermel_l = vorhanden & ins & (xx <= 5) & (yy >= 9) & (yy <= 13)
aermel_r = vorhanden & ins & (xx >= 16) & (yy >= 9) & (yy <= 13)
koerper = vorhanden & ~aermel_l & ~aermel_r                       # Kapuze, Kopf, Robe, Rippen, Beine
oben = koerper & (yy <= 14)                                       # hebt sich beim Schweben
unten = koerper & (yy >= 15)                                      # bleibt am Boden

AUGEN = [(9, 7), (12, 7)]
ZAEHNE = [(9, 11), (12, 11), (10, 12), (11, 12)]
KIEFER_FARBE = c(9, 11)                                           # D weiß
MUND_INNEN = SCHWARZ

FUNKEN = {'c': WEISS, 'r': BLAU}
PUFFS = [
    dict(x=PAD_L + 0, y=PAD_T + 7, vx=-2, vy=-10, off=0, form='o', wackeln=1),       # über der linken Ärmelspitze
    dict(x=PAD_L + 21, y=PAD_T + 7, vx=2, vy=-10, off=20, form='o', wackeln=1),      # über der rechten Ärmelspitze
    dict(x=PAD_L + 9, y=PAD_T - 3, vx=-1, vy=-9, off=10, form='o', wackeln=1),       # über der Kapuze links
    dict(x=PAD_L + 12, y=PAD_T - 3, vx=1, vy=-10, off=32, form='o', wackeln=1),      # über der Kapuze rechts
    dict(x=PAD_L + 5, y=PAD_T + 4, vx=-3, vy=-8, off=40, form='k', wackeln=1),       # einzelner Funke an der Kapuzenseite
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def frame(i):
    bob = U.stufe(i, N / 2, 1)                                   # 0/1: Schweben, zweimal pro Schleife
    dim = int(round(U.buckel(i, 26, 10)))                        # Augenglimmen (0/1)
    blink = {14: 1, 15: 2, 16: 1}.get(i, 0)
    kiefer = max(U.puls(i, 6, [1, 0, 1, 0, 1, 0]), U.puls(i, 34, [1, 0, 1, 0]))

    ob = teil(oben)
    # Augen
    stufe_aug = 2 if blink == 2 else (1 if (blink == 1 or dim) else 0)
    for (x, y) in AUGEN:
        if stufe_aug:
            ob[PAD_T + y, PAD_L + x, :3] = DUNKEL_VIOLETT if stufe_aug == 1 else SCHWARZ
    # Kiefer
    U.kiefer(ob, ZAEHNE, KIEFER_FARBE, MUND_INNEN, kiefer, PAD_L, PAD_T)
    ob = L.streck_zeile(ob, PAD_T + 14, bob)                     # Oberkörper streckt sich um die eingefügte Zeile

    ph_l = L.sinus(i, 16)
    ph_r = L.sinus(i, 24)
    boe = math.sin(math.pi * i / N) ** 2                          # Windstärke: 0 bei Frame 0 (Ruhepose), 1 in der Mitte der Schleife
    al = L.spalten_welle(teil(aermel_l), PAD_L + 5, 2.6 * boe, ph_l, nur_rechts=False, lauf=1.0)
    ar = L.spalten_welle(teil(aermel_r), PAD_L + 16, 2.6 * boe, ph_r, nur_rechts=True, lauf=1.0)
    un = teil(unten)
    funken = U.glut_ebene(H, W, i, N, PUFFS, FUNKEN)
    return L.zusammen(H, W, [(funken, 0, 0), (un, 0, 0), (ob, 0, 0), (al, 0, -bob), (ar, 0, -bob)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('skeleton-mage', 'Skeleton Mage', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-mage-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
