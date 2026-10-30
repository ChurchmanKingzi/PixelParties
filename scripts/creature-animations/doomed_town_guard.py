# -*- coding: utf-8 -*-
"""Idle-Animation für „Doomed Town Guard“ (Creature) — der Stadtwächter mit den schwarzen Haaren, der lila Uniform mit Lavendelstreifen und der goldenen Gürtelschnalle.

Quelle: src/doomed-town-guard.png (14×23 px, 27 Farben).
PICK: [["MotiveGrailWar", 676, 1]]      (Ebene „Doomed Town Guard“, Figur 1; Abgleich mit der Kunst Doomed_Town_Guard.png: 100 % bei (40,24); nur in dieser Karte)
Abgleich mit der Karte: Die Kunst zeigt zwei Figuren: unten in der Mitte den dunkelhaarigen Wächter in lila Uniform (dieser Sprite, mit einem weißen Fragezeichen daneben aus kleinen gemeinsam genutzten
Symbol-Ebenen, die nicht zur Figur gehören) und weiter oben ein blondes Mädchen, das hinter der Mauer hervorschaut (Ebene 677, andere Figur, nicht im Sprite).

Aufruf:   python3 doomed_town_guard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/doomed-town-guard.png + .json

Was im Sprite ist (x, y im 14×23-Sprite):
* HAARE (x 1–10, y 0–6): schwarze/dunkelgraue Haare (0,0,0), (24,24,24), (41,41,41), (65,65,65), (82,82,82), Seiten bis y 6.
* GESICHT (y 2–10): Haut (246,189,123)/(213,164,98)/(255,213,164); Augen: schwarze Pupillen bei (4,5) und (7,5), dunkle Lidbalken (4,6), (7,6) und schwarze Lidenden (3,6), (8,6), darunter weiße Pixel
  (246,255,255) bei (4,7) und (8,7) mit braunen Rändern; hellere Wangen/Nase (255,213,164).
* UNIFORM (y 11–19): lila Tunika (65,16,123)/(82,16,156)/(49,0,98) mit Lavendelstreifen (238,213,255)/(213,180,255) und grauen Schulterstücken (65,65,65); Gürtel y 15 mit GOLDENER Schnalle
  (255,205,49)/(255,180,24) bei (5–6, 15); Arme: linke Hand (213,164,98) bei (0,15), rechte Hand (246,189,123)/(213,164,98) bei (10–11, 16).
* BEINE/STIEFEL (y 19–22): schwarz mit weißen Stiefelspitzen (246,255,255)/(189,189,189) bei (3–4, 21).
Metall im Sprite: nur die goldene Gürtelschnalle (Regel 14: nur sie glänzt; Haare, Haut, Stoff nicht). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (die Tunikazeile 17 mit senkrechten Streifen wird einmal doppelt eingefügt: Tunika, Arme und Kopf steigen, Beine/Stiefel bleiben), der Kopf läuft 3 Frames
  nach und hebt sich um ein weiteres px (Kinnzeile 9, glatte Haut unter den Augen, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–18) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); Beine und Stiefel bleiben stehen.
* Kopfneigen: der Kopf (Zeilen 0–8) neigt sich 1 px nach links (Frames 2–7) und 1 px nach rechts (Frames 24–31).
* Arme schwingen: der linke Arm (Zeilen 12–18) spreizt sich 1 px nach außen (Frames 22–33), der rechte (Frames 2–9 und 46–47); nie in derselben Richtung wie die Gewichtsverlagerung (`Hm.rand_dehnen_innen`: der Umriss wandert mit dem Arm, die Lücke füllt die Hand — kein 2-px-Umrissblock).
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — die Pupillen (4,5), (7,5) und die weißen Pixel (4,7), (8,7) nehmen die umgebende Hautfarbe an ((246,189,123) bzw. (255,213,164)); die
  dunklen Lidbalken bleiben als Wimpernlinie. Kein Farbtausch, kein Augenglanz.
* Gold glänzt (Regel 12/14, nur die Schnalle): zweimal pro Schleife blitzt die Gürtelschnalle auf (Frames 7–10 und 31–34): erst wird die rechte Hälfte hell (205,49), dann sitzt ein weißer Glanzpunkt
  (Weiß der Quelle) links auf dem Gold, danach zurück zum Original.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px hinter den Rock (Frames 12–19), später der rechte (Frames 36–43).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter dem Rock).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Armspreizung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('doomed-town-guard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT_AUGE_OBEN, HAUT_AUGE_UNTEN = f(5, 4), f(5, 7)                  # (246,189,123), (255,213,164)
HAAR_UMRISS, KOERPER_UMRISS = (0, 0, 0), (0, 0, 24)
GOLD = [(255, 180, 24), (255, 205, 49)]
WEISS = f(4, 7)                                                     # (246,255,255), Weiß der Quelle

arm_l = vorhanden & (xx <= 2) & (yy >= 12) & (yy <= 18)
arm_r = vorhanden & (xx >= 10) & (yy >= 12) & (yy <= 18)
fuss_l = vorhanden & (xx <= 5) & (yy >= 21)
fuss_r = vorhanden & (xx >= 6) & (yy >= 21)
rumpf = vorhanden & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def frame(i):
    k, al, ar = ebene(rumpf), ebene(arm_l), ebene(arm_r)
    # --- Blinzeln: Pupille und weißer Pixel nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {(4, 5): HAUT_AUGE_OBEN, (7, 5): HAUT_AUGE_OBEN, (4, 7): HAUT_AUGE_UNTEN, (8, 7): HAUT_AUGE_UNTEN}, OFF)
    # --- Gold glänzt (Gürtelschnalle) ---
    for start in (7, 31):
        d = i - start
        if d in (0, 3):                                              # Ansatz/Abklingen: rechte Schnallenhälfte wird hell
            Hm.setze(k, {(6, 15): GOLD[1]}, OFF)
        elif d in (1, 2):                                            # Höhepunkt: weißer Glanzpunkt links (Weiß aus den Augen/Stiefeln der Quelle)
            Hm.setze(k, {(5, 15): WEISS, (6, 15): GOLD[1]}, OFF)
    # --- Arme schwingen (nach außen) ---
    dl = 1 if Hm.folge(i, 22, [1] * 12, N) else 0
    dr = 1 if (Hm.folge(i, 2, [1] * 8, N) or Hm.folge(i, 46, [1, 1], N)) else 0
    if dl:
        Hm.rand_dehnen_innen(al, OFF, {y: 1 for y in range(13, 19)}, 'l')
    if dr:
        Hm.rand_dehnen_innen(ar, OFF, {y: 1 for y in range(13, 19)}, 'r')
    # --- Kopfneigen (Zeilen 0–8) und Gewichtsverlagerung (Zeilen 0–18 samt Armen) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 9)}, -2, sw + 1)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 19)}, -2, sw + 1)
        for a in (al, ar):
            Hm.bereich_versatz(a, OFF, {y: gv for y in range(12, 19)}, -3, sw + 2)
    # --- Auf und ab: Tunikazeile 17 = Brust (alle Ebenen), Kinnzeile 9 läuft 3 Frames nach (nur Rumpf) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 17, PAD_T + 9, brust, kopf)
    al = Hm.atmen(al, PAD_T + 17, PAD_T + 9, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 17, PAD_T + 9, brust, 0)
    # --- Fußtippen (die Stiefel liegen hinter dem Rock) ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    hl = 1 if Hm.folge(i, 12, pat, N) else 0
    hr = 1 if Hm.folge(i, 36, pat, N) else 0
    fl, fr = ebene(fuss_l, -hl), ebene(fuss_r, -hr)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (k, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf → Schwarz, Körper → Dunkelblau)
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = HAAR_UMRISS if y - PAD_T < 11 else KOERPER_UMRISS
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
    L.speichern('doomed-town-guard', 'Doomed Town Guard', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/doomed-town-guard-strip.png', frames, spalten=12, scale=6)
