# -*- coding: utf-8 -*-
"""Idle-Animation für „Leafagami Snake“ (Creature) — eine eingerollte Schlange aus gefalteten Blättern (dunkler Schlangenleib, daran grüne, gelbe, orange und rote Blätter).

Quelle: src/leafagami-snake.png (45×45 px, 20 Farben; vorbereitet).
PICK: [["Motive", 771, 1]] (Ebene „Leafagami Snake“) + die Blatt-/Leib-Nachbarebenen (in src/ bereits zusammengesetzt). Abgleich mit Leafagami_Snake.png: Lage aller Blätter und des Leibs identisch;
das grüne Moos und der blaue Fleck der Kunst sind Kulisse.

Was im Sprite ist (x, y):
* SCHLANGENLEIB dunkelgrau (51,51,51)/(26,26,26)/(77,77,77)/schwarz: unterer Bogen (x 8–33, y 28–43) und eine obere Windung (x 13–23, y 13–21); Schwanzende/Stiel (68,58,28) bei (27–28, 43–44).
* GELBES BLATT (x 13–25, y 0–17; (249,212,102)/(190,162,78)/(116,99,48), Umriss (68,58,28)): steht mit der Spitze nach oben (Kopf-/Haubenblatt).
* GRÜNES BLATT (x 0–21, y 10–27; (61,79,4)/(118,153,8)/(139,181,10)/(196,255,14)): groß, Spitze links oben, mit Blattadern.
* ORANGE BLÄTTER: eines rechts der Windung (x 20–33, y 17–25, Spitze rechts), eines am Schwanz (x 30–44, y 25–38, Spitzen oben (34,25) und rechts (44,32)); (79,53,30)/(148,99,57)/(199,133,76)/(251,168,96).
* ROTE BLÄTTER: links unten (x 0–11, y 22–33) und in der Mitte (x 15–28, y 27–35, Spitze rechts); (96,29,29)/(130,39,39)/(181,55,55)/(232,70,70).
Kein Gesicht/keine Augen sichtbar → nichts blinzelt.

Ablauf (60 Frames à 75 ms = 4,5 s, nahtlos, Frame 0 = Original):
* BLÄTTER RASCHELN (Idle-Idee: ein Zittern läuft durch die Blattschlange): jedes Blatt wippt mit seiner SPITZE um den Ansatz am Leib (Blätter sind biegsam; Spalten- bzw. Zeilenversatz ≤ 1 px Gefälle,
  nur an freien Kanten, damit nirgends Hintergrund in der Figur aufreißt): gelbes Blatt seitlich ±1 px (Periode 20), grünes Blatt senkt die Spitze bis 2 px (Periode 30, liegt dabei vor dem roten Blatt),
  oranges Blatt rechts ±1 px (Periode 15), rotes Mittelblatt ±1 px (Periode 20, gegenläufig), Schwanzblatt: rechte Spitze ±1 px senkrecht (Periode 12; die obere Spitze bleibt fest – ein seitlicher Versatz riss dort den Umriss auf).
* SCHWANZENDE zuckt: die unterste Zeile des Stiels (y 44) springt zweimal je Schleife kurz 1 px zur Seite.
Der Leib selbst bleibt ruhig (eingerollt, keine Streckung). Keine Partikel, kein Glanz. Ergänzungen: keine. Farben: nur Quelle.
"""
import math

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_n1 as N1

N, MS = 60, 75
spr = L.lade('leafagami-snake')
S = N1.Szene(spr, (4, 4, 4, 4))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
xx, yy = S.xx, S.yy
GRUEN = L.farbmaske(spr, [(61, 79, 4), (118, 153, 8), (139, 181, 10), (196, 255, 14)])
GELB = L.farbmaske(spr, [(68, 58, 28), (116, 99, 48), (190, 162, 78), (249, 212, 102)])
ORANGE = L.farbmaske(spr, [(79, 53, 30), (148, 99, 57), (199, 133, 76), (251, 168, 96)])
ROT = L.farbmaske(spr, [(96, 29, 29), (130, 39, 39), (181, 55, 55), (232, 70, 70)])
M_GELB = GELB & (yy <= 5)
M_GRUEN = GRUEN & (xx <= 12)
M_OR1 = ORANGE & (xx >= 27) & (xx <= 33) & (yy <= 25)
M_ROT = ROT & (xx >= 24) & (yy >= 27)
M_OR2R = ORANGE & (xx >= 39) & (yy >= 26)
M_OR2O = ORANGE & (xx >= 31) & (yy >= 25) & (yy <= 28)
M_STIEL = S.da & (yy == 44)
BASIS = S.da & ~(M_GELB | M_GRUEN | M_OR1 | M_ROT | M_OR2R | M_OR2O | M_STIEL)
E = {k: S.ebene(m) for k, m in dict(basis=BASIS, gelb=M_GELB, gruen=M_GRUEN, or1=M_OR1, rot=M_ROT, or2r=M_OR2R, or2o=M_OR2O, stiel=M_STIEL).items()}
UMRISS_VON = {}
for fam in ([(61, 79, 4), (118, 153, 8), (139, 181, 10), (196, 255, 14)], [(68, 58, 28), (116, 99, 48), (190, 162, 78), (249, 212, 102)],
            [(79, 53, 30), (148, 99, 57), (199, 133, 76), (251, 168, 96)], [(96, 29, 29), (130, 39, 39), (181, 55, 55), (232, 70, 70)]):
    for c in fam[1:]:
        UMRISS_VON[c] = fam[0]
assert not any(tuple(int(v) for v in spr[y, x, :3]) in UMRISS_VON for y, x in zip(*np.nonzero(Hm.kantenmaske(spr)))), 'Original hat helle Randpixel'
TEST_EBENEN = 'koerper'


def r(v):
    return int(math.floor(v + 0.5))


def frame(i, nur=None):
    vg = r(math.sin(L.sinus(i, 20)))
    gelb = L.versetze(E['gelb'], vg, 0)
    vq = r(1 - math.cos(L.sinus(i, 30)))                                  # 0…2
    gruen = N1.spalten_dy(E['gruen'], lambda x: r(vq * min(1.0, max(0, 12 - (x - PL)) / 9.0)))
    vo = r(math.sin(L.sinus(i, 15)))
    or1 = N1.spalten_dy(E['or1'], lambda x: vo if x - PL >= 30 else 0)
    vr = -r(math.sin(L.sinus(i, 20)))
    rot = N1.spalten_dy(E['rot'], lambda x: vr if x - PL >= 26 else 0)
    vs = r(math.sin(L.sinus(i, 12)))
    or2r = N1.spalten_dy(E['or2r'], lambda x: vs if x - PL >= 41 else 0)
    st = L.versetze(E['stiel'], 1 if (i % 30) in (20, 21, 24, 25) else 0, 0)
    f = L.zusammen(H, W, [(E['basis'], 0, 0), (rot, 0, 0), (gelb, 0, 0), (or1, 0, 0), (or2r, 0, 0), (E['or2o'], 0, 0), (st, 0, 0), (gruen, 0, 0)])
    # Kontur schließen: wird an einer Versatzstufe ein Innenpixel zur Außenkante, bekommt es die Umrissfarbe SEINES Blatts (Umriss bleibt 1 px)
    for y, x in zip(*np.nonzero(Hm.kantenmaske(f))):
        c = tuple(int(v) for v in f[y, x, :3])
        if c in UMRISS_VON:
            f[y, x, :3] = UMRISS_VON[c]
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('leafagami-snake', 'Leafagami Snake', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
