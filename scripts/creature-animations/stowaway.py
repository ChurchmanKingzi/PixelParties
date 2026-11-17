# -*- coding: utf-8 -*-
"""Idle-Animation für „Stowaway“ (Creature) — der blinde Passagier im Schiffsrumpf: ein schwarzer Schattenleib mit zwei roten Augen, aus dem zwei
Tentakel mit Sichelhaken greifen. Der Schatten wabert, die Haken tasten umher, die Augen blinzeln.

PICK: [["MotiveIndia", 390, "Ebene „The Thing in the Hull“: die zwei kleinen Sichelhaken (x 0–7, y 86–95 und x 23–31, y 106–115) und das Augenrot (173,0,0)"],
       ["Kartenkunst", "Stowaway.png + Motiv-Maske", "der schwarze Riss im Rumpf mit den zwei roten Augen (Kunst x 38–44, y 22–34) = Leib; Schwarz (10,17,10) aus der Kunst"]]
ZUSAMMENGESETZT (Nutzer: „mit dem Schwarzen aus dem Schiff selbst zusammensetzen“): In der Kunst sieht man nur Riss, Augen und zwei Haken – einer hängt direkt
am Riss (unten rechts), der andere liegt 14 px weiter links oben frei auf dem Rumpf. Daraus EINE Figur: der Riss ist zu einem rundlichen Schattenleib ergänzt
(Zeilen 20–34, Schwarz der Kunst, die Maskenpixel des Risses sind vollständig enthalten), die Augen sitzen an ihren Kunstpositionen (40,25) und (41,29) (schräg
übereinander, wie in der Kunst); ein kurzer schwarzer Tentakel verbindet den Leib mit dem unteren rechten Haken (hängt in der Kunst direkt am Riss). Der linke
obere Haken steht FREI für sich (wie in der Kunst; die früher gezeichnete Verbindung zum Leib hat der Nutzer in Runde 12 gestrichen). Lage und Form der Haken = Kunst/Ebene.
src/stowaway.png ist die so gebaute Ruhepose (python3 stowaway.py --src schreibt sie neu).

Identifikation (Koordinaten der Kartenkunst; Sprite = Ausschnitt ab (16,11)): Haken 1 oben links (x 18–25, y 13–22; Ansatz unten rechts bei (24,21)),
Haken 2 unten rechts (x 40–47, y 33–42; Ansatz oben bei (44,33)); Hakenfarben: Umriss (56,22,49), Fläche (88,57,68), Lichtkante (135,103,116), Glanzpunkt
(189,165,173) – Horn/Chitin, kein Metall → kein Sparkle. Leib und der kurze Tentakel einfarbig schwarz (10,17,10). Augen (173,0,0).

Ablauf (64 Frames à 75 ms = 4,8 s). Frame 0 = Ruhepose:
* Schattenleib wabert: linker und rechter Rand jeder Zeile wandern um 0/1 px als nach unten laufende Welle (zwei Umläufe je Schleife); Fläche bleibt geschlossen.
* Haken 1 tastet als eigenes, freies Teil: starr auf einer kleinen liegenden Acht (±2 px waagerecht, ±1 px senkrecht, ein Umlauf je Schleife); keine Verbindung zum Leib.
* Haken 2 pendelt starr ±1 px waagerecht (zwei Umläufe), sein kurzer Tentakel folgt.
* Augen blinzeln einzeln und gemeinsam (Auge für 2 Frames schwarz): Frames 20–21 (beide), 44–45 (oberes), 50–51 (unteres). Kein Glühen außerhalb der Augenpixel.
"""
import math
import os
import sys

import numpy as np
from PIL import Image

import anim_lib as L
import anim_n11 as G

N, MS = 64, 75
OX, OY = 16 - 4, 11 - 4                      # Kunstkoordinate → Leinwand (Rand 4)
W_, H_ = 40, 40
SCHWARZ, ROT = (10, 17, 10), (173, 0, 0)
P2, P3, P1, P0 = (56, 22, 49), (88, 57, 68), (135, 103, 116), (189, 165, 173)
_F = {'2': P2, '3': P3, '1': P1, '0': P0}
HAKEN1 = ["...2....", "..23....", ".22302..", "23312...", "2302....", "2312....", "2312....", "233022..", ".233112.", "..22222."]     # Kunst (18,13)
HAKEN2 = ["...2.....", "...32....", ".20322...", "..21332..", "...2032..", "...2132..", "...2132..", ".220332..", "211332...", "22222...."]  # Kunst (40,33)
LEIB = {20: (39, 41), 21: (38, 43), 22: (37, 44), 23: (36, 45), 24: (36, 45), 25: (35, 45), 26: (35, 46), 27: (35, 46), 28: (35, 45), 29: (36, 45),
        30: (37, 45), 31: (38, 45), 32: (40, 45), 33: (41, 45)}
AUGEN = [(40, 25), (41, 29)]


def px(f, x, y, c):
    X, Y = x - OX, y - OY
    if not (0 <= X < W_ and 0 <= Y < H_):
        raise L.ClipError('außerhalb')
    f[Y, X, :3] = c; f[Y, X, 3] = 255


def haken(f, muster, x0, y0):
    for r, z in enumerate(muster):
        for c, ch in enumerate(z):
            if ch != '.':
                px(f, x0 + c, y0 + r, _F[ch])


def kette(f, a, b, durchhang, dick):
    """Schwarzer Tentakel von a nach b (quadratische Kurve mit Durchhang), dick(t) px hoch."""
    cx, cy = (a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0 + durchhang
    n = 4 * int(abs(a[0] - b[0]) + abs(a[1] - b[1]) + 2)
    for k in range(n + 1):
        t = k / n
        x = (1 - t) ** 2 * a[0] + 2 * t * (1 - t) * cx + t * t * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * cy + t * t * b[1]
        for d in range(dick(t)):
            px(f, int(round(x)), int(round(y)) - d, SCHWARZ)


def frame(i, nur=None):
    f = L.leer(H_, W_)
    ph = 2 * math.pi * i / N
    h1 = (int(round(2 * math.sin(ph))), int(round(math.sin(2 * ph + math.pi)) * 1))          # liegende Acht: ±2 px waagerecht, ±1 px senkrecht
    h2 = int(round(math.sin(2 * ph)))
    # Tentakel (unter Leib und Haken)
    # (Runde 12: der selbst gezeichnete Tentakel vom Leib zu Haken 1 ist entfernt – der linke Haken steht frei, wie in der Kunst)
    kette(f, (44, 31), (44 + h2, 35), 0, lambda t: 3)
    for d in (-1, 0, 1):
        kette(f, (44 + d, 31), (44 + h2 + (d if d < 1 else 0), 34), 0, lambda t: 1)
    # Schattenleib mit laufender Randwelle
    for y, (a, b) in LEIB.items():
        wl = 1 if math.sin(2 * ph * 1 - y * 1.1) > 0.45 else 0
        wr = 1 if math.sin(2 * ph * 1 - y * 1.1 + 2.2) > 0.45 else 0
        if i == 0:
            wl = wr = 0
        for x in range(a - wl, b + wr + 1):
            px(f, x, y, SCHWARZ)
    for (x, y) in [(39, 22), (40, 22), (41, 22), (38, 27), (38, 28), (44, 28), (41, 34), (42, 34), (43, 34), (44, 34)]:   # Risspixel der Maske (alle im Leib bzw. Tentakel)
        px(f, x, y, SCHWARZ)
    zu = {0: i in (20, 21, 44, 45), 1: i in (20, 21, 50, 51)}
    for k, (x, y) in enumerate(AUGEN):
        if not zu[k]:
            px(f, x, y, ROT)
    haken(f, HAKEN1, 18 + h1[0], 13 + h1[1])
    haken(f, HAKEN2, 40 + h2, 33)
    return f


if '--src' in sys.argv:
    f0 = frame(0)
    ys, xs = np.nonzero(f0[..., 3])
    Image.fromarray(f0[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(os.path.join(L.SRC, 'stowaway.png'))
spr = L.lade('stowaway')

if __name__ == '__main__':
    G.fertig('stowaway', 'Stowaway', frame, N, MS, spr, check=[0, 8, 16, 20, 32, 40, 48, 56], zoom=12)
