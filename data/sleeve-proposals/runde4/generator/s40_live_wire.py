# -*- coding: utf-8 -*-
"""40 Live Wire – im dunklen Gewölbelabor steht der Tesla-Kater mit gesträubtem Fell und hochgerissenen Pfoten
zwischen zwei gespiegelten Teslaspulen; von beiden Spulenköpfen springen Lichtbögen zueinander und in den
Kater, um dessen Kopf die Entladung knistert.

Quellen:
  MotiveIndia.xcf, Karte „Tesla“ (Szene Sichtbar #38 [50]):
    Ebenen 87 (Blitzkranz um den Kopf), 88, 89 (Kopf), 90 (Funken an den Armen), 91 (Körper), 92 (Schwanz)
      – Figur vollständig wie in der Szene; Ebene 85 (Marionettenfaden) bewusst weggelassen.
    Ebene 93 „TESLA #8“ – Teslaspule (eine der drei identischen Spulen, rechts gespiegelt)
  MotiveDeri.xcf, Hintergrund [253]: Ziegelkachel (16×16) für die Wand, Pflaster (32×16) für den Boden.
Selbst gezeichnet: Lichtbögen (1 Zelle breit, weiße Seele + Cyan aus Ebene 87), Lichtschein, Schatten.

Skalierung: EIN Raster 2× (125×175 Zellen) für alles; einmal hochskaliert.
"""
import sys, os, math
from common import *  # noqa  (Runde-4-common zuerst laden)
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'runde3', 'generator'))
from a_util import lowres, blow  # noqa

B = 'MotiveIndia'
G = 2
lo = lowres(G)                      # 125×175
W, H = lo.w, lo.h

cat = sprite('h40_cat', B, [87, 88, 89, 90, 91, 92])      # mit Blitzkranz
coil = parts(sprite('h40_coils', B, [93]), dil=1)[0]       # 30×104
CYAN, WHITE = (0, 207, 207), (207, 255, 255)

# --- Wand + Boden (Deri-Kacheln, stark abgedunkelt, bläulich) ------------------------------------------
bg = layer('MotiveDeri', 253)
brick = bg[169:185, 70:86].copy(); brick[..., 3] = 255
cob = bg[169 + 40:169 + 56, 185:217].copy(); cob[..., 3] = 255
brick = tint(darken(brick, 0.42), (20, 30, 60), 0.3)
cob = tint(darken(cob, 0.40), (20, 30, 60), 0.3)
FLOOR = 142
fill_tiles(lo, brick, 0, 0, W, FLOOR)
fill_tiles(lo, cob, 0, FLOOR, W, H)
for x in range(W):                                           # Fußkante
    lo.px(x, FLOOR, (14, 18, 30)); lo.px(x, FLOOR + 1, (30, 36, 52))

# kalter Lichtschein der Entladung (gedithert, zwei Stufen)
def glow(cx, cy, r, col, s):
    for y in range(max(0, int(cy - r)), min(H, int(cy + r) + 1)):
        for x in range(max(0, int(cx - r)), min(W, int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx), (y + .5 - cy) * 1.1) / r
            if d < 1:
                t = (1 - d) ** 1.3 * s
                q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
                if q > 0: lo.a[y, x] = (lo.a[y, x] * (1 - q * .6) + np.array(col) * q * .6).astype(np.uint8)
glow(62, 62, 66, (60, 170, 200), 0.7)

# --- Spulen (links Original, rechts gespiegelt) ----------------------------------------------------
CB = FLOOR + 10                                             # Unterkante der Spulen (Schattenellipse)
cl_x, cr_x = 6, W - 6 - coil.shape[1]
lo.paste(coil, cl_x, CB - coil.shape[0])
lo.paste(flip(coil), cr_x, CB - coil.shape[0])
# Spulenköpfe (oberste deckende Zeile, Mitte)
top_y = CB - coil.shape[0]
hl = (cl_x + coil.shape[1] // 2, top_y + 1)
hr = (cr_x + coil.shape[1] // 2, top_y + 1)

# --- Kater ----------------------------------------------------------------------------------------
KX = (W - cat.shape[1]) // 2
KY = FLOOR + 8 - cat.shape[0]
for x in range(KX + 12, KX + cat.shape[1] - 12):             # Schatten
    for y in (FLOOR + 7, FLOOR + 8):
        lo.a[y, x] = (lo.a[y, x] * (0.55 if y == FLOOR + 7 else 0.75)).astype(np.uint8)
lo.paste(cat, KX, KY)

# --- Lichtbögen (selbst gezeichnet, 1 Zelle breit) ----------------------------------------------------
rng = np.random.RandomState(40)

def bolt(p0, p1, jag=4.0, seg=5, branch=0, arch=0.0):
    (x0, y0), (x1, y1) = p0, p1
    L = math.hypot(x1 - x0, y1 - y0); n = max(2, int(L / seg))
    nx, ny = -(y1 - y0) / L, (x1 - x0) / L
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n; o = rng.uniform(-jag, jag) * math.sin(math.pi * t)
        ay = -arch * 4 * t * (1 - t)                      # Bogen nach oben
        pts.append((x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o + ay))
    pts.append((x1, y1))
    cells = []
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        k = int(max(abs(bx - ax), abs(by - ay))) + 1
        for j in range(k + 1):
            c = (int(round(ax + (bx - ax) * j / k)), int(round(ay + (by - ay) * j / k)))
            if not cells or cells[-1] != c: cells.append(c)
    for (x, y) in cells:                                   # cyanfarbener Saum
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if 0 <= x + dx < W and 0 <= y + dy < H and tuple(lo.a[y + dy, x + dx]) != WHITE:
                lo.px(x + dx, y + dy, CYAN)
    for (x, y) in cells: lo.px(x, y, WHITE)                # weiße Seele
    for b in range(branch):                               # kurze Seitenäste
        i = rng.randint(len(cells) // 4, 3 * len(cells) // 4)
        x, y = cells[i]; a = rng.uniform(0, 2 * math.pi); l = rng.randint(3, 6)
        for j in range(1, l):
            lo.px(int(round(x + math.cos(a) * j)), int(round(y + math.sin(a) * j + j * .3)), CYAN)

# Bogen zwischen den Spulenköpfen über dem Kater
bolt(hl, hr, jag=4, seg=6, branch=2, arch=16)
# von jedem Spulenkopf in die erhobenen Pfoten des Katers
paw_l = (KX + 7, KY + 26)
paw_r = (KX + cat.shape[1] - 8, KY + 26)
bolt(hl, paw_l, jag=3, seg=5, branch=0, arch=-6)
bolt(hr, paw_r, jag=3, seg=5, branch=0, arch=-6)
# Funken an den Spulenköpfen
for (x, y) in (hl, hr):
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, -1), (0, 1)):
        lo.px(x + dx, y + dy, WHITE if (dx, dy) == (0, 0) else CYAN)

cv = Canvas(250, 350)
blow(cv, lo, G)
print(save(cv, '40_live_wire.png'))
