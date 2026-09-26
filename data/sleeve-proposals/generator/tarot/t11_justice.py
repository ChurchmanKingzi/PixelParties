# -*- coding: utf-8 -*-
# XI – Die Gerechtigkeit: Madame Guillotine, the Great Equalizer
# Madame Guillotine thront frontal zwischen zwei Steinsäulen vor einem violetten Vorhang. Die Rückenlehne
# ihres "Throns" ist eine Guillotine, deren Fallbeil über ihrer Krone hängt. In der Rechten hält sie
# aufrecht ihre Klingenfahne (statt des Schwerts), in der Linken die Waage – auf der eine Krone und ein
# Stück Kuchen exakt gleich viel wiegen. Schachbrett-Marmorboden, goldene Fransen.
from t08_helpers import *

cv = new_card()
rnd = random.Random(11)
yy, xx = np.indices((H, W))
# ---------------------------------------------------------------- Hintergrund: violetter Vorhang
CURT = [(18, 6, 30), (38, 12, 60), (62, 24, 94), (90, 40, 130), (124, 68, 168), (160, 104, 200)]
Hc = np.zeros((H, W), np.float32); Mc = np.zeros((H, W), bool)
Mc[AY0:AY1, AX0:AX1] = True
# senkrechte Falten, unten leicht gerafft
nfold = noise(H, W, 40, seed=5, octaves=1)
Hc = (np.sin(xx * 0.36 + nfold * 2.2 + np.sin(yy * 0.03) * 0.8) * 1.4 + np.sin(xx * 0.13 + 1) * 0.9).astype(np.float32)
Hc += (noise(H, W, 6, seed=3) - 0.5) * 0.6
relief(cv, Hc, np.zeros((H, W), np.int32), [CURT], Mc, k=1.2, bias=-0.1)
# Lichtkegel von oben in die Mitte
glow(cv, 125, 110, 110, (230, 180, 255), k=0.3, mix=0.2, ry=0.8)

# ---------------------------------------------------------------- Marmorboden (Schachbrett in Perspektive)
FY = 262                                                   # Horizontlinie des Bodens
MARB_W = [(150, 144, 160), (190, 186, 200), (222, 220, 230), (246, 244, 250)]
MARB_B = [(14, 10, 20), (28, 22, 36), (46, 40, 56), (70, 62, 84)]
nmb = noise(H, W, 3, seed=8)
for y in range(FY, AY1):
    z = (y - FY + 8)                       # Tiefe (perspektivisch)
    for x in range(AX0, AX1):
        u = (x - 125) / z * 1.4
        v = 44.0 / z
        cell = (int(math.floor(u + 0.5)) + int(math.floor(v))) % 2
        vein = abs(math.sin((x * 0.3 + y * 0.8) + nmb[y, x] * 8)) < 0.12
        val = 0.55 + (nmb[y, x] - 0.5) * 0.6 + (0.2 if vein else 0) - (AY1 - y) * 0.006
        px(cv, x, y, rampc(MARB_W if cell else MARB_B, val, x, y))
# Stufe/Podest
for y in range(FY - 6, FY):
    for x in range(AX0, AX1):
        px(cv, x, y, rampc(STONE, 0.9 - (y - FY + 6) * 0.1, x, y))
for x in range(AX0, AX1):
    px(cv, x, FY - 7, STONE[0]); px(cv, x, FY, STONE[1])

# ---------------------------------------------------------------- Säulen links und rechts
PIL = [(30, 26, 44), (54, 50, 70), (84, 80, 102), (118, 114, 136), (154, 150, 172), (192, 188, 208)]
def pillar(x0, x1, y0=AY0, y1=FY - 6):
    Hp = np.zeros((H, W), np.float32); Mp = np.zeros((H, W), bool)
    cxp = (x0 + x1) / 2; rp = (x1 - x0) / 2
    for y in range(y0, y1):
        for x in range(x0 - 4, x1 + 4):
            if y < y0 + 14 or y > y1 - 10:           # Kapitell / Basis breiter
                w_ = rp + 4
            else:
                w_ = rp
            if abs(x - cxp) <= w_:
                Mp[y, x] = True
                Hp[y, x] = math.sqrt(max(0, 1 - ((x - cxp) / (w_ + 0.5)) ** 2)) * 3
                if y0 + 14 <= y <= y1 - 10:
                    Hp[y, x] += 0.6 * math.cos((x - cxp) * 1.1)          # Kanneluren
                if y in (y0 + 4, y0 + 9, y0 + 13, y1 - 9, y1 - 4):
                    Hp[y, x] -= 1.2
    Hp += (noise(H, W, 2, seed=x0) - 0.5) * 0.4
    Mp &= (xx >= AX0) & (xx < AX1)
    relief(cv, Hp, np.zeros((H, W), np.int32), [PIL], Mp, k=1.5, bias=0.02)
pillar(18, 38); pillar(212, 232)

# ---------------------------------------------------------------- Vorhang-Behang oben mit Goldfransen
Hv = np.zeros((H, W), np.float32); Mv = np.zeros((H, W), bool)
for x in range(AX0, AX1):
    sw = 12 + 8 * abs(math.sin((x - AX0) * math.pi / 54))      # Girlanden-Bögen
    for y in range(AY0, int(AY0 + sw)):
        Mv[y, x] = True
        Hv[y, x] = math.sin((x - AX0) * math.pi / 54 * 2) * 0.8 + (y - AY0) * 0.08
relief(cv, Hv, np.zeros((H, W), np.int32), [CURT], Mv, k=1.4, bias=0.1)
for x in range(AX0, AX1):
    sw = int(12 + 8 * abs(math.sin((x - AX0) * math.pi / 54)))
    px(cv, x, AY0 + sw, GOLD[2]); px(cv, x, AY0 + sw + 1, GOLD[3] if x % 2 else GOLD[1])
    if x % 3 == 0:
        for k in range(2, 5):
            px(cv, x, AY0 + sw + k, GOLD[3] if k < 4 else GOLD[1])
# ---------------------------------------------------------------- Guillotine als Thron-Rückenlehne
GW = [(26, 10, 8), (54, 22, 16), (88, 38, 26), (124, 60, 40), (160, 90, 62)]      # dunkles, geöltes Holz
g = Fig(W, H)
GL, GR, GT = 92, 158, 58                    # Pfosten links/rechts, Oberkante
g.part('postL'); g.rect(GL - 5, GT, GL + 5, FY - 2, 'w')
g.part('postR'); g.rect(GR - 5, GT, GR + 5, FY - 2, 'w')
g.part('beam'); g.rect(GL - 10, GT - 6, GR + 10, GT + 3, 'w')
g.part('cap'); g.poly([(GL - 12, GT - 6), (GR + 12, GT - 6), (GR + 8, GT - 10), (GL - 8, GT - 10)], 'w')
g.part('feetL'); g.rect(GL - 10, FY - 10, GL + 10, FY - 2, 'w')
g.part('feetR'); g.rect(GR - 10, FY - 10, GR + 10, FY - 2, 'w')
# Führungsschienen (Messing) innen an den Pfosten
g.part('railL'); g.rect(GL + 5, GT + 3, GL + 6, FY - 10, 'g')
g.part('railR'); g.rect(GR - 6, GT + 3, GR - 5, FY - 10, 'g')
# das Fallbeil: schräge Schneide, schwerer Block oben
g.part('weight'); g.rect(GL + 7, GT + 4, GR - 7, GT + 10, 'i')
g.part('blade')
g.poly([(GL + 7, GT + 10), (GR - 7, GT + 10), (GR - 7, GT + 16), (GL + 7, GT + 26)], 'b')
g.part('rope', line=False); g.rect(124, GT - 10, 125, GT + 4, 'r')
g.outline()
GMATS = {'w': mat(GW, pillow=2.5, k=1.5, bias=0.02, noise=0.6, nscale=1), 'g': mat(GOLD, pillow=1, k=1.2),
         'i': mat([(14, 14, 20), (30, 30, 40), (54, 54, 68), (84, 84, 100)], pillow=2, k=1.4),
         'b': mat(SILVER, pillow=2, k=2.0, spec=True), 'r': mat([(90, 70, 40), (150, 120, 70), (200, 170, 110)], pillow=1, k=1)}
grgba = g.render(GMATS)
cv.paste(grgba, 0, 0)
# Schneide glänzt, darunter ein Hauch Rot (wie auf ihrer Karte)
for x in range(GL + 8, GR - 7):
    t_ = (x - (GL + 7)) / ((GR - 7) - (GL + 7))
    ye = GT + 26 - t_ * 10
    px(cv, x, ye - 1, (255, 255, 255))
    if x % 5 != 0:
        px(cv, x, ye - 2, (200, 206, 224))
sparkle(cv, GR - 12, GT + 14, (255, 255, 255), r=3, c2=(170, 190, 230))

# ---------------------------------------------------------------- Madame Guillotine
HAIR = [(52, 38, 62), (90, 72, 104), (136, 116, 152), (176, 158, 192), (212, 198, 224), (236, 228, 244)]
DRESS = [(80, 22, 70), (140, 52, 120), (194, 100, 170), (230, 150, 210), (248, 200, 236), (255, 234, 250)]
SKIRT = [(8, 6, 12), (20, 16, 28), (36, 30, 48), (56, 50, 72), (84, 78, 104)]
CUFF = [(50, 84, 130), (96, 146, 200), (156, 200, 236), (214, 236, 252)]
POLE = [(8, 8, 12), (22, 20, 28), (44, 40, 54), (70, 66, 84)]
HX, HY = 125, 120
f = Fig(W, H)
# ---- Klingenfahne (statt des Schwerts), aufrecht in der rechten Hand
PXP = 86
f.part('pole'); f.rect(PXP - 1, 56, PXP + 1, FY + 30, 'p')
f.part('finial'); f.ellipse(PXP, 53, 2.5, 3, 'g')
f.part('flagblade')
f.poly([(PXP - 1, 58), (PXP - 44, 58), (PXP - 1, 112)], 'B')
# ---- Haare hinten (lang, bis über die Schultern)
f.part('hairback')
f.poly([(HX - 22, HY - 8), (HX + 22, HY - 8), (HX + 26, HY + 30), (HX + 22, HY + 44), (HX + 12, HY + 40), (HX - 12, HY + 40),
        (HX - 22, HY + 44), (HX - 26, HY + 30)], 'h')
# ---- Thronsitz: rotes Samtkissen zwischen den Guillotine-Pfosten
f.part('seat'); f.poly([(84, 196), (166, 196), (168, 222), (82, 222)], 'v')
f.part('seattop'); f.ellipse(125, 196, 42, 5, 'v')
# ---- Fußschemel
f.part('stool'); f.rect(96, 278, 154, 288, 'v')
f.part('stooltrim'); f.rect(96, 286, 154, 289, 'g')
# ---- Rock: Schoß (verkürzt), Knie, fällt dann bis auf den Schemel
f.part('skirt')
f.poly([(104, 176), (146, 176), (154, 196), (156, 214), (162, 250), (166, 280), (84, 280), (88, 250), (94, 214), (96, 196)], 'k')
f.part('lap'); f.ellipse(125, 204, 30, 11, 'k')
f.part('apron')
f.poly([(112, 180), (138, 180), (146, 200), (148, 226), (138, 230), (125, 227), (112, 230), (102, 226), (104, 200)], 'w')
f.part('apronhem')
ruff = []
for i in range(13):
    x = 102 + i * 46 / 12
    ruff.append((x, 226 + (3 if i % 2 else 0)))
f.poly([(102, 222), (148, 222)] + ruff[::-1], 'd')
f.part('shoes'); f.ellipse(113, 279, 8, 4, 'k'); f.ellipse(137, 279, 8, 4, 'k')
f.part('socks', line=False); f.rect(107, 271, 119, 275, 'w'); f.rect(131, 271, 143, 275, 'w')
# ---- Oberkörper
f.part('bodice'); f.poly([(106, 140), (144, 140), (141, 180), (109, 180)], 'd')
f.part('jabot')
f.poly([(119, 140), (131, 140), (134, 150), (130, 156), (133, 162), (128, 170), (125, 172), (122, 170), (117, 162), (120, 156), (116, 150)], 'w')
f.part('waist'); f.rect(108, 174, 142, 180, 'k')
f.part('sleeveL'); f.ellipse(103, 148, 9, 9, 'd')
f.part('sleeveR'); f.ellipse(147, 148, 9, 9, 'd')
# ---- rechter Arm (Bildseite links): hält die Stange
# Oberarm hängt am Körper, Ellbogen angewinkelt, Unterarm nach vorn zur Stange
f.part('armR'); f.limb(101, 152, 97, 176, 5.5, 5, 'd')
f.part('foreR'); f.limb(97, 176, 92, 183, 5, 4.5, 'd')
f.part('cuffR'); f.limb(93, 182, 91, 184, 4.8, 4.8, 'c')
f.part('handR'); f.ellipse(PXP + 1, 184, 3.8, 4.3, 's'); f.ellipse(PXP + 3, 180, 1.6, 1.4, 's')
# ---- Kopf
f.part('neck'); f.rect(119, 132, 131, 142, 's')
f.part('collar'); f.poly([(112, 140), (125, 146), (138, 140), (136, 136), (125, 140), (114, 136)], 'w')
f.part('face'); f.ellipse(HX, HY + 1, 18, 16, 's')
f.part('bangs')
f.poly([(HX - 19, HY + 4), (HX - 18, HY - 12), (HX - 8, HY - 17), (HX + 8, HY - 17), (HX + 18, HY - 12), (HX + 19, HY + 4),
        (HX + 15, HY - 2), (HX + 12, HY + 1), (HX + 8, HY - 3), (HX + 4, HY), (HX, HY - 3), (HX - 4, HY), (HX - 8, HY - 3), (HX - 12, HY + 1), (HX - 15, HY - 2)], 'h')
f.part('lockL'); f.poly([(HX - 19, HY - 4), (HX - 22, HY + 16), (HX - 20, HY + 34), (HX - 14, HY + 22), (HX - 14, HY + 4)], 'h')
f.part('lockR'); f.poly([(HX + 19, HY - 4), (HX + 22, HY + 16), (HX + 20, HY + 34), (HX + 14, HY + 22), (HX + 14, HY + 4)], 'h')
f.part('ribbon'); f.curve([(HX - 18, HY - 8), (HX - 8, HY - 13), (HX + 8, HY - 13), (HX + 18, HY - 8)], 'k', w=2.4)
# ---- Krone
f.part('crown')
pts = [(HX - 15, HY - 16)]
for i, (xo, yo) in enumerate([(-15, -26), (-10, -20), (-6, -30), (-2, -22), (0, -34), (2, -22), (6, -30), (10, -20), (15, -26)]):
    pts.append((HX + xo, HY + yo))
pts += [(HX + 15, HY - 16)]
f.poly(pts, 'g')
f.part('crownband'); f.rect(HX - 15, HY - 19, HX + 15, HY - 15, 'g')
# ---- linker Arm (Bildseite rechts): hält die Waage
# Ellbogen angewinkelt, Hand hebt die Waage auf Schulterhöhe
f.part('armL'); f.limb(150, 153, 161, 175, 5.5, 5, 'd')
f.part('foreL'); f.limb(161, 175, 172, 154, 5, 4.5, 'd')
f.part('cuffL'); f.limb(171, 156, 173, 152, 4.8, 4.8, 'c')
f.part('handL'); f.ellipse(175, 147, 3.8, 4.3, 's'); f.ellipse(172, 144, 1.5, 1.5, 's')
f.outline()
MATS = {
    's': mat(SKIN, pillow=2, k=1.0, bias=0.3),
    'h': mat(HAIR, pillow=4, k=1.7, noise=0.8, nscale=2, bias=0.04),
    'v': mat(RED_CLOTH, pillow=4, k=1.4, bias=0.05, noise=0.4, nscale=2),
    'd': mat(DRESS, pillow=4, k=1.5, folds=(0.25, 0.05, 0.4), bias=0.04),
    'w': mat(WHITE_CLOTH, pillow=3, k=1.5, folds=(0.4, 0.2, 0.5), bias=0.0),
    'k': mat(SKIRT, pillow=5, k=1.4, folds=(0.35, 0.02, 0.9), bias=0.1),
    'c': mat(CUFF, pillow=2, k=1.4),
    'g': mat(GOLD7, pillow=2, k=1.8, spec=True, spec_col=(255, 255, 230)),
    'p': mat(POLE, pillow=1, k=1.2),
    'B': mat(SILVER, pillow=3, k=1.8, bias=0.05, spec=True),
}
fig = f.render(MATS)
cv.paste(fig, 0, 0)
# Rockfalten (Glanzlinien) und rosa Rüschensaum
for (x0, x1) in [(100, 94), (112, 110), (138, 140), (150, 156)]:
    for y in range(232, 276):
        t_ = (y - 232) / 44
        x = int(round(x0 + (x1 - x0) * t_))
        if f.L[y, x] == 'k' and (y % 3 != 0):
            px(cv, x, y, SKIRT[3] if y % 2 else SKIRT[4])
for x in range(84, 167):
    for y in range(270, 282):
        if f.P[y, x] == f.parts['skirt'][0] and f.L[y + 1, x] in ('K', '.', 'v'):
            px(cv, x, y - 1, DRESS[3] if x % 3 else DRESS[4]); px(cv, x, y - 2, DRESS[2] if x % 3 != 1 else DRESS[3])
            break
# Glanzkante an der Fahnenstange (sonst verschwindet sie vor dem dunklen Vorhang)
for y in range(56, AY1):
    if f.L[y, PXP - 1] == 'p':
        px(cv, PXP - 1, y, (150, 146, 172) if y % 6 else (200, 196, 220))
    if f.L[y, PXP] == 'p':
        px(cv, PXP, y, (70, 66, 88))
# Blutige Schneide der Fahne (roter Streifen entlang der Diagonale, wie auf ihrer Karte)
for i in range(60):
    t_ = i / 59
    x = (PXP - 43) + t_ * 42; y = 59 + t_ * 53
    px(cv, x + 1, y - 1, (150, 16, 24)); px(cv, x + 2, y - 1, (200, 30, 40)) if i % 3 else None
for i in range(0, 40, 2):                   # Glanzlinie am oberen Rand der Klinge
    px(cv, PXP - 42 + i, 60, (255, 255, 255))
sparkle(cv, PXP - 30, 64, (255, 255, 255), r=3, c2=(170, 190, 230))

# ---- Gesicht: ernst, würdevoll, ein Hauch Schalk
EYE_M = (90, 150, 140)
lidded_eye(cv, HX - 12, HY + 2, EYE_M)          # halb gesenkte Lider (würdevoll)
lidded_eye(cv, HX + 6, HY + 2, EYE_M, flip=True)
for i in range(6):            # Brauen, eine leicht gehoben
    px(cv, HX - 12 + i, HY - 1, HAIR[1])
    px(cv, HX + 6 + i, HY - 1 - (1 if 1 <= i <= 3 else 0), HAIR[1])
px(cv, HX, HY + 8, SKIN[2]); px(cv, HX + 1, HY + 9, SKIN[2])
for x in range(HX - 3, HX + 4):                      # schmales, wissendes Lächeln
    px(cv, x, HY + 12 - (1 if x == HX + 3 else 0), (150, 40, 60))
px(cv, HX + 4, HY + 10, (150, 40, 60))
blush(cv, HX - 13, HY + 8, (250, 130, 160)); blush(cv, HX + 10, HY + 8, (250, 130, 160))
# Edelsteine in der Krone
for (x, y, c) in [(HX, HY - 17, RUBY), (HX - 9, HY - 17, SAPH), (HX + 9, HY - 17, SAPH)]:
    px(cv, x, y, c[2]); px(cv, x - 1, y, c[3]); px(cv, x, y - 1, c[4]); px(cv, x + 1, y, c[1])
for (x, y) in [(HX, HY - 34), (HX - 15, HY - 26), (HX + 15, HY - 26), (HX - 6, HY - 30), (HX + 6, HY - 30)]:
    px(cv, x, y, (255, 255, 240))
# Rüschen auf dem Jabot
for y in (146, 152, 158, 164):
    for x in range(120, 131):
        if fig[y, x, 3] and f.L[y, x] == 'w' and (x + y) % 3 == 0:
            px(cv, x, y, WHITE_CLOTH[1])
# Brosche
for (dx, dy, c) in [(0, 0, RUBY[2]), (-1, 0, RUBY[3]), (0, -1, RUBY[4]), (1, 0, RUBY[1]), (0, 1, RUBY[1])]:
    px(cv, 125 + dx, 144 + dy, c)

# ---------------------------------------------------------------- Korb mit Kohlköpfen neben dem Schemel (schwarzer Humor)
WICK = [(50, 30, 14), (96, 62, 30), (150, 106, 56), (196, 150, 90), (230, 196, 140)]
CAB = [(20, 60, 20), (40, 104, 34), (80, 150, 56), (140, 196, 100), (200, 236, 160)]
kb = Fig(W, H)
kb.part('cab1'); kb.ellipse(185, 253, 10, 9, 'c')
kb.part('cab2'); kb.ellipse(202, 256, 10, 9, 'c')
kb.part('basket'); kb.poly([(172, 264), (214, 264), (209, 292), (177, 292)], 'w')
kb.part('rim'); kb.rect(171, 262, 215, 266, 'w')
kb.outline()
krgba = kb.render({'w': mat(WICK, pillow=2, k=1.4, bias=0.05), 'c': mat(CAB, pillow=4, k=1.5, bias=0.08, noise=0.8, nscale=1)})
# Flechtmuster
for y in range(267, 292):
    for x in range(173, 214):
        if kb.L[y, x] == 'w' and ((x // 3 + y // 2) % 2 == 0) and (x % 3 == 0 or y % 2 == 0):
            krgba[y, x, :3] = WICK[1]
cv.paste(krgba, 0, 0)
for (cx_, cy_) in [(185, 253), (202, 256)]:          # Kohlblätter: gewölbte Blattränder + Mittelrippen
    for (rr, a0, a1) in [(5.5, 200, 300), (8.5, 215, 330), (7.0, 250, 345)]:
        for t_ in np.linspace(math.radians(a0), math.radians(a1), 30):
            x = cx_ + math.cos(t_) * rr; y = cy_ + 5 + math.sin(t_) * rr
            if kb.L[int(round(y)), int(round(x))] == 'c':
                px(cv, x, y, CAB[0]); px(cv, x, y - 1, CAB[4])
    for k in range(0, 8):
        px(cv, cx_ - k * 0.5, cy_ + 3 - k, CAB[4])

# ---------------------------------------------------------------- Waage: Krone gegen Kuchen – exakt im Gleichgewicht
SCX, SCY = 176, 158          # Waage hängt am Ring in ihrer Hand (Ring bei y≈141)
BR = 26
sc = Fig(W, H)
sc.part('post'); sc.rect(SCX - 1, SCY - 14, SCX + 1, SCY + 3, 'g')
sc.part('top'); sc.ellipse(SCX, SCY - 16, 3, 3, 'g'); sc.ellipse(SCX, SCY - 16, 1.2, 1.2, '.')
sc.part('point'); sc.poly([(SCX - 2, SCY + 3), (SCX + 2, SCY + 3), (SCX, SCY + 7)], 'g')
sc.part('beam'); sc.rect(SCX - BR, SCY - 1, SCX + BR, SCY + 1, 'g')
sc.ellipse(SCX - BR, SCY, 2, 2, 'g'); sc.ellipse(SCX + BR, SCY, 2, 2, 'g')
for side in (-1, 1):
    bx = SCX + side * BR
    sc.part('pan%d' % side)
    sc.ellipse(bx, SCY + 30, 11, 3.5, 'g', a0=0, a1=180)
    sc.poly([(bx - 11, SCY + 29), (bx + 11, SCY + 29), (bx + 7, SCY + 34), (bx - 7, SCY + 34)], 'g')
sc.outline()
cv.paste(sc.render({'g': mat(GOLD7, pillow=1.5, k=1.8, spec=True, spec_col=(255, 255, 230))}), 0, 0)
# Ketten
for side in (-1, 1):
    bx = SCX + side * BR
    for (ex, ey) in [(bx - 10, SCY + 29), (bx + 10, SCY + 29), (bx, SCY + 29)]:
        n = int(math.hypot(ex - bx, ey - SCY))
        for i in range(n):
            x = bx + (ex - bx) * i / n; y = SCY + 2 + (ey - SCY - 2) * i / n
            px(cv, x, y, GOLD7[4] if i % 2 else GOLD7[2])
# links: kleine Krone (Adel) ...
cx_ = SCX - BR; cy_ = SCY + 24
crown_rows = ["#.#.#.#", "#######", "#o#o#o#", "#######"]
for j, r in enumerate(crown_rows):
    for i, ch in enumerate(r):
        if ch == '#':
            px(cv, cx_ - 3 + i, cy_ + j, GOLD7[5] if j < 2 else GOLD7[3])
        elif ch == 'o':
            px(cv, cx_ - 3 + i, cy_ + j, RUBY[3])
for i in range(9):
    px(cv, cx_ - 4 + i, cy_ + 4, GOLD7[1])
# ... rechts: ein Stück Kuchen ("Qu'ils mangent de la brioche!")
cx_ = SCX + BR; cy_ = SCY + 22
cake = ["....##", "..####", "#ppppp", "cccccc", "pppppp", "cccccc"]
cols = {'#': (255, 250, 250), 'p': (250, 150, 180), 'c': (240, 214, 160)}
for j, r in enumerate(cake):
    for i, ch in enumerate(r):
        if ch in cols:
            px(cv, cx_ - 3 + i, cy_ + j, cols[ch])
px(cv, cx_ + 1, cy_ - 1, (220, 30, 50)); px(cv, cx_ + 1, cy_ - 2, (60, 120, 40))     # Kirsche
sparkle(cv, SCX + BR, SCY - 4, (255, 255, 240), r=3, c2=(255, 210, 90))

# Hand mit dem Waagen-Ring wieder vor den Ring legen, dann feine Finger
for part_ in ('handL', 'handR'):
    hm = f.P == f.parts[part_][0]
    hm2 = hm | (cv2.dilate(hm.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & (f.L == 'K'))
    for y, x in zip(*np.where(hm2)):
        cv.a[y, x] = fig[y, x, :3]
for (x0, x1, ys) in [(PXP - 2, PXP + 4, (182, 184, 186)), (173, 179, (146, 148, 150))]:
    for y in ys:
        for x in range(x0, x1):
            if f.L[y, x] == 's' and f.L[y, x + 1] == 's' and f.L[y, x - 1] == 's':
                px(cv, x, y, SKIN[1] if x % 2 else SKIN[2])
vignette(cv, strength=0.5, r0=0.6)
finish(cv, 'XI', 'GUILLOTINE', out='11_justice_guillotine', emblem=emblem_generic(
    ["#######", "#....##", "#...##.", "#..##..", "#.##...", "###....", "#......"], {'#': (220, 224, 236)}))
print('ok')
