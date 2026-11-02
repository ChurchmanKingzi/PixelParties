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
* RUNDE 2 (Nutzer: „besteht eigentlich alles aus Feuer – die oberen Outlines sollen auch wie Flammen etwas animiert sein“): Der GANZE Teil über dem Körperband
  (Zeilen 0–22: Flammenfächer und beide Flügel oben) wird mit dem Feuermodul anim_feuer.py (unverändert benutzt) als echtes Feuer gezeichnet: 6 Zungen im Fächer,
  je 4 an jedem Flügel; jede Zunge hat fünf verschachtelte Farbschichten (rote Außenhaut = Umriss, rot, orange, gelb, creme Kern), je Zunge eine eigene Folge aus
  12 Posen à 2–3 Frames (Höhe, Seitenneigung, S-Kurve, Breite wechseln, Kerne wandern auf und ab); die Spitzen laufen spitz zu und neigen sich, also schwankt
  auch die ÄUSSERE KONTUR (die obere Outline) wie Flammen. Die Zungen reißen oben ab und steigen als Funken auf (kühlen ab: creme → gelb → orange → rot).
  Das Körperband (Zeilen ≥ 23: cremefarbenes Federband, Gesicht) steht als feste Basis (anim_feuer `sperre`) und bleibt unverändert.
* Kräftiger Flügelschlag: viermal pro Schleife (Periode 9 Frames); jede Flügelspalte (Flammen UND Band) wandert senkrecht, je weiter außen, desto mehr: Spitze etwa −7 … +9 px
  (F.fluegel_welle mit Wellenlauf, Spalten bleiben ganz, Zusammenhang erzwungen). Die Spalten am Körperrand (links x ≥ 10, rechts x ≤ 25) stehen fest.
* Der Rest hebt sich beim Abschlag mit: Fächer und Flügel steigen bis 2–3 px, das Gesicht (ab Zeile 26) folgt etwas später; der Unterschied wird an Zeile 25
  (reines Creme-Band) durch Verdoppeln/Entfernen einer Zeile an Körper UND Flügeln ausgeglichen.
* Abreißende Funken (1 px, Feuerfunken nach Regel 15) steigen von den Zungenspitzen auf und folgen dem Flügelschlag (Startversatz = Bob + Flügelversatz der Spalte).
* Blinzeln (Frames 28–30).

Ergänzungen: keine nötig — die Flammen werden komplett neu gezeichnet (die Ruhepose weicht im Feuer vom Original ab; Feuer ist ausgenommen), das Körperband ist Original.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_feuer as FEU
import anim_amorph as A

N, MS = 36, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 16, 5

spr = L.lade('cute-phoenix')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
DUNKELROT = (159, 35, 32)
ZEILE = PAD_T + 25                                           # reines Creme-Band: hier wird ausgeglichen
BASIS_FAECHER, BASIS_FLUEGEL = 17, 20                         # ab dieser Sprite-Zeile steht die Feuerbasis fest (Fächer bzw. Flügel); darüber nur gezeichnetes Feuer

wing_l = vorhanden & (xx <= 9)
wing_r = vorhanden & (xx >= 26)
koerper = vorhanden & ~wing_l & ~wing_r

AUG_L = [(15, 27), (16, 27), (15, 28), (16, 28)]
AUG_R = [(19, 27), (20, 27), (19, 28), (20, 28)]
UMRISS = F.umriss_farben(spr)                                # Umrissfarben der Quelle (Randpixel-Test, Regel 16)


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Feuer (anim_feuer): alles über dem Körperband ─────────────────────────────────────────────────────────────────────────────
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': ORANGE, 'hell': GELB}
BASIS = vorhanden & (((xx >= 10) & (xx <= 25) & (yy >= BASIS_FAECHER)) | (((xx <= 9) | (xx >= 26)) & (yy >= BASIS_FLUEGEL)))   # feste Basis: Originalpixel
SPERRE = L.leer(H, W)[..., 3] > 0
SPERRE[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] = BASIS
# (x, Höhe in Pixeln) der Zungen im Sprite — Fächer 6 Zungen (mittlere am höchsten), je Flügel 4 Zungen (außen am höchsten)
FAECHER = [(11.0, 9), (13.7, 17), (16.4, 12), (19.1, 11), (21.8, 16), (24.5, 9)]
FLUEGEL_L = [(0.8, 10), (3.4, 7), (6.0, 6), (8.6, 8)]
FLUEGEL_R = [(35 - x, h) for x, h in FLUEGEL_L]
ZUNGEN = ([FEU.Zunge(PAD_L + x, PAD_T + BASIS_FAECHER - 1, h, 2.3) for x, h in FAECHER]
          + [FEU.Zunge(PAD_L + x, PAD_T + BASIS_FLUEGEL - 1, h, 2.0) for x, h in FLUEGEL_L + FLUEGEL_R])
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=5, posen=12, amplitude=0.95, sperre=SPERRE)

BAND = L.leer(H, W)                                          # festes Körperband auf der Leinwand
BAND[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw][BASIS] = spr[BASIS]
# Rote Innenstreifen der Basis (Täler zwischen Flügel und Fächer, KEINE Außenkante im Original) wirkten im neuen Feuer wie dunkle Flecken → Orange (Quellfarbe)
_innen_rot = BASIS & (spr[..., 0] == ROT[0]) & (spr[..., 1] == ROT[1]) & (spr[..., 2] == ROT[2]) & ~F.kanten(spr)
BAND[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw][_innen_rot, :3] = ORANGE


def schicht(a, x0, x1):
    """Spalten x0..x1 (Sprite-Koordinaten) einer Leinwandebene."""
    m = np.zeros(a.shape[:2], bool)
    m[:, PAD_L + x0:PAD_L + x1 + 1] = True
    t, _ = L.trenne(a, m)
    return t


def flug_dy(x, ph, hauptdy=0):
    """Versatz einer Funken-Startspalte x (Sprite-Koordinate) zur Phase ph: Flügelschlag der Spalte + Bob."""
    if x <= 9:
        return hauptdy + F.spalte_dy(WL_REF, PAD_L + 10, 8.0, ph, PAD_L + x, potenz=1.1, lauf=0.1, nur_rechts=False) - F.spalte_dy(WL_REF, PAD_L + 10, 8.0, 0.0, PAD_L + x, potenz=1.1, lauf=0.1, nur_rechts=False)
    if x >= 26:
        return hauptdy + F.spalte_dy(WR_REF, PAD_L + 25, 8.0, ph, PAD_L + x, potenz=1.1, lauf=0.1, nur_rechts=True) - F.spalte_dy(WR_REF, PAD_L + 25, 8.0, 0.0, PAD_L + x, potenz=1.1, lauf=0.1, nur_rechts=True)
    return hauptdy


WL_REF = schicht(BAND, 0, 9)
WL_REF = L.zusammen(H, W, [(WL_REF, 0, 0), (schicht(FEUER.ebene(0), 0, 9), 0, 0)])
WR_REF = schicht(BAND, 26, 35)
WR_REF = L.zusammen(H, W, [(WR_REF, 0, 0), (schicht(FEUER.ebene(0), 26, 35), 0, 0)])


def hub(i):
    """(Flügelphase, Bob Fächer/Flügel, Bob Gesicht) zum Frame i."""
    ph = L.sinus(i, N / 4)                                    # Flügelschlag: viermal pro Schleife (Periode 9)
    return ph, int(round(-2.2 * math.sin(ph))), int(round(-2.2 * math.sin(ph - 0.9)))


def funken_ebene(i, leben=12):
    """Abgerissene Spitzen als aufsteigende Funken (wie FEUER.funken), aber mit Flügel- und Bob-Versatz der Startspalte zum Abrisszeitpunkt."""
    e = L.leer(H, W)
    farben = [FEUER.farben[4], FEUER.farben[3], FEUER.farben[2], FEUER.farben[0]]
    for (f, x0, y0, drift) in FEUER.ereignisse:
        a = (i - f) % N
        if a >= leben:
            continue
        ph_f, haupt_f, kopf_f = hub(f)
        x = x0 + int(round(drift * a / 4.0)) + int(round(0.8 * math.sin(2 * math.pi * a / 8.0)))
        y = y0 + flug_dy(x0 - PAD_L, ph_f, haupt_f) - int(round(0.55 * a))
        if not (0 <= y < H and 0 <= x < W):
            raise L.ClipError(f'Funke bei ({x},{y}) außerhalb der Leinwand {W}×{H}')
        e[y, x, :3] = farben[min(len(farben) - 1, a * len(farben) // leben)]
        e[y, x, 3] = 255
    return e


def frame(i, partikel=True):
    ph, haupt, kopf = hub(i)
    n_str = max(-2, min(2, kopf - haupt))

    flammen = FEUER.ebene(i)
    kp = L.zusammen(H, W, [(schicht(BAND, 10, 25), 0, 0), (schicht(flammen, 10, 25), 0, 0)])
    wl = L.zusammen(H, W, [(schicht(BAND, 0, 9), 0, 0), (schicht(flammen, 0, 9), 0, 0)])
    wr = L.zusammen(H, W, [(schicht(BAND, 26, 35), 0, 0), (schicht(flammen, 26, 35), 0, 0)])

    # Blinzeln
    if i in (28, 30):
        F.setze(kp, PAD_L, PAD_T, {p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])})
    if i == 29:
        F.setze(kp, PAD_L, PAD_T, {**{p: GELB for p in (AUG_L[0], AUG_L[1], AUG_R[0], AUG_R[1])},
                                   **{p: ROT for p in (AUG_L[2], AUG_L[3], AUG_R[2], AUG_R[3])}})

    # kräftiger Flügelschlag: Spitze etwa −7 … +9 px
    wl = F.fluegel_welle(wl, PAD_L + 10, 8.0, ph, potenz=1.1, nur_rechts=False, lauf=0.1, zusammenhang=True)
    wr = F.fluegel_welle(wr, PAD_L + 25, 8.0, ph, potenz=1.1, nur_rechts=True, lauf=0.1, zusammenhang=True)

    # Bob: Zeile 25 gleichmäßig an allen Ebenen strecken/kürzen, dann alles um die Gesichtsbewegung verschieben
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, kopf) for a in (kp, wl, wr))

    f = L.zusammen(H, W, [(kp, 0, 0), (wl, 0, 0), (wr, 0, 0)])
    # Randpixel-Test (Regel 16): Spaltenversatz legt an den Flügelrändern Innenfarbe frei → Kante in Umrissfarbe
    F.umranden(f, [wl, wr], UMRISS, ORANGE, GELB, GELB)
    f, _ = A.verbinde4(f)                                     # eine Flammenspitze, die der Flügelschlag nur über eine Pixelecke hält, bekommt ein Brückenpixel (Außenhautfarbe)
    if partikel:
        f = L.zusammen(H, W, [(funken_ebene(i), 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cute-phoenix', 'Cute Phoenix', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-phoenix-strip.png', frames, spalten=9, scale=3)
