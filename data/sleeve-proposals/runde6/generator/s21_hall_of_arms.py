# -*- coding: utf-8 -*-
"""21 Hall of Arms – Gegner „Great Weapon Master“ (sample-Structure Deck Great Weapon Master),
Held/Hauptmotiv (und Cover-Karte): Toras, Master of all Weapons (Base-Karte).

Idee (Porträt in der Waffenhalle, Wand streng symmetrisch): Toras steht mitten in seiner Halle im Schloss
von Blackport, frontal, mit dem Schwert in der Linken und der riesigen weißen Krummklinge in der Rechten –
genau wie auf seiner Karte. Die Wand hinter ihm ist als Trophäenwand geordnet: ganz links und rechts je ein
grünes Banner der Halle, dazwischen (ohne Überschneidung) hängen als Paar die beiden Schilde seines Decks (Shield of Life und
Shield of Death), und über seinem Kopf liegt – wie im Kartenbild – das grüne Schwert quer an der Wand.
Kartentext: +40 Angriff je Artefakt mit anderem Namen → die Halle ist voller verschiedener Waffen.

Quellen:
  MotiveDeepsea.xcf  Ebene 56 „Toras“ (Figur, goldene Parierstange, weiße Krummklinge) + aus Ebene 55
                     „Toras #2“ das nach unten gehaltene Schwert in seiner Linken (Teil x 304–316, y 193–207);
                     geprüft gegen Kartenszene Ebene 54 „Sichtbar #102“ (Lage 280,159).
                     Ebene 57 „Toras #3“: grünes Schwert über dem Kopf (Teil x 303–329, y 169–175, wie auf
                     der Karte, ohne die Axt/Hellebarde rechts daneben).
                     Ebene 263 „Castle“: Ziegelwand (Periode 16), Sockelleiste, violettes Pflaster, grünes
                     Banner (x 290–303, y 140–173) – links original, rechts gespiegelt.
  Motive.xcf         Ebene 427 „Shield of Life“, Ebene 426 „Shield of Death“ (Deck-Artefakte).
Selbst gezeichnet: nichts außer Abdunkelung/Vignette und dem weichen Bodenschatten (Raster 4×).
Skalierung: alles 4× (Raster 63×88) – Toras, Wand, Banner, Schilde, Boden stehen im selben Maßstab
            wie im Spiel (Wand ist Teil derselben Kartenszene).
"""
import math
from common import *  # noqa
from dkit19_24 import *  # noqa

BD, BM = 'MotiveDeepsea', 'Motive'
castle = layer(BD, 263)

# ---------------------------------------------------------------- Toras (Base) aus Ebenen
t56 = layer(BD, 56)
t55 = layer(BD, 55).copy()
m = np.zeros(t55.shape[:2], bool); m[193:207, 304:316] = True
t55[~m] = 0
tor_full = over(t56, t55)
tor_full[..., 3] = np.where(tor_full[..., 3] >= 128, 255, 0)
TB = bbox(tor_full)                               # (304,173,350,212)
toras = tor_full[TB[1]:TB[3], TB[0]:TB[2]].copy()
Image.fromarray(toras).save(os.path.join(xcfkit.CACHE, 'o21_toras.png'))
# Prüfung gegen die Kartenszene
sc = layer(BD, 54)[TB[1]:TB[3], TB[0]:TB[2]]
mm = toras[..., 3] > 0
diff = (np.abs(toras[..., :3].astype(int) - sc[..., :3]).max(-1) > 8) & mm
print('Toras: Abweichungen zur Kartenszene:', int(diff.sum()), 'von', int(mm.sum()))

g57 = layer(BD, 57).copy()
m = np.zeros(g57.shape[:2], bool); m[167:176, 300:325] = True; m[170:176, 325:330] = True
g57[~m] = 0
gsword = crop_alpha(g57)

life = crop_alpha(layer(BM, 427))
death = crop_alpha(layer(BM, 426))

# Banner aus der Burgkarte (farbige Pixel = Banner, graue = Wand)
ban = castle[139:175, 288:306].copy()
c = ban[..., :3].astype(int)
sat = c.max(-1) - c.min(-1)
bm = (sat > 38) | ((c.max(-1) < 70) & (sat > 12))
import cv2
n, lab, st, _ = cv2.connectedComponentsWithStats(bm.astype(np.uint8), connectivity=8)
k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
bm = lab == k
ban[..., 3] = np.where(bm, 255, 0)
ban = fill_holes(ban)
ban = crop_alpha(ban)

# ---------------------------------------------------------------- Halle 4× (63×88)
GW, GH = grid(4)            # 63×88
AX = 31                     # Mittelachse (Raster)
hall = rgba(GW, GH)
WALL_T = castle[141:173, 324:340]      # 16×32 (zwei Perioden Ziegel)
LEDGE = castle[180:190, 324:340]
FLOOR = castle[190:222, 300:332]
WALL_Y1 = 50                # Sockelleiste ab Zeile 50
for y in range(GH):
    for x in range(GW):
        if y < WALL_Y1:
            hall[y, x, :3] = WALL_T[(y + 7) % 32, (x + 7) % 16][:3]
        elif y < WALL_Y1 + 10:
            hall[y, x, :3] = LEDGE[y - WALL_Y1, (x + 7) % 16][:3]
        else:
            hall[y, x, :3] = FLOOR[(y - WALL_Y1 - 10) % 32, (x + 3) % 32][:3]
        hall[y, x, 3] = 255
# Wand etwas dunkler als der Held (ruhiger Hintergrund), gedithert zum Rand hin noch dunkler
for y in range(GH):
    for x in range(GW):
        d = math.hypot((x + .5 - AX - .5) / 40, (y + .5 - 46) / 52)
        f = 0.80 - 0.40 * dith(max(0.0, d - 0.35) / 0.65, x, y, 4)
        hall[y, x, :3] = (hall[y, x, :3].astype(float) * f + np.array([10, 6, 22]) * (1 - f) * 0.6).astype(np.uint8)

# Banner links (original) und rechts (gespiegelt), symmetrisch zur Achse
bw = ban.shape[1]
BY = 7
BX = -2                                   # Banner ganz außen (teils unter dem Rahmen), damit sie die Schilde nicht berühren
put(hall, ban, BX, BY)
put(hall, flip(ban), 2 * AX + 1 - BX - bw, BY)
# Schildpaar über dem Kopf: Life links, Death rechts
SY = 9
put(hall, life, 15, SY)                   # Life x 15–32 und Death x 35–47: Paar mittig, je 2 px Abstand zu den Bannern
put(hall, death, 35, SY + 1)
# grünes Schwert quer über dem Kopf (Lage wie im Kartenbild: 1 px über dem Scheitel)
tw = toras.shape[1]
TX = AX - (318 - TB[0])           # Körpermitte (x≈318) auf die Achse
TY = 80 - toras.shape[0]          # Füße auf Zeile 80
gx = TX + (bbox(g57)[0] - TB[0]); gy = TY + (bbox(g57)[1] - TB[1])
put(hall, gsword, gx, gy)
# weicher Bodenschatten unter Toras
for y in range(GH):
    for x in range(GW):
        d = ((x + .5 - AX) / 13) ** 2 + ((y + .5 - 79) / 2.2) ** 2
        if d < 1 and bay(x, y) < 0.6:
            hall[y, x, :3] = (hall[y, x, :3] * 0.5).astype(np.uint8)
put(hall, toras, TX, TY)

cv = Canvas(W, H)
blit(cv, hall, 4)
print(save(cv, '21_hall_of_arms.png'))
