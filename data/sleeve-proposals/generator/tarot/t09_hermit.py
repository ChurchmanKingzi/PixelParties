# -*- coding: utf-8 -*-
# IX – Der Eremit: Koperniko, the Stargazer
# Koperniko steht allein auf einem verschneiten Gipfel unter dem Sternenhimmel. In der erhobenen Hand
# die Laterne mit dem sechszackigen Stern, in der anderen sein Messing-Holz-Fernrohr als Wanderstab.
# Milchstraße, Sternbilder, roter Planet (wie der rote Nebel auf seiner Karte), fernes Gebirge im Dunst.
from t08_helpers import *

cv = new_card()
rnd = random.Random(9)
yy, xx = np.indices((H, W))
# ---------------------------------------------------------------- Nachthimmel
sky(cv, [(4, 6, 22), (8, 12, 40), (14, 22, 66), (24, 38, 96), (44, 62, 128), (70, 90, 150)], y1=250)
# Milchstraße: diagonales Band mit Rauschen, gedithert aufgehellt
nm = noise(H, W, 7, seed=41, octaves=3)
nm2 = noise(H, W, 3, seed=42, octaves=2)
MW = [(40, 44, 96), (70, 70, 130), (120, 110, 170), (180, 170, 214), (230, 220, 245)]
for y in range(AY0, 250):
    for x in range(AX0, AX1):
        # Abstand zur Bandachse (von oben links nach rechts Mitte)
        d = ((y - AY0) - (x - AX0) * 0.62 - 10) / 34.0
        band = math.exp(-d * d * 1.6)
        v = band * (0.45 + 0.9 * (nm[y, x] - 0.45)) + (nm2[y, x] - 0.5) * 0.25 * band
        dark_lane = math.exp(-((d + 0.12) * 5) ** 2) * 0.35 * (nm2[y, x] > 0.45)   # Staubstreifen
        v -= dark_lane
        if v > 0.12 and BAYER4[y % 4, x % 4] < (v - 0.12) * 2.2:
            c = MW[min(4, int(v * 5))]
            if (x * 7 + y * 3) % 11 == 0 and v > 0.4:
                c = (236, 190, 220)
            blend_px(cv, x, y, c, 0.55)
# dichter Sternenstaub im Band
for _ in range(700):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(AY0, 249)
    d = ((y - AY0) - (x - AX0) * 0.62 - 10) / 34.0
    if rnd.random() < math.exp(-d * d * 1.6):
        blend_px(cv, x, y, (240, 240, 255), rnd.uniform(0.4, 0.9))
stars(cv, 260, y1=240, seed=4, big=0.15)
# roter Planet (wie der rote Nebel auf Koperniks Karte) mit Ring
MARS = [(60, 10, 14), (120, 24, 24), (180, 50, 36), (220, 96, 60), (246, 150, 110), (255, 210, 180)]
glow(cv, 204, 72, 26, (220, 60, 60), k=0.4, mix=0.3)
disc_relief(cv, 204, 72, 13, MARS, craters=((200, 68, 3), (209, 77, 2)), noise_k=0.5, seed=7, bias=0.05)
for t_ in np.linspace(0, 2 * math.pi, 300):
    x = 204 + math.cos(t_) * 22; y = 72 + math.sin(t_) * 5 - math.cos(t_) * 2.5
    if math.sin(t_) < 0 and math.hypot(x - 204, y - 72) < 13.5:
        continue                       # hinterer Ringteil hinter dem Planeten
    px(cv, x, y, (240, 190, 150) if math.sin(t_) > 0 else (170, 110, 90))
# kleiner Mond links oben
disc_relief(cv, 36, 64, 7, [(90, 96, 120), (150, 156, 176), (206, 210, 222), (240, 242, 248)], noise_k=0.4, seed=3)
for y in range(56, 73):
    for x in range(26, 46):
        if math.hypot(x - 40, y - 62) < 7.5 and math.hypot(x - 36, y - 64) <= 7.5:
            px(cv, x, y, (10, 14, 44))     # Sichel
# Sternbilder: helle Sterne mit dünnen Linien (Großer Wagen + Kassiopeia + eigenes "Fernrohr")
CONST = [
    [(150, 104), (162, 98), (176, 100), (186, 108), (184, 122), (200, 126), (204, 112)],
    [(24, 100), (34, 90), (44, 98), (54, 86), (64, 94)],
    [(96, 60), (110, 52), (124, 58), (118, 70), (104, 72)],
]
for pts in CONST:
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = int(math.hypot(b[0] - a[0], b[1] - a[1]))
        for i in range(n):
            if i % 2 == 0:
                x = a[0] + (b[0] - a[0]) * i / n; y = a[1] + (b[1] - a[1]) * i / n
                blend_px(cv, x, y, (120, 150, 230), 0.45)
for pts in CONST:
    for (x, y) in pts:
        sparkle(cv, x, y, (255, 255, 255), r=2, c2=(140, 170, 255))
for (x, y, r) in [(80, 92, 3), (224, 146, 2), (40, 150, 2), (140, 50, 2), (60, 128, 1), (218, 188, 1), (26, 190, 1)]:
    sparkle(cv, x, y, (255, 250, 230), r=r, c2=(170, 190, 255))

# ---------------------------------------------------------------- fernes Gebirge
def ridge_noise(seed, n=W, rough=0.55):
    """1D-Mittelpunktverschiebung für gezackte Grate"""
    r = random.Random(seed)
    size = 256
    a = [0.0] * (size + 1)
    step, amp = size, 1.0
    while step > 1:
        half = step // 2
        for i in range(half, size, step):
            a[i] = (a[i - half] + a[i + half]) / 2 + r.uniform(-amp, amp)
        step, amp = half, amp * rough
    return a
def mountains(peaks, lit, dark, snow_lit, snow_dark, seed, snow_depth=10, y_max=AY1, rough=2.0):
    """klassische Gebirgssilhouetten: jeder Gipfel mit heller (links) und dunkler (rechts) Flanke + Schneekappe"""
    rn = ridge_noise(seed)
    nz = noise(H, W, 3, seed=seed + 7)
    tops = {}
    for x in range(AX0, AX1):
        best = None
        for (pxk, top, sl, sr) in peaks:
            yk = top + (pxk - x) * sl if x < pxk else top + (x - pxk) * sr
            if best is None or yk < best[0]:
                best = (yk, pxk, top)
        ry, pxk, top = best
        ry += rn[x] * rough
        tops[x] = int(ry)
        for y in range(int(ry), y_max):
            side_lit = x < pxk + (y - top) * 0.3 + 2 * math.sin(y * 0.21 + pxk)
            gully = 0.18 * math.sin((x - pxk) * 0.55 + (y - top) * 0.35 * (1 if x < pxk else -1))
            v = (0.62 if side_lit else 0.28) + (nz[y, x] - 0.5) * 0.5 - (y - ry) * 0.004 + gully
            jag = 3 * math.sin(x * 0.7 + seed) + 2 * math.sin(x * 1.9)
            if y < top + snow_depth + jag + (abs(x - pxk) * 0.3):
                c = rampc(snow_lit if side_lit else snow_dark, v + 0.15, x, y)
            else:
                c = rampc(lit if side_lit else dark, v, x, y)
            px(cv, x, y, c)
    return tops
ROCK_L = [(26, 34, 76), (40, 50, 98), (58, 70, 122), (80, 94, 146)]
ROCK_D = [(12, 14, 40), (20, 24, 56), (30, 36, 74), (44, 52, 96)]
SNOW_L = [(110, 130, 186), (160, 178, 222), (206, 218, 244), (240, 244, 255)]
SNOW_D = [(60, 76, 130), (86, 102, 158), (118, 136, 190), (150, 166, 214)]
mountains([(30, 196, 0.8, 0.9), (74, 206, 0.9, 0.7), (118, 190, 0.8, 0.8), (168, 200, 0.7, 0.9), (214, 186, 0.9, 0.8)],
          ROCK_L, ROCK_D, SNOW_L, SNOW_D, seed=3, snow_depth=12)
fog(cv, 210, 256, (70, 90, 150), k=2.2, seed=5, mix=0.4)
ROCK_L2 = [(16, 20, 52), (26, 32, 70), (40, 48, 92), (58, 68, 116)]
ROCK_D2 = [(8, 8, 26), (14, 16, 38), (22, 26, 54), (32, 38, 72)]
SNOW_L2 = [(90, 110, 170), (140, 160, 210), (196, 208, 240), (236, 240, 255)]
SNOW_D2 = [(50, 64, 116), (72, 88, 142), (100, 118, 176), (132, 150, 204)]
mountains([(20, 236, 0.9, 1.0), (60, 244, 1.0, 0.8), (190, 240, 0.8, 1.0), (232, 230, 1.0, 0.9)],
          ROCK_L2, ROCK_D2, SNOW_L2, SNOW_D2, seed=11, snow_depth=8)
fog(cv, 250, 300, (60, 80, 140), k=2.0, seed=6, mix=0.35)

# ---------------------------------------------------------------- Gipfel (Schnee-Relief mit Felsen)
SNOW = [(40, 54, 110), (80, 100, 160), (130, 150, 206), (180, 198, 236), (224, 234, 252), (255, 255, 255)]
ROCK = [(16, 14, 30), (32, 30, 52), (54, 52, 78), (80, 80, 108), (110, 112, 140)]
Hs = np.zeros((H, W), np.float32); Ms = np.zeros((H, W), bool); Mat = np.zeros((H, W), np.int32)
nsn = noise(H, W, 4, seed=61)
top_of = {}
rn = ridge_noise(21)
for x in range(AX0, AX1):
    top = 266 + max(0, abs(x - 132) - 16) * 0.5 + rn[x] * 3
    top_of[x] = int(top)
    for y in range(int(top), AY1):
        Ms[y, x] = True
        Hs[y, x] = min(y - top, 10) * 0.35 - abs(x - 132) * 0.02 * (y - top) * 0.1
Hs += (nsn - 0.5) * 3.0
# Felsbrocken, die aus dem Schnee ragen
for (cx_, cy_, rx_, ry_) in [(52, 292, 12, 9), (206, 290, 14, 10), (84, 298, 8, 5), (178, 300, 10, 6), (224, 302, 8, 8)]:
    d = ((xx - cx_) / rx_) ** 2 + ((yy - cy_) / ry_) ** 2
    m = (d < 1) & Ms
    Mat[m] = 1
    Hs = np.where(m, Hs + np.sqrt(np.maximum(0, 1 - d)) * 4 + (nsn - 0.5) * 3, Hs)
Mat[(Mat == 1) & (nsn > 0.62)] = 0      # Schneehauben auf den Felsen
relief(cv, Hs, Mat, [SNOW, ROCK], Ms, k=1.3, bias=0.08)
for x in range(AX0, AX1):                # Schneegrat-Kante
    if top_of[x] < AY1:
        px(cv, x, top_of[x], SNOW[5] if x < 150 else SNOW[4])
    if top_of[x] - 1 < AY1:
        px(cv, x, top_of[x] - 1, SNOW[1] if x > 150 else SNOW[2])
# Fußspuren im Schnee (vom linken Hang herauf)
for i, (x, y) in enumerate([(52, 282), (62, 280), (72, 278), (84, 275), (96, 272)]):
    for dx in range(3):
        px(cv, x + dx + (i % 2) * 2, y, SNOW[2]); px(cv, x + dx + (i % 2) * 2, y + 1, SNOW[3])

# ---------------------------------------------------------------- Koperniko
HAIR = [(64, 68, 92), (112, 116, 140), (166, 170, 192), (212, 216, 232), (244, 246, 255)]
ROBE = [(10, 8, 34), (30, 18, 80), (56, 32, 136), (86, 56, 190), (122, 92, 226), (164, 140, 246)]
INNER = [(4, 6, 20), (12, 14, 40), (22, 26, 64), (36, 42, 90), (54, 62, 118)]
WOOD = [(36, 18, 10), (70, 38, 20), (110, 64, 34), (150, 96, 52), (190, 134, 78)]
LENS = [(20, 80, 100), (60, 170, 200), (150, 240, 250), (230, 255, 255)]
IRON = [(14, 12, 20), (30, 28, 40), (52, 50, 66), (80, 78, 96), (120, 118, 136)]
LAMP = [(120, 50, 10), (180, 90, 20), (226, 140, 40), (250, 186, 70), (255, 220, 120)]
BOOT = [(20, 14, 20), (40, 28, 34), (64, 46, 50), (92, 70, 70)]
HX, HY = 134, 108
LX, LY = 84, 118            # Laterne: Aufhängering
f = Fig(W, H)
# ---- Fernrohr als Wanderstab (rechts, aufgestützt): Holzrohr mit Messingringen, oben die Linse
SX = 172
f.part('scope')
f.limb(SX, 274, SX - 1, 94, 2.0, 5.4, 'w')
f.part('scopeband')
for yb in (108, 140, 178, 222):
    t_ = (274 - yb) / (274 - 94)
    r_ = 2.0 + (5.4 - 2.0) * t_ + 1
    f.rect(SX - r_, yb, SX + r_ - 1, yb + 3, 'g')
f.part('scopehead'); f.rect(SX - 7, 84, SX + 5, 95, 'g')
f.part('lens'); f.ellipse(SX - 1, 84, 6, 2.5, 'l')
f.part('eyepiece'); f.rect(SX - 2, 268, SX + 1, 278, 'g')
# ---- Robe
f.part('robe')
f.poly([(116, 128), (152, 128), (162, 180), (176, 268), (154, 274), (134, 270), (112, 274), (90, 268), (104, 180)], 'r')
f.part('inner'); f.poly([(128, 134), (140, 134), (146, 200), (152, 270), (116, 270), (122, 200)], 'i')
f.part('robeL'); f.poly([(116, 128), (130, 130), (124, 200), (118, 270), (90, 268), (104, 180)], 'r')
f.part('robeR'); f.poly([(138, 130), (152, 128), (162, 180), (176, 268), (152, 272), (144, 200)], 'r')
f.part('boots'); f.ellipse(122, 272, 9, 4, 'b'); f.ellipse(146, 273, 9, 4, 'b')
# Kordel-Gürtel mit Quaste
f.part('cord'); f.curve([(119, 184), (134, 188), (149, 184)], 'g', w=2.2)
f.curve([(138, 187), (140, 200), (139, 212)], 'g', w=1.6)
f.part('tassel'); f.poly([(137, 211), (142, 211), (144, 220), (135, 220)], 'g')
# Kapuze, im Nacken zurückgeschlagen
f.part('hood')
f.poly([(106, 136), (114, 122), (134, 126), (156, 122), (164, 136), (160, 148), (134, 138), (110, 148)], 'r')
# ---- Arm rechts (Stab)
f.part('armR'); f.limb(154, 138, 164, 164, 8, 7.5, 'r')
f.part('sleeveR'); f.poly([(157, 158), (171, 158), (176, 176), (160, 178)], 'r')
f.part('handR'); f.ellipse(171, 176, 5.5, 6, 's')
# ---- Kopf
f.part('neck'); f.rect(128, 120, 140, 130, 's')
f.part('hairB')
f.poly([(HX - 20, HY - 2), (HX + 20, HY - 4), (HX + 23, HY + 14), (HX + 14, HY + 18), (HX - 12, HY + 14), (HX - 20, HY + 10)], 'h')
f.part('face'); f.ellipse(HX - 2, HY + 3, 16, 15, 's')
f.part('ear'); f.ellipse(HX + 14, HY + 4, 2.5, 4, 's')
f.part('hair')
spk = []
for i in range(17):
    a = math.radians(165 + i * (210 / 16))
    rr = 27 if i % 2 == 0 else 17
    if i in (0, 16):
        rr = 21
    spk.append((HX + 1 + math.cos(a) * rr * 1.1, HY - 3 + math.sin(a) * rr * 0.95))
f.poly(spk + [(HX + 21, HY + 2), (HX + 14, HY - 1), (HX + 9, HY + 3), (HX + 3, HY - 4), (HX - 3, HY + 1), (HX - 8, HY - 4),
              (HX - 13, HY + 4), (HX - 17, HY + 1)], 'h')
# ---- Arm links (Laterne): weiter Zauberärmel
f.part('armL'); f.limb(116, 138, 100, 132, 8, 7, 'r')
f.part('foreL'); f.limb(100, 132, 88, 114, 7, 6, 'r')
f.part('sleeveL'); f.poly([(92, 110), (82, 118), (80, 134), (86, 150), (92, 138), (100, 128)], 'r')
f.part('handL'); f.ellipse(LX + 2, LY - 7, 5, 5, 's')
f.outline()
MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.06),
    'h': mat(HAIR, pillow=4, k=1.8, noise=1.0, nscale=2, bias=0.05),
    'r': mat(ROBE, pillow=5, k=1.4, folds=(0.35, 0.03, 0.8), bias=0.0),
    'i': mat(INNER, pillow=3, k=1.2, folds=(0.3, 0.02, 0.5)),
    'g': mat(GOLD, pillow=1.5, k=1.6, spec=True, spec_col=(255, 255, 230)),
    'w': mat(WOOD, pillow=2, k=1.4, bias=0.05),
    'l': mat(LENS, pillow=1.5, k=1.2, bias=0.2),
    'b': mat(BOOT, pillow=2, k=1.4),
}
# Lichthof der Laterne (vor der Figur, damit er sie nicht überstrahlt)
glow(cv, LX, LY + 18, 50, (255, 220, 140), k=0.55, mix=0.28)
glow(cv, LX, LY + 18, 26, (255, 240, 190), k=0.8, mix=0.35)
fig = f.render(MATS, light=(-0.75, -0.45, 0.5))      # Licht kommt von der Laterne (links)
cv.paste(fig, 0, 0)
# Sterne auf der Robe (wie auf der Karte)
rs = random.Random(12)
robe_m = (f.L == 'r')
cands = list(zip(*np.where(robe_m)))
for _ in range(34):
    y, x = rs.choice(cands)
    if robe_m[y - 1:y + 2, x - 1:x + 2].all():
        c = rs.choice([(255, 255, 255), (190, 220, 255), (255, 240, 200)])
        px(cv, x, y, c)
        if rs.random() < 0.3:
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                blend_px(cv, x + dx, y + dy, c, 0.5)
# Goldborte an Saum und Vorderkante
for x in range(88, 180):
    for y in range(262, 278):
        if f.L[y, x] == 'r' and f.L[y + 1, x] in ('K', '.'):
            px(cv, x, y - 1, GOLD[3] if x % 4 else GOLD[5]); px(cv, x, y - 2, GOLD[2] if x % 4 != 2 else GOLD[4])
            break

# ---------------------------------------------------------------- Laterne mit sechszackigem Stern
L = Fig(W, H)
L.part('ring'); L.ellipse(LX, LY - 1, 3, 3, 'i'); L.ellipse(LX, LY - 1, 1.2, 1.2, '.')
L.part('cap'); L.poly([(LX - 3, LY + 2), (LX + 3, LY + 2), (LX + 9, LY + 8), (LX - 9, LY + 8)], 'i')
L.part('glass', line=False); L.rect(LX - 9, LY + 9, LX + 9, LY + 30, 'L')
L.part('base'); L.poly([(LX - 11, LY + 30), (LX + 11, LY + 30), (LX + 9, LY + 35), (LX - 9, LY + 35)], 'i')
L.part('bars')
for bx in (LX - 10, LX + 10):
    L.rect(bx - 1, LY + 8, bx, LY + 31, 'i')
L.rect(LX - 10, LY + 8, LX + 10, LY + 9, 'i')
L.outline()
lrgba = L.render({'i': mat(IRON, pillow=1.5, k=1.6, spec=True, spec_col=(200, 190, 170)), 'L': mat(LAMP, pillow=4, k=0.8, bias=-0.05)})
cv.paste(lrgba, 0, 0)
# sechszackiger Stern (zwei Dreiecke) im Glas
SCX, SCY = LX, LY + 20
for tri in (0, 1):
    pts = []
    for k in range(3):
        a = math.radians(-90 + k * 120 + tri * 60)
        pts.append((SCX + math.cos(a) * 8.2, SCY + math.sin(a) * 8.2))
    m = np.zeros((H, W), np.uint8)
    cv2.fillPoly(m, [np.round(np.array(pts)).astype(np.int32)], 1)
    for y, x in zip(*np.where(m > 0)):
        d = math.hypot(x - SCX, y - SCY)
        px(cv, x, y, (255, 255, 255) if d < 2.5 else (255, 252, 214) if d < 4.5 else (255, 236, 150))
px(cv, SCX, SCY, (255, 255, 255))
# Finger um den Aufhängering
px(cv, LX + 1, LY - 4, SKIN[1]); px(cv, LX + 3, LY - 4, SKIN[1]); px(cv, LX + 5, LY - 5, SKIN[1])
# Lichtschein auf dem Schnee unter der Laterne
glow(cv, LX + 8, 272, 40, (255, 210, 150), k=0.35, mix=0.22, ry=2.5)

# ---------------------------------------------------------------- Gesicht
EYE_R = (200, 30, 40)
anime_eye(cv, HX - 12, HY + 1, EYE_R, h=6, w=5)
# Monokel/Linse über dem anderen Auge (goldener Ring, hellblaues Glas, Kette)
MCX, MCY = HX + 5, HY + 4
for y in range(MCY - 5, MCY + 6):
    for x in range(MCX - 5, MCX + 6):
        d = math.hypot(x - MCX, y - MCY)
        if d <= 3.4:
            px(cv, x, y, LENS[2] if (x - MCX) + (y - MCY) < 0 else LENS[1])
        elif d <= 4.8:
            px(cv, x, y, GOLD[4] if y < MCY else GOLD[2])
        elif d <= 5.6:
            px(cv, x, y, OUT)
px(cv, MCX - 1, MCY - 2, (255, 255, 255)); px(cv, MCX - 2, MCY - 1, (255, 255, 255))
for i, (x, y) in enumerate([(MCX + 5, MCY + 3), (MCX + 6, MCY + 6), (MCX + 7, MCY + 9), (MCX + 7, MCY + 12), (MCX + 6, MCY + 15),
                            (MCX + 5, MCY + 18), (MCX + 3, MCY + 20)]):
    px(cv, x, y, GOLD[4] if i % 2 == 0 else GOLD[2])
# buschige weiße Brauen
for i in range(7):
    px(cv, HX - 13 + i, HY - 1 - (1 if 2 <= i <= 4 else 0), HAIR[4]); px(cv, HX - 13 + i, HY - (1 if 2 <= i <= 4 else 0), HAIR[2])
for i in range(6):
    px(cv, HX + 2 + i, HY - 3 - (1 if 1 <= i <= 3 else 0), HAIR[4])
# Nase, Falten, Mund
px(cv, HX - 4, HY + 8, SKIN[2]); px(cv, HX - 5, HY + 9, SKIN[1]); px(cv, HX - 4, HY + 9, SKIN[2])
px(cv, HX - 14, HY + 4, SKIN[2]); px(cv, HX - 14, HY + 6, SKIN[2])       # Krähenfüße
for x in range(HX - 8, HX - 2):
    px(cv, x, HY + 13, (120, 50, 50) if x not in (HX - 8, HX - 3) else SKIN[1])
px(cv, HX - 9, HY + 12, SKIN[1]); px(cv, HX - 2, HY + 12, SKIN[1])
blush(cv, HX - 14, HY + 9, (240, 140, 140))
# Linse oben am Fernrohr glitzert
sparkle(cv, SX - 2, 83, (230, 255, 255), r=3, c2=(120, 220, 240))

# ---------------------------------------------------------------- leichter Schneefall
for _ in range(70):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(AY0, AY1 - 1)
    if f.L[y, x] == '.':
        blend_px(cv, x, y, (240, 244, 255), rnd.uniform(0.5, 0.9))

finish(cv, 'IX', 'KOPERNIKO', out='09_hermit_koperniko', emblem=emblem_star)
print('ok')
