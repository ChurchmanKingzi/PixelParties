# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Chilly Wizard“ (Creature) — der Eiszauberer mit dem Sternenhut.

Quelle: src/mischief-militia-chilly-wizard.png (15×25 px, 14 Farben).
PICK: [["MotiveRussia", 104, 1]]      (Ebene „Ebene #90“, Figur 1)

Aufruf:   python3 mischief_militia_chilly_wizard.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-chilly-wizard.png + .json

Was im Sprite ist (x, y im 15×25-Sprite):
* HUT: spitzer blauer Kegel (x 3–11, y 0–9; B (51,102,170) Fläche, A (23,46,76)/C (13,27,44) dunkle Seite und Umriss, E/G (85,117,169)/(141,170,207)
  helle Kante rechts) mit 9 gelben Sternen I (252,252,3): (9,6) (5,7) (7,8) (9,9) (6,10) (2,12) (13,12) (9,13) (4,14). Breite Krempe (x 0–14, y 10–14),
  darunter ein dunkler Schattenstrich C (x 3–11, y 15).
* KÖRPER (y 16–24): hell-lavendelfarbener Rand H/K/J/N (Eis/Schnee/Schal) um eine graue Füllung D/F/M im Schachbrettmuster (Bart/Gewand?). Das braune
  Pixel (7,17) in der Mitte oben ist unklar (Nase?). Ein Gesicht oder Augen sind NICHT zu sehen — der Hut und sein Schatten verdecken es. Also kein
  Blinzeln. Der Körper bleibt (außer Atmen/Glanz) fest.
* Braune Pixel L (104,64,32) am Rand (0,17) (1,18) (2,19) und (14,17) (13,18) (12,19): Rest eines braunen Rings (Boden/Gürtel?) um den Körper — fest am
  Körper, steigen mit ihm mit (so bleibt der Rand genau wie im Original zusammenhängend).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24): Der Körper hebt sich zuerst 1 px (graue Zeile 20 wird einmal doppelt eingefügt), der Hut läuft 3 Frames nach und
  hebt sich um ein weiteres px (Schattenzeile 15 verlängert). Hut 0 → 1 → 2 → 1 → 0 px, Körper 0 → 1 → 0.
* Hutspitze schwingt (Periode 16, dreimal pro Schleife): Die Zeilen 0–5 des Kegels verschieben sich waagerecht um bis zu ±2 px (Spitze mehr, Kegelfuß
  nicht); benachbarte Zeilen unterscheiden sich um höchstens 1 px und die einpixelige Spitze (Zeilen 0–1) bewegt sich gemeinsam — alle Zustände sind
  4-verbunden (Eckkontakt-Kontrolle in der Prüfung).
* Krempenenden flattern: das linke (x 0, C) und rechte (x 14, A) Krempenende wächst gegenphasig um 1 Umrisspixel nach oben bzw. unten (Periode 24), 4-verbunden mit der Nachbarspalte.
* KEIN Glanz (Regel 14): Hut, Sterne und Eisrand glänzen/funkeln NICHT (kein Lichtband, keine Glitzersterne, keine blinkenden Hutsterne).
* Magiefunken (6 kreisende + 2 auf und ab): acht runde Funken (Tiefenwirkung: auf der Vorderseite der Bahn groß 2×2, auf der Rückseite klein 1 px — die Größe hängt nur von der Tiefe ab, nicht von der Zeit) in Hutblau B/G, Weiß/Lavendel N/J und Gelb I (alles Farben des Sprites)
  kreisen langsam (eine Runde pro Schleife) in flachen Ellipsen um Hut (drei, Rechtslauf) und Körper (drei, Linkslauf); zwei weitere (2×2, stehen vor dem Hut) steigen links/rechts neben der Krempe sanft auf und ab. Die Funken
  auf der Rückseite der Ellipse liegen hinter der Figur (1 px), die auf der Vorderseite davor (2×2); Hut-Funken steigen mit dem Hut, Körper-Funken mit dem Körper.
Frame 0 = Original (Ruhepose), die Funken ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (es wird nichts verschoben, was Verdecktes freilegt).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 8, 3

spr = L.lade('mischief-militia-chilly-wizard')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)                                   # Farben der Außenkante im Original (Regel 16)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# Farben des Sprites
CA, CB, CC, CE, CG = (23, 46, 76), (51, 102, 170), (13, 27, 44), (85, 117, 169), (141, 170, 207)         # Hut
LH, LK, LJ, LN = (172, 171, 232), (204, 204, 242), (214, 213, 244), (223, 224, 246)                       # Lavendel
GD, GF, GM = (85, 85, 85), (126, 126, 127), (169, 169, 170)                                               # Grau
GELB = (252, 252, 3)
HUT_RAMPE = [CC, CA, CB, CE, CG]
RAND_RAMPE = [LH, LK, LJ, LN]
GRAU_RAMPE = [GD, GF, GM]

# Braune Pixel am Rand ((0,17) (1,18) (2,19) und (14,17) (13,18) (12,19)): Rest eines braunen Rings um den Körper — sie schmiegen sich
# 4-verbunden an den Rand und steigen deshalb mit dem Körper mit (sonst entstünden Eckkontakte)
for (bx, by) in [(0, 17), (1, 18), (2, 19), (14, 17), (13, 18), (12, 19)]:
    assert f(bx, by) == (104, 64, 32)
koerper = vorhanden.copy()
STERNE = [(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and f(x, y) == GELB]
assert len(STERNE) == 9

# Masken für das Lichtband
m_hut = np.array([[(koerper[y, x] and y <= 14 and f(x, y) in HUT_RAMPE) for x in range(sw)] for y in range(sh)])
m_rand = np.array([[(vorhanden[y, x] and y >= 16 and f(x, y) in RAND_RAMPE) for x in range(sw)] for y in range(sh)])
m_grau = np.array([[(vorhanden[y, x] and y >= 16 and f(x, y) in GRAU_RAMPE) for x in range(sw)] for y in range(sh)])

# Hutspitze: Zeilenversatz nach Stufe (Betrag); benachbarte Zeilen ≤ 1 Unterschied, Zeilen 0–1 (einpixelig) gleich
SCHWUNG = {0: {}, 1: {0: 1, 1: 1, 2: 1, 3: 1, 4: 1}, 2: {0: 2, 1: 2, 2: 2, 3: 1, 4: 1, 5: 1}}      # Zeilen 0–2 (einpixelige Spitze + 3-px-Zeile) gleich, sonst bliebe ein Mittelpixel oben ohne Umriss


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


# Magiefunken: kleine runde Funken (Vorderseite der Bahn 2×2, Rückseite 1 px) kreisen langsam in flachen Ellipsen um Hut und Körper (eine Runde pro Schleife) und bobben sanft auf und ab.
# (cx, cy) Mittelpunkt in Spritekoordinaten, (rx, ry) Halbachsen, Phase (0–1), Richtung ±1, Farbe, Bezug: 'hut' steigt mit dem Hut, 'koerper' mit dem Körper
FUNKEN = [
    dict(cx=7.5, cy=6.0, rx=9.5, ry=2.5, ph=0.00, r=+1, farbe=GELB, bez='hut', gross=True),
    dict(cx=7.5, cy=6.0, rx=9.5, ry=2.5, ph=0.34, r=+1, farbe=LN, bez='hut', gross=False),
    dict(cx=7.5, cy=6.0, rx=9.5, ry=2.5, ph=0.67, r=+1, farbe=CG, bez='hut', gross=True),
    dict(cx=7.5, cy=19.0, rx=10.0, ry=2.0, ph=0.12, r=-1, farbe=LJ, bez='koerper', gross=False),
    dict(cx=7.5, cy=19.0, rx=10.0, ry=2.0, ph=0.46, r=-1, farbe=GELB, bez='koerper', gross=True),
    dict(cx=7.5, cy=19.0, rx=10.0, ry=2.0, ph=0.79, r=-1, farbe=LN, bez='koerper', gross=False),
    dict(cx=-2.0, cy=11.0, rx=1.0, ry=5.0, ph=0.25, r=+1, farbe=CB, bez='hut', gross=False),      # steigt und sinkt links neben der Krempe
    dict(cx=17.0, cy=14.0, rx=1.0, ry=5.0, ph=0.75, r=+1, farbe=GELB, bez='hut', gross=False),    # … und rechts
]


def funken_ebenen(i, brust, hub):
    """(hinten, vorn): zwei Leinwandebenen; Funken auf der Rückseite der Ellipse (sin < 0) liegen hinter der Figur und sind klein (1 px),
    die auf der Vorderseite (sin > 0) davor und groß (2×2) — die Größe hängt nur von der Tiefe auf der Bahn ab."""
    hinten, vorn = L.leer(H, W), L.leer(H, W)
    for sp in FUNKEN:
        th = 2 * math.pi * (sp['r'] * i / N + sp['ph'])
        x = sp['cx'] + sp['rx'] * math.cos(th)
        y = sp['cy'] + sp['ry'] * math.sin(th)
        y -= hub if sp['bez'] == 'hut' else brust
        ebene = vorn if math.sin(th) > 0 else hinten
        X, Y = PAD_L + int(round(x)), PAD_T + int(round(y))
        gross = math.sin(th) > 0 or sp['rx'] < 1.5                             # Tiefe: Vorderseite der Bahn 2×2, Rückseite 1 px (die zwei Seitenfunken stehen vor dem Hut: 2×2)
        pts = [(X, Y)] + ([(X + 1, Y), (X, Y + 1), (X + 1, Y + 1)] if gross else [])
        for (px, py) in pts:
            if not (0 <= px < W and 0 <= py < H):
                raise L.ClipError(f'Funke bei ({px},{py}) außerhalb der Leinwand {W}×{H}')
            ebene[py, px, :3] = sp['farbe']
            ebene[py, px, 3] = 255
    return hinten, vorn


def frame(i, funken=True):
    k = teil(koerper)
    # --- Krempenenden flattern (gegenphasig) ---
    # Statt die Randspalten zu verschieben (das legt Innenpixel an der Außenkante frei), wächst das Krempenende um 1 Umrisspixel nach oben oder unten:
    # links (0,10)/(0,13) in C, rechts (14,10)/(14,13) in A, jeweils 4-verbunden an der Nachbarspalte; gegenphasig.
    dl = int(round(1.0 * math.sin(L.sinus(i, N / 2))))
    wuchs = {}
    if dl > 0:
        wuchs.update({(0, 13): CC, (14, 10): CA})
    elif dl < 0:
        wuchs.update({(0, 10): CC, (14, 13): CA})
    Hm.setze(k, wuchs, OFF)
    # --- Hutspitze schwingt (Periode 16) ---
    a = int(round(2.0 * math.sin(L.sinus(i, N / 3))))
    if a:
        Hm.zeilen_versatz(k, OFF, {y: int(math.copysign(d, a)) for y, d in SCHWUNG[abs(a)].items()})
    # --- Auf und ab: Körper zuerst (graue Zeile 20), Hut 3 Frames später (Schattenzeile 15) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 15, brust, kopf)
    hub = brust + kopf
    Hm.kontur_schliessen(k, ERLAUBT, CC)                          # Regel 16: Außenkante in jeder Pose in Umrissfarbe
    ebenen = []
    if funken:
        hinten, vorn = funken_ebenen(i, brust, hub)
        ebenen.append((hinten, 0, 0))
    ebenen.append((k, 0, 0))
    if funken:
        ebenen.append((vorn, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, funken=False), spr, OFF)
    print('Ruhepose (ohne Funken) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, funken=False) for i in range(N)]
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Funken) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('mischief-militia-chilly-wizard', 'Mischief Militia - Chilly Wizard', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-chilly-wizard-strip.png', frames, spalten=12, scale=5)
