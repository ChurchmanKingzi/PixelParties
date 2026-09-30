# -*- coding: utf-8 -*-
"""42 Sunforged Summit – Gegner „Sun Fencer Frenzy“ (Structure Deck), Held: Taio, the Sun Fencer.

Taio steht im Morgengrauen breitbeinig auf dem Gipfel seines Vulkans und reckt The Sun Sword empor – die
Klingenspitze sitzt genau vor der aufgehenden Sonne. Um ihn lodert der Flammenring seiner Base-Karte, im
Gipfelfels glühen die Adern des Mountain's Heart (Cover: „Taio, Absorber of the Mountain's Heart“); weiter unten
am Hang wachen die zwei Wasserspeier-Statuen mit roten Augen aus seiner Karte.

Quellen:
  MotiveHawaii.xcf  Base-Karte „Taio, the Sun Fencer“ = Sichtbar #30 (Ebene 69, Lage 454,130):
                    Ebene 72 „Taio“ (Figur mit erhobenem rechtem Arm), Ebene 71 „Ebene #110“ (The Sun Sword, Spitze
                    oben), Ebene 70 „Ebene #111“ (Faust am Griff), Ebene 73 „Ebene #112“ (Flammenring um Taio).
                    Komposit [70, 71, 72] gegen die Szene geprüft (Abweichungen nur dort, wo in der Szene der
                    halbtransparente Flammenring über der Figur liegt). In der Szene blenden Taios Stiefel nach unten
                    aus (Alpha 253→90, er steht im Lavaschein) – hier voll deckend, damit die Figur vollständig ist.
                    Der Flammenring ist in der Szene halbtransparent und wird hier mit 70 % Deckkraft (je ganzem 4×-Pixel) gemischt.
                    Der obere Flammenbogen (Ebene 76) ist weggelassen, weil die Sonne seinen Platz einnimmt.
                    NICHT Ebene 74 „Taio-Kopie“ (andere Pose, Arme unten).
                    Ebene 81 „Ebene #107“: Wasserspeier-Statuen auf Sockeln mit roten Augen (wie auf der Base-Karte).
Selbst gezeichnet: Morgenhimmel mit zwei Wolkenbänken, Sonne mit Lichthof, ferne Bergketten, Gipfelkegel mit
glühendem Riss (Mountain's Heart), Felsnasen der Statuen.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Sonne, Wolkenbänke, ferne Bergketten,
               Wasserspeier 16×30 → 32×60 auf zwei Felsnasen)                 – 2×-Raster (125×175)
  Vordergrund (Taio mit Schwert 44×48-Ausschnitt → 176×192, Flammenring, Gipfel) – 4×-Raster (63×88)
"""
import math, random
import numpy as np
from kitH import *  # noqa

BH = 'MotiveHawaii'
rnd = random.Random(42)

# ------------------------------------------------------------------ Sprites
def raw(i, box):
    return raw_cached('o42_raw%d' % i, BH, i, box)


BOX = (470, 130, 514, 178)                    # gemeinsamer Ausschnitt (Leinwandkoordinaten)
t_body = opaque(raw(72, BOX))                 # Stiefel voll deckend
t_sword = raw(71, BOX)
t_fist = raw(70, BOX)
t_ring = raw(73, BOX)
taio = np.zeros_like(t_body)
for part in (t_sword, t_body, t_fist):        # Stapel: 72 unten, 71 darüber, 70 (Faust) oben
    m = part[..., 3] >= 128
    taio[m] = part[m]
    taio[m, 3] = 255
garg = parts(sprite('o42_gargoyles', BH, [81]), dil=0)[0]     # 16×30

# ================================================================== Hintergrund 2× (125×175)
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
HOR = 124                                     # Horizont hinter den Bergen (y 248)
SKY = [(22, 20, 50), (36, 30, 74), (62, 40, 94), (104, 54, 100), (156, 74, 92), (210, 110, 80), (244, 160, 92)]
for y in range(h2):
    t = min(y / HOR, 1.0) * (len(SKY) - 1)
    i = min(int(t), len(SKY) - 2)
    f = t - i
    for x in range(w2):
        bg[y, x, :3] = SKY[i + 1] if f > BAY[y % 4, x % 4] else SKY[i]

# Lage der Figur (4×-Raster) → Sonne sitzt hinter der Klingenspitze
K4 = 4
w4, h4 = grid(K4)
FEET = 73                                     # Standzeile der Stiefel im 4×-Raster (y 292–296)
ys, xs = np.where(t_sword[..., 3] > 0)
tip_y, tip_x = ys.min(), xs[ys == ys.min()].mean()
feet_row = np.where(t_body[..., 3].any(1))[0].max()
body_cx = np.where(t_body[..., 3].any(0))[0].mean()
TX = int(round(w4 / 2 - 0.5 - body_cx))      # Körpermitte auf die Bildmitte
TY = FEET - feet_row
SUNX = (TX + tip_x + 0.5) * K4 / 2
SUNY = (TY + tip_y + 2.5) * K4 / 2
R_SUN = 15
glow(bg, SUNX, SUNY, 46, (255, 180, 110), 0.42, power=1.3, steps=3)
glow(bg, SUNX, SUNY, 24, (255, 222, 150), 0.55, power=1.1, steps=3)
for y in range(h2):
    for x in range(w2):
        d = math.hypot(x + .5 - SUNX, y + .5 - SUNY)
        if d < R_SUN:
            bg[y, x, :3] = (255, 240, 180) if d < R_SUN - 1.5 else (255, 214, 136)


def cloud(cx, cy, ln, thick):
    """Langgezogenes Wolkenband: dunkle Oberseite, von unten angestrahlte Unterkante, runde Enden."""
    for x in range(int(cx - ln / 2), int(cx + ln / 2)):
        e = 1 - abs(x + .5 - cx) / (ln / 2)
        hh = int(round(thick * min(1, e * 3)))
        for j in range(hh):
            col = (236, 146, 108) if j == 0 else ((176, 96, 104) if j == 1 else (120, 66, 100))
            setp(bg, x, cy - j, col)


cloud(22, 96, 40, 4)                          # zwei Wolkenbänke tief über den Bergen
cloud(108, 104, 34, 3)


def ridge(y0, amp, freq, ph, col, top_col):
    tops = []
    for x in range(w2):
        top = int(y0 - amp * (0.6 * math.sin(x * freq + ph) + 0.4 * math.sin(x * freq * 2.7 + ph * 1.9)))
        tops.append(top)
        for y in range(max(top, 0), h2):
            bg[y, x, :3] = top_col if y == top else col
    return tops


ridge(HOR - 8, 8, 0.07, 0.5, (98, 56, 96), (150, 84, 104))   # ferne Kette, im Dunst
near = ridge(HOR + 8, 12, 0.05, 2.1, (54, 32, 62), (96, 54, 84))  # nähere Kette

# Wasserspeier-Statuen (2×, wie der ferne Hang): auf zwei Felsnasen links und rechts, zur Mitte gewandt
ROCK2 = [(40, 24, 48), (58, 36, 62), (82, 52, 80)]
for gx, flipit in ((10, False), (99, True)):
    top = HOR + 6
    for y in range(top, h2):
        spread = (y - top) * 0.7
        for x in range(int(gx - 2 - spread), int(gx + 18 + spread)):
            if 0 <= x < w2:
                c = ROCK2[2] if y == top else ROCK2[0 if (x < gx + 8) ^ flipit else 1]
                bg[y, x, :3] = c
    g = flip(garg) if flipit else garg
    put(bg, g, gx, top - g.shape[0] + 1)

# ================================================================== Vordergrund 4× (63×88)
fg = rgba(w4, h4)
BAS = [(18, 12, 22), (30, 20, 32), (44, 30, 44), (70, 46, 60)]
GLOW = [(130, 30, 20), (220, 90, 30), (255, 190, 80)]
CX = w4 / 2


def peak_top(x):
    """Gipfel: flache Kuppe unter Taio, zu beiden Seiten abfallend (Kegel des Vulkans)."""
    d = abs(x + .5 - CX)
    return FEET + 1 + (0 if d < 8 else (d - 8) * 0.45 + ((d - 8) ** 2) * 0.012)


for x in range(w4):
    top = peak_top(x)
    for y in range(int(math.ceil(top)), h4):
        d = y - top
        right = x + .5 > CX                   # Gegenlicht: rechte Flanke minimal heller
        if d < 1:
            c = BAS[3] if (x * 7) % 5 else BAS[2]
        elif d < 2:
            c = BAS[2]
        else:
            c = BAS[1] if right else BAS[0]
        fg[y, x, :3] = c
        fg[y, x, 3] = 255
# Mountain's Heart: ein glühender Riss öffnet sich unter Taios Füßen und läuft den Kegel hinab
path = [(31, FEET + 2), (30, FEET + 4), (31, FEET + 6), (29, FEET + 8), (30, FEET + 10), (28, FEET + 12),
        (29, FEET + 14)]
for (x, y) in path:
    for yy in range(y, y + 2):
        if yy < h4 and fg[yy, x, 3]:
            fg[yy, x, :3] = GLOW[2] if yy < FEET + 8 else GLOW[1]
            for xx in (x - 1, x + 1):
                if fg[yy, xx, 3] and tuple(fg[yy, xx, :3]) not in [tuple(c) for c in GLOW]:
                    fg[yy, xx, :3] = GLOW[0]
ring_layer = rgba(w4, h4)
put(ring_layer, t_ring, TX, TY)
put(fg, taio, TX, TY)

cv = Canvas(W, H)
blit(cv, bg, 2)
# Flammenring: in der Szene halbtransparent – hier 70 % Deckkraft, Mischung je ganzem 4×-Pixel
ringU = up(ring_layer, K4)[:H, :W]
m = ringU[..., 3] > 0
cv.a[m] = (cv.a[m] * 0.3 + ringU[m, :3] * 0.7).astype(np.uint8)
blit(cv, fg, K4)
print(save(cv, '42_sunforged_summit.png'))
