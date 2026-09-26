from lib import *
im = new()
im.alpha_composite(dither_gradient((W, H), [(0, (8, 10, 30)), (0.4, (16, 22, 56)), (0.8, (30, 34, 80)), (1, (44, 42, 92))]))
stars(im, 120, [(255, 255, 255), (190, 200, 255), (255, 240, 200), (120, 130, 190)], seed=11, box=(6, 6, W - 6, H - 6), big=0.06)
cx, cy = W // 2, 168
d = ImageDraw.Draw(im)
# Mondschein-Halo
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - cx, yy - cy)
for rad, col, st in [(96, (34, 40, 86, 255), 1.0), (70, (52, 56, 104, 255), 1.0), (52, (74, 74, 120, 255), 0.9)]:
    m = dither_mask(None, np.clip(1 - dist / rad, 0, 1) * st * 1.5)
    a = np.array(im); a[m] = col; im = Image.fromarray(a)
# Vollmond Mitte
fm = moon(34, 0.5, seed=3)
paste(im, fm, (cx, cy), center=True)
# Ring
d = ImageDraw.Draw(im)
R = 100
for ang in range(0, 360, 3):
    x = cx + R * math.cos(math.radians(ang)); y = cy + R * math.sin(math.radians(ang))
    d.point((round(x), round(y)), fill=(170, 150, 90))
# 8 Phasen im Kreis (oben = Neumond, im Uhrzeigersinn zunehmend)
for i in range(8):
    p = i / 8
    ang = -90 + i * 45
    x = cx + R * math.cos(math.radians(ang)); y = cy + R * math.sin(math.radians(ang))
    m = moon(11, p, seed=i + 5)
    ring = Image.new('RGBA', (m.width + 4, m.height + 4), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((0, 0, m.width + 3, m.height + 3), fill=(12, 14, 36, 255), outline=(200, 170, 90, 255))
    ring.alpha_composite(m, (2, 2))
    paste(im, ring, (x, y), center=True)

# Hawk (Karten-Sprite "Lunatic Hawk", vollständige Flügelflächen)
nv = native('Lunatic Hawk')
a = np.array(nv).astype(int)
yl = (a[..., 0] + a[..., 1]) / 2 - a[..., 2]
lines = yl > 28
lines[:, 70:] = False; lines[:, :8] = False; lines[46:, :] = False
lines = ndimage.binary_closing(lines, iterations=1)
lab, k = ndimage.label(lines); sz = ndimage.sum(lines, lab, range(1, k + 1)); lines = np.isin(lab, np.where(sz > 12)[0] + 1)
full = ndimage.binary_closing(np.pad(lines, 3), iterations=2)[3:-3, 3:-3]
full = ndimage.binary_fill_holes(full) | lines
out = np.array(nv); out[..., 3] = np.where(full, 255, 0)
ln = np.zeros(out.shape[:2], np.uint8); ln[lines] = 255
hawk = mirror_left(Image.fromarray(out).crop((14, 5, 62, 47)), 24)
hl = np.array(mirror_left(Image.fromarray(np.dstack([ln, ln, ln, ln])).crop((14, 5, 62, 47)), 24))[..., 0] > 0
ha = np.array(hawk).astype(int)
L = ha[..., :3].mean(2)
ylh = (ha[..., 0] + ha[..., 1]) / 2 - ha[..., 2]
orbs = (ha[..., 3] > 0) & (ylh > 62)
k = 3
alpha = ha[..., 3] > 0
Lk = np.kron(L, np.ones((k, k))); Ak = np.kron(alpha, np.ones((k, k))).astype(bool)
Hk = np.kron(hl, np.ones((k, k))).astype(bool)
hh, ww = Lk.shape
edge = Ak & ~ndimage.binary_erosion(Ak)
out = np.zeros((hh, ww, 4), np.uint8)
t = np.clip((Lk - 120) / 110, 0, 1)
# Goldlinien wie im Original (Helligkeit -> fest / gedithert)
solid = Hk & (t > 0.72)
half = Hk & ~solid & dither_mask(None, t * 0.9 + 0.1)
# blasse Federflächen dazwischen: durchscheinend
pale = Ak & ~Hk & dither_mask(None, np.full(Lk.shape, 0.26))
out[pale] = (150, 136, 132, 255)
out[half] = (214, 176, 96, 255)
out[solid] = (250, 228, 150, 255)
out[edge] = (255, 240, 180, 255)
hk = Image.fromarray(out)
gl, p = glow(hk, (60, 56, 90, 255), radius=4, strength=0.7)
hx, hy = cx - hk.width // 2, cy - hk.height // 2 + 6
paste(im, gl, (hx - p, hy - p))
paste(im, hk, (hx, hy))
d = ImageDraw.Draw(im)
lab, n = ndimage.label(orbs)
for c_ in ndimage.center_of_mass(orbs, lab, range(1, n + 1)):
    sparkle(d, hx + int(c_[1] * k + k / 2), hy + int(c_[0] * k + k / 2), 4, (255, 230, 140))
    d.rectangle((hx + int(c_[1] * k), hy + int(c_[0] * k), hx + int(c_[1] * k) + 1, hy + int(c_[0] * k) + 1), fill=(255, 255, 230))
# Titel
t = text_img('LUNATIC CYCLE', 16, (255, 232, 160, 255), outline_col=(40, 30, 20, 255))
paste(im, t, (cx - t.width // 2, 300))
d = ImageDraw.Draw(im)
d.line((30, 296, W - 31, 296), fill=(170, 140, 80)); d.line((30, 322, W - 31, 322), fill=(170, 140, 80))
# Rahmen
bevel_frame(im, (10, 8, 24), (230, 200, 120), (120, 90, 50), (70, 50, 30), (10, 8, 24), width=5)
d = ImageDraw.Draw(im)
for (x, y) in [(12, 12), (W - 13, 12), (12, H - 13), (W - 13, H - 13)]:
    sparkle(d, x, y, 3, (230, 200, 120))
print(save(im, '06_mondzyklus'))
