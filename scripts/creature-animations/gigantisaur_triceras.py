# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Triceras“ (Creature) — riesiger Dreihorn-Saurier, scharrt wie ein Stier vor dem Angriff: langsam, schwer.

PICK: [["MotiveGrailWar", 509, "ganze Ebene „Tricera“ (60×51 px, nur Alpha 0/255)"]]
Quelle: src/gigantisaur-triceras.png (20 Farben), blickt nach rechts. Die Ebene ist vollständig (Hörner, Beine, Schwanz); nichts ergänzt.

Aufruf:   python3 gigantisaur_triceras.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-triceras.png + .json

Identifikation (x, y im Sprite):
* Nackenschild (x 21–36, y 10–24) mit zwei Zacken oben (27, 30; y 10) und hellen Glanzflecken (R); darunter der Hals im Schatten (dunkles Raster G/H, x 24–40, y 18–29).
* Hörner (starr, cremeweiß S/P mit grauem Umriss F): langes Stirnhorn (x 37–52, y 0–16), zweites Stirnhorn (x 43–56, y 3–15), kurzes Nasenhorn (x 51–55, y 10–16).
* Gesicht (x 37–59, y 16–29): Auge 2×2 (43–44, 18–19) mit weißem Lichtpunkt (44,18); Schnabel grau (N/Q/K/I): Oberschnabel (53–59, 18–22) mit Hakenspitze, Unterschnabel (53–58, 25–29),
  dazwischen der offene Spalt (54–59, 22–24); Wangenlinie (46–48, 22–24).
* Rumpf (x 9–48, y 17–38), helles Raster J/L. Schwanz (x 0–11, y 27–42): dick, hängt links hinter dem Hinterbein herab, die Spitze biegt bei (3–5, 40–42) nach rechts.
* Beine: nahes Hinterbein (x 3–17, y 34–48), nahes Vorderbein (x 20–34, y 30–50), fernes Vorderbein (dunkles Raster D/E, x 39–49, y 36–46), dunkler Ansatz des fernen Hinterbeins (x 28–33, y 39–42).
Bleibt fest: Hörner und Schild (nur starr mit dem Kopf), Glanzflecken, Hufe.

Idle-Idee: der Triceras senkt den Kopf und scharrt mit dem fernen Vorderbein, kaut, schlägt mit dem Schwanzende.
Ablauf (72 Frames à 80 ms = 5,76 s), alle Bewegungen unabhängig:
* Scharren (Frames 8–17 und 20–29): das ferne Vorderbein hebt sich als starre Pose (ganzes Bein samt Huf, bis 3 px hoch und 1 px zurück), setzt vorn wieder auf.
* Kopf senken (Frames 6–32): der ganze Kopf (x ≥ 37, samt aller Hörner, starr) sinkt 1 px; das Schachbrett-Raster läuft an der Naht weiter (Z.raster_tausch).
* Kauen (Frames 44–61, drei Bisse): der Unterschnabel (x ≥ 53, y ≥ 25) hebt sich als Pose 1 px, der Spalt wird schmaler.
* Schwanzende schlägt (2× je Schleife): die freien Zeilen 36–42 wandern zeilenweise bis 2 px nach links und zurück (Gefälle ≤ 1 px je Zeile), oberhalb liegt der Schwanz am Bein an und bleibt fest.
* Atmen (2× je Schleife, oben in Frames 4–19 und 40–55): Zeile 44 (nur Beine) wird texturiert eingefügt (anim_textur) – Rumpf, Kopf und Schwanz heben sich 1 px, die Hufe bleiben stehen.
* Blinzeln (Frames 36–39 und 66–69): Lid im Hautraster.
Offene Kanten schließt anim_tiere.umriss_schliessen (Umrissfarbe des Originals). Nur ganze Pixel, nur Farben der Quelle.
"""
import sys

import numpy as np

import anim_drache as D
import anim_lib as L
import anim_n10 as Z
import anim_textur as TX
import anim_tiere as T

N, MS = 72, 80
PAD_L, PAD_R, PAD_T, PAD_B = 4, 3, 3, 3

spr = L.lade('gigantisaur-triceras')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

B_, D_, E_, G_, H_, J_, L_, M_, O_ = (37, 28, 26), (47, 39, 33), (64, 53, 50), (78, 67, 59), (82, 71, 63), (106, 95, 78), (146, 134, 124), (148, 138, 121), (170, 160, 146)
F_, I_ = (72, 69, 61), (76, 79, 76)
UMRISS = [B_, F_, I_, (31, 27, 22), (41, 38, 27)]
REGEL = T.umriss_regeln(spr, UMRISS)[2]
RASTER = [(J_, L_), (G_, H_), (D_, E_), (M_, O_)]

bein_f = Z.mit_umriss(spr, Z.maske_farben(spr, [D_, E_], 39, 36, 50, 46), [B_], kasten=(39, 36, 50, 46), diagonal=True)
kopf_m = vorhanden & (xx >= 37) & (yy <= 29) & ~bein_f
schnabel_m = kopf_m & (xx >= 53) & (yy >= 25)
SCHWANZ_X = {36: 7, 37: 6, 38: 4, 39: 3, 40: 3, 41: 4, 42: 4}
schwanz_m = np.zeros((sh, sw), bool)
for _y, _x in SCHWANZ_X.items():
    schwanz_m[_y, :_x + 1] = vorhanden[_y, :_x + 1]
koerper = vorhanden & ~bein_f & ~kopf_m & ~schwanz_m

SCHARR = [(-1, -1), (-1, -2), (-1, -3), (-1, -3), (0, -3), (0, -2), (0, -1), (0, 0), (0, 0), (0, 0)]
KAU = [1, 1, 1, 0, 0, 0]
AUGE = [(43, 18), (44, 18), (43, 19), (44, 19)]
LID_REF = tuple(int(v) for v in spr[18, 42, :3])                # Hautfarbe links neben dem Auge (Rasterlage (42 + 18) gerade/ungerade)
assert LID_REF in (J_, L_)


def lid(x, y):
    return LID_REF if (x + y) % 2 == (42 + 18) % 2 else (L_ if LID_REF == J_ else J_)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def zustand(i):
    atem = 1 if (i % 36) in range(4, 20) else 0
    sch = (0, 0)
    for s in (8, 20):
        if 0 <= i - s < len(SCHARR):
            sch = SCHARR[i - s]
    nick = 1 if 6 <= i < 33 else 0
    kau = KAU[(i - 44) % 6] if 44 <= i < 62 else 0
    bl = max(D.blinzeln(i, 36), D.blinzeln(i, 66))
    sn = Z.sinus(i, N / 2)
    schwanz = int(round(-2 * sn)) if sn > 0 else 0
    return atem, sch, nick, kau, bl, schwanz


def frame(i, nur=None):
    atem, sch, nick, kau, bl, schwanz = zustand(i)
    kp = teil(kopf_m & ~schnabel_m)
    if bl:
        for x, y in AUGE:
            if bl == 2 or y == 18:
                kp[PAD_T + y, PAD_L + x, :3] = lid(x, y)
    kp = L.zusammen(H, W, [(kp, 0, 0), (teil(schnabel_m), 0, -kau)])
    if nick:
        dys = {x: nick for x in range(W)}
        kp = Z.raster_tausch(L.versetze(kp, 0, nick), dys, RASTER)
    dxs = Z.gefaelle({PAD_T + y: (schwanz if y >= 38 else int(round(schwanz * 0.5))) if y >= 36 else 0 for y in range(34, 43)}, PAD_T + 35)
    sw_ = Z.zeilen_dx(teil(schwanz_m), dxs)
    ebenen = {'bein_f': (teil(bein_f), sch[0], sch[1]), 'schwanz': (sw_, 0, 0), 'koerper': (teil(koerper), 0, 0), 'kopf': (kp, 0, 0)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [ebenen[n] for n in wahl])
    ganz = T.umriss_schliessen(ganz, UMRISS, REGEL)
    return TX.streck_zeile(ganz, PAD_T + 44, atem)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = Z.zuschneiden([frame(i) for i in range(N)])
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', min(n), max(n), '| Original', int(vorhanden.sum()))
    print('Lücken je Frame (Original %d):' % Z.loecher(spr), sorted({Z.loecher(f) for f in frames}))
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-triceras', 'Gigantisaur Triceras', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-triceras-strip.png', frames, spalten=12, scale=3)
