# -*- coding: utf-8 -*-
"""Idle-Animation für „Piggyfied Hero“ (Creature) — das Schweinchen mit der blonden Heldenfrisur und dem blau-gelben Stirnband.

PICK: [["MotiveGrailWar", 633, 1]]
Quelle: src/piggyfied-hero.png (19×19 px, 19 Farben) = Ebene 633 „Piggyfication“ (einzige Figur der Ebene; die Nachbarebenen 631/634–638 sind Rauch- und Zauberschlieren, 630 die Kellerszene).
Eine Kartenkunst liegt für diese Karte (und für „Piggyfication“) nicht im Repo – Zuordnung über den Ebenennamen.

Was ist was (x/y im Sprite):
* FRISUR (y 0–8, x 6–18): blonder Schopf (255,219,82)/(255,190,74)/(173,125,49)/(140,105,41) mit dunklem Umriss; rechts hängt der ZOPF herab (x 13–18, y 7–13, Spitze y 13).
* STIRNBAND (y 8–14, x 3–14): dunkelblau (16,38,80)/(22,28,69)/(30,42,98) mit gelbgrünen Streifen (146,142,2)/(170,166,2), schräg über die Stirn.
* SCHWEINCHEN (y 11–18, x 0–15): rosa (225,181,168)/(238,194,179), links der dunklere Rüssel (180,134,122) (x 1–3, y 12–17), dunkelbraune Gesichts-/Beinlinien (60,42,36); unten zwei helle Füßchen
  (4–5, 18) und (9–10, 18). Die dunklen Pixel im Gesicht (Augen/Maul/Beinfalten) sind nicht sicher einzeln zu deuten → sie bleiben fest (kein Blinzeln geraten).
Kein Metall, kein Feuer, keine Partikel.

Idle-Idee: Das verwandelte Schweinchen tippelt aufgeregt auf der Stelle, der Zopf wippt nach. Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Tippeln (zwei Anläufe, Frames 4–17 und 28–41): linkes und rechtes Füßchen heben sich abwechselnd je 2 Frames um 1 px (das Bein wird 1 px kürzer: die Fußzeile rückt in die Beinzeile, nichts wird gestreckt).
* Zopf wippt nach (jeweils direkt nach einem Schritt, 2 Frames): der Zopf (x ≥ 14, y 9–13, ohne Stirnband) wird um 1 px länger (TX.streck_unten, texturierte Einfügezeile, Zeile 10) und federt zurück; ein letztes Nachwippen in der Pause (Frames 19–20 und 43–44).
Körper, Kopf und Frisur bleiben sonst ruhig (kleine Figur, nichts schwebt, nichts seitlich). Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('piggyfied-hero', pad=(2, 2, 2, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

BAND = FIG.maske([(16, 38, 80), (22, 28, 69), (30, 42, 98), (146, 142, 2), (170, 166, 2)])
ZOPF = FIG.op & (xx >= 14) & (yy >= 9) & (yy <= 13) & ~BAND
REST = FIG.op & ~ZOPF
FUSS = {'l': range(3, 7), 'r': range(8, 13)}
#          0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
SCHRITT = [0, 0, 0, 0, 1, 1, 0, 2, 2, 0, 1, 1, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]      # 1 = links oben, 2 = rechts oben
WIPP =    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0]      # Zopf 1 px länger (federt nach jedem Schritt)


def frame(i, nur=None):
    a = FIG.platz(REST)
    s = SCHRITT[(i - 0) % 24]
    if s:
        for x in FUSS['l' if s == 1 else 'r']:
            X = x + OFF[0]
            a[17 + OFF[1], X] = a[18 + OFF[1], X]
            a[18 + OFF[1], X] = 0
    z = FIG.platz(ZOPF)
    if WIPP[i % 24]:
        z = TX.streck_unten(z, 10 + OFF[1], 1)
    return L.zusammen(FIG.H, FIG.W, [(a, 0, 0), (z, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Piggyfied Hero')
