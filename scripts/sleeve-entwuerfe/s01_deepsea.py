from lib import *
im = new()
# Hintergrund-Verlauf
bg = dither_gradient((W, H), [(0, (40, 84, 120)), (0.3, (22, 48, 84)), (0.62, (12, 26, 54)), (1, (8, 14, 34))])
im.alpha_composite(bg)
# Lichtstrahlen
yy, xx = np.mgrid[0:H, 0:W]
t = np.zeros((H, W))
for cx, wdt in [(40, 18), (120, 26), (200, 14), (250, 20)]:
    u = xx - cx + (yy * 0.45)
    t += np.clip(1 - np.abs(u) / wdt, 0, 1) * np.clip(1 - yy / 260, 0, 1) * 0.55
m = dither_mask(None, t)
a = np.array(im); a[m] = np.clip(a[m].astype(int) + np.array([22, 38, 44, 0]), 0, 255); im = Image.fromarray(a)

# Tiefseegott (native Pixel, x4)
nv = native('Dark Deepsea God').crop((4, 1, 72, 51))
na = np.array(nv).astype(int)
r, gg, b = na[..., 0], na[..., 1], na[..., 2]
eyes = (r > 70) & (r > gg + 30)
body = (((b - gg) < 30) & (gg > 36)) | eyes
lab, k = ndimage.label(body)
sizes = ndimage.sum(body, lab, range(1, k + 1))
body = lab == (np.argmax(sizes) + 1)
body = ndimage.binary_closing(body, iterations=1)
body = ndimage.binary_fill_holes(body)
eyes &= body
lum = na[..., :3].mean(2)
lum = np.clip((lum - 36) * 2.4, 0, 90)
col = np.stack([10 + lum * 0.20, 24 + lum * 0.45, 44 + lum * 0.55], -1)
# Augenrand (dunkelrot), Augen (3 Rottöne), Glanzpunkt
rim = ndimage.binary_dilation(eyes, iterations=1) & body & ~eyes
col[rim] = (58, 14, 40)
glint = eyes & (gg > 80)
col[eyes] = (150, 16, 48)
col[eyes & (r > 110)] = (214, 30, 64)
col[eyes & (r > 150)] = (255, 70, 96)
col[glint] = (255, 214, 224)
ga = np.dstack([col, np.where(body, 255, 0)]).clip(0, 255).astype(np.uint8)
god = up(Image.fromarray(ga), 4)
ga = np.array(god).astype(int)
hh = ga.shape[0]
fy = np.mgrid[0:hh, 0:ga.shape[1]][0]
fadeT = np.clip((hh - 4 - fy) / 60, 0, 1)
ga[..., 3] = np.where(dither_mask(None, fadeT) & (ga[..., 3] > 0), 255, 0)
god = Image.fromarray(ga.astype(np.uint8))
gx, gy = (W - god.width) // 2, 6
# weiches Rotlicht hinter dem Kopf
eyeimg = Image.fromarray(np.dstack([np.full(eyes.shape, 255), np.zeros(eyes.shape), np.zeros(eyes.shape), eyes * 255]).astype(np.uint8))
gl, p = glow(up(eyeimg, 4), (40, 30, 70, 255), radius=6, strength=0.5)
paste(im, gl, (gx - p, gy - p))
paste(im, god, (gx, gy))
godmask = np.zeros((H, W), bool)
gm = np.array(god)[..., 3] > 0
y0, x0 = max(gy, 0), max(gx, 0)
godmask[y0:y0 + gm.shape[0], x0:x0 + gm.shape[1]] = gm[:H - y0, :W - x0][:, :W - x0] if gx >= 0 else gm[:H - y0, -gx:-gx + W]

# Nebel-Schloss im Hintergrund
back = area('deepsea-castle/back')
ba = np.array(back).astype(float)
ba[..., :3] = ba[..., :3] * np.array([0.16, 0.26, 0.42])
back = Image.fromarray(ba.clip(0, 255).astype(np.uint8))
back = back.resize((256, 200), Image.NEAREST)
fade = np.array(back)
yyb = np.mgrid[0:200, 0:256][0]
fade[..., 3] = np.where(dither_mask(None, np.clip((yyb - 10) / 60, 0, 1)), 255, 0)
paste(im, Image.fromarray(fade), (-3, 150))

# Schloss
castle = area('deepsea-castle/castle')
cg, p = glow(castle, (70, 150, 170, 255), radius=3, strength=0.25)
paste(im, cg, ((W - castle.width) // 2 - p, H - 108 - p))
paste(im, castle, ((W - castle.width) // 2, H - 108))

# Boden
d = ImageDraw.Draw(im)
d.rectangle((0, H - 10, W, H), fill=(24, 20, 44))
# Blasen
rnd = random.Random(7)
for _ in range(60):
    x = rnd.randrange(8, W - 8); y = rnd.randrange(20, 250); s = rnd.choice([1, 1, 1, 2, 2, 3])
    c = (150, 210, 230)
    if godmask[max(0, y - 1):y + 2 * s + 2, max(0, x - 1):x + 2 * s + 2].any():
        continue
    if s == 1:
        d.point((x, y), fill=c)
    else:
        d.ellipse((x, y, x + s * 2, y + s * 2), outline=c)
        d.point((x + 1, y + 1), fill=(230, 250, 255))
# Wal-Silhouette
whale = area('deepsea-castle/whale').crop((0, 0, 40, 13)); whale = whale.crop(whale.getbbox())
whale = silhouette(whale.resize((whale.width * 2, whale.height * 2), Image.NEAREST), (14, 34, 64))
paste(im, whale, (150, 212))
jelly = area('deepsea-castle/jelly').crop((0, 0, 7, 10)); jelly = jelly.crop(jelly.getbbox())
jelly = jelly.resize((jelly.width * 2, jelly.height * 2), Image.NEAREST)
paste(im, jelly, (22, 120)); paste(im, jelly, (214, 96))

# Rahmen
bevel_frame(im, (4, 6, 16), (90, 170, 190), (22, 60, 84), (8, 20, 36), (4, 6, 16), width=7)
d = ImageDraw.Draw(im)
for (x, y) in [(3, 3), (W - 4, 3), (3, H - 4), (W - 4, H - 4)]:
    d.rectangle((x - 2, y - 2, x + 2, y + 2), fill=(200, 60, 90)); d.point((x, y), fill=(255, 170, 190))
print(save(im, '01_tiefsee_abgrund'))
