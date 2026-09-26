# -*- coding: utf-8 -*-
# III – Die Herrscherin: Victorica, the Eternal Empress
# Victorica thront auf roten Kissen inmitten eines Weizenfelds, das Zepter in der Hand, neben ihr das
# herzförmige Schild mit dem Venus-Zeichen. Hinter ihrem Kopf die Uhr ihres Thrones, deren zwölf
# Stundenmarken die zwölf Sterne der Krone bilden. Dahinter Wald, Wasserfall und goldener Himmel –
# und ganz hinten am Horizont, kaum sichtbar, qualmende Fabrikschlote (ihr Archetyp: „Pollution“).
from tarot_fmhe_helpers import *

cv = new_card()
rnd = random.Random(11)
# ---------------------------------------------------------------- Himmel (goldener Nachmittag)
sky(cv, [(70, 110, 190), (104, 150, 214), (150, 190, 230), (214, 214, 214), (250, 222, 170), (255, 236, 190)], y1=200)
glow(cv, 125, 150, 110, (255, 240, 200), k=0.4, mix=0.25)
CL = [(170, 150, 170), (214, 190, 196), (240, 220, 214), (255, 240, 230), (255, 252, 244)]
puffy_cloud(cv, 50, 80, 50, 14, CL, seed=3)
puffy_cloud(cv, 200, 66, 50, 13, CL, seed=9)
puffy_cloud(cv, 214, 112, 30, 8, CL, seed=4)
# ---------------------------------------------------------------- ferne Hügel + Fabrikschlote (Ironie)
hills(cv, 172, 5, [(120, 140, 170), (140, 160, 186), (160, 180, 200)], freq=0.03, seed=2)
FAC = (112, 112, 134); FAC2 = (92, 92, 114)
# Fabrikhalle mit Sägezahndach
for x in range(28, 66):
    top = 163 + (x - 28) % 7 // 2
    for y in range(top, 176):
        px(cv, x, y, FAC if (x - 28) % 7 < 4 else FAC2)
for x in range(28, 66, 3):
    px(cv, x, 170, (230, 200, 120))       # erleuchtete Fenster
for (sx_, sh) in [(34, 30), (44, 24), (56, 34)]:
    for y in range(166 - sh, 168):
        for x in range(sx_ - 1, sx_ + 2):
            px(cv, x, y, FAC if x < sx_ + 1 else FAC2)
        if (y - 166 + sh) % 8 == 3:
            px(cv, sx_ - 1, y, (170, 80, 70)); px(cv, sx_, y, (190, 100, 90))
    for x in range(sx_ - 2, sx_ + 3):
        px(cv, x, 166 - sh, (70, 64, 80))
# Smog-Schwaden (grau-bräunlich, gedithert), treiben nach rechts oben
for (cx_, cy_, r_) in [(36, 126, 8), (46, 118, 10), (58, 118, 11), (60, 106, 10), (74, 98, 12), (92, 92, 10), (40, 138, 6), (56, 124, 7)]:
    for y in range(cy_ - r_, cy_ + r_):
        for x in range(cx_ - r_ * 2, cx_ + r_ * 2):
            d = math.hypot((x - cx_) / 1.8, y - cy_) / r_
            if d < 1 and in_art(x, y) and BAYER4[y % 4, x % 4] < (1 - d) * 1.1:
                blend_px(cv, x, y, (140, 128, 124) if y > cy_ - r_ / 3 else (170, 160, 156), 0.5)

# ---------------------------------------------------------------- Wasserfall rechts
FW0, FW1 = 176, 200
ROCKW = [(40, 44, 50), (70, 74, 80), (104, 108, 110), (140, 142, 140), (176, 176, 170)]
# Felsen, über die das Wasser fällt
Mr = poly_mask([(160, 120), (176, 100), (206, 96), (234, 104), (234, 232), (150, 232)])
facet_rock(cv, Mr & art_mask(), ROCKW, n=30, seed=5, bias=0.05, crack=(30, 32, 40))
WATER = [(40, 90, 140), (70, 140, 190), (130, 190, 230), (200, 236, 250), (255, 255, 255)]
for y in range(100, 226):
    for x in range(FW0, FW1):
        if not in_art(x, y):
            continue
        streak = math.sin(x * 1.7 + math.sin(x * 0.7) * 2) * 0.5 + 0.5
        v = 0.45 + streak * 0.4 + ((y * 3 + x * 5) % 11) / 30 - (0.1 if x in (FW0, FW1 - 1) else 0)
        px(cv, x, y, rampc(WATER, v, x, y))
# Gischt unten
for _ in range(160):
    x = rnd.randint(FW0 - 10, FW1 + 10); y = int(222 + abs(rnd.gauss(0, 4)))
    if in_art(x, y):
        px(cv, x, y, rnd.choice([(255, 255, 255), (220, 240, 250), (190, 220, 240)]))
# ---------------------------------------------------------------- Wald links und rechts
TREE = [(8, 34, 24), (16, 60, 34), (30, 92, 44), (56, 128, 56), (100, 170, 76), (150, 206, 110)]
TREE2 = [(12, 42, 36), (22, 72, 48), (40, 104, 58), (70, 142, 74), (120, 186, 100), (170, 220, 140)]
for (tx, ty, tw, th, sd, trunk) in [(22, 176, 30, 36, 1, 40), (216, 118, 40, 40, 5, 60), (230, 170, 32, 44, 6, 60),
                                    (58, 196, 32, 26, 2, 30), (206, 204, 36, 30, 8, 30), (20, 214, 34, 26, 3, 20)]:
    for y in range(ty, ty + trunk):
        for x in (tx - 1, tx, tx + 1):
            if in_art(x, y):
                px(cv, x, y, (70, 44, 30) if x == tx - 1 else (46, 28, 20))
    tree_canopy(cv, tx, ty, tw, th, TREE if sd % 2 else TREE2, seed=sd)
# Wiese hinter dem Feld mit Teich (vom Wasserfall)
MEAD = [(40, 96, 40), (60, 130, 50), (90, 160, 60), (130, 190, 80)]
nm = noise(H, W, 4, seed=3)
for y in range(214, 250):
    for x in range(AX0, AX1):
        v = 0.6 - (y - 214) / 60 + (nm[y, x] - 0.5) * 0.5
        px(cv, x, y, rampc(MEAD, v, x, y))
for y in range(222, 236):
    for x in range(150, AX1):
        if ((x - 196) / 40) ** 2 + ((y - 229) / 7) ** 2 <= 1:
            v = 0.5 + 0.3 * math.sin(x * 0.6 + y) + (0.3 if (x + y * 3) % 7 == 0 else 0)
            px(cv, x, y, rampc(WATER, v, x, y))
# Rosenbüsche am Wiesenrand
for (bx, by) in [(26, 222), (60, 228), (190, 244), (224, 240)]:
    tree_canopy(cv, bx, by - 3, 24, 12, TREE2, seed=bx)
    for k in range(5):
        x = bx + rnd.randint(-10, 10); y = by + rnd.randint(-8, 0)
        sparkle(cv, x, y, (240, 90, 110), r=1, c2=(170, 30, 60))

# ---------------------------------------------------------------- Farben
SKINV = [(70, 86, 146), (116, 140, 196), (164, 190, 232), (204, 222, 248), (230, 240, 255), (248, 251, 255)]
HAIRV = [(8, 18, 34), (14, 36, 58), (24, 62, 86), (42, 96, 118), (74, 138, 156), (120, 186, 196)]
CROWN = [(56, 6, 20), (104, 16, 36), (156, 30, 52), (206, 58, 72), (236, 110, 112), (255, 170, 160)]
ROBEB = [(12, 14, 50), (24, 30, 94), (40, 52, 144), (64, 84, 190), (104, 126, 226), (156, 172, 246)]
PINK = [(70, 18, 40), (118, 36, 62), (166, 66, 88), (206, 104, 118), (236, 150, 154), (252, 196, 190)]
LAV = [(80, 72, 130), (130, 122, 180), (180, 176, 222), (222, 220, 246), (246, 246, 255)]
VELVET = [(50, 6, 16), (96, 14, 28), (146, 26, 40), (196, 52, 58), (232, 100, 90)]
IVORY = [(150, 130, 100), (200, 184, 150), (232, 222, 196), (248, 244, 228), (255, 255, 246)]

MATS = {
    's': mat(SKINV, pillow=5, k=0.9, bias=0.06),
    'S': mat(SKINV, pillow=2, k=0.7, bias=0.18),
    'h': mat(HAIRV, pillow=4, k=1.8, noise=0.9, nscale=2, bias=0.05),
    'r': mat(ROBEB, pillow=5, k=1.5, folds=(0.3, 0.03, 0.7), bias=0.05),
    'q': mat(ROBEB[:4], pillow=1, k=1.0, bias=-0.25),
    'u': mat(ROBEB[2:], pillow=1, k=1.0, bias=0.1),
    'l': mat(LAV, pillow=2, k=1.3, bias=0.1),
    'p': mat(PINK, pillow=5, k=1.6, bias=0.05),
    'g': mat(GOLD, pillow=2, k=1.7, spec=True, spec_col=(255, 255, 230), bias=0.05),
    'G': mat(GOLD7, pillow=2, k=1.8, spec=True, spec_col=(255, 255, 236), bias=0.1),
    'e': mat([(80, 6, 24), (140, 16, 40), (196, 36, 60), (236, 80, 96), (255, 150, 160)], pillow=5, k=1.6, bias=0.1),
    'v': mat(VELVET, pillow=6, k=1.3, bias=-0.05),
    'V': mat(VELVET, pillow=4, k=1.6, bias=0.05),
    'i': mat(IVORY, pillow=6, k=0.8, bias=0.15),
    'c': mat(CROWN, pillow=5, k=1.7, bias=0.08),
    'd': mat([(20, 16, 30), (40, 34, 56), (70, 64, 90)], pillow=1, k=1),
}
# ---- Thron (eigene Ebene): Rückenlehne mit großer Uhr
t = Fig(W, H)
TB = [(76, 252), (76, 116), (86, 94), (104, 76), (125, 68), (146, 76), (164, 94), (174, 116), (174, 252)]
t.part('throneBack'); t.poly(TB, 'v')
t.part('frame'); t.curve(TB, 'g', w=3)
t.part('finialL'); t.ellipse(76, 114, 5, 5, 'g'); t.part('finialR'); t.ellipse(174, 114, 5, 5, 'g')
t.part('topfin'); t.poly([(119, 70), (125, 54), (131, 70)], 'g'); t.ellipse(125, 52, 3, 3, 'g')
CLX, CLY, CLR = 125, 114, 44
t.part('clockring'); t.ellipse(CLX, CLY, CLR, CLR, 'g')
t.part('clockface'); t.ellipse(CLX, CLY, CLR - 4, CLR - 4, 'i')
t.part('armL'); t.poly([(60, 202), (84, 198), (86, 252), (62, 252)], 'g')
t.part('armR'); t.poly([(190, 202), (166, 198), (164, 252), (188, 252)], 'g')
t.part('cushArmL'); t.ellipse(72, 200, 14, 6, 'V')
t.part('cushArmR'); t.ellipse(178, 200, 14, 6, 'V')
t.part('seat'); t.poly([(70, 228), (180, 228), (188, 252), (62, 252)], 'V')
t.part('base'); t.poly([(56, 252), (194, 252), (198, 268), (52, 268)], 'g')
t.outline()
cv.paste(t.render(MATS), 0, 0)
# Uhr: zwölf Sterne als Stundenmarken (= die zwölf Sterne der Krone), Minutenstriche, Ziffernring
for i in range(60):
    a = -math.pi / 2 + i * math.pi / 30
    for rr in (CLR - 6, CLR - 7):
        x = CLX + math.cos(a) * rr; y = CLY + math.sin(a) * rr
        if i % 5:
            px(cv, x, y, IVORY[0]) if rr == CLR - 6 else None
arc_px(cv, CLX, CLY, CLR - 9, CLR - 9, 0, 2 * math.pi, IVORY[1], 300)
for i in range(12):
    a = -math.pi / 2 + i * math.pi / 6
    x = int(round(CLX + math.cos(a) * (CLR - 13))); y = int(round(CLY + math.sin(a) * (CLR - 13)))
    star_px(cv, x, y, (255, 214, 70), r=3, c2=(210, 130, 30))
    px(cv, x, y, (255, 255, 220))
# Zeiger (ragen seitlich hinter dem Kopf hervor): ewig kurz vor zwölf
for (a, L, w_) in [(-math.pi / 2 - math.pi / 6 * 2.2, 34, 1), (-math.pi / 2 + math.pi / 6 * 1.8, 26, 2)]:
    for s_ in np.linspace(0, L, 80):
        for o in range(w_):
            x = CLX + math.cos(a) * s_ + o; y = CLY + math.sin(a) * s_
            px(cv, x, y, (40, 30, 56))
# Samt-Muster (goldene Lilien-Punkte) auf der Rückenlehne außerhalb der Uhr
for y in range(160, 250, 8):
    for x in range(82, 170, 8):
        if math.hypot(x - CLX, y - CLY) > CLR + 3 and tuple(cv.a[y, x]) in set(tuple(c) for c in VELVET):
            px(cv, x, y, GOLD[2]); px(cv, x, y - 1, GOLD[3])

# ---- Figur
f = Fig(W, H)
# Haare hinten (lang, dunkeltürkis)
f.part('hairB')
f.poly([(104, 120), (146, 120), (156, 150), (158, 186), (150, 196), (100, 196), (92, 186), (94, 150)], 'h')
# Kleid: Schoß (Oberschenkel nach vorn), Knie, dann fällt der Rock in Falten bis auf den Sockel
hem = []
for i in range(25):
    x = 76 + i * (174 - 76) / 24
    hem.append((x, 262 + 2 * math.sin(i * 1.4)))
f.part('skirt')
f.poly([(106, 186), (144, 186), (156, 200), (162, 222), (168, 246), (174, 262)] + hem[::-1] + [(76, 262), (82, 246), (88, 222), (94, 200)], 'r')
f.part('lap', line=False); f.poly([(100, 196), (150, 196), (152, 214), (98, 214)], 'r')
f.part('kneeL'); f.ellipse(110, 216, 13, 8, 'r')
f.part('kneeR'); f.ellipse(140, 216, 13, 8, 'r')
# Faltenwurf unterhalb der Knie: Täler (dunkel) und Grate (hell)
f.part('folds', line=False)
for (x0, y0, x1, y1, w0) in [(99, 224, 88, 258, 2.4), (111, 225, 106, 262, 1.8), (139, 225, 144, 262, 1.8), (151, 224, 162, 258, 2.4),
                             (92, 232, 81, 258, 1.4), (158, 232, 169, 258, 1.4)]:
    f.limb(x0, y0, x1, y1, 0.6, w0, 'q')
for (x0, y0, x1, y1, w0) in [(105, 225, 97, 260, 1.4), (145, 225, 153, 260, 1.4), (116, 226, 113, 262, 1.0), (134, 226, 137, 262, 1.0)]:
    f.limb(x0, y0, x1, y1, 0.5, w0, 'u')
f.curve([(114, 222), (119, 230), (125, 233), (131, 230), (136, 222)], 'q', w=1.6)     # Mulde zwischen den Knien
f.curve([(100, 212), (108, 208), (118, 208)], 'u', w=1.3); f.curve([(132, 208), (142, 208), (150, 212)], 'u', w=1.3)
f.curve([(104, 198), (114, 202), (124, 204)], 'q', w=1.0); f.curve([(126, 204), (136, 202), (146, 198)], 'q', w=1.0)
# goldene Borten: Saum und vordere Kante der Schleppe
f.part('hemBorder'); f.curve([(hx, hy - 2) for hx, hy in hem], 'g', w=3)
f.part('panelL'); f.curve([(119, 190), (117, 214), (113, 240), (110, 260)], 'g', w=2)
f.part('panelR'); f.curve([(131, 190), (133, 214), (137, 240), (140, 260)], 'g', w=2)
# Oberkörper (Mieder)
f.part('torso')
f.poly([(106, 150), (144, 150), (146, 166), (142, 190), (108, 190), (104, 166)], 'r')
f.part('tfolds', line=False)
f.limb(111, 170, 113, 186, 0.4, 1.0, 'q'); f.limb(139, 170, 137, 186, 0.4, 1.0, 'q')
f.part('collarL'); f.line(107, 150, 124, 162, 'l', w=2)
f.part('collarR'); f.line(143, 150, 126, 162, 'l', w=2)
f.part('emblem'); f.rect(118, 164, 132, 178, 'g')
f.part('emblemIn'); f.rect(121, 167, 129, 175, 'r')
f.part('belt'); f.poly([(106, 185), (144, 185), (144, 190), (106, 190)], 'g')
# Puffärmel (rosa-rot wie auf der Karte)
f.part('puffL'); f.ellipse(101, 160, 12, 11, 'p')
f.part('puffR'); f.ellipse(149, 160, 12, 11, 'p')
# linker Arm (Betrachter): Ellbogen nach außen, Hand umfasst das Zepter vor dem Knie
f.part('armLl'); f.limb(95, 168, 86, 190, 6, 5.5, 'r')
f.part('armLf', line=False); f.limb(92, 172, 87, 186, 0.4, 1.2, 'q')
f.part('foreLl'); f.limb(86, 190, 96, 202, 5.5, 5, 'r')
f.part('cuffLl'); f.limb(93, 198, 96, 202, 5.5, 5.5, 'g')
f.part('scepter'); f.limb(102, 238, 88, 108, 1.8, 1.8, 'g')
f.part('scepterOrb'); f.ellipse(88, 104, 5, 5, 'g')
f.part('scepterCross'); f.rect(87, 92, 89, 99, 'g'); f.rect(85, 95, 91, 96, 'g')
f.part('handLl'); f.poly([(95, 199), (103, 198), (105, 203), (104, 209), (97, 210), (94, 205)], 'S')
# rechter Arm: Unterarm liegt auf dem Oberschenkel, Hand ruht auf dem Knie
f.part('armRr'); f.limb(155, 168, 162, 192, 6, 5.5, 'r')
f.part('armRf', line=False); f.limb(158, 172, 162, 188, 0.4, 1.2, 'q')
f.part('foreRr'); f.limb(162, 192, 148, 208, 5.5, 5, 'r')
f.part('cuffRr'); f.limb(152, 204, 149, 207, 5.5, 5.5, 'g')
f.part('handRr'); f.poly([(146, 203), (140, 206), (135, 212), (136, 215), (142, 214), (148, 211), (150, 206)], 'S')
# Kopf
f.part('neck'); f.rect(121, 141, 129, 151, 's')
cx, cy = 125, 128
f.part('face')
f.ellipse(cx, cy + 1, 16, 14, 's')
f.poly([(cx - 15, cy + 3), (cx + 15, cy + 3), (cx + 12, cy + 11), (cx + 5, cy + 16), (cx, cy + 17), (cx - 5, cy + 16), (cx - 12, cy + 11)], 's')
f.part('bangs')      # gerader Pony (Hime-Schnitt)
f.poly([(cx - 18, cy + 2), (cx - 18, cy - 7), (cx - 12, cy - 11), (cx + 12, cy - 11), (cx + 18, cy - 7), (cx + 18, cy + 2),
        (cx + 15, cy - 2), (cx + 10, cy - 3), (cx + 5, cy - 2), (cx, cy - 3), (cx - 5, cy - 2), (cx - 10, cy - 3), (cx - 15, cy - 2)], 'h')
f.part('lockL'); f.poly([(cx - 21, cy - 4), (cx - 16, cy - 2), (cx - 16, cy + 22), (cx - 22, cy + 22)], 'h')
f.part('lockR'); f.poly([(cx + 21, cy - 4), (cx + 16, cy - 2), (cx + 16, cy + 22), (cx + 22, cy + 22)], 'h')
# Krone: hohe rote Haube mit goldenen Spangen
f.part('crown')
f.poly([(cx - 16, cy - 8), (cx - 18, cy - 18), (cx - 14, cy - 28), (cx - 6, cy - 35), (cx, cy - 36), (cx + 6, cy - 35), (cx + 14, cy - 28),
        (cx + 18, cy - 18), (cx + 16, cy - 8)], 'c')
f.part('crownBand'); f.poly([(cx - 17, cy - 12), (cx + 17, cy - 12), (cx + 16, cy - 6), (cx - 16, cy - 6)], 'g')
f.part('crownTip'); f.rect(cx - 1, cy - 43, cx + 1, cy - 36, 'd'); f.ellipse(cx, cy - 44, 2.5, 2.5, 'g')
# Herzschild mit Venus-Zeichen (lehnt rechts am Thron)
SHX, SHY = 196, 230
f.part('shield')
f.ellipse(SHX - 8, SHY - 7, 10, 10, 'G'); f.ellipse(SHX + 8, SHY - 7, 10, 10, 'G')
f.poly([(SHX - 17, SHY - 3), (SHX + 17, SHY - 3), (SHX, SHY + 20)], 'G')
f.part('enamel')
f.ellipse(SHX - 7, SHY - 7, 7, 7, 'e'); f.ellipse(SHX + 7, SHY - 7, 7, 7, 'e')
f.poly([(SHX - 13, SHY - 4), (SHX + 13, SHY - 4), (SHX, SHY + 15)], 'e')
f.outline()
fig = f.render(MATS)
cv.paste(fig, 0, 0)
def inside(x, y):
    return fig[int(y), int(x), 3] > 0 and tuple(cv.a[int(y), int(x)]) != OUT

# ---------------------------------------------------------------- Gesicht (geisterhaft blau, leuchtende Augen)
EYE = (30, 200, 214)
big_eye(cv, 112, 128, EYE, w=6, h=9, glow_=True)
big_eye(cv, 132, 128, EYE, w=6, h=9, flip=True, glow_=True)
for (ex, ey) in [(115, 133), (135, 133)]:
    glow(cv, ex, ey, 7, (120, 255, 250), k=0.45, mix=0.22)
# Brauen: elegant geschwungen, leicht hochmütig
for (bx, d) in [(112, 1), (132, -1)]:
    for i in range(6):
        yb = 124 - (1 if (d > 0 and i >= 3) or (d < 0 and i <= 2) else 0)
        px(cv, bx + i, yb, HAIRV[0])
# Nase, Mund (spöttisches Lächeln, dunkles Lila), Wangen-/Kinnkontur
px(cv, 126, 139, SKINV[1]); px(cv, 125, 140, SKINV[2])
MC = (70, 30, 80)
for x in range(122, 129): px(cv, x, 143, MC)
px(cv, 129, 142, MC); px(cv, 130, 141, MC); px(cv, 121, 142, MC)
for x in range(123, 128): px(cv, x, 144, (190, 110, 170))
for (x, y) in [(113, 139), (112, 138), (114, 141), (137, 139), (138, 138), (136, 141), (118, 145), (132, 145), (121, 146), (129, 146)]:
    px(cv, x, y, SKINV[1])
for (bx, by) in [(113, 139), (133, 139)]:
    for dx in range(5):
        if (bx + dx + by) % 2 == 0:
            blend_px(cv, bx + dx, by, (200, 150, 240), 0.6)
# Krone: Rautenmuster + Spangen + Juwelen (wie das Karomuster auf der Karte)
for y in range(cy - 40, cy - 12):
    for x in range(cx - 18, cx + 19):
        if inside(x, y) and tuple(cv.a[y, x]) in set(tuple(c) for c in CROWN):
            if (x + y) % 6 == 0 or (x - y) % 6 == 0:
                px(cv, x, y, CROWN[1])
for sx_ in (-9, 0, 9):
    for y in range(cy - 38 + abs(sx_) // 3, cy - 12):
        x = cx + sx_ * (1 - (cy - 12 - y) / 60)
        if inside(x, y):
            px(cv, x, y, IVORY[3] if y % 3 else IVORY[2])
for (x, y, c) in [(cx - 12, cy - 9, AMETH), (cx, cy - 9, RUBY), (cx + 12, cy - 9, AMETH), (cx - 6, cy - 9, SAPH), (cx + 6, cy - 9, SAPH)]:
    px(cv, x, y, c[2]); px(cv, x - 1, y, c[3]); px(cv, x, y - 1, c[4])
# Brust-Emblem: goldenes Quadrat mit blauem Stein (wie auf der Karte)
for (dx, dy, c) in [(0, 0, SAPH[2]), (1, 0, SAPH[2]), (0, 1, SAPH[1]), (1, 1, SAPH[1]), (0, -1, SAPH[3]), (-1, 0, SAPH[3])]:
    px(cv, 125 + dx - 1, 171 + dy - 1, c)
# Sterne auf dem Rock (Lavendel)
for (x, y) in [(97, 240), (153, 240), (125, 250), (90, 228), (160, 228)]:
    if inside(x, y):
        sparkle(cv, x, y, GOLD[4], r=1, c2=GOLD[2])
# Venus-Zeichen auf dem Schild (gold auf rotem Email)
VX, VY = SHX, SHY - 7
for (col, off) in [(GOLD7[1], 1), (GOLD7[5], 0)]:
    arc_px(cv, VX + off, VY + off, 4, 4, 0, 2 * math.pi, col, 40)
    for y in range(VY + 4, VY + 13):
        px(cv, VX + off, y + off, col)
    for x in range(VX - 3, VX + 4):
        px(cv, x + off, VY + 8 + off, col)
# Schild-Glanz
for tt in np.linspace(math.pi * 1.1, math.pi * 1.6, 10):
    px(cv, SHX - 8 + math.cos(tt) * 8, SHY - 7 + math.sin(tt) * 8, (255, 200, 200))
# Zepter-Juwel
px(cv, 88, 104, RUBY[3]); px(cv, 87, 103, RUBY[4]); px(cv, 89, 105, RUBY[1])
sparkle(cv, 88, 90, (255, 255, 230), r=3, c2=(255, 200, 80))
# Quasten an den Kissen
for (tx, ty) in [(61, 200), (189, 200), (66, 250), (184, 250)]:
    for k in range(4):
        px(cv, tx, ty + k, GOLD[3] if k < 3 else GOLD[1])
    px(cv, tx - 1, ty + 3, GOLD[2]); px(cv, tx + 1, ty + 3, GOLD[2])
# Finger
# Zepterhand: vier Finger quer um den Stab (Fugen dunkel), Daumen oben, Knöchel rechts
FD, FM, FL = SKINV[0], SKINV[2], SKINV[4]
for fy in (202, 204, 206, 208):
    for fx in range(96, 104):
        if inside(fx, fy):
            px(cv, fx, fy, FD if fx < 103 else FM)
for fx in range(99, 104):
    if inside(fx, 200):
        px(cv, fx, 200, FL)                      # Daumen
px(cv, 98, 200, FD); px(cv, 104, 201, FM)
for fy in (203, 205, 207):
    if inside(103, fy):
        px(cv, 103, fy, FL)                      # Knöchel-Glanz
# Hand auf dem Knie: Finger schräg nach unten, dunkle Fugen, heller Handrücken
for (x0, y0) in [(142, 205), (144, 207), (146, 209)]:
    for k in range(5):
        x, y = x0 - k, y0 + k * 1.1
        if inside(x, y):
            px(cv, x, y, FD)
for (x, y) in [(147, 204), (146, 204), (148, 205)]:
    if inside(x, y):
        px(cv, x, y, FL)

# ---------------------------------------------------------------- Weizenfeld (vorne)
WHEAT = [(110, 60, 10), (160, 100, 18), (204, 144, 30), (234, 184, 56), (250, 214, 100), (255, 238, 160)]
STALK = [(96, 90, 24), (140, 128, 44), (186, 170, 76)]
EAR_OUT = (84, 44, 10)
def ear(bx, by, n, sc, lean):
    """Weizenähre aus Körnern im Fischgrätmuster: n Kornpaare, sc = Korngröße (1 oder 2 px)"""
    def blk(x, y, c):
        for dy in range(sc):
            for dx in range(sc):
                if in_art(x + dx, y + dy):
                    px(cv, x + dx, y + dy, c)
    pts = []
    for k in range(n):
        pts.append((bx + lean * k * 2 * sc, by - k * 2 * sc))
    # Kontur: dunkler Rand um alle Körner
    for (xk, yk) in pts + [(pts[-1][0], pts[-1][1] - sc * 2)]:
        for (ox, oy) in [(-sc, -sc), (sc, 0), (0, 0), (0, sc)]:
            for dy in range(-1, sc + 1):
                for dx in range(-1, sc + 1):
                    if in_art(xk + ox + dx, yk + oy + dy):
                        px(cv, xk + ox + dx, yk + oy + dy, EAR_OUT)
    for k, (xk, yk) in enumerate(pts):
        blk(xk, yk + sc, WHEAT[1])                                  # Fuge
        blk(xk - sc, yk - sc, WHEAT[4] if k < n - 1 else WHEAT[3])   # linkes Korn (Licht)
        blk(xk + sc, yk, WHEAT[2])                                  # rechtes Korn (Schatten)
        blk(xk, yk, WHEAT[3])                                       # Mitte
        if sc > 1:
            px(cv, xk - sc, yk - sc, WHEAT[5])
    # Spitze + Grannen
    xt, yt = pts[-1]
    blk(xt, yt - sc * 2, WHEAT[4]); blk(xt, yt - sc * 3, EAR_OUT)
    for q in (-1, 0, 1):
        for s_ in range(n + 3):
            x = xt + q * (1 + s_ * 0.35) + lean * s_; y = yt - sc * 2 - s_
            if in_art(x, y) and s_ % 2 == 0:
                blend_px(cv, x, y, WHEAT[5], 0.65)
def stalk(x0, y0, x1, y1):
    for tt in np.linspace(0, 1, int(abs(y1 - y0)) + 2):
        x = x0 + (x1 - x0) * tt; y = y0 + (y1 - y0) * tt
        if in_art(x, y):
            px(cv, x, y, STALK[1] if tt < 0.9 else STALK[2])
            px(cv, x + 1, y, STALK[0])
# dichter Feldgrund (Halme + Schatten), zum Vordergrund dunkler
nw = noise(H, W, 3, seed=44)
FIELD = [(70, 44, 12), (120, 80, 20), (170, 120, 30), (212, 164, 50), (240, 206, 100)]
for y in range(250, AY1):
    for x in range(AX0, AX1):
        top = 252 + math.sin(x * 0.45) * 1.5 + math.sin(x * 1.3) * 1.0 + 16 * math.exp(-((x - 125) / 46) ** 4)
        if y >= top:
            # dichte senkrechte Halme: helle/dunkle Striche, oben heller
            ph = (x * 0.9 + math.sin(x * 0.37) * 3) % 3
            streak = 0.22 if ph < 1 else (-0.12 if ph > 2 else 0.05)
            v = 0.5 - (y - 252) / 110 + (nw[y, x] - 0.5) * 0.35 + streak
            px(cv, x, y, rampc(FIELD, v, x, y))
# Ähren in vier Reihen, hinten klein, vorne groß; in der Mitte etwas niedriger
rows = [(262, 4, 1, 24), (274, 5, 1, 19), (288, 5, 2, 13), (304, 6, 2, 10), (316, 6, 2, 9)]
for (yb, L, wd, n) in rows:
    for i in range(n):
        x0 = AX0 + (i + 0.2 + rnd.random() * 0.6) * (AX1 - AX0) / n
        lean = rnd.uniform(-0.35, 0.35)
        hgt = (yb - 244) * rnd.uniform(0.45, 0.7)
        if abs(x0 - 125) < 46:
            if yb < 280:
                continue                     # vor dem Saum keine hohen Ähren
            hgt *= 0.2
        ex, ey = x0 + math.sin(lean) * hgt, yb - hgt
        stalk(x0, min(AY1 - 1, yb), ex, ey)
        ear(int(ex), int(ey), L, wd, lean * 0.3)
# Kornblumen + Mohn im Feld
for _ in range(22):
    x = rnd.randint(AX0 + 2, AX1 - 3); y = rnd.randint(262, AY1 - 3)
    small_flower(cv, x, y, rnd.choice([(80, 120, 240), (230, 50, 50)]), center=(40, 20, 40))
# Vögel am Himmel
for (bx, by) in [(150, 60), (160, 66), (142, 70)]:
    for dx, dy in [(-2, -1), (-1, 0), (1, 0), (2, -1)]:
        px(cv, bx + dx, by + dy, (60, 70, 110))
    px(cv, bx, by + 1, (60, 70, 110))
# Schmetterlinge / Glanz
for (x, y) in [(60, 120), (196, 150), (150, 90), (70, 250), (210, 262)]:
    sparkle(cv, x, y, (255, 250, 220), r=1)
vignette(cv, (40, 20, 10), strength=0.35, r0=0.75)

emblem_venus = emblem_generic([".###.", "#...#", "#...#", ".###.", "..#..", ".###.", "..#.."], {'#': (255, 200, 210)})
finish(cv, 'III', 'VICTORICA', out='03_empress_victorica', emblem=emblem_venus)
print('ok')
