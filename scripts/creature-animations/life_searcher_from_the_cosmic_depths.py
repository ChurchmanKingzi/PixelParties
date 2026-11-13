# -*- coding: utf-8 -*-
"""Idle-Animation für „Life-Searcher from the Cosmic Depths“ (Creature) — die braune, stachelige Raumsonde mit grünen Sensoraugen, gelben Lauflichtern und drei Greifbeinen,
die im All schwebt und mit einem grünen Suchstrahl nach Leben tastet.

Quelle: src/life-searcher-from-the-cosmic-depths.png (19×34 px, 9 Farben).
PICK: [["MotiveBoons", 22, 1]]   (Ebene #36 enthält drei identische Exemplare – genommen ist das linke obere, Ebenenausschnitt x 344–362, y 253–286; vollständig, Alpha 0/255.)
  Ebene 23 (#37, 50 % Deckkraft) sind die grünen Suchstrahlen der Karte: ein reines, halbtransparentes Grün-Rechteck – als Vorlage für den Strahl benutzt, aber nicht
  als Pixel übernommen (in der Animation ist der Strahl ein Schachbrett-Dither in den zwei Grüntönen der Sonde, kein Alpha).

Was im Sprite ist (x, y):
* STACHEL/ANTENNE oben (9, 0–4), RUMPF (x 5–13, y 5–15) braun (54,10,0)/(86,37,4)/(129,81,5), Umriss fast schwarz (1,6,2).
* Zwei grüne SENSORAUGEN: oben (9,6)/(10,7) hellgrün (20,243,0), (9,7) mittelgrün (80,185,30), (8,7)/(9,8) dunkelgrün (0,73,14); unten dasselbe Muster bei (9,11)/(10,12), (9,12), (8,12)/(9,13).
* SEITENFLÜGEL (x 0–5 und x 13–18, y 10–15); darauf fünf gelbe LAMPEN in einer Reihe: (3,13), (6,14), (9,15) dunkelgelb (123,100,6) = aus, (12,14), (15,13) hellgelb (234,253,73) = an.
* Drei GREIFBEINE (y 16–33): zwei lange äußere Bögen (x 2–6 und x 12–16), ein kurzes mittleres (x 7–11, bis y 27).
Kein Metallglanz (dunkles, mattes Material), kein Feuer.

Idee: Die Sonde schwebt und sucht – die Lampen laufen als Lauflicht über die Flügel, die Sensoraugen pulsieren im Wechsel, der Suchstrahl tastet nach unten, die Greifbeine öffnen sich.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Schweben (Periode 30, 2×): die ganze Sonde hebt und senkt sich als Ganzes um 1 px (sie fliegt).
* Lauflicht (Periode 20, 3×): je zwei benachbarte Lampen leuchten, das Paar wandert von rechts nach links durch die fünf Lampen (Schritt alle 4 Frames; Schritt 0 = Original).
* Sensoraugen (Periode 30): oberes und unteres Auge werden abwechselnd eine Stufe dunkler (hell → mittel → dunkel innerhalb der Augenpixel) und wieder hell.
* Suchstrahl (Frames 24–47): hinter der Sonde wächst vom Bauch aus ein trapezförmiger Strahl nach unten (4 Frames), flimmert (das Schachbrett wechselt alle 2 Frames die Phase)
  und zieht sich wieder zurück (4 Frames). Farben: (20,243,0) und (80,185,30) aus den Sensoraugen. Dither statt Alpha.
* Greifbeine (während des Strahls, Frames 28–43): die unteren Hälften der beiden äußeren Beine (ab y 20) spreizen sich als starre Teile 1 px nach außen und schließen sich wieder.
Frame 0 = Original.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4

N, MS = 60, 70
G = N4.Figur('life-searcher-from-the-cosmic-depths', 4, 4, 4, 8)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

HELL, MITTEL, DUNKEL = f(9, 6), f(9, 7), f(8, 7)
AN, AUS = f(15, 13), f(3, 13)
LAMPEN = [(15, 13), (12, 14), (9, 15), (6, 14), (3, 13)]
AUGE_O, AUGE_U = L.rechteck(spr, 8, 6, 11, 9), L.rechteck(spr, 8, 11, 11, 14)
BEIN_L, BEIN_R = L.rechteck(spr, 0, 20, 7, 34), L.rechteck(spr, 12, 20, 19, 34)
TEST_EBENEN = 'koerper'


def auge(a, maske, stufe):
    if not stufe:
        return a
    m = np.zeros((H, W), bool); m[OFF[1]:OFF[1] + G.sh, OFF[0]:OFF[0] + G.sw] = maske
    return L.tausche(a, {HELL: MITTEL, MITTEL: DUNKEL} if stufe == 1 else {HELL: DUNKEL, MITTEL: DUNKEL}, m)


def strahl(i):
    """Trapez-Strahl (Schachbrett) vom Bauch (y 16) bis 5 px unter die Beinspitzen; laenge 0…1 = Anteil der vollen Länge."""
    e = L.leer(H, W)
    k = (i - 24) % N
    if k >= 24:
        return e
    laenge = min(1.0, (k + 1) / 4.0, (24 - k) / 4.0)
    y0, y1 = 16, 38
    yend = y0 + int(round((y1 - y0) * laenge))
    phase = (k // 2) % 2
    for y in range(y0, yend + 1):
        halb = 2 + (y - y0) * 4.0 / (y1 - y0)
        for x in range(int(round(9 - halb)), int(round(9 + halb)) + 1):
            if (x + y + phase) % 2 == 0:
                e[OFF[1] + y, OFF[0] + x, :3] = HELL if abs(x - 9) <= 1 else MITTEL
                e[OFF[1] + y, OFF[0] + x, 3] = 255
    return e


def frame(i, nur=None):
    a = G.ebene()
    schritt = (i % 20) // 4
    Hm.setze(a, {p: (AN if (j - schritt) % 5 in (0, 1) else AUS) for j, p in enumerate(LAMPEN)}, OFF)
    seq = [0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0] + [0] * 15
    a = auge(a, AUGE_O, seq[i % 30]); a = auge(a, AUGE_U, seq[(i + 15) % 30])
    if Hm.takt(i, N, 28, 16):
        rest, t = N4.starr(a, OFF, BEIN_L, -1, 0); a = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
        rest, t = N4.starr(a, OFF, BEIN_R, 1, 0); a = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
    a = G.schliessen(a, lambda x, y: f(9, 0))                # Stufe am gespreizten Bein: Innenpixel am Rand wird Umriss (Regel 16)
    dy = -Hm.stufe(i, 30, 1)
    if nur:
        return L.versetze(a, 0, dy)
    return L.zusammen(H, W, [(strahl(i), 0, dy), (a, 0, dy)])


if __name__ == '__main__':
    N4.abschluss(G, 'Life-Searcher from the Cosmic Depths', [frame(i) for i in range(N)], MS, sys.argv, scale=6)
