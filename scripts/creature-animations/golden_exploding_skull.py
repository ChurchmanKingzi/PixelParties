# -*- coding: utf-8 -*-
"""Idle-Animation für „Golden Exploding Skull“ (Creature).

PICK: [["MotiveSteamDwarfs", 234, 2]]   Ebene „Golden Exploding Skull“ (MotiveSteamDwarfs.xcf, 42×36 px mit vier Figuren; Figur 2 = der Schädel, 22×17 px, 8 Farben,
nur Alpha 0/255) → src/golden-exploding-skull.png. Die drei vierzackigen Sterne derselben Ebene (oben, links, unten rechts) sind das Glitzern der Kartenkunst und
nicht Teil der Creature; sie werden hier nicht übernommen (die Sterne dieser Animation entstehen neu an den goldenen Stellen).

Aufruf:   python3 golden_exploding_skull.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/golden-exploding-skull.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Goldener Schädel (x 7–14, y 3–14): Umriss in Orange B=(238,100,40), Fläche in Hellgelb C=(247,247,173), Gold D=(250,213,74) und Orangegold E=(242,154,62); zwei Augen zu je
  2×2 px aus dunklem Rot A=(148,27,0) mit rotem Lichtpunkt G=(201,45,0) bei (8–9, 7–8) und (12–13, 7–8); Nasenlöcher A/G bei (10–11, 11–12); Zähne/Kiefer in C bei (9–12, 13).
* Zündschnur: goldener Bogen (D, C, E) von der Schädeldecke (10–11, 2–3) über (7–10, 0–2) nach links; am Ende brennt ein gelb-weißer Funke F=(255,255,0), H=(255,255,255)
  bei (3–6, 1–4) mit einem orangen Pixel B bei (6, 2).
* Beine: vier dunkelrote 1-px-Diagonalen A je Seite (links bei (0–5, 5–14), rechts bei (16–21, 5–14)) und zwei Füße unten bei (7, 15–16) und (14, 15–16).
* Es gibt kein Flammenfeuer im Sprite (das Orange ist das Gold-/Umrissmaterial des Schädels, Rot nur in Beinen und Augen); das gelb-weiße Zündfunken-Pixelgrüppchen ist nur 8 px
  groß — daher wird `anim_feuer.py` hier nicht verwendet (wie bei der Basiskarte): der Funke flackert als Funkengruppe mit abkühlenden Funken.
Hinweis Verbund: Das Sprite ist nur 8-verbunden (die Beine sind 1-px-Diagonalen); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden Teil besteht
und dass es keine offenen Randpixel gibt.
Fest bleiben: Schädelform, Beine, Augenform, Zündschnur-Bogen.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos) — Konventionen der Basiskarte, soweit sie zu diesem Sprite passen (Hüpfer, Zündfunke, Blinzeln); die Blitzbögen gibt es hier nicht:
* Hüpfer: der ganze Schädel hebt sich 1 px (Frames 2–10 und 26–34), sonst steht er (Frame 0 = Original).
* Zündfunke: der Funke am Schnurende flackert zwischen acht Gelb/Weiß/Orange-Gruppen (Pose 0 = Original, Posen 2–3 Frames); dazu steigen acht 1-px-Funken (Weiß → Gelb →
  Orange → Dunkelrot) 2–3 px auf und kreiseln leicht (Partikel).
* Blinzeln: beide Augen (Frames 16–18 und 40–42, das linke einen Frame früher): dunkelrot → halb zu → zu; die Lidfarbe ist die umgebende Körperfarbe (je Pixel die häufigste Goldstufe
  im 2-px-Umkreis außerhalb der Augen). Sonst keine Farbwechsel an den Augen.
* Goldglanz (Regel 14: Gold): zweimal pro Schleife (Frames 4–12 und 28–36) zieht ein schmales diagonales Lichtband über die goldenen Flächen des Schädels (eine Stufe heller auf der
  Gold-Rampe E→D→C→H); dazu blitzen vierzackige Glitzersterne an vier hellen Stellen des Schädels auf (Stirn (10,4), Wangen (7,6) und (14,6), Kinn (11,10) — nie über Augen oder Nase) (5 Frames Lauf, wachsen/schrumpfen). Umrisse, Beine, Augen und Nase glänzen nicht.
* Goldstaub (Partikel): sechs kleine runde Goldpunkte (Formen k/s, Farben C und D) steigen langsam neben dem Schädel auf.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Zündfunken + Hüpfer), 2 px unten — Figur zentriert; Funken/Staub liegen in der 2-px-Zone um die Figur.
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

spr = L.lade('golden-exploding-skull')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG, CH = (148, 27, 0), (238, 100, 40), (247, 247, 173), (250, 213, 74), (242, 154, 62), (255, 255, 0), (201, 45, 0), (255, 255, 255)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH):
    assert _c in _farben, _c
RAND0 = A.randpixel(spr)
GOLD = {CC, CD, CE}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile ──
FUNKE = [(4, 1), (5, 2), (6, 2), (4, 3), (5, 3), (6, 3), (3, 4), (5, 4)]                # (x, y) der Zündfunken-Gruppe
FUNKE_MASKE = np.zeros((sh, sw), bool)
for (x, y) in FUNKE:
    FUNKE_MASKE[y, x] = True
assert all(OPAK[y, x] for (x, y) in FUNKE)
AUGEN = [[(7, 8), (7, 9), (8, 8), (8, 9)], [(7, 12), (7, 13), (8, 12), (8, 13)]]      # (y, x)
for a in AUGEN:
    assert all(_col(y, x) in (CA, CG) for (y, x) in a), [(_col(y, x)) for (y, x) in a]
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
            if c not in GOLD:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

GOLDMASKE = OPAK & ~RAND0 & ((spr[..., 0:3] == np.array(CC)).all(axis=2) | (spr[..., 0:3] == np.array(CD)).all(axis=2) | (spr[..., 0:3] == np.array(CE)).all(axis=2))
GOLDMASKE &= (xx >= 7) & (xx <= 14) & (yy >= 3) & (yy <= 14)
HELLER = {CE: CD, CD: CC, CC: CH}
STERN_FARBEN = {'m': CH, 'a': CC, 's': CD}
STAUBFARBEN = {'c': CC, 'r': CD}
SWEEPS = [4, 28]
ORTE = {'a': (10, 4), 'b': (14, 6), 'c': (7, 6), 'd': (11, 10)}                  # Stirn, Wangen — nie über Augen oder Nase
STERN_LAUF = [0, 1, 2, 1, 0]
STERNE = [(s0 + d, o) for s0 in SWEEPS for (o, d) in (('a', 1), ('c', 2), ('b', 4), ('d', 5))]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


def _funke(rnd):
    """Gelb-weiß-orange Gruppe am Schnurende (Spitze bei (5,2)); unregelmäßig, keine Kreuzform."""
    muster = rnd.choice([
        [(0, 0, CH), (0, 1, CH), (-1, 1, CF), (1, 0, CB), (-1, -1, CF)],
        [(0, 0, CH), (-1, 0, CF), (0, 1, CF), (1, 1, CF), (1, 0, CB)],
        [(0, 0, CH), (0, -1, CH), (1, 0, CB), (-1, 1, CF)],
        [(0, 0, CH), (1, 0, CH), (0, 1, CF), (-1, 0, CF), (1, -1, CF), (1, 1, CB)],
        [(0, 0, CH), (-1, -1, CF), (0, 1, CF), (-1, 1, CF), (1, 0, CB)],
        [(0, 0, CH), (0, 1, CH), (1, 1, CF), (-1, 0, CF), (0, -1, CB)],
        [(0, 0, CH), (-1, 0, CH), (0, -1, CF), (1, 1, CB), (-1, 1, CF)],
    ])
    return {(5 + dx, 2 + dy): c for dx, dy, c in muster}


def _pose_folge(rnd, n_posen, n=N, tempo=(2, 3)):
    ablauf, rest = [0] * 3, []
    while len(ablauf) < n:
        if not rest:
            rest = list(range(1, n_posen))
            rnd.shuffle(rest)
        ablauf += [rest.pop()] * rnd.randint(*tempo)
    return ablauf[:n]


_rnd = random.Random(777)
FUNKEN_POSE = [None] + [_funke(_rnd) for _ in range(7)]
FOLGE_F = _pose_folge(random.Random(13), 8, tempo=(1, 2))
HOP = [-1 if math.sin(2 * math.pi * i / 24) > 0.3 else 0 for i in range(N)]       # − = hoch
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
assert HOP[0] == 0 and FOLGE_F[0] == 0

ZUENDFUNKEN = [(3, -1), (9, 0), (15, 1), (21, -1), (27, 0), (33, 1), (39, -1), (45, 0)]      # Startframe, seitlicher Weg
PUFFS = [
    dict(x=PAD_L + 1, y=PAD_T + 15, vx=-1, vy=-7, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 14, vx=1, vy=-7, off=4, form='s', wackeln=1),
    dict(x=PAD_L + 1, y=PAD_T + 11, vx=0, vy=-6, off=8, form='k', wackeln=0),
    dict(x=PAD_L + 19, y=PAD_T + 10, vx=1, vy=-6, off=12, form='k', wackeln=1),
    dict(x=PAD_L + 3, y=PAD_T + 14, vx=-1, vy=-7, off=16, form='s', wackeln=0),
    dict(x=PAD_L + 17, y=PAD_T + 15, vx=1, vy=-7, off=20, form='k', wackeln=1),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    if FOLGE_F[i]:
        sp[FUNKE_MASKE] = 0
        for (x, y), c in FUNKEN_POSE[FOLGE_F[i]].items():
            if 0 <= x < sw and 0 <= y < sh and not (OPAK[y, x] and not FUNKE_MASKE[y, x]):
                sp[y, x, :3] = c
                sp[y, x, 3] = 255
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 9:
            t = 3 * (i - s0) + 6
            sp = A.farb_schritt(sp, HELLER, GOLDMASKE & (xx + yy >= t) & (xx + yy < t + 4))
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
            raise L.ClipError(f'Funke bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
        e[Y, X, :3] = c
        e[Y, X, 3] = 255

    for (f0, drift) in ZUENDFUNKEN:                                               # steigen 8 Frames vom Schnurende auf
        a = (i - f0) % N
        if a >= 8:
            continue
        x = 4 + drift * (a // 3) + int(round(0.7 * math.sin(2 * math.pi * a / 6.0)))
        y = 1 - int(round(0.28 * a))
        pix(x, y, CH if a < 3 else (CF if a < 5 else (CB if a < 7 else CA)))
    return e


def sterne_ebene(i):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        A.stern(e, PAD_L + x, PAD_T + y + HOP[i], stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    staub = L.puff_ebene(H, W, i, 24, PUFFS, STAUBFARBEN)
    return L.zusammen(H, W, [(staub, 0, 0), (f['fig'], 0, 0), (funken_ebene(i), 0, 0), (sterne_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())), '| Goldfläche (Glanzmaske):', int(GOLDMASKE.sum()))
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
    schlecht = A.ausdruck_pruefen(figs, spr, 'golden-exploding-skull')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('golden-exploding-skull', 'Golden Exploding Skull', frames, MS, prev)
    if prev:
        L.streifen(prev + '/golden-exploding-skull-strip.png', frames[::2], spalten=12, scale=6)
