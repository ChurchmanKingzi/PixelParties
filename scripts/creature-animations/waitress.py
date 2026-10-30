# -*- coding: utf-8 -*-
"""Idle-Animation für „Waitress“ (Creature) — das blonde Mädchen mit den langen goldenen Zöpfen und der hellblauen Bluse in der Kartenmitte.

Quelle: src/waitress.png (20×23 px, 25 Farben).
PICK: [["Motive", 1013, 1]]      (Ebene „Waitress #1“, Figur 1 = das Mädchen (x 28–48 der Ebene); die Ebene trägt in Figur 2 zusätzlich den Mann links (andere Karte: Barkeeper))
Abgleich mit der Karte (Kunst Waitress.png): Die Kunst zeigt DREI Figuren: den Barkeeper (Mann, links, Ebene 1013 Teil 2), eine Frau mit Tablett oben hinten (Ebene 1021 „Waitress“, 15×25, 78 %) und
das blonde Mädchen in der Bildmitte (Ebene 1013 Figur 1, 99 % bei (27,19)). Ich habe das MITTLERE Mädchen genommen: sie steht an der Heldenposition der Karte (dieselbe Position wird in den Ebenen
„Haste #5“ und „Kohta“ für andere Karten wiederverwendet), die beiden anderen sind Beiwerk. Die Frau mit dem Tablett (Ebene 1021) wäre die klassische Kellnerin — falls sie gemeint ist, bitte Bescheid sagen;
sie ist ein ganz anderer Sprite (violett-schwarzes Kleid, Tablett, 15×25).

Aufruf:   python3 waitress.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/waitress.png + .json

Was im Sprite ist (x, y im 20×23-Sprite):
* HAARE (x 0–19, y 0–19): ein riesiger goldener Haarschopf (C (255,205,49), D (246,164,24), E (255,230,131), L (255,222,90), I (213,98,16), Umriss A (65,0,0)) mit Pony und zwei langen Zöpfen/Haarsträhnen, die seitlich
  bis zur Hüfte (y 17–19) herabfallen.
* GESICHT (y 6–11, x 7–12): Haut J (246,189,152)/M (246,205,139)/S (255,230,213), rosa Wangen (255,152,153) bei (7,9) und (12,9), schwarze Augenstriche (7,7)+(8,8) und (12,7)+(11,8) — die Augen sind
  schräg-schmale schwarze Striche (geschlossen/lächelnd), keine Iris → kein Blinzeln; Umriss braun (49,24,0) bei (7,10) und (12,10).
* BLUSE (y 12–21): hellblau G (139,213,255)/H (180,246,255)/O (74,172,255)/P (246,255,255) mit schwarzem Kragen B und grauem Gürtel (N (82,82,82), Q (106,106,106), R (123,123,123)); Hände in Hautfarbe bei (3–4, 15–16).
Kein Metall, Gold (Haare sind Haarfarbe) oder Edelstein → KEIN Glanz (Regel 14; goldene Haare glänzen nicht); kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Brust zuerst 1 px (Zeile 17 wird einmal doppelt eingefügt: Bluse, Arme, Hände und Kopf steigen, Saum/Gürtel bleibt), der Kopf läuft 3 Frames nach und hebt sich um ein
  weiteres px (Kinnzeile 10 wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Zöpfe schwingen: die Zopfspitzen (Zeilen 17–19) schwingen 1 px nach außen: links Frames 6–11 und 28–33, rechts Frames 3–8 und 22–27 (4-verbunden über die Zeile 16).
* Gewichtsverlagerung: der Oberkörper (Zeilen 0–18) schiebt sich 1 px nach rechts (Frames 10–21) und später 1 px nach links (Frames 34–45); die Hüftzeilen 19–22 bleiben stehen.
* Kopfneigen: der Kopf (Zeilen 0–9) neigt sich 1 px nach links (Frames 2–7) und rechts (Frames 24–31); Kinn und Hals bleiben stehen.
Kein Blinzeln: die Augen sind im Sprite schmale geschlossene Striche (kein Auge, das sich schließen könnte).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Zopfschwung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('waitress')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)

ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAAR_UMRISS, KOERPER_UMRISS = (65, 0, 0), (0, 0, 0)


def frame(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Zöpfe schwingen (Zopfspitzen Zeilen 17–18 nach außen) ---
    if Hm.folge(i, 6, [1] * 6, N) or Hm.folge(i, 28, [1] * 6, N):
        Hm.bereich_versatz(k, OFF, {17: -1, 18: -1, 19: -1}, -2, 4)
    if Hm.folge(i, 22, [1] * 6, N) or Hm.folge(i, 3, [1] * 6, N):
        Hm.bereich_versatz(k, OFF, {17: 1, 18: 1, 19: 1}, 15, sw + 1)
    # --- Kopfneigen (Zeilen 0–9) und Gewichtsverlagerung (Zeilen 0–18) in getrennten Zeitfenstern ---
    kn = -1 if Hm.folge(i, 2, [1] * 6, N) else (1 if Hm.folge(i, 24, [1] * 8, N) else 0)
    if kn:
        Hm.bereich_versatz(k, OFF, {y: kn for y in range(0, 10)}, -2, sw + 1)
    gv = 1 if Hm.folge(i, 10, [1] * 12, N) else (-1 if Hm.folge(i, 34, [1] * 12, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 19)}, -2, sw + 1)
    # --- Auf und ab: Zeile 17 = Brust, Kinnzeile 10 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 17, PAD_T + 10, brust, kopf)
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Haare → Dunkelrot, Körper unten → Schwarz)
    kk = Hm.kantenmaske(k)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in k[y, x, :3])
        if c not in ERLAUBT:
            k[y, x, :3] = HAAR_UMRISS if y - PAD_T < 19 else KOERPER_UMRISS
    return k


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('waitress', 'Waitress', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/waitress-strip.png', frames, spalten=12, scale=6)
