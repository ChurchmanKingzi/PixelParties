# -*- coding: utf-8 -*-
"""Idle-Animation für „Potion Juggler“ (Creature) — der Clown mit dem blauen Hut und den grünen Ärmeln, der mit erhobenen Händen DREI TRÄNKE (rot, gelb, blau) jongliert.

Quelle: src/potion-juggler.png (32×40 px, 47 Farben) = Clown + die drei Tränke an ihren Plätzen in der Ebene; einzeln: src/potion-juggler-clown.png (gleiche Leinwand, nur der Clown) und
        src/potion-juggler-trank0.png (rot), -trank1.png (gelb), -trank2.png (blau), je 10×12 px.
PICK: [["MotiveCoolhalla", 62, 1], ["MotiveCoolhalla", 61, 1], ["MotiveCoolhalla", 61, 2], ["MotiveCoolhalla", 61, 3]]
  (Ebene 62 „Ebene #163“ = der Clown mit erhobenen Armen, 20×24; Ebene 61 „Ebene #165“ = die drei SCHARFEN Tränke im Dreieck über ihm. In der Kartenkunst liegt darüber Ebene 60 „Ebene #166“: dieselben
  Tränke als verwischte Bewegungsunschärfe – das ist ein weicher Effekt und wird nicht übernommen (Pixelart-Regel); stattdessen fliegen die scharfen Tränke wirklich. Ebene 58 „Ebene #168“ ist derselbe
  Clown mit hängenden Armen und Sonnenbrille, 57/56 sind leere Flaschen und Pfützen (ein anderer Zustand) – nicht verwendet. Der xcf-Abgleich kannte nur Ebene 62 (78 %, weil die Unschärfe die Arme
  überdeckt) und einen Fetzen der Unschärfe.)

Aufruf:   python3 potion_juggler.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/potion-juggler.png + .json

Was im Sprite ist (x, y im 32×40-Sprite):
* CLOWN (x 6–25, y 16–39): blauer Hut mit weißen Bommeln (y 16–21), orange Haare, schwarze Augenmaske/Brille (y 23–24) → blinzelt nicht (Regel 10/21), rote Nase, roter Mund (15–16, 26), rosa Wangen;
  grüne Ärmel schräg nach oben (x 7–12 und 19–24, y 27–31), weiße Handschuhe (7–9 / 22–24, y 25–27); Latzhose halb rot, halb blau (y 30–37), gelbe Schuhe (y 38–39).
* TRÄNKE (je 10×12): bauchige Flasche mit schwarzem Umriss, Korken (orange/gelb), hellem Hals; rot oben in der Mitte (11,0), gelb links (0,10), blau rechts (22,10).
Glas/Flüssigkeit, kein Metall → kein Glanz. Keine Partikel.

Idee: Er JONGLIERT wirklich – echte 3-Ball-Kaskade: jede Flasche fliegt im Bogen von einer Hand über den Scheitelpunkt zur anderen, wird dort kurz gefangen (taucht 3 px in die Hand) und wieder geworfen.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos; 1 Schlag = 5 Frames, jede Flasche braucht 6 Schläge für Hin- und Rückweg, die Schleife enthält zwei volle Umläufe):
* Flugbahn je Flasche (starr, nur ganze Pixel, keine Drehung): Schlag 0–2 Wurf links → rechts (Parabel über den Scheitel y 0), Schlag 2–3 in der rechten Hand (Eintauchen 3 px und zurück), Schlag 3–5 Wurf
  rechts → links, Schlag 5–6 in der linken Hand. Die Bahnen der beiden Wurfrichtungen sind waagerecht gegeneinander versetzt (bis ±3 px), so kreuzen sich steigende und fallende Flasche nebeneinander.
  Die drei Flaschen sind um je 2 Schläge versetzt: in Frame 0 steht gelb links (eben geworfen), rot im Scheitel, blau rechts (eben gefangen) = Original.
* Clown: federt im Wurftakt (Periode 10): Hosenzeile 34 wird einmal texturiert eingefügt (anim_textur) – Oberkörper, Arme, Hände und Kopf steigen 1 px, Schuhe bleiben. Der Kopf bewegt sich nicht seitlich.
* Mund: der rote Mund (15–16, 26) schließt sich kurz (Frames 22–25 und 52–55 → Hautweiß wie daneben) – er pustet vor Anstrengung.
Frame 0 = Original. Ergänzungen: keine (der Clown ist als eigene Ebene vollständig; die Flaschen fliegen vor freiem Hintergrund bzw. vor dem Hut).
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
BEAT = 5
G = N4.Figur('potion-juggler', 2, 2, 2, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
clown = L.lade('potion-juggler-clown')
TRANK = [L.lade('potion-juggler-trank%d' % k) for k in range(3)]     # 0 rot (Scheitel), 1 gelb (links), 2 blau (rechts)
XL, XR, YH, YT, DIP = 0, 22, 10, 0, 3
START = {1: 0.0, 0: 4.0, 2: 2.0}                                      # lokale Zeit (in Schlägen) in Frame 0: gelb wird links geworfen, rot im Scheitel (R→L), blau rechts gefangen
G.erlaubt = G.erlaubt | {f(15, 25)}
MUND_ZU = f(14, 26)


def bahn(t):
    """Ort (x, y) der Flasche zur lokalen Zeit t (Schläge, Periode 6)."""
    t %= 6.0
    if t < 2.0 or 3.0 <= t < 5.0:
        p = (t if t < 2.0 else t - 3.0) / 2.0
        y = YH - (YH - YT) * 4 * p * (1 - p)
        w = 0.15 * math.sin(2 * math.pi * p)                           # Bahnen der beiden Wurfrichtungen gegeneinander versetzt → sie kreuzen sich nebeneinander statt deckungsgleich
        x = XL + (XR - XL) * (p + w) if t < 2.0 else XR - (XR - XL) * (p - w)
        return int(round(x)), int(round(y)), (p > 0.5)
    q = t - 2.0 if t < 3.0 else t - 5.0
    return (XR if t < 3.0 else XL), int(round(YH + DIP * math.sin(math.pi * q))), True


def frame(i):
    k = G.ebene(quelle=clown)
    if Hm.takt(i, 30, 22, 4):
        Hm.setze(k, {(15, 26): MUND_ZU, (16, 26): MUND_ZU}, OFF)
    if Hm.stufe(i, 10, 1):
        k = TX.streck_zeile(k, G.PT + 34, 1)
    k = G.schliessen(k, lambda x, y: (0, 0, 0))
    lagen = []
    for n, tr in enumerate(TRANK):
        x, y, faellt = bahn(START[n] + i / BEAT)
        lagen.append((faellt, tr, x, y))
    lagen.sort(key=lambda e: e[0])                                   # steigende Flasche hinten, fallende vorn
    return L.zusammen(H, W, [(k, 0, 0)] + [(L.platz(tr, H, W, G.PL + x, G.PT + y), 0, 0) for _, tr, x, y in lagen])


if __name__ == '__main__':
    N4.abschluss(G, 'Potion Juggler', [frame(i) for i in range(N)], MS, sys.argv, scale=4)
