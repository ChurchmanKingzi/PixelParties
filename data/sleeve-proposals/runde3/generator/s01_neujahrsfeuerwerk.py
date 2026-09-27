# -*- coding: utf-8 -*-
"""Sleeve 01 – Neujahrsfeuerwerk vor der Palastmauer (Runde 3b überarbeitet).

Vorne hält sich Junshi die Ohren zu (wie auf der Karte „Firework Cannon“), während aus der
Kanonenkiste drei Raketen aufsteigen; hinter den Zinnen der Palastmauer schauen der Bambus-
wächter Xiong und der verhüllte Bibliothekar Tushu dem Feuerwerk zu.

Skalierung: Himmel, Feuerwerksblüten, Lichthöfe, Palastmauer, Rasen und die Zuschauer (Xiong,
Tushu) liegen alle auf einem gemeinsamen 3×-Raster (Hintergrund). Vordergrund (Kanonenkiste,
Raketen, Junshi) einheitlich 5×.

Quellen (MotiveChina.xcf): Ebene #1 [36] (Palastmauer), Hintergrund [37] (Rasen), Firework Cannon #2
[30] (Raketen; rote Blüte als Stilvorlage), Firework Cannon #1 [31] (Kiste + Ärmel) + Firework
Cannon [32] (Junshi, Ohren zuhaltend – Figur = [32] + Ärmel aus [31], geprüft gegen Sichtbar #1),
Xiong [5], Tushu [21] + Tushu #5 [20].
Himmel, große Blüten und Lichthöfe: selbst gezeichnet im 3×-Raster (Farben der Blüten aus [30]).
"""
from a_util import *  # noqa

B = 'MotiveChina'
cv = Canvas(250, 350)
G = 3
lo = lowres(G)                                  # 84×117 Zellen

# --- Bauteile ---------------------------------------------------------------------------
fw = sprite('a01_fireworks', B, [30])
fw_parts = parts(fw, dil=0)
blob = [p for p in fw_parts if p.shape[0] >= 9][0]
rockets = [p for p in fw_parts if p.shape[1] == 4 and p.shape[0] >= 13]
red = (blob[..., 0] > 200) & (blob[..., 2] < 100) & (blob[..., 3] > 0)
ys, xs = np.where(red)
bmask = red[ys.min():ys.max() + 1, xs.min():xs.max() + 1]          # 11×11 Blütenform

wall = compose(B, [36])                          # 469×89
box = parts(sprite('a01_cannons', B, [31]), dil=0)[0]      # Kiste mit drei Rohren (ohne Ärmel)
# Junshi = [32] + Ärmel aus [31] (Ärmel liegen im Stapel darüber); Kiste dabei ausblenden
import xcfkit
import cv2
_l31 = layer(B, 31).copy()
_n, _lab, _st, _ = cv2.connectedComponentsWithStats((_l31[..., 3] > 0).astype(np.uint8), connectivity=8)
_big = 1 + int(np.argmax(_st[1:, cv2.CC_STAT_AREA]))
_l31[_lab == _big] = 0                          # größte Komponente = Kiste → entfernen, Ärmel bleiben
_j = xcfkit.over(layer(B, 32).copy(), _l31)
_j[..., 3] = np.where(_j[..., 3] >= 128, 255, 0)
_b = bbox(_j)
junshi_full = _j[_b[1]:_b[3], _b[0]:_b[2]]
Image.fromarray(junshi_full).save(os.path.join(xcfkit.CACHE, 'a01_junshi_full.png'))
xiong = sprite('a01_xiong', B, [5])
tushu = sprite('a01_tushu', B, [21, 20])

C_RED, C_CYAN, C_PURP, C_GOLD = (255, 29, 14), (14, 255, 207), (117, 77, 198), (255, 230, 40)


def mix(c, d, t):
    return tuple(int(a * (1 - t) + b * t) for a, b in zip(c, d))


def burst(cx, cy, R, col, rays=16):
    """Chrysanthemen-Blüte im Raster: gepunktete Strahlen, helle Mitte, Kreuzspitzen."""
    glow(lo, cx + .5, cy + .5, R * 1.7, col, 0.42)
    core = mix(col, (255, 255, 255), 0.55)
    for k in range(rays):
        a = 2 * math.pi * k / rays + (0.5 if k % 2 else 0) * 0
        L = R if k % 2 == 0 else R * 0.72
        r = 2.0
        while r <= L:
            x, y = int(round(cx + r * math.cos(a))), int(round(cy + r * math.sin(a)))
            lo.px(x, y, core if r < L * 0.45 else col)
            r += 1.6 if r < L * 0.45 else 2.0
        tx, ty = int(round(cx + (L + 1.5) * math.cos(a))), int(round(cy + (L + 1.5) * math.sin(a)))
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            lo.px(tx + dx, ty + dy, col if (dx or dy) else core)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        lo.px(cx + dx, cy + dy, (255, 255, 255))


def small(cx, cy, col):
    """Kleine Blüte = Originalform aus Firework Cannon #2 (11×11), im selben Raster."""
    glow(lo, cx + .5, cy + .5, 10, col, 0.3)
    s = np.zeros(bmask.shape + (4,), np.uint8); s[bmask] = list(col) + [255]
    lo.paste(s, cx - 5, cy - 5)


# --- Himmel (3×-Raster) --------------------------------------------------------------------
vgrad(lo, 0, 70, [(5, 3, 18), (12, 8, 38), (28, 14, 58), (58, 24, 70)])
# Sterne
rng = np.random.RandomState(3)
for _ in range(26):
    x, y = rng.randint(1, 83), rng.randint(1, 48)
    lo.px(x, y, (150, 140, 190) if rng.rand() < .6 else (230, 220, 255))

burst(52, 19, 15, C_RED, rays=20)
burst(16, 24, 11, C_CYAN)
burst(73, 41, 7, C_GOLD, rays=12)
small(30, 42, C_PURP)
small(79, 8, C_GOLD)
small(33, 5, C_PURP)

# --- Palastmauer mit Zuschauern ----------------------------------------------------------------
WY = 52                                         # Oberkante der Zinnen (Raster)
wcrop = wall[:, 100:100 + 84]
wdark = tint(darken(wcrop, 0.62), (70, 24, 96), 0.22)
# Zuschauer hinter der Brüstung (zwischen den Zinnen)
# Lücken zwischen den Zinnen: Spalten 0–16 und 43–60, Brüstung ab Zeile 6
lo.paste(xiong, 52 - 17, WY + 6 - 16)          # Xiong: Kopf + Schultern über der Brüstung, Stab dahinter
lo.paste(tushu, 8 - tushu.shape[1] // 2, WY + 6 - 17)             # Tushu schwebt hinter der Brüstung
lo.paste(wdark, 0, WY)
# warmer Widerschein der Blüten auf der Mauerkrone
glow(lo, 42, WY + 6, 40, (255, 110, 80), 0.2)

# Rasen vor der Mauer (nachtdunkel)
grass = layer(B, 37)[372:420, 214:300].copy()
grass[..., 3] = 255
lo.paste(tint(darken(grass, 0.5), (30, 16, 60), 0.2), 0, 92)
# gezackte Rasenkante
for x in range(84):
    if (x * 7) % 5 < 2: lo.px(x, 91, tuple(tint(darken(grass[:1, :1], .5), (30, 16, 60), .2)[0, 0, :3]))

blow(cv, lo, G)

# --- Vordergrund (5×) ------------------------------------------------------------------------------
K = 5
GY = 344                                        # Standlinie
# Lichtschein der Zündung um die Kiste
bx, by = 6, GY - box.shape[0] * K
# Raketen steigen aus den drei Rohren (Rohrmitten der Kiste bestimmen)
tube_cols = []
dark_top = box[0, :, 3] > 0
xs_ = np.where(box[1, :, 3] > 0)[0]
# Rohre: drei Gruppen deckender Pixel in der obersten Zeile
row = box[0, :, 3] > 0
groups, cur = [], []
for x in range(box.shape[1]):
    if row[x]: cur.append(x)
    elif cur: groups.append(cur); cur = []
if cur: groups.append(cur)
print('tubes', [(g[0], g[-1]) for g in groups])
lift = [22, 6, 36]
for g, r, dy in zip(groups[:3], rockets, lift):
    cx = bx + int((g[0] + g[-1] + 1) / 2 * K)
    put(cv, r, cx - 2 * K, by - r.shape[0] * K - dy, K)
# Funkenspur zwischen Rohr und Rakete (5×-Raster, Farben der Raketenfunken)
for g, r, dy in zip(groups[:3], rockets, lift):
    cx = bx + int((g[0] + g[-1] + 1) / 2 * K) - K // 2 - 2
    for i, yy in enumerate(range(by - dy, by, K)):
        if (i + g[0]) % 2 == 0:
            cv.rect(cx + ((i % 3) - 1) * K // 2 * 0, yy, cx + K, yy + K, (255, 230, 40) if i % 4 else (255, 150, 30))
put(cv, box, bx, GY, K, anchor='bl', shadow=0.45, sdx=1, sdy=0)
# Junshi mit Ärmeln (Ohren zugehalten), rechts neben der Kiste: Ebene [32] + Ärmel-Teil von [31]
put(cv, junshi_full, 248 - junshi_full.shape[1] * K, GY - junshi_full.shape[0] * K, K,
    shadow=0.45, sdx=-1, sdy=0)

print(save(cv, '01_neujahrsfeuerwerk.png'))
