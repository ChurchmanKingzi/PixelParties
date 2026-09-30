# -*- coding: utf-8 -*-
"""22 Vengeful Vigil – Gegner „Guardians of the Treasure Cave“ (sample-Structure Deck Guardians of the
Treasure Cave), Held/Hauptmotiv: Mao, the Vengeful Guardian (Base-Karte).

Idee (Draufsicht im Spielraster, Ruhemoment/Nachtwache): Mitten im Wächterhof der Guardian Beasts, auf
dem Rasenfeld ihrer Karte (oben die Reihe runder Büsche), schläft Guardian
Beast Zhu (Cover-Karte) genau wie auf seiner Karte. Auf seinem Rücken sitzt Mao, die schwarze Katze mit dem
roten, blutigen Tuch, hellwach und blickt uns an: Sie wacht über den schlafenden Wächter und rächt jeden
Eindringling (Mao lässt die Effekte der gerade beschworenen Guardian Beasts sofort auslösen).
Nacht: der Garten liegt im Dunkeln, nur um die beiden ein fahler Mondschein auf dem Rasen.

Quellen (MotiveGuardianBeasts.xcf):
  Ebene 35 „Mao“ = Base-Karte (schwarze Katze; 100 % in Kartenszene Ebene 2 „Sichtbar #37“, Lage 114,115).
           NICHT Ebene 34 „Mao-Kopie“ (graue Variante einer anderen Szene).
  Ebene 56 „Zhu #1“ (schlafender Zhu, 100 % in Kartenszene Ebene 4 „Sichtbar #36“ = Guardian Beast Zhu).
  Ebene 37 „Ebene #41“ (Wächterhof: mittleres Rasenfeld mit Büschen – genau der Rasen der Mao-Karte;
           Ausschnitt x 128–178, y 93–163, ohne den FPS-Schriftzug).
Selbst gezeichnet: Nachtabdunkelung mit Mondschein (gedithert), Schatten unter Zhu.
Skalierung: alles 5× (Raster 50×70) – Garten, Zhu und Mao stehen wie im Spiel im selben Maßstab
            (Mao 27×25 → 135×125, Zhu 45×16 → 225×80).
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

BG = 'MotiveGuardianBeasts'

mao = crop_alpha(layer(BG, 35))
mao = part_at(mao, mao.shape[1] // 2 + 3, mao.shape[0] // 2, dil=1)   # ohne den losen Blutstrich links (gehört zur Blutlache der Karte)
zhu = crop_alpha(layer(BG, 56))
Image.fromarray(mao).save(os.path.join(xcfkit.CACHE, 'o22_mao.png'))
Image.fromarray(zhu).save(os.path.join(xcfkit.CACHE, 'o22_zhu.png'))

GW, GH = grid(5)            # 50×70
X0, Y0 = 128, 93             # Mitte des Hofes: Rasenfeld, oben die Reihe runder Büsche
g = layer(BG, 37)[Y0:Y0 + GH, X0:X0 + GW].copy()
g[..., 3] = 255

# Zhu: mittig, etwas unter der Bildmitte; Mao sitzt auf seinem Rücken
zw, zh = zhu.shape[1], zhu.shape[0]
zx, zy = 25 - zw // 2, 42
mw, mh = mao.shape[1], mao.shape[0]
mx, my = 25 - mw // 2 + 1, zy + 7 - mh           # Maos Pfoten auf Zhus Rücken

# Nacht mit Mondschein um die Gruppe
LX, LY = 25, 40
for y in range(GH):
    for x in range(GW):
        d = math.hypot((x + .5 - LX) / 30, (y + .5 - LY) / 36)
        t = max(0.0, 1 - d)
        f = 0.28 + 0.66 * dith(t ** 0.8, x, y, 4)
        c = g[y, x, :3].astype(float)
        g[y, x, :3] = (c * f + np.array([10, 12, 34]) * (1 - f)).clip(0, 255).astype(np.uint8)
# Schatten unter Zhu (weich, 2 Stufen)
for y in range(GH):
    for x in range(GW):
        d = ((x + .5 - 25) / 23.5) ** 2 + ((y + .5 - (zy + zh - 1)) / 3.2) ** 2
        if d < 1 and bay(x, y) < (0.8 if d < 0.6 else 0.45):
            g[y, x, :3] = (g[y, x, :3] * 0.5).astype(np.uint8)
put(g, zhu, zx, zy)
put(g, mao, mx, my)

cv = Canvas(W, H)
blit(cv, g, 5)
print(save(cv, '22_vengeful_vigil.png'))
