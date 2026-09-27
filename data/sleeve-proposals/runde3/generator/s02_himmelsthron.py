# -*- coding: utf-8 -*-
"""Sleeve 02 – Der Himmelsthron (Runde 3b: ersetzt „Verbotene Bibliothek“ → Doppelung mit 35 aufgelöst).

Audienz beim Kinderkaiser: Zhigao sitzt auf dem steinernen Drachenthron, darüber hängt der goldene
Bambusschild, rote Vorhänge rahmen die Szene, dahinter die goldenen Drachenpaneele des Palastes,
vorne der Fliesenboden. Anordnung von Thron, Schild und Vorhängen exakt wie auf der Karte
„Bamboo Shield“, Zhigao sitzt wie auf der Karte „Zhigao the Heavenly Emperor“ im Thron.

Skalierung: ALLES einheitlich 5× (Szene im 5×-Raster = 50×70 Zellen gebaut): Paneelwand, Vorhänge,
Schild, Thron, Zhigao, Boden, Lichtschein und Vignette.

Quellen (MotiveChina.xcf): Palace [15] (Thron), Bamboo Shield [16], Bamboo Shield #1 [3] (Vorhänge),
Zhigao #2 [14] (vollständig), Palace #4 [24] (Drachenpaneele), Palace #3 [26] (Bodenfliesen).
Relative Lage Thron/Schild/Vorhang/Zhigao aus den Ebenen-Offsets (Sichtbar #5, Sichtbar #2).
Lichtschein und Vignette: selbst erstellt (weiche Abstufung pro 5×-Rasterzelle, ohne Dither).
"""
from a_util import *  # noqa

B = 'MotiveChina'
cv = Canvas(250, 350)
G = 5
lo = lowres(G)                                    # 50×70 Zellen
W_, H_ = lo.w, lo.h

throne = sprite('a02_throne', B, [15])
shield = sprite('a02_shield', B, [16])
curtain = sprite('a02_curtains', B, [3])
zhigao = sprite('a02_zhigao', B, [14])
panels = compose(B, [24])
tiles = compose(B, [26])
# Offsets relativ zum Thron (Ebenen liegen im gemeinsamen Koordinatensystem der Karten)
tb = bbox(layer(B, 15))
def rel(i):
    b = bbox(layer(B, i)); return b[0] - tb[0], b[1] - tb[1]
off_shield, off_curtain, off_zhigao = rel(16), rel(3), rel(14)
print('offsets', off_shield, off_curtain, off_zhigao, panels.shape, tiles.shape)

TX, TY = (W_ - throne.shape[1]) // 2, 30           # Thron links oben
FLOOR = TY + throne.shape[0] - 4                   # Boden-Oberkante (Thronfüße stehen darauf)

# --- Paneelwand (Palace #4), leicht abgedunkelt ------------------------------------------------------
pw = panels.shape[1]
lo.paste(darken(panels, 0.78), (W_ - pw) // 2, FLOOR - panels.shape[0] + 2)
lo.paste(darken(panels, 0.78), (W_ - pw) // 2, FLOOR - 2 * panels.shape[0] + 2)

# --- Boden (Palace #3), nach vorn etwas dunkler ---------------------------------------------------------
for i in range(2):
    lo.paste(tiles, (W_ - tiles.shape[1]) // 2, FLOOR + i * tiles.shape[0])
for y in range(FLOOR, H_):
    t = (y - FLOOR) / (H_ - FLOOR)
    lo.a[y] = (lo.a[y] * (1 - 0.35 * t)).astype(np.uint8)

# --- warmer Lichtschein hinter dem Thron ------------------------------------------------------------------
# (ungedithert: jede Rasterzelle bekommt eine einheitliche Farbe, weiche Abstufung pro Zelle)
for y in range(H_):
    for x in range(W_):
        d = math.hypot(x + .5 - W_ / 2, (y + .5 - TY - 4) * 0.8) / 26
        if d < 1:
            t = 0.3 * (1 - d)
            lo.a[y, x] = (lo.a[y, x] * (1 - t) + np.array([255, 225, 150]) * t).astype(np.uint8)

# --- Vorhänge, Schild, Thron, Zhigao (Anordnung wie auf den Karten) --------------------------------------
cx0 = TX + off_curtain[0]
lo.paste(curtain, cx0, TY + off_curtain[1])
lo.paste(shield, TX + off_shield[0], TY + off_shield[1])
# Schlagschatten des Throns auf dem Boden
sh = silhouette(throne, (0, 0, 0))
lo.paste(sh[-6:], TX + 1, TY + throne.shape[0] - 6 + 1, alpha=0.45)
lo.paste(throne, TX, TY)
lo.paste(zhigao, TX + off_zhigao[0], TY + off_zhigao[1])

# --- Vignette im Raster -----------------------------------------------------------------------------------
for y in range(H_):
    for x in range(W_):
        d = math.hypot((x + .5 - W_ / 2) / (W_ / 2), (y + .5 - H_ / 2) / (H_ / 2)) / math.sqrt(2)
        t = min(0.6, max(0.0, (d - 0.45) / 0.55) * 0.75)
        lo.a[y, x] = (lo.a[y, x] * (1 - t)).astype(np.uint8)

blow(cv, lo, G)
print(save(cv, '02_himmelsthron.png'))
