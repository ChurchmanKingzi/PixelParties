# -*- coding: utf-8 -*-
"""04 Stormdraw – Champion, the Stormbringer (Base-Held) steht auf einer Hügelkuppe und greift mit
ausgestrecktem Arm in den Trichter seines Wirbelsturms; der Tornado reißt Pixel-Parties-Karten mit sich
in den Himmel (Kartentext: beide Spieler werfen bis zu 5 Karten ab und ziehen neu).

Quellen:
  MotiveJapan.xcf  Ebene 121 „Champion“ + 119 „Ebene #167“ (Schwerthand) + 120 „Ebene #166“ (Schwert,
                   „The Stormblade“) – Base-Karte „Champion, the Stormbringer“, geprüft gegen Sichtbar #33
                   (Ebene 16, gleiche Form) und Sichtbar #38 (Ebene 1 = Kartenbild; dort nur zusätzlich
                   von der weichen Schattenebene 118 überlagert). NICHT MotiveHawaii „Ascended Champion“.
  MotiveJapan.xcf  Ebene 112 „Gate to the Armory“ (falsch benannt: der Tornado aus dem Kartenbild).
  Motive.xcf       Ebene 584 „Ebene #696“ – Spielkarten vom Tisch aus „Card Game Player Inya“
                   (lila Heldenkarten, blaue, goldene und rote Karten).
Selbst gezeichnet: Sturmhimmel mit heller Wolkenlücke, eingedrehte Mutterwolke, Wolkenkragen am Trichter,
Regen, ferner Blitz, Ebene mit Fluss (wie im Kartenbild), Hügelkuppe, gebogene Windstreifen (1 px hell
mit 1 px dunkler Schattenlinie, spiralig um den Trichter, hinten vom Trichter verdeckt), Staub- und
Trümmerwolke am Rüssel, Bodenschatten.
Karten: fünf gleich große Karten (lila Heldenkarten, rote, blaue, goldene), ungedreht bzw. um 90° gedreht,
im Wechsel vorn rechts/vorn links die Spirale hinauf gestaffelt – unten eben aus der Hand gerissen,
oben in der Wolke verschwindend.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Wolken, Regen, Blitz, Ebene, Fluss)                  – 2×-Raster (125×175)
  Mittelgrund (Tornado 32×50 → 96×150, Karten 8×11 → 24×33, Windstreifen,
               Wolkenkragen, Staub, Hügelkuppe)                            – 3×-Raster (84×117)
  Vordergrund (Champion 28×31 → 140×155, Bodenschatten)                    – 5×-Raster (50×70)
"""
import math, random
import numpy as np
from common import *  # noqa

W, H = 250, 350
rnd = random.Random(4)
BJ, BM = 'MotiveJapan', 'Motive'

champ = sprite('h04_champion', BJ, [119, 120, 121])   # 28×31
tornado = sprite('h04_tornado', BJ, [112])           # 32×50
cards_all = sprite('h04_cards', BM, [584])           # Tischkarten


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


def setp(dst, x, y, col):
    if 0 <= x < dst.shape[1] and 0 <= y < dst.shape[0]:
        dst[y, x, :3] = col[:3]
        if dst.shape[2] == 4: dst[y, x, 3] = 255


def blit(cv, arr, k, ox=0, oy=0):
    a = arr.a if hasattr(arr, 'a') else arr
    if a.shape[2] == 3:
        a = np.dstack([a, np.full(a.shape[:2], 255, np.uint8)])
    cv.paste(up(a, k), -ox, -oy)


def bayer(x, y):
    return BAYER4[y % 4, x % 4]


# ---------------- Karten aus der Tischszene ------------------------------------------------
def card_parts():
    P = parts(cards_all, dil=0, minpx=4)
    # Einzelkarten (8×11): lila Heldenkarten, gold, blau (rechte Karte der blauen Paare), rot (quer)
    out = {}
    for p in P:
        h, w = p.shape[:2]
        if (h, w) == (11, 8):
            c = p[5, 4, :3]
            top = p[1, 3, :3]
            if top[0] > 200 and top[1] > 150: out.setdefault('gold', p)
            else: out.setdefault('purple%d' % len([k for k in out if k.startswith('purple')]), p)
        elif (h, w) == (11, 12):
            out.setdefault('blue%d' % len([k for k in out if k.startswith('blue')]), p[:, 4:])
        elif (h, w) == (13, 8):
            out['blueL'] = p
        elif (h, w) == (8, 11):
            out['red'] = p
    return out


CARDS = card_parts()

# ================= Hintergrund 2× =======================================================
bw, bh = grid(2)                       # 125×175
bg = Canvas(bw, bh)
HOR = 122                              # Horizont (2×-Raster) = y 244
sky = [(18, 20, 30), (24, 28, 42), (34, 42, 56), (48, 60, 72), (66, 84, 90), (94, 114, 114), (132, 150, 142)]
for y in range(HOR):
    t = y / (HOR - 1) * (len(sky) - 1)
    i = min(int(t), len(sky) - 2); f = t - i
    for x in range(bw):
        bg.a[y, x] = sky[i + 1] if f > bayer(x, y) else sky[i]


def glow(cv, cx, cy, r, col, strength=0.5, ry=None):
    col = np.array(col, float); ry = ry or r
    for y in range(max(0, int(cy - ry)), min(cv.h, int(cy + ry) + 1)):
        for x in range(max(0, int(cx - r)), min(cv.w, int(cx + r) + 1)):
            d = math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry)
            if d >= 1: continue
            q = min(math.floor((1 - d) ** 1.5 * strength * 4 + bayer(x, y)) / 4, strength)
            if q > 0: cv.a[y, x] = (cv.a[y, x] * (1 - q) + col * q).astype(np.uint8)


# heller Wolkenriss hinter dem Helden (Blickpunkt), zum Horizont hin
glow(bg, 76, 84, 50, (150, 170, 160), 0.6, ry=46)

# Mutterwolke: flache, eingedrehte Wolkenscheibe über dem Tornado + Wolkendecke am oberen Rand
cl = [(22, 24, 36), (32, 35, 50), (46, 51, 68), (66, 73, 90), (96, 106, 120)]
CX, CY, RX, RY = 26, 38, 80, 20
for y in range(0, 62):
    for x in range(bw):
        e = math.hypot((x - CX) / RX, (y - CY) / RY)
        top = 7 + 2.5 * math.sin(x * .21) + 1.5 * math.sin(x * .53 + 1)     # Decke am oberen Rand
        if e >= 1 and y > top: continue
        ang = math.atan2((y - CY) / RY, (x - CX) / RX)
        v = math.sin(ang * 2 + e * 11)                    # Spiralbänder
        k = 1 + (1 if v > .1 + (bayer(x, y) - .5) * .5 else 0)
        if e >= 1: k = 0
        # beleuchtete Unterkante der Scheibe
        if e < 1 and y > CY and e > .86: k = 3 + (1 if e > .95 and bayer(x, y) > .4 else 0)
        elif e < 1 and y > CY and e > .74 and bayer(x, y) > .5: k = 3
        bg.a[y, x] = cl[k]


# ferner Blitz rechts (schlägt am Horizont ein)
def bolt_path(x, y, y_end, seed):
    r = random.Random(seed); pts = [(x, y)]
    while y < y_end:
        x += r.choice((-2, -1, 0, 1, 1, 2)); y += r.choice((2, 3, 3, 4))
        pts.append((x, min(y, y_end)))
    return pts


def draw_path(cv, pts, col, wid=0):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for s_ in range(n + 1):
            px, py = round(x0 + (x1 - x0) * s_ / n), round(y0 + (y1 - y0) * s_ / n)
            for d in range(-wid, wid + 1): cv.px(px + d, py, col)


main = bolt_path(104, 44, HOR, 7)
side = bolt_path(*main[8], main[8][1] + 22, 21)
side = [(x + (x - side[0][0]) * 1, y) for x, y in side]
glow(bg, main[-1][0], HOR, 18, (170, 200, 196), 0.5, ry=8)
glow(bg, 104, 46, 16, (150, 176, 184), 0.4, ry=8)
draw_path(bg, main, (84, 122, 136), 1)
draw_path(bg, side, (70, 104, 118), 1)
draw_path(bg, main, (230, 248, 244))
draw_path(bg, side, (190, 222, 222))

# Ebene mit fernen Hügeln
plain = [(46, 62, 56), (38, 52, 46), (30, 42, 38)]
for y in range(HOR, bh):
    t = (y - HOR) / (bh - HOR) * 2
    i = min(int(t), 1); f = t - i
    for x in range(bw):
        bg.a[y, x] = plain[i + 1] if f > bayer(x, y) else plain[i]
for x in range(bw):
    h = int(3 + 2.2 * math.sin(x * .07 + 1) + 1.5 * math.sin(x * .19))
    for y in range(HOR - h, HOR): bg.a[y, x] = (56, 72, 68) if y > HOR - h else (74, 92, 86)

# Fluss aus dem Kartenbild: windet sich vom Horizont nach links vorn (spiegelt das Sturmlicht)
for y in range(HOR + 1, bh):
    d = (y - HOR) / (bh - HOR)
    cx = 50 - 44 * d + 6 * math.sin(d * 6.5)
    w = 0.8 + 11 * d ** 1.3
    for x in range(int(cx - w - 1), int(cx + w) + 2):
        if not 0 <= x < bw: continue
        e = abs(x + .5 - cx) / w
        if e > 1: continue
        if e > .78: c = (38, 56, 66)
        elif (x * 3 + y * 5) % 11 == 0 and e < .6: c = (140, 164, 160)
        else: c = (56, 82, 98) if bayer(x, y) > d * .6 else (48, 70, 86)
        bg.a[y, x] = c

# Regen (2×-Raster, schräg, dezent aufgehellt)
for _ in range(150):
    x, y = rnd.randrange(bw), rnd.randrange(0, bh)
    for i in range(rnd.choice((3, 4, 5))):
        xx, yy = x - i // 2, y + i
        if 0 <= xx < bw and 0 <= yy < bh:
            bg.a[yy, xx] = np.clip(bg.a[yy, xx].astype(int) + 18, 0, 255)

# ================= Mittelgrund 3× (Tornado, Karten, Windstreifen, Hügel) =================
K3 = 3
mw, mh = grid(K3)                      # 84×117
mid = rgba(mw, mh)
TX, TY = 5, 28                         # Tornado: Scheitel in der Wolke (y 84), Rüssel in der Staubwolke
th, tw = tornado.shape[:2]
tm = tornado[..., 3] > 0
rows = {}
for r in range(th):
    xs = np.where(tm[r])[0]
    rows[TY + r] = (TX + (xs.min() + xs.max() + 1) / 2, (xs.max() - xs.min() + 1) / 2)
tip = (TX + 15, TY + th - 1)
GROUND = 83                            # Aufsetzpunkt der Staubwolke (y 249–252, knapp vor dem Horizont)


def funnel(y):
    y = min(max(int(round(y)), TY), TY + th - 1)
    return rows[y]


A0, TURNS = 0.75, 2.0
Y_LO, Y_HI = 73, TY - 5


def spiral(t, dr=0.0, da=0.0):
    """Sog um den Trichter: unten eng, oben weit; sin(a) > 0 = vordere Hälfte."""
    y = Y_LO + (Y_HI - Y_LO) * t
    c, hw = funnel(y)
    a = A0 + da + t * math.pi * 2 * TURNS
    r = hw + 4 + t * 6 + dr
    return c + math.cos(a) * r, y + math.sin(a) * (5 + t * 9), math.sin(a)


def arc(t0, a0, a1, dr=0.0):
    """Punkte eines kurzen, gebogenen Windstreifens: Winkel a0→a1, steigt dabei spiralig an."""
    pts = []
    for i in range(160):
        a = a0 + (a1 - a0) * i / 159
        t = t0 + 0.4 * (a - a0) / (math.pi * 2 * TURNS)
        y = Y_LO + (Y_HI - Y_LO) * t
        c, hw = funnel(y)
        r = hw + 4 + t * 6 + dr
        p_ = (int(round(c + math.cos(a) * r)), int(round(y + math.sin(a) * (5 + t * 9))))
        if not pts or pts[-1] != p_: pts.append(p_)
    return pts


def streak(pts, front=True):
    """1-px-Streifen im 3×-Raster: helle Linie, darunter eine dunkle Schattenlinie (hell/dunkel),
    Enden eine Stufe matter – liest sich als Böe, nicht als Punktkette."""
    hi, mid_, lo = ((218, 236, 228), (160, 186, 182), (46, 60, 68)) if front else \
                   ((104, 122, 124), (84, 100, 104), (40, 50, 58))
    S_ = set(pts)
    for j, (x, y) in enumerate(pts):
        if (x, y + 1) not in S_: setp(mid, x, y + 1, lo)
    for j, (x, y) in enumerate(pts):
        setp(mid, x, y, mid_ if j < 2 or j >= len(pts) - 2 else hi)


# vordere Streifen: (Höhe t, Startwinkel, Endwinkel, Radius-Versatz) – abwechselnd rechts und links vorn
FRONT = [(0.06, 0.35, 1.9, 0), (0.17, 1.5, 2.9, 1), (0.30, 0.25, 1.55, 0), (0.33, 0.9, 1.9, 3),
         (0.45, 1.45, 2.85, 0), (0.58, 0.2, 1.45, 1), (0.62, 0.8, 1.7, 4), (0.74, 1.5, 2.8, 0),
         (0.88, 0.25, 1.6, 2)]
BACK = [(0.12, 3.6, 4.4, 0), (0.25, 5.2, 5.9, 0), (0.40, 3.4, 4.2, 1), (0.53, 5.1, 5.9, 0),
        (0.69, 3.5, 4.3, 1), (0.82, 5.0, 5.8, 0)]


def card_at(t, key, rot=0, dx=0, dy=0):
    c = CARDS[key]
    if rot: c = rot90(c, rot)
    x, y, _ = spiral(t)
    put(mid, c, int(round(x)) - c.shape[1] // 2 + dx, int(round(y)) - c.shape[0] // 2 + dy)


for t0, a0, a1, dr in BACK: streak(arc(t0, a0, a1, dr), False)   # hinten (vom Trichter verdeckt)
put(mid, tornado, TX, TY)

# Staub- und Trümmerwolke, in der der Rüssel aufsetzt
dust = [(52, 62, 58), (76, 86, 80), (104, 112, 102), (134, 140, 126)]
for x in range(tip[0] - 13, tip[0] + 14):
    u = (x - tip[0]) / 13.5
    h = (1 - u * u) * 6.5 + 1.0 * math.sin(x * 1.3) + 0.6 * math.sin(x * 2.7)
    top = GROUND - h
    for y in range(int(math.floor(top)), GROUND + 1):
        d = y - top
        c = dust[3] if d < 1 and u < .3 else (dust[2] if d < 2 + bayer(x, y) * 1.5 else (dust[1] if d < 4.5 + bayer(x, y) * 1.5 else dust[0]))
        setp(mid, x, y, c)

# Wolkenkragen: der Trichter wächst aus der Mutterwolke
ccol = [(34, 37, 52), (46, 51, 68), (66, 73, 90), (96, 106, 120)]
for x in range(-1, TX + 42):
    u = (x - (TX + 15)) / 20
    base = TY + 6 - 3 * abs(u) + 1.3 * math.sin(x * .55) + 1.0 * math.sin(x * 1.3 + 1)
    if x > TX + 30: base -= (x - TX - 30) * .7
    for y in range(0, int(base) + 1):
        d = int(base) - y
        if d > 9 and mid[y, x, 3] == 0: continue
        c = ccol[3] if d == 0 else (ccol[2] if d < 2 + bayer(x, y) * 1.2 else (ccol[1] if d < 5 + bayer(x, y) * 2 else ccol[0]))
        setp(mid, x, y, c)

for t0, a0, a1, dr in FRONT: streak(arc(t0, a0, a1, dr), True)   # vorn über dem Trichter
# Karten im Sog, gleich groß, gestaffelt die Spirale hinauf (vorn rechts / vorn links im Wechsel)
card_at(0.03, 'purple0', 0, dx=1)      # eben aus der Hand gerissen
card_at(0.14, 'red', 0, dx=-1)
card_at(0.50, 'blue0', 1)
card_at(0.64, 'purple1', 3, dx=9)
card_at(0.99, 'gold', 0, dy=2)

# Hügelkuppe rechts unten (Standfläche des Helden)
grass = [(24, 40, 32), (34, 56, 40), (48, 76, 50), (72, 104, 64)]
def hill_top(x):
    return 98.5 + ((x - 56) / 34) ** 2 * 4 if x >= 30 else 98.5 + ((30 - 56) / 34) ** 2 * 4 + (30 - x) * .9
for x in range(mw):
    top = hill_top(x)
    for y in range(int(top), mh):
        d = y - top
        cc = grass[3] if d < 1 else (grass[2] if d < 2.5 + bayer(x, y) * 1.5 else (grass[1] if d < 7 + bayer(x, y) * 4 else grass[0]))
        mid[y, x, :3] = cc; mid[y, x, 3] = 255
for x in range(28, mw, 4):             # windgebeugte Halme
    top = int(hill_top(x))
    setp(mid, x, top - 1, grass[3]); setp(mid, x - 1, top - 2, grass[2])

# ================= Vordergrund 5× (Champion) ============================================
K5 = 5
fw, fh = W // K5, H // K5              # 50×70
fg = rgba(fw, fh)
CXf, CYf = 18, 34                      # x 90–230; Füße auf Zeile CYf+25 (y 295–300)
sh = (18, 30, 24)
for x in range(CXf + 6, CXf + 24): setp(fg, x, CYf + 26, sh)
for x in range(CXf + 18, CXf + 24): setp(fg, x, CYf + 31, sh)
put(fg, champ, CXf, CYf)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, mid, K3)
blit(cv, fg, K5)
p = save(cv, '04_stormdraw.png')
print(p)
