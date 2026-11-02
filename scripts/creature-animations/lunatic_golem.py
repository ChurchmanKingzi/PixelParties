# -*- coding: utf-8 -*-
"""Idle-Animation für „Lunatic Golem“ (Creature) — Runde 2: schwer, am Boden, gemächlich, halbtransparent.

PICK: [["MotiveGN", 215, 1]]
Quelle: src/lunatic-golem.png — Gold-Golem (22×26 px, 6 Farben) aus MotiveGN.xcf, Ebene 215 („Lunatic Golem“, Ebenendeckkraft 50 %), im Sprite voll deckend (Alpha nur 255), nichts ging verloren. Die Nachbarebenen
(211–220 der xcf: Mond/Busch/Gras/andere Figuren) enthalten keine Teile des Golems; Abgleich mit der Kartenkunst (data/card-art/native/Lunatic_Golem.png, 152×102): Kopf mit hellem Kern, zwei Schulterkugeln,
helle Bauchkugel, zwei Fäuste, zwei Füße — die Figur STEHT dort auf dem Gras (kein Schweben).

Aufruf:   python3 lunatic_golem.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/lunatic-golem.png + .json (Frame auf die Figur zugeschnitten; JSON-Feld `deckkraft: 0.5` = im Spiel halbtransparent, der Sprite selbst hat nur Alpha 0/255)

Nutzerfeedback (wörtlich): „soll schwer am Boden stehen, sich gemächlich bewegen und halbtransparent sein.“
→ kein Schweben mehr (kein Hover-Bob, kein Pendeln der ganzen Figur), die Füße bleiben die ganze Schleife über auf dem Boden; alles läuft langsam (64 Frames à 90 ms = 5,76 s); halbtransparent über
`extra={'deckkraft': 0.5}`.

Identifikation (Sprite-Koordinaten x, y; Golem von vorn):
* Kopf (x 7–14, y 0–5) mit hellem Kern (Kopfkugel), Schultern (x 3–18, y 5–8) mit zwei hellen Schulterkugeln (x 2–5 / 16–19, y 8–10), Rumpf (x 6–15, y 9–20) mit heller Bauchkugel (x 9–12, y 13–19), seitlich zwei
  Arme/Fäuste (x 0–4 und 17–21, y 12–20; innen von einer 1–2 px breiten Umrisslinie bei x 5 / x 16 vom Rumpf getrennt), unten zwei Füße (x 3–9 und 12–18, y 22–25), Hüftlinie y 21.
* Farben: Goldrampe von dunkel nach hell (213,170,33) Umriss, (244,196,38), (244,214,66), (249,238,103), (250,242,130), (249,246,199); die hellen Pixel in den vier Kugeln = Glanzkerne.
* Keine Flügel, keine Waffe, keine Partikelquellen.

Ablauf (64 Frames à 90 ms, Frame 0 = Original; alles langsam, die Figur wird nie leichter als die Füße es zulassen):
* Atmen (Periode 32, zweimal je Schleife): Brust und Kopf heben sich langsam um 1 px (`L.streck_zeile` an Zeile 17 — mischt die Textur der Nachbarzeile in die eingefügte Zeile), halten oben, sinken wieder; die
  Füße bleiben am Boden. Einmal je Schleife (Frame 46–54) setzt sich der Golem beim Ausatmen mit einem Seufzer 1 px unter die Ruhelage (Zeile 17 entfällt) — schwerer Körper, der „einsinkt“.
* Arme/Fäuste: folgen dem Atem mit Nachlauf (5 Frames) 1 px nach außen und zurück (die Zeilen y 13–21 samt Innenumriss rücken waagerecht, die Fuge zum Rumpf wird mit der Umrissfarbe (213,170,33) geschlossen,
  Arme werden nicht dicker, Gefälle zwischen Zeilen ≤ 1 px).
* Glühen: die vier hellen Kugelkerne (Kopf, linke/rechte Schulter, Bauch) dunkeln nacheinander eine Stufe der Goldrampe ab und kehren zurück (Periode 32, je Kugel versetzt; Fenster à 16 Frames) — langsames Pochen.
* Glanz auf dem Gold (Regel 14: Gold): ein dezentes Lichtband (eine Stufe heller auf der Goldrampe, in der Bandmitte zwei) läuft einmal je Schleife über den Golem (Frame 8–34). Keine Glitzersterne (die hellste Quellfarbe ist
  zugleich die Körperfarbe — Sterne wären auf dem Gold unsichtbar). Umriss glänzt nicht.
* Keine Partikel.

Ergänzungen: keine nötig, nichts ist verdeckt (die Fuge zwischen Arm und Rumpf wird beim Armversatz mit der Umrissfarbe geschlossen; das ist kein neues Motiv).
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert). Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle,
Alpha nur 0/255. Randpixel-Test (Regel 16): Umrisspixel bleiben außen; zusätzlich randtest.py.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_humanoide as H_

N, MS = 64, 90
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 8, 8                      # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('lunatic-golem')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

RAMPE = [(213, 170, 33), (244, 196, 38), (244, 214, 66), (249, 238, 103), (250, 242, 130), (249, 246, 199)]      # dunkel → hell
UMRISS_GOLD = RAMPE[0]
HELL = RAMPE[5]
glanz_maske = vorhanden & ~F.kanten(spr)
UMRISS = F.umriss_farben(spr)

ZEILE = 17                                                     # Brustzeile: hier wird eingefügt/entfernt
ARM_Y0, ARM_Y1 = 13, 21                                        # Armzeilen (Sprite) — der Versatz beginnt erst ab Zeile 13 (Gefälle ≤ 1 px an der Schulter)
ARM_L_X, ARM_R_X = 5, 16                                       # letzte Spalte des linken / erste Spalte des rechten Arms (= Innenumriss)

# Glühkerne (Sprite-Koordinaten): Kopf, linke Schulter, Bauch, rechte Schulter — jeweils die hellsten Pixel in der Box
KUGELN = [(8, 1, 12, 4), (2, 8, 5, 10), (9, 13, 12, 19), (16, 8, 19, 10)]


def u01(i, n, versatz=0.0):
    return 0.5 - 0.5 * math.cos(2 * math.pi * (i / n) + versatz)


def brust_stufe(i):
    """Brusthub −1 … +1: zweimal je Schleife langsam heben (0 → 1), oben halten, senken; einmal der Seufzer (−1)."""
    u = u01(i, N // 2)
    c = 1 if u > 0.55 else 0
    if 46 <= i <= 54:
        c = -1 if 48 <= i <= 52 else 0
    return c


def arm_stufe(i):
    """Arme folgen dem Atem mit 5 Frames Nachlauf (0 oder 1 px nach außen)."""
    return 1 if u01(i - 5, N // 2) > 0.55 and not (46 <= i <= 56) else 0


def pulse_stufe(i, k):
    """Kugel k dunkelt langsam ab (0 hell, 1 / 2 eine bzw. zwei Stufen dunkler) und kehrt zurück: ein 16-Frames-Fenster je 32 Frames, die Fenster der vier Kugeln beginnen bei Frame 1 / 6 / 11 / 15 (Welle
    Kopf → Schulter → Bauch → Schulter); in Frame 0 sind alle hell (= Original)."""
    start = (1, 6, 11, 15)[k]
    t = (i - start) % 32
    if t >= 16:
        return 0
    w = 0.5 - 0.5 * math.cos(2 * math.pi * t / 16)
    return 0 if w < 0.2 else (1 if w < 0.8 else 2)


def kugeln_dimmen(a, i):
    """Glühkerne pochen: hellste Pixel (Index 5 der Rampe) in den Kugel-Boxen eine Stufe dunkler, bei Stufe 2 auch Index 4 → 3 (Frame 0 = Original, weil u01(0) = 0)."""
    for k, (x0, y0, x1, y1) in enumerate(KUGELN):
        st = pulse_stufe(i, k)
        if not st:
            continue
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if not a[PAD_T + y, PAD_L + x, 3]:
                    continue
                c = tuple(int(v) for v in a[PAD_T + y, PAD_L + x, :3])
                if c == RAMPE[5]:
                    a[PAD_T + y, PAD_L + x, :3] = RAMPE[4]
                elif c == RAMPE[4] and st == 2:
                    a[PAD_T + y, PAD_L + x, :3] = RAMPE[3]
    return a


def arme_versetzen(f, c, d):
    """Arme (Zeilen ARM_Y0…ARM_Y1 des Sprites, in der gestreckten Leinwand um −c verschoben, wo y ≤ ZEILE) um d px nach außen; die Fuge zum Rumpf wird mit der Umrissfarbe geschlossen."""
    if not d:
        return f
    y0 = PAD_T + ARM_Y0 - c
    y1 = PAD_T + ARM_Y1
    out = f.copy()
    for (xa, xb, s) in ((0, ARM_L_X, -d), (ARM_R_X, sw - 1, +d)):          # Spaltenbereich im Sprite, Verschieberichtung
        for y in range(y0, y1 + 1):
            for x in range(xa, xb + 1):
                out[y, PAD_L + x] = 0
        for y in range(y0, y1 + 1):
            for x in range(xa, xb + 1):
                if f[y, PAD_L + x, 3]:
                    out[y, PAD_L + x + s] = f[y, PAD_L + x]
            fuge = ARM_L_X if s < 0 else ARM_R_X
            if f[y, PAD_L + fuge, 3]:
                out[y, PAD_L + fuge, :3] = UMRISS_GOLD
                out[y, PAD_L + fuge, 3] = 255
    return out


def frame(i, partikel=True, effekte=True, nur=None):
    c = brust_stufe(i)
    d = arm_stufe(i)
    koerper = L.platz(spr, H, W, PAD_L, PAD_T)
    if effekte:
        kugeln_dimmen(koerper, i)
        F.lichtband(koerper, glanz_maske, PAD_L, PAD_T, i, N, 8, 26, RAMPE, stufen=1, kern_stufen=2, breite=4.0, achse=(1.0, 0.7))
    if c:
        koerper = L.streck_zeile(koerper, PAD_T + ZEILE, c)
    f = arme_versetzen(koerper, c, d)
    F.umranden(f, [f], UMRISS, UMRISS_GOLD, UMRISS_GOLD, UMRISS_GOLD)                    # Randpixel-Test (Regel 16)
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
    L.speichern('lunatic-golem', 'Lunatic Golem', frames, MS, prev, extra={'deckkraft': 0.5})
    if prev:
        L.streifen(prev + '/lunatic-golem-strip.png', frames, spalten=8, scale=6)
