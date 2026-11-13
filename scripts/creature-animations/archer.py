# -*- coding: utf-8 -*-
"""Idle-Animation für „Archer“ (Creature) — Bogenschützin auf Wache, den Langbogen neben sich aufgestellt: atmet, blinzelt, die blaue Hutfeder weht,
bei jedem zweiten Atemzug hebt sie den Bogen kurz an und stellt ihn wieder ab.

PICK: [["MotiveDeri", 185, "Ebene mit fünf Bogenschützinnen hinter einer Mauerbrüstung; genommen: die erste (x 0–13, y 0–19, alles oberhalb der Mauerkrone)"]]
Abgleich mit der Kartenkunst (public/cardgen/art/Archer.webp; data/card-art/native hat keine Datei): dieselbe Reihe hinter der Mauer.
Quelle UNVOLLSTÄNDIG: ab der Mauerkrone (y 20) fehlen Rocksaum, Beine und unteres Bogenende. ERGÄNZT nach der REFERENZ DES NUTZERS (Runde 12,
„archer-beine-referenz.png“, 10×7 px): Rock, Beine und Stiefel sind diese Referenz, pixel- und farbgenau übernommen an x 2–11, y 18–24 (ihre oberste Zeile
deckt sich mit der Rockzeile 18 der Ebene; ihre rechte Randspalte x 11 liegt hinter dem Bogen). Zeilen 0–3 der Referenz = weißer Rock, 4–5 = dunkle Beine/Stiefel
mit hellem Glanzpixel, 6 = braune Sohlenlinie. Die zwei grünen Pixel (32,156,0) in der Sohlenzeile zwischen den Füßen sind als Hintergrund (Gras) gewertet und
TRANSPARENT. Farben der Referenz, die die Ebene nicht hat ((201,213,210), (41,41,41), (65,65,65), (123,123,123), (49,8,0)), sind damit Quellfarben.
Bogen x 11–13 (selbst ergänzt): gespiegelt zur oberen Hälfte bis zur Spitze (12,24) weitergeführt – steht auf Sohlenhöhe (Griff liegt bei y 14–15).

Identifikation (14×25): blaue Feder (x 8–12, y 0–3) an dunkelgrauer Kappe (x 4–9, y 1–4), weißblondes Haar (x 0–11, y 2–13), Gesicht nach bildrechts gewandt:
großes Auge (x 8–9, y 8–10: Lidstrich, Blau, Glanz), zweites Auge am Rand (5,8)/(5,10); schwarzes Lederwams mit hellem Beschlag (x 3–5, y 15–16), Hand
(10,15–16) am Bogengriff, Langbogen senkrecht (x 11–13, y 5–24, Holz – kein Glanz), weißer Rock.

Ablauf (48 Frames à 80 ms = 3,8 s). Frame 0 = Original:
* Atmen (Periode 24): texturierte Zeile im Wams (y 17, nur Spalten ≤ 10, TX.streck_zeile); Kopf, Schultern und die Hand heben sich 1 px. Kopf nie seitlich.
* Bogen: steht auf dem Boden und bleibt beim ersten Atemzug stehen (die Hand gleitet 1 px am Griff); beim zweiten Atemzug hebt sie ihn als starre Einheit
  1 px mit an und setzt ihn wieder ab.
* Feder: weht in zwei Stufen nach bildrechts (Zeile 0, dann Zeilen 0–1 um 1 px) und zurück, zweimal je Schleife.
* Blinzeln (Frames 14–15 und 39–40): großes Auge → Haut mit geschlossenem Lidstrich; am Randauge verschwindet der obere Lidstrich.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n11 as G

N, MS = 48, 80
sz = G.Szene('archer', (3, 4, 3, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
BOGEN_M = sz.da & (xx >= 11) & (yy >= 5)
FEDER_M = sz.da & sz.ist((50, 128, 170), (74, 191, 253), (55, 116, 138)) & (yy <= 3)
UNTEN_M = sz.da & (yy >= 18) & ~BOGEN_M
BOGEN, FEDER, UNTEN = sz.teil(BOGEN_M), sz.teil(FEDER_M), sz.teil(UNTEN_M)
OBEN = sz.teil(sz.da & ~BOGEN_M & ~FEDER_M & ~UNTEN_M)
HAUT, HAUT2, LID = (246, 189, 123), (213, 164, 98), (0, 0, 0)
FEDERSTUFE = [0] * 4 + [1] * 3 + [2] * 6 + [1] * 3 + [0] * 8 + [1] * 3 + [2] * 5 + [1] * 3 + [0] * 13
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = G.stufe(i, 24, 5, 10)
    heb = n if i >= 24 else 0
    oben = OBEN.copy()
    if i in (14, 15, 39, 40):
        for (x, y, c) in [(8, 9, HAUT), (9, 9, HAUT2), (8, 10, LID), (9, 10, LID), (5, 8, HAUT2)]:
            oben[sz.PT + y, sz.PL + x, :3] = c
    fs = FEDERSTUFE[i]
    feder = G.zeilen_schub(FEDER, lambda y: (1 if (fs >= 1 and y <= sz.PT) else 0) if fs < 2 else (1 if y <= sz.PT + 1 else 0))
    kopf = TX.streck_zeile(G.ueber(oben, feder), sz.PT + 17, n)
    return L.zusammen(sz.H, sz.W, [(BOGEN, 0, -heb), (kopf, 0, 0), (UNTEN, 0, 0)])


if __name__ == '__main__':
    G.fertig('archer', 'Archer', frame, N, MS, spr, check=[0, 8, 10, 14, 30, 36], zoom=14)
