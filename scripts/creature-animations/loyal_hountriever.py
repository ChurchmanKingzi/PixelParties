# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Hountriever“ (Creature).

Quelle: src/loyal-hountriever.png — Ebene „Hountriever“ (12×15 px, 13 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 182, 2]]

Aufruf:   python3 loyal_hountriever.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-hountriever.png + .json

Identifikation (Sprite 12×15, goldbrauner Hund von vorn, lange Schlappohren):
* Kopf (Innenfläche x 3–8, Zeilen 1–7): lichtbraunes Gesicht B (159,117,101), links eine dunklere Schattenspalte C (x = 3); zwei sehr dunkle Augen als
  senkrechte 1×2-Pixel (links x 4, rechts x 7; oben H (49,31,29), unten I (36,22,19), je y 3–4); Nase = schwarz E (5–6, 6–7) mit blaugrauem/hellem
  Nasenglanz K (118,124,136) (5,5) und L (157,166,175) (6,5) — nasse Nase, kein Metall, bleibt fest.
* Schlappohren (links x 0–1, rechts x 10–11, Zeilen 1–6): zwei Pixel breite Streifen A/D (dunkler Umriss, dunkelrotbraune Innenspalte D (70,37,30)) mit
  Kappen (1,1) (1,6) bzw. (10,1) (10,6); der Kopfumriss (2,y) / (9,y) ist NICHT Teil des Ohres und bleibt am Kopf.
* Halsband: bordeauxrote U-Linie F (88,30,44) / G (101,49,61) (3,8) (4,9) (5,10) (6,10) (7,9) (8,8) — Leder. Darunter eine graue Metallmarke J (128,120,117)
  bei (5,11) und (6,11) — Metall, daher Glanz.
* Brust (Zeilen 8–11) mit hellen Fellpixeln B/C, zwei Vorderbeine (links x 3–4, rechts x 7–8, Zeilen 12–13), Fußlinie Zeile 14.
* Kein Schwanz, keine Zunge sichtbar — nichts davon erfunden.
Bleibt fest: Gesicht, Nase (samt Glanzpixeln), Halsband, Brust, Beine bis auf die Pfoten.

Ablauf (58 Frames à 62 ms = 3,6 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen, nur die Augen blicken:
* Atmen (Periode 29, 2× pro Schleife; oben in Frames 4–16 und 33–45): Zeile 12 (oberes Beinstück) wird eingefügt — Kopf, Ohren, Halsband, Marke und
  Brust heben sich 1 px, die Füße bleiben am Boden.
* Schlappohren schwingen: links in Frames 3, 17, 30, 45, rechts in 10, 24, 38, 52 (je 6 Frames): erst nur die Unterkante (Zeile 6), dann die Zeilen
  4–6, dann 3–6 gemeinsam je 1 px nach außen und zurück (glatte Außenkante); die Lücke zum Kopfumriss wird mit dem inneren Randpixel der Zeile
  geschlossen, Kappen oben/unten wandern mit — der Ohrumriss ist in jeder Pose geschlossen.
* Blick, nur die Augen: 1 px — Frames 16–22 nach rechts, 26–32 nach links, 47–52 nach rechts; frei werdende Stellen bekommen die Gesichtsfarbe.
* Blinzeln (Frames 12–15 und 41–44, alle 29 Frames ≈ 1,8 s): die dunklen Augenpixel schließen sich in der Fellfarbe des Gesichts (B (159,117,101), die
  Farbe des umgebenden Fells): erst das obere Pixel (halb), dann beide (ganz, zwei Frames), dann wieder das obere — gut sichtbar, weil die dunklen
  Augen auf dem hellbraunen Gesicht verschwinden.
* Markenglanz (Regel 14, Metall): ein Lichtpunkt läuft über die Metallmarke — (5,11) in Frames 22–23 und (6,11) in 24–25, ebenso 50–53 (J → L).
* Pfoten tippen: linker Fuß in Frames 6–7, 21–22 und 44–45, rechter Fuß in 14–15, 35–36 und 54–55 (die Beinzeile 13 des Fußes entfällt, die Fußlinie rückt
  1 px hoch; die Innenumrisse (5,13) (6,13) zwischen den Beinen bleiben am Körper).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 58, 62
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-hountriever')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 1) & (yy >= 1) & (yy <= 6)
ohr_r = vorhanden & (xx >= 10) & (yy >= 1) & (yy <= 6)
koerper = vorhanden & ~ohr_l & ~ohr_r

HELL = (157, 166, 175)                                            # L: hellste Farbe des Sprites (Markenglanz an der Metallmarke)
GESICHT = (159, 117, 101)                                         # B
AUGE_OBEN, AUGE_UNTEN = (49, 31, 29), (36, 22, 19)                # H, I
AUGEN_X = (4, 7)
MARKE = [(5, 11), (6, 11)]
BEINZEILE = 12                                                    # hier wird beim Atmen eine Zeile eingefügt
RAND = T.rand_farben(spr)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def ohr_profil(env, richtung):
    """Schlappohr schwingt nach außen: Kappe/Unterkante (Zeile 6), dann Zeilen 4–6, dann 3–6 gemeinsam (glatte Außenkante)."""
    zeilen = [] if env < 0.2 else ([6] if env < 0.5 else ([4, 5, 6] if env < 0.85 else [3, 4, 5, 6]))
    return {PAD_T + y: richtung for y in zeilen}


PFOTE_L = (6, 7, 21, 22, 44, 45)
PFOTE_R = (14, 15, 35, 36, 54, 55)


def zustand(i):
    atem = 1 if (i % 29) in range(4, 17) else 0
    blick = 1 if (16 <= i < 23 or 47 <= i < 53) else (-1 if 26 <= i < 33 else 0)
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (3, 17, 30, 45))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (10, 24, 38, 52))
    lid = 0
    for s in (12, 41):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    glanz = -1
    for s in (22, 50):
        if 0 <= i - s < 4:
            glanz = (i - s) // 2
    return atem, blick, ohr_li, ohr_re, lid, glanz, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


def frame(i, nur=None):
    atem, blick, ohr_li, ohr_re, lid, glanz, tipp_l, tipp_r = zustand(i)
    k = teil(koerper)
    # Blick (nur die Augen) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    if blick:
        for x0 in AUGEN_X:
            for y in (3, 4):
                k[PAD_T + y, PAD_L + x0, :3] = GESICHT
            k[PAD_T + 3, PAD_L + x0 + blick, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x0 + blick, :3] = AUGE_UNTEN
    if lid:
        for x0 in AUGEN_X:
            x = x0 + blick
            k[PAD_T + 3, PAD_L + x, :3] = GESICHT                     # Lid = Fellfarbe des Gesichts: die dunklen Augenpixel verschwinden
            if lid == 2:
                k[PAD_T + 4, PAD_L + x, :3] = GESICHT
    if glanz >= 0:
        x, y = MARKE[glanz]
        k[PAD_T + y, PAD_L + x, :3] = HELL
    z = PAD_T + BEINZEILE
    r = L.streck_zeile(k, z, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + 13) & (cols >= PAD_L + 2) & (cols <= PAD_L + 9)
    # Innenumrisse (5,13) (6,13) zwischen den Beinen bleiben am Körper (Umriss unter dem Bein-/Brustansatz)
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 4))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 7))
    fl = L.heben_unten(fl, PAD_T + 13, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + 13, tipp_r)
    ol = L.streck_zeile(T.ohr_haengend(teil(ohr_l), ohr_profil(ohr_li, -1), 'links'), z, atem)
    orr = L.streck_zeile(T.ohr_haengend(teil(ohr_r), ohr_profil(ohr_re, 1), 'rechts'), z, atem)
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-hountriever', 'Loyal Hountriever', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-hountriever-strip.png', frames, spalten=14, scale=8)
