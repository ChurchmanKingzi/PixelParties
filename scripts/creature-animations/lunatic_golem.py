# -*- coding: utf-8 -*-
"""Idle-Animation für „Lunatic Golem“ (Creature) — Regeln 14/15/16 (Gold: Glanz erlaubt; kein Feuer).

PICK: [["MotiveGN", 215, 1]]
Quelle: src/lunatic-golem.png — schwebender Gold-Golem (22×26 px, 6 Farben) aus MotiveGN.xcf, Ebene 215 („Lunatic Golem“, Ebenendeckkraft 50 %, unsichtbar geschaltet), vollständig deckend (Alpha nur 255), nichts ging
verloren. Der Layer fand sich nicht über den Pixelabgleich der Kartenkunst (Ebene wird dort mit 50 % Deckkraft und Leuchten eingeblendet: die Karte zeigt ihn weich und gelb verwaschen), sondern über den Ebenennamen in der xcf.
Die Kartenkunst (152×102 px, 2×2-Blöcke) zeigt dieselbe Figur: Kopf mit hellem Kern, zwei Schulterkugeln, helle Bauchkugel, zwei Fäuste, zwei Füße (Abgleich bestanden).

Aufruf:   python3 lunatic_golem.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/lunatic-golem.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Golem von vorn, schwebend):
* Kopf (x 7–14, y 0–5) mit hellem Kern, Schultern (x 3–18, y 5–8), Rumpf (x 6–15, y 9–20) mit heller Bauchkugel (x 8–13, y 14–20), seitlich zwei Arme/Fäuste (x 0–4 und 17–21, y 8–20), unten zwei Füße (x 3–8 und 13–18, y 22–25).
* Farben: Goldrampe von dunkel nach hell (213,170,33) Umriss, (244,196,38), (244,214,66), (249,238,103), (250,242,130), (249,246,199); die helle Spitze = die Kugeln der Kartenkunst.
* Keine Flügel im Sprite (der Golem schwebt): also kein Flügelschlag.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12) und langsames seitliches Pendeln der ganzen Figur um ±1 px (Periode 24, nur ganze Pixel).
* Die Füße baumeln nach (die Reihen 22–25 pendeln um die Unterkante des Rumpfs bis 1–2 px, Periode 12, verzögert); die Unterarme/Fäuste (Reihen 13–20) schwingen im Takt des Bobs bis 1 px nach außen.
* Glanz auf dem Gold (Regel 14): ein dezentes Lichtband (eine Stufe heller auf der Goldrampe) läuft zweimal pro Schleife (alle 24 Frames) über Kopf, Rumpf, Arme und Füße; zwei kleine vierzackige Glitzersterne (Farbe (249,246,199),
  die hellste Quellfarbe) blitzen abwechselnd auf den Armlinien auf. Der Umriss/Rand glänzt nicht.
* Keine Partikel.

Ergänzungen: keine nötig, nichts ist verdeckt.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert); die Sterne liegen auf dem Körper und ragen nicht über die Figur hinaus.
Randpixel-Test (Regel 16): Das Fußpendeln kann Innenfarbe an die Ränder legen → F.umranden setzt dort den Umriss (213,170,33); Glanz und Sterne bleiben im Inneren; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 8, 8                      # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('lunatic-golem')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

RAMPE = [(213, 170, 33), (244, 196, 38), (244, 214, 66), (249, 238, 103), (250, 242, 130), (249, 246, 199)]      # dunkel → hell
UMRISS_GOLD = RAMPE[0]
HELL = RAMPE[5]

m_fuss = vorhanden & (yy >= 21)                                # Füße samt unterer Rumpfkante (Zeile 21 = Pivot, bleibt stehen)
m_arm_l = vorhanden & (xx <= 4) & (yy >= 13) & (yy <= 20)      # Unterarme/Fäuste (Pivot: Zeile 12 am Schulteransatz)
m_arm_r = vorhanden & (xx >= 17) & (yy >= 13) & (yy <= 20)
m_koerper = vorhanden & ~m_fuss & ~m_arm_l & ~m_arm_r
glanz_maske = vorhanden & ~F.kanten(spr)
UMRISS = F.umriss_farben(spr)
Y_FUSS = PAD_T + 21
Y_ARM = PAD_T + 12
STERNE = [(5, 16), (16, 12)]                                   # Sternmitten (Sprite-Koordinaten) auf den Armlinien links/rechts


def frame(i, partikel=True, effekte=True):
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    dx = int(round(1.0 * math.sin(2 * math.pi * i / (N / 2))))     # Seitwärtspendeln ±1 px (Periode 24)

    kp = F.ebene(spr, m_koerper, H, W, PAD_L, PAD_T)
    fuss = F.ebene(spr, m_fuss, H, W, PAD_L, PAD_T)
    arm_l = F.ebene(spr, m_arm_l, H, W, PAD_L, PAD_T)
    arm_r = F.ebene(spr, m_arm_r, H, W, PAD_L, PAD_T)
    if effekte:
        for ebene_ in (kp, fuss, arm_l, arm_r):
            F.lichtband(ebene_, glanz_maske, PAD_L, PAD_T, i, N // 2, 4, 10, RAMPE, stufen=1, breite=3.5, achse=(1.0, 0.7))
        for k, (sx, sy) in enumerate(STERNE):
            st = F.stern_stufe(i, N // 2, 3 + 11 * k, folge=(0, 1, 2, 1))
            if st is not None:
                F.stern(kp, PAD_L + sx, PAD_T + sy, st, HELL, HELL)
    fuss = F.zeilen_pendel(fuss, Y_FUSS, 1.8, L.sinus(i, N / 4), 1.0, lauf=1.0)
    arm_l = F.zeilen_pendel(arm_l, Y_ARM, -1.0, L.sinus(i, N / 4), 1.0, lauf=1.0, einseitig=True)      # Fäuste schwingen mit dem Bob 0…1 px nach außen
    arm_r = F.zeilen_pendel(arm_r, Y_ARM, 1.0, L.sinus(i, N / 4), 1.0, lauf=1.0, einseitig=True)
    kp, fuss, arm_l, arm_r = (L.versetze(a, dx, bob) for a in (kp, fuss, arm_l, arm_r))
    f = L.zusammen(H, W, [(fuss, 0, 0), (arm_l, 0, 0), (arm_r, 0, 0), (kp, 0, 0)])
    F.umranden(f, [fuss, arm_l, arm_r, kp], UMRISS, UMRISS_GOLD, UMRISS_GOLD, UMRISS_GOLD)                    # Randpixel-Test (Regel 16)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('lunatic-golem', 'Lunatic Golem', frames, MS, prev)
    if prev:
        L.streifen(prev + '/lunatic-golem-strip.png', frames, spalten=8, scale=6)
