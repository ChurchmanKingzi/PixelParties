# -*- coding: utf-8 -*-
"""Idle-Animation für „Dragsparov, the King of Dragons“ (Creature) — dicker, halb weißer, halb schwarzgrauer Drache mit Narrenkappe und Narrenzepter; die Schellen klingeln.

PICK: [["MotiveRussia", 17, "Ebene „Dragsparov“, linke Figur (x 0–25, y 18–49). Die Ebene enthält außerdem eine schwarze Königs-Schachfigur mit Krone und eine weiße
        Schachfigur mit Narrenkappe (vermutlich „Kasperov, the King of Kings“, der laut Kartentext UNTER diese Creature gelegt wird) – beide nicht Teil des Sprites"]]
Für die Karte liegt keine Kartenkunst vor (weder data/card-art/native noch public/cardgen/art) → kein Abgleich möglich; gewählt wurde der Drache (Kartenname „King of Dragons“).

Identifikation (26×32): Narrenkappe (y 0–9): roter Mittelteil, linker Zipfel orange/gelb (x 2–9, y 2–10, hängt bis auf die Wange), rechter Zipfel grün/blau (x 13–19, y 3–11);
goldene Schellen als 2×2-Muster (gelb/weiß): Kappenspitze (16–17, 2–3), linker Zipfel (3–4, 11–12); einzelne gelbe Zipfelenden (4,5) und (19,5).
Drachenkopf von vorn, links weiß, rechts grau (y 9–15), Augen hellblau über weiß bei (9,10–11) und (14,10–11), schwarze Gesichtszeichnung. Bildlinks weißer Arm/Flügelstummel
(x 0–5, y 12–18), dicker Bauch (y 16–31, weiß x 1–11, grau x 12–20), Standlinie y 31. Narrenzepter rechts (x 20–25): Puppenkopf (x 20–24, y 7–11), Kragen mit drei Schellen
((19–20,12–13), (24–25,12–13), (21–23,14–15)), brauner Stab bis zum Boden (x 21–23, y 16–31).

Ablauf (60 Frames à 80 ms = 4,8 s; schwer und gemächlich). Frame 0 = Original:
* Atmen (Periode 30): texturierte Zeile im Bauch bei y 25 (nur Drache, x ≤ 20; TX.streck_zeile) – Kopf, Kappe und Arm heben sich 1 px. Das Zepter steht am Boden.
* Schellen der Kappe hinken nach: beim Heben bleiben die Schelle an der Kappenspitze und die am linken Zipfel 2 Frames zurück, beim Senken schwingen sie 2 Frames nach oben
  (jeweils die ganze 2×2-Schelle als Einheit, 1 px).
* Zepter: zweimal kurz angehoben und wieder aufgesetzt (ganzes Zepter starr 1 px, Frames 26–27, 30–31 und 56–57).
* Kurze Sparkles auf den goldenen Schellen (Kappenspitze Frames 15–18, Zepterschelle Frames 32–35). Blinzeln beider Augen (Frames 12–13, 44–45). Kopf nie seitlich.
Ergänzungen: unter der linken Zepterschelle (19–20, 12–13) liegt der Drachenkörper in Grau (128,128,128) (sichtbar nur, wenn das Zepter angehoben ist);
frei werdende Stellen der Kappenschellen: (16,3) und (17,3) dunkles Kappengrün (33,97,45, Umrissfarbe des Zipfels); (3,11)/(4,11) Zipfelfarben (224,152,8)/(248,189,61); (3,12)/(4,12) Körperweiß (204,204,204)/(230,230,230).
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

SLUG = 'dragsparov-the-king-of-dragons'
N, MS = 60, 80
sz = N9.Szene(SLUG, (3, 3, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
ZEPTER_M = ((xx >= 21) | ((xx >= 19) & (yy >= 12) & (yy <= 13))) & sz.da
ZEPTER = sz.teil(ZEPTER_M)
_k = spr.copy()
_k[ZEPTER_M] = 0
for _x, _y in ((19, 12), (20, 12), (19, 13), (20, 13)):
    _k[_y, _x] = (128, 128, 128, 255)
KOERPER = L.platz(_k, sz.H, sz.W, sz.PL, sz.PT)
SCHELLE = [[(242, 229, 37), (255, 255, 255)], [(213, 143, 21), (242, 229, 37)]]
WEISS = (255, 255, 255)
TEST_EBENEN = ('figur',)


def schelle(r, x, y, rel, fuell):
    """2×2-Schelle bei (x, y) um rel (±1) senkrecht versetzen; fuell = Farben für die beiden frei werdenden Pixel (None = leer)."""
    frei_y = y if rel > 0 else y + 1
    for k in (0, 1):
        if fuell[k] is None:
            r[sz.PT + frei_y, sz.PL + x + k] = 0
        else:
            r[sz.PT + frei_y, sz.PL + x + k] = tuple(fuell[k]) + (255,)
    for dy in (0, 1):
        for dx in (0, 1):
            r[sz.PT + y + rel + dy, sz.PL + x + dx] = tuple(SCHELLE[dy][dx]) + (255,)


def frame(i, nur=None):
    j = i % 30
    n = 1 if 6 <= j < 20 else 0
    rel = 1 if j in (6, 7) else (-1 if j in (20, 21) else 0)
    r = KOERPER.copy()
    px = lambda x, y, c: r.__setitem__((sz.PT + y, sz.PL + x), tuple(c) + (255,))
    if rel > 0:
        schelle(r, 16, 2, 1, (None, None))
        schelle(r, 3, 11, 1, ((224, 152, 8), (248, 189, 61)))
    elif rel < 0:
        schelle(r, 16, 2, -1, ((33, 97, 45), (33, 97, 45)))
        schelle(r, 3, 11, -1, ((204, 204, 204), (230, 230, 230)))
    if i in (12, 13, 44, 45):
        px(9, 10, (204, 204, 204)); px(9, 11, (0, 0, 0)); px(14, 10, (77, 77, 77)); px(14, 11, (0, 0, 0))
    r = TX.streck_zeile(r, sz.PT + 25, n)
    zy = -1 if i in (26, 27, 30, 31, 56, 57) else 0
    f = L.zusammen(sz.H, sz.W, [(r, 0, 0), (ZEPTER, 0, zy)])
    if not nur:
        s1 = N9.funkel_folge(i, N, 15, (1, 2, 2, 1))
        if s1:
            N9.funkel(f, sz.PL + 17, sz.PT + 2 - n, s1, WEISS)
        s2 = N9.funkel_folge(i, N, 32, (1, 2, 2, 1))
        if s2:
            N9.funkel(f, sz.PL + 25, sz.PT + 12, s2, WEISS)
    return f


if __name__ == '__main__':
    N9.fertig(SLUG, 'Dragsparov, the King of Dragons', frame, N, MS, spr, check=[0, 6, 10, 12, 20, 26, 16, 33], zoom=12)
