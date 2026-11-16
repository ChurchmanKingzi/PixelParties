# -*- coding: utf-8 -*-
"""Idle-Animation für „Pyraga“ (Creature) — Feuerechse mit zwei Flammen, Regeln 14/15/16 (Feuer wie Feuer, kein Glanz).

Quelle: src/pyraga.png — Ebene „Pyraga“ (53×39 px, 1058 Pixel, 19 Farben) aus Motive.xcf (Ebene 839, Figur 1; Treffer 0.989; in der Kartenkunst 2:1 vergrößert). Die Kartenkunst (data/card-art/native/Pyraga.png) zeigt dieselbe Figur.
PICK: [["Motive", 839, 1]]
Die Quelle war vollständig (Kopf, Körper, Beine, beide Flammen).

Aufruf:   python3 pyraga.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/pyraga.png + .json

Was ist was (x/y im Sprite):
* Körper: rosa-beiges Tier im Profil nach LINKS (Haut (195,138,131)/(182,112,104)/(211,175,163), dunkler Umriss (43,26,18)). Kopf links (x 0–15, y 13–32) mit zwei gelbgrünen Augen mit schlitzförmigen Pupillen
  (links: Pixel (185,190,132) (2,18) (1,19) (3,19) (1,20) (3,20) (2,21), Pupille (73,75,26) (2,19) (2,20); rechts: (7,18) (8,18) (6,19) (8,19) (6,20) (8,20) (7,21), Pupille (7,19) (7,20); dunkle Wimpern (64,34,23)),
  dunkelroten Nüstern (74,19,12) (2,23) (5,23) (2,24) (5,24), Maul unten mit grauen Hauern (190,189,187) und Zunge (173,138,142) bei (5–10,25–32). Rücken/Rumpf (x 16–46, y 12–33), zwei Vorderbeine/Klauen
  (x 16–28, y 24–38) und ein dicker Hinterlauf rechts (x 33–47, y 24–38) mit glühenden Lavapunkten ((255,105,0)/(255,154,0)) an den Fußsohlen (y 35–37).
* Flamme 1 (links oben, x 7–16, y 0–12): Mähne/Kamm im Nacken des Kopfes, zwei hohe Spitzen (x 10 und 14); Farben Rot (202,44,41), Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184); darunter ein dunkeloliver Balken
  (63,66,37) (9–14,13) als Flammenfuß.
* Flamme 2 (rechts, x 37–52, y 9–20): große Flamme auf dem Hinterteil, im Original nach rechts geneigt; ihr Fuß liegt auf dem Rücken (x 37–43, y 16–20), rechts davon (x 44–52) hängt sie frei in der Luft.
Fest bleiben: Körperform, Beine/Klauen, Hauer, Zunge, Maul, Nüstern.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, die Flammen sind ausgenommen):
* Feuer (Runde 4, „richtige Feuer-Animation“, Modul anim_feuer3.py): klassischer Flammenzyklus mit Aufwärtsfluss; Runde 5: schneller und lebhafter (16 Posen à 1 Frame, Welle läuft 2× je Zyklus ≈ 0,5 s, Zungen wechseln Länge/Neigung), 3 Zyklen je Schleife; die Rückenflamme schlägt aus dem Loch im Rücken (siehe FL_R). Beide Flammen sitzen dort, wo sie gemalt sind, und haben deren Größe
  und Farben (Rot außen → Orange → Gelb → Creme-Kern am Fuß): links (Nacken) ein ruhiger Glutsockel auf dem Oliv-Balken + drei phasenversetzte Zungen nach oben; rechts (Hinterteil) Sockel auf dem Rücken + drei Zungen, die wie
  gemalt nach rechts oben fließen. Bäuche wandern vom Fuß zur Spitze, Spitzen schnüren sich ab und steigen als kleine Fetzen weiter. Die Flammen heben sich beim Atmen mit dem Körper. Keine Einzelfunken mehr.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Hautzeile y 22 (reine Haut, ohne Nüstern/Augen) wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); alles darüber (Rücken, Kopf, Flammen) steigt,
  die Beine/Klauen/Hinterlauf bleiben am Boden.
* Blinzeln beider Augen (Lid = Hautfarbe (195,138,131); Wimpern bleiben): Frame 9–11 und 33–35.
* Lavapunkte an den Fußsohlen glühen unregelmäßig (jedes Pixel wechselt mit eigener Periode 6–10 Frames zwischen (255,105,0), (255,154,0) und (244,123,34); Farben der Quelle).
Kein Glanz/Glitzer (Haut/Feuer — Regel 14).
ERGÄNZUNG: keine gemalten Pixel nötig (die Flammen entstehen aus der gemalten Vorlage). Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle); Flammenränder = Umrissfarbe (202,44,41).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Funken gehören zum Feuer).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
import anim_untote as U
import anim_feuer3 as F3
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 8, 16, 4

spr = L.lade('pyraga')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (43, 26, 18)
ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
HAUT = (195, 138, 131)
LAVA_M, LAVA_R = (255, 105, 0), (255, 154, 0)
flamme_alt = vorhanden & (yy <= 21) & L.farbmaske(spr, [ROT, ORANGE, GELB, CREME])
koerper = vorhanden & ~flamme_alt
AUGEN = [(2, 18), (1, 19), (3, 19), (1, 20), (3, 20), (2, 21), (2, 19), (2, 20), (7, 18), (8, 18), (6, 19), (8, 19), (6, 20), (8, 20), (7, 21), (7, 19), (7, 20)]
assert all(col(x, y) in {(185, 190, 132), (73, 75, 26)} for (x, y) in AUGEN)
LAVA = [(x, y) for y in range(35, 38) for x in range(30, 50) if vorhanden[y, x] and col(x, y) in (LAVA_M, LAVA_R)]
assert len(LAVA) == 15

# --- Feuer (anim_feuer2: die gemalte Flamme der Quelle wird Zunge für Zunge animiert) ---
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
SPERRE = np.zeros((H, W), bool)
SPERRE[GPT:GPT + sh, GPL:GPL + sw] = koerper


def flamm_vorlage(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)


# Runde 4 (anim_feuer3: klassischer Flammenzyklus mit Aufwärtsfluss, 8 Posen à 2 Frames, 3 Zyklen je Schleife; Lage/Größe/Farben nach der gemalten Flamme)
_F = lambda x, y, l, b, **k: F3.Flamme(x + GPL, y + GPT, l, b, **k)
# linke Flamme (Mähne im Nacken): flacher Fuß auf dem Oliv-Balken (y 12), ruhiger Glutsockel + zwei phasenversetzte Zungen (Spitzen der Quelle bei (10,0) und (14,1))
FL_L = [_F(11.5, 12.6, 6, 4.6, fuss=0, bauch=0.2, schlag=0.3, phase=0.2, baender=F3.SOCKEL, puls=0.08, wiegen=0.1),
        _F(11.6, 11.5, 8, 2.6, phase=0.72),
        _F(9.6, 11.5, 12, 3.0, phase=0.0, richtung=(-0.06, -1)),
        _F(13.6, 11.5, 11, 3.0, phase=0.5, richtung=(0.08, -1))]
# rechte Flamme (Runde 5: „soll AUS dem Loch im Rücken kommen“). Das Loch ist die Öffnung im Umriss zwischen (36,14) und (41,21); sein dunkler Grund ist der Oliv-Streifen (36,15)…(41,20).
# Die Flammenfüße sitzen jetzt AUF diesem Streifen (im Loch, vom Körper verdeckt), der Sockel ist so breit wie das Loch, die Zungen schlagen wie gemalt nach rechts oben heraus.
# Links/oberhalb der Lochkante (x − y ≤ 21) wird nichts gezeichnet (nichts schwebt über dem Rücken), der Oliv-Streifen bleibt als Öffnung sichtbar.
FL_R = [_F(38.3, 17.3, 6, 4.2, richtung=(1, -0.55), fuss=2.5, bauch=0.2, schlag=0.3, phase=0.6, baender=F3.SOCKEL, puls=0.08, wiegen=0.1),
        _F(39.0, 17.6, 10, 2.8, richtung=(1, -0.4), phase=0.35),
        _F(37.6, 15.6, 15, 3.2, richtung=(1, -0.5), phase=0.1),
        _F(40.0, 19.0, 13, 3.0, richtung=(1, -0.22), phase=0.6)]
FEUER = F3.Feuer(H, W, FL_L, [ROT, ORANGE, GELB, CREME], posen=16, halten=1, sperre=SPERRE)
SPERRE_R = SPERRE.copy()
_yy, _xx = np.mgrid[0:H, 0:W]
SPERRE_R |= ((_xx - GPL) - (_yy - GPT) <= 21)
FEUER_R = F3.Feuer(H, W, FL_R, [ROT, ORANGE, GELB, CREME], posen=16, halten=1, sperre=None)
# fester Flammenfuß: die Pixel direkt an der Lochkante brennen in jedem Frame (gelb/creme = heißer Kern im Loch), damit nie Hintergrund zwischen Loch und Flamme steht
FUSS_R = [((37, 15), ORANGE), ((38, 15), ORANGE), ((38, 16), GELB), ((39, 16), GELB), ((39, 17), CREME), ((40, 17), CREME), ((40, 18), CREME), ((41, 18), GELB), ((41, 19), GELB), ((42, 19), ORANGE), ((42, 20), ROT), ((38, 14), ROT), ((37, 14), ROT)]


def feuer_rechts(i, n):
    e = FEUER_R.ebene(i)
    for (x, y), c in FUSS_R:
        if e[GPT + y, GPL + x, 3] == 0 or (c != ROT and tuple(e[GPT + y, GPL + x, :3]) in (ROT, ORANGE) and c in (GELB, CREME)):
            e[GPT + y, GPL + x] = c + (255,)
    e[SPERRE_R] = 0
    return L.versetze(e, 0, -n) if n else e


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_KOERPER = teil(koerper)


def lava_farbe(k, i):
    per = 6 + (k % 5)
    st = int(((i + 3 * k) % per) * 3 / per)
    return (LAVA_M, LAVA_R, ORANGE)[(st + k) % 3] if (i != 0) else (spr[LAVA[k][1], LAVA[k][0], :3])


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    kp = T_KOERPER.copy()
    if i in (9, 10, 11, 33, 34, 35):
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = HAUT
    for k, (x, y) in enumerate(LAVA):
        kp[GPT + y, GPL + x, :3] = lava_farbe(k, i)
    kp = TX.streck_zeile(kp, GPT + 22, n)
    kp = U.kontur_schliessen(kp, UMRISS, KONTUR)
    fl = L.zusammen(H, W, [(FEUER.ebene(i, dy=-n), 0, 0), (feuer_rechts(i, n), 0, 0)])
    f = U.kontur_schliessen(L.zusammen(H, W, [(fl, 0, 0), (kp, 0, 0)]), UMRISS, ROT)
    if nur == 'koerper':
        return f
    return f


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('pyraga', 'Pyraga', frames, MS, prev)
    if prev:
        L.streifen(prev + '/pyraga-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=2, scale=8)
