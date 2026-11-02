# -*- coding: utf-8 -*-
"""Idle-Animation für „Hockey Genie“ (Creature) — schwebender Eishockey-Geist mit Schläger, Puck am Boden.

Quelle: src/hockey-genie.png — Ebene „Ebene #17“ (32×31 px, 398 Pixel, 29 Farben) aus MotiveCoolhalla.xcf (Ebene 238, Figur 2; Treffer 0.997). Die Kartenkunst (data/card-art/native/Hockey_Genie.png) zeigt dieselbe Figur auf Eis.
PICK: [["MotiveCoolhalla", 238, 2]]
Die Quelle war vollständig (Figur samt Schläger, Puck als eigenes Teil unten links; die Nachbarebenen enthalten nur Eisflächen/Schriftzug).

Aufruf:   python3 hockey_genie.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hockey-genie.png + .json

Was ist was (x/y im Sprite):
* Maske (x 15–24, y 0–6): graue Eishockeymaske (158,158,158) mit dunklem Umriss (24,20,25); durch die Augenöffnungen leuchtet das Cyan des Geistes ((3,146,166)/(1,188,212) bei (18–21,3–4)); drei braune Punkte (141,125,113) bei (17,6) (19,6) (21,6)
  = Lüftungslöcher/Zähne der Maske. Die Maske ist ein Visier: kein Blinzeln, kein Farbspiel.
* Kragen (17–20,7) cyan; Trikot/Oberkörper (x 10–26, y 7–17) in Dunkelgrau-Blau ((71,73,85)/(85,88,102)/(17,15,18)), blaues Brust-Emblem (33,150,243)/(31,129,209)/(30,66,102)/(68,165,243) bei (17–21,9–13).
* Rechter Arm (x 22–30, y 7–11) mit weißem Handschuh ((181,174,175)/(255,255,255)) bei (27–29,10–11), der den Schläger oben hält; linker Arm (x 9–13, y 8–17) mit Handschuh bei (11–13,18–19), der den Schaft hält.
* Schläger: brauner Holzschaft ((59,44,38)/(77,57,49)) diagonal über den Oberkörper von (29,9) nach (9,20), unten ein Blatt mit grauem Tape ((82,82,82)/(147,146,147)/(141,125,113)) bei x 0–9, y 20–24.
* Schweif (x 14–31, y 17–23): cyanfarbener Geisterschweif ohne Beine ((3,146,166)/(1,188,212)/(43,221,244), Umriss (13,37,40)), der nach rechts schwingt und in einer nach oben gekrümmten Spitze (28–31, 18–21) endet.
* Puck (x 1–8, y 26–30): graublaue Scheibe (88,113,126)/(96,125,139)/(59,70,80) mit dunklem Umriss (21,13,22), liegt am Boden (Eis) und bleibt unten.
Fest bleiben: Maske, Emblem, Puck (Boden).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Dunst ausgenommen):
* Schweben (der Geist fliegt, er hat keine Beine): zweistufig 0-1-2-1-0 px nach oben (Periode 24, zweimal pro Schleife) — Oberkörper samt Schläger, Armen und Schweif; die Maske folgt der Brust 2 Frames später
  (nie höher als die Brust, sinkt höchstens 1 px in die Schultern); der Kopf bewegt sich nie seitlich. Der Puck bleibt am Boden.
* Schweif wellt (Periode 16, dreimal pro Schleife): jede Spalte des Schweifs wandert senkrecht, je weiter vom Rumpf entfernt, desto mehr (Spitze bis ±2,4 px), mit Wellenlauf (die Spitze hinkt nach); 4-verbunden
  (anim_flieger.fluegel_welle); wird eine Spalte gesenkt, füllt ihr oberstes Pixel die Lücke unter dem Rumpf (angewachsen).
* Schlägerblatt schwingt (Periode 24): die Spalten des Blatts (x ≤ 9) wandern senkrecht um den Handschuh als Drehpunkt (Blattspitze bis ±1,8 px); der Schaft zwischen den Händen steht. Das Blatt kann den Puck beim Absenken fast berühren, nie überlappen.
* Eisdunst (hinter der Figur, 3 Wölkchen, Lebensdauer 48 Frames, langsam aufsteigend, 2×2 → 4×4 → 2×2; Farben (1,188,212)/(3,146,166) aus dem Sprite) löst sich von der Schweifspitze und vom Schweif.
Kein Glanz (Maske/Holz/Handschuhe/Puck sind kein Metall — Regel 14), keine Augen-Effekte (Visier).
ERGÄNZUNG: keine gemalten Pixel nötig. Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Dunst höchstens 2 px darüber hinaus).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_flieger as F
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 7, 3

spr = L.lade('hockey-genie')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (17, 15, 18)

puck = vorhanden & (yy >= 25)
figur = vorhanden & ~puck
schweif = figur & (yy >= 17) & (xx >= 14) & L.farbmaske(spr, [(3, 146, 166), (1, 188, 212), (43, 221, 244), (13, 37, 40)])
kopf = figur & (yy <= 6) & (xx >= 15)
blatt = figur & (xx <= 9) & (yy >= 20)
rumpf = figur & ~schweif & ~kopf & ~blatt
assert (puck | schweif | kopf | blatt | rumpf).sum() == vorhanden.sum()

DUNST = {'c': (1, 188, 212), 'r': (3, 146, 166)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in DUNST.values())
P = lambda x, y: (GPL + x, GPT + y)
DUNST_P = [
    dict(x=P(29, 18)[0], y=P(29, 18)[1], vx=1, vy=-5, off=0, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(25, 23)[0], y=P(25, 23)[1], vx=0, vy=-4, off=16, wackeln=1, formen=('s', 'o', 's')),
    dict(x=P(19, 23)[0], y=P(19, 23)[1], vx=-1, vy=-4, off=32, wackeln=1, formen=('s', 'o', 's')),
]

_OHNE_PARTIKEL = [False]


def dunst(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return D.klekse_ebene(*a, **k)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_PUCK, T_SCHWEIF, T_KOPF, T_BLATT, T_RUMPF = (teil(m) for m in (puck, schweif, kopf, blatt, rumpf))
STUETZE = L.deckend(T_RUMPF)


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    n_kopf = max(min(n, U.stufe(i - 2, 24, 2)), n - 1)
    sw_ = F.fluegel_welle(T_SCHWEIF, GPL + 15, 2.4, L.sinus(i, 16), potenz=1.3, nur_rechts=True, lauf=1.6, zusammenhang=True)
    sw_ = D.fuelle_oben(sw_, T_SCHWEIF, STUETZE)
    bl = F.fluegel_welle(T_BLATT, GPL + 10, 1.8, L.sinus(i, 24), potenz=1.0, nur_rechts=False, lauf=0.0, zusammenhang=True)
    f = L.zusammen(H, W, [(T_PUCK, 0, 0), (sw_, 0, -n), (bl, 0, -n), (T_RUMPF, 0, -n), (T_KOPF, 0, -n_kopf)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    return L.zusammen(H, W, [(dunst(H, W, i, N, DUNST_P, DUNST), 0, 0), (f, 0, 0)])


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('hockey-genie', 'Hockey Genie', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hockey-genie-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=8)
