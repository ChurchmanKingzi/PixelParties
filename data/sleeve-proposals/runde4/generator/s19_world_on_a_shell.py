# -*- coding: utf-8 -*-
"""19 World on a Shell – Geteilter Blick über und unter die Wasserlinie: die riesige Inselschildkröte
schwimmt durchs Meer und trägt Wald und Städtchen auf ihrem Panzer; unter Wasser rudern ihre Flossen,
zwei Fische ziehen vorbei, am Horizont segelt ein Schiff.

Quellen (MotiveGrailWar.xcf), Anordnung wie auf der Karte „Populated Island Turtle“ (Sichtbar #51):
  Ebene 542 „Populated Island Turtle“ – Schildkröte
  Ebene 538 „Ebene #125“ – Bäume, Städtchen und Baumstumpf auf dem Panzer (liegt im Stapel über der
          Schildkröte, gleiche Koordinaten; das Segelschiff derselben Ebene wird nicht verwendet)
  Ebene 617 „Ebene #300“ – Fische;  Ebene 615 „Ebene #294“ – Luftblasen
Selbst gezeichnet: Himmel, Wolken, Horizont, Wasserfläche, Wellenkamm, Wasserschleier über den
untergetauchten Teilen, Lichtstrahlen unter Wasser, Tiefenverlauf.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Wolken, Horizont, Unterwasser-Verlauf, Lichtstrahlen, Fische, Blasen) – 2×
  Vordergrund (Schildkröte mit Insel, Wasserschleier, Wellenkamm)                                     – 4×
"""
import random
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
rnd = random.Random(19)

isle = compose(B, [538, 542], crop=False)[380:416, 490:545]   # Schildkröte + Insel (ohne Schiff)
b = bbox(isle); isle = isle[b[1]:b[3], b[0]:b[2]]
Image.fromarray(isle).save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sprites4', 'd19_isle.png'))
fish = parts(sprite('d19_fish', B, [617]), dil=1)
bubbles = parts(sprite('d19_bubbles', B, [615]), dil=0, minpx=1)

WL4 = 50                        # Wasserlinie in 4×-Zellen (= 200 px)
WL2 = WL4 * 2                   # … in 2×-Zellen

# ---------------- Hintergrund 2× --------------------------------------------------------------
bw, bh = grid(2)
bg = Canvas(bw, bh)
bands(bg, 0, WL2, [(70, 132, 214), (92, 154, 226), (122, 180, 236), (160, 206, 242), (200, 226, 246)], soft=0.7)
for cx, cy, r in [(22, 22, 6), (30, 20, 5), (37, 23, 4), (92, 44, 5), (100, 42, 6), (108, 45, 4), (64, 70, 4), (70, 69, 3)]:
    for y in range(int(cy - r), int(cy + 2)):
        for x in range(int(cx - r * 1.7), int(cx + r * 1.7) + 1):
            d = ((x + .5 - cx) / (r * 1.7)) ** 2 + ((y + .5 - cy) / r) ** 2
            if d < 1: bg.px(x, y, (244, 248, 250) if y < cy - r * 0.35 else (214, 228, 244))
# Meer bis zum Horizont (schmales Band, wird zur Wasserlinie hin dunkler)
HZ = WL2 - 14
bands(bg, HZ, WL2, [(96, 150, 206), (60, 116, 190), (44, 96, 176)], soft=0.5)
for x in range(bw):
    if (x * 7) % 11 < 2: bg.px(x, HZ + 3 + (x % 3) * 3, (150, 196, 232))
# Unter Wasser: Tiefenverlauf
bands(bg, WL2, bh, [(34, 118, 170), (26, 92, 150), (20, 66, 124), (14, 42, 90), (10, 26, 60)], soft=0.45)
# Lichtstrahlen (schräg, gedithert)
for (x0, wdt) in [(10, 6), (38, 4), (70, 7), (104, 5)]:
    shade(bg, lambda x, y, x0=x0, wdt=wdt: (0.2 * max(0, 1 - (y - WL2) / 60)
                                           if y > WL2 and 0 <= (x - x0 - (y - WL2) * 0.35) < wdt else 0),
          col=(150, 214, 236))
# Fische + Blasen
f0 = fish[0]
bg.paste(f0, 12, WL2 + 50)
bg.paste(fish[1], 84, WL2 + 36)
for (x, y), bb in zip([(98, WL2 + 30), (100, WL2 + 22), (97, WL2 + 14), (20, WL2 + 42), (22, WL2 + 34)],
                      bubbles * 2):
    bg.paste(bb, x, y)

# ---------------- Vordergrund 4× --------------------------------------------------------------
fw, fh = grid(4)
fg = rgba(fw, fh)
tx = (fw - isle.shape[1]) // 2 + 1
ROW_WL = 22                                    # Wasserlinie auf Höhe der Panzermitte (Sprite-Zeile)
ty = WL4 - ROW_WL
put(fg, isle, tx, ty)
# Wasserschleier über allen untergetauchten Pixeln (geordnetes Dithering: 50 % Wasserfarbe)
WAT = np.array([40, 110, 170])
for y in range(WL4, fh):
    for x in range(fw):
        if fg[y, x, 3] == 0: continue
        d = (y - WL4)
        t = 0.45 + min(0.3, d * 0.03)
        q = math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4
        fg[y, x, :3] = (fg[y, x, :3] * (1 - q) + WAT * q).astype(np.uint8)
# Wasserlinie (1 Zelle, über die ganze Breite, auch vor der Schildkröte) + kleine Wellenkämme
for x in range(fw):
    fg[WL4, x] = [236, 246, 250, 255] if (x % 6) in (0, 1) else [130, 196, 236, 255]
    if (x % 6) == 3 and fg[WL4 - 1, x, 3] == 0: fg[WL4 - 1, x] = [130, 196, 236, 255]
# Schaum links und rechts, wo der Panzer die Oberfläche durchstößt
cols = np.where(fg[WL4 - 2, :, 3] > 0)[0]
for c in (cols.min() - 2, cols.min() - 1, cols.max() + 1, cols.max() + 2):
    if 0 <= c < fw and fg[WL4 - 1, c, 3] == 0: fg[WL4 - 1, c] = [236, 246, 250, 255]

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 4, ox=1, oy=0)
print(save(cv, '19_world_on_a_shell.png'))
