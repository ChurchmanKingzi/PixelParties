# -*- coding: utf-8 -*-
"""Idle-Animation für „Box Spider“ (Creature).

Quelle: src/box-spider.png — Ebene „Ebene #174“ (15×20 px, 15 Farben) aus MotiveGN.xcf (Ebene 274): die Holzkiste mit Netz-Fenster und Spinnfäden, in der die „Box Spider“ sitzt.
Das ist der einzige karten-eigene Sprite der Karte (der Abgleich in merged.json lieferte sonst nur die kleinen Dekor-Spinnen der Kartenkulisse — sie gehören nicht zur Figur). Auf der Karte
liegen unter/hinter der Kiste noch dunkle Beinpixel einer Spinne; sie stammen aus keiner Ebene, die sich zuordnen ließ (Vorlagenabgleich ohne Treffer), und fehlen deshalb.
PICK: [["MotiveGN", 274, "ganze Ebene"]]

Aufruf:   python3 box_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/box-spider.png + .json

Identifikation (Sprite 15×20):
* Spinnfäden (Zeilen 0–2, weiß A (255,255,255)): fünf nach oben aus der Kistenöffnung ragende Fäden — Mitte (7,0)(7,1) mit Ansatz (6,2)(8,2); links (0,1)+(1,2) und (4,1)+(3,2)(5,2); rechts (10,1)+(9,2)(11,2)
  und (14,1)+(13,2); in Zeile 3 setzen sie sich als weiße Pixel des Kistenrands fort.
* Netz-Fenster (Zeilen 3–9, x 2–12): weiß/dunkel kariert — weißes Gitter A über dunklem Inneren (J (65,61,56) hell, H (58,50,44), F (46,40,35), I (25,26,25) nach unten dunkler).
* Fenstersturz (Zeile 10): hellbraune Leiste (G (232,200,136) / K (216,179,116) / D (175,127,64)).
* Kiste (Zeilen 3–16, x 1–13): senkrechte Holzbretter in B (103,64,32) / C (136,95,49) / D / E (155,112,57) / L (194,152,88), Rand links C, rechts B, Boden Zeile 16 B.
* Beschlag/Riegel unter der Kiste (Zeilen 17–19, x 8–11): dunkles Pixelkreuz I (25,26,25) mit zwei Mittelpixeln N (207,197,146) / O (172,164,120) — nicht eindeutig (Schloss? Fuß?), bleibt fest an der Kiste.
* Kein Metall/Gold/Edelstein sichtbar → kein Glanz, kein Glitzer (Regel 14).
Bleibt fest: Holzbretter, Kistenrand, Sturz, Riegel (bewegen sich nur mit der ganzen Kiste), Netzgitter (weiß).

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* Fäden wehen: jeder der fünf Spinnfäden wiegt sich für sich (je Faden eigene Periode 3…5 je Schleife; die Spitzen wechseln zwischen links/senkrecht/rechts, 1 px; die Mittelspitze (7,0) folgt (7,1)).
* Schatten im Netz: zweimal pro Schleife wandert ein dunkler Schatten diagonal durch das Fenster — die dunklen Netzpixel werden dort um bis zu zwei Rampenstufen dunkler (J→H→F→I), das Gitter bleibt weiß:
  „etwas krabbelt in der Kiste“.
* Rütteln: dreimal pro Schleife (Frames 10–15, 26–31 und 41–46) wackelt die ganze Kiste starr 1 px nach links/rechts (die Fäden schwingen dann am stärksten mit); sonst steht sie fest.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.

Ergänzungen: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

spr = L.lade('box-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

fadenmaske = vor & (yy <= 2)
kiste = vor & ~fadenmaske
WEISS = (255, 255, 255)
RAMPE = [(65, 61, 56), (58, 50, 44), (46, 40, 35), (25, 26, 25)]       # J → H → F → I
netz = vor & (yy >= 5) & (yy <= 9) & (xx >= 3) & (xx <= 11) & L.farbmaske(spr, RAMPE[:3])
RUETTELN = ((10, (1, -1, 1, -1, 1, 0)), (26, (-1, 1, -1, 1, 0, 0)), (41, (1, -1, 1, -1, 0, 0)))
STRAENGE = [  # (Spitzenpixel, Ansatz-Bereich der Zeile 1, Perioden je Schleife, zulässige Verschiebungen)
    dict(tip=[(0, 1)], per=3, erlaubt=(0, 1)),
    dict(tip=[(4, 1)], per=4, erlaubt=(-1, 0, 1)),
    dict(tip=[(7, 1), (7, 0)], per=3, erlaubt=(-1, 0, 1)),
    dict(tip=[(10, 1)], per=5, erlaubt=(-1, 0, 1)),
    dict(tip=[(14, 1)], per=4, erlaubt=(-1, 0)),
]


def zustand(i):
    # Kiste rütteln
    dx = 0
    rue = False
    for s, muster in RUETTELN:
        if 0 <= i - s < len(muster):
            dx = muster[i - s]; rue = True
    sw_ = []
    for k, st in enumerate(STRAENGE):
        a = math.sin(2 * math.pi * st['per'] * i / N + 0.0)
        if rue:
            a = math.copysign(1.0, a if a else 1.0) * min(1.0, abs(a) * 1.6)
        v = int(round(a * 1.0))
        v = min(st['erlaubt'], key=lambda e: abs(e - v))
        sw_.append(v)
    schatten = None
    for s in (4, 28):
        if 0 <= i - s < 14:
            schatten = 2.0 + (i - s) * 0.95               # Mittelachse u = x + 0,5·(y−5), läuft von 2 bis ~14
    return dx, sw_, schatten


def frame(i, nur=None):
    dx, sw_, schatten = zustand(i)
    k, _ = L.trenne(spr, kiste)
    k = L.platz(k, H, W, PAD_L + dx, PAD_T)
    if schatten is not None:
        for y, x in zip(*np.nonzero(netz)):
            u = x + 0.5 * (y - 5)
            d = abs(u - schatten)
            stufe = 2 if d < 0.8 else (1 if d < 1.8 else 0)
            if stufe:
                c = tuple(int(v) for v in spr[y, x, :3])
                j = min(len(RAMPE) - 1, RAMPE.index(c) + stufe)
                k[PAD_T + y, PAD_L + dx + x, :3] = RAMPE[j]
    f = L.leer(H, W)
    for (px, py) in [(int(x), int(y)) for y, x in zip(*np.nonzero(fadenmaske))]:
        # Spitzenpixel einzelner Fäden werden verschoben (Zeile 1 / Zeile 0), alle anderen Fadenpixel bleiben
        schieb = 0
        for st, v in zip(STRAENGE, sw_):
            if (px, py) in st['tip']:
                schieb = v
        f[PAD_T + py, PAD_L + dx + px + schieb, :3] = WEISS
        f[PAD_T + py, PAD_L + dx + px + schieb, 3] = 255
    ebenen = {'kiste': k, 'faeden': f}
    wahl = nur or ('kiste', 'faeden')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('box-spider', 'Box Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/box-spider-strip.png', frames, spalten=12, scale=8)
