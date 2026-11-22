# -*- coding: utf-8 -*-
"""Idle-Animation für „Eager Oarsman“ (Creature) — Ruderer von vorn, beide Arme ausgebreitet an zwei Riemen; er rudert (Blätter tauchen ein, Gischt spritzt, Blätter heben sich).

PICK: [["MotiveIndia", 229, "Ebene „Eager Oarsman #3“, rechte Figur (Ruderer mit ausgebreiteten Armen, x 347–368, y 252–271 der Leinwand); die linke Figur derselben Ebene
        (Mann mit verschränkten Armen) ist eine zweite Pose/Nebenfigur"],
       ["MotiveIndia", 228, "Ebene „Eager Oarsman #5“: die beiden Riemen (vollständig, auch unter der Gischt)"],
       ["MotiveIndia", 227, "Ebene „Eager Oarsman“: Gischt an beiden Ruderblättern"]]
Nicht übernommen: Ebene 230 „Eager Oarsman #1“ (Wal-Boot, Wal, Wasserfläche = eigene Karte „Whale Race Boat“/Szene).
Für die Karte liegt keine Kartenkunst vor (weder data/card-art/native noch public/cardgen/art) → kein Abgleich möglich; die Ebenennamen tragen den Kartennamen.
Quellen: src/eager-oarsman.png (Gesamtbild, Frame 0), src/eager-oarsman-mann.png, -ruder.png, -gischt.png (gleiche 47×24-Leinwand).

Identifikation (47×24): Kopf von vorn (x 18–27, y 0–7) mit dunklem Haar/Stirnband, Augen weiß (20,5–6) und (25,5–6) mit dunkler Pupille daneben, Zähne (21–22,9) –
breites Grinsen, bleibt fest; nackter Oberkörper (y 7–13), heller Lendenschurz (y 14–15), kniende Beine (y 16–19), graue Punkte (17,17)/(28,17) (Sitz/Dolle – unklar, fest).
Arme seitlich ausgestreckt (x 12–17 bzw. 28–33, y 7–11), Fäuste (x 12–15 bzw. 30–33) umfassen je einen Riemen; Riemen diagonal nach außen unten (Griffende (16,6)/(16–17,7)
über der Faust, Schaft bis y 16, Blatt x 0–7 bzw. 38–46, y 16–23). Gischt (hellblau/weiß) vor den Blättern, y 17–22.

Ablauf (60 Frames à 70 ms = 4,2 s; drei Ruderschläge, Periode 20). Frame 0 = Original (Blätter im Wasser):
* Ruderschlag: Der Oberkörper richtet sich in zwei Schritten 2 px auf (texturierte Zeilen in der Brust bei y 12, TX.streck_zeile); Kopf, beide Arme und die Riemen gehen
  als starre Einheit mit → die Blätter heben sich 2 px aus dem Wasser. Danach beugt er sich zurück und taucht die Blätter 1 px tiefer ein (Zeile y 13 entfällt kurz), dann Ruhe.
  Arme und Riemen werden nicht verformt.
* Gischt: nur solange die Blätter im Wasser sind; beim Eintauchen spritzt sie 3 Frames lang 1 px höher, beim Ausheben bleibt 1 Frame ein Rest (untere Zeilen); im Wasser
  schwappt sie 1 px seitlich hin und her.
* Blinzeln beider Augen (Frames 23–24). Kopf nur senkrecht.
Ergänzungen: keine; die Ruderblätter unter der Gischt stammen aus Ebene 228 (nichts erfunden).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

SLUG = 'eager-oarsman'
N, MS = 60, 70
sz = N9.Szene(SLUG, (4, 4, 6, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
MANN, RUDER, GISCHT = L.lade(SLUG + '-mann'), L.lade(SLUG + '-ruder'), L.lade(SLUG + '-gischt')
MANN_E = sz.teil(MANN[..., 3] > 0, MANN)
RUDER_E = sz.teil(RUDER[..., 3] > 0, RUDER)
GISCHT_L, GISCHT_R = sz.teil((GISCHT[..., 3] > 0) & (xx < 23), GISCHT), sz.teil((GISCHT[..., 3] > 0) & (xx >= 23), GISCHT)
HAUT, LID = (189, 90, 57), (38, 19, 9)
#      0  1  2  3  4  5  6  7  8  9 10 11  12  13  14 15 16 17 18 19
N_F = [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -1, -1, 0, 0, 0, 0, 0]
G_F = [2, 2, 2, 2, 1, 0, 0, 0, 0, 0, 0, 3, 3, 3, 2, 2, 2, 2, 2, 2]      # 0 keine Gischt, 1 Rest, 2 voll, 3 spritzt hoch
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    j = i % 20
    n, g = N_F[j], G_F[j]
    r = MANN_E.copy()
    if i in (23, 24):
        for x in (20, 25):
            r[sz.PT + 5, sz.PL + x, :3] = HAUT; r[sz.PT + 6, sz.PL + x, :3] = LID
    r = TX.streck_zeile(r, sz.PT + (12 if n > 0 else 13), n)
    f = L.zusammen(sz.H, sz.W, [(r, 0, 0), (RUDER_E, 0, -n)])
    if nur:
        return f
    if g:
        schwapp = (1 if (i // 3) % 2 else 0) if g == 2 else 0
        gl, gr = N9.starr(GISCHT_L, -schwapp, -1 if g == 3 else 0), N9.starr(GISCHT_R, schwapp, -1 if g == 3 else 0)
        if g == 1:
            gl, gr = gl.copy(), gr.copy()
            gl[:sz.PT + 20] = 0; gr[:sz.PT + 20] = 0
        f = L.zusammen(sz.H, sz.W, [(f, 0, 0), (gl, 0, 0), (gr, 0, 0)])
    return f


if __name__ == '__main__':
    N9.fertig(SLUG, 'Eager Oarsman', frame, N, MS, spr, check=[0, 3, 4, 7, 11, 13, 23], zoom=9)
