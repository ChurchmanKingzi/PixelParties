# -*- coding: utf-8 -*-
"""02 Blast Radius – Gegner „Suicide Bombers“, Held: Bomb Berserker Bartas (Base-Version).
Bartas steht mit verschränkten Armen unbeeindruckt vorn auf dem Lavastein, während hinter ihm eine gewaltige
Explosion aufblüht (Suicide Bombers: die Helden sprengen sich selbst mit in die Luft). Am Horizont glüht ein
Lavaband, eine flache Druckwelle läuft über den Boden, Splitter fliegen; das Gegenlicht wirft seinen Schatten lang
nach vorn.

Quellen (Motive.xcf):
  Ebene 1476 „Bartas“: Base-Bartas (14×25), in Sichtbar #267 (Ebene 129, Kartenbild „Bomb Berserker Bartas“,
      Lage 278,78) zu 100 % pixelgleich sichtbar. (Nicht verwendet: 1474 „Bartas skin“.)
  Ebene 1481 „Explosion“ (69×84), nach Helligkeit in eine Glutpalette umgefärbt.
  Ebene 1477 „Bartas #2“ (Lavastein-Kachel, Splitter), Ebene 1475 „Bartas #6“ (Lavakachel) – beide aus Bartas' Kartenszene.
Selbst gezeichnet: Himmelverlauf, Glutschein, Druckwelle, Schatten (gespiegelte Silhouette, halbtransparent).

Skalierung:
  Himmel, Explosion, Boden, Lavaband, Druckwelle, Splitter – 3× (84×117)
  Bartas und sein Schatten                                – 6× (42×59)
"""
import math, random
from a_util import *  # noqa
import numpy as np

B = 'Motive'
rnd = random.Random(2)

# ---- Quellen -------------------------------------------------------------------------------
bartas = sprite('o02_bartas', B, [1476])                      # Base-Bartas (14×25), = Sichtbar #267
expl = sprite('o02_explosion', B, [1481])                    # „Explosion“ (69×84)
rocks = parts(compose(B, [1477]), dil=1)                     # „Bartas #2“: Lavastein, Splitter, Kristall, Felsen
flames = parts(compose(B, [1475]), dil=1)                    # „Bartas #6“: Lavakachel + zwei Flammenkronen
rock_tile, crystal, boulder = rocks[0], rocks[2], rocks[3]
lava_tile, flame_s, flame_b = flames[0], flames[1], flames[2]

# Explosion in Feuerfarben umfärben (Helligkeit → Glutpalette)
FIRE = [(70, 12, 8), (130, 24, 12), (196, 52, 18), (238, 110, 28), (252, 178, 52), (255, 226, 120), (255, 248, 206)]
ex = expl.copy()
v = ex[..., :3].astype(float).mean(-1)
lo, hi = v[ex[..., 3] > 0].min(), v[ex[..., 3] > 0].max()
for y in range(ex.shape[0]):
    for x in range(ex.shape[1]):
        if ex[y, x, 3]:
            t = (v[y, x] - lo) / (hi - lo)
            ex[y, x, :3] = FIRE[min(6, int(t * 6.99))]

# ---- Ebene 1: Himmel, Explosion, Boden, Felsnadeln (3×, 84×117) ------------------------------
W3, H3 = 84, 117
p3 = rgba(W3, H3)
SKY = [(22, 8, 10), (36, 11, 12), (54, 16, 14), (78, 22, 16), (108, 34, 18)]
HOR = 84                                              # Horizont (3×-Raster)
for y in range(H3):
    for x in range(W3):
        t = min(1, max(0, y / HOR)) * (len(SKY) - 1)
        i = min(len(SKY) - 2, int(t)); f = t - i
        p3[y, x] = list(SKY[i + 1] if f > bayer(x, y) else SKY[i]) + [255]
EX, EY = (W3 - ex.shape[1]) // 2, 6
ECX, ECY = W3 / 2, EY + 44
# weicher Glutschein um die Explosion (2 Stufen, geordnet gedithert)
for y in range(H3):
    for x in range(W3):
        d = math.hypot((x + 0.5 - ECX) / 44.0, (y + 0.5 - ECY) / 50.0)
        if d < 1:
            t = (1 - d) * 2.2
            if t > 0.5 + bayer(x, y) * 0.5: p3[y, x, :3] = mix(p3[y, x, :3], (170, 54, 20), 0.35 if t < 1.5 else 0.55)
put(p3, ex, EX, EY)
# Boden: Lavastein-Plateau (dunkler), am Horizont ein Band glühender Lava
for y in range(HOR, H3):
    for x in range(W3):
        c = rock_tile[(y - HOR) % rock_tile.shape[0], (x + 4) % rock_tile.shape[1]]
        # Kontrast der Kachel halbieren (ruhiger Boden), nach vorn leicht heller vom Explosionslicht
        base = np.array([70, 22, 14])
        c3 = base + (c[:3].astype(int) - base) * 0.5
        f = 0.75 + 0.2 * (1 - (y - HOR) / (H3 - HOR))
        p3[y, x] = list(np.clip(c3 * f, 0, 255).astype(np.uint8)) + [255]
lt = lava_tile
for y in range(HOR - 2, HOR + 3):
    for x in range(W3):
        p3[y, x] = lt[(y - HOR + 8) % lt.shape[0], (x + 5) % lt.shape[1]]
# Druckwelle: flacher, heller Staubring am Horizont (selbst gezeichnet)
for x in range(W3):
    dx = (x + 0.5 - ECX) / 40.0
    if abs(dx) < 1:
        h = int(round(3 * math.sqrt(1 - dx * dx)))
        for k in range(h):
            y = HOR - 1 - k
            col = (255, 214, 120) if k == h - 1 else (240, 150, 60)
            if (x + k) % 2 == 0 or k == 0: p3[y, x, :3] = col
# fliegende Splitter (die kleinen Lavastein-Splitter aus Bartas' Kartenbild)
shard = rocks[1]
for (x, y, r) in [(12, 34, 1), (70, 40, 1), (20, 12, 0), (62, 10, 0), (8, 62, 1), (74, 66, 1)]:
    put(p3, np.rot90(shard, r), x, y)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Bartas (6×, 42×59) --------------------------------------------------------------
W6, H6 = 42, 59
p6 = rgba(W6, H6)
BX = (W6 - bartas.shape[1]) // 2
BY = 50 - bartas.shape[0]
# Gegenlicht: sein Schatten fällt lang nach vorn auf den Boden (gespiegelte Silhouette, halbtransparent)
s6 = rgba(W6, H6)
put(s6, silhouette(bartas[::-1], (16, 4, 4)), BX, BY + bartas.shape[0])
cv.paste(up(s6, 6), -1, 0, alpha=0.6)
put(p6, bartas, BX, BY)
blit(cv, p6, 6, -1, 0)
print(save(cv, '02_blast_radius.png'))
print(preview('02_blast_radius.png', 'industrial', 'iron', 'lava'))
