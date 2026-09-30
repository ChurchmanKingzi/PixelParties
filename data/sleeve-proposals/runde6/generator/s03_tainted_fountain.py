# -*- coding: utf-8 -*-
"""03 Tainted Fountain – Gegner „Venom Swamp“, Held: Zsos'Ssar, the Serpent Warlord (Base-Version).
Poisoned Well (Cover): Abends auf dem Dorfplatz von Deri steht Zsos'Ssar groß mit Hellebarde vor dem Brunnenbecken,
dessen Wasser er vergiftet hat – das Becken leuchtet giftviolett (die vergiftete Fassung der Kartenszene), Giftblasen
steigen auf, Dunst zieht über das Wasser, der violette Schein fällt auf Pflaster und Beckenrand. Die Steinstatue in
der Beckenmitte ragt über ihm auf.

Quellen:
  Motive.xcf Ebene 521 „Snecko“ = Base-Zsos'Ssar mit Hellebarde und Blütenkrone (23×35), in Sichtbar #148
      (Ebene 405, Kartenbild „Zsos'Ssar, the Serpent Warlord“, Lage 333,224) zu 100 % pixelgleich.
  MotiveDeri.xcf Ebene 179 „Ebene #40“: Dorfplatz von Deri mit violettem Giftwasser (= Kartenbild „Poisoned Well“,
      Sichtbar #14 Lage 220,203), Ausschnitt x224–308/y229–346. Die eingebackenen Figuren der Szene wurden mit
      Pflaster aus 32/48 px versetzten Zeilen übermalt (Pflaster hat senkrecht Periode 16).
Selbst gezeichnet: Abendfärbung, Giftschein, Giftblasen, Dunstschwaden, Schatten.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Dorfplatz, Brunnen, Statue, Blasen, Dunst, Schein, Schatten – 3× (84×117)
  Zsos'Ssar                                                    – 6× (42×59)
"""
import math, random
from a_util import *  # noqa
import numpy as np

zsos = sprite('o03_zsos', 'Motive', [521])                   # „Snecko“ = Base-Zsos'Ssar (23×35), Sichtbar #148
CX0, CY0 = 202, 175                                          # Bezug der Flickkoordinaten (alter Ausschnitt)
pois_full = compose('MotiveDeri', [179], crop=False)        # „Ebene #40“: Deri mit vergiftetem Brunnen


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


# ---- Ebene 1: Brunnen und Dorfplatz im Abendlicht (3×, 84×117) ---------------------------------
CX1, CY1 = 224, 229                                          # Bildausschnitt 84×117: Brunnen füllt die obere Hälfte
W3, H3 = 84, 117
p3 = depeople(pois_full)[CY1:CY1 + H3, CX1:CX1 + W3].copy()
p3[..., 3] = 255
p3[100:117, 0:22] = p3[84:101, 0:22]                         # Wegweiser links unten durch Pflaster ersetzen
PX0, PY0, PX1, PY1 = 4, 4, 81, 83                            # Becken inkl. Rand im Ausschnitt
c = p3[..., :3].astype(int)
water = (c[..., 2] > 150) & (c[..., 0] > 90) & (c[..., 1] < 140)       # violettes Giftwasser
water[:PY0] = False; water[PY1:] = False
# Abendstimmung: alles kühl abdunkeln, das Giftwasser leuchtet
out = (p3[..., :3] * np.array([0.55, 0.55, 0.72])).astype(np.uint8)
# Wasser: zur Beckenmitte hin heller (leuchtendes Gift), zu den Rändern dunkler
yy, xx = np.mgrid[0:H3, 0:W3]
rad = np.hypot((xx - 42) / 40.0, (yy - 42) / 40.0)
gain = (1.18 - 0.35 * np.clip(rad, 0, 1))[..., None]
wv = np.clip(p3[..., :3].astype(float) * np.array([1.0, 0.9, 1.0]) * gain, 0, 255).astype(np.uint8)
out[water] = wv[water]
p3[..., :3] = out
# violetter Giftschein auf Rand und Pflaster (gedithert, 2 Stufen)
for y in range(H3):
    for x in range(W3):
        if water[y, x]: continue
        dx = max(PX0 - x, 0, x - PX1); dy = max(PY0 - y, 0, y - PY1)
        d = math.hypot(dx, dy * 1.2)
        if PX0 + 3 <= x <= PX1 - 3 and PY0 + 3 <= y <= PY1 - 3: continue   # Statue im Becken bleibt steingrau
        t = max(0.0, 1 - d / 26) if d > 0 else 0.8
        if t > 0 and t * 1.4 > bayer(x, y) + 0.2:
            p3[y, x, :3] = mix(p3[y, x, :3], (150, 80, 200), 0.28 if t < 0.6 else 0.4)
# Giftblasen im Wasser (kleine Ringe mit Glanzpunkt, selbst gezeichnet)
BUB, BUBL = (214, 170, 245), (250, 236, 255)
for (x, y, r) in [(14, 20, 2), (22, 58, 1), (66, 16, 1), (70, 50, 2), (12, 70, 1), (56, 72, 1), (30, 38, 1)]:
    for yy in range(y - r - 1, y + r + 2):
        for xx in range(x - r - 1, x + r + 2):
            dd = math.hypot(xx + 0.5 - x - 0.5, yy + 0.5 - y - 0.5)
            if r - 0.5 <= dd < r + 0.6: p3[yy, xx, :3] = BUB
    p3[y - r + (1 if r > 1 else 0), x - r + (1 if r > 1 else 0), :3] = BUBL
# Giftdunst: flache, halbtransparente Schwaden über dem Wasser (gedithert)
for (cx, cy, rx, ry) in [(18, 30, 12, 2.5), (64, 26, 12, 2.5), (40, 8, 14, 2.5), (60, 64, 9, 2)]:
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(cx - rx, cx + rx + 1):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d < 1 and (1 - d) * 1.4 > bayer(x, y) + 0.25:
                p3[y, x, :3] = mix(p3[y, x, :3], (200, 160, 236), 0.45)
# Bodenschatten für Zsos'Ssar (Füße bei 250er-y 312 → 3×-Reihe 104)
shadow_ellipse(p3, 40.5, 104, 13, 2.2, a=0.5)
cv = Canvas(250, 350)
blit(cv, p3, 3, -1, 0)

# ---- Ebene 2: Zsos'Ssar (6×, 42×59) ---------------------------------------------------------------
W6, H6 = 42, 59
p6 = rgba(W6, H6)
ZX, ZY = 5, 52 - zsos.shape[0]                               # Gesicht = Sprite-Spalten 10–19 (Mitte 15,0) → 250er-x 125
put(p6, zsos, ZX, ZY)
blit(cv, p6, 6, 5, 0)                                         # gemessen: Gesichtsmitte x = 375 (von 750)
print(save(cv, '03_tainted_fountain.png'))
print(preview('03_tainted_fountain.png', 'twist', 'bronze', 'emerald', 'amethyst'))
