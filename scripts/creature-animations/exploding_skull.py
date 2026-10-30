# -*- coding: utf-8 -*-
"""Idle-Animation für „Exploding Skull“ (Creature).

PICK: [["Motive", 75, 1]]   Ebene „Exploding Skull“ (Motive.xcf, Ebene 75, 29×19 px, 15 Farben, nur Alpha 0/255) → src/exploding-skull.png
(Der Treffer-Abgleich von creature_show.py findet für diese Karte nur die Nachbarfiguren der Szene — Ebene 73 „Exploding Skull #2“ sind der Held und das
Skelett links/rechts; das richtige Sprite ist die gleichnamige Ebene 75. Ebene 74 „Exploding Skull #1“ (8×6, halbtransparent) ist ein Augenschatten und
bleibt ungenutzt, Ebene 72 ein Lichtschleier der Karte.)
Nicht verwendet: Held und Skelett der Szene.

Aufruf:   python3 exploding_skull.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/exploding-skull.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Schädel (x 9–18, y 4–15): Knochen in Weiß/Hellgrau (D=(246,255,255), F, H, G, I), dunkler Umriss C=(26,26,26), zwei rote Augen zu je 2×2 px in vier Rotstufen
  J, K, L, M bei (11–12, 8–9) und (15–16, 8–9); unter dem Kiefer ein gelbes Glühen N=(244,244,0)/O=(255,255,116) bei (13–14, 12–13).
* Zündschnur: schwarzer Faden von der Schädeldecke (13, 2–3) nach links oben bis (11–12, 1); an ihrem Ende brennt ein gelb-weißer Funke bei (8–11, 0–3).
* Beine: schwarze 1-px-Diagonalen (B=(0,0,0)), je Seite zwei geschwungene Beine (links bei (3–8, 6–14), rechts bei (19–24, 6–14)) und zwei Füße unten bei (10, 16) und (17, 16).
* Zwei gelbe Blitzbögen A=(255,255,0) mit weißen Kernen E=(255,255,255): links von der freien Spitze (0–2, 10) abwärts bis zum linken Fuß (9–11, 17–18), rechts von
  der freien Spitze (27–28, 7–8) abwärts bis zum rechten Fuß (16–18, 17–18). Es ist Elektrizität/Funkenflug, kein Flammenfeuer (keine Rot-/Orangetöne im Sprite außer den Augen).
Hinweis Verbund: Das Sprite ist nur 8-verbunden (die Spinnenbeine sind 1-px-Diagonalen); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden Teil
besteht und dass die neu gezeichneten Blitzbögen selbst 4-verbunden sind.
Fest bleiben: Schädel, Beine, Augenform, Zündschnur.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Hüpfer: der ganze Skull hebt sich 1 px (Frames 2–10 und 26–34), sonst steht er (Frame 0 = Original).
* Blitzbögen: Sie knistern — jeder Bogen hat acht Posen (Pose 0 = Original), jede Pose steht 2–3 Frames, die beiden Bögen sind gegeneinander versetzt (Zufallsfolge, nahtlos über
  48 Frames). Die Füße (unterer Teil, Zeilen ≥ 14 bzw. ≥ 15) bleiben fest; der obere Teil ändert Weg, Knicke und freie Spitze; Kerne in Weiß E, Bogen in Gelb A.
* Zündfunke: der Funke am Schnurende flackert zwischen acht kleinen Gelb/Weiß-Gruppen (Frame 0 = Original); dazu steigen acht 1-px-Funken (Weiß → Gelb) in 8 Frames
  1–3 px auf und kreiseln leicht (Partikel).
* Kieferglühen: das Gelb unter dem Kiefer (4 px) flackert zwischen N, O, A und kurz Weiß E (fünf Zustände, 2–3 Frames) — wie Glut.
* Blinzeln: beide Augen (Frames 16–18 und 40–42, das linke einen Frame früher): rot → halb zu → zu; die Lidfarbe ist die umgebende Knochenfarbe (je Pixel die häufigste
  Knochenstufe im 2-px-Umkreis). Sonst keine Farbwechsel an den Augen.
* Funken an den freien Spitzen der Bögen: kurze 1-px-Funken (2 Frames), die 1–2 px abspringen (Partikel).
* KEIN Glanz (Regel 14): Knochen glänzen nicht.
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

spr = L.lade('exploding-skull')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG, CH, CI = (255, 255, 0), (0, 0, 0), (26, 26, 26), (246, 255, 255), (255, 255, 255), (213, 213, 213), (123, 123, 123), (189, 189, 189), (156, 156, 156)
CJ, CK, CL, CM, CN, CO = (128, 0, 0), (179, 0, 0), (153, 0, 0), (213, 0, 0), (244, 244, 0), (255, 255, 116)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO):
    assert _c in _farben, _c
RAND_FARBEN = A.umrissfarben(spr)
KNOCHEN = {CD, CF, CG, CH, CI}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


_gelb = OPAK & ((spr[..., 0] == 255) & (spr[..., 1] == 255) & (spr[..., 2] == 0) | (spr[..., 0] == 255) & (spr[..., 1] == 255) & (spr[..., 2] == 255))   # A (gelb) und E (weiß)
BOLT_L = _gelb & (yy >= 9) & (yy <= 14) & (xx <= 6)                                  # beweglicher Teil des linken Bogens (Füße ab Zeile 15 fest)
BOLT_R = _gelb & (yy >= 7) & (yy <= 13) & (xx >= 21)                                 # beweglicher Teil des rechten Bogens
FUSS_L = _gelb & (yy >= 15) & (xx <= 12)                                             # unterer Teil des linken Bogens (Nutzer-Feedback: auch er knistert)
FUSS_R = _gelb & (yy >= 14) & (xx >= 15)                                             # unterer Teil des rechten Bogens
FUNKE = _gelb & (yy <= 3) & (xx <= 11)                                               # Zündfunke am Schnurende
MUND = [(12, 13), (12, 14), (13, 13), (13, 14)]                                      # (y, x) des Kieferglühens: N, O / O, N
assert [_col(y, x) for (y, x) in MUND] == [CN, CO, CO, CN], [_col(y, x) for (y, x) in MUND]
AUGEN = [[(8, 11), (8, 12), (9, 11), (9, 12)], [(8, 15), (8, 16), (9, 15), (9, 16)]]
for a in AUGEN:
    assert all(_col(y, x) in (CJ, CK, CL, CM) for (y, x) in a)
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
            if c not in KNOCHEN:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

SCHWARZ = OPAK & (spr[..., 0] == 0) & (spr[..., 1] == 0) & (spr[..., 2] == 0)


def _linie(p, q):
    """8-verbundene Pixellinie von p nach q (Bresenham)."""
    (x0, y0), (x1, y1) = p, q
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if (x0, y0) == (x1, y1):
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def _bogen(rnd, seite):
    """Neuer beweglicher Teil eines Blitzbogens: freie Spitze → Zickzack mit 3–4 Knicken → fester Endpunkt; 2 px dick nach innen (so ist er 4-verbunden);
    weiße Kerne an den Knicken und am Endpunkt."""
    if seite == 'l':
        tip = (rnd.choice([0, 1, 1, 2]), rnd.choice([9, 10, 10, 11]))
        ende, innen, ys, lo, hi = (6, 14), 1, [10, 11, 12, 13], 1, 5
        x_aus, x_ein = 2, 5
    else:
        tip = (rnd.choice([28, 28, 27]), rnd.choice([7, 8, 8]))
        ende, innen, ys, lo, hi = (22, 13), -1, [8, 9, 10, 11, 12], 22, 27
        x_aus, x_ein = 26, 23
    n = rnd.choice([3, 4]) if seite == 'l' else rnd.choice([3, 4, 4])
    ys = sorted(rnd.sample(ys, n))
    start = rnd.choice([0, 1])
    verts = []
    for k, y in enumerate(ys):
        x = (x_aus if (k + start) % 2 == 0 else x_ein) + rnd.choice([-1, 0, 0, 1])
        verts.append((min(hi, max(lo, x)), y))
    way = [tip] + verts + [ende]
    out = {}
    for p, q in zip(way[:-1], way[1:]):
        for (x, y) in _linie(p, q):
            out[(x, y)] = CA
            out.setdefault((x + innen, y), CA)
    kerne = [v for v in verts if rnd.random() < 0.7] + [ende]
    for p in kerne:
        out[p] = CE
    return out


def _fuss(rnd, seite):
    """Neuer unterer Teil eines Blitzbogens: fester Anschluss an den oberen Bogen → Zickzack → fester Endpunkt am Fuß; 2 px dick nach innen; weiße Kerne."""
    if seite == 'l':
        start, ende, innen, lo, hi = (6, 15), (10, 18), 1, 5, 11
    else:
        start, ende, innen, lo, hi = (22, 14), (17, 18), -1, 16, 22
    n = rnd.choice([1, 2])
    ys = sorted(rnd.sample([start[1] + 1, start[1] + 2, ende[1] - 1], n))
    verts = []
    for y in ys:
        t = (y - start[1]) / max(1, ende[1] - start[1])
        x = int(round(start[0] + (ende[0] - start[0]) * t)) + rnd.choice([-1, 0, 1])
        verts.append((min(hi, max(lo, x)), y))
    way = [start] + verts + [ende]
    out = {}
    for p, q in zip(way[:-1], way[1:]):
        for (x, y) in _linie(p, q):
            out[(x, y)] = CA
            out.setdefault((x + innen, y), CA)
    for p in [v for v in verts if rnd.random() < 0.6] + [start, ende]:
        out[p] = CE
    return out


def _funke(rnd):
    """Gelb-weiße Gruppe am Schnurende (Spitze bei (10,1)); unregelmäßig, keine Kreuzform."""
    muster = rnd.choice([
        [(0, 0, CE), (0, 1, CE), (-1, 1, CA), (1, 0, CA), (-1, -1, CA)],
        [(0, 0, CE), (-1, 0, CA), (0, 1, CA), (1, 1, CA), (1, -1, CA)],
        [(0, 0, CE), (0, -1, CE), (1, 0, CA), (-1, 1, CA)],
        [(0, 0, CE), (1, 0, CE), (0, 1, CA), (-1, 0, CA), (1, -1, CA), (2, 1, CA)],
        [(0, 0, CE), (-1, -1, CA), (0, 1, CA), (-1, 1, CA), (1, 0, CA)],
        [(0, 0, CE), (0, 1, CE), (1, 1, CA), (-1, 0, CA), (0, -1, CA)],
        [(0, 0, CE), (-1, 0, CE), (0, -1, CA), (1, 1, CA), (-1, 1, CA)],
    ])
    return {(10 + dx, 1 + dy): c for dx, dy, c in muster}


def _pose_folge(rnd, n_posen, n=N, tempo=(2, 3)):
    """Folge von Posenindizes je Frame (Pose 0 am Anfang, jede Pose 2–3 Frames, nahtlos wiederholbar)."""
    ablauf, rest = [0] * 3, []
    while len(ablauf) < n:
        if not rest:
            rest = list(range(1, n_posen))
            rnd.shuffle(rest)
        ablauf += [rest.pop()] * rnd.randint(*tempo)
    return ablauf[:n]


_rnd = random.Random(2024)
BOGEN_L = [None] + [_bogen(_rnd, 'l') for _ in range(7)]                              # None = Original (Pose 0)
BOGEN_R = [None] + [_bogen(_rnd, 'r') for _ in range(7)]
FUNKEN_POSE = [None] + [_funke(_rnd) for _ in range(7)]
FUSS_POSE_L = [None] + [_fuss(_rnd, 'l') for _ in range(5)]
FUSS_POSE_R = [None] + [_fuss(_rnd, 'r') for _ in range(5)]
FOLGE_L = _pose_folge(random.Random(5), 8)
FOLGE_R = _pose_folge(random.Random(9), 8)
FOLGE_F = _pose_folge(random.Random(13), 8, tempo=(1, 2))
FOLGE_FL = _pose_folge(random.Random(21), 6)
FOLGE_FR = _pose_folge(random.Random(34), 6)
MUND_ZUSTAENDE = [[CN, CO, CO, CN], [CO, CN, CN, CO], [CA, CO, CO, CA], [CO, CE, CE, CO], [CN, CA, CA, CN]]
FOLGE_M = [0, 0, 0] + sum([[k] * d for k, d in zip([1, 2, 4, 1, 3, 0, 2, 1, 4, 3, 0, 2, 4, 1, 0, 3, 2, 0], [2, 3, 2, 2, 1, 3, 2, 3, 2, 1, 3, 2, 2, 3, 2, 2, 3, 2])], [])
FOLGE_M = (FOLGE_M + [0] * N)[:N]
HOP = [0] * N                                                                       # Nutzer-Feedback: der Skull schwebt/hüpft nicht, er steht
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
assert HOP[0] == 0 and FOLGE_FL[0] == 0 and FOLGE_FR[0] == 0 and FOLGE_L[0] == 0 and FOLGE_R[0] == 0 and FOLGE_F[0] == 0 and FOLGE_M[0] == 0

# Zündfunken (steigen vom Schnurende auf): Startframe, seitlicher Weg
ZUENDFUNKEN = [(3, -1), (9, 0), (15, 1), (21, -1), (27, 0), (33, 1), (39, -1), (45, 0)]
# Funken an den freien Spitzen der Bögen (x, y im Sprite, Startframe, Richtung)
SPITZENFUNKEN = [(-1, 9, 1, -1), (29, 6, 7, 1), (-1, 11, 13, -1), (29, 9, 19, 1), (-1, 10, 25, -1), (29, 7, 31, 1), (-1, 8, 37, -1), (29, 8, 43, 1)]


def _setze(sp, pixel, bereich):
    """Bereich (Maske) leeren, danach die Pixel {(x,y): Farbe} setzen (nicht auf schwarze Beine)."""
    sp[bereich] = 0
    for (x, y), c in pixel.items():
        if not (0 <= x < sw and 0 <= y < sh):
            continue
        if SCHWARZ[y, x]:
            continue
        sp[y, x, :3] = c
        sp[y, x, 3] = 255


def sprite_mit_effekten(i):
    sp = spr.copy()
    if FOLGE_L[i]:
        _setze(sp, BOGEN_L[FOLGE_L[i]], BOLT_L)
    if FOLGE_R[i]:
        _setze(sp, BOGEN_R[FOLGE_R[i]], BOLT_R)
    if FOLGE_FL[i]:
        _setze(sp, FUSS_POSE_L[FOLGE_FL[i]], FUSS_L)
    if FOLGE_FR[i]:
        _setze(sp, FUSS_POSE_R[FOLGE_FR[i]], FUSS_R)
    if FOLGE_F[i]:
        _setze(sp, FUNKEN_POSE[FOLGE_F[i]], FUNKE)
    for (y, x), c in zip(MUND, MUND_ZUSTAENDE[FOLGE_M[i]]):
        sp[y, x, :3] = c
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
        x = 10 + drift * (a // 3) + int(round(0.7 * math.sin(2 * math.pi * a / 6.0)))
        y = 1 - int(round(0.28 * a))
        pix(x, y, CE if a < 3 else (CO if a < 6 else CA))
    for (x0, y0, f0, d) in SPITZENFUNKEN:                                         # 2 Frames, springen 1–2 px ab
        a = (i - f0) % N
        if a >= 2:
            continue
        pix(x0 + d * a * 0, y0 - a, CA if a == 0 else CE)
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())),
          '| bewegliche Bogenpixel:', int(BOLT_L.sum()), int(BOLT_R.sum()), '| Funke:', int(FUNKE.sum()))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    k8 = [int(cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)[0] - 1) for f in figs]
    k4 = [A.komponenten4(f[..., 3] > 0) for f in figs]
    print('8-Komponenten je Frame (soll überall 1):', sorted(set(k8)), '| 4-Komponenten (Original 17):', sorted(set(k4)))
    schlecht = A.ausdruck_pruefen(figs, spr, 'exploding-skull')
    L.speichern('exploding-skull', 'Exploding Skull', frames, MS, prev)
    if prev:
        L.streifen(prev + '/exploding-skull-strip.png', frames[::2], spalten=12, scale=6)
