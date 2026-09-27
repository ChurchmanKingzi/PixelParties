# -*- coding: utf-8 -*-
"""01 – Heartguard (Held: Cool Rescuer Monia, Base-Version)

Idee: Monia schwebt mit feuernden Jet-Düsen vor ihrem großen Herz (dem Herz ihres Kartenbilds), das hier
zur durchscheinenden Schutzkuppel wird. Darin suchen zwei kleine „Cute“-Kreaturen aus der MOE-Bomb-Szene
Schutz; eine MOE Bomb (Herz-Bombe) verpufft am Herzschild, eine zweite fällt noch heran – ihr Kartentext:
Effekte auf Kreaturen negieren. Das Herz ruht wie auf der Karte auf einer Wolkenbank.

Quellen (MotiveMoe.xcf):
  - Monia (Base): Ebenen 511 „Monia“ + 510 „Monia #2“ (große Düsenflammen); pixelgleich mit Szene 68
    („Sichtbar #157“, Kartenszene Cool Rescuer Monia). NICHT 502 Skin / 503 Slimonia / 506 / 508 / 509.
  - Herz-Palette nach Ebene 512 „Monia #1“ (Herz des Kartenbilds), kleine Deko-Herzen aus 512.
  - Cute Bunny (Fledermaus-Hase, Seitenansicht): Ebene 429 „Cute Bunny #1“ (Teil 0).
  - Cute Cat (Flügelkatze): Ebene 492 „Cute Cat“.
  - MOE-Bomb-Herz: Ebene 376 „MOE Bomb“ (Kartenausschnitt Szene 78), „M“-Emblem rot übermalt (kein Text).
  - Himmel: Ebene 553 „Hintergrund“ (MOE-Himmel mit Wölkchen), Wolkenfarben daraus.
Selbst gezeichnet: Herzschild (Füllung, Ränder, Glanz, Aufprall-Leuchten), Explosionswolke, Fallspur,
Wolkenbank, Himmelsverlauf.

Skalierung:  Hintergrund-Ebene (Himmel, Wolken, Herzschild, Kreaturen, Bomben, Effekte) 2× (125×175-Raster);
             Monia 5× (Vordergrund).
"""
import math
import numpy as np
import cv2
from common import *   # noqa

F = 'MotiveMoe'
W2, H2 = 125, 175
CAT_PART = 1

# ---------------------------------------------------------------- Sprites
monia = sprite('h01_monia', F, [511, 510])
bunny = parts(sprite('h01_bunny_all', F, [429]), dil=1)[0]
cat = parts(sprite('h01_cat_all', F, [492]), dil=1)[CAT_PART]
_bomb_layer = compose(F, [376], crop=False)[434:505, 255:331]
bomb = [p for p in parts(_bomb_layer, dil=1) if (p[..., 0] == 0xe2).any()][0].copy()
# „M“-Emblem (rosa Pixel) in Bombenrot übermalen – kein Text
rgb = bomb[..., :3].astype(int)
pink = (rgb[..., 0] > 180) & (rgb[..., 2] > 150) & (rgb[..., 1] < 190)
bomb[pink, :3] = (0xe2, 0x11, 0x13)
mini_heart = parts(sprite('h01_heart', F, [512]), dil=1)[1]

PINK = (247, 89, 129); PINK_D = (181, 59, 91); PINK_M = (232, 75, 117)
PINK_L = (248, 128, 153); PINK_H = (245, 160, 176); WHITE = (255, 240, 246)
CL = [(246, 255, 255), (230, 239, 250), (197, 219, 246), (139, 181, 237), (37, 109, 216)]
B4 = kit.BAYER4

yy, xx = np.mgrid[0:H2, 0:W2]


def dmix(base, col, t):
    """Geordnet gedithertes Mischen: t (Array 0..1) Anteil von col."""
    q = (t > B4[yy % 4, xx % 4])
    out = base.copy(); out[q] = col
    return out


def heart_mask(cx, top, w):
    """Implizites Herz ((x²+y²-1)³ - x²y³ ≤ 0); Breite w Zellen, Lappen-Oberkante bei top."""
    s = w / 2.28
    X = (xx + 0.5 - cx) / s
    Y = 1.2 - (yy + 0.5 - top) / s
    return (X ** 2 + Y ** 2 - 1) ** 3 - X ** 2 * Y ** 3 <= 0


# ---------------------------------------------------------------- Himmel 2×
bg = Canvas(W2, H2)
bg.a[:] = layer(F, 553)[190:190 + H2, 60:60 + W2, :3]
# oben ins Tiefblaue (ruhig, lenkt zur Mitte): 6 Stufen, nur zwischen Nachbarstufen gedithert
DARK = np.array([10, 26, 92])
t = np.clip((84 - yy) / 84, 0, 1) ** 1.1 * 5
lv = np.floor(t + B4[yy % 4, xx % 4] - 0.5).clip(0, 5)
bg.a[:] = (bg.a * (1 - lv[..., None] / 5 * 0.85) + DARK * (lv[..., None] / 5 * 0.85)).astype(np.uint8)

# ---------------------------------------------------------------- Herzschild
HX, HTOP, HW = 62.5, 32, 100
hm = heart_mask(HX, HTOP, HW)
inner = heart_mask(HX, HTOP + 1.1, HW - 2.4)
rim = hm & ~inner
outer = heart_mask(HX, HTOP - 1.1, HW + 2.4) & ~hm
dist = cv2.distanceTransform(hm.astype(np.uint8), cv2.DIST_L2, 5)
alpha = np.where(hm, 0.30 + 0.40 * np.clip(1 - dist / 10, 0, 1) ** 1.5, 0)
bg.a[:] = (bg.a * (1 - alpha[..., None]) + np.array(PINK) * alpha[..., None]).astype(np.uint8)
# Glanz: Sichelband im linken Lappen und kleiner Punkt im rechten (wie beim Kartenherz)
g1 = inner & heart_mask(HX - 3, HTOP + 3, HW - 12) & ~heart_mask(HX + 1, HTOP + 6, HW - 12) & (xx < HX - 6) & (yy < HTOP + 40)
bg.a[g1] = (bg.a[g1] * 0.35 + np.array(WHITE) * 0.65).astype(np.uint8)
g2 = inner & heart_mask(HX + 3, HTOP + 3, HW - 12) & ~heart_mask(HX - 1, HTOP + 5, HW - 12) & (xx > HX + 22) & (yy < HTOP + 16)
bg.a[g2] = (bg.a[g2] * 0.4 + np.array(WHITE) * 0.6).astype(np.uint8)
bg.a[outer] = (bg.a[outer] * 0.45 + np.array(PINK_D) * 0.55).astype(np.uint8)
bg.a[rim] = PINK_L
bg.a[rim & (yy > HTOP + 40) & (xx > HX)] = PINK
# Mittelfalte oben (wie im Kartenherz)
for y in range(HTOP + 11, HTOP + 17):
    bg.px(62, y, PINK_M)

# Kreaturen im Schild (hinter der Schildfläche: danach leicht rosa überhaucht)
crea = Canvas(W2, H2); crea.a[:] = bg.a
crea.paste(bunny, 22, 52)
crea.paste(cat[:, ::-1], 80, 55)
cm = (crea.a != bg.a).any(-1)
bg.a[cm] = (crea.a[cm] * 0.88 + np.array(PINK) * 0.12).astype(np.uint8)

# ---------------------------------------------------------------- Aufprall oben links
ex, ey = 27, 37           # liegt auf dem Schildrand
hit = rim & ((xx - ex) ** 2 + (yy - ey) ** 2 <= 14 ** 2)
bg.a[hit] = WHITE
hit2 = outer & ((xx - ex) ** 2 + (yy - ey) ** 2 <= 10 ** 2)
bg.a[hit2] = PINK_H
# Explosion: gezackter Blitz (weiß/gelb/orange) mit rosa Rauchpuffs – die Bombe verpufft am Schild
cxe, cye = ex - 1, ey - 4
ang = np.arctan2(yy - cye, xx - cxe); dd = np.hypot(xx - cxe, yy - cye)
spike = 4.2 + 3.4 * np.clip(np.cos(5 * ang + 0.4), 0, 1) ** 2 + 2.2 * np.clip(np.cos(3 * ang - 1.1), 0, 1) ** 3
smoke = np.zeros((H2, W2), bool)
for cx0, cy0, r in [(cxe - 7, cye + 2, 4), (cxe + 7, cye - 3, 3.5), (cxe - 3, cye - 8, 3.5), (cxe + 4, cye + 5, 3)]:
    smoke |= (xx - cx0) ** 2 + (yy - cy0) ** 2 <= r * r
sedge = smoke & ~cv2.erode(smoke.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
bg.a[smoke] = PINK_H
bg.a[sedge] = PINK_M
bg.a[dd <= spike + 1.0] = (232, 60, 90)
bg.a[dd <= spike] = (255, 140, 60)
bg.a[dd <= spike * 0.72] = (255, 214, 80)
bg.a[dd <= spike * 0.42] = (255, 252, 222)
# Funken
for k in range(10):
    a = k * math.pi / 5 + 0.2
    rr = 11 + (k % 3)
    bg.px(int(round(cxe + rr * math.cos(a))), int(round(cye + rr * math.sin(a))), (255, 230, 120) if k % 2 else PINK_H)

# ---------------------------------------------------------------- fallende Herzbombe oben rechts
bx, by = 86, 13
for k in range(9):          # Fallspur: zwei Striche, nach oben ausdünnend
    y = by - 1 - k
    if k < 6 or k % 2 == 0:
        bg.px(bx + 7, y, (170, 200, 250))
    if k < 4 or (k < 7 and k % 2 == 0):
        bg.px(bx + 11, y + 2, (120, 165, 235))
bg.paste(bomb, bx, by)

# ---------------------------------------------------------------- Deko-Herzen (Kartenmotiv), symmetrisch
for x, y in [(9, 60), (112, 60), (17, 110), (104, 110)]:
    bg.paste(mini_heart, x, y)

# ---------------------------------------------------------------- Wolkenbank (hinten bläulich, vorn hell)
def puff(cx0, cy0, rx, ry, cols):
    """Eine Wolkenwulst (Ellipse), Licht von oben links, von hinten nach vorn übereinander gemalt."""
    dx = (xx + 0.5 - cx0) / rx; dy = (yy + 0.5 - cy0) / ry
    m = dx ** 2 + dy ** 2 <= 1
    t = dy - 0.3 * dx + (B4[yy % 4, xx % 4] - 0.5) * 0.22
    lev = np.where(t < -0.62, 0, np.where(t < -0.12, 1, np.where(t < 0.42, 2, 3)))
    for k in range(4):
        bg.a[m & (lev == k)] = cols[k]


BACK = [(146, 178, 238), (122, 162, 230), (98, 143, 222), (80, 126, 212)]
FRONT = CL[:4]
MID = [CL[1], CL[2], (168, 200, 242), CL[3]]
rows = [
    (BACK, [(-2, 139, 14, 8), (22, 136, 13, 8), (104, 135, 13, 8), (128, 139, 14, 8)]),
    (MID, [(6, 146, 14, 9), (32, 143, 13, 8), (92, 142, 13, 8), (118, 146, 14, 9)]),
    (FRONT, [(62, 137, 17, 11), (44, 145, 13, 9), (81, 145, 13, 9)]),
    (FRONT, [(62, 150, 14, 9), (-4, 155, 15, 10), (20, 153, 14, 9), (104, 153, 14, 9), (129, 155, 15, 10)]),
    (FRONT, [(40, 157, 15, 10), (85, 157, 15, 10), (62, 160, 16, 10)]),
    (FRONT, [(8, 168, 17, 10), (38, 171, 16, 9), (88, 171, 16, 9), (117, 168, 17, 10)]),
]
bg.a[150:] = CL[2]
for cols, ps in rows:
    for c in ps:
        puff(*c, cols)

big = Canvas(W, H)
big.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]

# ---------------------------------------------------------------- Monia 5×
M = up(monia, 5)
mx = (W - M.shape[1]) // 2
my = 110
big.paste(M, mx, my)

save(big, '01_heartguard.png')
print('ok', monia.shape, bunny.shape, cat.shape, bomb.shape)
