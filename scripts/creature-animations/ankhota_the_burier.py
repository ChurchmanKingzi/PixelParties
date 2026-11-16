# -*- coding: utf-8 -*-
"""Idle-Animation für „Ankhota, the Burier“ (Creature) — Sandwesen in Pyramidenform mit grauer Schädelmaske; es scharrt mit der Klaue und Sand rieselt die Flanken hinab.

PICK: [["MotiveGrailWar", 551, "Ebene „Ankhota“ (57×54 px, ganze Figur)"]]
Nicht verwendet: Ebene 552 (halbtransparenter Bodenschatten), 553 (Sandwellen-Hintergrund + dunkle Grube). Abgleich mit data/card-art/native/Ankhota_the_Burier.png: gleiche Figur
(dort vom Kartenrand unten/rechts beschnitten; die Ebene ist vollständig).

Identifikation (57×54): Pyramidenspitze = helle Sandkappe (y 0–12). Graue Schädelmaske (x 14–37, y 11–27) mit zwei Hörnchen (y 11–13), dunklen Augenhöhlen mit rosa Pupillen
(x 19–22 und 27–30, y 17–21), Nasenspitze (x 23–26, y 24–27), seitlichen Maskenlaschen mit hellen Nieten (x 14–16 und 34–36, y 21–26). Darunter im Sand: zwei rötliche Ovale
(x 17–19 und 30–32, y 24–27; Wangenmale oder zweites Augenpaar – unklar, bleiben fest), breiter Grinsemund mit Zunge (x 19–30, y 29–38). Linker Arm liegt flach am Boden
(x 0–15, y 38–47), rechter Arm greift nach vorn, Unterarm x 40–52 (y 44–46), Klauenhand mit vier dunklen Krallen (x 43–56, y 47–53). Dunkle Striche im Sand = Falten.
Maske blinzelt nicht (Regel), Augen bleiben fest. Kein Glanz (Sand/Knochen).

Ablauf (72 Frames à 75 ms = 5,4 s, schweres Wesen → langsam). Frame 0 = Original:
* Atmen (Periode 36): unterhalb des Mundes (Zeile 39) wird eine texturierte Zeile eingefügt (TX.streck_zeile); Pyramide, Maske, Schultern heben sich 1 px. Der rechte Arm
  (eigene Ebene vor dem Körper) und die Hand machen das nicht mit, ebenso die Unterkante des linken Arms.
* Arm heben und fallen lassen (Periode 36, also zweimal je Schleife): der rechte Arm trägt die Klauenhand. Er ist die rechte untere Ecke der Pyramide: Unterkante
  (40,44)–(44,47) ab der Achselkerbe (39,44), Oberkante = die Flanke ab (47,38). Sechs Schlüsselposen (0 = Original … 5 = ganz oben): der Arm schwenkt um den festen
  Ansatz (Schräge x+y = 83 von der Achselkerbe zur Flanke; alles darüber/links davon ist Körper und bleibt unverändert, auch die Falte (37,40)–(39,43)) nach oben außen.
  Jede Schräge x+y = c des Arms (c = 84 … 89) wird dazu ALS GANZES entlang ihrer selbst um n(c) Schritte (1,−1) verschoben; n wächst vom Ansatz bis zum Handgelenk auf
  die Posenstufe k, die Hand (c ≥ 90) ist starr und unverändert (k rechts, k hoch – ein Bogen um den Ansatz; Abstand Ansatz–Handmitte 12,1 → 12,3 px). Das ist eine
  reine Gitter-Scherung: kein Pixel entsteht doppelt, keins fehlt, die Armdicke (Länge jeder Schräge) und die Sandschraffur bleiben erhalten und folgen der Pose;
  nichts wird in den Körper geschoben, Hand und Arm überlappen nicht. Unter dem Arm öffnet sich die Achselkerbe als Keil (Hintergrund).
  Zeitablauf wie bisher: langsam heben (1 Stufe je 3 Bilder), verharren, in zwei Bildern schwer fallen (Aufprall Bild 26 der Periode). Beim Aufprall: vier Staubwölkchen
  (2×2 → 5×3 → 2×2, Sandfarben) und kurzes Nachbeben – der Körper sackt zweimal 1 px zusammen (Zeile 39 entfällt, TX.streck_zeile mit −1).
* Sand rieselt: 2×2-Körner in Sandfarben gleiten hinter der Figur die beiden Pyramidenflanken hinab (je Flanke 3, versetzt; sie liegen HINTER dem Körper, treten also am Rand aus).
Ergänzungen (nur bei gehobenem Arm bzw. an der Atemnaht): frei liegende Sandpixel an Armober- und -unterkante bekommen die Umrissfarbe (80,66,27), an den Scherstufen
überstehende Umriss-Einzelpixel entfallen, das von Armunterkante und Handecke eingeschlossene Pixel wird Umriss. Die Körperkante an der Kerbe ((38,44), (37,45)) ist schon in der Quelle fertig.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n8 as N8

N, MS = 72, 75
sz = N8.Szene('ankhota-the-burier', (6, 10, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
PL, PT = sz.PL, sz.PT
UMRISS = (80, 66, 27)
SAND, SAND2, HELL = (214, 201, 167), (192, 178, 131), (230, 217, 192)
ATEMZEILE = 39
# --- rechter Arm: Schrägen x+y = c ≥ 84 rechts der Armunterkante; FALTE_X[c] = erste Spalte des Arms auf der Schräge c (ab c = 91: alles ab Spalte 43 = Hand)
C0, C1 = 83, 90                                                             # letzte feste Schräge (Ansatz; durch die Achselkerbe (39,44)) … Handgelenk
FALTE_X = {84: 40, 85: 41, 86: 41, 87: 42, 88: 42, 89: 43, 90: 44}
cc = xx + yy
M_ARM = np.zeros(spr.shape[:2], bool)
for c_, x_ in FALTE_X.items():
    M_ARM |= (cc == c_) & (xx >= x_)
M_ARM |= (cc > C1) & (xx >= 43)
M_ARM &= sz.da
# Körper ohne Arm. Die Armpixel bis zur Atemzeile ((46–47,38), (45–47,39); Flanke) bleiben zusätzlich im Körper stehen: der Arm verdeckt sie, beim Atmen schließen sie die Flanke.
_k = spr.copy()
_k[M_ARM & (yy > ATEMZEILE)] = 0
KOERPER = L.platz(_k, sz.H, sz.W, PL, PT)
STUFEN = 5


def schritte(k):
    """n(c) für die Pose k: 0 am Ansatz, k ab dem Handgelenk, dazwischen gleichmäßig gestuft (monoton, höchstens 1 Stufe je Schräge)."""
    return {c: (k if c >= C1 else int(np.floor(k * (c - C0) / (C1 - C0) + 0.5))) for c in range(C0 + 1, 120)}


def arm_pose(k):
    """Arm-Ebene der Pose k (volle Leinwand) und Maske der starren Hand."""
    e = L.leer(sz.H, sz.W)
    n = schritte(k)
    for y, x in zip(*np.nonzero(M_ARM)):
        d = n[int(cc[y, x])]
        e[PT + y - d, PL + x + d] = spr[y, x]
    return e


ARM = [arm_pose(k) for k in range(STUFEN + 1)]
HAND_M = [np.roll(sz.voll(M_ARM & (cc >= C1)), (-k, k), (0, 1)) for k in range(STUFEN + 1)]
ARMZONE = sz.voll((xx >= 34) & (yy >= 26))
ARMZONE[:, PL + sz.sw:] = True
ARMZONE[:PT + 26] = False
TEST_EBENEN = ('figur',)

# Sandkörner an den Flanken: linke Flanke läuft von (23,1) nach (1,38), rechte von (26,1) nach (48,40)
RIESEL = []
for k, (t0, off) in enumerate([(0.10, 2), (0.42, 26), (0.62, 47)]):
    x, y = 23 - 22 * t0, 1 + 37 * t0
    RIESEL.append(dict(x=PL + x - 2, y=PT + y - 1, dx=-7, dy=12, leben=24, periode=72, off=off, farbe=(SAND, SAND2, HELL)[k]))
for k, (t0, off) in enumerate([(0.22, 9), (0.50, 34), (0.05, 46)]):
    x, y = 26 + 22 * t0, 1 + 39 * t0
    RIESEL.append(dict(x=PL + x + 1, y=PT + y - 1, dx=7, dy=12, leben=24, periode=72, off=off, farbe=(SAND2, SAND, HELL)[k]))
# Hand heben und fallen lassen (Periode 36): langsam 5 px hoch (1 px je 3 Bilder), kurz halten, in zwei Bildern herunterfallen, Aufprall bei Bild 26 der Periode.
#        0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35
HEBEN = (0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
AUFPRALL = 26
BEBEN = {26: -1, 27: -1, 28: 0, 29: -1}                                    # Nachbeben: der Körper sackt 1 px zusammen (Zeile entfällt), federt, sackt nochmals
STAUB_F = {'c': SAND, 'r': SAND2}
STAUB = [dict(x=PL + 41, y=PT + 51, vx=-5, vy=-4, leben=9), dict(x=PL + 57, y=PT + 50, vx=4, vy=-5, leben=9),
         dict(x=PL + 47, y=PT + 46, vx=-1, vy=-6, leben=8, start=1), dict(x=PL + 53, y=PT + 47, vx=2, vy=-6, leben=10, start=1)]
RAND_F = [UMRISS]


def staub(i):
    """Staubwölkchen beim Aufprall: 2×2 → 5×3 → 2×2 → weg (nie 1 px), treiben von der Hand weg nach oben."""
    e = L.leer(sz.H, sz.W)
    for pf in STAUB:
        k = (i % 36) - AUFPRALL - pf.get('start', 0)
        if not 0 <= k < pf['leben']:
            continue
        t = k / pf['leben']
        cx, cy = int(round(pf['x'] + pf['vx'] * t)), int(round(pf['y'] + pf['vy'] * t))
        for dx, dy, f in L.PUFF_FORMEN['m' if 0.2 <= t < 0.7 else 's']:
            e[cy + dy, cx + dx, :3] = STAUB_F[f]; e[cy + dy, cx + dx, 3] = 255
    return e


def sauber(f, k):
    """Umriss nach der Scherung säubern (nur Armzone, nie in der starren Hand): 1. Umriss-Einzelpixel, die an einer Scherstufe überstehen (drei der vier Nachbarn
    frei), entfallen; 2. dadurch oder durch die Stufe frei liegende Sandpixel bekommen die Umrissfarbe. Der Umriss wird so nicht dicker."""
    zone = ARMZONE & ~HAND_M[k]
    f = f.copy()
    for _ in range(3):
        m = f[..., 3] > 0
        p = np.pad(m, 1)
        frei = (~p[:-2, 1:-1]).astype(int) + (~p[2:, 1:-1]) + (~p[1:-1, :-2]) + (~p[1:-1, 2:])
        dorn = m & (frei >= 3) & zone & L.farbmaske(f, [UMRISS])
        if not dorn.any():
            break
        f[dorn] = 0
    f = N8.kontur_schliessen(f, RAND_F, UMRISS, maske=zone)
    for x, y in N8.luecken(f):                      # von Armunterkante und Handecke eingeschlossenes Einzelpixel (Ecke (43,47) der Quelle) → Umriss
        if ARMZONE[y, x]:
            f[y, x] = UMRISS + (255,)
    return f


def frame(i, nur=None):
    n = N8.stufe(i, 36, 6, 16)
    n = BEBEN.get(i % 36, n)
    koerper = TX.streck_zeile(KOERPER, PT + ATEMZEILE, n)
    k = HEBEN[i % 36]
    eb = []
    if not nur:
        eb.append((N8.koerner(sz.H, sz.W, i, RIESEL), 0, 0))
    figur = L.zusammen(sz.H, sz.W, [(koerper, 0, 0), (ARM[k], 0, 0)])       # Arm mit Klauenhand als Pose vor dem Körper
    if k or n:
        figur = sauber(figur, k)
    eb.append((figur, 0, 0))
    if not nur:
        eb.append((staub(i), 0, 0))
    return L.zusammen(sz.H, sz.W, eb)


if __name__ == '__main__':
    N8.fertig('ankhota-the-burier', 'Ankhota, the Burier', frame, N, MS, spr, check=[0, 8, 11, 14, 17, 22, 25, 26], zoom=16, box=(30, 24, 67, 59), spalten=4)
