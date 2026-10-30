# -*- coding: utf-8 -*-
"""Idle-Animation für „Stellin, the Calm Dictator“ (Creature) — der ruhige Diktator mit den schwarzen Haaren, dem Ziegenbart, der roten Schärpe und den ausgebreiteten Armen.

Quelle: src/stellin-the-calm-dictator.png (18×24 px, 24 Farben).
PICK: [["MotiveRussia", 225, 4]]      (Ebene „STELLIN“, Figur 4; Abgleich mit der Kunst Stellin_the_Calm_Dictator.png: 100 % bei (28,15))
Abgleich mit der Karte: Die Ebene „STELLIN“ enthält fünf Figuren; Figur 4 (20×26 mit Rand, 267 px) ist die Hauptfigur in der Kartenmitte (Augen geschlossen, „ruhig“). Die vier kleinen Figuren (2, 3, 5, 6)
sind die Schneemänner in den Ecken der Kunst (andere Wesen, Beiwerk). Ebene 142 „Ebene #97“ ist dieselbe Figur mit OFFENEN Augen (zweite Ausdrucks-Variante, 98 %); die Kunst zeigt aber die geschlossenen Augen — ich
habe also nicht die Variante 142, sondern die Karten-Variante verwendet. Der rote Schein um die Figur in der Kunst ist eine halbtransparente Aura (nicht im Sprite).

Aufruf:   python3 stellin_the_calm_dictator.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/stellin-the-calm-dictator.png + .json

Was im Sprite ist (x, y im 18×24-Sprite):
* HAARE (x 4–13, y 0–6): schwarze Haare (0,0,0) mit grauen Lichtern (N (65,65,65), O (106,106,106), P (156,156,156), T (189,189,189), I (41,41,41)), seitlich weit herabgezogen, Pony y 3–5.
* GESICHT (y 4–8): Haut (246,189,123)/(246,205,139)/(255,230,213), die Augen sind GESCHLOSSEN (schwarze Lid-Balken (6–7, 7) und (10–11, 7)) — ruhiger, entspannter Ausdruck; unten ein grauer Ziegenbart M (82,82,82)/I (41,41,41) (6–11, 9–10).
* ROBE (y 10–20): olivbraun (J (72,61,29), R (93,78,47), S (138,123,82), E (40,31,14)) mit einer diagonalen ROTEN SCHÄRPE (H (201,47,35), L (151,37,26), K (114,35,22), D (74,23,14)) von der rechten Schulter
  (12, 11) schräg zur linken Hüfte (6, 18); unten ein dunkler Saum (y 20).
* ARME (x 0–4 und 13–17, y 10–15): weit nach außen und oben ausgebreitet, Hände in Hautfarbe (255,230,213)/(246,189,123)/(246,205,139) mit braunem Umriss A (49,24,0) bei (1–3, 11–14) und (14–16, 11–14).
* FÜSSE (y 21–23): nackte Füße (F (246,205,139), B, G) bei (4–7, 21–22) und (10–13, 21–22), Sohlen A (49,24,0).
Kein Metall, Gold oder Edelstein → KEIN Glanz (Regel 14); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos; ruhig und würdevoll):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Saumzeile 20 wird einmal doppelt eingefügt: Robe, Arme, Kopf steigen, Füße bleiben), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px
  (Wangenzeile 8, glatte Haut unter den Augen, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Hände schweben: beide Hände (Spalten 0–3 links und 14–17 rechts) heben und senken sich ±1 px gegeneinander (Periode 24, gegenphasig) — eine ruhige, segnende Geste; die Ärmel bleiben am Körper.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–20) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); die Füße bleiben stehen.
* Kopfneigen: der Kopf (Zeilen 0–8) neigt sich 1 px nach links (Frames 2–7) und rechts (Frames 26–31); der Bart (Zeilen 9–10) bleibt hängen.
* Fußtippen: der linke Fuß hebt sich zweimal 1 px hinter den Saum (Frames 12–19), später der rechte (Frames 36–43).
Kein Blinzeln: die Augen sind im Sprite bereits geschlossen (ruhiger Ausdruck); die offene Variante (Ebene 142) gehört nicht zur Karten-Optik und wird nicht gezeigt.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Füße liegen beim Heben hinter dem Saum).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('stellin-the-calm-dictator')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAAR_UMRISS, ROBE_UMRISS = f(6, 0), f(4, 12)                        # (0,0,0), (49,24,0)

fuss_l = vorhanden & (xx <= 8) & (yy >= 21)
fuss_r = vorhanden & (xx >= 9) & (yy >= 21)
rumpf = vorhanden & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k = ebene(rumpf)
    # --- Hände schweben (gegenphasig, ±1 px) ---
    dl = int(round(1.2 * math.sin(L.sinus(i, N / 2))))
    dr = -dl
    if dl:
        Hm.spalten_versatz(k, OFF, {x: (dl, 9, 16) for x in range(0, 4)})
        Hm.spalten_versatz(k, OFF, {x: (dr, 9, 16) for x in range(14, 18)})
    # --- Kopfneigen (Zeilen 0–8) und Gewichtsverlagerung (Zeilen 0–20) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 26, [1] * 6, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 9)}, -2, sw + 1)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 21)}, -2, sw + 1)
    # --- Auf und ab: Saum 20 = Brust, Wangenzeile 8 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 8, brust, kopf)
    # --- Fußtippen (die Füße liegen hinter dem Saum) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Haare → Schwarz, Robe/Arme/Füße → Braun)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 6 else ROBE_UMRISS
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
    L.speichern('stellin-the-calm-dictator', 'Stellin, the Calm Dictator', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/stellin-the-calm-dictator-strip.png', frames, spalten=12, scale=6)
