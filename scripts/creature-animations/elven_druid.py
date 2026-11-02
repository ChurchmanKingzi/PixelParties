# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Druid“ (Creature) — der Druide mit Geweih-Schädelmaske, grüner Robe und dem Stab mit der leuchtenden grünen Kugel.

Quelle: src/elven-druid.png (26×35 px, 67 Farben).
PICK: [["MotiveGrailWar", 139, 1]]      (Ebene „Elven Druid“, 26×35 px, vollständig: Geweih, Maske, Gesicht, Robe, Stab mit Kugel; der Scan der Kartenkunst findet nur Büsche, deshalb direkt aus der Ebene genommen —
                                          Abgleich mit Elven_Druid.png: Figur und Stab stimmen überein, die Kunst legt Funkelsterne um die Kugel, die in der Ebene fehlen). Nicht verwendet: Büsche, Blumen, Lichtung der Kunst.
Aufruf:   python3 elven_druid.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-druid.png + .json

Was im Sprite ist (x, y im 26×35-Sprite):
* GEWEIH (x 1–25, y 0–9): zwei Reihen orange-brauner Geweihsprossen (170,87,17)/(134,61,6)/(80,36,1)/(234,135,42), sie gehen in die Maske über.
* MASKE (x 11–19, y 10–17): dunkelroter Schädel-/Hirschkopf-Helm (51,3,1)/(88,37,8)/(107,49,12) mit hellen Knochenpixeln (166,154,156)/(219,218,226) und schwarzen Augenhöhlen (0,2,0).
* GESICHT (x 11–16, y 18–21): zwei Augen mit stahlblauer Iris (86,106,128) über Weiß (246,255,255) bei (12,18–19) und (16,18–19), Nase/Brauen braun (123,94,61), Haut (213,164,98)/(246,189,123)/(255,213,164).
* ROBE/KÖRPER (x 9–21, y 20–33): grüne Robe (0,24,5)…(82,116,4), Schulterschal grau (43,45,42)/(150,146,143), hellblauer Gürtel (139,213,255)/(180,246,255) in y 26, Tabard unten (y 27–33) mit Knochenperlen
  (229,221,198)/(244,246,224), Händen links (7–8, 24–25) am Stab und rechts (19–21, 24–27).
* STAB (x 0–10 oben, x 5 unten, y 8–34): brauner Stab (97,67,39)/(25,14,12) mit einem Ring aus dunklem Holz um eine KUGEL (x 2–8, y 10–16): grüne Kugel in vier Stufen (61,191,95) < (87,201,114) < (102,215,133) < (127,236,171);
  sie gilt als Edelstein/Kristallkugel (Glanz erlaubt, Regel 14: wie die Funkelsterne der Kunst).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos; Ebenen: Stab+Hand (stehen fest, die Hand hält den Stab), Körper):
* Atmen (Periode 24, zweimal pro Schleife): die Brustzeile 22 des Körpers wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Geweih, Maske, Gesicht und Schultern steigen 1 px, Arme/Hände/Gürtel/Tabard bleiben (der Stab
  steht am Boden, die Hand hält ihn fest). Nur senkrecht.
* Kugel leuchtet (Regel 12, Edelstein): alle Kugelpixel steigen im Takt von 24 Frames eine Stufe auf der Grünrampe (heller), und der helle Kern (Facette) wandert 1 px im Kreis ((0,0) → (1,0) → (1,1) → (0,1) in Abschnitten zu 6 Frames).
* Funkelstern an der Kugel (Frames 6–9 und 30–33, Stufen Mitte → 1 px Arme → 2 px Arme → 1 px): vierzackiger Stern am oberen linken Ringrand der Kugel in Hellgrün (127,236,171)/(102,215,133)/(87,201,114) — bleibt AM Objekt.
* Blinzeln (Frames 14–16 und 38–40): die vier Augenpixel (blaugrau/weiß) nehmen die Hautfarbe (246,189,123) an.
Kein Geweih-/Stofffunkeln, keine Partikel. Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Stern liegt auf Ring-/Außenpixeln der Kugel in Quellfarben; nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 62
GP = 6

spr = L.lade('elven-druid')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


HAUT = (246, 189, 123)
KUGEL = [(61, 191, 95), (87, 201, 114), (102, 215, 133), (127, 236, 171)]
HOLZ = {(39, 25, 12), (58, 35, 21), (81, 55, 30), (97, 67, 39), (25, 14, 12)}
ring = L.farbmaske(spr, [(39, 25, 12), (58, 35, 21), (81, 55, 30)]) & (xx <= 10) & (yy >= 8) & (yy <= 17)
kugel = L.farbmaske(spr, KUGEL)
hand = np.zeros((sh, sw), bool)
for p in [(7, 24), (7, 25), (8, 25), (6, 24), (6, 25)]:
    hand[p[1], p[0]] = True
stab = (kugel | ring | ((xx <= 6) & (yy >= 18)) | hand) & vorhanden
koerper = vorhanden & ~stab
AUGEN = [(12, 18), (12, 19), (16, 18), (16, 19)]
orb_idx = np.full((sh, sw), -1, int)
for y in range(sh):
    for x in range(sw):
        if kugel[y, x]:
            orb_idx[y, x] = KUGEL.index(f(x, y))
STERN = {'kern': KUGEL[3], 'arm1': KUGEL[2], 'arm2': KUGEL[1]}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def kugel_farben(a, i):
    g = 1 if Hm.welle01(i, 24) > 0.5 else 0
    dx, dy = ((0, 0), (1, 0), (1, 1), (0, 1))[(i // 6) % 4] if g else (0, 0)
    ys, xs = np.nonzero(kugel)
    for y, x in zip(ys, xs):
        sx, sy = x - dx, y - dy
        k = orb_idx[sy, sx] if (0 <= sx < sw and 0 <= sy < sh and orb_idx[sy, sx] >= 0) else 0
        k = min(3, max(0, k + g))
        a[y + GP, x + GP, :3] = KUGEL[k]
    return a


def frame_gross(i, nur=None):
    k = teil(koerper)
    if Hm.folge(i, 14, [1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        k = L.streck_zeile(k, GP + 22, b)
    k = Hm.kontur_schliessen(k, ERLAUBT, (39, 25, 12))
    s = teil(stab)
    kugel_farben(s, i)
    st = Hm.folge(i, 6, [0, 1, 2, 1], N) if Hm.folge(i, 6, [0, 1, 2, 1], N) is not None else Hm.folge(i, 30, [0, 1, 2, 1], N)
    Hm.stern4(s, 1, 10, st, STERN['kern'], STERN['arm1'], STERN['arm2'], OFF)
    return L.zusammen(H, W, [(k, 0, 0), (s, 0, 0)])


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('elven-druid', 'Elven Druid', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-druid-strip.png', frames, spalten=12, scale=5)
