# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Rider Warg“ (Creature) — der graue Warg (Wolf), der mit dem Chaorc-Reiter vor sich durch die Flammen springt.

Quelle: src/chaorc-rider-warg.png (33×37 px, 24 Farben) = Warg (src/chaorc-rider-warg-warg.png, 26×33 px) + Reiter (src/chaorc-rider-warg-reiter.png, 23×18 px, bei (10,19) hinter dem Warg).
PICK: [["MotiveHawaii", 118, 1], ["MotiveHawaii", 117, 1]]      (Ebene 117 „Rider Warg“ = der Warg, Ebene 118 daneben = der Chaorc-Reiter (liegt in der xcf unter dem Warg; in der Kartenkunst Chaorc_Rider_Warg.png
  sitzt er bei (32,27), der Warg bei (22,8): 100 % Pixeltreffer des Gesamtbilds). Die Quelle ist vollständig: im Gesamtbild fehlen nur Teile des Reiters, die der Warg verdeckt — sie liegen in der eigenen Reiterebene vor.
  Nicht verwendet: Flammenwand/Gerüst/Kisten der Kunst; Ebene 106/107 (andere Posen des Reiters, 107 = Bewegungsunschärfe).
Aufruf:   python3 chaorc_rider_warg.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-rider-warg.png + .json

Was im Sprite ist (x, y im 33×37-Gesamtbild):
* WARG (x 0–25, y 0–32): grauer Wolf mit schwarzem Umriss (17,19,16) und Fell in (42,44,41)/(50,51,49)/(59,61,58). Spitzes Ohr oben (x 11–15, y 0–4), Kopf y 4–12 mit rotem Augenschlitz (60,1,0)/(164,1,0) bei (15,7),(16,7),(16,8),(17,8),(17,9),
  Schnauze nach rechts (x 17–23, y 9–12); Rumpf/Brust y 13–30 mit senkrechten Fellstreifen, vorgestrecktes Vorderbein/Pranke rechts (x 19–25, y 17–21), Hinterlauf/Pfoten unten (x 10–23, y 28–32);
  flacher Schwanz nach links (x 0–9, y 22–28).
* REITER (x 10–32, y 19–36): kleiner Chaorc mit Spitzkopf, liegt bäuchlings nach rechts (Kopf x 18–32, y 19–28), ein 2×2-Auge (schwarz (0,0,0) + weiß) bei (28,23),(29,23),(28,24),(29,24), Haut (246,189,123)/(213,164,98),
  Umriss (49,24,0); unten links ein eisblaues Stück (180,246,255)/(139,213,255)/(74,172,255)/(246,255,255) mit braunem Saum (x 11–16, y 31–35) = Stiefel/Umhangzipfel (nicht eindeutig → bleibt FEST), Beine (x 17–23, y 33–36).
Metall/Edelstein: nichts eindeutig → KEIN Glanz (Regel 14). Kein Feuer im Sprite (die Flammen der Kunst sind Kulisse).

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos):
* Atmen (Periode 24, zweimal pro Schleife): die Rumpfzeile 22 (nur Warg-Körper, x ≥ 10) wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf, Brust und Pranke steigen 1 px, Hinterlauf/Pfoten bleiben am Boden; der Reiter steigt starr mit der Brust (1 px).
* Schwanzwedeln (Periode 24, zweimal pro Schleife, im Takt des Atmens): L.spalten_welle am Schwanz (Gelenk x 10, Ausschlag bis ±2 px an der Spitze, Gefälle ≤ 1 px je Spalte, bleibt an den Rumpf angewachsen).
* Ohrzucken (Frames 5–8, 29–32 und 14–15, 38–39 doppelt kurz): die zwei oberen Ohrzeilen (y 0–1) knicken 1 px nach links.
* Blinzeln des roten Augenschlitzes (Frames 19–21 und 40–42): die fünf roten Pixel nehmen die Fellfarbe (50,51,49) an (Lid). Der Reiter blinzelt versetzt (Frames 11–13 und 33–35): das 2×2-Auge nimmt die Hautfarbe (246,189,123) an.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): Kontur in jeder Pose in Umrissfarbe, zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Reiter liegt als eigene, vollständige Ebene unter dem Warg; die Schwanzspalten behalten ihren Umriss).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 66
GP = 7

spr = L.lade('chaorc-rider-warg')
warg = L.lade('chaorc-rider-warg-warg')
reiter = L.lade('chaorc-rider-warg-reiter')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
RX, RY = 10, 19                                                    # Lage des Reiters im Gesamtbild
ERLAUBT = Hm.umrissfarben(spr)
UMRISS_WARG = (17, 19, 16)
UMRISS_REITER = (49, 24, 0)
wh, ww = warg.shape[:2]
yy, xx = np.mgrid[0:wh, 0:ww]
schwanz_m = L.deckend(warg) & (xx <= 9)
koerper_m = L.deckend(warg) & ~schwanz_m

FELL = (50, 51, 49)
AUGE_WARG = [(15, 7), (16, 7), (16, 8), (17, 8), (17, 9)]
for p in AUGE_WARG:
    assert tuple(int(v) for v in warg[p[1], p[0], :3]) in ((60, 1, 0), (164, 1, 0))
HAUT = (246, 189, 123)
AUGE_REITER = [(18, 4), (19, 4), (18, 5), (19, 5)]                  # in Reiter-Koordinaten (Gesamtbild: +10,+19)
for p in AUGE_REITER:
    assert tuple(int(v) for v in reiter[p[1], p[0], :3]) in ((0, 0, 0), (255, 255, 255))


def platz_teil(a, m, dx, dy):
    t, _ = L.trenne(a, m)
    return L.platz(t, H, W, GP + dx, GP + dy)


def frame_gross(i, nur=None):
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    # --- Warg-Körper: Ohr, Auge, Atmen ---
    k = platz_teil(warg, koerper_m, 0, 0)
    if any(Hm.folge(i, s, [1] * 4, N) for s in (5, 29)) or any(Hm.folge(i, s, [1, 1], N) for s in (14, 38)):
        Hm.zeilen_versatz(k, OFF, {0: -1, 1: -1})
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(k, {p: FELL for p in AUGE_WARG}, OFF)
    if b:
        k = L.streck_zeile(k, GP + 22, b)
    # --- Schwanz wedelt (Gelenk x = 10), bleibt am Rumpf angewachsen ---
    s = platz_teil(warg, schwanz_m, 0, 0)
    s = L.spalten_welle(s, GP + 10, 2.4, L.sinus(i, 24))
    # --- Reiter: starr mit der Brust, blinzelt ---
    r = platz_teil(reiter, L.deckend(reiter), RX, RY)
    if Hm.folge(i, 11, [1, 1, 1], N) or Hm.folge(i, 33, [1, 1, 1], N):
        Hm.setze(r, {(x + RX, y + RY): HAUT for (x, y) in AUGE_REITER}, OFF)
    r = L.versetze(r, 0, -b)
    f = L.zusammen(H, W, [(r, 0, 0), (k, 0, 0), (s, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe (durch Schwanz-/Zeilenversatz freigelegt) bekommen die Umrissfarbe ihrer Ebene (Warg schwarz, Reiter braun)
    warg_m = (k[..., 3] > 0) | (s[..., 3] > 0)
    for y, x in zip(*np.nonzero(Hm.kantenmaske(f))):
        if tuple(int(v) for v in f[y, x, :3]) not in ERLAUBT:
            f[y, x, :3] = UMRISS_WARG if warg_m[y, x] else UMRISS_REITER
    return f


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('chaorc-rider-warg', 'Chaorc Rider Warg', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-rider-warg-strip.png', frames, spalten=12, scale=5)
