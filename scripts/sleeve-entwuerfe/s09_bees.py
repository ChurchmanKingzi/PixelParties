from lib import *

K = (18, 14, 20, 255)


def bomblebee(flip=False, spark_phase=0):
    s = Image.new('RGBA', (30, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    # Flügel (hinten)
    for (x0, y0, x1, y1) in [(1, 5, 13, 14), (17, 5, 29, 14)]:
        d.ellipse((x0, y0, x1, y1), fill=(222, 218, 200, 255), outline=(110, 100, 90, 255))
        d.line((x0 + 3, (y0 + y1) // 2, x1 - 3, (y0 + y1) // 2 - 1), fill=(186, 178, 160, 255))
        d.point([(x0 + 3, y0 + 2), (x0 + 4, y0 + 2)], fill=(255, 255, 255, 255))
    # Beine
    for i, (x, y) in enumerate([(9, 20), (8, 23), (10, 26), (20, 20), (21, 23), (19, 26)]):
        cx = 15
        d.line((x, y, x + (-2 if x < cx else 2), y + 1), fill=K)
    # Körper (Bombe)
    d.ellipse((7, 11, 23, 26), fill=(44, 40, 50, 255), outline=K)
    d.ellipse((9, 13, 15, 18), fill=(84, 78, 94, 255))
    d.point([(10, 14), (11, 14), (10, 15)], fill=(160, 156, 170, 255))
    # goldener Ring (Gesicht)
    d.ellipse((11, 16, 20, 24), outline=(250, 196, 40, 255))
    d.ellipse((12, 17, 19, 23), outline=(200, 130, 20, 255))
    d.point([(13, 19), (17, 19)], fill=(255, 255, 255, 255))
    # Zündschnur
    d.line((15, 11, 15, 8), fill=(60, 40, 30, 255)); d.line((15, 8, 17, 5), fill=(120, 80, 40, 255)); d.line((17, 5, 19, 4), fill=(150, 100, 50, 255))
    # Funke
    sx, sy = 20, 3
    col = [(255, 250, 180, 255), (255, 200, 60, 255), (255, 130, 30, 255)]
    d.point([(sx, sy)], fill=col[0])
    for i, (dx, dy) in enumerate([(1, 0), (-1, 0), (0, 1), (0, -1)]):
        d.point((sx + dx, sy + dy), fill=col[1])
    for (dx, dy) in [(2, -2), (-2, -2), (2, 2), (3, 0)] if spark_phase == 0 else [(2, 0), (0, -2), (-2, 1), (1, 2)]:
        d.point((sx + dx, sy + dy), fill=col[2])
    s = outline(s, K)
    return s.transpose(Image.FLIP_LEFT_RIGHT) if flip else s


def bigbee():
    u = 2
    s = Image.new('RGBA', (30 * u + 4, 28 * u + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    def P(*v):
        return tuple(int(round(x * u)) + 2 for x in v)
    # Flügel mit Adern
    for (x0, y0, x1, y1), sgn in [((0.5, 3.5, 13.5, 14), -1), ((16.5, 3.5, 29.5, 14), 1)]:
        d.ellipse(P(x0, y0, x1, y1), fill=(226, 222, 206, 255), outline=(100, 90, 80, 255))
        d.ellipse(P(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5), outline=(196, 190, 172, 255))
        cx = (x0 + x1) / 2; cy = (y0 + y1) / 2
        d.line(P(cx - 4, cy + 1, cx + 4, cy - 1), fill=(160, 150, 134, 255))
        d.line(P(cx - 1, cy - 3, cx + 1, cy + 3), fill=(160, 150, 134, 255))
        d.rectangle(P(x0 + 2.5, y0 + 1.5, x0 + 4, y0 + 2.5), fill=(255, 255, 255, 255))
    # Spinnenbeine
    for side in (-1, 1):
        for i, (ax, ay) in enumerate([(4, 18), (5, 22), (6, 25.5)]):
            bx_ = 15 + side * (7 - i * 0.5); by_ = 18 + i * 2.5
            kx = 15 + side * (11 + i); ky = by_ + 1
            fx = 15 + side * (12 + i * 0.5); fy = by_ + 5
            d.line(P(bx_, by_, kx, ky), fill=K, width=2)
            d.line(P(kx, ky, fx, fy), fill=K, width=2)
    # Körper
    d.ellipse(P(6.5, 10.5, 23.5, 27), fill=(40, 36, 46, 255), outline=K)
    d.ellipse(P(8.5, 12.5, 16, 19), fill=(70, 64, 80, 255))
    d.ellipse(P(9.5, 13.5, 12.5, 16), fill=(120, 114, 132, 255))
    d.rectangle(P(10, 14, 10.5, 14.5), fill=(220, 216, 230, 255))
    # goldener Ring
    d.ellipse(P(10.5, 15.5, 20.5, 25), outline=(252, 204, 50, 255), width=2)
    d.ellipse(P(11.5, 16.5, 19.5, 24), outline=(190, 120, 20, 255))
    d.ellipse(P(12.5, 17.5, 18.5, 23), fill=(26, 22, 30, 255))
    d.rectangle(P(13.5, 19, 14, 20), fill=(255, 255, 255, 255)); d.rectangle(P(16.5, 19, 17, 20), fill=(255, 255, 255, 255))
    # Zündschnur
    d.line(P(15, 11, 15, 8), fill=(70, 50, 36, 255), width=2)
    d.line(P(15, 8, 17, 5.5), fill=(130, 90, 46, 255), width=2)
    d.line(P(17, 5.5, 19, 4), fill=(160, 110, 56, 255), width=2)
    # Funken
    sx, sy = P(20, 3)
    for (dx, dy, c) in [(0, 0, (255, 255, 220)), (2, 0, (255, 220, 80)), (-2, 0, (255, 220, 80)), (0, 2, (255, 220, 80)), (0, -2, (255, 220, 80)),
                        (4, -4, (255, 150, 40)), (-4, -3, (255, 150, 40)), (5, 1, (255, 150, 40)), (3, 4, (255, 190, 60)), (-1, -6, (255, 190, 60)), (7, -2, (255, 120, 30))]:
        d.rectangle((sx + dx, sy + dy, sx + dx + 1, sy + dy + 1), fill=c + (255,))
    return outline(s, K)


def honeycomb(w, h, R=11):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    # Pointy-top Hex-Gitter
    sq3 = math.sqrt(3)
    q = (sq3 / 3 * xx - 1 / 3 * yy) / R
    r = (2 / 3 * yy) / R
    # cube round
    x_ = q; z_ = r; y_ = -x_ - z_
    rx, ry, rz = np.round(x_), np.round(y_), np.round(z_)
    dx, dy, dz = np.abs(rx - x_), np.abs(ry - y_), np.abs(rz - z_)
    c1 = (dx > dy) & (dx > dz)
    rx = np.where(c1, -ry - rz, rx)
    c2 = ~c1 & (dy > dz)
    ry = np.where(c2, -rx - rz, ry)
    rz = np.where(~c1 & ~c2, -rx - ry, rz)
    cx = R * sq3 * (rx + rz / 2)
    cy = R * 1.5 * rz
    # Abstand zum Zentrum (hex-norm)
    px, py = xx - cx, yy - cy
    hexd = np.maximum(np.abs(px) * sq3 / 2 + np.abs(py) / 2, np.abs(py)) / (R * sq3 / 2 * 1.0)
    cell_id = (rx * 131 + rz * 71).astype(int)
    return hexd, px, py, cell_id


im = new()
hexd, px, py, cid = honeycomb(W, H, R=13)
rnd = np.random.RandomState(5)
ids = np.unique(cid)
full = {i: rnd.rand() < 0.62 for i in ids}
fullm = np.vectorize(full.get)(cid)
a = np.zeros((H, W, 4), np.uint8); a[..., 3] = 255
# Zellen
HONEY = [(150, 70, 10), (206, 116, 16), (240, 164, 30), (255, 206, 70)]
EMPTY = [(90, 50, 20), (120, 70, 26), (150, 94, 36)]
shade = np.clip(0.5 - (px + py) / 30, 0, 1)
t = np.clip(1 - hexd, 0, 1)
hq = np.digitize(shade * 0.7 + t * 0.6, [0.35, 0.6, 0.85])
eq = np.digitize(shade * 0.6 + (1 - t) * 0.4, [0.35, 0.6])
a[..., :3] = np.where(fullm[..., None], np.array(HONEY)[hq], np.array(EMPTY)[eq])
# Glanz auf Honig
gl = fullm & (np.hypot(px + 4, py + 4) < 2.2)
a[gl] = (255, 244, 190, 255)
# Wachswände
wall = hexd > 0.8
wall_l = hexd > 0.92
a[wall] = (250, 214, 110, 255)
a[wall_l] = (120, 66, 16, 255)
im = Image.fromarray(a)
# Vignette
yy, xx = np.mgrid[0:H, 0:W]
dist = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
m = dither_mask(None, np.clip((dist - 0.95) * 1.2, 0, 0.5))
aa = np.array(im); aa[m] = (90, 46, 12, 255); im = Image.fromarray(aa)

# Flugbahnen (gepunktet) + Bienen
d = ImageDraw.Draw(im)
bees = [(40, 60, 1, False), (190, 44, 1, True), (206, 120, 1, True), (30, 170, 1, False), (60, 286, 1, False), (196, 270, 1, True)]
for (x, y, k, fl) in bees:
    for i in range(1, 7):
        tx = x + (i * 5 if fl else -i * 5) + 15
        ty = y + 16 + int(3 * math.sin(i))
        d.point((tx, ty), fill=(255, 240, 180))
for (x, y, k, fl) in bees:
    b = bomblebee(flip=fl, spark_phase=(x // 10) % 2)
    paste(im, b, (x, y))
# Großer Bomblebee
big = up(bigbee(), 2)
glw, p = glow(big, (255, 220, 120, 255), radius=5, strength=0.5)
bx, by = W // 2 - big.width // 2, 92
paste(im, glw, (bx - p, by - p))
paste(im, big, (bx, by))
# Warnstreifen oben/unten
d = ImageDraw.Draw(im)
def hazard(y0, y1):
    for y in range(y0, y1):
        for x in range(W):
            d.point((x, y), fill=(250, 200, 30) if ((x + y) // 6) % 2 == 0 else (24, 18, 20))
hazard(0, 18); hazard(H - 18, H)
d.line((0, 18, W, 18), fill=K); d.line((0, H - 19, W, H - 19), fill=K)
# Titel
t = text_img('BOMBLEBEE', 20, (255, 214, 40, 255), outline_col=K, shadow=(90, 40, 10, 255))
d.rectangle((W // 2 - t.width // 2 - 6, 238, W // 2 + t.width // 2 + 5, 238 + t.height + 7), fill=K)
d.rectangle((W // 2 - t.width // 2 - 5, 239, W // 2 + t.width // 2 + 4, 238 + t.height + 6), outline=(250, 200, 30))
paste(im, t, (W // 2 - t.width // 2, 242))
frame(im, [K, (250, 200, 30, 255), K])
print(save(im, '09_bomblebee_wabe'))
