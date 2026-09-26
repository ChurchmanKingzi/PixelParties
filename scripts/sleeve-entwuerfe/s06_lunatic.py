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

# Hawk
nv = native('Lunatic Hawk')
a = np.array(nv).astype(int)
yl = (a[..., 0] + a[..., 1]) / 2 - a[..., 2]
m = yl > 28
m[:, 70:] = False; m[:, :8] = False; m[46:, :] = False
m = ndimage.binary_closing(m, iterations=1)
lab, k = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, k + 1)); m = np.isin(lab, np.where(sz > 12)[0] + 1)
out = np.array(nv); out[..., 3] = np.where(m, 255, 0)
hawk = Image.fromarray(out).crop((14, 5, 62, 47))
hawk = mirror_left(hawk, 24)
ha = np.array(hawk).astype(int)
L = ha[..., :3].mean(2)
ylh = (ha[..., 0] + ha[..., 1]) / 2 - ha[..., 2]
orbs = (ha[..., 3] > 0) & (ylh > 62)
k = 3
alpha = ha[..., 3] > 0
Lk = np.kron(L, np.ones((k, k))); Ak = np.kron(alpha, np.ones((k, k))).astype(bool)
hh, ww = Lk.shape
yy2, xx2 = np.mgrid[0:hh, 0:ww]
edge = Ak & ~ndimage.binary_erosion(Ak)
out = np.zeros((hh, ww, 4), np.uint8)
t = np.clip((Lk - 120) / 110, 0, 1)
solid = Ak & (t > 0.72)
half = Ak & ~solid & dither_mask(None, t * 0.9 + 0.1)
out[half] = (214, 176, 96, 255)
out[solid] = (250, 228, 150, 255)
out[edge] = (255, 240, 180, 255)
hk = Image.fromarray(out)
gl, p = glow(hk, (60, 56, 90, 255), radius=4, strength=0.7)
hx, hy = cx - hk.width // 2, cy - hk.height // 2 + 6
paste(im, gl, (hx - p, hy - p))
paste(im, hk, (hx, hy))
d = ImageDraw.Draw(im)
oy, ox = np.where(orbs)
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
