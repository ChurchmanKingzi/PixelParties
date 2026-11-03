# -*- coding: utf-8 -*-
"""Idle-Animation für „Jumper Spider“ (Creature) — Runde 3 überarbeitet.

Nutzerfeedback Runde 3: „Jumper Spider: fehlen teilweise die Füße? Außerdem soll sie, wie die Slimes, richtig abspringen und wieder landen.“

Quelle: src/jumper-spider.png — Ebene „Ebene #308“ (17×13 px, 5 Farben) aus MotiveGN.xcf (Ebene 278): die schwarze Springspinne von vorn mit zwei roten Augen (dieselbe Spinne steckt als Körper
im Cute Spider). Auf der Karte liegt dahinter eine große, unscharfe, halbtransparente Sprungspur („Motion Blur“, Ebene 281) — kein Pixelart, nicht übernommen.
PICK: [["MotiveGN", 278, "ganze Ebene"]]

Aufruf:   python3 jumper_spider.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/jumper-spider.png + .json  (Frame auf die Figur zugeschnitten, Luftraum des Sprungs inklusive)

Identifikation (Sprite 17×13, Spinne von vorn, symmetrisch um x = 8; links schwarz/dunkelgrau, rechts grau):
* Körperkern (x 4–12, Zeilen 1–6 + Bauchstummel (5,7), (6,7), (6,8) bzw. (10,7), (11,7), (10,8)): graue Platten (40,41,39)/(31,32,30)/(65,66,64); oben bei (8,0) ein einzelnes Pixel; zwei rote Augen
  (255,2,0) bei (7,5) und (9,5).
* Acht Beine als einpixelige Ketten (Wurzel am Körperkern → Fuß). Links: L1 (3,2) (2,3) (1,4) (0,5) [vorderes Bein, nach oben geknickt, Ansatz (4,1)];
  L2 (3,4) (2,5) (1,6) (1,7) … (1,11) [langes äußeres Hinterbein, Ansatz (4,3); dazu der Knie-Stummel (0,6)]; L3 (3,7) (2,8) [Ansatz (4,6)]; L4 (4,8) (4,9) (3,10) (3,11) (3,12) [inneres Hinterbein,
  Ansatz (5,7)]. Rechts spiegelbildlich: R1 (13,2) (14,3) (15,4) (16,5) [Ansatz (12,1)]; R2 (13,4) (14,5) (15,6) (15,7) … (15,11) [Ansatz (12,3), Stummel (16,6)]; R3 (13,7) (14,8) [Ansatz (12,6)];
  R4 (12,8) (12,9) (13,10) (13,11) (13,12) [Ansatz (11,7)]. (Runde 2 hat die Beine einer Seite als ein verwobenes Gelenkgeflecht bewegt — dabei gingen Füße verloren; jetzt hat jedes Bein seine eigene Kette.)
* Kein Glanz (Regel 14), keine Partikel.

Ablauf (60 Frames à 65 ms = 3,9 s), Frame 0 = Original. Zwei richtige Sprünge pro Schleife (wie bei den Slimes: Hocke → Absprung/Streckung → Flug → Landung/Squash → Ruhe):
* Sprung 1 (Frames 5–23, Scheitel 9 px über dem Boden), Sprung 2 (Frames 35–53, Scheitel 5 px). Je Sprung: Anlauf (2 Frames still), Hocke (Körper senkt sich in 2 Stufen um 2 px, die Knie spreizen nach außen, die Füße
  bleiben am Boden), Absprung (Körper schießt hoch, die Beine strecken sich nach unten, die Füße verlassen als Letztes den Boden), Flug (die ganze Figur ist in der Luft; die Füße ziehen beim Aufstieg an den Körper,
  vor der Landung strecken sie sich wieder nach unten und spreizen), Landung (Füße zuerst am Boden, der Körper federt tiefer als in der Ruhe — Squash mit 2 px gespreizten Knien), Ausfedern, Ruhe.
* Beine werden je Frame neu gezeichnet: Wurzel am Körperkern (mit 8er-Linie angeschlossen, wenn der Fuß noch am Boden steht, während der Körper steigt), Gelenke dazwischen verschoben, 8er-Linien dazwischen —
  nichts wird verdoppelt oder gedehnt, kein Fuß fehlt (Test: jedes Bein hat in JEDEM Frame alle Knoten, Fuß und Körper bleiben 8-verbunden).
* Ruhephasen: Fußtippeln (ein Fuß hebt sich für 3 Frames 1 px), Blinzeln (beide Augen 2 Frames, Lid = (31,32,30), Frames 27–28 und 58–59).
Ergänzungen: keine gemalten Pixel — nur die Verbindungslinien der Beine (Farbe des jeweiligen Beinpixels).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_spinne as S

N, MS = 60, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 14, 3

spr = L.lade('jumper-spider')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)

# Beine: (Name, Ansatz am Körperkern, Kette Wurzel → Fuß, Seite)
BEINE = [
    ('L1', (4, 1), [(3, 2), (2, 3), (1, 4), (0, 5)], -1),
    ('L2', (4, 3), [(3, 4), (2, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11)], -1),
    ('L3', (4, 6), [(3, 7), (2, 8)], -1),
    ('L4', (5, 7), [(4, 8), (4, 9), (3, 10), (3, 11), (3, 12)], -1),
    ('R1', (12, 1), [(13, 2), (14, 3), (15, 4), (16, 5)], 1),
    ('R2', (12, 3), [(13, 4), (14, 5), (15, 6), (15, 7), (15, 8), (15, 9), (15, 10), (15, 11)], 1),
    ('R3', (12, 6), [(13, 7), (14, 8)], 1),
    ('R4', (11, 7), [(12, 8), (12, 9), (13, 10), (13, 11), (13, 12)], 1),
]
STUMMEL = [((0, 6), (1, 6), -1), ((16, 6), (15, 6), 1)]                    # (Pixel, Elternknoten (Kettenpixel), Seite) — bewegt sich mit dem Elternknoten
_bein_pixel = {p for _, _, k, _ in BEINE for p in k} | {s[0] for s in STUMMEL}
KERN = vor.copy()
for (_x, _y) in _bein_pixel:
    assert vor[_y, _x], (_x, _y)
    KERN[_y, _x] = False
for _n, _a, _k, _s in BEINE:
    assert KERN[_a[1], _a[0]], f'{_n}: Ansatz {_a} nicht im Körperkern'
    for _p, _q in zip([_a] + _k[:-1], _k):
        assert max(abs(_p[0] - _q[0]), abs(_p[1] - _q[1])) == 1, f'{_n}: {_p}→{_q} nicht 8-verbunden'
for (_p, _par, _s) in STUMMEL:
    assert max(abs(_p[0] - _par[0]), abs(_p[1] - _par[1])) == 1
assert int(KERN.sum()) + len(_bein_pixel) == int(vor.sum())
AUGEN = [(7, 5), (9, 5)]
LID = (31, 32, 30)


def farbe(p):
    return tuple(int(v) for v in spr[p[1], p[0], :3])


# ── Sprungablauf: je Frame (G, p, t, s) ──────────────────────────────────────────────────────────────────────────────────────────────────────
#   G = Körperversatz (px, + = nach unten), p = „Füße am Boden“-Anteil 0…1 (1 = Füße bleiben unten, die Beine strecken/stauchen sich), t = Füße zum Körper gezogen (+) bzw. nach unten gestreckt (−),
#   s = Knie nach außen (+) bzw. nach innen (−) in px
def sprung(hoehe):
    """Zustandsfolge eines Sprungs mit Scheitelhöhe `hoehe` (px über dem Boden)."""
    h = lambda f: -int(round(hoehe * f))
    return [
        (0, 1.0, 0, 0), (0, 1.0, 0, 0),                         # Anlauf (still)
        (1, 1.0, 0, 1), (2, 1.0, 0, 1), (2, 1.0, 0, 2),         # Hocke: Körper sinkt, Knie spreizen
        (h(0.12), 1.0, 0, 0),                                   # Absprung: Körper schießt hoch, Beine gestreckt, Füße noch am Boden
        (h(0.45), 0.55, 0, 0),                                  # Füße verlassen den Boden
        (h(0.80), 0.0, 1, 0),                                   # Flug aufwärts, Füße ziehen an
        (h(0.97), 0.0, 2, -1), (h(1.0), 0.0, 2, -1), (h(1.0), 0.0, 2, -1),   # Scheitel
        (h(0.92), 0.0, 1, 0),                                   # Abstieg
        (h(0.72), 0.0, 0, 0),
        (h(0.40), 0.0, -1, 1),                                  # Füße strecken sich nach unten und spreizen
        (h(0.12), 0.7, -1, 1),                                  # fast am Boden
        (1, 1.0, 0, 2),                                         # Landung: Füße am Boden, Körper federt tiefer
        (2, 1.0, 0, 2),
        (1, 1.0, 0, 1),
        (0, 1.0, 0, 0),
    ]


SPRUNG1, SPRUNG2 = sprung(9), sprung(5)
START1, START2 = 5, 35
ZUSTAND = [(0, 1.0, 0, 0)] * N
for st, folge in ((START1, SPRUNG1), (START2, SPRUNG2)):
    for k, z in enumerate(folge):
        ZUSTAND[st + k] = z
TIPPEN = {'L4': (26, 3), 'R4': (30, 3), 'L2': (47 + 6, 3), 'R2': (57, 3)}               # Fuß-Tippeln in den Ruhephasen: (Startframe, Dauer)
BLINZELN = (27, 28, 58, 59)
FLUG = [i for i in range(N) if ZUSTAND[i][1] == 0.0]


def knoten_versatz(name, k, node, z, side):
    """Versatz (dx, dy) des Kettenknotens `node` (Sprite-Koordinaten) im Zustand z = (G, p, t, s)."""
    G, p, t, s = z
    a = min(1.0, max(0.0, (node[1] - 3.0) / 9.0))              # 0 = auf Höhe des Körpers, 1 = Boden
    dy = G * (1.0 - p * a) - t * a
    dx = side * s * math.sin(math.pi * a) - side * (0.0 if t <= 0 else 0.0)
    return int(round(dx)), int(round(dy))


def frame(i, nur=None):
    z = ZUSTAND[i]
    G = z[0]
    k, _ = L.trenne(spr, KERN)
    kern = L.platz(k, H, W, PAD_L, PAD_T + G)
    if i in BLINZELN:
        for (x, y) in AUGEN:
            kern[PAD_T + G + y, PAD_L + x, :3] = LID
    bein = L.leer(H, W)
    pos = {}

    def setz(p, c):
        x, y = p
        if not (0 <= x < W and 0 <= y < H):
            raise L.ClipError(f'Beinpixel {p} außerhalb der Leinwand')
        bein[y, x, :3] = c
        bein[y, x, 3] = 255
    for name, ansatz, kette, side in BEINE:
        prev = (PAD_L + ansatz[0], PAD_T + G + ansatz[1])
        for j, node in enumerate(kette):
            dx, dy = knoten_versatz(name, j, node, z, side)
            if name in TIPPEN and j == len(kette) - 1:
                st, d = TIPPEN[name]
                if 0 <= i - st < d:
                    dy -= 1
            q = (PAD_L + node[0] + dx, PAD_T + node[1] + dy)
            for px in S.linie(prev, q)[1:]:
                setz(px, farbe(node))
            pos[node] = q
            prev = q
    for p, par, side in STUMMEL:
        q = pos[par]
        d = (q[0] - (PAD_L + par[0]), q[1] - (PAD_T + par[1]))
        setz((PAD_L + p[0] + d[0], PAD_T + p[1] + d[1]), farbe(p))
    ebenen = {'beine': bein, 'kern': kern}
    wahl = nur or ('beine', 'kern')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


def test_beine(frames_roh):
    """Jedes Bein hat in jedem Frame alle Knoten (kein Fuß fehlt) und hängt am Körper: die ganze Figur ist ein 8-zusammenhängendes Teil, und im Ruhezustand sind es genau die Originalpixel."""
    import cv2
    for k, f in enumerate(frames_roh):
        m = (f[..., 3] > 0).astype(np.uint8)
        n, _ = cv2.connectedComponents(m, connectivity=8)
        assert n - 1 == 1, f'Frame {k}: Figur zerfällt in {n - 1} Teile'
        for name, ansatz, kette, side in BEINE:
            foot = kette[-1]
            z = ZUSTAND[k]
            dx, dy = knoten_versatz(name, len(kette) - 1, foot, z, side)
            q = (PAD_L + foot[0] + dx, PAD_T + foot[1] + dy)
            if name in TIPPEN and 0 <= k - TIPPEN[name][0] < TIPPEN[name][1]:
                q = (q[0], q[1] - 1)
            assert f[q[1], q[0], 3] and tuple(int(v) for v in f[q[1], q[0], :3]) == farbe(foot), f'Frame {k}: Fuß von {name} fehlt bei {q}'
    print('BEIN-Test bestanden: in allen', len(frames_roh), 'Frames sind alle Füße da und die Figur bleibt ein Teil')


def zuschneiden(frames):
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = int(xs.min()) - 2, int(xs.max()) + 2, int(ys.min()) - 2, int(ys.max()) + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    assert (frames[0][PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all(), 'Frame 0 ist nicht das Original'
    test_beine(frames)
    frames = zuschneiden(frames)
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('jumper-spider', 'Jumper Spider', frames, MS, prev)
    if prev:
        L.streifen(prev + '/jumper-spider-strip.png', frames, spalten=12, scale=6)
