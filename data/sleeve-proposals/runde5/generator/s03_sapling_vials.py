# -*- coding: utf-8 -*-
"""03 (Arbeitsstand v1) – Kyli, the Deceptive Sapling."""
import math, random
import numpy as np
from common import *  # noqa

W, H = 250, 350
rnd = random.Random(3)
GW = 'MotiveGrailWar'
SD = 'MotiveSteamDwarfs'

# ---------------- Sprites ----------------------------------------------------------------
kyli = sprite('h03_kyli', GW, [149])                    # 24×33, Base-Kyli (Szene Sichtbar #7)
tree = sprite('h03_eyetree', GW, [150])                 # 33×44, Augenbaum aus Kylis Kartenszene
_pots = parts(layer(SD, 134)[400:540, 70:400], dil=0, minpx=10)
pot_green, pot_teal, pot_red = _pots[12], _pots[13], _pots[16]              # runde Korkflaschen (Biomancy-Szene)
_circ = compose(GW, [159], crop=False)[91:139, 271:319]  # Ritualkreis mit Kerzen (Asriel/Chara-Szene)
candle = _circ[3:14, 14:18].copy()
_rc = ((candle[..., 0] == 91) & (candle[..., 1] == 3)) | ((candle[..., 0] == 130) & (candle[..., 1] == 0))
candle[_rc] = 0
candle = candle[np.ix_(*[np.where(candle[..., 3].any(ax))[0] for ax in (1, 0)])]


def grid(k):
    return -(-W // k), -(-H // k)


def rgba(w, h):
    return np.zeros((h, w, 4), np.uint8)


def put(dst, s, x, y):
    h, w = s.shape[:2]
    X0, Y0 = max(0, x), max(0, y); X1, Y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if X1 <= X0 or Y1 <= Y0: return
    sub = s[Y0 - y:Y1 - y, X0 - x:X1 - x]
    m = sub[..., 3] >= 128
    dst[Y0:Y1, X0:X1][m] = sub[m]


def blit(cv, arr, k, ox=0, oy=0):
    a = arr.a if hasattr(arr, 'a') else arr
    if a.shape[2] == 3: a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    cv.paste(up(a, k), -ox, -oy)


def bands(cv, y0, y1, stops, soft=0.4):
    n = len(stops) - 1
    for y in range(max(0, y0), min(cv.h, y1)):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1); f = t - i
        f = min(1, max(0, (f - (1 - soft) / 2) / soft))
        a, b = np.array(stops[i]), np.array(stops[i + 1])
        for x in range(cv.w):
            cv.a[y, x] = b if f > BAYER4[y % 4, x % 4] else a


def glow_rgba(arr, cx, cy, r, col, strength=0.5, ry=None):
    """Lichthof auf ein RGBA-Array (nur dort, wo schon etwas ist, sonst halbtransparente Pixel)."""
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(arr.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(arr.shape[1], int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1: continue
            t = (1 - d) ** 1.5 * strength
            q = min(math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4, strength)
            if q <= 0: continue
            if arr[y, x, 3] > 0:
                arr[y, x, :3] = (arr[y, x, :3] * (1 - q) + col * q).astype(np.uint8)
            else:
                arr[y, x] = list(col.astype(np.uint8)) + [int(255 * q)]


def glow(cv, cx, cy, r, col, strength=0.5, ry=None):
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(cv.h, int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1: continue
            t = (1 - d) ** 1.5 * strength
            q = min(math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4, strength)
            if q > 0: cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


# ---------------- Hintergrund 2× (125×175): Nachthimmel + Mond -----------------------------
bw, bh = grid(2)
bg = Canvas(bw, bh)
bands(bg, 0, 130, [(10, 8, 22), (20, 13, 38), (34, 20, 56), (54, 30, 76), (78, 44, 92)])
bg.a[130:] = (78, 44, 92)
for _ in range(30):
    x, y = rnd.randrange(4, bw - 4), rnd.randrange(4, 80)
    bg.px(x, y, (200, 190, 230) if rnd.random() < .45 else (130, 110, 170))
MX, MY, MR = 62.5, 95, 31
glow(bg, MX, MY, MR + 14, (170, 210, 160), 0.3)
MOON = [(220, 232, 196), (192, 210, 168), (166, 186, 150)]
for y in range(bh):
    for x in range(bw):
        dx, dy = x + .5 - MX, y + .5 - MY
        if math.hypot(dx, dy) < MR:
            c = 0
            if math.hypot(dx + 9, dy + 7) >= MR: c = 1           # Sichel-Schatten unten rechts
            if math.hypot(dx + 4, dy + 3) >= MR: c = 2
            bg.a[y, x] = MOON[c]
for cx, cy, r in [(51, 84, 5), (70, 103, 4), (57, 110, 3), (76, 82, 3), (45, 99, 2), (64, 72, 2)]:
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if math.hypot(x + .5 - cx, y + .5 - cy) < r and math.hypot(x + .5 - MX, y + .5 - MY) < MR - 1:
                bg.a[y, x] = (np.array(bg.a[y, x], float) * 0.88).astype(np.uint8)

# ---------------- Mittelgrund 3× (84×117): Steinlichtung + zwei Augenbäume -------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
floor = layer(GW, 161)[140:156, 240:256]                 # 16×16-Kachel des Steinbodens
HZ = 85
FM = floor[..., :3].reshape(-1, 3).mean(0)
for y in range(HZ, mh):
    for x in range(mw):
        c = floor[(y - HZ) % 16, x % 16, :3].astype(float)
        c = FM + (c - FM) * 0.6                               # Steinkörnung beruhigen
        f = 0.42 + 0.3 * (y - HZ) / (mh - HZ)
        c = c * f * np.array([0.95, 0.9, 1.08])
        mg[y, x] = list(c.clip(0, 255).astype(np.uint8)) + [255]
for x in range(mw):                                       # Nebelsaum am Horizont
    mg[HZ, x, :3] = (mg[HZ, x, :3] * 0.6 + np.array([90, 60, 110]) * 0.4).astype(np.uint8)
# Lichtschein auf dem Boden: rotes Glimmen im Ritualring, warmes Kerzenlicht (auf dem 3×-Boden gedithert)
def glow_a(arr, cx, cy, r, col, strength, ry=None):
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(arr.shape[0], int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(arr.shape[1], int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1 or arr[y, x, 3] == 0: continue
            q = min(math.floor((1 - d) ** 1.2 * strength * 4 + BAYER4[y % 4, x % 4]) / 4, strength)
            if q > 0: arr[y, x, :3] = (arr[y, x, :3] * (1 - q) + col * q).astype(np.uint8)


glow_a(mg, 41.7, 100.5, 30, (140, 20, 34), 0.35, ry=8)
red = (tree[..., 0] > 120) & (tree[..., 1] < 60)
treeD = tree.copy()
treeD[..., :3] = np.where(red[..., None], tree[..., :3],
                          (tree[..., :3] * 0.72 + np.array([40, 20, 60]) * 0.28)).astype(np.uint8)
teeth = tree[..., :3].min(-1) > 200
treeD[teeth, :3] = (treeD[teeth, :3] * 0.72).astype(np.uint8)
tx = -5
put(mg, treeD, tx, HZ + 2 - tree.shape[0])
put(mg, flip(treeD), mw - tx - tree.shape[1], HZ + 2 - tree.shape[0])

# ---------------- Vordergrund 5× (50×70): Kyli, Ritualring, Tränke -------------------------
fw, fh = grid(5)
fg = rgba(fw, fh)
KX, KF = 13, 61                                          # Kyli links oben x, Fußlinie (Zelle)
ky = KF - kyli.shape[0]


def ell_outline(cx, cy, rx, ry, col):
    """Ellipsenlinie, 1 Zelle breit, lückenlos (4-verbunden)."""
    pts = []
    for i in range(720):
        t = math.radians(i / 2)
        p = (int(math.floor(cx + rx * math.cos(t))), int(math.floor(cy + ry * math.sin(t))))
        if not pts or p != pts[-1]:
            if pts and abs(p[0] - pts[-1][0]) + abs(p[1] - pts[-1][1]) == 2: pts.append((p[0], pts[-1][1]))
            pts.append(p)
    for x, y in pts:
        if 0 <= x < fw and 0 <= y < fh: fg[y, x] = list(col) + [255]
    return pts


def ell_fill(cx, cy, rx, ry, col, a):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if 0 <= x < fw and 0 <= y < fh and ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 < 1:
                fg[y, x] = list(col) + [a]


# Ritualring (selbst gezeichnet, nach dem Kreis aus Kylis Occultism-Umfeld, ohne Pentagramm)
RCX, RCY, RX, RY = 25, KF - 0.5, 17.5, 4.2
ring_pts = ell_outline(RCX, RCY, RX, RY, (104, 6, 4))
for k, a in enumerate(range(0, 360, 24)):                 # Runenkerben innen
    t = math.radians(a + 12)
    x = int(math.floor(RCX + (RX - 2) * math.cos(t))); y = int(math.floor(RCY + (RY - 1.3) * math.sin(t)))
    if 0 <= y < fh and fg[y, x, 3] == 0: fg[y, x] = [150, 14, 12, 255] if k % 2 else [70, 2, 2, 255]
ell_fill(KX + 12, KF - 0.2, 7, 1.3, (6, 4, 12), 150)       # Schatten unter Kyli
put(fg, candle, int(RCX - RX), int(RCY) - 7)
put(fg, candle, int(RCX + RX) - 1, int(RCY) - 7)
put(fg, kyli, KX, ky)

# Tränke: Ranken wachsen aus Kylis Geweih-Spitzen und halten die schwebenden Flaschen
VL, VD = (96, 150, 64), (30, 62, 34)


def vine(pts):
    """Ranke als Bezier-Kurve, 1 Zelle breit, hell/dunkel abwechselnd."""
    out = []
    for i in range(200):
        t = i / 199
        if len(pts) == 3:
            (x0, y0), (x1, y1), (x2, y2) = pts
            x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t * t * x2
            y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t * t * y2
        p = (int(round(x)), int(round(y)))
        if not out or p != out[-1]:
            if out and abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) == 2:   # 4-verbunden machen
                out.append((p[0], out[-1][1]))
            out.append(p)
    for i, (x, y) in enumerate(out):
        if fg[y, x, 3] == 0 or i > 0: fg[y, x] = list(VL if i % 2 == 0 else VD) + [255]


def halo(s, x, y, col, alphas=(48,)):
    h, w = s.shape[:2]
    m = np.zeros((h + 6, w + 6), bool); m[3:-3, 3:-3] = s[..., 3] > 0
    prev = m
    import cv2
    for k, a in enumerate(alphas):
        d = cv2.dilate(prev.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0
        ring_ = d & ~prev
        ys, xs = np.where(ring_)
        for yy, xx in zip(ys, xs):
            X, Y = x + xx - 3, y + yy - 3
            if 0 <= X < fw and 0 <= Y < fh and fg[Y, X, 3] == 0: fg[Y, X] = list(col) + [a]
        prev = d


PL = (6, ky - 8); PR = (35, ky - 10); PC = (21, ky - 20)
tipL, tipR, tipC = (KX + 0, ky + 11), (KX + 23, ky + 8), (KX + 13, ky + 0)
for (px_, py_), s_, col in [(PL, pot_green, (150, 255, 120)), (PR, pot_red, (255, 110, 90)),
                            (PC, pot_teal, (140, 240, 255))]:
    halo(s_, px_, py_, col)
vine([(tipL[0], tipL[1] - 1), (tipL[0] - 3, tipL[1] - 4), (PL[0] + 5, PL[1] + 12)])
vine([(tipR[0], tipR[1] - 1), (tipR[0] + 3, tipR[1] - 3), (PR[0] + 5, PR[1] + 12)])
vine([(tipC[0], tipC[1] - 1), (tipC[0] + 2, tipC[1] - 4), (PC[0] + 5, PC[1] + 12)])
put(fg, pot_green, *PL)
put(fg, pot_red, *PR)
put(fg, pot_teal, *PC)
# Rankenenden umgreifen die Flaschen wie ein Fruchtstiel (seitlich hochgebogen)
CURL = [(4, 12), (3, 12), (2, 12), (1, 12), (1, 11), (0, 11), (0, 10), (-1, 10), (-1, 9), (-1, 8), (-1, 7),
        (-1, 6), (-2, 6), (-2, 5)]
for (bx_, by_), mirror in [(PL, False), (PR, True), (PC, False)]:
    for i, (cx_, cy_) in enumerate(CURL):
        X = bx_ + (9 - cx_ if mirror else cx_); Y = by_ + cy_
        if fg[Y, X, 3] < 255: fg[Y, X] = list(VD if i % 2 == 0 else VL) + [255]

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, mg, 3)
blit(cv, fg, 5)
print(save(cv, '03_sapling_vials.png'))
