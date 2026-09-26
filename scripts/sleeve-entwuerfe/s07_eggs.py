from lib import *
im = new()
yy, xx = np.mgrid[0:H, 0:W]
s = xx / W + yy / H - 1 + 0.07 * np.sin(yy / 16.0) + 0.03 * np.sin(xx / 7.0)
fire = s < 0
# Lava
n = value_noise(W, H, 40, seed=3)
band = np.sin(yy * 0.28 + n * 9 + xx * 0.03)
FIRE = [(120, 12, 8), (200, 40, 10), (246, 110, 20), (255, 180, 40), (255, 236, 120)]
q = np.digitize(band + (n - 0.5) * 1.2, [-0.9, -0.3, 0.3, 0.8])
lava = np.array(FIRE)[q]
# Eis
n2 = value_noise(W, H, 36, seed=8)
ICE = [(80, 110, 190), (130, 170, 230), (180, 210, 245), (226, 240, 255), (255, 255, 255)]
stripe = ((xx - yy) // 5) % 9 == 0
ib = np.digitize(n2 + stripe * 0.25 + (yy / H) * 0.2, [0.35, 0.5, 0.65, 0.85])
ice = np.array(ICE)[ib]
a = np.zeros((H, W, 4), np.uint8); a[..., 3] = 255
a[..., :3] = np.where(fire[..., None], lava, ice)
# Grenze: Dampf
b_in = fire & ~ndimage.binary_erosion(fire, iterations=2)
b_out = ~fire & ~ndimage.binary_erosion(~fire, iterations=2)
halo = ~fire & ~ndimage.binary_erosion(~fire, iterations=7)
a[halo & dither_mask(None, np.full((H, W), 0.45))] = (255, 255, 255, 255)
a[b_in] = (255, 240, 170, 255)
a[b_out] = (40, 20, 50, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Glut- und Eisfunken
rnd = random.Random(2)
for _ in range(60):
    x, y = rnd.randrange(8, W - 8), rnd.randrange(8, H - 8)
    if s[y, x] < -0.08:
        d.point((x, y), fill=rnd.choice([(255, 250, 200), (255, 200, 60)]))
    elif s[y, x] > 0.08:
        sparkle(d, x, y, rnd.choice([1, 2]), (255, 255, 255), core=(255, 255, 255))

# Eier
fe = draw_egg3(84, 106, [(30, 4, 6), (70, 10, 12), (120, 22, 14), (184, 52, 18), (240, 124, 30), (255, 214, 96)])
ie = draw_egg3(84, 106, [(24, 34, 96), (50, 76, 160), (90, 140, 210), (150, 200, 240), (210, 238, 255), (255, 255, 255)])
for egg, (x, y), gc in [(fe, (68, 96), (255, 246, 190, 255)), (ie, (182, 258), (255, 255, 255, 255))]:
    gl, p = glow(egg, gc, radius=5, strength=0.55)
    paste(im, gl, (x - egg.width // 2 - p, y - egg.height // 2 - p))
    paste(im, egg, (x, y), center=True)
# Glanzlichter
d = ImageDraw.Draw(im)
for (x, y) in [(68 - 24, 96 - 36), (182 - 24, 258 - 36)]:
    d.rectangle((x, y, x + 2, y + 7), fill=(255, 255, 240)); d.rectangle((x, y + 10, x + 2, y + 12), fill=(255, 255, 240))
# Drachen
nv = native('Red Dragoneer')
def bgr(a):
    L = a[..., :3].mean(2); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (L > 45) | ((g < 45) & (b < 70) & (r > 70))
rd = keep_largest(cut_by(nv, (20, 8, 54, 42), bgr))
rd = outline(up(rd.crop(rd.getbbox()), 2), (40, 6, 6, 255))
paste(im, rd, (62, 212), center=True)
nv2 = native('Blue-Ice Dragon')
bd = keep_largest(cut_native(nv2, (18, 10, 56, 40), barrier_lum=70))
bd = outline(up(bd.crop(bd.getbbox()), 2).transpose(Image.FLIP_LEFT_RIGHT), (16, 24, 70, 255))
paste(im, bd, (188, 138), center=True)
# Rahmen: halb Feuer, halb Eis
fr = new((0, 0, 0, 0))
bevel_frame(fr, (60, 8, 4), (255, 200, 80), (200, 60, 20), (110, 20, 10), (60, 8, 4), width=6)
fr2 = new((0, 0, 0, 0))
bevel_frame(fr2, (20, 30, 80), (240, 250, 255), (140, 180, 230), (70, 100, 170), (20, 30, 80), width=6)
fa = np.array(fr); fb = np.array(fr2)
fa[~fire] = fb[~fire]
im.alpha_composite(Image.fromarray(fa))
print(save(im, '07_feuer_und_eis'))
