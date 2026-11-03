# -*- coding: utf-8 -*-
"""Idle-Animation für „Slime Rancher“ (Creature) — die Gestalt im braunen Kapuzenmantel mit goldener Schließe. Runde 3: sie steht einfach (kein Schweben).

Quelle: src/slime-rancher.png (14×25 px, 10 Farben, deckend).
PICK: [["Motive", 474, "ganze Ebene"]]      Ebene 474 trägt in der xcf den Namen „Slime Rancher“ (14×25, Karte Slime_Rancher.png: Mitte, Maßstab 2). creature_show.py findet sie nicht (die Treffer dort
sind Rauschen/andere Schleime) — von Hand gewählt. Die gelben Schlängel links/rechts daneben in der Karte sind die Fühler des gelben Schleims (Ebene 473) und nicht Teil der Figur; die anderen
Schleime der Karte (Ebenen 473/475) sind Beiwerk.

Aufruf:   python3 slime_rancher.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slime-rancher.png + .json

Was im Sprite ist (x, y im 14×25-Sprite):
* KAPUZE (y 0–12): brauner Stoff B/C/D mit dunklem Umriss A/E (28,23,16)/(35,29,19), im Inneren ein schwarzes Loch F (0,0,0) (x 3–10, y 5–11) — kein Gesicht erkennbar, nichts zu blinzeln.
* UMHANG (y 13–24): Falten B/G/A, am Saum zwei Füße/Zipfel (x 2–5, 8–11, y 24).
* SCHLIESSE (7–8, 13–14): goldene Brosche H (184,184,41), I (235,235,53), J (147,147,33) — Gold, darf glänzen (Regel 14).
Material: Stoff (kein Glanz), Gold (Glanz/Glitzer erlaubt).

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos), alle Bewegungen unabhängig — Runde 3: er STEHT einfach (kein Schweben):
Nutzerkorrektur (wörtlich): „Slime Rancher soll nicht schweben(?), er steht einfach.“ — Angenommene Ursache: der seitlich schwingende Mantelsaum, die abwechselnd angehobenen Fußzipfel („Gewichtsverlagerung“) und das
Mitwippen der ganzen Gestalt lasen sich als Schweben/Gleiten. Beides ist entfernt: Saum und Füße (Zeilen 19–24) bleiben jetzt STARR auf dem Boden.
* Atmen (Periode 24, zweimal je Schleife, zweistufig mit Nachlauf): erst hebt sich der Mantel (Zeile 16, eine Mantelfalte, wird einmal doppelt eingefügt, Mischtextur — Brust und Kapuze steigen 1 px), etwa 2 Frames
  später folgt die Kapuze (Zeile 4, Stoff ohne Loch, wird einmal doppelt eingefügt — Kapuzenspitze steigt 1 px weiter, insgesamt 2 px). Die Füße/der Saum bleiben am Boden; die Kapuze bewegt sich NICHT seitlich.
* Schließe glitzert (zweimal je Schleife, 4 Frames): die Brosche wird 1–2 Stufen heller auf der Goldrampe J→H→I, dazu wächst ein kleiner vierzackiger Stern AM Objekt (Mitte + 4 Arme à 1 px) auf und verschwindet.
Ergänzungen: Umrisspixel A (28,23,16) wo nötig (kontur_schliessen); Glitzerstern in Goldfarben der Brosche. Frame 0 = Original.
"""
import math
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 2
TEST_EBENEN = ('koerper',)

spr = L.lade('slime-rancher')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

GOLD = [(147, 147, 33), (184, 184, 41), (235, 235, 53)]
BROSCHE = [(7, 13), (8, 13), (7, 14), (8, 14)]


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # Schließe glitzert (Gold)
    st = Hm.folge(i, 10, [1, 2, 2, 1], N) or Hm.folge(i, 34, [1, 2, 2, 1], N)
    if st:
        for (x, y) in BROSCHE:
            c = tuple(int(v) for v in k[y + OFF[1], x + OFF[0], :3])
            Hm.setze(k, {(x, y): Hm.farbe_stufe(c, GOLD, st)}, OFF)
        if st == 2:
            Hm.stern4(k, 8, 13, 1, GOLD[2], GOLD[1], off=OFF)
    # Atmen, zweistufig: Mantel (Zeile 16) zuerst, Kapuze (Zeile 4) etwa 2 Frames später; Saum und Füße (Zeilen 19–24) bleiben starr am Boden
    brust = E.verlauf3(i, 24, 0.0, 1)
    kopf = E.verlauf3(i, 24, -0.5, 1)
    if brust:
        k = L.streck_zeile(k, PAD_T + 16, brust)
    if kopf:
        k = L.streck_zeile(k, PAD_T + 4 - brust, kopf)
    Hm.kontur_schliessen(k, ERLAUBT, (28, 23, 16))
    return k


def frame(i, nur=None):
    return koerper(i)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(frames[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', [int((f[..., 3] > 0).sum()) for f in frames])
    import anim_amorph as A
    A.ausdruck_pruefen(frames, spr, 'slime-rancher')
    L.speichern('slime-rancher', 'Slime Rancher', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slime-rancher-strip.png', frames[::2], spalten=12, scale=8)
