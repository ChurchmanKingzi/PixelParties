# -*- coding: utf-8 -*-
"""Idle-Animation für „Lunatic Hawk“ (Creature) — goldener Falke mit fünf Lunatic-Kugeln, fliegt (Dauerschlag + Bob).

PICK: [["MotiveGN", 213, "Lunatic Hawk (Falke)"], ["MotiveGN", 212, "Ebene #262 (die fünf Kugeln)"]]
Quelle: src/lunatic-hawk.png — Falke (Ebene „Lunatic Hawk“, 47×42 px) + Kugeln (Ebene „Ebene #262“, 45×25 px) aus MotiveGN.xcf, mit ihren Ebenen-Versätzen auf eine 47×43-Leinwand
gelegt (Alpha 253/255 des Falken → 255; die Ebene hat in der xcf 50 % Deckkraft, das ist ein Karteneffekt). Zusätzlich liegen die Teile einzeln vor:
  src/lunatic-hawk-falke.png   Falke ohne Kugeln (vollständig, auch unter den Kugeln)
  src/lunatic-hawk-orbs.png    die fünf Kugeln
Nicht verwendet: die weichen Leucht-Ebenen der Karte (Ebene #261/#234/#141, Alphaverläufe) — Glow-Hintergrund, kein Sprite.

Aufruf:   python3 lunatic_hawk.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/lunatic-hawk.png + .json

Identifikation (Sprite-Koordinaten x, y; spiegelsymmetrisch um x = 23):
* Falke von vorn mit nach oben gespreizten Flügeln (V-Form), nur 11 Gelbtöne: Umriss (213,170,33), Federn (244,214,66)/(249,238,103)/(249,243,174), Lichter (249,247,224).
  - Flügel: links x 0–19, rechts x 27–46 (y 0–32), Spitzen oben außen (x 2–4 / 42–44, y 0), Ansatz an den Schultern bei x 19 / 27 (y 14–31).
  - Kopf/Brust (x 20–26, y 21–33): Kopf oben (y 21–27) mit dunkleren Schnabel-/Augenstrichen (22,26) (24,26) (23,27–28) — keine eindeutigen Augen, deshalb kein Blinzeln.
  - Beine/Krallen und Schwanz (y 34–42, x 16–30): zwei Fänge mit Krallen, Mitte Schwanz.
* Fünf goldene Kugeln (Lunatic Cycle, Edelstein-artig, Plusform 4×4 / 5×4, Farben (244,196,38) (244,214,66) (249,238,103) (250,242,130) (249,246,199)):
  an den Flügelspitzen (1–4, 0–3) und (42–45, 0–3), an den Schultern (16–19, 14–17) und (27–30, 14–17), auf dem Kopf (21–25, 21–24).

Ablauf (48 Frames à 65 ms = 3,12 s) — er FLIEGT; Frame 0 = Originalpose (Flügel oben):
* Flügelschlag, durchgehend: ein Schlag = 12 Frames (780 ms), 4 Schläge pro Schleife; Abschlag 5 Frames, Aufschlag 7 Frames. Jede Flügelspalte wandert als Ganzes senkrecht (Federtextur
  bleibt, nichts kopiert): bis 8 px nach unten, Betrag wächst mit dem Abstand vom Ansatz (Exponent 1,1 — die Spitzen werden nicht zu flach); die Spitzen hinken 1 Frame nach. In Frame 0
  steht jede Spalte genau an ihrer Originalposition. Der rechte Flügel schlägt 0,3 Frames später. Die Flügelkugeln wandern mit ihren Spalten.
* Bob: die ganze Figur hebt sich im Takt bis 4 px über die Ruhelage (am höchsten kurz nach dem Abschlag unten, Frame 0 = tiefste Lage = Original). Fänge und Schwanz baumeln nach
  (60 %, 1,5 Frames verzögert; die Lücke füllen doppelte Zeilen).
* Kugeln (Edelsteine, Gold): pulsieren — je Pixel eine Stufe heller auf der Kugelrampe, die Hellphase wandert (Facetten); reihum blitzt an jeder Kugel ein kleiner Glitzerstern auf
  (Frame 2–5, 12–15, 21–24, 31–34, 40–43). Die Federn glänzen nicht.
* Goldstaub (Partikel): kleine goldene Funken steigen langsam an den Flügeln auf, nahtlos.

Ergänzungen: keine nötig — die Falken-Ebene ist vollständig (auch unter den Kugeln).
Randpixel-Test (Regel 16): verschobene Federspalten legen an Seitenkanten Innenfarbe frei; solche Randpixel (und Sternarme am Rand) werden in der Umrissfarbe ihrer Ebene gesetzt:
Federn (213,170,33), Kugeln/Stern (244,214,66) (B.umriss_je_ebene).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Schlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 2

spr = L.lade('lunatic-hawk')                               # Falke + Kugeln (Ruhepose / Referenz für den Randpixel-Test)
falke = L.lade('lunatic-hawk-falke')
orbs = L.lade('lunatic-hawk-orbs')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
xx = np.arange(sw)
yy = np.arange(sh)
CUT = 34                                                   # ab dieser Zeile beginnen Fänge und Schwanz


def teil(a, maske_x, y0=0, y1=sh):
    m = maske_x[None, :, None] & ((yy >= y0) & (yy < y1))[:, None, None]
    return L.platz(np.where(m, a, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


FL_L, FL_R = teil(falke, xx <= 19, 0, CUT), teil(falke, xx >= 27, 0, CUT)
KOERPER = teil(falke, (xx >= 20) & (xx <= 26), 0, CUT)
BEINE = teil(falke, xx >= 0, CUT, sh)
OB_L, OB_R, OB_C = teil(orbs, xx <= 19), teil(orbs, xx >= 27), teil(orbs, (xx >= 20) & (xx <= 26))

# ── Farben (alle aus dem Sprite) ───────────────────────────────────────────────────────────────────────────────────
OUTLINE, ORB_GELB = (213, 170, 33), (244, 214, 66)
ERLAUBT = {(213, 170, 33), (244, 214, 66), (244, 196, 38)}                 # Umrissfarben der Quelle (Randpixel-Test)
EBENEN_FARBE = {0: ORB_GELB, 1: OUTLINE, 2: OUTLINE, 3: OUTLINE, 4: OUTLINE, 5: ORB_GELB}
RAMPE = [(244, 196, 38), (244, 214, 66), (249, 238, 103), (250, 242, 130), (249, 246, 199)]    # Kugelrampe (dunkel → hell)
STERN_KERN, STERN_ARM = (249, 247, 224), (249, 246, 199)
STERNE = [((2, 1), 2, 'L'), ((17, 15), 12, 'L'), ((23, 22), 21, 'K'), ((28, 15), 31, 'R'), ((43, 1), 40, 'R')]    # Mitte (Sprite), Startframe, Teil


def px(x, y):
    return PAD_L + x, PAD_T + y


# ── Flügelschlag ─────────────────────────────────────────────────────────────────────────────────────────────────────
A_AMP, POT, LAG = 8.0, 1.1, 1.0
MAXD = 19                                                  # größter Spaltenabstand eines Flügels vom Ansatz (x 0 ↔ 19 / x 46 ↔ 27)


def welle(t):
    """Schlagphase 0 (Flügel oben = Original) … 1 (unten): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t, versatz):
    """Spaltenverschiebung als Funktion des Abstandsanteils f. Die Verschiebung wird auf Frame 0 bezogen (Frame 0 = Original, auch bei Wellenlauf/Versatz)."""
    def dy(f):
        return A_AMP * (welle(t - versatz - LAG * f) - welle(-versatz - LAG * f)) * f ** POT
    return dy


def spalte_dy(x, pivot, t, versatz):
    return int(round(dy_fn(t, versatz)(abs(x - pivot) / MAXD)))


# ── Flug ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
BOB_AMP, BOB_MAX_T = 2.0, 6.0


def bob(t):
    """Versatz in px (negativ = oben): Frame 0 = tiefste Lage (Original), am höchsten (−4) kurz nach dem Abschlag unten."""
    return -int(round(BOB_AMP * (1.0 + math.cos(2 * math.pi * (t - BOB_MAX_T) / BEAT))))


def bein_versatz(t):
    return max(bob(t), int(round(0.6 * bob(t - 1.5))))


def kugeln(a, i):
    """Pulsieren: je Kugelpixel eine Stufe heller auf der Kugelrampe, wenn die wandernde Hellphase ihn trifft."""
    out = a.copy()
    ys, xs = np.nonzero(a[..., 3])
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in a[y, x, :3])
        if c in RAMPE and i % N and F.puls(i, N, x, y, 4, 0.9):
            out[y, x, :3] = RAMPE[min(len(RAMPE) - 1, RAMPE.index(c) + 1)]
    return out


# ── Partikel: Goldstaub steigt auf ─────────────────────────────────────────────────────────────────────────────────────
STAUB = {'c': (249, 238, 103), 'r': (244, 196, 38)}
PUFFS = [
    dict(x=px(0, 10)[0], y=px(0, 10)[1], vx=-1, vy=-8, off=0, form='k', wackeln=1),
    dict(x=px(10, 22)[0], y=px(10, 22)[1], vx=1, vy=-9, off=12, form='k', wackeln=1),
    dict(x=px(36, 22)[0], y=px(36, 22)[1], vx=-1, vy=-9, off=24, form='k', wackeln=1),
    dict(x=px(46, 10)[0], y=px(46, 10)[1], vx=1, vy=-8, off=36, form='k', wackeln=1),
    dict(x=px(14, 12)[0], y=px(14, 12)[1], vx=0, vy=-7, off=18, form='k', wackeln=1),
    dict(x=px(32, 12)[0], y=px(32, 12)[1], vx=0, vy=-7, off=42, form='k', wackeln=1),
]
TEST_EBENEN = ('fluegel', 'koerper')                        # für den Randpixel-Test: ohne Partikel


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    dy_u, dy_f = bob(i), bein_versatz(i)
    schichten = []
    if 'fluegel' in ebenen:
        fn_l, fn_r = dy_fn(i, 0.0), dy_fn(i, 0.3)
        pl, pr = PAD_L + 19, PAD_L + 27
        schichten += [(B.spalten_schub(FL_L, pl, fn_l, MAXD), 0, dy_u, 1), (B.spalten_schub(FL_R, pr, fn_r, MAXD), 0, dy_u, 2)]
    if 'koerper' in ebenen:
        beine = BEINE
        if dy_f - dy_u > 0:
            beine = L.streck_zeile(beine, PAD_T + CUT, dy_f - dy_u)          # schmale Zeile 34 (Schwanzansatz) doppelt: Fänge hängen tiefer
        schichten += [(KOERPER, 0, dy_u, 3), (beine, 0, dy_f, 4)]
    if 'fluegel' in ebenen:
        schichten += [(B.spalten_schub(kugeln(OB_L, i), PAD_L + 19, dy_fn(i, 0.0), MAXD), 0, dy_u, 5),
                      (B.spalten_schub(kugeln(OB_R, i), PAD_L + 27, dy_fn(i, 0.3), MAXD), 0, dy_u, 5)]
    if 'koerper' in ebenen:
        schichten += [(kugeln(OB_C, i), 0, dy_u, 5)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    if 'fluegel' in ebenen:
        for (mx, my), start, teil_ in STERNE:                 # Glitzerstern an der Kugel (Edelstein), folgt Spalte und Bob
            st = F.stern_stufe(i, N, start, (0, 1, 2, 1))
            if st is None:
                continue
            if teil_ == 'L':
                dy = spalte_dy(mx, 19, i, 0.0)
            elif teil_ == 'R':
                dy = spalte_dy(mx, 27, i, 0.3)
            else:
                dy = 0
            F.stern(f, PAD_L + mx, PAD_T + my + dy + dy_u, st, STERN_KERN, STERN_ARM)
    B.umriss_je_ebene(f, karte, ERLAUBT, EBENEN_FARBE)
    if partikel:
        f = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS, STAUB), 0, 0), (f, 0, 0)])
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('lunatic-hawk', 'Lunatic Hawk', frames, MS, prev)
    if prev:
        L.streifen(prev + '/lunatic-hawk-strip.png', frames, spalten=8, scale=5)
