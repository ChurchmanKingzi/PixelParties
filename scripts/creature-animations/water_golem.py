# -*- coding: utf-8 -*-
"""Idle-Animation für „Water Golem“ (Creature) — Golem aus Wasser: das Wasser strömt in seinem Leib langsam nach unten, die Oberfläche kräuselt sich,
der schwere Leib hebt und senkt sich, Tropfen fallen von den Armen.

PICK: [["Motive", 1395, "Wassertextur-Ebene (48×128, senkrecht alle 16 Zeilen periodisch) – der Golem der Kartenkunst ist genau diese Textur ab (6,2), fast deckend"],
       ["Motiv-Maske", "Water Golem", "Silhouette des Golems in der Kunst (x 23–53, y 6–45)"]]
In Motive.xcf gibt es KEINE eigene Golem-Figur: Helligkeitssuche über alle Ebenen aller xcf-Dateien → einziger Treffer ist Ebene 1395 (Korrelation 0,80), eine reine
Wassertextur; die Golemform entsteht in der Kunst erst durch die Ebenenmaske. Sprite = Textur × Motiv-Maske, voll deckend (in der Kunst leicht durchscheinend;
kein `deckkraft`-Feld gesetzt – siehe Bericht). src/water-golem-textur.png = eine Periode der Textur (16 Zeilen) für das Strömen.

Identifikation (31×40): Kopfbuckel (x 15–22, y 0–3), breite Schultern (y 3–13), bildlinks hängender Arm (x 0–7, y 14–24, geht in die Hüfte über), bildrechts
hängender Arm (x 21–30, y 14–24), dazwischen der Rumpf (x 8–20) mit den zwei Lücken (Achseln, x 7–9 und x 19–22), zwei Säulenbeine (x 1–13 und x 19–29,
y 25–39). Kein Gesicht, keine Augen in der Kunst → nichts blinzelt. Kein Umriss: die Figur ist reine Wassertextur.

Ablauf (64 Frames à 80 ms = 5,1 s; schwer → langsam). Frame 0 = Original:
* Strömen: die Textur wandert im Leib alle 4 Frames 1 px nach unten (16 Schritte = eine Texturperiode → nahtlos). Silhouette bleibt stehen.
* Schwerer Atem (Periode 32): alles oberhalb von Zeile 30 hebt sich 1 px (Silhouette; die Textur wird nicht kopiert, sie füllt die neue Zeile selbst).
* Gekräuselte Oberfläche: der äußere linke/rechte Rand jeder Zeile oberhalb der Füße wölbt sich als nach unten laufende Welle um 1 px vor (Textur füllt).
* Tropfen: 2×2-Tropfen in den zwei hellsten Texturfarben fallen neben den Armen herab (links ab Frame 6 und 38, rechts ab Frame 22 und 54).
"""
import math

import numpy as np

import anim_lib as L
import anim_n11 as G

N, MS = 64, 80
sz = G.Szene('water-golem', (4, 4, 4, 3))
spr = sz.spr
TEX = L.lade('water-golem-textur')                         # 16×35, Spalte 0 = Spritespalte −2
HELL, HELL2 = (95, 134, 179), (59, 111, 177)
TEST_EBENEN = ('figur',)


def silhouette(i):
    m = sz.da.copy()
    ph = 2 * math.pi * i / N
    if i:
        for y in range(1, 36):
            xs = np.nonzero(sz.da[y])[0]
            if math.sin(2 * ph - y * 0.8) > 0.6 and xs[0] > 0:
                m[y, xs[0] - 1] = True
            if math.sin(2 * ph - y * 0.8 + 2.5) > 0.6 and xs[-1] < sz.sw - 1:
                m[y, xs[-1] + 1] = True
    voll = sz.voll(m)
    if G.stufe(i, 32, 8, 14):
        z = sz.PT + 30
        voll[:z] = voll[1:z + 1]
    return voll


def frame(i, nur=None):
    m = silhouette(i)
    f = L.leer(sz.H, sz.W)
    s = i // 4
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        f[y, x] = TEX[(y - sz.PT + 2 - s) % 16, x - sz.PL + 2]
    if not nur:
        tr = G.tropfen(sz.H, sz.W, i, [dict(x=sz.PL - 3, y=sz.PT + 16, start=6, dauer=14, g=0.08), dict(x=sz.PL - 3, y=sz.PT + 16, start=38, dauer=14, g=0.08),
                                       dict(x=sz.PL + 32, y=sz.PT + 15, start=22, dauer=14, g=0.08), dict(x=sz.PL + 32, y=sz.PT + 15, start=54, dauer=10, g=0.14)],
                       HELL, HELL2)
        f = G.ueber(f, np.where(f[..., 3:] == 0, tr, 0).astype(np.uint8))
    return f


if __name__ == '__main__':
    G.fertig('water-golem', 'Water Golem', frame, N, MS, np.concatenate([spr.reshape(-1, 4), TEX.reshape(-1, 4)])[None], check=[0, 8, 14, 24, 40, 56], zoom=10)
