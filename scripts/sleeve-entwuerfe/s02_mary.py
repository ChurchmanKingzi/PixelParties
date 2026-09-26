from lib import *
g = art('Cute Princess Mary').crop((6, 4, 604, 396))
hsv = np.array(g.convert('RGB').convert('HSV')).astype(float)
h = hsv[..., 0] * 360 / 255; s = hsv[..., 1] / 255; v = hsv[..., 2] / 255
a = np.array(g).astype(int); lum = a[..., :3].mean(2)
fg = ((h > 18) & (h < 60) & (s > 0.55)) | (lum < 105) | ((s < 0.25) & (v > 0.6))
fg = ndimage.binary_closing(fg, iterations=3)
fg = ndimage.binary_fill_holes(fg)
fg = ndimage.binary_opening(fg, iterations=3)
lab, k = ndimage.label(fg); sz = ndimage.sum(fg, lab, range(1, k + 1))
fg = np.isin(lab, np.where(sz > 3000)[0] + 1)
fg[:, :40] = False
fg[:12, :] = False
out = np.array(g); out[..., 3] = np.where(fg, 255, 0)
mary = mirror_left(Image.fromarray(out), 299)
mary = keep_largest(mary)
mary = shrink(mary, 0.48)
mary = outline(mary, (120, 30, 20, 255))

im = new()
bg = dither_gradient((W, H), [(0, (255, 214, 232)), (0.25, (250, 170, 206)), (0.55, (236, 118, 170)), (0.8, (210, 86, 150)), (1, (160, 60, 130))])
im.alpha_composite(bg)
# Strahlen hinter Mary
yy, xx = np.mgrid[0:H, 0:W]
cx, cy = W // 2, 150
ang = np.arctan2(yy - cy, xx - cx)
ray = (np.sin(ang * 10) > 0.55)
dist = np.hypot(xx - cx, yy - cy)
t = ray * np.clip(1 - dist / 190, 0, 1) * 0.55
m = dither_mask(None, t)
aa = np.array(im); aa[m] = (255, 236, 200, 255); im = Image.fromarray(aa)
# großes Herz
hz = heart(236, 216, (255, 90, 150, 255), edge=(170, 40, 100, 255))
hz2 = heart(214, 196, (255, 130, 180, 255))
paste(im, hz, (cx, cy + 6), center=True)
paste(im, hz2, (cx, cy + 3), center=True)
d = ImageDraw.Draw(im)
d.rectangle((cx - 72, cy - 76, cx - 62, cy - 68), fill=(255, 220, 235))
d.rectangle((cx - 80, cy - 67, cx - 74, cy - 60), fill=(255, 220, 235))
# kleine Herzen
rnd = random.Random(3)
for _ in range(22):
    sx = rnd.randrange(10, W - 18); sy = rnd.randrange(12, H - 30)
    if abs(sx - cx) < 118 and abs(sy - cy) < 108 or sy > 250:
        continue
    sz = rnd.choice([7, 7, 9, 11])
    paste(im, heart(sz, sz - 1, rnd.choice([(255, 255, 255, 255), (255, 200, 225, 255), (255, 70, 140, 255)])), (sx, sy))
# Wolken unten
for i, (x, y, r) in enumerate([(10, 328, 22), (52, 336, 20), (100, 332, 24), (150, 338, 20), (196, 330, 24), (240, 334, 22)]):
    cloud(im, x, y, r, (255, 246, 250, 255), (236, 170, 204, 255), seed=i)
for i, (x, y, r) in enumerate([(30, 348, 20), (130, 350, 22), (220, 350, 20)]):
    cloud(im, x, y, r, (255, 255, 255, 255), (246, 200, 222, 255), seed=10 + i)
# Schrift
t1 = text_img('Cute', 40, (255, 110, 170, 255), outline_col=(255, 255, 255, 255))
t1 = outline(t1, (150, 30, 90, 255))
paste(im, t1, (cx - t1.width // 2, 262))
# Mary
gl, p = glow(mary, (255, 240, 190, 255), radius=4, strength=0.6)
mx, my = cx - mary.width // 2, cy - mary.height // 2 - 4
paste(im, gl, (mx - p, my - p))
paste(im, mary, (mx, my))
# Heiligenschein
d = ImageDraw.Draw(im)
d.ellipse((cx - 13, my - 4, cx + 13, my + 4), outline=(255, 240, 120))
d.ellipse((cx - 12, my - 3, cx + 12, my + 3), outline=(255, 210, 60))
# Rahmen
bevel_frame(im, (110, 30, 80), (255, 210, 230), (240, 120, 175), (170, 50, 110), (110, 30, 80), width=7)
for (x, y) in [(3, 3), (W - 12, 3), (3, H - 12), (W - 12, H - 12)]:
    paste(im, heart(9, 8, (255, 255, 255, 255), edge=(170, 40, 100, 255)), (x - 1, y - 1))
print(save(im, '02_engelsherz'))
