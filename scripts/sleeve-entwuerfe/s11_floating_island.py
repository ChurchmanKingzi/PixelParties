# -*- coding: utf-8 -*-
"""11 Floating Island – Tarleinns schwebende Insel über dem Wolkenmeer: der Fluss stürzt als langer
Wasserfall in die Wolken, kleine Schwebeinseln in mehreren Tiefen, Sonne oben rechts (wie im Spiel:
Licht IMMER oben rechts), Schwalben. Aufgebaut aus den Area-Ebenen public/areas/floating-island/."""
from lib import *

FI = 'floating-island/'
YY, XX = np.mgrid[0:H, 0:W]
rnd = random.Random(11)


# ---------------------------------------------------------------- Helfer
def A(n):
    return area(FI + n)


def ordered(v, n, ox=0, oy=0):
    h, w = v.shape
    yy, xx = np.mgrid[0:h, 0:w]
    return np.clip(np.floor(v * (n - 1) + BAYER4[(yy + oy) % 4, (xx + ox) % 4]), 0, n - 1).astype(int)


def rgba(c):
    return tuple(c) + (255,) if len(c) == 3 else tuple(c)


def layer_from(idx, mask, pal):
    P = np.array([rgba(c) for c in pal], np.uint8)
    out = P[np.clip(idx, 0, len(pal) - 1)]
    out[~mask] = 0
    return Image.fromarray(out, 'RGBA')


def comp(img, sprite, x, y):
    img.alpha_composite(sprite, (int(x), int(y)))


def setc(img, m, col):
    a = np.array(img); a[m] = rgba(col)
    return Image.fromarray(a)


def haze(img, col, amt):
    """Luftperspektive: Farben Richtung Dunst ziehen (Pixelstruktur bleibt)."""
    a = np.array(img).astype(float)
    a[..., :3] = a[..., :3] * (1 - amt) + np.array(col) * amt
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def flip(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def sea_layer(w, h, seed, rmin, rmax, pal, amp=4, depth=22, ox=0, oy=0, towers=(), rows=2, pad=0):
    """Wolkenmeer-Schicht aus runden Buckeln (Licht oben rechts), gemalt wie Pixel-Art-Wolken:
    helle Kappe oben rechts, Hauptton, Schattensichel unten links; Körper darunter wird nach unten
    dunkler. Tiefer liegende Buckel überdecken höhere -> klare Kanten. pal dunkel -> hell."""
    r = random.Random(seed)
    n = len(pal)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    val = np.full((h, w), -1.0)
    circ = []
    base = pad + amp + rmax * 1.5
    ph = r.uniform(0, 6)
    for row in range(rows):
        x = r.uniform(-rmax, 0)
        while x < w + rmax:
            rr = r.uniform(rmin, rmax) * (1 - 0.18 * row)
            lift = amp * (math.sin(x * 0.05 + ph) + 1) * 0.5 + r.uniform(0, amp * 0.5)
            cy = base - rr * 0.45 + lift - amp + row * rmax * 0.55
            circ.append((x + row * rmax * 0.5, cy, rr))
            x += rr * r.uniform(0.9, 1.3)
    for (tx, er, lift) in towers:
        circ.append((tx, base - er * 0.5 - lift, er))
    # Körper
    body = yy >= base - 1
    val[body] = 0.55
    circ.sort(key=lambda c: c[1] + c[2] * 0.3)
    for (cx, cy, rr) in circ:
        dx = (xx - cx) / rr; dy = (yy - cy) / rr
        d = np.sqrt(dx * dx + dy * dy)
        disc = d <= 1
        lit = (dx * 0.5 - dy * 0.85)           # Licht von oben rechts
        v = 0.62 + 0.38 * np.clip(lit, -1, 1)
        v = np.where(d > 0.84, v - 0.1 * np.clip(-lit + 0.3, 0, 1), v)   # dunkler Randsaum unten links
        val = np.where(disc, v, val)
    m = val >= 0
    below = np.clip((yy - (base - rmax * 0.2)) / depth, 0, 1)
    val = val - 0.55 * below
    val += (value_noise(w, h, 5, seed=seed + 100, octaves=2) - 0.5) * 0.10
    idx = ordered(np.clip(val, 0, 1), n, ox, oy)
    return layer_from(idx, m, pal)


def puff(w, h, circ, pal, flat=None, seed=0, ox=0, oy=0):
    """Einzelne Pixelwolke aus Buckeln (gleiche Malweise wie sea_layer)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    val = np.full((h, w), -1.0)
    for (cx, cy, rr) in sorted(circ, key=lambda c: c[1] + c[2] * 0.3):
        dx = (xx - cx) / rr; dy = (yy - cy) / rr
        d = np.sqrt(dx * dx + dy * dy)
        lit = (dx * 0.5 - dy * 0.85)
        v = 0.62 + 0.38 * np.clip(lit, -1, 1)
        v = np.where(d > 0.84, v - 0.1 * np.clip(-lit + 0.3, 0, 1), v)
        val = np.where(d <= 1, v, val)
    m = val >= 0
    if flat is not None:
        m &= yy <= flat
    val += (value_noise(w, h, 5, seed=seed + 7, octaves=2) - 0.5) * 0.10
    return layer_from(ordered(np.clip(val, 0, 1), len(pal), ox, oy), m, pal)


# ---------------------------------------------------------------- Palette (aus den Area-Bildern)
SKYP = [(19, 73, 189), (23, 83, 203), (26, 93, 215), (31, 103, 224), (38, 114, 232), (45, 125, 239),
        (54, 136, 243), (76, 152, 246), (104, 170, 248), (138, 190, 250)]
CLOUD = [(100, 133, 200), (131, 163, 220), (152, 180, 227), (173, 196, 234), (203, 219, 245),
         (221, 232, 249), (237, 243, 252)]
WAT = {'H': (8, 26, 90), 'F': (13, 35, 120), 'C': (19, 52, 164), 'B': (26, 72, 200), 'A': (35, 96, 226),
       'D': (47, 120, 243), 'E': (78, 147, 251), 'I': (128, 180, 255), 'G': (188, 217, 255),
       'J': (26, 58, 154), 'K': (230, 242, 255), 'L': (212, 232, 255)}

# ---------------------------------------------------------------- Himmel
SUN = (194, 46)
RAMP = SKYP + [(172, 208, 252), (208, 230, 255), (236, 246, 255)]
noise = value_noise(W, H, 16, seed=4)
dsun = np.hypot(XX - SUN[0], (YY - SUN[1]) * 1.05)
ang = np.arctan2(YY - SUN[1], XX - SUN[0])
v = YY / 250.0 * 8.2 + (noise - 0.5) * 1.1
v += 3.2 * np.exp(-(dsun / 62) ** 2) + 5.5 * np.exp(-(dsun / 20) ** 2)
# Sonnenstrahlen nach unten links (weiche, gedithterte Lichtbahnen)
ray = np.clip(np.sin(ang * 13 + 0.9) * 1.6 - 0.6, 0, 1) * ((ang > 1.3) & (ang < 3.1))
v += ray * 1.5 * np.clip(1 - dsun / 260, 0, 1) * np.clip(dsun / 30, 0, 1)
idx = np.clip(np.floor(v + BAYER4[YY % 4, XX % 4]), 0, len(RAMP) - 1).astype(int)
im = layer_from(idx, np.ones((H, W), bool), RAMP)
# Sonnenscheibe
dsun_c = np.hypot(XX - SUN[0], YY - SUN[1])
im = setc(im, dsun_c <= 7.3, (255, 240, 190))
im = setc(im, dsun_c <= 6.3, (255, 249, 222))
im = setc(im, dsun_c <= 4.4, (255, 255, 248))

# feine Schlierenwolken (wie im Spiel-Himmel)
d = ImageDraw.Draw(im)
for (x, y, L) in [(14, 66, 22), (44, 72, 10), (96, 30, 16), (26, 128, 18), (214, 116, 20), (132, 132, 12)]:
    d.line((x, y, x + L, y), fill=(90, 143, 232))
    for k in range(0, L, 5):
        d.point((x + k + 2, y), fill=(120, 170, 240))
    d.line((x + 3, y + 1, x + L - 4, y + 1), fill=(61, 120, 224))

# ---------------------------------------------------------------- Sprites der Area
CB = A('clouds-back')
cb_lab, _ = ndimage.label(np.array(CB)[:75, :, 3] > 0, structure=np.ones((3, 3)))
PUFFS = [CB.crop((s_[1].start, s_[0].start, s_[1].stop, s_[0].stop)) for s_ in ndimage.find_objects(cb_lab)]
PUFFS.sort(key=lambda c: -c.width)
BANK = CB.crop((0, 76, 256, 100))
BIRD = A('bird')
BIRDS = [BIRD.crop((k * 11, 0, k * 11 + 11, 7)) for k in range(4)]
ISLE = {n: A('isle-' + n) for n in 'abcde'}
HAZE = (104, 170, 248)

# kleine Himmelswolken (1x)
# ferne Schwebeinseln (stark im Dunst)
comp(im, haze(ISLE['c'], HAZE, 0.62), 22, 34)
comp(im, haze(flip(ISLE['e']), HAZE, 0.62), 112, 14)
comp(im, haze(ISLE['d'], (120, 180, 250), 0.5), 218, 138)

for (i, x, y, hz) in [(0, 8, 92, 0.0), (4, 150, 86, 0.1), (3, 88, 44, 0.2)]:
    comp(im, haze(PUFFS[i], HAZE, hz), x, y)

# ---------------------------------------------------------------- Wolkenmeer hinten
CLOUDX = CLOUD + [(250, 252, 255)]


def sea_pal(hz, lo=0, hi=7):
    return [lerp(c, HAZE, hz) for c in CLOUDX[lo:hi]]


comp(im, haze(BANK, HAZE, 0.3), -3, 230)
SEA = [  # (y, seed, rmin, rmax, Dunst, Palette lo..hi, amp, towers)
    (236, 5, 5, 9, 0.22, 0, 6, 3, ()),
]


def draw_sea(rows):
    global im
    for (ty, sd, r0, r1, hz, lo, hi, amp, tw) in rows:
        pal = sea_pal(hz, lo, hi)
        PADY = 30
        lay = sea_layer(W, H - ty + PADY, sd, r0, r1, pal, amp=amp, oy=ty - PADY, towers=tw, pad=PADY,
                        rows=1 if r1 >= 18 else 2)
        comp(im, lay, 0, ty - PADY)


draw_sea(SEA)

# ---------------------------------------------------------------- Hauptinsel
IX, IY = 25, 106
island = A('island')
water = A('water').crop((0, 0, 200, 100))
sway = A('sway').crop((0, 0, 200, 100))
wa = np.array(water); wa[85:, :, 3] = 0; water = Image.fromarray(wa)

# Wasserfall verlängern (gleiche Palette/Struktur wie water.png)
FALL_TOP = 85
FALL_END = 253 - IY
fh = FALL_END - FALL_TOP
fw = 28
fall = np.zeros((fh, fw, 4), np.uint8)
rf = random.Random(21)
INNER = ['A', 'B', 'B', 'D', 'E', 'A', 'B', 'I', 'D', 'C', 'A', 'B']
X0 = 57 - 46                  # linke Kante im Ausschnitt (Stück-x 57); Ausschnitt beginnt bei Stück-x 46
edges = []
for y_ in range(fh):
    g = y_ / fh
    xl = X0
    xr = 69 - 46
    edges.append((xl, xr))
    fall[y_, xl] = rgba(WAT['H'])
    fall[y_, xl + 1] = rgba(WAT['F'])
    fall[y_, xl + 2] = rgba(WAT['F'] if (y_ // 3) % 3 else WAT['C'])
    fall[y_, xr] = rgba(WAT['J'])
for x in range(fw):
    y_ = 0
    while y_ < fh:
        L = rf.randint(2, 7)
        c = rf.choice(INNER)
        for k in range(L):
            yk = y_ + k
            if yk < fh:
                xl, xr = edges[yk]
                if xl + 3 <= x <= xr - 1:
                    fall[yk, x] = rgba(WAT[c])
        y_ += L
# nach unten in Dunst übergehen (Luftperspektive zum Wolkenmeer hin)
fy_ = np.mgrid[0:fh, 0:fw][0]
hz_t = np.clip((fy_ - 8) / (fh - 8), 0, 1) ** 1.2 * 0.5
fa_ = fall.astype(float)
fa_[..., :3] = fa_[..., :3] * (1 - hz_t[..., None]) + np.array([150, 192, 246]) * hz_t[..., None]
fall = fa_.clip(0, 255).astype(np.uint8)
# Gischt an den Kanten, nach unten dichter
for y_ in range(0, fh):
    xl, xr = edges[y_]
    p_ = 0.04 + 0.30 * (y_ / fh) ** 2
    for side, xe in ((-1, xl), (1, xr)):
        if rf.random() < p_:
            k = 1 + (rf.random() < 0.3 * y_ / fh)
            x = xe + side * k
            if 0 <= x < fw:
                fall[y_, x] = rgba(WAT['L'] if rf.random() < 0.6 else WAT['K'])
# unten in Gischt auflösen
for y_ in range(fh - 8, fh):
    tt = (y_ - (fh - 8)) / 8
    for x in range(fw):
        if fall[y_, x, 3] and rf.random() < tt * 0.5:
            fall[y_, x] = rgba(WAT['L'] if rf.random() < 0.6 else WAT['K'])
fall_img = Image.fromarray(fall)
FX, FY = IX + 46, IY + FALL_TOP

comp(im, island, IX, IY)
comp(im, water, IX, IY)
comp(im, fall_img, FX, FY)
comp(im, sway, IX, IY)

# Details wie im Spiel: Glitzern auf dem Fluss, Erdkrümel unter den Zacken, Tropfen am Überlauf
dd = ImageDraw.Draw(im)
for (gx, gy) in [(60, 10), (58, 30), (61, 46)]:
    x, y = IX + gx, IY + gy
    dd.point([(x - 1, y), (x + 1, y)], fill=(188, 217, 255))
    dd.point((x, y), fill=(255, 255, 255))
for (tx, ty) in [(57, 66), (70, 70), (56, 76), (71, 79)]:
    dd.point((IX + tx, IY + ty), fill=(188, 217, 255))

# ---------------------------------------------------------------- Wolkenmeer vorne
SEA2 = [
    (246, 7, 6, 11, 0.12, 0, 7, 3, ()),
    (262, 8, 8, 14, 0.05, 0, 7, 4, ((170, 20, 6),)),
    (284, 9, 10, 18, 0.0, 1, 8, 5, ((30, 24, 4),)),
    (312, 10, 15, 26, 0.0, 1, 8, 5, ((4, 30, 12), (246, 28, 10))),
]
draw_sea(SEA2[:1])

# Gischtwolke, wo der Wasserfall in die Wolken stürzt
FCX = FX + (X0 + 69 - 46) // 2 + 1
SPL_Y = 241
sp = puff(46, 26, [(10, 11, 7.5), (3, 17, 5), (34, 10, 8), (42, 16, 5), (22, 12.5, 7), (15, 18, 6), (29, 18, 6)],
          sea_pal(0.02, 1, 8), seed=3, oy=SPL_Y - 4)
comp(im, sp, FCX - 22, SPL_Y - 4)
dsp = ImageDraw.Draw(im)
rs = random.Random(8)
for _ in range(16):
    x = FCX + int(rs.gauss(0, 7)); y = SPL_Y - 2 - int(abs(rs.gauss(0, 6)))
    dsp.point((x, y), fill=WAT['K'] if rs.random() < 0.5 else WAT['L'])
draw_sea(SEA2[1:2])

# ---------------------------------------------------------------- Schwebeinseln mittlere Tiefe / vorne
comp(im, haze(ISLE['a'], HAZE, 0.22), 6, 194)
comp(im, haze(flip(ISLE['b']), HAZE, 0.18), 214, 190)
draw_sea(SEA2[2:3])
comp(im, ISLE['c'], 190, 262)
comp(im, flip(ISLE['d']), 26, 250)
draw_sea(SEA2[3:])

# ---------------------------------------------------------------- Schwalben
for (k, x, y, fl) in [(0, 62, 74, False), (2, 80, 67, False), (0, 184, 80, True)]:
    b = BIRDS[k]
    comp(im, flip(b) if fl else b, x, y)


# ---------------------------------------------------------------- Rahmen
bevel_frame(im, (48, 30, 12), (255, 234, 160), (218, 168, 64), (146, 94, 30), (48, 30, 12), width=6)
dfr = ImageDraw.Draw(im)
dfr.rectangle((6, 6, W - 7, H - 7), outline=(22, 58, 146))
# Eckstücke: kleine Himmelssteine in Goldfassung
for (x, y) in [(3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)]:
    dfr.rectangle((x - 3, y - 3, x + 3, y + 3), fill=(48, 30, 12))
    dfr.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(255, 234, 160))
    dfr.rectangle((x - 1, y - 1, x + 1, y + 1), fill=(44, 104, 206))
    dfr.point((x - 1, y - 1), fill=(188, 217, 255))
    dfr.point((x + 1, y + 1), fill=(22, 58, 146))
print(save(im, '11_floating_island'))
