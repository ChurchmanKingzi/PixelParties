# -*- coding: utf-8 -*-
"""Idle-Animation für „Ethan, the Prodigy“ (Creature) — der schwarzhaarige Junge mit der grün-gelben Jacke, der am Pult in einem großen Buch LIEST.

Quelle: src/ethan-the-prodigy.png (16×28 px, 32 Farben) = Ebenen übereinander; einzeln auf derselben Leinwand: src/ethan-the-prodigy-koerper.png (Figur) und
        src/ethan-the-prodigy-buch.png (Buch mit den beiden Händen an den oberen Ecken).
PICK: [["MotiveArcanum", 190, 1], ["MotiveArcanum", 188, 1]]   (Ebene „Ebene #2“ = Ethan, 15×25; „Ebene #4“ = aufgeschlagenes Buch, 16×11, liegt in der Kunst vor seinem Unterkörper.
  Der xcf-Abgleich kannte nur das Buch; die Figur wurde über einen Gesichtsausschnitt der Kartenkunst in den Ebenen gesucht (Abweichung 3/255). Nachbarebene 189 „Ebene #3“ (48×16) ist die
  Tischplatte, 191 der Raum – beides Kulisse, nicht übernommen.)

Aufruf:   python3 ethan_the_prodigy.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ethan-the-prodigy.png + .json

Was im Sprite ist (x, y im 16×28-Sprite):
* HAAR (y 0–8): schwarz (2,5,1) mit grauen Strähnen. GESICHT (y 7–11): Haut (248,188,119)/(245,206,136)/(252,231,214), brauner Umriss (49,24,0).
  AUGEN je 2×2: links (5–6, 9–10) = Weiß, Pupille schwarz (6,9), grüne Iris (5,10), Weiß; rechts (9–10, 9–10) = Pupille (9,9), Weiß, Iris (9,10), Weiß – er schaut nach unten ins Buch.
* JACKE (y 12–17): dunkelgrau mit grünen (79,108,5) und gelbgrünen (222,255,74)/(182,255,0) Streifen, weißer Kragen (4/9, 13).
* BUCH (y 18–27, eigene Ebene): zwei helle Seiten (x 1–6 und 9–14) mit Zeilen, Falz bei x 7–8, roter/oranger Einband (Rand x 0 / x 15, y 20–27), die HÄNDE (1–2 und 13–14, y 18–19) halten es oben fest.
Kein Metall → kein Glanz. Kein Feuer, keine Partikel.

Idee: Ethan liest – die Pupillen wandern Zeile für Zeile von links nach rechts, einmal je Schleife blättert er um (ein Blatt hebt sich rechts, steht am Falz hoch und legt sich links ab), er atmet und blinzelt.
Ablauf (64 Frames à 70 ms = 4,5 s, nahtlos):
* Lesen (Runde 8, Nutzer: „das Grüne in den Augen soll sich bewegen“; 12-Frame-Takt, Frames 0–47 = vier Zeilen): die GRÜNE IRIS wandert in der unteren Augenzeile von links (Original: (5,10) bzw. (9,10), Zeilenanfang, 6 Frames)
  nach rechts ((6,10) bzw. (10,10), Zeilenende, 6 Frames) und springt zurück zum nächsten Zeilenanfang. Grün und Augenweiß tauschen nur innerhalb der Augenpixel; die schwarzen Pixel (6,9)/(9,9) bleiben fest (der alte Pupillen-Effekt ist entfernt).
* Umblättern (Frames 48–59, je 2 Frames): Blatt als heller senkrechter Strich mit Schattenkante (Blattfarbe (252,231,214) = hellster Hautton der Quelle) bei x 11 → 10 → 9 → Falz (x 8, ragt 2 px über das Buch) → 6 → 4 (zwischen den Händen), dann liegt es wieder flach. Buch und Hände bleiben starr.
* Atmen (Periode 32): Jackenzeile 17 (direkt über dem Buch) wird einmal texturiert eingefügt (anim_textur) – Oberkörper und Kopf steigen 1 px, das Buch und die Hände darauf bleiben liegen.
* Blinzeln (Frames 20–22 und 60–62): obere Augenzeile → Haut, untere → brauner Lidstrich (49,24,0).
Frame 0 = Original. Ergänzungen: keine nötig – der Körper liegt als vollständige eigene Ebene hinter dem Buch (Quelle).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 64, 70
G = N4.Figur('ethan-the-prodigy', 2, 2, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
koerper = L.lade('ethan-the-prodigy-koerper')
buch = L.lade('ethan-the-prodigy-buch')

HAUT, LID, WEISS, PUPILLE = f(6, 8), f(2, 8), f(5, 9), f(6, 9)
SEITE_H, SEITE, SCHATTEN = f(7, 10), f(6, 18), f(2, 24)      # (209,197,189) hell, (187,173,159), (129,114,100) Schatten
HAAR_UMRISS, JACKE_UMRISS = f(6, 0), f(1, 14)
IRIS = f(5, 10)
assert IRIS == f(9, 10) == (79, 108, 5) and f(6, 10) == f(10, 10) == WEISS
LESEN = ['O'] * 6 + ['R'] * 6                                 # Zeile lesen: Iris links (Original) → rechts, dann Sprung zurück
BLATT = [11, 10, 9, 8, 6, 4]                                   # Spalte des Blattes je Pose


def frame(i):
    k = G.ebene(quelle=koerper)
    blick = LESEN[i % 12] if i < 48 else 'O'
    if blick == 'R':                                             # grüne Iris am Zeilenende (rechts), beide Augen gleich
        Hm.setze(k, {(5, 10): WEISS, (6, 10): IRIS, (9, 10): WEISS, (10, 10): IRIS}, OFF)
    if Hm.folge(i, 20, [1] * 3, N) or Hm.folge(i, 60, [1] * 3, N):
        Hm.setze(k, {(5, 9): HAUT, (6, 9): HAUT, (9, 9): HAUT, (10, 9): HAUT, (5, 10): LID, (6, 10): LID, (9, 10): LID, (10, 10): LID}, OFF)
    if Hm.stufe(i, N / 2, 1):
        k = TX.streck_zeile(k, G.PT + 17, 1)
    k = G.schliessen(k, lambda x, y: HAAR_UMRISS if y < 12 else JACKE_UMRISS)
    b = G.ebene(quelle=buch)
    p = Hm.folge(i, 48, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], N)
    if p is not None:
        x = BLATT[p]
        if p == 3:                                               # Blatt steht senkrecht am Falz und ragt über das Buch
            Hm.setze(b, {(x, y): SEITE_H for y in range(16, 25)}, OFF)
            Hm.setze(b, {(x - 1, y): SCHATTEN for y in range(18, 25)}, OFF)
        else:
            y0 = 17 if p in (2, 4) else 18
            Hm.setze(b, {(x, y): SEITE_H for y in range(y0, 25)}, OFF)
            Hm.setze(b, {(x + (1 if p < 3 else -1), y): SCHATTEN for y in range(19, 25)}, OFF)
    return L.zusammen(H, W, [(k, 0, 0), (b, 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Ethan, the Prodigy', [frame(i) for i in range(N)], MS, sys.argv)
