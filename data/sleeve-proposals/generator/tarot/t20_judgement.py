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
MTN = [(30, 10, 26), (54, 20, 38), (84, 34, 48), (130, 60, 60)]
for x in range(AX0, AX1):
    top = HOR - max(0, 24 - abs(x - 30) * 0.7) - max(0, 20 - abs(x - 220) * 0.6) - 3 * math.sin(x * 0.3)
    for y in range(int(top), HOR + 1):
        px(cv, x, y, rampc(MTN, 0.8 - (y - top) / 26, x, y))
SEA = [(30, 12, 30), (70, 26, 44), (130, 56, 56), (210, 120, 80), (255, 210, 150)]
SEA_Y1 = HOR + 14
for y in range(HOR - 2, SEA_Y1):
    for x in range(AX0, AX1):
        top = HOR - max(0, 24 - abs(x - 30) * 0.7) - max(0, 20 - abs(x - 220) * 0.6)
        if y < HOR and y < top:
            continue
        v = 0.55 - (y - HOR) / 14 * 0.35
        if math.sin(y * 2.1 + math.sin(x * 0.2) * 2) > 0.8:
            v += 0.3
        # Glanzpfad des Lichts
        if abs(x - DX) < 26 - (y - HOR) and (x + y) % 3 == 0:
            v += 0.3
        px(cv, x, y, rampc(SEA, v, x, y))

# ---------------------------------------------------------------- Friedhofsboden
EARTH = [(20, 10, 16), (40, 20, 26), (64, 34, 36), (94, 54, 48), (130, 80, 60)]
gn = noise(H, W, 4, seed=5)
for y in range(SEA_Y1, AY1):
    for x in range(AX0, AX1):
        v = 0.55 - (y - SEA_Y1) / (AY1 - SEA_Y1) * 0.3 + (gn[y, x] - 0.5) * 0.55
        px(cv, x, y, rampc(EARTH, v, x, y))
for x in range(AX0, AX1):
    px(cv, x, SEA_Y1, (30, 14, 22))
# spärliches, verdorrtes Gras
for _ in range(220):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(SEA_Y1 + 2, AY1 - 1)
    for k in range(rnd.randint(1, 3)):
        px(cv, x + (k if rnd.random() < 0.3 else 0), y - k, (110, 90, 50) if k else (70, 56, 36))
# Grabsteine (lavendelgrau wie in den Skelett-Karten)
TOMB = [(40, 30, 50), (76, 66, 88), (120, 110, 134), (170, 160, 182), (214, 206, 224)]
def tombstone(x, y, w, h, cross=False, tilt=0):
    f = Fig(W, H)
    if cross:
        f.part('c')
        f.rect(x - 1.5, y - h, x + 1.5, y, 's')
        f.rect(x - w / 2, y - h + h * 0.25, x + w / 2, y - h + h * 0.25 + 2.5, 's')
    else:
        f.part('t')
        f.poly([(x - w / 2 + tilt, y - h + w / 2), (x - w / 2, y), (x + w / 2, y), (x + w / 2 + tilt, y - h + w / 2)], 's')
        f.ellipse(x + tilt, y - h + w / 2, w / 2, w / 2, 's')
    f.part('base'); f.rect(x - w / 2 - 1, y - 1, x + w / 2 + 1, y + 1, 's')
    f.outline()
    cv.paste(f.render({'s': mat(TOMB, pillow=2, k=1.5, noise=0.8, nscale=2)}), 0, 0)
    if not cross:
        for k in range(3):     # eingraviertes Kreuz
            px(cv, x + tilt * 0.5, y - h + w / 2 - 1 + k, TOMB[1])
        px(cv, x - 1 + tilt * 0.5, y - h + w / 2, TOMB[1]); px(cv, x + 1 + tilt * 0.5, y - h + w / 2, TOMB[1])
for (x, y, w, h, c, tl) in [(28, 248, 10, 16, False, -1), (94, 244, 8, 12, True, 0), (156, 246, 9, 13, False, 1), (224, 252, 10, 18, True, 0),
                            (70, 240, 6, 9, False, 0), (182, 240, 6, 9, True, 0)]:
    tombstone(x, y, w, h, c, tl)

# kleine, ferne Skelette, die sich aus der Erde recken
def tiny_skel(x, y):
    B = BONE
    for k in range(5):
        px(cv, x, y - k, B[3])
    for (dx, dy) in [(-1, -7), (0, -7), (1, -7), (-1, -8), (0, -8), (1, -8), (0, -9)]:
        px(cv, x + dx, y + dy, B[4])
    px(cv, x - 1, y - 7, OUT); px(cv, x + 1, y - 7, OUT)
    for k in range(1, 5):
        px(cv, x - 1 - k // 2, y - 3 - k, B[3]); px(cv, x + 1 + k // 2, y - 3 - k, B[3])
    for dx in range(-3, 4):
        px(cv, x + dx, y + 1, EARTH[1])
for (x, y) in [(52, 244), (120, 242), (200, 246)]:
    tiny_skel(x, y)

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
cloud_mass([(44, 192, 56, 18, 11), (206, 196, 56, 16, 12), (80, 200, 60, 20, 16), (168, 202, 64, 20, 17), (122, 208, 90, 22, 13),
            (60, 214, 50, 12, 14), (186, 216, 50, 12, 15)], CL, shade=(70, 20, 40), k=0.7)
# Lichtsaum auf den Wolken
glow(cv, DX, 190, 50, (255, 230, 180), k=0.4, mix=0.25)

# ---------------------------------------------------------------- Skelette erheben sich aus offenen Särgen
WOOD = [(24, 12, 8), (50, 28, 16), (84, 50, 28), (120, 78, 44), (156, 108, 66)]
HOOD_G = [(8, 24, 12), (18, 50, 22), (30, 84, 34), (50, 120, 50), (90, 160, 80)]
HOOD_B = [(30, 16, 10), (60, 34, 18), (96, 58, 30), (134, 88, 50), (170, 124, 76)]

def coffin(f, cx, y, w=30):
    """offener Sarg in Aufsicht-Perspektive: y = Oberkante der Öffnung"""
    f.part('lid%d' % cx)
    f.poly([(cx + w * 0.5, y - 2), (cx + w * 0.5 + 12, y - 16), (cx + w * 0.5 + 16, y - 14), (cx + w * 0.5 + 5, y + 4)], 'l')
    f.part('inside%d' % cx)
    f.poly([(cx - w * 0.5, y), (cx + w * 0.5, y), (cx + w * 0.44, y + 7), (cx - w * 0.44, y + 7)], 'i')

def coffin_front(f, cx, y, w=30):
    f.part('front%d' % cx)
    f.poly([(cx - w * 0.5 - 1, y + 4), (cx + w * 0.5 + 1, y + 4), (cx + w * 0.44, y + 18), (cx - w * 0.44, y + 18)], 'l')
    f.part('rim%d' % cx)
    f.poly([(cx - w * 0.5 - 2, y + 2), (cx + w * 0.5 + 2, y + 2), (cx + w * 0.5 + 1, y + 5), (cx - w * 0.5 - 1, y + 5)], 'l')

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
            f.curve([(cx, yy), (cx + s * rw * 0.7, yy - S(0.5)), (cx + s * rw, yy + S(2.2)), (cx + s * rw * 0.8, yy + S(3.2))], 'B', w=S(1.8))
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
        f.ellipse(cx, by - S(36), S(11.5), S(8), hood, a0=180, a1=360, keep='.')
        f.ellipse(cx, by - S(36), S(11.5), S(8), hood, a0=180, a1=360, only='B')
        f.ellipse(cx, by - S(33), S(8.5), S(8), 'B', only=hood)
        f.ellipse(cx, by - S(40), S(9), S(2.5), hood, only='B')
        f.part('cape%d' % cx)
        f.poly([(cx - S(9), by - S(24)), (cx + S(9), by - S(24)), (cx + S(11), by - S(19)), (cx + S(4), by - S(20)), (cx, by - S(17)),
                (cx - S(4), by - S(20)), (cx - S(11), by - S(19))], hood)
    return (cx, by - S(33))

SK = [(40, 32, 30), (96, 84, 72), (150, 138, 116), (200, 190, 164), (234, 228, 206), (252, 250, 238)]
MATS_S = {'B': mat(SK, pillow=2, k=1.6, bias=0.12, spec=True, spec_col=(255, 255, 245)),
          'l': mat(WOOD, pillow=2, k=1.4, folds=(0.0, 0.9, 0.35)), 'i': mat([(10, 4, 6), (24, 12, 12), (40, 22, 18)], pillow=2, k=1),
          'g': mat(HOOD_G, pillow=3, k=1.5), 'h': mat(HOOD_B, pillow=3, k=1.5),
          'w': mat(BROWN, pillow=1.5, k=1.2), 'a': mat(SILVER, pillow=1, k=1.2)}
# Erdhügel um die Särge
for (cx, y, w) in [(52, 266, 32), (126, 280, 36), (198, 266, 32)]:
    for yy in range(y - 2, y + 24):
        for xx in range(cx - w // 2 - 8, cx + w // 2 + 9):
            dd = ((xx - cx) / (w / 2 + 8)) ** 2 + ((yy - y - 12) / 13) ** 2
            if dd < 1 and in_art(xx, yy):
                px(cv, xx, yy, rampc(EARTH, 0.75 - dd * 0.4 - (yy - y) / 40, xx, yy))
heads = {}
for (cx, y, w, sc, pose, hood) in [(52, 266, 30, 0.95, 'bow', 'g'), (126, 280, 34, 1.15, 'up', None), (198, 266, 30, 0.95, 'cast', 'h')]:
    f = Fig(W, H)
    coffin(f, cx, y, w)
    heads[cx] = skeleton(f, cx, y + 3, sc, pose, hood)
    if pose == 'bow':
        # Bogen des Skeleton Archer (hoch erhoben)
        hx, hy = cx - 24 * sc, y + 3 - 41 * sc
        f.part('bow%d' % cx, line=True)
        f.curve([(hx + 2, hy - 13), (hx - 4, hy - 4), (hx - 4, hy + 5), (hx + 3, hy + 13)], 'w', w=2)
        f.part('string%d' % cx, line=False); f.line(hx + 2, hy - 13, hx + 3, hy + 13, 'a', w=1)
        # Feder am Kapuzenzipfel
        f.part('feather%d' % cx); f.curve([(cx + 6, y - 34), (cx + 11, y - 42), (cx + 16, y - 44)], 'g', w=2.4, w1=1)
    coffin_front(f, cx, y, w)
    f.outline()
    cv.paste(f.render(MATS_S), 0, 0)
    # Augenhöhlen + leuchtende Augen
    hx, hy = heads[cx]
    eye = {'g': (90, 255, 90), 'h': (200, 140, 255), None: (255, 130, 60)}[hood]
    for s in (-1, 1):
        ex, ey = int(round(hx + s * 3.6 * sc)), int(round(hy + 1))
        for (dx, dy) in [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1), (0, 2)]:
            px(cv, ex + dx, ey + dy, (14, 8, 12))
        glow(cv, ex, ey, 4, eye, k=0.6, mix=0.25)
        px(cv, ex, ey, eye); px(cv, ex, ey + 1, lerp(eye, (0, 0, 0), 0.4))
    px(cv, hx, hy + 5 * sc, (14, 8, 12)); px(cv, hx - 1, hy + 5 * sc + 1, (14, 8, 12)); px(cv, hx + 1, hy + 5 * sc + 1, (14, 8, 12))
    for dx in range(-3, 4):
        if dx % 2 == 0:
            px(cv, hx + dx * sc, hy + 8 * sc, (60, 50, 44))
    # Nägel/Beschläge am Sarg
    for dx in (-10, 0, 10):
        px(cv, cx + dx * w / 30, y + 11, GOLD[3])
# Magie in der Hand des Skeleton Mage
mx_, my_ = 198 + 25 * 0.95, 269 - 32 * 0.95
glow(cv, mx_, my_ - 2, 12, (190, 110, 255), k=0.8, mix=0.4)
twinkle(cv, mx_, my_ - 3, (240, 220, 255), r=3, c2=(170, 90, 240))
for (dx, dy) in [(-6, -8), (5, -10), (8, -2), (-3, -13)]:
    sparkle(cv, mx_ + dx, my_ + dy, (220, 180, 255), r=1, c2=(140, 70, 200))

# Staub + Funken
for _ in range(40):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(150, AY1 - 1)
    if not DMk[y, x]:
        px(cv, x, y, rnd.choice([(255, 200, 120), (255, 150, 80), (255, 230, 170)]))
glitter(cv, 20, (AX0, AY0, AX1, 150), seed=3, cols=[(255, 240, 200), (255, 220, 170)], mask=~DMk)

finish(cv, 'XX', 'DAMUS', out='20_judgement_damus', emblem=emblem_generic(
    ["..#..", ".###.", "#####", "..#..", ".###."], {'#': (255, 206, 90)}))
print('ok')
