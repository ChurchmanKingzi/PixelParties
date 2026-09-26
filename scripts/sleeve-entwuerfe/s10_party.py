# -*- coding: utf-8 -*-
"""10 Skelett-Party: Friedhofs-Rave vor einer Gruft-Bühne im Vollmond."""
from lib import *
from skel_sprites import *
from skel_sprites import _stamp, _bone

rnd = random.Random(10)
yy, xx = np.mgrid[0:H, 0:W]
CX = W // 2


SHADOW = [True]


def shadow(im, x, y, w):
    a = np.array(im)
    m = (np.abs(xx - x) / max(1, w / 2)) ** 2 + ((yy - y) / 1.6) ** 2 <= 1
    a[m, :3] = (a[m, :3] * 0.55).astype(np.uint8)
    im.paste(Image.fromarray(a))


def put(im, spr, x, y, anchor='bottom', shd=False):
    """Sprite mit Fußpunkt (x=Mitte, y=Unterkante) setzen."""
    if shd:
        shadow(im, x, y - 1, spr.width * 0.9)
    if anchor == 'bottom':
        im.alpha_composite(spr, (int(x - spr.width // 2), int(y - spr.height)))
    else:
        im.alpha_composite(spr, (int(x), int(y)))


def blend_mask(im, m, col, amt=None):
    a = np.array(im)
    if amt is None:
        a[m, :3] = col[:3]
    else:
        a[m, :3] = (a[m, :3] * (1 - amt) + np.array(col[:3]) * amt).astype(np.uint8)
    return Image.fromarray(a)


def add_light(im, cx, cy, rad, col, st=1.0, sy=1.0, mask=None):
    """Gedithertes additives Licht."""
    dd = np.hypot(xx - cx, (yy - cy) / sy)
    t = np.clip(1 - dd / rad, 0, 1) ** 1.3 * st
    m = dither_mask(None, t)
    if mask is not None:
        m &= mask
    a = np.array(im).astype(int)
    a[m, :3] = np.clip(a[m, :3] + np.array(col[:3]), 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def tone(img, mul, add=(0, 0, 0)):
    a = np.array(img).astype(float)
    a[..., :3] = a[..., :3] * np.array(mul) + np.array(add)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


# =====================================================================
# 1) Himmel
# =====================================================================
im = new()
im.alpha_composite(dither_gradient((W, H), [(0, (10, 8, 28)), (0.18, (22, 14, 48)), (0.4, (44, 24, 74)), (0.55, (70, 36, 96)), (0.62, (84, 44, 104)), (1, (40, 20, 50))]))
MX, MY, MR = CX, 86, 38
# Mond-Halo
for rad, col, st in [(120, (40, 28, 78), 1.0), (86, (58, 44, 98), 1.0), (60, (82, 72, 122), 1.0)]:
    dd = np.hypot(xx - MX, yy - MY)
    m = dither_mask(None, np.clip(1 - dd / rad, 0, 1) * 1.5 * st)
    im = blend_mask(im, m, col)
stars(im, 110, [(255, 255, 255), (210, 200, 255), (255, 230, 250), (140, 120, 200)], seed=21, box=(6, 6, W - 6, 170), big=0.05)
# Vollmond
mn = moon(MR, 0.5, lit=(236, 246, 206), lit2=(206, 222, 176), seed=8)
ma = np.array(mn)
# Mondmeere: Rauschen
nz = value_noise(ma.shape[1], ma.shape[0], 14, seed=3)
inside = ma[..., 3] > 0
ma[inside & (nz > 0.58)] = (200, 216, 172, 255)
ma[inside & (nz > 0.66)] = (178, 196, 156, 255)
mn = Image.fromarray(ma)
paste(im, mn, (MX, MY), center=True)
# Wolkenschleier vor dem Mond (Rauschen, horizontal gestreckt, Mondkante beleuchtet)
for (cy_, hh_, sd, body, rim) in [(66, 9, 4, (52, 34, 86), (150, 150, 170)), (108, 8, 7, (58, 38, 92), (160, 160, 176)), (30, 7, 9, (30, 20, 60), (80, 70, 120))]:
    n1 = value_noise(W // 3 + 2, H, 6, seed=sd, octaves=3)
    n1 = np.array(Image.fromarray((n1 * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(float) / 255
    prof = np.clip(1 - np.abs(yy - cy_ - 3 * np.sin(xx / 23.0 + sd)) / hh_, 0, 1)
    c = (n1 * 0.9 + prof * 0.8) > 1.02
    c &= prof > 0
    rimm = c & ~np.roll(c, 1, axis=0)
    near = np.hypot(xx - MX, yy - MY) < MR + 30
    im = blend_mask(im, c, body)
    im = blend_mask(im, rimm & near, rim)
    im = blend_mask(im, rimm & ~near, tuple(int(v * 0.7) for v in body[:3]))

im.save(os.path.join(TMP, 'p10_a.png'))

# =====================================================================
# 2) Ferne Hügel, Kirche, Bäume, Nebel
# =====================================================================
nz = value_noise(W, H, 40, seed=5)
HOR = 182
hill1 = yy > HOR - 16 + 10 * np.sin(xx / 34.0 + 1.2) + 6 * nz
hill2 = yy > HOR - 4 + 6 * np.sin(xx / 22.0 + 3) + 4 * nz
a = np.array(im)
a[hill1] = (36, 22, 58, 255)
e1 = hill1 & ~ndimage.binary_erosion(hill1)
a[e1] = (74, 52, 108, 255)
a[hill2] = (28, 16, 44, 255)
e2 = hill2 & ~ndimage.binary_erosion(hill2)
a[e2] = (60, 40, 86, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# ferne Kirche (Silhouette) rechts
CH = (30, 18, 48)
def church(x, base):
    d.rectangle((x, base - 22, x + 16, base), fill=CH)
    d.polygon([(x - 1, base - 22), (x + 8, base - 30), (x + 17, base - 22)], fill=CH)
    d.rectangle((x + 18, base - 38, x + 24, base), fill=CH)
    d.polygon([(x + 17, base - 38), (x + 21, base - 52), (x + 25, base - 38)], fill=CH)
    d.line((x + 21, base - 57, x + 21, base - 52), fill=CH); d.line((x + 19, base - 55, x + 23, base - 55), fill=CH)
    d.point((x + 21, base - 32), fill=(250, 210, 110)); d.point((x + 5, base - 14), fill=(250, 210, 110)); d.point((x + 10, base - 14), fill=(230, 170, 90))
# kleine Grabkreuz-Silhouetten am Horizont
for x in range(10, 240, 7):
    yb = int(HOR - 16 + 10 * math.sin(x / 34.0 + 1.2) + 6 * nz[0, x]) + 1
    if rnd.random() < 0.55 and not (190 < x < 222):
        if rnd.random() < 0.5:
            d.line((x, yb - 4, x, yb), fill=CH); d.line((x - 1, yb - 3, x + 1, yb - 3), fill=CH)
        else:
            d.rectangle((x - 1, yb - 3, x + 1, yb), fill=CH); d.point((x, yb - 4), fill=CH)
# tote Bäume links/rechts
tree = area('graveyard/tree'); tree = tree.crop(tree.getbbox())
ta = np.array(tree).astype(int)
L = ta[..., :3].mean(2)
tsil = np.zeros_like(ta)
tsil[..., 3] = np.where(ta[..., 3] == 255, 255, 0)
tsil[..., :3] = np.where((L > 60)[..., None], (48, 30, 70), (22, 12, 34))
treeS = Image.fromarray(tsil.astype(np.uint8))
put(im, treeS, 30, 190)
put(im, treeS.transpose(Image.FLIP_LEFT_RIGHT), 222, 196)
im.save(os.path.join(TMP, 'p10_b.png'))
print('ok')

# =====================================================================
# 2b) Boden (Erde, Kies, Grasbüschel) mit Tiefenstaffelung
# =====================================================================
GY = 196
gnd = yy >= GY + 2 * np.sin(xx / 19.0)
depth = np.clip((yy - GY) / (H - GY), 0, 1)
n1 = value_noise(W, H, 16, seed=31); n2 = value_noise(W, H, 4, seed=32)
base = np.zeros((H, W, 3))
c_far = np.array((34, 20, 46)); c_near = np.array((58, 36, 58))
base[:] = c_far + (c_near - c_far) * depth[..., None]
tt = n1 * 0.7 + n2 * 0.3
lvl = np.where(dither_mask(None, np.clip((tt - 0.42) * 3, 0, 1)), 1, 0) + np.where(dither_mask(None, np.clip((tt - 0.6) * 4, 0, 1)), 1, 0)
base = base * (0.82 + 0.14 * lvl[..., None])
a = np.array(im)
a[gnd, :3] = base[gnd].clip(0, 255).astype(np.uint8)
# Kiesel
r3 = random.Random(44)
for _ in range(900):
    x = r3.randrange(0, W); y = r3.randrange(GY + 4, H)
    if not gnd[y, x]:
        continue
    dp = (y - GY) / (H - GY)
    lc = (np.array((c_far + (c_near - c_far) * dp)) * 1.5 + 12).clip(0, 255).astype(np.uint8)
    dc = (np.array((c_far + (c_near - c_far) * dp)) * 0.6).astype(np.uint8)
    if dp > 0.45 and r3.random() < 0.5:
        a[y, x, :3] = lc; a[y, min(x + 1, W - 1), :3] = lc
        if y + 1 < H: a[y + 1, x, :3] = dc; a[y + 1, min(x + 1, W - 1), :3] = dc
    else:
        a[y, x, :3] = lc
        if y + 1 < H: a[y + 1, x, :3] = dc
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Grasbüschel
for _ in range(160):
    x = r3.randrange(4, W - 4); y = r3.randrange(GY + 3, H)
    dp = (y - GY) / (H - GY)
    g1 = tuple(int(v) for v in (np.array((40, 70, 70)) * (0.7 + dp * 0.6)))
    g2 = tuple(int(v) for v in (np.array((70, 120, 90)) * (0.7 + dp * 0.5)))
    hgt = 1 + int(dp * 3)
    d.line((x, y, x - 1, y - hgt), fill=g1); d.line((x + 1, y, x + 1, y - hgt - 1), fill=g2); d.line((x + 2, y, x + 3, y - hgt), fill=g1)

# =====================================================================
# 3) Scheinwerfer-Kegel
# =====================================================================
def beam(im, x0, y0, ang, spread, length, col, st=0.35):
    r = np.hypot(xx - x0, yy - y0)
    th = np.degrees(np.arctan2(xx - x0, -(yy - y0)))
    t = np.clip(1 - np.abs(th - ang) / spread, 0, 1) * np.clip(1 - r / length, 0, 1) * st * (yy < y0)
    m = dither_mask(None, t)
    a = np.array(im).astype(int)
    a[m, :3] = np.clip(a[m, :3] + np.array(col), 0, 255)
    return Image.fromarray(a.astype(np.uint8))
im = beam(im, 96, 150, -38, 4.5, 190, (40, 100, 110), 0.5)
im = beam(im, 154, 150, 38, 4.5, 190, (110, 40, 100), 0.5)
im = beam(im, 112, 150, -16, 3, 170, (90, 90, 30), 0.35)
im = beam(im, 138, 150, 16, 3, 170, (40, 100, 50), 0.35)

# =====================================================================
# 4) Gruft-Bühne
# =====================================================================
ST = dict(hl=(176, 166, 204), li=(132, 122, 164), mi=(98, 88, 130), da=(70, 60, 100), de=(46, 36, 70), ol=(20, 12, 30))
def C(k):
    return ST[k] + (255,)

cr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(cr)
WX0, WX1, WY0, WY1 = 74, 176, 136, 199
# Mauerwerk
a = np.zeros((H, W, 4), np.uint8)
r2 = random.Random(3)
for row, y in enumerate(range(WY0, WY1, 5)):
    x = WX0 - (row % 2) * 5
    while x < WX1:
        bw = r2.randint(7, 12)
        v = r2.uniform(-0.12, 0.12)
        for yy_ in range(y, min(y + 4, WY1)):
            for xx_ in range(max(x, WX0), min(x + bw - 1, WX1)):
                k = 'mi'
                if yy_ == y: k = 'li'
                if yy_ == y + 3 or xx_ == x + bw - 2: k = 'da'
                col = np.array(ST[k]) * (1 + v)
                a[yy_, xx_, :3] = col.clip(0, 255); a[yy_, xx_, 3] = 255
        # Mörtel
        for xx_ in range(max(x, WX0), min(x + bw, WX1)):
            if y + 4 < WY1: a[y + 4, xx_] = C('de')
        if x + bw - 1 < WX1 and x + bw - 1 >= WX0:
            a[y:min(y + 4, WY1), x + bw - 1] = C('de')
        # Risse / Moos
        if r2.random() < 0.18:
            cx_ = r2.randint(max(x, WX0), max(max(x, WX0), min(x + bw - 3, WX1 - 1)))
            a[y + 1, cx_] = C('de'); a[y + 2, cx_ + 1] = C('de')
        if r2.random() < 0.25 and y > WY0 + 30:
            mx_ = r2.randint(max(x, WX0), max(max(x, WX0), min(x + bw - 2, WX1 - 1)))
            a[y + 3, mx_] = (70, 120, 70, 255)
            if r2.random() < 0.5: a[y + 4, mx_ + 1] = (50, 90, 60, 255)
        x += bw
cr.alpha_composite(Image.fromarray(a))
cd = ImageDraw.Draw(cr)
# Türbogen (Innen leuchtet)
DX0, DX1, DYT = 107, 143, 150
door = np.zeros((H, W), bool)
dcx, dr = (DX0 + DX1) / 2, (DX1 - DX0) / 2
door |= (xx >= DX0) & (xx <= DX1) & (yy >= DYT) & (yy <= WY1)
door |= (np.hypot(xx - dcx, (yy - DYT) * 1.15) <= dr) & (yy < DYT)
t = np.clip((yy - (DYT - dr)) / (WY1 - DYT + dr), 0, 1)
inner = dither_gradient((W, H), [(0, (60, 20, 90)), (0.45, (150, 40, 140)), (0.8, (250, 110, 190)), (1, (255, 200, 220))], func=lambda X, Y: np.clip((Y - (DYT - dr)) / (WY1 - DYT + dr), 0, 1))
ia = np.array(inner)
ca = np.array(cr)
ca[door] = ia[door]
# Treppe ins Innere (Stufen-Linien)
for i, y in enumerate(range(WY1 - 14, WY1, 3)):
    w_ = 4 + i * 2
    ca[y, int(dcx - w_):int(dcx + w_)] = (255, 170, 210, 255)
# Bogen-Laibung (Keilsteine)
edge = ndimage.binary_dilation(door, iterations=3) & ~door & (yy <= WY1)
ca[edge] = C('li')
edge2 = ndimage.binary_dilation(door, iterations=1) & ~door & (yy <= WY1)
ca[edge2] = C('de')
arch_out = ndimage.binary_dilation(door, iterations=4) & ~ndimage.binary_dilation(door, iterations=3) & (yy <= WY1)
ca[arch_out] = C('ol')
for ang in range(-80, 81, 20):
    rr_ = dr + 2.5
    px = int(round(dcx + rr_ * math.sin(math.radians(ang)))); py = int(round(DYT - rr_ * math.cos(math.radians(ang)) / 1.15))
    ca[py, px] = C('da')
    ca[py - 1, px] = C('hl') if ang < 0 else ca[py - 1, px]
# Schlussstein mit Schädel
ks = ["..hhhh..", ".hllllh.", "hlkllkld", "hlkllkld", ".llkkld.", "..ldld..", "..dddd.."]
kc = dict(h=C('hl'), l=(226, 220, 196, 255), k=C('ol'), d=(150, 140, 150, 255))
kx, ky = int(dcx) - 4, int(DYT - dr / 1.15) - 6
for j, r in enumerate(ks):
    for i, ch in enumerate(r):
        if ch != '.': ca[ky + j, kx + i] = kc[ch]
cr = Image.fromarray(ca)
cd = ImageDraw.Draw(cr)
# Säulen
def column(x, y0, y1, w=9):
    cols = [ST['ol'], ST['hl'], ST['li'], ST['li'], ST['mi'], ST['mi'], ST['da'], ST['de'], ST['ol']]
    for i in range(w):
        cd.line((x + i, y0, x + i, y1), fill=cols[i] + (255,))
    for y in range(y0 + 10, y1 - 4, 11):
        cd.line((x + 1, y, x + w - 2, y), fill=ST['de'] + (255,))
        cd.line((x + 1, y + 1, x + 2, y + 1), fill=ST['hl'] + (255,))
    # Kanneluren
    for y in range(y0 + 2, y1 - 2):
        if y % 11 not in (0, 1):
            cr.putpixel((x + 3, y), ST['mi'] + (255,)); cr.putpixel((x + 6, y), ST['de'] + (255,))
    # Kapitell / Basis
    cd.rectangle((x - 2, y0 - 5, x + w + 1, y0 - 1), fill=C('mi'), outline=C('ol'))
    cd.line((x - 1, y0 - 4, x + w, y0 - 4), fill=C('hl'))
    cd.line((x - 1, y0 - 2, x + w, y0 - 2), fill=C('da'))
    cd.point([(x - 1, y0 - 3), (x + w, y0 - 3)], fill=C('li'))
    cd.rectangle((x - 2, y1 + 1, x + w + 1, y1 + 4), fill=C('mi'), outline=C('ol'))
    cd.line((x - 1, y1 + 2, x + w, y1 + 2), fill=C('li'))
for x in (73, 91, 150, 168):
    column(x, WY0 + 2, WY1 - 5)
# Gebälk
EY0, EY1 = 122, 136
cd.rectangle((66, EY0, 184, EY1), fill=C('da'), outline=C('ol'))
cd.line((67, EY0 + 1, 183, EY0 + 1), fill=C('hl'))
cd.line((67, EY0 + 2, 183, EY0 + 2), fill=C('li'))
cd.line((67, EY0 + 3, 183, EY0 + 3), fill=C('ol'))
cd.rectangle((70, EY0 + 4, 180, EY1 - 2), fill=C('mi'))
cd.line((70, EY1 - 2, 180, EY1 - 2), fill=C('de'))
cd.line((70, EY1 - 1, 180, EY1 - 1), fill=C('ol'))
# Zahnschnitt
for x in range(68, 183, 3):
    cd.point((x, EY1), fill=C('li')); cd.point((x, EY1 + 1), fill=C('da'))
# Inschrift
insc = text_img('REST IN PARTY', 10, (56, 44, 80, 255))
ins2 = silhouette(insc, (150, 140, 180))
cr.alpha_composite(ins2, (CX - insc.width // 2 + 1, EY0 + 5))
cr.alpha_composite(insc, (CX - insc.width // 2, EY0 + 5 - 0))
# Giebel
PY = 96
tri = (yy < EY0) & (yy >= PY) & (np.abs(xx - CX) <= (yy - PY) * (60 / (EY0 - PY)) + 0.5)
ca = np.array(cr)
ca[tri] = C('da')
tin = (yy < EY0 - 1) & (yy >= PY + 5) & (np.abs(xx - CX) <= (yy - PY - 5) * (52 / (EY0 - PY - 5)))
ca[tin] = C('mi')
# Giebelfeld-Textur
ntx = value_noise(W, H, 5, seed=12)
ca[tin & (ntx > 0.62)] = C('li')
ca[tin & (ntx < 0.36)] = C('da')
tri_e = tri & ~ndimage.binary_erosion(tri)
ca[tri_e] = C('ol')
rim = tri & ~ndimage.binary_erosion(tri, iterations=2) & ~tri_e & (yy < EY0 - 1)
ca[rim] = (200, 214, 180, 255)  # Mondlicht-Kante
cr = Image.fromarray(ca)
cd = ImageDraw.Draw(cr)
# Relief: Schädel mit gekreuzten Knochen
rel = ["....hhhhh....",
       "...hlllllh...",
       "..hlllllllld.",
       "..hlkklkklld.",
       "..hlkklkklld.",
       "...llllklld..",
       "b..hlkdkld..b",
       ".b..ddddd..b.",
       "..bb.....bb..",
       "....bb.bb....",
       "..bb.....bb..",
       ".b.........b.",
       "b...........b"]
rc = dict(h=(186, 178, 200, 255), l=(160, 150, 180, 255), k=(36, 26, 54, 255), d=(104, 94, 132, 255), b=(150, 140, 176, 255))
rx0, ry0 = CX - 6, 106
for j, r in enumerate(rel):
    for i, ch in enumerate(r):
        if ch != '.': cr.putpixel((rx0 + i, ry0 + j), rc[ch])
# Sockel auf der Giebelspitze
cd.rectangle((CX - 6, PY - 4, CX + 6, PY + 1), fill=C('mi'), outline=C('ol'))
cd.line((CX - 5, PY - 3, CX + 5, PY - 3), fill=(200, 214, 180, 255))
# Eckakroterien (kleine Urnen)
for ex in (66, 184):
    cd.rectangle((ex - 3, EY0 - 4, ex + 3, EY0), fill=C('mi'), outline=C('ol'))
    cd.ellipse((ex - 3, EY0 - 10, ex + 3, EY0 - 4), fill=C('mi'), outline=C('ol'))
    cd.point((ex - 1, EY0 - 8), fill=C('hl'))
# Stufen / Bühne
for i, (x0, x1, y0, y1) in enumerate([(66, 184, 199, 203), (58, 192, 203, 208), (50, 200, 208, 213)]):
    cd.rectangle((x0, y0, x1, y1), fill=C('mi'), outline=C('ol'))
    cd.line((x0 + 1, y0 + 1, x1 - 1, y0 + 1), fill=C('li'))
    cd.line((x0 + 1, y1 - 1, x1 - 1, y1 - 1), fill=C('da'))
    for x in range(x0 + 5 + i * 3, x1 - 2, 13):
        cd.line((x, y0 + 2, x, y1 - 1), fill=C('de'))
im.alpha_composite(cr)
# Licht aus der Tür auf Stufen
stm = (yy >= 196) & (yy <= 214)
im = add_light(im, dcx, 205, 34, (70, 20, 60), 0.9, sy=0.45, mask=stm)
im.save(os.path.join(TMP, 'p10_c.png'))
print('crypt ok')

# =====================================================================
# 5) Requisiten & Figuren-Helfer
# =====================================================================
GOLD = {'1': (255, 230, 120), '2': (236, 176, 64), '3': (176, 104, 40), 'k': (70, 34, 20)}
CHAR = {'1': (130, 104, 100), '2': (96, 72, 76), '3': (64, 44, 56), 'k': (255, 170, 40)}
FAR = {'1': (150, 130, 178), '2': (120, 100, 150), '3': (96, 80, 128), 'k': (40, 26, 60)}
MIDP = {'1': (222, 212, 196), '2': (190, 178, 166), '3': (136, 122, 136)}


def rows_img(rows, cmap, outl=(20, 11, 28)):
    h, w = len(rows), max(len(r) for r in rows)
    a = np.zeros((h, w, 4), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != '.':
                a[j, i, :3] = cmap[ch][:3]; a[j, i, 3] = 255
    img = Image.fromarray(a)
    return outline(pad(img, 1), outl + (255,)) if outl else img


def sword(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], ["s", "w", "s", "s", "s", "s", "s", "s", "S", "yyy", ".Y.", ".y."][::-1][::-1], hx, hy - 10)


def king_sword(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], [".w.", ".s.", ".s.", ".s.", ".s.", ".s.", ".S.", ".s.", "yry", ".Y.", ".y."], hx - 1, hy - 9)


def orb(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], [".mm.", "mwmM", "mmMM", ".MM."], hx - 1, hy - 4)


def staff(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], [".c.", "cwc", ".c.", ".P.", ".n.", ".n.", ".n.", ".n.", ".n.", ".n.", ".n.", ".n."], hx - 1, hy - 5)


def bow(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], ["nn.", "..n", "..n", "..n", "..n", "..n", "nn."], hx - 1, hy - 3)


def scythe(ctx, which):
    hx, hy = ctx['hands'][which]
    _stamp(ctx['G'], ["ssssss...", "S....sss.", ".......ss", "........n", "........n", ".......n.", ".......n.", ".......n.", "......n..", "......n..", "......n..", ".....n...", ".....n...", ".....n...", "....n...."], hx - 8, hy - 5)


def knight_helm(ctx):
    h = ctx['head']; G = ctx['G']
    if ctx['size'] == 'm':
        rows = ["..rrr..", ".xxxxx.", "xxxxxxx", "xEExEEx", "xXxXxXx", ".xXXXx."]
    else:
        rows = ["....rrr....", "..xxxxxxx..", ".xxxxxxxxx.", "xxxxxxxxxxx", "xXXXXXXXXXx", "xkEEkxkEEkx", "xxxxxxxxxxx", "xXxXxXxXxXx", ".xXxXxXxXx.", "..xxxxxxx.."]
    _stamp(G, rows, h['x'] + (h['w'] - len(rows[0])) // 2, h['y'] - 1)


def dark_hood(ctx):
    hood('x', 'X')(ctx)


def lute_extra(ctx):
    rx, top, rw, rh = ctx['ribs']
    _stamp(ctx['G'], [".........nN",
                      "........nN.",
                      ".......nN..",
                      "......nN...",
                      ".nnnnN.....",
                      "nynnnnn....",
                      "nnkknNn....",
                      "nnkkNNn....",
                      ".nnNNn.....",
                      "..NNN......"], rx - 3, top + 1)


def wings(size='m', col=((226, 218, 200), (170, 158, 160))):
    """Knochenflügel (gespreizt)."""
    if size == 'm':
        rows = ["1.........",
                "11........",
                "1.1.......",
                "1..11.....",
                "1....11...",
                "1.1....111",
                "1..1......",
                "1...1.....",
                ".1...1....",
                "..1..1....",
                "...1.1...."]
    img = rows_img(rows, {'1': col[0]})
    return img


def coffin_speaker():
    w, h = 20, 38
    m = np.zeros((h, w), bool)
    for y in range(h):
        if y < 10:
            hw = 6 + y * 0.4
        else:
            hw = 10 - (y - 10) * 0.12
        m[y, int(round(w / 2 - hw)):int(round(w / 2 + hw))] = True
    a = np.zeros((h, w, 4), np.uint8)
    wood = np.array((104, 60, 52)); wood2 = np.array((76, 42, 44)); wood3 = np.array((136, 84, 62))
    nzw = value_noise(w, h, 3, seed=7)
    for y in range(h):
        for x in range(w):
            if m[y, x]:
                c = wood if nzw[y, x] > 0.45 else wood2
                if (x + (y // 7)) % 5 == 0: c = wood2
                a[y, x, :3] = c; a[y, x, 3] = 255
    e = m & ~ndimage.binary_erosion(m)
    img = Image.fromarray(a)
    ia = np.array(img)
    ia[ndimage.binary_erosion(m) & ~ndimage.binary_erosion(m, iterations=2)] = tuple(wood3) + (255,)
    img = Image.fromarray(ia)
    d = ImageDraw.Draw(img)
    # Lautsprecher-Membranen
    for (cy_, r) in [(12, 5), (27, 6)]:
        d.ellipse((w // 2 - r, cy_ - r, w // 2 + r, cy_ + r), fill=(28, 20, 34), outline=(150, 140, 160))
        d.ellipse((w // 2 - r + 2, cy_ - r + 2, w // 2 + r - 2, cy_ + r - 2), fill=(52, 44, 64), outline=(90, 80, 110))
        d.point((w // 2, cy_), fill=(200, 190, 220)); d.point((w // 2 - 1, cy_ - 1), fill=(120, 110, 140))
    # Beschläge
    for (x, y) in [(4, 5), (15, 5), (3, 35), (16, 35)]:
        d.point((x, y), fill=(220, 190, 110))
    return outline(pad(img, 1), (20, 11, 28, 255))


def drumkit():
    img = Image.new('RGBA', (40, 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Becken
    d.line((4, 3, 4, 25), fill=(120, 110, 130)); d.line((0, 3, 9, 1), fill=(255, 214, 90)); d.line((0, 4, 9, 2), fill=(196, 140, 50))
    d.line((35, 6, 35, 25), fill=(120, 110, 130)); d.line((31, 6, 40, 7), fill=(255, 214, 90)); d.line((31, 7, 40, 8), fill=(196, 140, 50))
    # Toms
    for (x, y, w_) in [(9, 10, 9), (22, 11, 9)]:
        d.rectangle((x, y, x + w_, y + 5), fill=(170, 40, 80)); d.line((x, y, x + w_, y), fill=(240, 230, 220)); d.line((x, y + 5, x + w_, y + 5), fill=(120, 110, 130))
        d.line((x + 1, y + 1, x + 1, y + 4), fill=(230, 90, 130))
    # Bassdrum mit Schädel
    d.ellipse((10, 12, 30, 25), fill=(210, 204, 220), outline=(170, 40, 80))
    d.ellipse((11, 13, 29, 24), outline=(170, 40, 80))
    sk = ["..111..", ".11111.", "1kk1kk1", "1kk1kk1", ".11k11.", "..1k1.."]
    for j, r in enumerate(sk):
        for i, ch in enumerate(r):
            if ch != '.': img.putpixel((17 + i, 14 + j), (40, 26, 50, 255) if ch == 'k' else (250, 246, 236, 255))
    return outline(img, (20, 11, 28, 255))


def candle(h=4, col=(236, 226, 200)):
    img = Image.new('RGBA', (3, h + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.point((1, 0), fill=(255, 250, 200)); d.point((1, 1), fill=(255, 180, 60)); d.point((1, 2), fill=(40, 30, 30))
    d.rectangle((0, 3, 2, h + 3), fill=col); d.line((2, 3, 2, h + 3), fill=(170, 150, 150)); d.point((0, 3), fill=(255, 255, 240))
    return img


def tombstone(kind, w, h, seed=0):
    img = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    m = np.zeros((h, w), bool)
    Y, X = np.mgrid[0:h, 0:w]
    if kind == 'round':
        m |= (Y >= w / 2) | (np.hypot(X - (w - 1) / 2, Y - w / 2) <= w / 2)
    elif kind == 'cross':
        m |= (np.abs(X - (w - 1) / 2) <= w * 0.17) | ((Y >= h * 0.2) & (Y <= h * 0.2 + w * 0.3))
    else:
        m |= (Y >= np.abs(X - (w - 1) / 2) * 0.8)
    rs = np.random.RandomState(seed)
    nzs = value_noise(w, h, 3, seed=seed)
    a = np.zeros((h, w, 4), np.uint8)
    base = np.array((112, 104, 140)); lite = np.array((150, 142, 178)); dark = np.array((76, 68, 104))
    col = np.where((nzs > 0.6)[..., None], lite, np.where((nzs < 0.38)[..., None], dark, base))
    a[..., :3] = col; a[..., 3] = np.where(m, 255, 0)
    er = ndimage.binary_erosion(m)
    # Licht links, Schatten rechts
    lft = m & ~np.roll(m, 1, axis=1)
    rgt = m & ~np.roll(m, -1, axis=1)
    a[lft & er | (m & ~np.roll(m, 1, axis=0))] = (180, 174, 206, 255)
    a[rgt] = (60, 52, 86, 255)
    # Moos unten
    mo = m & (Y > h - 4) & (rs.rand(h, w) < 0.45)
    a[mo] = (70, 110, 76, 255)
    if kind == 'round' and w >= 9:
        # Inschrift-Striche
        for k_ in range(3):
            yy_ = int(w / 2) + 2 + k_ * 2
            if yy_ < h - 3:
                a[yy_, 3:w - 3] = (70, 62, 96, 255)
    img = Image.fromarray(a)
    return outline(pad(img, 1), (20, 11, 28, 255))


def lantern_spr():
    l = area('graveyard/lantern').crop((0, 0, 7, 10)); return l.crop(l.getbbox())


print('props ok')

# Girlanden: Knochen-Lichterketten zwischen Bäumen und Gruft
BULB = [(255, 90, 110), (255, 214, 72), (110, 230, 140), (100, 190, 255), (220, 120, 255)]
lant = lantern_spr()
def garland(p0, p1, sag, bulbs=True, lanterns=False, step=9, seed=0):
    global im
    d = ImageDraw.Draw(im)
    n = int(abs(p1[0] - p0[0]))
    pts = []
    for i in range(n + 1):
        t = i / n
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + sag * 4 * t * (1 - t)
        pts.append((int(round(x)), int(round(y))))
    for (x, y) in pts:
        d.point((x, y), fill=(24, 14, 30))
    items = pts[step // 2::step]
    for i, (x, y) in enumerate(items):
        if lanterns and i % 2 == 0:
            im = add_light(im, x, y + 6, 9, (60, 44, 16), 0.9)
            d = ImageDraw.Draw(im)
            im.alpha_composite(lant, (x - 3, y + 1))
            d = ImageDraw.Draw(im)
        elif bulbs and i % 2 == 1 or not lanterns:
            c = BULB[(i + seed) % len(BULB)]
            if i % 3 == 2:
                # kleiner Knochen
                d.line((x - 2, y + 1, x + 2, y + 1), fill=(236, 226, 200))
                d.point([(x - 3, y), (x - 3, y + 2), (x + 3, y), (x + 3, y + 2)], fill=(236, 226, 200))
                d.point([(x - 2, y + 2), (x + 2, y + 2)], fill=(150, 136, 140))
            else:
                im = add_light(im, x, y + 3, 5, tuple(v // 4 for v in c), 0.9)
                d = ImageDraw.Draw(im)
                d.point((x, y + 1), fill=(40, 30, 40))
                d.rectangle((x - 1, y + 2, x + 1, y + 4), fill=c)
                d.point((x - 1, y + 2), fill=(255, 255, 255))
                d.point((x + 1, y + 4), fill=tuple(int(v * 0.6) for v in c))
garland((7, 100), (63, 113), 12, lanterns=True, step=8)
garland((187, 113), (243, 100), 12, lanterns=True, step=8, seed=2)
garland((68, 136), (182, 136), 14, lanterns=False, step=8, seed=1)

# =====================================================================
# 6) Ferne Tänzer auf den Hügeln
# =====================================================================
POSES = [
    dict(la=(-150, -170), ra=(150, 170), ll=(-15, 0), rl=(15, 0)),
    dict(la=(-60, 20), ra=(160, 140), ll=(-30, 10), rl=(60, 10), lean=2),
    dict(la=(-100, -150), ra=(40, 100), ll=(-5, 30), rl=(20, 0), lean=-2),
    dict(la=(-40, -120), ra=(40, 120), ll=(-40, 20), rl=(40, -20)),
    dict(la=(-120, -160), ra=(60, 20), ll=(-20, -5), rl=(70, 30), lean=1),
    dict(la=(-80, -150), ra=(80, 20), ll=(-25, 10), rl=(25, -10)),
    dict(la=(-20, 40), ra=(140, 190), ll=(-10, 10), rl=(40, -40), lean=-1),
    dict(la=(-160, -130), ra=(-10, -60), ll=(10, 30), rl=(30, 0), lean=2),
]
far_pos = [(16, 194), (27, 196), (40, 193), (52, 197), (63, 195), (188, 198), (199, 196), (211, 199), (223, 197), (235, 199)]
for i, (x, y) in enumerate(far_pos):
    s_ = skeleton('s', POSES[(i * 3) % len(POSES)], pal=FAR, flip=i % 2 == 1)
    put(im, s_, x, y)
d = ImageDraw.Draw(im)
# Kerzen / Irrlichter bei den fernen Gräbern
for (x, y) in [(22, 195), (58, 196), (204, 198), (230, 198)]:
    im = add_light(im, x, y - 2, 7, (60, 40, 20), 0.8)
    d = ImageDraw.Draw(im)
    d.point((x, y - 1), fill=(255, 220, 120)); d.point((x, y), fill=(200, 190, 180))

# Bodennebel (gedithert, verrauscht)
def fog_band(im, y0, hh, col, st, seed, xmask=None):
    nf = value_noise(W, H, 12, seed=seed)
    nf = np.array(Image.fromarray((nf * 255).astype(np.uint8)).resize((W, H))).astype(float) / 255
    prof = np.clip(1 - np.abs(yy - y0) / hh, 0, 1)
    t = prof * (0.35 + nf) * st
    m = dither_mask(None, np.clip(t, 0, 0.75))
    if xmask is not None:
        m &= xmask
    return blend_mask(im, m, col)
im = fog_band(im, 196, 8, (92, 72, 124), 0.9, 61)
im = fog_band(im, 200, 5, (120, 100, 150), 0.6, 62)
im.save(os.path.join(TMP, 'p10_d.png'))

# =====================================================================
# 6b) Himmel-Deko: Flügelskelette, Fledermäuse, Seelen, Krähen
# =====================================================================
def bone_wing(span=14, seed=0):
    """Gefiederter Knochenflügel (rechter Flügel, Ansatz links unten)."""
    N_ = span + 8
    G = np.full((N_, N_ + 4), '.', dtype='<U1')
    ox, oy = 1, span // 2 + 2
    tip = (ox + span, 1)
    nf = 5
    heads, tails = [], []
    for k in range(nf + 1):
        t = k / nf
        bx = ox + (tip[0] - ox) * t; by = oy + (tip[1] - oy) * t
        L_ = span * (0.30 + 0.55 * math.sin(math.pi * (0.25 + 0.6 * t)))
        heads.append((bx, by)); tails.append((bx + L_ * 0.35, by + L_))
    mem = Image.new('L', (G.shape[1], G.shape[0]), 0)
    md = ImageDraw.Draw(mem)
    md.polygon(heads + tails[::-1], fill=1)
    for k in range(nf):
        md.polygon([heads[k], heads[k + 1], tails[k + 1], tails[k]], fill=2 + (k % 2))
    mm = np.array(mem)
    G[mm == 2] = '1'; G[mm == 3] = '2'; G[mm == 1] = '2'
    # Federenden gezackt
    for k in range(nf + 1):
        _bone(G, heads[k], tails[k], 1, '3', outl=False)
    _bone(G, (ox, oy), tip, 1, '1', outl=False)
    _bone(G, (ox, oy + 1), (tip[0] - 1, tip[1] + 1), 1, 'w', outl=False)
    cm = dict(PAL)
    a = np.zeros(G.shape + (4,), np.uint8)
    for ch, col in cm.items():
        m_ = G == ch; a[m_, :3] = col[:3]; a[m_, 3] = 255
    img = Image.fromarray(a)
    img = outline(img, (20, 11, 28, 255))
    return img.crop(img.getbbox())


def winged(size_span=14, pose=None, hat=None):
    body = skeleton('m', pose or dict(la=(-120, -160), ra=(120, 160), ll=(-10, 20), rl=(15, 30)), hat=hat)
    wr = bone_wing(size_span)
    wl = wr.transpose(Image.FLIP_LEFT_RIGHT)
    Wd = body.width + 2 * wr.width + 4
    out = Image.new('RGBA', (Wd, max(body.height, wr.height) + 4), (0, 0, 0, 0))
    bx = wr.width
    out.alpha_composite(wl, (bx - wl.width + body.width // 2 - 2, 2))
    out.alpha_composite(wr, (bx + body.width // 2 + 2, 2))
    out.alpha_composite(body, (bx, 0))
    return out.crop(out.getbbox())
w1 = winged(16, hat=party_hat('m', 'y'))
im = add_light(im, 46, 58, 20, (26, 20, 40), 0.8)
put(im, w1, 46, 78)
w2 = winged(12, pose=dict(la=(-100, -150), ra=(150, 170), ll=(-20, 10), rl=(20, 40)))
put(im, w2, 208, 66)
d = ImageDraw.Draw(im)
# Fledermäuse
def bat(x, y, c=(26, 14, 40)):
    d.point([(x, y), (x - 1, y - 1), (x + 1, y - 1), (x - 2, y), (x + 2, y), (x - 3, y - 1), (x + 3, y - 1), (x - 1, y + 1), (x + 1, y + 1)], fill=c)
    d.point((x, y - 1), fill=c)
for (x, y) in [(88, 38), (98, 30), (170, 34), (160, 140), (150, 26), (24, 112), (230, 120)]:
    bat(x, y)
for (x, y) in [(104, 70), (146, 62)]:
    bat(x, y, (40, 44, 50)); d.point([(x - 4, y - 2), (x + 4, y - 2), (x - 2, y - 1), (x + 2, y - 1)], fill=(40, 44, 50))
# Seelen (Area-Sprite, 1x)
soul = area('graveyard/soul')
souls = [soul.crop((i * 7, 0, i * 7 + 7, 11)) for i in range(4)]
for i, (x, y) in enumerate([(14, 160), (236, 150), (60, 176), (192, 178)]):
    s_ = souls[i % 4]
    im = add_light(im, x + 3, y + 5, 8, (30, 30, 40), 0.7)
    im.alpha_composite(s_, (x, y))
# Krähen auf den Bäumen
crow = area('graveyard/crow')
crows = [crow.crop((i * 10, 0, i * 10 + 10, 8)) for i in range(3)]
crows = [c.crop(c.getbbox()) for c in crows]
im.alpha_composite(crows[0], (18, 124))
im.alpha_composite(crows[2].transpose(Image.FLIP_LEFT_RIGHT), (224, 128))

# =====================================================================
# 7) Bühne: Band + König
# =====================================================================
# Lautsprecher-Särge
spk = coffin_speaker()
put(im, spk, 30, 226, shd=True)
put(im, spk.transpose(Image.FLIP_LEFT_RIGHT), 220, 226, shd=True)
# Schlagzeuger hinter dem Drumset
drummer = skeleton('m', dict(la=(-150, -110), ra=(150, 110), ll=(-20, 0), rl=(20, 0)), hat=cross_cap, item=bone_club(), item2=bone_club())
put(im, drummer, 88, 196)
put(im, drumkit(), 88, 202)
# Barde mit Laute in der Tür
bardS = skeleton('m', dict(la=(-40, 60), ra=(40, -50), ll=(-25, 10), rl=(15, 0), lean=1), hat=top_hat, extra=lute_extra)
put(im, bardS, CX, 200, shd=True)
# Magier rechts mit Orb
mageS = skeleton('m', dict(la=(-60, -20), ra=(150, 170), ll=(-10, 0), rl=(30, 10), lean=-1), hat=hood('p', 'P'), item2=orb)
put(im, mageS, 162, 200, shd=True)
im = add_light(im, 168, 170, 12, (70, 30, 80), 1.0)
# Musiknoten (Farben wie auf "Skeleton Bard")
NOTE1 = ["..AA", "..AB", "..A.", "..A.", "AAA.", "AAA."]
NOTE2 = ["AAAAA", "A...A", "A...A", "A..AA", "AA.AA", "AA..."]
for (x, y, col, kind) in [(106, 166, (230, 214, 60), 0), (144, 160, (110, 220, 90), 1), (100, 150, (190, 90, 230), 1), (150, 176, (240, 80, 80), 0), (62, 176, (230, 214, 60), 0), (196, 168, (190, 90, 230), 0)]:
    rows = NOTE1 if kind == 0 else NOTE2
    nimg = rows_img(rows, {'A': col, 'B': tuple(int(v * 0.7) for v in col)})
    im.alpha_composite(nimg, (x, y))
# König auf der Giebelspitze
kingS = skeleton('m', dict(la=(-60, -10), ra=(160, 175), ll=(-15, 0), rl=(15, 0)), hat=crown, item2=king_sword)
put(im, kingS, CX, PY - 4)
im.save(os.path.join(TMP, 'p10_e.png'))
print('stage ok')

# Discokugel am mittleren Girlanden-Tiefpunkt
def disco(R=5):
    Y_, X_ = np.mgrid[-R:R + 1, -R:R + 1]
    ins = X_ ** 2 + Y_ ** 2 <= R * R + 1
    sh = np.clip(1 - np.hypot(X_ + 2, Y_ + 2) / (R * 2.0), 0, 1)
    chk = ((X_ + R) // 2 + (Y_ + R) // 2) % 2
    tone_ = np.digitize(sh + chk * 0.12, [0.2, 0.42, 0.62, 0.8])
    PALd = np.array([(60, 50, 90, 255), (110, 100, 150, 255), (170, 164, 210, 255), (220, 216, 245, 255), (255, 255, 255, 255)])
    b = np.zeros(ins.shape + (4,), np.uint8)
    b[ins] = PALd[tone_][ins]
    return outline(Image.fromarray(b), (20, 11, 28, 255))
db = disco(5)
d = ImageDraw.Draw(im)
d.line((CX, 143, CX, 146), fill=(24, 14, 30))
put(im, db, CX, 159)
d = ImageDraw.Draw(im)
sparkle(d, CX - 3, 150, 3, (255, 255, 255))
sparkle(d, CX + 4, 155, 2, (200, 240, 255))

# =====================================================================
# 8) Tanzfläche: Licht-Pools
# =====================================================================
for (x, y, c, r) in [(125, 240, (60, 16, 60), 40), (70, 262, (10, 50, 60), 30), (182, 262, (60, 40, 10), 30)]:
    im = add_light(im, x, y, r, c, 0.9, sy=0.4, mask=gnd)
# Disco-Punkte auf dem Boden
d = ImageDraw.Draw(im)
r4 = random.Random(5)
DOTS = [(255, 120, 220), (120, 230, 255), (220, 255, 140), (255, 230, 120)]
for _ in range(40):
    x = r4.randrange(60, 190); y = r4.randrange(218, 272)
    d.line((x, y, x + 1, y), fill=r4.choice(DOTS))

# =====================================================================
# 9) Menge (mittlere Reihen)
# =====================================================================
gt = area('graveyard/tile')
def tile_stone(box, seed=0):
    c = gt.crop(box)
    a = np.array(c).astype(int)
    pink = (a[..., 0] > a[..., 1] + 25) & (a[..., 0] > 110)
    m = ndimage.binary_closing(pink, iterations=1)
    m = ndimage.binary_fill_holes(m)
    ol = ndimage.binary_dilation(m) & ~m
    out = np.zeros_like(a)
    L = a[..., :3].mean(2)
    t = np.clip((L - 60) / 120, 0, 1)
    stone = np.stack([80 + t * 110, 72 + t * 106, 110 + t * 110], -1)
    green = (a[..., 1] > a[..., 0] + 5)
    stone[green] = (76, 116, 80)
    out[..., :3] = np.where(m[..., None], stone, (20, 11, 28))
    out[..., 3] = np.where(m | ol, 255, 0)
    s_ = Image.fromarray(out.clip(0, 255).astype(np.uint8))
    return s_.crop(s_.getbbox())
STONES = [tile_stone(b) for b in [(34, 4, 48, 22), (71, 4, 82, 25), (48, 30, 65, 49), (72, 51, 89, 71), (92, 69, 111, 95), (7, 75, 26, 96), (52, 74, 65, 98)]]

crowd = []  # (y, x, sprite)
def add(spr, x, y):
    crowd.append((y, x, spr))

hats = [party_hat('m', 'y'), party_hat('b', 'w'), party_hat('g', 'r'), None, party_hat('p', 'y')]
row1 = [(52, 234, 0, hats[0], goblet()), (74, 236, 1, hood('g', 'G'), bow), (98, 233, 4, halo, None),
        (152, 233, 5, hats[1], bottle()), (175, 236, 2, cross_cap, None), (197, 234, 7, hats[4], maraca())]
for i, (x, y, pi, hat, it) in enumerate(row1):
    add(skeleton('m', POSES[pi], hat=hat, item=it, pal=MIDP, flip=i % 2 == 0), x, y)
# Heiler-Sprite aus der Knochenmühle (1x) + Skeletthund
hs = area('bonegrinder/healer')
healer_fr = [hs.crop((i * 21, 0, i * 21 + 21, 32)) for i in range(3)]
healer_fr = [f.crop(f.getbbox()) for f in healer_fr]
add(healer_fr[2], 118, 240)
dog = area('bonegrinder/dog').crop((0, 0, 25, 17)); dog = dog.crop(dog.getbbox())
add(dog, 136, 244)
# Reihe 2
burning = skeleton('m', POSES[0], hat=flame_head, pal=CHAR)
row2 = [(14, 262, 3, hats[2], goblet()), (40, 264, 6, dark_hood, scythe), (66, 261, None, None, None),
        (184, 261, 1, knight_helm, 'dk'), (208, 264, 4, hats[0], bone_club()), (234, 262, 5, hood('p', 'P'), None)]
for i, (x, y, pi, hat, it) in enumerate(row2):
    if pi is None:
        add(burning, x, y); continue
    if it == 'dk':
        add(skeleton('m', POSES[pi], hat=hat, under=robe('x', 'X', trim='r'), item=king_sword, flip=True), x, y); continue
    add(skeleton('m', POSES[pi], hat=hat, item=it, flip=i % 2 == 1), x, y)
# Schatz-Skelett (gold)
add(skeleton('m', POSES[7], pal=GOLD, eyes='e', hat=crown), 160, 266)
# Grabsteine zwischen den Tänzern
for (x, y, k) in [(8, 240, 0), (116, 262, 2), (224, 242, 3), (92, 266, 5), (246, 272, 1)]:
    add(STONES[k], x, y)

crowd.sort(key=lambda t: t[0])
for (y, x, spr) in crowd:
    put(im, spr, x, y, shd=True)
# Flammen-Sprite (Knochenmühle) auf dem brennenden Skelett + Funken
fl = area('bonegrinder/flame')
flames = [fl.crop((i * 5, 0, i * 5 + 5, 8)) for i in range(4)]
bx_, by_ = 66, 261 - burning.height
im = add_light(im, 66, 244, 18, (70, 36, 0), 1.0)
im.alpha_composite(up(flames[1], 1), (bx_ - 5, by_ - 5))
im.alpha_composite(flames[2], (bx_ - 1, by_ - 7))
im.alpha_composite(flames[3], (bx_ + 2, by_ - 4))
d = ImageDraw.Draw(im)
for (x, y) in [(60, 226), (72, 222), (64, 218), (70, 230), (58, 216)]:
    d.point((x, y), fill=(255, 200, 80))
im.save(os.path.join(TMP, 'p10_f.png'))
print('crowd ok')

# =====================================================================
# 10) Vordergrund
# =====================================================================
fg = []
def addf(spr, x, y):
    fg.append((y, x, spr))

# offenes Grab in der Mitte
GX0, GX1, GYT, GYB = 100, 150, 298, 324
gm = (yy >= GYT) & (yy <= GYB) & (xx >= GX0 - (yy - GYT) * 0.15) & (xx <= GX1 + (yy - GYT) * 0.15)
a = np.array(im)
a[gm] = (10, 4, 16, 255)
# hintere Innenwand: Erde mit Verlauf nach unten dunkler, Wurzeln, Steine
wall = gm & (yy < GYT + 12)
wt = value_noise(W, H, 3, seed=77)
tw = np.clip((yy - GYT) / 12, 0, 1)
wc = np.stack([86 - 60 * tw, 56 - 44 * tw, 66 - 44 * tw], -1)
wc = wc * (0.85 + 0.3 * (wt[..., None] > 0.55))
m2 = wall & dither_mask(None, 1 - tw * 0.9)
a[m2, :3] = wc[m2].clip(0, 255).astype(np.uint8)
ge = ndimage.binary_dilation(gm) & ~gm
a[ge] = (20, 11, 28, 255)
lip = ndimage.binary_dilation(gm, iterations=2) & ~ndimage.binary_dilation(gm) & (yy <= GYT)
a[lip] = (118, 84, 92, 255)
side = ndimage.binary_dilation(gm, iterations=2) & ~ndimage.binary_dilation(gm) & (yy > GYT) & (yy < GYB)
a[side] = (88, 60, 72, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
for (x, y) in [(104, 301), (118, 300), (141, 302), (129, 303)]:
    d.line((x, y, x + 1, y + 3), fill=(130, 90, 66)); d.point((x + 2, y + 4), fill=(130, 90, 66)); d.point((x, y + 5), fill=(100, 70, 56))
for (x, y) in [(110, 304), (136, 306), (146, 301)]:
    d.point((x, y), fill=(170, 150, 170)); d.point((x + 1, y), fill=(120, 100, 130))
# Erdhügel rechts vom Grab
mound = (np.hypot((xx - 170) / 20.0, (yy - 312) / 9.0) <= 1) & (yy <= 318)
mt = value_noise(W, H, 3, seed=78)
a = np.array(im)
mcol = np.where((mt > 0.55)[..., None], (112, 74, 70), np.where((mt < 0.4)[..., None], (66, 40, 48), (88, 56, 60)))
a[mound, :3] = mcol[mound]
me = ndimage.binary_dilation(mound) & ~mound & (yy < 318)
a[me] = (20, 11, 28, 255)
top_m = mound & ~np.roll(mound, 1, axis=0)
a[top_m] = (140, 100, 90, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Schaufel im Hügel
d.line((176, 286, 172, 306), fill=(120, 80, 50)); d.line((177, 286, 173, 306), fill=(90, 56, 40))
d.rectangle((174, 283, 179, 285), fill=(120, 80, 50))
d.polygon([(169, 305), (175, 305), (174, 312), (170, 312)], fill=(150, 150, 170), outline=(20, 11, 28))
d.line((170, 306, 170, 310), fill=(210, 210, 230))
# Sargdeckel links am Grab lehnend
lid = Image.new('RGBA', (16, 30), (0, 0, 0, 0))
ld = ImageDraw.Draw(lid)
ld.polygon([(4, 0), (11, 0), (15, 7), (13, 29), (2, 29), (0, 7)], fill=(96, 56, 50), outline=(20, 11, 28))
ld.line((7, 5, 7, 20), fill=(210, 190, 120)); ld.line((4, 9, 10, 9), fill=(210, 190, 120))
ld.line((2, 8, 3, 27), fill=(130, 84, 64)); ld.line((13, 8, 12, 27), fill=(66, 36, 38))
lid = lid.rotate(18, expand=True, resample=Image.NEAREST)
put(im, lid, 90, 316)

# Skelett steigt aus dem Grab (nur Oberkörper)
riser = skeleton('l', dict(la=(-150, -175), ra=(80, 150), ll=(0, 0), rl=(0, 0), lean=2), hat=party_hat('m', 'y'), item=goblet('l'), jaw=1)
riser = riser.crop((0, 0, riser.width, int(riser.height * 0.60)))
put(im, riser, 124, 321)
# vordere Grabkante über dem Riser
a = np.array(im)
front = (yy >= 321) & gm
a[front] = (10, 4, 16, 255)
fl = (yy >= GYB + 1) & (yy <= GYB + 2) & (xx >= GX0 - 6) & (xx <= GX1 + 6)
a[fl] = (118, 84, 92, 255)
a[(yy == GYB + 3) & (xx >= GX0 - 6) & (xx <= GX1 + 6)] = (60, 36, 50, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Erdklumpen auf der Kante
for x in range(GX0 - 4, GX1 + 6, 5):
    d.point((x, GYB + 1), fill=(150, 110, 110)); d.point((x + 2, GYB + 2), fill=(86, 56, 66))

# große Grabsteine mit Kerzen in den unteren Ecken
bigL = tombstone('round', 26, 34, seed=3)
bigR = tombstone('pointed', 24, 38, seed=5)
crossS = tombstone('cross', 16, 26, seed=6)
addf(bigL, 16, 346)
addf(bigR, 238, 346)
addf(crossS, 196, 300)
addf(STONES[4], 64, 304)
# große Tänzer
bigA = skeleton('l', dict(la=(-140, -170), ra=(70, 20), ll=(-20, 0), rl=(50, 5), lean=2), hat=party_hat('r', 'w'), item=goblet('l'), jaw=1)
addf(bigA, 50, 344)
bigB = skeleton('l', dict(la=(-60, -140), ra=(150, 120), ll=(-40, -10), rl=(15, 0), lean=-2), hat=party_hat('c', 'm'), item2=bottle('l'), flip=True)
addf(bigB, 206, 344)
# Sensenmann (Robe)
reap = skeleton('m', dict(la=(-40, -150), ra=(40, 100), ll=(-5, 0), rl=(5, 0)), hat=hood('x', 'X'), item=scythe, under=robe('x', 'X'))
addf(reap, 30, 296)
fg.sort(key=lambda t: t[0])
for (y, x, spr) in fg:
    put(im, spr, x, y, shd=True)

# Schatztruhe
chest = Image.new('RGBA', (22, 16), (0, 0, 0, 0))
cdd = ImageDraw.Draw(chest)
cdd.rectangle((1, 6, 20, 15), fill=(120, 70, 40), outline=(20, 11, 28))
cdd.line((2, 7, 19, 7), fill=(160, 100, 56)); cdd.line((2, 11, 19, 11), fill=(90, 50, 32))
cdd.rectangle((2, 1, 19, 5), fill=(255, 214, 72))
for x in range(3, 19, 2): cdd.point((x, 2), fill=(255, 250, 180)); cdd.point((x + 1, 4), fill=(196, 128, 40))
cdd.line((1, 0, 20, 0), fill=(20, 11, 28)); cdd.line((1, 0, 1, 6), fill=(20, 11, 28)); cdd.line((20, 0, 20, 6), fill=(20, 11, 28))
for x in (5, 16): cdd.line((x, 6, x, 15), fill=(200, 160, 80))
cdd.rectangle((9, 8, 12, 11), fill=(255, 214, 72), outline=(20, 11, 28))
chest = outline(chest, (20, 11, 28, 255))
im = add_light(im, 160, 334, 16, (60, 44, 0), 1.0)
put(im, chest, 160, 344)
d = ImageDraw.Draw(im)
for (x, y) in [(147, 341), (150, 342), (172, 340), (175, 342), (153, 339)]:
    d.rectangle((x, y, x + 1, y), fill=(255, 214, 72)); d.point((x, y + 1), fill=(196, 128, 40))
for (x, y, s_) in [(156, 322, 3), (168, 326, 2), (148, 330, 2)]:
    sparkle(d, x, y, s_, (255, 230, 120))

# Kerzen-Gruppen mit Lichtschein
for (x, y, n) in [(8, 312, 3), (12, 346 - 36, 0), (92, 300, 2), (190, 272, 2), (240, 306, 3), (136, 344, 2)]:
    if n == 0:
        continue
    im = add_light(im, x + n, y - 5, 12, (70, 50, 20), 1.0)
    for k in range(n):
        c = candle(3 + (k * 2) % 4)
        put(im, c, x + k * 3, y)
im.save(os.path.join(TMP, 'p10_g.png'))
print('fg ok')

# =====================================================================
# 11) Rahmen mit Totenkopf-Ecken
# =====================================================================
bevel_frame(im, (14, 6, 20), (200, 150, 255), (100, 50, 150), (56, 24, 84), (14, 6, 20), width=6)
d = ImageDraw.Draw(im)
cs = ["..111..", ".11111.", "1kk1kk1", "1kk1kk1", ".11k11.", "..1k1.."]
for (x0, y0) in [(0, 0), (W - 7, 0), (0, H - 6), (W - 7, H - 6)]:
    for j, r in enumerate(cs):
        for i, ch in enumerate(r):
            if ch != '.':
                d.point((x0 + i, y0 + j), fill=(40, 20, 50) if ch == 'k' else (240, 232, 206))
print(save(im, '10_skelett_party'))
