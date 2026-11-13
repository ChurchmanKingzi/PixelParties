# -*- coding: utf-8 -*-
"""Idle-Animation für „Future Tech Mech“ (Creature).

Quelle: src/future-tech-mech.png — Ebene „Future Tech Mech“ (18×23 px, 266 Pixel, alle deckend, 11 Farben) aus MotiveGN.xcf (Ebene 523). Gegen die Kartenkunst abgeglichen (data/card-art/native/Future_Tech_Mech.png,
76×51; die Ebene liegt bei (29, 16), Korrelation 0,98): gleiche Form, Position und Größe; die Karte ist hell überstrahlt.
PICK: [["MotiveGN", 523, 1]]

Aufruf:   python3 future_tech_mech.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/future-tech-mech.png + .json

Was ist was (x/y im Sprite):
* Ein kleiner grauer Kampfroboter (Metall: Grautöne (23,24,22) … (187,189,186)): gewölbter Helm (x 3–14, y 0–8) mit schwarzem Visier (0,1,0) bei (5–12, 5–7) und einem roten Sensorauge, 2×2 bei (8–9, 6–7)
  (dunkelrot (130,0,0) links, hellrot (190,0,0) rechts); breite Schulterpanzer (y 9–11), Brustpanzer mit hellen Platten (y 11–13), Taille (y 14), die Arme hängen seitlich (Kolben x 1–3 / 14–16, y 10–15, Fäuste
  x 0–4 / 13–17, y 16–19), Becken (x 6–11, y 15–18) und zwei Beine mit Füßen (x 4–8 und 9–14, y 19–22).
Fest bleiben: Helm-/Visierform, Augengröße, Brustpanzer, Becken, Ruhepose.

Ablauf (96 Frames à 70 ms = 6,7 s; Frame 0 = Original) — Runde 3 (Rückmeldung: „Der Kopf soll sich nicht so nach links und rechts bewegen. Das rote Auge darf hin und wieder aufleuchten.“):
* Der Kopf steht jetzt still (kein Block-Versatz) und das Auge wandert nicht mehr im Visier hin und her (der frühere Scannerblick las sich als seitliche Kopfbewegung).
* Auge leuchtet hin und wieder auf (zweimal pro Schleife: Frames 20–29 lang, 66–75 als kurzes Flackern mit zweitem Impuls): Stufe 1 = beide Augenspalten in hellem Quellrot (190,0,0); Stufe 2 = Spitze in Palettenrot (255,26,26)
  (einzige Farbe, die nicht im Sprite steht, aus data/palette.json, in L.pruefe freigegeben) plus zwei Visierpixel (7,6) und (10,7) in dunklem Quellrot (130,0,0) als Glutsaum. Kein Blinzeln (Rückmeldung des Spielgestalters).
* Arme (Runde 4: „Arme synchron“): Fäuste/Kolben (x ≤ 4 bzw. ≥ 13, y ≥ 9) heben und senken sich GLEICHZEITIG ±1 px (Periode 16, sechsmal pro Schleife) — wie Servos.
* Körper (Runde 4: „etwas Animation im Körper“): mechanisches Einfedern — dreimal pro Schleife (Periode 32, Frames 8–19) sackt der Oberkörper samt Kopf und Armen 1 px ein; dafür entfällt die Unterschenkel-Zeile y 20
  (Beine 1 px kürzer, Füße stehen). Der Kopf bewegt sich nur senkrecht mit.
* KEIN Fußheben (Rückmeldung des Spielgestalters): beide Füße bleiben am Boden.
* Metallglanz (Regel 14: der ganze Roboter ist Metall): ein diagonales Lichtband läuft über den Körper (viermal pro Schleife, Start Frame 6, 30, 54 und 78, 14 Frames, zwei Stufen heller auf der Rampe der Grautöne); Umrisspixel am Rand,
  das Visier und das Auge glänzen nicht.
Keine Partikel (Roboter: im Zweifel weglassen). Kein Feuer (Regel 15). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Randfarben der Quelle) in jeder Pose; im Ruhebild nichts. Keine gemalten Pixel außer Farben der Quelle.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand
(anim_lib wirft ClipError). Nur ganze Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 96, 70                                                   # 96 Frames = 6,7 s: das Auge leuchtet nur „hin und wieder“ auf (zweimal pro Schleife, unterschiedlich lang)
GPL, GPR, GPT, GPB = 6, 6, 6, 4

spr = L.lade('future-tech-mech')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (64, 65, 63)
VISIER = (0, 1, 0)
ROT_D, ROT_H = (130, 0, 0), (190, 0, 0)
assert KONTUR in UMRISS

AUGE = [(8, 6), (9, 6), (8, 7), (9, 7)]
assert [col(x, y) for (x, y) in AUGE] == [ROT_D, ROT_H, ROT_D, ROT_H]
VISIER_PX = {(x, y) for y in (6, 7) for x in range(5, 13) if vorhanden[y, x] and col(x, y) == VISIER}
assert len(VISIER_PX) == 10

# Augenleuchten (Rückmeldung: „das rote Auge darf hin und wieder aufleuchten“): Stufe je Frame; 0 = Ruhe (Frame 0 = Original)
# Stufe 1: das ganze Auge in hellem Quellrot (190,0,0); Stufe 2: Spitze des Aufleuchtens in Palettenrot (255,26,26) mit einem Glutsaum aus zwei dunkelroten Visierpixeln.
LEUCHT = {}
for _f, _s in zip(range(20, 30), (1, 2, 2, 2, 2, 2, 1, 1, 1, 0)):               # langes Aufleuchten
    LEUCHT[_f] = _s
for _f, _s in zip(range(66, 76), (1, 2, 1, 0, 1, 2, 2, 2, 1, 0)):               # kurzes Flackern, dann ein zweiter Impuls
    LEUCHT[_f] = _s
ROT_FLASH = (255, 26, 26)                                                       # Palettenfarbe (data/palette.json), im Sprite nicht vorhanden
SAUM = [(7, 6), (10, 7)]                                                       # Visierpixel um das Auge, die bei Stufe 2 dunkelrot mitglühen (Schachbrett, kein ganzer Rahmen)
assert all(col(x, y) == VISIER for (x, y) in SAUM)


# Teile (Masken im Sprite)
ARM_L = vorhanden & (((xx <= 3) & (yy >= 9) & (yy <= 19)) | ((xx == 4) & (yy >= 16) & (yy <= 19)))
ARM_R = vorhanden & (((xx >= 14) & (yy >= 9) & (yy <= 19)) | ((xx == 13) & (yy >= 16) & (yy <= 19)))
BEIN_L = vorhanden & (xx <= 8) & (yy >= 19) & ~ARM_L
BEIN_R = vorhanden & (xx >= 9) & (yy >= 19) & ~ARM_R
KOPF = vorhanden & (yy <= 8)
rest = vorhanden & ~ARM_L & ~ARM_R & ~BEIN_L & ~BEIN_R & ~KOPF
assert not (ARM_L & BEIN_L).any() and not (ARM_R & BEIN_R).any()

# Glanz: Rampe der Grautöne
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x] and col(x, y) not in (ROT_D, ROT_H, VISIER)}, key=lambda c: sum(c))
RAMPE_B = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}
GLANZ_M = vorhanden & ~U.kanten(spr)
for (x, y) in AUGE:
    GLANZ_M[y, x] = False
for y in range(sh):
    for x in range(sw):
        if col(x, y) == VISIER:
            GLANZ_M[y, x] = False

P = lambda x, y: (GPL + x, GPT + y)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def _gross(m):
    g = np.zeros((H, W), bool)
    g[GPT:GPT + sh, GPL:GPL + sw] = m
    return g


def set_px(a, x, y, farbe):
    a[GPT + y, GPL + x, :3] = farbe
    a[GPT + y, GPL + x, 3] = 255


def sinz(i, per, ph=0.0):
    return math.sin(2 * math.pi * i / per + ph)


def frame_gross(i, nur=None):
    ganz = L.platz(spr, H, W, GPL, GPT)
    # Lichtband (Metall) in Quellkoordinaten, bevor die Teile versetzt werden
    for start in (6, 30, 54, 78):
        j = i - start
        if 0 <= j <= 13:
            d = 4 + 3 * j
            for y in range(sh):
                for x in range(sw):
                    if GLANZ_M[y, x] and d <= x + y < d + 4 and col(x, y) in RAMPE_B:
                        ganz[GPT + y, GPL + x, :3] = RAMPE_B[col(x, y)]
    kopf, arml, armr, beinl, beinr, kb = (L.trenne(ganz, _gross(m))[0] for m in (KOPF, ARM_L, ARM_R, BEIN_L, BEIN_R, rest))
    # Auge: bleibt an seinem Platz (der Kopf und der Blick wandern nicht mehr seitlich); es leuchtet hin und wieder auf
    stufe = LEUCHT.get(i, 0)
    if stufe == 1:
        for (x, y) in AUGE:
            set_px(kopf, x, y, ROT_H)
    elif stufe == 2:
        for (x, y) in AUGE:
            set_px(kopf, x, y, ROT_FLASH)
        for (x, y) in SAUM:
            set_px(kopf, x, y, ROT_D)
    # Arme (Servos im Gegentakt)
    # Runde 4 (Rückmeldung: „die Arme sollen sich synchron bewegen, und er soll etwas Animation im Körper haben“): beide Arme heben/senken sich GLEICHZEITIG (±1 px, Periode 16);
    # der Körper federt mechanisch: dreimal pro Schleife (Periode 32, 12 Frames lang) sackt der ganze Oberkörper samt Kopf und Armen 1 px ein — die Beine werden dabei 1 px kürzer
    # (die Unterschenkel-Zeile y 20 entfällt, alles darüber rückt 1 px herunter; Füße y 21–22 stehen). Nichts wird gestreckt/kopiert, der Kopf geht nur senkrecht mit.
    dyl = dyr = int(round(sinz(i, 16)))
    sack = 1 if 8 <= i % 32 <= 19 else 0
    rumpf = L.zusammen(H, W, [(kb, 0, 0), (kopf, 0, 0), (beinl, 0, 0), (beinr, 0, 0)])
    if sack:
        rumpf = L.streck_zeile(rumpf, GPT + 20, -1)
    koerper = L.zusammen(H, W, [(rumpf, 0, 0), (arml, 0, dyl + sack), (armr, 0, dyr + sack)])
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
    L.pruefe(frames, quelle=spr, min_rand=1, erlaubt=[ROT_FLASH])
    L.speichern('future-tech-mech', 'Future Tech Mech', frames, MS, prev)
    if prev:
        L.streifen(prev + '/future-tech-mech-strip.png', [frames[k] for k in (0, 6, 12, 21, 24, 30, 36, 42)], spalten=4, scale=8)
