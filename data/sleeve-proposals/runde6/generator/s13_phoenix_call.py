# -*- coding: utf-8 -*-
"""13 „Phoenix Call“ – Gegner „Cute Commando“ (sample-Structure Deck Cute Commando), Held: Cute Annoyance Mini (Base).

Bildidee (Action, asymmetrisch): Mini schwebt groß als Kommandantin am blauen Himmel ihrer Moe-Inselwelt und grinst
den Betrachter an; hinter ihr stürzt auf ihr Kommando die Cute Phoenix (Coverkarte) als senkrechte Feuersäule auf den
Säulenplatz der Relic-Insel – genau wie im Kartenbild „Cute Phoenix“ (Feuersäule über der Säulenruine). Eine
Flügel-Bunny und eine Cute Cat aus ihrem Deck fliegen zum Einschlag. (Andere Idee als „Kitten Escort“: kein Herz,
keine Katzen-Eskorte, sondern der Beschwörungsangriff ihres Decks.)

Quellen (MotiveMoe.xcf):
  Mini            = Ebenen 497 „Mini #2“ + 498 „Mini“ (Base; = Sichtbar #124, Lage 100,259, 0 px Abweichung, vgl. Runde 5)
  Cute Phoenix    = Ebene 420 „Cute Phoenix #1“ (= Sichtbar #94, Karte „Cute Phoenix“, Lage 167,167, 100 % deckungsgleich)
  Relic-Insel     = Ebene 478 „Relic-Insel“ (Säulenplatz derselben Kartenszene), Altar unter der Feuersäule
  Cute Bunny      = Ebene 429 „Cute Bunny #1“ (frontal fliegende Fledermausflügel-Bunny, 36×18)
  Cute Cat        = Ebene 492 „Cute Cat“ (geflügelte Katze, 23×13)
  Himmel          = Ebene 553 „Hintergrund“ (Moe-Himmel mit Schleierwölkchen), Ausschnitt x150–400/y200–550
Selbst gezeichnet: Feuersäule (senkrechte Flammenzungen in 5 Feuerfarben, 1×), warmer Säulenschein auf dem Himmel und
Lichtfleck auf dem Platz (geordnet gedithert). Die weichen Glow-Ebenen 421/422 der Karte (Alpha-Verläufe) bleiben weg.

Skalierung (Ausgabe = 250×350-Raster × 3):
  Himmel, Relic-Insel, Feuersäule, Phoenix, Schein   – 1× (250×350, Originalpixel)
  Cute Bunny, Cute Cat                               – 2× (125×175)
  Mini                                               – 5× (50×70)
"""
import math, random
from c_util import *  # noqa
import numpy as np

B = 'MotiveMoe'
rnd = random.Random(13)

mini = sprite('o13_mini', B, [497, 498])                       # 34×25 Base-Mini
bunnies = parts(compose(B, [429]), dil=1)
bunny = [p for p in bunnies if p.shape == (18, 36, 4)][0]      # frontal fliegender Cute Bunny
cats = parts(compose(B, [492]), dil=1)
cat = [p for p in cats if p.shape[1] == 23][0]                 # frontal fliegende Cute Cat
phoenix = sprite('o13_phoenix', B, [420])                      # 36×32 Cute Phoenix im Sturzflug
relic = sprite('o13_relic', B, [478])                          # 240×240 „Relic-Insel“ (Cute-Phoenix-Karte)
sky = layer(B, 553)[200:550, 150:400].copy()                     # Moe-Himmel mit Schleierwölkchen

# ---------- 1×: Himmel, Relic-Insel, Feuersäule, Phoenix ----------
cv = Canvas(250, 350)
cv.a[:] = sky[..., :3]
PX = 204                     # Achse der Feuersäule
IX, IY = PX - 105, 196       # Relic-Insel so, dass der Altar (x250,y152 in der Ebene) unter der Säule liegt
p1 = rgba(250, 350)
put(p1, relic, IX, IY)
# warmer Schein der Säule auf dem Himmel: zwei geditherte Stufen, nach außen auslaufend
for y in range(350):
    for x in range(250):
        d = abs(x + 0.5 - PX)
        fade = 1.0 if y < 250 else max(0.0, 1 - (y - 250) / 30)
        g = max(0.0, 1 - d / 64) ** 1.5 * fade
        if g <= 0: continue
        c = tuple(int(v) for v in cv.a[y, x])
        lv = int(g * 3 + bayer(x, y))          # 0..3 Stufen, geordnet gedithert
        if lv: cv.a[y, x] = mix(c, (255, 196, 128), (0.0, 0.16, 0.32, 0.48)[min(3, lv)])
FL = [(255, 250, 214), (255, 226, 92), (252, 168, 40), (232, 96, 28), (184, 44, 30)]
colw = [rnd.uniform(-1.5, 1.5) for _ in range(40)]
for y in range(0, 262):
    for x in range(PX - 18, PX + 19):
        d = abs(x + 0.5 - PX)
        w = 14 + colw[(y // 5) % 40] + 1.5 * math.sin(y / 7.0 + x)
        if d > w: continue
        t = d / w
        k = 0 if t < 0.25 else 1 if t < 0.5 else 2 if t < 0.72 else 3 if t < 0.9 else 4
        # senkrechte Flammenzungen: in jeder 3. Spalte eine Stufe dunkler
        if (x % 3 == 0) and k < 4 and ((y + x * 5) // 6) % 2: k += 1
        p1[y, x] = list(FL[k]) + [255]
# Lichtschein auf dem Platz der Relic-Insel (nur auf Inselpixeln, gedithert)
AX, AY = PX, IY + 152 - 82 - 6
for y in range(AY - 26, AY + 26):
    for x in range(PX - 44, PX + 45):
        if not (0 <= y < 350 and 0 <= x < 250) or p1[y, x, 3] == 0: continue
        e = math.hypot((x + 0.5 - AX) / 44, (y + 0.5 - AY) / 24)
        if e < 1 and (1 - e) > bayer(x, y) * 0.9:
            c = tuple(int(v) for v in p1[y, x, :3])
            p1[y, x, :3] = mix(c, (255, 196, 110), 0.38 if e < 0.55 else 0.2)
put(p1, phoenix, PX - 18, AY - 26)
blit(cv, p1, 1)

# ---------- 2×: Kommando ----------
p2 = rgba(125, 175)
# kleines Cute-Kommando (Cute Birds, Bunnies, Cats) im Bogen von links oben zum Einschlag
doves = [p for p in parts(compose(B, [433]), dil=1) if p.shape in ((12, 20, 4), (11, 16, 4))]
lying = [p for p in bunnies if p.shape == (19, 28, 4)][0]     # zweite Cute Bunny (seitlich fliegend)
put(p2, doves[0], 13, 22); put(p2, flip(doves[3]), 27, 12)
put(p2, bunny, 11, 96); put(p2, flip(lying), 16, 120)
put(p2, cat, 42, 110); put(p2, flip(cat), 64, 98)
put(p2, doves[5], 80, 116)
blit(cv, p2, 2)

# ---------- 5×: Mini ----------
p5 = rgba(50, 70)
put(p5, mini, 8, 12)                      # Gesichtsmitte auf x = 125 (750er: 375)
blit(cv, p5, 5)
print(save(cv, '13_phoenix_call.png'))
