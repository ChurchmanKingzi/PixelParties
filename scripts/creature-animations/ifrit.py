# -*- coding: utf-8 -*-
"""Idle-Animation für „Ifrit“ (Creature) — schwebender Feuergeist, Regeln 14/15/16 (Feuer wie Feuer, kein Glanz).

Quelle: src/ifrit.png — Ebene „Ifrit“ (16×35 px, 329 Pixel, 17 Farben) aus Motive.xcf (Ebene 594, Figur 1; Treffer 1.0). Die Kartenkunst (data/card-art/native/Ifrit.png) zeigt dieselbe Figur (Feuerstrahl nach unten).
PICK: [["Motive", 594, 1]]
Die Quelle war vollständig (Kopf mit Hörnern, Schultern/Arme, Feuerschweif; kein Beiwerk).

Aufruf:   python3 ifrit.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/ifrit.png + .json

Was ist was (x/y im Sprite):
* Hörner (links x 1–5, y 0–8; rechts x 10–14): dunkelbraun (46,29,22) mit glühender Innenseite ((253,237,115)/(255,140,63)/(121,79,55)); sie beginnen oben als 1-px-Spitze und biegen zum Kopf (starr, Horn glänzt nicht).
* Kopf (x 3–12, y 6–14): dunkelrotes Gesicht (139,37,35) mit Schatten (82,19,10); Augen: weiß (255,255,255) bei (5,10) (10,10), blassblau (213,255,255) bei (5,11) (10,11), orange Pupille (233,154,59) bei (6,11) (9,11);
  Mund-/Nasenschatten (82,19,10) (7–8,12) (6–9,13–14).
* Hals/Kragen (x 3–12, y 15), Schultern/Oberkörper (x 1–14, y 16–21) in Dunkelrot ((139,37,35)/(104,20,20)/(189,50,47)); Arme links (x 0–3) und rechts (x 12–15), y 19–21, hängen am Körper.
* Feuerschweif (x 2–13, y 22–34): ein Flammenkörper in Rot (202,44,41), Orange (244,123,34), Gelb (246,231,14) und cremeweißem Kern (247,245,184); oben breit (am Gürtel), nach unten spitz zulaufend — ein Düsen-/Geisterschweif NACH UNTEN.
Fest bleiben: Hörner, Gesichtsform, Mund, Schultern.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, der Feuerschweif ist ausgenommen, er wird neu gezeichnet):
* Feuerschweif (Regel 15, Modul anim_feuer.py unverändert benutzt): fünf Flammenzungen werden NEU gezeichnet (verschachtelte Farbschichten Rot/Orange/Gelb/Creme-Kern, je Zunge 12 Posen à 2–3 Frames, Höhe/Breite/Neigung wechseln, Kerne wandern;
  die Zungen laufen spitz zu, Spaltung nur selten); weil der Schweif nach unten brennt, läuft das Modul auf einer senkrecht gespiegelten Leinwand und das Ergebnis wird zurückgespiegelt (wie bei der Future Tech Drone). Die Basis (Gürtelzeile y 22, x 4–12)
  steht fest am Körper; abgerissene Spitzen fallen als Funken (1 px, Regel 15) und kühlen ab (creme → gelb → orange → rot).
* Schweben: zweistufig 0-1-2-1-0 px nach oben (Periode 24, zweimal pro Schleife) — der ganze Geist samt Feuerschweif und Funken. (Der Geist schwebt tatsächlich: kein Bein, nur Feuer.)
* Atmen: die Brustzeile y 17 wird 1× eingefügt (anim_lib.streck_zeile mit Texturmischung, Frame 14–20 und 38–44, Nachlauf zur Schwebephase): Kopf samt Hörnern und Schultern heben sich 1 px zusätzlich. Der Kopf bewegt sich nie seitlich.
* Arme pendeln locker nach außen (je ≤ 1 px, gegengleich, Periode 24 bzw. 16): Zeilenversatz wächst von der Schulter (y 18) zur Armspitze.
* Blinzeln (Lid = Gesichtsfarbe (139,37,35)): weiße/blasse Augenpixel und Pupillen Frame 9–11 und 33–35.
* Glut an den Hörnern: je ein Feuerfunke (1 px (253,237,115)→(255,140,63), Regel 15) löst sich von der linken/rechten Hornspitze und steigt 4 px auf (hinter der Figur), versetzt, verglimmt.
Kein Glanz/Glitzer (Feuer, Horn, Haut — Regel 14).
ERGÄNZUNG: keine gemalten Pixel nötig (das Feuer wird komplett neu aus Quellfarben gezeichnet). Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle); Flammenränder = Umrissfarbe (202,44,41).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Funken gehören zum Feuer).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer as FEU
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 7, 9

spr = L.lade('ifrit')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (32, 11, 6)
GESICHT = (139, 37, 35)
AUGEN = [(5, 10), (10, 10), (5, 11), (10, 11), (6, 11), (9, 11)]
assert all(col(x, y) in {(255, 255, 255), (213, 255, 255), (233, 154, 59)} for (x, y) in AUGEN)

ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
flamme_alt = vorhanden & (yy >= 22) & L.farbmaske(spr, [ROT, ORANGE, GELB, CREME])
koerper = vorhanden & ~flamme_alt
kopf = koerper & (yy <= 14)
arm_l = koerper & (yy >= 19) & (yy <= 21) & (xx <= 3)
arm_r = koerper & (yy >= 19) & (yy <= 21) & (xx >= 12)
rumpf = koerper & ~kopf & ~arm_l & ~arm_r
assert (kopf | arm_l | arm_r | rumpf | flamme_alt).sum() == vorhanden.sum()

# --- Feuerschweif (anim_feuer, gespiegelte Leinwand: Fuß oben am Gürtel) ---
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
fy = lambda y: H - 1 - y                                          # Zeile der Originalleinwand → gespiegelte Leinwand
fixiert = np.zeros((H, W), bool)
fixiert[GPT:GPT + sh, GPL:GPL + sw] = koerper
SPERRE = fixiert[::-1].copy()
BASIS = fy(GPT + 22)
ZUNGEN = [FEU.Zunge(GPL + 3.8, BASIS, 5.0, 1.9), FEU.Zunge(GPL + 5.9, BASIS, 8.5, 2.2), FEU.Zunge(GPL + 8.0, BASIS, 12.0, 2.6),
          FEU.Zunge(GPL + 10.1, BASIS, 8.5, 2.2), FEU.Zunge(GPL + 12.2, BASIS, 5.0, 1.9)]
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=9, posen=12, amplitude=0.9, sperre=SPERRE)

HORN = [(253, 237, 115), (255, 140, 63)]
assert all(c in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for c in HORN)
P = lambda x, y: (GPL + x, GPT + y)
HORN_P = [dict(x=P(1, 1)[0], y=P(1, 1)[1], vx=-1, vy=-4, off=0, form='k', wackeln=1),
          dict(x=P(14, 1)[0], y=P(14, 1)[1], vx=1, vy=-4, off=26, form='k', wackeln=1)]
_OHNE_PARTIKEL = [False]


def funken_horn(i):
    if _OHNE_PARTIKEL[0]:
        return L.leer(H, W)
    return U.glut_ebene(H, W, i, N, HORN_P, {'c': HORN[0], 'r': HORN[1]})


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_KOPF, T_AL, T_AR, T_RUMPF = (teil(m) for m in (kopf, arm_l, arm_r, rumpf))


def frame_gross(i, nur=None):
    hov = U.stufe(i, 24, 2)                                       # Schweben 0-1-2-1-0 (nach oben)
    n = 1 if 14 <= (i % 24) <= 20 else 0                          # Atmen 0-1-0 (Nachlauf: der Kopf steigt, wenn der Geist schon sinkt)
    kp = T_KOPF.copy()
    if i in (9, 10, 11, 33, 34, 35):
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = GESICHT
    rp = L.streck_zeile(T_RUMPF, GPT + 17, n)
    al = U.haengen(T_AL, GPT + 18, -1.0 * U.buckel(i, 0, 24, n=24), 1.0)
    ar = U.haengen(T_AR, GPT + 18, 1.0 * U.buckel(i, 0, 16, n=16), 1.0)
    f = L.zusammen(H, W, [(rp, 0, 0), (al, 0, -n), (ar, 0, -n), (kp, 0, -n)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    # Feuer: Pixel der Flamme liegen auf der gespiegelten Leinwand → zurückspiegeln
    fl = D.flip_v(FEUER.ebene(i))
    fk = D.flip_v(FEUER.funken(i, leben=10))
    f = U.kontur_schliessen(L.zusammen(H, W, [(fl, 0, 0), (f, 0, 0)]), UMRISS, ROT)       # Randpixel-Test auch für Flammenpixel am Körper
    ebenen = [(f, 0, 0)]
    if nur != 'koerper':
        ebenen = [(fk, 0, 0)] + ebenen                           # Feuerfunken gehören zum Feuer (Zuschnitt), aber nicht zum Randpixel-Test
    if nur is None:
        ebenen = [(funken_horn(i), 0, 0)] + ebenen
    return L.versetze(L.zusammen(H, W, ebenen), 0, -hov)


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'feuer') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('ifrit', 'Ifrit', frames, MS, prev)
    if prev:
        L.streifen(prev + '/ifrit-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=10)
