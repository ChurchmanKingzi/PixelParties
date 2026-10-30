# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Phoenix“ (Creature).

PICK: [["MotiveMoe", 354, 1]]   (Ebene „Final Trial #7“, Figur 1; Ebene 368 Figur 2 ist identisch, Ebenen 224/414 haben ein anderes Gesicht)
Quelle: src/cute-phoenix.png — Feuervogel (36×32 px, nur 6 Farben) aus MotiveMoe.xcf.

Aufruf:   python3 cute_phoenix.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-phoenix.png + .json

Identifikation (x, y):
* Farbrampe der Flamme (dunkel → hell): Rot (202,44,41) = äußerer Rand, Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184) =
  glühender Kern; Dunkelrot (159,35,32) = Gesichtsumriss, Pink (255,139,255) = Wangen.
* Schwanz-/Flammenfächer (x 10–25, y 0–22): hohe rote Flammenzungen oben, nach unten orange → gelb → creme Kern.
* Flügel (links x 0–9, rechts x 26–35, y 10–27): waagerecht gespreizt, oben gezackte rote Federflammen, darunter gelbe/orange Federn und
  ein breites cremefarbenes Band (y 23–27), das in der Mitte in den Körper übergeht.
* Gesicht (Mitte unten, x 14–21, y 26–31): Augen je 2×2 px ((15–16, 27–28) und (19–20, 27–28): dunkelrot/rot mit cremefarbenem Glanzpixel
  (16,28) und (19,28)), pinke Wangen (15,29) und (20,29), orange Stirn (17–18, 26), Schnabel/Kinn gelb–rot (17–18, 28–31).
* Die Kunst enthält zwei weitere Gesichter (Ebenen 224 und 414); sie werden nicht verwendet.

Ablauf (40 Frames à 70 ms = 2,8 s):
* Flügelschlag: viermal pro Schleife (Periode 10 Frames); jede Flügelspalte wandert senkrecht (Spitze etwa −3 … +5 px), je weiter außen,
  desto mehr, die Spitze hinkt nach (F.fluegel_welle, Ruhepose = Original). Die Spalten am Körperrand (links x ≥ 10, rechts x ≤ 25)
  bleiben stehen, erst weiter außen biegt sich der Flügel (keine Tasche zwischen Flügel und Fächer).
* Schwebe-Bob zweistufig: Fächer und Flügel heben sich bis 2 px, das Gesicht (ab Zeile 26) folgt etwas später. Der Unterschied wird
  an Zeile 25 (reines Creme-Band) durch Verdoppeln/Entfernen einer Zeile ausgeglichen — an Körper UND Flügeln gleichermaßen.
* Flammenzungen züngeln: rote Flammenspitzen von Fächer und Flügelrand werden 0…2 px länger/kürzer, jede Zunge mit eigener Phase
  (Fächer: Periode 10 Frames, Flügel: Periode 8), nur an den Spaltenenden — die Figur bleibt 4-verbunden.
* Lichtband: zweimal pro Schleife läuft ein diagonales Band über die ganze Flamme (Pixel eine, im Kern zwei Stufen heller auf der Rampe
  Rot → Orange → Gelb → Creme). Der gelbe Kern pulsiert (gelbe Pixel blitzen creme auf, die Hellphase wandert diagonal).
* Glitzer-Sterne (vierzackig, wachsen/schrumpfen, bleiben an den Flammenspitzen von Fächer und beiden Flügeln): vier pro Schleife.
* Blinzeln (Frames 31–33), Augenglanzpunkte pulsieren.
* Aufsteigende Glut (Partikel): zwölf kleine gelbe/orange Funken, Punkte und Kreise sowie cremefarbene Funken steigen langsam auf.

Ergänzungen: keine nötig — Flügel und Fächer überlappen sich im Original nirgends, es gibt keine verdeckten Teile.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 40, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 16, 9

spr = L.lade('cute-phoenix')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
DUNKELROT = (159, 35, 32)
RAMPE = [ROT, ORANGE, GELB, CREME]                          # Glut: dunkel → hell

wing_l = vorhanden & (xx <= 9)
wing_r = vorhanden & (xx >= 26)
koerper = vorhanden & ~wing_l & ~wing_r
kern = L.farbmaske(spr, [GELB]) & (yy >= 11)                 # gelbe Pixel: pulsieren (blitzen creme auf)

AUG_L = [(15, 27), (16, 27), (15, 28), (16, 28)]
AUG_R = [(19, 27), (20, 27), (19, 28), (20, 28)]
GLANZ = [(16, 28), (19, 28)]                                 # Augen-Glanzpixel (creme)
ZEILE = PAD_T + 25                                           # reines Creme-Band: hier wird ausgeglichen


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


GLUT1 = {'c': GELB, 'r': ORANGE}                             # gelber Kern, orangefarbener Rand
GLUT2 = {'c': CREME, 'r': GELB}                              # heiße Funken
PUFFS1 = puffs([
    (13, 2, 0, -12, 0, 'k', 1), (18, 4, 0, -11, 7, 's', 1), (23, 2, 1, -12, 14, 'k', 1), (15, 3, -1, -10, 21, 'o', 1),
    (21, 4, 1, -11, 28, 's', 1), (11, 8, -1, -10, 34, 'k', 1),
    (2, 12, -1, -9, 3, 'k', 1), (7, 13, 0, -9, 17, 's', 1), (33, 12, 1, -9, 10, 'k', 1), (28, 13, 0, -9, 25, 's', 1),
])
PUFFS2 = puffs([
    (17, 1, 0, -13, 4, 'k', 1), (24, 5, 1, -11, 19, 'k', 1), (3, 14, 0, -10, 31, 'k', 1), (31, 14, 0, -10, 12, 'k', 1),
])


def spitze(f, x_sprite):
    """Oberste belegte Zeile (Leinwand) der Spalte x des Sprites im fertigen Frame."""
    ys = np.nonzero(f[:, PAD_L + x_sprite, 3])[0]
    return int(ys.min())


def frame(i, partikel=True):
    ph = L.sinus(i, N / 4)                                    # Flügelschlag: viermal pro Schleife
    haupt = int(round(-1.8 * math.sin(ph)))                   # Fächer/Flügel zuerst …
    kopf = int(round(-1.8 * math.sin(ph - 0.9)))              # … das Gesicht hinterher
    n_str = kopf - haupt
    zunge1 = L.sinus(i, N / 4)                                # Flammenzungen Fächer: Periode 10
    zunge2 = L.sinus(i, N / 5)                                # Flammenzungen Flügel: Periode 8

    ganz = vorhanden
    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    wl = F.ebene(spr, wing_l, H, W, PAD_L, PAD_T)
    wr = F.ebene(spr, wing_r, H, W, PAD_L, PAD_T)

    # Blinzeln + Augenglanz
    if i in (31, 33):
        F.setze(kp, PAD_L, PAD_T, {p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])})
    if i == 32:
        F.setze(kp, PAD_L, PAD_T, {**{p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])},
                                   **{p: ROT for p in (AUG_L[2], AUG_L[3], AUG_R[2], AUG_R[3])}})
    elif 6 <= i % 20 <= 8 and i not in (31, 32, 33):          # Glanzpixel blitzt auf (creme → gelb → creme)
        F.setze(kp, PAD_L, PAD_T, {p: GELB for p in GLANZ})

    # Glut pulsiert (gelbe Pixel blitzen creme auf) und Lichtband (zweimal pro Schleife)
    for ebene_ in (kp, wl, wr):
        ys, xs = np.nonzero(kern)
        for y, x in zip(ys, xs):
            if F.puls(i, N, x, y, periode=4, versatz=0.7):
                if ebene_[PAD_T + y, PAD_L + x, 3]:
                    ebene_[PAD_T + y, PAD_L + x, :3] = F.heller(ebene_[PAD_T + y, PAD_L + x, :3], RAMPE, 1)
        F.lichtband(ebene_, ganz, PAD_L, PAD_T, i, N // 2, 4, 14, RAMPE, stufen=1, breite=3.0, achse=(1.0, 0.7), kern_stufen=2)

    kp = F.flammen_spitzen(kp, zunge1, ROT, lauf=1.3)
    wl = F.flammen_spitzen(wl, zunge2 + 0.8, ROT, lauf=1.1)
    wr = F.flammen_spitzen(wr, zunge2 + 2.1, ROT, lauf=1.1)

    fl_amp, fl_pot, lauf = 3.8, 1.3, 0.3
    wl = F.fluegel_welle(wl, PAD_L + 10, fl_amp, ph, potenz=fl_pot, nur_rechts=False, lauf=lauf)
    wr = F.fluegel_welle(wr, PAD_L + 25, fl_amp, ph, potenz=fl_pot, nur_rechts=True, lauf=lauf)

    # Bob: Zeile 25 gleichmäßig an allen Ebenen strecken/kürzen, dann alles um die Gesichtsbewegung verschieben
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, kopf) for a in (kp, wl, wr))

    glut = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, GLUT1), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, GLUT2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(glut, 0, 0), (kp, 0, 0), (wl, 0, 0), (wr, 0, 0)])

    # Glitzer-Sterne an den Flammenspitzen (bleiben AM Objekt, folgen dessen Bewegung)
    for (xs_, start) in ((13, 2), (1, 12), (34, 22), (23, 31)):
        st = F.stern_stufe(i, N, start, (0, 1, 2, 1))
        if st is not None:
            F.stern(f, PAD_L + xs_, spitze(f, xs_) - 1, st, CREME, GELB, ORANGE)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-phoenix', 'Cute Phoenix', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-phoenix-strip.png', frames, spalten=8, scale=4)
