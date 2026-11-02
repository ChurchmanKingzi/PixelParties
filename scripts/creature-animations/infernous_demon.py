# -*- coding: utf-8 -*-
"""Idle-Animation für „Infernous Demon“ (Creature, Archetyp Cycling Demons — Element: Feuer/Glut).

Quelle: src/infernous-demon.png — Ebene „Infernal Demon“ (20×28 px, 313 Pixel, 19 Farben) aus Motive.xcf (Ebene 834, Figur 1; in der Kartenkunst 2:1 vergrößert). Die Ebenen 833/835 („Ebene #325/#324“) sind die Lava-Hintergründe der Karte
(Treffer, aber keine Figur) und werden nicht verwendet; die Figur ist vollständig.
PICK: [["Motive", 834, 1]]

Aufruf:   python3 infernous_demon.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/infernous-demon.png + .json

Was ist was (x/y im Sprite):
* Zwei große, nach innen gebogene Hörner (links x 0–8, y 0–10; rechts gespiegelt x 11–19): dunkelroter Umriss (50,6,0), Füllung (234,84,34)/(240,69,12)/(177,59,24)/(209,67,50). Sie sind Hörner und bleiben starr am Kopf (Regel: Fels/Horn glänzt nicht).
* Kopf (x 5–14, y 9–15): orangerotes Gesicht ((222,57,4)/(237,92,11)), dunkelrote Brauen (148,28,23) (7–8,10) (11–12,10), schwarze schräge Augenschlitze: links (6,12) (7,12) (8,13) (8,14), rechts (13,12) (12,12) (11,13) (11,14)
  (Farben (0,0,0) bzw. (65,12,0) an den Unterkanten); darunter ein dunkelroter Mund/Nasenbereich (58,12,7)/(105,4,1)/(123,17,9) (8–11,16–17).
* Arme: links (x 1–6, y 16–22) und rechts (x 13–18): dunkelrote Fäuste (137,7,19)/(104,20,20)… bei (2–3,17–18) bzw. (16–17,17–18), darunter orange Hände (245,131,49) bei (4–5,21) / (14–15,21).
* Rumpf (x 6–13, y 19–27): oranger Verlauf (237,92,11) → (232,103,43) → (245,131,49) nach unten, mit zwei Füßchen (y 26–27).
Fest bleiben: Hörner, Gesichtsform, Mund, Füße.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Funken ausgenommen):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 23 des Rumpfs wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Kopf samt Hörnern und beide Arme steigen, die Füße bleiben am Boden. Der Kopf folgt
  der Brust 2 Frames später (nie höher als die Brust, sinkt höchstens 1 px in die Schultern).
* Arme schwingen locker nach außen (je ≤ 1 px, gegengleich, Periode 24 bzw. 16) — Spaltenversatz wächst von der Schulter zur Faust.
* Blinzeln (Lid = Gesichtsfarben (222,57,4)/(237,92,11)): beide Augenschlitze Frame 9–11 und 33–35. Die Brauen bleiben.
* Glut: Funken (Regel 15: 1 px, runde Glutpunkte, steigen langsam auf, verglimmen am Ende) lösen sich von den Hornspitzen, den Schultern und aus der Luft neben dem Körper (hinter der Figur, 8 Stück, Lebensdauer 48 Frames, leichtes Wabern;
  Farben (245,131,49)/(232,103,43)/(240,69,12) aus dem Sprite). Kein Glanz/Glitzer (Regel 14), keine erfundene Flamme (der Sprite enthält keine).
ERGÄNZUNG: keine gemalten Pixel nötig. Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Funken höchstens 2 px darüber hinaus).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 8, 3

spr = L.lade('infernous-demon')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (50, 6, 0)
BRAUN = (222, 57, 4)
ORANGE = (237, 92, 11)
AUGEN_LID = {(6, 12): BRAUN, (7, 12): BRAUN, (12, 12): BRAUN, (13, 12): BRAUN, (8, 13): ORANGE, (11, 13): ORANGE, (8, 14): ORANGE, (11, 14): ORANGE}
assert all(col(x, y) in {(0, 0, 0), (65, 12, 0)} for (x, y) in AUGEN_LID)

kopf = vorhanden & (yy <= 15)
arm_l = vorhanden & (yy >= 16) & (yy <= 22) & (xx <= 5)
arm_r = vorhanden & (yy >= 16) & (yy <= 22) & (xx >= 14)
rumpf = vorhanden & (yy >= 16) & ~arm_l & ~arm_r
assert (kopf | arm_l | arm_r | rumpf).sum() == vorhanden.sum()

GLUT = {'c': (245, 131, 49), 'r': (232, 103, 43)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in GLUT.values())
P = lambda x, y: (GPL + x, GPT + y)
FUNKEN = [
    dict(x=P(7, 2)[0], y=P(7, 2)[1], vx=-1, vy=-5, off=0, form='k', wackeln=1),
    dict(x=P(12, 2)[0], y=P(12, 2)[1], vx=1, vy=-5, off=17, form='k', wackeln=1),
    dict(x=P(1, 9)[0], y=P(1, 9)[1], vx=-1, vy=-7, off=30, form='k', wackeln=1),
    dict(x=P(18, 9)[0], y=P(18, 9)[1], vx=1, vy=-7, off=9, form='k', wackeln=1),
    dict(x=P(4, 17)[0], y=P(4, 17)[1], vx=-1, vy=-8, off=24, form='k', wackeln=1),
    dict(x=P(15, 17)[0], y=P(15, 17)[1], vx=1, vy=-8, off=41, form='k', wackeln=1),
    dict(x=P(9, 3)[0], y=P(9, 3)[1], vx=0, vy=-4, off=36, form='k', wackeln=1),
    dict(x=P(10, 4)[0], y=P(10, 4)[1], vx=0, vy=-4, off=12, form='k', wackeln=1),
]

_OHNE_PARTIKEL = [False]


def glut(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_KOPF, T_AL, T_AR, T_RUMPF = (teil(m) for m in (kopf, arm_l, arm_r, rumpf))


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    n_kopf = max(min(n, U.stufe(i - 2, 24, 2)), n - 1)
    kp = T_KOPF.copy()
    if i in (9, 10, 11, 33, 34, 35):
        for (x, y), c in AUGEN_LID.items():
            kp[GPT + y, GPL + x, :3] = c
    rp = L.streck_zeile(T_RUMPF, GPT + 23, n)
    al = U.haengen(T_AL, GPT + 16, -1.0 * U.buckel(i, 0, 16, n=16), 1.0)
    ar = U.haengen(T_AR, GPT + 16, 1.0 * U.buckel(i, 0, 16, n=16), 1.0)
    f = L.zusammen(H, W, [(rp, 0, 0), (al, 0, -n), (ar, 0, -n), (kp, 0, -n_kopf)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    return L.zusammen(H, W, [(glut(H, W, i, N, FUNKEN, GLUT), 0, 0), (f, 0, 0)])


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('infernous-demon', 'Infernous Demon', frames, MS, prev)
    if prev:
        L.streifen(prev + '/infernous-demon-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=10)
