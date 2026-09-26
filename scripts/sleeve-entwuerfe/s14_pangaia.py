# -*- coding: utf-8 -*-
"""14 Pangaia – die Dino-Insel aus der Vogelperspektive.

Das Area-Motiv (public/areas/pangaia/island.png, 260x100) ist das Herzstück: Vulkan mit Lavasee und
Lavastrom, Fluss, See, Lichtungen. Nach Norden und Süden wird es im selben Stil zu einer ganzen Insel
weitergemalt (Baumkronen aus Blattballen, Licht oben rechts, Strand, Flachwasser, Brandung, Bucht).
Darüber: Rauchfahne des Vulkans, Wolken mit Schatten, Flugsaurier (Spiel-Sprites, 1x)."""
from lib import *

PG = 'pangaia/'
YY, XX = np.mgrid[0:H, 0:W]
DBG = os.environ.get('PP_DBG')


def dbg(arr, name, k=3):
    if DBG:
        im_ = arr if isinstance(arr, Image.Image) else Image.fromarray(arr)
        up(im_.convert('RGBA'), k).save(os.path.join(TMP, name + '.png'))


def sdf(mask):
    """< 0 innen, > 0 außen (Pixelabstand)."""
    return ndimage.distance_transform_edt(~mask) - ndimage.distance_transform_edt(mask)


def blend(img, mask, col, alpha):
    """img: HxWx3 uint8; col RGB; alpha 0..1 (Skalar oder Array)."""
    a = np.broadcast_to(np.asarray(alpha, float), mask.shape)
    f = img[mask].astype(float)
    img[mask] = np.clip(f * (1 - a[mask, None]) + np.array(col[:3], float) * a[mask, None] + 0.5, 0, 255).astype(np.uint8)


def comp_sprite(img, spr, x, y, alpha_scale=1.0):
    """RGBA-Sprite (PIL oder Array) mit seiner Alpha auf img (HxWx3) legen."""
    s = np.array(spr).astype(float)
    h, w = s.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    sub = s[y0 - y:y1 - y, x0 - x:x1 - x]
    a = sub[..., 3:4] / 255 * alpha_scale
    dst = img[y0:y1, x0:x1].astype(float)
    img[y0:y1, x0:x1] = np.clip(dst * (1 - a) + sub[..., :3] * a + 0.5, 0, 255).astype(np.uint8)


def frames(name, n):
    s = area(PG + name)
    fw = s.width // n
    return [s.crop((i * fw, 0, i * fw + fw, s.height)) for i in range(n)]


# ------------------------------------------------------------------ Paletten (aus island.png / sea.png)
SEA = [(11, 40, 112), (15, 49, 134), (18, 58, 150), (21, 65, 162), (25, 73, 174), (30, 83, 186)]
SEA_HI = [(27, 83, 207), (32, 93, 223), (38, 106, 238)]
SHALLOW = [(72, 176, 204), (52, 156, 200), (42, 138, 198), (36, 120, 192), (31, 102, 182), (27, 86, 170)]
SAND = [(132, 123, 90), (192, 168, 110), (210, 188, 132)]
GREEN = [(8, 22, 10), (15, 42, 14), (23, 62, 18), (33, 84, 22), (46, 106, 28), (62, 130, 34), (82, 152, 42), (106, 174, 52), (132, 192, 64)]
OLIVE = [(20, 24, 6), (34, 42, 10), (52, 64, 14), (72, 86, 20), (94, 108, 26), (118, 132, 34), (142, 154, 46), (168, 178, 62)]
TEAL = [(6, 22, 16), (11, 38, 24), (18, 56, 34), (26, 76, 44), (36, 96, 54), (48, 116, 66), (62, 136, 78), (80, 160, 90)]
GRASS = [(57, 92, 29), (68, 103, 34), (72, 118, 28), (88, 138, 34), (106, 156, 42), (126, 174, 52)]
SOIL = [(51, 40, 28), (58, 40, 20), (78, 54, 32), (100, 70, 40)]
ROCK = [(23, 20, 22), (33, 29, 30), (44, 38, 40), (56, 49, 50), (69, 60, 59), (83, 72, 69), (98, 86, 79), (114, 101, 91), (132, 123, 110)]


# ------------------------------------------------------------------ Dschungel-Generator (Kronen wie im Spiel)
def canopy(mask, seed, spec_field=None, rmin=3.0, rmax=4.8):
    """Baumkronen aus Blattballen, Licht oben rechts, Schlagschatten aus Höhenpuffer.
    Farbverteilung je Baumart per Rang-Abbildung auf die Häufigkeiten in island.png."""
    h, w = mask.shape
    r = random.Random(seed); rs_ = np.random.RandomState(seed)
    Hh = np.full((h, w), -1.0); tone = np.zeros((h, w)); sp = np.zeros((h, w), int)
    bid = np.full((h, w), -1)
    tcy = np.full((h, w), -99.0)
    yy, xx = np.mgrid[0:h, 0:w]
    pts, grid, G = [], {}, 6
    cand = np.argwhere(ndimage.binary_dilation(mask, iterations=1))
    for i in rs_.permutation(len(cand)):
        y, x = cand[i]
        rad = r.uniform(rmin, rmax)
        gx, gy = x // G, y // G
        ok = True
        for ax in range(gx - 2, gx + 3):
            for ay in range(gy - 2, gy + 3):
                for (px, py, pr) in grid.get((ax, ay), ()):
                    if (px - x) ** 2 + (py - y) ** 2 < (0.7 * (pr + rad)) ** 2:
                        ok = False; break
                if not ok: break
            if not ok: break
        if ok:
            pts.append((x, y, rad)); grid.setdefault((gx, gy), []).append((x, y, rad))
    L = np.array([0.7, -0.62, 0.38]); L /= np.linalg.norm(L)
    k = 0
    for (x, y, rad) in pts:
        s = spec_field(x, y, r) if spec_field is not None else r.choices([0, 1, 2], [0.62, 0.16, 0.22])[0]
        base = r.uniform(0, 2.5)
        blobs = [(x + r.uniform(-0.2, 0.2), y + r.uniform(-0.2, 0.2), rad * r.uniform(0.7, 0.82))]
        for j in range(r.randint(3, 5)):
            a = r.uniform(0, 2 * math.pi); dd = rad * r.uniform(0.3, 0.45)
            blobs.append((x + math.cos(a) * dd, y + math.sin(a) * dd, rad * r.uniform(0.5, 0.62)))
        for (bx, by, br) in blobs:
            x0, x1 = max(0, int(bx - br - 1)), min(w, int(bx + br + 2))
            y0, y1 = max(0, int(by - br - 1)), min(h, int(by + br + 2))
            if x0 >= x1 or y0 >= y1: continue
            sy, sx = yy[y0:y1, x0:x1], xx[y0:y1, x0:x1]
            nx = (sx + 0.5 - bx) / br; ny = (sy + 0.5 - by) / br
            q = nx * nx + ny * ny
            nzv = np.sqrt(np.clip(1 - q, 0, 1))
            hh = base + rad * 0.9 + nzv * br * 0.8
            lum = nx * L[0] + ny * L[1] + nzv * L[2]
            cur = Hh[y0:y1, x0:x1]
            upd = (q < 1) & (hh > cur)
            cur[upd] = hh[upd]
            tone[y0:y1, x0:x1][upd] = lum[upd]
            sp[y0:y1, x0:x1][upd] = s
            bid[y0:y1, x0:x1][upd] = k
            tcy[y0:y1, x0:x1][upd] = y
            k += 1
    crown = Hh >= 0
    shadow = np.zeros((h, w))
    for d in range(1, 7):
        sh = np.full((h, w), -1.0)
        sh[d:, :w - d] = Hh[:h - d, d:]
        shadow = np.maximum(shadow, np.clip((sh - Hh - d * 0.55) / 1.5, 0, 1))
    t = tone * 0.5 + 0.5 - shadow * 0.45
    edge = np.zeros((h, w), bool)
    for (dy, dx) in [(1, 0), (0, -1), (1, -1)]:
        nb = np.roll(np.roll(bid, -dy, 0), -dx, 1)
        nh = np.roll(np.roll(Hh, -dy, 0), -dx, 1)
        edge |= (nb != bid) & (nh < Hh - 0.3)
    t = t - edge * 0.12 + (rs_.rand(h, w) - 0.5) * 0.12
    out = np.zeros((h, w, 3), np.uint8)
    PALS = [GREEN, OLIVE, TEAL]
    TGT = [[1418, 1133, 612, 526, 575, 520, 540, 351, 308], [279, 249, 180, 117, 128, 153, 108, 80],
           [285, 239, 131, 116, 116, 106, 103, 108]]
    for s, P in enumerate(PALS):
        m = crown & (sp == s)
        if not m.any(): continue
        vals = t[m]
        rk = np.argsort(np.argsort(vals)) / max(1, len(vals) - 1)
        cum = np.cumsum(TGT[s]) / np.sum(TGT[s])
        out[m] = np.array(P)[np.searchsorted(cum, rk, side='left').clip(0, len(P) - 1)]
    FW = np.array([1001, 1575, 179, 204, 133.0]); FW /= FW.sum()
    FL = np.array([(4, 10, 4), (5, 12, 11), (5, 14, 11), (7, 18, 13), (5, 13, 5)])
    fl = FL[rs_.choice(len(FL), (h, w), p=FW)]
    out[~crown] = fl[~crown]
    return out, crown, Hh, tcy


# ------------------------------------------------------------------ Area-Band laden
BX, BY, BH = -5, 118, 100
isl = np.array(area(PG + 'island')).astype(int)
mwat = np.array(area(PG + 'mask-water'))[..., 3] > 0
btr = isl[..., 3] == 0
bland = ~mwat & ~btr
dtr = ndimage.distance_transform_edt(~btr)
bouter = btr | (mwat & (dtr <= 14))      # Außenwasser -> wird neu gerendert
binner = mwat & ~bouter                  # Fluss + See bleiben original


def to_canvas(arr, fill=0):
    out = np.full((H, W) + arr.shape[2:], fill, arr.dtype)
    xs0 = max(0, BX); xs1 = min(W, BX + arr.shape[1])
    out[BY:BY + BH, xs0:xs1] = arr[:, xs0 - BX:xs1 - BX]
    return out


def bc(x, y):
    """Insel-Koordinate -> Leinwand."""
    return x + BX, y + BY


BAND = np.zeros((H, W), bool); BAND[BY:BY + BH] = True
B_RGB = to_canvas(isl[..., :3].astype(np.uint8))
B_LAND = to_canvas(bland, False)
B_INNER = to_canvas(binner, False)

# ------------------------------------------------------------------ Landmaske
nz_lo = value_noise(W, H, 22, seed=41, octaves=2) - 0.5
nz_mid = value_noise(W, H, 7, seed=42, octaves=2) - 0.5


def ell(cx, cy, rx, ry):
    return (np.hypot((XX - cx) / rx, (YY - cy) / ry) - 1) * min(rx, ry)


def row_sd(row_land):
    s = sdf(np.tile(row_land[None, :], (3, 1)))[1]
    return np.tile(s[None, :], (H, 1))


# Nordkappe (Bandzeile 0: Land x 52..229)
north = ell(140, BY + 4, 92, 68)
north = np.minimum(north, ell(96, BY - 26, 44, 30))          # Landzunge nach Nordwest
north = np.maximum(north, -ell(208, BY - 40, 15, 11))        # kleine Bucht im Nordosten
north = north + nz_lo * 10 + nz_mid * 2.5
# Süden (Bandzeile 99: Land 20..98 und 153..227): zwei Landarme um die Bucht
south_l = ell(58, BY + BH - 8, 42, 66) + nz_lo * 9 + nz_mid * 2.5
south_r = ell(194, BY + BH - 14, 36, 92) + nz_lo * 8 + nz_mid * 2.5
south_r = np.minimum(south_r, ell(178, BY + BH + 66, 20, 14) + nz_mid * 2)
south = np.minimum(south_l, south_r)

T = 18
tN = np.clip((BY - YY) / T, 0, 1)
tS = np.clip((YY - (BY + BH - 1)) / T, 0, 1)
sdN = row_sd(B_LAND[BY]) * (1 - tN) + north * tN
sdS = row_sd(B_LAND[BY + BH - 1]) * (1 - tS) + south * tS
LAND = np.where(YY < BY, sdN < 0, np.where(YY >= BY + BH, sdS < 0, B_LAND))
lab, n = ndimage.label(LAND)
sizes = ndimage.sum(LAND, lab, range(1, n + 1))
LAND = np.isin(lab, np.where(sizes > 30)[0] + 1)
LAND |= ndimage.binary_fill_holes(LAND) & ~LAND & ~B_INNER & ~BAND
# 1-Pixel-Zacken glätten (nur neues Land)
for _ in range(2):
    nb = ndimage.convolve(LAND.astype(int), np.ones((3, 3), int), mode='constant') - LAND
    LAND = np.where(BAND, LAND, np.where(LAND, nb >= 2, nb >= 6))
EXT = LAND & ~BAND

# ------------------------------------------------------------------ Meer
rs = np.random.RandomState(14)
dland = ndimage.distance_transform_edt(~LAND)
v = rs.rand(H, W) * 0.62 + value_noise(W, H, 9, seed=5, octaves=3) * 0.55 - 0.08
v -= np.clip((dland - 30) / 140, 0, 0.18)
img = np.array(SEA, np.uint8)[np.clip((v * 6.2).astype(int) - 1, 0, 5)]
for _ in range(240):
    x, y = rs.randint(0, W - 3), rs.randint(0, H)
    img[y, x:x + rs.choice([1, 2, 2, 3])] = SEA_HI[rs.choice([0, 0, 1, 1, 2])]

WATER = ~LAND & ~B_INNER
dn = (dland + (rs.rand(H, W) - 0.5) * 1.3 + nz_mid * 1.2) * np.clip(0.75 + nz_lo * 1.2, 0.55, 1.15)
for k, c in enumerate(SHALLOW):
    m = WATER & (dn < k + 1.5) & ((dn >= k + 0.5) if k else True)
    img[m] = c
img[WATER & (dland < 1.5) & (rs.rand(H, W) < 0.45)] = SHALLOW[1]

# Felsinselchen + Riff aus der Hochsee-Kachel (je einmal)
seat = np.array(area(PG + 'sea')).astype(int)
seacols = {tuple(c) for c in SEA + SEA_HI}
for (box, pos) in [((78, 10, 110, 32), (196, 22)), ((26, 68, 46, 86), (14, 300))]:
    x0, y0, x1, y1 = box
    sub = seat[y0:y1, x0:x1]
    m = np.array([[tuple(p[:3]) not in seacols for p in row] for row in sub])
    m = ndimage.binary_fill_holes(m)
    px, py = pos
    tgt = img[py:py + y1 - y0, px:px + x1 - x0]
    tgt[m] = sub[..., :3][m]

# ------------------------------------------------------------------ Band einsetzen
keep = (B_LAND | B_INNER) & BAND
img[keep] = B_RGB[keep]

# ------------------------------------------------------------------ neues Land: Strand, Lichtungen, Dschungel
din = ndimage.distance_transform_edt(LAND)
sandw = 1.2 + np.clip(nz_lo * 5 + 0.6, 0, 2.2) + (rs.rand(H, W) - 0.5) * 0.7
SANDM = EXT & (din <= sandw)

# Lichtungen (Form + Gras + Erde + Pfad)
CLR = np.zeros((H, W), bool)
for (cx, cy, rx, ry, sd_) in [(112, 86, 17, 10, 3), (52, 246, 20, 13, 4), (196, 262, 13, 17, 5)]:
    e = ell(cx, cy, rx, ry) + (value_noise(W, H, 5, seed=sd_, octaves=2) - 0.5) * 7
    CLR |= (e < 0) & EXT & (din > 4)
spec_noise = value_noise(W, H, 14, seed=77, octaves=2)


def species(x, y, r):
    v_ = spec_noise[min(H - 1, max(0, y)), min(W - 1, max(0, x))]
    if v_ > 0.64:
        return r.choices([0, 1, 2], [0.35, 0.1, 0.55])[0]
    if v_ < 0.36:
        return r.choices([0, 1, 2], [0.45, 0.45, 0.1])[0]
    return r.choices([0, 1, 2], [0.78, 0.1, 0.12])[0]


SEAM = np.zeros((H, W), bool)
SEAM[BY - 1:BY + 3] = True; SEAM[BY + BH - 3:BY + BH + 1] = True
CANM = (EXT & ~SANDM & ~ndimage.binary_erosion(CLR, iterations=2)) | (SEAM & LAND & ndimage.binary_erosion(LAND, iterations=3))
can, crown, Hc, tcy = canopy(CANM, 7, species)

m = EXT & ~SANDM
img[m] = can[m]
# Gras auf Lichtungen
gv = value_noise(W, H, 4, seed=9, octaves=2) * 0.6 + rs.rand(H, W) * 0.4
GW = np.array([186, 163, 248, 636, 553, 166.0]); cum = np.cumsum(GW) / GW.sum()
gidx = np.searchsorted(cum, np.clip(gv, 0, 0.999))
# Baumschatten am oberen/rechten Rand der Lichtung
treeup = np.zeros((H, W), bool)
for d in range(1, 4):
    sh = np.zeros((H, W), bool); sh[d:, :W - d] = (crown & ~CLR)[:H - d, d:]
    treeup |= sh
gidx = np.where(treeup, np.maximum(gidx - 3, 0), gidx)
cl = CLR & ~crown
img[cl] = np.array(GRASS, np.uint8)[gidx[cl]]
cl2 = CLR & crown & (din > 1)                                  # Kronen am Lichtungsrand bleiben
# Erdflecken + Trampelpfad
soil = CLR & ~crown & (value_noise(W, H, 3, seed=21, octaves=1) > 0.72) & ~treeup
img[soil] = SOIL[2]
img[soil & (rs.rand(H, W) < 0.3)] = SOIL[1]

# Sand
sv = rs.rand(H, W)
sidx = np.where(din <= 1.0, 0, np.where(sv < 0.55, 1, 2))
sidx = np.where((din > 1.0) & (din <= 1.8) & (sv < 0.3), 0, sidx)
img[SANDM] = np.array(SAND, np.uint8)[sidx[SANDM]]
m = EXT & SANDM & crown & (din > 1.0)
img[m] = can[m]
# Kronen über der Bandkante
over = BAND & crown & LAND & (((tcy < BY) & (YY < BY + 4)) | ((tcy > BY + BH - 1) & (YY > BY + BH - 5)))
img[over] = can[over]

dbg(img, 'v_terrain')

# ------------------------------------------------------------------ Animations-Ebenen als Standbild
# Lava: Fließtextur durch die Lavamaske, Glut
mlava = to_canvas(np.array(area(PG + 'mask-lava'))[..., 3] > 0, False)
fl = np.array(area(PG + 'flow-lava')).astype(float)
tile = np.tile(fl, (H // 8 + 1, W // 8 + 1, 1))[:H, :W]
m = mlava & (tile[..., 3] > 0)
a = tile[..., 3] / 255
img[m] = np.clip(img[m] * (1 - a[m, None]) + tile[..., :3][m] * a[m, None], 0, 255).astype(np.uint8)
glow_ = np.array(area(PG + 'lava-glow')).astype(float)
gl = np.zeros((H, W, 4)); gl[BY:BY + BH, max(0, BX):BX + 260] = glow_[:, -BX:W - BX] if BX < 0 else glow_
m = gl[..., 3] > 0
a = gl[..., 3] / 255 * 0.85
img[m] = np.clip(img[m] * (1 - a[m, None]) + gl[..., :3][m] * a[m, None], 0, 255).astype(np.uint8)
# Fluss-Strömung
mriv = to_canvas(np.array(area(PG + 'mask-river'))[..., 3] > 0, False)
fr = np.array(area(PG + 'flow-river')).astype(float)
tile = np.tile(fr, (H // 8 + 1, W // 16 + 1, 1))[:H, :W]
m = mriv & (tile[..., 3] > 0)
blend(img, m, (170, 215, 250), 150 / 255)
# Glitzern auf dem Wasser (wie glitter.png, aber ohne Kachelwiederholung)
gm = WATER | B_INNER
for _ in range(330):
    x, y = rs.randint(6, W - 8), rs.randint(6, H - 6)
    if not gm[y, x]:
        continue
    if rs.rand() < 0.25 and gm[y, x + 1] and gm[y, x - 1]:
        blend(img, np.pad(np.ones((1, 3), bool), ((y, H - y - 1), (x - 1, W - x - 2))), (150, 200, 245), 120 / 255)
        blend(img, np.pad(np.ones((1, 1), bool), ((y, H - y - 1), (x, W - x - 1))), (235, 248, 255), 200 / 255)
    else:
        blend(img, np.pad(np.ones((1, 1), bool), ((y, H - y - 1), (x, W - x - 1))), (150, 200, 245), 120 / 255)
# Brandung: gebrochene Linie direkt an der Küste
surf_n = value_noise(W, H, 3, seed=31, octaves=1)
SURF = WATER & (dland >= 0.9) & (dland < 2.2) & (surf_n > 0.42)
blend(img, SURF, (200, 232, 240), 190 / 255)
SURF2 = WATER & (dland >= 3.5) & (dland < 4.6) & (surf_n > 0.66)
blend(img, SURF2, (150, 205, 232), 130 / 255)

# Dampf, wo die Lava ins Meer läuft; Blasen im Lavasee
steam = frames('steam', 3)
sx, sy = bc(208, 40)
for (f, dx, dy) in [(0, -3, -5), (1, -1, -10), (2, 2, -16)]:
    comp_sprite(img, steam[f], sx + dx, sy + dy)
bub = frames('bubble', 3)
for (x, y, f) in [(153, 22, 1), (158, 25, 0)]:
    comp_sprite(img, bub[f], *bc(x - 1, y - 1))

# Dinos (Spiel-Sprites, 1x): Brachio-Herde auf der großen Lichtung, Plesiosaurier in der Bucht
brach = frames('brachio', 8)
comp_sprite(img, brach[2], *bc(50, 41))
comp_sprite(img, brach[3], *bc(70, 49))
ples = frames('plesio', 8)
comp_sprite(img, ples[0], 118, 258)

dbg(img, 'v_all')

# ------------------------------------------------------------------ Rauchfahne + Wolken (Höhenfeld, Licht oben rechts)
def puff_field(circles, h=H, w=W):
    hgt = np.full((h, w), -1.0); nx_ = np.zeros((h, w)); ny_ = np.zeros((h, w)); age = np.zeros((h, w))
    for (cx, cy, r, ag) in circles:
        x0, x1 = max(0, int(cx - r - 1)), min(w, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 1)), min(h, int(cy + r + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        sy_, sx_ = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
        ux = (sx_ + 0.5 - cx) / r; uy = (sy_ + 0.5 - cy) / r
        q = ux * ux + uy * uy
        hh = np.sqrt(np.clip(1 - q, 0, 1)) * r + r * 0.4
        cur = hgt[y0:y1, x0:x1]
        upd = (q < 1) & (hh > cur)
        cur[upd] = hh[upd]
        nx_[y0:y1, x0:x1][upd] = ux[upd]; ny_[y0:y1, x0:x1][upd] = uy[upd]
        age[y0:y1, x0:x1][upd] = ag
    return hgt, nx_, ny_, age


def shade(hgt, nx_, ny_, light=(0.62, -0.62, 0.48)):
    Lv = np.array(light); Lv /= np.linalg.norm(Lv)
    nz_ = np.sqrt(np.clip(1 - nx_ ** 2 - ny_ ** 2, 0, 1))
    lum = nx_ * Lv[0] + ny_ * Lv[1] + nz_ * Lv[2]
    # Eigenschatten zwischen den Ballen
    sh = np.zeros_like(hgt)
    for d in range(1, 6):
        s_ = np.full_like(hgt, -1.0); s_[d:, :W - d] = hgt[:H - d, d:]
        sh = np.maximum(sh, np.clip((s_ - hgt - d * 0.6) / 2.0, 0, 1))
    return np.clip(lum * 0.55 + 0.45 - sh * 0.35, 0, 1)


def ordered(v_, n):
    return np.clip(np.floor(v_ * (n - 1) + BAYER4[YY % 4, XX % 4]), 0, n - 1).astype(int)


def billow(circles, light=(0.62, -0.62, 0.5)):
    """Plastische Ballen: Höhenfeld aus Kugeln, Normalen aus dem Gradienten, Eigenschatten."""
    hgt = np.zeros((H, W)); age = np.zeros((H, W)); M = np.zeros((H, W), bool)
    for (cx, cy, r, ag, z) in circles:
        x0, x1 = max(0, int(cx - r - 1)), min(W, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 1)), min(H, int(cy + r + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        sy_, sx_ = YY[y0:y1, x0:x1], XX[y0:y1, x0:x1]
        q = ((sx_ + 0.5 - cx) ** 2 + (sy_ + 0.5 - cy) ** 2) / (r * r)
        hh = np.sqrt(np.clip(1 - q, 0, 1)) * r + z
        cur = hgt[y0:y1, x0:x1]
        upd = (q < 1) & (hh > cur)
        cur[upd] = hh[upd]
        age[y0:y1, x0:x1][upd] = ag
        M[y0:y1, x0:x1] |= q < 1
    hs = ndimage.gaussian_filter(hgt, 0.7)
    gy, gx = np.gradient(hs)
    n_ = np.dstack([-gx, -gy, np.ones_like(hs) * 1.1])
    n_ /= np.linalg.norm(n_, axis=2, keepdims=True)
    Lv = np.array(light, float); Lv /= np.linalg.norm(Lv)
    lum = n_[..., 0] * Lv[0] + n_[..., 1] * Lv[1] + n_[..., 2] * Lv[2]
    sh = np.zeros_like(hgt)
    for d in range(1, 8):
        s_ = np.zeros_like(hgt); s_[d:, :W - d] = hgt[:H - d, d:]
        sh = np.maximum(sh, np.clip((s_ - hgt - d * 0.7) / 2.5, 0, 1))
    lum = np.clip((lum - 0.25) / 0.75, 0, 1) - sh * 0.35
    return M, np.clip(lum, 0, 1), age, hgt


# Rauchfahne: vom Krater nach oben rechts, wird breiter, heller und löst sich auf
rr = random.Random(3)
path = [(151, 140), (155, 128), (164, 112), (180, 94), (202, 76), (228, 58), (262, 40)]
circ = []
Np = 70
for i in range(Np):
    tt = i / (Np - 1)
    f = tt * (len(path) - 1); j = min(int(f), len(path) - 2); u = f - j
    (x0, y0), (x1, y1) = path[j], path[j + 1]
    cx = x0 + (x1 - x0) * u; cy = y0 + (y1 - y0) * u
    r0 = 3 + 16 * tt ** 0.8
    z = tt * 30
    circ.append((cx + rr.uniform(-1, 1) * r0 * 0.25, cy + rr.uniform(-1, 1) * r0 * 0.25, r0 * rr.uniform(0.7, 0.9), tt, z))
    for _ in range(3 if tt > 0.05 else 1):
        a_ = rr.uniform(0, 2 * math.pi)
        rs_ = r0 * rr.uniform(0.3, 0.55)
        circ.append((cx + math.cos(a_) * r0 * 0.62, cy + math.sin(a_) * r0 * 0.62, rs_, tt, z + r0 * 0.25))
PM, pl, page, ph = billow(circ)
pn = value_noise(W, H, 4, seed=12, octaves=2)
fade = np.clip(1.6 - page * 1.25 + (pn - 0.5) * 0.9, 0, 1)
PM &= dither_mask(None, fade) | (page < 0.6)
PM = ndimage.binary_opening(PM, np.ones((2, 2))) | (PM & (page < 0.5))
SMOKE = [(18, 16, 16), (30, 26, 25), (44, 38, 36), (60, 53, 51), (82, 74, 69), (110, 100, 92), (138, 130, 122), (166, 160, 152), (194, 190, 184), (222, 220, 216)]
pv = np.clip(pl * 0.78 + page * 0.32 - 0.02, 0, 1)
pidx = ordered(pv, len(SMOKE))

# Wolken
CLOUD = [(96, 112, 132), (122, 138, 156), (152, 168, 184), (184, 196, 208), (212, 222, 230), (236, 242, 246), (252, 254, 255)]


def cloud_circles(cx, cy, rx, ry, seed, core):
    r_ = random.Random(seed)
    out = [(cx, cy, core, 0, 0)]
    for _ in range(int(rx * ry / 14)):
        a_ = r_.uniform(0, 2 * math.pi); d_ = r_.random() ** 0.5
        x = cx + math.cos(a_) * rx * d_; y = cy + math.sin(a_) * ry * d_
        rad = core * r_.uniform(0.3, 0.6) * (1.15 - 0.6 * d_)
        out.append((x, y, rad, 0, core * 0.55 * (1 - d_)))
    for _ in range(int(rx * ry / 20)):   # kleine Blumenkohl-Ballen am Rand
        a_ = r_.uniform(0, 2 * math.pi); d_ = r_.uniform(0.75, 1.05)
        x = cx + math.cos(a_) * rx * d_; y = cy + math.sin(a_) * ry * d_
        out.append((x, y, core * r_.uniform(0.15, 0.3), 0, core * 0.1))
    return out


clouds = []
clouds += cloud_circles(26, 30, 36, 18, 51, 14)
clouds += cloud_circles(226, 322, 38, 18, 52, 15)
clouds += cloud_circles(4, 122, 14, 8, 53, 7)
CM, cl_, _, _ = billow(clouds)
cidx = ordered(cl_, len(CLOUD))

# Schatten auf Land und Meer (Licht oben rechts -> Schatten unten links)
def shifted(m, dx, dy):
    out = np.zeros_like(m)
    ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
    xs, xd = (slice(-dx, W), slice(0, W + dx)) if dx < 0 else (slice(0, W - dx), slice(dx, W))
    out[yd, xd] = m[ys, xs]
    return out


SH_P = shifted(PM, -12, 14) & ~PM
SH_C = shifted(CM, -18, 20) & ~CM
shd = SH_P | SH_C
img[shd] = (img[shd].astype(float) * np.array([0.52, 0.56, 0.66])).astype(np.uint8)

# Flugsaurier mit Schatten (Spiel-Sprites 1x)
pt = frames('ptero', 6)
pts_ = frames('ptero-shadow', 6)
PTEROS = [(64, 36, 2), (176, 214, 4), (84, 292, 3)]
for (x, y, f) in PTEROS:
    comp_sprite(img, pts_[f], x - 11, y + 15)

# Rauch zeichnen
img[PM] = np.array(SMOKE, np.uint8)[pidx[PM]]
# Glut von unten am Fuß der Fahne
gm_ = PM & (page < 0.14) & (pl < 0.5)
img[gm_] = (110, 50, 30)
gm2 = PM & (page < 0.07) & (pl < 0.35)
img[gm2] = (170, 80, 36)

for (x, y, f) in PTEROS:
    comp_sprite(img, pt[f], x, y)

# Wolken zeichnen
img[CM] = np.array(CLOUD, np.uint8)[cidx[CM]]

dbg(img, 'v_all')
im = Image.fromarray(img).convert('RGBA')

# ------------------------------------------------------------------ Rahmen
bevel_frame(im, (24, 12, 8), (255, 170, 70), (150, 64, 26), (84, 30, 14), (24, 12, 8), width=6)
print(save(im, '14_pangaia'))
