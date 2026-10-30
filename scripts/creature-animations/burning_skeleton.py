# -*- coding: utf-8 -*-
"""Idle-Animation für „Burning Skeleton“ (Creature) — Fassung 2 (Feuer wie Feuer, Beine intakt).

Quelle: src/burning-skeleton.png — Ebene „Burning Skele“ (20×30 px, 16 Farben) aus Motive.xcf.
PICK: [["Motive", 814, 1]]
  Die Ebene hat unten halbtransparente Beine (Alpha 204 = Skelett steht in Lava, Zeilen 24–29: 52 Pixel). `creature_show.py extract` übernimmt nur Alpha ≥ 250
  (Zeilen 0–24); ich habe die Beinpixel der Ebene in src/ als DECKEND ergänzt (Farben alle aus dem Sprite, (48,48,48) → (38,38,38)). Die Beine bleiben in
  JEDEM Frame vollständig und deckend (kein Dither, kein Flimmern).

Aufruf:   python3 burning_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/burning-skeleton.png + .json

Was ist was (Koordinaten im Sprite, x/y):
* Flamme y 0–8 auf dem Schädel: Flammenrampe M (150,0,0) < E rot (202,44,41) < G orange (244,123,34) < P gelb (246,231,14). Breite, ruhige Basis y 7–8
  (heißer Kern P bei (9,8)), Zungen rot bei (9,4–6), (11,6); die drei roten Pixel (11,0) (12,1) (12,2) sind ein aufsteigender Funke über der Flamme.
* Schädel y 9–15: schwarz/dunkelbraun (A, B, C, D, F); Augenhöhlen F schwarz bei (7,13/14) und (12,13/14); rote Glutaugen M bei (8,14) und (11,14).
* Rumpf: Schultern y 16–18, Rippen y 17–20 (dunkelrote Muster B/C/D/L/N), Becken y 21–23.
* Arme: oben an den Schultern (x 2–5, y 16–18), dann frei hängend: Unterarm x 1–3 y 19–20, graue Hände/Handschuhe H/I/O/K bei y 21–23, Spitze y 24.
* Beine y 24–29: dunkel A/D/B/C mit grauen Knöcheln (in der Kunst halbtransparent, hier deckend).
Fest bleiben: Schädel, Rippenmuster, Beine, Hände.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Glutfunken ausgenommen):
* FEUER (Regel 15): breite, ruhige Basis (nur der Kern flackert: P wandert kurz auf (10,8) und (8,8)); fünf Zungen bei x 8–12 steigen jede für sich auf und
  flackern unregelmäßig — je Zunge eine eigene Folge aus 2–3 Frames langen Posen (insgesamt 11–13 Posen je Zunge, Höhe 0–6 px, spitz zulaufend: 1 px breit,
  unten orange G, oben rot E, einzelne Zungen lehnen sich links/rechts). Frame 0 = Originalzungen. Aus hohen Zungen reißt die Spitze ab und steigt als
  Funke auf (orange → rot, 6 Frames, 5 px, mit Seitendrift). Der Ur-Funke (11,0)/(12,1)/(12,2) steigt in den ersten Frames weg.
  Kein Lichtband, keine Sterne (Regel 14).
* Atmen zweistufig (Periode 48, 0-1-2-1-0 px): im Rumpf-Layer wird Zeile y 20 eingefügt; Brust (Rippen, Schultern) und Arme steigen zuerst, Becken/Beine
  bleiben. Der Schädel samt Flamme folgt 2 Frames später, nie höher als die Brust (sinkt höchstens 1 px in die Schultern, nie ein Spalt).
* Arme schwingen synchron und gespiegelt nach außen (Periode 24, bis 2,5 px, wächst von der Schulter y 18 zur Hand); Schulterzeilen y 16–18 bleiben am Rumpf.
* Rote Augen glühen sanft (Periode 12: M → E → M), Blinzeln Frame 18–20 und 42–44. Kein Stern.
* Glut-Partikel (hinter der Figur, 10 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, Formen k, o): Funken über der Flamme,
  runde Glutkugeln neben Kopf und Schultern, Lavafunken rechts/links der Beine. Farben aus der Flammenrampe (P/G/E).
ERGÄNZUNG: die Beinzeilen 24–29 (52 Halbpixel, deckend in src, siehe oben). Die Flamme ist aus denselben Pixelfarben neu gezeichnet (Frame 0 = Original, per assert geprüft).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 18, 5

spr = L.lade('burning-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

M_, E_, G_, P_ = (150, 0, 0), (202, 44, 41), (244, 123, 34), (246, 231, 14)
B_ = (47, 18, 18)
A_ = (12, 12, 12)                                 # Umrissschwarz
UMRISS = U.umrissfarben(spr * np.where(np.arange(spr.shape[0])[:, None, None] >= 9, 1, 0).astype(np.uint8))   # Randfarben des Körpers (ohne Flamme y 0–8)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (M_, E_, G_, P_, B_))
FARBE = {'E': E_, 'G': G_, 'P': P_}

flamme = vorhanden & (yy <= 8)
kopf = vorhanden & (yy >= 9) & (yy <= 15)
arm_l = vorhanden & (xx <= 4) & (yy >= 19) & (yy <= 24)
arm_r = vorhanden & (xx >= 15) & (yy >= 19) & (yy <= 24)
rumpf = vorhanden & (yy >= 16) & (yy <= 23) & ~arm_l & ~arm_r
beine = vorhanden & (yy >= 24) & ~arm_l & ~arm_r
assert (flamme | kopf | arm_l | arm_r | rumpf | beine).sum() == vorhanden.sum()

# --- FEUER (Regel 15) ---------------------------------------------------------------------------------------
# Basis (Zeilen 7–8) breit und ruhig = Originalpixel; darüber fünf Zungen bei x 8–12 mit eigenen Posenfolgen (2–3 Frames je Pose).
# Zungenformen relativ zum Fußpunkt (x0, Zeile 7): (dx, dy, Farbe), dy < 0 = aufwärts; unten orange G, oben rot E, 1 px breit (spitz zulaufend).
FARBE = {'E': E_, 'G': G_, 'P': P_}
FORMEN = {
    'N0': [],
    'S1': [(0, -1, 'E')],
    'S2': [(0, -1, 'G'), (0, -2, 'E')],
    'S3': [(0, -1, 'G'), (0, -2, 'E'), (0, -3, 'E')],
    'S4': [(0, -1, 'G'), (0, -2, 'G'), (0, -3, 'E'), (0, -4, 'E')],
    'S5': [(0, -1, 'G'), (0, -2, 'G'), (0, -3, 'E'), (0, -4, 'E'), (0, -5, 'E')],
    'S6': [(0, -1, 'G'), (0, -2, 'G'), (0, -3, 'G'), (0, -4, 'E'), (0, -5, 'E'), (0, -6, 'E')],
    'R3': [(0, -1, 'G'), (0, -2, 'G'), (1, -2, 'E'), (1, -3, 'E')],            # Spitze lehnt rechts (4-verbunden über (0,-2)-(1,-2))
    'R4': [(0, -1, 'G'), (0, -2, 'G'), (0, -3, 'G'), (1, -3, 'E'), (1, -4, 'E')],
    'L3': [(0, -1, 'G'), (0, -2, 'G'), (-1, -2, 'E'), (-1, -3, 'E')],
    'L4': [(0, -1, 'G'), (0, -2, 'G'), (0, -3, 'G'), (-1, -3, 'E'), (-1, -4, 'E')],
    'O3': [(0, -1, 'E'), (0, -2, 'E'), (0, -3, 'E')],                          # Originalzunge bei x 9
}
FOLGEN = {          # Zunge bei x0: Liste (Form, Dauer in Frames); Summe je Zunge = 48
    8: [('N0', 3), ('S1', 2), ('S2', 3), ('S3', 2), ('L3', 2), ('S2', 3), ('S1', 2), ('N0', 2), ('S2', 2), ('S3', 3), ('S2', 2), ('L3', 2),
        ('S1', 3), ('S2', 2), ('S3', 3), ('S2', 2), ('N0', 2), ('S1', 2), ('S2', 3), ('N0', 3)],
    9: [('O3', 2), ('S4', 3), ('S3', 2), ('R4', 3), ('S5', 2), ('S4', 3), ('S6', 2), ('S4', 2), ('L4', 3), ('S3', 2), ('S5', 3), ('S4', 2), ('R3', 2),
        ('S2', 2), ('S4', 3), ('S5', 2), ('L3', 3), ('S4', 2), ('S3', 2), ('S2', 3)],
    10: [('N0', 2), ('S2', 3), ('S3', 2), ('S1', 2), ('S2', 3), ('R3', 2), ('S3', 3), ('S4', 2), ('S2', 2), ('N0', 2), ('S3', 3), ('S2', 2), ('L3', 3),
         ('S4', 3), ('S3', 2), ('S2', 3), ('S1', 2), ('S3', 2), ('S2', 2), ('N0', 3)],
    11: [('S1', 2), ('S2', 3), ('S3', 2), ('R3', 3), ('S2', 2), ('S4', 3), ('S3', 2), ('S1', 2), ('S3', 3), ('L3', 2), ('S4', 3), ('S2', 3), ('S5', 2),
         ('S3', 3), ('S2', 2), ('S1', 2), ('S4', 3), ('S2', 3), ('S1', 3)],
    12: [('N0', 2), ('S1', 3), ('S2', 2), ('S3', 3), ('R3', 2), ('S2', 3), ('S1', 2), ('S3', 2), ('S4', 3), ('S3', 2), ('S2', 3), ('S1', 2), ('N0', 3),
         ('S2', 2), ('S3', 3), ('R3', 2), ('S2', 2), ('S1', 2), ('S2', 3), ('N0', 2)],
}
for _x, _f in FOLGEN.items():
    assert sum(d for _, d in _f) == N, (_x, sum(d for _, d in _f))


def zunge(x0, i):
    """(Form, Frames seit Posenbeginn, Posenbeginn) der Zunge x0 im Frame i."""
    t = i % N
    acc = 0
    for form, d in FOLGEN[x0]:
        if t < acc + d:
            return form, t - acc, acc
        acc += d


HOCH = {'S4', 'S5', 'S6', 'R4', 'L4'}                  # nach diesen Formen reißt die Spitze ab (Funken)
ABREISS = []                                           # (Startframe, Zunge x0, Drift)
for _x, _f in FOLGEN.items():
    _acc = 0
    for _k, (_form, _d) in enumerate(_f):
        if _form in HOCH and _acc > 0:
            ABREISS.append((_acc, _x, {'R4': 1, 'L4': -1}.get(_form, (1, -1)[_k % 2])))
        _acc += _d


def basis_pixel(i):
    """Basis y 7–8 = Originalpixel (ruhig); der heiße Kern flackert nur kurz: P wandert nach (10,8) bzw. (8,8)."""
    px = {(x, y): tuple(int(v) for v in spr[y, x, :3]) for y in (7, 8) for x in range(sw) if spr[y, x, 3]}
    if i % N:
        if i % 12 in (6, 7):
            px[(10, 8)] = P_
        if i % 12 in (9, 10):
            px[(8, 8)] = P_
    return px


def hoehe(form):
    return -min((dy for _, dy, _ in FORMEN[form]), default=0)


def formen_tal(i):
    """Form jeder Zunge im Frame i mit „Tälern“: eine Zunge von ≥ 2 px lässt ihre unmittelbaren Nachbarn nicht ebenfalls ≥ 2 px hoch werden
    (höhere Zunge zuerst, bei Gleichstand die linke) — die Zungen erscheinen einzeln und spitz und verschmelzen nicht zu einem Block."""
    formen = {x0: zunge(x0, i)[0] for x0 in FOLGEN}
    frei = []
    for x0 in sorted(formen, key=lambda x: (-hoehe(formen[x]), x)):
        if hoehe(formen[x0]) >= 2:
            if any(abs(x0 - a) == 1 for a in frei):
                formen[x0] = 'S1'
            else:
                frei.append(x0)
    return formen


def flamme_pixel(i):
    """Alle Flammenpixel (x, y) → Farbe im Frame i: Basis + Zungen + abreißende Funken + Ur-Funke."""
    px = dict(basis_pixel(i))
    abgerissen = {(x0, f0) for (f0, x0, _) in ABREISS if i % N == f0}
    formen = formen_tal(i)
    for x0 in FOLGEN:
        form = formen[x0]
        pts = FORMEN[form]
        if (x0, i % N) in abgerissen and pts:                    # Spitze reißt in diesem Frame ab
            pts = pts[:-1]
        for dx, dy, ch in pts:
            px[(x0 + dx, 7 + dy)] = FARBE[ch]
    for (f0, x0, drift) in ABREISS:                              # aufsteigende Funken (6 Frames, 5 px): orange → rot, mit Seitendrift
        for kk in range(6):
            if (i - f0) % N == kk:
                form = formen_tal(f0)[x0]
                if not FORMEN[form]:
                    continue
                top = min(FORMEN[form], key=lambda t: t[1])
                x = x0 + top[0] + (drift * (kk // 3))
                y = 7 + top[1] - 1 - int(round(0.85 * kk))
                px[(x, y)] = G_ if kk < 3 else E_
    t = i % N                                                    # Ur-Funke (11,0)/(12,1)/(12,2) steigt in den ersten Frames weg
    if t < 7:
        for (x, y) in ((11, 0), (12, 1), (12, 2)):
            px[(x, y - t)] = E_
    return px


_orig = {(x, y): tuple(int(v) for v in spr[y, x, :3]) for y in range(9) for x in range(sw) if spr[y, x, 3]}
assert flamme_pixel(0) == _orig, 'Flamme in Frame 0 weicht vom Sprite ab'

GLOW12 = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]       # Augenglühen sanft (Periode 12): M → E → M, 0 = Original
AUGEN = [(8, 14), (11, 14)]
AUGENFARBE = [M_, E_]

HEISS = {'c': P_, 'r': G_}                          # heiße Funken/Kugeln: Kern gelb, Rand orange
GLUT = {'c': G_, 'r': E_}                           # Glut: Kern orange, Rand rot
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_HEISS = [
    dict(x=P(9, 2)[0], y=P(9, 2)[1], vx=1, vy=-12, off=0, form='k', wackeln=1),          # Funken über der Flamme
    dict(x=P(12, 1)[0], y=P(12, 1)[1], vx=1, vy=-12, off=16, form='k', wackeln=1),
    dict(x=P(7, 4)[0], y=P(7, 4)[1], vx=-2, vy=-11, off=32, form='k', wackeln=1),
    dict(x=P(4, 10)[0], y=P(4, 10)[1], vx=-2, vy=-13, off=8, form='o', wackeln=1),       # runde Glut neben dem Kopf
    dict(x=P(15, 10)[0], y=P(15, 10)[1], vx=2, vy=-13, off=28, form='o', wackeln=1),
]
PUFFS_GLUT = [
    dict(x=P(1, 17)[0], y=P(1, 17)[1], vx=-2, vy=-12, off=20, form='k', wackeln=1),      # an den Schultern
    dict(x=P(18, 17)[0], y=P(18, 17)[1], vx=2, vy=-12, off=40, form='k', wackeln=1),
    dict(x=P(3, 28)[0], y=P(3, 28)[1], vx=-2, vy=-15, off=4, form='o', wackeln=1),       # Lavafunken neben den Beinen
    dict(x=P(16, 28)[0], y=P(16, 28)[1], vx=2, vy=-15, off=24, form='o', wackeln=1),
    dict(x=P(10, 29)[0], y=P(10, 29)[1], vx=0, vy=-10, off=44, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def stufe2(i):
    t = (i % N) / N
    return int(round(2 * (1 - abs(2 * t - 1))))                  # 0-1-2-1-0


def frame(i, nur=None):
    r_b = stufe2(i)
    r_k = max(min(r_b, stufe2(i - 2)), r_b - 1)                   # Schädel + Flamme folgen der Brust, nie höher
    aus = 2.5 * U.buckel(i, 0, 24, n=24)
    glut = GLOW12[i % 12]
    blink = {18: 1, 19: 2, 20: 1, 42: 1, 43: 2, 44: 1}.get(i, 0)

    # --- Feuer: Basis, Zungen, abreißende Funken (alle Pixel aus E/G/P) ---
    fl = L.leer(H, W)
    for (x, y), col in flamme_pixel(i).items():
        fl[PAD_T + y, PAD_L + x, :3] = col
        fl[PAD_T + y, PAD_L + x, 3] = 255
    # --- Schädel mit Glutaugen ---
    kp = teil(kopf)
    for (x, y) in AUGEN:
        kp[PAD_T + y, PAD_L + x, :3] = B_ if blink == 2 else (AUGENFARBE[0] if blink == 1 else AUGENFARBE[glut])
    # --- Rumpf, Arme, Beine (Beine intakt, jeder Frame vollständig und deckend) ---
    rp = L.streck_zeile(teil(rumpf), PAD_T + 20, r_b)
    al = U.haengen(teil(arm_l), PAD_T + 18, -aus)
    ar = U.haengen(teil(arm_r), PAD_T + 18, aus)
    bn = teil(beine)
    koerper = L.zusammen(H, W, [(bn, 0, 0), (rp, 0, 0), (al, 0, -r_b), (ar, 0, -r_b), (kp, 0, -r_k)])
    koerper = U.kontur_schliessen(koerper, UMRISS, A_)             # Regel 16: Umriss an Armen/Händen in jeder Pose geschlossen
    if nur == 'koerper':                                           # Randpixel-Test: Körper ohne Flamme (Feuer hat keinen Umriss) und Partikel
        return koerper
    heiss = U.glut_ebene(H, W, i, N, PUFFS_HEISS, HEISS)
    kalt = U.glut_ebene(H, W, i, N, PUFFS_GLUT, GLUT)
    return L.zusammen(H, W, [(kalt, 0, 0), (heiss, 0, 0), (koerper, 0, 0), (fl, 0, -r_k)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('burning-skeleton', 'Burning Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/burning-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=7)
