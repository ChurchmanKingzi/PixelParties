# -*- coding: utf-8 -*-
"""23 Infernal Muster – Gegner „Hellfire Battery“ (sample-Structure Deck Hellfire Battery),
Held/Hauptmotiv: Baaliel, the Demon General (Base-Karte).

Idee (Aufmarsch, Tiefenstaffelung): Baaliel steht vorn mit ausgebreiteten Armen und nimmt die Parade ab.
Hinter ihm ist auf dem glühenden Lavafeld sein Heer angetreten – Horned Demons (Cover-Karte) in zwei
Reihen (hinten sieben, vorn vier, die Mitte für ihn frei), nach hinten dunkler im Rauch. Über dem Horizont geht das Höllenfeuer
seiner „Batterie“ nieder: Feuerschweife stürzen aus dem schwarzroten Himmel in die Ferne (Burn-Deck:
Fireball, Explosion, Victory Phoenix Cannon, Laser Volley). Kartentext: Baaliel beschwört Horned Demons
ohne Levelgrenze; jede Niederlage gibt allen Horned Demons einen Demon Counter.

Quellen (Motive.xcf):
  Baaliel:     Ebene 571 „Baaliel“ (20×28, vollständige Figur; Kartenbild „Baaliel, the Demon General“
               zeigt dieselbe Figur vor den Horned Demons, Ebenen 568–572; die Karte ist aus einer vergrößerten
               Szene erzeugt, daher kein pixelgenauer Treffer in einer „Sichtbar“-Ebene – Form und Farben
               visuell geprüft).
  Horned Demon: Ebene 573 „Horned Demon“ (16×29, Cover-Karte).
  Lavafeld:    Ebene 1044 „Hell“ (Basaltboden mit Lavastrom; Ausschnitt x 150–275, y 186–297,
               zum Horizont hin abgedunkelt).
  Feuerschweife: Ebene 577 „Armageddon“ (drei der fallenden Feuerschweife).
Selbst gezeichnet: Himmelsverlauf schwarzrot→Glut (geordnetes Dithering), Horizont-Dunst, Schatten unter
               Baaliel, Abdunkelung der hinteren Reihen.
Skalierung: Himmel, Feuerschweife, Lavafeld, Horned-Demon-Heer – 2×-Raster (125×175);
            Baaliel 20×28 → 100×140 – 5× (einzige Figur im Vordergrund; das Heer steht deutlich dahinter,
            alle Füße des Heers oberhalb seiner Schultern).
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

B = 'Motive'
baal = crop_alpha(layer(B, 571))
demon = crop_alpha(layer(B, 573))
Image.fromarray(baal).save(os.path.join(xcfkit.CACHE, 'o23_baaliel.png'))
Image.fromarray(demon).save(os.path.join(xcfkit.CACHE, 'o23_horned_demon.png'))
streaks = [p for p in parts(layer(B, 577), dil=1, minpx=10) if p.shape[1] == 12]
streaks.sort(key=lambda p: p.shape[0])          # 33, 36, 48, 48 hoch

GW, GH = grid(2)            # 125×175
HOR = 64
bg = rgba(GW, GH)
# Himmel
TOP, MID, GLOW = np.array([12, 4, 8]), np.array([70, 10, 12]), np.array([214, 86, 30])
for y in range(HOR):
    for x in range(GW):
        t = y / HOR
        if t < 0.6:
            q = dith(t / 0.6, x, y, 6); c = TOP * (1 - q) + MID * q
        else:
            q = dith((t - 0.6) / 0.4, x, y, 6); c = MID * (1 - q) + GLOW * q
        bg[y, x, :3] = c; bg[y, x, 3] = 255
# Feuerschweife (fallen hinter dem Horizont nieder)
for (x, y, i) in ((18, 2, 3), (98, 12, 1), (66, HOR - 33 + 2, 0)):
    s = streaks[i]
    put(bg, s, x, y)
# Einschlag am Horizont (Schein hinter dem Heer, gedithert)
IX, IY = 72, HOR
for y in range(HOR - 10, HOR + 2):
    for x in range(IX - 20, IX + 20):
        d = math.hypot((x + .5 - IX) / 20, (y + .5 - IY) / 9)
        if d < 1 and 0 <= x < GW:
            q = dith(1 - d, x, y, 3)
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q * 0.6) + np.array([255, 190, 80]) * q * 0.6).astype(np.uint8)
# Lavafeld
lava = layer(B, 1044)
LX0, LY0 = 150, 186
for y in range(HOR, GH):
    for x in range(GW):
        c = lava[LY0 + (y - HOR), LX0 + x, :3].astype(float)
        if c.max() < 16:                                        # Lücken der Ebene (schwarz) → Basalt
            c = np.array([44, 8, 6], float)
        t = (y - HOR) / (GH - HOR)
        f = 0.3 + 0.55 * dith(min(1.0, t * 1.4), x, y, 4)       # zum Horizont dunkler (Rauch)
        bg[y, x, :3] = (c * f + np.array([40, 6, 6]) * (1 - f)).clip(0, 255).astype(np.uint8)
        bg[y, x, 3] = 255
# Horizontlinie: Glutdunst
for x in range(GW):
    bg[HOR, x, :3] = (150, 50, 24)
    if bay(x, 1) < 0.5: bg[HOR + 1, x, :3] = (110, 30, 18)

# Heer: drei Reihen, keilförmig; hintere Reihen dunkler
AX = 62
ranks = [   # (Fußlinie, x-Mittelpunkte, Helligkeit)
    (82, [AX - 48, AX - 32, AX - 16, AX, AX + 16, AX + 32, AX + 48], 0.6),
    (94, [AX - 40, AX - 24, AX + 24, AX + 40], 0.8),
]
dh, dw = demon.shape[:2]
for foot, xs, br in ranks:
    d = shade(demon, br, (40, 6, 6))
    for cx in xs:
        # kleiner Schatten
        for xx in range(cx - 6, cx + 6):
            if 0 <= xx < GW and bay(xx, foot) < 0.75:
                bg[foot, xx, :3] = (bg[foot, xx, :3] * 0.5).astype(np.uint8)
        put(bg, d, cx - dw // 2, foot - dh + 1)

cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- Baaliel 5×
FG = rgba(50, 70)
bw, bh = baal.shape[1], baal.shape[0]
bx, by = 25 - bw // 2, 66 - bh
for y in range(70):
    for x in range(50):
        d = ((x + .5 - 25) / 9) ** 2 + ((y + .5 - 65.5) / 1.6) ** 2
        if d < 1 and bay(x, y) < 0.7:
            FG[y, x] = (10, 2, 2, 150)
put(FG, baal, bx, by)
cv.paste(up(FG, 5), 0, 0)
print(save(cv, '23_infernal_muster.png'))
