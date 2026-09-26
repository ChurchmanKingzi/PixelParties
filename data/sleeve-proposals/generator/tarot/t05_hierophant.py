# -*- coding: utf-8 -*-
# V – Der Hierophant: Saint Nicolas
# Sankt Nikolaus thront zwischen zwei zuckerstangen-gestreiften Säulen vor einem Bogenfenster mit
# Schneenacht; die Rechte segnend erhoben, in der Linken der goldene Hirtenstab. Vor ihm knien zwei
# kleine Krampus-Gehilfen mit den roten Dämonenmasken (Trank und Geschenk als Gaben), zu seinen
# Füßen die gekreuzten Zuckerstangen (statt der Schlüssel). Lichterketten, Tränke, Geschenke.
from tarot_iv_vii_helpers import *

cv = new_card()
rnd = random.Random(55)

# ---------------------------------------------------------------- Steinmauer (wie auf der Karte)
WALL = [(30, 26, 44), (50, 46, 70), (74, 70, 98), (100, 96, 126), (128, 124, 154), (160, 156, 184)]
Hw = np.zeros((H, W), np.float32); Mw = np.zeros((H, W), bool)
rowh = 10
for y in range(AY0, AY1):
    row = (y - AY0) // rowh
    off = [0, 9, 4, 13][row % 4]
    bw = 18 + (row % 3) * 2
    for x in range(AX0, AX1):
        Mw[y, x] = True
        by = (y - AY0) % rowh; bx = (x + off) % bw
        e = min(by, rowh - 1 - by, bx, bw - 1 - bx)
        Hw[y, x] = min(e, 3) * 0.7
Hw += (noise(H, W, 3, seed=31) - 0.5) * 1.0
relief(cv, Hw, np.zeros((H, W), np.int32), [WALL], Mw, k=1.4, bias=-0.06)

# ---------------------------------------------------------------- Bogenfenster mit Schneenacht
WX0, WX1, WY0, WY1 = 72, 178, 54, 214
WR = (WX1 - WX0) / 2
WCY = WY0 + WR
yy, xx = np.indices((H, W))
win = ((yy >= WCY) & (xx >= WX0) & (xx <= WX1) & (yy <= WY1)) | ((xx - CX) ** 2 + (yy - WCY) ** 2 <= WR ** 2)
ring = ((yy >= WCY) & (xx >= WX0 - 7) & (xx <= WX1 + 7) & (yy <= WY1 + 4)) | ((xx - CX) ** 2 + (yy - WCY) ** 2 <= (WR + 7) ** 2)
ring &= ~win
# Rahmen: Keilsteine (radiale Fugen) als Relief
Hr = np.zeros((H, W), np.float32)
ang = np.degrees(np.arctan2(yy - WCY, xx - CX))
dd = np.hypot(xx - CX, yy - WCY)
Hr = np.where(yy < WCY, np.minimum(np.abs(((ang + 180) % 15) - 7.5), np.minimum(dd - WR, WR + 7 - dd)) * 0.9,
              np.minimum(np.abs(((yy - WCY) % 14) - 7), np.minimum(np.abs(xx - CX) - WR, WR + 7 - np.abs(xx - CX))) * 0.9)
Hr = np.clip(Hr, 0, 2.2) + (noise(H, W, 3, seed=32) - 0.5) * 0.6
STONE_L = [(46, 42, 64), (76, 72, 100), (110, 106, 136), (146, 142, 170), (186, 182, 206), (220, 218, 236)]
relief(cv, Hr, np.zeros((H, W), np.int32), [STONE_L], ring, k=1.3, bias=0.04)
# Nachthimmel
NIGHT = [(8, 10, 34), (14, 22, 60), (24, 40, 96), (40, 70, 140), (70, 110, 180)]
for y in range(WY0, WY1 + 1):
    for x in range(WX0, WX1 + 1):
        if win[y, x]:
            t = (y - WY0) / (WY1 - WY0)
            px(cv, x, y, rampc(NIGHT, 0.15 + t * 0.7, x, y))
stars(cv, 60, y0=WY0, y1=WY1, x0=WX0, x1=WX1, seed=7, mask=win, big=0.1)
# Mondsichel
for y in range(62, 86):
    for x in range(138, 164):
        d1 = math.hypot(x - 152, y - 74); d2 = math.hypot(x - 157, y - 71)
        if d1 <= 9 and d2 > 8 and win[y, x]:
            px(cv, x, y, rampc([(200, 196, 170), (236, 232, 206), (255, 252, 236)], 0.3 + (152 - x) / 18 + (74 - y) / 30, x, y))
glow(cv, 152, 74, 20, (220, 220, 255), k=0.25, mix=0.2)
# verschneite Dächer/Tannen in der Ferne (Silhouette) im Fenster
for x in range(WX0, WX1 + 1):
    h = 192 + int(4 * math.sin(x * 0.09) + 3 * math.sin(x * 0.23))
    for y in range(h, WY1 + 1):
        if win[y, x]:
            px(cv, x, y, (30, 40, 80) if y > h + 1 else (190, 210, 240))
for (tx, th) in [(80, 22), (92, 30), (158, 28), (170, 20)]:
    for y in range(196 - th, 198):
        hw = (y - (196 - th)) * 0.36
        for x in range(int(tx - hw), int(tx + hw) + 1):
            if win[y, x]:
                c = (22, 44, 60) if (x + y) % 5 else (40, 70, 90)
                if (y - (196 - th)) % 6 == 0 and abs(x - tx) < hw:
                    c = (220, 236, 255)
                px(cv, x, y, c)
# Schneeflocken
for _ in range(70):
    x = rnd.randint(WX0, WX1); y = rnd.randint(WY0, WY1)
    if win[y, x]:
        if rnd.random() < 0.2:
            sparkle(cv, x, y, (255, 255, 255), r=1, c2=(170, 190, 230))
        else:
            px(cv, x, y, (236, 242, 255))
# Schnee auf der Fensterbank
for x in range(WX0 - 6, WX1 + 7):
    h = 2 + int(1.5 * math.sin(x * 0.4) + 1)
    for y in range(WY1 + 1 - h, WY1 + 2):
        px(cv, x, y, (246, 250, 255) if y < WY1 else (190, 204, 232))

# ---------------------------------------------------------------- Säulen (Zuckerstangen-Marmor)
MARBLE = [(120, 112, 130), (170, 164, 180), (214, 210, 222), (240, 238, 244), (255, 255, 255)]
CANE_R = [(90, 6, 20), (150, 14, 30), (206, 30, 44), (240, 80, 80), (255, 150, 140)]
HOLLY = [(6, 36, 20), (14, 70, 34), (30, 110, 50), (70, 160, 80), (140, 210, 130)]


def pillar(x0, x1, y0, y1, seed):
    w = x1 - x0
    for y in range(y0, y1):
        for x in range(x0, x1):
            u = (x - x0 + 0.5) / w
            v = 0.2 + 0.85 * math.cos((u - 0.38) * math.pi * 0.95)
            stripe = ((y + 9 * math.sin((u - 0.5) * math.pi)) % 18) < 7
            ramp = CANE_R if stripe else MARBLE
            c = rampc(ramp, v, x, y)
            if x == x0 or x == x1 - 1:
                c = OUT
            px(cv, x, y, c)


for (x0, x1) in ((20, 42), (208, 230)):
    pillar(x0, x1, 76, 256, 0)


def capitals(f):
    for (x0, x1) in ((20, 42), (208, 230)):
        cx = (x0 + x1) / 2
        f.part('cap%d' % x0); f.poly([(x0 - 6, 62), (x1 + 6, 62), (x1 + 2, 72), (x1, 77), (x0, 77), (x0 - 2, 72)], 'g')
        f.part('abacus%d' % x0); f.rect(x0 - 8, 56, x1 + 8, 62, 'g')
        f.part('base%d' % x0); f.rect(x0 - 3, 254, x1 + 3, 260, 'g'); f.rect(x0 - 6, 260, x1 + 6, 268, 's')
        # Stechpalmenblätter am Kapitell
        for (lx, ly, a) in [(cx - 9, 70, -0.5), (cx + 9, 70, 0.5), (cx, 72, 0.0)]:
            f.part('holly%d_%d' % (x0, lx))
            f.poly([(lx, ly - 4), (lx + 4 * math.cos(a) + 3, ly + 1), (lx, ly + 6), (lx - 4 * math.cos(a) - 3, ly + 1)], 'h')


fcap, capr = fig_draw(cv, capitals, {'g': mat(GOLD, pillow=2, k=1.6, spec=True), 's': mat(STONE_L, pillow=3, k=1.4),
                                     'h': mat(HOLLY, pillow=2, k=1.5)})
for (x0, x1) in ((20, 42), (208, 230)):
    cx = (x0 + x1) // 2
    for (bx, by) in [(cx - 2, 73), (cx + 1, 74), (cx - 1, 76)]:
        px(cv, bx, by, (230, 30, 40)); px(cv, bx, by - 1, (255, 150, 140))
    for x in range(x0 - 7, x1 + 8, 3):
        px(cv, x, 58, GOLD[5]); px(cv, x + 1, 60, GOLD[1])

# ---------------------------------------------------------------- Thron (roter Samt, Goldrahmen)
VELVET = [(40, 4, 14), (80, 10, 26), (124, 20, 36), (170, 36, 48), (210, 70, 70)]


def throne(f):
    f.part('frame')
    f.poly([(90, 104), (104, 90), (125, 76), (146, 90), (160, 104), (162, 218), (88, 218)], 'g')
    f.part('velvet')
    f.poly([(96, 108), (108, 96), (125, 84), (142, 96), (154, 108), (155, 214), (95, 214)], 'v')
    for (x, y) in [(88, 100), (162, 100), (125, 72)]:
        f.part('fin%d' % x); f.ellipse(x, y, 4, 4, 'g')
        f.part('fintip%d' % x); f.poly([(x - 1.5, y - 3), (x + 1.5, y - 3), (x, y - 9)], 'g')
    for side in (-1, 1):
        x0 = 76 if side < 0 else 160
        f.part('arm%d' % side); f.rect(x0, 190, x0 + 14, 200, 'g')
        f.part('armv%d' % side); f.rect(x0 + 2, 200, x0 + 12, 226, 'v')
    # Stufen
    f.part('step1'); f.rect(70, 226, 180, 238, 's')
    f.part('step2'); f.rect(58, 238, 192, 250, 's')
    f.part('step3'); f.rect(46, 250, 204, 262, 's')


fth, thr = fig_draw(cv, throne, {'g': mat(GOLD, pillow=2, k=1.7, spec=True), 'v': mat(VELVET, pillow=5, k=1.3, noise=0.5, nscale=2),
                                 's': mat(STONE_L, pillow=3, k=1.4, noise=0.6, nscale=3, bias=-0.05)})
# Samtmuster: goldene Lilien-Punkte
for y in range(104, 212, 9):
    for x in range(100 + (y // 9 % 2) * 5, 152, 10):
        recolor_in(cv, thr, x, y, GOLD[2]); recolor_in(cv, thr, x, y - 1, GOLD[3])
        recolor_in(cv, thr, x - 1, y + 1, GOLD[1]); recolor_in(cv, thr, x + 1, y + 1, GOLD[1])
# roter Teppich über die Stufen
RUG = [(60, 6, 14), (110, 14, 26), (160, 26, 36), (206, 52, 50), (236, 96, 80)]
for y in range(226, AY1):
    hw = 26 + max(0, y - 262) * 0.6
    for x in range(int(CX - hw), int(CX + hw) + 1):
        d = abs(x - CX) / hw
        edge = y in (226, 238, 250, 262)
        v = 0.6 - 0.2 * d - (0.35 if edge else 0) + (0.2 if y in (227, 239, 251) else 0)
        c = rampc(RUG, v, x, y)
        if d > 0.88:
            c = GOLD[3] if d < 0.95 else GOLD[1]
        px(cv, x, y, c)
# Boden
FLOOR = [(30, 24, 40), (52, 44, 66), (80, 72, 98), (110, 102, 130), (140, 132, 162)]
for y in range(262, AY1):
    for x in range(AX0, AX1):
        if abs(x - CX) > 26 + max(0, y - 262) * 0.6:
            t = (y - 262) / 40
            u = (x - CX) / (1 + t * 1.5)
            chk = (int(u // 10) + int((y - 262) ** 1.2 // 7)) % 2
            v = 0.35 + 0.25 * chk + (noise(H, W, 3, seed=33)[y, x] - 0.5) * 0.3
            px(cv, x, y, rampc(FLOOR, v, x, y))

# ---------------------------------------------------------------- Lichterketten
BULBS = [(255, 70, 70), (80, 220, 110), (80, 150, 255), (255, 214, 70), (230, 120, 255)]


def light_string(p0, p1, sag, n, seed):
    pts = []
    for i in range(121):
        t = i / 120
        pts.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t + sag * math.sin(math.pi * t)))
    for (x, y) in pts:
        px(cv, x, y, (20, 50, 30))
    for k in range(n):
        t = (k + 0.5) / n
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t + sag * math.sin(math.pi * t)
        c = BULBS[(k + seed) % len(BULBS)]
        glow(cv, x, y + 3, 7, c, k=0.4, mix=0.35)
        px(cv, x, y + 1, (40, 60, 40))
        for (dx, dy) in [(0, 2), (-1, 3), (0, 3), (1, 3), (-1, 4), (0, 4), (1, 4), (0, 5)]:
            px(cv, x + dx, y + dy, c)
        px(cv, x - 1, y + 3, lerp(c, (255, 255, 255), 0.6))
        px(cv, x, y + 5, lerp(c, (0, 0, 0), 0.35)); px(cv, x + 1, y + 4, lerp(c, (0, 0, 0), 0.25))


light_string((31, 60), (125, 52), 20, 8, 0)
light_string((125, 52), (219, 60), 20, 8, 3)
light_string((16, 90), (31, 64), 4, 2, 1)
light_string((219, 64), (234, 90), 4, 2, 2)

# ---------------------------------------------------------------- Sankt Nikolaus
MITRE = [(56, 6, 22), (104, 14, 36), (150, 26, 48), (196, 50, 64), (232, 104, 104)]
COPE = [(50, 6, 16), (96, 12, 28), (150, 24, 36), (200, 48, 50), (236, 100, 86)]
CREAM = [(120, 90, 50), (176, 146, 86), (222, 200, 136), (246, 234, 186), (255, 250, 228)]
BEARD = [(84, 90, 116), (136, 144, 168), (186, 192, 212), (224, 228, 240), (248, 250, 255)]
ALB = [(90, 92, 120), (150, 152, 178), (200, 202, 220), (234, 236, 246), (255, 255, 255)]


def nicolas(f):
    # Infuln (Bänder der Mitra) hinter dem Kopf
    f.part('lappets')
    f.poly([(103, 94), (110, 94), (110, 136), (102, 138)], 'M', mirror=True)
    # Umhang (Pluviale), sitzend
    f.part('cope')
    f.poly([(100, 124), (150, 124), (168, 146), (176, 196), (176, 228), (74, 228), (74, 196), (82, 146)], 'C')
    f.part('knees'); f.ellipse(106, 204, 20, 11, 'C'); f.ellipse(144, 204, 20, 11, 'C')
    # Albe (weiß) zwischen den Goldborten
    f.part('alb'); f.poly([(114, 150), (136, 150), (146, 230), (104, 230)], 'D')
    f.part('shoes'); f.ellipse(112, 230, 7, 3.5, 'r'); f.ellipse(138, 230, 7, 3.5, 'r')
    f.part('lace'); f.poly([(103, 220), (147, 220), (148, 228), (102, 228)], 'A')
    # Goldborten (Stäbe) vorn am Umhang
    f.part('orphL'); f.curve([(110, 136), (108, 170), (104, 200), (100, 228)], 'O', w=8, w1=9)
    f.part('orphR'); f.curve([(140, 136), (142, 170), (146, 200), (150, 228)], 'O', w=8, w1=9)
    # rechter Arm (Bildseite links): segnend erhoben
    f.part('upperR'); f.limb(100, 136, 82, 168, 9, 8, 'C')
    f.part('sleeveR'); f.poly([(72, 150), (92, 152), (96, 176), (86, 186), (70, 180), (68, 164)], 'C')
    f.part('forearmR'); f.limb(82, 166, 82, 138, 5.5, 4.5, 'A')
    f.part('cuffR'); f.rect(76, 137, 88, 140, 'O')
    f.part('handR')
    f.ellipse(82, 130, 5.5, 6, 's')
    f.part('fingerI'); f.limb(80, 126, 79.5, 118, 2.1, 1.9, 's')
    f.part('fingerM'); f.limb(84.5, 126, 85, 117, 2.1, 1.9, 's')
    f.part('folded'); f.ellipse(83, 133, 4.5, 2.8, 's')
    f.part('thumb'); f.limb(76, 134, 81, 130, 2, 1.8, 's')
    # linker Arm (Bildseite rechts): hält den Hirtenstab
    f.part('upperL'); f.limb(150, 136, 164, 170, 9, 8, 'C')
    f.part('sleeveL'); f.poly([(158, 152), (178, 150), (182, 164), (180, 180), (164, 186), (154, 176)], 'C')
    f.part('forearmL'); f.limb(164, 170, 168, 186, 5.5, 5, 'A')
    f.part('staff'); f.rect(166, 98, 170, 226, 'G')
    f.part('knop'); f.ellipse(168, 112, 4.5, 4, 'G')
    f.part('crook')
    f.curve([(168, 100), (167, 88), (170, 76), (178, 70), (186, 73), (188, 81), (184, 88), (177, 88), (176, 81), (180, 79)], 'G', w=4, w1=3)
    f.part('fistL'); f.ellipse(168, 188, 6, 5.5, 's')
    # Kopf: Haar, Gesicht, Bart
    f.part('hair'); f.ellipse(CX, 106, 18, 12, 'b')
    f.part('face'); f.ellipse(CX, 105, 14, 12.5, 's')
    f.part('beard')
    f.poly([(109, 106), (114, 115), (125, 119), (136, 115), (141, 106), (148, 122), (146, 136), (125, 142), (104, 136), (102, 122)], 'b')
    for i, pts in enumerate([[(105, 118), (102, 136), (107, 152)], [(145, 118), (148, 136), (143, 152)],
                             [(111, 122), (108, 146), (113, 164)], [(139, 122), (142, 146), (137, 164)],
                             [(118, 124), (116, 152), (120, 174)], [(132, 124), (134, 152), (130, 174)],
                             [(125, 124), (125, 160), (125, 182)]]):
        f.part('lock%d' % i)
        f.curve(pts, 'b', w=9 if i < 6 else 10, w1=3)
    f.part('mustache')
    f.ellipse(118, 114, 8, 3.2, 'b'); f.ellipse(132, 114, 8, 3.2, 'b')
    # Mitra
    f.part('mitre')
    f.poly([(107, 96), (143, 96), (145, 80), (139, 64), (125, 50), (111, 64), (105, 80)], 'M')
    f.part('mitreband'); f.rect(105, 89, 145, 96, 'W')
    f.part('mitrev'); f.rect(123, 52, 127, 89, 'W', only='M')
    f.part('mitrecross'); f.rect(118, 67, 132, 70, 'W', only='M')


MATS = {
    's': mat(SKIN, pillow=4, k=1.1, bias=0.2),
    'b': mat(BEARD, pillow=3.5, k=1.7, noise=0.6, nscale=2, bias=0.12),
    'M': mat(MITRE, pillow=4, k=1.5, bias=0.02),
    'W': mat(CREAM, pillow=1.5, k=1.5, spec=True),
    'C': mat(COPE, pillow=6, k=1.4, folds=(0.12, 0.2, 0.7)),
    'A': mat(ALB, pillow=3, k=1.3, folds=(0.3, 0.02, 0.4)),
    'D': mat([(40, 4, 16), (80, 10, 30), (120, 20, 40), (160, 36, 52), (196, 70, 70)], pillow=4, k=1.3, folds=(0.05, 0.3, 0.4)),
    'O': mat(GOLD, pillow=2, k=1.6, spec=True),
    'G': mat(GOLD7, pillow=1.5, k=1.8, spec=True),
    'r': mat(RED_CLOTH, pillow=2, k=1.4, spec=True),
}
glow(cv, CX, 130, 60, (255, 230, 170), k=0.3, mix=0.25)
fn, fig = fig_draw(cv, nicolas, MATS)

# Gesicht: weich schattierte Haut neu setzen (kleine Fläche -> eigener Verlauf), runde rote Nase
for y in range(94, 118):
    for x in range(108, 143):
        if fn.L[y, x] == 's' and tuple(cv.a[y, x]) != OUT:
            v = 0.78 - 0.35 * (y - 96) / 20 - 0.18 * (x - 125) / 15 - (0.25 if y < 98 else 0)
            px(cv, x, y, rampc(SKIN, v, x, y))
for y in range(106, 113):
    for x in range(121, 130):
        d = ((x - 125) / 3.6) ** 2 + ((y - 109.5) / 2.9) ** 2
        if d <= 1:
            v = 0.8 - 0.4 * (y - 107) / 5 - 0.2 * (x - 124) / 4
            px(cv, x, y, rampc([(150, 60, 60), (210, 110, 100), (240, 160, 140), (255, 210, 190), (255, 240, 230)], v, x, y))
px(cv, 123, 107, (255, 245, 235))
# Gesicht: fröhlich geschlossene Augen (Bögen) unter buschigen weißen Brauen, rote Wangen
for (ex, fl) in ((114, False), (130, True)):
    for (dx, dy) in [(0, 2), (1, 1), (2, 0), (3, 0), (4, 1), (5, 2)]:
        px(cv, ex + dx, 103 + dy, (70, 34, 44))
    # Brauen: weiße Büschel ohne Kontur
    for (dx, dy, c) in [(-1, -1, BEARD[3]), (0, -2, BEARD[4]), (1, -2, BEARD[4]), (2, -3, BEARD[4]), (3, -3, BEARD[4]),
                        (4, -2, BEARD[4]), (5, -2, BEARD[3]), (6, -1, BEARD[2]), (0, -1, BEARD[2]), (1, -1, BEARD[3]),
                        (2, -2, BEARD[3]), (3, -2, BEARD[3]), (4, -1, BEARD[2]), (5, -1, BEARD[2])]:
        px(cv, (ex + 5 - dx) if fl else (ex + dx), 103 + dy, c)
blush(cv, 111, 108, (240, 110, 120)); blush(cv, 137, 108, (240, 110, 120))
blush(cv, 112, 109, (240, 110, 120)); blush(cv, 136, 109, (240, 110, 120))
# Bart: feine Strähnenlinien
for i in range(7):
    xs = [104, 146, 110, 140, 117, 133, 125][i]
    for y in range(128, 176, 1):
        x = xs + math.sin(y * 0.3 + i) * 1.2
        if (y + i * 3) % 7 < 3:
            recolor_on(cv, fn, x, y, BEARD[2], 'b')
# Mund unter dem Schnurrbart
for x in range(123, 128):
    recolor_in(cv, fig, x, 118, (150, 60, 70))
# Kreuz auf der Mitra: kleine Goldpunkte; Perlen am Band
for x in range(107, 144, 3):
    recolor_in(cv, fig, x, 92, GOLD[2]); recolor_in(cv, fig, x, 93, GOLD[4])
for (x, y) in [(125, 58), (125, 82), (119, 68), (131, 68)]:
    recolor_in(cv, fig, x, y, RUBY[3])
# Goldrauten auf dem Untergewand
for y in range(160, 220, 7):
    for x in range(114 - (y - 150) // 7, 137 + (y - 150) // 7, 7):
        xx = x + (3 if (y // 7) % 2 else 0)
        for (dx, dy) in [(0, -1), (-1, 0), (1, 0), (0, 1)]:
            recolor_on(cv, fn, xx + dx, y + dy, GOLD[2], 'D')
        recolor_on(cv, fn, xx, y, GOLD[4], 'D')
# Stickerei auf den Goldborten: Kreuzchen
for yb in range(146, 224, 10):
    for (xb, sl) in ((108, -0.12), (142, 0.12)):
        x = xb + sl * (yb - 140)
        for (dx, dy) in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
            recolor_on(cv, fn, x + dx, yb + dy, RUBY[2] if (dx, dy) == (0, 0) else CANE_R[3], 'O')
# Spitzensaum der Albe
for x in range(103, 148):
    if x % 3 == 0:
        recolor_in(cv, fig, x, 226, ALB[1])
    if x % 3 == 1:
        recolor_in(cv, fig, x, 224, ALB[2])
# Fingerlinien an der Faust
for y in (186, 189, 192):
    for x in range(164, 170):
        recolor_in(cv, fig, x, y, SKIN[1] if x > 164 else SKIN[0])
# Segen: kleiner Lichtschein über der Hand
glow(cv, 82, 122, 14, (255, 250, 200), k=0.4, mix=0.3)
for (x, y, r) in [(72, 112, 2), (92, 110, 2), (82, 104, 1)]:
    sparkle(cv, x, y, (255, 255, 230), r=r, c2=(255, 220, 140))
# Stern in der Krümme des Hirtenstabs
sparkle(cv, 181, 80, (255, 250, 200), r=2, c2=GOLD[3])

# ---------------------------------------------------------------- Krampus-Gehilfen (knien vor dem Thron)
FUR = [(18, 10, 10), (40, 24, 18), (68, 42, 28), (100, 66, 42), (136, 96, 64)]
MASK = [(56, 4, 10), (116, 14, 20), (176, 32, 32), (222, 66, 54), (250, 128, 100)]
HORN = [(20, 14, 16), (50, 36, 34), (92, 72, 62), (150, 130, 110), (222, 212, 190)]
HOOF = [(10, 8, 10), (30, 24, 26), (56, 48, 50), (90, 80, 84)]


def krampus(f, sg):
    """sg=+1: links (blickt nach rechts), sg=-1: rechts (gespiegelt)"""
    X = lambda x: x if sg > 0 else 250 - x
    f.part('tail%d' % sg); f.curve([(X(36), 282), (X(26), 276), (X(22), 262), (X(26), 254)], 'F', w=3, w1=2)
    f.part('tuft%d' % sg); f.ellipse(X(26), 252, 4, 5, 'F')
    f.part('backleg%d' % sg)
    f.limb(X(44), 272, X(54), 292, 7, 5.5, 'F'); f.limb(X(54), 292, X(36), 296, 5, 4, 'F')
    f.part('hoofB%d' % sg); f.ellipse(X(34), 296, 3.5, 3, 'H')
    f.part('body%d' % sg); f.ellipse(X(50), 262, 14, 17, 'F')
    f.part('frontleg%d' % sg)
    f.limb(X(52), 274, X(70), 276, 7.5, 6, 'F'); f.limb(X(70), 276, X(72), 294, 6, 4.5, 'F')
    f.part('hoofF%d' % sg); f.ellipse(X(73), 296, 4.5, 3, 'H')
    f.part('belly%d' % sg); f.ellipse(X(55), 264, 7, 9, 'B')
    f.part('arm%d' % sg); f.limb(X(56), 252, X(74), 240, 4.5, 3.5, 'F')
    f.part('head%d' % sg)
    # zottige Kapuze aus Fell
    pts = []
    for i in range(16):
        a = i / 16 * 2 * math.pi
        r = (15 if i % 2 == 0 else 12)
        pts.append((X(50) + math.cos(a) * r, 236 + math.sin(a) * r * 0.95))
    f.poly(pts, 'F')
    f.part('hornA%d' % sg); f.curve([(X(42), 228), (X(36), 220), (X(35), 211), (X(39), 204)], 'h', w=5, w1=2)
    f.part('hornB%d' % sg); f.curve([(X(58), 228), (X(64), 220), (X(65), 211), (X(61), 204)], 'h', w=5, w1=2)
    f.part('mask%d' % sg)
    f.poly([(X(40), 228), (X(60), 228), (X(62), 238), (X(58), 248), (X(50), 252), (X(42), 248), (X(38), 238)], 'm')
    f.part('ears%d' % sg)
    f.poly([(X(39), 232), (X(30), 228), (X(34), 236)], 'm'); f.poly([(X(61), 232), (X(70), 228), (X(66), 236)], 'm')
    f.part('nose%d' % sg); f.ellipse(X(50), 240, 3, 3.5, 'm')


FMATS = {'F': mat(FUR, pillow=4, k=1.6, noise=1.4, nscale=1), 'B': mat(FUR[1:], pillow=3, k=1.2, bias=0.1, noise=0.8, nscale=1),
         'H': mat(HOOF, pillow=2, k=1.4, spec=True), 'h': mat(HORN, pillow=2, k=1.6, spec=True),
         'm': mat(MASK, pillow=3, k=1.6, spec=True, spec_col=(255, 200, 180)),
         'P': mat(glass_ramp((250, 210, 60)), pillow=3, k=1.5, spec=True), 'c': mat(BROWN, pillow=1, k=1.2),
         'x': mat(RED_CLOTH, pillow=2, k=1.4), 'y': mat(GOLD, pillow=1.5, k=1.5, spec=True),
         's': mat(SKIN_DARK, pillow=2, k=1.3)}


def helpers(f):
    krampus(f, 1)
    krampus(f, -1)
    # Gaben: links ein gelber Trank, rechts ein Geschenk
    f.part('potion'); f.ellipse(80, 232, 6.5, 6.5, 'P'); f.rect(78, 221, 82, 226, 'P')
    f.part('cork'); f.rect(78, 219, 82, 222, 'c')
    f.part('gift'); f.rect(162, 226, 178, 240, 'x')
    f.part('ribbonV'); f.rect(169, 226, 171, 240, 'y')
    f.part('ribbonH'); f.rect(162, 232, 178, 234, 'y')
    f.part('bow'); f.ellipse(167, 224, 3, 2.2, 'y'); f.ellipse(173, 224, 3, 2.2, 'y')
    f.part('handA'); f.ellipse(76, 239, 3.2, 3, 'F')
    f.part('handB'); f.ellipse(174, 240, 3.2, 3, 'F')


fk, kr = fig_draw(cv, helpers, FMATS)
# Masken-Gesichter: Augen (links weiß, rechts gelb wie auf der Karte), Brauen, Maul mit Hauern
for (sg, iris) in ((1, (240, 240, 250)), (-1, (250, 226, 60))):
    X = lambda x: x if sg > 0 else 250 - x
    for (ex, fl) in ((X(44), sg < 0), (X(56), sg > 0)):
        ex0 = ex - 2
        for (dx, dy, c) in [(0, 0, OUT), (1, 0, OUT), (2, 0, OUT), (3, 0, OUT),
                            (0, 1, OUT), (1, 1, iris), (2, 1, iris), (3, 1, OUT),
                            (0, 2, OUT), (1, 2, iris), (2, 2, (20, 10, 10)), (3, 2, OUT), (1, 3, OUT), (2, 3, OUT)]:
            px(cv, ex0 + dx, 233 + dy, c)
        px(cv, ex0 + 1, 234, (255, 255, 255))
    # böse Brauen
    for i in range(5):
        px(cv, X(40 + i), 231 - (i // 2 if True else 0) + 1, OUT)
        px(cv, X(60 - i), 231 - (i // 2) + 1, OUT)
    # Maul mit Zähnen
    for x in range(42, 59):
        px(cv, X(x), 245, OUT)
        if 43 <= x <= 57:
            px(cv, X(x), 246, (250, 250, 240) if x % 2 else (120, 20, 30))
        if 44 <= x <= 56:
            px(cv, X(x), 247, OUT if x in (44, 56) else (90, 10, 20))
    for x in (44, 56):
        px(cv, X(x), 247, (250, 250, 240)); px(cv, X(x), 248, (250, 250, 240))
    px(cv, X(50), 240, MASK[1]); px(cv, X(51), 241, MASK[1])  # Nasenloch
    # Fell-Strähnen
    for (x, y) in [(42, 256), (48, 262), (56, 258), (46, 272), (60, 276), (40, 266)]:
        for i in range(4):
            recolor_in(cv, kr, X(x + i * 0.3), y + i, FUR[4] if i == 0 else FUR[3])
# Etikett + Glanz am Trank
for (x, y) in [(77, 231), (78, 231), (79, 231), (77, 232), (78, 232), (79, 232), (80, 232), (81, 231)]:
    recolor_in(cv, kr, x, y, (250, 240, 210))
sparkle(cv, 77, 228, (255, 255, 240), r=1, c2=(255, 240, 160))
glow(cv, 80, 232, 12, (255, 230, 90), k=0.3, mix=0.3)

# ---------------------------------------------------------------- Tränke und Geschenke auf den Stufen
POT = [((96, 243), (80, 150, 255), 4.5), ((156, 243), (80, 230, 230), 4.5), ((104, 256), (255, 150, 60), 4),
       ((147, 256), (240, 240, 250), 4)]


def potions(f):
    for i, ((x, y), c, r) in enumerate(POT):
        k = 'abcd'[i]
        f.part('p%d' % i); f.ellipse(x, y - r, r, r, k); f.rect(x - 1.5, y - 2 * r - 4, x + 1.5, y - 2 * r + 1, k)
        f.part('cork%d' % i); f.rect(x - 1.5, y - 2 * r - 6, x + 1.5, y - 2 * r - 4, 'c')


fp, pr = fig_draw(cv, potions, {'abcd'[i]: mat(glass_ramp(c), pillow=3, k=1.5, spec=True) for i, (_, c, _) in enumerate(POT)} |
                  {'c': mat(BROWN, pillow=1, k=1.2)})
for ((x, y), c, r) in POT:
    sparkle(cv, x - 2, y - r - 2, (255, 255, 255), r=1, c2=lerp(c, (255, 255, 255), 0.5))
    glow(cv, x, y - r, 9, c, k=0.25, mix=0.3)

# ---------------------------------------------------------------- Gekreuzte Zuckerstangen (statt Schlüssel)


def canes(f):
    for sg in (1, -1):
        X = lambda x: x if sg > 0 else 250 - x
        f.part('cane%d' % sg)
        f.limb(X(106), 298, X(138), 268, 2.8, 2.8, 'w')
        f.curve([(X(138), 268), (X(141), 262), (X(147), 260), (X(152), 263), (X(153), 269)], 'w', w=5.6)
    f.part('bowR'); f.ellipse(121, 284, 4, 3, 'e'); f.ellipse(129, 284, 4, 3, 'e')
    f.part('bowC'); f.ellipse(125, 284, 2, 2, 'e')
    f.part('bowT'); f.poly([(123, 285), (119, 293), (122, 292)], 'e'); f.poly([(127, 285), (131, 293), (128, 292)], 'e')


fc, cr = fig_draw(cv, canes, {'w': mat(MARBLE, pillow=2, k=1.6, bias=0.1, spec=True), 'e': mat(HOLLY, pillow=2, k=1.5, spec=True)})
# rote Schrägstreifen je Stange (über die Teil-IDs der Figur getrennt)
for sg in (1, -1):
    pid = fc.parts['cane%d' % sg][0]
    ys, xs = np.where(fc.P == pid)
    for y, x in zip(ys, xs):
        c = tuple(int(v) for v in cv.a[y, x])
        if c == OUT:
            continue
        u = (x - CX) * sg
        if (u * 0.4 + y * 1.0 - (x - CX) * sg * 0.0) % 7 < 3 if sg > 0 else ((-u) * 0.4 + y) % 7 < 3:
            lum_ = sum(c) / 3
            px(cv, x, y, CANE_R[3] if lum_ > 230 else CANE_R[2] if lum_ > 180 else CANE_R[1])
# Funkeln
for (x, y) in [(56, 110), (194, 118), (60, 180), (190, 186), (125, 44 + 6), (36, 214), (214, 212)]:
    sparkle(cv, x, y, (255, 250, 230), r=2, c2=(200, 200, 255))
vignette(cv, (14, 8, 24), strength=0.4)
emblem = emblem_generic(["#.###", "#.#.#", "###.#", "#...#", "#...#"][::-1], {'#': (240, 60, 60)})
emblem = emblem_generic(["..##.", ".#..#", ".#...", ".#...", ".#..."], {'#': (240, 70, 70)})
p = finish(cv, 'V', 'ST. NICOLAS', out='05_hierophant_nicolas', emblem=emblem)
print(p)
