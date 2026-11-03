# -*- coding: utf-8 -*-
"""Idle-Animation für „Rook of Kings [B]“ (Creature) — der schwarze Turm: ein zinnengekrönter Turmkörper mit zwei abgespreizten Armen und blauen Augen.

Quelle: src/rook-of-kings-b.png (22×22 px, 10 Farben: Schwarz, Grautöne 26/51/77/102/204/76, blaue Augen (0,107,176)).
PICK: [["Motive", 650, 3]]      (Ebene „Ebene #617“, Figur 3, die schwarze Figur ohne Flammenarm; die Ebenen 645 „Night“ (24×24) und 651 (23×23, Alpha 127) zeigen dieselbe Figur anders (mit Beinen/Schatten) und bleiben ungenutzt.)
Karte (Rook_of_Kings.png): Figur sitzt bei (27,16) zu 90 %. In der Ebene „Chess“ (639) trägt derselbe Turm einen FLAMMENARM (Angriffspose) — er ist NICHT Teil der Karte und bleibt weg.
Quelle vollständig. Weiße Schwester: rook_of_kings_w.py.

Aufruf:   python3 rook_of_kings_b.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rook-of-kings-b.png + .json

Was im Sprite ist (x, y im 22×22-Sprite):
* ZINNEN (y 0–1): fünf Zinnenzähne (x 4–5, 7–8, 10–11, 13–14, 16–17); KOPFBLOCK (x 4–17, y 2–6) mit schwarzen Balken y 2 und 6.
* AUGEN (y 7): zwei blaue Pixel (0,107,176) bei (9,7) und (13,7), links davon ein heller Augapfel (204,204,204) bei (8,7) und (12,7).
* ARME (x 0–5 und 16–21, y 7–12): zwei abgespreizte Ärmel mit Umriss, an der Schulter durch eine schwarze Doppelspalte (x 6–7 / 14–15) vom Rumpf getrennt.
* RUMPF (x 6–15, y 7–14), TAILLE y 15 (schwarz), SOCKEL in zwei Stufen (y 16–19), FÜSSE (y 20–21): vier kleine Füße (x 4–9 und 12–17) mit Sohlen.
Stein/Dunkelstahl: kein Gold, kein Metallglanz im Sprite (Regel 14) → kein Glanz/Glitzer. Keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos) — eigene Zeitfenster gegenüber [W]:
* Heben (Periode 16, drei Atemzüge je Schleife): die texturierte Rumpfzeile 13 wird einmal eingefügt (Texturmischung): Kopfblock und Arme steigen 1 px, Sockel/Füße bleiben.
* Arme wippen: starre Spaltenverschiebung um die Schulter (Spitze bis ±2 px, Gefälle ≤ 1 px je Spalte, nichts wird breiter): links eine Welle je Schleife, rechts zwei Wellen (je ±1 px) — die Arme laufen nicht im Gleichschritt.
* Blinzeln (Frames 4–5, 28–29): Augapfel und blaue Pupille nehmen die Körperfarbe daneben an (Lid = Körperfarbe).
* ROLLEN (Runde 3, Nutzer: „Das Schwarze unten bei den Rooks sind Rollen, sie bitte hin und her rollen lassen“): die vier kleinen Räder unten (Innenpixel (26,26,26)/(76,76,76) in y 20 bei x 5–6, 8–9, 12–13, 15–16; Reifen schwarz) rollen: der GANZE Turm
  (Körper, Arme, Rollen) fährt ein bis zwei Pixel hin und her (Weg round(1,6·sin), Periode 48 Frames, gegenläufig zu [W]: erst nach links); dabei drehen sich die Rollen: die zyklische Folge [dunkel, hell, hell] läuft durch das 2-px-Fenster jeder Rolle ((d,h) → (h,h) → (h,d) → …),
  ein Schritt je Pixel Rollweg (Position 0 = Original). Das frühere Fußtippen entfällt. Nur Quellfarben.
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc

SLUG, KARTE = 'rook-of-kings-b', 'Rook of Kings [B]'
spr = L.lade(SLUG)
import math
A = Sc.Turm(spr, hub_per=16, arm_l=(1, 1.0, 2), arm_r=(2, 1.0, 1), blink=(4, 28), roll_per=48, roll_amp=1.6, roll_ph=math.pi)
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('rook_of_kings_b', KARTE, frames, MS, prev, spr, OFF)
