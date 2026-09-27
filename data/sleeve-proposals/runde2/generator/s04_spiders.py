# -*- coding: utf-8 -*-
"""Sleeve: Spinnennest – ein großes Radnetz vor dunklem Fels, in der Nabe die Crimson Skull Spider an
ihrem roten Faden, ringsum Brain-, Diamond- und Cute Spider sowie kleine Spinnen aus „SPODDERS“.
Quellen (Repo PixelPartiesSprites):
  Netz      MotiveGrailWar.xcf „Trapping #1“ (273): weiße Netzpixel der oberen Hälfte, senkrecht
            gespiegelt (untere Hälfte ist dort von der gefangenen Figur verdeckt), um 90° gedreht;
            Haltefäden = verlängerte Speichen des Netzes (1 Kartenpixel breit)
  Spinnen   MotiveGN.xcf: Crimson Skull Spider „Ebene #178“ (259, mit rotem Faden), Brain Spider
            „Ebene #246“ (251, weißer Faden) + Glanz „Ebene #248“ (250), Diamond Spider „Ebene #181“ (260),
            Cute Spider „Ebene #309/#308/#310“ (264–266), kleine Spinnen „SPODDERS“ (267)
  Fels      MotiveGN.xcf „Klippen“ (421), abgedunkelt
Skalierung: ALLES (Fels, Netz, Fäden, alle Spinnen, Schatten) auf einem 63×88-Kartenpixel-Raster,
am Ende einheitlich 4× (→ 252×352, auf 250×350 beschnitten; Ausgabe 12 px je Kartenpixel). Keine eigenen Rahmenlinien."""
import math
import numpy as np
from kit import Canvas, up, flip, rot90, hsv_shift, silhouette, vignette, save
from xcfkit import sprite, parts, layer, bbox

G = 'MotiveGN'
NW, NH, K = 63, 88, 4
cv = Canvas(NW, NH)

# --- Fels (Ebene „Klippen“), Kartenpixel 1:1, gespiegelt auf Höhe gebracht, abgedunkelt
kl = sprite('r2_04_klippen', G, [421])
band = kl[150:240, 130:130 + NW]
bg = np.concatenate([band[::-1], band], 0)[:NH]
bg = hsv_shift(bg, 0, 0.8, 0.8)[..., :3].astype(float)
bg = bg.mean((0, 1)) + (bg - bg.mean((0, 1))) * 0.6          # Kontrast zurücknehmen → ruhiger Hintergrund
cv.a[:] = bg.clip(0, 255).astype(np.uint8)
vignette(cv, 0.55, 0.35)

# --- Netz aus „Trapping #1“
try:
    t = layer('MotiveGrailWar', 273); b = bbox(t); t = t[b[1]:b[3], b[0]:b[2]]
    wm = (t[..., 3] > 0) & (t[..., :3].min(-1) > 235)
    from PIL import Image; import os
    from xcfkit import CACHE
    Image.fromarray((wm * 255).astype(np.uint8)).save(os.path.join(CACHE, 'r2_04_web_mask.png'))
except Exception:
    from PIL import Image; import os
    from xcfkit import CACHE
    wm = np.array(Image.open(os.path.join(CACHE, 'r2_04_web_mask.png'))) > 0
HUB_Y, HUB_X = 44, 51
top = wm[:HUB_Y + 1]
web = np.concatenate([top, top[:-1][::-1]], 0)          # 89 × 91, Nabe (44, 51)
web = np.rot90(web)                                     # 91 × 89, Nabe (39, 44)
wy, wx = 91 - 1 - HUB_X, HUB_Y
HX, HY = NW // 2, NH // 2 - 2                            # Nabe auf der Leinwand
ox, oy = HX - wx, HY - wy
M = np.zeros((NH, NW), bool)
for y, x in zip(*np.where(web)):
    if 0 <= y + oy < NH and 0 <= x + ox < NW: M[y + oy, x + ox] = True

# Speichen finden (Winkelhistogramm um die Nabe) und als Haltefäden bis zum Rand verlängern
ang = np.zeros(360)
ys, xs = np.where(M)
for y, x in zip(ys, xs):
    r = math.hypot(x - HX, y - HY)
    if r > 20: ang[int(math.degrees(math.atan2(y - HY, x - HX))) % 360] += 1
spokes = [a for a in range(360) if ang[a] >= 12 and ang[a] == max(ang[(a + d) % 360] for d in range(-6, 7))]
for a in spokes:
    # äußerstes Netzpixel dieser Speiche suchen, dann gerade weiter bis zum Rand
    th = math.radians(a + 0.5); r = 20; last = None
    while True:
        x = round(HX + r * math.cos(th)); y = round(HY + r * math.sin(th))
        if not (0 <= x < NW and 0 <= y < NH): break
        if M[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any(): last = r
        r += 0.5
    if last is None: continue
    r = last
    while True:
        x = round(HX + r * math.cos(th)); y = round(HY + r * math.sin(th))
        if not (0 <= x < NW and 0 <= y < NH): break
        M[y, x] = True; r += 0.5

WEB, WEBS = (214, 212, 222), (24, 16, 10)
for y, x in zip(*np.where(M)):
    cv.px(x + 1, y + 1, WEBS)
for y, x in zip(*np.where(M)):
    cv.px(x, y, WEB)

# --- Spinnen (xcf-Ebenen, Kartenpixel 1:1)
boss = sprite('r2_04_crimson_skull_spider', G, [259])      # mit rotem Faden
brain = sprite('r2_04_brain_spider', G, [250, 251])        # mit weißem Faden + Glanz
dia = sprite('r2_04_diamond_spider', G, [260])
cute = sprite('r2_04_cute_spider', G, [264, 265, 266])     # Flügel + Körper + Herzaugen
hive = [p for p in parts(sprite('r2_04_spodders', G, [267]), dil=1) if p.shape[0] >= 8 and p.shape[1] >= 10]

def put(s, x, y, fl=False, r=0):
    s2 = rot90(flip(s) if fl else s, r)
    cv.paste(silhouette(s2, (0, 0, 0)), x + 1, y + 1, alpha=0.5)
    cv.paste(s2, x, y)
    return s2

def hang(s, x, y, seglen=2):
    """Spinne am eigenen Faden (oberste Pixelzeilen der Ebene), Faden bis zum oberen Rand verlängert."""
    col = int(np.argmax(s[0, :, 3] > 0))
    seg = s[0:seglen, col:col + 1]; yy = y
    while yy > 0:
        yy -= seg.shape[0]; cv.paste(seg, x + col, yy)
    put(s, x, y)

# Crimson Skull Spider: Körper auf der Nabe, roter Faden nach oben
bcol = int(np.argmax(boss[0, :, 3] > 0))
hang(boss, HX - bcol, HY - boss.shape[0] + 13, seglen=4)
hang(brain, 42, 2)
put(cute, 2, 3)
put(dia, 1, 45, r=1); put(dia, 46, 64, r=3)
put(hive[0], 34, 11); put(hive[5], 6, 27, True, 1); put(hive[3], 13, 66)
put(hive[2], 30, 78); put(hive[0], 49, 80, False, 2)

# --- einheitlich 4× hochskalieren, auf 250×350 beschneiden
u = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), K)[..., :3]
big = Canvas(250, 350)
big.a[:] = u[1:351, 1:251]
print(save(big, '04_spider_nest.png'))
