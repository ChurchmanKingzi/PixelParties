# -*- coding: utf-8 -*-
"""Idle-Animation für „Cosmic Exploding Skull“ (Creature).

PICK: [["MotiveSteamDwarfs", 376, 1]]   Ebene „Cosmic Exploding Skull“ (MotiveSteamDwarfs.xcf, Ebene 376, 22×17 px, 7 Farben, nur Alpha 0/255) → src/cosmic-exploding-skull.png
(ganze Ebene, ein einziges 8-verbundenes Teil). Nicht verwendet: der violette Sternennebel dahinter (Ebenen 377/378) und der Boden der Karte.

Aufruf:   python3 cosmic_exploding_skull.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cosmic-exploding-skull.png + .json

Was im Sprite ist (Koordinaten im Sprite 22×17, x/y ab 0):
* Violetter Schädel (x 6–15, y 3–14): Fläche in Violett B=(77,0,122) und C=(111,0,176), Umriss/Beine in Nachtviolett A=(21,0,33); zwei zornige Augen als schräge Schlitze in
  Pastellgelb D=(255,255,99) bei (8, 7–8)/(9, 8) und (13, 7–8)/(12, 8); Mund: schwarz-violett offen bei (9–13, 10–13) mit einem hellgelben Zahn G=(255,255,164) bei (9, 12).
* Zündschnur: Faden A von der Schädeldecke (8–13, 3) über (7–10, 0–2) nach links unten; am Ende brennt ein kleiner gelb-weißer Funke E=(255,255,0), F=(255,255,255) bei (3–6, 1–4).
* Beine: vier violette 1-px-Diagonalen je Seite (links bei (0–6, 5–14), rechts bei (15–21, 5–14)) und zwei Füße unten bei (7, 15–16) und (14, 15–16).
* Es ist kein Metall, Gold oder Edelstein (violette Knochenfläche, „kosmisch“ nur durch die Farbe): daher KEIN Glanz und keine Glitzersterne (Regel 14). Es gibt keine
  Flammen im Sprite (Gelb/Weiß = Funken) — `anim_feuer.py` wird nicht verwendet (Modul unverändert); der Funke flackert als Funkenposen wie bei den anderen Skulls.
Hinweis Verbund: Das Sprite ist 8-verbunden (die Beine sind 1-px-Diagonalen); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden Teil besteht
und dass es keine offenen Randpixel gibt.
Fest bleiben: Schädelform, Umriss, Augenform, Mundform, Beine (bis auf die Fußspitzen), Zündschnur-Bogen.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos) — Konventionen der bisherigen Skulls:
* Hüpfer: der ganze Schädel hebt sich 1 px (Frames 2–10 und 26–34), sonst steht er (Frame 0 = Original).
* Zündfunke: der Funke am Schnurende flackert zwischen acht Gelb/Weiß-Posen (Pose 0 = Original, Posen 1–2 Frames; `anim_amorph.strahlenfunke`), dazu steigen acht 1-px-Funken
  (Weiß → Gelb → Pastellgelb) 2–3 px auf und kreiseln leicht (Partikel).
* Fußtritt: die Fußspitzen (7, 16) und (14, 16) heben sich abwechselnd (links Frames 10–13 und 34–37, rechts 22–25 und 44–47): der Fuß wird dann 1 px kürzer.
* Blinzeln: beide Augen (Frames 15–17 und 39–41, das rechte einen Frame später): Schlitz → halb zu → zu; die Lidfarbe ist die umgebende Schädelfarbe (je Pixel die häufigste Violettstufe
  im 2-px-Umkreis außerhalb der Augen). Sonst keine Farbwechsel an den Augen.
* KEIN Glanz, keine Glitzersterne (kein Metall/Gold/Edelstein).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Zündfunken + Hüpfer), 2 px unten — Figur zentriert; Funken liegen in der 2-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('cosmic-exploding-skull')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG = (21, 0, 33), (77, 0, 122), (111, 0, 176), (255, 255, 99), (255, 255, 0), (255, 255, 255), (255, 255, 164)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG):
    assert _c in _farben, _c
RAND0 = A.randpixel(spr)
SCHAEDEL = {CB, CC}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile ──
FUNKE = [(4, 1), (5, 2), (4, 3), (5, 3), (6, 3), (3, 4), (5, 4)]                      # (x, y) der Funkengruppe
FUNKE_MASKE = np.zeros((sh, sw), bool)
for (x, y) in FUNKE:
    FUNKE_MASKE[y, x] = True
assert all(OPAK[y, x] and _col(y, x) in (CE, CF) for (x, y) in FUNKE)
AUGEN = [[(7, 8), (8, 8), (8, 9)], [(7, 13), (8, 13), (8, 12)]]                       # (y, x): schräge Schlitze
for a in AUGEN:
    assert all(_col(y, x) == CD for (y, x) in a), [_col(y, x) for (y, x) in a]
_augpix = {p for a in AUGEN for p in a}
LID = {}
for (y, x) in _augpix:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in _augpix or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not OPAK[q]:
                continue
            c = _col(*q)
            if c not in SCHAEDEL:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

assert _col(16, 7) == CA and _col(16, 14) == CA
FUSS_L, FUSS_R = (16, 7), (16, 14)                                                      # (y, x) der Fußspitzen
LIFT_L = {10, 11, 12, 13, 34, 35, 36, 37}
LIFT_R = {22, 23, 24, 25, 44, 45, 46, 47}

_rnd = random.Random(99)
FUNKEN_POSE = [None] + [A.strahlenfunke(_rnd, (5, 2), CF, CE, kern_pixel=[(0, 0), (0, 1)], n_strahlen=(3, 4), laenge=(1, 3), box=(1, 0, 7, 5), dick=0.0) for _ in range(7)]
FOLGE_F = A.pose_folge(random.Random(13), 8, tempo=(1, 2))
HOP = [-1 if math.sin(2 * math.pi * i / 24) > 0.3 else 0 for i in range(N)]       # − = hoch
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
assert HOP[0] == 0 and FOLGE_F[0] == 0 and 0 not in LIFT_L and 0 not in LIFT_R and 0 not in BLINZELN_L

ZUENDFUNKEN = [(3, -1), (9, 0), (15, 1), (21, -1), (27, 0), (33, 1), (39, -1), (45, 0)]      # Startframe, seitlicher Weg


def sprite_mit_effekten(i):
    sp = spr.copy()
    if FOLGE_F[i]:
        sp[FUNKE_MASKE] = 0
        for (x, y), c in FUNKEN_POSE[FOLGE_F[i]].items():
            if 0 <= x < sw and 0 <= y < sh and not (OPAK[y, x] and not FUNKE_MASKE[y, x]):
                sp[y, x, :3] = c
                sp[y, x, 3] = 255
    for fuss, lift in ((FUSS_L, LIFT_L), (FUSS_R, LIFT_R)):
        if i in lift:
            sp[fuss[0], fuss[1]] = 0
    for k, a in enumerate(AUGEN):
        b = (BLINZELN_L if k == 0 else BLINZELN_R).get(i, 0)
        if b:
            ys = sorted({y for y, x in a})
            for (y, x) in a:
                if b == 2 or y == ys[0]:
                    sp[y, x, :3] = LID[(y, x)]
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    fig = L.zusammen(H, W, [(L.platz(sp, H, W, PAD_L, PAD_T), 0, HOP[i])])
    return dict(fig=fig)


def funken_ebene(i):
    e = L.leer(H, W)

    def pix(x, y, c):
        X, Y = PAD_L + x, PAD_T + y + HOP[i]
        if not (2 <= X < W - 2 and 2 <= Y < H - 2):
            return
        e[Y, X, :3] = c
        e[Y, X, 3] = 255

    for (f0, drift) in ZUENDFUNKEN:                                               # steigen 8 Frames vom Schnurende auf
        a = (i - f0) % N
        if a >= 8:
            continue
        x = 4 + drift * (a // 3) + int(round(0.7 * math.sin(2 * math.pi * a / 6.0)))
        y = 1 - int(round(0.28 * a))
        pix(x, y, CF if a < 3 else (CE if a < 6 else CG))
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())), '| Funke:', len(FUNKE))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    k8 = [int(cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)[0] - 1) for f in figs]
    k4 = [A.komponenten4(f[..., 3] > 0) for f in figs]
    print('8-Komponenten je Frame (soll überall 1):', sorted(set(k8)), '| 4-Komponenten (Original', A.komponenten4(OPAK), '):', sorted(set(k4)))
    schlecht = A.ausdruck_pruefen(figs, spr, 'cosmic-exploding-skull')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('cosmic-exploding-skull', 'Cosmic Exploding Skull', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cosmic-exploding-skull-strip.png', frames[::2], spalten=12, scale=8)
