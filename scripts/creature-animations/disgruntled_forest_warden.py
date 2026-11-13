# -*- coding: utf-8 -*-
"""Idle-Animation für „Disgruntled Forest Warden“ (Creature) — der mürrische, bärtige Waldwächter in brauner Weste und grünen Hosen vor der Tür seiner Hütte (nur der Mann, ohne Tür und Axt).

Quelle: src/disgruntled-forest-warden.png (20×26 px, 23 Farben), zusammengesetzt aus zwei Ebenen derselben Datei.
PICK: [["MotiveGrailWar", 592, 1], ["MotiveGrailWar", 595, 1]]      (Ebene 592 „#48“ (13×18 px) = Haar und Bart mit den Augen, liegt in der Kunst über dem Kopf; Ebene 595 „Forest Warden“ (20×39 px) = der Körper mit kahlem Kopf und der Tür dahinter:
  nur ihre Zeilen ≥ 24 (Weste, Arme, Hose, Stiefel) und die vom Bart eingeschlossenen Gesichtspixel (Nase/Wange, 9 px) gehören zur Figur; die Tür (Zeilen < 24 und die dunklen Türpixel (63,31,15) bei (16–17,24)) ist Hintergrund und bleibt weg.
  Lage: Bart bei (4,13) der Körperebene; die Kartenkunst Disgruntled_Forest_Warden.png zeigt genau diese Kombination (Bart 95 % Treffer). NICHT in der Quelle: die Axt auf dem Hackklotz rechts in der Kunst — kein sauberes Ebenenbild (die Ebene 591 „Controlled Attack“ zeigt nur
  eine verwischte, andersherum gehaltene Axt) → Beiwerk, weggelassen. Quelle sonst vollständig.)
Aufruf:   python3 disgruntled_forest_warden.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/disgruntled-forest-warden.png + .json

Was im Sprite ist (x, y im 20×26-Sprite):
* HAAR + BART (x 4–15, y 0–10): zerzauste braune Locken (69,52,33)/(109,77,48)/(146,95,60)/(89,67,43)/(183,118,75), zwei Augen 2×2 bei (7–8, 8–9) und (11–12, 8–9) (weiß (255,255,255) + grau (194,194,194)), schwarze Wimpern (0,2,0) bei (8,7),(11,7),
  Nase/Wange blass (252,231,214) bei (10,8),(9–10,9); darunter der Bart (y 7–10) und eine Lücke (9–10, 7).
* OBERKÖRPER (x 0–19, y 11–21): braune Weste (123,66,39)/(81,41,22)/(89,63,39) mit hellem Hemd (131,133,130)/(65,66,64) in der Mitte (x 8–11, y 17–18), nackte Arme (213,164,100)/(245,206,136)/(248,188,119)/(208,139,64) mit Fäusten unten (y 14–19), Umriss (49,24,0).
* HOSE/STIEFEL (x 4–15, y 19–25): grüne Hose (0,107,24)/(0,57,31), zwei braune Stiefel (57,16,0)/(132,66,24)/(98,49,8) (y 22–25).
Metall/Edelstein: nichts (die grauen Pixel sind das Hemd) → KEIN Glanz (Regel 14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos):
* Atmen (Periode 24, zweimal pro Schleife): die Gürtelzeile 19 von Körper und Armen wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf, Brust und Arme steigen 1 px, Hose und Stiefel bleiben am Boden. Nur senkrecht.
* Mürrisches Kopfsenken (Frames 14–19 und 38–43): der Kopf sinkt 1 px unter die Ruhelage (die Schulterzeile 11 entfällt einmal) und hebt sich wieder — nur Heben/Senken, kein seitliches Neigen.
* Arme: hängen ruhig am Körper, KEIN Schlackern (Nutzerkorrektur Runde 3) — sie heben und senken sich nur mit dem Atmen des Oberkörpers (Gürtelzeile 19 wie beim Körper doppelt eingefügt).
* Blinzeln (Frames 20–22 und 43–45): die acht Augenpixel nehmen die Haarfarbe (109,77,48) an (Lid), Wimpern und Nase bleiben.
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Flächen (die 9 Gesichtspixel stammen aus der Körperebene).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_untote as U

N, MS = 48, 66
GP = 6

spr = L.lade('disgruntled-forest-warden')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)
HAAR = (109, 77, 48)
AUGEN = [(7, 8), (8, 8), (7, 9), (8, 9), (11, 8), (12, 8), (11, 9), (12, 9)]
arm_l = vorhanden & (((xx <= 4) & (yy >= 12) & (yy <= 18)) | ((xx <= 3) & (yy == 19)))
arm_r = vorhanden & (((xx >= 15) & (yy >= 12) & (yy <= 18)) | ((xx >= 16) & (yy == 19)))
koerper = vorhanden & ~arm_l & ~arm_r


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    k = teil(koerper)
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 43, [1, 1, 1], N):
        Hm.setze(k, {p: HAAR for p in AUGEN}, OFF)
    al, ar = teil(arm_l), teil(arm_r)                            # Arme hängen still (Nutzer-Feedback: kein Schlackern); sie atmen nur mit dem Oberkörper
    if Hm.folge(i, 14, [1] * 6, N) or Hm.folge(i, 38, [1] * 6, N):
        k = TX.streck_zeile(k, GP + 11, -1)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        k = TX.streck_zeile(k, GP + 19, b)
        al = TX.streck_zeile(al, GP + 19, b)
        ar = TX.streck_zeile(ar, GP + 19, b)
    fr = L.zusammen(H, W, [(k, 0, 0), (al, 0, 0), (ar, 0, 0)])
    return Hm.kontur_schliessen(fr, ERLAUBT, UMRISS)


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
    L.speichern('disgruntled-forest-warden', 'Disgruntled Forest Warden', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/disgruntled-forest-warden-strip.png', frames, spalten=12, scale=6)
