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
* Krempenenden flattern: die äußersten Spalten (x 0 und x 14) gehen ±1 px auf und ab, gegenphasig (Periode 24).
* Sterne funkeln (Regel 12): jeder der 9 gelben Hutsterne blitzt reihum 2 Frames weiß (N). An der Hutspitze und an der rechten Krempenkante
  blitzt zusätzlich je ein vierzackiger Glitzer-Stern (Frames 10–13 / 34–37 Spitze, 22–25 Krempe).
* Eisglanz (Regel 12): ein Lichtband läuft zweimal pro Schleife diagonal (Frames 4–17 und 28–41) über den Hut (Rampe C < A < B < E < G), den lavendelfarbenen
  Rand (H < K < J < N) und das graue Schachbrett (D < F < M): 1–2 Stufen heller.
* Kältedunst: acht runde Dunstwolken ('m' Wölkchen, 'o' Oval, 'k' Funke) in Weiß/Lavendel steigen langsam links und rechts vom Körper auf (L.puff_ebene,
  wachsen/schrumpfen, langsames Wackeln, hinter der Figur).
Frame 0 = Original (Ruhepose), der Dunst ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen.
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
SCHWUNG = {0: {}, 1: {0: 1, 1: 1, 2: 1, 3: 1, 4: 1}, 2: {0: 2, 1: 2, 2: 1, 3: 1, 4: 1, 5: 1}}


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def frame(i, dunst=True):
    k = teil(koerper)
    # --- Eisglanz: Lichtband zweimal pro Schleife über Hut, Rand und Grau ---
    for start in (4, 28):
        Hm.lichtband(k, m_hut, OFF, i, N, start, 14, HUT_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(k, m_rand, OFF, i, N, start, 14, RAND_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(k, m_grau, OFF, i, N, start, 14, GRAU_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Sterne am Hut funkeln reihum ---
    for j, (sx, sy) in enumerate(STERNE):
        if Hm.folge(i, (5 * j + 6) % N, [1, 1], N):
            Hm.setze(k, {(sx, sy): LN}, OFF)
    # --- Krempenenden flattern (gegenphasig) ---
    dl = int(round(1.0 * math.sin(L.sinus(i, N / 2))))
    dr = -int(round(1.0 * math.sin(L.sinus(i, N / 2))))
    Hm.spalten_versatz(k, OFF, {0: (dl, 10, 13), 14: (dr, 10, 13)})
    # --- Hutspitze schwingt (Periode 16) ---
    a = int(round(2.0 * math.sin(L.sinus(i, N / 3))))
    if a:
        Hm.zeilen_versatz(k, OFF, {y: int(math.copysign(d, a)) for y, d in SCHWUNG[abs(a)].items()})
    # --- Auf und ab: Körper zuerst (graue Zeile 20), Hut 3 Frames später (Schattenzeile 15) ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 15, brust, kopf)
    hub = brust + kopf
    # --- Glitzer-Sterne an Hutspitze und rechter Krempenkante (nach dem Atmen, mit dem Hut mitgehoben) ---
    tipp_x = PAD_L + 7 + (int(math.copysign(SCHWUNG[abs(a)][0], a)) if a else 0)
    st = Hm.folge(i, 10, [0, 1, 2, 1], N)
    if st is None:
        st = Hm.folge(i, 34, [0, 1, 2, 1], N)
    Hm.stern4(k, tipp_x, PAD_T - hub, st, LN, LJ, LH)
    st2 = Hm.folge(i, 22, [0, 1, 2, 1], N)
    Hm.stern4(k, PAD_L + 15, PAD_T + 11 - hub, st2, LN, LJ, LH)
    ebenen = []
    if dunst:
        px, py = PAD_L, PAD_T
        spec = [dict(x=px - 2, y=py + 21, vx=-1, vy=-14, off=0, form='m', wackeln=1.2),
                dict(x=px - 1, y=py + 23, vx=0, vy=-12, off=16, form='o', wackeln=1.0),
                dict(x=px - 3, y=py + 19, vx=-1, vy=-13, off=32, form='k', wackeln=1.5),
                dict(x=px + 16, y=py + 22, vx=1, vy=-14, off=8, form='m', wackeln=1.2),
                dict(x=px + 15, y=py + 24, vx=0, vy=-12, off=24, form='o', wackeln=1.0),
                dict(x=px + 17, y=py + 20, vx=1, vy=-13, off=40, form='k', wackeln=1.5),
                dict(x=px - 1, y=py + 12, vx=-1, vy=-11, off=4, form='k', wackeln=1.2),
                dict(x=px + 15, y=py + 12, vx=1, vy=-11, off=28, form='k', wackeln=1.2)]
        ebenen.append((L.puff_ebene(H, W, i, N, spec, {'c': LN, 'r': LK}), 0, 0))
    ebenen.append((k, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, dunst=False), spr, OFF)
    print('Ruhepose (ohne Dunst) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, dunst=False) for i in range(N)]
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Dunst) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('mischief-militia-chilly-wizard', 'Mischief Militia - Chilly Wizard', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-chilly-wizard-strip.png', frames, spalten=12, scale=5)
