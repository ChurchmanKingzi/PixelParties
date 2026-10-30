# -*- coding: utf-8 -*-
"""Idle-Animation für „Barkeeper“ (Creature) — der rundliche Wirt im schwarzen Anzug, der ein Tablett mit einer Flasche hält.

Quelle: src/barkeeper.png (18×25 px, 33 Farben).
PICK: [["Motive", 1014, 1]]      (Ebene „Lilly #1“, Figur 1; die Ebene trägt den Namen einer anderen Karte, passt aber zu 97 % zur Barkeeper-Kunst und kommt nur in dieser Karte vor)

Aufruf:   python3 barkeeper.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/barkeeper.png + .json

Was im Sprite ist (x, y im 18×25-Sprite):
* KOPF (x 3–14, y 0–9): rundes Gesicht in Hautfarbe (247,190,123)/(214,166,99)/(255,215,165) mit braunem Umriss B (49,24,0), oben eine Haarsträhne (181,121,49)/(214,166,99) (8–10, 1), dichte schwarze Brauen
  (5–7, 3) und (10–12, 2/4); zwei Augen: links hellblaue Iris (173,215,255) (6,4) mit weißem Pixel (247,255,255) (6,5), rechts hellblaue Iris (10,5) mit brauner Pupille/Wimper (90,32,0) (11,5);
  rote Nase (189,89,57) (8–9, 6); offener Mund (schwarz, 2×2) bei (8–9, 8–9) („Oh“ — er redet/ruft).
* ANZUG (x 0–15, y 9–21): schwarz-dunkelgrauer Anzug (C (41,40,41), E (49,48,49), F (33,32,33), G (57,56,57), H (16,20,16)) mit weißen Kragenpixeln (247,247,247) bei (6–7, 17) und braunem Gürtel (49,24,0) y 16.
* TABLETT mit Flasche (x 9–17, y 10–18): braunes Holztablett/Becher (66,52,33)/(90,69,41)/(148,109,66) und eine lavendel-graue Flasche/Glas (99,101,99)/(156,158,156)/(156,125,198) bei (9–11, 12–15),
  von zwei Händen (247,190,123) bei (9,15), (13,16), (14,17) gehalten.
* BEINE/SCHUHE (y 21–24): schwarze Schuhe (A (0,0,0)).
Kein Metall, Gold oder Edelstein im Sprite (Glasflasche und Holz glänzen nicht) → KEIN Glanz (Regel 14); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Anzugzeile 20, glatt, wird einmal doppelt eingefügt: Rumpf, Tablett, Hände und Kopf steigen, Schuhe bleiben),
  der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Wangenzeile 7, glatte Haut zwischen Nase und Mund, wird verlängert): Kopf 0 → 1 → 2 → 1 → 0 px, Brust/Tablett 0 → 1 → 0.
* Kopfwiegen: der Kopf (Zeilen 0–8) neigt sich 1 px nach rechts (Frames 24–33) und 1 px nach links (Frames 36–45); Kinn und Kragen bleiben stehen (4-verbunden).
* Gewichtsverlagerung: der Oberkörper samt Tablett (Zeilen 0–20) schiebt sich 1 px nach links (Frames 6–17) und später 1 px nach rechts (Frames 38–45; nie zugleich mit dem Kopfwiegen in
  derselben Richtung, damit höchstens 1 px Ausschlag bleibt); Beine und Schuhe bleiben stehen.
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — Iris und Weiß (6,4), (6,5) und die Iris (10,5) nehmen die umgebende Hautfarbe (247,190,123) an; die Brauen und die braune Wimper (11,5)
  bleiben. Kein Farbtausch, kein Augenglanz.
* Sprechen: der „Oh“-Mund (schwarz, 2×2) wird zeitweise nur 1 px hoch (obere Mundzeile (8–9, 8) nimmt Hautfarbe an): Frames 8–15 und 31–38 im Wechsel (offen, halb, halb, offen, halb, offen, halb, halb).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Gewichtsverlagerung ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('barkeeper')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
HAUT = f(8, 4)                                                      # (247,190,123), Lidfarbe/Mundhaut
KOPF_UMRISS, KOERPER_UMRISS = f(5, 3), f(3, 9)                      # (49,24,0) Kopf, (33,32,33) Anzug
AUGEN = [(6, 4), (6, 5), (10, 5)]


def frame(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    # --- Blinzeln: Iris und Weiß nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    # --- Sprechen: obere Mundzeile wird zeitweise Haut (Mund nur 1 px hoch) ---
    if Hm.folge(i, 8, [0, 1, 1, 0, 1, 0, 1, 1], N) or Hm.folge(i, 31, [0, 1, 1, 0, 1, 0, 1, 1], N):
        Hm.setze(k, {(8, 8): HAUT, (9, 8): HAUT}, OFF)
    # --- Kopfwiegen (Zeilen 0–8) ---
    kw = 1 if Hm.folge(i, 24, [1] * 10, N) else (-1 if Hm.folge(i, 36, [1] * 10, N) else 0)
    if kw:
        Hm.bereich_versatz(k, OFF, {y: kw for y in range(0, 9)}, -2, sw + 1)
    # --- Gewichtsverlagerung (Zeilen 0–20 samt Tablett) ---
    gv = -1 if Hm.folge(i, 6, [1] * 12, N) else (1 if Hm.folge(i, 38, [1] * 8, N) else 0)
    if gv:
        Hm.bereich_versatz(k, OFF, {y: gv for y in range(0, 21)}, -2, sw + 1)
    # --- Auf und ab: Anzugzeile 20 = Brust, Wangenzeile 7 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 7, brust, kopf)
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf → Braun, Körper → Dunkelgrau)
    kk = Hm.kantenmaske(k)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in k[y, x, :3])
        if c not in ERLAUBT:
            k[y, x, :3] = KOPF_UMRISS if y - PAD_T < 10 else KOERPER_UMRISS
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
    L.speichern('barkeeper', 'Barkeeper', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/barkeeper-strip.png', frames, spalten=12, scale=6)
