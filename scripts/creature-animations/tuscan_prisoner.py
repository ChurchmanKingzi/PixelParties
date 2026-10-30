# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Prisoner“ (Creature) — der gefangene Elefantenmensch hinter den Gitterstäben: riesige graue Ohren, leuchtend cyanfarbene Augen, die Hände an den Stäben.

Quelle: src/tuscan-prisoner.png (24×25 px, 17 Farben).
PICK: [["MotiveRussia", 132, 1]]      (Ebene „Ebene #96“, Figur 1, nur in dieser Karte; die Gitterstäbe sind eine eigene Ebene (131), der Herrscher mit der Krone von hinten Ebene 130)
Abgleich mit der Kartenkunst Tuscan_Prisoner.png (76×51): Sprite sitzt dort bei (26,7). Die Stäbe (Ebene 131) verdecken 167 der 388 Pixel; von den 221 sichtbaren Pixeln stimmen 100 % mit der Kunst überein
(nächstbester Treffer 44 %). Auf der Karte stehen außerdem die Stäbe und die Krone des Aristokraten von hinten am unteren Rand: beides gehört nicht zur Figur.

Aufruf:   python3 tuscan_prisoner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-prisoner.png + .json

Was im Sprite ist (x, y im 24×25-Sprite):
* OHREN (x 0–6 links, 17–23 rechts, y 0–12): riesige graue Ohren (91,82,83)/(124,112,112)/(161,147,144) mit schwarzem Umriss (23,21,22).
* KOPF (x 7–16, y 1–12): braungrauer Elefantenkopf (73,68,59)/(132,119,105) mit dunkler Seitenkante (47,44,38)/(18,21,20); schwarze Lidblöcke (y 7–8) und die leuchtenden AUGEN: je ein
  2-Pixel-Strich in Cyan (193,255,255) über (73,255,255) bei (9,9–10) und (14,9–10).
* ARME/HÄNDE (y 13–17): orangefarbene Hände (156,105,62)/(239,161,95)/(245,203,161) bei (3–4,13–14) und (19–20,13–15), innere Handteile bei (7–8,13–14) und (15–16,13–14), weiße Manschetten
  (225,215,217)/(189,189,189) bei (5–6,15–16) und (17–18,15–16) — die Hände halten die Stäbe.
* KÖRPER (y 13–22): dunkler Kittel mit schwarzer Mittelnaht (32,29,30)/(47,44,38), graue Seiten; Beine y 22–24 mit weißen Stiefelspitzen (225,215,217)/(189,189,189) bei (7–9,23) und (14–16,23).
Metall/Gold/Edelsteine im Sprite: keine (die Augen sind Leuchtpixel, kein Edelstein). Also kein Glanz (Regel 14), kein Farbtausch an den Augen außer dem Blinzeln. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (die glatte Kittelzeile 20 wird einmal doppelt eingefügt: Körper, Arme und Kopf steigen, die Beine bleiben), der Kopf läuft 3 Frames nach
  und hebt sich um ein weiteres px (Halszeile 11): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Ohrenwackeln: das linke Ohr schlägt zweimal 1 px nach außen (Frames 14–19, aus–aus–zu–zu–aus–aus), das rechte später (Frames 38–43). Die Ohren sind eigene Ebenen (x ≤ 6 bzw. ≥ 17, y ≤ 12);
  die Zeile wird mit `Hm.rand_dehnen` um 1 px nach außen gedehnt, innen bleibt alles am Kopf.
* Gewichtsverlagerung: Körper (Zeilen 0–19) samt Ohren und Armen 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Hosenbeine und Stiefel bleiben stehen.
* Kopfneigen: Kopf und Ohren (Zeilen 0–12) neigen sich 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31), getrennt von der Verlagerung.
* Hände rutschen an den Stäben: der linke Arm (Zeilen 13–17) spreizt sich 1 px nach außen (Frames 22–33), der rechte (Frames 2–9 und 46–47).
* Blinzeln (Frames 19–21 und 41–43): die vier Cyan-Pixel nehmen die umgebende Kopffarbe an. Kein Leuchten/Pulsieren, kein Farbtausch.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter den Kittelsaum (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter dem Saum).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Ohr/Arm ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('tuscan-prisoner')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
KOPF = f(10, 10)                                                    # Kopffarbe um die Augen: Lid = umgebende Körperfarbe
UMRISS = f(8, 12) if False else (23, 21, 22)
AUGEN = [(9, 9), (9, 10), (14, 9), (14, 10)]

ohr_l = vorhanden & (xx <= 6) & (yy <= 12)
ohr_r = vorhanden & (xx >= 17) & (yy <= 12)
arm_l = vorhanden & (xx <= 8) & (yy >= 13) & (yy <= 17)
arm_r = vorhanden & (xx >= 15) & (yy >= 13) & (yy <= 17)
fuss_l = vorhanden & (xx <= 10) & (yy >= 23)
fuss_r = vorhanden & (xx >= 13) & (yy >= 23)
rumpf = vorhanden & ~ohr_l & ~ohr_r & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k, ol, orr, al, ar = ebene(rumpf), ebene(ohr_l), ebene(ohr_r), ebene(arm_l), ebene(arm_r)
    # --- Blinzeln: die Cyan-Augenpixel nehmen die Kopffarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {p: KOPF for p in AUGEN}, OFF)
    # --- Ohrenwackeln: Zeile um 1 px nach außen dehnen (Ohren sind eigene Ebenen, innen bleibt der Kopf) ---
    pat = [1, 1, 0, 0, 1, 1]
    if Hm.folge(i, 14, pat, N):
        Hm.rand_dehnen(ol, OFF, {y: 1 for y in range(1, 9)}, 'l')
    if Hm.folge(i, 38, pat, N):
        Hm.rand_dehnen(orr, OFF, {y: 1 for y in range(1, 9)}, 'r')
    # --- Hände rutschen nach außen ---
    dl = 1 if Hm.folge(i, 22, [1] * 12, N) else 0
    dr = 1 if (Hm.folge(i, 2, [1] * 8, N) or Hm.folge(i, 46, [1, 1], N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(13, 18)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(13, 18)}, 'r')
    # --- Kopfneigen (Zeilen 0–12 samt Ohren) und Gewichtsverlagerung (Zeilen 0–19 samt Ohren/Armen) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 13)}, -3, sw + 2)
        for o in (ol, orr):
            Hm.bereich_versatz(o, OFF, {y: kn for y in range(0, 13)}, -3, sw + 2)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 20)}, -3, sw + 2)
        for o in (ol, orr):
            Hm.bereich_versatz(o, OFF, {y: gv for y in range(0, 13)}, -3, sw + 2)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(13, 18)}, -3, sw + 2)
    # --- Auf und ab: glatte Kittelzeile 20 = Brust, Halszeile 11 läuft 3 Frames nach (Ohren steigen mit dem Kopf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 11, brust, kopf)
    ol = Hm.atmen(ol, PAD_T + 20, PAD_T + 11, brust, kopf)
    orr = Hm.atmen(orr, PAD_T + 20, PAD_T + 11, brust, kopf)
    al = Hm.atmen(al, PAD_T + 20, PAD_T + 11, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 20, PAD_T + 11, brust, 0)
    # --- Fußtippen (die Stiefel liegen hinter dem Saum) ---
    pat2 = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat2, N) else 0
    hr = 1 if Hm.folge(i, 36, pat2, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (ol, 0, 0), (orr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS
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
    L.speichern('tuscan-prisoner', 'Tuscan Prisoner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tuscan-prisoner-strip.png', frames, spalten=12, scale=6)
