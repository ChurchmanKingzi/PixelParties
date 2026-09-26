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
fm = moon(30, 0.5, seed=3)
paste(im, fm, (cx, cy - 22), center=True)
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

# Hawk: goldenes Sternbild, nach dem Kartenmotiv "Lunatic Hawk" neu gezeichnet
HW, HH = 150, 150
OX, OY = 75, 70  # Brustmitte im Hawk-Bild
fill = np.zeros((HH, HW), np.uint8)   # 0 leer, 1 Feder, 2 Deckfeder, 3 Körper
line = Image.new('L', (HW, HH), 0)
ld = ImageDraw.Draw(line)
fi = Image.new('L', (HW, HH), 0)
fd = ImageDraw.Draw(fi)


def pt(x, y):
    return (OX + x, OY + y)


def feather(base, ang, length, width, lvl):
    bx, by = base
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    nx, ny = -sa, ca
    tip = (bx + ca * length, by + sa * length)
    mid = (bx + ca * length * 0.55, by + sa * length * 0.55)
    poly = [(bx + nx * width / 2, by + ny * width / 2), (mid[0] + nx * width * 0.55, mid[1] + ny * width * 0.55), tip,
            (mid[0] - nx * width * 0.55, mid[1] - ny * width * 0.55), (bx - nx * width / 2, by - ny * width / 2)]
    fd.polygon(poly, fill=lvl)
    ld.line(poly[1:] + [poly[0]], fill=0)
    ld.line([poly[0], poly[1], tip, poly[3], poly[4]], fill=255)
    ld.line([(bx, by), (tip[0] * 0.7 + bx * 0.3, tip[1] * 0.7 + by * 0.3)], fill=140)  # Kiel


def wing(sg):
    S = pt(sg * 9, -4); Wr = pt(sg * 26, -26); T = pt(sg * 58, -60)
    path = [S, Wr, T]
    segs = [(S, Wr), (Wr, T)]
    L1 = math.dist(S, Wr); L2 = math.dist(Wr, T); tot = L1 + L2
    N = 11
    feathers = []
    for i in range(N):
        u = i / (N - 1)
        d_ = u * tot
        if d_ <= L1:
            q = d_ / L1; P = (S[0] + (Wr[0] - S[0]) * q, S[1] + (Wr[1] - S[1]) * q)
        else:
            q = (d_ - L1) / L2; P = (Wr[0] + (T[0] - Wr[0]) * q, Wr[1] + (T[1] - Wr[1]) * q)
        ang_out = 96 - 78 * u  # innen fast senkrecht nach unten, außen nach außen
        ang = ang_out if sg > 0 else 180 - ang_out
        length = 30 + 16 * math.sin(math.pi * min(1, u * 1.2)) - 12 * u
        feathers.append((P, ang, length, 9 - 3 * u))
    for P, ang, length, wdt in reversed(feathers):
        feather(P, ang, length, wdt, 1)
    # Deckfedern
    for P, ang, length, wdt in reversed(feathers[:-1]):
        feather(P, ang, length * 0.42, wdt + 1, 2)
    ld.line(path, fill=255, width=2)
    return Wr, T


orbs_pts = []
for sg in (-1, 1):
    Wr, T = wing(sg)
    orbs_pts += [Wr, T]
# Schwanzfächer
for ang in (70, 80, 90, 100, 110):
    feather(pt(0, 22), ang, 26, 7, 1)
# Körper
fd.ellipse((OX - 11, OY - 12, OX + 11, OY + 26), fill=3)
ld.ellipse((OX - 11, OY - 12, OX + 11, OY + 26), outline=255)
for j in range(4):
    yj = OY - 2 + j * 6
    ld.line((OX - 5, yj, OX, yj + 3), fill=140); ld.line((OX, yj + 3, OX + 5, yj), fill=140)
# Kopf
fd.ellipse((OX - 8, OY - 26, OX + 8, OY - 10), fill=3)
ld.ellipse((OX - 8, OY - 26, OX + 8, OY - 10), outline=255)
head = pt(0, -20)
# Krallen
for sg in (-1, 1):
    x0 = OX + sg * 6
    ld.line((x0, OY + 24, x0 + sg * 2, OY + 32), fill=255)
    for dx in (-2, 0, 2):
        ld.line((x0 + sg * 2, OY + 32, x0 + sg * 2 + dx, OY + 36), fill=255)

F = np.array(fi); Ln = np.array(line)
yy2, xx2 = np.mgrid[0:HH, 0:HW]
chk = BAYER4[yy2 % 4, xx2 % 4]
out = np.zeros((HH, HW, 4), np.uint8)
out[(F == 1) & (chk < 0.38)] = (196, 170, 116, 255)
out[(F == 2) & (chk < 0.6)] = (222, 196, 132, 255)
out[(F == 3)] = (206, 164, 84, 255)
out[(F == 3) & (chk < 0.3)] = (236, 204, 130, 255)
out[Ln == 140] = (226, 186, 96, 255)
out[Ln == 255] = (250, 220, 130, 255)
union = ndimage.binary_closing(out[..., 3] > 0, iterations=2)
ring = ndimage.binary_dilation(union, iterations=1) & ~union
out[ring] = (26, 22, 56, 255)
body_edge = ndimage.binary_dilation(F == 3, iterations=1) & ~(F == 3) & (out[..., 3] == 0)
hk = Image.fromarray(out)
# Augen & Schnabel
hd = ImageDraw.Draw(hk)
hd.rectangle((OX - 5, OY - 20, OX - 4, OY - 19), fill=(40, 30, 60, 255)); hd.rectangle((OX + 4, OY - 20, OX + 5, OY - 19), fill=(40, 30, 60, 255))
hd.point([(OX - 5, OY - 20), (OX + 4, OY - 20)], fill=(255, 255, 255, 255))
hd.polygon([(OX - 2, OY - 16), (OX + 2, OY - 16), (OX, OY - 12)], fill=(250, 170, 70, 255))
gl, p = glow(hk, (58, 54, 96, 255), radius=4, strength=0.6)
hx, hy = cx - OX, cy - OY + 14
paste(im, gl, (hx - p, hy - p))
paste(im, hk, (hx, hy))
d = ImageDraw.Draw(im)
for (ox_, oy_) in orbs_pts + [(OX, OY - 28)]:
    X, Y = hx + int(ox_), hy + int(oy_)
    d.ellipse((X - 3, Y - 3, X + 3, Y + 3), fill=(255, 214, 90), outline=(170, 120, 40))
    d.rectangle((X - 1, Y - 2, X, Y - 1), fill=(255, 255, 230))
    sparkle(d, X, Y, 6, (255, 230, 140), core=(255, 250, 200))
    d.ellipse((X - 2, Y - 2, X + 2, Y + 2), fill=(255, 226, 110))
    d.point((X - 1, Y - 1), fill=(255, 255, 240))
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
