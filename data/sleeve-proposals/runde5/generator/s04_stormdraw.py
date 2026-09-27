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
Regen, ferner Blitz, Ebene mit Fluss (wie im Kartenbild), Hügelkuppe, Windbahn (1 px, hell/dunkel),
Staubwolke am Rüssel, Bodenschatten.
Karten: nur drei (lila Heldenkarte = eigene Hand, blaue Karte = Gegner, goldene Karte oben = neu gezogen),
nur um 90° gedreht, auf der Windbahn aufgereiht.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Wolken, Regen, Blitz, Ebene, Fluss)                  – 2×-Raster (125×175)
  Mittelgrund (Tornado 32×50 → 96×150, Karten 8×11 → 24×33, Windbahn,
               Wolkenkragen, Staub, Hügelkuppe)                            – 3×-Raster (84×117)
  Vordergrund (Champion 28×31 → 168×186, Bodenschatten)                    – 6×-Raster (42×59)
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

# ================= Mittelgrund 3× (Tornado, Karten, Windbänder, Hügel) ===================
K3 = 3
mw, mh = grid(K3)                      # 84×117
mid = rgba(mw, mh)
TX, TY = 2, 37                        # Tornado (Rüsselspitze auf dem Horizont)
th, tw = tornado.shape[:2]
tm = tornado[..., 3] > 0
rows = {}
for r in range(th):
    xs = np.where(tm[r])[0]
    rows[TY + r] = (TX + (xs.min() + xs.max() + 1) / 2, (xs.max() - xs.min() + 1) / 2)
tip = (TX + 15, TY + th - 1)


def funnel(y):
    y = min(max(int(round(y)), TY), TY + th - 1)
    return rows[y]


def spiral(t):
    """Windbahn: von der Hand des Helden um den Trichter herum hinauf in die Wolke."""
    y = tip[1] - 6 - t * (th + 14)
    c, hw = funnel(y)
    a = 0.2 + t * math.pi * 2 * 2.1
    r = hw + 3 + t * 7
    return c + math.cos(a) * r, y + math.sin(a) * (2.5 + t * 7), math.sin(a)


N = 1400
path = [spiral(i / N) for i in range(N)]
wind_f = [(210, 230, 222), (58, 74, 80)]
wind_b = [(80, 98, 102), (60, 76, 82)]


def draw_wind(front):
    seen = []
    for x, y, s_ in path:
        p = (int(round(x)), int(round(y)))
        if (s_ >= 0) == front and (not seen or seen[-1] != p):
            seen.append(p)
    for j, (x, y) in enumerate(dict.fromkeys(seen)):
        if j % 9 == 8: continue           # kleine Lücken: Böen
        setp(mid, x, y, (wind_f if front else wind_b)[j % 2])


def card_at(t, key, rot=0, dark=0.0, dx=0, dy=0):
    c = CARDS[key]
    if rot: c = rot90(c, rot)
    if dark: c = darken(c, dark)
    x, y, _ = spiral(t)
    put(mid, c, int(round(x)) - c.shape[1] // 2 + dx, int(round(y)) - c.shape[0] // 2 + dy)


draw_wind(False)
put(mid, tornado, TX, TY)
# Staubwolke am Fuß des Rüssels (flache, gewölbte Wolke, von links beleuchtet)
dust = [(56, 66, 60), (80, 90, 82), (110, 118, 106), (140, 146, 130)]
for x in range(tip[0] - 9, tip[0] + 10):
    u = (x - tip[0]) / 9.5
    h = (1 - u * u) * 3.2 + 0.8 * math.sin(x * 1.7)
    top = tip[1] + 1 - h
    for y in range(int(math.floor(top)), tip[1] + 2):
        d = y - top
        c = dust[3] if d < 1 and u < .2 else (dust[2] if d < 1.6 + bayer(x, y) else (dust[1] if d < 3 + bayer(x, y) else dust[0]))
        setp(mid, x, y, c)
# Wolkenkragen: der Trichter wächst aus der Mutterwolke (Wolkenwülste über den oberen Zeilen)
ccol = [(34, 37, 52), (46, 51, 68), (66, 73, 90), (96, 106, 120)]
for x in range(-1, TX + 40):
    u = (x - (TX + 15)) / 20
    base = TY + 6 - 3 * abs(u) + 1.3 * math.sin(x * .55) + 1.0 * math.sin(x * 1.3 + 1)
    if x > TX + 30: base -= (x - TX - 30) * .7
    for y in range(TY - 14, int(base) + 1):
        d = int(base) - y
        c = ccol[3] if d == 0 else (ccol[2] if d < 2 + bayer(x, y) * 1.2 else (ccol[1] if d < 5 + bayer(x, y) * 2 else ccol[0]))
        setp(mid, x, y, c)
draw_wind(True)
card_at(0.17, 'purple0', 0, dx=2)
card_at(0.51, 'blue0', 1, dx=-2, dy=-6)
card_at(0.99, 'gold', 0)

# Hügelkuppe rechts unten (Standfläche des Helden)
grass = [(24, 40, 32), (34, 56, 40), (48, 76, 50), (72, 104, 64)]
def hill_top(x):
    return 98.5 + ((x - 56) / 34) ** 2 * 4 if x >= 26 else 98.5 + ((26 - 56) / 34) ** 2 * 4 + (26 - x) * .9
for x in range(mw):
    top = hill_top(x)
    for y in range(int(top), mh):
        d = y - top
        cc = grass[3] if d < 1 else (grass[2] if d < 2.5 + bayer(x, y) * 1.5 else (grass[1] if d < 7 + bayer(x, y) * 4 else grass[0]))
        mid[y, x, :3] = cc; mid[y, x, 3] = 255
for x in range(24, mw, 4):             # windgebeugte Halme
    top = int(hill_top(x))
    setp(mid, x, top - 1, grass[3]); setp(mid, x - 1, top - 2, grass[2])

# ================= Vordergrund 6× (Champion) ============================================
fw, fh = grid(6)                       # 42×59
fg = rgba(fw, fh)
CXf, CYf = 10, 24                      # Füße auf Zeile CYf+25 (y 294–300)
sh = (18, 30, 24)
for x in range(CXf + 6, CXf + 24): setp(fg, x, CYf + 26, sh)
for x in range(CXf + 18, CXf + 24): setp(fg, x, CYf + 31, sh)
put(fg, champ, CXf, CYf)

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, mid, K3)
blit(cv, fg, 6)
p = save(cv, '04_stormdraw.png')
print(p)
