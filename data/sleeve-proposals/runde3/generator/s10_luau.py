# -*- coding: utf-8 -*-
"""10 Luau – Feuertanz am Strand bei Sonnenuntergang: Luna Pele, die Flammentänzerin, tanzt zwischen zwei
steinernen Kiai-Idolen und Tiki-Fackeln; hinter dem Meer raucht der Vulkan, Lava rinnt die Flanken hinab.

Quellen (MotiveHawaii.xcf):
  Ebene 262 „Luna Tepe“ – Luna Pele (Flammentänzerin, Karte „Luna Pele the Flame Dancer“), 4×
  Ebene 81  „Ebene #107“ – Kiai-Steinidole auf Sockel (rote Augen; Kartenszene „Luna Pele“/„Luna Kiai“), 4×
  Ebene 208 „Ebene #7“  – Tiki-Fackeln, 4×
  Ebene 193 „Ebene #21“ – Inselkarte: Sandkachel 16×16 (Strand, 4×) und Klippen-Kachel (Vulkanflanke, 2×)
  Ebene 269 „Ebene #4“  – Inselkarte mit Lavafall: Lavafarben für die Lavarinnen (2×)
  Vulkan, Rauchsäule, Lavaglut, Sonne und Meer: selbst gezeichnet (harte Kanten, begrenzte Palette) im
  2×-Raster; Palette aus den Hawaii-Karten (Sand, Lava, Feuer).
Skalierung: Hintergrund (Himmel, Vulkan, Rauch, Sonne, Meer) einheitlich 2×; Strand, Idole, Fackeln und
  Luna Pele einheitlich 4×.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
HW = 'MotiveHawaii'
cv = Canvas(W, H)
rng = np.random.RandomState(3)

# =============== Hintergrund im 2×-Raster ===============
NW, NH = 125, 100                      # deckt y 0..200 ab
HOR = 78                               # Horizont (native) -> 156 px
bgc = Canvas(NW, NH)
SKY = [(0, (38, 18, 58)), (0.35, (96, 34, 78)), (0.66, (190, 70, 60)), (0.88, (236, 136, 54)), (1, (250, 196, 92))]
vgrad(bgc, SKY, 0, 0, NW, HOR)

# Sonne rechts, halb im Meer, mit Streifen
SX, SY, SR = 94, HOR + 2, 17
for y in range(SY - SR, HOR):
    for x in range(SX - SR, SX + SR + 1):
        if math.hypot(x + .5 - SX, y + .5 - SY) < SR:
            k = SY - y
            if k < 10 and (k % 3) == 0:
                continue
            bgc.a[y, x] = (252, 228, 120) if y < SY - 12 else (250, 190, 80)

# ---- Vulkan ----
cliff = layer(HW, 193)[192:208, 80:96]
sprite('b10_hw193_cliff', HW, [193], box=(80, 192, 96, 208))
VX, VT = 42, 26                        # Kraterlage (Mitte, Oberkante)
def half_w(y):
    t = (y - VT) / (HOR - VT)
    return 7 + 52 * t ** 1.6
VOL = np.zeros((NH, NW), bool)
for y in range(VT, HOR):
    hw = half_w(y)
    for x in range(NW):
        if abs(x + .5 - VX) < hw: VOL[y, x] = True
tex = tile_rgb(cliff, NW, NH)
for y in range(VT, HOR):
    for x in range(NW):
        if not VOL[y, x]: continue
        c = tex[y, x].astype(float) * np.array([0.42, 0.30, 0.42])     # Abend-Dunst
        if x > VX + 2:                                                   # rechte Flanke im Sonnenlicht
            c = c * np.array([1.35, 1.1, 1.0])
        bgc.a[y, x] = c.clip(0, 255).astype(np.uint8)
# Kontur/Rimlight
for y in range(VT, HOR):
    hw = half_w(y)
    xl, xr = int(math.floor(VX - hw + .5)), int(math.ceil(VX + hw - .5)) - 1
    if 0 <= xr < NW: bgc.a[y, xr] = (150, 70, 60)
    if 0 <= xl < NW: bgc.a[y, xl] = (40, 16, 36)
# Krater
LAVA = [(120, 24, 16), (214, 60, 20), (247, 138, 58), (255, 212, 90), (255, 246, 190)]
for x in range(VX - 6, VX + 7):
    bgc.a[VT, x] = LAVA[3] if abs(x - VX) < 4 else LAVA[2]
    bgc.a[VT + 1, x] = LAVA[2] if abs(x - VX) < 5 else LAVA[1]
# Lavarinnen die Flanken hinab (Zufallspfad, 1 Pixel breit)
for sx0, drift in ((VX - 3, -0.55), (VX + 2, 0.45), (VX, -0.1)):
    x = float(sx0)
    for y in range(VT + 2, HOR):
        x += drift * (0.6 + 0.8 * rng.rand()) + rng.choice([-0.4, 0, 0.4])
        if not VOL[y, int(x)]: break
        t = (y - VT) / (HOR - VT)
        bgc.a[y, int(x)] = LAVA[3] if t < 0.3 else (LAVA[2] if t < 0.65 else LAVA[1])
        if drift * (x - VX) > 0 and y % 3 == 0 and VOL[y, int(x) + 1]:
            bgc.a[y, int(x) + 1] = LAVA[0]
# Rauchsäule (Puffs, driftet nach rechts oben)
SM = [(46, 26, 50), (78, 50, 76), (118, 80, 98), (170, 110, 100)]
puffs = [(VX + 1, VT - 3, 5), (VX - 2, VT - 8, 6), (VX + 4, VT - 12, 7), (VX - 1, VT - 17, 7), (VX + 8, VT - 19, 8),
         (VX + 16, VT - 21, 8), (VX + 25, VT - 23, 8), (VX + 34, VT - 24, 7), (VX + 43, VT - 23, 6),
         (VX + 51, VT - 21, 5), (VX + 58, VT - 18, 4), (VX + 6, VT - 25, 5), (VX + 20, VT - 26, 5)]
for (px, py, r) in puffs:
    for y in range(int(py - r), int(py + r) + 1):
        for x in range(int(px - r), int(px + r) + 1):
            if not (0 <= x < NW and 0 <= y < NH): continue
            d = math.hypot(x + .5 - px, y + .5 - py)
            if d < r:
                ny = (y + .5 - py) / r; nx = (x + .5 - px) / r
                if ny > 0.55 and py > VT - 16: col = SM[3]            # unten von der Lava angestrahlt
                elif nx + ny < -0.7: col = SM[2]                       # Lichtkante oben links
                elif d > r - 1.2: col = SM[0]
                else: col = SM[1]
                bgc.a[y, x] = col
# Lavaspritzer
for (dx, dy) in ((-4, -3), (5, -4), (-7, -1), (8, -1), (2, -6), (-1, -7)):
    bgc.a[VT + dy, VX + dx] = LAVA[3] if dy < -3 else LAVA[2]

# ---- Meer ----
vgrad(bgc, [(0, (120, 60, 90)), (0.5, (70, 36, 84)), (1, (40, 22, 64))], 0, HOR, NW, NH)
for j, y in enumerate(range(HOR + 1, NH, 2)):
    hw = int(12 - j * 0.6) + (j % 2) * 2
    for x in range(SX - hw, SX + hw):
        if 0 <= x < NW and ((x // 2 + j) % 3):
            bgc.a[y, x] = (250, 190, 80) if j < 4 else (236, 136, 54)
for y in range(HOR + 2, NH, 3):
    for x in range(NW):
        if ((x + y * 5) // 4) % 5 == 0 and not (abs(x - SX) < 14):
            bgc.a[y, x] = (150, 80, 110)
# Lavaschein auf dem Wasser unter dem Vulkan
for j, y in enumerate(range(HOR + 1, HOR + 10, 2)):
    for x in range(VX - 8 + j, VX + 8 - j):
        if (x + j) % 3 == 0: bgc.a[y, x] = LAVA[1]
bgc.a[HOR] = (200, 120, 110)

cv.a[:NH * 2] = up(np.dstack([bgc.a, np.full((NH, NW), 255, np.uint8)]), 2)[..., :3]

# =============== Strand im 4×-Raster ===============
F = 4
SAND0 = 176
sand = sprite('b10_hw193_sand', HW, [193], box=(532, 384, 548, 400))
st = tile_rgb(sand, W // F + 1, (H - SAND0) // F + 1)
st = up(np.dstack([st, np.full(st.shape[:2], 255, np.uint8)]), F)[:H - SAND0, :W, :3]
st = (st.astype(float) * np.array([0.95, 0.72, 0.62])).clip(0, 255).astype(np.uint8)   # Abendlicht
cv.a[SAND0:] = st
# Brandungssaum: unregelmäßige Schaumkante im 4×-Raster
foam = [0, 1, 1, 0, 0, 1, 2, 1, 0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 0, 0, 1, 1, 0, 0]
for i, x in enumerate(range(0, W, F)):
    d = foam[i % len(foam)]
    cv.a[SAND0:SAND0 + F * d, x:x + F] = (236, 200, 170)
    cv.a[SAND0 + F * d:SAND0 + F * d + F, x:x + F] = (150, 104, 90)     # nasser Sand
# Feuerschein auf dem Sand: zwei hart abgesetzte Lichtstufen (Ellipsen im 4×-Raster)
for (ry, rx, f, add) in ((13, 30, 1.08, 10), (8, 19, 1.1, 14)):
    for y in range(SAND0, H, F):
        for x in range(0, W, F):
            if ((x + 2 - 125) / (rx * F)) ** 2 + ((y + 2 - 312) / (ry * F)) ** 2 < 1:
                c = cv.a[y:y + F, x:x + F].astype(float) * f + np.array([add, add * 0.5, 0])
                cv.a[y:y + F, x:x + F] = c.clip(0, 255).astype(np.uint8)

# Idole + Fackeln
idols = parts(sprite('b10_hw81', HW, [81]), dil=0)
idol = idols[0]
I4 = up(idol, F)
IB = 262
def shadow(cx, by, w):
    for y in range(by - 4, by + 4):
        for x in range(cx - w, cx + w):
            if 0 <= x < W and ((x - cx) / w) ** 2 + ((y - by) / 4) ** 2 < 1 and 0.6 > BAYER4[(y // 2) % 4, (x // 2) % 4]:
                cv.a[y, x] = (cv.a[y, x] * 0.55).astype(np.uint8)
for cx in (34, W - 34):
    shadow(cx, IB, 34)
    pb(cv, I4 if cx < 125 else flip(I4), cx, IB)
torches = parts(sprite('b10_hw208', HW, [208]), dil=0)
T4 = up(torches[0], F)
for cx in (70, W - 70):
    shadow(cx, 274, 14)
    pb(cv, T4, cx, 274)

# Luna Pele
flames = parts(sprite('b10_hw262', HW, [262]), dil=0)
pele = [p for p in flames if p.shape[:2] == (32, 22)][0]
P4 = up(pele, F)
shadow(125, 336, 40)
pb(cv, P4, 125, 338)

vignette_grid(cv, 0.4, 0.62, 2, box=(0, 0, W, SAND0))
vignette_grid(cv, 0.4, 0.62, F, box=(0, SAND0, W, H))
print(save(cv, '10_luau.png'))
