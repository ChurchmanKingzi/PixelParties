# -*- coding: utf-8 -*-
"""49 First Bloom – Frühling: der schüchterne Tanuki steht (von hinten gesehen) im Vordergrund und reißt beim Anblick
des blühenden Kirschhains auf dem Hügel begeistert die Arme hoch; Blütenblätter treiben über das Bild.

Quellen (MotiveJapan.xcf):
  Ebene 177 „Tanuki-Kopie“ – Tanuki von hinten mit erhobenen Armen (Karte „Tanuki Escape“, Szene „Sichtbar #23“), mit Randlicht + Kontur, 4×
  Ebene 183 „Ebene #17“ – Kirschbaum (unterster, vollständiger Baum einer Baumspalte), dreimal zum Hain gesetzt (Seiten gespiegelt), 3×
  Ebene 245 „Ebene #13“ – rosa Blütenteppich (Textur), 3× auf dem Hügel, 4× im Vordergrund
  Ebene 244 „Ebene #139“ – Grastextur für den Hügel, 3×
Selbst gezeichnet: Himmel, Wolken, ferne Hügel mit Hainen, Hügelform, Gras, fallende Blütenblätter, Schatten.
Skalierung: Himmel + ferne Hügel 2× (125×175); Hügel + Kirschhain + Blütenblätter über dem Bild 3× (84×117);
Vordergrund-Böschung, Tanuki, nahe Blütenblätter 4× (63×88).
"""
import math, random
from j_util_46_50 import *  # noqa

J = 'MotiveJapan'
random.seed(49)

# ---------------- 2×: Himmel, ferne Hügel ----------------
sky = Lay(2)
sky.vgrad([(0, (120, 170, 222)), (0.55, (186, 196, 232)), (1, (246, 208, 222))], y1=112)
# zwei flache Wolken
for (cx, cy, w) in [(30, 26, 22), (92, 44, 18)]:
    for y in range(cy - 3, cy + 3):
        for x in range(cx - w, cx + w):
            d = ((x - cx) / w) ** 2 + ((y - cy) / 3.2) ** 2 + 0.25 * math.sin(x * 0.7) ** 2
            if d < 1: sky.px(x, y, (240, 240, 250) if y < cy else (214, 216, 238))
# ferne Hügel (zwei Staffeln) mit rosa Hainen
for (base, amp, ph, col, grove) in [(96, 7, 0.0, (170, 160, 206), (214, 170, 214)), (104, 5, 1.7, (150, 170, 190), (226, 150, 196))]:
    for x in range(sky.w):
        top = int(base - amp * math.sin(x / 17.0 + ph) - 3 * math.sin(x / 7.0 + ph * 2))
        for y in range(top, sky.h):
            sky.px(x, y, col)
        for y in range(top, top + 3):
            if (x * 3 + y * 5) % 7 < 3 and math.sin(x / 5.0 + ph) > 0.2: sky.px(x, y, grove)

# ---------------- 3×: Hügel + Kirschbaum ----------------
mid = Lay(3)
petal_tex = sprite('j49_petals', J, [245], box=(40, 150, 80, 180))
PT = tile_rgb(petal_tex, mid.w, mid.h)
CREST_X, CREST_Y = 44, 70              # Hügelkuppe (→ 132, 210 px)
GT = tile_rgb(sprite('j49_grass', J, [244], box=(0, 112, 60, 152)), mid.w, mid.h)


def hill_top(x):
    return int(CREST_Y + ((x - CREST_X) / 26.0) ** 2 * 7)


for x in range(mid.w):
    top = hill_top(x)
    for y in range(top, mid.h):
        d = math.hypot((x - CREST_X) / 34.0, (y - CREST_Y - 3) / 9.0)      # Blütenteppich unter den Bäumen
        use_pink = d < 1 or (d < 1.5 and (1.5 - d) / 0.5 > B4[y % 4, x % 4])
        c = (PT[y, x] if use_pink else GT[y, x]).astype(float)
        f = 1.0 - 0.3 * (y - top) / 40
        if y == top: c = np.array((255, 200, 230.0) if use_pink else (140, 190, 90.0)); f = 1.0
        mid.px(x, y, tuple(int(v) for v in (c * f).clip(0, 255)))
col = parts(sprite('j49_trees', J, [183]), dil=0)[0]
tree = col[105:].copy()
# Stammstück des darüberstehenden Baums in den obersten Reihen entfernen
for j in range(3):
    for i in range(tree.shape[1]):
        r, g, b = tree[j, i, :3].astype(int)
        if not (r > 170 and b > 140): tree[j, i, 3] = 0
tree = tree[np.where(tree[..., 3].max(1) > 0)[0].min():]
tw3, th3 = tree.shape[1], tree.shape[0]
# prächtiger Kirschhain: drei vollständige Bäume auf der Kuppe (Seitenbäume gespiegelt, am Hang tiefer)
PET = [(255, 176, 222), (240, 120, 196)]
for (dx, tr) in [(-19, flip(tree)), (19, tree)]:
    x0 = CREST_X + dx - tw3 // 2
    base = hill_top(CREST_X + dx) + 1
    for x in range(x0 + 5, x0 + tw3 - 5): mid.px(x, base, (200, 120, 170))
    mid.paste(darken(tr, 0.9), x0, base - th3)
TX = CREST_X - tw3 // 2
TY = CREST_Y + 1 - th3 - 4                  # Mittelbaum steht auf einer kleinen Kuppe (Wurzeln im Blütenteppich)
for x in range(TX + 4, TX + tw3 - 4):
    for y in range(TY + th3 - 1, CREST_Y + 1):
        if abs(x - CREST_X) < (tw3 // 2 - 4) - (CREST_Y - y) * 2: mid.px(x, y, PT[y, x])
mid.paste(tree, TX, TY)
# Blütenblätter über das ganze Bild, vom Hain nach links unten treibend
for _ in range(70):
    x = random.uniform(-10, mid.w + 10); y = random.uniform(6, 104)
    if CREST_X - 34 < x < CREST_X + 34 and TY - 2 < y < CREST_Y + 2: continue
    mid.px(x, y, PET[random.random() < 0.4])
    if random.random() < 0.5: mid.px(x + 1, y, PET[1])

# ---------------- 4×: Böschung + Tanuki ----------------
fg = Lay(4)
fgt = tile_rgb(quant(sprite('j49_petals', J, [245], box=(40, 150, 80, 180)), [(206, 110, 170), (232, 150, 200), (248, 190, 222)]), fg.w, fg.h)
BANK = 79
for x in range(fg.w):
    top = BANK + int(1.2 * math.sin(x / 6.0)) + (1 if x > 40 else 0)
    for y in range(top, fg.h):
        c = fgt[y, x].astype(float) * (0.9 if y > top else 1.0)
        if y == top: c = np.array((255, 206, 232.0))
        fg.px(x, y, tuple(int(v) for v in c))
tan = [p for p in parts(sprite('j49_tanuki', J, [177]), dil=1) if p.shape[:2] == (28, 30)][0]
tw, th = tan.shape[1], tan.shape[0]
# Randlicht: oberste/äußere Fellpixel (zum hellen Himmel hin) aufgehellt; dunkle Kontur außen
tm = tan[..., 3] >= 128
rim = tan.copy()
for j in range(th):
    for i in range(tw):
        if not tm[j, i]: continue
        up_ = j == 0 or not tm[j - 1, i]
        side = (i == tw - 1 or not tm[j, i + 1]) or (i == 0 or not tm[j, i - 1])
        if up_ or (side and j < th - 6):
            rim[j, i, :3] = (236, 178, 170) if up_ else (196, 136, 128)
TNX, FEET = 6, 81
for x in range(TNX + 5, TNX + tw - 5): fg.px(x, FEET, (170, 90, 140))
for x in range(TNX + 8, TNX + tw - 8): fg.px(x, FEET + 1, (190, 110, 156))
fg.paste(outline_sil(silhouette(tan, (70, 30, 56)), (70, 30, 56)), TNX - 1, FEET - th)
fg.paste(rim, TNX, FEET + 1 - th)
# nahe Blütenblätter
for (x, y) in [(44, 30), (50, 44), (40, 56), (56, 20), (34, 12), (12, 40), (52, 64)]:
    fg.px(x, y, PET[0]); fg.px(x + 1, y, PET[1])

cv = flatten([sky, mid, fg])
print(save(cv, '49_first_bloom.png'))
