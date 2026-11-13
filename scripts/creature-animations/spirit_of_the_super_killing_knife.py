# -*- coding: utf-8 -*-
"""Idle-Animation für „Spirit of the Super-Killing Knife“ (Creature).

PICK: [["MotiveGrailWar", 664, 1]]
Quelle: src/spirit-of-the-super-killing-knife.png (31×23 px, 27 Farben) = Ebene 664 „Knife Spirit“, vollständig (Ebene 677 enthält dieselbe Figur). Gegen die Kartenkunst abgeglichen
(Mauer, Wiese, Erdhaufen sind Szene).

Was ist was (x/y im Sprite):
* Gestalt mit blondem Pagenkopf (x 10–21, y 0–9), grauem, maskenhaftem Gesicht mit blauen Augen (x 13–14 und 17–18, y 7–8; Maske/unklar → kein Blinzeln), dunkelgrauem Gewand (x 11–20, y 9–22).
* Zwei Messer, überkreuz nach außen-oben gehalten: Klingen hellgrau/weiß diagonal von den Händen (x 9–10 bzw. 21–22, y 10–12) nach links oben (bis (3, 6)) und rechts oben (bis (28, 6)); weiße
  Schneidenkanten daneben. Starr.
* Zwei blonde Zöpfe hängen links und rechts herab (x 6–9 und 22–27, y 12–19), oben mit weißer Manschette.
* Weiße Sparkles (Glanz der Klingen, Quelle): großer Stern rechts oben (25, 4), kleine Kreuze bei (8, 8), (1, 9), (29, 13), (22, 17), großer Stern links (4, 15).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* Sparkles blitzen einzeln und versetzt (voll → klein → aus → klein → voll; die kleinen Kreuze nur voll/aus, damit keine Einzelpunkte entstehen); sie bleiben an ihrem Platz.
* Klingen (Metall): abwechselnd läuft ein Lichtband die linke (Frames 4–13) und die rechte Klinge (Frames 28–37) entlang (eine Stufe heller auf der Klingen-Rampe).
* Zöpfe pendeln: die unteren Zeilen der Zöpfe schwingen 1 px nach links/rechts (Periode 24, beide Zöpfe gegenläufig); der Ansatz bleibt.
* Atmen: Gewandzeile 20 wird texturiert eingefügt (0–1 px, Periode 24); Oberkörper, Kopf, Messer und Zöpfe heben sich starr mit. Kopf nie seitlich.
ERGÄNZUNGEN (unter Sparkles, sichtbar wenn sie aus sind): Zopfumriss (6, 15), (23, 17), (22, 18) in Umrissbraun (55,29,6).
Nur ganze Pixel, nur Farben der Quelle.
"""
import math

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n2 as N2
import anim_textur as TX
TX.umleiten()

N, MS = 48, 70
FIG = N2.Figur('spirit-of-the-super-killing-knife', pad=(2, 2, 3, 2))
spr = FIG.spr
xx, yy = FIG.xx, FIG.yy
OFF = FIG.off
H, W = FIG.H, FIG.W

WEISS = FIG.farbe((255, 255, 255))
BRAUN = FIG.farbe((55, 29, 6))
KLINGE = FIG.farbe((184, 184, 184), (204, 204, 204), (232, 232, 232), (255, 255, 255))
BLOND = FIG.farbe((55, 29, 6), (238, 209, 107), (217, 171, 94), (178, 138, 79), (255, 230, 131), (240, 214, 119))

STERNE = [
    ([(25, 3), (24, 4), (26, 4), (25, 5)], [(25, 2), (23, 4), (27, 4), (25, 6)], 24, 0),
    ([(8, 7), (7, 8), (9, 8), (8, 9)], [], 16, 2),
    ([(1, 8), (0, 9), (2, 9), (1, 10)], [], 16, 14),
    ([(4, 14), (3, 15), (5, 15), (4, 16)], [(4, 13), (2, 15), (6, 15), (4, 17)], 24, 6),
    ([(29, 12), (28, 13), (30, 13), (29, 14)], [], 16, 5),
    ([(22, 16), (21, 17), (23, 17), (22, 18)], [], 24, 22),
]
TAKT = {24: [2] * 10 + [1] * 2 + [0] * 8 + [1] * 2 + [2] * 2, 16: [2] * 6 + [1] * 2 + [0] * 4 + [1] * 2 + [2] * 2}
ERLAUBT = Hm.umrissfarben(spr)
M_STERN = np.zeros((FIG.sh, FIG.sw), bool)
for inn, aus, _, _ in STERNE:
    for (x, y) in inn + aus:
        assert FIG.f(x, y) == WEISS, (x, y)
        M_STERN[y, x] = True
UNTER = {(6, 15): BRAUN, (23, 17): BRAUN, (22, 18): BRAUN}

ZOPF_L = FIG.op & ~M_STERN & (yy >= 13) & (xx <= 9) & (FIG.maske(BLOND) | FIG.maske([WEISS]))
ZOPF_R = FIG.op & ~M_STERN & (yy >= 13) & (xx >= 22) & (FIG.maske(BLOND) | FIG.maske([WEISS]))
KOERPER = FIG.op & ~M_STERN & ~ZOPF_L & ~ZOPF_R
M_KL_L = FIG.maske(KLINGE[:3]) & (xx <= 9) & (yy <= 12)
M_KL_R = FIG.maske(KLINGE[:3]) & (xx >= 22) & (yy <= 12)


def frame(i, nur=None):
    ko = FIG.platz(KOERPER)
    Hm.lichtband(ko, M_KL_L, OFF, i, N, 4, 10, KLINGE, stufen=1, breite=2.5, achse=(1.0, 1.0))
    Hm.lichtband(ko, M_KL_R, OFF, i, N, 28, 10, KLINGE, stufen=1, breite=2.5, achse=(-1.0, 1.0))
    zl, zr = FIG.platz(ZOPF_L), FIG.platz(ZOPF_R)
    N2.setze(zl, OFF, {(6, 15): BRAUN}, neu=True)
    N2.setze(zr, OFF, {(23, 17): BRAUN, (22, 18): BRAUN}, neu=True)
    zl = L.zeilen_welle(zl, FIG.pt + 13, 1.2, L.sinus(i, 24), potenz=1.5)
    zr = L.zeilen_welle(zr, FIG.pt + 13, -1.2, L.sinus(i, 24), potenz=1.5)
    for z in (zl, zr):
        oben = z[:FIG.pt + 16].copy()
        Hm.kontur_schliessen(z, ERLAUBT, BRAUN)
        z[:FIG.pt + 16] = oben                      # verschobene Zopfzeilen: Außenkante bleibt Umrissbraun
    fig = L.zusammen(H, W, [(zl, 0, 0), (zr, 0, 0), (ko, 0, 0)])
    fig = TX.streck_zeile(fig, FIG.pt + 20, N2.hub(i, 24, 1))
    if nur == 'koerper':
        return fig
    st = L.leer(H, W)
    for inn, aus, takt, off in STERNE:
        s = TAKT[takt][(i + off) % takt]
        if not aus:
            s = 2 if s >= 1 else 0
        pts = (inn if s >= 1 else []) + (aus if s >= 2 else [])
        N2.setze(st, OFF, {p: WEISS for p in pts}, neu=True)
    return L.zusammen(H, W, [(fig, 0, 0), (st, 0, 0)])


if __name__ == '__main__':
    N2.haupt(__import__(__name__), 'Spirit of the Super-Killing Knife')
