# -*- coding: utf-8 -*-
"""Idle-Animation für „Bouldor Demon“ (Creature).

Quelle: src/bouldor-demon.png — Ebene „Bouldor Demon“ (26×32 px, 425 Pixel, 16 Farben) aus MotiveDeri.xcf (Ebene 152, Figur 1, Treffer 0.995; in der Kartenkunst 2:1 vergrößert).
PICK: [["MotiveDeri", 152, 1]]

Aufruf:   python3 bouldor_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bouldor-demon.png + .json

Was ist was (x/y im Sprite):
* Gehörnter roter Dämon: zwei große graue Widderhörner (x 8–14 und x 18–25, y 0–9; Stein-/Hornfarben (100,85,82)/(89,76,68)/(57,50,44) mit Umriss (48,41,35)), rotes Gesicht (x 10–20, y 9–18; (151,67,39)
  mit Schatten (115,56,40) und hellem Fleck auf der Stirn (182,115,96)); Augen und Brauen dunkelrot-braun: Augen (13–14,13) (16–17,13) (13,14) (17,14), Brauen (12–13,12) (17–18,12).
* Körper (x 10–22, y 19–28): grau-schwarze Rüstung, rote Gürtel-/Schulterteile; Beine (x 11–21, y 28–31) mit rötlichen Füßen und schwarzer Lücke dazwischen (15–16, 29–30).
* Linker Arm (x 5–10, y 19–23): rote Faust, die gegen eine Mauer (nicht im Sprite) schlägt; die SCHWARZEN RISSE links davon (x 0–8, y 13–27, 31 Pixel, reines Schwarz (0,0,0)) sind die Sprünge in der Mauer —
  liegen am Boden/an der Wand und bleiben fest.
Fest bleiben: Hörner, Gesichtsform, Rüstung, Risse.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Staub ausgenommen) — Fels/Horn glänzt nicht (Regel 14), kein Feuer (Regel 15):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): die Zeile y 25 des Rumpfs wird 1–2× eingefügt; Kopf samt Hörnern, Schultern und Arm heben sich, Beine und Füße bleiben am Boden.
* Faustschlag (Periode 24, zweimal pro Schleife): die Faust zieht sich 2 px zum Körper zurück (Frame 10–13) und schlägt wieder an die Wand (Frame 14); der Arm ist ein starres Teil (x 5–9, y 19–23), das sich nur
  zum Körper hin bewegt (so bleibt es 4-verbunden). Beim Aufschlag nickt der Kopf 1 px nach unten (Frame 12–14 und 36–38) und ein Staubwölkchen löst sich an der Faust.
* Blinzeln (Lid = Hautfarbe (151,67,39)): die Augenpixel werden 3 Frames lang zur Gesichtsfarbe (Frame 4–6 und 28–30); die Brauen bleiben. Kein Glühen oder Farbtausch sonst.
* Füße wippen starr im Wechsel: linker Fuß hebt sich 1 px (Frame 17–19), rechter (Frame 5–7) — Beine y 28–31.
* Staub und Steinbröckchen (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen m, o): graubraune Wölkchen (Kern (100,85,82), Rand (89,76,68))
  an der Faust (zwei davon starten genau beim Aufschlag, Frame 14 und 38) und an den Füßen; nur Farben des Sprites, rund.
Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (48,41,35)) in jeder Pose; im Ruhebild nichts. ERGÄNZUNG: keine gemalten Pixel.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Staub vergrößert ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 8, 4

spr = L.lade('bouldor-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (48, 41, 35)
HAUT = (151, 67, 39)
schwarz = np.array([[bool(vorhanden[y, x]) and col(x, y) == (0, 0, 0) for x in range(sw)] for y in range(sh)])
risse = schwarz & (xx <= 8)
fig = vorhanden & ~risse
arm = fig & (xx <= 9) & (yy >= 19) & (yy <= 23)
kopf = fig & (yy <= 18) & (xx >= 8)
bein_l = fig & (xx <= 15) & (yy >= 28)
bein_r = fig & (xx >= 17) & (yy >= 28)
rumpf = fig & ~arm & ~kopf & ~bein_l & ~bein_r
assert (arm | kopf | bein_l | bein_r | rumpf).sum() == fig.sum()
AUGEN = [(13, 13), (14, 13), (16, 13), (17, 13), (13, 14), (17, 14)]
assert all(col(x, y) in {(99, 35, 7), (73, 33, 21)} for (x, y) in AUGEN) and HAUT in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}
BLINZ = {4, 5, 6, 28, 29, 30}
FAUST = {10: 1, 11: 2, 12: 2, 13: 1, 34: 1, 35: 2, 36: 2, 37: 1}       # Faust zieht sich zum Körper zurück (nur 0 … +2 px zum Körper hin)
NICK = {12, 13, 14, 36, 37, 38}

DUNST = {'c': (100, 85, 82), 'r': (89, 76, 68)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in DUNST.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(5, 21)[0], y=P(5, 21)[1], vx=-1, vy=-7, off=37, form='m', wackeln=1),          # Aufschlag Frame 14: t = 0,06 bei Frame 14
    dict(x=P(5, 21)[0], y=P(5, 21)[1], vx=-1, vy=-7, off=13, form='m', wackeln=1),          # Aufschlag Frame 38
    dict(x=P(3, 25)[0], y=P(3, 25)[1], vx=0, vy=-8, off=26, form='o', wackeln=1),           # an den Rissen
    dict(x=P(12, 30)[0], y=P(12, 30)[1], vx=-1, vy=-6, off=0, form='m', wackeln=1),         # an den Füßen
    dict(x=P(20, 30)[0], y=P(20, 30)[1], vx=1, vy=-6, off=24, form='m', wackeln=1),
    dict(x=P(2, 16)[0], y=P(2, 16)[1], vx=-1, vy=-6, off=10, form='o', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0
    kp = teil(kopf)
    if i in BLINZ:
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = HAUT
    nick = 1 if i in NICK else 0
    dx_a = FAUST.get(i, 0)
    bl = 1 if (i % 24) in (17, 18, 19) else 0
    br = 1 if (i % 24) in (5, 6, 7) else 0
    rp = L.streck_zeile(teil(rumpf), GPT + 25, n)
    koerper = L.zusammen(H, W, [(teil(risse), 0, 0), (teil(bein_l), 0, -bl), (teil(bein_r), 0, -br), (rp, 0, 0), (teil(arm), dx_a, -n), (kp, 0, -n + nick)])
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    dunst = _glut(H, W, i, N, PUFFS, DUNST)
    return L.zusammen(H, W, [(dunst, 0, 0), (koerper, 0, 0)])


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
    L.speichern('bouldor-demon', 'Bouldor Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bouldor-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
