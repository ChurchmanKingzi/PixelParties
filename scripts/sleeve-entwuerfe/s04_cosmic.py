from lib import *
im = new((8, 6, 24, 255))
tile = area('cosmic-depths/tile')
for ty in range(0, H, 100):
    for tx in range(0, W, 128):
        t = tile
        if (tx // 128 + ty // 100) % 2:
            t = t.transpose(Image.FLIP_LEFT_RIGHT)
        if (ty // 100) % 2:
            t = t.transpose(Image.FLIP_TOP_BOTTOM)
        im.alpha_composite(t, (tx, ty))
# abdunkeln zum Rand hin (Vignette)
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot((xx - W / 2) / (W / 2), (yy - 150) / (H / 2))
m = dither_mask(None, np.clip((dist - 0.75) * 1.3, 0, 0.9))
a = np.array(im); a[m] = (6, 4, 16, 255); im = Image.fromarray(a)

cx, cy = W // 2, 140
# roter Schein
yy, xx = np.mgrid[0:H, 0:W]
dd = np.hypot((xx - cx) / 1.0, (yy - cy) / 1.25)
for rad, col, st in [(118, (60, 12, 40, 255), 0.9), (92, (96, 18, 44, 255), 0.8)]:
    m = dither_mask(None, np.clip(1 - dd / rad, 0, 1) * st * 1.6)
    a = np.array(im); a[m] = col; im = Image.fromarray(a)
# Argos-Körper (Leere)
body = area('cosmic-depths/argos-body').crop((0, 0, 76, 98))
body = body.crop(body.getbbox())
body = up(body, 2)
paste(im, body, (cx, cy), center=True)
# Auge
rift = area('cosmic-depths/rift').crop((46, 0, 69, 45))
rift = rift.crop(rift.getbbox())
rg = area('cosmic-depths/rift-glow')
paste(im, up(rg, 2), (cx, cy), center=True)
paste(im, up(rift, 2), (cx, cy), center=True)
# Pupille-Glanz
d = ImageDraw.Draw(im)

# Mond & Würfelwelt
center = area('cosmic-depths/center')
moon = center.crop((72, 4, 102, 33))
cube = center.crop((120, 19, 183, 83))
paste(im, moon, (192, 22))
paste(im, cube, (22, 238))
# Untertassen
sau = area('cosmic-depths/saucer').crop((0, 0, 21, 10)); sau = sau.crop(sau.getbbox())
paste(im, up(sau, 2), (190, 250))
paste(im, sau, (40, 70))
paste(im, sau.transpose(Image.FLIP_LEFT_RIGHT), (206, 190))
# Traktorstrahl der großen Untertasse
bx = 190 + sau.width
beam = np.zeros((H, W))
for i in range(0, 40):
    w_ = 2 + i // 3
    beam[270 + i, bx - w_:bx + w_] = 0.6 * (1 - i / 40)
m = dither_mask(None, beam)
a = np.array(im); a[m] = np.clip(a[m].astype(int) + np.array([60, 120, 70, 0]), 0, 255); im = Image.fromarray(a)
d = ImageDraw.Draw(im)
# Asteroiden, Komet
ast = area('cosmic-depths/asteroid-l').crop((0, 0, 9, 9)); ast = ast.crop(ast.getbbox())
ast2 = area('cosmic-depths/asteroid-s').crop((0, 0, 6, 6)); ast2 = ast2.crop(ast2.getbbox())
for (x, y) in [(30, 150), (214, 120), (100, 290)]:
    paste(im, up(ast, 2) if y == 150 else ast, (x, y))
for (x, y) in [(60, 118), (180, 300), (150, 40), (26, 196)]:
    paste(im, ast2, (x, y))
comet = area('cosmic-depths/comet').crop((0, 0, 30, 7)); comet = comet.crop(comet.getbbox())
paste(im, up(comet, 2), (60, 30))
# Analyzer
an = area('cosmic-depths/analyzer-l').crop((0, 0, 10, 6)); an = an.crop(an.getbbox())
paste(im, up(an, 2), (40, 110)); paste(im, up(an, 2).transpose(Image.FLIP_LEFT_RIGHT), (196, 150))
# Sterne
bodymask = new((0, 0, 0, 0)); paste(bodymask, body, (cx, cy), center=True)
bm = np.array(bodymask)[..., 3] > 0
before = np.array(im)
stars(im, 40, [(255, 255, 255), (200, 200, 255), (255, 220, 240)], seed=5, box=(8, 8, W - 8, H - 8), big=0.15)
a = np.array(im); a[bm] = before[bm]; im = Image.fromarray(a)
# Schrift
t = text_img('THE EYE SEES YOU', 14, (255, 220, 230, 255), outline_col=(40, 8, 30, 255))
paste(im, t, (cx - t.width // 2, 318))
# Rahmen
bevel_frame(im, (10, 4, 20), (150, 110, 220), (60, 36, 110), (30, 16, 60), (10, 4, 20), width=6)
d = ImageDraw.Draw(im)
for (x, y) in [(2, 2), (W - 3, 2), (2, H - 3), (W - 3, H - 3)]:
    d.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(255, 90, 100))
print(save(im, '04_kosmische_tiefen'))
