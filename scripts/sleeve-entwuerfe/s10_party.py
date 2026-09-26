from lib import *
from skel_sprites import minions, bard

im = new()
im.alpha_composite(dither_gradient((W, H), [(0, (20, 8, 36)), (0.35, (44, 18, 70)), (0.62, (70, 30, 96)), (1, (36, 14, 50))]))
stars(im, 60, [(255, 255, 255), (220, 190, 255), (160, 130, 200)], seed=21, box=(6, 6, W - 6, 180), big=0.08)
# Mond
mn = moon(26, 0.5, lit=(226, 250, 190), lit2=(186, 220, 150), seed=4)
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot(xx - 186, yy - 108)
for rad, col in [(56, (60, 40, 96, 255)), (40, (84, 60, 116, 255))]:
    m = dither_mask(None, np.clip(1 - dist / rad, 0, 1) * 1.6)
    a = np.array(im); a[m] = col; im = Image.fromarray(a)
paste(im, mn, (186, 108), center=True)
# Toter Baum links
tree = area('graveyard/tree'); tree = tree.crop(tree.getbbox())
tree = silhouette(tree, (22, 10, 30))
paste(im, tree, (-26, 158))
# Krähen
crow = area('graveyard/crow').crop((0, 0, 10, 8)); crow = crow.crop(crow.getbbox())
paste(im, crow, (40, 170)); paste(im, crow.transpose(Image.FLIP_LEFT_RIGHT), (14, 186))
# Hügel
d = ImageDraw.Draw(im)
hill = (yy > 272 + 10 * np.cos((xx - 125) / 60.0))
a = np.array(im); a[hill] = (32, 22, 40, 255)
hill2 = (yy > 282 + 6 * np.cos((xx - 40) / 30.0)) 
a[hill2] = (24, 16, 30, 255)
edge = hill & ~ndimage.binary_erosion(hill)
a[edge] = (80, 60, 100, 255)
im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Grabsteine
def tomb(x, y, w, h, cross=False):
    if cross:
        d.rectangle((x + w // 2 - 2, y, x + w // 2 + 1, y + h), fill=(120, 110, 140), outline=(20, 14, 26))
        d.rectangle((x, y + 4, x + w, y + 7), fill=(120, 110, 140), outline=(20, 14, 26))
        d.rectangle((x + w // 2 - 1, y + 5, x + w // 2, y + 6), fill=(120, 110, 140))
    else:
        d.rectangle((x, y + 4, x + w, y + h), fill=(110, 100, 130), outline=(20, 14, 26))
        d.ellipse((x, y, x + w, y + 9), fill=(110, 100, 130), outline=(20, 14, 26))
        d.rectangle((x + 1, y + 5, x + w - 1, y + 7), fill=(110, 100, 130))
        d.line((x + 2, y + 3, x + 2, y + h - 2), fill=(150, 140, 170))
        d.line((x + w // 2 - 2, y + 8, x + w // 2 + 2, y + 8), fill=(60, 50, 76))
for (x, y, w, h, c) in [(8, 262, 14, 20, False), (214, 258, 16, 22, False), (196, 270, 10, 18, True), (40, 276, 10, 16, True)]:
    tomb(x, y, w, h, c)
# Lichterkette
pts = []
for x in range(6, W - 5):
    t = (x - 6) / (W - 12)
    y = 78 + 26 * math.sin(math.pi * t * 2) ** 2 * 0.0 + 30 * (1 - (2 * t - 1) ** 2)
    pts.append((x, int(y)))
    d.point((x, int(y)), fill=(20, 12, 24))
BULB = [(255, 80, 90), (255, 220, 60), (100, 230, 120), (90, 170, 255), (220, 110, 255)]
for i, (x, y) in enumerate(pts[6::16]):
    c = BULB[i % len(BULB)]
    d.rectangle((x - 1, y + 1, x + 1, y + 2), fill=(40, 30, 40))
    d.rectangle((x - 2, y + 3, x + 2, y + 7), fill=c)
    d.point((x - 1, y + 4), fill=(255, 255, 255))
    gl = np.hypot(xx - x, yy - (y + 5)) < 7
    m = gl & dither_mask(None, np.full((H, W), 0.25)) & ~(np.hypot(xx - x, yy - (y + 5)) < 3)
    a = np.array(im); a[m, :3] = np.clip(a[m, :3].astype(int) + (np.array(c) * 0.35).astype(int), 0, 255); im = Image.fromarray(a)
    d = ImageDraw.Draw(im)
# Diskokugel
bx_, by_ = W // 2, 132
d = ImageDraw.Draw(im)
d.line((bx_, 108, bx_, by_ - 14), fill=(20, 12, 24))
R = 14
ball = np.zeros((2 * R + 1, 2 * R + 1, 4), np.uint8)
yyb, xxb = np.mgrid[-R:R + 1, -R:R + 1]
inside = xxb ** 2 + yyb ** 2 <= R * R
lat = np.floor((yyb + R) / 4); lon = np.floor((xxb + R + (lat % 2) * 2) / 4)
shade = np.clip(1 - (np.hypot(xxb + 5, yyb + 5) / (R * 1.9)), 0, 1)
tone = np.digitize(shade + ((lat + lon) % 3) * 0.08, [0.25, 0.45, 0.62, 0.8])
PAL = np.array([(60, 50, 80, 255), (110, 100, 140, 255), (170, 160, 200, 255), (220, 214, 240, 255), (255, 255, 255, 255)])
ball[inside] = PAL[tone][inside]
grid = inside & (((yyb + R) % 4 == 0) | ((xxb + R + (lat.astype(int) % 2) * 2) % 4 == 0))
ball[grid] = (40, 32, 56, 255)
bi = outline(Image.fromarray(ball), (16, 8, 20, 255))
paste(im, bi, (bx_, by_), center=True)
d = ImageDraw.Draw(im)
sparkle(d, bx_ - 6, by_ - 7, 4, (255, 255, 255))
# Reflexionspunkte
rnd = random.Random(9)
REFL = [(255, 120, 220), (120, 230, 255), (200, 255, 120), (255, 230, 120), (255, 255, 255)]
for _ in range(70):
    ang = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(24, 200)
    x = int(bx_ + math.cos(ang) * rr); y = int(by_ + math.sin(ang) * rr * 0.9)
    if 8 < x < W - 9 and 8 < y < 300:
        d.rectangle((x, y, x + 1, y), fill=rnd.choice(REFL))
# Seelen
soul = area('graveyard/soul').crop((0, 0, 7, 11)); soul = soul.crop(soul.getbbox())
for (x, y) in [(60, 150), (176, 176), (222, 214)]:
    paste(im, up(soul, 2), (x, y))
# Noten
def note(col, kind=0):
    n = Image.new('RGBA', (9, 12), (0, 0, 0, 0)); dd = ImageDraw.Draw(n)
    dd.ellipse((0, 8, 4, 11), fill=col); dd.line((4, 1, 4, 9), fill=col)
    if kind == 0:
        dd.line((4, 1, 7, 3), fill=col); dd.line((5, 1, 8, 4), fill=col)
    else:
        dd.ellipse((5, 6, 8, 9), fill=col); dd.line((8, 0, 8, 7), fill=col); dd.line((4, 1, 8, 0), fill=col); dd.line((4, 2, 8, 1), fill=col)
    return outline(n, (20, 10, 26, 255))
for i, (x, y) in enumerate([(84, 176), (158, 146), (100, 214), (40, 214), (204, 192), (150, 222)]):
    paste(im, up(note([(255, 220, 60, 255), (120, 240, 110, 255), (220, 110, 255, 255), (255, 90, 100, 255)][i % 4], i % 2), 2 if i < 3 else 1), (x, y))
# Skelette
ms = minions(); bd = bard()
k = 3
heal, arch, mage = [outline(up(s, 2), (14, 8, 18, 255)) for s in ms]
bdk = outline(up(bd, 3), (14, 8, 18, 255))
ground = 312
big_mage = outline(up(ms[2], 3), (14, 8, 18, 255))
paste(im, arch, (12, ground - arch.height - 8))
paste(im, mage.transpose(Image.FLIP_LEFT_RIGHT), (196, ground - mage.height - 10))
paste(im, heal, (54, ground - heal.height + 4))
paste(im, arch.transpose(Image.FLIP_LEFT_RIGHT), (158, ground - arch.height + 6))
paste(im, big_mage, (W // 2 - big_mage.width // 2, ground - big_mage.height + 16))
# Tanzbewegungslinien
d = ImageDraw.Draw(im)
for (x, y) in [(12, 250), (42, 256), (210, 244), (238, 250)]:
    d.line((x, y, x + 2, y - 3), fill=(240, 220, 255)); d.line((x + 4, y + 1, x + 6, y - 2), fill=(240, 220, 255))
# Rahmen
bevel_frame(im, (14, 6, 20), (200, 140, 255), (110, 50, 160), (60, 24, 90), (14, 6, 20), width=6)
# Logo
def pal(a):
    a = a.copy()
    rgb = a[..., :3].astype(int)
    mp = {255: (236, 255, 190), 228: (170, 96, 230), 186: (130, 64, 190), 172: (116, 54, 172), 150: (98, 44, 150), 132: (84, 36, 130), 78: (56, 22, 90)}
    for g, c in mp.items():
        m = (rgb[..., 0] == g) & (rgb[..., 1] == g) & (a[..., 3] > 0)
        a[m, :3] = c
    return a
lg = logo(pal)
lg2 = lg.resize((lg.width * 2, lg.height * 2), Image.NEAREST)
print(save_overlay(im, '10_skelett_party', [(lg2, ((W * S - lg2.width) // 2, 36))]))
