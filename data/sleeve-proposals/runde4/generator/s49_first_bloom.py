# -*- coding: utf-8 -*-
"""49 First Bloom – Frühling: der schüchterne Tanuki steht (von hinten gesehen) im Vordergrund und reißt beim Anblick
des ersten blühenden Kirschbaums auf dem Hügel begeistert die Arme hoch; Blütenblätter treiben im Wind.

Quellen (MotiveJapan.xcf):
  Ebene 177 „Tanuki-Kopie“ – Tanuki von hinten mit erhobenen Armen (Karte „Tanuki Escape“, Szene „Sichtbar #23“), 5×
  Ebene 183 „Ebene #17“ – Kirschbaum (unterster, vollständiger Baum einer Baumspalte), 3×
  Ebene 245 „Ebene #13“ – rosa Blütenteppich (Textur), 3× auf dem Hügel, 5× im Vordergrund
  Ebene 244 „Ebene #139“ – Grastextur für den Hügel, 3×
Selbst gezeichnet: Himmel, Wolken, ferne Hügel mit Hainen, Hügelform, Gras, fallende Blütenblätter, Schatten.
Skalierung: Himmel + ferne Hügel 2× (125×175); Hügel + Kirschbaum + Blütenblätter am Baum 3× (84×117);
Vordergrund-Böschung, Tanuki, nahe Blütenblätter 5× (50×70).
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
CREST_X, CREST_Y = 58, 62
GT = tile_rgb(sprite('j49_grass', J, [244], box=(0, 112, 60, 152)), mid.w, mid.h)
for x in range(mid.w):
    top = int(CREST_Y + ((x - CREST_X) / 24.0) ** 2 * 6)
    for y in range(top, mid.h):
        d = math.hypot((x - CREST_X) / 20.0, (y - CREST_Y - 2) / 7.0)      # Blütenteppich unter dem Baum
        use_pink = d < 1 or (d < 1.6 and (1.6 - d) / 0.6 > B4[y % 4, x % 4])
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
TX = CREST_X - tree.shape[1] // 2
TY = CREST_Y + 1 - tree.shape[0]
# Schatten unter dem Baum
for x in range(TX + 4, TX + tree.shape[1] - 4):
    mid.px(x, CREST_Y + 1, (200, 120, 170))
mid.paste(tree, TX, TY)
# vom Baum wehende Blütenblätter (nach links unten)
PET = [(255, 176, 222), (240, 120, 196)]
for _ in range(34):
    t = random.random()
    x = TX + 6 - t * 50 + random.uniform(-5, 5)
    y = TY + 6 + t * 30 + random.uniform(-7, 7) - 10 * math.sin(t * math.pi)
    mid.px(x, y, PET[random.random() < 0.4])
    if random.random() < 0.5: mid.px(x + 1, y, PET[1])

# ---------------- 5×: Böschung + Tanuki ----------------
fg = Lay(5)
fgt = tile_rgb(quant(sprite('j49_petals', J, [245], box=(40, 150, 80, 180)), [(206, 110, 170), (232, 150, 200), (248, 190, 222)]), fg.w, fg.h)
BANK = 61
for x in range(fg.w):
    top = BANK + int(1.2 * math.sin(x / 6.0)) + (1 if x > 34 else 0)
    for y in range(top, fg.h):
        c = fgt[y, x].astype(float) * (0.9 if y > top else 1.0)
        if y == top: c = np.array((255, 206, 232.0))
        fg.px(x, y, tuple(int(v) for v in c))
tan = [p for p in parts(sprite('j49_tanuki', J, [177]), dil=1) if p.shape[:2] == (28, 30)][0]
tw, th = tan.shape[1], tan.shape[0]
TNX, FEET = 4, 64
for x in range(TNX + 5, TNX + tw - 5): fg.px(x, FEET, (170, 90, 140))
for x in range(TNX + 7, TNX + tw - 7): fg.px(x, FEET + 1, (190, 110, 156))
fg.paste(tan, TNX, FEET + 1 - th)
# ein paar nahe Blütenblätter
for (x, y) in [(40, 12), (44, 20), (37, 28), (29, 8), (46, 34)]:
    fg.px(x, y, PET[0]); fg.px(x + 1, y, PET[1])

cv = flatten([sky, mid, fg])
print(save(cv, '49_first_bloom.png'))
