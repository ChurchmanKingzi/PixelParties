# -*- coding: utf-8 -*-
"""Idle-Animation für „Wowkyrie, Bringer of Coolness“ (Creature) — Walküre mit goldenem Flügelhelm und blondem Zopf auf einem rosa Einhorn, das einen Regenbogen hinter sich herzieht (fliegt durch die Wolken).

Quelle: src/wowkyrie-bringer-of-coolness.png (45×34 px) = Ruhebild; src/wowkyrie-bringer-of-coolness-schweif.png = nur der Regenbogenschweif (x ≥ 25), ungerastert.
PICK: [["MotiveCoolhalla", 215, 1], ["MotiveCoolhalla", 214, 1]]
  Ebene 215 „Ebene #22“ = Einhorn + Reiterin + Regenbogen (81×30), Ebene 214 „Ebene #23“ = Goldhelm mit Flügel (20×13), nach den Ebenen-Offsets der xcf zusammengesetzt (wie in der Kartenkunst).
  Der Regenbogen läuft in der Quelle 81 px weit bis zum Bildrand; für den Sprite ist er bei x = 44 gekappt und läuft dort in einem Schachbrett-Raster aus (Dithering statt Alpha, Regel 27: Frame auf die Figur zugeschnitten).

Was im Sprite ist (x, y):
* HELM (x 9–17, y 3–9) gold (255,201,50)/(255,227,142) mit Flügel (x 15–28, y 0–8; (152,105,97)/(249,226,212)) – starrer Helmschmuck, bewegt sich nicht eigenständig.
* GESICHT (x 12–15, y 10–13): ein sichtbares Auge – Lidstrich (27,32,36) (13,11), grau (14,11), Iris (51,87,111) (13,12), Weiß (246,255,255) (14,12). Blinzelt (kein Visier).
* RÜSTUNG schwarz mit Gold (x 12–20, y 14–24), ZOPF blond (x 19–25, y 12–20; (255,232,146)/(238,196,112)/(208,162,84)/(173,124,57)/(145,95,36)/(89,50,11)), Stiefel (y 22–24).
* EINHORN rosa (x 2–24, y 11–33): Kopf links, HORN orange-rot (x 0–7, y 9–14) starr; nahe Beine rosa mit magenta Hufen (vorn x 7–10, hinten x 21–24, y 28–33), ferne Beine dunkelbraun (x 12–13 und x 17–19, y 28–32).
* REGENBOGEN (7 Bänder): kurzes Stück vor der Reiterin (x 10–12, y 13–18), hinter ihr schräg abwärts (x 20–24, y 18–23) und dann als Treppe nach rechts oben (x 25–44).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos, Frame 0 = Original):
* GALOPP IN DER LUFT (Idle-Idee): die Beine heben sich paarweise (nahes Vorder- + fernes Hinterbein, dann umgekehrt) starr 1–2 px hinter den Rumpf (kein Stauchen: das Bein verschwindet oben hinter dem Bauch),
  Periode 16; dazu hebt sich die ganze Figur im Takt 1 px (Flieger – Schweben erlaubt).
* REGENBOGEN fließt: die Spalten des Schweifs (x ≥ 25) laufen als Welle (≤ 1–2 px, zum Ende hin stärker, Periode 24); das Ende bleibt gerastert.
* ZOPF weht: das untere Zopfende (y ≥ 17) schwingt ±1 px seitlich (Periode 24, Haar – biegsam).
* BLINZELN: Frames 20–22 (Lid in Hautfarbe (246,189,152), Lidstrich unten).
Kopf/Helm bewegen sich nie seitlich. Ergänzungen: keine neuen Flächen; an der Bauchkante (y 26–28) wird ein rosa Innenpixel, das hinter einem angezogenen Bein zur Außenkante wird, in der Umrissfarbe (162,109,129) gezeichnet. Farben: nur Quelle.
"""
import math

import numpy as np

import anim_cool as C
import anim_lib as L
import anim_n1 as N1

N, MS = 48, 70
SLUG = 'wowkyrie-bringer-of-coolness'
spr = L.lade(SLUG)
S = N1.Szene(spr, (3, 5, 3, 4))
H, W, OFF = S.H, S.W, S.OFF
PL, PT = OFF
xx, yy = S.xx, S.yy
REGEN = L.farbmaske(spr, [(1, 162, 246), (4, 240, 51), (249, 254, 0), (255, 117, 2), (255, 1, 0), (176, 81, 254), (255, 80, 233)])
HAAR = L.farbmaske(spr, [(89, 50, 11), (173, 124, 57), (238, 196, 112), (208, 162, 84), (255, 232, 146), (145, 95, 36), (99, 56, 13)])
SCHWEIF = REGEN & (xx >= 25)
ZOPF = HAAR & (xx >= 21) & (yy >= 17) & (yy <= 20)
BEIN_VN = S.da & (yy >= 28) & (xx <= 10)
DUNKEL = L.farbmaske(spr, [(49, 24, 0)])
BEIN_HN = S.da & (yy >= 28) & (xx >= 19) & ~REGEN & ~DUNKEL
BEIN_VF = S.da & (yy >= 28) & (xx >= 12) & (xx <= 13)
BEIN_HF = DUNKEL & (yy >= 28) & (xx >= 17) & (xx <= 19)
KOERPER = S.da & ~(SCHWEIF | ZOPF | BEIN_VN | BEIN_HN | BEIN_VF | BEIN_HF)
E_K, E_Z, E_VN, E_HN, E_VF, E_HF = (S.ebene(m) for m in (KOERPER, ZOPF, BEIN_VN, BEIN_HN, BEIN_VF, BEIN_HF))
E_S = L.platz(L.lade(SLUG + '-schweif'), H, W, PL, PT)
HAUT, LID = (246, 189, 152), (27, 32, 36)
assert S.col(13, 11) == LID and S.col(15, 11) == HAUT
ROSA = {(250, 239, 249), (250, 153, 204), (255, 254, 255), (243, 219, 229)}
HUB = {2: 1, 3: 2, 4: 2, 5: 2, 6: 1}
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    k = E_K.copy()
    if 20 <= i <= 22:
        for x in (13, 14):
            k[PT + 11, PL + x, :3] = HAUT
            k[PT + 12, PL + x, :3] = LID
    p = i % 16
    a, b = HUB.get(p, 0), HUB.get((p + 8) % 16, 0)
    e = min(1.0, 6 * math.sin(math.pi * i / N) ** 2)
    sw = N1.spalten_dy(E_S, lambda x: int(math.floor(e * (0.3 + 1.3 * (x - PL - 25) / 19.0) * math.sin(L.sinus(i, 24) - (x - PL - 25) / 4.0) + 0.5)))
    ys, xs = np.nonzero(sw[..., 3])
    for y, x in zip(ys, xs):                               # gerastertes Ende (Schachbrett) – bezogen auf die Spritekoordinate, wie im Ruhebild
        if x - PL >= 43 and (x + y - PL - PT) % 2 == 1:
            sw[y, x] = 0
    vz = int(math.floor(math.sin(L.sinus(i, 24)) + 0.5))
    zopf = N1.zeilen_dx(E_Z, lambda y: min(vz, 0) if y - PT <= 17 else vz)
    f = L.zusammen(H, W, [(E_VF, 0, -b), (E_HF, 0, -a), (E_VN, 0, -a), (E_HN, 0, -b), (sw, 0, 0), (k, 0, 0), (zopf, 0, 0)])
    for y in range(PT + 26, PT + 29):                      # Bauchkante: wird hinter einem angezogenen Bein ein rosa Innenpixel zur Außenkante, bekommt es die Umrissfarbe (162,109,129)
        for x in range(PL + 6, PL + 25):
            if f[y, x, 3] and tuple(int(v) for v in f[y, x, :3]) in ROSA and not (f[y + 1, x, 3] and f[y, x - 1, 3] and f[y, x + 1, 3]):
                f[y, x, :3] = (162, 109, 129)
    dy = -1 if p in (3, 4, 5, 6, 7, 11, 12, 13, 14, 15) else 0
    return L.versetze(f, 0, dy)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    C.abschluss(SLUG, 'Wowkyrie, Bringer of Coolness', frames, MS, spr, OFF, C.vorschau_arg(), ecken=False)
