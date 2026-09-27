# -*- coding: utf-8 -*-
"""39 Loose Thread – Kalypso, die weiße Katze mit der goldenen Mähne, liegt im Sonnenfleck auf dem Dielenboden
auf dem Rücken und hat das große Wollknäuel mit hochgereckten Pfoten in die Luft geschleudert; der abgewickelte
Faden fällt vom Knäuel herab, zieht eine Schlaufe über den Boden und endet verheddert an ihren Pfoten.

Quellen (MotiveIndia.xcf, Karte „Kalypso“, Szene Sichtbar #70 [18]):
  Ebene 175 „KALYPSO“    – Katze auf dem Rücken (Körper, Kopf, Schwanz)
  Ebene 172 „KALYPSO #4“ – goldene Mähne + blaue Augen (gehört zur Figur, Szene 1.0)
  Ebene 176 „KALYPSO #2“ – hochgereckte Pfoten (alternative Pfotenhaltung der Figur; in der Szene steht an
                           derselben Stelle Ebene 174 mit angezogenen Pfoten)
  Ebene 173 „KALYPSO #3“ – Wollknäuel mit Fadenende
  Ebene 296 „Non-Fungible Monkee #1“ – gerahmtes Porträt an der Wand (Sichtbar #62)
Selbst gezeichnet: Wand, Fußleiste, Dielenboden, Sonnenlicht aus dem (unsichtbaren) Fenster, Schatten,
Nagel + Bilderschnur, der weitere Wollfaden (1 Zelle breit, Farben des Originalfadens hell/dunkel abwechselnd).

Skalierung: EIN Raster 3× (84×117 Zellen) für alles; einmal hochskaliert.
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import lowres, blow  # noqa

B = 'MotiveIndia'
G = 3
lo = lowres(G)                      # 84×117
W, H = lo.w, lo.h

cat = sprite('h39_cat', B, [172, 176, 175])        # Ursprung (380,133)
ball = sprite('h39_ball', B, [173])                # 28×27, Fadenende unten rechts bei (23,26)
T1, T2 = (255, 0, 210), (170, 0, 140)              # Fadenfarben aus dem Knäuel (hell/dunkel)

# --- Wand ----------------------------------------------------------------------------------------------
FLOOR = 66
WALL1, WALL2 = (58, 40, 70), (50, 34, 62)
for y in range(FLOOR):
    for x in range(W):
        lo.px(x, y, WALL1 if (x // 4) % 2 == 0 else WALL2)
# Fußleiste
for y in range(FLOOR - 4, FLOOR):
    for x in range(W):
        lo.px(x, y, (86, 54, 40) if y == FLOOR - 4 else ((64, 40, 30) if y < FLOOR - 1 else (40, 24, 20)))

# Bild an der Wand: gerahmtes Affenporträt (Ebene 296), an Schnur und Nagel
pic = sprite('h39_picture', B, [296])
PX0, PY0 = 11, 16
NX, NY = PX0 + pic.shape[1] // 2, PY0 - 6
for i in range(1, 7):                                   # zwei Schnurhälften vom Nagel zu den Rahmenecken
    lo.px(NX - i, NY + i, (150, 120, 90) if i % 2 else (96, 74, 56))
    lo.px(NX + i, NY + i, (150, 120, 90) if i % 2 else (96, 74, 56))
lo.px(NX, NY, (200, 200, 210)); lo.px(NX, NY + 1, (90, 90, 100))   # Nagel
for y in range(PY0 + 1, PY0 + pic.shape[0] + 1):        # Schlagschatten des Rahmens
    lo.a[y, PX0 + pic.shape[1]] = (lo.a[y, PX0 + pic.shape[1]] * 0.6).astype(np.uint8)
for x in range(PX0 + 1, PX0 + pic.shape[1] + 1):
    lo.a[PY0 + pic.shape[0], x] = (lo.a[PY0 + pic.shape[0], x] * 0.6).astype(np.uint8)
lo.paste(pic, PX0, PY0)

# --- Dielenboden ---------------------------------------------------------------------------------------
P1, P2, SEAM = (140, 92, 54), (126, 82, 48), (84, 52, 32)
yy, k, rows = FLOOR, 0, []
while yy < H:
    hgt = 4 + k
    rows.append((yy, hgt))
    for y in range(yy, min(H, yy + hgt)):
        for x in range(W):
            lo.px(x, y, P1 if k % 2 == 0 else P2)
    for x in range(W): lo.px(x, yy, SEAM)
    off = (k * 23) % 37
    for x in range(off, W, 37):                     # Stoßfugen
        for y in range(yy, min(H, yy + hgt)): lo.px(x, y, SEAM)
    yy += hgt; k += 1

# --- Sonnenlicht: Schacht von rechts oben, heller Fleck am Boden um die Katze ---------------------------
def lighten(x, y, t, col=(255, 214, 150)):
    # ohne Dithering: jede Zelle gleichmäßig zur Lichtfarbe gemischt (zwei Stufen: Kern/Rand)
    if 0 <= x < W and 0 <= y < H:
        lo.a[y, x] = (lo.a[y, x] * (1 - t) + np.array(col) * t).astype(np.uint8)
for y in range(H):
    for x in range(W):
        # Lichtschacht: Band zwischen zwei parallelen Schrägen
        u = x - (86 - y * 0.62)
        if 0 < u < 44 and y < FLOOR:
            lighten(x, y, 0.13 if 3 < u < 41 else 0.07)
        # Lichtfleck auf dem Boden (Fensterform, perspektivisch)
        if y >= FLOOR + 6:
            fx = (x - 42) / 40.0; fy = (y - 94) / 17.0
            if abs(fx) < 1 and abs(fy) < 1:
                lighten(x, y, 0.26 if (abs(fx) < 0.93 and abs(fy) < 0.86) else 0.12)

# --- Katze ------------------------------------------------------------------------------------------
CX0, CY0 = 42 - cat.shape[1] // 2, 104 - cat.shape[0]     # Rücken liegt auf Zeile 104
# Schatten unter dem Körper
for x in range(CX0 + 2, CX0 + cat.shape[1] - 6):
    for y in (104, 105):
        lo.a[y, x] = (lo.a[y, x] * (0.6 if y == 104 else 0.8)).astype(np.uint8)
# Pfotenspitzen (Ebene 176 liegt bei x 392–411, y 133 → relativ 12–31, 0)
paw_l = (CX0 + 14, CY0 + 1)
paw_r = (CX0 + 28, CY0 + 1)

# --- Wollknäuel in der Luft ----------------------------------------------------------------------------
BX, BY = 44, 22
tail = (BX + 23, BY + 26)

# --- Faden: vom Knäuelende herab, Schlaufe über den Boden, zurück zu den Pfoten ---------------------------
def catmull(pts, n=24):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(p, float) for p in P[i - 1:i + 3]]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(np.array(P[-2], float))
    return out

def thread(pts, start=0):
    cells = []
    for p in catmull(pts, 40):
        c = (int(round(p[0])), int(round(p[1])))
        if not cells or c != cells[-1]:
            # 8er-Nachbarschaft ohne Lücken
            if cells:
                px, py = cells[-1]
                while max(abs(c[0] - px), abs(c[1] - py)) > 1:
                    px += (c[0] > px) - (c[0] < px); py += (c[1] > py) - (c[1] < py)
                    cells.append((px, py))
            cells.append(c)
    # doppelte Ecken (L-Stufen) entfernen → sauberer 1-Zellen-Faden
    clean = []
    for c in cells:
        if len(clean) >= 2 and abs(c[0] - clean[-2][0]) <= 1 and abs(c[1] - clean[-2][1]) <= 1:
            clean[-1] = c
        else:
            clean.append(c)
    for i, (x, y) in enumerate(clean):
        lo.px(x, y, T1 if (i + start) % 2 == 0 else T2)
    return clean

lo.paste(cat, CX0, CY0)
# EIN durchgehender Faden: Knäuelende → rechts über die Mähne herab → vorne über den Boden nach links →
# über den Schwanz hinauf → um beide Pfoten gewickelt
path = [tail, (tail[0] + 3, tail[1] + 10), (71, 72), (70, 90), (62, 104), (40, 107), (20, 106), (11, 100),
        (12, 90), (17, 84), (paw_l[0] - 2, paw_l[1] + 7), paw_l, (paw_l[0] + 7, paw_l[1] + 5), paw_r]
thread(path)
# Schatten des Knäuels am Boden (klein, weit unten = hoch in der Luft)
for x in range(BX + 6, BX + 22):
    lo.a[FLOOR + 8, x] = (lo.a[FLOOR + 8, x] * 0.7).astype(np.uint8)
lo.paste(ball, BX, BY)

cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '39_loose_thread.png'))
