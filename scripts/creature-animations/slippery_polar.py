# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Polar“ (Creature) — Runde 2: die vermeintlichen „Räder“ sind PFOTEN und treten abwechselnd (kein Raddrehen mehr).

Nutzerkorrektur (wörtlich): „Slippery Polar hat KEINE Reifen/Räder, die sich drehen sollten; das sind Pfoten.“

Quelle: src/slippery-polar.png — der Eisbär (44×23 px, 16 Farben) aus Motive.xcf, Ebene 803 „Polar“ (die Ebene enthält nur diesen Bären; die graue Wischspur
hinter ihm im Kartenbild ist eine eigene, geteilte Ebene und gehört nicht zur Creature).
PICK: [["Motive", 803, 1]]

Aufruf:   python3 slippery_polar.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-polar.png + .json

Identifikation (Sprite 44×23, weißer Eisbär im Profil, nach links blickend; Farben A (85,83,84) Rückenlinie, B (7,6,1) Nase, C (255,255,255) Fell weiß, E/F creme, G/H/J dunkle Augen-/Nasenpartie,
I/D/N/K/L Grautöne des Schattenfells, M (51,50,50) Umriss, O (38,35,36)/P (28,28,28) Pfotenschwarz):
* Kopf (x 0–12, Zeilen 0–11): Nase = schwarzer 2×2-Block (0–1, 5–6), Auge = dunkler 2×2-Block (6–7, 4–5), zwei Ohren oben (x 6–12, Zeilen 0–2) mit dunklem Ohrinneren, unten ein geöffneter Mund (grauer Unterkiefer).
* Körper (x 8–43, Zeilen 4–15): weiß mit grauer Oberlinie (Rücken), gerundete Hüfte rechts, grau schattierter Bauch (x 25–31, Zeilen 15–19, unten Umrisszeile 19).
* ZWEI PFOTEN (nicht Räder): vordere Pfote x 16–24 und hintere Pfote x 32–40, je Zeilen 18–22: schwarze, oben abgerundete Ballen O/P mit einem weißen Fellbogen C (Zehenfell) in Zeile 18–19; darüber
  gehen die grauen Beine (Schattenfell K/L) mit einem Schachbrett aus dunklen Pixeln (Zeilen 16–17, Fellübergang zum Ballen) in die Pfote über. Der weiße Bogen gehört zur Pfote und wandert mit.
* Kein Fell-Glanz, kein Metall im Bild (Regel 14). Keine Partikel.
Bleibt fest: Kopfform, Nase, Mundumriss, Rückenlinie, Hüfte, Bauch, die Fellübergänge der Beine (Zeilen 14–17).

Ablauf (64 Frames à 66 ms = 4,2 s), alle Bewegungen unabhängig:
* Pfoten treten (Periode 32 Frames, 2 Zyklen pro Schleife; die Pfoten sind eigene Ebenen): vorn und hinten abwechselnd (Versatz ½ Zyklus) — die Pfote hebt ab (bis 2 px), kippt dabei kurz (untere Zeilen
  starr 1 px nach hinten, dann beim Aufsetzen 1 px nach vorn), schwingt 2 px nach vorn (links), setzt auf und wandert am Boden ±2 px nach hinten (rechts). Der Boden bleibt: die Standpfote steht auf Zeile 22.
  Das ist der Laufzyklus eines schweren Bären (Schwungphase 35 %, Standphase 65 %).
* Körper federt: nach jedem Aufsetzen sackt der Bär (Kopf, Rumpf, Ohren) 1 px ein und kommt dann wieder hoch (je 5 Frames, 2× pro Zyklus).
* Ohrzucken: die Ohrspitzen (Zeilen 0–1) schnippen 1 px nach hinten (rechts), 3× pro Schleife (Frames 6, 28, 50).
* Blinzeln (Frames 12–15 und 40–43): das Auge (6–7, 4–5) wird erst oben, dann ganz zur Fellfarbe A (247,240,230) des Kopfes, dann wieder offen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel außer der Randpixel-Korrektur (Regel 16): wo Ohrschnipser oder Einsacken eine Füllfarbe an den Rand schieben, wird ein Umrisspixel ergänzt
(anim_tiere.umriss_schliessen). Die Pfoten laufen als eigene Ebene VOR dem Körper (dessen Fellübergang in den Zeilen 16–17 steht fest und bleibt als Bein sichtbar).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_tier as G

N, MS = 64, 66
ZYKLUS = 32
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 3

spr = L.lade('slippery-polar')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (yy <= 1) & (xx >= 6) & (xx <= 12)
pfote_v = vorhanden & (yy >= 18) & (xx >= 16) & (xx <= 24) & ~((yy == 19) & (xx == 24))      # vordere Pfote (Zeilen 18–22)
pfote_h = vorhanden & (yy >= 18) & (xx >= 32) & (xx <= 40)                                    # hintere Pfote
koerper = vorhanden & ~ohr & ~pfote_v & ~pfote_h
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

FELL = (247, 240, 230)                                             # A: Kopffarbe (Lid)
AUGE = [(6, 4), (7, 4), (6, 5), (7, 5)]
TEST_EBENEN = ['koerper', 'ohr']
SCHWUNG, AMP, HUB = 0.35, 1.6, 2.0


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def pfoten_pose(i, versatz):
    """(dx, lift, kippen) der Pfote zum Frame i; kippen = −1/0/+1: untere Zeilen nach hinten (+) bzw. vorn (−)."""
    f = (i + START) / float(ZYKLUS) + versatz
    dx, lift = G.gang(f, AMP, SCHWUNG, HUB)
    kipp = 0
    if lift > 0:
        p = (f % 1.0) / SCHWUNG
        kipp = G.runde(1.2 * math.cos(math.pi * p))
    return G.runde(dx), G.runde(lift), kipp


def _start():
    """Phase von Frame 0: beide Pfoten stehen am Boden und möglichst senkrecht (Ruhepose)."""
    best, bw = 0, 99
    for s in range(ZYKLUS):
        w = 0
        for v in (0.0, 0.5):
            f = s / float(ZYKLUS) + v
            dx, lift = G.gang(f, AMP, SCHWUNG, HUB)
            w += abs(dx) + 10 * lift
        fe = s / float(ZYKLUS)
        for land in (SCHWUNG, (SCHWUNG + 0.5) % 1.0):
            if (fe - land) % 1.0 < 5.0 / ZYKLUS:
                w += 5                                             # Frame 0 nicht mitten im Einsacken
        if w < bw:
            best, bw = s, w
    return best


START = _start()


def pfote_ebene(maske, dx, lift, kipp):
    t = teil(maske)
    rows = {}
    for y in range(18, 23):
        s = G.runde(kipp * (y - 18) / 4.0)
        rows[PAD_T + y] = s
    t = G.zeilen_versatz(t, rows)
    return L.versetze(t, dx, -lift)


def zustand(i):
    lid = 0
    for s in (12, 40):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    ohr_h = max(T.huellkurve(i, N, s, 6) for s in (6, 28, 50))
    # Einsacken: 5 Frames nach dem Aufsetzen der vorderen (Phase 0,35) und hinteren Pfote (0,85)
    fe = ((i + START) % ZYKLUS) / float(ZYKLUS)
    sack = 0
    for land in (SCHWUNG, (SCHWUNG + 0.5) % 1.0):
        d = (fe - land) % 1.0
        if d < 5.0 / ZYKLUS:
            sack = 1
    return lid, ohr_h, sack


def frame(i, nur=None):
    lid, ohr_h, sack = zustand(i)
    k = teil(koerper)
    if lid:
        for (x, y) in (AUGE[:2] if lid == 1 else AUGE):
            k[PAD_T + y, PAD_L + x, :3] = FELL
    ohr_t = T.zucken_zeilen(teil(ohr), PAD_T + 2, 1.2 * ohr_h, {PAD_T + 0: 1.0, PAD_T + 1: 1.0}, innen='links')
    k = L.versetze(k, 0, sack)
    ohr_t = L.versetze(ohr_t, 0, sack)
    pv = pfote_ebene(pfote_v, *pfoten_pose(i, 0.0))
    ph = pfote_ebene(pfote_h, *pfoten_pose(i, 0.5))
    ebenen = {'koerper': k, 'ohr': ohr_t, 'pfote_v': pv, 'pfote_h': ph}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('slippery-polar', 'Slippery Polar', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-polar-strip.png', frames, spalten=12, scale=5)
