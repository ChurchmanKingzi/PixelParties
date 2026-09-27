# -*- coding: utf-8 -*-
"""Sleeve 51 – Hou im Bombenkreis (neu in Runde 3b).

Guardian Beast Hou steht mit ihrem roten Stab im Hof der Wächter, um sie herum liegen im Kreis die
Bomben mit brennenden Lunten – genau wie auf ihrer Karte, aber für das Hochformat neu angeordnet:
eine Bombe über ihr, je zwei links und rechts, zwei vorn. Die Lunten werfen gelbes Licht, der Rand
verschwindet im Dunkel.

Skalierung: ALLES einheitlich 6× (Szene im 6×-Raster = 42×59 Zellen): Hofboden (lila Kreuz, dunkler
Geröllring, orange Fliesen), Hou, Stab, alle Bomben, Funken, Lichtschein, Vignette.

Quellen (MotiveGuardianBeasts.xcf): Hou [124] + roter Stab aus Hou #1 [123] (Lage relativ zu Hou wie in
den Ebenen) = vollständige Figur lt. Sichtbar #19; Bomben aus Hou #1 [123] (5 Stück, zwei davon
gespiegelt wiederholt), Funken Hou #2 [122]; Hintergrund [126] (Hofboden der Hou-Karte).
Lichtschein und Vignette: selbst erstellt (ungedithert, pro Rasterzelle).
"""
from a_util import *  # noqa

B = 'MotiveGuardianBeasts'
cv = Canvas(250, 350)
G = 6
lo = lowres(G)                                        # 42×59
W_, H_ = lo.w, lo.h

hou = compose(B, [124], crop=False)
bombs_layer = compose(B, [123], crop=False)
spark = sprite('a51_spark', B, [122])
# roter Stab = die Spalten mit langem senkrechtem Lauf (≥25 Pixel); Bomben = übrige Komponenten
import cv2
A = bombs_layer[..., 3] > 0
scols = [x for x in range(A.shape[1]) if A[:, x].sum() >= 25]
staff_layer = np.zeros_like(bombs_layer)
staff_layer[:, scols[0]:scols[-1] + 1] = bombs_layer[:, scols[0]:scols[-1] + 1]
rest = bombs_layer.copy(); rest[:, scols[0]:scols[-1] + 1] = 0
n, lab, st, _ = cv2.connectedComponentsWithStats(cv2.dilate((rest[..., 3] > 0).astype(np.uint8),
                                                             np.ones((3, 3), np.uint8)), connectivity=8)
figure = compose(B, [124], crop=False)
import xcfkit
figure = xcfkit.over(figure, staff_layer)             # Stab liegt im Stapel über Hou
figure[..., 3] = np.where(figure[..., 3] >= 128, 255, 0)
fb = bbox(figure); fig = figure[fb[1]:fb[3], fb[0]:fb[2]]
Image.fromarray(fig).save(os.path.join(xcfkit.CACHE, 'a51_hou.png'))
bombs = []
for k in range(1, n):
    p = rest.copy(); p[lab != k] = 0
    b = bbox(p); bombs.append(p[b[1]:b[3], b[0]:b[2]])

print('figure', fig.shape, 'bombs', [b.shape for b in bombs])

# --- Hofboden der Hou-Karte (5×) ------------------------------------------------------------------------------
bg = layer(B, 126)
cxb, cyb = (fb[0] + fb[2]) // 2, (fb[1] + fb[3]) // 2
crop = bg[cyb - 32:cyb - 32 + H_, cxb - W_ // 2:cxb - W_ // 2 + W_].copy()
lo.a[:] = crop[..., :3]
lo.a[:] = (lo.a * 0.42 + np.array([20, 14, 40]) * 0.3).clip(0, 255).astype(np.uint8)   # Nacht im Hof

# --- Lichtschein der Lunten + Figur ------------------------------------------------------------------------
FX, FY = W_ // 2, 49                                  # Fußpunkt Hou
spots = [(21, 12, 2, False), (7, 21, 1, False), (35, 21, 4, True), (6, 38, 0, True), (36, 38, 3, False),
         (11, 56, 4, False), (31, 56, 1, True)]
for x, y, i, fl in spots:
    sglow(lo, x, y - 6, 10, (255, 200, 80), 0.55)
sglow(lo, FX, FY - 12, 17, (255, 190, 120), 0.45)

# Schatten unter Hou
for y in range(FY - 1, FY + 2):
    for x in range(FX - 7, FX + 8):
        if ((x + .5 - FX) / 7.5) ** 2 + ((y + .5 - FY) / 1.6) ** 2 < 1:
            lo.a[y, x] = (lo.a[y, x] * 0.55).astype(np.uint8)
hx = FX - (bbox(layer(B, 124))[0] + bbox(layer(B, 124))[2]) // 2 + fb[0]
lo.paste(fig, FX - 8 - (bbox(layer(B, 124))[0] - fb[0]), FY - fig.shape[0] + 1)

# --- Bomben im Kreis ---------------------------------------------------------------------------------------
for x, y, i, fl in spots:
    b = bombs[i % len(bombs)]
    b = flip(b) if fl else b
    # Schlagschatten
    lo.paste(silhouette(b, (0, 0, 0)), x - b.shape[1] // 2 + 1, y - b.shape[0] + 2, alpha=0.4)
    lo.paste(b, x - b.shape[1] // 2, y - b.shape[0] + 1)

# --- Vignette ------------------------------------------------------------------------------------------------
for y in range(H_):
    for x in range(W_):
        d = math.hypot((x + .5 - W_ / 2) / (W_ / 2), (y + .5 - H_ / 2) / (H_ / 2)) / math.sqrt(2)
        t = min(0.5, max(0.0, (d - 0.5) / 0.5) * 0.6)
        lo.a[y, x] = (lo.a[y, x] * (1 - t)).astype(np.uint8)

blow(cv, lo, G)
print(save(cv, '51_hou_bombenkreis.png'))
