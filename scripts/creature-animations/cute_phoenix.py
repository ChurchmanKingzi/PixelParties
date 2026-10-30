# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Phoenix“ (Creature) — Regeln 14/15 (Feuer wie Feuer, kein Glanz) und kräftiger Flügelschlag.

PICK: [["MotiveMoe", 354, 1]]   (Ebene „Final Trial #7“, Figur 1; Ebene 368 Figur 2 ist identisch, Ebenen 224/414 haben ein anderes Gesicht)
Quelle: src/cute-phoenix.png — Feuervogel (36×32 px, nur 6 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 cute_phoenix.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-phoenix.png + .json

Identifikation (x, y):
* Farbrampe der Flamme (dunkel → hell): Rot (202,44,41) = Zungenspitzen/Rand, Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184) = heller Kern;
  Dunkelrot (159,35,32) = Gesichtsumriss, Pink (255,139,255) = Wangen.
* Schwanz-/Flammenfächer (x 10–25, y 0–22): hohe rote Flammenzungen oben, nach unten orange → gelb → creme Kern.
* Flügel (links x 0–9, rechts x 26–35, y 10–27): waagerecht gespreizt, oben gezackte rote Federflammen, darunter gelbe/orange Federn und ein breites cremefarbenes
  Band (y 23–27), das in der Mitte in den Körper übergeht.
* Gesicht (Mitte unten, x 14–21, y 26–31): Augen je 2×2 px ((15–16, 27–28) und (19–20, 27–28): dunkelrot/rot mit cremefarbenem Glanzpixel (16,28) und (19,28)),
  pinke Wangen (15,29) und (20,29), orange Stirn (17–18, 26), Schnabel/Kinn gelb–rot (17–18, 28–31).
* Die Kunst enthält zwei weitere Gesichter (Ebenen 224 und 414); sie werden nicht verwendet.

Ablauf (36 Frames à 70 ms = 2,52 s):
* ECHTER Flügelschlag (Nutzerwunsch): Jeder Flügel (die Flammenschwinge) dreht sich als Ganzes um den Schulteransatz (links Pixel (9, 24), rechts (26, 24) — das
  Creme-Band am Körperrand; die Wurzel bleibt dort 4-verbunden), viermal pro Schleife (Periode 9 Frames): Abschlag ca. 40° unter die Waagerechte, Aufschlag
  ca. 65° darüber (Flügelspitze beschreibt einen großen Bogen); der Aufschlag ist langsamer als der Abschlag (Rückholen). Ruhepose = waagerecht = Original. Drehung
  per Rückwärtsabbildung (Nächster-Nachbar, keine Mischfarben, Alpha 0/255); die Kanten werden nachgezeichnet (Randpixel-Test, Regel 16).
* Der Körper hebt sich beim Abschlag mit (bis 3 px, Fächer/Flügelansatz zuerst, Gesicht etwas später; Ausgleich an Zeile 25).
* Feuer wie Feuer, Farbschichten UNABHÄNGIG (Regel 15, Nutzerwunsch): Je Spalte schwanken die Schichtgrenzen Rot-Außenhaut / Orange / Gelb / Creme-Kern jeweils mit eigener
  Höhe und Neigung (je Zunge und Grenze eine eigene Pose-Tabelle, 12 Posen à 3 Frames, gegeneinander versetzt); die Spalte wird zwischen den Grenzen linear gedehnt/gestaucht.
  So bewegen sich auch die hellen Farben und der cremefarbene Kern, nicht nur die Spitzen. Die Basis (ab Zeile 22: Creme-Band, Gesicht) bleibt ruhig. Kein Lichtband, keine Sterne.
* Abreißende Funken: von den Zungenspitzen steigen kleine runde Funken (Rot/Orange/Gelb) langsam auf (14 Partikel, Formen k, s).
* Blinzeln (Frames 28–30).

Ergänzungen: keine nötig — Flügel und Fächer überlappen sich im Original nirgends, es gibt keine verdeckten Teile.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 36, 70
PAD_L, PAD_R, PAD_T, PAD_B = 16, 16, 22, 14

spr = L.lade('cute-phoenix')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
DUNKELROT = (159, 35, 32)
KERN = [GELB, CREME]                                         # heller Kern: hier setzt die Zunge an
HEISS = {ROT: 0, ORANGE: 1, GELB: 2, CREME: 3}                # Farbschichten von außen (kühl) nach innen (heiß)
Y_ENDE = PAD_T + 22                                          # ab hier (Creme-Band) steht die Basis ruhig

wing_l = vorhanden & (xx <= 9)
wing_r = vorhanden & (xx >= 26)
koerper = vorhanden & ~wing_l & ~wing_r

AUG_L = [(15, 27), (16, 27), (15, 28), (16, 28)]
AUG_R = [(19, 27), (20, 27), (19, 28), (20, 28)]
UMRISS = F.umriss_farben(spr)                                # Umrissfarben der Quelle (Randpixel-Test, Regel 16)
ZEILE = PAD_T + 25                                           # reines Creme-Band: hier wird ausgeglichen


def px(x, y):
    return PAD_L + x, PAD_T + y


# Zungenspitzen im Ausgangsbild → Startpunkte der abreißenden Funken
SPITZEN_F = F.zungen_spitzen(F.ebene(spr, koerper, H, W, PAD_L, PAD_T), KERN)
SPITZEN_L = F.zungen_spitzen(F.ebene(spr, wing_l, H, W, PAD_L, PAD_T), KERN)
SPITZEN_R = F.zungen_spitzen(F.ebene(spr, wing_r, H, W, PAD_L, PAD_T), KERN)


def funken(spitzen, ab, anzahl, formen, vy, vx=0):
    res = []
    spitzen = sorted(spitzen, key=lambda p: p[1])[:anzahl]
    for k, (x, y) in enumerate(spitzen):
        res.append(dict(x=x, y=y - 1, vx=vx, vy=vy, off=(ab + k * 7) % N, form=formen[k % len(formen)], wackeln=1))
    return res


FUNKEN1 = {'c': ORANGE, 'r': ROT}                            # Funken: orange Kern, roter Rand (frisch von der Spitze)
FUNKEN2 = {'c': GELB, 'r': ORANGE}                           # heißere Funken
PUFFS1 = funken(SPITZEN_F, 0, 5, ('k', 's'), -13) + funken(SPITZEN_L, 5, 2, ('k',), -11, -1) + funken(SPITZEN_R, 11, 2, ('k',), -11, 1)
PUFFS2 = funken(SPITZEN_F[1:], 17, 3, ('k', 's'), -14) + funken(SPITZEN_L[1:], 23, 1, ('k',), -12, -1) + funken(SPITZEN_R[1:], 29, 1, ('k',), -12, 1)


def frame(i, partikel=True):
    ph = L.sinus(i, N / 4)                                    # Flügelschlag: viermal pro Schleife (Periode 9)
    ph2 = ph + 0.4 * math.sin(ph)                             # Abschlag schneller als Aufschlag (Rückholen)
    C, A = math.radians(12.5), math.radians(52.5)             # Winkel: −40° … +65° gegenüber waagerecht (Ruhe = 0)
    phi0 = math.asin(-C / A)
    theta = C + A * math.sin(ph2 + phi0)                      # im Uhrzeigersinn positiv = linke Spitze steigt
    c0 = math.cos(phi0 - 0.3)
    haupt = int(round(1.6 * (math.cos(ph2 + phi0 - 0.3) - c0)))        # Körper hebt sich beim Abschlag (negativ = hoch) …
    kopf = int(round(1.6 * (math.cos(ph2 + phi0 - 1.1) - math.cos(phi0 - 1.1))))   # … das Gesicht hinterher
    n_str = max(-2, min(2, kopf - haupt))

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wl = F.ebene(spr, wing_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(spr, wing_r, H, W, PAD_L, PAD_T)

    # Blinzeln
    if i in (28, 30):
        F.setze(kp, PAD_L, PAD_T, {p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])})
    if i == 29:
        F.setze(kp, PAD_L, PAD_T, {**{p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])},
                                   **{p: ROT for p in (AUG_L[2], AUG_L[3], AUG_R[2], AUG_R[3])}})

    # Feuer: Farbschichten schwanken unabhängig (Regel 15), je Teil eigene Zufallsfolge
    kp = F.feuer_schichten(kp, i, N, HEISS, Y_ENDE, seed=11)
    wl = F.feuer_schichten(wl, i, N, HEISS, Y_ENDE, seed=23)
    wr = F.feuer_schichten(wr, i, N, HEISS, Y_ENDE, seed=37)

    # Flügelschlag: ganze Schwinge dreht sich um den Schulteransatz
    wl = F.drehen(wl, PAD_L + 9, PAD_T + 24, theta)
    wr = F.drehen(wr, PAD_L + 26, PAD_T + 24, -theta)

    # Bob: Zeile 25 gleichmäßig an allen Ebenen strecken/kürzen, dann alles um die Gesichtsbewegung verschieben
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, kopf) for a in (kp, wl, wr))

    glut = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(glut, 0, 0), (kp, 0, 0), (wl, 0, 0), (wr, 0, 0)])
    # Randpixel-Test (Regel 16): Drehung/Dehnung legt Innenfarbe an den Rändern frei → Kante in Umrissfarbe (Gelb unten/seitlich, Orange oben)
    F.umranden(f, [wl, wr], UMRISS, ORANGE, GELB, GELB)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-phoenix', 'Cute Phoenix', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-phoenix-strip.png', frames, spalten=9, scale=3)
