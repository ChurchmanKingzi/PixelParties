# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Zhuque“ (Creature) — der Vermilion-Vogel des Südens: ein roter Feuervogel von vorn mit zum V gespreizten Flügeln, Federkleid in Rot/Lachs/Pfirsich,
gelb-pfirsichfarbenen Flügelvorderkanten, einem Kopf mit Krone in der Mitte und zwei gekrümmten dunklen Fängen (Krallen) unten.

Quelle: src/cardinal-beast-zhuque.png (59×44 px, 16 Farben).
PICK: [["MotiveEgypt", 4, 1]]      (Ebene „Zhuque #1“, Figur 1; Ebene 3 „Zhuque #2“ ist der weich verlaufende Feuerring der Kartenkunst (Alpha 50 %), Ebene 5 „Zhuque“ ein Bodenschatten — beides Szene)
Quelle vollständig: ja (Flügel, Körper, Kopf, Krallen in einer Ebene).

Aufruf:   python3 cardinal_beast_zhuque.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-zhuque.png + .json

Identifikation (x, y im 59×44-Sprite, spiegelsymmetrisch um x = 29):
* FLÜGEL (links x 0–25, rechts x 34–58, y 0–38): zum V gespreizte Flügel mit gezackter Außenkante (dunkelrot (111,19,8) / braun (123,62,0)); Federreihen in Dunkelrot (134,51,37), Lachs (160,74,61)/(201,103,64)/
  (216,129,101), Pfirsich (230,138,87)/(247,145,83); die VORDERKANTE (von den oberen Flügelspitzen bei (0–9, 0) schräg nach innen unten bis (24, 23)) ist ein helles Band aus
  Pfirsich/Gelb (255,190,91)/(255,200,131)/(247,145,83) mit braunem Innenrand (123,62,0).
* KÖRPER (x 26–33, y 18–43): schmaler Körper mit dunkelrotem Umriss (111,19,8); Kopf mit Federkrone (y 18–21, Zacken bei x 28/30/32), Gesicht y 22–27 mit vier hellrosa Pixeln (220,160,149) bei (27,24), (32,24),
  (27,26), (32,26) — sie könnten Augen sein; sicher ist es nicht, deshalb bleiben sie fest; Brustfedern y 28–35.
* KRALLEN (x 21–28 und 31–38, y 35–42): zwei gekrümmte dunkelgraue Fänge (55,59,70)/(68,73,79)/(90,90,92) mit schwarzem Umriss (35,12,0); Schwanzspitze/Schnabel mittig bei (28–30, 41–43).
Metall/Gold/Edelsteine: keine → kein Glanz (Regel 14). Feuer: der Vogel trägt kein Feuer im Sprite; die Kartenkunst umgibt ihn aber mit einem Feuerring — deshalb erhalten die oberen Flügelspitzen
kleine Flammen (anim_feuer.py, Regel 15), ausschaltbar mit FEUER_AN = False (Annahme, siehe Bericht).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos):
* FLÜGELSCHLAG: zweimal pro Schleife (Periode 24) schlagen beide Flügel: jede Spalte wandert senkrecht, je weiter außen desto mehr (Spitzen ≈ −5 … +5 px), die Spitze läuft der Wurzel etwas hinterher
  (Wellenlauf, Federbiegung); anim_flieger.fluegel_welle mit Zusammenhang-Erzwingung, Federtextur wird nur verschoben, nie kopiert. Die Flügelwurzeln am Körper (x 24–25 / 34–35) bewegen sich kaum.
* SCHWEBEN: der ganze Vogel hebt/senkt sich ±1 px gegenläufig zum Schlag (er fliegt, schwebt also).
* FLAMMEN (Regel 15): an jeder oberen Flügelspitze züngeln drei kleine Flammen (je 8–12 Posen, 2–3 Frames je Pose, Spitzen reißen ab und steigen als Funken auf); die Flammenfüße folgen der Flügelspitze.
Frame 0 = Ruhepose (Original, Flammen ausgenommen). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur Farben der Quelle.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur); die Flammen/Funken dürfen ihn höchstens 24 px über den Flügelschlag hinaus vergrößern, dazu 1 px leerer Rand.
Ergänzungen: keine gemalten Pixel außer den neu gezeichneten Flammen; Randpixel (Regel 16): anim_flieger.umranden setzt Randpixel in Nicht-Umrissfarbe auf Außenkantenfarben.
"""
import math
import sys

import numpy as np

import anim_feuer as FEU
import anim_flieger as F
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GPL, GPR, GPT, GPB = 6, 6, 30, 10
FEUER_AN = True

spr = L.lade('cardinal-beast-zhuque')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
UMRISS = F.umriss_farben(spr)
DUNKEL, BRAUN = (111, 19, 8), (123, 62, 0)
TEST_EBENEN = ('koerper',)

wing_l = vorhanden & (xx <= 25)
wing_r = vorhanden & (xx >= 34)
koerper_m = vorhanden & ~wing_l & ~wing_r
SPITZE_X = 10                                                                # obere Flügelspitze: Spalten 0–9 (links)


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, GPL, GPT)


WL0, WR0, KP0 = teil(wing_l), teil(wing_r), teil(koerper_m)
SPITZE0 = min(int(np.nonzero(WL0[:, GPL:GPL + SPITZE_X, 3].any(axis=1))[0].min()), 999)

# ── Feuer an den oberen Flügelspitzen (anim_feuer): Fuß = Zeile über der obersten Flügelzeile; jede Flamme folgt der Spalte, auf der sie steht ──
RAMPE = {'rand': (111, 19, 8), 'rot': (160, 74, 61), 'orange': (247, 145, 83), 'gelb': (255, 190, 91), 'hell': (255, 200, 131)}
SPERRE = np.zeros((H, W), bool)
SPERRE[GPT:GPT + 2, GPL:GPL + SPITZE_X + 2] = (WL0[GPT:GPT + 2, GPL:GPL + SPITZE_X + 2, 3] > 0)                      # oberste Flügelzeilen (feste Basis der Flammen)
SPERRE[GPT:GPT + 2, GPL + sw - SPITZE_X - 2:GPL + sw] = (WR0[GPT:GPT + 2, GPL + sw - SPITZE_X - 2:GPL + sw, 3] > 0)
FLAMMEN = []                                                                   # (Feuer, Spalte x im Sprite, linker Flügel?)
for g, (xs_, hs_) in enumerate(((2.3, 5.0), (5.0, 7.0), (7.7, 5.0))):
    for seite, x_ in (('l', xs_), ('r', sw - 1 - xs_)):
        fe = FEU.Feuer(H, W, [FEU.Zunge(GPL + x_, GPT - 1, hs_, 1.7)], RAMPE, n=N, seed=4 + 2 * g + (seite == 'r'), posen=12, amplitude=0.9, sperre=SPERRE)
        FLAMMEN.append((fe, int(round(x_)), seite == 'l'))


def flug(i):
    """(Phase des Flügelschlags, Schweben dy)."""
    ph = L.sinus(i, 24)
    return ph, int(round(-1.2 * math.sin(ph)))


def fluegel(i):
    ph, bob = flug(i)
    wl = F.fluegel_welle(WL0, GPL + 25, 5.0, ph, potenz=1.15, nur_rechts=False, lauf=0.5, zusammenhang=True)
    wr = F.fluegel_welle(WR0, GPL + 34, 5.0, ph, potenz=1.15, nur_rechts=True, lauf=0.5, zusammenhang=True)
    return wl, wr, bob


def spalten_oben(a, x0, x1):
    """Oberste belegte Zeile je Leinwandspalte x0..x1."""
    return max(int(np.nonzero(a[:, x, 3])[0].min()) for x in range(x0, x1 + 1) if a[:, x, 3].any())


FUSS0 = {}
for k, (fe, x_, links) in enumerate(FLAMMEN):
    a0 = WL0 if links else WR0
    FUSS0[k] = spalten_oben(a0, GPL + x_ - 1, GPL + x_ + 1)


def flammen_dy(i):
    """Versatz jeder Flamme im Frame i: ihre Spalten (x−1…x+1) liegen nach dem Flügelschlag um so viel höher/tiefer (tiefste der drei, damit der Fuß aufliegt) + Schweben."""
    wl, wr, bob = fluegel(i)
    return [spalten_oben(wl if links else wr, GPL + x_ - 1, GPL + x_ + 1) - FUSS0[k] + bob for k, (fe, x_, links) in enumerate(FLAMMEN)]


FDY = [flammen_dy(i) for i in range(N)]


def frame_gross(i, nur=None):
    wl, wr, bob = fluegel(i)
    f = L.zusammen(H, W, [(wl, 0, bob), (wr, 0, bob), (KP0, 0, bob)])
    F.umranden(f, [L.versetze(wl, 0, bob), L.versetze(wr, 0, bob)], UMRISS, BRAUN, DUNKEL, DUNKEL)
    if FEUER_AN and not nur:
        ebenen = [(f, 0, 0)]
        for k, (fe, x_, links) in enumerate(FLAMMEN):
            ebenen.append((L.versetze(fe.ebene(i), 0, FDY[i][k]), 0, 0))
            ebenen.append((fe.funken(i, dy=lambda g, k=k: FDY[g % N][k], leben=9), 0, 0))
        f = L.zusammen(H, W, ebenen)
    return f


def _frames(nur):
    return [frame_gross(i, nur) for i in range(N)]


BOX = U.zuschnitt(_frames(None), _frames(TEST_EBENEN), (GPL, GPT, GPL + sw, GPT + sh), zugabe=24, rand=2)
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    import os
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=2)
    print('Pixel je Frame:', n)
    r0 = frame(0, nur=TEST_EBENEN)
    ox, oy = PAD_L, PAD_T
    diff = [(x, y) for y in range(sh) for x in range(sw)
            if bool(r0[y + oy, x + ox, 3]) != bool(spr[y, x, 3]) or (spr[y, x, 3] and not np.array_equal(r0[y + oy, x + ox, :3], spr[y, x, :3]))]
    print('Ruhepose (ohne Feuer) weicht vom Original ab bei:', diff if diff else 'nichts')
    L.speichern('cardinal-beast-zhuque', 'Cardinal Beast Zhuque', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-zhuque-strip.png', frames, spalten=8, scale=3)
