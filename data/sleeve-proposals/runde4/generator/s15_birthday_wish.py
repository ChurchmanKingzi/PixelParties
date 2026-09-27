# -*- coding: utf-8 -*-
"""15 Birthday Wish – Geburtstag im abgedunkelten Labor: vorne links steht Monia mit geschlossenen Augen
und wünscht sich etwas, das Kerzenlicht fällt warm auf ihr Gesicht; hinter ihr die riesige Torte mit drei
brennenden Kerzen, an deren Teller zwei blaue Ballontrauben an langen Schnüren schweben; vorne rechts,
als Gegengewicht zu Monia, das Geschenk.

Quellen (MotiveGN.xcf):
  Ebene 547 „Chibi-Monia“ – Monia mit geschlossenen Augen (Karte „Cool Birthday Girl Monia“)
  Ebene 359 „Ebene #132“ – Torte mit Kerzen (Szene 578 „Sichtbar #42“; dort teils vom Geschenk verdeckt)
  Ebene 360 „Ebene #131“ – zwei Luftballontrauben (nur die Ballons, Zeilen 0–25; die Schnüre neu gezogen)
  Ebene 358 „Ebene #126“ – Geschenk (Szene 578: 135/145 Pixel sichtbar, Rest verdeckt)
  Ebene 134 „Ebene #249“ – Labor-Wand (Mäanderfries) und Bodenplatten
Tiefenebenen / Skalierung (250×350-Raster, Ausgabe ×3):
  Raum und Kerzenschein 2× (Raster 125×175);
  Torte, Ballons, Schnüre (je Traube eine, 1 Rasterpixel, hell/dunkel abwechselnd), Tortenschatten 4× (Raster 63×88);
  Monia und Geschenk (vorderste Ebene, als Paar gleich skaliert) + ihre Schatten 6× (Raster 42×59).
"""
import sys, os, math
from common import *  # noqa
sys.path.append(os.path.join(HERE, '..', '..', 'runde3', 'generator'))
from bkit import *    # noqa

D = 'MotiveGN'
W, H = 250, 350

# ---------------------------------------------------------------- Raum (2×)
lab = layer(D, 134)
frieze = lab[169 + 10:169 + 34, 70:390, :3]        # Mäanderfliesen als Fries
floor = lab[169 + 150:169 + 240, 70:390, :3]       # Bodenplatten
bg = Canvas(125, 175)
FLOORY = 98                                        # Wand/Boden-Kante im 2×-Raster
vgrad(bg, [(0, (14, 8, 20)), (1, (34, 20, 36))], y1=FLOORY)
for y in range(FLOORY - 26, FLOORY - 2):           # Fries knapp über dem Boden, stark abgedunkelt
    for x in range(125):
        c = frieze[y - (FLOORY - 26), (x + 7) % frieze.shape[1]].astype(float)
        bg.a[y, x] = (c * 0.22 + np.array([22, 12, 24])).astype(np.uint8)
bg.a[FLOORY - 27] = (12, 6, 14); bg.a[FLOORY - 2] = (12, 6, 14)
for y in range(FLOORY, 175):
    for x in range(125):
        c = floor[(y - FLOORY) % floor.shape[0], (x + 3) % floor.shape[1]].astype(float)
        bg.a[y, x] = (c * 0.30 + np.array([16, 10, 14])).clip(0, 255).astype(np.uint8)
bg.a[FLOORY - 1] = (10, 6, 12); bg.a[FLOORY] = (60, 44, 50)
# Kerzenschein: warmes Licht in drei Stufen, zwischen den Stufen geordnet gedithert
CANDLE = (62.5, 62)
LV = [np.array([1.25, 1.1, 0.95]), np.array([1.6, 1.3, 1.0]), np.array([2.1, 1.6, 1.1])]
for y in range(175):
    for x in range(125):
        d = math.hypot(x + .5 - CANDLE[0], (y + .5 - CANDLE[1]) * 0.95) / 70
        if d >= 1: continue
        t = (1 - d) * 3
        i = int(t); f = t - i
        if f > BAYER4[y % 4, x % 4]: i += 1
        if i == 0: continue
        c = bg.a[y, x].astype(float) * LV[min(i, 3) - 1] + np.array([6, 2, 0]) * i
        bg.a[y, x] = c.clip(0, 255).astype(np.uint8)
cv = Canvas(W, H)
cv.a[:] = up(np.dstack([bg.a, np.full((175, 125), 255, np.uint8)]), 2)[:H, :W, :3]
vignette_grid(cv, 0.6, 0.5, g=2)

# ---------------------------------------------------------------- Torte + Ballons (4×)
G = 4
gw, gh = 63, 88
out = np.zeros((gh, gw, 4), np.uint8)
def put(o, s, x, y):
    for j in range(s.shape[0]):
        for i in range(s.shape[1]):
            if s[j, i, 3] and 0 <= x + i < o.shape[1] and 0 <= y + j < o.shape[0]:
                o[y + j, x + i] = s[j, i]
def shadow(o, cx, cy, rx, ry, col=(18, 10, 14, 255)):
    for Y in range(int(cy - ry), int(cy + ry) + 1):
        for X in range(int(cx - rx), int(cx + rx) + 1):
            q = ((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2
            if q < 1 and 0 <= X < o.shape[1] and 0 <= Y < o.shape[0] and ((X + Y) % 2 == 0 or q < 0.45):
                o[Y, X] = col

cake = sprite('c15_cake', D, [359])                   # 31×25
TX, TY = 19, 26                                       # Torte: x 76..176, y 104..228
bal = [p for p in parts(sprite('c15_balloons', D, [360]), dil=0, minpx=1)]
cl = bal[0][:26].copy()                               # linke Traube ohne Schnüre (16×26)
cr = bal[1][:26].copy()
def trim_(s):
    b = bbox(s); return s[b[1]:b[3], b[0]:b[2]]
cl, cr = trim_(cl), trim_(cr)
# Schnur-Knoten der drei Ballons je Traube (unterste blaue Pixel) -> Tellerrand
def knots(s):
    pts = []
    for x in range(s.shape[1]):
        ys = np.where(s[:, x, 3] > 0)[0]
        if len(ys): pts.append((x, ys.max()))
    pts.sort(key=lambda t: -t[1])
    sel = []
    for x, y in pts:
        if all(abs(x - a) > 1 for a, _ in sel): sel.append((x, y))
        if len(sel) == 3: break
    return sel
LX, LY = 6, 7                                         # linke Traube (etwas höher)
RX, RY = gw - 6 - cr.shape[1], 11                     # rechte Traube (etwas tiefer)
PL = (TX + 1, TY + 27)                                # Befestigung am Tellerrand links / rechts
PR = (TX + cake.shape[1] - 2, TY + 27)
STR = [(214, 204, 196), (70, 58, 66)]
def string(o, a, b, sag):
    n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) * 2
    last = None; k = 0
    for t in np.linspace(0, 1, n):
        x = a[0] + (b[0] - a[0]) * t + sag * math.sin(math.pi * t)
        y = a[1] + (b[1] - a[1]) * t
        p = (int(round(x)), int(round(y)))
        if p != last and 0 <= p[0] < gw and 0 <= p[1] < gh:
            if not o[p[1], p[0], 3]:
                o[p[1], p[0]] = STR[k % 2] + (255,)
            k += 1; last = p
shadow(out, TX + 12.5, TY + 31, 15, 2.2)
for (cx0, cy0, c, P, sgn) in [(LX, LY, cl, PL, 1), (RX, RY, cr, PR, -1)]:
    kx, ky = sorted(knots(c))[1]                      # mittlerer Knoten der Traube
    string(out, (cx0 + kx, cy0 + ky + 1), P, sag=sgn * 2.5)
put(out, cake, TX, TY)
put(out, cl, LX, LY)
put(out, cr, RX, RY)
cv.paste(up(out, G)[:H, 1:W + 1], 0, 0)

# ---------------------------------------------------------------- Monia + Geschenk (5×, vorne)
K = 6
fw, fh = 42, 59
fo = np.zeros((fh, fw, 4), np.uint8)
ms = sprite('c15_monia', D, [547]).copy()            # 22×16
gs = sprite('c15_gift', D, [358])                    # 14×13
# Kerzenlicht von rechts oben auf Monias Gesicht und Haar: warme Aufhellung, rechte Kanten stärker
for j in range(ms.shape[0]):
    xs = np.where(ms[j, :, 3] > 0)[0]
    if not len(xs): continue
    for i in xs:
        t = 0.15 + 0.35 * (i / ms.shape[1]) * (1 - j / ms.shape[0])
        if i == xs.max(): t += 0.35
        c = ms[j, i, :3].astype(float)
        ms[j, i, :3] = (c * (1 + t * 0.6) + np.array([60, 30, 0]) * t).clip(0, 255).astype(np.uint8)
MX, MY = 4, 53 - ms.shape[0]
GX, GY = 24, 53 - gs.shape[0]
shadow(fo, MX + 8, MY + 22, 8, 1.6)
shadow(fo, GX + 7, GY + 14, 8, 1.6)
put(fo, ms, MX, MY)
put(fo, gs, GX, GY)
cv.paste(up(fo, K), 0, 0)
print(save(cv, '15_birthday_wish.png'))
