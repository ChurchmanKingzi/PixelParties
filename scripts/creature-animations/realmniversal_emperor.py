# -*- coding: utf-8 -*-
"""Idle-Animation für „Realmniversal Emperor“ (Creature) — riesiger grauer Weltraumdrache mit zwei Köpfen, steht schwer da: der rechte Kopf senkt sich
langsam am langen Hals, der eingerollte Schwanz schwingt träge, blauer Geifer tropft.

PICK: [["vom Nutzer gelieferter Sprite", "feedback11/realmniversal-emperor-sprite.png", "138×108, exaktes 2×-Raster → 69×54, Alpha war schon binär"]]
Abgleich mit data/card-art/native/Realmniversal_Emperor.png und der Motiv-Maske (data/subject-masks.json): deckungsgleich. Die Krallen laufen unten spitz
aus (Zeilen 50–53) – als vollständig gewertet, nichts ergänzt.

Identifikation (69×54): Mittlerer Kopf (x 19–40, y 0–20) blickt nach links unten: drei Hörner (y 0–8), zwei schwarze Nasenlöcher (20,10) und (22,10), schräg darüber die lila Augen (23,8) und (26–27,7–8), weiße Zähne
(25,11–12), (23,13–14), (20,14), blaue Zunge/Geifer (x 19–24, y 14–17, bleibt fest). Rechter Kopf am langen Hals (Hals x 44–54, y 5–23 mit lila Unterseite,
Kopf x 54–68, y 4–21) hängt nach unten: Nasenlöcher (60,16) und (61,18), lila Augen (61–62,13–14) und (63–64,17), weiße Zähne (x 56–58, y 15–20), blauer Geiferfaden (x 56–57, y 19–25).
Eingerollter Schwanz links (x 0–18, y 10–33, lila Unterseite) mit blauer Klingenspitze (x 12–21, y 1–12), die hinter dem mittleren Kopf endet; blaue Flossen-
splitter am Schwanz (x 1–2, y 11–15). Lila Bauchschuppen (x 31–43, y 10–36), zwei Beine (y 36–49) mit dunkelblauen Krallen (y 44–53); hellblaue Sporne/Splitter
an den Beinen (x 13–16, y 37–41; x 22–29, y 40–43; x 38–39, y 39–42) und am Ellbogen (x 49–51, y 26–29) – unklar (Sporn/Tropfen), bleiben fest am Körper.

Ablauf (72 Frames à 80 ms = 5,8 s; riesig → langsam). Frame 0 = Original:
* Schwerer Stand (Periode 36): die Beine strecken sich um 1 px (TX.streck_zeile in Zeile 41, dort nur die zwei Beine) – der ganze Leib hebt/senkt sich.
* Rechter Kopf: der Hals senkt sich in zwei Stufen (Spalten ab x 48 um 1 px, ab x 51 um 2 px; Kopf und Geiferfaden starr mit) und hebt sich wieder.
  Nur Senken – beim Heben würde die diagonale Halskontur aufreißen.
* Schwanz: die obere Schlinge schwingt in zwei Stufen nach rechts (Zeilen ≤ 20 um 1 px, Zeilen ≤ 14 um 2 px; an der Stufe wird 1 Innenpixel zum Umriss); die Klingenspitze schiebt sich dabei hinter den
  mittleren Kopf (liegt in der Kunst dahinter).
* Blinzeln: mittlerer Kopf (Frames 5–6, 50–51), rechter Kopf (Frames 28–29) – an den LILA Augenpixeln schräg über den Nasenlöchern (Lila → Hautgrau, dunkler
  Augenkern → dunkles Hautgrau als Lidstrich); die schwarzen Nasenlöcher bleiben fest.
* Geifer: je ein blauer 2×2-Tropfen fällt vom Faden des rechten Kopfes (ab Frame 22 und 58) und vom Maul des mittleren Kopfes (ab Frame 42, landet in der Schwanzschlinge).
Ergänzungen: keine.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n11 as G

N, MS = 72, 80
sz = G.Szene('realmniversal-emperor', (3, 3, 4, 3))
spr = sz.spr
xx, yy = sz.xx, sz.yy
# Schwanz (liegt hinter dem mittleren Kopf): rechte Grenze je Zeile
GRENZE = {1: 22, 2: 22, 3: 22, 4: 22, 5: 22, 6: 22, 7: 22, 8: 20, 9: 19, 10: 18, 11: 18, 12: 17}
SCHWANZ_M = np.zeros_like(sz.da)
for y in range(0, 21):
    SCHWANZ_M[y, :GRENZE.get(y, 14) + 1] = sz.da[y, :GRENZE.get(y, 14) + 1]
SCHWANZ_M[0] = False
HALS_M = sz.da & (xx >= 48) & (yy <= 25)
FEST_M = sz.da & (((xx >= 22) & (xx <= 29) & (yy >= 40) & (yy <= 43) & ~((xx <= 22) & (yy <= 42)) & ~((xx >= 29) & (yy <= 42))))   # Splitter zwischen den Beinen
FEST_M &= sz.ist((119, 129, 159), (89, 102, 139), (76, 89, 127), (78, 91, 127))
SCHWANZ, HALS, FEST = sz.teil(SCHWANZ_M), sz.teil(HALS_M), sz.teil(FEST_M)
RUMPF = sz.teil(sz.da & ~SCHWANZ_M & ~HALS_M & ~FEST_M)
# Augen = die lila Pixel schräg über den Nasenlöchern (Nutzer, Runde 12); die schwarzen Punkte (20,10) (22,10) / (60,16) (61,18) sind Nasenlöcher und bleiben fest
AUGE_M = sz.voll(sz.ist((40, 41, 88), (80, 77, 146)) & (((xx == 23) & (yy == 8)) | ((xx >= 26) & (xx <= 27) & (yy >= 7) & (yy <= 8))))
AUGE_R = sz.voll(sz.ist((40, 41, 88), (80, 77, 146)) & (((xx >= 61) & (xx <= 62) & (yy >= 13) & (yy <= 14)) | ((xx >= 63) & (xx <= 64) & (yy == 17))))
assert AUGE_M.sum() == 4 and AUGE_R.sum() == 5
HAUT = (104, 113, 122)
LID = {(80, 77, 146): HAUT, (40, 41, 88): (76, 83, 89)}          # Lila → Haut, dunkler Augenkern → dunkles Hautgrau (Lidstrich)
BLAU, BLAU2 = (98, 92, 212), (80, 77, 146)
SENK = [0] * 10 + [1] * 6 + [2] * 24 + [1] * 6 + [0] * 26
SCHW = [0] * 30 + [1] * 6 + [2] * 18 + [1] * 8 + [0] * 10
TEST_EBENEN = ('figur',)


def frame(i, nur=None):
    n = G.stufe(i, 36, 6, 16)
    d, s = SENK[i], SCHW[i]
    schwanz = G.zeilen_schub(SCHWANZ, lambda y: 0 if not s else ((1 if y <= sz.PT + 20 else 0) + (1 if (s == 2 and y <= sz.PT + 14) else 0)))
    if s == 2:
        schwanz[sz.PT + 14, sz.PL + 13, :3] = (37, 41, 43)            # Stufe der Schlinge: freigelegtes Innenpixel wird Umriss
    hals = G.spalten_schub(HALS, lambda x: 0 if not d else ((1 if x >= sz.PL + 48 else 0) + (1 if (d == 2 and x >= sz.PL + 51) else 0)))
    rumpf = RUMPF
    if i in (5, 6, 50, 51):
        rumpf = G.farbtausch(rumpf, AUGE_M, LID)
    if i in (28, 29):
        hals = G.farbtausch(hals, np.roll(AUGE_R, d, axis=0), LID)
    f = L.zusammen(sz.H, sz.W, [(schwanz, 0, 0), (hals, 0, 0), (rumpf, 0, 0)])
    f = TX.streck_zeile(f, sz.PT + 41, n)
    f = G.ueber(f, FEST)
    if not nur:
        tr = G.tropfen(sz.H, sz.W, i, [dict(x=sz.PL + 56, y=sz.PT + 27, start=22, dauer=12), dict(x=sz.PL + 56, y=sz.PT + 25, start=58, dauer=12),
                                       dict(x=sz.PL + 17, y=sz.PT + 17, start=42, dauer=6, g=0.1)], BLAU, BLAU2)
        f = G.ueber(f, np.where((f[..., 3:] == 0), tr, 0).astype(np.uint8))     # Tropfen nur vor dem Hintergrund
    return f


if __name__ == '__main__':
    G.fertig('realmniversal-emperor', 'Realmniversal Emperor', frame, N, MS, spr, check=[0, 12, 20, 26, 34, 40, 46, 60], zoom=8)
