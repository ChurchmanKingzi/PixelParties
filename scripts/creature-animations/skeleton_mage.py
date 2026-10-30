# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Mage“ (Creature) — Fassung 2 (Blitze, synchrone Ärmel, mehr Bewegung, Glanz).

Quelle: src/skeleton-mage.png — Ebene „Skele Mage #1“ (22×23 px, 22 Farben) aus Motive.xcf.
PICK: [["Motive", 68, 1]]   (die Ebene enthält als zweite Pose eine Seitenansicht; die Karte benutzt die Frontansicht)

Aufruf:   python3 skeleton_mage.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-mage.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Kapuze: gewölbter Bogen y 0–9, x 4–17, Umriss B/M, außen Besatz (H tan, E braun, F dunkelbraun innen).
* Schädel im Kapuzenausschnitt: Stirn O/P (y 5–6), Augenhöhlen G (schwarz) bei (8,6/7) und (13,6/7); blaue Augenpunkte U (46,0,172)
  bei (9,7) und (12,7), dazwischen weißes Nasenbein D (10/11,7), Nase P (10/11,8), Wangenknochen D/I (y 8).
* Mund: offenes „O“ — obere Zähne D (10/11,9), seitlich V (9/12,10) und D (9/12,11), untere Zähne D (10/11,12); Mundinneres G schwarz.
* Ärmel: links x 0–5, rechts x 16–21, y 9–13 — violette Stoffzipfel (C Umriss, N/Q Violett), vermutlich die Ärmel der seitlich ausgestreckten
  Arme (in der Seitenpose hängt an so einem Ärmel eine Knochenhand). Hände sind in der Frontpose nicht zu sehen.
* Robe/Kragen: y 10–14, dunkel (K, S, R, B, A); Schulterknochen J/I bei (5/6,13) und (15/16,13).
* Rippen/Becken: y 15–17 (I, J, L, D); Beine y 18–22 (Knochen L/D/I auf A-Umriss), Füße y 21–22.
Fest bleiben: Kapuze samt Besatz, Schädel (außer Mund/Augen), Schulterknochen, Rippen/Becken, Beine/Füße (nur Glanz).

Ablauf (40 Frames à 65 ms = 2,6 s; Frame 0 = Original, die Funken und Blitze ausgenommen):
* Schweben zweistufig (Periode 40, 0-1-2-1-0 px): Oberkörper (Kapuze, Kopf, Robe, Ärmel) steigt, im Oberkörper-Layer wird die Zeile y 14
  eingefügt (Rippen/Beine bleiben am Boden). Die Ärmel steigen starr mit.
* Kapuze atmet (Periode 20): die Zeile y 4 wird einmal eingefügt, die Kuppe hebt sich 1 px (Gesicht, Ärmel bleiben).
* Ärmel SYNCHRON (gleiche Periode und Phase, gespiegelt): Geste alle 20 Frames, die Spitzen heben sich bis 2 px und flattern zusätzlich mit
  einer Welle (Periode 10, die Spitze hinkt hinterher) bis ±2,4 px; Spaltenversatz wächst von der Schulter (x 5 / x 16, Versatz 0) zur Spitze.
* Kleine Blitze (Regel: Magie zeigen): 12 Zickzack-Blitze à 3–6 Pixel (Länge 2–5 px, 8 Muster, 4-verbunden, keine Kreuzform) knistern je
  3 Frames (voll, anderes Muster, kurz) an wechselnden Stellen um die Ärmelspitzen (links Start Frame 1, 8, 14, 21, 27, 34; rechts 4, 11, 18, 24, 31,
  37) — etwa 4–5 pro Sekunde, immer an der Hand, folgen deren Bewegung. Farben: Weiß D (246,255,255) mit Augenblau U (46,0,172) an Spitze/Knick.
* Augen: Glimmen (Periode 10: blau → dunkelviolett → blau), Blinzeln Frame 14–16 und 34–36 (N → schwarz → N). Glanz (Regel 12): vierzackiger Glitzerstern
  (Mitte Weiß D, Arme Augenblau U) am linken Auge Frame 8–10, am rechten Frame 24–26 — der Stern bleibt am Auge.
* Kiefer klappert öfter: Zahnpixel (9,11) (12,11) (10,12) (11,12) rutschen 1 px nach unten (Mundinneres schwarz G) — dreimal ab Frame 4, zweimal ab 18,
  dreimal ab 30.
* Knochenglanz (Regel 12): ein Lichtband (Knochenrampe J → I → L → D, 107 → 189 → 213 → 246) läuft alle 20 Frames diagonal über Schultern, Rippen und
  Beine; ein Glitzerstern (Mitte D, Arme L) blitzt am rechten Fuß (15,21) Frame 30–32 auf.
* Zauberfunken (Partikel, hinter der Figur, 9 Stück, Lebensdauer 40 Frames, langsam aufsteigend, Formen o, m, k): von den Ärmelspitzen, über der Kapuze und an den Schultern.
  Kern weiß D, Rand Augenblau U (beides aus dem Sprite).
ERGÄNZUNG: keine gemalten Pixel; Mundinneres nutzt die vorhandene Farbe G (0,0,0).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 40, 65
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 18, 4

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
J_, I_, L_ = c(8, 17), c(9, 15), c(9, 17)         # Knochenrampe: (107,107,107) → (189,189,189) → (213,213,213)
RAMPE = {J_: I_, I_: L_, L_: WEISS}

ins = L.farbmaske(spr, [C, N_, Q])
aermel_l = vorhanden & ins & (xx <= 5) & (yy >= 9) & (yy <= 13)
aermel_r = vorhanden & ins & (xx >= 16) & (yy >= 9) & (yy <= 13)
koerper = vorhanden & ~aermel_l & ~aermel_r                       # Kapuze, Kopf, Robe, Rippen, Beine
oben = koerper & (yy <= 14)                                       # hebt sich beim Schweben
unten = koerper & (yy >= 15)                                      # bleibt am Boden
knochen = [(x, y) for y in range(13, 23) for x in range(sw) if vorhanden[y, x] and tuple(spr[y, x, :3]) in RAMPE and (y >= 15 or x in (5, 6, 15, 16))]
D_MIN = min(x + y for x, y in knochen)
D_MAX = max(x + y for x, y in knochen)

AUGEN = [(9, 7), (12, 7)]
ZAEHNE = [(9, 11), (12, 11), (10, 12), (11, 12)]
KIEFER_FARBE = c(9, 11)                                           # D weiß
MUND_INNEN = SCHWARZ
GLIMMEN10 = [0, 0, 0, 0, 0, 1, 1, 0, 0, 0]                        # Augenglimmen, Periode 10

FUNKEN = {'c': WEISS, 'r': BLAU}
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS = [
    dict(x=P(0, 7)[0], y=P(0, 7)[1], vx=-2, vy=-11, off=0, form='o', wackeln=1),       # über der linken Ärmelspitze
    dict(x=P(21, 7)[0], y=P(21, 7)[1], vx=2, vy=-11, off=20, form='o', wackeln=1),     # über der rechten Ärmelspitze
    dict(x=P(9, -3)[0], y=P(9, -3)[1], vx=-1, vy=-10, off=10, form='m', wackeln=1),    # über der Kapuze links
    dict(x=P(12, -3)[0], y=P(12, -3)[1], vx=1, vy=-11, off=30, form='k', wackeln=1),   # über der Kapuze rechts
    dict(x=P(5, 4)[0], y=P(5, 4)[1], vx=-3, vy=-8, off=5, form='k', wackeln=1),        # an der Kapuzenseite links
    dict(x=P(16, 4)[0], y=P(16, 4)[1], vx=3, vy=-8, off=25, form='k', wackeln=1),      # … rechts
    dict(x=P(3, 14)[0], y=P(3, 14)[1], vx=-3, vy=-9, off=15, form='o', wackeln=1),     # an der linken Schulter
    dict(x=P(18, 14)[0], y=P(18, 14)[1], vx=3, vy=-9, off=35, form='o', wackeln=1),    # an der rechten Schulter
    dict(x=P(10, -2)[0], y=P(10, -2)[1], vx=0, vy=-12, off=8, form='k', wackeln=1),    # Funke über der Mitte
]

# Blitze: (Start, Seite, Anker relativ zur Ärmelspitze, Muster a, Muster b) — je 3 Frames: voll, anderes Muster, kurz
BLITZE = [
    (1, 'l', (-2, -2), 0, 3), (4, 'r', (-1, 1), 5, 2), (8, 'l', (1, -3), 3, 6), (11, 'r', (-2, -3), 1, 4),
    (14, 'l', (-3, 1), 2, 7), (18, 'r', (0, 3), 6, 0), (21, 'l', (0, 3), 5, 1), (24, 'r', (-3, 0), 4, 7),
    (27, 'l', (2, -1), 7, 2), (31, 'r', (1, -2), 3, 5), (34, 'l', (-1, -4), 0, 6), (37, 'r', (-2, 2), 1, 3),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def frame(i):
    r_b = stufe2(i)                                              # Schweben (zweistufig)
    r_c = U.stufe(i, N / 2, 1)                                   # Kapuze atmet (0/1, Periode 20)
    hump = U.buckel(i, 0, 20, n=20)                              # Ärmel-Geste (Periode 20), Frame 0 = Ruhe
    ph = L.sinus(i, 10)                                          # Flatterwelle (Periode 10)
    glimmen = GLIMMEN10[i % 10]
    blink = {14: 1, 15: 2, 16: 1, 34: 1, 35: 2, 36: 1}.get(i, 0)
    kiefer = max(U.puls(i, 4, [1, 0, 1, 0, 1, 0]), U.puls(i, 18, [1, 0, 1, 0]), U.puls(i, 30, [1, 0, 1, 0, 1, 0]))

    ob = teil(oben)
    # Augen
    stufe_aug = 2 if blink == 2 else (1 if (blink == 1 or glimmen) else 0)
    for (x, y) in AUGEN:
        if stufe_aug:
            ob[PAD_T + y, PAD_L + x, :3] = DUNKEL_VIOLETT if stufe_aug == 1 else SCHWARZ
    # Kiefer
    U.kiefer(ob, ZAEHNE, KIEFER_FARBE, MUND_INNEN, kiefer, PAD_L, PAD_T)
    ob = L.streck_zeile(ob, PAD_T + 4, r_c)                      # Kapuze atmet (Kuppe hebt sich)
    ob = L.streck_zeile(ob, PAD_T + 14, r_b)                     # Oberkörper steigt (Zeile y 14 eingefügt)

    # Ärmel SYNCHRON: gleiche Funktion, gleiche Phase, gespiegelt
    amp, bias = 2.4 * hump, -2.0 * hump
    al = L.spalten_welle(teil(aermel_l), PAD_L + 5, amp, ph, bias=bias, lauf=1.0, nur_rechts=False)
    ar = L.spalten_welle(teil(aermel_r), PAD_L + 16, amp, ph, bias=bias, lauf=1.0, nur_rechts=True)
    un = teil(unten)
    # Knochenglanz: Lichtband über Schultern/Rippen/Beine (alle 20 Frames, diagonal von links oben nach rechts unten)
    k = i % 20
    U.band_diagonal(un, [p for p in knochen if p[1] >= 15], RAMPE, D_MIN - 2 + k, 2, PAD_L, PAD_T)
    U.band_diagonal(ob, [p for p in knochen if p[1] < 15], RAMPE, D_MIN - 2 + k, 2, PAD_L, PAD_T - r_b)
    funken = U.glut_ebene(H, W, i, N, PUFFS, FUNKEN)

    # Blitze an den Ärmelspitzen (vorn)
    blitze = L.leer(H, W)
    spitze = {}
    for seite, spalte, sa in (('l', PAD_L + 0, al), ('r', PAD_L + 21, ar)):
        ys = np.nonzero(sa[:, spalte, 3])[0]
        spitze[seite] = (spalte, int(round(ys.mean())) - r_b)
    for (start, seite, (ox, oy), ma, mb) in BLITZE:
        kk = i - start
        if 0 <= kk <= 2:
            sx, sy = spitze[seite]
            sp = seite == 'r'
            ax = sx + (-ox if sp else ox)
            ay = sy + oy
            muster, laenge = (ma, None) if kk == 0 else ((mb, None) if kk == 1 else (ma, 3))
            L.einsetzen(blitze, U.blitz_ebene(H, W, ax, ay, muster, sp, WEISS, BLAU, laenge))

    # Glitzersterne (nach der Figur): am Auge und am Fuß
    sterne = L.leer(H, W)
    for (st, ex) in (({8: 1, 9: 2, 10: 1}.get(i, 0), 9), ({24: 1, 25: 2, 26: 1}.get(i, 0), 12)):
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + ex, PAD_T + 7 - r_b, st, WEISS, BLAU))
    st_fuss = {30: 1, 31: 2, 32: 1}.get(i, 0)
    if st_fuss:
        L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + 15, PAD_T + 21, st_fuss, WEISS, c(9, 17)))

    return L.zusammen(H, W, [(funken, 0, 0), (un, 0, 0), (ob, 0, 0), (al, 0, -r_b), (ar, 0, -r_b), (blitze, 0, 0), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('skeleton-mage', 'Skeleton Mage', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-mage-strip.png', [frames[k] for k in (0, 5, 10, 15, 20, 25, 30, 35)], spalten=4, scale=7)
