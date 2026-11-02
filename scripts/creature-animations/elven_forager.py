# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Forager“ (Creature) — die silberhaarige Elfe im grünen Gewand, die neben der Beerenkiste Früchte sammelt (nur die Elfe, ohne Kiste und Beeren).

Quelle: src/elven-forager.png (12×19 px, 30 Farben) = Ausschnitt x 17–28, y 0–18 der Ebene „Elven Forager“ (38×26 px).
PICK: [["MotiveGrailWar", 33, 1]]      (Ebene „Elven Forager“, Figur 1 (38×26 px): Kiste mit Beeren (x 0–15), die Elfe (x 17–28, y 0–18) und sieben einzelne Beeren drumherum. Abgleich mit der Kartenkunst
                                          Elven_Forager.png: 100 % Pixeltreffer bei (17,16). Zum Sprite gehört nur die Elfe: Kiste, Beeren und das Beerenpixel (28–30,10–13) rechts an ihrem Arm sind Beiwerk und bleiben weg.)
Aufruf:   python3 elven_forager.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-forager.png + .json

Was im Sprite ist (x, y im 12×19-Sprite):
* HAAR (x 0–7, y 0–9 und die Strähne x 1–3, y 10–16): langes silbergrünes Haar in sieben Stufen (61,66,46) … (241,248,214), dunkelgrüner Umriss (61,66,46); eine lange Strähne hängt über den Rücken bis y 15, am Ende ein dunkelgrünes Pixel (16,32,0) bei (1,16).
* GESICHT (x 4–11, y 4–10), Dreiviertelansicht nach rechts: Haut (246,189,123)/(255,213,164)/(246,205,139)/(255,230,213), Brauen schwarz (0,0,0) bei (8,6),(9,6), EIN sichtbares Auge 2×2 bei (8,7),(9,7),(8,8),(9,8):
  hellblau (172,213,255) + dunkelrote Pupille (90,8,0) über Weiß (246,246,246) + Orange (189,57,0); das zweite Auge ist vom Haar verdeckt (nur Haut/Rost (238,156,123),(189,90,57) bei (5,6),(5,7)).
* GEWAND (x 3–10, y 10–17): dunkelgrüne Tunika (28,38,1)/(54,65,22)/(93,103,34)/(130,144,47) mit braunem Umriss (49,24,0), Arm/Hand rechts (x 8–10, y 12–13) in Hauttönen (230,172,106)/(189,90,57), Stiefel braun (90,32,0)/(148,65,24)/(230,131,82) (y 17).
Metall/Edelstein: nichts → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Atmen (Periode 24, zweimal pro Schleife): die Saumzeile 14 der Tunika wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf, Brust, Arm steigen 1 px, Saum und Stiefel bleiben am Boden. Nur senkrecht.
* Suchender Nicker (Frames 27–32, einmal pro Schleife): der Kopf senkt sich 1 px unter die Ruhelage (die Kinnzeile 10 wird einmal entfernt) und hebt sich wieder — die Elfe prüft die Beeren. Nur Heben/Senken.
* Blick (Frames 18–23 und 40–44): das sichtbare Auge tauscht Pupille und Iris mit Weiß/Orange (Blick nach links, zur Kamera): (8,7)/(9,7) und (8,8)/(9,8) vertauschen die Farben.
* Blinzeln (Frames 9–11 und 34–36): die vier Augenpixel nehmen die Hautfarbe (246,205,139) an (Lid), die Brauen bleiben.
* Haarsträhne weht (Frames 2–11 und 26–35; Welle von unten nach oben, je Stufe 2 Frames): die unteren Zeilen der Strähne (y 15, dann 14–15, dann 13–15) schlagen 1 px nach links aus (Zeilen x 1–3 → 0–2, das rechte Umrisspixel
  (3,y) bleibt als zweiter Umriss stehen, damit die Kontur zur Tunika geschlossen bleibt) und kehren zurück.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Flächen (Strähne: nur Umordnen vorhandener Pixel in Quellfarben).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 62
GP = 6

spr = L.lade('elven-forager')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


HELLBLAU, PUPILLE, WEISS, ORANGE = (172, 213, 255), (90, 8, 0), (246, 246, 246), (189, 57, 0)
assert (f(8, 7), f(9, 7), f(8, 8), f(9, 8)) == (HELLBLAU, PUPILLE, WEISS, ORANGE)
LID = (246, 205, 139)
AUGE_ZU = {(8, 7): LID, (9, 7): LID, (8, 8): LID, (9, 8): LID}
BLICK_LINKS = {(8, 7): PUPILLE, (9, 7): HELLBLAU, (8, 8): ORANGE, (9, 8): WEISS}
HAAR_UMRISS = f(1, 10)
assert HAAR_UMRISS == (61, 66, 46) and f(3, 13) == HAAR_UMRISS


def straehne(zeilen):
    """Strähne der Zeilen y (13–15) um 1 px nach links: Umriss (0,y), Haar (1,y), Umriss (2,y); (3,y) bleibt Umriss."""
    px = {}
    for y in zeilen:
        px[(0, y)] = HAAR_UMRISS
        px[(1, y)] = f(2, y)
        px[(2, y)] = HAAR_UMRISS
    return px


STRAEHNE_FOLGE = [(15,), (15,), (14, 15), (14, 15), (13, 14, 15), (13, 14, 15), (14, 15), (14, 15), (15,), (15,)]


def frame_gross(i, nur=None):
    t, _ = L.trenne(spr, L.deckend(spr))
    k = L.platz(t, H, W, GP, GP)
    # --- Strähne weht, Blick, Blinzeln (vor den Zeilenoperationen) ---
    for start in (2, 26):
        z = Hm.folge(i, start, STRAEHNE_FOLGE, N)
        if z:
            Hm.setze(k, straehne(z), OFF)
    if Hm.folge(i, 18, [1] * 6, N) or Hm.folge(i, 40, [1] * 5, N):
        Hm.setze(k, BLICK_LINKS, OFF)
    if Hm.folge(i, 9, [1, 1, 1], N) or Hm.folge(i, 34, [1, 1, 1], N):
        Hm.setze(k, AUGE_ZU, OFF)
    # --- Nicker (Kinnzeile 10 entfällt) und Atmen (Saumzeile 14 doppelt) ---
    if Hm.folge(i, 27, [1] * 6, N):
        k = L.streck_zeile(k, GP + 10, -1)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        k = L.streck_zeile(k, GP + 14, b)
    return Hm.kontur_schliessen(k, ERLAUBT, UMRISS)


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
    L.speichern('elven-forager', 'Elven Forager', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-forager-strip.png', frames, spalten=12, scale=8)
