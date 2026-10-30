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
* Kräftiger Flügelschlag: viermal pro Schleife (Periode 9 Frames); jede Flügelspalte wandert senkrecht, je weiter außen, desto mehr: Spitze etwa −7 … +9 px
  (F.fluegel_welle mit Wellenlauf, Spalten bleiben ganz, Zusammenhang erzwungen). Die Spalten am Körperrand (links x ≥ 10, rechts x ≤ 25) stehen fest.
* Der Rest hebt sich beim Abschlag mit: Fächer und Flügel steigen bis 2–3 px, das Gesicht (ab Zeile 26) folgt etwas später; der Unterschied wird an Zeile 25
  (reines Creme-Band) durch Verdoppeln/Entfernen einer Zeile an Körper UND Flügeln ausgeglichen.
* Feuer wie Feuer (Regel 15): Die FLÜGEL-Zungen flackern unverändert unregelmäßig in 12 Posen à 3 Frames; jede Zunge (Gipfel der Silhouette) hat ihre eigene Pose-Tabelle und
  einen eigenen Versatz. Der Teil über dem hellen Kern (rote Spitze, orange Mitte) wird gestreckt/gestaucht, die Farbfolge wandert mit der Zunge; Kern und Basis bleiben ruhig.
  Kein Lichtband, keine Sterne.
* Der Flammenfächer (Körper, Mitte) flackert stärker (Nutzerwunsch): F.feuer_schichten — die Farbschichten Rot-Außenhaut / Orange / Gelb / heller Creme-Kern schwanken je Spalte mit
  eigener Höhe und Neigung gegeneinander (12 Posen à 3 Frames je Zunge und Schicht), der helle Kern wandert also mit auf und ab; die Basis (ab Zeile 22) bleibt ruhig.
* Abreißende Funken: von den Zungenspitzen steigen kleine runde Funken (Rot/Orange/Gelb) langsam auf (Formen k, s) — 14 vom Körper (vorher 8) + 6 von den Flügeln = 20 Partikel.
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
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 20, 16

spr = L.lade('cute-phoenix')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
DUNKELROT = (159, 35, 32)
KERN = [GELB, CREME]                                         # heller Kern: hier setzt die Zunge an
HEISS = {ROT: 0, ORANGE: 1, GELB: 2, CREME: 3}                # Farbschichten von außen (kühl) nach innen (heiß)
Y_ENDE = PAD_T + 22                                          # ab hier (Creme-Band) steht die Basis des Fächers ruhig

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


def fan_funken(spalten, ab, formen, vy, abstand=6):
    """Zusätzliche Funken vom Fächer: Start an der obersten Pixelzeile der angegebenen Fächerspalten (Ruhepose)."""
    top = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    res = []
    for k, x in enumerate(spalten):
        ys = np.nonzero(top[:, PAD_L + x, 3])[0]
        res.append(dict(x=PAD_L + x, y=int(ys.min()) - 1, vx=(-1, 0, 1)[k % 3], vy=vy - (k % 2), off=(ab + k * abstand) % N,
                        form=formen[k % len(formen)], wackeln=1))
    return res


PUFFS1 = PUFFS1 + fan_funken((12, 14, 17, 22, 24, 20), 3, ('k', 's', 'k'), -12, 6)           # mehr abreißende Funken am Fächer
PUFFS2 = PUFFS2 + fan_funken((11, 15, 19, 21, 23, 16), 9, ('k', 'k', 's'), -13, 6)


def frame(i, partikel=True):
    ph = L.sinus(i, N / 4)                                    # Flügelschlag: viermal pro Schleife (Periode 9)
    haupt = int(round(-2.2 * math.sin(ph)))                   # Fächer/Flügel steigen beim Abschlag …
    kopf = int(round(-2.2 * math.sin(ph - 0.9)))              # … das Gesicht hinterher
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

    # Feuer: Zungen flackern (Regel 15), je Teil eigene Zufallsfolge
    kp = F.feuer_schichten(kp, i, N, HEISS, Y_ENDE, seed=11, amp=(4.5, 3.5, 3.0, 2.5))      # Fächer: Farbschichten schwanken gegeneinander, Kern wandert
    wl = F.feuer_zungen(wl, i, N, KERN, pose_frames=3, seed=23, hub=0.34)
    wr = F.feuer_zungen(wr, i, N, KERN, pose_frames=3, seed=37, hub=0.34)

    # kräftiger Flügelschlag: Spitze etwa −7 … +9 px
    wl = F.fluegel_welle(wl, PAD_L + 10, 8.0, ph, potenz=1.1, nur_rechts=False, lauf=0.1, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 25, 8.0, ph, potenz=1.1, nur_rechts=True, lauf=0.1, zusammenhang=True)

    # Bob: Zeile 25 gleichmäßig an allen Ebenen strecken/kürzen, dann alles um die Gesichtsbewegung verschieben
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, kopf) for a in (kp, wl, wr))

    glut = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, FUNKEN1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, FUNKEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(glut, 0, 0), (kp, 0, 0), (wl, 0, 0), (wr, 0, 0)])
    # Randpixel-Test (Regel 16): Spaltenversatz legt an den Flügelrändern Innenfarbe (Creme) frei → Kante in Umrissfarbe (Gelb unten/seitlich, Orange oben)
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
