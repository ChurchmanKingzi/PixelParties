# -*- coding: utf-8 -*-
"""Idle-Animation für „Mountain Boars“ (Creature).

Quelle: src/mountain-boars.png — ein Wildschwein (31×18 px, 9 Farben) aus MotiveSteamDwarfs.xcf, Ebene 38 „Ebene #303“. Die Ebene enthält fünf leicht unterschiedlich gezeichnete Eber
(wie auf der Karte); verwendet wird der erste (Komponente 1, oben links).
PICK: [["MotiveSteamDwarfs", 38, 1]]

Aufruf:   python3 mountain_boars.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mountain-boars.png + .json

Identifikation (Sprite 31×18, braunes Wildschwein im Profil, nach links blickend, dunkler Umriss B (57,31,33) / D (32,24,0)):
* Kopf (x 0–8, Zeilen 4–15): braun A (138,72,54); Schnauze hell F (246,202,159) / G (230,156,105) (0–5, 10–15), zwei Hauer F (0,10) (0,11) (0,12), rosa Nasenloch/Zahnfleisch I (245,85,93)
  bei (2,10) und (3,12); Auge = dunkle Pupille B (5,10) mit hellem Augenweiß F (6,10); an der Gesichtsvorderkante sitzen zwei dunkelrote Pixel H (90,8,0) (3,8) (3,9) (Narbe/Braue, bleiben fest).
* Rücken mit Borstenkamm: einzelne dunkle Borsten B bei (10,0) (13,0) (16,0) (7,1) (9,1) (12,1) (15,1) (18,1), darunter die dichte Mähne (Zeilen 2–4), helle Rückenlinie E (191,111,74).
* Körper (x 3–22, Zeilen 4–15): braun A mit dunklem Bauchschatten C (93,44,40) / B und hellen Fellstreifen E.
* Zwei sichtbare Beine (vorn x 7–11, hinten x 15–20, Zeilen 14–17) mit dunklen Hufen D.
* Schwanz: dünner dunkler Strich rechts hinten (24,10) (25–28,11) (28–29,10) (30,9).
* Kein Glanz (Fell, Regel 14), keine Partikel.
Bleibt fest: Kopfform, Schnauze, Hauer, Mähne, Bauchschatten.

Ablauf (56 Frames à 64 ms = 3,6 s), alle Bewegungen unabhängig:
* Atmen (Periode 28, 2× pro Schleife; oben in Frames 3–16 und 31–44): Zeile 13 (Bauch) wird eingefügt — Kopf, Rücken, Mähne und Schwanzansatz heben sich 1 px, die Beine bleiben am Boden.
* Borsten sträuben sich: die acht einzelnen Rückenborsten wachsen nacheinander von links nach rechts für je 4 Frames 1 px nach oben (Welle ab Frame 10 und ab Frame 34, 2 Frames Versatz je Borste).
* Schwanz wedelt: zweimal pro Schleife (Frames 5–18 und 30–43) schwingt der Schwanzstrich zweimal auf und ab (bis 2 px an der Spitze, wandernde Welle), der Ansatz am Körper bleibt.
* Blinzeln (Frames 12–15 und 37–40): das Auge (Augenweiß (6,10), Pupille (5,10)) verschwindet in der Fellfarbe A (138,72,54): erst das Augenweiß, dann beide, dann das Augenweiß wieder.
* Hufe tippen: vorderer Huf in Frames 8–9 und 36–37, hinterer Huf in 20–21 und 48–49 (die Fußzeile 15 des Beins entfällt kurz, der Huf rückt 1 px hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: die gesträubten Borsten sind Duplikate der vorhandenen Borstenpixel (1 px darüber); Randpixel-Korrektur (Regel 16): wo die Schwanzbewegung eine Füllfarbe an den
Rand schiebt, wird ein Umrisspixel ergänzt (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 64
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 4, 2

spr = L.lade('mountain-boars')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (xx >= 24) & (yy >= 9)
bein_v = vorhanden & (yy >= 15) & (xx >= 7) & (xx <= 11)
bein_h = vorhanden & (yy >= 15) & (xx >= 15) & (xx <= 20)
koerper = vorhanden & ~schwanz & ~bein_v & ~bein_h

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
FELL = (138, 72, 54)                                               # A: Fellfarbe (Lid)
BORSTE = (57, 31, 33)                                              # B
BORSTEN = [(7, 1), (9, 1), (10, 0), (12, 1), (13, 0), (15, 1), (16, 0), (18, 1)]     # von links nach rechts
AUGE = [(6, 10), (5, 10)]                                          # Auge: weißer Fleck F (6,10) und dunkle Pupille B (5,10)
ZEILE = 13                                                         # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    atem = 1 if (i % 28) in range(3, 17) else 0
    gesträubt = [any(s + 2 * k <= i < s + 2 * k + 4 for s in (10, 34)) for k in range(len(BORSTEN))]
    lid = 0
    for s in (12, 37):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    u = None
    for a_, e_ in ((5, 19), (30, 44)):
        if a_ <= i < e_:
            u = (i - a_) / float(e_ - a_)
    return atem, gesträubt, lid, u, 1 if i in (8, 9, 36, 37) else 0, 1 if i in (20, 21, 48, 49) else 0


def schwanz_wedeln(t, u):
    """Schwanzstrich (Spalten 24–30): jede Spalte wandert senkrecht, je weiter vom Körper desto mehr (bis 2 px), zweimal auf/ab; ohne Ausschlag (u=None) wie im Original."""
    if u is None:
        return t
    out = L.leer(H, W)
    for x in range(PAD_L + 24, PAD_L + 31):
        ys_ = np.nonzero(t[:, x, 3])[0]
        if not len(ys_):
            continue
        f = (x - (PAD_L + 24)) / 6.0
        dy = int(round(2.2 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.8 * f)))
        for y in ys_:
            out[y + dy, x] = t[y, x]
    return out


def frame(i, nur=None):
    atem, gestr, lid, u, tipp_v, tipp_h = zustand(i)
    k = teil(koerper)
    for (x, y), g in zip(BORSTEN, gestr):
        if g:
            k[PAD_T + y - 1, PAD_L + x, :3] = BORSTE
            k[PAD_T + y - 1, PAD_L + x, 3] = 255
    if lid:
        for (x, y) in (AUGE[:1] if lid == 1 else AUGE):
            k[PAD_T + y, PAD_L + x, :3] = FELL
    sw_ = schwanz_wedeln(teil(schwanz), u)
    bv = L.heben_unten(teil(bein_v), PAD_T + 15, tipp_v)
    bh = L.heben_unten(teil(bein_h), PAD_T + 15, tipp_h)
    k = L.streck_zeile(k, PAD_T + ZEILE, atem)
    sw_ = L.streck_zeile(sw_, PAD_T + ZEILE, atem)
    ebenen = {'koerper': k, 'schwanz': sw_, 'bein_v': bv, 'bein_h': bh}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('mountain-boars', 'Mountain Boars', frames, MS, prev)
    if prev:
        L.streifen(prev + '/mountain-boars-strip.png', frames, spalten=12, scale=6)
