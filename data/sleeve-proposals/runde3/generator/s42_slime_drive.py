# -*- coding: utf-8 -*-
"""Sleeve 42 – „Slime Drive“: Der Slime Rancher treibt seine Herde den Waldweg herunter – vorne groß der
Rancher in der Kutte, dahinter in einer S-Kurve Hardy, Fiery, Icy, Sparky, Rocky, Slimy, Darky und ganz hinten der
gekrönte Shiny Slime; über dem Weg flattert der Cloudy Slime. Hintergrund: der Waldweg mit Holzsteg aus der
Übersichtskarte „Wald“ (2×).

Quellen (Motive.xcf): 456 „Slime Rancher“, 447 „Shiny Slime“, 449 „Hardy Slime“, 454 „Slimy Slime“,
459 „Cloudy Slime“, 462 „Rocky Slime“, 466 „Fiery Slime“, 469 „Icy Slime“, 532 „Sparky Slime“, 535 „Darky Slime“,
1142 „Wald“ (Karte).
"""
from g_util import *

B = 'Motive'
W2, H2 = 250, 350
cv = Canvas(W2, H2)

wald = layer(B, 1142)[:, 100:420, :3]
bg = wald[0:175, 165:290]
cv.a[:] = up(rgba(bg), 2)[:H2, :W2, :3]

sl = {n: lay(B, i) for n, i in dict(rancher=456, shiny=447, hardy=449, slimy=454, cloudy=459, rocky=462,
                                     fiery=466, icy=469, sparky=532, darky=535).items()}
sl['rancher'] = hsv_shift(sl['rancher'], 0, 1.0, 1.3)
for n, s in sl.items():
    Image.fromarray(s).save(os.path.join(xcfkit.CACHE, 'g42_%s.png' % n))


def put(name, cx, feet, k=3, fl=False, shadow=True):
    s = sl[name]
    if fl: s = flip(s)
    u = up(s, k)
    x, y = int(cx - u.shape[1] / 2), feet - u.shape[0]
    if shadow:                                      # Schlagschatten auf dem Boden (flach, halbtransparent)
        sh = silhouette(u, (20, 30, 10))
        sh = sh[::3]                                # gestaucht = liegender Schatten
        cv.paste(sh, x + 4, feet - sh.shape[0] + 3, alpha=0.35)
    cv.paste(u, x, y)


# von hinten (oben) nach vorn (unten)
put('shiny', 126, 70)
put('darky', 94, 104)
put('slimy', 156, 128)
put('rocky', 100, 166)
put('sparky', 158, 200)
put('icy', 102, 240)
put('fiery', 160, 276)
put('hardy', 118, 318, fl=True)
put('rancher', 44, 346, k=5)
# Cloudy Slime schwebt (Schatten weit darunter)
c = up(sl['cloudy'], 3)
cv.paste(silhouette(c, (20, 30, 10))[::3], 200 - c.shape[1] // 2 + 6, 128, alpha=0.3)
cv.paste(flip(c), 200 - c.shape[1] // 2, 64)

vignette(cv, 0.3, 0.65)
frame(cv, ((12, 20, 8), (70, 130, 40), (170, 220, 110), (12, 20, 8)))
print(save(cv, '42_slime_drive.png'))
