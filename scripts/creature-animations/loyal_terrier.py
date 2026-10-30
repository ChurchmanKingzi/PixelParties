# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Terrier“ (Creature).

Quelle: src/loyal-terrier.png — Ebene „Terrier“ (11×13 px, 12 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 174, 2]]

Aufruf:   python3 loyal_terrier.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-terrier.png + .json

Identifikation (Sprite 11×13, Hund von vorn, grau-braun):
* Spitzohren oben (links x 2–4, rechts x 7–9, Zeilen 0–2): dunkler Umriss A, braunes Ohrinnere D (3,1) (8,1), G/E an den Ohrbasen
  (3–4, 2) (7–8, 2); zwischen den Ohren der Stirnumriss (5–6, 2) A.
* Gesicht (x 3–8, Zeilen 3–5): graues Fell, links dunkler (F), Mitte C, rechts hell (H, bis (173,177,176)); zwei dunkle Augen als
  senkrechte 1×2-Pixel (links x 4, rechts x 7; oben J (34,33,27), unten K (16,13,5), je y 4–5).
* Schnauze/Bart (Zeilen 6–8): breite braune Zeile 6 (2–9: E/F/G/D/C), Nase = zwei fast schwarze Pixel L (5,7) (6,7), brauner Bartstreifen
  (2–4,7) (7–8,7) und (5–6,8) E/G; seitliche Umrisspixel (1,6) (10,6).
* Links am Rand sitzen drei dunkle Pixel (0,6) (0,7) (1,7) (B, B, F), rechts gibt es kein Gegenstück: unklar, ob Schwanzspitze,
  Schatten oder Barthaar — bleiben FEST.
* Halsband: silbergraue U-Linie (4,9) (5,10) (6,10) (7,9) I mit helleren/dunkleren Nachbarn (3,9) C, (8,9) H, Zeile 10 C/F/H
  (gleiche U-Form wie bei Rottweiler/Beagle).
* Zwei Vorderbeine (links x 3–4, rechts x 7–8, Zeile 11: E G | G D) mit Fußlinie in Zeile 12 (2–4) und (7–9).
* Kein Schwanz, keine Zunge, kein Hecheln sicher erkennbar — nichts davon erfunden.
Bleibt fest: Nase, Bart, Gesicht (außer den Augen), Halsband (bis auf den Glanz), die drei Randpixel links, Brust.

Ablauf (56 Frames à 65 ms = 3,64 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen, nur Augen blicken:
* Atmen (Periode 28, 2× pro Schleife; oben in Frames 3–16 und 31–44): Zeile 11 wird eingefügt — Kopf, Ohren und Halsband heben sich
  1 px, die Füße bleiben am Boden.
* Spitzohren zucken: jedes Ohr 4× pro Schleife (links Frames 2/16/30/44, rechts 9/23/37/50, je 6 Frames): die Ohrspitze (Zeilen 0–1)
  schnippt 1 px nach außen und zurück, die Ohrbasis (Zeile 2) bleibt, die Zeilen überlappen sich (4-verbunden).
* Blick: nur die dunklen Augen wandern 1 px — Frames 14–21 nach rechts, 26–33 nach links, 45–52 nach rechts.
* Blinzeln, deutlich sichtbar (Frames 9–12 und 37–40, alle 28 Frames ≈ 1,8 s): die Augenpixel werden hellgrau (H) — erst das obere,
  dann beide (zwei Frames), dann wieder das obere.
* Halsbandglanz (Regel 12): ein Lichtband läuft über die U-Linie (links → rechts, jedes Pixel 2 Frames in H = hellste Stufe der
  Fellrampe), in den Frames 18–25 und 46–53.
* Pfoten tippen: linker Fuß in Frames 5–6, 21–22 und 36–37, rechter Fuß in Frames 13–14, 29–30 und 44–45 (Zeile 11 des Fußes entfällt,
  die Fußlinie rückt 1 px hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-terrier')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr_l = vorhanden & (xx <= 4) & (yy <= 1)
ohr_r = vorhanden & (xx >= 7) & (yy <= 1)
koerper = vorhanden & ~ohr_l & ~ohr_r

HELL = (173, 177, 176)                                            # H: hellste Stufe der Fellrampe (Lid, Halsbandglanz)
AUGE_OBEN, AUGE_UNTEN = (34, 33, 27), (16, 13, 5)                 # J, K
AUGEN_X = (4, 7)
# Beim Blick frei werdende Augenpixel bekommen die Farbe des Nachbarn, von dem das Auge wegläuft:
FELL_LINKS = {(4, 4): (114, 120, 116), (4, 5): (55, 61, 63), (7, 4): (173, 177, 176), (7, 5): (114, 120, 116)}   # Auge ging nach links
FELL_RECHTS = {(4, 4): (55, 61, 63), (4, 5): (55, 61, 63), (7, 4): (114, 120, 116), (7, 5): (114, 120, 116)}      # Auge ging nach rechts
HALSBAND = [(4, 9), (5, 10), (6, 10), (7, 9)]                     # silbergraue U-Linie
FUSSZEILE = 11                                                    # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


PFOTE_L = (5, 6, 21, 22, 36, 37)
PFOTE_R = (13, 14, 29, 30, 44, 45)


def zustand(i):
    atem = 1 if (i % 28) in range(3, 17) else 0
    blick = 1 if 14 <= i < 22 else (-1 if 26 <= i < 34 else (1 if 45 <= i < 53 else 0))
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (2, 16, 30, 44))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (9, 23, 37, 50))
    lid = 0
    for s in (9, 37):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    glanz = -1
    for s in (18, 46):
        if 0 <= i - s < 8:
            glanz = (i - s) // 2
    return atem, blick, ohr_li, ohr_re, lid, glanz, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


def frame(i, nur=None):
    atem, blick, ohr_li, ohr_re, lid, glanz, tipp_l, tipp_r = zustand(i)
    k = teil(koerper)
    # Blick (nur die Augen) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    if blick:
        neben = FELL_LINKS if blick < 0 else FELL_RECHTS
        for x0 in AUGEN_X:
            for y in (4, 5):
                k[PAD_T + y, PAD_L + x0, :3] = neben[(x0, y)]
            k[PAD_T + 4, PAD_L + x0 + blick, :3] = AUGE_OBEN
            k[PAD_T + 5, PAD_L + x0 + blick, :3] = AUGE_UNTEN
    if lid:
        for x0 in AUGEN_X:
            x = x0 + blick
            k[PAD_T + 4, PAD_L + x, :3] = HELL
            if lid == 2:
                k[PAD_T + 5, PAD_L + x, :3] = HELL
    if glanz >= 0:
        x, y = HALSBAND[glanz]
        k[PAD_T + y, PAD_L + x, :3] = HELL
    r = L.streck_zeile(k, PAD_T + FUSSZEILE, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + FUSSZEILE) & (cols >= PAD_L + 2) & (cols <= PAD_L + 9)
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 5))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 6))
    fl = L.heben_unten(fl, PAD_T + FUSSZEILE, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + FUSSZEILE, tipp_r)
    # Ohren: Spitze (Zeilen 0–1) schnippt 1 px nach außen, mit dem Atem-Hub
    ol = L.versetze(T.zucken_zeilen(teil(ohr_l), PAD_T + 2, -1.2 * ohr_li, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}), 0, -atem)
    orr = L.versetze(T.zucken_zeilen(teil(ohr_r), PAD_T + 2, 1.2 * ohr_re, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}), 0, -atem)
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-terrier', 'Loyal Terrier', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-terrier-strip.png', frames, spalten=14, scale=8)
