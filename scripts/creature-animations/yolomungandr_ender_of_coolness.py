# -*- coding: utf-8 -*-
"""Idle-Animation für „Yolomungandr, Ender of Coolness“ (Creature) — die riesige Weltenschlange: Leib steigt unten auf, biegt sich im Bogen nach rechts, der Kopf blickt rechts herab.

Quelle: src/yolomungandr-ender-of-coolness.png (80×58 px, 12 Farben).
PICK: [["MotiveCoolhalla", 185, 1]]   (Ebene „Ebene #43“: die ganze Schlange in einem Stück, vollständig deckend)
Die Kartenkunst zeigt dieselbe Schlange (vergrößerter Ausschnitt, Ebene 26) um das Coolhalla-Gebäude gewunden, mit Ketten (Ebene 175), Zahnreihe (176/178) und Schatten (173/177) – das ist Kulisse/Ausschnitt;
als Creature-Sprite dient die vollständige Figur der Ebene 185 (Annahme, siehe Bericht).

Was im Sprite ist (x, y):
* RÜCKEN: Schachbrett aus (112,133,152)/(40,58,70) (streng nach (x+y) gerade/ungerade), Umriss (28,29,33); drei große RÜCKENSTACHELN nach links (y 4–7, y 18–25, y 35–43) und Hörner am Kopf (x 64–76, y 4–10).
* BAUCH: Schachbrett aus (239,208,188)/(145,112,71) mit braunen Segmentlinien (71,43,19).
* KOPF (x 62–79, y 4–25): zwei gelbe AUGEN ((243,217,158)/(195,172,66)/(190,147,34), dunkelrot (54,7,0), Pupillen schwarz) bei (71–74, 15–17) und (74–76, 17–19); weiße ZÄHNE (255,255,255) im offenen Maul (x 67–73, y 19–24).
* SCHWANZENDE: läuft unten links als dünne dunkle Linie aus (x 0–20, y 53–57), daneben ein flacher grauer Fleck (x 18–25, y 53–55). Liegt am Boden → völlig still.

Ablauf (72 Frames à 80 ms = 5,76 s – riesiges Wesen, langsam; nahtlos, Frame 0 = Original):
* KOPF WIEGEN (Idle-Idee: die Schlange wiegt ihren Kopf wie eine Kobra in einer liegenden Acht): der Leib schwingt seitlich (Zeilenversatz, unten y ≥ 50 fest, nach oben bis ±2 px, oberhalb y 26 einheitlich – Periode 72),
  der Bogen hebt/senkt den Kopf (ein bis zwei Versatzstufen zwischen x 49 und x 63, ±2 px am Kopf – Periode 36; die Stufen liegen dort, wo am wenigsten Zacken im Umriss entstehen – `beste_grenzen`). Der KOPF (x ≥ 64) bewegt sich dabei als starre Einheit (Hörner, Augen, Zähne unverändert zueinander).
  Gefälle höchstens 1 px je mehrere Zeilen/Spalten, nichts wird gestreckt oder kopiert.
* Das Schachbrett-Muster von Rücken und Bauch wird nach jeder Verschiebung wieder am festen Raster ausgerichtet (kein Flimmern/keine Doppelspalten an den Versatzstufen); Segmentlinien, Augen, Zähne wandern mit.
* Wird an einer Versatzstufe ein Innenpixel zur Außenkante, bekommt es die Umrissfarbe (Umriss bleibt geschlossen, 1 px).
Kein Blinzeln (keine Lider), keine Partikel, kein Glanz. Ergänzungen: keine. Farben: nur Quelle.
"""
import math

import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_n1 as N1

N, MS = 72, 80
SLUG = 'yolomungandr-ender-of-coolness'
spr = L.lade(SLUG)
S = N1.Szene(spr, (5, 6, 5, 3))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
BASIS = S.ebene()
B1, B2 = (112, 133, 152), (40, 58, 70)
T1, T2 = (239, 208, 188), (145, 112, 71)
UMRISS = (28, 29, 33)
INNEN = {B1, B2, T1, T2, (71, 43, 19)}
TEST_EBENEN = 'koerper'


def r(v):
    return int(math.floor(v + 0.5))


def glatt(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def kanten(a):
    """Je Spalte: oberste Pixelzeile, oberste Bauchzeile, unterste Pixelzeile des Bogens (nur Bogenbereich)."""
    out = []
    for x in range(PL + 44, PL + 70):
        ys = np.nonzero(a[:PT + 30, x, 3])[0]
        tan = [y for y in ys if tuple(int(v) for v in a[y, x, :3]) in (T1, T2)]
        out.append((int(ys.min()), min(tan) if tan else -1, int(ys.max())))
    return out


def hoecker(a):
    """Zahl der 1–2 Spalten breiten Zacken/Kerben in den drei Kantenzügen (Maß für unruhige Versatzstufen)."""
    k = kanten(a)
    n = 0
    for j in range(3):
        e = [v[j] for v in k]
        for q in range(1, len(e) - 2):
            if e[q] != e[q - 1] and e[q + 1] == e[q - 1]:
                n += 2
            elif e[q] != e[q - 1] and e[q] == e[q + 1] and e[q + 2] == e[q - 1]:
                n += 1
    return n


def heben(a, grenzen, vz):
    """Spalten ab jeder Grenze (Leinwandspalte) um je 1 px weiter in Richtung vz versetzen (Bogen/Kopf als Hebel; der Kopf rechts aller Grenzen bleibt starr)."""
    return N1.spalten_dy(a, lambda x: vz * sum(1 for g in grenzen if x >= g))


def beste_grenzen(k, vz):
    """Die k Versatzstufen so legen (zwischen x 49 und x 63, vor dem Kopf), dass möglichst keine Zacken entstehen."""
    import itertools
    best = None
    for gs in itertools.combinations(range(PL + 49, PL + 64), k):
        if any(q - p < 4 for p, q in zip(gs, gs[1:])):
            continue
        sc = hoecker(heben(BASIS, gs, vz))
        if best is None or sc < best[0]:
            best = (sc, gs)
    return best[1]


GRENZEN = {(k, vz): beste_grenzen(k, vz) for k in (1, 2) for vz in (-1, 1)}


def frame(i, nur=None):
    th = L.sinus(i, N)
    ax, ay = 2.0 * math.sin(th), 2.0 * math.sin(2 * th)
    dx_oben = r(ax)
    a = N1.zeilen_dx(BASIS, lambda y: r(ax * glatt((50 - (y - PT)) / 24.0)))
    kopf = r(ay)
    if kopf:
        gs = [g + dx_oben for g in GRENZEN[(abs(kopf), 1 if kopf > 0 else -1)]]
        a = heben(a, gs, 1 if kopf > 0 else -1)
    horn = (PT + 5 + kopf, PL + 67 + dx_oben)             # die Hornspitze (67,5) ist schon im Original ein helles Randpixel und bleibt es
    for y, x in zip(*np.nonzero(Hm.kantenmaske(a))):
        if y < PT + 52 and (y, x) != horn and tuple(int(v) for v in a[y, x, :3]) in INNEN:
            a[y, x, :3] = UMRISS
    # Schachbrett am festen Raster ausrichten (nur oberhalb des ruhenden Schwanzendes)
    for y in range(PT + 52):
        for x in np.nonzero(a[y, :, 3])[0]:
            c = tuple(int(v) for v in a[y, x, :3])
            g = (x - PL + y - PT) % 2 == 0
            if c in (B1, B2):
                a[y, x, :3] = B1 if g else B2
            elif c in (T1, T2):
                a[y, x, :3] = T1 if g else T2
    a[horn[0], horn[1], :3] = B1
    return a


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss(SLUG, 'Yolomungandr, Ender of Coolness', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
