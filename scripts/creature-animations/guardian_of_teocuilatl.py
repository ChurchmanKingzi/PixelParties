# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian of Teocuilatl“ (Creature) — der Krieger mit den blauen Stachelhaaren hinter dem großen roten Schild, in der goldenen Faust die steinerne Keule.

Quelle: src/guardian-of-teocuilatl.png (28×31 px, 57 Farben).
PICK: [["MotiveSteamDwarfs", 183, 1]] (Ebene „Guardian of Teocuilatl“, komplett; 4 Pixel mit Alpha 253 deckend gemacht). Nachbarebene 182 („Ebene #190“) = zwei große Glitzersterne der
      Kartenkunst (Effekt-Ebene) — nicht übernommen, aber Anlass für das kurze Aufblitzen am Gold. Abgleich mit Guardian_of_Teocuilatl.png: stimmt.

Was im Sprite ist (x, y im 28×31-Sprite):
* KEULE (x 0–5, y 0–24): grauer Steinkopf (y 0–14), brauner Griff (x 1–4, y 15–21), grauer Knauf (y 22–24). Stein/Holz → kein Glanz. Sie wird frei in der Faust gehalten (Knauf 5 px über dem Boden).
* GOLDENE FAUST/ARMSCHUTZ (x 5–9, y 14–19), gold-orange.
* HAARE (y 4–10) schwarz-blau; GESICHT (y 9–13): Iris (11,11)/(16,11) hellblau, Augenweiß (11,12)/(16,12), goldene Bemalung (12,12)/(15,12).
* OBERKÖRPER (x 8–15, y 14–19), GRAS-ROCK (x 7–13, y 20–26), linker Fuß (x 8–12, y 27–29), vom rechten Bein nur Reste (14,27)/(14–15,28) neben dem Schild.
* SCHILD (x 13–27, y 12–30): rot (193,32,37)/(121,26,20) mit dunklem Rand (56,0,0), Mittelsteg (x 20), goldenem Querband (y 15–20; (172,123,30)/(202,163,88)) und blaugrauen Steinen (y 16–18).
  Seine Unterkante (y 30) liegt 1 px unter den Füßen → der Schild steht auf dem Boden und bleibt völlig still (Regel 44).
Gold: Faust und Schildband → dort je ein kurzes Aufblitzen. Kein Feuer, keine Partikel.

Ablauf (48 Frames à 75 ms = 3,6 s, nahtlos); Idee: Wächter hinter dem Schild — er atmet schwer und wiegt die Keule in der Faust.
* Atmen (Periode 24): Rockzeile 24 wird einmal texturiert eingefügt (TX; nur Körperebene) — Kopf und Oberkörper heben sich 1 px HINTER dem stehenden Schild (Frames 4–15, 28–39).
* Keule wiegen: Keule + goldene Faust (starre Einheit) gehen mit dem Atemzug 1 px hoch und zucken dabei zweimal 1 px weiter (Frames 8–10 und 13–15 jedes Atemzugs).
* Blinzeln (Frames 20–22, 44–46): Iris und Augenweiß nehmen die Hautfarbe an.
* Aufblitzen: am goldenen Schildband (Frames 18–21) und an der goldenen Faust (Frames 42–45): Mitte → kleines Kreuz → weg.
Frame 0 = Original. Kopf bewegt sich nur senkrecht.
Ergänzungen (Körperebene, im Original verdeckt):
* hinter der Schildkante, sichtbar wenn der Körper 1 px steigt: (17,13) und (18,12) Umriss (49,24,0) (Wangen-/Kinnlinie), (16,14), (15,15), (14,16), (13,17) Haut (180,123,49) (Schulter/Brust).
* unter der goldenen Faust, sichtbar wenn sie 1 px höher steht als der Körper: (9,14) Umriss (49,24,0), (8,15) Hautschatten (164,98,41).
"""
import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n5 as G
import anim_textur as TX
TX.umleiten()

N, MS = 48, 75
F = G.Figur('guardian-of-teocuilatl', (2, 2, 4, 2))
spr = F.spr
r, g, b = (spr[..., k].astype(int) for k in range(3))
gold = F.da & (r > 240) & (g > 130) & (g < 235) & (b < 30)
arm = gold & (F.xx <= 9) & (F.yy >= 14) & (F.yy <= 19)
keule = F.da & (F.xx <= 5) & ~arm
KANTE = {12: 18, 13: 17, 14: 16, 15: 15, 16: 14, 26: 14, 27: 15, 28: 16, 29: 17, 30: 18}
schild = np.zeros_like(F.da)
for y in range(12, 31):
    schild[y, KANTE.get(y, 13):] = True
schild &= F.da
rumpf = F.da & ~arm & ~keule & ~schild
HAUT, UMRISS, SCHATTEN = F.f(13, 10), F.f(10, 14), F.f(9, 15)
WEISS, HELLGOLD, BAND = F.f(11, 12), F.f(5, 16), F.f(19, 15)
ATEM = [0] * 4 + [1] * 12 + [0] * 8
ZUCK = [0] * 8 + [1] * 3 + [0] * 2 + [1] * 3 + [0] * 8
TEST_EBENEN = ('koerper',)


def frame(i, nur=None):
    at = ATEM[i % 24]
    ke = at + ZUCK[i % 24]
    k = F.ebene(rumpf)
    F.setze(k, {(17, 13): UMRISS, (18, 12): UMRISS, (16, 14): HAUT, (15, 15): HAUT, (14, 16): HAUT, (13, 17): HAUT, (9, 14): UMRISS, (8, 15): SCHATTEN})
    if i in (20, 21, 22, 44, 45, 46):
        F.setze(k, {(11, 11): HAUT, (11, 12): HAUT, (16, 11): HAUT, (16, 12): HAUT})
    k = F.streck(k, 24, at)
    fig = G.ueber(G.ueber(G.ueber(k, F.ebene(schild)), F.ebene(arm, 0, -ke)), F.ebene(keule, 0, -ke))
    if not nur:
        Hm.stern4(fig, 23, 18, Hm.folge(i, 18, [0, 1, 1, 0], N), WEISS, BAND, off=F.OFF)
        Hm.stern4(fig, 6, 17, Hm.folge(i, 42, [0, 1, 1, 0], N), WEISS, HELLGOLD, off=F.OFF)
    return fig


if __name__ == '__main__':
    G.abschluss(F, 'Guardian of Teocuilatl', [frame(i) for i in range(N)], MS)
