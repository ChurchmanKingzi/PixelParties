# -*- coding: utf-8 -*-
"""Idle-Animation für „Bunny Bombs“ (Creature) — drei mintgrüne Bombenhäschen mit brennender Lunte.

PICK: [["Motive", 608, "Ebene „Bunny Bombs“ (die drei Häschen)"], ["Motive", 605, "Ebene „Bunny Bombs #1“ (die drei Luntenfunken)"]]
Abgleich mit data/card-art/native/Bunny_Bombs.png: die drei Häschen samt Funken stimmen (98–100 %); das Mädchen (Ebene 622 „Inya“) und der Teppich gehören nicht dazu.
Die Karte heißt im Plural und zeigt drei Häschen in einer Ebene → alle drei bilden die Figur (wie bei den Sentient Bomb Golems).

Identifikation (42×38):
* Häschen 1 (x 11–22, y 3–16) sitzt aufrecht, von vorn: zwei Ohren mit rosa Innenseite, schwarze Lunte zwischen den Ohren ((17,4) (16,5–7)), Augen 2×2 schwarz bei (14–15,10–11) und (18–19,10–11),
  Füße y 15–16. Funke x 16–18, y 0–3.
* Häschen 2 (x 27–41, y 9–21) liegt auf der Seite (Ohren oben rechts, Auge (37–38,16–17)); an seinem Bauch die schwarze Bombenkugel mit grauem Glanzpunkt (x 29–33, y 15–19), deren Lunte im Bogen
  nach links oben läuft ((29–30,11) (28,12) (31,12) (27,13)); Funke x 24–27, y 12–15.
* Häschen 3 (x 0–14, y 22–37) liegt gespiegelt (Auge (3–4,29–30), Bombe x 9–13, y 30–33, Lunte (11–12,24) (10,25) (13,25) (14,26)), ein Bein hängt nach unten (x 11–13, y 34–37); Funke x 14–17, y 25–28.

Ablauf (64 Frames à 65 ms = 4,2 s). Frame 0 = Original, nur die Funkensterne sind durch die Luntenflamme ersetzt:
* Lunten brennen: handgezeichneter 8-Bilder-Zyklus F3.klein('lunte'), je Häschen versetzt, Farben der Funken der Quelle (Gelb, Hellgelb); Fuß lückenlos am Luntenende, die Flamme geht mit dem Häschen mit.
* Häschen 1 hüpft wirklich (einmal je 32 Frames): Hocke (1 Zeile gestaucht) → Flug (bis 5 px, ganze Figur in der Luft) → Landung (wieder gestaucht) → Ruhe; dazwischen blinzelt es (Frames 6–7 je 32).
* Häschen 2 und 3 liegen und atmen im Wechsel (Periode 16): eine texturierte Zeile wird im Rumpf oberhalb von Auge und Bombe eingefügt (TX.streck_zeile bei y 14 bzw. y 28), Ohren und Lunte heben sich 1 px; die Unterseite bleibt liegen.
Kein Glanz (die Bombenkugel ist nur 5 px groß; ihr grauer Glanzpunkt bleibt wie gemalt). Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_feuer3 as F3
import anim_n7 as N7

N, MS = 64, 65
sz = N7.Szene('bunny-bombs', (3, 3, 9, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
GELB, HELL = (255, 255, 0), (255, 255, 203)
funke = sz.ist(GELB, HELL)
B1 = sz.teil(~funke & (xx >= 11) & (xx <= 22) & (yy <= 16))
B2 = sz.teil(~funke & (xx >= 24) & (yy <= 21) & ~((xx <= 22)))
B3 = sz.teil(~funke & (xx <= 17) & (yy >= 22))
HUPF = {16: (-1, 0), 17: (-1, 0), 18: (0, 1), 19: (0, 3), 20: (0, 4), 21: (0, 5), 22: (0, 5), 23: (0, 4), 24: (0, 3), 25: (0, 1), 26: (-1, 0), 27: (-1, 0)}   # (Stauchung, Höhe)
LIDFARBE = (220, 255, 244)
FARBEN = [GELB, HELL, HELL]


def frame(i, nur=None):
    k = i % 32
    st, hoch = HUPF.get(k, (0, 0))
    b1 = B1
    if k in (6, 7):
        b1 = b1.copy()
        for x in (14, 15, 18, 19):
            b1[sz.PT + 10, sz.PL + x, :3] = LIDFARBE
    if st:
        b1 = L.streck_zeile(b1, sz.PT + 12, st)
    f1 = F3.klein(sz.H, sz.W, sz.PL + 17, sz.PT + 3 - hoch + (1 if st else 0), i, FARBEN, 'lunte')
    n2, n3 = N7.stufe(i, 16, 2, 7), N7.stufe(i, 16, 10, 7)
    b2 = TX.streck_zeile(B2, sz.PT + 14, n2)
    b3 = TX.streck_zeile(B3, sz.PT + 28, n3)
    f2 = F3.klein(sz.H, sz.W, sz.PL + 26, sz.PT + 13 - n2, i, FARBEN, 'lunte', versatz=3)
    f3 = F3.klein(sz.H, sz.W, sz.PL + 15, sz.PT + 26 - n3, i, FARBEN, 'lunte', versatz=5, spiegel=True)
    return L.zusammen(sz.H, sz.W, [(f1, 0, 0), (f2, 0, 0), (f3, 0, 0), (b1, 0, -hoch), (b2, 0, 0), (b3, 0, 0)])


if __name__ == '__main__':
    N7.fertig('bunny-bombs', 'Bunny Bombs', frame, N, MS, spr, check=[0, 5, 6, 16, 19, 21, 26, 44], zoom=9)
