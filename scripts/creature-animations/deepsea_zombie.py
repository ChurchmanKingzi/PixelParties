# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Zombie“ (Creature).

Quelle: src/deepsea-zombie.png — Ebene „Zombie“ (16×23 px, 247 Pixel, 5 Farben, alle deckend) aus MotiveDeepsea.xcf (Ebene 322; in der Kartenkunst blau getönt, deshalb vom Treffer-Suchlauf nicht
als Figur geführt; ich habe sie direkt aus dem Dump genommen und gegen die Kunst abgeglichen: gleiche Form, Position und Größe).
PICK: [["MotiveDeepsea", 322, 1]]

Aufruf:   python3 deepsea_zombie.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-zombie.png + .json

Was ist was (x/y im Sprite):
* Ein aufrecht treibender Zombie in SCHACHBRETT-GERASTERTEM Teal (51,93,119)/(77,137,154) mit dunkelblauem Umriss und Dunkelpixeln (13,16,49): Kopf mit stacheligem Schopf (y 0–6), zwei große
  weiße Augen (255,255,255), je 2×2 bei (5–6, 7–8) und (9–10, 7–8), ein dunkler offener Mund (2×3 Pixel, (7–8, 10–12)), Rumpf mit hängenden Armen (x 1–14, y 9–18), zwei Beine/Füße (x 1–5 und 9–14, y 19–22).
* Das Schachbrettmuster ist die Haut/Textur; es bleibt erhalten.
Fest bleiben: Kopfform, Augengröße, Mundform im Ruhebild, Schachbrettmuster innerhalb jeder Zeile.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Blasen ausgenommen):
* Schlurfendes Wiegen: der Körper pendelt um die Füße (Zeilenversatz in Gruppen, wächst linear mit dem Abstand zu den Füßen, Kopf bis ±2 px, Zeile 0–2 gleich — der Scheitel bleibt rund, Augen und Mund werden nicht verscheert;
  Periode 24, zweimal pro Schleife; die Füße y ≥ 19 stehen), dazu treibt die ganze Figur langsam ±1 px senkrecht (Periode 16, dreimal pro Schleife).
* Blinzeln (Lid = Hautmuster): die weißen Augenpixel werden 3 Frames lang zu Teal im Schachbrettmuster ((51,93,119)/(77,137,154), passend zur Umgebung), zweimal pro Schleife (Frame 13–15 und 37–39).
* Stöhnen: der dunkle Mund schließt sich halb und ganz (Zeile y 12, dann y 11–12 werden Haut im Schachbrettmuster), dreimal pro Schleife (Frame 6–9, 22–25, 38–41, je 4 Frames).
* Füße wippen im Wechsel (je 3 Frames 1 px hoch, Periode 16: linker Fuß Frame 3–5, rechter Frame 11–13).
* Blasen (Partikel, hinter der Figur, 5 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern): runde Teal-Blasen, die 2×2 → 3×3 → 2×2 wachsen und schrumpfen (nie ein einzelner Punkt),
  Kern (77,137,154), Rand (51,93,119); `U.wolke_ebene`.
Kein Glanz (Regel 14: Fleisch/Haut), kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (13,16,49)) in jeder Pose; im Ruhebild nichts. ERGÄNZUNG: keine gemalten
Pixel außer dem passenden Schachbrett-Hautmuster in den Lidern/der Mundzuklappung (Farben der Quelle).
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Blasen vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen
Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-zombie')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
B_, C_, W_ = (51, 93, 119), (77, 137, 154), (255, 255, 255)
assert KONTUR in UMRISS

AUGEN = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and col(x, y) == W_]
assert len(AUGEN) == 8
MUND = [(7, 10), (8, 10), (7, 11), (8, 11), (7, 12), (8, 12)]
assert all(col(x, y) == KONTUR for (x, y) in MUND)
haut = lambda x, y: B_ if (x + y) % 2 else C_                      # Schachbrett der Umgebung
BLINZ = {13, 14, 15, 37, 38, 39}
MUNDZU = {}
for s0 in (6, 22, 38):
    for k, st in enumerate((1, 2, 2, 1)):
        MUNDZU[s0 + k] = st

fuss_l = vorhanden & (xx <= 5) & (yy >= 19)
fuss_r = vorhanden & (xx >= 9) & (yy >= 19)
rest = vorhanden & ~fuss_l & ~fuss_r

BLASE = {'c': C_, 'r': B_}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(0, 16)[0], y=P(0, 16)[1], vx=-1, vy=-9, off=0, wackeln=0.5),
    dict(x=P(15, 14)[0], y=P(15, 14)[1], vx=1, vy=-9, off=19, wackeln=0.5),
    dict(x=P(0, 6)[0], y=P(0, 6)[1], vx=-1, vy=-5, off=33, wackeln=0.5),
    dict(x=P(15, 5)[0], y=P(15, 5)[1], vx=1, vy=-6, off=11, wackeln=0.5),
    dict(x=P(8, 1)[0], y=P(8, 1)[1], vx=0, vy=-3, off=40, wackeln=0.5),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


GRUPPEN = [(0, 2), (3, 4), (5, 6), (7, 8), (9, 12), (13, 14), (15, 16), (17, 18)]      # Zeilengruppen mit gleichem Versatz: Augen (7–8) und Mund (9–12) werden nicht verscheert, die Schopfspitzen (0) bleiben an Zeile 1


def wiegen(a, aus):
    """Wiegen um die Füße (Zeile y 19): der Versatz wächst linear mit dem Abstand der Zeilengruppe zu den Füßen; die Zeilen einer Gruppe verschieben sich gleich (Augen/Mund bleiben unverschert)."""
    out = L.leer(*a.shape[:2])
    for (y0, y1) in GRUPPEN:
        dx = int(round(aus * (19 - (y0 + y1) / 2.0) / 18.0))
        for y in range(y0, y1 + 1):
            gy = GPT + y
            for x in np.nonzero(a[gy, :, 3])[0]:
                out[gy, x + dx] = a[gy, x]
    for y in range(19, sh):                                       # Zeilen y ≥ 19 (Füße-Ansatz) stehen
        out[GPT + y] = a[GPT + y]
    return out


def frame_gross(i, nur=None):
    aus = 1.6 * math.sin(2 * math.pi * i / 24)                    # Wiegen (0 bei Frame 0)
    drift = int(round(1.0 * math.sin(2 * math.pi * i / 16)))      # senkrecht ±1
    kb = teil(rest)
    if i in BLINZ:
        for (x, y) in AUGEN:
            c = haut(x, y)
            kb[GPT + y, GPL + x, :3] = c
    st = MUNDZU.get(i, 0)
    if st:
        for (x, y) in MUND:
            if y >= 12 - (st - 1):
                kb[GPT + y, GPL + x, :3] = haut(x, y)
    # Wiegen um die Füße: Zeilenversatz wächst mit dem Abstand zu Zeile y 19 (nur Rumpf/Kopf; die Füße y ≥ 19 stehen)
    kb = wiegen(kb, aus)
    bl = 1 if (i % 16) in (3, 4, 5) else 0
    br = 1 if (i % 16) in (11, 12, 13) else 0
    koerper = L.zusammen(H, W, [(teil(fuss_l), 0, -bl), (teil(fuss_r), 0, -br), (kb, 0, 0)])
    koerper = L.versetze(koerper, 0, drift) if drift else koerper
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    blasen = _glut(H, W, i, N, PUFFS, BLASE)
    return L.zusammen(H, W, [(blasen, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Blasen dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('deepsea-zombie', 'Deepsea Zombie', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-zombie-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
