# -*- coding: utf-8 -*-
"""Sleeve 40 – „Angel's Mirror“ (Runde 3b, neu): Der Guardian Angel schwebt im Strahlenkranz über einem stillen
See – doch sein Spiegelbild im Wasser zeigt den Undead Guardian Angel. Ein großes Hauptmotiv (Engel 5×), ruhiger
Himmel, die „dunkle Seite“ nur als Spiegelung (Regel E: Spiegelungen dürfen transparent/verzerrt sein).

Skalierung: Engel und Spiegelbild 5×; Wolken 3× (weit hinten); ferne Uferlinie im 3×-Raster; Himmel/Strahlen
als Dither-Verlauf.

Vollständigkeit (Regel B):
  * Guardian Angel = freistehender Engel aus Ebene 1058 (22×29, ganze Figur inkl. Füße; Zeilen 0–21 pixelgleich mit
    dem Engel über der Statue in derselben Ebene).
  * Undead Guardian Angel: Ebene 729 zeigt nur den Oberkörper (der Rest steckt hinter der Statue), das Gesicht fehlt
    in der Ebene und wird pixelgenau aus der Szene „Sichtbar #61“ [728] ergänzt. Unterkörper (Kleid, Füße) =
    Unterkörper des Guardian Angel, umgefärbt in die Undead-Palette (violette Aura, dunkles Kleid, graue Haut).

Quellen (Motive.xcf): 1058 „Guardian Angel“, 729 „Undead Guardian Angel“, 728 „Sichtbar #61“,
1520 „Ebene #652“ (Wolke), 1510 „Ebene #653“ (Wolkenband).
"""
import math
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
K = 5

# ---------------------------------------------------------------- Sprites
gp = parts(lay(B, 1058), dil=0)
angel = [p for p in gp if p.shape[:2] == (29, 22)][0]           # freistehender Engel, ganze Figur

ua = layer(B, 729).copy()
sc = layer(B, 728)
filled = fill_holes(ua)
hole = (filled[..., 3] > 0) & (ua[..., 3] == 0)
ua[hole] = sc[hole]; ua[hole, 3] = 255                        # fehlendes Gesicht aus der Szene
bb = bbox(ua); ua = ua[bb[1]:bb[3], bb[0]:bb[2]]
ua[..., 3] = np.where(ua[..., 3] >= 128, 255, 0)
ucol = max(parts(ua, dil=0), key=lambda p: p.shape[0])        # Säule: Engel über Statue über Betender
CUT = 21
lower = recolor_map(angel[CUT:], [
    ((255, 255, 114), (45, 0, 105)), ((255, 222, 90), (45, 0, 105)), ((255, 246, 172), (106, 81, 142)),
    ((246, 255, 255), (213, 213, 213)), ((180, 246, 255), (45, 0, 105)), ((139, 213, 255), (45, 0, 105)),
    ((118, 118, 118), (41, 41, 41)), ((133, 133, 133), (46, 46, 46)), ((141, 141, 141), (52, 52, 52)),
    ((159, 159, 159), (61, 61, 61)), ((192, 192, 192), (83, 83, 83)), ((189, 90, 57), (123, 123, 123)),
    ((246, 205, 139), (191, 191, 191)), ((202, 171, 39), (30, 30, 30)), ((90, 76, 17), (26, 26, 26)),
    ((230, 216, 75), (41, 41, 41)), ((214, 193, 0), (30, 30, 30))], tol=6)
undead = np.zeros_like(angel)
undead[:CUT] = ucol[:CUT, :angel.shape[1]]
undead[CUT:] = lower
for n, s in dict(angel=angel, undead=undead).items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g40_%s.png' % n))

# ---------------------------------------------------------------- Himmel
cv = Canvas(W2, H2)
HOR = 184
c_top, c_hor = np.array((40, 96, 200)), np.array((176, 214, 246))
for y in range(HOR):
    t = (y / HOR) ** 1.3
    for x in range(W2):
        lv = math.floor(t * 6 + BAYER4[y % 4, x % 4]) / 6
        cv.a[y, x] = (c_top * (1 - lv) + c_hor * lv).astype(np.uint8)

# Strahlenkranz um den Heiligenschein
AX, AY = W2 // 2, 16
hx, hy = AX, AY + 2 * K
for y in range(HOR):
    for x in range(W2):
        a = math.degrees(math.atan2(y - hy, x - hx)) % 360
        if int(a // 12) % 2: continue
        r = math.hypot(x - hx, y - hy)
        t = max(0.0, 1 - r / 200) * 0.5
        q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
        if q > 0: cv.a[y, x] = (cv.a[y, x] * (1 - q) + np.array((255, 250, 200)) * q).astype(np.uint8)

# Wolken (3×, weit hinten)
cl = lay(B, 1520); cl2 = lay(B, 1510)
for s, x, y in ((cl, -30, 118), (flip(cl), 120, 140), (cl2, 20, 60), (flip(cl2), 150, 92)):
    u = up(s, 3); cv.paste(u, x, y)

# ferne Uferlinie (3×-Raster)
rng = np.random.RandomState(4)
h = 2
for i in range(W2 // 3 + 1):
    h = max(1, min(4, h + rng.randint(-1, 2)))
    cv.rect(i * 3, HOR - 3 * h, i * 3 + 3, HOR, (70, 110, 120))
    cv.rect(i * 3, HOR - 3 * h, i * 3 + 3, HOR - 3 * h + 3, (100, 140, 150))

# ---------------------------------------------------------------- See: gespiegelter Himmel, dunkler + blauer
WL = HOR
for y in range(WL, H2):
    my = max(0, 2 * WL - y - 1)
    row = cv.a[my].astype(float)
    t = min(1.0, (y - WL) / 120)
    cv.a[y] = (row * (0.62 - 0.22 * t) + np.array((10, 40, 90)) * (0.38 + 0.22 * t)).astype(np.uint8)
# Wellenlinien im 5×-Raster
for y in range(WL + 6, H2, 20):
    for x in range((y * 7) % 40 - 40, W2, 40):
        cv.rect(x, y, x + 15, y + 1, (150, 190, 230))

# ---------------------------------------------------------------- Engel (5×) und Spiegelbild
A = up(angel, K)
ax, ay = AX - A.shape[1] // 2, AY
feet = ay + A.shape[0]
# Spiegelbild: Undead, vertikal gespiegelt; Wasserlinie = Symmetrieachse; zeilenweise Wellenversatz (5er-Raster)
R = up(undead[::-1], K)
ry = WL + (WL - feet)
ref = Canvas(W2, H2); ref.a[:] = cv.a
ref.paste(R, ax, ry)
for y in range(ry, min(H2, ry + R.shape[0])):
    band = (y - ry) // K
    sh = [0, 0, 0, K, 0, 0, 0, -K][band % 8] if band > 5 else 0
    if sh: ref.a[y] = np.roll(ref.a[y], sh, 0)
m = np.zeros((H2, W2), bool)
m[ry:ry + R.shape[0], ax - K:ax + R.shape[1] + K] = True
blend = (ref.a.astype(float) * 0.78 + cv.a.astype(float) * 0.22)
cv.a[m] = blend[m].astype(np.uint8)
# Wellenlinien über das Spiegelbild
for y in range(WL + 6, H2, 20):
    for x in range((y * 7) % 40 - 40, W2, 40):
        if m[y, max(0, min(W2 - 1, x + 7))]: cv.rect(x, y, x + 15, y + 1, (150, 170, 220))
cv.paste(A, ax, ay)

vignette(cv, 0.3, 0.7)
print(save(cv, '40_angel_mirror.png'))
