# -*- coding: utf-8 -*-
"""Idle-Animation für „Slime Rancher“ (Creature) — die Gestalt im braunen Kapuzenmantel mit goldener Schließe.

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

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos), alle Bewegungen unabhängig:
* Atmen (Periode 24, zweimal je Schleife): Zeile 16 (Mantelfalte) wird einmal doppelt eingefügt (Mischtextur) — die Kapuze steigt 1 px, der Saum bleibt am Boden. Die Kapuze bewegt sich NICHT seitlich.
* Mantelsaum schwingt (Periode 16, Wellenlauf nach unten): die Zeilen 19–24 wandern waagerecht um bis zu ±1 px (unten am stärksten), Zeilenversatz ≤ 1 px je Zeile.
* Gewichtsverlagerung (Periode 24, abwechselnd 8 Frames): ein Fußzipfel (x 2–5 bzw. 8–11) verliert seine unterste Umrisszeile (Saum hebt sich 1 px), der Umriss darüber wird in Umrissfarbe A geschlossen. Die Zipfel hängen am Mantel (kein Schweben).
* Schließe glitzert (zweimal je Schleife, 4 Frames): die Brosche wird 1–2 Stufen heller auf der Goldrampe J→H→I, dazu blitzt ein kleiner vierzackiger Stern AM Objekt (Mitte + 4 Arme à 1 px) auf und verschwindet.
Ergänzungen: Umrisspixel A (28,23,16) in Zeile 23 (x 2–5 / 8–11), wenn ein Zipfel sich hebt; Glitzerstern in Goldfarben der Brosche. Frame 0 = Original.
"""
import math
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 75
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 4, 3
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
    # Fußzipfel heben sich abwechselnd (Gewichtsverlagerung): die unterste Umrisszeile des Zipfels entfällt (Umriss wird von kontur_schliessen geschlossen)
    if Hm.takt(i, 24, 2, 8):
        Hm.setze(k, {(x, 24): None for x in range(2, 6)}, OFF)
    if Hm.takt(i, 24, 14, 8):
        Hm.setze(k, {(x, 24): None for x in range(8, 12)}, OFF)
    # Saum schwingt (Wellenlauf nach unten), Frame 0 = 0
    dx = {}
    for y in range(19, 25):
        f = (y - 18) / 6.0
        dx[y] = int(round(1.3 * f * (math.sin(L.sinus(i, 16) - 0.5 * f) - math.sin(-0.5 * f)) / 1.0))
        dx[y] = max(-1, min(1, dx[y]))
    for y in range(20, 25):                                          # Nachbarzeilen höchstens 1 px auseinander
        dx[y] = max(dx[y - 1] - 1, min(dx[y - 1] + 1, dx[y]))
    Hm.zeilen_versatz(k, OFF, dx)
    # Schließe glitzert
    st = Hm.folge(i, 10, [1, 2, 2, 1], N) or Hm.folge(i, 34, [1, 2, 2, 1], N)
    if st:
        for (x, y) in BROSCHE:
            c = tuple(int(v) for v in k[y + OFF[1], x + OFF[0], :3])
            Hm.setze(k, {(x, y): Hm.farbe_stufe(c, GOLD, st)}, OFF)
        if st == 2:
            Hm.stern4(k, 8, 13, 1, GOLD[2], GOLD[1], off=OFF)
    k = Hm.atmen(k, PAD_T + 16, PAD_T + 10, E.verlauf3(i, 24, 0.0, 1), 0)
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
