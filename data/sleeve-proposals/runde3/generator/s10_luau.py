# -*- coding: utf-8 -*-
"""10 Luau – Strandfest bei Sonnenuntergang: Luna Pele tanzt im Feuer vor dem steinernen Kiai-Idol, links
tanzt Moana Hula, rechts spielt die Gitarristin; hinten raucht der Vulkan über dem Meer.

Quellen (MotiveHawaii.xcf):
  Ebene 262 „Luna Tepe“  – Luna Pele (Flammentänzerin) und Feuersäulen (Karte „Luna Pele the Flame Dancer“), 4×/3×
  Ebene 254 „Ebene #1“   – Steinidol (Karte „Luna Kiai“), 4×
  Ebene 189 „Tempeste Moana“ – Hula-Tänzerin (Karte „Prophecy of Tempeste“), 4×
  Ebene 159 „Ebene #36“  – Gitarristin, 4× (gespiegelt)
  Ebene 170 „Ebene #103“ – Noten
  Ebene 193 „Ebene #21“  – Inselkarte: Sandkachel 16×16 (2×, abendlich getönt)
  MotiveDeepsea.xcf Ebene 385 „Ebene #195“ – Felshang (gespiegelt zum Vulkankegel, Silhouette)
  Himmel/Sonne: selbst gedithert in Feuer-/Sandfarben der Hawaii-Karten.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
HW = 'MotiveHawaii'
cv = Canvas(W, H)
HOR = 176

# ---------- Himmel ----------
SKY = [(0, (38, 18, 58)), (0.35, (96, 34, 78)), (0.65, (190, 70, 60)), (0.88, (236, 136, 54)), (1, (250, 196, 92))]
vgrad(cv, SKY, 0, 0, W, HOR)
# Sonne (halb im Meer, mit Streifen)
SX, SY, SR = 160, HOR + 4, 38
for y in range(SY - SR, HOR):
    for x in range(SX - SR, SX + SR):
        if math.hypot(x + .5 - SX, y + .5 - SY) < SR:
            k = SY - y
            if k < 20 and (k % 6) < (3 if k < 10 else 2):
                continue
            cv.a[y, x] = (252, 228, 120) if y < SY - 26 else (250, 190, 80)

# Vulkan (Silhouette aus dem Deepsea-Felshang, gespiegelt)
slope = compose('MotiveDeepsea', [385])            # 109×103, steigt nach rechts
half = np.transpose(slope, (1, 0, 2))[::-1, ::-1].copy()   # Hang quer gelegt …
half[..., 3] = 255 - half[..., 3]                          # … und Fläche unter der Kurve: konkave Flanke
cone = np.concatenate([half, flip(half)], 1)
cone = cone[14:]                                    # Kraterplateau
cone = silhouette(cone, (40, 16, 44))
vx = 8
cv.paste(cone, vx - 40, HOR - cone.shape[0] + 1)
# Lavaglühen im Krater + Feuer
flames = parts(compose(HW, [262]), dil=0)
tall = [p for p in flames if p.shape[0] >= 60]
mid = [p for p in flames if p.shape == (35, 14, 4)]
cx_crater = vx - 40 + cone.shape[1] // 2
for dx, p in ((-12, mid[0]), (0, tall[0]), (10, mid[1])):
    pb(cv, p, cx_crater + dx, HOR - cone.shape[0] + 8)

# ---------- Meer ----------
vgrad(cv, [(0, (120, 60, 90)), (0.4, (60, 34, 80)), (1, (30, 20, 60))], 0, HOR, W, 214)
for j, y in enumerate(range(HOR + 1, 214, 3)):
    hw = int(28 - j * 1.4) + (j % 2) * 5
    for x in range(SX - hw, SX + hw):
        if 0 <= x < W and ((x // 3 + j) % 4):
            cv.a[y, x] = (250, 190, 80) if j < 5 else (236, 136, 54)
for x in range(W):
    if (x // 5) % 3 == 0: cv.a[HOR + 2 + (x // 17) % 3 * 7, x] = (190, 110, 120)

# ---------- Strand ----------
SAND0 = 206
sand = layer(HW, 193)[384:400, 532:548]
st = tile_rgb(sand, W // 2 + 1, (H - SAND0) // 2 + 1)
st = np.repeat(np.repeat(st, 2, 0), 2, 1)[:H - SAND0, :W]
st = (st.astype(float) * np.array([0.92, 0.72, 0.62])).clip(0, 255).astype(np.uint8)   # Abendlicht
cv.a[SAND0:] = st
# Brandungslinie
for x in range(W):
    y = SAND0 + int(2 * math.sin(x / 9.0))
    cv.a[y - 1:y + 1, x] = (240, 220, 190) if (x // 4) % 3 else (200, 150, 140)
# Schatten zum Vordergrund hin
for y in range(SAND0 + 60, H):
    t = (y - SAND0 - 60) / (H - SAND0 - 60) * 0.5
    for x in range(W):
        if t > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (cv.a[y, x] * 0.72).astype(np.uint8)

# ---------- Idol + Feuersäulen ----------
idol = compose(HW, [254])
I4 = up(idol, 4)
IB = 244
# Feuerschein auf dem Sand
radial(cv, 125, 262, 92, (230, 150, 70), 0.55, power=1.3)
pb(cv, I4, 125, IB)
pb(cv, up(tall[1], 2), 44, 250)
pb(cv, up(flip(tall[0]), 2), 206, 250)

# Trompeterin hinten rechts neben dem Idol
notes = parts(compose(HW, [170]), dil=1)

# ---------- Vordergrund ----------
pele = [p for p in flames if p.shape[:2] == (32, 22)][0]
P4 = up(pele, 4)
pb(cv, P4, 125, 340)
moana = compose(HW, [189])
pb(cv, up(moana, 4), 40, 346)
gtr = compose(HW, [159])
pb(cv, up(flip(gtr), 4), 212, 346)

for p, (x, y) in zip(notes, [(88, 196), (176, 190), (192, 150), (60, 150)]):
    cv.paste(up(p, 2), x, y)

vignette(cv, 0.45, 0.62)
print(save(cv, '10_luau.png'))
