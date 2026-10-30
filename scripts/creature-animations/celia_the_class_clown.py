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
* ARME SCHLACKERN (Rückmeldung): beide Arme pendeln locker mit drei Schwüngen je Schleife (links/rechts versetzt): jede Zeile unter der Schulter (Zeile 14) wandert waagerecht, je weiter unten (Hand),
  desto mehr (Hand bis 3 px nach außen, bis 1–2 px nach innen vor den Körper). Dabei wird der Körper darunter prozedural fortgesetzt: unter dem rechten Arm (in der Quelle verdeckt) entstehen Weste, Gürtel
  und Shorts mit den Farben der sichtbaren Nachbarpixel samt braunem Umriss; links liegt der Körperrand schon in der Quelle. Die Arme liegen vor dem Körper.
* Kein Kopfwiegen (Rückmeldung: zu viel Squash & Stretch); nur ein Atemzug je Schleife.
* Blinzeln (Frames 20–22 und 38–40): weißer Pixel und türkise Iris beider Augen nehmen die umgebende Hautfarbe (246,190,158) an (Lid = Hautfarbe); die Wimpern bleiben. Kein Farbtausch, kein Augenglanz.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; Pferdeschwanz-Spitze und Strähne bleiben über ihrer Nachbarzeile, die Armlücke füllt die Hautfarbe).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 4, 2          # Figur knapp zugeschnitten: Armschlackern bis 3 px seitlich, Kopfhub 1–2 px oben, Randabstand ≥ 2

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

# Arme: links alles bis XL[y] (Schulter, Oberarm, Hand samt Umriss), rechts die ausdrücklich gelisteten Pixel (Schulter, Oberarm, Hand am Gürtel samt Umriss und rotem Ärmelband)
XL = {14: 4, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3}
arm_l = np.zeros((sh, sw), bool)
for y, xl in XL.items():
    arm_l[y, :xl + 1] = True
ARM_R = [(10, 14), (11, 14), (12, 14), (10, 15), (11, 15), (12, 15), (9, 16), (10, 16), (11, 16), (12, 16), (8, 17), (9, 17), (10, 17), (11, 17), (12, 17),
         (7, 18), (8, 18), (9, 18), (10, 18), (8, 19), (9, 19)]
arm_r = np.zeros((sh, sw), bool)
for x, y in ARM_R:
    arm_r[y, x] = True
arm_l &= vorhanden
arm_r &= vorhanden
rumpf = vorhanden & ~arm_l & ~arm_r
HAUT_ARM = f(4, 14)                                                 # (248,188,119): Armhaut
DUNKEL = {f(4, 15), f(5, 14), f(4, 13), f(6, 13)}                   # dunkle Körperpixel (Westenrand, Haarumriss, Braun): daran braucht die Hand keinen eigenen Umriss
OUTLINE_N4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]


def arm_zerlegen(m):
    """Armmaske → (Haut-Pixel, Extras): Extras sind Armpixel, die weder Haut noch 4-Nachbar der Haut sind (rote Ärmelbänder, Umrissecke); der Umriss wird beim Schlackern neu um die Haut gezeichnet."""
    haut = {(x, y): f(x, y) for y, x in zip(*np.nonzero(m)) if f(x, y) == HAUT_ARM}
    nachbarn = {(x + dx, y + dy) for (x, y) in haut for dx, dy in OUTLINE_N4}
    extra = {(x, y): f(x, y) for y, x in zip(*np.nonzero(m)) if f(x, y) != HAUT_ARM and (x, y) not in nachbarn}
    return haut, extra


ARM_L_TEILE, ARM_R_TEILE = arm_zerlegen(arm_l), arm_zerlegen(arm_r)


def arm_bauen(teile, dx_zeile, k):
    """Arm für die Zeilenverschiebungen dx_zeile ({y: dx}) auf einer Leinwandebene: Haut und Extras wandern zeilenweise, der braune Umriss wird um die verschobene Haut neu gezeichnet
    (nicht dort, wo der Körper `k` schon ein dunkles Pixel hat). Ohne Verschiebung entsteht genau der Originalarm."""
    haut, extra = teile
    a = L.leer(H, W)
    for (x, y), c in extra.items():
        Hm.setze(a, {(x + dx_zeile.get(y, 0), y): c}, OFF)
    sk = {(x + dx_zeile.get(y, 0), y) for (x, y) in haut}
    for (x, y) in sk:
        Hm.setze(a, {(x, y): HAUT_ARM}, OFF)
    for (x, y) in sk:
        for dx, dy in OUTLINE_N4:
            n = (x + dx, y + dy)
            if n in sk or a[n[1] + PAD_T, n[0] + PAD_L, 3]:
                continue
            kp = k[n[1] + PAD_T, n[0] + PAD_L]
            if kp[3] and tuple(int(v) for v in kp[:3]) in DUNKEL:
                continue
            Hm.setze(a, {n: BRAUN}, OFF)
    return a

# Körper UNTER dem rechten Arm (in der Quelle verdeckt, wird beim Schlackern frei): Weste, Gürtel und Shorts werden mit den Farben der sichtbaren Nachbarn fortgesetzt,
# am Rand der Umriss (49,24,0). Alle diese Pixel liegen im Ruhezustand unter dem Arm (Frame 0 = Original).
BRAUN, WESTE, GUERTEL, SHORTS_H, SHORTS_D, SCHLITZ = f(6, 13), f(7, 15), f(5, 17), f(5, 18), f(4, 18), f(7, 19)
KOERPER_UNTER = {(10, 14): BRAUN, (10, 15): BRAUN, (9, 16): WESTE, (10, 16): BRAUN, (8, 17): GUERTEL, (9, 17): GUERTEL, (10, 17): GUERTEL, (11, 17): BRAUN,
                 (7, 18): BRAUN, (8, 18): SHORTS_H, (9, 18): SHORTS_H, (10, 18): SHORTS_H, (8, 19): SCHLITZ, (9, 19): SHORTS_H}

STERN_ARM, STERN_RAND = f(2, 8), f(2, 10)                           # Sternweiß (255,255,255), Kern/Umriss (35,29,85)
STERN_HAAR_L, STERN_HAAR_R = f(3, 9), f(4, 9)                       # Haarfarben unter den rechten Sternarmen
STERN = [2] * 8 + [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2]  # 24 Frames; 2 = voller Stern (Original), 1 = Arme kurz, 0 = nur Kern


def frame(i):
    t, _ = L.trenne(spr, rumpf)
    k = L.platz(t, H, W, PAD_L, PAD_T)
    Hm.setze(k, KOERPER_UNTER, OFF)
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
    # --- Arme schlackern: jede Zeile unter der Schulter (Zeile 14) wandert waagerecht, je weiter unten (Hand), desto mehr; links 3, rechts 2 Schwünge je Schleife (Frame 0 = Ruhe) ---
    ua, ub = math.sin(L.sinus(i, N / 3)), math.sin(L.sinus(i, N / 2))
    sl = -3.1 * ua if ua > 0 else -1.4 * ua                         # links: -3,1 (außen) … +1,4 (innen)
    sr = 3.1 * ub if ub > 0 else 1.4 * ub                           # rechts: +3,1 (außen) … -1,4 (innen)
    al = arm_bauen(ARM_L_TEILE, {y: int((y - 14) / 5 * sl) for y in range(15, 20)}, k)
    ar = arm_bauen(ARM_R_TEILE, {y: int((y - 14) / 5 * sr) for y in range(15, 20)}, k)
    # --- Auf und ab: Hüftzeile 20 = Brust (Rumpf und Arme), Kragenzeile 13 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N, 1)                                       # nur ein Atemzug je Schleife (weniger Squash & Stretch)
    kopf = 0
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 13, brust, kopf)
    al = Hm.atmen(al, PAD_T + 20, PAD_T + 13, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 20, PAD_T + 13, brust, 0)
    fig = L.zusammen(H, W, [(k, 0, 0), (al, 0, 0), (ar, 0, 0)])        # Arme vor dem Körper
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
