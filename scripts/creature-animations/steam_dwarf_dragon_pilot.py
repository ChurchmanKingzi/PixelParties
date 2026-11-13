# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Dragon Pilot“ (Creature) — Dampfzwerg im Führerstand seines goldenen Drachen-Läufers: der Kessel stampft (die Maschine
ruckt im Takt 1 px hoch), die Glut im Ofenrost flackert, zwischen den Hörnern steigen Dampfwölkchen auf, der Drachenkopf hebt sich am Gliederhals, der Zwerg blinzelt.

PICK: [["MotiveSteamDwarfs", 420, "rechte Figur der Ebene (x 63–92, y 0–51): der vollständige Drachen-Läufer mit Pilot, freigestellt"]]
Abgleich mit data/card-art/native/Steam_Dwarf_Dragon_Pilot.png und der Motiv-Maske: die Kunst zeigt denselben Läufer von vorn, oben von einer Dampfwolke
verdeckt (Hörner unsichtbar) und unten abgeschnitten – die Ebene hat die ganze Figur samt Hörnern und Füßen. Quelle vollständig, nichts ergänzt.
(Die linke Figur der Ebene – Glaskapsel mit zwei Schloten – ist ein anderes Gerät.)

Identifikation (30×52): zwei weiße Hörner (x 7–12 und x 17–22, y 0–6), goldener Drachenkopf (y 7–16) mit Seitenflossen (x 4–8 / x 21–25, y 9–12), orange
Glutaugen (x 11–13 / x 16–18, y 10–12, dunkle Pupillen (12,12), (17,12)), Nüstern (13,15), (16,15), weißer Kiefer (y 17–18); weißgrauer Gliederhals
(x 9–20, y 17–24); darunter der Pilot im Führerstand (x 11–18, y 25–31): schwarzes Haar (y 25–27), linkes Auge blau/weiß (12,27–28) mit Pupille (13,28),
rechtes Auge rot (16,28) halb unter dem Haar, weißgraues Mundtuch (y 29–31) – das Tuch ist eine Maske, die Augen sind frei → blinzeln. Goldene
Schulterplatten (x 4–8 / x 21–25, y 22–34), goldene Schenkel (x 1–8 / x 21–28, y 35–48), Kessel mit glühendem Ofenrost (x 9–20, y 39–46; orange Stäbe),
Füße mit hellblauen Krallen (y 49–51).

Ablauf (48 Frames à 80 ms = 3,8 s). Frame 0 = Original:
* Kesselstampfen (Periode 16, 4 Frames): die ganze Maschine hebt sich 1 px (TX.streck_zeile in Fußzeile 48, Füße bleiben am Boden) und setzt zurück.
* Glut: je Schritt (3 Frames) leuchten zwei der fünf Roststäbe von Orange (242,136,76) nach Hellorange (246,189,123) auf, reihum.
* Dampf: drei Wölkchen (2×2 → 5×3 → 2×2, Grau/Weiß des Halses) steigen nacheinander zwischen den Hörnern 15 px auf (je 24 Frames, versetzt).
* Drachenkopf: hebt sich einmal je Schleife 1 px (Frames 18–35), der Gliederhals bekommt dafür eine texturierte Zeile (y 21); Hörner und Kopf starr.
* Pilot blinzelt (Frames 10–11 und 40–41): Augenpixel → Haut bzw. Haar.
* Kurzes Sparkle (4 Frames) an der linken Hornspitze (Frame 30) und auf dem rechten Goldschenkel (Frame 6) – Metall.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n11 as G

N, MS = 48, 80
sz = G.Szene('steam-dwarf-dragon-pilot', (4, 4, 20, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
KOPF_M = sz.da & (yy <= 21)
KOPF, LEIB = sz.teil(KOPF_M), sz.teil(sz.da & ~KOPF_M)
GLUT, GLUT2 = (242, 136, 76), (246, 189, 123)
STAEBE = [(10,), (12,), (14, 15), (17,), (19,)]
ROST = sz.da & (yy >= 41) & (yy <= 44)
HAUT, HAUT2, HAAR = (255, 230, 213), (213, 164, 98), (0, 0, 0)
DAMPF = [dict(x=sz.PL + 14, y=sz.PT + 5, vy=-15, vx=k - 1, off=8 * k, wackeln=1, leben=24) for k in range(3)]
DFARBE = {'c': (220, 221, 215), 'r': (148, 154, 154)}
WEISS = (251, 250, 245)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n1 = G.stufe(i, 16, 8, 4)
    n2 = 1 if 18 <= i < 36 else 0
    leib = LEIB.copy()
    p = (i // 3) % 5
    if i:
        for k in (p, (p + 2) % 5):
            for x in STAEBE[k]:
                m = sz.voll(ROST & (xx == x))
                leib = G.farbtausch(leib, m, {GLUT: GLUT2})
    if i in (10, 11, 40, 41):
        for (x, y, c) in [(12, 27, HAAR), (12, 28, HAUT2), (13, 28, HAUT), (16, 28, HAUT2)]:
            leib[sz.PT + y, sz.PL + x, :3] = c
    f = G.ueber(leib, TX.streck_zeile(KOPF, sz.PT + 21, n2))
    f = TX.streck_zeile(f, sz.PT + 48, n1)
    if not nur:
        d = G.dampf(sz.H, sz.W, i, N, DAMPF, DFARBE)
        f = G.ueber(d, f)
        s = G.funkel_folge(i, N, 30, (1, 2, 2, 1))
        if s:
            G.funkel(f, sz.PL + 8, sz.PT + 1 - n1 - n2, s, WEISS)
        s = G.funkel_folge(i, N, 6, (1, 2, 2, 1))
        if s:
            G.funkel(f, sz.PL + 25, sz.PT + 39 - n1, s, WEISS)
    return f


if __name__ == '__main__':
    G.fertig('steam-dwarf-dragon-pilot', 'Steam Dwarf Dragon Pilot', frame, N, MS, spr, check=[0, 6, 9, 10, 20, 31], zoom=7)
