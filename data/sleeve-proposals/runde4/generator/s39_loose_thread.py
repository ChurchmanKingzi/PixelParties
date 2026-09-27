# -*- coding: utf-8 -*-
"""39 Loose Thread – Kalypso, die weiße Katze mit der goldenen Mähne, liegt im Sonnenfleck unter dem Fenster
auf dem Dielenboden auf dem Rücken und hält mit hochgereckten Pfoten den Faden des großen Wollknäuels, das
hinter ihr auf dem Boden liegt; der Faden läuft in einer weichen Kurve über die Dielen zu ihren Pfoten.
An der Wand hängt ein gerahmtes Affenporträt.

Quellen (MotiveIndia.xcf, Karte „Kalypso“, Szene Sichtbar #70 [18]):
  Ebene 175 „KALYPSO“    – Katze auf dem Rücken (Körper, Kopf, Schwanz)
  Ebene 172 „KALYPSO #4“ – goldene Mähne + blaue Augen (gehört zur Figur, Szene 1.0)
  Ebene 176 „KALYPSO #2“ – hochgereckte Pfoten (alternative Pfotenhaltung der Figur; in der Szene steht an
                           derselben Stelle Ebene 174 mit angezogenen Pfoten)
  Ebene 173 „KALYPSO #3“ – Wollknäuel mit Fadenende
  Ebene 296 „Non-Fungible Monkee #1“ – gerahmtes Porträt an der Wand (Sichtbar #62)
Selbst gezeichnet: Wand, Fußleiste, Dielenboden, Sonnenfleck mit Fensterkreuz-Schatten, Nagel + Bilderschnur,
der weitere Wollfaden (1 Zelle breit, lückenlos 4er-verbunden, Fadenfarben hell/dunkel Zelle für Zelle).

Skalierung: EIN Raster 4× (63×88 Zellen) für alles; einmal hochskaliert. Schwanzspitze links und Mähnenende
rechts laufen in die Rahmenzone (Kopf/Augen ≥ 38 px vom Rand).
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import lowres, blow  # noqa

B = 'MotiveIndia'
G = 4
lo = lowres(G)                      # 63×88
W, H = lo.w, lo.h

cat = sprite('h39_cat', B, [172, 176, 175])        # Ursprung (380,133), 63×33
ball = sprite('h39_ball', B, [173])                # 28×27, Fadenende unten rechts bei (23,26)
T1, T2 = (250, 10, 206), (196, 0, 158)             # Fadenfarben (hell/dunkel, aus dem Knäuel)

# --- Wand ----------------------------------------------------------------------------------------------
FLOOR = 36
WALL1, WALL2 = (58, 40, 70), (52, 36, 64)
for y in range(FLOOR):
    for x in range(W):
        lo.px(x, y, WALL1 if (x // 3) % 2 == 0 else WALL2)
for x in range(W):                                   # Fußleiste
    lo.px(x, FLOOR - 3, (92, 58, 42)); lo.px(x, FLOOR - 2, (66, 42, 30)); lo.px(x, FLOOR - 1, (40, 24, 20))

# Bild an der Wand: gerahmtes Affenporträt (Ebene 296), an Schnur und Nagel
pic = sprite('h39_picture', B, [296])
PX0, PY0 = 8, 11
NX, NY = PX0 + pic.shape[1] // 2, PY0 - 5
for i in range(1, 6):
    c = (150, 120, 90) if i % 2 else (96, 74, 56)
    lo.px(NX - i, NY + i, c); lo.px(NX + i, NY + i, c)
lo.px(NX, NY, (200, 200, 210))
for y in range(PY0 + 1, PY0 + pic.shape[0] + 1):
    lo.a[y, PX0 + pic.shape[1]] = (lo.a[y, PX0 + pic.shape[1]] * 0.6).astype(np.uint8)
for x in range(PX0 + 1, PX0 + pic.shape[1] + 1):
    lo.a[PY0 + pic.shape[0], x] = (lo.a[PY0 + pic.shape[0], x] * 0.6).astype(np.uint8)
lo.paste(pic, PX0, PY0)

# --- Dielenboden (Bretter nach vorn breiter) --------------------------------------------------------------
P1, P2, SEAM = (140, 92, 54), (128, 84, 49), (84, 52, 32)
yy, k = FLOOR, 0
while yy < H:
    hgt = 3 + k
    for y in range(yy, min(H, yy + hgt)):
        for x in range(W): lo.px(x, y, P1 if k % 2 == 0 else P2)
    for x in range(W): lo.px(x, yy, SEAM)
    for x in range((k * 17) % 29, W, 29):
        for y in range(yy, min(H, yy + hgt)): lo.px(x, y, SEAM)
    yy += hgt; k += 1

# --- Sonnenfleck vom (links außerhalb liegenden) Fenster: Parallelogramm mit Fensterkreuz-Schatten ---------
SUN = np.array((255, 212, 140))
def lit(x, y, t):
    if 0 <= x < W and 0 <= y < H:
        lo.a[y, x] = (lo.a[y, x] * (1 - t) + SUN * t).astype(np.uint8)
Y0, Y1 = 60, 87                                     # Fleck auf dem Boden
for y in range(Y0, Y1):
    s = (y - Y0) / (Y1 - Y0)
    xa = int(round(3 + s * 8)); xb = int(round(47 + s * 12))       # schräg nach rechts vorn
    xm = (xa + xb) // 2; ym = 76                   # Querholz vor der Katze sichtbar
    for x in range(xa, xb):
        bar = abs(x - xm) <= 0 or abs(y - ym) <= 0             # Fensterkreuz (1 Zelle breit)
        edge = x in (xa, xb - 1) or y in (Y0, Y1 - 1)
        if not bar: lit(x, y, 0.28 if edge else 0.52)
        else: lo.a[y, x] = (lo.a[y, x] * 0.8).astype(np.uint8)   # Schatten des Fensterkreuzes
# schwacher Lichtschacht in der Luft (von links oben zum Fleck)
for y in range(0, Y0):
    for x in range(W):
        u = x - (-24 + y * 0.62)
        if 0 < u < 40 and y >= FLOOR: lit(x, y, 0.08)

# --- Wollknäuel: liegt hinten rechts auf dem Boden -------------------------------------------------------------
BX, BY = 28, FLOOR + 4 - ball.shape[0]             # Unterkante knapp hinter der Fußleiste auf den Dielen
for x in range(BX + 3, BX + 23):                   # Kontaktschatten
    lo.a[BY + ball.shape[0], x] = (lo.a[BY + ball.shape[0], x] * 0.62).astype(np.uint8)
lo.paste(ball, BX, BY)
tail = (BX + 23, BY + 26)

# --- Katze vorn ---------------------------------------------------------------------------------------------
CX0, CY0 = 2, 72 - cat.shape[0]                     # Rücken liegt auf Zeile 72
for x in range(CX0 + 3, CX0 + cat.shape[1] - 8):
    lo.a[72, x] = (lo.a[72, x] * 0.6).astype(np.uint8)
    lo.a[73, x] = (lo.a[73, x] * 0.82).astype(np.uint8)
paw_l = (CX0 + 14, CY0 + 1)                        # Pfotenspitzen (Ebene 176 relativ 12–31, 0)
paw_r = (CX0 + 28, CY0 + 1)

# --- Faden: vom Knäuel in weicher Kurve über den Boden (hinter der Katze) zu den Pfoten ----------------------
def catmull(pts, n=40):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = [np.array(p, float) for p in P[i - 1:i + 3]]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(np.array(P[-2], float))
    return out

def thread_cells(pts):
    """Lückenlos 4er-verbundene Zellenkette (keine reinen Diagonalschritte → durchgehende Linie)."""
    cells = []
    for p in catmull(pts):
        c = (int(round(p[0])), int(round(p[1])))
        if cells and c == cells[-1]: continue
        if cells:
            px, py = cells[-1]
            while (px, py) != c:
                if px != c[0] and (abs(c[0] - px) >= abs(c[1] - py)): px += 1 if c[0] > px else -1
                else: py += 1 if c[1] > py else -1
                cells.append((px, py))
        else:
            cells.append(c)
    return cells

path = [tail, (tail[0] + 1, tail[1] + 3), (54, FLOOR + 8), (44, FLOOR + 10), (35, FLOOR + 8),
        (paw_r[0] + 1, paw_r[1] + 3), paw_r, (paw_r[0] - 6, paw_r[1] + 1), paw_l]
cells = thread_cells(path)
for i, (x, y) in enumerate(cells):
    lo.px(x, y, T1 if i % 2 == 0 else T2)
lo.paste(cat, CX0, CY0)
# Fadenstück, das um die Pfoten geschlungen vor der Katze liegt (nochmals obenauf)
on_paws = [c for c in cells if c[1] <= paw_r[1] + 4 and c[0] <= paw_r[0] + 2]
for i, (x, y) in enumerate(on_paws):
    lo.px(x, y, T1 if i % 2 == 0 else T2)

cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '39_loose_thread.png'))
