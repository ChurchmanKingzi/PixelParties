# -*- coding: utf-8 -*-
"""Idle-Animation für „Unsettling Opportunist Vullary“ (Creature).

PICK: [["MotiveRussia", 215, 1]]
Quelle: src/unsettling-opportunist-vullary.png (20×31 px, 31 Farben) = Ebene 215 („MARY“ benannt, zeigt aber den Geier der Karte), vollständig; Ebene 101 enthält dieselbe Figur und eine Variante mit
nach rechts gedrehtem Kopf und offenem Schnabel (nicht verwendet: Köpfe drehen sich nicht seitlich). Gegen die Kartenkunst abgeglichen; Tannen und Schnee sind Szene.

Was ist was (x/y im Sprite):
* Geier, stehend, Flügel angelegt: dunkelviolette Flügel links und rechts (x 0–5 und 14–19, y 3–23) mit rosa Krallen an den Flügelenden (x 2–4 bzw. 15–17, y 20–21).
* Kahler rosa Kopf (x 5–14, y 3–14) mit Schopffedern (y 0–3, dunkel), schwarzen Brauen, Augen (hellrosa/weiß (6, 8) und (13, 8), gelbe Iris (6, 9) und (12, 9), rot daneben (7, 9), (13, 9)),
  orangefarbenem Hakenschnabel (x 9–10, y 11–14), darunter rosa Hals (x 9–10, y 15–17).
* Weißlich-rosa Halskrause (x 6–13, y 15–18), dunkler olivgrauer Rumpf (x 3–16, y 15–27), dunkelrote Krallenfüße (y 26–30).

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos; Frame 0 = Original):
* Atmen: Rumpfzeile 24 wird texturiert eingefügt (0–1 px, Periode 30) – Rumpf, Flügel und Kopf heben sich gemeinsam, die Füße bleiben stehen.
* Lauern: Der Kopf reckt sich als starre Einheit (Kopf, Schopf, Schnabel) 1 px aus der Halskrause (Frames 18–37) und sinkt zurück; nie seitlich. Der Hals wird dabei um eine Zeile sichtbar
  (Fortsetzung der Halspixel), die Flügelkante neben dem Kopf wird fortgesetzt.
* Krächzen bei gerecktem Kopf (Frames 24–26 und 30–32): der Schnabel öffnet sich (dunkler Spalt zwischen Ober- und Unterschnabel).
* Blinzeln beider Augen (Frames 8–10 und 46–48): Auge → Rosa der Kopfhaut.
* Schopffedern zucken (Frames 40–43 und 54–56): die Federspitzen (y 0–1) kippen 1 px nach rechts.
ERGÄNZUNGEN: wo der gereckte Kopf unten eine Zelle freigibt und darunter Flügel oder Hals liegt, wird diese Zelle mit dem Pixel darunter fortgesetzt (Hals (9, 14) und (10, 14); Flügelkante an x 5 und 14).
Keine Partikel, kein Glanz (nichts Metallisches). Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 60, 75
FIG = N2.Figur('unsettling-opportunist-vullary', pad=(2, 2, 4, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

FLUEGEL = FIG.maske([(32, 22, 37), (63, 54, 66), (13, 0, 0), (50, 41, 53), (25, 15, 30), FIG.f(1, 21)])
KOPF = FIG.op & ~FLUEGEL & (yy <= 14) & (xx >= 5) & (xx <= 14)
REST = FIG.op & ~KOPF
HAUT = FIG.f(8, 9)
SPALT = FIG.f(9, 0)
AUGEN = [(6, 8), (6, 9), (7, 9), (13, 8), (12, 9), (13, 9)]
FEDERN = [(9, 0), (9, 1), (12, 0), (12, 1)]

# Zellen, die der gereckte Kopf unten freigibt und unter denen etwas liegt → Fortsetzung
FORT = {}
for x in range(FIG.sw):
    ys = np.nonzero(KOPF[:, x])[0]
    if len(ys) and ys.max() + 1 < FIG.sh and REST[ys.max() + 1, x]:
        FORT[(x, int(ys.max()))] = FIG.f(x, int(ys.max()) + 1)


def frame(i, nur=None):
    re = FIG.platz(REST)
    ko = FIG.platz(KOPF)
    if N2.fenster(i, N, 8, [1, 1, 1]) or N2.fenster(i, N, 46, [1, 1, 1]):
        N2.setze(ko, OFF, {p: HAUT for p in AUGEN})
    if N2.fenster(i, N, 40, [1, 1, 1, 1]) or N2.fenster(i, N, 54, [1, 1, 1]):
        farbe = FIG.f(9, 0)
        N2.loesche(ko, OFF, FEDERN)
        N2.setze(ko, OFF, {(x + 1, y): farbe for x, y in FEDERN}, neu=True)
    if N2.fenster(i, N, 24, [1, 1, 1]) or N2.fenster(i, N, 30, [1, 1, 1]):
        N2.setze(ko, OFF, {(9, 13): SPALT, (10, 13): SPALT})
    hoch = 1 if 18 <= i <= 37 else 0
    if hoch:
        N2.setze(re, OFF, FORT, neu=True)
        ko = L.versetze(ko, 0, -1)
    fig = L.zusammen(FIG.H, FIG.W, [(re, 0, 0), (ko, 0, 0)])
    return TX.streck_zeile(fig, FIG.pt + 24, N2.hub(i, 30, 1))


if __name__ == '__main__':
    print('Fortsetzungen:', FORT)
    N2.haupt(__import__(__name__), 'Unsettling Opportunist Vullary')
