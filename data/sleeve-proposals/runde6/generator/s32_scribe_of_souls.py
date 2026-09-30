# -*- coding: utf-8 -*-
"""32 Scribe of Souls – Gegner „Parts of the Soul“ (sample-Structure Deck Parts of the Soul), Held: Thep, the Court
Scribe (Base).

Idee: Ruhemoment im Grabgemach der Pyramide aus Theps Kartenszene (Ziegelwand, Flechtboden, graue Pharaonen-Büsten,
goldene Krüge). Thep steht groß vorn mit erhobener Feder und aufgeschlagenem Buch; über ihm schweben im Dunkel als
fahle, türkis leuchtende Geister drei Seelenteile – Sekhem (Cover-Karte) oben, Ka und Khet links/rechts. Ihr Schein
ist das einzige Licht im Gemach. Thep holt „Soul Shard“-Kreaturen aus dem Ablagestapel in seine Support-Zonen.

Quellen (MotiveEgypt.xcf):
  Ebene 159 „Thep“ – Base-Thep mit Feder und Buch, pixelgleich mit Szene 87 „Sichtbar #21“ (Kartenbild, Lage 400,371);
             einzige Thep-Ebene.
  Ebene 173 „Ebene #98“ – graue Pharaonen-Büste der Kartenszene (linke Büste, rechts gespiegelt).
  Ebene 181 „Ebene #59“ – goldene Krüge der Kartenszene.
  Ebene 226 „Sekhem“ + 222 (Szene „Sichtbar #4“, Karte Soul Shard Sekhem), 208 „Ka“, 214 „Khet“.
  Szene 87 „Sichtbar #21“ – Ziegel der Rückwand (Kachel 32×16) und Flechtboden (Kachel 16×16) des Grabgemachs.
Selbst gezeichnet: Dunkelheit/Lichtverlauf, Geisterschein, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Ziegelwand, Flechtboden, zwei Büsten    – 2× (125×175)
  Mittelgrund: drei Seelenteil-Geister, goldene Krüge   – 3× (84×117)
  Vordergrund: Thep                                     – 5× (50×70); Thep 115×155 px
"""
import math
import numpy as np
from kit_f import *  # noqa

E = 'MotiveEgypt'

thep = sprite('o32_thep', E, [159])                                    # 23×31
sekhem = sprite('o32_sekhem', E, [226, 222])
ka = sprite('o32_ka', E, [208])
khet = sprite('o32_khet', E, [214])
statue = cached('o32_statue', lambda: parts(layer(E, 173), dil=1)[0])
jars = cached('o32_jars', lambda: layer(E, 181))
jar_parts = parts(jars, dil=1)
jar = jar_parts[0]
wall = cached('o32_wall', lambda: layer(E, 87)[358:374, 484:516].copy())
floor = cached('o32_floor', lambda: layer(E, 87)[412:428, 500:516].copy())

# ---------------- Hintergrund 2× (125×175) -------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
FL = 112                                                         # Wandfuß (2×) → y 224
for y in range(bh):
    for x in range(bw):
        if y < FL:
            c = wall[y % 16, x % 32, :3].astype(float)
            f = 0.16 + 0.34 * (y / FL) ** 1.3
        else:
            c = floor[(y - FL) % 16, (x + 5) % 16, :3].astype(float)
            f = 0.42 + 0.34 * (y - FL) / (bh - FL)
        bg[y, x, :3] = (c * f * np.array([1.0, 0.92, 0.9])).clip(0, 255).astype(np.uint8)
for x in range(bw):                                              # Wandsockel-Fuge
    bg[FL, x, :3] = (bg[FL, x, :3] * 0.55).astype(np.uint8)
# Büsten an der Rückwand, links und gespiegelt rechts, mit Schatten
stD = mul(statue, (0.62, 0.64, 0.72))
SX = 16
shade_ellipse(bg, SX + statue.shape[1] / 2, FL + 3, statue.shape[1] / 2 + 2, 1.8, 0.5)
shade_ellipse(bg, bw - SX - statue.shape[1] / 2, FL + 3, statue.shape[1] / 2 + 2, 1.8, 0.5)
put(bg, stD, SX, FL + 3 - statue.shape[0])
put(bg, flip(stD), bw - SX - statue.shape[1], FL + 3 - statue.shape[0])
# türkiser Geisterschein auf Wand und Boden
TURQ = (70, 190, 190)
glow(bg, 62.5, 34, 30, TURQ, 0.35)
glow(bg, 28, 55, 24, TURQ, 0.28)
glow(bg, 97, 55, 24, TURQ, 0.28)
glow(bg, 62.5, 150, 50, (200, 140, 70), 0.22, ry=22)             # warmer Rest-Schein am Boden
glow(bg, 62.5, 110, 60, TURQ, 0.12, ry=40)

# ---------------- Mittelgrund 3× (84×117): Geister + Krüge ---------------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)


def spirit(s):
    out = s.copy(); m = out[..., 3] > 0
    c = out[m, :3].astype(float)
    lum = c.mean(-1) / 255.0
    pal = np.array([(26, 60, 74), (58, 128, 138), (112, 196, 196), (196, 242, 232)], float)
    t = np.clip(lum * 1.6 + 0.12, 0, 0.999) * 3
    i = t.astype(int); f = (t - i)[:, None]
    g = pal[i] * (1 - f) + pal[np.minimum(i + 1, 3)] * f
    c = g * 0.8 + c * 0.2
    out[m, :3] = c.clip(0, 255).astype(np.uint8)
    return out


ghosts = rgba(mw, mh)
put(ghosts, spirit(sekhem), 42 - sekhem.shape[1] // 2, 11)       # → Mitte x 125, y 33..108
put(ghosts, spirit(ka), 21 - ka.shape[1] // 2, 24)
put(ghosts, spirit(khet), 63 - khet.shape[1] // 2, 24)
ghosts[..., 3] = np.where(ghosts[..., 3] > 0, 128, 0)            # 50 % transparent (Nutzerwunsch)

JF = 108                                                          # Fußlinie der Krüge (3×) → y 324
for jx in (8, mw - 8 - jar.shape[1]):
    for y in range(JF - 2, JF + 2):
        for x in range(jx - 1, jx + jar.shape[1] + 1):
            d = ((x + .5 - jx - jar.shape[1] / 2) / (jar.shape[1] / 2 + 1)) ** 2 + ((y + .5 - JF + 0.5) / 1.6) ** 2
            if d < 1: mg[y, x] = (0, 0, 0, 100)
    put(mg, mul(jar, (0.85, 0.8, 0.72)), jx, JF - jar.shape[0])
# Bodenschatten Thep
for y in range(104, 109):
    for x in range(24, 62):
        d = ((x + .5 - 42) / 19) ** 2 + ((y + .5 - 106.3) / 2.2) ** 2
        if d < 1: mg[y, x] = (0, 0, 0, 110)

# ---------------- Vordergrund 5× (50×70): Thep ----------------------------------------------------------------
fw, fh = grid(5)
fg = rgba(fw, fh)
TF = 64                                                           # Füße y 320
put(fg, thep, 13, TF - thep.shape[0])

st = Stack()
st.add(bg, 2)
st.add(ghosts, 3)
st.add(mg, 3)
st.add(fg, 5, ox=3)
save(st.canvas(), '32_scribe_of_souls.png')
if __name__ == '__main__':
    print(preview('32_scribe_of_souls.png', 'arch', 'gold', 'cyan', 'sapphire'))
