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
nfold = noise(H, W, 20, seed=5, octaves=1)
Hc = (np.sin(xx * 0.36 + nfold * 5 + np.sin(yy * 0.03) * 1.2) * 1.4 + np.sin(xx * 0.13 + 1) * 0.9).astype(np.float32)
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
PIL = [(40, 36, 54), (70, 66, 86), (104, 100, 120), (144, 140, 160), (186, 184, 200), (226, 224, 236)]
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
# Quasten
for (qx, qy) in [(AX0 + 54, AY0 + 22), (AX0 + 108, AY0 + 22), (AX0 + 162, AY0 + 22)]:
    for k in range(9):
        wq = 1 if k < 3 else 2 + (k - 3) // 3
        for d in range(-wq, wq + 1):
            px(cv, qx + d, qy + k, GOLD[4] if d < 0 else GOLD[2])
    px(cv, qx, qy - 1, GOLD[5])

finish(cv, 'XI', 'GUILLOTINE', out='11_justice_guillotine', emblem=emblem_generic(
    ["#######", "#....##", "#...##.", "#..##..", "#.##...", "###....", "#......"], {'#': (220, 224, 236)}))
print('ok')
