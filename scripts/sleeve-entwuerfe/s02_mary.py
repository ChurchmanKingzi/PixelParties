from lib import *
from mary_sprite import mary_posed, phoenix_native

im = new()
bg = dither_gradient((W, H), [(0, (255, 214, 232)), (0.25, (250, 170, 206)), (0.55, (236, 118, 170)), (0.8, (210, 86, 150)), (1, (160, 60, 130))])
im.alpha_composite(bg)
mary = up(mary_posed(), 3)
ph = up(phoenix_native().transpose(Image.FLIP_TOP_BOTTOM), 3)
cx = W // 2
my = 12
yy, xx = np.mgrid[0:H, 0:W]
hc = (cx, my + 92)
ang = np.arctan2(yy - hc[1], xx - cx)
dist = np.hypot(xx - cx, yy - hc[1])
ray = (np.sin(ang * 10) > 0.55)
m = dither_mask(None, ray * np.clip(1 - dist / 200, 0, 1) * 0.5)
a = np.array(im); a[m] = (255, 236, 200, 255); im = Image.fromarray(a)
# großes Herz hinter Mary
hz = heart(200, 184, (255, 90, 150, 255), edge=(170, 40, 100, 255))
hz2 = heart(180, 166, (255, 130, 180, 255))
paste(im, hz, (cx, hc[1] + 6), center=True)
paste(im, hz2, (cx, hc[1] + 3), center=True)
d = ImageDraw.Draw(im)
d.rectangle((cx - 62, hc[1] - 68, cx - 54, hc[1] - 61), fill=(255, 220, 235))
d.rectangle((cx - 69, hc[1] - 60, cx - 64, hc[1] - 54), fill=(255, 220, 235))
# kleine Herzen
rnd = random.Random(3)
for _ in range(40):
    sx = rnd.randrange(10, W - 18); sy = rnd.randrange(12, H - 30)
    if (abs(sx - cx) < 120 and sy < 210) or (abs(sx - cx) < 60 and sy < 330):
        continue
    sz = rnd.choice([7, 7, 9, 11])
    paste(im, heart(sz, sz - 1, rnd.choice([(255, 255, 255, 255), (255, 200, 225, 255), (255, 70, 140, 255)])), (sx, sy))
# Wolken unten
for i, (x, y, r) in enumerate([(10, 326, 22), (52, 334, 20), (100, 330, 24), (150, 336, 20), (196, 328, 24), (240, 332, 22)]):
    cloud(im, x, y, r, (255, 246, 250, 255), (236, 170, 204, 255), seed=i)
# Phönix (stürzt unter Mary herab)
pg, p = glow(ph, (255, 236, 170, 255), radius=4, strength=0.6)
px_, py_ = cx - ph.width // 2, my + mary.height + 4
paste(im, pg, (px_ - p, py_ - p))
paste(im, ph, (px_, py_))
# Mary
mg, p = glow(mary, (255, 244, 210, 255), radius=4, strength=0.6)
paste(im, mg, (cx - mary.width // 2 - p, my - p))
paste(im, mary, (cx - mary.width // 2, my))
for i, (x, y, r) in enumerate([(30, 350, 20), (130, 354, 22), (220, 350, 20)]):
    cloud(im, x, y, r, (255, 255, 255, 255), (246, 200, 222, 255), seed=10 + i)
bevel_frame(im, (110, 30, 80), (255, 210, 230), (240, 120, 175), (170, 50, 110), (110, 30, 80), width=6)
for (x, y) in [(3, 3), (W - 12, 3), (3, H - 12), (W - 12, H - 12)]:
    paste(im, heart(9, 8, (255, 255, 255, 255), edge=(170, 40, 100, 255)), (x - 1, y - 1))
print(save(im, '02_engelsherz'))
