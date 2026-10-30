# -*- coding: utf-8 -*-
"""Idle-Animation für „Psychic Scout“ (Creature) — der kleine blaugrüne Späher mit den Fledermausohren, den roten Augen, der magentafarbenen Nase und dem geschwungenen Schwanz.

Quelle: src/psychic-scout.png (20×18 px, 14 Farben).
PICK: [["MotiveGrailWar", 433, 1]]      (Ebene „Psychic Scout“, Figur 1; Abgleich mit der Kunst Psychic_Scout.png: 100 % bei (31,17), nur in dieser Karte)
Abgleich mit der Karte: Die Kunst zeigt ein einzelnes blaugrünes Wesen in der Bildmitte, umgeben von Baumstämmen und Büschen (Beiwerk, nicht im Sprite); die benannte Ebene „Psychic Scout“ passt vollständig.

Aufruf:   python3 psychic_scout.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/psychic-scout.png + .json

Was im Sprite ist (x, y im 20×18-Sprite):
* KOPF (x 0–13, y 0–8): rundes blaugrünes Fell (T (63,150,124) hell, (52,124,102) mittel, (43,102,84) dunkel, Umriss (23,54,44)); zwei Fledermausohren mit mauvefarbenen Spitzen (162,136,154)/(121,107,127) bei (1–2, 1–2) und
  (11–12, 1–2); mauvefarbene Brauen (73,64,77) bei (5,2), (8,2), (6–7,3); Augen: lilaweißer Pixel (193,176,214) und rote Iris (196,37,75) bei (4–5, 4) und (8–9, 4); magentafarbene Nase (193,24,141) bei (6–7, 6);
  mauvefarbener Mund (73,64,77) bei (4,7), (9,7) und (5–8, 8).
* SCHWANZ (x 13–19, y 1–5): geschwungen nach oben rechts, Spitze mit rotem (196,37,75) und blauem (63,53,145) Pixel bei (16,2), (17,2), (16,3).
* KÖRPER (x 1–12, y 9–13): helleres Bauchfell (77,143,111)/(63,116,90), mauvefarbener Kragen/Schal (121,107,127)/(162,136,154) bei (4–9, 9–10); kleine rote Greifer (196,37,75) bei (3,13) und (10,13).
* STAB/ARM rechts (x 13–14, y 9–14): mauvefarbene Stange mit blauem Griff (63,53,145) bei (13,11).
* FÜSSE (x 2–5 und 8–11, y 14–17): mauvefarbene Stiefel mit blauer Zehenkappe (63,53,145).
Kein Metall, Gold oder Edelstein im Sprite → KEIN Glanz (Regel 14; die blauen und roten Pixel sind Fell- und Schmuckfarben, kein Edelstein); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (die glatte Bauchzeile 12 wird einmal doppelt eingefügt: Körper, Stab und Kopf steigen, Füße bleiben), der Kopf läuft 3 Frames nach und hebt sich um
  ein weiteres px (Wangenzeile 5, glattes Fell zwischen Augen und Nase, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Schwanzspitze schwingt: die zwei obersten Schwanzzeilen (1–2) schlagen 1 px nach links (Frames 2–7 und 40–45) bzw. nach rechts (Frames 22–27), über der Zeile 3 4-verbunden.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–13) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); die Füße bleiben stehen.
* Kopfneigen: der Kopf (Zeilen 0–8) neigt sich 1 px nach links (Frames 12–17) bzw. rechts (Frames 28–33).
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — lilaweißer Pixel und rote Iris ((4–5,4), (8–9,4)) nehmen die umgebende Fellfarbe (52,124,102) an. Kein Farbtausch, kein Augenglanz.
* Fußtippen: der linke Fuß hebt sich zweimal 1 px hinter den Körper (Frames 14–21), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Füße liegen beim Heben hinter dem Körper).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Schwanzschlag ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('psychic-scout')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
FELL = f(6, 4)                                                      # (52,124,102), Lidfarbe
UMRISS, STIEFEL_UMRISS = f(1, 0), f(2, 17)                          # (23,54,44), (45,41,51)
AUGEN = [(4, 4), (5, 4), (8, 4), (9, 4)]

fuss_l = vorhanden & (xx <= 6) & (yy >= 14)
fuss_r = vorhanden & (xx >= 7) & (yy >= 15)
rumpf = vorhanden & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k = ebene(rumpf)
    # --- Blinzeln ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {p: FELL for p in AUGEN}, OFF)
    # --- Schwanzspitze schwingt (Zeilen 1–2, x 14–19) ---
    st = -1 if (Hm.folge(i, 2, [1] * 6, N) or Hm.folge(i, 40, [1] * 6, N)) else (1 if Hm.folge(i, 22, [1] * 6, N) else 0)
    if st:
        Hm.bereich_versatz(k, OFF, {1: st, 2: st}, 14, sw + 1)
    # --- Kopfneigen (Zeilen 0–8, ohne Schwanz) und Gewichtsverlagerung (Zeilen 0–13) ---
    kn = -1 if Hm.folge(i, 12, [1] * 6, N) else (1 if Hm.folge(i, 28, [1] * 6, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 9)}, -2, 12)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 14)}, -2, sw + 1)
    # --- Auf und ab: Bauchzeile 12 = Brust, Wangenzeile 5 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 12, PAD_T + 5, brust, kopf)
    # --- Fußtippen (die Füße liegen hinter dem Körper) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 14, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Körper → Fellumriss, Füße → Stiefelumriss)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS if y - PAD_T < 14 else STIEFEL_UMRISS
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
    L.speichern('psychic-scout', 'Psychic Scout', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/psychic-scout-strip.png', frames, spalten=12, scale=6)
