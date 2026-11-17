# -*- coding: utf-8 -*-
"""Idle-Animation für „Invader from the Cosmic Depths“ (Creature) — großes Raumschiff mit grüner Glaskuppel und vier grünen Leuchtkugeln; schwebt langsam, die Leuchten laufen reihum.

PICK: [["MotiveBoons", 25, "Ebene „Ebene #35“ (82×45 px, ganze Ebene, ein einzelnes Schiff)"]]
Abgleich mit data/card-art/native/Invader_from_the_Cosmic_Depths.png (dasselbe Schiff formatfüllend über Meer und Strand). Quelle vollständig, Alpha 0/255.
Ebene 26 (#33, 50 % Deckkraft) ist der Schatten des Schiffs auf dem Boden (Szene) – nicht übernommen.

Identifikation (82×45): große grüne Kuppel (x 24–56, y 0–29; dunkler Rand blau-grün, heller Glanzbogen rechts oben (x 38–50, y 3–20)), rosa/violetter Metallrahmen mit zwei
geschwungenen Bügeln nach außen (y 1–12), seitliche Flossen (x 0–9 und 72–81, y 12–23), vier kleine grüne Leuchtkugeln mit Glanzpunkt: links (x 9–18, y 11–21),
rechts (x 63–72, y 11–21), unten links (x 24–34, y 33–43), unten rechts (x 47–57, y 33–43); mittlerer Ausleger unten (x 37–44, y 33–44).

Ablauf (64 Frames à 80 ms = 5,1 s; riesig = langsam). Frame 0 = Original:
* Schweben: das ganze Schiff hebt und senkt sich als starre Einheit um ±1 px (eine Runde je Schleife) – es fliegt, nichts wird verformt.
* Lauflicht (Periode 32): die vier Leuchtkugeln leuchten nacheinander je 5 Frames eine Helligkeitsstufe heller auf (links → unten links → unten rechts → rechts),
  nur mit den Grüntönen der Kugeln.
* Kuppelglanz (Frames 44–55): ein schmales diagonales Lichtband (parallel zum gemalten Glanzbogen) wandert einmal über das Kuppelglas (eine Stufe heller auf der Grünrampe der Kuppel).
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_n9 as N9

SLUG = 'invader-from-the-cosmic-depths'
N, MS = 64, 80
sz = N9.Szene(SLUG, (2, 2, 4, 4))
spr = sz.spr
xx, yy = sz.xx, sz.yy
E_, D_, C_, G_, I_ = (11, 65, 77), (4, 90, 53), (3, 136, 0), (18, 178, 92), (137, 243, 181)
HELLER = {D_: C_, C_: G_, G_: I_}
KUGELN = [(xx >= 9) & (xx <= 18) & (yy >= 11) & (yy <= 21), (xx >= 24) & (xx <= 34) & (yy >= 33) & (yy <= 43),
          (xx >= 47) & (xx <= 57) & (yy >= 33) & (yy <= 43), (xx >= 63) & (xx <= 72) & (yy >= 11) & (yy <= 21)]
KUPPEL = (xx >= 24) & (xx <= 56) & (yy <= 29)
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    a = spr.copy()
    j = i % 32
    for k, m in enumerate(KUGELN):
        if k * 8 + 1 <= j < k * 8 + 6:
            a = N9.farbtausch(a, m, HELLER)
    if 44 <= i <= 55:
        s = -6 + (i - 44) * 5.5
        band = KUPPEL & (np.abs(xx - yy - s) < 2.5)
        a = N9.farbtausch(a, band, {E_: D_, D_: C_, C_: G_})
    dy = N9.sinus_px(i, N, 1.4)
    return L.platz(a, sz.H, sz.W, sz.PL, sz.PT + dy)


if __name__ == '__main__':
    N9.fertig(SLUG, 'Invader from the Cosmic Depths', frame, N, MS, spr, check=[0, 3, 11, 19, 27, 48, 52], zoom=4, )
