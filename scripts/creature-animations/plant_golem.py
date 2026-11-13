# -*- coding: utf-8 -*-
"""Idle-Animation für „Plant Golem“ (Creature) — riesiger Golem aus blühenden Büschen mit Holzgesicht; er atmet ruhig, Blüten leuchten, Blätter fallen.

PICK: [["Motive", 886, "Ebene „Plant Golem“ (64×53 px, ganze Ebene)"]]
Quelle vollständig (eine Figur, 19 Farben). Für die Karte liegt keine Kartenkunst-Datei unter data/card-art/native (kein Abgleich möglich); die Ebene trägt den Kartennamen.
(MotiveDeepsea 178 „Plant Golems“ ist eine Szene mit mehreren kleinen Exemplaren und wird nicht verwendet.)

Identifikation (64×53): Kopfbusch (x 25–38, y 0–10), zwei mächtige Schulter-/Armbüsche (x 0–24 und 39–63, y 2–23), Rumpfbusch (x 17–46, y 22–46), alle aus Laub in vier Grüntönen mit
rosa Blüten (Rosa (237,170,222)/(223,104,161), gelbe Mitte). In der Mitte das Holzgesicht/der Stamm (x 25–38, y 10–26; Brauntöne, zwei blaue Augen (41,57,197) in Zeile 16, Nase/Mund
hautfarben). Dünne braune Rankenarme hängen seitlich herab (x 5–20 und 44–58, y 23–39). Zwei Wurzelfüße (y 45–52).
Riesig und schwer → langsam. Holz/Laub → kein Glanz.

Ablauf (64 Frames à 85 ms = 5,4 s). Frame 0 = Original.
(Runde 8: Die frühere Zeilenwelle über das ganze Laub war „schwindelerregend“ und ist ERSATZLOS entfernt. Kein Pixel des Laubs wandert mehr seitlich in einer Welle.)
* Ruhiges Atmen (einmal je Schleife, Frames 12–39): alles oberhalb der Wurzelfüße hebt sich 1 px – bei Zeile 43 (dunkles Laub am Rumpfsaum) wird eine texturierte Zeile
  eingefügt (anim_textur). Wurzelfüße bleiben stehen.
* Vereinzeltes Rascheln: fünf kleine Randbüschel (Liste BUESCHEL) zucken nacheinander je einmal pro Schleife für 2–3 Frames um 1 px nach innen (starr als Büschel, der Rest
  des Laubs steht still; durch die Richtung „nach innen“ entsteht nirgends eine Lücke).
* Blüten: sechs große Blüten (Liste BLUETEN) leuchten nacheinander kurz auf (4 Frames; nur innerhalb der Blütenpixel: Dunkelrosa → Hellrosa, Orange → Gelb – Farben des Sprites;
  kein Stern, kein Schein, da Blüten kein Metall sind).
* Blinzeln (Frames 30–32): die blauen Augen nehmen die Rindenfarbe (136,95,49) an.
* Drei Blätter (2×2, Laubgrün (145,169,47)) lösen sich nacheinander und trudeln neben dem Rumpf zu Boden.
Ergänzungen: keine.
"""
import math

import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
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


# Randbüschel: (x0, y0, x1, y1, dx, dy, Startframe, Dauer) – Rechteck am Rand der Silhouette, rückt 1 px nach innen
BUESCHEL = [(10, 2, 16, 3, 0, 1, 5, 3), (4, 30, 9, 34, 1, 0, 18, 2), (60, 11, 63, 18, -1, 0, 27, 3), (47, 31, 56, 34, -1, 0, 41, 2), (13, 36, 17, 39, 1, 0, 52, 3),
            (4, 30, 9, 34, 1, 0, 22, 2)]
# große Blüten (Rechteck um die Blüte, Startframe)
BLUETEN = [(53, 8, 57, 11, 2), (18, 10, 21, 13, 13), (26, 27, 29, 30, 24), (41, 21, 44, 24, 35), (38, 37, 41, 40, 46), (33, 3, 36, 6, 57)]
ROSA_H, ROSA_D, GELB, ORANGE = (237, 170, 222), (223, 104, 161), (252, 245, 102), (245, 178, 81)


def rascheln(a, i):
    """a = Sprite (Spritekoordinaten). Aktive Büschel 1 px nach innen rücken."""
    out = a
    for (x0, y0, x1, y1, dx, dy, start, dauer) in BUESCHEL:
        if (i - start) % N < dauer:
            out = out.copy()
            teil = out[y0:y1 + 1, x0:x1 + 1].copy()
            out[y0:y1 + 1, x0:x1 + 1] = 0
            ziel = out[y0 + dy:y1 + 1 + dy, x0 + dx:x1 + 1 + dx]
            m = teil[..., 3] > 0
            ziel[m] = teil[m]
    return out


def bluehen(a, i):
    out = a
    for (x0, y0, x1, y1, start) in BLUETEN:
        if (i - start) % N < 4:
            out = out.copy()
            reg = out[y0:y1 + 1, x0:x1 + 1]
            for alt, neu in ((ROSA_D, ROSA_H), (ORANGE, GELB)):
                reg[L.farbmaske(reg, [alt])] = neu + (255,)
    return out


def atem(i):
    return 1 if 12 <= i % N < 40 else 0


def frame(i, nur=None):
    a = bluehen(rascheln(spr, i), i)
    if 30 <= i <= 32:
        a = N7.farbtausch(a, sz.ist((41, 57, 197), (24, 41, 131)), {(41, 57, 197): RINDE, (24, 41, 131): RINDE})
    f = L.platz(a, sz.H, sz.W, sz.PL, sz.PT)
    if atem(i):
        f = TX.streck_zeile(f, sz.PT + 43, 1)
    if nur:
        return f
    return L.zusammen(sz.H, sz.W, [(f, 0, 0), (N7.blasen(sz.H, sz.W, i, N, BLAETTER, BLATT), 0, 0)])


if __name__ == '__main__':
    N7.fertig('plant-golem', 'Plant Golem', frame, N, MS, spr, check=[0, 8, 16, 31], zoom=6)
