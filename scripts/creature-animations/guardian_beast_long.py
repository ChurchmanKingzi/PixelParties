# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Long“ (Creature, Archetyp Guardian Beasts) — der Drachen-Wächter (Zeichen „Long“ = Drache): grüner Schuppenkopf mit goldenem Geweih, goldene Schulterplatten, Klauen und ein Feuerstrahl aus dem Maul.

Quelle: src/guardian-beast-long.png (26×37 px, 38 Farben) — die Figur ohne Flamme; src/guardian-beast-long-flamme.png (23×48 px, vier Farben) = die gemalte Feuerstrahl-Ebene 104 der xcf-Datei. Der Körper steht FEST (kein Schweben/Atmen),
nur das Feuer lebt (Runde 4: anim_feuer3.py, klassischer Flammenzyklus in Flussrichtung nach der gemalten Vorlage).
PICK: [["MotiveGuardianBeasts", 105, "Ganze Ebene"], ["MotiveGuardianBeasts", 104, "Flamme (nur Farben/Form als Vorlage)"]]      (Ebene „Long-Kopie“ = Drache mit Geweih und Klauen, Ebene „Long #1“ = Feuerstrahl; die Ebene „Long“ (106) ist eine
andere Pose desselben Wächters mit geschlossenem Maul und Helm, ohne Geweih; Ebene 102 „Ebene #10“ ist eine Reihe kleiner Flammen, die zu anderen Karten gehört)
Abgleich mit der Kartenkunst Guardian_Beast_Long.png (76×51): die Karte zeigt Ebene 105 (Geweih, Klauen) mit dem Feuerstrahl (Ebene 104) vom Maul bis zum Kartenrand, die Flamme liegt vor dem Körper. Die Suche fand für diese Karte keinen
Treffer in der Datei (die Flamme verdeckt die Figur), daher direkt aus dem Ebenen-Dump. Die Quelle war damit vollständig (Figur) + Flamme als Beiwerk, das zum Wesen gehört (Verbrennen).

Aufruf:   python3 guardian_beast_long.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-long.png + .json

Identifikation (x, y im 26×37-Sprite):
* GEWEIH (x 0–8 und 17–25, y 0–9): große goldolive Geweihzacken (102,98,50)/(175,171,98)/(207,204,125)/(246,245,155) mit schwarzen Lücken (10,8,0); Horn/Knochen → kein Glanz.
* KOPF (x 9–16, y 3–12): graue Kappe (61,73,69)/(123,127,128)/(144,151,153)/(164,167,163), grünes Schuppengesicht (84,122,98)/(96,136,111)/(115,163,133) mit dunklem Rand (15,42,3), rote Augen: weiß (243,243,243) bei (10,7)/(11,8) bzw. (15,7)/(14,8)
  mit dunkelroten Rändern (79,18,18) bei (10,8–9)/(15,8–9) und rosa Pupillen (153,78,74) bei (11,9)/(14,9).
* MAUL/HALS (x 10–15, y 11–18): weißgraue Kiefer mit Zähnen (213,213,213)/(243,243,243)/(123,123,123), schwarzer Rachen (0,0,0) bei (12–13,12–13), darunter goldene Kehle (223,191,108)/(249,220,136)/(148,131,82) bei (12–13,15–17).
* SCHULTERPLATTEN (x 4–8 und 17–21, y 18–22): goldene Pauldrons (103,79,0)/(163,138,46)/(223,196,83)/(249,235,126) mit braunem Rand (49,24,0) → Metall/Gold, glänzt.
* BRUST (y 19–23): violetter Latz (62,45,94)/(90,61,146)/(122,86,194)/(153,121,221); ARME (x 2–7 und 18–23, y 23–28): grüne Schuppenarme (84,122,98)/(115,163,133), die Hände enden in weißen Klauenspitzen (240,239,242) bei (3,25), (2,26), (7,26), (1,27), (4,27), (7,27),
  (1,28), (4,28), (5,29) und gespiegelt rechts.
* BAUCHPLATTE (x 9–16, y 24–31): goldener Panzer (223,191,108)/(190,155,71)/(120,104,59)/(249,220,136) mit braunem Rand (84,62,33) → Gold, glänzt.
* BEINE (y 31–36): grüne Schuppenbeine (84,122,98)/(115,163,133) mit dunklem Rand (15,42,3) und weißen Zehenkrallen (250,253,247) bei (4–7,34–36)/(18–21,34–36).
* FLAMME (Vorlage Ebene 104): von (12–13,13) aus ein Feuerkegel nach unten (Spitze am Maul, wird breiter bis x 1–22), Farben Creme (247,245,184), Gelb (246,231,14), Orange (244,123,34), Rot (202,44,41).
Gold im Sprite: Schulterplatten und Bauchplatte → nur sie glänzen (Regel 12/14); Geweih, Schuppen, Klauen nicht.

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Körper steht fest (Nutzerkorrektur: nicht den ganzen Sprite samt Feuer schweben lassen): kein Atmen, kein Heben. Erhalten bleiben die kleinen Details der früheren Fassung: Blinzeln (Frames 19–21, 41–43), Gold glänzt
  (Lichtband/Glitzer nur an Schulterplatten und Bauchplatte), Geweihzacken zucken, Klauen spielen — alles ohne dass sich der Körper verschiebt.
* FEUERSTRAHL (Runde 4, „richtige Feuer-Animation“, anim_feuer3): klassischer Flammenzyklus, 8 Posen à 2 Frames (3 Zyklen je Schleife), Fluss vom Maul weg nach UNTEN. Ein Kegel wie in der gemalten Ebene 104 (am Maul schmal und
  cremefarben, nach unten bis ~19 px breit; Mantel Rot → Orange → Gelb um den Creme-Kern), an dessen Rändern Bäuche nach unten wandern und der leicht schlängelt; das untere Ende läuft in fünf phasenversetzten Zungen aus (mittlere am
  längsten), deren Spitzen sich abschnüren und als kleine Fetzen weiter nach unten fliegen. Farben nur aus der Flammenebene.
Frame 0 = Original (Körper); die Flamme ist ausgenommen (Posenfolge). Kontrolle: Ruhepose/Eckkontakte/Randpixel-Test (nur Körperebenen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle bzw. der Flammenvorlage.
Ergänzungen: keine für den Körper; der Strahl wird nach der gemalten Vorlage neu gezeichnet.
"""
import sys

import cv2
import numpy as np
from PIL import Image

import anim_feuer3 as F3
import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 64
PAD = (4, 3, 4, 25)
sz = G.Szene('guardian-beast-long', PAD)
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f
PL, PT = sz.PL, sz.PT

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)      # Farben der Flammenvorlage (Ebene 104)
ERLAUBT_FEUER = [ROT, ORANGE, GELB, CREME]

GRUEN = f(12, 6)                                                 # (84,122,98) Gesichtsgrün
UMRISS = f(7, 2)                                                 # (15,42,3)
GOLD = [(103, 79, 0), (120, 104, 59), (148, 131, 82), (163, 138, 46), (190, 155, 71), (223, 196, 83), (223, 191, 108), (249, 220, 136), (249, 235, 126)]
AUGEN = [(10, 7), (11, 8), (10, 8), (10, 9), (11, 9), (15, 7), (14, 8), (15, 8), (15, 9), (14, 9)]

geweih_l = sz.maske(0, 0, 8, 7) | sz.maske(0, 8, 6, 9)
geweih_r = sz.maske(17, 0, 25, 7) | sz.maske(19, 8, 25, 9)
klauen_farbe = f(3, 25)                                          # (240,239,242)
klauen_l = sz.vorhanden & L.farbmaske(spr, [klauen_farbe]) & (sz.xx <= 8) & (sz.yy >= 25)
klauen_r = sz.vorhanden & L.farbmaske(spr, [klauen_farbe]) & (sz.xx >= 17) & (sz.yy >= 25)
koerper = sz.vorhanden & ~geweih_l & ~geweih_r & ~klauen_l & ~klauen_r
m_gold = sz.vorhanden & L.farbmaske(spr, GOLD) & (sz.yy >= 18) & (sz.yy <= 30)

# --- Feuerstrahl (Runde 4, anim_feuer3): Kegel vom Maul nach unten wie in der gemalten Ebene 104 (Maul (12–13,13) → unten x 1–22 breit), der Fluss läuft vom Maul weg nach UNTEN ---
FLAMME = np.array(Image.open(L.os.path.join(L.SRC, 'guardian-beast-long-flamme.png')).convert('RGBA'))      # nur noch Vorlage für Form/Lage/Farben
FX, FY = 0, 13                                                   # Lage der Flammenebene im Sprite (Stiel x 12–13 liegt im Maul)
_X, _Y = PL + FX + 12.5, PT + FY
KEGEL = F3.Strahl(_X, _Y, 27, 0.9, 9.6, richtung=(0, 1), welle=13, bauch=0.13, schlag=0.7)
# fünf Zungen am unteren Kegelende (Füße bei Zeile ~22–25 der Flammenebene), phasenversetzt, fließen nach unten und leicht nach außen; mittlere am längsten
ENDE = [F3.Flamme(_X + dx, _Y + fy, l, b, richtung=(rx, 1), phase=ph, fuss=0, welle=11)
        for (dx, fy, l, b, rx, ph) in [(-7.6, 21, 11, 3.0, -0.25, 0.0), (-3.8, 24, 13, 3.3, -0.1, 0.55), (0.0, 25, 15, 3.6, 0.0, 0.25), (3.8, 24, 13, 3.3, 0.1, 0.8), (7.6, 21, 11, 3.0, 0.25, 0.4)]]
FEUER = F3.Feuer(H, W, [KEGEL] + ENDE, [ROT, ORANGE, GELB, CREME], posen=8, halten=2)


def frame(i, nur=None):
    k = sz.ebene(koerper)
    ge_l, ge_r = sz.ebene(geweih_l), sz.ebene(geweih_r)
    kl_l, kl_r = sz.ebene(klauen_l), sz.ebene(klauen_r)
    # --- Blinzeln ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, {p: GRUEN for p in AUGEN})
    # --- Gold glänzt ---
    Hm.lichtband(k, m_gold, OFF, i, N, 6, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_gold, OFF, i, N, 30, 12, GOLD, stufen=1, breite=2.6, achse=(-1.0, 1.0), kern=2)
    for (x, y), start in (((6, 20), 20), ((19, 20), 44)):
        s = Hm.folge(i, start, [0, 1, 1, 0], N)
        if s is not None:
            Hm.stern4(k, x, y, s, klauen_farbe, klauen_farbe, off=OFF)
    # --- Geweih zuckt: äußere Zacken (Zeilen 0–2) knicken zur Seite ---
    for ge, start, sgn, (x0, x1) in ((ge_l, 6, 1, (-3, 4)), (ge_r, 28, -1, (21, 25))):
        d = Hm.folge(i, start, [1, 1, 1, 0, 1, 1, 0, 0], N)
        if d:
            sz.bereich(ge, {0: sgn, 1: sgn}, x0, x1)
    # --- Klauen rutschen ---
    dl = 1 if Hm.folge(i, 14, [1, 1, 0, 1, 1, 0, 0, 0], N) else 0
    dr = 1 if Hm.folge(i, 38, [1, 1, 0, 1, 1, 0, 0, 0], N) else 0
    kl_l, kl_r = L.versetze(kl_l, 0, dl), L.versetze(kl_r, 0, dr)
    fig = L.zusammen(H, W, [(kl_l, 0, 0), (kl_r, 0, 0), (ge_l, 0, 0), (ge_r, 0, 0), (k, 0, 0)])
    fig = sz.kontur(fig, UMRISS)
    if nur == 'koerper':
        return fig
    return L.zusammen(H, W, [(fig, 0, 0), (FEUER.ebene(i), 0, 0)])


TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-long', 'Guardian Beast Long', MS, prev, erlaubt=ERLAUBT_FEUER, ruhe0=frame(0, nur='koerper'))
