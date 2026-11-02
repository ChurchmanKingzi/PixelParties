# -*- coding: utf-8 -*-
"""Idle-Animation für „Barkeeper“ (Creature) — der rundliche Wirt im schwarzen Anzug, der seinen KRUG PUTZT (Nutzerfeedback: „soll seinen Krug putzen, ungefähr wie im Anhang“, ref6.png: 3 Frames, 68×30).

Quelle: src/barkeeper.png (18×25 px, 33 Farben).
PICK: [["Motive", 1014, 1]]      (Ebene „Lilly #1“, Figur 1; die Ebene trägt den Namen einer anderen Karte, passt aber zu 97 % zur Barkeeper-Kunst und kommt nur in dieser Karte vor;
  Nachbarebenen 1009/1011/1008 „Chuck #1“/„Lilly #6“/„Elixir of Quickness #3“ sind Umfärbungen derselben Figur, 1013 „Waitress #1“ ist die Kellnerin — keine weiteren Bestandteile)

Aufruf:   python3 barkeeper.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/barkeeper.png + .json

Was im Sprite ist (x, y im 18×25-Sprite):
* KOPF (x 3–14, y 0–9): rundes Gesicht in Hautfarbe (247,190,123)/(214,166,99)/(255,215,165) mit braunem Umriss B (49,24,0), oben eine Haarsträhne (181,121,49)/(214,166,99) (8–10, 1), dichte schwarze Brauen
  (5–7, 3) und (10–12, 2/4); zwei Augen: links hellblaue Iris (173,215,255) (6,4) mit weißem Pixel (247,255,255) (6,5), rechts hellblaue Iris (10,5) mit brauner Pupille/Wimper (90,32,0) (11,5);
  rote Nase (189,89,57) (8–9, 6); offener Mund (schwarz, 2×2) bei (8–9, 8–9) („Oh“ — er redet/ruft).
* ANZUG (x 0–15, y 9–21): schwarz-dunkelgrauer Anzug (C (41,40,41), E (49,48,49), F (33,32,33), G (57,56,57), H (16,20,16)) mit weißen Kragenpixeln (247,247,247) bei (6–7, 17) und braunem Gürtel (49,24,0) y 16.
  Der linke Ärmel (vom Betrachter aus, x 0–5, y 12–19) ist der Arm mit dem Putztuch.
* KRUG (x 9–17, y 10–18): braunes Holzgefäß (66,52,33)/(90,69,41)/(148,109,66), links an der Kante ein Stück GLAS in Lavendel (107,81,148)/(156,125,198) (x 11, y 12–15). Davor das PUTZTUCH: ein grauer
  Streifen aus (10,12), (9–10,13), (9–10,14), (10,15) in (99,101,99)/(156,158,156), gehalten von der Hand (247,190,123) bei (9,15); die rechte Hand hält den Krug bei (13,16), (14,17).
* BEINE/SCHUHE (y 21–24): schwarze Schuhe (A (0,0,0)).
Kein Metall, Gold oder Edelstein im Sprite (Holz, Glas, Stoff glänzen nicht) → KEIN Glanz (Regel 14); kein Feuer (Regel 15), kein Dampf, keine Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* KRUG PUTZEN (Hauptbewegung, 3 Hübe je Schleife, Periode 16 Frames; Ablauf je Hub: Frames 0–1 Ruhe (Original), 2–4 Tuch 1 px nach rechts über das Glas, 5–6 zurück, 7–8 1 px nach links, 9–11 2 px nach links, 12 1 px nach links, 13–15 Ruhe):
  das Tuch (graue Streifen + Hand) wandert waagerecht über den Krug und deckt dabei das lavendelfarbene Glas ab bzw. gibt es frei; der Arm mit dem Tuch (linker Ärmel, Zeilen 12–19, x ≤ 5) geht mit nach links hinaus
  (bis 2 px, so wie in ref6.png der Ärmel nach links ausschlägt) und kommt wieder zurück. Das Tuch liegt als eigene Ebene vor dem Krug; der Krug darunter wird dort, wo das Tuch ihn freigibt, ergänzt
  (siehe Ergänzungen). Der Arm liegt als eigene Ebene (ein Abbild der Ärmelzeilen, verschoben) über dem Körper, der darunter vollständig stehen bleibt — nichts wird aufgerissen.
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust 1 px (Anzugzeile 20 wird einmal doppelt eingefügt: Rumpf, Arm, Tuch, Krug, Hände und Kopf steigen, Schuhe bleiben). Der Kopf bewegt sich NICHT seitlich (Regel 17).
* Blinzeln (Frames 19–21 und 41–43): beide Augen schließen sich — Iris und Weiß (6,4), (6,5) und die Iris (10,5) nehmen die umgebende Hautfarbe (247,190,123) an; die Brauen und die braune Wimper (11,5) bleiben.
* Sprechen: der „Oh“-Mund (schwarz, 2×2) wird zeitweise nur 1 px hoch (obere Mundzeile (8–9, 8) nimmt Hautfarbe an): Frames 8–15 und 31–38 im Wechsel (offen, halb, halb, offen, halb, offen, halb, halb).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen (Quellfarben, von mir festgelegt): unter dem Tuch liegt der Krug — (10,12) → Lavendel (107,81,148), (10,13) und (10,14) → Lavendel hell (156,125,198), (10,15) → Lavendel (107,81,148) (das Glas reicht hinter dem Tuch bis x 10,
  wie das Glas rechts daneben), (9,13) und (9,14) → Krugumriss (49,24,0), (9,15) → Anzug (49,48,49) (dort, wo die Hand das Tuch hielt). Die Ärmelzeilen werden nicht ergänzt (der Arm liegt als Abbild über dem vollständigen Körper).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 5, 3, 4, 2          # Arm schlägt bis 2 px nach links aus (+3 Rand), Kopfhub 1 px oben (+3), Randabstand ≥ 2

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

GLAS_D, GLAS_H = f(11, 12), f(11, 13)                               # Lavendel (107,81,148) / hell (156,125,198)
KRUG_UMRISS, ANZUG = f(9, 12), f(8, 12)                             # (49,24,0), Anzug-Innenfarbe
# Putztuch: Pixel und Farben im Original
TUCH = {(10, 12): f(10, 12), (9, 13): f(9, 13), (10, 13): f(10, 13), (9, 14): f(9, 14), (10, 14): f(10, 14), (10, 15): f(10, 15), (9, 15): f(9, 15)}
# Ergänzung unter dem Tuch (Krug bzw. Anzug)
UNTER_TUCH = {(10, 12): GLAS_D, (10, 13): GLAS_H, (10, 14): GLAS_H, (10, 15): GLAS_D, (9, 13): KRUG_UMRISS, (9, 14): KRUG_UMRISS, (9, 15): f(8, 15)}
# Arm: Ärmelzeilen 12–19, x ≤ 5
ARM_Y = range(12, 20)
ARM_X = 5

# Putz-Takt (16 Frames): Tuchversatz dx je Frame
TAKT = [0, 0, 1, 1, 1, 0, 0, -1, -1, -2, -2, -2, -1, 0, 0, 0]


def frame(i, nur=None):
    dx = TAKT[i % 16]
    a = min(0, dx)                                                   # der Arm geht nur nach links hinaus, wenn das Tuch nach links wandert
    # --- Körper mit Ergänzung unter dem Tuch ---
    base = spr.copy()
    for (x, y), c in UNTER_TUCH.items():
        base[y, x, :3] = c
        base[y, x, 3] = 255
    k = L.platz(base, H, W, PAD_L, PAD_T)
    # --- Arm: Abbild der Ärmelzeilen (x ≤ 5) 0…2 px nach links, liegt über dem Körper ---
    if a:
        for y in ARM_Y:
            for x in range(0, ARM_X + 1):
                if spr[y, x, 3]:
                    X = x + a + PAD_L
                    if X < 0:
                        raise L.ClipError('Arm ragt links aus der Leinwand')
                    k[y + PAD_T, X] = spr[y, x]
    # --- Tuch + Hand: eigene Ebene vor dem Krug, waagerecht um dx verschoben ---
    for (x, y), c in TUCH.items():
        X = x + dx + PAD_L
        k[y + PAD_T, X, :3] = c
        k[y + PAD_T, X, 3] = 255
    # --- Blinzeln: Iris und Weiß nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN}, OFF)
    # --- Sprechen: obere Mundzeile wird zeitweise Haut (Mund nur 1 px hoch) ---
    if Hm.folge(i, 8, [0, 1, 1, 0, 1, 0, 1, 1], N) or Hm.folge(i, 31, [0, 1, 1, 0, 1, 0, 1, 1], N):
        Hm.setze(k, {(8, 8): HAUT, (9, 8): HAUT}, OFF)
    # --- Auf und ab: Anzugzeile 20 = Brust (nur senkrecht, Kopf bleibt in der Mitte) ---
    brust = Hm.stufe(i, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 7, brust, 0)
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss (Kopf → Braun, Körper → Dunkelgrau)
    kk = Hm.kantenmaske(k)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in k[y, x, :3])
        if c not in ERLAUBT:
            k[y, x, :3] = KOPF_UMRISS if y - PAD_T < 10 else KOERPER_UMRISS
    return k


TEST_EBENEN = ('figur',)

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
