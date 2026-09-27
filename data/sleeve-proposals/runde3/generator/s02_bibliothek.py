# -*- coding: utf-8 -*-
"""Sleeve 02 – Die verbotene Bibliothek.

Der verhüllte Bibliothekar Tushu schwebt zwischen hohen Bücherregalen des Palastes; Schriftrollen
und ein offenes Buch kreisen um ihn, rote Runen glimmen auf dem Fliesenboden. Über den Regalen
der goldene Drachenfries des Palastes.
Quellen (MotiveChina.xcf): Tushu [21] + Tushu #5 [20] (Gesicht), Tushu #1 [22] (Schatten),
Tushu #3 [19] (Schriftrollen, Buch), Tushu #4 [18] (rote Runen/Funken), Ebene #4 [23]
(Bücherregal), Palace #4 [24] (Drachenpaneele), Palace #3 [26] (Bodenfliesen).
Roter Lichtschein: selbst erstellt (gedithert) statt der weichgezeichneten Ebene Tushu #2.
"""
from a_util import *  # noqa

B = 'MotiveChina'
cv = Canvas(250, 350)

tushu = sprite('a02_tushu', B, [21, 20])
shadows = parts(sprite('a02_tushu_shadow', B, [22]), dil=1)
scroll_parts = parts(sprite('a02_scrolls', B, [19]), dil=1)       # Rolle links, Buch, Rolle rechts
scroll_l, book, scroll_r = scroll_parts
runes = sprite('a02_runes', B, [18])
rune_parts = parts(runes, dil=0)
shelf = sprite('a02_shelf', B, [23])
panels = max(parts(compose(B, [24]), dil=0), key=lambda q: q.shape[0] * q.shape[1])   # ohne Einzelziegel
tiles = compose(B, [26])
print(tushu.shape, shelf.shape, panels.shape, tiles.shape, [p.shape for p in scroll_parts])

# --- Hintergrund: Drachenfries oben, Regalwand, Fliesenboden --------------------------------
cv.a[:] = (24, 12, 20)
pan = tint(darken(panels, 0.55), (60, 10, 40), 0.15)
top_row = pan[:40]                       # obere Paneelreihe
for x in range(-30, 250, top_row.shape[1] * 2):
    put(cv, top_row, x, -18, 2)

sh = tint(darken(shelf, 0.5), (50, 10, 60), 0.2)
for row, y in enumerate([60, 156]):
    for x in range(-24 + (row % 2) * 0, 250, 96):
        put(cv, sh, x, y, 2)

# Boden: Fliesenblöcke in 3× (Perspektive: vorne größer)
tl = darken(tiles, 0.55)
FY = 250
cv.rect(0, FY, 250, 350, (30, 14, 10))
for x in range(-10, 250, tl.shape[1] * 3):
    put(cv, tl, x, FY, 3)
for x in range(-40, 250, tl.shape[1] * 4):
    put(cv, darken(tiles, 0.7), x, FY + 70, 4)

# --- Magie --------------------------------------------------------------------------------
glow(cv, 125, 190, 110, (230, 40, 50), 0.45)
glow(cv, 125, 290, 70, (255, 60, 60), 0.35)

# Runen auf dem Boden (die großen Rune-Gruppen) und Funken in der Luft
big_runes = [p for p in rune_parts if p.shape[0] >= 8]
sparks = [p for p in rune_parts if p.shape[0] < 8]
for p, (x, y) in zip(big_runes, [(40, 300), (150, 308), (96, 322), (190, 290)]):
    put(cv, p, x, y, 3)
for p, (x, y) in zip(sparks * 2, [(30, 120), (214, 96), (60, 70), (200, 190), (18, 220), (232, 250),
                                  (100, 50), (170, 40), (40, 180), (222, 140)]):
    put(cv, p, x, y, 2)

# Schatten unter Tushu
sd = up(silhouette(shadows[1], (10, 0, 0)), 5)
cv.paste(sd, 125 - sd.shape[1] // 2, 268, alpha=0.5)

# Tushu groß in der Mitte
put(cv, tushu, 125, 262, 6, anchor='b')

# kreisende Schriftrollen und Buch
put(cv, scroll_l, 14, 150, 4)
put(cv, scroll_r, 160, 118, 4)
glow(cv, 125, 322, 40, (255, 200, 150), 0.3)
put(cv, book, 125, 340, 4, anchor='b', shadow=0.5, sdx=0, sdy=1)

frame(cv, [(12, 4, 8), (90, 30, 110), (200, 160, 90), (12, 4, 8)])
print(save(cv, '02_verbotene_bibliothek.png'))
