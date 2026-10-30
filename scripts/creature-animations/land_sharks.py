# -*- coding: utf-8 -*-
"""Idle-Animation für „Land Sharks“ (Creature).

Quelle: src/land-sharks.png — eine Haifischflosse, die aus einem Erdhügel ragt (21×17 px, 6 Farben) aus Motive.xcf, Ebene 763 „Land Sharks“. Die Ebene enthält drei fast gleiche
Exemplare (wie auf der Karte), die sich nur in der Form des Erdhügels unterscheiden; verwendet wird das obere Exemplar samt seinen vier Erdkrümeln (Pixel (18,7) (0,9) (3,9) (5,8) im Sprite).
PICK: [["Motive", 763, 1]]

Aufruf:   python3 land_sharks.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/land-sharks.png + .json

Identifikation (Sprite 21×17):
* Haifischflosse (x 5–14, Zeilen 0–9): schwarzer Umriss D (0,0,0) links/oben, grauschwarze Fläche in Schachbrett-Rasterung C (43,55,67) / E (58,72,85); unten Schatten F (29,39,51)
  am Flossenansatz (Zeilen 7–11); die Flosse neigt sich nach rechts.
* Erdhügel (x 0–20, Zeilen 8–16): braun A (119,80,40) / dunkler B (83,48,23), zerklüfteter Rand; drumherum ein paar Erdkrümel (einzelne Pixel, schon so gezeichnet).
* Keine Augen, kein Maul — es ist nur die Flosse, die durch die Erde pflügt. Kein Glanz (Regel 14), keine Partikel.
Bleibt fest: Erdkrümel (einzelne Pixel), Flossenansatz im Hügel.

Ablauf (56 Frames à 66 ms = 3,7 s), alle Bewegungen unabhängig:
* Flosse taucht auf (Periode 28, 2× pro Schleife): die Flossenspitze hebt sich in zwei Stufen — erst 1 px (Zeile 7 wird in der Flosse eingefügt, Frames 3–16 und 31–44), 3 Frames später
  noch 1 px (Zeile 3, Frames 6–19 und 34–47); der Ansatz bleibt im Hügel. Die Flosse wird dabei etwas höher.
* Flosse wiegt sich: die Flossenzeilen 0–9 neigen sich als wandernde Welle bis ±2 px (Spitze am meisten), 2 Wellen pro Schleife.
* Hügel bebt: zweimal pro Schleife (Frames 6–21 und 34–49) schüttelt sich der Erdhügel (Zeilen 12–16 wandern zweimal bis ±1 px hin und her, benachbarte Zeilen im Gegentakt; die Erde um den Flossenansatz bleibt).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16): wo die Flossenbewegung eine Füllfarbe an den Rand schiebt, wird ein Umrisspixel (Farbe aus dem Original) ergänzt (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 66
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('land-sharks')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

flosse = vorhanden & L.farbmaske(spr, [(0, 0, 0), (43, 55, 67), (58, 72, 85), (29, 39, 51)])
huegel = vorhanden & ~flosse
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
FENSTER_HUEGEL = [(6, 22), (34, 50)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    a = 1 if (i % 28) in range(3, 17) else 0
    b = 1 if (i % 28) in range(6, 20) else 0
    u = None
    for s, e in FENSTER_HUEGEL:
        if s <= i < e:
            u = (i - s) / float(e - s)
    return a, b, u


def flosse_wiegen(t, i):
    """Flossenzeilen 0–9 wandern waagerecht: round(1,6 · f · sin(φ − 0,5 f)), f = (9 − y)/9 (Spitze am meisten, Ansatz fest; Frame 0 = Original)."""
    out = L.leer(H, W)
    ph = 2 * math.pi * i / 28.0 + 0.2
    for y in range(0, 12):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = max(0.0, (9 - y) / 9.0)
        dx = int(round(1.6 * f * math.sin(ph - 0.5 * f)))
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def huegel_beben(t, u):
    """Hügelzeilen 12–16: benachbarte Zeilen im Gegentakt bis ±1 px, nur im Bebenfenster; sonst wie im Original."""
    if u is None:
        return t
    out = L.leer(H, W)
    for y in range(0, sh):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        if y < 12:                                                 # die Erde direkt um den Flossenansatz (Zeilen 7–11) bleibt, sonst entstünden Lücken neben der Flosse
            out[PAD_T + y, xs_] = t[PAD_T + y, xs_]
            continue
        dx = int(round(1.0 * math.sin(math.pi * u) * math.sin(4 * math.pi * u + 1.7 * y)))
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    a, b, u = zustand(i)
    f = flosse_wiegen(teil(flosse), i)
    f = L.streck_zeile(f, PAD_T + 3, b)
    f = L.streck_zeile(f, PAD_T + 7, a)
    h = huegel_beben(teil(huegel), u)
    ebenen = {'huegel': h, 'flosse': f}
    wahl = nur or ('huegel', 'flosse')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('land-sharks', 'Land Sharks', frames, MS, prev)
    if prev:
        L.streifen(prev + '/land-sharks-strip.png', frames, spalten=14, scale=8)
