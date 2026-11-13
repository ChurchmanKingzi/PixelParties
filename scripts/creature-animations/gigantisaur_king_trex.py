# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur King Trex“ (Creature) — riesiger Tyrannosaurus mit Flammenkrone: langsam, schwer; Feuer über anim_feuer3.

PICK: [["MotiveGrailWar", 513, "ganze Ebene „Trex“ (80×59 px, nur Alpha 0/255)"], ["MotiveGrailWar", 512, "Flammenkrone (Ebene #335, 25×27 px, Pixel mit Alpha ≥ 128 deckend gemacht)"]]
Quelle: src/gigantisaur-king-trex.png (80×68 px) — Trex (24 Farben) mit der gemalten Flammenkrone (294 Farbtöne) an ihrer Stelle im Bild. Die Ebene zeigt die ganze Figur samt Beinen/Füßen
(die Kartenkunst schneidet sie ab). In der Kartenkunst liegt die Flamme ÜBER dem Hinterkopf – so auch hier.

Aufruf:   python3 gigantisaur_king_trex.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-king-trex.png + .json

Identifikation (x, y im Sprite):
* Schwanz (x 0–18, y 9–27): steigt nach links oben an, goldgelbes Schachbrett-Raster (V/S), dunkle Unterkante H.
* Rumpf (x 19–58, y 19–46), Oberschenkel des nahen Beins durch die Linie x 31–36 abgesetzt; ferner Oberschenkel als dunkleres Raster (Q/R, x 32–38, y 40–48).
* Kopf (x 52–79, y 13–46): Nasenloch (72–73, 15), dunkles Auge mit Brauenschatten (59–64, 21–24), weit aufgerissenes Maul: Oberkiefer mit Zähnen (beige X, y 17–26), Rachen (braun J/N, x 60–66),
  dunkelrotes Maulinneres (C/F), Zunge (rosa P/I/T, 66–72, 35–39), Unterkiefer (x 60–79, ab der schwarzen Lippenlinie y 34…43) mit Zähnen (X/D, y 37–43).
* Ärmchen (x 39–49, y 46–55) mit Krallenhand (43–48, 52–55): hängt starr am Rumpf.
* Nahes Bein (Unterschenkel x 18–24, y 47–61; Fuß mit drei Krallen 14–28, 61–67), fernes Bein (x 34–40, y 47–60; Fuß 37–48, 59–66).
* Flammenkrone (x 40–63, y 1–27): gemaltes Feuer mit zwei leuchtend roten Kernen samt rosa Lichtpunkt (55–57, 17–19) und (51–52, 20–22) – als Glutkerne/Juwelen der Krone gedeutet: sie bleiben
  als feste Pixel (starr am Kopf) über dem animierten Feuer stehen.

Idle-Idee: der König steht schwer atmend da, lässt den Kiefer langsam zuklappen und reißt ihn wieder auf, stampft abwechselnd mit den Beinen, die Flammenkrone lodert.
Ablauf (64 Frames à 85 ms = 5,44 s), alle Bewegungen unabhängig:
* Flammenkrone: anim_feuer3 (posen=16, halten=1), fünf Zungen + Glutsockel, Fuß lückenlos auf Hinterkopf/Nacken; vier Farbtöne der gemalten Flamme (61,6,0)/(157,43,0)/(188,79,14)/(236,130,57).
  Das gemalte Feuer selbst wird nicht gezeigt (Frame 0 weicht dadurch vom Original ab – wie bei allen Feuer-Figuren).
* Unterkiefer (Pose, starr): der ganze Unterkiefer samt Zähnen und Zunge schwenkt um sein Gelenk (x 62) nach oben – spaltenweise Scherung mit Gefälle ≤ 1 px auf 2 Spalten, vorn bis 7 px –
  und klappt wieder auf (Frames 8–29); ein zweites, kleines Schnappen in Frames 44–53. Das Schachbrett-Raster wird an den Stufen fortgeführt (Z.raster_tausch).
* Atmen (2× je Schleife, oben in Frames 4–17 und 36–49): Rumpf, Schwanz, Kopf, Ärmchen und Flammenkrone heben sich 1 px; die Beine werden dafür in Zeile 49 texturiert um eine Zeile verlängert (anim_textur), die Füße bleiben stehen.
* Schwanz pendelt (2× je Schleife): spaltenweise Biegung, Spitze ±2 px.
* Stampfen: nahes Bein Frames 2–11, fernes Bein 34–43 (Hub 1-1-1-2-2-2-2-1-1-1 px: zwei glatte Zeilen des Unterschenkels entfallen, Fuß samt Krallen rückt unverändert hoch).
* Blinzeln (Frames 30–33 und 60–63): Lid im Hautraster über dem Auge, die unterste Augenzeile bleibt als Lidstrich.
Offene Kanten an den Scher-Stufen: das freiliegende Hautpixel wird selbst zum Umrisspixel (Z.umriss_faerben, Umrissfarbe des Originals) – die Kontur bleibt 1 px. Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_drache as D
import anim_feuer3 as F3
import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 64, 85
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 14, 3

quelle = L.lade('gigantisaur-king-trex')
sh, sw = quelle.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

A_, H_, L_ = (24, 8, 7), (59, 36, 9), (102, 61, 16)
Q_, R_, S_, V_, U_, W_ = (124, 95, 28), (139, 106, 31), (161, 124, 32), (183, 140, 36), (169, 136, 64), (184, 148, 66)
E_ = (37, 27, 21)
TREX_FARBEN = [(24, 8, 7), (25, 20, 22), (41, 16, 15), (38, 18, 15), (37, 27, 21), (59, 24, 18), (52, 33, 12), (59, 36, 9), (73, 45, 45), (71, 49, 41), (74, 59, 42), (102, 61, 16),
               (79, 68, 56), (97, 67, 54), (87, 72, 56), (118, 81, 82), (124, 95, 28), (139, 106, 31), (161, 124, 32), (149, 118, 124), (169, 136, 64), (183, 140, 36), (184, 148, 66), (184, 162, 144)]
flamme_m = L.deckend(quelle) & ~L.farbmaske(quelle, TREX_FARBEN)
spr = quelle.copy()
spr[flamme_m] = 0                                              # Trex ohne die gemalte Flamme (unter der Flamme liegt in der Quelle nichts Verdecktes: Ebene 513 ist dort leer)
vorhanden = L.deckend(spr)
UMRISS = [A_, H_, L_, (52, 33, 12)]
REGEL = T.umriss_regeln(spr, UMRISS)[2]
RASTER = [(V_, S_), (Q_, R_), (U_, W_)]
HAUT = [V_, S_, Q_, R_, U_, W_]

# Glutkerne der Krone (leuchtend rot + rosa Lichtpunkt): feste Pixel über dem Feuer
r, g, b = (quelle[..., k].astype(int) for k in range(3))
kern_m = flamme_m & (((r > 150) & (g < 60)) | ((r > 160) & (b > 60) & (g < 115))) & (((xx >= 54) & (xx <= 58) & (yy >= 16) & (yy <= 20)) | ((xx >= 50) & (xx <= 53) & (yy >= 20) & (yy <= 23)))

FEUER_FARBEN = [(61, 6, 0), (157, 43, 0), (188, 79, 14), (236, 130, 57)]
assert all(L.farbmaske(quelle, [c]).any() for c in FEUER_FARBEN)

schwanz_m = vorhanden & (xx <= 18) & (yy <= 30)
arm_m = vorhanden & (yy >= 47) & (yy <= 55) & (((yy == 47) & (xx >= 41)) | ((yy == 48) & (xx >= 40)) | ((yy >= 49) & (yy <= 51) & (xx >= 39)) | ((yy == 52) & (xx >= 41)) | ((yy >= 53) & (xx >= 43)))
bein_n = vorhanden & (yy >= 47) & (xx <= 31)
bein_f = vorhanden & (yy >= 47) & (xx >= 32) & (xx <= 50) & ~arm_m

# Unterkiefer: je Spalte alles ab der Lippenlinie (x ≤ 66: schwarze Schräge; rechts davon ab Zunge/Zähnen bzw. Lippenumriss)
kiefer_m = np.zeros((sh, sw), bool)
for x in range(60, sw):
    oben = None
    for y in range(33, sh):
        if not vorhanden[y, x]:
            continue
        c = tuple(int(v) for v in spr[y, x, :3])
        if x <= 66:
            if c == A_ and y >= 34 + min(x - 60, 4):
                oben = y
                break
        elif c in ((118, 81, 82), (73, 45, 45), (149, 118, 124), (184, 162, 144), (38, 18, 15)) or (c == A_ and y >= 38) or c in (Q_, R_):
            oben = y
            break
    if oben is not None:
        kiefer_m[oben:, x] = vorhanden[oben:, x]
koerper = vorhanden & ~schwanz_m & ~bein_n & ~bein_f & ~kiefer_m           # Rumpf + Kopf + Ärmchen

HUB = [1, 1, 1, 2, 2, 2, 2, 1, 1, 1]
KIEFER_1 = [1, 1, 2, 2, 3, 4, 5, 6, 7, 7, 7, 7, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1]
KIEFER_2 = [1, 2, 3, 3, 3, 3, 3, 2, 1, 1]
AUGE = [(x, y) for y in range(21, 24) for x in range(59, 65) if vorhanden[y, x] and tuple(int(v) for v in spr[y, x, :3]) not in (V_, S_, U_, W_, L_)]
LID_P = (int(xx[21, 65]) + 21) % 2                              # Rasterlage: Farbe von (65, 21) gilt für gleiche Parität
LID_C = tuple(int(v) for v in spr[21, 65, :3])
LID = {0: LID_C, 1: S_ if LID_C == V_ else V_}


AUGE_SPERRE = np.zeros((H, W), bool)                                   # das Feuer deckt das Auge nie zu (Auge + 1 px Rand)
for _x in range(58, 66):
    for _y in range(20, 26):
        if any((ax - _x) ** 2 + (ay - _y) ** 2 <= 2 for ax in range(59, 65) for ay in range(21, 25) if vorhanden[ay, ax] and tuple(int(v) for v in spr[ay, ax, :3]) not in HAUT + [L_]):
            AUGE_SPERRE[PAD_T + _y, PAD_L + _x] = True


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def _fl(x, y, laenge, breite, richtung, phase, **kw):
    return F3.Flamme(x=PAD_L + x, y=PAD_T + y, laenge=laenge, breite=breite, richtung=richtung, phase=phase, **kw)


FEUER = F3.Feuer(H, W, [
    _fl(53, 24.5, 9, 5.5, (0, -1), 0.0, bauch=0.2, schlag=0.3, puls=0.08, wiegen=0.1, baender=F3.SOCKEL),      # Glutsockel auf Hinterkopf/Nacken
    _fl(55.5, 21, 19, 3.6, (0.05, -1), 0.10),
    _fl(51.5, 21.5, 18, 3.4, (-0.15, -1), 0.55),
    _fl(49.5, 22, 15, 3.2, (-0.55, -1), 0.30),
    _fl(47.5, 23.5, 12, 3.0, (-1, -0.75), 0.80),
    _fl(58.5, 19, 10, 2.4, (0.45, -1), 0.65),
], FEUER_FARBEN, posen=16, halten=1, sperre=AUGE_SPERRE)


def zustand(i):
    atem = 1 if (i % 32) in range(4, 18) else 0
    kiefer = Z.hub(i, [8], KIEFER_1) or Z.hub(i, [44], KIEFER_2)
    bl = max(D.blinzeln(i, 30), D.blinzeln(i, 60))
    schwanz = 2.0 * Z.sinus(i, N / 2, -0.5) + 2.0 * np.sin(0.5)
    return atem, kiefer, bl, schwanz


def frame(i, nur=None, feuer=True):
    atem, kiefer, bl, schwanz = zustand(i)
    k = teil(koerper)
    if bl:
        for x, y in AUGE:
            if bl == 2 or y <= 22:
                k[PAD_T + y, PAD_L + x, :3] = LID[(x + y + LID_P) % 2]
    kf = teil(kiefer_m)
    if kiefer:
        dys = Z.biegung(PAD_L + 62, PAD_L + 79, PAD_L + 79, -kiefer, 1.0)
        kf = Z.biegen(kf, dys, RASTER, oben=False)
    dys = Z.biegung(PAD_L + 19, PAD_L + 0, PAD_L + 8, schwanz, 1.0)
    sw_ = Z.biegen(teil(schwanz_m), dys, RASTER)
    bn = L.heben_unten(teil(bein_n), PAD_T + 54, Z.hub(i, [2], HUB))
    bf = L.heben_unten(teil(bein_f), PAD_T + 56, Z.hub(i, [34], HUB))
    bn = TX.streck_zeile(bn, PAD_T + 49, atem)
    bf = TX.streck_zeile(bf, PAD_T + 49, atem)
    ebenen = {'bein_f': (bf, 0), 'bein_n': (bn, 0), 'koerper': (k, -atem), 'schwanz': (sw_, -atem), 'kiefer': (kf, -atem)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1]) for n in wahl])
    ganz = Z.umriss_faerben(ganz, HAUT, REGEL, H_)
    if feuer and nur is None:
        fe = FEUER.ebene(i, dy=-atem)
        kern = L.platz(L.trenne(quelle, kern_m)[0], H, W, PAD_L, PAD_T)
        ganz = L.zusammen(H, W, [(ganz, 0, 0), (fe, 0, 0), (kern, 0, -atem)])
    return ganz


TEST_EBENEN = ('bein_f', 'bein_n', 'koerper', 'schwanz', 'kiefer')


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=quelle, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-king-trex', 'Gigantisaur King Trex', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-king-trex-strip.png', frames, spalten=8, scale=3)
