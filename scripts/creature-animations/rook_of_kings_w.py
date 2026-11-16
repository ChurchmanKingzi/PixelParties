# -*- coding: utf-8 -*-
"""Idle-Animation für „Rook of Kings [W]“ (Creature) — der weiße Turm: zinnengekrönter Turmkörper mit zwei abgespreizten Armen und blauen Augen.

Quelle: src/rook-of-kings-w.png (22×22 px, 9 Farben: Schwarz, Grautöne, zwei blaue Augenpixel).
PICK: [["Motive", 653, 2]]      (Ebene „Ebene #118“, Figur 2 = der weiße Turm, 23×23 px; die zweite Figur dieser Ebene (links, Joker/Dame mit Federhut) gehört nicht zur Karte.)
Auf der Karte (Rook_of_Kings_1.png, Figur bei (27,16), Korrelation 0,98) sind die Grauwerte der Ebenenfigur UM 25 DUNKLER als in der Ebene (Median je Quellfarbe: 255→230, 204→179, 153→128; Streuung ≤ 10, bei 230 nur 7 Pixel):
der Sprite trägt deshalb die Kartenwerte (255→230, 230→204, 204→179, 153→128), Schwarz/Dunkelgrau (26,76) und die Augenblautöne bleiben. Das ist dieselbe „getönt“-Zuordnung wie bei den schwarzen Schwestern, nur mit anderer Stärke.
Quelle vollständig (das Pixelmuster der Figur stimmt mit der schwarzen Schwester überein, nur die Augen sind hier zwei einzelne blaue Pixel statt Augapfel + Pupille). Schwarze Schwester: rook_of_kings_b.py.

Aufruf:   python3 rook_of_kings_w.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rook-of-kings-w.png + .json

Was im Sprite ist (x, y im 22×22-Sprite):
* ZINNEN (y 0–1), KOPFBLOCK (x 4–17, y 2–6); AUGEN (y 7): zwei einzelne blaue Pixel (0,107,176) bei (8,7) und (0,69,113) bei (12,7);
* ARME (x 0–5 und 16–21, y 7–12): abgespreizte Ärmel mit Umriss, durch eine schwarze Doppelspalte (x 6–7 / 14–15) vom Rumpf getrennt; RUMPF (x 6–15, y 7–14), TAILLE y 15, SOCKEL (y 16–19), FÜSSE (y 20–21).
Stein: kein Gold/Metall/Edelstein → kein Glanz (Regel 14). Keine Partikel, kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* Heben (Periode 24, zwei Atemzüge je Schleife): texturierte Rumpfzeile 13 einmal eingefügt: Kopfblock und Arme steigen 1 px, Sockel/Füße bleiben.
* Arme wippen gegenläufig (je eine Welle je Schleife, Spitze ±2 px, starre Spalten mit Gefälle ≤ 1 px, nichts wird breiter).
* Blinzeln (Frames 20–21, 44–45): die zwei blauen Pixel nehmen die Körperfarbe daneben an.
* ROLLEN (Runde 3, Nutzer: „Das Schwarze unten bei den Rooks sind Rollen, sie bitte hin und her rollen lassen“): die vier kleinen Räder unten (Innenpixel (26,26,26)/(76,76,76) in y 20 bei x 5–6, 8–9, 12–13, 15–16; Rand/Reifen schwarz) rollen: der GANZE Turm
  (Körper, Arme, Rollen) fährt ein bis zwei Pixel hin und her (Weg round(1,6·sin), Periode 48 Frames = eine Fahrt hin und zurück je Schleife, erst nach rechts); dabei drehen sich die Rollen: die zyklische Folge [dunkel, hell, hell] läuft durch das
  2-px-Fenster jeder Rolle ((d,h) → (h,h) → (h,d) → …; das helle Stück bleibt immer sichtbar), ein Schritt je Pixel Rollweg (Position 0 = Original). Das frühere Fußtippen entfällt (Rollen kippen nicht). Nur Quellfarben ((26,26,26), (76,76,76)).
Frame 0 = Original (Ruhepose). Ergänzungen: keine.
"""
import sys

import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_schach as Sc

SLUG, KARTE = 'rook-of-kings-w', 'Rook of Kings [W]'
spr = L.lade(SLUG)
import math
A = Sc.Turm(spr, hub_per=24, arm_l=(1, 1.0, 2), arm_r=(1, -1.0, 2), blink=(20, 44), roll_per=48, roll_amp=1.6, roll_ph=0.0)
N, MS, OFF = A.N, A.MS, A.OFF
frame = A.frame

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('rook_of_kings_w', KARTE, frames, MS, prev, spr, OFF)
