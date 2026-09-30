# -*- coding: utf-8 -*-
"""31 Tiger and Ox – Gegner „One-Two-Punch!“ (sample-Structure Deck One-Two-Punch), Held: Ghuanjun, the Undead
Martial Artist (Base).

Idee: Nachts auf dem Friedhof seiner Heldenkarte (Grabkreuze, Schädel und Knochen auf dunklem Fels) steht der
untote Kampfkünstler Ghuanjun groß und frontal. Hinter ihm erscheinen über seinen Schultern als halbtransparente,
leuchtende Mosaik-Masken seine zwei Kampfgeister aus den Angriffskarten des Decks: links der Tiger
(„Ferocious Tiger Kick“ / Szene „Tiger Axe Kick“), rechts der Ochse („Strong Ox Headbutt“) – „One-Two-Punch“:
Ghuanjun darf pro Zug zwei verschiedene Angriffe ausführen. Zwischen den Geistern steht der Vollmond.

Quellen (Motive.xcf):
  Ebene 170 „Ghuanjun-Kopie“ – Base-Ghuanjun, pixelgleich (0 px Abweichung) mit Szene 168 „Sichtbar #247“ =
             Kartenbild „Ghuanjun, the Undead Martial Artist“ (Lage 143,237). (171 „Ghuanjun“ weicht in 19 px ab.)
  Ebene 169 „Ghuanjun #1“ – Schädel und Knochen derselben Kartenszene.
  Ebene 167 „Tiger Axe Kick #5“ – Tigermaske (Mosaik, Zelle 5 px → 14×13 Zellen).
  Ebene 154 „Strong Ox Headbutt #3“ – Ochsenkopf (Mosaik, Zelle 4 px → 21×25 Zellen).
  Ebene 1286 „Dark Land“ – Felsboden-Textur und Grabkreuz (Friedhof der Kartenszene).
Selbst gezeichnet: Nachthimmel, Sterne, Mond, Horizont-Hügel, Geisterschein, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Himmel, Mond, Hügel, Felsboden        – 2× (125×175)
  Mittelgrund: Grabkreuze, Schädel, Knochen          – 3× (84×117)
  Kampfgeister Tiger/Ochse (Mosaikzellen) + Schein   – 4× (63×88); Tiger 56×52, Ochse 84×100 px
  Vordergrund: Ghuanjun + Schatten                   – 6× (42×59); Ghuanjun 96×168 px
"""
import math, random
import numpy as np
from kit_f import *  # noqa

M = 'Motive'
rnd = random.Random(31)

# ---------------- Sprites ----------------------------------------------------------------------------------
ghu = sprite('o31_ghuanjun', M, [170])                                  # 16×28
skulls = cached('o31_skulls', lambda: layer(M, 169))
tiger = cached('o31_tiger', lambda: cells(trim(layer(M, 167)), 5))     # 14×13 Zellen
ox = cached('o31_ox', lambda: cells(trim(layer(M, 154)), 4))           # 21×25 Zellen


def _tomb():
    a = layer(M, 1286)[122:146, 238:264].copy()
    c = a[..., :3].astype(int)
    m = (c[..., 0] > 120) & (c[..., 2] > 120) & (c[..., 0] - c[..., 1] > 8)     # lila Grabstein
    a[~m] = 0
    return trim(a)


tomb = cached('o31_tomb', _tomb)
rock = cached('o31_rock', lambda: layer(M, 1286)[180:212, 244:284].copy())   # 40×32 heller Felsboden ohne Knochen

sk_parts = parts(skulls, dil=1)
skull_a = sk_parts[2]; skull_b = sk_parts[5]
bone_a = sk_parts[1] if sk_parts[1].shape[1] < 12 else sk_parts[7]
bone_b = sk_parts[7]

# ---------------- Hintergrund 2× (125×175) ------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
HZ = 104                                                        # Horizont (2×-Zeile) → y 208
bands(bg, 0, HZ, [(8, 8, 22), (14, 13, 34), (22, 18, 46), (34, 26, 58), (50, 36, 70)], soft=0.5)
for _ in range(34):
    x, y = rnd.randrange(3, bw - 3), rnd.randrange(3, 70)
    bg[y, x, :3] = (190, 190, 225) if rnd.random() < .4 else (110, 105, 150)
MX, MY, MR = 50, 24, 7.5
glow(bg, MX, MY, MR + 14, (120, 120, 170), 0.35)
for y in range(bh):
    for x in range(bw):
        dx, dy = x + .5 - MX, y + .5 - MY
        if math.hypot(dx, dy) < MR:
            c = (232, 228, 206)
            if math.hypot(dx - 3, dy - 2) >= MR: c = (206, 202, 186)
            bg[y, x, :3] = c
for cx, cy, r in [(48, 22, 2.2), (53, 27, 1.8), (47, 28, 1.2)]:
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            if math.hypot(x + .5 - cx, y + .5 - cy) < r:
                bg[y, x, :3] = (bg[y, x, :3] * 0.9).astype(np.uint8)
# ferne Hügel
for x in range(bw):
    h1 = HZ - 8 - 5 * math.sin(x / 13.0 + 1.2) - 3 * math.sin(x / 5.3)
    for y in range(int(h1), HZ):
        bg[y, x, :3] = (26, 22, 38)
RM = rock[..., :3].reshape(-1, 3).mean(0)
# Felsboden (Dark-Land-Textur, mondblau abgedunkelt, nach vorne heller)
for y in range(HZ, bh):
    t = (y - HZ) / (bh - HZ)
    for x in range(bw):
        c = rock[(y - HZ) % rock.shape[0], (x + (y // 32) * 13) % rock.shape[1], :3].astype(float)
        c = RM + (c - RM) * 0.8                                  # Körnung beruhigen
        c = c * (0.5 + 0.35 * t) * np.array([0.9, 0.9, 1.1])
        bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
for x in range(bw):
    bg[HZ, x, :3] = (40, 32, 56)
glow(bg, 62.5, 150, 42, (70, 70, 100), 0.3, ry=18)            # Mondlicht auf dem Boden um Ghuanjun
glow(bg, 25, 55, 25, (190, 96, 30), 0.45)                        # Geisterschein Tiger
glow(bg, 93, 43, 34, (150, 140, 90), 0.4)                        # Geisterschein Ochse

# ---------------- Mittelgrund 3× (84×117): Grabkreuze, Schädel, Knochen -----------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
tombD = mul(tomb, (0.66, 0.62, 0.8))


def ground_shadow(arr, cx, cy, rx, ry):
    shadow = rgba(arr.shape[1], arr.shape[0])
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if d < 1 and 0 <= x < arr.shape[1] and 0 <= y < arr.shape[0]:
                shadow[y, x] = (0, 0, 0, 80)
    for y in range(arr.shape[0]):
        for x in range(arr.shape[1]):
            if shadow[y, x, 3] and arr[y, x, 3] == 0:
                arr[y, x] = shadow[y, x]


TB = 84                                                          # Fußlinie der Grabkreuze (3×) → y 252
for tx in (10, mw - 10 - tomb.shape[1]):
    ground_shadow(mg, tx + tomb.shape[1] / 2, TB - 0.5, tomb.shape[1] / 2 + 1, 1.2)
    put(mg, tombD, tx, TB - tomb.shape[0])
ground_shadow(mg, 125 / 3, 318 / 3, 19, 2.2)                    # Bodenschatten Ghuanjun (3×-Raster)
# Schädel und Knochen liegen vorn auf dem Boden (gleiche 3×-Ebene)
put(mg, skull_a, 14, 93)
put(mg, flip(bone_b), 25, 99)
put(mg, flip(skull_b), mw - 14 - skull_b.shape[1], 92)
put(mg, bone_b, mw - 25 - bone_b.shape[1], 98)

# ---------------- Kampfgeister 4× (63×88) ---------------------------------------------------------------------
sw, sh = grid(4)
sp = rgba(sw, sh)
TX, TY = 6, 21                                                   # Tiger (14×13) → x 24..80, y 84..136
OX, OY = 36, 9                                                   # Ochse (21×25) → x 144..228, y 36..136


def aura(arr, s, x0, y0, col, strength, grow=2):
    m = s[..., 3] > 0
    h, w = m.shape
    for y in range(-grow, h + grow):
        for x in range(-grow, w + grow):
            yy, xx = np.mgrid[max(0, y - grow):min(h, y + grow + 1), max(0, x - grow):min(w, x + grow + 1)]
            if yy.size == 0 or not m[yy, xx].any(): continue
            if 0 <= y < h and 0 <= x < w and m[y, x]: continue
            d = min(math.hypot(x - a, y - b) for b, a in zip(yy[m[yy, xx]], xx[m[yy, xx]]))
            q = strength * (1 - (d - 1) / grow)
            X, Y = x0 + x, y0 + y
            if q > 0 and 0 <= X < arr.shape[1] and 0 <= Y < arr.shape[0] and q > BAYER[Y % 4, X % 4] * 0.9:
                arr[Y, X] = list(col) + [255]


put(sp, tiger, TX, TY)
put(sp, mul(ox, (1.3, 1.3, 1.25)), OX, OY)
ghost = sp.copy()
ghost[..., 3] = np.where(sp[..., 3] > 0, 205, 0)                 # halbtransparent, je 4×-Pixel

# ---------------- Vordergrund 6× (42×59): Ghuanjun --------------------------------------------------------------
fw, fh = grid(6)
fg = rgba(fw, fh)
GX, GF = 13, 53                                                  # x 78..174, Füße y 318
put(fg, ghu, GX, GF - ghu.shape[0])

# ---------------- Zusammensetzen -------------------------------------------------------------------------------
st = Stack()
st.add(bg, 2)
st.add(mg, 3)
st.add(ghost, 4)
st.add(fg, 6, ox=-1)
cv = st.canvas()
save(cv, '31_tiger_and_ox.png')
if __name__ == '__main__':
    print(preview('31_tiger_and_ox.png', 'meander', 'lacquer', 'lava', 'jade'))
