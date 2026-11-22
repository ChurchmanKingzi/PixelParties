# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Shattered Trident“ (Creature).

PICK: [["MotiveGrailWar", 603, 1]]
Quelle: src/spirit-of-the-shattered-trident.png (32×31 px, 21 Farben) = Ebene 603 „Trident Spirit“, vollständig. Gegen die Kartenkunst abgeglichen (Baumstümpfe, Holzstapel, Lagerfeuer sind Szene).

Was ist was (x/y im Sprite):
* Kleine Gestalt in grauer Rüstung (x 10–25, y 12–30): petrolfarbenes Gesicht (x 14–21, y 12–17) mit winzigen Augen (schwarze Brauen (15, 14)/(16, 15) und (20, 14)/(19, 15); Augenweiß (16, 16) links, (20, 15–16) mit hellblauer Iris (19, 16) rechts; das linke Auge ist teils von der Energie überstrahlt), graue Brust-/Beinpanzer,
  petrolfarbene Stiefel (y 26–30).
* Rosa Energie (Magenta (226,71,227) → (253,81,254) → (247,165,254) → (249,192,254) → fast Weiß (251,216,254)): Blitzkrone aus dem Kopf (drei Zacken nach oben, x 12–23, y 0–13, seitliche Äste y 7–12),
  der Energie-Dreizack quer vor dem Körper (Schaft y 23, x 0–25, drei Zinken nach links y 21/23/25 mit Bögen y 19–20 und 26–27).
* Funkelsterne der Energie (Sparkles der Quelle): oben an der Mittelzacke (19, 2), links oben (9, 6), rechts oben (28, 9), groß links (6, 16) und rechts (29, 16), rechts unten (28, 23).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Energie pulsiert: alle 16 Frames läuft vom Körper aus ein Lichtring nach außen durch alle rosa Pixel (jedes Pixel im Ring eine Stufe heller auf der Rosa-Rampe der Quelle; Form der Blitze bleibt).
* Funkelsterne blitzen einzeln und versetzt: voll → klein → aus → klein → voll (Takte 24 bzw. 16 Frames; die drei kleinen Sterne ohne Zwischenschritt, damit keine Einzelpunkte entstehen) – sie bleiben an ihrem Platz.
* Blinzeln (Runde 8; Frames 10–12 und 34–36): Augenweiß und Iris → Petrol der Gesichtshaut, die Brauen bleiben.
* Atmen: Stiefelzeile 28 wird texturiert eingefügt (0–1 px, Periode 24): Körper, Dreizack und Blitzkrone heben sich starr gemeinsam, die Sohlen bleiben am Boden. Kopf nie seitlich.
Keine Ergänzungen nötig (Sterne stehen frei). Kein Metallglanz. Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('spirit-of-the-shattered-trident', pad=(2, 2, 3, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

ROSA = FIG.farbe((226, 71, 227), (253, 81, 254), (247, 165, 254), (249, 192, 254), (251, 216, 254))
M_ROSA = FIG.maske(ROSA)
DIST = np.hypot(xx - 18.5, yy - 17.0)

# Sterne: (innere Pixel, äußere Pixel, Takt, Versatz)
STERNE = [
    ([(18, 2), (20, 2), (19, 1), (19, 3)], [(17, 2), (21, 2), (19, 0)], 24, 0),
    ([(9, 6)], [(8, 5), (10, 5), (8, 7), (10, 7)], 16, 3),
    ([(28, 8), (27, 9), (29, 9), (28, 10)], [], 16, 14),
    ([(6, 15), (5, 16), (7, 16), (6, 17)], [(6, 14), (4, 16), (8, 16), (6, 18)], 24, 6),
    ([(29, 15), (28, 16), (30, 16), (29, 17)], [(29, 14), (27, 16), (31, 16), (29, 18)], 24, 22),
    ([(28, 22), (27, 23), (29, 23), (28, 24)], [], 16, 1),
]
for inn, aus, _, _ in STERNE:
    for p in inn + aus:
        assert M_ROSA[p[1], p[0]], p
TAKT = {24: [2] * 10 + [1] * 2 + [0] * 8 + [1] * 2 + [2] * 2, 16: [2] * 6 + [1] * 2 + [0] * 4 + [1] * 2 + [2] * 2}


HAUT = (FIG.f(17, 16), FIG.f(18, 16))
ZU = {(16, 16): HAUT[0], (20, 16): HAUT[0], (20, 15): HAUT[1], (19, 16): HAUT[1]}


def frame(i, nur=None):
    a = FIG.platz()
    if N2.fenster(i, N, 10, [1, 1, 1]) or N2.fenster(i, N, 34, [1, 1, 1]):
        N2.setze(a, OFF, ZU)
    # Lichtring
    p = (i % 16) / 16.0 * 27.0 - 3.0
    ring = M_ROSA & (DIST >= p) & (DIST < p + 3.0)
    for y, x in zip(*np.nonzero(ring)):
        N2.setze(a, OFF, {(int(x), int(y)): Hm.farbe_stufe(FIG.f(int(x), int(y)), ROSA, 1)})
    # Sterne
    for inn, aus, takt, off in STERNE:
        st = TAKT[takt][(i + off) % takt]
        if not aus or len(inn) < 4:                                    # kleine Sterne: kein Zwischenschritt (ergäbe Einzelpunkte) – nur voll oder aus
            st = 2 if st >= 1 else 0
        if st < 2:
            N2.loesche(a, OFF, aus)
        if st == 0:
            N2.loesche(a, OFF, inn)
    return TX.streck_zeile(a, FIG.pt + 28, N2.hub(i, 24, 1))


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Shattered Trident')
