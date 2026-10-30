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

# --- FEUER (Regel 15) — Farbschichten schwanken UNABHÄNGIG --------------------------------------------------
# Sechs Flammenspalten x 7–12 über der Basis (Zeile 8 = Höhe 0). Je Spalte drei verschachtelte Schichten mit eigener Höhe: rote Außenhaut (hR) ≥ orange (hO)
# ≥ gelber Kern (hY). Farbe auf Höhenstufe l: l < hY gelb, l < hO orange, l < hR rot. Jede Schicht schwankt in Höhe (Summe zweier Sinus mit eigener Periode,
# gehalten in 2–3-Frame-Stufen, bei Frame 0 genau 0 → Originalflamme), die rote Spitze lehnt sich links/rechts (Knick mit Verbindungspixel), die hohe Mittelzunge spaltet
# sich kurz in zwei Spitzen und verschmilzt wieder, der gelbe Kern wandert seitlich (P ↔ G auf Zeile 8), Aufhellblitze heben Orange und Gelb für 2 Frames,
# aus hohen Zungen reißen Spitzen ab und steigen als Funken auf.
BASIS_R = {7: 1, 8: 2, 9: 5, 10: 2, 11: 3, 12: 2}
BASIS_O = {7: 0, 8: 1, 9: 2, 10: 1, 11: 2, 12: 0}
BASIS_Y = {7: 0, 8: 0, 9: 1, 10: 0, 11: 0, 12: 0}
MIN_R = {7: 1, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2}          # die breite Basis (Zeilen 7–8) bleibt immer stehen
MAX_R = {7: 1, 8: 4, 9: 8, 10: 5, 11: 6, 12: 4}
SCHWANK = {                                              # (Spalte, Schicht): [(Amplitude in px, Periode in Frames, Haltedauer in Frames), …]
    (8, 'R'): [(1.4, 12, 2), (0.8, 8, 3)], (9, 'R'): [(2.6, 16, 2), (1.4, 6, 3)], (10, 'R'): [(1.6, 24, 3), (1.0, 8, 2)],
    (11, 'R'): [(2.2, 12, 2), (1.2, 16, 3)], (12, 'R'): [(1.4, 16, 3), (0.9, 6, 2)],
    (8, 'O'): [(1.2, 8, 3)], (9, 'O'): [(1.8, 12, 2), (0.9, 24, 3)], (10, 'O'): [(1.2, 16, 2)], (11, 'O'): [(1.4, 6, 3), (0.7, 12, 2)],
    (12, 'O'): [(1.3, 24, 2)], (7, 'O'): [(0.8, 16, 3)],
    (8, 'Y'): [(0.9, 24, 3)], (9, 'Y'): [(1.7, 8, 2), (0.9, 16, 3)], (10, 'Y'): [(1.1, 12, 2)], (11, 'Y'): [(1.0, 16, 3)],
}
NEIGUNG = {8: (12, 3), 9: (16, 2), 10: (24, 3), 11: (12, 2), 12: (16, 3)}   # Spalte: (Periode, Haltedauer) der Neigung ±1 der roten Spitze
BLITZ = {14, 15, 36, 37}                                  # Aufhellblitze (Orange und Gelb heben sich um eine Stufe)
SPALT = {10, 11, 12, 30, 31, 32}                          # Mittelzunge (Spalte 9) spaltet sich kurz in zwei Spitzen


def _delta(x, e, t):
    z = 0.0
    for (amp, per, halt) in SCHWANK.get((x, e), []):
        z += amp * math.sin(2 * math.pi * ((t // halt) * halt) / per)
    return int(round(z))


def hoehen(i):
    """Höhen (hR, hO, hY) je Spalte im Frame i; bei Frame 0 genau die Originalhöhen."""
    t = i % N
    hr, ho, hy = {}, {}, {}
    for x in BASIS_R:
        r = min(MAX_R[x], max(MIN_R[x], BASIS_R[x] + _delta(x, 'R', t)))
        o = BASIS_O[x] + _delta(x, 'O', t) + (1 if t in BLITZ and x in (8, 9, 10, 11) else 0)
        y = BASIS_Y[x] + _delta(x, 'Y', t) + (1 if t in BLITZ and x in (8, 9, 10, 11) else 0)
        o = max(0, min(o, r - 1 if r > 1 else r))              # Orange immer unterhalb der roten Spitze
        y = max(0, min(y, o))                                  # Gelb im Orange
        hr[x], ho[x], hy[x] = r, o, y
    for x in sorted(hr, key=lambda c: (-hr[c], c)):            # „Täler“: neben einer Zunge ≥ 3 px bleiben Nachbarn ≤ 2 px (Zungen bleiben einzeln)
        if hr[x] >= 3:
            for nb in (x - 1, x + 1):
                if nb in hr and hr[nb] > 2 and hr[nb] <= hr[x] and (hr[nb] < hr[x] or nb > x):
                    hr[nb] = 2
                    ho[nb], hy[nb] = min(ho[nb], 1), min(hy[nb], 1)
    return hr, ho, hy


def spitzen_neigung(x, t):
    per, halt = NEIGUNG[x]
    z = math.sin(2 * math.pi * ((t // halt) * halt) / per)
    return 0 if abs(z) < 0.6 else (1 if z > 0 else -1)


def flamme_basis(i):
    """Flammenpixel (x, y) → Farbe ohne abreißende Funken."""
    t = i % N
    hr, ho, hy = hoehen(i)
    px = {}
    for x in BASIS_R:
        lean = spitzen_neigung(x, t) if x in NEIGUNG else 0
        for l in range(hr[x]):
            y = 8 - l
            if l < hy[x]:
                px[(x, y)] = P_
            elif l < ho[x]:
                px[(x, y)] = G_
            else:
                rot_nr = l - ho[x]
                n_rot = hr[x] - ho[x]
                dx = lean if (n_rot >= 3 and rot_nr >= 1) else 0
                px[(x + dx, y)] = E_
                if dx and rot_nr == 1:
                    px[(x, y)] = E_                           # Knick: Verbindungspixel (4-verbunden)
        if x == 9 and t in SPALT and hr[9] >= 4:                # Mittelzunge spaltet sich in zwei Spitzen
            ls = hr[9] - 2
            for l in range(ls + 1, hr[9]):
                px.pop((9, 8 - l), None)
                px.pop((9 + lean, 8 - l), None)
            for dx in (-1, 1):
                px[(9 + dx, 8 - ls)] = E_
                px[(9 + dx, 8 - ls - 1)] = E_
            px[(9, 8 - ls)] = E_
    cx = int(round(math.sin(2 * math.pi * ((t // 2) * 2) / 24)))   # gelber Kern wandert seitlich
    if cx and px.get((9, 8)) == P_ and px.get((9 + cx, 8)) == G_:
        px[(9, 8)], px[(9 + cx, 8)] = G_, P_
    return px


def _hoehen_alle():
    return [hoehen(t)[0] for t in range(N)]


_HR = _hoehen_alle()
ABREISS = []                                             # (Startframe, Spalte, Drift, x_Spitze, y_Spitze)
for _t in range(1, 43):
    for _x in BASIS_R:
        if _HR[_t - 1][_x] >= 4 and _HR[_t][_x] <= _HR[_t - 1][_x] - 2:
            ABREISS.append((_t, _x, (1, -1)[(_t + _x) % 2], _x, 8 - (_HR[_t - 1][_x] - 1)))


def flamme_pixel(i):
    """Alle Flammenpixel im Frame i: Basis + Zungen + abreißende Funken + Ur-Funke."""
    px = dict(flamme_basis(i))
    for (f0, x0, drift, tx, ty) in ABREISS:                      # abgerissene Spitzen steigen als Funken auf (6 Frames, 5 px): orange → rot
        kk = (i - f0) % N
        if kk < 6:
            px[(tx + drift * (kk // 3), ty - 1 - int(round(0.85 * kk)))] = G_ if kk < 3 else E_
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
