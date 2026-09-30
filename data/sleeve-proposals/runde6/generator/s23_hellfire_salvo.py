# -*- coding: utf-8 -*-
"""23 Hellfire Salvo – Gegner „Hellfire Battery“ (sample-Structure Deck Hellfire Battery),
Held/Hauptmotiv: Baaliel, the Demon General (Base-Karte).

Idee (Beschuss, Tiefenstaffelung): Baaliel steht groß und mittig vorn auf dunklem Basalt vor einem Lavastrom
und gibt mit ausgebreiteten Armen den Feuerbefehl. Seine Höllenbatterie schießt eine Salve: vier Feuerbälle
(Karte „Fireball“ aus dem Deck) ziehen auf parallelen Bahnen schräg von rechts oben nach links unten – Kopf
voran, Schweif hinterher, die fernen kleiner – auf den fernen Hügel links, an dem die Einschläge glühen.
Horned Demons (Cover-Karte) in zwei Tiefen: zwei nahe als Ehrenwache links/rechts, drei ferne im Glutdunst.

Quellen (Motive.xcf):
  Baaliel:      Ebene 571 „Baaliel“ (20×28, vollständige Figur; das Kartenbild ist aus einer vergrößerten Szene
                erzeugt, daher kein pixelgenauer „Sichtbar“-Treffer – Form/Farben visuell mit der Karte geprüft).
  Horned Demon: Ebene 573 „Horned Demon“ (16×29, Cover-Karte).
  Feuerball:    Ebene 1539 „Fireball“ (nur das Geschoss, 19×11; gespiegelt, um 20° geneigt).
  Boden:        Ebene 1044 „Hell“ (Basalt mit Lavastrom; Ausschnitt x 150–275, y 186–297).
Selbst gezeichnet: Himmelsverlauf (geordnetes Dithering), ferne Hügelsilhouette, Glutschein am Horizont und
                um den Brand, Schatten.
Skalierung (Tiefenebenen):
  Himmel, Hügel, Einschlagglut, 3 ferne Feuerbälle, 3 ferne Horned Demons, Lavaboden – 2×-Raster (125×175)
  1 naher Feuerball, 2 nahe Horned Demons – 3×-Raster (84×117) (deutlich vor/über den 2×-Dingen)
  Baaliel 20×28 → 100×140 – 5× (Vordergrund; keine andere Figur auf seiner Höhe neben ihm)
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

B = 'Motive'
baal = crop_alpha(layer(B, 571))
demon = crop_alpha(layer(B, 573))
fb = [p for p in parts(layer(B, 1539), dil=0, minpx=5) if p.shape[:2] == (11, 19)][0]
Image.fromarray(baal).save(os.path.join(xcfkit.CACHE, 'o23_baaliel.png'))
Image.fromarray(demon).save(os.path.join(xcfkit.CACHE, 'o23_horned_demon.png'))
Image.fromarray(fb).save(os.path.join(xcfkit.CACHE, 'o23_fireball.png'))
shot = rotate(flip(fb), 20)                  # Kopf nach links unten
shot[..., 3] = np.where(shot[..., 3] >= 128, 255, 0)

# ---------------------------------------------------------------- 2×-Ebene (125×175)
GW, GH = grid(2)
HOR = 72
bg = rgba(GW, GH)
TOP, MID, GLOW = np.array([10, 4, 10]), np.array([58, 10, 14]), np.array([190, 70, 28])
for y in range(HOR):
    for x in range(GW):
        t = y / HOR
        if t < 0.55:
            q = dith(t / 0.55, x, y, 6); c = TOP * (1 - q) + MID * q
        else:
            q = dith((t - 0.55) / 0.45, x, y, 6); c = MID * (1 - q) + GLOW * q
        bg[y, x, :3] = c; bg[y, x, 3] = 255
# Lavaboden
lava = layer(B, 1044)
LX0, LY0 = 150, 186
for y in range(HOR, GH):
    for x in range(GW):
        c = lava[LY0 + (y - HOR), LX0 + x, :3].astype(float)
        if c.max() < 16:
            c = np.array([44, 8, 6], float)
        t = (y - HOR) / (GH - HOR)
        f = 0.3 + 0.55 * dith(min(1.0, t * 1.4), x, y, 4)
        bg[y, x, :3] = (c * f + np.array([40, 6, 6]) * (1 - f)).clip(0, 255).astype(np.uint8)
        bg[y, x, 3] = 255
# ferne Hügelsilhouette (links höher), dunkler Basalt mit Glutkante
HILL = (22, 8, 10)
for x in range(GW):
    h = 3 + 2 * math.sin(x * 0.21) + max(0.0, 13 - abs(x - 20) * 0.55)
    top = int(HOR - h)
    for y in range(top, HOR + 1):
        bg[y, x, :3] = HILL
    setp(bg, x, top, (96, 30, 20))
# Einschlagglut auf der Hügelkuppe (Ziel der Salve), gedithert
TX, TY = 20, int(HOR - 16)
for y in range(TY - 26, TY + 6):
    for x in range(TX - 20, TX + 22):
        d = math.hypot((x + .5 - TX) / 20, (y + .5 - (TY - 8)) / 18)
        if d < 1 and 0 <= x < GW and 0 <= y < GH:
            q = dith(1 - d, x, y, 3) * 0.5
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q) + np.array([255, 150, 60]) * q).astype(np.uint8)
# ferne Feuerbälle der Salve, alle auf parallelen Bahnen nach links unten zum Hügel
for (x, y) in ((30, 42), (54, 34), (80, 25)):
    put(bg, shot, x, y)
# drei ferne Horned Demons im Glutdunst (dunkler), verteilt auf der Ebene
fd = shade(demon, 0.7, (40, 6, 6))
for FDX, FDY in ((40, 85), (62, 80), (84, 86)):
    for xx in range(FDX - 7, FDX + 7):
        if 0 <= xx < GW and bay(xx, FDY) < 0.7: bg[FDY, xx, :3] = (bg[FDY, xx, :3] * 0.5).astype(np.uint8)
    put(bg, fd, FDX - demon.shape[1] // 2, FDY - demon.shape[0] + 1)

cv = Canvas(W, H)
blit(cv, bg, 2)

# ---------------------------------------------------------------- 3×-Ebene (84×117)
MW, MH = grid(3)
mid = rgba(MW, MH)
# nahe Feuerbälle oben rechts, parallel zu den fernen
for (x, y) in ((44, 2),):
    put(mid, shot, x, y)
# zwei nahe Horned Demons links und rechts (Ehrenwache), Füße bei Zeile 70 (Leinwand y 210)
for NDX in (13, 71):
    for y in range(MH):
        for x in range(MW):
            d = ((x + .5 - NDX) / 8) ** 2 + ((y + .5 - 69.5) / 1.4) ** 2
            if d < 1 and bay(x, y) < 0.7:
                mid[y, x] = (10, 2, 2, 150)
    put(mid, demon if NDX < 42 else flip(demon), NDX - demon.shape[1] // 2, 70 - demon.shape[0])
cv.paste(up(mid, 3), 0, 0)

# ---------------------------------------------------------------- Baaliel 5×
FG = rgba(50, 70)
bw, bh = baal.shape[1], baal.shape[0]
bx, by = 15, 66 - bh                        # Gesichtsmitte (Spalte 10) auf x = 375 von 750
for y in range(70):
    for x in range(50):
        d = ((x + .5 - 25) / 9) ** 2 + ((y + .5 - 65.5) / 1.6) ** 2
        if d < 1 and bay(x, y) < 0.7:
            FG[y, x] = (10, 2, 2, 150)
put(FG, baal, bx, by)
cv.paste(up(FG, 5), 0, 0)
print(save(cv, '23_hellfire_salvo.png'))
