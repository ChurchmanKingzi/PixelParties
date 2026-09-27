# -*- coding: utf-8 -*-
"""11 Fire & Storm – Tempeluna, die Konvergenz-Fee (halb Feuer, halb Sturm), steht als einziges Hauptmotiv
auf dem Felsen am Fuß des geteilten Wasserfalls: links stürzt Lava herab und Feuersäulen lodern, rechts fällt
Wasser im Gewitterregen, Blitze zucken. (Keine Wiederholung von Luna/Tempeste – nur die verschmolzene Gestalt.)

Quellen (MotiveHawaii.xcf), nachgebaut nach der Karte „Tempeluna the Convergence Fairy“ (Szene „Sichtbar #26“):
  Ebene 90  „Tempeluna“ – die Fee (Karte „Tempeluna the Convergence Fairy“), 7×
  Ebene 89  „Ebene #99“ – Steinfelsen unter der Fee, 7× (links warm, rechts kalt getönt)
  Ebene 269 „Ebene #4“  – Inselkarte mit Lavafall: Lava-Kachel (16 px Periode), 3×
  Ebene 193 „Ebene #21“ – Inselkarte mit Wasserfall: Wasser-Kachel + braune Klippe, 3×
    Ebene 260 „Ebene #18“ – Feuersäulen/Flammen, 3×;  Ebene 149 „Ebene #46“ + 88 „Ebene #94“ – Blitze, 3×
  Ebene 176 „Ebene #101“ – Regen, 3×
Skalierung: Hintergrund-Ebene (Klippe, Lava-/Wasserfall, Flammen, Blitze, Regen) einheitlich 3×;
  Vordergrund (Felsen + Fee) einheitlich 7×.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
HW = 'MotiveHawaii'
cv = Canvas(W, H)
K = 3                                # Hintergrund-Pixelgröße
NW, NH = W // K + 1, H // K + 1      # natives Hintergrundraster (84×117)

L4 = layer(HW, 269); M21 = layer(HW, 193)
lava = L4[192:208, 145:171]           # 16 Zeilen = eine Periode des Lavafalls
wat = M21[192:208, 176:204]           # Wasserfall
cliff = M21[192:224, 105:137]         # braune Klippe
sprite('b11_hw269_lava', HW, [269], box=(145, 192, 171, 208))
sprite('b11_hw193_water', HW, [193], box=(176, 192, 204, 208))
sprite('b11_hw193_cliff', HW, [193], box=(105, 192, 137, 224))

nat = np.zeros((NH, NW, 3), np.uint8)
TOP = 0                               # Fälle reichen über den oberen Rand
FX0, FX1 = 12, 72                     # Fall-Bereich
SEAM = 42
nat[:] = tile_rgb(cliff, NW, NH, ox=5)
for y in range(TOP, NH):
    for x in range(FX0, FX1):
        if x < SEAM:
            nat[y, x] = lava[(y - TOP) % 16, (x - FX0 + 6) % lava.shape[1]][:3]
        else:
            nat[y, x] = wat[(y - TOP) % 16, (x - SEAM) % wat.shape[1]][:3]
# Schattenkanten an den Fallrändern
nat[:, FX0 - 1] = (30, 18, 10); nat[:, FX1] = (30, 18, 10)

bg = up(np.dstack([nat, np.full(nat.shape[:2], 255, np.uint8)]), K)[:H, :W]
cv.a[:] = bg[..., :3]
sx = SEAM * K

# Stimmung: rechte Hälfte gewittrig dunkel, linke Hälfte glutwarm
a = cv.a.astype(float)
a[:, sx:] *= np.array([0.42, 0.48, 0.66])
a[:, :sx] *= np.array([0.78, 0.58, 0.50])
cv.a[:] = a.clip(0, 255).astype(np.uint8)
# Klippe außen etwas dunkler (Tiefe)
for x in list(range(0, FX0 * K)) + list(range(FX1 * K + K, W)):
    cv.a[:, x] = (cv.a[:, x] * 0.7).astype(np.uint8)

# Naht: helle Gischt-/Glutkante (3 px = 1 Hintergrundpixel)
cv.a[:, sx - 3:sx] = np.where(cv.a[:, sx - 3:sx] > 0, (200, 120, 70), 0)
cv.a[:, sx:sx + 3] = (110, 150, 200)

# Regen rechts (Hintergrund, 3×)
rain = sprite('b11_hw176', HW, [176])
rn = Canvas(W, H); rn.a[:] = cv.a
rain = recolor_map(rain, [tuple(c) for c in np.unique(rain[rain[..., 3] > 0][:, :3], axis=0)],
                   [(70, 110, 170)] * len(np.unique(rain[rain[..., 3] > 0][:, :3], axis=0)))
R3 = up(rain, K)
for ox, oy in ((sx - 120, -60), (sx - 300, 180), (sx + 40, 200)):
    rn.paste(R3, ox, oy)
cv.a[:, sx + 4:] = rn.a[:, sx + 4:]

# Blitze rechts im Himmel/über dem Wasserfall (3×)
b46 = parts(sprite('b11_hw149', HW, [149]), dil=1)
cv.paste(up(b46[0], K), 146, 12)

# Feuersäulen links am Fuß des Lavafalls (3×)
fl = parts(sprite('b11_hw260', HW, [260]), dil=0)
tall = sorted([p for p in fl if p.shape[0] >= 70], key=lambda p: -p.shape[0])
small = [p for p in fl if p.shape[0] < 30]
cv.paste(up(tall[0], K), 6, 140)
cv.paste(up(small[0], K), 64, 200)
cv.paste(up(small[1], K), 30, 90)


vignette_grid(cv, 0.45, 0.6, K)          # Vignette im 3×-Raster des Hintergrunds

# ---------- Vordergrund ----------
F = 7
rock = sprite('b11_hw89', HW, [89])
RK = up(rock, F)
rl = RK.copy()
warm = hsv_shift(rl, 10, 0.55, 0.62); warm = tint(warm, (140, 60, 30), 0.25)
cold = hsv_shift(rl, 0, 0.4, 0.55); cold = tint(cold, (40, 60, 120), 0.35)
half = RK.shape[1] // 2
rl[:, :half] = warm[:, :half]; rl[:, half:] = cold[:, half:]
RY = 282
rx = sx - RK.shape[1] // 2
cv.paste(rl, rx, RY)
# Oberkante als Lichtkante (Lava links, Wasser rechts)
m = rl[..., 3] > 0
for i in range(rl.shape[1]):
    js = np.where(m[:, i])[0]
    if len(js):
        X = rx + i; Y = RY + js[0]
        if 0 <= X < W and 0 <= Y < H:
            cv.a[Y:Y + 2, X] = (255, 170, 80) if X < sx else (130, 190, 240)

tl = sprite('b11_hw90', HW, [90])
T = up(tl, F)
# Füße auf die Felsoberkante unter der Fee setzen
cols = [i for i in range(T.shape[1]) if T[-1, i, 3] > 0]
fx = sx + 2 - T.shape[1] // 2
tops = [RY + np.where(m[:, fx + i - rx])[0][0] for i in cols if m[:, fx + i - rx].any()]
pb(cv, T, sx + 2, min(tops) + F)

print(save(cv, '11_fire_and_storm.png'))
