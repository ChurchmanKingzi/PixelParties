# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Pinpom“ (Creature).

Quelle: src/loyal-pinpom.png — Ebene „Pinpom“ (11×11 px, 10 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 172, 3]]

Aufruf:   python3 loyal_pinpom.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-pinpom.png + .json

Identifikation (Sprite 11×11, kleiner hellbrauner Hund von vorn, spitze Ohren):
* Spitzohren (links x 3–5, rechts x 8–10, Zeilen 0–2): dunkler Umriss A, hellbeige Ohrspitze E (4,1) / (9,1), braun B an den Ohrbasen (4–5,2) (8–9,2).
* Gesicht (x 4–9, Zeilen 3–6): lichtbraun/cremefarben; zwei dunkle Augen als senkrechte 1×2-Pixel (links x 5, rechts x 8; oben G (60,64,63), unten
  H (32,29,36), je y 3–4); heller Stirnstreifen F (6–7, 3); Nase = zwei fast schwarze Pixel I (6–7, 5); helle Wangen D (4–5, 5) und J (8–9, 5);
  Kinn D/F (6–7, 6).
* Schwänzchen links (x 0–2, Zeilen 4–7): ein kleiner hellbrauner Bogen mit dunklem Umriss (1–2,4) (0,5) (1,6) (2,7) und braunen Pixeln B (1–2,5) (2,6) —
  sitzt nur links am Körperumriss (x = 3), kein Gegenstück rechts: ich lese es als Schwanz (nicht ganz sicher).
* Brust (Zeilen 7–8): helle Brustflecken D/E (5,7) (8–9,7), Zeile 8 C/B; zwei Vorderbeine (links x 4–5, rechts x 8–9, Zeile 9) mit Fußlinie Zeile 10.
* Kein Halsband, keine Zunge sichtbar — nichts davon erfunden.
Bleibt fest: Stirnstreifen, Nase, Wangen, Kinn, Brust.

Ablauf (54 Frames à 65 ms = 3,51 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen, nur die Augen blicken:
* Atmen (Periode 27, 2× pro Schleife; oben in Frames 3–15 und 30–42): Zeile 8 wird eingefügt — Kopf, Ohren, Schwänzchen und Brust heben sich 1 px, die Füße bleiben.
* Schwänzchen wedelt (Periode 9, 6× pro Schleife): der kleine Bogen schlägt 1 px nach oben und unten (starr; sein Umriss wandert mit, er bleibt am
  Körperumriss x = 3 haften, 4-verbunden).
* Spitzohren zucken: jedes Ohr 4× pro Schleife (links Frames 2/15/28/41, rechts 8/21/34/47, je 6 Frames): die Ohrspitze (Zeilen 0–1) schnippt 1 px nach
  außen, der innere Umrisspixel der Zeile 1 bleibt zusätzlich stehen (sonst läge das braune Pixel darunter offen), die Ohrbasis bleibt.
* Blick, nur die Augen: Frames 14–20 nach rechts, 24–30 nach links, 44–49 nach rechts (1 px); die frei werdenden Stellen bekommen die Farbe des Fellnachbarn.
* Blinzeln (Frames 10–13 und 37–40, alle 27 Frames ≈ 1,75 s): die dunklen Augenpixel werden hell (J, die hellste Fellfarbe): oben, beide (zwei Frames), oben.
* Pfoten tippen: linker Fuß in Frames 5–6, 20–21 und 40–41, rechter Fuß in 13–14, 33–34 und 50–51 (die Beinzeile 9 des Fußes entfällt, die Fußlinie rückt
  1 px hoch; die Innenumrisse (6,9) (7,9) zwischen den Beinen bleiben am Körper).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 54, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-pinpom')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 5) & (yy <= 1)
ohr_r = vorhanden & (xx >= 8) & (yy <= 1)
schwanz = vorhanden & (xx <= 2) & (yy >= 4) & (yy <= 7)
koerper = vorhanden & ~ohr_l & ~ohr_r & ~schwanz

HELL = (227, 221, 207)                                            # J: hellste Fellfarbe (Lid)
AUGE_OBEN, AUGE_UNTEN = (60, 64, 63), (32, 29, 36)                # G, H
AUGEN_X = (5, 8)
# Frei werdende Augenpixel bekommen die Farbe des Nachbarn, von dem das Auge wegläuft:
FELL_LINKS = {(5, 3): (224, 214, 202), (5, 4): (207, 178, 144), (8, 3): (207, 178, 144), (8, 4): (207, 178, 144)}    # Auge ging nach links
FELL_RECHTS = {(5, 3): (169, 137, 114), (5, 4): (169, 137, 114), (8, 3): (224, 214, 202), (8, 4): (207, 178, 144)}   # Auge ging nach rechts
BAUCHZEILE = 8                                                    # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


PFOTE_L = (5, 6, 20, 21, 40, 41)
PFOTE_R = (13, 14, 33, 34, 50, 51)


def zustand(i):
    atem = 1 if (i % 27) in range(3, 16) else 0
    blick = 1 if (14 <= i < 21 or 44 <= i < 50) else (-1 if 24 <= i < 31 else 0)
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (2, 15, 28, 41))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (8, 21, 34, 47))
    lid = 0
    for s in (10, 37):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    wedel = int(round(1.4 * math.sin(L.sinus(i, 9))))
    return atem, blick, ohr_li, ohr_re, lid, wedel, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


def frame(i, nur=None):
    atem, blick, ohr_li, ohr_re, lid, wedel, tipp_l, tipp_r = zustand(i)
    k = teil(koerper)
    # Blick (nur die Augen) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    if blick:
        neben = FELL_LINKS if blick < 0 else FELL_RECHTS
        for x0 in AUGEN_X:
            for y in (3, 4):
                k[PAD_T + y, PAD_L + x0, :3] = neben[(x0, y)]
            k[PAD_T + 3, PAD_L + x0 + blick, :3] = AUGE_OBEN
            k[PAD_T + 4, PAD_L + x0 + blick, :3] = AUGE_UNTEN
    if lid:
        for x0 in AUGEN_X:
            x = x0 + blick
            k[PAD_T + 3, PAD_L + x, :3] = HELL
            if lid == 2:
                k[PAD_T + 4, PAD_L + x, :3] = HELL
    z = PAD_T + BAUCHZEILE
    r = L.streck_zeile(k, z, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + 9) & (cols >= PAD_L + 3) & (cols <= PAD_L + 10)
    # Innenumrisse (6,9) und (7,9) zwischen den Beinen bleiben am Körper (Umriss unter der Brust)
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 5))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 8))
    fl = L.heben_unten(fl, PAD_T + 9, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + 9, tipp_r)
    sz = L.versetze(L.streck_zeile(teil(schwanz), z, atem), 0, wedel)
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 2, -1.2 * ohr_li, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='rechts'), 0, -atem)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 2, 1.2 * ohr_re, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='links'), 0, -atem)
    ebenen = {'schwanz': sz, 'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('schwanz', 'rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-pinpom', 'Loyal Pinpom', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-pinpom-strip.png', frames, spalten=14, scale=8)
