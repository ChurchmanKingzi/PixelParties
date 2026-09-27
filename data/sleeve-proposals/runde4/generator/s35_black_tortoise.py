# -*- coding: utf-8 -*-
"""Sleeve 35 – „Black Tortoise“: Xuanwu, die Schildkröte des Nordens, watet nachts durch einen spiegelglatten
Bergsee. Die Kamera liegt tief über dem Wasser: die Schildkröte füllt die Bildbreite, hinter ihr ragt eine
verschneite Bergkette mit Graten und Schattenseiten in den Sternenhimmel, links steht der Mond. Unter der
Wasserlinie (etwas unter der Bildmitte) spiegeln sich Schildkröte, Berge und Mond – bläulich abgedunkelt und
zeilenweise um ganze Pixel verwellt.

Skalierung / Tiefenstaffelung (zwei Raster, je einmal hochskaliert):
  Hintergrund 2× (125×175): Himmel, Sterne, Mond, Bergkette, Seefläche mit Spiegelung der Berge/des Monds,
                            Wellenlinien.
  Vordergrund 4× (64×88):   Xuanwu, ihr Spiegelbild, Wasserringe an den Beinen, Wellenlinien im Spiegelbild.

Quellen (MotiveRussia.xcf, Karte „Cardinal Beast Xuanwu“, Szene 1 „Sichtbar #42“):
  Xuanwu = Ebene 5 „Xuanwu #1“ (Panzer, Beine, gehörnter Kopf, Schlange am Hals – vollständig; der weiße
           Wischer „Xuanwumon“ (Ebene 2), der Bogen (Ebene 4) und der Schneeschleier (86/133) sind Effekte der
           Karte und entfallen). Leicht editiert: Mondlicht-Oberkante.
  Himmel, Mond, Sterne, Berge, Wasser, Wellen, Spiegelung: selbst gezeichnet (Blau-/Weißtöne aus dem Eismeer der
  Karte, Ebene 221 „Ebene #6“)
"""
from common import *
import numpy as np

RU = 'MotiveRussia'
rng = np.random.RandomState(35)

# ======================= Hintergrund 2× =======================
W2, H2 = 125, 175
HZ = 94                                           # Uferlinie am Fuß der Berge (188 px)
bg = Canvas(W2, H2)
yy, xx = np.mgrid[0:H2, 0:W2]
TH = BAYER4[yy % 4, xx % 4]
cols = [(6, 8, 26), (10, 16, 42), (18, 28, 64), (30, 44, 88)]
t = np.clip((yy - 4) / (HZ - 20), 0, 1) * (len(cols) - 1)
q = np.floor(t + TH * 0.999).clip(0, len(cols) - 1).astype(int)
for k, c in enumerate(cols):
    bg.a[q == k] = c
for gy in range(3, 60, 10):                       # Sterne, gleichmäßig gestreut
    for gx in range(2, W2 - 8, 11):
        if rng.rand() < 0.75:
            bg.px(gx + rng.randint(0, 10), gy + rng.randint(0, 9), (206, 212, 248) if rng.rand() < 0.7 else (140, 154, 214))

# Mond mit Hof
MX, MY, MR = 24, 22, 8.5
dm = np.hypot(xx + .5 - MX, yy + .5 - MY)
halo = (np.clip(1 - (dm - MR) / 16, 0, 1) * 0.55 > TH) & (dm >= MR)
bg.a[halo] = (bg.a[halo] * 0.6 + np.array([80, 92, 150]) * 0.4).astype(np.uint8)
bg.a[dm < MR] = (236, 236, 214)
bg.a[(dm < MR) & ((xx + .5 - MX) + (yy + .5 - MY) * 0.4 > 3.5)] = (208, 210, 196)
for cx_, cy_ in [(21, 19), (26, 24), (22, 25), (27, 18)]:
    bg.px(cx_, cy_, (200, 200, 184))

# Bergkette: Grat (gezackte Silhouette), Kammlinie teilt Licht- (links) und Schattenseite, Schneekappen
def jag(n, amp, seed):
    r = np.random.RandomState(seed); v = np.cumsum(r.randint(-1, 2, n)); v = v - np.linspace(v[0], v[-1], n)
    return np.clip(v, -amp, amp)
def mountain(px, py, wl, wr, cols, cap, seed):
    lit, shade, snow_l, snow_s = cols
    xs = np.arange(W2)
    jg = jag(W2, 2, seed)
    for x in xs:
        d = x + .5 - px
        top = py + (abs(d) * (HZ - py) / (wl if d < 0 else wr)) + (jg[x] if abs(d) > 3 else 0)
        top = int(round(top))
        if top >= HZ: continue
        cj = jag(HZ, 2, seed + 7)
        for y in range(max(top, 0), HZ):
            crest = px + (y - py) * 0.18 + cj[y] * 0.8        # Kammlinie leicht nach rechts geneigt
            left = x + .5 < crest
            snowline = py + cap + jg[(x * 3) % W2] * 1.5 + (2 if (x // 3) % 2 else 0)
            if y < snowline:
                c = snow_l if left else snow_s
            else:
                c = lit if left else shade
                if not left and (y - top) < 1: c = snow_s          # Schnee auf dem Schattengrat
            bg.a[y, x] = c
FAR = ((58, 68, 118), (40, 48, 92), (176, 186, 230), (132, 142, 198))
NEAR = ((40, 48, 90), (24, 30, 62), (150, 160, 214), (104, 114, 172))
mountain(22, 40, 34, 26, FAR, 14, 1)
mountain(100, 34, 30, 34, FAR, 16, 2)
mountain(62, 26, 34, 34, FAR, 18, 3)
mountain(-2, 62, 20, 22, NEAR, 9, 4)
mountain(42, 60, 22, 20, NEAR, 9, 5)
mountain(84, 58, 20, 24, NEAR, 10, 6)
mountain(128, 64, 22, 18, NEAR, 8, 7)
bg.a[HZ - 1] = (22, 28, 58)                       # Uferkante

# Seefläche: Spiegelung von Himmel/Bergen/Mond, bläulich abgedunkelt, zeilenweise verwellt
water = np.array([10, 18, 46], float)
for j in range(H2 - HZ):
    sy = HZ - 1 - j
    shift = (1 if j % 4 == 1 else -1 if j % 6 == 3 else 0) * (1 + (j > 30))
    row = np.roll(bg.a[sy], shift, axis=0).astype(float) if sy >= 0 else np.tile(np.array(cols[0], float), (W2, 1))
    f = 0.62 - 0.2 * min(1, j / 70)
    bg.a[HZ + j] = (row * f * np.array([0.85, 0.92, 1.1]) + water * (1 - f)).clip(0, 255).astype(np.uint8)
for j in range(2, H2 - HZ, 3):                    # Wellenlinien (kurz, nach vorn länger)
    for _ in range(2 + j // 20):
        L = 3 + j // 12 + rng.randint(0, 3)
        x0 = rng.randint(0, W2 - L)
        bg.a[HZ + j, x0:x0 + L] = np.maximum(bg.a[HZ + j, x0:x0 + L], (54, 70, 124))

# ======================= Vordergrund 4× =======================
W4, H4 = 64, 88
WL = 50                                           # Wasserlinie an den Füßen (199 px)
fg = np.zeros((H4, W4, 4), np.uint8)
tor = sprite('g35_xuanwu', RU, [5]).copy()
th_, tw = tor.shape[:2]
tm = tor[..., 3] > 0                              # Mondlicht von links oben: obere Kante aufhellen
edge = tm & ~np.vstack([np.zeros((1, tw), bool), tm[:-1]])
tor[edge, :3] = np.clip(tor[edge, :3].astype(int) * 1.25 + np.array([18, 22, 40]), 0, 255).astype(np.uint8)
TX, TY = 5, WL - th_                              # x 5..57 -> 17..225 px (Gesicht ≤ 222 px)
fg[TY:TY + th_, TX:TX + tw] = tor
# Spiegelbild: Zeilen gespiegelt, bläulich abgedunkelt, um ganze Rasterpunkte verwellt
for j in range(th_):
    src = tor[th_ - 1 - j]
    shift = 1 if j % 4 == 2 else -1 if j % 5 == 4 else 0
    y = WL + j
    if y >= H4: break
    for i in range(tw):
        s = src[i]
        if s[3] == 0: continue
        x = TX + i + shift
        if 0 <= x < W4:
            c = (s[:3] * 0.68 * np.array([0.82, 0.9, 1.08]) + water * 0.32).clip(0, 255)
            fg[y, x] = (*c.astype(np.uint8), 255)
    # helle Wellenstriche quer durch das Spiegelbild
    if j % 6 == 2:
        xs = [x for x in range(W4) if fg[y, x, 3]]
        for x0 in xs[3 + (j % 4)::13]:
            for x in range(x0, min(x0 + 3, W4)):
                if fg[y, x, 3]: fg[y, x, :3] = (86, 104, 158)
# Wasserringe um die Beine
legs = np.where(tor[-1, :, 3] > 0)[0] + TX
for x in legs:
    for dx in (-1, 0, 1):
        if 0 <= x + dx < W4:
            fg[WL, x + dx] = (130, 150, 206, 255)

# ======================= zusammensetzen =======================
out = Canvas(250, 350)
out.a[:] = up(np.dstack([bg.a, np.full((H2, W2), 255, np.uint8)]), 2)[..., :3]
out.paste(up(fg, 4)[:350, 3:253], 0, 0)
print(save(out, '35_black_tortoise.png'))
