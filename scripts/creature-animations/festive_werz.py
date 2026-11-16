# -*- coding: utf-8 -*-
"""Idle-Animation für „Festive Werz“ (Creature) — gelbgrünes Echsenwesen im Weihnachtsmann-Kostüm sitzt mit erhobenen Händen im Schnee, wippt und winkt vor Freude
abwechselnd mit den Händen, die Mützenbommel wackelt, die Schwanzspitze wippt.

PICK: [["vom Nutzer gelieferter Sprite", "feedback11/festive-werz-sprite.png", "64×54, exaktes 2×-Raster → 32×27, Alpha war schon binär"]]
Abgleich mit data/card-art/native/Festive_Werz.png (dort unten rechts vor dem Geschenkestapel; Geschenke/Baum sind Szene). Quelle vollständig.

Identifikation (32×27): rote Zipfelmütze (x 9–21, y 1–7) mit weißer Bommel (18,0), (18–19,1) und weißem Fellrand (y 5–8); gelbgrünes Gesicht (x 10–20, y 8–12) mit
zugekniffenen Augen (dunkle Pixel (13,9), (17,9) und die Fältchen in Zeile 10) – blinzelt deshalb nicht; darunter ein blaues Teil (x 12–18, y 12–15; unklar, ob
Nase/Brille/Kugel – bleibt fest) und ein heller Kinnbart (x 12–18, y 15–18). Zwei gelbgrüne Krallenhände (links x 0–8, y 8–17; rechts x 23–31) an roten Ärmeln,
roter Mantel (y 13–21), weißer Fellsaum (y 22–23), darunter der gelbgrüne Schwanz (y 23–26), dessen Spitze links hochsteht (x 3–7, y 21–24).

Ablauf (48 Frames à 70 ms = 3,4 s). Frame 0 = Original:
* Freudiges Wippen (Periode 24): der Mantel streckt sich in Zeile 19 um 1 px (TX.streck_zeile), Kopf, Mütze und die erhobenen Hände heben sich mit.
* Patschen: die äußere Handhälfte hebt sich 1 px und fällt zurück (links Spalten ≤ 3, rechts Spalten ≥ 28; Stufe von 1 px in der Hand, Ärmel und Handwurzel
  bleiben) – links/rechts abwechselnd, zwei Serien je Schleife.
* Bommel: kippt beim Patschen 1 px nach rechts und zurück (starr, 3 px).
* Schwanzspitze: senkt sich 1 px (Spalten ≤ 5) und hebt sich wieder – zwischen den Patsch-Serien.
Ergänzungen: keine. Bewusst fest: Kopf (nie seitlich), Mütze (starr), blaues Teil, Bart.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n11 as G

N, MS = 48, 70
sz = G.Szene('festive-werz', (3, 3, 3, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
HAND_L_M = sz.da & (xx <= 3) & (yy <= 17)
HAND_R_M = sz.da & (xx >= 28) & (yy <= 17)
BOMMEL_M = sz.da & (((xx == 18) & (yy <= 1)) | ((xx == 19) & (yy == 1)))
SPITZE_M = sz.da & (xx <= 5) & (yy >= 21)
HAND_L, HAND_R, BOMMEL, SPITZE = sz.teil(HAND_L_M), sz.teil(HAND_R_M), sz.teil(BOMMEL_M), sz.teil(SPITZE_M)
RUMPF = sz.teil(sz.da & ~HAND_L_M & ~HAND_R_M & ~BOMMEL_M & (yy <= 20))
UNTEN = sz.teil(sz.da & (yy >= 21) & ~SPITZE_M)
BEIN_LEER = L.leer(sz.H, sz.W)
LINKS = set(range(3, 6)) | set(range(11, 14)) | set(range(27, 30))
RECHTS = set(range(7, 10)) | set(range(15, 18)) | set(range(31, 34))
BOM = set(range(5, 8)) | set(range(13, 16)) | set(range(29, 32))
TIEF = set(range(19, 25)) | set(range(36, 39)) | set(range(42, 45))


def frame(i, nur=None):
    f = L.zusammen(sz.H, sz.W, [(RUMPF, 0, 0), (HAND_L, 0, -1 if i in LINKS else 0), (HAND_R, 0, -1 if i in RECHTS else 0),
                                   (BOMMEL, 1 if i in BOM else 0, 0), (BEIN_LEER, 0, 0)])
    f = TX.streck_zeile(f, sz.PT + 19, G.stufe(i, 24, 10, 11))
    return L.zusammen(sz.H, sz.W, [(f, 0, 0), (UNTEN, 0, 0), (SPITZE, 0, 1 if i in TIEF else 0)])


if __name__ == '__main__':
    G.fertig('festive-werz', 'Festive Werz', frame, N, MS, spr, check=[0, 4, 6, 8, 20, 30], zoom=14)
