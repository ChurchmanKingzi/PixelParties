# -*- coding: utf-8 -*-
# XX – Das Gericht: Damus, the Prophet of Apocalypse
# Damus schwebt in glühenden Wolken und Lichtstrahlen und bläst die Posaune der Apokalypse; an ihr hängt
# ein Banner mit dem Flammenbild seiner Prophezeiungstafel. Unten, zwischen Grabsteinen und Meer,
# erheben sich Skelette (Skeleton Archer, ein einfaches Skelett, Skeleton Mage) aus offenen Särgen.
from tarot_sterne_helpers import *

cv = new_card()
rnd = random.Random(20)
HOR = 222
# ---------------------------------------------------------------- Apokalyptischer Himmel
sky(cv, [(24, 8, 28), (58, 14, 40), (110, 26, 44), (170, 52, 46), (222, 104, 56), (250, 170, 90), (255, 220, 150)], y1=HOR + 4)
vignette(cv, color=(20, 4, 14), strength=0.5)
stars(cv, 40, y1=110, seed=20, cols=[(255, 220, 200), (255, 180, 160)], big=0.1)
DX, DY = 118, 96                       # Kopf von Damus
# göttliche Strahlen hinter ihm
rays(cv, DX, DY, 20, 18, 180, (255, 230, 170), width=0.07, k=0.7, mix=0.4)
rays(cv, DX, DY, 10, 18, 140, (255, 250, 220), width=0.03, k=0.6, mix=0.35, phase=0.16)
glow(cv, DX, DY + 10, 80, (255, 210, 140), k=0.55, mix=0.3)
glow(cv, DX, DY, 40, (255, 240, 200), k=0.6, mix=0.35)
# ferne, dunkle Wolkenbänder
CL_D = [(40, 14, 34), (70, 26, 48), (110, 46, 60), (160, 80, 70), (210, 130, 90)]
def cloud_mass(parts, ramp, shade=(40, 10, 30), k=0.55):
    """mehrere Kumuli übereinander; unten gedithert abgedunkelt (Gewitterwolke)"""
    for (cx_, cy_, w_, h_, sd) in parts:
        M = puffy_cloud(cv, cx_, cy_, w_, h_, ramp, seed=sd)
        ys_ = np.where(M.any(1))[0]
        if len(ys_) == 0:
            continue
        y0_, y1_ = ys_.min(), ys_.max()
        for y, x in zip(*np.where(M)):
            t_ = (y - y0_) / max(1, y1_ - y0_)
            if t_ > 0.45 and BAYER4[y % 4, x % 4] < (t_ - 0.45) * 2 * k:
                blend_px(cv, x, y, shade, 0.45)
cloud_mass([(36, 76, 46, 16, 1), (58, 66, 40, 18, 5), (26, 60, 30, 12, 6)], CL_D)
cloud_mass([(214, 70, 46, 16, 2), (192, 60, 40, 16, 7), (226, 56, 26, 11, 8)], CL_D)
cloud_mass([(30, 136, 44, 12, 3), (220, 130, 44, 12, 4)], CL_D)

# ---------------------------------------------------------------- Berge und Meer am Horizont
MTN = [(26, 8, 24), (46, 16, 34), (72, 28, 44), (110, 50, 56), (180, 96, 70)]
def mtn_top(x):
    return HOR - max(0, 34 - abs(x - 28) * 0.75) - max(0, 28 - abs(x - 222) * 0.7) - max(0, 10 - abs(x - 70) * 0.4) \
        - max(0, 9 - abs(x - 178) * 0.35) - 2.5 * math.sin(x * 0.31)
for x in range(AX0, AX1):
    top = mtn_top(x)
    for y in range(int(top), HOR + 1):
        v = 0.7 - (y - top) / 22 + (0.18 if (x - 28) * (x - 222) < 0 and x < 125 else 0)
        px(cv, x, y, rampc(MTN, v, x, y))
    # vom Himmelslicht angestrahlte Grate
    px(cv, x, int(top), MTN[4]); px(cv, x, int(top) + 1, MTN[3] if x % 2 else MTN[2])
SEA = [(24, 8, 26), (60, 20, 40), (120, 50, 54), (200, 110, 76), (255, 200, 140), (255, 240, 200)]
SEA_Y1 = HOR + 14
for y in range(HOR - 4, SEA_Y1):
    for x in range(AX0, AX1):
        if y < mtn_top(x) + 0 and y < HOR:
            continue
        if y < HOR and y >= mtn_top(x):
            continue
        v = 0.5 - (y - HOR) / 14 * 0.3
        if math.sin(y * 2.3 + math.sin(x * 0.25) * 2.2) > 0.75:
            v += 0.3                        # Wellenkämme
        if abs(x - DX) < 30 - (y - HOR) * 0.8 and (x + 2 * y) % 3 != 0:
            v += 0.35                       # Glanzpfad des göttlichen Lichts
        px(cv, x, y, rampc(SEA, v, x, y))
# Brandung an der Küstenlinie
for x in range(AX0, AX1):
    if x % 3:
        px(cv, x, SEA_Y1 - 1, SEA[4] if (x // 3) % 2 else SEA[3])

# ---------------------------------------------------------------- Friedhofsboden
EARTH = [(18, 8, 14), (36, 18, 24), (58, 30, 32), (86, 48, 42), (120, 74, 56), (160, 108, 76)]
gn = noise(H, W, 4, seed=5)
gn2 = noise(H, W, 9, seed=6)
for y in range(SEA_Y1, AY1):
    for x in range(AX0, AX1):
        t_ = (y - SEA_Y1) / (AY1 - SEA_Y1)
        v = 0.5 - t_ * 0.18 + (gn[y, x] - 0.5) * 0.5 + (gn2[y, x] - 0.5) * 0.3
        px(cv, x, y, rampc(EARTH, v, x, y))
for x in range(AX0, AX1):
    px(cv, x, SEA_Y1, (30, 12, 20)); px(cv, x, SEA_Y1 + 1, EARTH[4] if x % 2 else EARTH[3])
# Steinchen im Boden
for _ in range(90):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(SEA_Y1 + 3, AY1 - 1)
    px(cv, x, y, EARTH[4]); px(cv, x + 1, y + 1, EARTH[0])

GRASS_D = [(40, 30, 16), (72, 60, 28), (110, 96, 40), (156, 132, 60), (206, 170, 90)]
def tuft(x, y, n=5, h=6, seed=0):
    """Grasbüschel: fächerförmige, verdorrte Halme mit Streiflicht"""
    rr = random.Random(seed)
    for i in range(n):
        a = -math.pi / 2 + (i - (n - 1) / 2) * 0.32 + rr.uniform(-0.1, 0.1)
        L = h * rr.uniform(0.6, 1.0)
        for k in range(int(L) + 1):
            t_ = k / max(1, L)
            bx = x + math.cos(a) * k + (t_ ** 2) * (i - n / 2) * 0.6; by = y + math.sin(a) * k
            px(cv, bx, by, GRASS_D[1 + min(3, int(t_ * 3.5))] if (i % 2 == 0) else GRASS_D[min(3, int(t_ * 3))])
    px(cv, x - 1, y + 1, GRASS_D[0]); px(cv, x, y + 1, GRASS_D[0]); px(cv, x + 1, y + 1, GRASS_D[0])

TOMB = [(34, 26, 44), (64, 56, 80), (100, 92, 118), (142, 134, 158), (188, 180, 202), (226, 220, 236)]
def tomb_relief(x, y, w, h, kind='round', tilt=0.0, seed=0, moss=True):
    """Grabstein als Relief: gewölbte Platte mit eingraviertem Kreuz und Randrille"""
    M = np.zeros((H, W), np.uint8)
    if kind == 'cross':
        cv2.rectangle(M, (int(x - w * 0.18), int(y - h)), (int(x + w * 0.18), int(y)), 1, -1)
        cv2.rectangle(M, (int(x - w / 2), int(y - h * 0.75)), (int(x + w / 2), int(y - h * 0.75 + w * 0.34)), 1, -1)
    else:
        cv2.rectangle(M, (int(x - w / 2), int(y - h + w / 2)), (int(x + w / 2), int(y)), 1, -1)
        cv2.ellipse(M, (int(x), int(y - h + w / 2)), (int(w / 2), int(w / 2)), 0, 180, 360, 1, -1)
    if tilt:
        ys, xs = np.where(M > 0)
        M2 = np.zeros_like(M)
        xs2 = np.clip(np.round(xs + (y - ys) * tilt).astype(int), 0, W - 1)
        M2[ys, xs2] = 1
        M = cv2.morphologyEx(M2, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8))
    d = cv2.distanceTransform(np.pad(M, 1), cv2.DIST_L2, 3)[1:-1, 1:-1]
    Hh = np.sqrt(np.minimum(d, 3) / 3) * 2.2
    Hh += (noise(H, W, 2, seed=seed) - 0.5) * 0.9
    if kind != 'cross':
        # eingraviertes Kreuz + Randrille
        cx_ = x + tilt * h * 0.45
        yy, xx = np.indices((H, W))
        cross = ((np.abs(xx - cx_) < 1.0) & (yy > y - h + w * 0.45) & (yy < y - h * 0.3)) | \
                ((np.abs(yy - (y - h + w * 0.8)) < 1.0) & (np.abs(xx - cx_) < w * 0.22))
        Hh -= cross * 1.4
        Hh -= ((d > 2.2) & (d < 3.2)) * 0.6
    Mb = (M > 0) & (np.indices((H, W))[0] >= AY0)
    relief(cv, Hh, np.zeros((H, W), np.int32), [TOMB], Mb, k=1.5, bias=0.02)
    ring = cv2.dilate(M, np.ones((3, 3), np.uint8)) > 0
    for yy_, xx_ in zip(*np.where(ring & ~Mb)):
        if in_art(xx_, yy_):
            px(cv, xx_, yy_, (14, 8, 16))
    rr = random.Random(seed)
    if moss:
        for _ in range(int(w * 1.4)):
            ys, xs = np.where(Mb)
            i = rr.randrange(len(ys))
            if ys[i] > y - h * 0.4 or rr.random() < 0.2:
                px(cv, xs[i], ys[i], rr.choice([(60, 80, 40), (90, 110, 50), (40, 58, 30)]))
    # Erdsockel + Gras
    for k in range(-w // 2 - 3, w // 2 + 4):
        px(cv, x + k, y + 1, EARTH[1]); px(cv, x + k, y + 2, EARTH[0] if k % 2 else EARTH[1])
    tuft(x - w // 2 - 1, y + 1, 4, 5, seed); tuft(x + w // 2 + 1, y + 1, 3, 4, seed + 1)

# hintere Grabsteine (klein, im Dunst) und vordere (groß, mit Relief)
for (x, y, w, h, kd, tl, sd) in [(40, 244, 8, 12, 'round', 0.1, 1), (86, 241, 7, 10, 'cross', 0, 2), (112, 243, 7, 10, 'round', -0.1, 3),
                                 (148, 242, 8, 11, 'round', 0.08, 4), (170, 241, 7, 11, 'cross', 0, 5), (214, 244, 8, 12, 'round', -0.12, 6)]:
    tomb_relief(x, y, w, h, kd, tl, sd, moss=False)
fog(cv, SEA_Y1 - 2, SEA_Y1 + 22, (200, 120, 110), k=1.8, seed=21, mix=0.35)
for (x, y, w, h, kd, tl, sd) in [(24, 268, 12, 22, 'round', -0.12, 7), (92, 262, 11, 18, 'cross', 0.06, 8),
                                 (160, 262, 12, 19, 'round', 0.1, 9), (228, 270, 12, 24, 'cross', -0.08, 10)]:
    tomb_relief(x, y, w, h, kd, tl, sd)
# Grasbüschel über den Boden verteilt
for i in range(46):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(SEA_Y1 + 6, AY1 - 1)
    tuft(x, y, rnd.randint(3, 6), rnd.randint(3, 7), 100 + i)

# ---------------------------------------------------------------- Wolkenbank unter Damus
CL = [(70, 30, 54), (120, 60, 74), (186, 110, 96), (236, 170, 126), (255, 222, 176), (255, 244, 220)]

# ---------------------------------------------------------------- Damus
ROBE = [(70, 52, 40), (120, 96, 72), (170, 146, 112), (210, 190, 150), (236, 222, 188), (250, 244, 220)]
MANTLE = [(26, 12, 10), (52, 28, 16), (86, 50, 28), (124, 78, 44), (162, 110, 66)]
BEARD = [(110, 104, 120), (160, 156, 172), (206, 204, 216), (236, 236, 244), (255, 255, 255)]
SKIN_O = [(80, 40, 34), (140, 80, 60), (196, 128, 96), (230, 170, 132), (248, 206, 170), (255, 232, 206)]
BAN = [(90, 24, 10), (170, 60, 20), (230, 120, 30), (255, 180, 60), (255, 230, 130)]
d = Fig(W, H)
# Posaune (lange Herold-Trompete), schräg nach rechts unten gerichtet
m0 = (DX + 3, DY + 11)                 # Mundstück
ang = math.radians(30)
ux, uy = math.cos(ang), math.sin(ang)
TL = 86
bell = (m0[0] + ux * TL, m0[1] + uy * TL)
nx_, ny_ = -uy, ux
T = lambda t_: (m0[0] + ux * t_, m0[1] + uy * t_)
# Umhang (hinten) + Robe
d.part('mantle')
d.poly([(DX - 20, DY + 14), (DX - 30, DY + 30), (DX - 42, DY + 70), (DX - 50, DY + 106), (DX + 50, DY + 106), (DX + 42, DY + 70),
        (DX + 30, DY + 30), (DX + 20, DY + 14)], 'm')
d.part('robe')
d.poly([(DX - 17, DY + 20), (DX + 17, DY + 20), (DX + 24, DY + 50), (DX + 32, DY + 106), (DX - 32, DY + 106), (DX - 24, DY + 50)], 'r')
d.part('trim')
d.poly([(DX - 3, DY + 22), (DX + 3, DY + 22), (DX + 4, DY + 106), (DX - 4, DY + 106)], 'g')
d.part('sash'); d.poly([(DX - 21, DY + 46), (DX + 21, DY + 46), (DX + 22, DY + 51), (DX - 22, DY + 51)], 'N')
d.part('collarL'); d.poly([(DX - 14, DY + 8), (DX - 24, DY - 2), (DX - 27, DY + 14), (DX - 18, DY + 22)], 'm')
d.part('collarR'); d.poly([(DX + 14, DY + 8), (DX + 24, DY - 2), (DX + 27, DY + 14), (DX + 18, DY + 22)], 'm')
# Arme (Ärmel), beide Hände an der Posaune
hL = T(15); hR = T(46)
d.part('armL'); d.limb(DX - 16, DY + 26, DX - 8, DY + 44, 6, 5.4, 'r')
d.part('foreL'); d.limb(DX - 8, DY + 44, hL[0] - 2, hL[1] + 4, 5.4, 4.6, 'r')
d.part('armR'); d.limb(DX + 18, DY + 24, DX + 30, DY + 46, 6, 5.4, 'r')
d.part('foreR'); d.limb(DX + 30, DY + 46, hR[0] - 2, hR[1] + 4, 5.4, 4.6, 'r')
# Kopf
d.part('face')
d.ellipse(DX, DY, 15, 16, 's')
d.part('ears'); d.ellipse(DX - 15, DY + 2, 2.8, 4.5, 's'); d.ellipse(DX + 15, DY + 2, 2.8, 4.5, 's')
d.part('hair')                          # wilde weiße Haarbüschel (Glatze oben, Zacken wie im Sprite)
for (a, L) in [(-150, 9), (-128, 12), (-108, 10), (-72, 10), (-52, 12), (-30, 9), (-170, 7), (-10, 7)]:
    ar = math.radians(a)
    bx, by = DX + math.cos(ar) * 13, DY - 2 + math.sin(ar) * 13
    tx, ty = DX + math.cos(ar) * (13 + L), DY - 2 + math.sin(ar) * (13 + L)
    d.poly([(bx - math.sin(ar) * 3.6, by + math.cos(ar) * 3.6), (tx, ty), (bx + math.sin(ar) * 3.6, by - math.cos(ar) * 3.6)], 'w')
d.ellipse(DX - 14, DY - 3, 4, 7, 'w'); d.ellipse(DX + 14, DY - 3, 4, 7, 'w')
d.part('cheeks')                        # aufgeblasene Backen beim Blasen
d.ellipse(DX - 8, DY + 7, 4.5, 4, 's'); d.ellipse(DX + 8, DY + 7, 4.5, 4, 's')
d.part('beard')                         # langer, spitzer Bart
d.poly([(DX - 15, DY + 3), (DX - 14, DY + 14), (DX - 10, DY + 28), (DX - 4, DY + 40), (DX, DY + 48), (DX + 3, DY + 38), (DX + 9, DY + 26),
        (DX + 14, DY + 14), (DX + 15, DY + 3), (DX + 11, DY + 12), (DX + 4, DY + 12), (DX, DY + 13), (DX - 4, DY + 12), (DX - 11, DY + 12)], 'w')
d.part('mustache')
d.poly([(DX - 12, DY + 12), (DX - 6, DY + 8), (DX - 1, DY + 7), (DX + 3, DY + 7), (DX + 9, DY + 9), (DX + 5, DY + 12), (DX + 1, DY + 10),
        (DX - 3, DY + 11), (DX - 8, DY + 14)], 'w')
d.part('browL'); d.poly([(DX - 13, DY - 6), (DX - 3, DY - 2), (DX - 3, DY + 1), (DX - 8, DY - 1), (DX - 14, DY - 2)], 'w')
d.part('browR'); d.poly([(DX + 13, DY - 6), (DX + 3, DY - 2), (DX + 3, DY + 1), (DX + 8, DY - 1), (DX + 14, DY - 2)], 'w')
# Banner hängt an zwei Kordeln unter der Posaune
bp0 = T(40); bp1 = T(64)
d.part('cord', line=False)
d.line(bp0[0], bp0[1], bp0[0], bp0[1] + 6, 'g', w=1); d.line(bp1[0], bp1[1], bp1[0], bp1[1] + 6, 'g', w=1)
d.part('banner')
top0 = (bp0[0], bp0[1] + 5); top1 = (bp1[0], bp1[1] + 5)
bpts = [top0]
for i in range(1, 11):
    t_ = i / 10
    bpts.append((top0[0] + (top1[0] - top0[0]) * t_, top0[1] + (top1[1] - top0[1]) * t_ + math.sin(t_ * math.pi) * 1.5))
bot1 = (top1[0] + 1, top1[1] + 30); bot0 = (top0[0] - 2, top0[1] + 36)
bpts += [bot1, ((top0[0] + top1[0]) / 2 + 1, (top0[1] + top1[1]) / 2 + 24), bot0]
d.poly(bpts, 'n')
# Posaunenrohr + Schallbecher (vor dem Bart)
d.part('trumpet')
d.limb(m0[0], m0[1], bell[0] - ux * 10, bell[1] - uy * 10, 1.7, 2.3, 'g')
d.ellipse(*T(31), 3, 3, 'g')
d.ellipse(*T(1), 2.6, 2.6, 'g')
d.part('bell')
bl = []
for s_ in np.linspace(0, 1, 12):
    r = 2.2 + 10 * s_ ** 2.2
    bl.append((bell[0] - ux * (15 - s_ * 15) + nx_ * r, bell[1] - uy * (15 - s_ * 15) + ny_ * r))
br_ = [(2 * (bell[0] - ux * (15 - s_ * 15)) - x, 2 * (bell[1] - uy * (15 - s_ * 15)) - y) for s_, (x, y) in zip(np.linspace(0, 1, 12), bl)]
d.poly(bl + br_[::-1], 'g')
d.part('bellmouth')
d.poly([(bell[0] + nx_ * 12, bell[1] + ny_ * 12), (bell[0] + ux * 3 + nx_ * 9.5, bell[1] + uy * 3 + ny_ * 9.5),
        (bell[0] + ux * 3 - nx_ * 9.5, bell[1] + uy * 3 - ny_ * 9.5), (bell[0] - nx_ * 12, bell[1] - ny_ * 12)], 'y')
d.part('handL'); d.ellipse(hL[0], hL[1] + 1, 4.4, 4.2, 's')
d.part('handR'); d.ellipse(hR[0], hR[1] + 1, 4.4, 4.2, 's')
d.outline()
DM = {
    's': mat(SKIN_O, pillow=3, k=1.4, bias=0.12),
    'w': mat(BEARD, pillow=3, k=1.6, noise=1.0, nscale=2, bias=0.1),
    'r': mat(ROBE, pillow=5, k=1.4, folds=(0.4, 0.05, 0.8)),
    'm': mat(MANTLE, pillow=4, k=1.5, folds=(0.3, 0.0, 0.6)),
    'g': mat(GOLD, pillow=2, k=1.9, spec=True, spec_col=(255, 255, 230)),
    'y': mat([(60, 30, 6), (110, 60, 14), (170, 100, 24)], pillow=2, k=1.2),
    'n': mat(BAN, pillow=4, k=1.3, folds=(0.0, 0.3, 0.8), bias=0.05),
    'N': mat(RED_CLOTH, pillow=2, k=1.4),
}
drgba = d.render(DM)
cv.paste(drgba, 0, 0)
DMk = drgba[..., 3] > 0
# Flammenbild auf dem Banner (wie auf der Tafel des Propheten) + dunkle Randlinie
BM = d.L == 'n'
ys, xs = np.where(BM)
bx0, bx1 = xs.min(), xs.max()
for y, x in zip(ys, xs):
    if tuple(cv.a[y, x]) == OUT:
        continue
    u = (x - bx0) / max(1, bx1 - bx0)
    edge = not (BM[y - 2, x] and BM[y + 2, x] and BM[y, x - 2] and BM[y, x + 2])
    if edge:
        px(cv, x, y, (70, 14, 10) if (x + y) % 2 else (110, 24, 14))
        continue
    fl = math.sin(u * 9 + math.sin(y * 0.4) * 1.2)
    v = 0.45 + fl * 0.35 + (y - ys.min()) / 40 * 0.2
    px(cv, x, y, rampc(FIRE, v, x, y))
# Gesicht: rote, zusammengekniffene Augen unter den buschigen Brauen
for ex in (DX - 7, DX + 7):
    for dx in range(-2, 3):
        px(cv, ex + dx, DY + 2, (50, 14, 14))
    px(cv, ex, DY + 2, (230, 36, 44)); px(cv, ex + (1 if ex > DX else -1), DY + 2, (150, 20, 30))
    px(cv, ex - 2, DY + 3, SKIN_O[1]); px(cv, ex + 2, DY + 3, SKIN_O[1])
# Nase
px(cv, DX, DY + 3, SKIN_O[2]); px(cv, DX + 1, DY + 4, SKIN_O[1]); px(cv, DX - 1, DY + 6, SKIN_O[1]); px(cv, DX, DY + 6, SKIN_O[2]); px(cv, DX + 1, DY + 6, SKIN_O[1])
# Stirnfalten
for dx in range(-5, 6):
    if dx % 3:
        px(cv, DX + dx, DY - 9, SKIN_O[2])
        px(cv, DX + dx + 1, DY - 11, SKIN_O[2])
# Bartsträhnen
for (x0, y0, x1, y1) in [(DX - 6, DY + 14, DX - 3, DY + 32), (DX, DY + 13, DX, DY + 38), (DX + 5, DY + 14, DX + 2, DY + 30),
                         (DX - 9, DY + 12, DX - 6, DY + 22)]:
    for t_ in np.linspace(0, 1, 16):
        x = x0 + (x1 - x0) * t_; y = y0 + (y1 - y0) * t_
        if d.L[int(y), int(round(x))] == 'w' and tuple(cv.a[int(y), int(round(x))]) != OUT:
            px(cv, x, y, BEARD[1])
# Glanz auf der Glatze
for (x, y) in [(DX - 5, DY - 13), (DX - 4, DY - 14), (DX - 3, DY - 14), (DX - 6, DY - 12)]:
    px(cv, x, y, SKIN_O[5])
# Finger um die Posaune
for (hx, hy) in (hL, hR):
    for j in (-2, 0, 2):
        px(cv, hx + j * 0.8, hy + 3, SKIN_O[1])
# Schallwellen aus der Posaune
for r in (8, 13, 18, 23):
    for a in np.linspace(-0.55, 0.55, 30):
        aa = ang + a
        x = bell[0] + math.cos(aa) * r; y = bell[1] + math.sin(aa) * r
        if in_art(x, y) and not DMk[int(y), int(x)] and (int((a + 1) * 30) % 4):
            blend_px(cv, x, y, (255, 240, 200), 0.6 if r < 16 else 0.4)

# Wolken vor dem unteren Körper
cloud_mass([(50, 194, 50, 16, 11), (200, 196, 50, 14, 12), (82, 198, 60, 20, 16), (166, 200, 64, 20, 17), (122, 206, 92, 22, 13)],
           CL, shade=(70, 20, 40), k=0.7)
# Lichtsaum auf den Wolken
glow(cv, DX, 190, 50, (255, 230, 180), k=0.4, mix=0.25)

# ---------------------------------------------------------------- Skelette erheben sich aus Sarg und Gräbern
WOOD = [(22, 10, 8), (46, 24, 14), (78, 44, 24), (112, 70, 38), (150, 100, 58), (186, 136, 84)]
WOOD_D = [(14, 6, 6), (30, 16, 10), (54, 30, 18), (80, 48, 28), (108, 70, 42)]
HOOD_G = [(8, 24, 12), (18, 50, 22), (30, 84, 34), (50, 120, 50), (90, 160, 80)]
HOOD_B = [(30, 16, 10), (60, 34, 18), (96, 58, 30), (134, 88, 50), (170, 124, 76)]
SK = [(40, 32, 30), (96, 84, 72), (150, 138, 116), (200, 190, 164), (234, 228, 206), (252, 250, 238)]
MATS_S = {'B': mat(SK, pillow=2, k=1.6, bias=0.12, spec=True, spec_col=(255, 255, 245)),
          'l': mat(WOOD, pillow=2, k=1.5, folds=(0.05, 1.3, 0.3), noise=0.6, nscale=1, bias=0.12),
          'L': mat(WOOD_D, pillow=2, k=1.3, folds=(0.0, 1.1, 0.4), noise=0.5, nscale=1),
          'i': mat([(8, 2, 4), (20, 8, 10), (36, 16, 16)], pillow=3, k=1),
          'g': mat(HOOD_G, pillow=3, k=1.5, folds=(0.4, 0.2, 0.4)), 'h': mat(HOOD_B, pillow=3, k=1.5, folds=(0.4, 0.2, 0.4)),
          'w': mat(BROWN, pillow=1.5, k=1.2), 'a': mat(SILVER, pillow=1, k=1.2),
          'e': mat(EARTH, pillow=3, k=1.6, noise=1.2, nscale=1, bias=0.05)}

def skeleton(f, cx, by, sc=1.0, pose='up', hood=None, flip=1):
    """Oberkörper eines Skeletts, das sich erhebt. by = Höhe des Sargrands"""
    S = lambda v: v * sc
    X = lambda x: cx + flip * S(x)
    # Wirbelsäule + Becken (im Sarg halb verborgen)
    f.part('spine%d' % cx); f.limb(cx, by + 2, cx, by - S(22), S(1.8), S(1.8), 'B')
    # Rippen
    f.part('ribs%d' % cx)
    for i in range(4):
        yy = by - S(20) + S(i * 4.2)
        rw = S(8.5 - i * 0.6)
        for s in (-1, 1):
            f.curve([(cx, yy), (cx + s * rw * 0.6, yy - S(1)), (cx + s * rw, yy + S(2)), (cx + s * rw * 0.85, yy + S(4.2))], 'B', w=S(1.6))
    f.part('sternum%d' % cx); f.limb(cx, by - S(21), cx, by - S(8), S(1.4), S(1.2), 'B')
    # Schlüsselbeine
    f.part('clav%d' % cx); f.line(cx - S(9), by - S(22), cx + S(9), by - S(22), 'B', w=max(2, int(S(2))))
    # Arme
    if pose == 'up':
        arms = [((-9, -22), (-15, -34), (-17, -48)), ((9, -22), (15, -34), (17, -48))]
    elif pose == 'bow':
        arms = [((-9, -22), (-18, -30), (-24, -40)), ((9, -22), (16, -32), (18, -45))]
    else:     # 'cast': ein Arm hoch, einer vorgestreckt
        arms = [((-9, -22), (-16, -32), (-14, -46)), ((9, -22), (17, -26), (25, -32))]
    for i, (sh, el, ha) in enumerate(arms):
        f.part('ua%d_%d' % (cx, i)); f.limb(X(sh[0]), by + S(sh[1]), X(el[0]), by + S(el[1]), S(2), S(1.7), 'B')
        f.part('fa%d_%d' % (cx, i)); f.limb(X(el[0]), by + S(el[1]), X(ha[0]), by + S(ha[1]), S(1.7), S(1.4), 'B')
        f.part('hd%d_%d' % (cx, i)); f.ellipse(X(ha[0]), by + S(ha[1]) - S(1), S(2.4), S(2.4), 'B')
        for k in (-1, 0, 1):
            f.limb(X(ha[0]), by + S(ha[1]) - S(1), X(ha[0] + k * 2.4), by + S(ha[1]) - S(5.5) + abs(k) * S(1), S(0.7), S(0.6), 'B')
    if hood:
        f.part('hoodback%d' % cx)
        f.ellipse(cx, by - S(34), S(11.5), S(11), hood)
        f.poly([(cx - S(11.5), by - S(34)), (cx - S(13), by - S(20)), (cx + S(13), by - S(20)), (cx + S(11.5), by - S(34))], hood)
    # Schädel (chibi-groß)
    f.part('skull%d' % cx)
    f.ellipse(cx, by - S(33), S(8.5), S(8), 'B')
    f.part('jaw%d' % cx)
    f.poly([(cx - S(5), by - S(27)), (cx + S(5), by - S(27)), (cx + S(4), by - S(22.5)), (cx - S(4), by - S(22.5))], 'B')
    if hood:
        f.part('hoodbrim%d' % cx)
        f.ellipse(cx, by - S(33), S(8.6), S(8.1), hood, only='B')
        f.ellipse(cx, by - S(31), S(6.8), S(6.2), 'B', only=hood)
        f.part('cape%d' % cx)
        f.poly([(cx - S(9), by - S(24)), (cx + S(9), by - S(24)), (cx + S(11), by - S(19)), (cx + S(4), by - S(20)), (cx, by - S(17)),
                (cx - S(4), by - S(20)), (cx - S(11), by - S(19))], hood)
    return (cx, by - S(33))


def coffin_back(f, cx, by, w):
    """Sarg in Perspektive (Längsachse in die Tiefe): Seitenwände, Rand und dunkles Inneres"""
    hw_far, hw_sh, hw_near = w * 0.3, w * 0.5, w * 0.36
    yf, ysh, yn = by - 14, by - 6, by + 9
    f.part('cside%d' % cx)
    f.poly([(cx - hw_sh - 1, ysh), (cx - hw_near - 1, yn + 1), (cx + hw_near + 1, yn + 1), (cx + hw_sh + 1, ysh),
            (cx + hw_sh + 1, ysh + 7), (cx + hw_near + 1, yn + 9), (cx - hw_near - 1, yn + 9), (cx - hw_sh - 1, ysh + 7)], 'L')
    f.part('crim%d' % cx)
    f.poly([(cx - hw_far - 2, yf - 2), (cx + hw_far + 2, yf - 2), (cx + hw_sh + 2, ysh), (cx + hw_near + 2, yn + 2),
            (cx - hw_near - 2, yn + 2), (cx - hw_sh - 2, ysh)], 'l')
    f.part('cin%d' % cx)
    f.poly([(cx - hw_far, yf), (cx + hw_far, yf), (cx + hw_sh - 1, ysh), (cx + hw_near - 1, yn),
            (cx - hw_near + 1, yn), (cx - hw_sh + 1, ysh)], 'i')

def coffin_front(f, cx, by, w):
    """vorderer Rand über dem Becken, damit das Skelett im Sarg sitzt"""
    hw_sh, hw_near = w * 0.5, w * 0.36
    ysh, yn = by - 6, by + 9
    f.part('cfront%d' % cx)
    f.poly([(cx - hw_sh * 0.85, by - 1), (cx + hw_sh * 0.85, by - 1), (cx + hw_near + 2, yn + 2), (cx - hw_near - 2, yn + 2)], 'i')
    f.poly([(cx - hw_near - 2, yn - 1), (cx + hw_near + 2, yn - 1), (cx + hw_near + 2, yn + 2), (cx - hw_near - 2, yn + 2)], 'l')
    f.poly([(cx - hw_sh - 2, ysh), (cx - hw_sh + 1, ysh), (cx - hw_near + 1, yn), (cx - hw_near - 2, yn + 2)], 'l')
    f.poly([(cx + hw_sh + 2, ysh), (cx + hw_sh - 1, ysh), (cx + hw_near - 1, yn), (cx + hw_near + 2, yn + 2)], 'l')

def grave_hole(f, cx, by, w):
    """aufgebrochener Grabhügel: Erdwall mit dunklem Loch"""
    f.part('mound%d' % cx)
    f.ellipse(cx, by + 3, w * 0.62, 10, 'e')
    f.part('hole%d' % cx)
    f.ellipse(cx, by + 1, w * 0.42, 5.5, 'i')

def grave_front(f, cx, by, w):
    f.part('lip%d' % cx)
    f.ellipse(cx, by + 6, w * 0.5, 4.5, 'e', a0=0, a1=180)
    f.ellipse(cx, by + 3, w * 0.42, 2.5, 'e', a0=0, a1=180)

LAYOUT = [(58, 276, 36, 1.35, 'bow', 'g', 'grave'), (125, 286, 42, 1.6, 'up', None, 'coffin'), (199, 276, 36, 1.35, 'cast', 'h', 'grave')]
# Sargdeckel, abgehoben und schräg neben den Sarg gekippt (mit geschnitztem Kreuz)
lf = Fig(W, H)
lc = (96, 290); la = math.radians(-24)
hexl = [(-6, -17), (6, -17), (10, -9), (7, 17), (-7, 17), (-10, -9)]
lf.part('lidside'); lf.poly([(lc[0] + (x * math.cos(la) - y * math.sin(la)) + 1.5, lc[1] + (x * math.sin(la) + y * math.cos(la)) + 3) for (x, y) in hexl], 'L')
lf.part('lid'); lf.poly([(lc[0] + x * math.cos(la) - y * math.sin(la), lc[1] + x * math.sin(la) + y * math.cos(la)) for (x, y) in hexl], 'l')
lf.outline()
cv.paste(lf.render(MATS_S), 0, 0)
for (x0, y0, x1, y1) in [(0, -11, 0, 9), (-5, -5, 5, -5)]:
    for t_ in np.linspace(0, 1, 20):
        x = x0 + (x1 - x0) * t_; y = y0 + (y1 - y0) * t_
        X = lc[0] + x * math.cos(la) - y * math.sin(la); Y = lc[1] + x * math.sin(la) + y * math.cos(la)
        px(cv, X, Y, WOOD[1]); px(cv, X + 1, Y, WOOD[4])
heads = {}
for (cx, by, w, sc, pose, hood, kind) in LAYOUT:
    f = Fig(W, H)
    if kind == 'coffin':
        coffin_back(f, cx, by, w)
    else:
        grave_hole(f, cx, by, w)
    heads[cx] = skeleton(f, cx, by + 3, sc, pose, hood, flip=(-1 if pose == 'cast' else 1))
    if pose == 'bow':
        # Bogen des Skeleton Archer (hoch erhoben)
        hx, hy = cx - 24 * sc, by + 3 - 41 * sc
        f.part('bow%d' % cx, line=True)
        f.curve([(hx + 3, hy - 17), (hx - 5, hy - 5), (hx - 5, hy + 6), (hx + 4, hy + 17)], 'w', w=2.6)
        f.part('string%d' % cx, line=False); f.line(hx + 3, hy - 17, hx + 4, hy + 17, 'a', w=1)
        f.part('feather%d' % cx); f.curve([(cx + 8, by - 44), (cx + 15, by - 54), (cx + 22, by - 57)], 'g', w=3.2, w1=1)
    if kind == 'coffin':
        coffin_front(f, cx, by, w)
    else:
        grave_front(f, cx, by, w)
    f.outline()
    rg = f.render(MATS_S)
    cv.paste(rg, 0, 0)
    # Holzmaserung / Erdschichten
    if kind == 'coffin':
        for y in range(by - 20, by + 20):
            for x in range(cx - w // 2 - 3, cx + w // 2 + 4):
                if f.L[y, x] in ('l', 'L') and tuple(cv.a[y, x]) != OUT:
                    g = math.sin((x - cx) * 0.25 + math.sin(y * 0.7) * 1.6 + y * 0.05)
                    if g > 0.85:
                        px(cv, x, y, WOOD[1] if f.L[y, x] == 'l' else WOOD_D[0])
        for (dx, dy) in [(-15, 3), (15, 3), (-10, 13), (10, 13), (0, 15)]:
            px(cv, cx + dx, by + dy, GOLD[3]); px(cv, cx + dx + 1, by + dy + 1, GOLD[1])
    else:
        STRATA = [(90, 40, 30), (60, 30, 30), (120, 80, 50), (40, 20, 24)]
        for y in range(by - 5, by + 6):
            for x in range(cx - w // 2, cx + w // 2 + 1):
                if f.L[y, x] == 'e' and y < by + 3 and tuple(cv.a[y, x]) != OUT:
                    if (y + int(2 * math.sin(x * 0.4))) % 3 == 0:
                        px(cv, x, y, STRATA[((y + x // 7) % 4)])
    # Augenhöhlen + leuchtende Augen
    hx, hy = heads[cx]
    eye = {'g': (90, 255, 90), 'h': (200, 140, 255), None: (255, 130, 60)}[hood]
    for s_ in (-1, 1):
        ex, ey = int(round(hx + s_ * 3.6 * sc)), int(round(hy + 1))
        glow(cv, ex, ey, 6, eye, k=0.6, mix=0.22)
        rx_e, ry_e = 2.3 * sc / 1.35, 2.6 * sc / 1.35
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if (dx / rx_e) ** 2 + ((dy - 0.5) / ry_e) ** 2 <= 1:
                    px(cv, ex + dx, ey + dy, (14, 8, 12))
        px(cv, ex, ey, eye); px(cv, ex, ey + 1, lerp(eye, (0, 0, 0), 0.4)); px(cv, ex + s_, ey, lerp(eye, (255, 255, 255), 0.4))
    for (dx, dy) in [(0, 0), (-1, 1), (0, 1), (1, 1)]:
        px(cv, hx + dx, hy + 5 * sc + dy, (14, 8, 12))
    ty_ = hy + (8 if hood is None else 5.2) * sc
    for dx in range(-4, 5):
        if dx % 2 == 0:
            px(cv, hx + dx * sc * (0.8 if hood is None else 0.55), ty_, (60, 50, 44))
    # Risslinie im Schädel
    px(cv, hx + 3 * sc, hy - 6 * sc, SK[1]); px(cv, hx + 4 * sc, hy - 5 * sc, SK[1]); px(cv, hx + 4 * sc, hy - 4 * sc, SK[1])

# Erdbrocken fliegen aus den aufgebrochenen Gräbern
CLOD = [(30, 14, 18), (70, 40, 36), (110, 70, 52), (150, 104, 72)]
for (cx, by) in [(58, 276), (199, 276)]:
    rr = random.Random(cx)
    for i in range(9):
        a = rr.uniform(-2.8, -0.35); d = rr.uniform(16, 30)
        x = cx + math.cos(a) * d * 1.1; y = by + 2 + math.sin(a) * d * 0.8
        r = rr.choice((1.3, 1.8, 2.3))
        for yy in range(int(y - r) - 1, int(y + r) + 2):
            for xx in range(int(x - r) - 1, int(x + r) + 2):
                dd = math.hypot(xx - x, yy - y)
                if dd <= r:
                    px(cv, xx, yy, rampc(CLOD, 0.9 - (yy - y + r) / (2 * r + 0.1) * 0.8, xx, yy))
                elif dd <= r + 1 and in_art(xx, yy):
                    px(cv, xx, yy, (14, 8, 12))
        # Bewegungsspur
        for k in range(1, 3):
            blend_px(cv, x - math.cos(a) * (r + 1 + k), y - math.sin(a) * (r + 1 + k) * 0.8, CLOD[2], 0.5)

# verstreute Knochen und ein Schädel im Vordergrund
def bone(x, y, ang_, L=7):
    ca, sa = math.cos(ang_), math.sin(ang_)
    for k in range(int(L) + 1):
        px(cv, x + ca * k, y + sa * k, SK[4] if k % 3 else SK[3])
        px(cv, x + ca * k + sa, y + sa * k - ca + 1, SK[2])
    for (ex, ey) in [(x, y), (x + ca * L, y + sa * L)]:
        for (dx, dy) in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
            px(cv, ex + dx * 0.9 - sa * dy * 0.5, ey + dy * 0.9 + ca * dx * 0.3, SK[4] if dy < 0 else SK[2])
    for k in range(int(L) + 1):
        px(cv, x + ca * k - sa * 1.5, y + sa * k + ca * 1.5 + 1, (20, 10, 14))
for (x, y, a_) in [(30, 296, 0.3), (160, 298, -0.2), (80, 300, 0.1), (216, 294, 2.8), (150, 284, 0.6)]:
    bone(x, y, a_)
sk_x, sk_y = 176, 292
for (dx, dy, c) in [(dx, dy, SK[4] if dy < 0 else SK[2]) for dx in range(-3, 4) for dy in range(-3, 2) if dx * dx / 12 + (dy + 1) ** 2 / 6 <= 1]:
    px(cv, sk_x + dx, sk_y + dy, c)
for (dx, dy) in [(-1, -1), (1, -1), (0, 1)]:
    px(cv, sk_x + dx, sk_y + dy, (14, 8, 12))
for dx in range(-2, 3):
    px(cv, sk_x + dx, sk_y + 2, SK[3] if dx % 2 else (14, 8, 12))
# Magie in der Hand des Skeleton Mage (Zauberhand zur Mitte)
mx_, my_ = 199 - 25 * 1.35, 279 - 32 * 1.35
glow(cv, mx_, my_ - 3, 14, (190, 110, 255), k=0.8, mix=0.4)
twinkle(cv, mx_, my_ - 4, (240, 220, 255), r=4, c2=(170, 90, 240))
for (dx, dy) in [(-7, -9), (6, -12), (9, -3), (-4, -15), (-9, 0)]:
    sparkle(cv, mx_ + dx, my_ + dy, (220, 180, 255), r=1, c2=(140, 70, 200))
# bodennaher Nebel vor allem (gedithert)
fog(cv, 268, AY1, (150, 90, 100), k=1.2, seed=33, mix=0.22)

# Staub + Funken
for _ in range(40):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(150, AY1 - 1)
    if not DMk[y, x]:
        px(cv, x, y, rnd.choice([(255, 200, 120), (255, 150, 80), (255, 230, 170)]))
glitter(cv, 20, (AX0, AY0, AX1, 150), seed=3, cols=[(255, 240, 200), (255, 220, 170)], mask=~DMk)

finish(cv, 'XX', 'DAMUS', out='20_judgement_damus', emblem=emblem_generic(
    ["..#..", ".###.", "#####", "..#..", ".###."], {'#': (255, 206, 90)}))
print('ok')
