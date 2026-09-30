# -*- coding: utf-8 -*-
"""03 Tainted Fountain – Gegner „Venom Swamp“, Held: Zsos'Ssar, the Serpent Warlord (Base-Version).
Poisoned Well: Nachts auf dem Dorfplatz von Deri steht Zsos'Ssar mit Hellebarde vor dem Brunnenbecken. Sein
Schlangengewimmel gleitet links über den Beckenrand ins Wasser – von dort aus färbt sich das Becken violett (die
vergiftete Fassung der Karte), hinten rechts ist es noch blau. Giftdunst liegt über dem Wasser, violetter Schein
auf dem Pflaster, der Rest des Platzes versinkt im Dunkel.

Quellen:
  Motive.xcf Ebene 521 „Snecko“ = Base-Zsos'Ssar mit Hellebarde und Blütenkrone (23×35), in Sichtbar #148
      (Ebene 405, Kartenbild „Zsos'Ssar, the Serpent Warlord“, Lage 333,224) zu 100 % pixelgleich.
  Motive.xcf Ebene 515 „Ebene #512“: das Schlangengewimmel derselben Kartenszene (leicht abgedunkelt).
  MotiveDeri.xcf Ebene 178 „Stadt“ (Dorfplatz mit Brunnen) und Ebene 179 „Ebene #40“ (dieselbe Stadt mit violettem
      Giftwasser = Kartenbild „Poisoned Well“, Sichtbar #14 Lage 220,203), Ausschnitt x202–327/y223–398.
      Die eingebackenen Figuren der Szene wurden mit Pflaster aus 32/48 px versetzten Zeilen übermalt
      (Pflaster hat senkrecht Periode 16).
Selbst gezeichnet: Giftgrenze (gedithert), Nachtfärbung, Giftschein, Dunstschwaden, Vignette, Schatten.

Skalierung:
  Dorfplatz, Becken, Schlangen, Dunst, Schein, Schatten – 2× (125×175)
  Zsos'Ssar                                            – 5× (50×70)
"""
import math, random
from a_util import *  # noqa
import numpy as np

rnd = random.Random(3)

# ---- Quellen -------------------------------------------------------------------------------
zsos = sprite('o03_zsos', 'Motive', [521])                   # „Snecko“ = Base-Zsos'Ssar (23×35), Sichtbar #148
swarm = sprite('o03_swarm', 'Motive', [515])                 # Schlangengewimmel seiner Kartenszene (42×43)
CX0, CY0 = 202, 175                                          # Ausschnitt des Dorfplatzes (125×175)
clean_full = compose('MotiveDeri', [178], crop=False)       # „Stadt“ (Dorfplatz von Deri)
pois_full = compose('MotiveDeri', [179], crop=False)        # „Ebene #40“: dieselbe Stadt vergiftet (Poisoned Well)


def depeople(full):
    """Die Figuren der Kartenszene entfernen: Pflaster hat senkrecht eine Periode von 16 px,
    daher werden die Flächen aus 32/48 px darüber/darunter liegendem, freiem Pflaster ergänzt."""
    f = full.copy()
    def cp(r0, r1, c0, c1, dy=0, dx=0):       # Koordinaten relativ zum Ausschnitt
        r0, r1, c0, c1 = r0 + CY0, r1 + CY0, c0 + CX0, c1 + CX0
        f[r0:r1, c0:c1] = f[r0 + dy:r1 + dy, c0 + dx:c1 + dx].copy()
    cp(33, 59, 24, 94, dy=-32)          # Paar auf der Bank + Krug über dem Becken
    cp(78, 108, 4, 25, dy=32)           # Mädchen links
    cp(62, 94, 104, 121, dy=-48)        # Mädchen rechts
    cp(138, 158, 38, 122, dy=32)        # Mann, Krug, Busch-Figur, Eimer unten
    for c0 in range(55, 108, 24):       # Beckenrand unten (von der freien linken Randstrecke)
        w = min(24, 108 - c0)
        cp(128, 138, c0, c0 + w, dx=28 - c0)
    return f


CX1, CY1 = 202, 223                                          # Bildausschnitt (Becken oben im Bild)
clean = depeople(clean_full)[CY1:CY1 + 175, CX1:CX1 + 125].copy()
pois = depeople(pois_full)[CY1:CY1 + 175, CX1:CX1 + 125].copy()

# ---- Ebene 1: Dorfplatz bei Nacht, Becken halb vergiftet, Schlangen (2×, 125×175) ------------
W2, H2 = 125, 175
PX0, PY0, PX1, PY1 = 25, 12, 104, 89                        # Becken (inkl. Rand) im Ausschnitt
SNX, SNY = 14, 50                                             # Schlangengewimmel links vorn am Beckenrand
SRC = (26, 84)                                               # Eintrittsstelle des Gifts
p2 = clean.copy()
# Gift breitet sich von links vorn aus: Wasserpixel innerhalb eines welligen Radius aus der vergifteten Fassung
for y in range(PY0, PY1):
    for x in range(PX0, PX1):
        d = math.hypot(x - SRC[0], (y - SRC[1]) * 1.1)
        edge = 54 + 4 * math.sin(y * 0.35) + 3 * math.sin(x * 0.5 + 1)
        if d < edge - 3 or (d < edge + 3 and (d - edge + 3) / 6 < bayer(x, y)):
            p2[y, x] = pois[y, x]
# Nacht: kühl abdunkeln, nur das Giftwasser leuchtet
water_p = (np.abs(p2[..., :3].astype(int) - pois[..., :3].astype(int)).max(-1) == 0) & \
          (np.abs(clean[..., :3].astype(int) - pois[..., :3].astype(int)).max(-1) > 20)
water_p[:PY0] = False; water_p[PY1:] = False; water_p[:, :PX0] = False; water_p[:, PX1:] = False
NIGHT = np.array([0.48, 0.50, 0.70])
out = (p2[..., :3] * NIGHT).astype(np.uint8)
out[water_p] = np.clip(p2[..., :3][water_p] * np.array([1.12, 0.95, 1.12]), 0, 255).astype(np.uint8)
p2[..., :3] = out
# violetter Giftschein auf dem Pflaster rund ums vergiftete Becken (gedithert)
for y in range(H2):
    for x in range(W2):
        if water_p[y, x] or (PX0 + 3 <= x < PX1 - 3 and PY0 + 3 <= y < PY1 - 4): continue
        d = math.hypot(x - 45, (y - 58) * 1.1)
        t = max(0, 1 - d / 75)
        if t > 0 and t * 1.5 > bayer(x, y) + 0.1:
            p2[y, x, :3] = mix(p2[y, x, :3], (140, 70, 190), 0.3 if t < 0.5 else 0.42)
put(p2, darken(swarm, 0.85), SNX, SNY)
# Giftdunst: flache, halbtransparente Schwaden über dem violetten Wasser (selbst gezeichnet, 2×, gedithert)
for (cx, cy, rx, ry) in [(44, 40, 16, 4), (62, 26, 12, 3), (36, 18, 10, 3), (56, 56, 14, 3)]:
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d < 1 and (1 - d) * 1.4 > bayer(x, y) + 0.2:
                p2[y, x, :3] = mix(p2[y, x, :3], (190, 140, 230), 0.4)
# Nachtvignette: Ränder und Ecken versinken im Dunkel (gedithert in 3 Stufen)
for y in range(H2):
    for x in range(W2):
        d = math.hypot((x + 0.5 - 62) / 70.0, (y + 0.5 - 70) / 105.0)
        t = max(0.0, d - 0.55) / 0.45 * 3
        k = int(t) + (1 if t - int(t) > bayer(x, y) else 0)
        if k > 0: p2[y, x, :3] = (p2[y, x, :3] * (1 - 0.18 * min(k, 3))).astype(np.uint8)
# Bodenschatten für Zsos'Ssar (Füße bei 250er-y 310 → 2×-Reihe 155)
shadow_ellipse(p2, 76, 155.5, 12, 2.4, a=0.5)
cv = Canvas(250, 350)
blit(cv, p2, 2)

# ---- Ebene 2: Zsos'Ssar (5×, 50×70) --------------------------------------------------------------
W5, H5 = 50, 70
p5 = rgba(W5, H5)
ZX, ZY = 21, 62 - zsos.shape[0]
put(p5, zsos, ZX, ZY)
blit(cv, p5, 5, 0, 0)
print(save(cv, '03_tainted_fountain.png'))
print(preview('03_tainted_fountain.png', 'twist', 'bronze', 'emerald', 'amethyst'))
