# -*- coding: utf-8 -*-
"""Sleeve 17 – Duell im Schneesturm (Blick über die Schulter).

Der Mischief-Militia-Bärenreiter steht – von hinten gesehen – am verschneiten Ufer des Nordmeers;
vor ihm erhebt sich die dreiköpfige Nothern Hydra aus dem eisigen Wasser. Schneeflocken wehen quer
über das Bild.

Quellen (MotiveRussia.xcf):
  Bärenreiter von hinten = Ebene 76 „Ebene #109“ (Karte „Mischief Invasion“)
  Nothern Hydra          = Ebene 9 „Nothern Hydra“
  Meer / Ufer / Wald     = Ebene 221 „Ebene #6“ (Karte mit Nothern Hydra), nach oben mit der
                           Meereskachel derselben Ebene verlängert
  Schneeflocken          = Ebene 64 „Ebene #122“ (Schneerauschen), nur die deckenden Pixel
"""
from c_util import *

cv = Canvas(W, H)

# ---------- Hintergrund: Ebene 221, nach oben um Meereskacheln verlängert, 2×
L = layer(RU, 221)[..., :3] if os.path.exists(os.path.join(XK.EXP, RU)) else None
bgkey = 'c17_bg'
if L is not None:
    X0, X1 = 376, 501
    Y0, Y1 = 372, 470                     # Ausschnitt mit Uferlinie, Eisschollen, Wald
    part = L[Y0:Y1, X0:X1]
    sea = L[328:344, X0:X1]               # 16 Zeilen dunkles Meer (periodisch)
    ext = 175 - part.shape[0]
    top = np.concatenate([sea] * (ext // 16 + 2), 0)[-ext:]
    bg = np.concatenate([top, part], 0)
    Image.fromarray(bg).save(os.path.join(XK.CACHE, bgkey + '.png'))
else:
    bg = np.array(Image.open(os.path.join(XK.CACHE, bgkey + '.png')).convert('RGB'))
cv.a[:] = up(np.dstack([bg, np.full(bg.shape[:2], 255, np.uint8)]), 2)[:H, :W, :3]
shade_rows(cv, 0, 150, 0.6, 0.0, (8, 12, 40))          # Sturmdunkel über dem Meer

# ---------- Hydra: aus dem Meer aufsteigend (hinter der Uferlinie)
hydra = sprite('c17_hydra', RU, [9])
Hy = up(hydra, 2)
WL = 176                                               # Wasserlinie im hellen Meer vor dem Ufer
hx, hy = (W - Hy.shape[1]) // 2, WL + 12 - Hy.shape[0]
vis = Hy[:WL - hy]                                     # nur der Teil über dem Wasser
cv.paste(silhouette(vis, (10, 16, 50)), hx + 4, hy + 6, alpha=0.5)
cv.paste(vis, hx, hy)
# Schaumkante, wo die Hydra ins Wasser taucht
cols = np.nonzero(Hy[WL - hy - 1, :, 3] > 0)[0]
for c in cols:
    cv.px(hx + c, WL, (226, 232, 255))
    if c % 3: cv.px(hx + c, WL + 1, (160, 180, 250))
for c in (cols.min() - 3, cols.min() - 2, cols.max() + 2, cols.max() + 3):
    cv.px(hx + c, WL + 1, (226, 232, 255))

# ---------- Bärenreiter von hinten, groß im Vordergrund
bear = sprite('c17_bear_back', RU, [76])
K = 4
B = up(bear, K)
bx, by = (W - B.shape[1]) // 2, H - B.shape[0] + 6
cv.paste(silhouette(up(outline(bear), K), (20, 24, 60)), bx - K + 3, by - K + 3, alpha=0.5)
cv.paste(up(outline(bear, (24, 22, 40)), K), bx - K, by - K)
cv.paste(B, bx, by)

# ---------- Schneegestöber: deckende Pixel des Schneerauschens (Ebene 64), 1× und 2×
snow = layer(RU, 64) if L is not None else None
if snow is not None:
    fl = (snow[..., 3] >= 250)
    np.save(os.path.join(XK.CACHE, 'c17_flakes.npy'), fl[:H, :W])
else:
    fl = np.load(os.path.join(XK.CACHE, 'c17_flakes.npy'))
ys, xs = np.nonzero(fl[:H, :W])
for y, x in zip(ys, xs):
    if (x * 7 + y * 13) % 5 == 0:                      # ausdünnen
        cv.px(x, y, (236, 240, 255))
fl2 = fl[200:200 + H // 2, 300:300 + W // 2]
ys, xs = np.nonzero(fl2)
for y, x in zip(ys, xs):
    if (x * 5 + y * 11) % 9 == 0:
        cv.rect(2 * x, 2 * y, 2 * x + 2, 2 * y + 2, (248, 250, 255))

print(save(cv, '17_hydra_duel.png'))
