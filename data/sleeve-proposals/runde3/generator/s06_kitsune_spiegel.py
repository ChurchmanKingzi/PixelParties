# -*- coding: utf-8 -*-
"""Sleeve 06 – Der Spiegel der Kitsune.

Nachts im Kirschhain schwebt der Heilige Spiegel über der Kitsune – doch das Glas zeigt nicht
den Fuchs, sondern ihre verwandelte Gestalt, den Kirin (vgl. Karte „Kitsune Transformation“).
Quellen (MotiveJapan.xcf): Sacred Mirror [226], Kitsune [223] + Ebene #129 [222]
(Fuchsfeuer-Schwänze), Kirin [166], Ebene #17 [183] (Kirschbaum-Reihen), Ebene #13 [245]
(Blütenboden), Ebene #75 [52] (Blütenblätter). Nachtverlauf, Lichthof und Glas-Tönung: selbst
erstellt (gedithert); Kirin im Glas nur umgefärbt und auf die Glasfläche beschnitten.
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)

mirror = sprite('a06_mirror', B, [226])
kitsune = sprite('a06_kitsune', B, [223, 222])
kirin = sprite('a06_kirin', B, [166])
rows = sprite('a06_cherry_rows', B, [183])
bank = layer(B, 245)
petals = [q for q in parts(sprite('a06_petals', B, [52]), dil=0) if q.shape[0] * q.shape[1] >= 4]

# --- Hintergrund: nächtlicher Kirschhain -----------------------------------------------------------
vgrad(cv, 0, 350, [(10, 6, 26), (30, 12, 44), (60, 20, 60)])
col_l = parts(rows, dil=0)
print('tree columns', [c.shape for c in col_l])
dark = lambda s, f: tint(darken(s, f), (40, 0, 60), 0.3)
# zwei Baumreihen links/rechts, hintere dunkler (Tiefe)
put(cv, dark(col_l[1], 0.35), 36, -20, 2)
put(cv, dark(col_l[2], 0.35), 150, -34, 2, fl=True)
put(cv, dark(col_l[0], 0.55), -24, -60, 3)
put(cv, dark(col_l[3], 0.55), 250 - col_l[3].shape[1] * 3 + 24, -40, 3, fl=True)

# Blütenboden
ground = bank[160:200, 0:125].copy(); ground[..., 3] = 255
put(cv, dark(ground, 0.5), 0, 292, 2)

# --- Heiliger Spiegel ------------------------------------------------------------------------------
K = 8
MX, MY = 125, 106
glow(cv, MX, MY, 120, (150, 230, 255), 0.4)
mx, my, mw, mh = put(cv, mirror, MX, MY, K, anchor='c')
# Glasfläche = blaue Pixel des Spiegels
c = mirror[..., :3].astype(int)
glass = (mirror[..., 3] > 0) & (c[..., 2] > 150) & (c[..., 2] > c[..., 0] + 60)
hi = glass & (c[..., 0] > 140)                        # helle Glanzstreifen
G = up(glass[..., None].astype(np.uint8), K)[..., 0] > 0
HI = up(hi[..., None].astype(np.uint8), K)[..., 0] > 0
# Kirin (4×), kühl getönt, nur innerhalb der Glasfläche
kr = tint(up(kirin, 4), (60, 170, 230), 0.22)
layer_ = np.zeros((mh, mw, 4), np.uint8)
kx, ky = (mw - kr.shape[1]) // 2, (mh - kr.shape[0]) // 2 + 10
layer_[ky:ky + kr.shape[0], kx:kx + kr.shape[1]] = kr
layer_[~G] = 0
cv.paste(layer_, mx, my, alpha=0.92)
# Glanzstreifen wieder darüber (halb), damit es Glas bleibt
gl = up(mirror, K).copy(); gl[~HI] = 0
cv.paste(gl, mx, my, alpha=0.35)

# --- Kitsune davor ---------------------------------------------------------------------------------
glow(cv, 125, 280, 70, (255, 130, 60), 0.25)
put(cv, kitsune, 125, 344, 5, anchor='b', shadow=0.45, sdx=0, sdy=1)

# Blütenblätter
for (x, y), i in zip([(18, 70), (224, 40), (36, 200), (210, 170), (20, 270), (228, 262), (60, 20),
                      (190, 300), (100, 214)], [5, 17, 29, 41, 53, 65, 77, 89, 101]):
    put(cv, petals[i % len(petals)], x, y, 2)

frame(cv, [(12, 4, 20), (160, 60, 120), (250, 200, 230), (12, 4, 20)])
print(save(cv, '06_kitsune_spiegel.png'))
