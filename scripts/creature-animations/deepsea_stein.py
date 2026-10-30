# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Stein“ (Creature).

Quelle: src/deepsea-stein.png — Ebene „Deepsea Stein“ (17×25 px, 274 Pixel, alle deckend, 15 Farben) aus MotiveDeepsea.xcf (Ebene 362). Gegen die Kartenkunst abgeglichen (data/card-art/native/Deepsea_Stein.png,
76×51; Ebene liegt bei (31, 18)): gleiche Form, Position und Größe; die Karte ist hell überstrahlt (Blitz-Ebene „Ebene #218“, 361, schlägt von oben in den Kopf: eigene Effektebene, nicht Teil der Figur, bleibt
unberührt), die Augen leuchten dort weiß (Korrelation deshalb nur 0,63).
PICK: [["MotiveDeepsea", 362, 1]]

Aufruf:   python3 deepsea_stein.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-stein.png + .json

Was ist was (x/y im Sprite):
* Ein kleines Frankenstein-Monster in Teal-Karo (51,93,119)/(77,137,154) mit schwarzem (0,0,0)/(0,8,24) Umriss: flacher Kopf mit schwarzem Haar und aufgestellten Haarsträhnen (y 0–3), darunter die Stirn (y 4–6) mit drei
  Metallklammern (hellgrau (204,204,204) über (128,128,128) bei x 6, 9, 12, y 4–5), zwei schwarze 2×2-Augen bei (5–6, 7–8) und (9–10, 7–8), Schultern (y 9–12) mit zwei grauen Metallbolzen am Hals
  ((2–5, 10–11) und (12–14, 10–11)), der linke Arm hängt nicht, sondern ist nach links oben angewinkelt (x 0–3, y 7–9), der rechte Arm hängt (x 13–16, y 14–19); Rumpf (y 12–22) mit dunklen Schattenpixeln und
  Gürtel (y 13/19), zwei Beine mit Metallstiefeln (grau (189,189,189)/(156,156,156), x 4–8 und 10–14, y 19–24).
Fest bleiben: Kopfform, Augen-/Klammerform im Ruhebild, Karomuster, Stiefel.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original):
* Atmen: alles oberhalb der Hüfte (Kopf, Arme, Rumpf) hebt sich 1 px (Zeile y 16 wird einmal wiederholt), die Beine bleiben am Boden; Periode 24, zweimal pro Schleife (oben in Frame 7–18 und 31–42).
* Kopf wackelt: der ganze Kopfblock (y 0–6, samt Haarsträhnen und Klammern — nicht verschert) schiebt sich 1 px nach rechts bzw. links (Frame 4–8 rechts, 28–32 links).
* Arme: der linke, angewinkelte Arm hebt/senkt sich ±1 px (Periode 24), der rechte hängende Arm pendelt ±1 px nach außen/zurück (Periode 16).
* Blinzeln (Lid = Haut im Karomuster): die schwarzen Augen werden erst oben, dann ganz zu Haut; zweimal (Frame 12–14 und 36–38).
* Schock: der ganze Körper zuckt kurz seitlich (±1 px, 4 Frames), zweimal pro Schleife (Frame 20–23 und 44–47).
* Metall glänzt (Regel 14: Klammern, Halsbolzen, Stiefel sind Metall): ein Lichtstreifen läuft über die drei Stirnklammern (links → rechts: unteres Pixel hellgrau, dann oberes Pixel weiß (255,255,255), dann
  zurück), Frame 17–22 und 41–46; Weiß (255,255,255) ist Palettenfarbe (data/palette.json), per `erlaubt` deklariert.
* Beine heben abwechselnd 1 px (Füße, y 23–24, je 3 Frames, Periode 16: links Frame 3–5, rechts Frame 11–13).
* Keine Partikel: die Figur ist klein und eng; Funken/Würfel würden wie verlorene Pixel wirken, der Blitz kommt aus der (nicht animierten) Blitz-Ebene der Karte.
Kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle (Lider/Glanz siehe oben).
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 7, 7, 7, 5

spr = L.lade('deepsea-stein')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 8, 24)
SCHWARZ = (0, 0, 0)
TL_, TD_ = (77, 137, 154), (51, 93, 119)
KL_HELL, KL_DUNKEL, WEISS = (204, 204, 204), (128, 128, 128), (255, 255, 255)
haut = lambda x, y: TL_ if (x + y) % 2 == 0 else TD_                   # Schachbrett der Haut
assert KONTUR in UMRISS

AUGEN = [(5, 7), (6, 7), (5, 8), (6, 8), (9, 7), (10, 7), (9, 8), (10, 8)]
assert all(col(x, y) == SCHWARZ for (x, y) in AUGEN)
KLAMMERN = [6, 9, 12]
assert all(col(x, 4) == KL_HELL and col(x, 5) == KL_DUNKEL for x in KLAMMERN)

# Zeitplan (alles 0 bei Frame 0)
BLINZ = {12: 1, 13: 2, 14: 1, 36: 1, 37: 2, 38: 1}                # 1 = obere Zeile zu, 2 = beide Zeilen zu
KOPF = {**{i: 1 for i in range(4, 9)}, **{i: -1 for i in range(28, 33)}}
SCHOCK = {20: 1, 21: -1, 22: 1, 23: -1, 44: 1, 45: -1, 46: 1, 47: -1}
GLANZ = {}                                                         # Frame → (Klammer-Index, Stufe)
for s0 in (17, 41):
    for k in range(3):
        GLANZ[s0 + 2 * k] = (k, 1)                                 # unteres Pixel hell
        GLANZ[s0 + 2 * k + 1] = (k, 2)                             # oberes Pixel weiß, unteres hell
assert max(GLANZ) < N and 0 not in GLANZ

# Teile (Masken im Sprite)
KOPFM = vorhanden & (yy <= 6)
ARM_L = vorhanden & (xx <= 3) & (yy >= 7) & (yy <= 9)
ARM_R = vorhanden & (xx >= 14) & (yy >= 14) & (yy <= 19)
FUSS_L = vorhanden & (xx <= 8) & (yy >= 23)
FUSS_R = vorhanden & (xx >= 10) & (yy >= 23)
rest = vorhanden & ~KOPFM & ~ARM_L & ~ARM_R & ~FUSS_L & ~FUSS_R


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


KOPF_A, ARML_A, ARMR_A, FUSSL_A, FUSSR_A, REST_A = teil(KOPFM), teil(ARM_L), teil(ARM_R), teil(FUSS_L), teil(FUSS_R), teil(rest)


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def frame_gross(i, nur=None):
    kb = REST_A.copy()
    kopf = KOPF_A.copy()
    bl = BLINZ.get(i, 0)
    if bl:
        for (x, y) in AUGEN:
            if bl == 2 or y == 7:
                set_px(kb, x, y, haut(x, y))
    g = GLANZ.get(i)
    if g is not None:
        x = KLAMMERN[g[0]]
        set_px(kopf, x, 5, KL_HELL)
        if g[1] == 2:
            set_px(kopf, x, 4, WEISS)
    dyl = int(round(sinz(i, 24)))
    dxr = max(0, int(round(sinz(i, 16))))                            # rechter Arm: 0 oder 1 px nach außen
    oben = L.zusammen(H, W, [(kb, 0, 0), (ARML_A, 0, dyl), (ARMR_A, dxr, 0), (kopf, KOPF.get(i, 0), 0)])
    if U.stufe(i, 24, 1) == 1:
        oben = L.streck_zeile(oben, GPT + 16, 1)
    bl_ = 1 if (i % 16) in (3, 4, 5) else 0
    br_ = 1 if (i % 16) in (11, 12, 13) else 0
    koerper = L.zusammen(H, W, [(oben, 0, 0), (FUSSL_A, 0, -bl_), (FUSSR_A, 0, -br_)])
    sd = SCHOCK.get(i, 0)
    koerper = L.versetze(koerper, sd, 0) if sd else koerper
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    return koerper


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur (keine Partikel)
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, erlaubt=[WEISS], min_rand=1)
    L.speichern('deepsea-stein', 'Deepsea Stein', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-stein-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
