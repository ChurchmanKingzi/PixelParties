# -*- coding: utf-8 -*-
"""Idle-Animation für „Test Dummy“ (Creature) — metallene Übungspuppe auf einem Pfahl mit roter Schadensanzeige „999“.

PICK: [["MotiveGN", 492, "Ebene „Test Dummy“ (19×38 px, ganze Ebene)"]]
Quelle vollständig (eine geschlossene Figur, 8 Farben). Zur Karte gibt es keine eigene Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.

Identifikation (19×38): Anzeigekasten (x 0–18, y 0–11; grauer Metallrahmen, schwarzes Feld x 3–15, y 3–9 mit drei roten 3×5-Ziffern „999“ (255,0,0)), Hals (y 12–16) mit zwei dunkelroten
Lämpchen (8,13) (10,13) (130,0,0), birnenförmiger Rumpf (x 5–13, y 17–29) mit zwei herabhängenden Armstummeln (x 2–4 und 14–16, y 21–28), Pfahl (x 8–10, y 29–37) im Boden.
Starr und aus Metall: nichts wird gestreckt, der Pfahlfuß bleibt stehen.

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Original:
* Die Puppe federt nach (wie nach einem Treffer): alles oberhalb der Pfahlmitte (y ≤ 32) kippt als starre Einheit 1 px nach links, zurück, 1 px nach rechts, zurück (Frames 8–31),
  danach steht sie ruhig. Der Pfahl knickt dabei an einer Stelle um 1 px (kein Gummi).
* Anzeige: die Ziffern flackern kurz (Frames 8–9, 12–13 und 40–41: Rot → Dunkelrot (130,0,0), nur Ziffernpixel).
* Die zwei Lämpchen am Hals blinken abwechselnd (Dunkelrot ↔ Rot, Periode 16).
* Ein kurzes Sparkle auf dem Metallrumpf (Frames 48–52, Punkt → Kreuz → Punkt; Farbe (181,178,181) der Quelle).
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 64, 75
sz = N7.Szene('test-dummy', (3, 3, 2, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ROT, DUNKEL, HELL = (255, 0, 0), (130, 0, 0), (181, 178, 181)
OBEN = sz.teil(yy <= 32)
UNTEN = sz.teil(yy > 32)
ZIFFERN = sz.voll(sz.ist(ROT) & (yy <= 9))
KIPP = {8: -1, 9: -1, 10: -1, 11: -1, 12: -1, 13: -1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 24: -1, 25: -1, 26: -1, 28: 1, 29: 1, 30: 1}
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    oben = OBEN
    if i in (8, 9, 12, 13, 40, 41):
        oben = N7.farbtausch(oben, ZIFFERN, {ROT: DUNKEL})
    oben = oben.copy()
    k = (i // 8) % 2
    oben[sz.PT + 13, sz.PL + 8, :3] = ROT if k == 1 else DUNKEL
    oben[sz.PT + 13, sz.PL + 10, :3] = ROT if (k == 0 and i >= 8) else DUNKEL
    dx = KIPP.get(i, 0)
    st = N7.funkel_folge(i, N, 48, (1, 2, 2, 1))
    if st and not nur:
        N7.funkel(oben, sz.PL + 10, sz.PT + 20, st, HELL)
    return L.zusammen(sz.H, sz.W, [(UNTEN, 0, 0), (oben, dx, 0)])


if __name__ == '__main__':
    N7.fertig('test-dummy', 'Test Dummy', frame, N, MS, spr, check=[0, 8, 12, 18, 49], zoom=10)
