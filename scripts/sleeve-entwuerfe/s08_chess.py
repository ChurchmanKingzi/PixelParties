from lib import *
import os


def kcard(fn):
    c = Image.open(os.path.join(ROOT, 'cards', fn + '.png')).convert('RGBA').crop((70, 170, 680, 570))
    return native(None, full=c)


IVORY = (246, 238, 214, 255)
GOLD = (214, 170, 60, 255)
GOLD_D = (130, 90, 30, 255)
INK = (24, 18, 22, 255)
RED = (180, 30, 40, 255)
im = new(IVORY)
d = ImageDraw.Draw(im)
# feines Rautenmuster im Hintergrund
for y in range(0, H, 4):
    for x in range(0, W, 4):
        if (x // 4 + y // 4) % 2 == 0:
            d.point((x, y), fill=(232, 222, 194))

wk = kcard('Kasperov the King of Kings.1')  # weiß
bk = kcard('Kasperov the King of Kings')    # schwarz
kw, kb = diff_cut(wk, bk, (26, 6, 54, 51))
qw, qb = diff_cut(wk, bk, (58, 8, 76, 51))
pw, pb = diff_cut(wk, bk, (0, 0, 16, 30))
pw = pw.transpose(Image.FLIP_LEFT_RIGHT); pb = pb.transpose(Image.FLIP_LEFT_RIGHT)
PW, PH = 190, 144


def panel(king, queen, pawn, light):
    pn = Image.new('RGBA', (PW, PH), (0, 0, 0, 255))
    top_c = (210, 204, 196) if light else (40, 34, 46)
    bot_c = (150, 144, 150) if light else (18, 14, 22)
    pn.alpha_composite(dither_gradient((PW, PH), [(0, top_c), (1, bot_c)]))
    # Perspektivischer Boden
    a = np.array(pn)
    hy = 62
    c1 = np.array((236, 232, 222, 255) if light else (96, 88, 106, 255))
    c2 = np.array((70, 64, 76, 255) if light else (26, 22, 30, 255))
    f = 70.0
    for y in range(hy + 1, PH):
        D = f * 1.0 / (y - hy)
        u = np.arange(PW) - PW / 2 + 0.5
        X = u * D / f
        gx = np.floor(X / 0.42)
        gz = np.floor(D / 0.42 + 0.3)
        chk = ((gx + gz) % 2 == 0)
        a[y, chk] = c1; a[y, ~chk] = c2
    # Nebel am Horizont
    for y in range(hy + 1, min(PH, hy + 22)):
        t = 1 - (y - hy) / 22
        row = dither_mask(None, np.full((1, PW), t * 0.8))[0] if False else None
        m = BAYER4[y % 4, np.arange(PW) % 4] < t * 1.05
        a[y, m] = np.array((bot_c if not light else top_c) + (255,))
    pn = Image.fromarray(a)
    d = ImageDraw.Draw(pn)
    d.line((0, hy, PW, hy), fill=(120, 110, 90) if light else (150, 120, 60))
    k3 = up(king, 3)
    q2 = up(queen, 2)
    p2 = up(pawn, 2)
    for spr, x, y in [(p2, 14, 96 - p2.height), (p2, 160, 98 - p2.height), (q2, 138, 118 - q2.height), (k3, PW // 2 - k3.width // 2 - 10, PH - k3.height - 6)]:
        spr_o = outline(spr, (250, 236, 180, 255) if not light else (30, 24, 30, 255))
        paste(pn, spr_o, (x, y))
    return pn

top = panel(kw, qw, pw, True)
bot = panel(kb, qb, pb, False).rotate(180)
pw_, ph_ = top.size
px = (W - pw_) // 2
y0 = 22
y1 = H - 22 - ph_
for img, yy_ in [(top, y0), (bot, y1)]:
    d.rectangle((px - 3, yy_ - 3, px + pw_ + 2, yy_ + ph_ + 2), fill=GOLD_D)
    d.rectangle((px - 2, yy_ - 2, px + pw_ + 1, yy_ + ph_ + 1), fill=GOLD)
    d.rectangle((px - 1, yy_ - 1, px + pw_, yy_ + ph_), fill=INK)
    paste(im, img, (px, yy_))
pw = pw_
# Mittelband
my = H // 2
d.rectangle((px - 3, my - 9, px + pw + 2, my + 8), fill=GOLD_D)
d.rectangle((px - 2, my - 8, px + pw + 1, my + 7), fill=RED)
d.line((px - 2, my - 6, px + pw + 1, my - 6), fill=GOLD); d.line((px - 2, my + 5, px + pw + 1, my + 5), fill=GOLD)
t = text_img('KING OF KINGS', 10, (255, 240, 200, 255))
paste(im, t, (W // 2 - t.width // 2, my - t.height // 2))


def crown(col, dark):
    c = Image.new('RGBA', (11, 9), (0, 0, 0, 0))
    dd = ImageDraw.Draw(c)
    dd.polygon([(0, 2), (2, 5), (5, 0), (8, 5), (10, 2), (10, 8), (0, 8)], fill=col)
    dd.line((0, 8, 10, 8), fill=dark)
    dd.point([(0, 1), (5, 0), (10, 1)], fill=(255, 220, 90))
    dd.point([(3, 6), (7, 6)], fill=(200, 40, 60))
    return c


def index(color):
    ic = Image.new('RGBA', (20, 36), (0, 0, 0, 0))
    t = text_img('K', 16, color)
    paste(ic, t, (10 - t.width // 2, 0))
    paste(ic, up(crown(color, INK), 1), (10 - 5, t.height + 4))
    return ic

ic = index(INK)
paste(im, ic, (7, 8))
paste(im, index(RED).rotate(180), (W - 7 - 20, H - 8 - 36))
# Schachbrett-Rahmen
d = ImageDraw.Draw(im)
for i in range(0, W, 5):
    c1 = INK if (i // 5) % 2 == 0 else IVORY
    d.rectangle((i, 0, i + 4, 3), fill=c1)
    c2 = INK if (i // 5) % 2 == 1 else IVORY
    d.rectangle((i, H - 4, i + 4, H - 1), fill=c2)
for j in range(0, H, 5):
    c1 = INK if (j // 5) % 2 == 0 else IVORY
    d.rectangle((0, j, 3, j + 4), fill=c1)
    c2 = INK if (j // 5) % 2 == 1 else IVORY
    d.rectangle((W - 4, j, W - 1, j + 4), fill=c2)
d.rectangle((4, 4, W - 5, H - 5), outline=GOLD_D)
print(save(im, '08_koenig_der_koenige'))
