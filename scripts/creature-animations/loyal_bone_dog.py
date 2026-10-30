# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Bone Dog“ (Creature).

Quelle: src/loyal-bone-dog.png — Ebene „Bone Dog“ (12×15 px, 8 Farben) aus Motive.xcf, Figur 3 (die Pose, die auf der Karte steht).
PICK: [["Motive", 576, 3]]   (Figur 2 derselben Ebene und „Bonegrinder #4“ sind Varianten desselben Skelettwesens, nicht verwendet)

Aufruf:   python3 loyal_bone_dog.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-bone-dog.png + .json

Identifikation (Sprite 12×15, weißes Skelett-Hündchen von vorn, Totenkopf, Knochenfarben B/C/D/E von hell bis grau, Umriss A (26,26,26)):
* Schädel (Zeilen 0–8, x 1–10): helle Knochenflächen C/B/D; zwei schwarze Augenhöhlen F (0,0,0) (links (3,3) (3,4) (4,4), rechts (8,3) (7,4) (8,4)) — leer,
  keine Pupillen, daher kein Blick; Nasenloch schwarz F (5,6) (5–6,7) mit E (6,6); darunter ein graues Zahn-/Kieferstück G (156,156,156) bei (5,8) und (6,8)
  zwischen Umrisspixeln A (4,8) (7,8).
* Rumpf/Rippen (Zeilen 9–11): helle Rippenbögen B/C/E/D mit dunkler Mittellinie (5–6, 9) und (5–6, 11), seitliche Vorderbeinknochen (2–3, 9–11) / (8–9, 9–11)
  mit dicken Umrissen A an den Außenseiten (0–1, 9–10) und (10–11, 9–10).
* Hinterbeine/Füße (Zeilen 12–14): zwei Knochenbeine (links x 3, rechts x 8: H (82,82,82) bzw. C), Fußlinie A in Zeile 14.
* Knochen glänzen nicht (Regel 14): kein Glanz, kein Glitzern.
* Kein Fell, keine Ohren, kein Schwanz — nichts davon erfunden.
Bleibt fest: Schädelform, Augenhöhlen (außer beim Blinzeln), Nase, Rippen, Beinknochen bis auf die Füße.

Ablauf (48 Frames à 65 ms = 3,12 s), alle Bewegungen unabhängig:
* Schweben/Atmen (Periode 24, 2× pro Schleife; oben in Frames 3–14 und 27–38): die Beinzeile 13 wird eingefügt — Schädel und Rippen heben sich 1 px,
  die Füße bleiben am Boden.
* Kiefer klappert: das graue Kieferstück (5–6, 8) rutscht 1 px nach unten (Zeile 9; der Spalt darüber wird schwarz A, der Mund öffnet sich) und bei größerem
  Ausschlag 2 px (Zeile 10, auf das Rippenpixel B): 4× pro Schleife in Frames 4–7, 15–18, 29–32, 38–41 (Stufen 1, 2, 2, 1).
* Augenhöhlen blinzeln (Frames 10–13 und 34–37, alle 24 Frames ≈ 1,56 s): erst das obere Höhlenpixel, dann beide Höhlen ganz zu (Knochenfarbe E, wie ein
  geschlossenes Lid auf dem Schädel), dann wieder oben — der Wechsel schwarz → grauweiß ist deutlich.
* Pfoten tippen: linker Fuß in Frames 6–7, 20–21 und 40–41, rechter Fuß in 12–13, 27–28 und 45–46 (die Beinzeile 13 des Fußes entfällt, die Fußlinie rückt
  1 px hoch; die Innenumrisse (4,12) und (7,12) bleiben am Körper).
* Knochenstaub: vier einzelne helle Staubkörnchen (1 px, Farben B/C aus dem Sprite) rieseln langsam zwischen den Hinterbeinen nach unten (≈ 0,1 px/Frame,
  insgesamt ~4 px, höchstens 2 px unter die Fußlinie), verglimmen flackernd und sind am Schleifenende aus; sie liegen hinter dem Skelett. Kein Glanz,
  keine Kreuz-/Rautenform. Der Rahmen ist auf die Figur zugeschnitten (18×23 px, Rand 3–4 px rundum, Figur zentriert); der Staub vergrößert ihn nicht.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel.
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 4                         # Figur zentriert; der Staub rieselt höchstens 2 px unter die Füße, der Rahmen wächst dafür nicht

spr = L.lade('loyal-bone-dog')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vorhanden = L.deckend(spr)

SCHWARZ = (26, 26, 26)                                            # A: Umriss / dunkler Mundspalt
KIEFER = (156, 156, 156)                                          # G
KNOCHEN = (123, 123, 123)                                         # E: Knochenfarbe für das geschlossene Lid
RAND = T.rand_farben(spr)
BEINZEILE = 13                                                    # hier wird beim Atmen eine Zeile eingefügt
STAUB = {'rot': ((189, 189, 189), (213, 213, 213))}               # B (Kern) / C (Rand) — einzelne Körnchen nutzen nur den Kern
TEST_EBENEN = ['rumpf', 'fuss_l', 'fuss_r']                       # Körper ohne Staub (für randtest.py)

PFOTE_L = (6, 7, 20, 21, 40, 41)
PFOTE_R = (12, 13, 27, 28, 45, 46)


def teil(a):
    return L.platz(a, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    atem = 1 if (i % 24) in range(3, 15) else 0
    kiefer = 0
    for s in (4, 15, 29, 38):
        if 0 <= i - s < 4:
            kiefer = (1, 2, 2, 1)[i - s]
    lid = 0
    for s in (10, 34):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    return atem, kiefer, lid, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


STAUBKOERNER = [dict(x=PAD_L + 5, y=PAD_T + 12, vx=0, vy=4.2, off=0, form='k', farbe='rot', wackeln=0.6, ph=0.0),
                dict(x=PAD_L + 6, y=PAD_T + 12, vx=1, vy=4.6, off=12, form='k', farbe='rot', wackeln=0.6, ph=1.5),
                dict(x=PAD_L + 5, y=PAD_T + 12, vx=-1, vy=4.2, off=24, form='k', farbe='rot', wackeln=0.6, ph=3.0),
                dict(x=PAD_L + 6, y=PAD_T + 12, vx=0, vy=4.6, off=36, form='k', farbe='rot', wackeln=0.6, ph=4.5)]


def frame(i, nur=None):
    atem, kiefer, lid, tipp_l, tipp_r = zustand(i)
    k = teil(spr.copy())
    # Kiefer klappert: das graue Stück (5–6, 8) rutscht nach unten, darüber öffnet sich der Spalt (Umrissfarbe A)
    if kiefer:
        for x in (5, 6):
            k[PAD_T + 8, PAD_L + x, :3] = SCHWARZ
            ziel = 9 if kiefer == 1 else 10
            if ziel == 10:
                k[PAD_T + 9, PAD_L + x, :3] = SCHWARZ
            k[PAD_T + ziel, PAD_L + x, :3] = KIEFER
    # Augenhöhlen blinzeln: oben schließen, dann ganz zu (Knochenfarbe)
    if lid:
        for (x, y) in ((3, 3), (8, 3)):
            k[PAD_T + y, PAD_L + x, :3] = KNOCHEN
        if lid == 2:
            for (x, y) in ((3, 4), (4, 4), (7, 4), (8, 4)):
                k[PAD_T + y, PAD_L + x, :3] = KNOCHEN
    r = L.streck_zeile(k, PAD_T + BEINZEILE, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + 13) & (cols >= PAD_L + 2) & (cols <= PAD_L + 9)
    # Innenumrisse (4,12) / (7,12) und alles oberhalb von Zeile 13 bleibt am Körper
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 4))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 7))
    fl = L.heben_unten(fl, PAD_T + 13, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + 13, tipp_r)
    staub = T.funken_ebene(H, W, i, N, STAUBKOERNER, STAUB)
    ebenen = {'staub': staub, 'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_}
    wahl = nur or ('staub', 'rumpf', 'fuss_l', 'fuss_r')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-bone-dog', 'Loyal Bone Dog', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-bone-dog-strip.png', frames, spalten=12, scale=8)
