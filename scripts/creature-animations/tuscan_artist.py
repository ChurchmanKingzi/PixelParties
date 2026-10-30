# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Artist“ (Creature) — der Künstler mit dem Gemälde als Kopf.

Quelle: src/tuscan-artist.png (24×37 px, 27 Farben).
PICK: [["MotiveGrailWar", 198, 1]]      (Ebene „Tuscan Artist“, Figur 1)

Aufruf:   python3 tuscan_artist.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-artist.png + .json

Was im Sprite ist (x, y im 24×37-Sprite):
* KOPF = ein gerahmtes Gemälde (x 6–19, y 0–12): goldener Rahmen (hell G (232,200,136) oben/unten, Seiten P/F, Schatten O/J, dunkle
  Außenkante S (103,64,32) links, Q (63,31,15) rechts), darin ein Windrad-Bild (x 8–17, y 3–10): links rot H, oben blau W/T, rechts
  grün X/M, unten rechts orange L, in der Mitte ein graulila Fleck R. Der Künstler hat KEIN Gesicht — es gibt also keine Augen/Brauen.
* Schwarzer Kragen/Halstuch (x 5–15, y 12–19, E/K/N/U/I) unter dem Bild, graue Puffärmel-Schultern (x 2–5 und 16–22, y 13–20).
* Arme: kurze Ärmel, unten nackte braune Unterarme/Hände (J/Y/a) links (2–5, 21–25) und rechts (19–22, 21–25).
* Overall/Anzug grau (B/C/D, y 20–34), Beine ab Zeile 34 getrennt, Schuhe mit weißen/silbernen Kappen V/Z (y 35, x 7–10 und 14–17).
* Links am Körper ein hängender Pinsel (x 3–6, y 26–31): Griff grau (D/B), Zwinge/Spitze hell V/Z (4–5,30), dunkle Umrisse A — in der
  linken Hand gehalten (Deutung; er sitzt direkt unter der Hand).
Fest bleiben: Gemälde-Umrisse, Kragen, Schultern, Hände, Anzug, Beine, Schuhe (außer dem Glanz).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (Zeile 32 des Anzugs wird einmal doppelt eingefügt: Schultern,
  Arme, Pinsel und Bild steigen, Beine/Schuhe bleiben), das Bild läuft 3 Frames nach und hebt sich um ein weiteres px (Zeile 13, Schulterlinie,
  wird verlängert): Bild 0 → 1 → 2 → 1 → 0 px, Brust 0 → 1 → 0.
* Das Windrad im Gemälde dreht sich: Die 20 Pixel des äußeren Rings (x 10–15, y 4–9) und die 12 des inneren (x 11–14, y 5–8) wandern im
  Uhrzeigersinn, zehn Schritte pro Schleife (zwei Vierteldrehungen, durch die Vierersymmetrie nahtlos). Nur Farben des Bildes.
* Gold glänzt (Regel 12): ein Lichtband läuft zweimal pro Schleife diagonal über den Rahmen (Frames 2–15 und 26–39, die Pixel dort 1–2 Stufen
  heller auf der Goldrampe S < O < J < F < P < G); je ein vierzackiger Glitzer-Stern an der Außenkante des Rahmens (oben links Frames 8–11 an der Ecke (6,0), rechte Kante
  (20,6) Frames 22–25, oben rechts (19,0) Frames 36–39; die Arme liegen halb auf dem Rahmen, halb davor). Die Schuhkappen glänzen: ein heller Pixel Z wandert zweimal pro Schleife über jede Kappe; die Pinselzwinge
  blitzt kurz (Frames 17–19, 41–43).
* Pinsel pendelt: Griff und Zwinge (Zeilen 29–31) schwingen am unteren Ende 0 → 2 → 3 px nach außen (links) und zurück (Periode 24, Zeile 28 fest an der Hand;
  nach innen geht nichts — da liegt der Körper); alle Zustände 4-verbunden.
* Farbtupfer steigen aus dem Gemälde auf: 8 runde Tupfer ('o' Oval, 'k' Funke) in Rot, Blau, Orange, Grün (Farben des Bildes), langsam
  aufsteigend, mit leichtem Wackeln, wachsen/schrumpfen (L.puff_ebene), hinter dem Rahmen entstehend.
Frame 0 = Original (Ruhepose), die Tupfer ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakte.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (es wird nichts verschoben, was Verdecktes freilegt).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 19, 3

spr = L.lade('tuscan-artist')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# Farben des Sprites
Z, V, A_ = f(7, 35), f(8, 35), f(3, 28)             # Z (225,215,217) weiß, V (189,189,189) silber, A (23,21,22) Umriss
GOLD = [(63, 31, 15), (103, 64, 32), (136, 95, 49), (156, 105, 62), (175, 127, 64), (199, 159, 97), (232, 200, 136)]
G_HELL, P_GOLD = GOLD[-1], GOLD[-2]

# Rahmen: Goldpixel im Kopfbereich (Zeilen 0–12, x 6–19)
rahmen = np.zeros((sh, sw), bool)
for _y in range(0, 13):
    for _x in range(6, 20):
        if vorhanden[_y, _x] and tuple(int(v) for v in spr[_y, _x, :3]) in GOLD:
            rahmen[_y, _x] = True

# Windrad: äußerer Ring (20 Pixel, im Uhrzeigersinn ab links oben) und innerer Ring (12 Pixel)
RING_A = [(x, 4) for x in range(10, 16)] + [(15, y) for y in range(5, 10)] + [(x, 9) for x in range(14, 9, -1)] + [(10, y) for y in range(8, 4, -1)]
RING_I = [(x, 5) for x in range(11, 15)] + [(14, y) for y in range(6, 9)] + [(x, 8) for x in range(13, 10, -1)] + [(11, y) for y in range(7, 5, -1)]
assert len(RING_A) == 20 and len(RING_I) == 12
FARBE_A = [f(x, y) for (x, y) in RING_A]
FARBE_I = [f(x, y) for (x, y) in RING_I]

# Pinsel (x 3–6, y 28–31); Zeile 27 und höher bleiben an der Hand. Stufe 1: Zeile 30 um 1, Zeile 31 um 2 px nach links; Stufe 2: Zeile 29 um 1, 30 um 2, 31 um 3 (Zeile 31 löst sich so ganz vom Bein, nie nur Ecke an Ecke)
PINSEL_ZEILEN = {28: (3, 6), 29: (3, 6), 30: (3, 6), 31: (4, 6)}
PINSEL_VERSATZ = {0: {}, 1: {30: 1, 31: 2}, 2: {29: 1, 30: 2, 31: 3}}

# Schuhkappen: Z wandert von außen nach innen
KAPPE_L = [(7, 35), (8, 35), (9, 35), (10, 35)]
KAPPE_R = [(17, 35), (16, 35), (15, 35), (14, 35)]
ZWINGE = {(4, 30): Z, (5, 30): V}                   # Ruhe: (4,30) V, (5,30) Z → kurz getauscht

PUNKTE_FARBE = {'rot': f(8, 8), 'blau': f(8, 4), 'orange': f(12, 9), 'gruen': f(16, 5)}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, tupfer=True):
    k = teil(vorhanden)
    # --- Windrad dreht (zehn Schritte pro Schleife) ---
    so = (10 * i) // N
    si = int(round(so * 0.6))
    for (p, c) in zip(RING_A, FARBE_A[-so % 20:] + FARBE_A[:-so % 20] if so else FARBE_A):
        Hm.setze(k, {p: c}, OFF)
    for (p, c) in zip(RING_I, FARBE_I[-si % 12:] + FARBE_I[:-si % 12] if si else FARBE_I):
        Hm.setze(k, {p: c}, OFF)
    # --- Gold glänzt: Lichtband (zweimal pro Schleife) + Glitzer-Sterne ---
    for start in (2, 26):
        Hm.lichtband(k, rahmen, OFF, i, N, start, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for (sx, sy, start) in ((6, 0, 8), (20, 6, 22), (19, 0, 36)):               # Sterne sitzen an Ecke/Kante AUSSEN am Rahmen
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(k, sx, sy, st, Z, G_HELL, P_GOLD, OFF)
    # --- Schuhkappen: Z wandert ---
    for kappe, start in ((KAPPE_L, 14), (KAPPE_R, 38), (KAPPE_L, 34), (KAPPE_R, 6)):
        j = Hm.folge(i, start, [0, 0, 1, 1, 2, 2, 3, 3], N)
        if j is not None:
            Hm.setze(k, {kappe[0]: V, kappe[j]: Z}, OFF)             # j = 0: Ruhe (Z außen); sonst Z auf Kappenpixel j, außen wieder silber
    if Hm.folge(i, 17, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(k, ZWINGE, OFF)
    # --- Pinsel pendelt (Zeilen 29–31 nach links) ---
    w = Hm.welle01(i - 4, N / 2)
    stufe = 0 if w < 0.3 else (1 if w < 0.75 else 2)
    versatz = PINSEL_VERSATZ[stufe]
    if versatz:
        zeilen = {y: [(x, tuple(int(v) for v in k[y + PAD_T, x + PAD_L, :3])) for x in range(x0, x1 + 1)] for y, (x0, x1) in PINSEL_ZEILEN.items()}
        for y, (x0, x1) in PINSEL_ZEILEN.items():
            if y in versatz:
                Hm.setze(k, {(x, y): None for x in range(x0, x1 + 1)}, OFF)
        for y, d in versatz.items():
            Hm.setze(k, {(x - d, y): c for (x, c) in zeilen[y]}, OFF)
    # --- Auf und ab: Brust zuerst (Zeile 32), Bild 3 Frames später (Zeile 13) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 32, PAD_T + 13, brust, kopf)
    ebenen = []
    if tupfer:
        px = PAD_L
        py = PAD_T
        spec = {
            'rot': [dict(x=px + 9, y=py + 3, vx=-1, vy=-17, off=0, form='o', wackeln=1.2),
                    dict(x=px + 15, y=py + 3, vx=1, vy=-14, off=24, form='k', wackeln=1.5)],
            'blau': [dict(x=px + 11, y=py + 3, vx=0, vy=-16, off=8, form='k', wackeln=1.5),
                     dict(x=px + 8, y=py + 3, vx=-1, vy=-13, off=32, form='o', wackeln=1.2)],
            'orange': [dict(x=px + 13, y=py + 3, vx=1, vy=-18, off=16, form='o', wackeln=1.2),
                       dict(x=px + 16, y=py + 3, vx=0, vy=-15, off=40, form='k', wackeln=1.5)],
            'gruen': [dict(x=px + 10, y=py + 3, vx=-1, vy=-15, off=4, form='k', wackeln=1.5),
                      dict(x=px + 14, y=py + 3, vx=1, vy=-17, off=28, form='o', wackeln=1.2)],
        }
        for name, puffs in spec.items():
            c = PUNKTE_FARBE[name]
            ebenen.append((L.puff_ebene(H, W, i, N, puffs, {'c': c, 'r': c}), 0, 0))
    ebenen.append((k, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, tupfer=False), spr, OFF)
    print('Ruhepose (ohne Tupfer) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, tupfer=False) for i in range(N)]
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Tupfer) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('tuscan-artist', 'Tuscan Artist', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tuscan-artist-strip.png', frames, spalten=12, scale=4)
