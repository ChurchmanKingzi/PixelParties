# -*- coding: utf-8 -*-
"""30 Severed Spell – Gegner „Null and Void“ (sample-Structure Deck Null and Void), Held: Null, the Mage Slayer.

Idee (Action im Thronsaal): Null steht groß im geheimen Thronsaal seiner Kartenszene – hinten Thron, Kandelaber und
Ziegelwand, hinter ihm der Steinsims. Ein gewaltiger Feuerzauber schießt von links heran; Null sticht mit seiner
violetten Null-Klinge mitten hinein, der Zauber reißt entzwei, seine Zungen fahren oben und unten an der Klinge
vorbei und zerfallen um die Klinge in violetten Null-Staub (Kartentext: negiert die Effekte getroffener Ziele;
Deck voller Waffen-Angriffe gegen Magier). Der Thron hinter ihm ist leer – der Herr des Saals ist aufgestanden. Violetter Schein hinter Null.

Quellen (MotiveArcanum.xcf, Kartenszene Sichtbar #41 = Ebene 1, Kartenausschnitt Lage 644,206):
  Null (Base-Karte): Ebene 6 „Null-Kopie“ (Rüstung; die Kopie ist die Kartenfassung – Ebene 8 „Null“ weicht an der
  linken Schulter in 47 Pixeln ab) + 5 „Null #1“ (rote Bruststeine) + 7 „Null #2“ (vorgestreckter Arm),
  Effekte seiner Karte: 4 „Null #3“ (violette Klinge, nur x ≥ 632), 3 „Null #5“ (violette Staubpunkte),
  2 „Null #4“ (Feuerzauber). Gruppe x 632–709, y 200–256 in genau der Anordnung der Kartenszene
  (pixelgenau geprüft gegen Sichtbar #41: 0 abweichende Pixel); die gerade Schnittkante des Feuers
  am Kartenrand liegt außerhalb des Bildes.
  Ebene 154 „GEHEIMRAUM“ (Thronsaal) – Ausschnitt x 630–755, y 110–285.
Bearbeitet: Beistelltisch mit Flasche hinter Nulls Kopf entfernt (Boden ergänzt, rechte Thron-Armlehne gespiegelt).
Selbst gezeichnet: violetter Null-Schein hinter Null, Bodenschatten, leichte Vignette.

Skalierung:
  Hintergrund (Thronsaal, Lichtschein)                           – 2× (Raster 125×175)
  Vordergrund (Null mit Klinge, Staub und Feuerzauber 77×56)   – 4× (Raster 63×88)
"""
import numpy as np
from ekit_25_30 import *  # noqa

D = 'MotiveArcanum'
group = compose(D, [2, 3, 4, 5, 6, 7], crop=False)[200:256, 632:712].copy()   # native Kartenanordnung

# ================================================================ 2×: Thronsaal
bw, bh = grid(2)
room = layer(D, 154).copy()
# Beistelltisch mit Flasche und Becher (x 699–718, y 180–206) entfernen: er säße genau hinter Nulls Kopf;
# Tisch/Becher → leerer Boden derselben Spalten unterhalb des Simses; die Flasche verdeckte die rechte Armlehne
# des Throns → rechte Armlehne aus der gespiegelten linken ergänzt (Thron symmetrisch um x 692)
room[190:207, 699:718] = room[248:265, 699:718]
room[180:190, 709:718] = room[248:258, 709:718]
for x in range(699, 710):
    room[168:190, x] = room[168:190, 1384 - x]
bg = room[110:110 + bh, 630:630 + bw].copy()
bg[..., 3] = 255
bg[..., :3] = (bg[..., :3].astype(float) * .82).astype(np.uint8)
# violetter Null-Schein hinter Null
glow(bg, 84, 116, 34, 38, (110, 40, 190), .45)
# Vignette (gestuft, gedithert)
for y in range(bh):
    for x in range(bw):
        d = ((x + .5 - 62.5) / 70) ** 2 + ((y + .5 - 90) / 100) ** 2
        q = min(.55, max(0, d - .55) * 1.2)
        q = np.floor(q * 4 + bay(x, y)) / 4
        if q > 0:
            bg[y, x, :3] = (bg[y, x, :3] * (1 - q) + np.array([4, 4, 12]) * q).astype(np.uint8)

# ================================================================ 4×: Null + Klinge + Feuer
fw, fh = grid(4)                      # 63×88
fg = rgba(fw, fh)
GX = 57 - (709 - 632)                # rechte Kante der Rüstung (x 709) auf Rasterspalte 57 (Canvas 228)
GY = 72 - (246 - 200)                # Füße (y 246) auf Rasterzeile 72 (Canvas 288–291)
# kleiner Bodenschatten unter den Füßen
for x in range(GX + 49, GX + 76):
    if bay(x, GY + 47) < .7:
        setp(fg, x, GY + 47, (6, 4, 14), 170)
put(fg, group, GX, GY)

print(finish([(bg, 2), (fg, 4)], '30_severed_spell.png'))
