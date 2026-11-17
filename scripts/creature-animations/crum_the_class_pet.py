# -*- coding: utf-8 -*-
"""Idle-Animation für „Crum, the Class Pet“ (Creature) — der dicke blaue Eulen-Pinguin mit gelben Federohren, der einen (toten) blauen Fisch am Schwanz hält.

Quelle: src/crum-the-class-pet.png (28×26 px, 24 Farben).
PICK: [["MotiveArcanum", 101, 1]]   (Ebene #43; 100 % Treffer mit der Kartenkunst, nur in dieser Karte; vollständig. Ebene 100 daneben ist ein 8×8-Schattenfleck anderer Karten.)

Was im Sprite ist (x, y):
* FEDEROHREN: gelb (201,193,137) mit weißer Spitze – links (8–12, 0–2), rechts (19–23, 0–2).
* KOPF (x 10–22, y 0–7): blauer Scheitel (13–19, 0–4), weiß-graue Gesichtsfelder (11–14 und 17–21, y 3–7), braune AUGEN (12,4),(12,5),(13,5) und (19,4),(18,5),(19,5).
* SCHNABEL (x 13–18, y 7–12): ockergelb mit dunkler Unterseite. Bleibt fest.
* BAUCH (x 11–20, y 10–21): weiß mit grauem Rand; dunkelblauer Körperrand; rechter FLÜGEL (x 22–27, y 8–16) hängt angelegt herab.
* FISCH (x 0–11, y 5–21), kopfüber am Schwanz gehalten: Schwanzflosse oben (y 5–8) mit Crums grauer Flügelspitze als Griff (4–7, 5–8); Kiemenschlitze (4–6, 13) und (4–6, 15),
  X-Auge (5–7, 17–19) → der Fisch ist tot und zappelt NICHT von selbst; Brustflosse (10–11, 13–16).
* FÜSSE (y 21–25): dunkle Krallen mit ockergelben Spitzen, stehen am Boden.
Kein Metall → kein Glanz; keine Partikel.

Idee: Crum steht stolz mit seiner Beute da – der Fisch baumelt am Griff hin und her, Crum atmet, blinzelt, zuckt mit den Federohren und schüttelt kurz den freien Flügel.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Fisch pendelt (Periode 20, 3×): Pendel um den Griff – das untere Fischdrittel (y 17–21) schwingt ±1 px seitlich, die Mitte (y 13–16) schlägt etwas später aus; oben (Griff, Schwanz) fest.
  Ganze Zeilen des Fisches werden verschoben (nichts gestreckt). Schwingt er nach links, wird der Körperrand dahinter fertiggezeichnet (Umriss (49,54,75)).
* Atmen (Periode 30, 2×): Körperzeile 15 wird einmal texturiert eingefügt (anim_textur, nur Körperebene) – Kopf, Schnabel, Flügel steigen 1 px; der Fisch hängt am Flügel und
  hebt sich als Ganzes mit; Füße bleiben stehen.
* Federohren zucken (Frames 24–26, 52–54): die Spitzen (oberste zwei Zeilen) legen sich 1 px an (rücken nach unten vor den Ohransatz) und stellen sich wieder auf.
* Flügel (Frames 34–36 und 39–41): die äußere Flügelhälfte (x 24–27) hebt sich als starrer Block 1 px (kurzes Schütteln).
* Blinzeln (Frames 14–16 und 44–45): Augen → Gesichtsfarbe (218,217,218).
Frame 0 = Original. Ergänzungen: Körperumriss hinter dem Fisch (nur sichtbar, wenn der Fisch nach links schwingt bzw. sich hebt): 1–2 px breite Lücken zwischen Fisch und
  Körper in den Zeilen 5–20 werden mit der Umrissfarbe (49,54,75) geschlossen.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_textur as TX
TX.umleiten()

N, MS = 60, 70
G = N4.Figur('crum-the-class-pet', 4, 3, 4, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

UMRISS, GESICHT = f(10, 3), f(11, 3)
FISCHFARBEN = [f(1, 5), f(2, 6), f(8, 6), f(9, 6), f(4, 13)]          # Dunkelblau, Mittelblau, Türkis, Hellblau, Schwarz
FISCH = (L.farbmaske(spr, FISCHFARBEN) & (G.xx <= 11) & (G.yy <= 21)) | L.rechteck(spr, 4, 5, 8, 9)
KOERPER = G.da & ~FISCH
AUGEN = [(12, 4), (12, 5), (13, 5), (19, 4), (18, 5), (19, 5)]
OHR_L = L.rechteck(spr, 8, 0, 12, 2) & KOERPER
OHR_R = L.rechteck(spr, 20, 0, 24, 2) & KOERPER
FLUEGEL = L.rechteck(spr, 24, 8, 28, 17)


def pendel(i, staerke):
    return int(round(staerke * math.sin(L.sinus(i, 20))))


def frame(i):
    k = G.ebene(KOERPER)
    if Hm.takt(i, N, 14, 3) or Hm.takt(i, N, 44, 2):
        Hm.setze(k, {p: GESICHT for p in AUGEN}, OFF)
    if Hm.takt(i, N, 24, 3) or Hm.takt(i, N, 52, 3):
        rest, t = N4.starr(k, OFF, OHR_L, 0, 1); k = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
        rest, t = N4.starr(k, OFF, OHR_R, 0, 1); k = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
    if Hm.takt(i, N, 34, 3) or Hm.takt(i, N, 39, 3):
        rest, t = N4.starr(k, OFF, FLUEGEL, 0, -1); k = L.zusammen(H, W, [(rest, 0, 0), (t, 0, 0)])
    brust = Hm.stufe(i, N / 2, 1)
    if brust:
        k = TX.atmen(k, G.PT + 15, 0, 1, 0)
    fisch = G.ebene(FISCH)
    unten, mitte = pendel(i, 1.3), pendel(i, 0.8)             # die Mitte schlägt später aus und kehrt früher zurück
    Hm.zeilen_versatz(fisch, OFF, {**{y: mitte for y in range(13, 17)}, **{y: unten for y in range(17, 22)}})
    fisch = G.schliessen(fisch, lambda x, y: FISCHFARBEN[0])   # Stufen im Fischrand: Randpixel in Innenfarbe werden Fischumriss (Regel 16)
    a = L.zusammen(H, W, [(k, 0, 0), (fisch, 0, -brust)])
    for y in range(G.PT + 4, G.PT + 21):                     # Körperumriss hinter dem Fisch fertigzeichnen (1–2 px breite Lücken)
        for x in range(G.PL + 5, G.PL + 13):
            if not a[y, x, 3] and a[y, x - 1, 3] and (a[y, x + 1, 3] or a[y, x + 2, 3]):
                a[y, x, :3] = UMRISS; a[y, x, 3] = 255
    return a


if __name__ == '__main__':
    N4.abschluss(G, 'Crum, the Class Pet', [frame(i) for i in range(N)], MS, sys.argv, scale=6)
