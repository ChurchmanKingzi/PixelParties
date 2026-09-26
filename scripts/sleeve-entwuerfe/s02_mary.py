from lib import *
from mary_parts import wings, mary, phoenix, hands, SKIN

im = new()
bg = dither_gradient((W, H), [(0, (255, 214, 232)), (0.25, (250, 170, 206)), (0.55, (236, 118, 170)), (0.8, (210, 86, 150)), (1, (160, 60, 130))])
im.alpha_composite(bg)
cx, cy = W // 2, 172
yy, xx = np.mgrid[0:H, 0:W]
ang = np.arctan2(yy - (cy - 30), xx - cx)
dist = np.hypot(xx - cx, yy - (cy - 30))
ray = (np.sin(ang * 10) > 0.55)
m = dither_mask(None, ray * np.clip(1 - dist / 190, 0, 1) * 0.5)
a = np.array(im); a[m] = (255, 236, 200, 255); im = Image.fromarray(a)
# großes Herz
hz = heart(236, 216, (255, 90, 150, 255), edge=(170, 40, 100, 255))
hz2 = heart(214, 196, (255, 130, 180, 255))
paste(im, hz, (cx, cy - 4), center=True)
paste(im, hz2, (cx, cy - 7), center=True)
d = ImageDraw.Draw(im)
d.rectangle((cx - 72, cy - 86, cx - 62, cy - 78), fill=(255, 220, 235))
d.rectangle((cx - 80, cy - 77, cx - 74, cy - 70), fill=(255, 220, 235))
# kleine Herzen
rnd = random.Random(3)
for _ in range(26):
    sx = rnd.randrange(10, W - 18); sy = rnd.randrange(12, H - 30)
    if abs(sx - cx) < 118 and abs(sy - cy) < 112 or sy > 300:
        continue
    sz = rnd.choice([7, 7, 9, 11])
    paste(im, heart(sz, sz - 1, rnd.choice([(255, 255, 255, 255), (255, 200, 225, 255), (255, 70, 140, 255)])), (sx, sy))
# Flügel
wg = wings(Wd=250, Hd=200, cx=125, sy=128)
gl, p = glow(wg, (255, 236, 190, 255), radius=4, strength=0.5)
wy = 62
paste(im, gl, (-p, wy - p))
paste(im, wg, (0, wy))
# Mary
mr = mary()
mx, my = cx - mr.width // 2, 142
mg, p = glow(mr, (255, 250, 220, 255), radius=3, strength=0.5)
paste(im, mg, (mx - p, my - p))
paste(im, mr, (mx, my))
# Phönix in den Armen
ph = phoenix()
px_, py_ = cx - ph.width // 2, my + 52
pg, p = glow(ph, (255, 255, 240, 255), radius=2, strength=0.9)
paste(im, pg, (px_ - p, py_ - p))
paste(im, ph, (px_, py_))
d = ImageDraw.Draw(im)
hands(d, cx, my + 86)
# Funken/Herzen vom Phönix
for (x, y, c) in [(cx - 30, my + 30, (255, 220, 90)), (cx + 28, my + 26, (255, 170, 60)), (cx - 36, my + 50, (255, 240, 160)), (cx + 34, my + 46, (255, 220, 90))]:
    sparkle(d, x, y, 2, c)
paste(im, heart(9, 8, (255, 70, 140, 255), edge=(150, 30, 80, 255)), (cx + 20, my + 12))
paste(im, heart(7, 6, (255, 120, 170, 255), edge=(150, 30, 80, 255)), (cx - 28, my + 18))
# Heiligenschein
d.ellipse((cx - 14, my - 9, cx + 14, my - 1), outline=(255, 240, 120))
d.ellipse((cx - 13, my - 8, cx + 13, my - 2), outline=(255, 210, 60))
# Wolken unten
for i, (x, y, r) in enumerate([(10, 330, 22), (52, 338, 20), (100, 334, 24), (150, 340, 20), (196, 332, 24), (240, 336, 22)]):
    cloud(im, x, y, r, (255, 246, 250, 255), (236, 170, 204, 255), seed=i)
for i, (x, y, r) in enumerate([(30, 350, 20), (130, 352, 22), (220, 350, 20)]):
    cloud(im, x, y, r, (255, 255, 255, 255), (246, 200, 222, 255), seed=10 + i)
# Rahmen
bevel_frame(im, (110, 30, 80), (255, 210, 230), (240, 120, 175), (170, 50, 110), (110, 30, 80), width=7)
for (x, y) in [(3, 3), (W - 12, 3), (3, H - 12), (W - 12, H - 12)]:
    paste(im, heart(9, 8, (255, 255, 255, 255), edge=(170, 40, 100, 255)), (x - 1, y - 1))
print(save(im, '02_engelsherz'))
