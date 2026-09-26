# -*- coding: utf-8 -*-
# IV – Der Herrscher: Zhigao, the Heavenly Emperor
# Zhigao thront frontal auf einem massiven Steinthron mit goldenen Drachenköpfen (oben) und
# Widderköpfen (Armlehnen), hält das Jade-Zepter (Ruyi) und den goldenen Reichsapfel (Drachenperle).
# Hinter ihm die aufgehende Sonne, karge rot-orange Karstberge, Glückswolken; rote Säulen,
# Laternen, Weihrauchbecken und eine Terrasse aus Stein.
from tarot_iv_vii_helpers import *

cv = new_card()
rnd = random.Random(44)

# ---------------------------------------------------------------- Himmel (Morgenrot)
sky(cv, [(46, 12, 38), (98, 20, 44), (168, 44, 44), (224, 98, 50), (248, 164, 80), (252, 210, 130)], y1=246)
stars(cv, 30, y1=100, seed=4, cols=[(255, 220, 190), (255, 190, 170), (240, 160, 170)], big=0.15)
# Sonne als Heiligenschein hinter Thron und Kopf
SX, SY, SR = 125, 104, 54
rays(cv, SX, SY, 24, SR + 2, 150, (255, 226, 140), width=0.1, k=0.55, mix=0.35)
glow(cv, SX, SY, SR + 24, (255, 210, 120), k=0.55, mix=0.3)
SUN = [(214, 96, 40), (240, 140, 52), (252, 186, 80), (255, 218, 130), (255, 240, 190), (255, 252, 232)]
disc_relief(cv, SX, SY, SR, SUN, noise_k=0.12, bias=0.18, k=1.2)
for y in range(SY - SR - 3, SY + SR + 4):          # Korona-Ring
    for x in range(SX - SR - 3, SX + SR + 4):
        if SR < math.hypot(x - SX, y - SY) <= SR + 1.5 and in_art(x, y):
            px(cv, x, y, (230, 120, 40))

# ---------------------------------------------------------------- Karstberge (karg, rot-orange)
FAR = [(120, 46, 56), (160, 70, 62), (196, 102, 72), (224, 140, 92), (240, 178, 124), (250, 210, 160)]
NEAR = [(52, 14, 22), (86, 26, 30), (124, 44, 36), (166, 70, 44), (204, 106, 60), (232, 150, 90)]
peak_range(cv, [(26, 112, 18, 2.4), (58, 134, 18, 2.0), (86, 158, 14, 2.0), (164, 158, 14, 2.0),
                (194, 130, 20, 2.2), (226, 106, 18, 2.6)], 246, FAR, seed=3, k=1.4, bias=0.05)
mist(cv, 176, 240, (252, 206, 170), mix=0.5, k=0.9, seed=5)
peak_range(cv, [(22, 146, 14, 2.6), (46, 168, 16, 2.4), (206, 162, 16, 2.4), (230, 140, 12, 2.6)],
           252, NEAR, seed=8, k=1.6, bias=0.0)
mist(cv, 214, 248, (250, 190, 150), mix=0.45, k=0.9, seed=9)

# Glückswolken (xiangyun) – Relief-Wolken mit eingerollten Locken
CLOUD = [(176, 96, 110), (220, 146, 140), (246, 196, 170), (255, 232, 206), (255, 248, 236)]
for (cx, cy, w, h, sd) in [(50, 150, 36, 9, 1), (204, 144, 34, 8, 2), (34, 206, 32, 8, 3), (218, 198, 34, 9, 4)]:
    puffy_cloud(cv, cx, cy, w, h, CLOUD, seed=sd)
    spiral(cv, cx - w * 0.3, cy - 2, 3.5, 1.2, CLOUD[0], a0=0, sgn=1)
    spiral(cv, cx + w * 0.28, cy - 3, 3.0, 1.2, CLOUD[0], a0=math.pi, sgn=-1)
    for x in range(int(cx - w / 2 - 2), int(cx + w / 2 + 3)):
        if in_art(x, cy + int(h * 0.25) + 1):
            px(cv, x, cy + int(h * 0.25) + 1, CLOUD[1] if x % 3 else CLOUD[0])

# ---------------------------------------------------------------- Terrasse (Steinboden)
FY = 250
FLOOR = [(44, 26, 30), (72, 44, 42), (104, 68, 56), (140, 98, 76), (176, 132, 100), (206, 170, 132)]
Hf = np.zeros((H, W), np.float32); Mf = np.zeros((H, W), bool)
for y in range(FY - 8, AY1):
    t = (y - (FY - 8)) / (AY1 - FY + 8)
    rowh = 4 + t * 10
    q = (y - (FY - 8)) ** 1.25
    for x in range(AX0, AX1):
        Mf[y, x] = True
        # perspektivische Fugen: Reihen werden nach vorn höher, Spalten laufen zum Fluchtpunkt
        ry = q % (rowh * 1.3)
        u = (x - CX) / (0.6 + t * 1.2)
        rx = (u + (8 if int(q / (rowh * 1.3)) % 2 else 0)) % 16
        e = min(ry, rowh * 1.3 - ry, rx, 16 - rx)
        Hf[y, x] = min(e, 2.0) * 0.8
Hf += (noise(H, W, 3, seed=21) - 0.5) * 0.7
relief(cv, Hf, np.zeros((H, W), np.int32), [FLOOR], Mf, k=1.3, bias=-0.02)
for x in range(AX0, AX1):                      # Kante der Terrasse
    px(cv, x, FY - 8, FLOOR[5]); px(cv, x, FY - 7, FLOOR[4])
# roter Teppich zum Thron
RUG = [(60, 6, 14), (110, 14, 26), (160, 26, 36), (206, 52, 50), (236, 96, 80)]
NZ = noise(H, W, 2, seed=23)
for y in range(FY, AY1):
    t = (y - FY) / (AY1 - FY)
    hw = 22 + t * 20
    for x in range(int(CX - hw), int(CX + hw) + 1):
        d = abs(x - CX) / hw
        v = 0.55 - 0.25 * d + (NZ[y, x] - 0.5) * 0.25
        c = rampc(RUG, v, x, y)
        if d > 0.86:
            c = GOLD[3] if d < 0.93 else GOLD[1]
        px(cv, x, y, c)
    for x in range(int(CX - hw * 0.72), int(CX + hw * 0.72) + 1):      # Rautenmuster
        if (abs(x - CX) + y) % 12 < 1 or (abs(x - CX) - y) % 12 < 1:
            px(cv, x, y, RUG[3])

# ---------------------------------------------------------------- Laternen (an Schnüren von oben)
for (lx, ly, ls) in ((28, 116, 1.0), (222, 116, 1.0)):
    lantern(cv, lx, ly, s=ls, cord_top=AY0)

# ---------------------------------------------------------------- Thron (Stein + Gold)
THR = [(28, 22, 40), (50, 44, 66), (78, 72, 98), (110, 104, 130), (146, 142, 166), (192, 190, 208)]
THR_D = [(20, 16, 30), (36, 30, 50), (56, 50, 74), (80, 74, 100), (106, 100, 128)]
BT = 104          # Oberkante der Rückenlehne (Mitte)


def throne(f):
    # Rückenlehne mit nach oben geschwungenen Enden (wie ein Pavillondach)
    f.part('back')
    top = [(x, BT - 12 * (abs(x - CX) / 58) ** 3) for x in range(67, 184)]
    f.poly(top + [(183, 214), (67, 214)], 'T')
    f.part('panel'); f.rect(77, BT + 8, 173, 208, 'D')
    f.part('toprail'); f.poly([(x, y) for (x, y) in top] + [(x, y + 4) for (x, y) in top[::-1]], 'g')
    # Seitenpfosten mit Armlehnen
    for side in (-1, 1):
        x0 = 52 if side < 0 else 182
        f.part('post%d' % side); f.rect(x0, 160, x0 + 16, 250, 'T')
        f.part('arm%d' % side)
        xa0, xa1 = (50, 92) if side < 0 else (158, 200)
        f.rect(xa0, 180, xa1, 190, 'T')
        f.part('armband%d' % side); f.rect(xa0, 180, xa1, 182, 'g')
    # Sitzfläche + Sockel
    f.part('seat'); f.rect(66, 212, 184, 240, 'T')
    f.part('seatband'); f.rect(66, 212, 184, 216, 'g')
    f.part('base'); f.poly([(44, 244), (206, 244), (212, 256), (38, 256)], 'T')
    f.part('baseband'); f.rect(44, 242, 206, 245, 'g')
    f.part('step'); f.poly([(38, 256), (212, 256), (216, 266), (34, 266)], 'T')
    # Drachenköpfe (Gold) auf den Enden der Lehne, nach außen blickend (links gezeichnet, gespiegelt)
    f.part('neck_d'); f.poly([(66, 104), (63, 94), (70, 86), (80, 86), (82, 96), (76, 106)], 'g', mirror=True)
    f.part('mane', line=False)
    f.poly([(74, 74), (84, 70), (80, 77), (92, 76), (84, 82), (94, 86), (84, 88), (90, 96), (80, 94), (82, 102), (74, 96)], 'f', mirror=True)
    f.part('mouth'); f.poly([(62, 85), (44, 85), (42, 93), (62, 94)], 'm', mirror=True)
    f.part('skull'); f.ellipse(70, 82, 8, 7, 'g', mirror=True)
    f.part('snout'); f.poly([(66, 76), (56, 77), (46, 77), (41, 74), (37, 77), (38, 82), (44, 86), (62, 87), (68, 86)], 'g', mirror=True)
    f.part('jaw'); f.poly([(66, 90), (56, 92), (46, 93), (42, 96), (48, 98), (60, 98), (70, 95)], 'g', mirror=True)
    f.part('beard', line=False); f.poly([(52, 97), (62, 97), (61, 104), (57, 100), (54, 106)], 'h', mirror=True)
    f.part('brow'); f.poly([(55, 77), (63, 72), (68, 76), (62, 79)], 'g', mirror=True)
    f.part('horn'); f.curve([(68, 76), (72, 68), (80, 62), (90, 60)], 'h', w=3.2, w1=1.4, mirror=True)
    f.curve([(74, 66), (73, 58)], 'h', w=2, w1=1, mirror=True)
    # Widderköpfe vorn auf den Armlehnen
    for side in (-1, 1):
        rx = 60 if side < 0 else 190
        f.part('ram%d' % side)
        f.ellipse(rx, 188, 6, 7, 'T')
        f.poly([(rx - 4, 191), (rx + 4, 191), (rx + 2, 199), (rx - 2, 199)], 'T')
        f.part('ramhorn%d' % side)
        for sg in (-1, 1):
            f.curve([(rx + sg * 3, 183), (rx + sg * 8, 180), (rx + sg * 12, 184), (rx + sg * 11, 190), (rx + sg * 7, 190), (rx + sg * 7, 186)],
                    'h', w=3.4, w1=2)


MATS_T = {'T': mat(THR, pillow=4, k=1.5, noise=0.8, nscale=3), 'D': mat(THR_D, pillow=3, k=1.3, noise=0.6, nscale=2),
          'g': mat(GOLD, pillow=2, k=1.8, spec=True, spec_col=(255, 255, 230)),
          'h': mat(GOLD7, pillow=1.5, k=1.8, spec=True),
          'f': mat(RED_CLOTH, pillow=2, k=1.2, bias=0.15),
          'm': mat([(40, 4, 10), (90, 10, 20), (150, 30, 40)], pillow=1, k=1.0, bias=-0.1)}
ft, thr = fig_draw(cv, throne, MATS_T)


def meander_rect(x0, y0, x1, y1, dark, light):
    """eingravierter Mäander-Rahmen (回纹)"""
    engrave(cv, [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)], dark, light)
    engrave(cv, [(x0 + 4, y0 + 4), (x1 - 4, y0 + 4), (x1 - 4, y1 - 4), (x0 + 4, y1 - 4), (x0 + 4, y0 + 4)], dark, light)
    for x in range(x0 + 2, x1 - 3, 5):
        engrave(cv, [(x, y0 + 3), (x, y0 + 1), (x + 2, y0 + 1), (x + 2, y0 + 2)], dark)
        engrave(cv, [(x, y1 - 3), (x, y1 - 1), (x + 2, y1 - 1), (x + 2, y1 - 2)], dark)
    for y in range(y0 + 2, y1 - 3, 5):
        engrave(cv, [(x0 + 3, y), (x0 + 1, y), (x0 + 1, y + 2), (x0 + 2, y + 2)], dark)
        engrave(cv, [(x1 - 3, y), (x1 - 1, y), (x1 - 1, y + 2), (x1 - 2, y + 2)], dark)


meander_rect(79, BT + 10, 171, 206, THR_D[0], THR_D[3])
# Wolkenreliefs auf den sichtbaren Lehnenflächen
for (x, y, sg) in [(90, 128, 1), (160, 128, -1), (90, 150, 1), (160, 150, -1), (90, 172, 1), (160, 172, -1)]:
    spiral(cv, x + 1, y + 1, 5, 1.3, THR_D[3], a0=0, sgn=sg)
    spiral(cv, x, y, 5, 1.3, THR_D[0], a0=0, sgn=sg)
# Sitz-Front und Sockel: Paneele
for x0 in (72, 111, 150):
    engrave(cv, [(x0, 221), (x0 + 28, 221), (x0 + 28, 236), (x0, 236), (x0, 221)], THR[0], THR[4])
    spiral(cv, x0 + 14, 228, 4, 1.2, THR[1], sgn=1)
for x0 in (50, 111, 172):
    engrave(cv, [(x0, 248), (x0 + 28, 248), (x0 + 28, 253), (x0, 253), (x0, 248)], THR[0], THR[4])
for (x0, y0) in ((56, 196), (186, 196)):
    for y in range(y0 + 6, 246, 8):
        engrave(cv, [(x0, y), (x0 + 8, y)], THR[1], THR[4])
# Augen, Zähne, Zunge und Barthaare der Drachen
for sg in (1, -1):
    X = lambda x: CX - sg * (CX - x)
    for (dx, dy) in [(0, -1), (1, -1), (2, -1), (-1, 0), (3, 0), (-1, 1), (3, 1), (0, 2), (1, 2), (2, 2)]:
        px(cv, X(59 + dx), 80 + dy, GOLD[0])
    px(cv, X(59), 80, (255, 250, 200)); px(cv, X(60), 80, (240, 60, 30)); px(cv, X(61), 80, (240, 60, 30))
    px(cv, X(59), 81, (200, 30, 20)); px(cv, X(60), 81, (30, 6, 6)); px(cv, X(61), 81, (200, 30, 20))
    for i in range(6):
        px(cv, X(45 + i * 3), 87, (255, 255, 240)); px(cv, X(46 + i * 3), 92, (255, 255, 240))
    px(cv, X(45), 88, (255, 255, 240)); px(cv, X(46), 91, (255, 255, 240))
    for x in range(48, 58): px(cv, X(x), 90, (220, 70, 80) if x % 2 else (190, 40, 60))
    px(cv, X(39), 77, GOLD[0]); px(cv, X(40), 77, GOLD[0])      # Nüster
    for i in range(22):                                        # Barthaare
        t = i / 21
        px(cv, X(39 - t * 12), 80 + t * 18 + math.sin(t * 7) * 2, GOLD[4] if i % 3 else GOLD[2])
    for i in range(16):
        t = i / 15
        px(cv, X(42 - t * 6), 84 + t * 24 + math.sin(t * 6 + 1) * 2, GOLD[3] if i % 3 else GOLD[1])
# Widder: Augen + Nase
for rx in (60, 190):
    px(cv, rx - 2, 187, OUT); px(cv, rx + 2, 187, OUT)
    px(cv, rx - 1, 197, THR[0]); px(cv, rx + 1, 197, THR[0])

# ---------------------------------------------------------------- Zhigao
HAIR = [(8, 8, 16), (20, 20, 32), (36, 38, 56), (60, 66, 94), (104, 114, 156)]
ROBE = [(6, 22, 28), (12, 44, 50), (22, 72, 76), (36, 104, 100), (64, 140, 124), (118, 184, 156)]
CAP = [(8, 6, 12), (22, 18, 30), (40, 36, 54), (70, 66, 90), (120, 116, 140)]
YEL = [(110, 60, 10), (170, 110, 20), (222, 168, 40), (250, 210, 90), (255, 240, 170)]
JADE = [(8, 50, 34), (20, 100, 64), (50, 160, 100), (120, 214, 150), (210, 250, 220)]
SHOE = [(40, 4, 12), (90, 12, 24), (150, 26, 34), (204, 54, 50), (240, 110, 90)]
HY = 104          # Kopfmitte


def emperor(f):
    # lange Haare hinter den Schultern
    f.part('hairback')
    f.poly([(104, 96), (146, 96), (154, 122), (158, 146), (146, 146), (125, 136), (104, 146), (92, 146), (96, 122)], 'h')
    # Unterkörper: Knie (sitzend, leicht gespreizt), Robe fällt bis zu den Schuhen
    f.part('lower')
    f.poly([(98, 184), (152, 184), (166, 204), (164, 246), (86, 246), (84, 204)], 'Q')
    f.part('shinL'); f.poly([(86, 208), (118, 208), (118, 246), (87, 246)], 'R')
    f.part('shinR'); f.poly([(132, 208), (164, 208), (163, 246), (132, 246)], 'R')
    f.part('kneeL'); f.ellipse(102, 203, 18, 10, 'R')
    f.part('kneeR'); f.ellipse(148, 203, 18, 10, 'R')
    f.part('hem'); f.poly([(85, 236), (165, 236), (166, 243), (84, 243)], 'g')
    f.part('shoeL'); f.poly([(98, 242), (116, 242), (117, 251), (98, 251), (92, 249), (89, 244), (93, 245)], 'B')
    f.part('shoeR'); f.poly([(134, 242), (152, 242), (157, 245), (161, 244), (158, 249), (152, 251), (133, 251)], 'B')
    f.part('soles'); f.rect(92, 251, 117, 253, 'w'); f.rect(133, 251, 158, 253, 'w')
    # Zierschurz (Bixi) in Kaisergelb mit Goldborte
    f.part('apronb'); f.poly([(111, 186), (139, 186), (142, 244), (108, 244)], 'g')
    f.part('apron'); f.poly([(114, 188), (136, 188), (139, 236), (111, 236)], 'Y')
    f.part('apronband'); f.poly([(110, 236), (140, 236), (141, 244), (109, 244)], 'r')
    # Oberkörper
    f.part('torso')
    f.poly([(102, 128), (148, 128), (160, 142), (158, 190), (92, 190), (90, 142)], 'R')
    f.part('inner'); f.poly([(116, 127), (134, 127), (125, 144)], 'w')
    # Kreuzkragen (rechts über links) mit Goldborte
    f.part('collarL'); f.curve([(111, 127), (115, 137), (126, 148), (140, 160)], 'g', w=4)
    f.part('collarR'); f.curve([(139, 127), (135, 136), (126, 145)], 'g', w=4)
    # rote Schärpe (diagonal wie auf der Karte) + Gürtel mit Jadeplatte
    f.part('sash'); f.curve([(96, 142), (120, 158), (154, 174)], 'r', w=6)
    f.part('belt'); f.rect(92, 180, 158, 188, 'g')
    f.part('beltjade'); f.rect(119, 179, 131, 189, 'j')
    # Ärmel (weit, hängend) – links hält das Zepter, rechts den Reichsapfel
    f.part('sleeveL')
    f.poly([(104, 130), (90, 134), (78, 150), (70, 176), (66, 202), (74, 208), (98, 204), (100, 178), (102, 154)], 'S')
    f.part('cuffL'); f.ellipse(82, 202, 14, 6, 'g')
    f.part('liningL'); f.ellipse(82, 202, 11, 3.5, 'r')
    f.part('sleeveR')
    f.poly([(146, 130), (160, 134), (172, 150), (180, 176), (184, 202), (176, 208), (152, 204), (150, 178), (148, 154)], 'S')
    f.part('cuffR'); f.ellipse(168, 192, 14, 6, 'g')
    f.part('liningR'); f.ellipse(168, 192, 11, 3.5, 'r')
    # Zepter (Ruyi aus Jade), in der linken Hand (Bildseite links)
    f.part('palmL'); f.ellipse(84, 198, 6, 5.5, 's')
    f.part('scepter')
    f.curve([(88, 220), (85, 204), (80, 180), (77, 162), (79, 146)], 'j', w=4, w1=3)
    f.part('scepterbands'); f.rect(74, 164, 82, 166, 'g', only='j'); f.rect(76, 150, 84, 152, 'g', only='j')
    f.part('ruyi')
    f.ellipse(79, 131, 6, 5.5, 'j'); f.ellipse(71, 137, 5, 4.5, 'j'); f.ellipse(87, 137, 5, 4.5, 'j')
    f.poly([(71, 140), (87, 140), (79, 148)], 'j')
    f.part('ruyigold'); f.ellipse(79, 137, 3.5, 3.5, 'g')
    f.part('ruyiruby'); f.ellipse(79, 137, 1.6, 1.6, 'j')
    f.part('fingersL'); f.ellipse(82, 199, 5.5, 5, 's')
    f.part('thumbL'); f.ellipse(87, 194, 2.5, 2.2, 's')
    # Reichsapfel: goldene Drachenperle, auf der rechten Hand emporgehalten
    f.part('wristR'); f.limb(168, 190, 168, 186, 4.5, 4.5, 's')
    f.part('palmR'); f.ellipse(168, 184, 8.5, 4.5, 's')
    f.part('orb'); f.ellipse(168, 171, 10.5, 10.5, 'o')
    f.part('orbtop'); f.ellipse(168, 158, 3.2, 3.2, 'p')
    f.part('orbflame', line=False)
    for a in (-0.8, 0, 0.8):
        f.limb(168 + math.sin(a) * 3, 157 - math.cos(a) * 3, 168 + math.sin(a) * 8, 157 - math.cos(a) * 9, 1.8, 0.4, 'f')
    for i, fx in enumerate((163, 167.5, 172, 176)):
        f.part('fingR%d' % i); f.ellipse(fx, 181 - (1 if 0 < i < 3 else 0), 2.3, 2.8, 's')
    f.part('thumbR'); f.ellipse(159, 179, 2.2, 3.2, 's')
    # Kopf
    f.part('neck'); f.rect(118, 116, 132, 130, 's')
    f.part('face')
    f.ellipse(CX, HY, 16, 14.5, 's')
    f.poly([(109, HY), (141, HY), (139, HY + 12), (132, HY + 18), (125, HY + 20), (118, HY + 18), (111, HY + 12)], 's')
    f.part('ears'); f.ellipse(108.5, HY + 3, 2.5, 4, 's', mirror=True)
    # Haar vorn: Pony + Strähnen neben dem Gesicht
    f.part('bangs')
    f.poly([(106, HY + 6), (107, HY - 8), (113, HY - 13), (125, HY - 15), (137, HY - 13), (143, HY - 8), (144, HY + 6),
            (141, HY - 3), (139, HY + 2), (136, HY - 5), (131, HY - 1), (127, HY - 7), (122, HY - 1), (117, HY - 6),
            (113, HY + 2), (110, HY - 3)], 'h')
    f.part('locks')
    f.poly([(106, HY - 6), (101, HY + 10), (101, HY + 26), (106, HY + 20), (108, HY + 8)], 'h', mirror=True)
    # Mütze (Guan) + Brett (Mian) der Bian-Krone
    f.part('cap'); f.poly([(106, HY - 10), (144, HY - 10), (142, HY - 27), (108, HY - 27)], 'C')
    f.part('capplate'); f.rect(119, HY - 25, 131, HY - 12, 'r')
    f.part('capplate2'); f.rect(122, HY - 22, 128, HY - 15, 'y')
    f.part('pin'); f.curve([(97, HY - 17), (153, HY - 17)], 'g', w=2)
    f.ellipse(97, HY - 17, 2.2, 2.2, 'g'); f.ellipse(153, HY - 17, 2.2, 2.2, 'g')
    f.part('board'); f.poly([(90, HY - 35), (160, HY - 35), (163, HY - 28), (87, HY - 28)], 'C')
    f.part('boardband'); f.poly([(87, HY - 29), (163, HY - 29), (163, HY - 27), (87, HY - 27)], 'g')


MATS = {
    's': mat(SKIN, pillow=3, k=1.3, bias=0.1),
    'h': mat(HAIR, pillow=4, k=1.8, noise=0.9, nscale=2, bias=0.05),
    'R': mat(ROBE, pillow=5, k=1.4, folds=(0.05, 0.28, 0.5)),
    'S': mat(ROBE, pillow=6, k=1.5, folds=(0.3, 0.12, 0.7)),
    'Y': mat(YEL, pillow=3, k=1.4, folds=(0.0, 0.3, 0.3)),
    'g': mat(GOLD, pillow=1.5, k=1.8, spec=True, spec_col=(255, 255, 230)),
    'y': mat(GOLD, pillow=1.5, k=1.2, bias=0.2),
    'o': mat(GOLD7, pillow=7, k=1.8, spec=True, spec_col=(255, 255, 240), bias=0.05),
    'r': mat(RED_CLOTH, pillow=2, k=1.3, bias=0.05),
    'p': mat([(120, 20, 20), (200, 50, 40), (250, 120, 70), (255, 200, 140), (255, 250, 230)], pillow=3, k=1.4, bias=0.2),
    'w': mat(WHITE_CLOTH, pillow=2, k=1.2),
    'Q': mat(ROBE[:4], pillow=3, k=1.2, bias=-0.15, folds=(0.4, 0.05, 0.6)),
    'j': mat(JADE, pillow=2.5, k=1.6, spec=True, spec_col=(230, 255, 240)),
    'C': mat(CAP, pillow=2, k=1.8, spec=True, spec_col=(160, 160, 190)),
    'B': mat(SHOE, pillow=2, k=1.5, spec=True, spec_col=(140, 130, 160)),
    'f': mat(FIRE, pillow=2, k=1.2, bias=0.25),
}
fz, fig = fig_draw(cv, emperor, MATS)

# ---------------------------------------------------------------- Details in voller Auflösung
# Gesichtshaut: sauberer Verlauf, Schatten unter Pony und Mütze
SKL = [(200, 124, 96), (232, 166, 132), (248, 200, 170), (255, 222, 198), (255, 240, 224)]
for y in range(HY - 12, HY + 22):
    for x in range(106, 145):
        if fz.L[y, x] == 's' and tuple(cv.a[y, x]) != OUT and not fz.inner_mask[y, x]:
            v = 0.8 - 0.32 * (y - HY + 6) / 26 - 0.14 * (x - 125) / 16
            if fz.L[y - 1, x] in 'hC' or fz.L[y - 2, x] in 'hC':
                v -= 0.35
            px(cv, x, y, rampc(SKL, v, x, y))
EYE = (54, 70, 110)
big_eye(cv, 111, HY, EYE, w=7, h=9, lash2=(40, 30, 50))
big_eye(cv, 132, HY, EYE, w=7, h=9, flip=True, lash2=(40, 30, 50))
for (x0, sg) in ((111, 1), (139, -1)):                        # Brauen, leicht streng
    for i in range(7):
        px(cv, x0 + sg * i, HY - 4 + (1 if i < 2 else 0) - (1 if i > 4 else 0) * 0, HAIR[1])
px(cv, 125, HY + 10, SKIN[2]); px(cv, 126, HY + 11, SKIN[1])   # Nase
for x in range(122, 129): px(cv, x, HY + 15, (130, 50, 46))     # ruhiges Lächeln
px(cv, 121, HY + 14, (130, 50, 46)); px(cv, 129, HY + 14, (130, 50, 46))
blush(cv, 111, HY + 11); blush(cv, 137, HY + 11)
# Perlenschnüre der Bian-Krone (vorn am Brett, seitlich des Gesichts)
BEADS = [(250, 250, 240), (210, 40, 40), (120, 214, 150), (250, 200, 80)]
for i, x in enumerate([90, 94, 98, 152, 156, 160]):
    L = 18 + ((i % 3) if i < 3 else (2 - i % 3)) * 5
    for s in range(L):
        y = HY - 26 + s
        if s % 3 == 2:
            px(cv, x, y, (70, 50, 40))
        else:
            c = BEADS[(s // 3 + i) % 4]
            px(cv, x, y, c)
            if s % 3 == 0:
                px(cv, x + 1, y, lerp(c, (0, 0, 0), 0.4))
# kurze Perlen vorn am Brett
for x in range(104, 147, 4):
    for s in range(2):
        px(cv, x, HY - 26 + s * 2, BEADS[(x // 4 + s) % 4])
# rote Kinnbänder vom Nadelende
for sg in (-1, 1):
    x0 = CX + sg * 28
    for s in range(36):
        x = x0 + sg * math.sin(s * 0.12) * 2
        px(cv, x, HY - 15 + s, RED_CLOTH[3] if s % 4 else RED_CLOTH[2])
    for s in range(5):
        px(cv, x0 + sg * 2, HY + 20 + s, RED_CLOTH[2]); px(cv, x0 + sg * 1, HY + 20 + s, RED_CLOTH[3])
# Sonne und Mond auf den Schultern (Kaiserrobe)
for (x, y, c1, c2) in [(102, 140, (250, 90, 50), (200, 40, 36)), (148, 140, (236, 240, 252), (170, 180, 210))]:
    for yy in range(y - 3, y + 4):
        for xx in range(x - 3, x + 4):
            if (xx - x) ** 2 + (yy - y) ** 2 <= 10:
                recolor_in(cv, fig, xx, yy, c1 if (xx - x) + (yy - y) < 1 else c2)
for (dx, dy) in [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1)]:
    recolor_in(cv, fig, 149 + dx, 140 + dy, (36, 104, 100))   # Mondsichel
# goldene Wolkenstickerei (Xiangyun-Motive) auf Robe und Ärmeln
for (x, y, fl) in [(96, 162, False), (148, 162, True), (74, 172, False), (146, 196, True), (92, 222, False), (152, 222, True),
                   (100, 150, True), (144, 150, False), (72, 186, True), (176, 204, False)]:
    stamp_in(cv, fig, x + 1, y + 1, CLOUD_MOTIF, {'#': GOLD[1]}, flip=fl)
    stamp_in(cv, fig, x, y, CLOUD_MOTIF, {'#': GOLD[3]}, flip=fl)
# Faltenwurf zwischen den Knien und an den Schienbeinen
for (x0, y0, x1, y1) in [(92, 214, 90, 236), (160, 214, 160, 236), (104, 216, 104, 234), (146, 216, 146, 234)]:
    for i in range(y1 - y0):
        recolor_in(cv, fig, x0 + (x1 - x0) * i / (y1 - y0), y0 + i, ROBE[1] if i % 5 else ROBE[2])
# Borte des Schurzes: kleine Rauten
for y in range(192, 234, 5):
    recolor_in(cv, fig, 125, y, RED_CLOTH[2]) if False else None
# Schurz: rotes Medaillon mit Goldspirale + Wolkenbänder
for yy in range(197, 212):
    for xx in range(117, 134):
        d = math.hypot(xx - CX, yy - 204)
        if d <= 6.5:
            recolor_in(cv, fig, xx, yy, RED_CLOTH[2] if d < 5.5 else GOLD[1])
spiral(cv, CX, 204, 4.5, 1.4, GOLD[3], a0=0, sgn=1)
for y0 in (216, 226):
    stamp_in(cv, fig, 115, y0, CLOUD_MOTIF, {'#': YEL[1]})
    stamp_in(cv, fig, 129, y0, CLOUD_MOTIF, {'#': YEL[1]}, flip=True)
for x in range(111, 140, 3):
    recolor_in(cv, fig, x, 240, GOLD[3])
# Schuhe: goldene Kappe
for (x0, x1) in ((94, 116), (134, 156)):
    for x in range(x0, x1):
        recolor_in(cv, fig, x, 245, GOLD[2] if x % 2 else GOLD[3])
# Finger (Linien zwischen den Fingern)
for y in (196, 199, 202):
    for x in range(78, 84):
        recolor_in(cv, fig, x, y, SKIN[1] if x > 78 else SKIN[0])

# Quaste am Zepter
for s in range(10):
    px(cv, 88 + (s > 5), 221 + s, RED_CLOTH[3] if s % 2 else RED_CLOTH[2])
    px(cv, 89 + (s > 5), 221 + s, RED_CLOTH[1])
# Glanz auf Apfel
sparkle(cv, 163, 166, (255, 255, 240), r=2, c2=GOLD[4])
for x in range(158, 179):                          # Jadeband mit Rubinen
    for y in (170, 171, 172):
        if math.hypot(x - 168, y - 171) < 10:
            recolor_in(cv, fig, x, y, JADE[3] if y == 170 else JADE[2] if y == 171 else JADE[1])
    if x % 5 == 0:
        recolor_in(cv, fig, x, 171, RUBY[3])

# ---------------------------------------------------------------- Weihrauchbecken (Ding) vorn, mit Rauch
BRONZE = [(30, 22, 16), (62, 46, 28), (104, 78, 40), (148, 114, 56), (196, 160, 90), (236, 214, 150)]
CXS = (38, 212)


def censers(f):
    for cx in CXS:
        f.part('leg%d' % cx)
        f.limb(cx - 8, 284, cx - 10, 298, 2, 1.5, 'z'); f.limb(cx + 8, 284, cx + 10, 298, 2, 1.5, 'z')
        f.limb(cx, 286, cx, 299, 2, 1.5, 'z')
        f.part('bowl%d' % cx)
        f.ellipse(cx, 278, 13, 9, 'z', a0=0, a1=180)
        f.rect(cx - 13, 272, cx + 13, 278, 'z')
        f.part('rim%d' % cx); f.rect(cx - 14, 270, cx + 14, 273, 'y')
        f.part('ear%d' % cx)
        f.rect(cx - 11, 264, cx - 8, 270, 'y'); f.rect(cx + 8, 264, cx + 11, 270, 'y')


fdz, dz = fig_draw(cv, censers, {'z': mat(BRONZE, pillow=4, k=1.6, spec=True, spec_col=(250, 230, 170)),
                                 'y': mat(GOLD, pillow=1.5, k=1.6)})
for cx in CXS:
    for (dx, dy) in [(-4, 276), (-3, 276), (3, 276), (4, 276), (0, 278), (-1, 279), (1, 279), (-5, 275), (5, 275)]:
        px(cv, cx + dx, dy, BRONZE[4])              # Taotie-Maske angedeutet
    engrave(cv, [(cx - 11, 281), (cx + 11, 281)], BRONZE[0], BRONZE[3])
    for x in range(cx - 10, cx + 11):
        px(cv, x, 269, FIRE[3] if x % 2 else FIRE[2])
    glow(cv, cx, 266, 14, (255, 170, 80), k=0.35, mix=0.3)
    for i in range(3):
        ph = i * 2.1 + cx
        for s in range(74):
            y = 266 - s
            x = cx + math.sin(s * 0.12 + ph) * (2 + s * 0.12) + (i - 1) * 3
            if s > 50 and BAYER4[int(y) % 4, int(x) % 4] < (s - 50) / 26:
                continue
            k = 0.8 if s < 36 else 0.55
            blend_px(cv, x, y, (255, 246, 240), k); blend_px(cv, x + 1, y, (236, 210, 214), k * 0.8)
            blend_px(cv, x - 1, y, (150, 100, 110), 0.35)
    spiral(cv, cx - 4, 206, 4, 1.1, (250, 232, 226), a0=0, sgn=1)
    spiral(cv, cx + 5, 216, 3, 1.1, (250, 232, 226), a0=math.pi, sgn=-1)

# Funken / Glanzpunkte
for (x, y) in [(52, 150), (198, 150), (96, 58), (154, 58), (30, 170), (220, 160), (125, 50)]:
    sparkle(cv, x, y, (255, 250, 220), r=2, c2=(255, 180, 90))

vignette(cv, (40, 10, 20), strength=0.35)
emblem = emblem_generic([".##.##.", "#..#..#", "#..#..#", "...#...", "...#..."],
                        {'#': (255, 206, 90)})
p = finish(cv, 'IV', 'ZHIGAO', out='04_emperor_zhigao', emblem=emblem)
print(p)
