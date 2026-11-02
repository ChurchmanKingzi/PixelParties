# -*- coding: utf-8 -*-
"""Idle-Animation für „Land Sharks“ (Creature) — Runde 2: die Flosse ist STARR, die Erde rundherum wird durchgehend aufgewühlt.

Nutzerkorrektur (wörtlich): „stellt die Rückenflosse eines Hais dar, die soll nicht so gummiartig sein! Stattdessen soll die Erde rundrum durchgehend aufgewühlt werden.“

Quelle: src/land-sharks.png — eine Haifischflosse, die aus einem Erdhügel ragt (21×17 px, 6 Farben) aus Motive.xcf, Ebene 763 „Land Sharks“. Die Ebene enthält drei fast gleiche
Exemplare (wie auf der Karte), die sich nur in der Form des Erdhügels unterscheiden; verwendet wird das obere Exemplar samt seinen Erdkrümeln.
PICK: [["Motive", 763, 1]]

Aufruf:   python3 land_sharks.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/land-sharks.png + .json

Identifikation (Sprite 21×17; Farben A (0,0,0) Umriss, B (43,55,67)/C (58,72,85) Flossenfläche im Schachbrett, D (29,39,51) Flossenschatten, E (119,80,40) helle Erde, F (83,48,23) dunkle Erde):
* Haifischflosse (x 5–14, Zeilen 0–11): schwarzer Umriss links/oben und rechts bis Zeile 8, graublaue Fläche; sie neigt sich nach links oben. Im Original verdecken einzelne Erdpixel den Flossenansatz
  (Zeilen 9–11, x 9–10 und x 13): dort ist die Flosse hinter der Erde ergänzt (siehe Ergänzungen).
* Erdhügel links (x 1–7, Zeilen 9–15), rechts (x 13–20, Zeilen 8–14) und der durchgehende Streifen darunter (Zeilen 12–16); einzelne Erdkrümel (18,7) (7,8) (0,9) (1,14) (20,14) (3,16) liegen lose daneben.
* Keine Augen, kein Maul — nur die Flosse, die durch die Erde pflügt. Kein Glanz (Regel 14).
Bleibt fest: die GANZE Flosse (starr, ohne Verbiegen — Nutzerwunsch), die losen Krümel, der Hügelrand am Boden.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* Erdströmung: die Erdfarben (E/F-Muster) fließen zeilenweise durch die feste Hügelform — die oberen Zeilen (9–11) nach links, die Zeilen 12–13 nach rechts, 14–15 wieder nach links
  (je genau eine Runde pro Schleife = nahtlos): die Erde wird sichtbar umgewälzt, ohne dass sich die Hügelform verbiegt.
* Hügeloberfläche wirft Wellen: der Hügelrand außerhalb des Flossenansatzes hebt und senkt sich um 1 px als wandernde Welle (zwei Wellen pro Schleife, läuft nach links);
  oben aufgesetzte Pixel in Erdfarbe, abgetragene Pixel verschwinden — die Silhouette „kocht“.
* Erdschollen: sechs Klumpen (2×2 bzw. 3×2 px, oben hell E, unten dunkel F) werden links und rechts an der Flosse aus der Erde geschleudert (Wurfparabel bis 4–7 px hoch), fallen zurück und
  versinken im Hügel (Ebene HINTER Flosse und Hügel, sie tauchen also aus der Erde auf); je zwei Würfe pro Schleife, zeitlich versetzt (immer ein paar in der Luft).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen (gemalt, Farben der Flosse): die im Original von Erde verdeckten Flossenpixel (9,9) (10,9) (9,10) (10,10) (10,11) und (13,8) (13,9) (13,10) (13,11) sowie die Flosse
nach unten verlängert (Zeilen 12–14, x 8–13, Kopie der Zeile 11) — alles liegt hinter der Erde und wird nur sichtbar, wenn sich der Hügelrand senkt. Die Klumpen sind eigene Pixel
in den zwei Erdfarben des Sprites. Randpixel-Korrektur (Regel 16) über anim_tiere.umriss_schliessen.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 3

spr = L.lade('land-sharks')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

E = (119, 80, 40)                                                  # helle Erde
F = (83, 48, 23)                                                   # dunkle Erde
FLOSSE_F = [(0, 0, 0), (43, 55, 67), (58, 72, 85), (29, 39, 51)]
flosse = vorhanden & L.farbmaske(spr, FLOSSE_F)
erde = vorhanden & ~flosse
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

# Erde in Hügelmasse (zusammenhängend) und lose Krümel (isolierte Pixel) trennen
_p = np.pad(erde, 1)
_nb = _p[:-2, 1:-1].astype(int) + _p[2:, 1:-1] + _p[1:-1, :-2] + _p[1:-1, 2:]
kruemel = erde & (_nb == 0)
masse = erde & ~kruemel

C_, B_, D_ = (58, 72, 85), (43, 55, 67), (29, 39, 51)
# Flosse hinter der Erde ergänzen (nur sichtbar, wenn sich der Hügelrand senkt)
ERG = {(9, 9): D_, (10, 9): B_, (9, 10): D_, (10, 10): D_, (10, 11): D_, (13, 8): C_, (13, 9): B_, (13, 10): D_, (13, 11): B_}
for y in (12, 13, 14):
    for x, c in zip(range(8, 13), (D_, D_, D_, D_, B_)):
        ERG[(x, y)] = c
    ERG[(13, y)] = D_

STROEM = {9: -1, 10: -1, 11: -1, 12: 1, 13: 1, 14: -1, 15: -1}      # Zeile → Richtung (−1 nach links); je eine Runde pro Schleife


def textur():
    """Farbmuster je Zeile (zyklisch über die Breite): Hügelpixel behalten ihre Farbe, Lücken bekommen das Schachbrett E/F."""
    tex = {}
    for y in range(sh):
        row = []
        for x in range(sw):
            if masse[y, x]:
                row.append(tuple(int(v) for v in spr[y, x, :3]))
            else:
                row.append(E if (x + y) % 2 == 0 else F)
        tex[y] = row
    return tex


TEX = textur()
OBEN = {}                                                          # oberste Hügelzeile je Spalte
for _x in range(sw):
    _ys = np.nonzero(masse[:, _x])[0]
    if len(_ys):
        OBEN[_x] = int(_ys.min())
WELLE = {x for x in OBEN if not (7 <= x <= 13)}                    # die Spalten am Flossenansatz bleiben ruhig (Spalte 7: sonst läge der Flossenrand (8,10) ohne Umriss frei)


def erde_ebene(i):
    out = L.leer(H, W)
    # 1. Erdströmung: Muster je Zeile zyklisch verschoben
    for y in range(sh):
        for x in range(sw):
            if not masse[y, x]:
                continue
            s = 0
            if y in STROEM:
                s = int(math.floor(STROEM[y] * i * sw / float(N) + 0.5))
            c = TEX[y][(x + s) % sw]
            out[PAD_T + y, PAD_L + x, :3] = c
            out[PAD_T + y, PAD_L + x, 3] = 255
    # 2. Oberfläche: Wellen (1 px), laufen nach links
    for x in WELLE:
        top = OBEN[x]
        h = int(math.floor(math.sin(2 * math.pi * 2 * i / N + 0.62 * x) * 1.15 + 0.5))     # −1, 0, +1
        if h > 0:                                                   # Erde hebt sich: Pixel oben aufsetzen
            y = top - 1
            s = int(math.floor(STROEM.get(y, -1) * i * sw / float(N) + 0.5)) if y in STROEM else 0
            out[PAD_T + y, PAD_L + x, :3] = TEX[min(top, sh - 1)][(x + s) % sw]
            out[PAD_T + y, PAD_L + x, 3] = 255
        elif h < 0 and (masse[top + 1, x] if top + 1 < sh else False) and top < 12:     # Erde sinkt: oberstes Pixel weg
            out[PAD_T + top, PAD_L + x, 3] = 0
    # 3. lose Krümel bleiben (Original)
    for y, x in zip(*np.nonzero(kruemel)):
        out[PAD_T + y, PAD_L + x, :3] = spr[y, x, :3]
        out[PAD_T + y, PAD_L + x, 3] = 255
    return out


def flosse_ebene():
    t, _ = L.trenne(spr, flosse)
    t = L.platz(t, H, W, PAD_L, PAD_T)
    for (x, y), c in ERG.items():
        if not t[PAD_T + y, PAD_L + x, 3]:
            t[PAD_T + y, PAD_L + x, :3] = c
            t[PAD_T + y, PAD_L + x, 3] = 255
    return t


FLOSSE_EBENE = flosse_ebene()

# Erdschollen: (Startspalte, Startzeile (liegt in der Erde), Weg dx über den Flug, Wurfhöhe, Dauer, Phase im 24er-Takt, Breite 2 oder 3 px)
KLUMPEN = [(6, 11, -6, 7, 18, 0, 2), (14, 10, 5, 6, 18, 4, 3), (4, 11, -3, 5, 16, 8, 3), (15, 10, 4, 7, 18, 12, 2), (5, 11, -4, 6, 17, 16, 2), (16, 10, 3, 5, 16, 20, 3)]
PERIODE = 24


def klumpen_ebene(i):
    out = L.leer(H, W)
    for (x0, y0, dx, hoehe, dauer, off, breite) in KLUMPEN:
        t = (i - off) % PERIODE
        if t >= dauer:
            continue
        u = t / float(dauer)
        x = x0 + dx * u
        y = y0 - 4.0 * hoehe * u * (1 - u)
        px, py = int(math.floor(x + 0.5)), int(math.floor(y + 0.5))
        for (ax, ay, c) in [(a_, 0, E) for a_ in range(breite)] + [(a_, 1, F) for a_ in range(breite)]:
            X, Y = PAD_L + px + ax, PAD_T + py + ay
            if not (0 <= Y < H and 0 <= X < W):
                raise L.ClipError(f'Scholle bei ({X},{Y}) außerhalb der Leinwand {W}×{H}')
            out[Y, X, :3] = c
            out[Y, X, 3] = 255
    return out


def frame(i, nur=None):
    ebenen = {'schollen': klumpen_ebene(i), 'flosse': FLOSSE_EBENE, 'erde': erde_ebene(i)}
    wahl = nur or ('schollen', 'flosse', 'erde')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in ('schollen', 'flosse', 'erde') if n in wahl])
    return ganz


TEST_EBENEN = ['flosse', 'erde']


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('land-sharks', 'Land Sharks', frames, MS, prev)
    if prev:
        L.streifen(prev + '/land-sharks-strip.png', frames, spalten=12, scale=7)
