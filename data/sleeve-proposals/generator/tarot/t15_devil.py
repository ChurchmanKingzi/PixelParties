# -*- coding: utf-8 -*-
# XV – Der Teufel: Baaliel, the Demon General
# Baaliel hockt mit ausgebreiteten Fledermausflügeln auf einem schwarzen Obsidian-Sockel, über ihm das
# umgedrehte Pentagramm; die rechte Hand erhoben, in der linken eine nach unten gerichtete Fackel.
# Vor dem Sockel stehen zwei seiner braunen Dämonensoldaten, mit Ketten am Hals an einen Ring im Sockel gefesselt.
# Hintergrund: Lavahöhle mit glühenden Rissen, Vulkanen und seiner Armee in der Ferne.
from tarot_b4_helpers import *

cv = new_card()
rnd = random.Random(15)
yy, xx = np.indices((H, W))
ARTM = (yy >= AY0) & (yy < AY1) & (xx >= AX0) & (xx < AX1)

# ---------------------------------------------------------------- Himmel: Rauch und Glut
sky(cv, [(12, 4, 8), (26, 6, 10), (48, 10, 12), (84, 18, 14), (140, 36, 16), (200, 70, 20)], y1=200)
# Rauchschwaden
SMOKE = [(20, 8, 12), (36, 14, 16), (56, 22, 20), (80, 34, 26)]
for (cx_, cy_, w_, h_, sd) in [(40, 66, 70, 16, 1), (120, 54, 80, 14, 2), (206, 68, 70, 18, 3), (70, 100, 60, 12, 4),
                               (184, 108, 60, 12, 5)]:
    puffy_cloud(cv, cx_, cy_, w_, h_, SMOKE, seed=sd)
# ferne Vulkane mit Lavaströmen
VOL = [(20, 6, 10), (34, 10, 14), (50, 16, 18), (70, 24, 22)]
for (vx, vy, vw, top_w) in [(46, 142, 60, 6), (206, 132, 66, 7)]:
    for y in range(vy, 186):
        hw = top_w + (y - vy) * vw / (186 - vy)
        for x in range(int(vx - hw), int(vx + hw) + 1):
            if in_art(x, y):
                v = 0.4 + (vx - x) / (hw + 1) * 0.3 - (y - vy) * 0.002
                px(cv, x, y, rampc(VOL, v, x, y))
    # Glut am Krater + Lavastrom
    glow2(cv, vx, vy - 2, 22, (255, 120, 30), k=0.6, mix=0.4)
    for x in range(vx - top_w, vx + top_w + 1):
        px(cv, x, vy, (255, 200, 80))
    rl = random.Random(vx)
    for s_ in range(2):
        x = vx + rl.uniform(-3, 3)
        for y in range(vy, 186):
            x += rl.uniform(-0.8, 0.8) + (0.35 if s_ else -0.35)
            px(cv, x, y, (255, 150, 40) if y % 5 else (255, 220, 110))
            blend_px(cv, x + 1, y, (200, 60, 20), 0.6)
# Lavasee am Horizont
for y in range(184, 214):
    for x in range(AX0, AX1):
        v = 0.35 + 0.12 * math.sin(x * 0.2 + y * 0.9) * math.sin(x * 0.05) + (y - 184) * 0.02
        px(cv, x, y, rampc([(120, 24, 10), (190, 56, 14), (236, 110, 26), (255, 170, 60), (255, 220, 120)], v, x, y))

# ---------------------------------------------------------------- die Armee in der Ferne (Silhouetten mit glühenden Augen)
ARMY = [(30, 12, 12), (44, 18, 16), (58, 26, 20)]


def army_row(y0, sc, n, x0, x1, seed, col=(24, 8, 8), eye=(255, 190, 90)):
    """Reihe gehörnter Dämonen-Silhouetten mit Speeren vor dem Lavasee"""
    r_ = random.Random(seed)
    for i in range(n):
        x = x0 + (x1 - x0) * (i + r_.uniform(-0.15, 0.15)) / max(1, n - 1)
        hh = 14 * sc                       # Höhe bis Scheitel
        M = np.zeros((H, W), np.uint8)
        # Kopf, Schultern/Rumpf, Beine
        cv2.circle(M, (int(x), int(y0 - hh + 2.5 * sc)), int(2.6 * sc), 1, -1)
        body = [(x - 4.8 * sc, y0 - hh + 6 * sc), (x + 4.8 * sc, y0 - hh + 6 * sc), (x + 3.2 * sc, y0 - 4 * sc),
                (x + 3.4 * sc, y0), (x - 3.4 * sc, y0), (x - 3.2 * sc, y0 - 4 * sc)]
        cv2.fillPoly(M, [np.round(np.array(body)).astype(np.int32)], 1)
        for sd in (-1, 1):                 # Hörner nach oben geschwungen
            for k in range(int(6 * sc)):
                hx = x + sd * (1.8 * sc + k * 0.35 - (k * k) * 0.02 * sc)
                hy = y0 - hh + 1.5 * sc - k * 0.9
                M[int(round(hy)), int(round(hx))] = 1
                M[int(round(hy)), int(round(hx)) + (1 if sd < 0 else -1)] = 1 if k < 4 * sc else M[int(round(hy)), int(round(hx))]
        if r_.random() < 0.7:              # Speer
            sx_ = int(x + 5.5 * sc)
            M[int(y0 - hh - 8 * sc):int(y0 - 2), sx_] = 1
        for yq, xq in zip(*np.where(M)):
            if in_art(xq, yq):
                px(cv, xq, yq, col)
        if r_.random() < 0.7:
            px(cv, int(x + 5.5 * sc), int(y0 - hh - 8 * sc) - 1, (200, 170, 150))
        ey = int(y0 - hh + 2.5 * sc)
        px(cv, int(x - 1 * sc), ey, eye); px(cv, int(x + 1 * sc), ey, eye)


army_row(193, 0.85, 17, 22, 228, 3, col=(60, 16, 12), eye=(255, 220, 140))
for (ax, sd) in [(28, 1), (48, 2), (68, 3), (182, 4), (202, 5), (222, 6)]:
    army_row(213, 1.45, 1, ax, ax, sd)

# ---------------------------------------------------------------- Boden: Basalt mit glühenden Lavarissen (Voronoi)
GY0 = 214
pts = [(rnd.uniform(0, W), rnd.uniform(GY0 - 10, AY1 + 10)) for _ in range(60)]
pts = np.array(pts)
sub = (yy >= GY0) & ARTM
ys, xs = np.where(sub)
# Perspektive: Zellen in y gestaucht nahe dem Horizont
d1 = np.full(len(ys), 1e9); d2 = np.full(len(ys), 1e9); lab = np.zeros(len(ys), int)
for i, (px_, py_) in enumerate(pts):
    sy = 0.5 + (ys - GY0) / (AY1 - GY0)
    d = np.hypot(xs - px_, (ys - py_) * 1.9 / sy)
    m = d < d1
    d2 = np.where(m, d1, np.minimum(d2, d)); d1 = np.where(m, d, d1); lab = np.where(m, i, lab)
edge = d2 - d1
BAS = [(10, 6, 8), (22, 14, 16), (38, 24, 24), (58, 38, 34), (84, 56, 46)]
LAVA = [(120, 20, 8), (200, 50, 10), (250, 120, 20), (255, 200, 70), (255, 250, 190)]
for k in range(len(ys)):
    y, x = ys[k], xs[k]
    e = edge[k]
    if e < 1.6:
        v = 1 - e / 1.6
        px(cv, x, y, rampc(LAVA, 0.35 + v * 0.65, x, y))
    else:
        # Platte: zum Rand hin dunkler, oben links Licht der Lava -> leicht warm
        v = 0.55 - min(e, 10) * 0.035 + (0.25 if e < 3 else 0) + (noise(H, W, 3, seed=4)[y, x] - 0.5) * 0.35
        px(cv, x, y, rampc(BAS, v, x, y))
# Glühen über den Rissen
for k in range(0, len(ys), 1):
    if edge[k] < 3.5 and edge[k] >= 1.6 and BAYER4[ys[k] % 4, xs[k] % 4] < (1 - edge[k] / 3.5) * 0.9:
        blend_px(cv, xs[k], ys[k], (240, 90, 30), 0.35)

# ---------------------------------------------------------------- Obsidian-Sockel
PX0, PX1, PT, PB = 76, 174, 204, 268       # Frontfläche x0..x1, Oberkante, Unterkante
OBS = [(6, 4, 8), (14, 10, 18), (26, 20, 32), (42, 34, 50), (66, 56, 78), (104, 94, 122)]
Mp = np.zeros((H, W), bool); Hp = np.zeros((H, W), np.float32)
# Deckfläche (Perspektive)
for y in range(PT - 8, PT + 1):
    t = (y - (PT - 8)) / 8
    a = PX0 + 6 * (1 - t); b = PX1 - 6 * (1 - t)
    Mp[y, int(a):int(b) + 1] = True
    Hp[y, int(a):int(b) + 1] = 3.0 + t * 0.5
# Frontfläche mit Fasen und Rahmenrelief
for y in range(PT, PB):
    for x in range(PX0, PX1 + 1):
        Mp[y, x] = True
        e = min(x - PX0, PX1 - x, y - PT, PB - 1 - y)
        Hp[y, x] = 2.0 + min(e, 3) * 0.4 - (0.8 if 7 <= e <= 8 else 0)
Hp += (noise(H, W, 2, seed=8) - 0.5) * 0.5
relief(cv, Hp, np.zeros((H, W), np.int32), [OBS], Mp, k=1.6, bias=0.0)
# Glühende Runen + Risse auf der Front
RUNE = (255, 90, 30)
for (rx, ry) in [(92, 222), (158, 222), (92, 250), (158, 250)]:
    for (dx, dy) in [(0, -3), (0, -2), (0, -1), (0, 0), (0, 1), (0, 2), (-2, -1), (2, -1), (-1, 2), (1, 3), (-2, 3)]:
        px(cv, rx + dx, ry + dy, RUNE)
    glow2(cv, rx, ry, 6, (255, 80, 20), k=0.6, mix=0.35)
for (x0, y0, L, sd) in [(118, 262, 16, 1), (140, 208, 12, 2), (84, 236, 10, 3)]:
    cp = bolt_path(x0, y0, x0 + rnd.uniform(-6, 6), y0 + (L if y0 < 240 else -L), seed=sd, jag=0.35, depth=4)
    for (a, b) in zip(cp[:-1], cp[1:]):
        for (x, y) in pts_line(a[0], a[1], b[0], b[1]):
            if Mp[y, x]:
                px(cv, x, y, (255, 150, 50))
mask_outline(cv, Mp, (4, 2, 4))
# Ring für die Ketten
RX, RY = 125, 240
IRON = [(14, 12, 16), (34, 30, 36), (60, 54, 62), (96, 90, 100), (146, 140, 150), (210, 206, 216)]
for y in range(RY - 6, RY + 7):
    for x in range(RX - 6, RX + 7):
        d = math.hypot(x - RX, y - RY)
        if 3 <= d <= 5.6:
            v = 0.6 - (y - RY) * 0.07 - (x - RX) * 0.03
            px(cv, x, y, rampc(IRON, v, x, y))
        elif 5.6 < d <= 6.6 or 2.2 <= d < 3:
            px(cv, x, y, (6, 4, 8))
# Halteplatte des Rings
for x in range(RX - 3, RX + 4):
    px(cv, x, RY - 7, IRON[3]); px(cv, x, RY - 8, IRON[4])

# ---------------------------------------------------------------- Pentagramm (umgedreht) über dem Kopf
PCX, PCY, PR = 125, 60, 16
glow2(cv, PCX, PCY, 34, (255, 60, 20), k=0.6, mix=0.35)
star = [(PCX + math.cos(math.radians(90 + k * 72)) * PR, PCY + math.sin(math.radians(90 + k * 72)) * PR) for k in range(5)]
order = [0, 2, 4, 1, 3, 0]
PEN = []
for i in range(5):
    a, b = star[order[i]], star[order[i + 1]]
    PEN += pts_line(a[0], a[1], b[0], b[1])
for t in np.linspace(0, 2 * math.pi, 150):
    PEN.append((int(round(PCX + math.cos(t) * (PR + 3))), int(round(PCY + math.sin(t) * (PR + 3)))))
PEN = set(PEN)
for (x, y) in PEN:
    for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        if (x + dx, y + dy) not in PEN:
            px(cv, x + dx, y + dy, (170, 20, 10))
for (x, y) in PEN:
    px(cv, x, y, (255, 210, 110))

# ================================================================= Baaliel (mit Flügeln)
RSKIN = [(46, 6, 10), (92, 14, 18), (140, 28, 26), (184, 50, 40), (220, 90, 70), (246, 146, 118)]
HORN = [(26, 30, 30), (58, 66, 64), (98, 110, 104), (146, 158, 150), (196, 206, 200), (236, 242, 238)]
WINGM = [(26, 4, 10), (54, 10, 20), (90, 20, 30), (128, 36, 40), (168, 64, 58)]
WBONE = [(20, 4, 8), (48, 10, 16), (84, 22, 26), (120, 40, 40), (160, 70, 64)]
CLAW = [(20, 16, 14), (60, 52, 46), (120, 110, 100), (200, 190, 176)]
LOIN = [(20, 8, 10), (44, 14, 18), (70, 22, 26), (100, 36, 38), (136, 56, 54)]
BONEW = [(90, 80, 66), (150, 140, 118), (210, 200, 176), (244, 238, 220)]

f = Fig(W, H)
# ---- Fledermausflügel (hinter allem)
for side in (1, -1):
    def M(p):
        return (p[0] if side == 1 else 250 - p[0], p[1])
    sh = M((104, 122)); el = M((72, 90)); wr = M((46, 70))
    tips = [M((20, 62)), M((22, 104)), M((32, 142)), M((58, 166)), M((88, 150))]
    f.part('wmem%d' % side)
    memb = [sh, el, wr]
    for i, tp in enumerate(tips):
        memb.append(tp)
        if i < len(tips) - 1:
            nxt = tips[i + 1]
            mx_, my_ = (tp[0] + nxt[0]) / 2, (tp[1] + nxt[1]) / 2
            # Einbuchtung der Flughaut zum Handgelenk hin
            memb.append((mx_ + (wr[0] - mx_) * 0.28, my_ + (wr[1] - my_) * 0.28))
    memb += [M((104, 150))]
    f.poly(memb, 'm')
    f.part('wbone%d' % side)
    f.limb(*sh, *el, 3.2, 2.6, 'w')
    f.limb(*el, *wr, 2.6, 2.2, 'w')
    for tp in tips[:4]:
        f.limb(*wr, *tp, 1.8, 0.8, 'w')
    f.ellipse(*wr, 2.8, 2.8, 'w')
    f.part('wclaw%d' % side)
    f.poly([M((46, 66)), M((40, 58)), M((49, 64))], 'c')
# ---- Schwanz (um den Sockel geschlungen)
f.part('tail')
f.curve([(146, 180), (168, 196), (180, 214), (178, 232), (186, 246)], 'r', w=5, w1=2.5)
f.poly([(184, 242), (194, 248), (186, 256), (182, 250)], 'r')
# ---- Beine (hockend)
f.part('thighL'); f.limb(116, 176, 92, 184, 10, 8, 'r')
f.part('thighR'); f.limb(134, 176, 158, 184, 10, 8, 'r')
f.part('shinL'); f.limb(90, 186, 96, 204, 7.5, 5, 'r')
f.part('shinR'); f.limb(160, 186, 154, 204, 7.5, 5, 'r')
f.part('footL'); f.poly([(88, 200), (104, 200), (108, 207), (86, 207)], 'r')
f.part('footR'); f.poly([(146, 200), (162, 200), (164, 207), (142, 207)], 'r')
f.part('clawsF')
for x in (88, 94, 100, 106):
    f.poly([(x, 205), (x + 3, 205), (x + 1, 210)], 'c')
for x in (143, 149, 155, 161):
    f.poly([(x, 205), (x + 3, 205), (x + 2, 210)], 'c')
f.part('kneeL'); f.ellipse(90, 184, 6, 6, 'i')
f.part('kneeR'); f.ellipse(160, 184, 6, 6, 'i')
# ---- Lendenschurz + Gürtel
f.part('loin'); f.poly([(112, 170), (138, 170), (142, 198), (132, 194), (125, 202), (118, 194), (108, 198)], 'l')
f.part('belt'); f.poly([(106, 164), (144, 164), (145, 172), (105, 172)], 'i')
f.part('buckle'); f.ellipse(125, 168, 6, 5, 'b')
# ---- Oberkörper (muskulös)
f.part('torso')
f.poly([(100, 122), (150, 122), (148, 140), (142, 156), (144, 166), (106, 166), (108, 156), (102, 140)], 'r')
f.part('pecs'); f.ellipse(115, 134, 10, 7, 'r'); f.ellipse(135, 134, 10, 7, 'r')
f.part('abs')
for (x, y) in [(119, 148), (131, 148), (119, 156), (131, 156)]:
    f.ellipse(x, y, 5, 3.6, 'r')
# ---- Arme
# rechte Hand erhoben (Bildseite links)
f.part('uarmL'); f.limb(100, 128, 80, 120, 7.5, 6, 'r')
f.part('farmL'); f.limb(80, 120, 74, 98, 6, 5, 'r')
f.part('bracerL'); f.limb(79, 116, 76, 104, 6.6, 6.2, 'i')
f.part('handL')
f.ellipse(73, 92, 6, 6, 'r')
for (dx, L) in [(-5, 7), (-2, 9), (2, 9), (5, 7)]:
    f.limb(73 + dx * 0.8, 90, 73 + dx * 1.2, 90 - L, 1.9, 1.4, 'r')
f.limb(79, 94, 84, 88, 2, 1.6, 'r')     # Daumen
# linke Hand senkt die Fackel (Bildseite rechts)
f.part('uarmR'); f.limb(150, 128, 168, 144, 7.5, 6, 'r')
f.part('farmR'); f.limb(168, 144, 176, 166, 6, 5, 'r')
f.part('bracerR'); f.limb(170, 148, 174, 160, 6.6, 6.2, 'i')
f.part('torch')
ta, tb = (173, 163), (192, 204)
f.limb(*ta, *tb, 3.0, 2.6, 'o')
f.part('torchhead'); f.limb(189, 197, 194, 207, 4.2, 3.8, 'i')
f.part('handR'); f.ellipse(177, 170, 6, 6, 'r')
# ---- Schulterpanzer
f.part('pauldL'); f.ellipse(100, 124, 11, 8, 'i')
f.poly([(92, 120), (86, 108), (97, 117)], 'i'); f.poly([(100, 117), (98, 104), (105, 116)], 'i')
f.part('pauldR'); f.ellipse(150, 124, 11, 8, 'i')
f.poly([(158, 120), (164, 108), (153, 117)], 'i'); f.poly([(150, 117), (152, 104), (145, 116)], 'i')
f.part('trimL'); f.curve([(90, 128), (100, 132), (110, 128)], 'x', w=2)
f.part('trimR'); f.curve([(140, 128), (150, 132), (160, 128)], 'x', w=2)
# ---- Zahnkette (Halskette aus Reißzähnen wie auf der Karte)
f.part('neck'); f.rect(117, 110, 133, 124, 'r')
f.part('necklace')
for i in range(9):
    t = i / 8
    x = 110 + t * 30; y = 122 + math.sin(t * math.pi) * 9
    f.poly([(x - 1.6, y - 1), (x + 1.6, y - 1), (x, y + 4)], 't')
# ---- Kopf
f.part('head')
f.ellipse(125, 98, 17, 16, 'r')
f.poly([(109, 100), (141, 100), (139, 111), (132, 118), (125, 120), (118, 118), (111, 111)], 'r')
f.part('ears'); f.poly([(110, 96), (98, 88), (106, 103)], 'r'); f.poly([(140, 96), (152, 88), (144, 103)], 'r')
f.part('goatee'); f.poly([(120, 118), (130, 118), (125, 126)], 'k')
f.part('hornL'); f.curve([(114, 86), (104, 80), (96, 70), (95, 58), (101, 48)], 'h', w=8, w1=2)
f.part('hornR'); f.curve([(136, 86), (146, 80), (154, 70), (155, 58), (149, 48)], 'h', w=8, w1=2)
f.outline()
MATS = {
    'r': mat(RSKIN, pillow=4, k=1.7, bias=0.02, spec=True, spec_col=(255, 180, 150)),
    'h': mat(HORN, pillow=2.5, k=1.9, bias=0.06, spec=True, spec_col=(255, 255, 255)),
    'm': mat(WINGM, pillow=5, k=1.3, folds=(0.25, 0.2, 0.5)),
    'w': mat(WBONE, pillow=2, k=1.6, bias=0.05),
    'c': mat(CLAW, pillow=1.5, k=1.5, bias=0.1),
    'i': mat(IRON, pillow=2.5, k=1.9, spec=True, spec_col=(255, 220, 200)),
    'x': mat(RUBY, pillow=1.5, k=1.4, bias=0.05),
    'l': mat(LOIN, pillow=3, k=1.5, folds=(0.4, 0.05, 0.6)),
    'b': mat(GOLD, pillow=2, k=1.8, spec=True),
    't': mat(BONEW, pillow=1.2, k=1.2, bias=0.1),
    'o': mat(BROWN, pillow=1.5, k=1.3),
    'k': mat([(10, 4, 6), (26, 8, 12), (44, 14, 18), (66, 24, 26)], pillow=1.5, k=1.4),
}
fig = f.render(MATS, light=(-0.55, -0.7, 0.45))
FM = fig[..., 3] > 0
cv.paste(fig, 0, 0)

# ---- Gesicht
DK = (40, 4, 10)
# dunkle Augenhöhlen
for (ex, sd) in [(117, -1), (133, 1)]:
    for i in range(-5, 6):
        for j in range(-3, 3):
            if (i / 5.5) ** 2 + (j / 3.2) ** 2 <= 1:
                blend_px(cv, ex + i, 99 + j, (70, 8, 14), 0.55)
# Brauen als kräftige Linien, zur Mitte hin abfallend
for i in range(9):
    px(cv, 109 + i, 92 + i * 0.5, DK); px(cv, 109 + i, 93 + i * 0.5, RSKIN[4] if i % 2 else RSKIN[3])
    px(cv, 141 - i, 92 + i * 0.5, DK); px(cv, 141 - i, 93 + i * 0.5, RSKIN[4] if i % 2 else RSKIN[3])
# glühende weiße Augen (schräg), rote Pupille
EYE_W = (255, 252, 236)
for (ex, sd) in [(117, -1), (133, 1)]:
    for i in range(-4, 5):
        top = 98.5 - (i * sd) * 0.45
        for y in range(int(round(top)), 102):
            px(cv, ex + i, y, EYE_W if y < 101 else (255, 214, 170))
    px(cv, ex + sd, 99, (210, 20, 20)); px(cv, ex + sd, 100, (150, 10, 10))
    glow2(cv, ex, 99, 7, (255, 230, 180), k=0.45, mix=0.3)
# Nase
px(cv, 123, 106, RSKIN[1]); px(cv, 127, 106, RSKIN[1]); px(cv, 124, 105, RSKIN[4]); px(cv, 126, 105, RSKIN[4])
# breites Grinsen mit Zahnreihe und Reißzähnen
for x in range(113, 138):
    yb = 110 + int(round(((x - 125) / 12) ** 2 * -3.5))
    px(cv, x, yb, DK)
    px(cv, x, yb + 1, (250, 244, 228) if (x % 3) else (190, 180, 166))
    px(cv, x, yb + 2, (250, 244, 228) if (x % 3) else (190, 180, 166))
    px(cv, x, yb + 3, DK)
for x in (116, 134):
    yb = 110 + int(round(((x - 125) / 12) ** 2 * -3.5))
    px(cv, x, yb + 4, (255, 250, 236)); px(cv, x, yb + 5, (210, 200, 186))
# Schulterflecken (wie auf der Karte: rosa Stellen) als Rubine im Panzer
for (x, y) in [(100, 124), (150, 124)]:
    for (dx, dy, c) in [(0, 0, RUBY[2]), (-1, 0, RUBY[3]), (0, -1, RUBY[4]), (1, 0, RUBY[1]), (0, 1, RUBY[1])]:
        px(cv, x + dx, y + dy, c)
# Schädel auf der Gürtelschnalle
for (dx, dy) in [(-2, -1), (-1, -2), (0, -2), (1, -2), (2, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2)]:
    px(cv, 125 + dx, 168 + dy, (60, 30, 10))
px(cv, 124, 167, (40, 10, 4)); px(cv, 126, 167, (40, 10, 4))
# Hornringe
for (x, y) in [(101, 77), (100, 66), (149, 77), (150, 66)]:
    px(cv, x, y, HORN[1]); px(cv, x + 1, y, HORN[1]); px(cv, x - 1, y, HORN[2])

# ---------------------------------------------------------------- Fackel-Flamme (brennt nach oben)
FX, FY = 194, 208
glow2(cv, FX, FY - 8, 30, (255, 140, 40), k=0.7, mix=0.4)
FL = Fig(W, H)
FL.part('fl', line=False)
for (dx, h_, w_) in [(-5, 16, 4), (0, 24, 5), (5, 14, 4), (-2, 20, 3), (3, 19, 3)]:
    FL.poly([(FX + dx - w_, FY), (FX + dx + w_, FY), (FX + dx + w_ * 0.3, FY - h_ * 0.6), (FX + dx + 1, FY - h_),
             (FX + dx - w_ * 0.5, FY - h_ * 0.5)], 'f')
FL.ellipse(FX, FY, 7, 5, 'f')
FL.outline(k='K')
fl_rgba = FL.render({'f': mat(FIRE, pillow=4, k=1.2, bias=0.3, noise=1.4, nscale=2)}, outline_col=(120, 20, 6))
cv.paste(fl_rgba, 0, 0)
for (x, y) in [(FX, FY - 6), (FX - 1, FY - 3), (FX + 1, FY - 9)]:
    px(cv, x, y, (255, 255, 230))

# ================================================================= Die beiden gefesselten Dämonensoldaten
MSK = [(24, 12, 10), (50, 26, 18), (80, 44, 30), (114, 68, 44), (150, 100, 66), (186, 140, 100)]
MHORN = [(34, 26, 24), (70, 56, 48), (110, 92, 78), (152, 134, 116), (196, 180, 160)]
GREY = [(20, 20, 26), (40, 40, 50), (66, 66, 80), (100, 100, 116), (150, 150, 166)]


SC = 1.15


def minion(g, cx, by, flip=1):
    """brauner Dämonensoldat von vorn, leicht zum Sockel gedreht; cx = Mitte, by = Fußsohle"""
    def P(dx, dy):
        return (cx + dx * flip * SC, by - dy * SC)
    # Schwanz
    g.part('mtail%d' % cx)
    g.curve([P(-8, 22), P(-18, 20), P(-24, 10), P(-20, 2)], 'r', w=3.5, w1=1.5)
    g.poly([P(-20, 5), P(-15, 1), P(-22, -1)], 'r')
    # Beine + Stiefel (grau wie auf der Karte)
    g.part('mlegs%d' % cx)
    g.limb(*P(-6, 24), *P(-7, 8), 5 * SC, 4 * SC, 'r'); g.limb(*P(6, 24), *P(8, 8), 5 * SC, 4 * SC, 'r')
    g.part('mbootL%d' % cx); g.poly([P(-12, 10), P(-3, 10), P(-2, 0), P(-13, 0)], 'g')
    g.part('mbootR%d' % cx); g.poly([P(3, 10), P(12, 10), P(14, 0), P(2, 0)], 'g')
    # massiger Körper mit hellerer Brust
    g.part('mbody%d' % cx)
    g.ellipse(*P(0, 36), 14 * SC, 14 * SC, 'r')
    g.part('mchest%d' % cx); g.ellipse(*P(1, 38), 8 * SC, 8 * SC, 'n')
    g.part('mloin%d' % cx); g.poly([P(-12, 27), P(12, 27), P(9, 16), P(0, 13), P(-9, 16)], 'l')
    g.part('mbelt%d' % cx); g.poly([P(-12, 29), P(12, 29), P(12, 26), P(-12, 26)], 'g')
    # Arme vorn, Hände in Handschellen vor dem Bauch
    g.part('marmL%d' % cx); g.limb(*P(-14, 44), *P(-12, 30), 5 * SC, 4.2 * SC, 'r'); g.limb(*P(-12, 30), *P(-4, 24), 4.2 * SC, 3.6 * SC, 'r')
    g.part('marmR%d' % cx); g.limb(*P(14, 44), *P(13, 30), 5 * SC, 4.2 * SC, 'r'); g.limb(*P(13, 30), *P(5, 24), 4.2 * SC, 3.6 * SC, 'r')
    g.part('mcuffs%d' % cx); g.ellipse(*P(-4, 24), 3.2 * SC, 3.6 * SC, 'g'); g.ellipse(*P(5, 24), 3.2 * SC, 3.6 * SC, 'g')
    g.part('mfists%d' % cx); g.ellipse(*P(0.5, 21), 4 * SC, 3 * SC, 'r')
    # eisernes Halsband
    g.part('mcollar%d' % cx); g.ellipse(*P(0, 47), 9 * SC, 3.4 * SC, 'g')
    # Kopf (leicht gesenkt)
    g.part('mhead%d' % cx)
    g.ellipse(*P(1, 56), 10 * SC, 9 * SC, 'r')
    g.poly([P(-8, 54), P(10, 54), P(7, 48), P(1, 46), P(-5, 48)], 'r')
    g.part('mhorn%d' % cx)
    g.curve([P(-5, 62), P(-11, 70), P(-12, 80), P(-8, 88)], 'h', w=4.5 * SC, w1=1.2)
    g.curve([P(7, 62), P(13, 70), P(14, 80), P(10, 88)], 'h', w=4.5 * SC, w1=1.2)


g = Fig(W, H)
minion(g, 52, 298, 1)
minion(g, 198, 298, -1)
g.outline()
MMATS = {
    'r': mat(MSK, pillow=4, k=1.6, bias=0.04, spec=True, spec_col=(230, 170, 120)),
    'h': mat(MHORN, pillow=2, k=1.7, bias=0.05),
    'g': mat(GREY, pillow=2, k=1.8, spec=True, spec_col=(220, 220, 240)),
    'l': mat(LOIN, pillow=2, k=1.4),
    'n': mat([(60, 34, 22), (96, 60, 38), (136, 92, 60), (176, 128, 88), (210, 166, 120)], pillow=3, k=1.4, bias=0.04),
}
mg = g.render(MMATS, light=(0.3, -0.8, 0.5))
cv.paste(mg, 0, 0)
MGM = mg[..., 3] > 0
for (cx, flip) in [(52, 1), (198, -1)]:
    by = 298

    def Q(dx, dy):
        return (int(round(cx + dx * flip * SC)), int(round(by - dy * SC)))
    # Stirnwulst-Schatten, glühende Augen
    for dx in range(-7, 10):
        px(cv, *Q(dx, 59), MSK[1])
    for dx in (-4, 5):
        x, y = Q(dx, 57)
        glow2(cv, x, y + 1, 5, (255, 190, 90), k=0.6, mix=0.35)
        for (qx, qy, c) in [(-1, 0, (255, 200, 110)), (0, 0, (255, 250, 210)), (1, 0, (255, 236, 170)), (2, 0, (255, 190, 90)),
                            (0, 1, (255, 170, 80)), (1, 1, (230, 110, 40))]:
            px(cv, x + qx * flip, y + qy, c)
    # Mund + Hauer
    for dx in range(-3, 7):
        px(cv, *Q(dx, 50), (40, 10, 8))
    for dx in (-3, 6):
        x, y = Q(dx, 50)
        px(cv, x, y - 1, (250, 246, 236)); px(cv, x, y - 2, (250, 246, 236)); px(cv, x, y - 3, (220, 214, 204))
    # Nasenlöcher
    px(cv, *Q(0, 53), MSK[0]); px(cv, *Q(2, 53), MSK[0])
    # Glanz auf den Stiefeln
    px(cv, *Q(-9, 8), GREY[4]); px(cv, *Q(6, 8), GREY[4])


# ---------------------------------------------------------------- Ketten vom Halsband zum Ring
CH = Fig(W, H)


def chain(p0, p1, sagk, name):
    pts_ = sag(p0, p1, sagk, n=200)
    L = 0.0
    last = pts_[0]
    marks = [pts_[0]]
    for p in pts_[1:]:
        L += math.hypot(p[0] - last[0], p[1] - last[1]); last = p
        if L >= 4.2:
            marks.append(p); L = 0
    for i, (x, y) in enumerate(marks[:-1]):
        nx_, ny_ = marks[i + 1][0] - x, marks[i + 1][1] - y
        ang = math.atan2(ny_, nx_)
        cx_, cy_ = (x + marks[i + 1][0]) / 2, (y + marks[i + 1][1]) / 2
        CH.part('%s%d' % (name, i))
        if i % 2 == 0:       # Glied von vorn: Ring
            m1 = np.zeros((H, W), np.uint8)
            cv2.ellipse(m1, (int(round(cx_ * 4)), int(round(cy_ * 4))), (13, 8), math.degrees(ang), 0, 360, 1, -1, shift=2)
            m2 = np.zeros((H, W), np.uint8)
            cv2.ellipse(m2, (int(round(cx_ * 4)), int(round(cy_ * 4))), (6, 2), math.degrees(ang), 0, 360, 1, -1, shift=2)
            CH.fill_mask(m1.astype(bool) & ~m2.astype(bool), 'i')
        else:                # Glied von der Seite: Steg
            CH.limb(cx_ - math.cos(ang) * 2.8, cy_ - math.sin(ang) * 2.8, cx_ + math.cos(ang) * 2.8, cy_ + math.sin(ang) * 2.8,
                    1.3, 1.3, 'i')


chain((62, 245), (RX - 5, RY + 2), 8, 'cL')
chain((188, 245), (RX + 5, RY + 2), 8, 'cR')
CH.outline()
chg = CH.render({'i': mat(IRON, pillow=1.2, k=2.2, bias=0.12, spec=True, spec_col=(255, 230, 210))}, inner=True)
cv.paste(chg, 0, 0)
# Lava-Reflexe auf den Kettengliedern
for y, x in zip(*np.where(chg[..., 3] > 0)):
    if tuple(cv.a[y, x]) == tuple(IRON[1]) and (x + y) % 3 == 0:
        cv.a[y, x] = (110, 40, 30)

# ---------------------------------------------------------------- Randlicht der Lava auf den Figuren (von unten)
for (Mx, strength) in [(FM, 0.5), (MGM, 0.45)]:
    ys_, xs_ = np.where(Mx)
    for y, x in zip(ys_, xs_):
        if y + 2 < H and not Mx[y + 2, x] and tuple(cv.a[y, x]) != OUT and (x + y) % 2 == 0 and y > 150:
            cv.a[y, x] = lerp(tuple(cv.a[y, x]), (255, 130, 50), strength)

# ---------------------------------------------------------------- Glutfunken
for i in range(70):
    x = rnd.randint(AX0, AX1 - 1); y = rnd.randint(AY0, AY1 - 1)
    c = rnd.choice([(255, 200, 80), (255, 140, 40), (255, 240, 170)])
    if rnd.random() < 0.25:
        sparkle(cv, x, y, c, r=1, c2=(200, 60, 20))
    else:
        px(cv, x, y, c)
        blend_px(cv, x, y + 1, (200, 60, 20), 0.6)

FMD = cv2.dilate((FM | MGM).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
vignette2(cv, color=(8, 2, 4), strength=0.55, protect=lambda x, y: FMD[y, x])
emblem = emblem_generic(["#...#", "##.##", ".###.", ".#.#.", "..#.."], {'#': (230, 60, 40)})
p = finish(cv, 'XV', 'BAALIEL', out='15_devil_baaliel', emblem=emblem)
print(p)
