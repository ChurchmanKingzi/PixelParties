from lib import *
im = new()
im.alpha_composite(dither_gradient((W, H), [(0, (120, 200, 222)), (0.45, (160, 222, 234)), (1, (214, 244, 250))]))
# Cool-Streifen diagonal
yy, xx = np.mgrid[0:H, 0:W]
stripe = ((xx + yy) // 8) % 3 == 0
a = np.array(im); a[stripe] = np.clip(a[stripe].astype(int) + np.array([18, 12, 8, 0]), 0, 255); im = Image.fromarray(a)
# Wolken
cl = area('wowhalla/clouds')
c1 = cl.crop((0, 0, 60, 30)); c1 = c1.crop(c1.getbbox())
c2 = cl.crop((60, 0, 128, 40)); c2 = c2.crop(c2.getbbox())
for (c, x, y, k) in [(c1, 150, 52, 2), (c2, 12, 196, 2), (c1, 196, 180, 1), (c2, 30, 48, 1), (c1, 180, 232, 2), (c2, 100, 150, 1)]:
    paste(im, up(c, k), (x, y))
# Zahnräder (Cool-Motiv) in der Ferne
gears = area('wowhalla/gears')
g1 = gears.crop((0, 0, 32, 32)); g1 = g1.crop(g1.getbbox())
# Halle
hall = area('wowhalla/hall')
hb = hall.getbbox(); hall = hall.crop(hb)
# Wolkenbank unten
for i, (x, y, r) in enumerate([(10, 330, 26), (60, 338, 22), (120, 342, 26), (180, 336, 24), (240, 330, 26)]):
    cloud(im, x, y, r, (246, 252, 255, 255), (190, 224, 236, 255), seed=20 + i)
paste(im, hall, ((W - hall.width) // 2, H - hall.height - 12))
for i, (x, y, r) in enumerate([(-4, 352, 20), (44, 356, 18), (206, 356, 18), (254, 350, 22)]):
    cloud(im, x, y, r, (255, 255, 255, 255), (206, 232, 242, 255), seed=40 + i)

# Wowkyrie
nv = native('Wowkyrie, Bringer of Coolness')
def sky(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ((b - r > 18) & (g - r > 10)) | ((r > 200) & (g > 215) & (b > 215) & (b >= r - 2))
wk = cut_by(nv, (16, 4, 50, 44), sky)
k = 4
ox, oy = 26, 64
BANDS = [(0, 159, 250), (0, 241, 52), (247, 255, 0), (255, 116, 8), (255, 2, 10), (181, 81, 254), (253, 81, 234)]
d = ImageDraw.Draw(im)
x0 = ox + 34 * k
for x in range(x0 - 8, W, 1):
    seg = (x - x0) // 8
    off = int(round(10 * math.sin(seg * 0.55))) // 2 * 2 + seg * 2
    for i, c in enumerate(BANDS):
        y = oy + (26 + i) * k + off - 0
        d.rectangle((x, y, x, y + k - 1), fill=c)
# Sternchen am Regenbogen
rnd = random.Random(4)
for _ in range(10):
    x = rnd.randrange(x0 + 4, W - 10); y = rnd.randrange(oy + 80, oy + 180)
    d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(255, 255, 255))
wks = up(wk, k)
wks = outline(wks, (40, 30, 60, 255))
paste(im, wks, (ox, oy))
# Titel
t = text_img('WOWHALLA', 22, (255, 214, 60, 255), outline_col=(110, 60, 10, 255), shadow=(40, 60, 90, 255))
paste(im, t, (W // 2 - t.width // 2, 18))
# Rahmen: Gold
bevel_frame(im, (70, 40, 10), (255, 236, 150), (230, 170, 50), (150, 90, 20), (70, 40, 10), width=6)
d = ImageDraw.Draw(im)
print(save(im, '05_wowhalla_regenbogen'))
