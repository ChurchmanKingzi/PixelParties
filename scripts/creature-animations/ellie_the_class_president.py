# -*- coding: utf-8 -*-
"""Idle-Animation für „Ellie, the Class President“ (Creature) — das Mädchen mit den langen schwarzen Haaren, von hinten gesehen (Rückansicht), mit grünem Oberteil und rotbraunen Schuhen.

Quelle: src/ellie-the-class-president.png (14×24 px, 18 Farben).
PICK: [["MotiveArcanum", 107, 1]]      (Ebene „Ellie“, Figur 1; 2 Karten)

Aufruf:   python3 ellie_the_class_president.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ellie-the-class-president.png + .json

Was im Sprite ist (x, y im 14×24-Sprite; Rückansicht, kein Gesicht):
* HAARE (x 0–13, y 0–18): ein dichter schwarzer/dunkelgrauer Haarschopf (A (32,32,32), B (47,47,47), C (41,41,41), D (2,5,1), E (56,56,56) …) vom Scheitel bis zum Rücken, unten in einem schmalen Zipfel
  (x 4–9, y 16–17; x 5–8, y 18) endend; Ohren: zwei Hautpixel (247,188,151) bei (2,7) und (11,7) mit braunem Umriss H (49,24,0) bei (1,7) und (12,7).
* ARME (x 0–2 und 11–13, y 12–17): schwarze Ärmel (D, L, I, K, M) neben dem Haar, Hände in Hautfarbe (248,188,119) bei (1,16) und (12,16) mit braunem Umriss (0,16), (13,16).
* OBERTEIL (y 17–19): grünes Shirt (G (185,203,101), J (158,181,53)), seitlich neben dem Haarzipfel sichtbar; Saum y 19 komplett grün.
* ROCK/BEINE (y 20–23): schwarz (D); graue Socken N (52,54,51) bei (4–5, 21) und (8–9, 21); rotbraune Schuhe Q (122,43,0)/R (198,70,0) bei (4–5, 22) und (8–9, 22); Sohlen (3–5, 23) und (8–10, 23).
Die Figur zeigt dem Betrachter den Rücken: KEIN Gesicht, KEINE Augen → kein Blinzeln, kein Blick, keine Lidfarbe. Kein Metall, Gold oder Edelstein → KEIN Glanz (Regel 14; Haare glänzen nicht);
kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (die Shirtzeile 18 wird einmal doppelt eingefügt: Haare, Arme, Ohren und der obere Teil des Shirts steigen, Rock und Schuhe bleiben),
  der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Haarzeile 10, glatte Haarstruktur, wird verlängert — Scheitel und Ohren steigen): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Haarzipfel schwingt: der Zipfel (Zeilen 17–18) pendelt ±1 px (Periode 24); die freigelegte Shirtfläche dahinter ist grün (J (158,181,53)), die Naht bleibt 4-verbunden.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–19: Haare, Arme, Shirt) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Rock und Schuhe bleiben stehen.
* Kopfneigen: der Kopf (Zeilen 0–9) neigt sich 1 px nach links (Frames 2–9) und 1 px nach rechts (Frames 24–31), Ohren und Scheitel gehen mit.
* Arme schwingen: der linke Ärmel (Zeilen 13–17) spreizt sich 1 px nach außen (Frames 4–15 und 28–33), der rechte versetzt (Frames 22–33 und 40–45; nie in derselben Richtung wie die Gewichtsverlagerung, damit höchstens 1 px Ausschlag bleibt); Schulterzeile 12 bleibt (`Hm.rand_dehnen`, Lücke in Ärmelfarbe).
* Fußtippen: der linke Fuß hebt sich 1 px hinter den Rock (Frames 12–19, zwei Mal), später der rechte (Frames 36–43); beim Heben verschwindet die Socke hinter dem schwarzen Rock.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: hinter dem schwingenden Haarzipfel wird das Shirt in Grün (158,181,53) ergänzt (die Fläche war im Original vom Zipfel verdeckt; Farbe wie die sichtbaren Shirtseiten).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Gewichtsverlagerung/Armspreizung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('ellie-the-class-president')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
SCHWARZ, HAAR_UMRISS = f(0, 12), f(0, 4)                            # (2,5,1) Umriss der Ärmel, (32,32,32) Haarkante
SHIRT = f(4, 18)                                                    # J (158,181,53): Shirtfarbe hinter dem Haarzipfel

arm_l = vorhanden & (xx <= 2) & (yy >= 13) & (yy <= 17)
arm_r = vorhanden & (xx >= 11) & (yy >= 13) & (yy <= 17)
fuss_l = vorhanden & (xx >= 3) & (xx <= 6) & (yy >= 21)
fuss_r = vorhanden & (xx >= 7) & (xx <= 10) & (yy >= 21)
rumpf = vorhanden & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r
ZIPFEL = [(x, 17) for x in range(4, 10)] + [(x, 18) for x in range(5, 9)]


def zipfel(k, s):
    """Haarzipfel (Zeilen 17–18) um s px versetzen; die vom Zipfel verdeckte Shirtfläche wird grün ergänzt."""
    if not s:
        return k
    alt = {(x, y): k[y + PAD_T, x + PAD_L].copy() for (x, y) in ZIPFEL}
    gruen = k[18 + PAD_T, 4 + PAD_L].copy()                          # (158,181,53)
    for (x, y) in ZIPFEL:
        k[y + PAD_T, x + PAD_L] = gruen
    for (x, y), px in alt.items():
        k[y + PAD_T, x + s + PAD_L] = px
    return k


def frame(i):
    t, _ = L.trenne(spr, rumpf)
    k = L.platz(t, H, W, PAD_L, PAD_T)
    tl, _ = L.trenne(spr, arm_l)
    al = L.platz(tl, H, W, PAD_L, PAD_T)
    tr, _ = L.trenne(spr, arm_r)
    ar = L.platz(tr, H, W, PAD_L, PAD_T)
    # --- Haarzipfel schwingt ---
    k = zipfel(k, int(round(1.2 * math.sin(L.sinus(i, N / 2)))))
    # --- Arme schwingen (Ärmel Zeilen 13–17 weichen 1 px nach außen) ---
    dl = 1 if (Hm.folge(i, 4, [1] * 12, N) or Hm.folge(i, 28, [1] * 6, N)) else 0
    dr = 1 if (Hm.folge(i, 22, [1] * 12, N) or Hm.folge(i, 40, [1] * 6, N)) else 0
    if dl:
        Hm.rand_dehnen(al, OFF, {y: 1 for y in range(13, 18)}, 'l')
    if dr:
        Hm.rand_dehnen(ar, OFF, {y: 1 for y in range(13, 18)}, 'r')
    # --- Kopfneigen (Zeilen 0–9) und Gewichtsverlagerung (Zeilen 0–19 samt Armen); getrennte Zeitfenster ---
    kn = 0                                           # Nutzer-Feedback: Kopf bewegt sich nicht seitwärts
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 10)}, 0, sw - 1)
    gv = 0                                           # Nutzer-Feedback: keine seitliche Verlagerung des Oberkörpers/Kopfes
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 20)}, 0, sw - 1)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(13, 18)}, -2, sw + 1)       # inkl. der 1 px nach außen gespreizten Ärmelpixel
    # --- Auf und ab: Shirtzeile 18 = Brust (Rumpf und Arme), Haarzeile 10 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 10, brust, kopf)
    al = Hm.atmen(al, PAD_T + 18, PAD_T + 10, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 18, PAD_T + 10, brust, 0)
    # --- Fußtippen: der Fuß liegt hinter dem Rock und hebt sich 1 px ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    tfl, _ = L.trenne(spr, fuss_l)
    fl = L.platz(tfl, H, W, PAD_L, PAD_T - hl)
    tfr, _ = L.trenne(spr, fuss_r)
    fr = L.platz(tfr, H, W, PAD_L, PAD_T - hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Haare → Haarkante, unten → Schwarz)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 19 else SCHWARZ
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
    L.speichern('ellie-the-class-president', 'Ellie, the Class President', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/ellie-the-class-president-strip.png', frames, spalten=12, scale=6)
