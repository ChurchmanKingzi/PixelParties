from lib import *
BG = (24, 72, 146, 255)
GRID1 = (36, 88, 166, 255)
GRID2 = (58, 112, 190, 255)
WHITE = (236, 244, 255, 255)
T1 = (150, 196, 245, 255)
T2 = (92, 146, 214, 255)
T3 = (48, 100, 176, 255)
DARK = (14, 40, 96, 255)


def blueprint(sp, k, grid=True):
    a = np.array(sp).astype(int)
    L = a[..., :3].mean(2)
    h, w = L.shape
    out = Image.new('RGBA', (w * k, h * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 0:
                continue
            l = L[y, x]
            r_, g_, b_ = a[y, x, :3]
            if (r_ > 100 and r_ > g_ * 3) or (r_ > 200 and g_ < 170 and b_ < 90):
                c = (255, 110, 120, 255)
            else:
                c = DARK if l < 55 else T2 if l < 110 else T1 if l < 175 else WHITE
            d.rectangle((x * k, y * k, x * k + k - 1, y * k + k - 1), fill=c)
            if grid and c != DARK:
                d.line((x * k, y * k, x * k + k - 1, y * k), fill=(max(0, c[0] - 22), max(0, c[1] - 18), max(0, c[2] - 10), 255))
                d.line((x * k, y * k, x * k, y * k + k - 1), fill=(max(0, c[0] - 22), max(0, c[1] - 18), max(0, c[2] - 10), 255))
    out = outline(out, WHITE)
    return out


def arrow_h(d, x0, x1, y, col=WHITE):
    d.line((x0, y, x1, y), fill=col)
    d.line((x0, y - 3, x0, y + 3), fill=col); d.line((x1, y - 3, x1, y + 3), fill=col)
    d.point([(x0 + 1, y - 1), (x0 + 1, y + 1), (x0 + 2, y - 2), (x0 + 2, y + 2)], fill=col)
    d.point([(x1 - 1, y - 1), (x1 - 1, y + 1), (x1 - 2, y - 2), (x1 - 2, y + 2)], fill=col)


def arrow_v(d, x, y0, y1, col=WHITE):
    d.line((x, y0, x, y1), fill=col)
    d.line((x - 3, y0, x + 3, y0), fill=col); d.line((x - 3, y1, x + 3, y1), fill=col)
    d.point([(x - 1, y0 + 1), (x + 1, y0 + 1), (x - 2, y0 + 2), (x + 2, y0 + 2)], fill=col)
    d.point([(x - 1, y1 - 1), (x + 1, y1 - 1), (x - 2, y1 - 2), (x + 2, y1 - 2)], fill=col)


im = new(BG)
d = ImageDraw.Draw(im)
for x in range(0, W, 6):
    d.line((x, 0, x, H), fill=GRID1)
for y in range(0, H, 6):
    d.line((0, y, W, y), fill=GRID1)
for x in range(0, W, 30):
    d.line((x, 0, x, H), fill=GRID2)
for y in range(0, H, 30):
    d.line((0, y, W, y), fill=GRID2)

# Hauptzeichnung: Jetpack-Forscher
nv = native('Future Tech Jetpack')
sci = cut_native(nv, (24, 8, 52, 38), sat_max=0.25)
sci = sci.crop(sci.getbbox())
k = 6
bp = blueprint(sci, k)
sx, sy = (W - bp.width) // 2, 58
# freie Fläche hinter Figur
d.rectangle((sx - 6, sy - 6, sx + bp.width + 5, sy + bp.height + 5), fill=BG)
paste(im, bp, (sx, sy))
d = ImageDraw.Draw(im)
# Bemaßung
arrow_h(d, sx, sx + bp.width - 1, sy + bp.height + 12)
t = text_img('%d PX' % sci.width, 10, WHITE)
d.rectangle((sx + bp.width // 2 - t.width // 2 - 2, sy + bp.height + 8, sx + bp.width // 2 + t.width // 2 + 2, sy + bp.height + 16), fill=BG)
paste(im, t, (sx + bp.width // 2 - t.width // 2, sy + bp.height + 9))
arrow_v(d, sx - 14, sy, sy + bp.height - 1)
t = text_img('%d PX' % sci.height, 10, WHITE).rotate(90, expand=True)
d.rectangle((sx - 18, sy + bp.height // 2 - t.height // 2 - 2, sx - 10, sy + bp.height // 2 + t.height // 2 + 2), fill=BG)
paste(im, t, (sx - 18, sy + bp.height // 2 - t.height // 2))

# Callouts
def callout(px, py, lx, ly, label, right=True):
    dd = ImageDraw.Draw(im)
    dd.ellipse((px - 3, py - 3, px + 3, py + 3), outline=WHITE)
    dd.line((px + (3 if lx > px else -3), py, lx, ly), fill=WHITE)
    t = text_img(label, 10, WHITE)
    if right:
        dd.line((lx, ly, lx + t.width + 3, ly), fill=WHITE)
        paste(im, t, (lx + 2, ly - t.height - 2))
    else:
        dd.line((lx - t.width - 3, ly, lx, ly), fill=WHITE)
        paste(im, t, (lx - t.width - 1, ly - t.height - 2))

def callout2(px, py, ex, ey, label):
    dd = ImageDraw.Draw(im)
    dd.ellipse((px - 3, py - 3, px + 3, py + 3), outline=WHITE)
    dd.line((px + 2, py - 2, ex, ey), fill=WHITE)
    t = text_img(label, 10, WHITE)
    dd.line((ex, ey, ex + t.width + 2, ey), fill=WHITE)
    paste(im, t, (ex + 2, ey - t.height - 2))

callout2(sx + int(15.5 * k), sy + 2 * k, 196, 44, 'GENIUS')
callout2(sx + int(22.5 * k), sy + 11 * k, 199, 100, "THRUST")
callout2(sx + int(22.5 * k), sy + int(21.5 * k), 207, 244, 'SPARK')

# Nebenansicht: Laserkanone
nv2 = native('Future Tech Laser Cannon')
gun = cut_native(nv2, (52, 16, 76, 43), sat_max=0.25)
gun = gun.crop(gun.getbbox())
gb = blueprint(gun, 3)
gx, gy = 20, 250
d = ImageDraw.Draw(im)
d.rectangle((gx - 4, gy - 4, gx + gb.width + 3, gy + gb.height + 3), fill=BG, outline=GRID2)
paste(im, gb, (gx, gy))
# Laserstrahl gestrichelt
for x in range(gx - 4, 12, -4):
    pass
t = text_img('FIG. 2', 10, WHITE); paste(im, t, (gx, gy + gb.height + 6))

# 999-Anzeige
disp = cut_native(nv2, (0, 4, 18, 18), sat_max=0.25)
disp = disp.crop(disp.getbbox())
db = blueprint(disp, 3)
d = ImageDraw.Draw(im)
dx0, dy0 = 26, 16
paste(im, db, (dx0, dy0))

# Titelblock
bx0, by0, bx1, by1 = 110, 262, 240, 340
d.rectangle((bx0, by0, bx1, by1), fill=BG, outline=WHITE)
d.rectangle((bx0 + 2, by0 + 2, bx1 - 2, by1 - 2), outline=WHITE)
d.line((bx0 + 2, by0 + 28, bx1 - 2, by0 + 28), fill=WHITE)
d.line((bx0 + 2, by0 + 44, bx1 - 2, by0 + 44), fill=WHITE)
d.line((bx0 + 2, by0 + 60, bx1 - 2, by0 + 60), fill=WHITE)
d.line((bx0 + 64, by0 + 44, bx0 + 64, by1 - 2), fill=WHITE)
t = text_img('FUTURE TECH', 14, WHITE); paste(im, t, ((bx0 + bx1) // 2 - t.width // 2, by0 + 9))
t = text_img('JETPACK  MK-II', 10, T1); paste(im, t, ((bx0 + bx1) // 2 - t.width // 2, by0 + 33))
t = text_img('SCALE', 9, T1); paste(im, t, (bx0 + 8, by0 + 49))
t = text_img('1:8', 10, WHITE); paste(im, t, (bx0 + 70, by0 + 49))
t = text_img('DMG', 9, T1); paste(im, t, (bx0 + 8, by0 + 65))
t = text_img('999', 10, (255, 120, 120, 255)); paste(im, t, (bx0 + 70, by0 + 65))

# Rahmen: Papierkante
d = ImageDraw.Draw(im)
d.rectangle((0, 0, W - 1, H - 1), outline=(10, 30, 70))
d.rectangle((1, 1, W - 2, H - 2), outline=(10, 30, 70))
d.rectangle((6, 6, W - 7, H - 7), outline=WHITE)
d.rectangle((8, 8, W - 9, H - 9), outline=T2)
print(save(im, '03_future_tech_blaupause'))
