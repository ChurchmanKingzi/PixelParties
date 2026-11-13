# -*- coding: utf-8 -*-
"""Idle-Animation für „Plant Golem“ (Creature) — riesiger Golem aus blühenden Büschen mit Holzgesicht; das Laub rauscht, Blätter fallen.

PICK: [["Motive", 886, "Ebene „Plant Golem“ (64×53 px, ganze Ebene)"]]
Quelle vollständig (eine Figur, 19 Farben). Für die Karte liegt keine Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.
(MotiveDeepsea 178 „Plant Golems“ ist eine Szene mit mehreren kleinen Exemplaren und wird nicht verwendet.)

Identifikation (64×53): Kopfbusch (x 25–38, y 0–10), zwei mächtige Schulter-/Armbüsche (x 0–24 und 39–63, y 2–23), Rumpfbusch (x 17–46, y 22–46), alle aus Laub in vier Grüntönen mit
rosa Blüten (Rosa (237,170,222)/(223,104,161), gelbe Mitte). In der Mitte das Holzgesicht/der Stamm (x 25–38, y 10–26; Brauntöne, zwei blaue Augen (41,57,197) in Zeile 16, Nase/Mund
hautfarben). Dünne braune Rankenarme hängen seitlich herab (x 5–20 und 44–58, y 23–39). Zwei Wurzelfüße (y 45–52).
Riesig und schwer → langsam. Holz/Laub → kein Glanz.

Ablauf (64 Frames à 85 ms = 5,4 s). Frame 0 = Original:
* Laub rauscht in einer Windbö (schwillt an und klingt zum Schleifenende ab): eine langsame Welle läuft von oben nach unten durch die Büsche – jede Laubzeile wandert 1 px nach links/rechts und zurück (nur der Umriss kräuselt sich; darunter liegt
  das unbewegte Original, so dass nirgends Hintergrund durchscheint). Gesicht/Stamm (x 24–39, y 10–26) und Wurzelfüße (y ≥ 44) bleiben vollkommen still, die Ranken gehen mit ihrem Laub mit.
* Blinzeln (Frames 30–32): die blauen Augen nehmen die Rindenfarbe (136,95,49) an.
* Drei Blätter (2×2, Laubgrün (145,169,47)) lösen sich nacheinander und trudeln neben dem Rumpf zu Boden.
Ergänzungen: keine.
"""
import math

import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 64, 85
sz = N7.Szene('plant-golem', (4, 4, 2, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
FEST_M = ((xx >= 24) & (xx <= 39) & (yy >= 10) & (yy <= 26)) | (yy >= 44)
BASIS = sz.teil(sz.da)
LAUB = sz.teil(sz.da & ~FEST_M)
FEST = sz.teil(sz.da & FEST_M)
AUGEN = sz.voll(sz.ist((41, 57, 197), (24, 41, 131)))
RINDE, BLATT = (136, 95, 49), (145, 169, 47)
BLAETTER = [dict(x=sz.PL + 12, y=sz.PT + 36, weg=13, off=0, leben=64, wackeln=2, schw=2), dict(x=sz.PL + 50, y=sz.PT + 34, weg=15, off=22, leben=64, wackeln=2, schw=2),
            dict(x=sz.PL + 5, y=sz.PT + 34, weg=15, off=43, leben=64, wackeln=2, schw=2)]
TEST_EBENEN = ('figur',)


def rauschen(a, i):
    out = np.zeros_like(a)
    for y in range(a.shape[0]):
        boe = min(1.0, 2.2 * math.sin(math.pi * i / 64.0))                    # Windbö: schwillt an und ab, Frame 0 = Original
        d = int(math.floor(1.3 * boe * math.sin(2 * math.pi * (i / 32.0 - (y - sz.PT) / 26.0)) + 0.5))
        d = max(-1, min(1, d))
        out[y] = np.roll(a[y], d, axis=0)
    return out


def frame(i, nur=None):
    fest = FEST
    if 30 <= i <= 32:
        fest = N7.farbtausch(fest, AUGEN, {(41, 57, 197): RINDE, (24, 41, 131): RINDE})
    f = L.zusammen(sz.H, sz.W, [(BASIS, 0, 0), (rauschen(LAUB, i), 0, 0), (fest, 0, 0)])
    if nur:
        return f
    return L.zusammen(sz.H, sz.W, [(f, 0, 0), (N7.blasen(sz.H, sz.W, i, N, BLAETTER, BLATT), 0, 0)])


if __name__ == '__main__':
    N7.fertig('plant-golem', 'Plant Golem', frame, N, MS, spr, check=[0, 8, 16, 31], zoom=6)
