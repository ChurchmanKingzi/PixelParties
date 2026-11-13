# -*- coding: utf-8 -*-
"""Idle-Animation für „Infallible Oracle Pythia“ (Creature) — das Orakel mit der grünen Lockenmähne, den leeren weißen Augen und den weit ausgebreiteten Armen.

Quelle: src/infallible-oracle-pythia.png (20×25 px, 25 Farben).
PICK: [["MotiveSteamDwarfs", 349, 1]]   (Ebene #58; 100 % Treffer mit der Kartenkunst, nur in dieser Karte). Die vier Feuerschalen mit grünen Flammen der
  Nachbarebene 350 stehen in der Karte frei um sie herum – Beiwerk der Szene, nicht Teil der Figur (nicht übernommen).

Was im Sprite ist (x, y):
* HAAR (y 0–11, grün in sechs Stufen, Umriss (15,64,0)): zwei Lockenkuppen oben (x 5–8, x 11–14), lange Seitensträhnen (x 2–5 und x 14–17, y 5–11).
* GESICHT (x 6–13, y 6–10): braune Brauen (x 6–7, x 11–12, y 6); AUGEN leer/weiß (Trance): (6,7)/(13,7) grau (187), (7,7),(7,8)/(12,7),(12,8) hellgrau (217),
  (8,8)/(11,8) weiß (254,253,250); rosa Wangen (7,9)/(12,9). Kein Mund sichtbar.
* ARME (y 11–15): beide waagerecht ausgebreitet, Hände außen (x 0–3 und x 16–19), Hautfarben mit braunem Umriss (49,24,0).
* KLEID (x 5–14, y 12–21): weiß/grau mit dunkelgrauem Träger/Umriss (72,72,72); rechts am Oberkörper Haut-Schatten (11–13, 14–15).
* SAUM/SOCKEL (y 21–24): grün-kariertes Band (0,170,0)/(0,146,0) mit dunkelgrünem Umriss – Rocksaum bzw. Sitzkissen, nicht eindeutig → bleibt fest. Keine Füße sichtbar.
Kein Metall → kein Glanz. Kein Feuer an der Figur.

Idee: Sie steht in Trance über den Orakeldämpfen – hebt beschwörend die Hände, die leeren Augen leuchten kurz auf, grüner Dunst steigt um sie auf.
Ablauf (64 Frames à 75 ms = 4,8 s, nahtlos):
* Atmen (Periode 32, 2×): Kleidzeile 19 wird einmal texturiert eingefügt (anim_textur) – Oberkörper, Arme und Kopf steigen 1 px, Saum bleibt am Boden.
* Beschwörung (Frames 20–43): die Hände heben sich als Pose in zwei Stufen (Stufe 1: Hand x 0–2 bzw. 17–19 um 1 px; Stufe 2: Fingerspitzen x 0–1/18–19 um 2 px,
  Handgelenk x 2–3/16–17 um 1 px) und senken sich wieder – ganze Spaltenblöcke starr, nichts wird gestreckt oder dicker; Schulter/Kopf bleiben, kein seitliches Kopfbewegen.
* Augen (Frames 26–37, auf dem Höhepunkt der Beschwörung): Leuchten nur INNERHALB der Augenpixel, eine Stufe heller auf der Grau-Weiß-Rampe des Sprites
  (187 → 217 → 254), ein-/ausgeblendet über je 2 Frames.
* Orakeldunst: 6 grüne Wölkchen (Formen 2×2 … 4×4, Farben (47,207,0)/(31,143,0) aus dem Haar) (nie kleiner als 2×2) steigen langsam HINTER der Figur neben dem Körper auf (Lebensdauer = Schleife).
Frame 0 = Original (ohne Wölkchen-Unterschied am Körper; die Wölkchen liegen dahinter). Ergänzungen: keine nötig (die Hände liegen vor den Haarsträhnen).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n4 as N4
import anim_n6 as N6
import anim_textur as TX
TX.umleiten()

N, MS = 64, 75
G = N4.Figur('infallible-oracle-pythia', 6, 6, 5, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f

GRAU, HELLGRAU, WEISS = f(6, 7), f(7, 7), f(8, 8)
AUGEN = {(6, 7): HELLGRAU, (13, 7): HELLGRAU, (7, 7): WEISS, (7, 8): WEISS, (12, 7): WEISS, (12, 8): WEISS}
DUNST = {'c': f(4, 2), 'r': f(5, 2)}
PUFFS = [dict(x=5, y=24, vy=-15, off=0, form='o', wackeln=1), dict(x=26, y=25, vy=-16, off=21, form='o', wackeln=-1),
         dict(x=8, y=27, vy=-9, off=40, form='s', wackeln=1), dict(x=23, y=27, vy=-10, off=11, form='s', wackeln=1),
         dict(x=6, y=22, vy=-14, off=32, form='s', wackeln=-1), dict(x=25, y=21, vy=-13, off=53, form='o', wackeln=1)]
ARM_Y = (10, 16)
TEST_EBENEN = 'koerper'


def heben(a, x0, x1, dy):
    """Spaltenblock x0…x1 der Armzeilen starr um dy nach oben (vor dem Haar)."""
    if not dy:
        return a
    m = L.rechteck(spr, x0, 11, x1 + 1, 16)
    rest, teil = N4.starr(a, OFF, m, 0, -dy)
    return L.zusammen(H, W, [(rest, 0, 0), (teil, 0, 0)])


def frame(i, nur=None):
    a = G.ebene()
    st = Hm.folge(i, 20, [1] * 4 + [2] * 16 + [1] * 4, N) or 0
    if st == 1:
        a = heben(a, 0, 2, 1); a = heben(a, 17, 19, 1)
    elif st == 2:
        a = heben(a, 0, 1, 2); a = heben(a, 2, 3, 1); a = heben(a, 18, 19, 2); a = heben(a, 16, 17, 1)
    g = Hm.folge(i, 26, [1, 1] + [2] * 8 + [1, 1], N)
    if g == 1:
        Hm.setze(a, {(7, 8): WEISS, (12, 8): WEISS, (6, 7): HELLGRAU, (13, 7): HELLGRAU}, OFF)
    elif g == 2:
        Hm.setze(a, AUGEN, OFF)
    if Hm.stufe(i, N / 2, 1):
        a = TX.atmen(a, G.PT + 19, 0, 1, 0)
    a = G.schliessen(a, lambda x, y: f(0, 12))          # Stufenecke unter der gehobenen Hand: Hautpixel am Rand wird Armumriss (Regel 16)
    if nur:
        return a
    hinten = N6.woelkchen(H, W, i, N, PUFFS, DUNST)
    return L.zusammen(H, W, [(hinten, 0, 0), (a, 0, 0)])


if __name__ == '__main__':
    N4.abschluss(G, 'Infallible Oracle Pythia', [frame(i) for i in range(N)], MS, sys.argv, scale=6)
