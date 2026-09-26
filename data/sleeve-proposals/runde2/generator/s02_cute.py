# -*- coding: utf-8 -*-
"""Sleeve: Army of the Cute – Pink-Sky-Himmel, Mosaik-Herz aus „Cute Angel Molinda“,
Mini („Cute Annoyance Mini“), geflügelte Katzen („Army of the Cute“), Fledermaus-Hasen („Cute Bunny“)."""
import numpy as np
from kit import *

cv = Canvas(W, H)
# --- Himmel: Kartenbild „Pink Sky“ (weiche Wolken), 1:2 verkleinert, gespiegelt gestapelt
sky = Image.fromarray(raw('Pink Sky')[170:566, 72:678])
sky = np.array(sky.resize((303, 198), Image.BOX))
col = np.concatenate([sky, sky[::-1, ::-1], sky], 0)
cv.a[:] = col[20:20 + H, 26:26 + W]

# --- Mosaik-Herz (Blockform + Blockfarben aus Molinda)
mo = nat('Cute Angel Molinda').astype(int)
shape = {0: (5, 7, 11, 13), 1: (4, 8, 10, 14), 2: (3, 15), 3: (3, 15), 4: (3, 15), 5: (3, 15), 6: (3, 15),
         7: (4, 14), 8: (5, 13), 9: (6, 12), 10: (8, 10)}
def blk(i, j):
    y = 3 + 4 * j + 1; x = 4 * i + 1
    r, g, b = mo[y:y + 2, x:x + 2].reshape(-1, 3).mean(0)
    return (r > 180 and b < 215 and r - b > 15), (int(r), int(g), int(b))
visible = [blk(i, j)[1] for j in range(11) for i in range(19) if blk(i, j)[0]]
rng = np.random.default_rng(7)
B = 14
HX0, HY0 = 125 - 9 * B - B // 2, 78
for j, sp in shape.items():  # Schlagschatten
    for k2 in range(0, len(sp), 2):
        cv.rect(HX0 + sp[k2] * B + 5, HY0 + j * B + 5, HX0 + (sp[k2 + 1] + 1) * B + 5, HY0 + (j + 1) * B + 5, (200, 50, 160))
for j, sp in shape.items():
    runs = [(sp[k], sp[k + 1]) for k in range(0, len(sp), 2)]
    for (c0, c1) in runs:
        for i in range(c0, c1 + 1):
            ok, c = blk(i, j)
            if not ok:
                ok2, c2 = blk(18 - i, j)
                c = c2 if ok2 else visible[rng.integers(len(visible))]
            x = HX0 + i * B; y = HY0 + j * B
            cv.rect(x, y, x + B, y + B, c)
# weicher Schatten unter dem Herz (Dither)
# --- kleine Herzen (Molinda-Hintergrund) verstreut
sheart = cutf('Cute Angel Molinda', (1, 7, 10, 15), tol=40)
for (x, y, k) in [(18, 40, 2), (214, 52, 3), (30, 250, 3), (206, 238, 2), (120, 30, 2), (228, 150, 2), (12, 160, 2), (70, 312, 2), (180, 318, 2)]:
    paste(cv, up(sheart, k), x, y)

# --- Figuren
cat = cutf('Army of the Cute', (15, 0, 42, 16), tol=40, largest=1)
bun = cutf('Cute Bunny', (43, 4, 76, 23), tol=45)
g = (bun[..., 1].astype(int) > bun[..., 0].astype(int) + 20) & (bun[..., 1] > bun[..., 2])
bun[g] = 0; bun = trim(bun)
bun = mirror_complete(bun, 18)
mini = cutf('Cute Annoyance Mini', (19, 10, 55, 38), tol=30, largest=1)

def put(s, x, y, k, fl=False, sh=True):
    s2 = up(flip(s) if fl else s, k)
    if sh: cv.paste(silhouette(s2, (150, 40, 120)), x + k, y + k, alpha=0.35)
    cv.paste(s2, x, y)

put(bun, 10, 12, 2); put(bun, 178, 118, 2, True); put(bun, 6, 222, 2, True)
put(cat, 150, 18, 2, True); put(cat, 16, 128, 2); put(cat, 188, 212, 2, True); put(cat, 36, 276, 2); put(cat, 150, 270, 2, True); put(cat, 96, 36, 2)
M = up(outline(mini, (90, 20, 80)), 4)
paste(cv, silhouette(M, (120, 30, 100)), 125 + 4, 246 + 4, 'b', alpha=0.35)
paste(cv, M, 125, 246, 'b')

# --- Schriftzug
text(cv, 'ARMY OF THE CUTE', 16, 125, 322, (255, 255, 255), outline_c=(150, 40, 120), center=True)
# Rahmen in Herzfarben
for i, c in enumerate([(120, 30, 100), (248, 89, 125), (252, 160, 184), (120, 30, 100)]):
    cv.a[i, :] = c; cv.a[-1 - i, :] = c; cv.a[:, i] = c; cv.a[:, -1 - i] = c
print(save(cv, '02_army_of_the_cute.png'))
