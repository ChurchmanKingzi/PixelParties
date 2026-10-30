# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Bard“ (Creature).

Quelle: src/skeleton-bard.png — Ebene „Skeleton Bard“ (21×25 px, 339 Pixel, 25 Farben) aus Motive.xcf (Ebene 382, Figur 1, Treffer 1.0). Übernommen aus dem Repo (unverändert, alle Pixel
deckend). Die bunten Musiknoten der Kartenkunst (grün, lila, rot, gelb; Ebene 381) sind eigene Ebenen weit um die Figur herum und NICHT Teil dieses Sprites.
PICK: [["Motive", 382, 1]]

Aufruf:   python3 skeleton_bard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-bard.png + .json

Was ist was (x/y im Sprite):
* Hut (x 0–14, y 0–9): schwarzer Schlapphut mit breiter Krempe (y 4–8) und grauem Band (58,68,70)/(38,48,50); oben rechts eine blaue Feder (12–13, 0–3) in (100,156,213)/(59,115,172).
* Schädel (x 5–12, y 10–13): weißer Knochen (246,255,255)/(213,213,213)/(189,189,189) mit schwarzen Augenhöhlen unter der Krempe; hier keine farbigen Augen.
* Rumpf (x 4–13, y 12–21): Rippenkorb aus weißen Knochen auf Schwarz; blaue Stoffreste/Instrumentenkorpus (16,76,162)/(28,71,126) in der Mitte (6–8, 17–19) und unten rechts (11–14, 21–24).
* Linker Arm (x 1–4, y 10–20): brauner Ärmel (49,24,0) mit Knochen; rechter Arm: blauer Ärmel (x 12–17, y 7–10) mit erhobener weißer Knochenhand (x 16–20, y 4–8, weiße/graue Fingerknochen
  mit schwarzem Umriss).
* Beine/Füße (y 19–24): Knochen, rechts unten blauer Stiefel (10–14, 22–24).
Fest bleiben: Hutform und Krempe, Rippenmuster, Ärmelform, Umrisse.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel ausgenommen) — alles im Takt eines Vierertakts (Beat = 12 Frames):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): die Rippenzeile y 16 wird 1–2× eingefügt, Hut, Schädel, Schultern, Arme und Hand heben sich, Becken, Beine und Füße bleiben am Boden.
* Kopfnicken im Takt: Hut + Schädel (y ≤ 9 und Schädel y 10–12) sinken 1 px für 3 Frames (je Beat bei Frame 3–5), Schädel liegt dann über der obersten Rippe.
* Fußwippen: der rechte Fuß (x 10–14, y 22–24) hebt sich 1 px für 3 Frames (je Beat bei Frame 9–11).
* Zupfhand: die erhobene Knochenhand (x 16–20, y 4–8) sinkt 1 px für 2 Frames im doppelten Takt (alle 6 Frames bei Frame 2–3); sie bleibt über die Handwurzel an den Ärmel angebunden (nur Abwärtsbewegung,
  damit die Pixel 4-verbunden bleiben).
* Federspitze (12–13, 0): die oberste Federzeile pendelt −1/0 px (Periode 24); die Zeile darunter bleibt stehen (Differenz ≤ 1 px).
* Klangfunken (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen k, o): hellblaue Kugeln (Kern (100,156,213), Rand
  (59,115,172)) und weiße Funken (255,255,255) steigen an Hand, Feder und linker Seite auf; nur Farben des Sprites, runde Formen (keine Noten- oder Kreuzformen).
Kein Glanz (Regel 14: Knochen, Stoff und Holz sind kein Metall; kein Metallteil erkennbar), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts.
ERGÄNZUNG: keine gemalten Pixel. Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Figurenrand hinaus, dazu 1 px leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 8, 4

spr = L.lade('skeleton-bard')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
SCHWARZ = (1, 3, 7)
assert SCHWARZ in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

hand = vorhanden & (xx >= 16) & (yy <= 8) & ~((xx == 16) & (yy >= 7))     # Finger + Handmanschette; die Ärmelpixel (16,7) (16,8) bleiben am Ärmel
kopf = vorhanden & ~hand & ((yy <= 9) | ((yy <= 12) & (xx >= 5) & (xx <= 12)))
fuss = vorhanden & (xx >= 10) & (yy >= 22)
rest = vorhanden & ~hand & ~kopf & ~fuss
assert (hand | kopf | fuss | rest).sum() == vorhanden.sum()
FEDER = [(x, y) for y in range(0, 2) for x in range(11, 15) if vorhanden[y, x]]
assert FEDER and all(y <= 1 for (x, y) in FEDER)

HELLBLAU = {'c': (100, 156, 213), 'r': (59, 115, 172)}
WEISS = {'c': (255, 255, 255), 'r': (255, 255, 255)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in (HELLBLAU['c'], HELLBLAU['r'], WEISS['c']))
P = lambda x, y: (GPL + x, GPT + y)
PUFFS_BLAU = [
    dict(x=P(18, 4)[0], y=P(18, 4)[1], vx=2, vy=-6, off=0, form='o', wackeln=1),            # aus der erhobenen Hand
    dict(x=P(2, 12)[0], y=P(2, 12)[1], vx=-1, vy=-6, off=20, form='o', wackeln=1),          # links neben dem Arm
    dict(x=P(6, 2)[0], y=P(6, 2)[1], vx=0, vy=-5, off=36, form='o', wackeln=1),             # über dem Hut
]
PUFFS_WEISS = [
    dict(x=P(14, 2)[0], y=P(14, 2)[1], vx=1, vy=-5, off=10, form='k', wackeln=1),           # an der Feder
    dict(x=P(19, 10)[0], y=P(19, 10)[1], vx=1, vy=-8, off=26, form='k', wackeln=1),         # rechts
    dict(x=P(3, 18)[0], y=P(3, 18)[1], vx=-1, vy=-8, off=40, form='k', wackeln=1),          # links unten
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0
    nick = 1 if i % 12 in (3, 4, 5) else 0                       # Kopfnicken im Takt
    tapp = 1 if i % 12 in (9, 10, 11) else 0                     # Fußwippen
    zupf = 1 if i % 6 in (2, 3) else 0                           # Zupfhand sinkt 1 px
    feder = -1 if (i % 24) in range(6, 14) else 0                # oberste Federzeile pendelt

    kp = teil(kopf)
    if feder:                                                    # oberste Zeile y 0 der Feder (x 11–14) 1 px nach links; Zeile y 1 bleibt
        for (x, y) in FEDER:
            if y == 0:
                kp[GPT, GPL + x + feder] = kp[GPT, GPL + x]
                kp[GPT, GPL + x] = 0
    hd = teil(hand)
    rp = L.streck_zeile(teil(rest), GPT + 16, n)
    fz = teil(fuss)
    koerper = L.zusammen(H, W, [(fz, 0, -tapp), (rp, 0, 0), (kp, 0, -n + nick), (hd, 0, -n + zupf)])
    koerper = U.kontur_schliessen(koerper, UMRISS, SCHWARZ)
    if nur == 'koerper':
        return koerper
    blau = _glut(H, W, i, N, PUFFS_BLAU, HELLBLAU)
    weiss = _glut(H, W, i, N, PUFFS_WEISS, WEISS)
    return L.zusammen(H, W, [(blau, 0, 0), (weiss, 0, 0), (koerper, 0, 0)])


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
    L.speichern('skeleton-bard', 'Skeleton Bard', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-bard-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
