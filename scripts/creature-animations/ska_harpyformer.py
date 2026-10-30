# -*- coding: utf-8 -*-
"""Idle-Animation für „Ska Harpyformer“ (Creature) — dunkelhaarige Harpyie spielt mit dem Flügel eine goldene Trompete; Notenzeichen steigen auf; schwebt.

PICK: [["MotiveMoe", 114, "Ebene „Ska Harpyformer“ (87×229 px, enthält mehrere Figuren): nur die Trompeterin (Komponente 320 px, Ebene-Koordinaten x 6–31, y 16–38) und drei Notenzeichen (x 0–13, y 5–22)"]]
Quelle: MotiveMoe.xcf, Ebene 114 „Ska Harpyformer“ (Versatz (178, 62)). Sie enthält mehrere voneinander getrennte Figuren: (a) die Trompeterin (8er-Komponente, 320 px), (b) das Mädchen im Rosa Kleid oben rechts
(271 px, x 34–48, y 5–28) samt Heiligenschein-Stück (20 px) — in der Karte die Figur mit den rosa Schmetterlingsflügeln (deren Flügel liegen in Ebene 115 „#2“) —, (c) drei Notenzeichen (8/9/8 px), (d) weitere Figuren
weit unterhalb (y 173–228, in der Karte nicht sichtbar). Ebene 118 „Ska Harpyformer #1“ ist die Engelfigur links im Kartenbild (schwarze Haare, violette Flügel). Die Ebenennamen stimmen also nicht mit den Figuren überein.
Abgleich mit der Kartenkunst (data/card-art/native/Ska_Harpyformer.png, 76×51; Kartenursprung in der xcf (160, 63), Ebene 114 sitzt bei Kartenpixel (18, −1)): Die Trompeterin (320 px) und die drei Noten (25 px) stehen in der
Karte alle 345 von 345 genauso (Toleranz 30). Das Mädchen (271 px) steht ebenfalls zu 100 % in der Karte (andere Figur), die Engelfigur links und die weiteren Figuren in der Ebene gehören nicht zur Creature und
wurden ausgespart. Der Stein-Pfeiler, auf dem die Trompeterin steht, gehört zum Hintergrund (ganzflächige Ebenen).
Sie liegt als 32×34-Sprite (Ursprung Ebene 114 (0, 5)) vor:
  src/ska-harpyformer.png          Gesamtbild (Ruhepose, Referenz für den Randpixel-Test)
  src/ska-harpyformer-harpyie.png  Trompeterin (320 px)
  src/ska-harpyformer-noten.png    drei Notenzeichen

Aufruf:   python3 ska_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ska-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Trompete (x 6–21, y 13–21): Gold (255,170,40) (255,201,40) (255,233,167) mit schwarzem Schallbecher links (0,0,0) (68,68,68) (x 6–7, y 13–21); die Röhre läuft oben (y 17) und unten (y 19–21) vom Becher nach rechts
  zum Mundstück bei (19–21, 17–19) vor dem Gesicht.
* Flügel (x 14–24, y 17–27): weiß-hellblaue Federn (246,255,255) (222,255,255) (180,246,255) (106,197,255), hält die Trompete (Flügelspitze links bei x 14–16, y 18–21, Ansatz an der Schulter x 21–25, y 22–26).
* Kopf (x 16–26, y 11–21): lange schwarzbraune Haare (15,6,2) (51,22,18) (68,39,38) (54,27,25) (Schopf y 11–16); das Auge ist der schwarze Punkt (19,18) am Mundstück mit hellem Hautpixel (18,18) (255,230,213);
  Wange (238,156,123), Haut (246,205,139). Die Haare fallen als Schleppe rechts bis y 32 herab (x 25–31).
* Körper (x 21–27, y 26–30): blaugraues Kleid (134,141,180) (108,117,155) (61,71,97) (38,38,61); Beine/Füße (x 20–25, y 30–33) mit weißen Krallenspitzen (246,255,255) und Beige-Orange (230,131,82).
* Notenzeichen: Rot (178,11,0) (193,84,77) (x 5–6, y 0–5), Orange (224,114,46) (224,147,99) (x 11–13, y 9–13), Cyan (77,177,193) (118,218,193) (x 1–3, y 12–16).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Sie SCHWEBT (Flieger):
* Flügelschlag, durchgehend im festen Rhythmus: ein Schlag = 12 Frames (780 ms), 4 pro Schleife; Abschlag 5 Frames. Der Flügelarm samt Trompete schwingt als Einheit um die Schulter: jede Spalte (x ≤ 20) wandert als Ganzes
  senkrecht, der Schallbecher hebt sich bis 4 px (Exponent 1,15, Spitze hinkt 1 Frame nach); Flügel und Trompete teilen sich dieselbe Spaltenverschiebung, ihre Lage zueinander bleibt daher erhalten. Federtextur bleibt, nichts wird kopiert.
* Schwebe-Bob: Harpyie samt Flügel, Trompete und Haaren hebt sich im Takt bis 2 px (am höchsten in der Schlagmitte); die Füße baumeln nach (60 %, 1,5 Frames verzögert, die Lücke füllen doppelte Fußzeilen).
* Trompete (Metall): Der Schallbecher und die Röhre bekommen zweimal pro Schleife ein diagonales Lichtband (eine Stufe heller auf der Goldrampe, Frames 6–17 und 30–41), dazu blitzt ein kleiner Glitzerstern
  am Becherrand auf (Frames 8–10 und 32–34, bei (8,15)).
* Haarschleppe schwingt: die Strähnen rechts (x 25–31, y 11–32) pendeln unten bis 1,5 px (Periode 16 Frames); das innere Ende bleibt am Kopf.
* Blinzeln: Frames 19–21 und 41–42, Lid = Hautfarbe (255,230,213) auf dem Augenpixel.
* Notenzeichen: jede Note wippt eigenständig bis 2 px (Perioden 24 / 16 / 48 Frames) und schwankt seitlich um 1 px — Teil der Kunst, ganze Zeichen, keine Partikel.
* Kein Glanz an Federn, Haaren, Haut und Kleid.

Ergänzungen: keine nötig — der Schallbecher und die Röhre sind unter dem Flügel vollständig gezeichnet (die Spalten wandern als Ganzes, es entstehen keine Lücken).
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 2, 4, 4, 2                    # oben: Hub 2 px + Noten; rechts: Haarschleppe schwingt bis 1,5 px

spr = L.lade('ska-harpyformer')                            # Gesamtbild (Ruhepose / Referenz für den Randpixel-Test)
harpyie = L.lade('ska-harpyformer-harpyie')
noten_q = L.lade('ska-harpyformer-noten')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = harpyie[..., 3] > 0

HAAR = [(15, 6, 2), (51, 22, 18), (68, 39, 38), (54, 27, 25), (39, 11, 14), (81, 58, 59), (102, 73, 74)]
GOLD = [(255, 170, 40), (255, 201, 40), (255, 233, 167)]                     # Goldrampe dunkel → hell (Trompete)
M_HAAR = fig & L.farbmaske(harpyie, HAAR)
M_ARM = fig & (xx <= 20) & ~M_HAAR                         # Flügel + Trompete (Spaltenschub)
M_SCHLEPPE = fig & M_HAAR & (xx >= 25) & (yy >= 11)
M_FUESSE = fig & (yy >= 31)
M_KOERPER = fig & ~(M_ARM | M_SCHLEPPE | M_FUESSE)
M_GOLD = M_ARM & L.farbmaske(harpyie, GOLD)


def teil(maske, quelle=harpyie):
    return L.platz(np.where(maske[..., None], quelle, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


ARM, SCHLEPPE, FUESSE, KOERPER = teil(M_ARM), teil(M_SCHLEPPE), teil(M_FUESSE), teil(M_KOERPER)
_n, _lab = cv2.connectedComponents((noten_q[..., 3] > 0).astype(np.uint8), connectivity=8)
NOTEN = [teil(_lab == k, noten_q) for k in range(1, _n)]
NOTEN = sorted(NOTEN, key=lambda nt: (np.nonzero(nt[..., 3])[0].min(), np.nonzero(nt[..., 3])[1].min()))     # 0 Rot (oben), 1 Orange, 2 Cyan
NOTEN_PAR = [(24.0, 0.0, 2.0, 32.0, 1.0), (16.0, 1.3, 2.0, 24.0, 2.0), (48.0, 2.4, 2.0, 48.0, 0.7)]       # (Periode y, Phase y, Ausschlag y, Periode x, Phase x)

AUGE, LID = (19, 18), (255, 230, 213)
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (15, 6, 2), 2: (49, 24, 0), 3: (0, 0, 0), 4: (15, 6, 2)}      # 1 Körper, 2 Füße, 3 Arm, 4 Schleppe


# ── Flügelarm schwingt ──────────────────────────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_ARM = 4.0
X_PIV, MAXD = 21, 15                                       # Schulter x 21 → Schallbecher x 6


def welle(t):
    """Schlagphase 0 (Original) … 1 (Becher oben): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def dy_fn(t):
    def dy(f):
        return -A_ARM * (welle(t - LAG * f) - welle(-LAG * f)) * f ** POT          # negativ = nach oben
    return dy


# ── Schwebe-Bob, Füße, Schleppe, Blinzeln, Noten ────────────────────────────────────────────────────────────────────
BOB_AMP = 1.0


def hub(t):
    return int(round(BOB_AMP * (1.0 - math.cos(2 * math.pi * t / BEAT))))


def fuss_hub(t):
    return min(hub(t), int(round(0.6 * hub(t - 1.5))))


def schleppe(a, t):
    """Haarschleppe schwingt (äußeres Ende = rechts): unten bis 1,4 px, Periode 16; zu schmale Zeilen bleiben stehen. Gespiegelt gerechnet (Funktion kennt nur ein äußeres Ende links)."""
    sp = a[:, ::-1].copy()
    innen, breite = {}, {}
    for y in range(PAD_T + 11, PAD_T + 32):
        xs_ = np.nonzero(sp[y, :, 3])[0]
        if len(xs_):
            innen[y] = int(xs_.max()) + 1
            breite[y] = int(xs_.max() - xs_.min() + 1)
    ys = sorted(innen)
    s = math.sin(2 * math.pi * t / 16.0)

    def dx(y):
        d = -1.4 * s * ((y - ys[0]) / max(1, ys[-1] - ys[0])) ** 1.2
        return 0 if breite[y] - int(round(d)) < 2 or breite[y] < 3 else d
    return B.zeilen_dehnen_aussen(sp, ys[0], ys[-1], innen, dx)[:, ::-1].copy()


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


def note_versatz(k, t):
    py, fy, ay, px_, fx = NOTEN_PAR[k]
    dy = int(round(ay * math.sin(2 * math.pi * t / py + fy))) - int(round(ay * math.sin(fy)))
    dx = int(round(1.0 * math.sin(2 * math.pi * t / px_ + fx))) - int(round(1.0 * math.sin(fx)))
    return dx, dy


TEST_EBENEN = ('figur',)                                    # für den Randpixel-Test: ohne Noten


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    if nur is not None:
        partikel = False
    n, k = hub(i), fuss_hub(i)
    schichten = []
    st = None
    if 'figur' in ebenen:
        koerper = KOERPER
        if blinzeln(i):
            koerper = koerper.copy()
            koerper[PAD_T + AUGE[1], PAD_L + AUGE[0], :3] = LID
        fuesse = FUESSE
        if n - k > 0:
            fuesse = L.streck_zeile(fuesse, PAD_T + 31, n - k)             # Füße: Lücke füllen doppelte oberste Fußzeile
        arm = ARM.copy()
        for start in (6, 30):                                              # Trompete (Metall): Lichtband über das Gold, bevor der Arm schwingt
            F.lichtband(arm, M_GOLD, PAD_L, PAD_T, i, N, start, 12, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0))
        arm = B.spalten_schub(arm, PAD_L + X_PIV, dy_fn(i), MAXD)
        schichten += [(koerper, 0, -n, 1), (fuesse, 0, -k, 2), (schleppe(SCHLEPPE, i), 0, -n, 4), (arm, 0, -n, 3)]
        st = F.stern_stufe(i, N, 8, (0, 1, 0))
        if st is None:
            st = F.stern_stufe(i, N, 32, (0, 1, 0))
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    if st is not None and st >= 1:                                         # Glitzerstern am Becherrand (folgt dem Becher und dem Bob)
        dyb = int(round(dy_fn(i)(abs(8 - X_PIV) / MAXD)))
        F.stern(f, PAD_L + 8, PAD_T + 15 + dyb - n, st, (255, 233, 167), (255, 201, 40))
    if partikel:
        ebenen_ = [(f, 0, 0)]
        for kk, nt in enumerate(NOTEN):
            dx, dy = note_versatz(kk, i)
            ebenen_.append((nt, dx, dy))
        f = L.zusammen(H, W, ebenen_)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('ska-harpyformer', 'Ska Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/ska-harpyformer-strip.png', frames, spalten=8, scale=6)
