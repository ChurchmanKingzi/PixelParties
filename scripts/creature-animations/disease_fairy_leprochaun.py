# -*- coding: utf-8 -*-
"""Idle-Animation für „Disease Fairy Leprochaun“ (Creature) — der kleine Kobold mit grauem Zylinder, orangem Bart und krankhaft violettem Gesicht.

PICK: [["MotiveBritain", 243, 1]]
Quelle: src/disease-fairy-leprochaun.png (16×25 px, 25 Farben) = Ebene 243 „Leprochaun“ (einzige Figur der Ebene, vollständig, Alpha schon binär).
Eine Kartenkunst liegt für diese Karte nicht im Repo (weder data/card-art/native noch public/cardgen/art) – Zuordnung über den Ebenennamen.

Was ist was (x/y im Sprite):
* ZYLINDER (y 0–10): grauer Filz (91)/(114)/(142), Umriss (49,49,49); braunes Hutband (y 6–7) mit GOLDENER Schnalle (255,180,24)/(255,205,49): Bügel (7–8, 5), Seiten (6,6), (9,6), (6,7), (9,7);
  Krempe y 8–10 (unter der Krempe violette Schattenpixel (5–6,10), (9–10,10)).
* GESICHT (y 11–16): oranger Bart/Haarkranz (189,57,0)/(213,98,16)/(246,90,8) rund um das violette Gesicht (185,94,166)/(189,106,186); dunkelviolette Augenhöhlen (155,0,104) mit ROTEN Augen (6,13) und
  (9,13); Bartspitze bis y 16.
* KÖRPER (y 16–22): grauer Rock mit schwarzen Falten, Gürtel y 19 mit goldener Schnalle (8–9, 19); violette Hände (x 1–3 und x 12–14, y 18–19); Beine y 21–22; Schuhe y 23 mit heller Spitze, Sohlen y 24.
Metall: nur die beiden Goldschnallen (nur sie glänzen). Kein Feuer.

Idle-Idee „Seuchenfee“: Um ihn steigen violette Seuchenblasen auf. Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original, Blasen hinter der Figur):
* Seuchenblasen: sechs runde Blasen in den Violetttönen des Gesichts steigen versetzt hinter der Figur langsam auf (2×2 → Kreis 4×4 → 2×2 → weg, leichtes Pendeln; nie Einzelpixel). In Frame 0 ist keine sichtbar.
* Atmen (Periode 24): Rockzeile 20 wird texturiert eingefügt (0–1 px): Oberkörper, Hände, Kopf und Zylinder heben sich gemeinsam, Schuhe bleiben stehen. Kopf nie seitlich.
* Blinzeln (Frames 14–16 und 38–40): die roten Augen nehmen das Dunkelviolett der Augenhöhle an.
* Gold glänzt kurz (nur Metall): Hutschnalle Frames 6–8 (Schnalle eine Stufe heller, dann 1 Frame kleiner Kreuz-Sparkle am Bügel), Gürtelschnalle Frames 30–31 (hell/dunkel getauscht).
Der Zylinder ist starr und geht nur als Ganzes mit dem Kopf mit. Ergänzungen: keine.
"""
import math

import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('disease-fairy-leprochaun', pad=(6, 6, 3, 2))
spr = FIG.spr
OFF = FIG.off
TEST_EBENEN = 'figur'

GOLD_D, GOLD_H = FIG.farbe((255, 180, 24), (255, 205, 49))
HOEHLE = FIG.f(5, 12)
BL_K, BL_R = FIG.farbe((185, 94, 166), (152, 61, 129))
SCHNALLE = [(7, 5), (8, 5), (6, 6), (9, 6), (6, 7), (9, 7)]
# Blasen: (x Start, y Start, Steighöhe, Pendel, Startframe, Lebensdauer)
BLASEN = [(-1, 17, 13, 1, 4, 22), (16, 19, 14, -1, 12, 22), (1, 12, 9, -1, 20, 18), (15, 13, 10, 1, 27, 20), (-1, 20, 12, 1, 34, 13), (14, 9, 6, 1, 40, 7)]


def blasen(i):
    e = L.leer(FIG.H, FIG.W)
    for x0, y0, hoch, pendel, start, leb in BLASEN:
        k = (i - start) % N
        if k >= leb:
            continue
        t = k / float(leb)
        form = 'o' if 0.25 <= t < 0.75 else 's'
        cx = x0 + int(round(pendel * math.sin(2 * math.pi * t)))
        cy = y0 - int(round(hoch * t))
        for dx, dy, art in L.PUFF_FORMEN[form]:
            X, Y = cx + dx + OFF[0], cy + dy + OFF[1]
            e[Y, X, :3] = BL_K if art == 'c' else BL_R
            e[Y, X, 3] = 255
    return e


def frame(i, nur=None):
    a = FIG.platz()
    if N2.fenster(i, N, 14, [1, 1, 1]) or N2.fenster(i, N, 38, [1, 1, 1]):
        N2.setze(a, OFF, {(6, 13): HOEHLE, (9, 13): HOEHLE})
    g = N2.fenster(i, N, 6, [1, 1, 2])
    if g:
        N2.setze(a, OFF, {p: GOLD_H for p in SCHNALLE})
        if g == 2:
            N2.funke(a, OFF, 8, 5, 1, GOLD_H, GOLD_D)
    if N2.fenster(i, N, 30, [1, 1]):
        N2.setze(a, OFF, {(8, 19): GOLD_H, (9, 19): GOLD_D})
    a = TX.streck_zeile(a, FIG.pt + 20, N2.hub(i, 24, 1))
    if nur == 'figur':
        return a
    return L.zusammen(FIG.H, FIG.W, [(blasen(i), 0, 0), (a, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Disease Fairy Leprochaun')
