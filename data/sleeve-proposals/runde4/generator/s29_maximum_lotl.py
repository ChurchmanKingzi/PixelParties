# -*- coding: utf-8 -*-
"""29 Maximum Lotl – Heldenporträt am Strand: Arnold, der Axolotl-Bodybuilder, spannt vorn groß den Bizeps;
hinter ihm steht seine riesige Sandburg (die Deepsea-Burg, in Sandfarben umgefärbt), dahinter Meer und
tropischer Mittagshimmel.

Quellen:
  MotiveDeepsea.xcf Ebene 125 „Arnold“ – Karte „Arnold, the Maximum Lotl“; gegen „Sichtbar #70“ (Ebene 119)
      geprüft (Treffer 1.0, keine weiteren Teile in der Szene)
  MotiveDeepsea.xcf Ebene 376 „Siphem #2“ – Burg (ohne rote Augen), nach Helligkeit in Sandtöne umgefärbt
  MotiveHawaii.xcf  Ebene 1 „Sichtbar #55“ – Sandkachel 16×16 (Strand, gekachelt)
Selbst gezeichnet: Himmel, Wolken, Meer, Brandungslinie, Schatten.

Skalierung:
  Hintergrund (Himmel, Wolken, Meer, Sandstrand): 2× (125×175-Raster)
  Mittelgrund (Sandburg): 3× (84×117-Raster)
  Vordergrund (Arnold + sein Schatten): 6× (42×59-Raster)
"""
from s26_30_fkit import *  # noqa

D, HW = 'MotiveDeepsea', 'MotiveHawaii'

# ================================ Hintergrund 2× ================================================================
G = Ebene(2)                                    # 125 × 175
gw, gh = G.w, G.h
HOR = 72                                        # Horizont
SHORE = 84                                      # Strandbeginn
vgrad(G, [(84, 150, 222), (104, 170, 232), (130, 192, 238), (164, 214, 240), (196, 230, 242)], 0, HOR)
# Wolken: flache Kumulus-Bänke aus Kreisen, Unterseite leicht grau
def cloud(cx, cy, w):
    for y in range(int(cy - w * 0.5), int(cy + 4)):
        for x in range(int(cx - w), int(cx + w)):
            inside = False
            for (ox, oy, r) in [(-w * .55, 1, w * .35), (-w * .15, -1, w * .45), (w * .3, 0, w * .38), (w * .65, 2, w * .25)]:
                if (x + .5 - cx - ox) ** 2 + (y + .5 - cy - oy) ** 2 < r * r and y < cy + 3: inside = True
            if inside and 0 <= x < gw and 0 <= y < gh:
                G.a[y, x, :3] = (250, 252, 255) if y < cy else (216, 230, 244)
cloud(26, 20, 14)
cloud(100, 34, 11)

# Meer
vgrad(G, [(44, 150, 196), (36, 128, 184), (30, 112, 170), (40, 150, 186)], HOR, SHORE)
G.rect(0, HOR, gw, HOR + 1, (70, 120, 180))
rng = np.random.RandomState(29)
for _ in range(40):
    y = rng.randint(HOR + 2, SHORE - 1); x = rng.randint(0, gw)
    for i in range(rng.randint(2, 5)):
        G.px(x + i, y, (150, 214, 232))
# Sand (Kachel aus der Hawaii-Szene)
sand = layer(HW, 1)[60:76, 500:516]
for y in range(SHORE, gh):
    for x in range(gw):
        G.a[y, x, :3] = sand[(y - SHORE) % 16, x % 16, :3]; G.a[y, x, 3] = 255
# nasser Sand + Brandungslinie
for x in range(gw):
    wob = int(1.5 + 1.5 * math.sin(x * 0.21) + math.sin(x * 0.07 + 2))
    for y in range(SHORE, SHORE + 3 + wob):
        G.a[y, x, :3] = mix(G.a[y, x, :3], (120, 110, 90), 0.35)
    G.a[SHORE + wob, x, :3] = (236, 246, 250) if (x + wob) % 5 else (180, 220, 236)
# Sand zum Vordergrund hin etwas wärmer/dunkler (Tiefe)
darken_region(G, lambda x, y: 0 if y < SHORE + 20 else (y - SHORE - 20) / (gh - SHORE - 20) * 0.25, (150, 100, 60))

cv = Canvas(W, H)
onto(cv, G)

# ================================ Mittelgrund 3×: die Sandburg (mittig hinter Arnold) ==========================
M = Ebene(3)                                    # 84 × 117
castle = sprite('f29_castle376', D, [376])      # 44 × 65
sc = lum_tint(castle, (118, 84, 50), (246, 222, 170))
# Tor bleibt dunkel (Holz)
door = (castle[..., 0] > castle[..., 2]) & (castle[..., 3] > 0)
sc[door, :3] = (86, 56, 34)
CB = 79                                         # Fuß der Burg (Raster 3×)  → 237 px
CX = 42                                         # Mitte → 126 px
M.put(sc, CX, CB - 1, 'b')
# Schatten der Burg nach rechts unten auf dem Sand
for y in range(CB - 1, CB + 2):
    for x in range(CX - 31, CX + 36):
        e = abs(x + .5 - (CX + 2)) / 34
        if e < 1 and (y < CB + 1 or (1 - e) > 0.35 + B4[y % 4, x % 4] * 0.6):
            M.px(x, y, (176, 140, 92))
onto(cv, M)

# ================================ Vordergrund 6×: Arnold ========================================================
F = Ebene(6)                                    # 42 × 59
arn = sprite('f29_arnold', D, [125])            # 24 × 23
AX, AB = 21, 53                                 # Mitte, Fußlinie
# Schlagschatten (Sonne links oben) als flache Ellipse
for y in range(AB - 1, AB + 1):
    for x in range(AX - 12, AX + 16):
        d = abs(x + .5 - (AX + 2)) / 12.5
        if d < 1 and (y == AB - 1 or d < 0.8):
            F.a[y, x, :3] = (168, 128, 80) if d < 0.85 else (190, 150, 96); F.a[y, x, 3] = 255
F.put(arn, AX, AB, 'b')
onto(cv, F)

print(save(cv, '29_maximum_lotl.png'))
