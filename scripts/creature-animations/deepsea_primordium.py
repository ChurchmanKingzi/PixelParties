# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Primordium“ (Creature).

Quelle: src/deepsea-primordium.png — Ebene „Ebene #189“ (42×14 px, 453 Pixel, 6 Farben, alle deckend) aus MotiveDeepsea.xcf (Ebene 312; in der Kartenkunst blau getönt, vom Treffer-Suchlauf als einziger Treffer „in 1 Karte“ geführt,
Kandidat 15). Die Ebene „Primordium“ (317) ist pixelgleich; „Primordium-Kopie“ (316, ohne Zähne, schwarze statt roter Pixel) gehört zur Karte „Tamed Primordium“. Gegen die Kartenkunst abgeglichen
(data/card-art/native/Deepsea_Primordium.png): gleiche Form, Zähne und Augenquadrate.
PICK: [["MotiveDeepsea", 312, 1]]

Aufruf:   python3 deepsea_primordium.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-primordium.png + .json

Was ist was (x/y im Sprite, 42×14):
* Ein flaches, am Boden liegendes Urwesen aus drei Buckeln in Teal-Schachbrett (51,93,119)/(77,137,154) mit Umriss (30,48,81): linker Buckel (x 1–11, y 1–10), mittlerer Buckel (x 12–27, y 0–11), rechter Buckel (x 28–41, y 0–12)
  mit einem dünnen Schwanz nach oben (x 35–41, y 0–6).
* VIER weiße 2×2-Quadrate (255,255,255) = Augen (Regel 21: keine Pupillen/Tränen): (16–17, 4–5), (5–6, 6–7), (32–33, 7–8), (24–25, 10–11).
* DREI Zahnreihen (Schachbrett aus Weiß (255,255,255) und Dunkelrot (59,0,0)): ein waagerechter Mund (x 11–16, y 9–10), ein senkrechter (x 28–29, y 7–11) und eine dünne Zahnreihe am Schwanz (x 39, y 3–8).
* Darunter ein flacher dunkler Bodenschatten (13,16,49) (x 0–4 bei y 10, x 5–18 bei y 11, x 18–20 bei y 12, x 21–33 bei y 13, x 32–36 bei y 12) — er bleibt fest.
Fest bleiben: Zahnform, Bodenschatten, die Form im Kern.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Raupen-Kriechwelle: die drei Buckel heben sich nacheinander (links → Mitte → rechts versetzt, je 10 Frames, zweimal pro Schleife). Linker Buckel (Zeile 8) und mittlerer Buckel (Zeile 7) heben sich um 1 px durch eine eingefügte, texturgemischte
  Zeile (`L.streck_zeile` auf der Teilmaske; ihre Unterkanten bleiben am Boden), der rechte Buckel hebt sich starr um 1 px (an seinen Zahnreihen darf keine Zeile eingefügt werden).
* Schwanzspitze (Zeilen 0–5, x ≥ 35) neigt sich waagerecht (≤ 2 px, Periode 16, Spitze am weitesten, Gruppen 0–1 / 2–3 / 4–5).
* Blinzeln der vier Augen nacheinander (Lid = Körperkaro (51,93,119)/(77,137,154), 3 Frames je Auge): links Frame 6, Mitte oben Frame 18, rechts Frame 30, Mitte unten Frame 40.
* Zähne klappern: die drei Zahnreihen vertauschen Weiß ↔ Dunkelrot (das Schachbrett kippt), waagerechter Mund bei Frame 10–11 und 34–35, senkrechter bei 22–23 und 44–45, Schwanzzähne bei 14–15 und 38–39.
* Eine Blase steigt links oben neben dem linken Buckel auf (`U.wolke_ebene`, Kern (77,137,154), Rand (51,93,119)).
Kein Glanz, kein Feuer. Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose.
Ergänzungen: keine gemalten Pixel außer Lidern im Körperkaro und Umrisspixeln an bewegten Kanten.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Blase höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-primordium')
S = T.Szene('deepsea-primordium', 'Deepsea Primordium', spr, N, MS, rand=(6, 6, 6, 5))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
col = S.col
SCHATTEN, KONTUR = (13, 16, 49), (30, 48, 81)
WEISS, ROT = (255, 255, 255), (59, 0, 0)
HELL, DUNKEL = (77, 137, 154), (51, 93, 119)

schatten = vorhanden & (spr[..., :3] == SCHATTEN).all(-1)
koerper = vorhanden & ~schatten
AUGEN = {'links': [(5, 6), (6, 6), (5, 7), (6, 7)], 'mitte_o': [(16, 4), (17, 4), (16, 5), (17, 5)],
         'rechts': [(32, 7), (33, 7), (32, 8), (33, 8)], 'mitte_u': [(24, 10), (25, 10), (24, 11), (25, 11)]}
for pts in AUGEN.values():
    assert all(col(x, y) == WEISS for x, y in pts)
ZAEHNE = {'mund': [(x, y) for y in (9, 10) for x in range(11, 17)], 'senkr': [(x, y) for y in range(7, 12) for x in (28, 29)],
          'schwanz': [(39, y) for y in range(3, 9)]}
for pts in ZAEHNE.values():
    assert all(col(x, y) in (WEISS, ROT) for x, y in pts), pts
LI, MI, RE = koerper & (xx <= 11), koerper & (xx >= 12) & (xx <= 27), koerper & (xx >= 28)
assert (LI | MI | RE).sum() == koerper.sum()
TAIL = RE & (xx >= 35) & (yy <= 5)
RE_REST = RE & ~TAIL
SCH_A, LI_A, MI_A, RE_A, TAIL_A = (S.teil(m) for m in (schatten, LI, MI, RE_REST, TAIL))
BLINK = {'links': 6, 'mitte_o': 18, 'rechts': 30, 'mitte_u': 40}
KLAPP = {'mund': (10, 34), 'senkr': (22, 44), 'schwanz': (14, 38)}
WELLEN = {'li': (14, 38), 'mi': (2, 26), 're': (8, 32)}                  # Start der zwei Hebe-Fenster je Buckel (je 10 Frames, enden vor Frame 48)


def hebt(i, starts):
    return 1 if any(0 <= i - s < 10 for s in starts) else 0


def haut(x, y):
    return HELL if (x + y) % 2 == 0 else DUNKEL


# Parität des Körperkaros aus dem Sprite prüfen
_c = [(x, y) for y in range(sh) for x in range(sw) if koerper[y, x] and col(x, y) in (HELL, DUNKEL)]
_gleich = sum(1 for (x, y) in _c if col(x, y) == haut(x, y))
if _gleich < len(_c) / 2:
    def haut(x, y):
        return DUNKEL if (x + y) % 2 == 0 else HELL


def setze(a, pts, farbe_fn):
    for (x, y) in pts:
        a[GPT + y, GPL + x, :3] = farbe_fn(x, y)
    return a


def frame_gross(i, nur=None):
    parts = []
    # Augen blinzeln / Zähne klappern auf dem jeweiligen Buckel
    layers = {'li': LI_A.copy(), 'mi': MI_A.copy(), 're': RE_A.copy(), 'tail': TAIL_A.copy()}
    ziel = {'links': 'li', 'mitte_o': 'mi', 'rechts': 're', 'mitte_u': 'mi'}
    for k, pts in AUGEN.items():
        if 0 <= i - BLINK[k] < 3:
            setze(layers[ziel[k]], pts, haut)
    for k, pts in ZAEHNE.items():
        if any(0 <= i - s < 2 for s in KLAPP[k]):
            for (x, y) in pts:
                lz = (layers['tail'] if y <= 5 else layers['re']) if k == 'schwanz' else (layers['mi'] if k == 'mund' else layers['re'])
                c = tuple(int(v) for v in lz[GPT + y, GPL + x, :3])
                lz[GPT + y, GPL + x, :3] = ROT if c == WEISS else WEISS
    li, mi = layers['li'], layers['mi']
    if hebt(i, WELLEN['li']):
        li = TX.streck_zeile(li, GPT + 8, 1)
    if hebt(i, WELLEN['mi']):
        mi = TX.streck_zeile(mi, GPT + 7, 1)
    dre = -hebt(i, WELLEN['re'])
    # Schwanzspitze neigt sich
    s = T.sinz(i, 16)
    tail = T.gruppen_scher(layers['tail'], [(GPT + 0, GPT + 1), (GPT + 2, GPT + 3), (GPT + 4, GPT + 5)], [int(round(2.0 * s)), int(round(1.0 * s)), 0])
    f = L.zusammen(H, W, [(SCH_A, 0, 0), (li, 0, 0), (mi, 0, 0), (layers['re'], 0, dre), (tail, 0, dre)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    blase = U.wolke_ebene(H, W, i, 48, [dict(x=P(1, 7)[0], y=P(1, 7)[1], vx=0, vy=-6, off=0, wackeln=0.5)],
                          {'c': HELL, 'r': DUNKEL})
    return L.zusammen(H, W, [(blase, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21], scale=12)
