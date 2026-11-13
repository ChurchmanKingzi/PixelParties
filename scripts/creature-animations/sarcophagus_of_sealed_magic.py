# -*- coding: utf-8 -*-
"""Idle-Animation für „Sarcophagus of Sealed Magic“ (Creature) — goldener Pharaonen-Sarkophag mit rot glühenden Augen und aufgerissenem, rot glimmendem Mund.

Quelle: src/sarcophagus-of-sealed-magic.png (17×35 px, 31 Farben; vorbereitet aus MotiveEgypt – in der Kartenkunst ist die Figur violett/rosa überblendet („getönt“), Form und Lage stimmen überein).
PICK: Sarkophag-Ebene aus MotiveEgypt (bereits in src/ abgelegt; die Treffer der Suche waren wegen der Tönung nur Fremdtreffer). Die roten Strahlen, weißen Sterne und der violette Nebel der Kunst
sind Effekte auf eigenen Ebenen und nicht Teil des Sprites.

Was im Sprite ist (x, y):
* KOPFTUCH (Nemes, x 1–15, y 0–11): Gold (240,204,86)/(228,172,68)/(255,246,160) mit dunklen Streifen (42,37,34)/(66,70,71); Stirnband mit zwei grünen Steinen (95,169,118) bei (7,3) und (9,3).
* AUGEN: rot glühend – links (5,6) (252,16,6), (5,7) (255,0,0), innen (6,7) (172,1,0); rechts (9,6) (253,19,8), (9,7) (255,0,0), innen (8,7) (172,2,1). Maske → kein Blinzeln.
* MUND (x 6–8, y 9–12): Verlauf von oben (147,0,0) → (83,0,0) → (23,0,0) → schwarz; darunter der dunkle Schlund/Bart (x 5–8, y 12–15).
* KRAGEN/ARME (y 11–22): gekreuzte Arme, grüne Steine bei (1,11), (14,11), (0,12), (16,12), (0,14), (16,14), (4,13), (12,13), (6,15), (10,15), (8,17). SOCKEL (y 23–34) Gold mit Glanzstreifen.
Der Sarkophag ist ein starrer, schwerer Gegenstand: nie gestreckt, er bewegt sich nur als Ganzes.

Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos, Frame 0 = Original):
* RÜTTELN (Idle-Idee: das Versiegelte will heraus): Frames 30–39 ruckt der ganze Sarkophag starr ±1 px seitlich (rechts, Mitte, links, Mitte, …), davor glühen Augen und Mund auf; danach steigen am Sockel
  zwei kleine Staubwölkchen (2×2, Goldschatten (187,157,87)/(94,66,26)) auf. Er bleibt am Boden.
* AUGEN: vor/während des Rüttelns (Frames 24–40) werden die inneren Augenpixel hellrot (das Glühen bleibt in den Augenpixeln); Frames 52–54 kurzes Abdunkeln.
* MUND glimmt: der Rotverlauf wandert eine Zeile tiefer (heller, Frames 22–40) bzw. höher (dunkler, Frames 46–56).
* GOLDGLANZ (Regel 12/14): ein Lichtband läuft Frames 4–17 diagonal über das Gold; drei kurze Sparkles (Frames 8–11 Stirn, 19–22 Sockel, 46–49 Schulter).
Ergänzungen: keine. Farben: nur Quelle.
"""
import numpy as np

import anim_cool as C
import anim_humanoide as Hm
import anim_lib as L
import anim_n1 as N1

N, MS = 60, 70
spr = L.lade('sarcophagus-of-sealed-magic')
S = N1.Szene(spr, (7, 4, 7, 3))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
GOLD = [(180, 127, 49), (228, 172, 68), (240, 204, 86), (255, 246, 160)]
GOLD_M = C.maske_farben(spr, GOLD)
HELL = (255, 246, 160)
ROT = [(0, 0, 0), (23, 0, 0), (83, 0, 0), (147, 0, 0), (255, 0, 0)]
MUND = {y: [(x, y) for x in (6, 7, 8)] for y in (9, 10, 11, 12)}
assert S.col(6, 9) == ROT[3] and S.col(6, 10) == ROT[2] and S.col(6, 11) == ROT[1] and S.col(6, 12) == ROT[0]
assert S.col(5, 7) == ROT[4] and S.col(9, 7) == ROT[4]
RUETTELN = [1, 1, 0, -1, -1, 0, 1, 0, -1, 0]
STAUB = dict(farbe=(187, 157, 87), rand=(94, 66, 26))
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    k = L.platz(spr, H, W, PL, PT)
    Hm.lichtband(k, GOLD_M, OFF, i, N, 4, 14, GOLD, stufen=1, breite=3.0)
    if 24 <= i <= 40:
        for (x, y) in ((6, 7), (8, 7)):
            k[PT + y, PL + x, :3] = ROT[4]
    if 52 <= i <= 54:
        for (x, y) in ((5, 6), (9, 6), (5, 7), (9, 7)):
            k[PT + y, PL + x, :3] = ROT[3]
    d = 1 if 22 <= i <= 40 else (-1 if 46 <= i <= 56 else 0)
    if d:
        for y, pts in MUND.items():
            st = {9: 3, 10: 2, 11: 1, 12: 0}[y] + d
            for (x, yy_) in pts:
                k[PT + yy_, PL + x, :3] = ROT[max(0, min(3, st))]
    if nur != 'koerper':
        for (x, y, s0) in ((4, 5, 8), (11, 27, 19), (13, 16, 46)):
            N1.funkel(k, PL + x, PT + y, Hm.folge(i, s0, [0, 1, 1, 0], N), HELL, HELL, nur_leer=False)
    dx = N1.huelle(i, N, 30, RUETTELN)
    k = L.versetze(k, dx, 0)
    if nur == 'koerper':
        return k
    st = N1.kleckse(H, W, [dict(s=40, L=8, x0=PL - 1, y0=PT + 32, x1=PL - 3, y1=PT + 29, gross=(1, 1, 1), **STAUB),
                           dict(s=41, L=8, x0=PL + 16, y0=PT + 32, x1=PL + 18, y1=PT + 29, gross=(1, 1, 1), **STAUB)], i, N)
    return L.zusammen(H, W, [(st, 0, 0), (k, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss('sarcophagus-of-sealed-magic', 'Sarcophagus of Sealed Magic', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
