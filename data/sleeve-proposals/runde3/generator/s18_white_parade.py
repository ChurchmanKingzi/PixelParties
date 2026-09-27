# -*- coding: utf-8 -*-
"""Sleeve 18 – Parade der weißen Armee.

Stellin, der ruhige Diktator, grüßt im Vordergrund; hinter ihm marschieren zwei Kolonnen
Schneemann-Bannerträger aus der Tiefe heran – wie Matrjoschkas nach Größe gestaffelt
(1×, 2×, 3×, 4×) entlang zweier Fluchtlinien auf den Eiskristall-Wall am Horizont zu.
Über dem Wall kreisen die Heli-Trooper.

Quellen (MotiveRussia.xcf):
  Stellin            = Ebene 142 „Ebene #97“ (Karten „Stellin, the Calm Dictator“ / „The White Army“)
  Bannerträger       = Ebene 91 „Ebene #102“ (Karte „Mischief Militia - Banner Bearer“)
  Heli-Trooper       = Ebenen 12 / 37 (Karte „Mischief Militia - Heli Troopers“)
  Eiskristall-Wall, Schnee = Ebene 230 „Hintergrund“ (Kulisse von „The White Army“)
"""
from c_util import *

cv = Canvas(W, H)
BG = 230

# ---------- Schneefläche (sauberer Ausschnitt aus Ebene 230, gespiegelt gekachelt), 2×
snow = tex('c18_snow', RU, BG, (234, 224, 298, 264))                 # 64×40
snow4 = np.concatenate([snow, snow[:, ::-1]], 1)
snow4 = np.concatenate([snow4, snow4[::-1]], 0)
tile_fill(cv, snow4, 0, 0, W, H, k=2)

# ---------- Himmel: dunkles Winterblau mit Dithering (selbst erstellt)
HOR = 66                                     # Fuß des Eiswalls = Horizont
ordered(cv, 0, 0, W, 30, (22, 26, 64), (60, 70, 130), lambda x, y: y / 30)

# ---------- Eiskristall-Wall: waagrechtes Stück aus Ebene 230 (mit Oberkante), gespiegelt gekachelt, 2×
wall = tex('c18_wall', RU, BG, (336, 180, 380, 208))                  # 44×28
wm = np.dstack([wall, np.full(wall.shape[:2], 255, np.uint8)])
wc = wall.astype(int)
wm[..., 3] = np.where((wc[..., 2] - wc[..., 0] > 38) | (wc.max(-1) < 120), 255, 0)
wm = fill_holes(wm)
wrow = np.concatenate([wm, wm[:, ::-1], wm], 1)                      # 132 breit
Wl = up(wrow, 2)
ys = np.nonzero(Wl[..., 3].any(1))[0]
Wl = Wl[ys.min():]
wy = HOR - Wl.shape[0]
cv.paste(Wl, (W - Wl.shape[1]) // 2, wy)
cv.rect(0, HOR, W, HOR + 2, (150, 150, 200))                          # Schattenkante am Wallfuß

# ---------- Heli-Trooper über dem Wall
for k, (x, y, s, fl) in enumerate([(30, 6, 2, False), (186, 12, 2, True), (112, 2, 1, False)]):
    t = sprite('c18_heli%d' % (k % 2), RU, [[12, 37][k % 2]])
    T = up(flip(t) if fl else t, s)
    cv.paste(T, x, y)

# ---------- Paradeweg: schraffierte Eisfläche (Ebene 230) als Trapez zum Fluchtpunkt
VPX, VPY = W // 2, HOR + 2              # Fluchtpunkt
hatch = tex('c18_hatch', RU, BG, (330, 280, 346, 296))                # 16×16 Schraffur
def on_path(x, y):
    if y < VPY: return False
    t = (y - VPY) / (H - VPY)
    return abs(x + .5 - VPX) < 8 + t * 70
tile_fill(cv, hatch, 0, VPY, W, H, k=2, mask=on_path)

# ---------- Kolonnen: Bannerträger nach Größe gestaffelt (hinten klein, vorne groß), Banner nach außen
bb = sprite('c18_banner', RU, [91])
rows = [(1, 0.05), (2, 0.24), (3, 0.52), (4, 0.92)]     # (Skalierung, Tiefe 0..1)
for side in (-1, 1):
    b_ = flip(bb) if side < 0 else bb
    for k, t in rows:
        S = up(b_, k)
        fx = VPX + side * (24 + t * 100)                 # Fußpunkt auf der Fluchtlinie
        fy = VPY + t * (H - VPY - 4)
        x = int(fx - S.shape[1] / 2 + side * S.shape[1] * 0.12); y = int(fy - S.shape[0])
        O = up(outline(b_, (70, 72, 120)), k)
        cv.paste(silhouette(O, (120, 120, 170)), x, y, alpha=0.45)   # Schatten im Schnee
        cv.paste(O, x - k, y - k)
        cv.paste(S, x, y)

# ---------- Stellin im Vordergrund (5×)
st = sprite('c18_stellin', RU, [142])
K = 5
St = up(st, K)
sx, sy = (W - St.shape[1]) // 2, H - St.shape[0] - 8
cv.paste(silhouette(St, (120, 120, 170)), sx + 6, sy + 8, alpha=0.45)
cv.paste(up(outline(st, (30, 20, 30)), K), sx - K, sy - K)
cv.paste(St, sx, sy)

print(save(cv, '18_white_parade.png'))
