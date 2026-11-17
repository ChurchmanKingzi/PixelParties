# -*- coding: utf-8 -*-
"""Idle-Animation für „Trident Spirit - Hammer Absorbed“ (Creature).

PICK: [["MotiveGrailWar", 602, 2], ["MotiveGrailWar", 601, 1]]
Quelle: src/trident-spirit-hammer-absorbed.png (34×36 px, 29 Farben) = Ebene 602 „Trident Hammer Absorbed“, die LINKE Figur (Geist mit Blitzkrone und Hammerhose; die rechte Figur derselben Ebene ist der
Hammer-Geist und wurde für spirit-of-the-relic-hammer verwendet) + Ebene 601 „Ebene #375“ (der rosa Energie-Hammer, der in der xcf genau vor dieser Figur liegt: Kopf links, Stiel quer vor dem Körper).
Eine Kartenkunst liegt für diese Karte nicht im Repo (weder data/card-art/native noch public/cardgen/art) – Zuordnung über den Ebenennamen und die Schwesterkarte „Spirit of the Shattered Trident“ (Ebene 603).

Was ist was (x/y im Sprite):
* Gestalt (x 12–27, y 12–35): petrolfarbenes Gesicht (x 16–23, y 12–17) mit schwarzen Brauen (17,14)/(22,14), Pupillen (18,15)/(21,15), türkiser Iris (22,15), Augenweiß (18,16)/(22,16); graue Rüstung
  (y 18–24), orange-braune Hose des Hammer-Geists (y 25–32) und graue Stiefel (y 33–35) – die „absorbierten“ Hammerbeine.
* Rosa Energie (Magenta (226,71,227) → (253,81,254) → (247,165,254) → (249,192,254) → fast Weiß (251,216,254)): Blitzkrone aus dem Kopf (Zacken x 14–25, y 4–13, Seitenäste y 7–12 und senkrechte Äste
  x 12 und x 27, y 14–17), der Energie-HAMMER quer vor dem Körper (Doppelkopf x 4–12, y 18–28 mit hellem Kern (8,23); Stiel y 23, x 12–25).
* Funkelsterne der Energie (Sparkles der Quelle): oben (21,2), links oben (11,6), rechts oben (30,9), groß links (8,16) und rechts (31,16), links unten (1,21), rechts unten (30,23), unter dem Hammer (14,28).

Ablauf wie bei der Schwesterkarte (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Energie pulsiert: alle 16 Frames läuft vom Körper aus ein Lichtring nach außen durch alle rosa Pixel (im Ring eine Stufe heller auf der Rosa-Rampe der Quelle; die Form bleibt) – er läuft sichtbar durch den Hammerkopf.
* Funkelsterne blitzen einzeln und versetzt (voll → klein → aus → klein → voll; kleine Sterne nur voll/aus, keine Einzelpunkte); sie bleiben an ihrem Platz. Der Stern unter dem Hammer überdeckt zwei
  Umrisspixel der Hose ((15,27), (15,29)): ist er aus, steht dort der Hosenumriss (49,24,0) – einzige Ergänzung.
* Blinzeln (Frames 10–12 und 34–36): Augenweiß und Iris → Petrol der Gesichtshaut, Brauen/Pupillen bleiben.
* Atmen: Hosenzeile 30 wird texturiert eingefügt (0–1 px, Periode 24): Körper, Hammer und Blitzkrone heben sich starr gemeinsam, die Stiefel bleiben am Boden. Kopf nie seitlich. Der Hammer ist starr.
Kein Metallglanz (Energie, kein Metall). Nur ganze Pixel, nur Farben der Quelle.
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('trident-spirit-hammer-absorbed', pad=(2, 2, 3, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off

ROSA = FIG.farbe((226, 71, 227), (253, 81, 254), (247, 165, 254), (249, 192, 254), (251, 216, 254))
M_ROSA = FIG.maske(ROSA)
DIST = np.hypot(xx - 20.0, yy - 19.0)
UMRISS = FIG.f(15, 30)

# Sterne: (innere Pixel, äußere Pixel, Takt, Versatz)
STERNE = [
    ([(20, 2), (22, 2), (21, 1), (21, 3)], [(19, 2), (23, 2), (21, 0)], 24, 0),
    ([(11, 6)], [(10, 5), (12, 5), (10, 7), (12, 7)], 16, 3),
    ([(30, 8), (29, 9), (31, 9), (30, 10)], [], 16, 14),
    ([(8, 15), (7, 16), (9, 16), (8, 17)], [(8, 14), (6, 16), (10, 16)], 24, 6),
    ([(31, 15), (30, 16), (32, 16), (31, 17)], [(31, 14), (29, 16), (33, 16), (31, 18)], 24, 22),
    ([(1, 20), (0, 21), (2, 21), (1, 22)], [], 16, 5),
    ([(30, 22), (29, 23), (31, 23), (30, 24)], [], 16, 1),
    ([(14, 28)], [(13, 27), (15, 27), (13, 29), (15, 29)], 24, 8),
]
for inn, aus, _, _ in STERNE:
    for p in inn + aus:
        assert M_ROSA[p[1], p[0]], p
TAKT = {24: [2] * 10 + [1] * 2 + [0] * 8 + [1] * 2 + [2] * 2, 16: [2] * 6 + [1] * 2 + [0] * 4 + [1] * 2 + [2] * 2}
HOSENRAND = [(15, 27), (15, 29)]

ZU = {(18, 16): FIG.f(19, 16), (22, 16): FIG.f(23, 16), (22, 15): FIG.f(19, 15)}


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
            N2.loesche(a, OFF, [q for q in aus if q not in HOSENRAND])
            N2.setze(a, OFF, {q: UMRISS for q in aus if q in HOSENRAND})
        if st == 0:
            N2.loesche(a, OFF, inn)
    return TX.streck_zeile(a, FIG.pt + 30, N2.hub(i, 24, 1))


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Trident Spirit - Hammer Absorbed')
