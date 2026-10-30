# -*- coding: utf-8 -*-
"""Idle-Animation für „Celia, the Class Clown“ (Creature) — das Mädchen mit den blauvioletten Haaren, dem seitlichen Pferdeschwanz, roter Weste und blauer Hose.

Quelle: src/celia-the-class-clown.png (17×25 px, 32 Farben).
PICK: [["MotiveArcanum", 146, 2]]      (Ebene „Celia“, Figur 2; nur in dieser Karte)
Ebenen 69 und 18 (Ebene „#76“/„#35“) sind Ausdrucks-Varianten desselben Mädchens (offener Mund) und bleiben ungenutzt; die Kerzenkrone und die Topfpflanze der Kunst liegen nicht in dieser Ebene.

Aufruf:   python3 celia_the_class_clown.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/celia-the-class-clown.png + .json

Was im Sprite ist (x, y im 17×25-Sprite):
* HAARE (x 2–16, y 0–7, Blauviolett A (35,29,85) < H (57,46,145) < C (65,53,158) < F (70,58,169) < K (79,66,177) < J (97,83,185)): Pony mit Mittelscheitel, dichte Strähnen, ein seitlicher Pferdeschwanz rechts oben
  (Spitze (13,0)/(12–14,1), Strähnen x 13–16, y 2–5, eine dünne Strähne (15,6)–(15,7)); eine rote Haarspange (212,39,39)/(143,0,50) mit schwarzem Rand bei (11–12, 3–4).
* GESICHT (y 7–12, x 5–10): Haut (246,190,158), hell (252,231,214); zwei Augen: schwarze Wimpern (5–6, 8) und (9–10, 8), darunter ein weißer Pixel (248,254,255) und eine türkise Iris (0,222,174) bei
  (5–6, 9) und (9–10, 9); rosa Wangen (255,156,153) bei (5,10) und (10,10); ein kleiner dunkelroter Mund (116,0,0)/(150,0,0) bei (6,11), (7–8,12).
* GLITZERSTERN links (x 0–4, y 8–12): ein weißer vierzackiger Stern (255,255,255) mit dunklem Kern (2,10) — er wird als Sparkle animiert (s. u.).
* KRAGEN/WESTE (y 13–17): roter Schal/Fliege (212,39,39), (221,76,76), (143,0,50) mit braunem Umriss B (49,24,0), Weste mit hellen Pixeln; Arme in Hautfarbe E (248,188,119) mit braunem Umriss, Hände bei (0–3, 17–19) links und (8–12, 17–19) rechts.
* HOSE (y 18–21): blaue Shorts N (17,111,249)/P (10,69,152); Beine y 22–24: weiße Socken Q (178,180,177)/(255,255,255) und schwarze Schuhe D (0,2,0).
Kein Metall, Gold oder Edelstein im Sprite → KEIN Glanz (Regel 14); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Atmen (einmal je Schleife): die Hüftzeile 20 wird einmal doppelt eingefügt (Texturmischung): Oberkörper, Arme und Kopf steigen 1 px, Beine und Schuhe bleiben.
* Pferdeschwanz schwingt: die Spitze (Zeilen 0–1) schlägt 1 px nach links (Frames 4–9) bzw. rechts (Frames 16–21), die dünne Strähne (15,6)–(15,7) pendelt gegenläufig (Frames 8–13 nach rechts, 22–27 nach links) — 4-verbunden.
* GLITZERN: das weiße Plus mit dem dunklen Loch links (x 0–4, y 8–12) ist ein Glitzerstern: zweimal je Schleife (Periode 24) schrumpft er auf 1-px-Arme, verschwindet bis auf den dunklen Kern und wächst wieder.
  Darunterliegende Haarfarben/Umriss kommen aus der Quelle (Pixel (3,9)/(4,9), Umriss (2,10)).
* Kein Kopfwiegen, kein Armspreizen mehr (Rückmeldung: zu viel Squash & Stretch); nur ein Atemzug je Schleife.
* Blinzeln (Frames 20–22 und 38–40): weißer Pixel und türkise Iris beider Augen nehmen die umgebende Hautfarbe (246,190,158) an (Lid = Hautfarbe); die Wimpern bleiben. Kein Farbtausch, kein Augenglanz.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; Pferdeschwanz-Spitze und Strähne bleiben über ihrer Nachbarzeile, die Armlücke füllt die Hautfarbe).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Armspreizung/Kopfwiegen ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('celia-the-class-clown')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAAR_UMRISS, KOERPER_UMRISS = f(2, 5), f(6, 13)                     # A (35,29,85), B (49,24,0)
HAUT = f(6, 10)                                                     # (246,190,158), Lidfarbe
AUGEN = [(5, 9), (6, 9), (9, 9), (10, 9)]

# Arme (zeilenweise Grenze zum Rumpf): links x ≤ XL[y], rechts x ≥ XR[y]
XL = {14: 4, 15: 4, 16: 4, 17: 4, 18: 3, 19: 3}
XR = {14: 10, 15: 10, 16: 9, 17: 9, 18: 8, 19: 8}
arm_l = np.zeros((sh, sw), bool)
arm_r = np.zeros((sh, sw), bool)
for y in range(14, 20):
    arm_l[y, :XL[y] + 1] = True
    arm_r[y, XR[y]:] = True
arm_l &= vorhanden
arm_r &= vorhanden
rumpf = vorhanden & ~arm_l & ~arm_r


STERN_ARM, STERN_RAND = f(2, 8), f(2, 10)                           # Sternweiß (255,255,255), Kern/Umriss (35,29,85)
STERN_HAAR_L, STERN_HAAR_R = f(3, 9), f(4, 9)                       # Haarfarben unter den rechten Sternarmen
STERN = [2] * 8 + [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2]  # 24 Frames; 2 = voller Stern (Original), 1 = Arme kurz, 0 = nur Kern


def frame(i):
    t, _ = L.trenne(spr, rumpf)
    k = L.platz(t, H, W, PAD_L, PAD_T)
    tl, _ = L.trenne(spr, arm_l)
    al = L.platz(tl, H, W, PAD_L, PAD_T)
    tr, _ = L.trenne(spr, arm_r)
    ar = L.platz(tr, H, W, PAD_L, PAD_T)
    # --- Glitzerstern (x 0–4, y 8–12): zweimal je Schleife schrumpft er auf kurze Arme, verschwindet und wächst wieder ---
    sp_stufe = STERN[i % len(STERN)]
    if sp_stufe < 2:
        weg = {(2, 8): STERN_RAND, (2, 9): STERN_RAND, (2, 11): STERN_RAND, (2, 12): STERN_RAND, (3, 10): STERN_HAAR_L, (4, 10): STERN_HAAR_R,
               (0, 10): None, (1, 10): None}
        Hm.setze(k, weg, OFF)
        if sp_stufe == 1:                                           # Arme nur 1 px: der innere Ring bleibt weiß
            Hm.setze(k, {(2, 9): STERN_ARM, (2, 11): STERN_ARM, (1, 10): STERN_ARM, (3, 10): STERN_ARM}, OFF)
    # --- Blinzeln: weißer Pixel und Iris nehmen die Hautfarbe an ---
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    # --- Pferdeschwanz: Spitze und dünne Strähne ---
    sp = -1 if Hm.folge(i, 4, [1] * 6, N) else (1 if Hm.folge(i, 16, [1] * 6, N) else 0)
    if sp:
        Hm.bereich_versatz(k, OFF, {0: sp, 1: sp}, 11, 15)
    st = 1 if Hm.folge(i, 8, [1] * 6, N) else (-1 if Hm.folge(i, 22, [1] * 6, N) else 0)
    if st:
        Hm.bereich_versatz(k, OFF, {6: st, 7: st}, 14, 16)
    # --- Kopfwiegen (Zeilen 0–12 samt Stern und Pferdeschwanz) ---
    kw = 0                                                          # Köpfe von Humanoiden bewegen sich nicht seitlich (Rückmeldung)
    if kw:
        Hm.bereich_versatz(k, OFF, {y: kw for y in range(0, 13)}, 0, sw - 1)
    # --- Arme schwingen (rand_dehnen: Schulterzeile 14 bleibt, Zeilen 15–19 weichen 1 px nach außen) ---
    dl = 1 if (Hm.folge(i, 6, [1] * 12, N) or Hm.folge(i, 32, [1] * 6, N)) else 0
    dr = 1 if (Hm.folge(i, 18, [1] * 12, N) or Hm.folge(i, 42, [1] * 6, N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(15, 20)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(15, 20)}, 'r')
    # --- Auf und ab: Hüftzeile 20 = Brust (Rumpf und Arme), Kragenzeile 13 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N, 1)                                       # nur ein Atemzug je Schleife (weniger Squash & Stretch)
    kopf = 0
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 13, brust, kopf)
    al = Hm.atmen(al, PAD_T + 20, PAD_T + 13, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 20, PAD_T + 13, brust, 0)
    fig = L.zusammen(H, W, [(al, 0, 0), (ar, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss: oben (Haare) Haarumriss, unten (Körper) Braun
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 13 else KOERPER_UMRISS
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('celia-the-class-clown', 'Celia, the Class Clown', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/celia-the-class-clown-strip.png', frames, spalten=12, scale=6)
