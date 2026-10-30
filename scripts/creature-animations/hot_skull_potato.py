# -*- coding: utf-8 -*-
"""Idle-Animation für „Hot Skull Potato“ (Creature).

PICK: [["MotiveArcanum", 113, 1]]   Ebene „Ebene #46“ (MotiveArcanum.xcf, Ebene 113, 19×17 px) → src/hot-skull-potato.png (15×15 px, 9 Farben, nur Alpha 0/255)
Die Ebene ist ein fliegender Schädel mit Bewegungsschmier: links vom Schädel und am Zündfunken hängt ein halbtransparenter Schweif (Alpha 1–249), der in dieser
Animation nicht verwendbar ist (kein Alpha). Das Sprite ist deshalb aus der Ebene abgeleitet — das ist die einzige Quelle:
  * nur Pixel mit Alpha ≥ 170 (Schädel, Zündschnur, Funke), der Schmier links vom Schädel (x ≤ 8, y ≥ 5; braune Weichzeichnerpixel) entfällt;
  * Schmier-/Weichzeichnerfarben am Schädel sind auf die sauberen Farben der Ebene geschnappt: Braunstich (r − b ≥ 20) → Umriss (49,24,0), sehr dunkel → Schwarz (0,0,0),
    sonst die nächste der fünf Grau-/Weißstufen der Ebene (246,255,255), (213,213,213), (189,189,189), (156,156,156), (123,123,123); die Funkenpixel → Gelb (255,255,0)
    bzw. Weißgrau (242,242,242).
  Es kommt keine Farbe hinzu, die nicht in der Ebene steht. Nicht verwendet: die Szene (Gewölbe, die zwei Figuren, Lichtkegel).

Aufruf:   python3 hot_skull_potato.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hot-skull-potato.png + .json

Was im Sprite ist (Koordinaten im Sprite 15×15, x/y ab 0):
* Schädel (x 5–14, y 3–14): Knochen in Weiß B=(246,255,255) und Grau D/F/H/E mit braunem Umriss A=(49,24,0); zwei schwarze Augenhöhlen (1 px) bei (8, 8) und (12, 8); unten ein
  offener, schwarzer Mund (Zeilen 10–13) mit grauen Zähnen.
* Zündschnur: schwarzer Faden (Bogen) von der Schädeldecke (9, 2) über die Oberkante (5–8, 0–1) nach links unten zum Funken; am Ende brennt ein gelb-weißer Funke
  G=(255,255,0), I=(242,242,242) bei (0–2, 1–4).
* Es gibt keine Rot-/Orange-Flammenfarben im Sprite (Gelb/Weiß = Funkenflug an der Schnur), daher wird `anim_feuer.py` hier nicht verwendet (Modul unverändert): der
  Funke flackert als Funkengruppe wie beim Exploding Skull.
Hinweis Verbund: Das Sprite ist 8-verbunden (der Faden hängt über Pixelecken, der Funke an der Schnur); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden
Teil besteht und dass es keine offenen Randpixel gibt.
Fest bleiben: Schädelform, Umriss, Zähne, Fadenbogen.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Heißer Hüpfer: der ganze Schädel hüpft zweimal pro Schleife bis zu 2 px (Frames 2–10 und 26–34, Spitze in 4–8 bzw. 28–32); sonst steht er (Frame 0 = Original).
* Zittern: in den Hüpfern (Frames 4–8 und 28–32) rattert der Schädel samt Umriss 1 px nach links und rechts (der Faden bleibt, er hängt 4-verbunden an der Schädeldecke).
* Zündfunke: der Funke am Schnurende flackert zwischen acht Gelb/Weiß-Gruppen (Pose 0 = Original, Posen 1–2 Frames); dazu steigen acht 1-px-Funken (Weiß → Gelb → Hellgrau)
  2–3 px auf und kreiseln leicht (Partikel).
* Dampf (Partikel): sechs kleine runde Dampfpunkte (Formen k/s, Weißgrau/Grau) steigen links und rechts vom heißen Schädel auf.
* Blinzeln: beide Augenhöhlen (Frames 15–16/39–40 links, 16–17/40–41 rechts) schließen sich 2 Frames lang; die Lidfarbe ist die umgebende Knochenfarbe (je Pixel die häufigste
  Knochenstufe im 2-px-Umkreis). Sonst keine Farbwechsel.
* KEIN Glanz (Regel 14): Knochen glänzen nicht.
Frame: Sprite plus 3 px links/rechts, 4 px oben (Zündfunken + Hüpfer), 2 px unten — Figur zentriert; Funken/Dampf liegen in der 2-px-Zone um die Figur.
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

spr = L.lade('hot-skull-potato')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG, CH, CI = (49, 24, 0), (246, 255, 255), (0, 0, 0), (213, 213, 213), (123, 123, 123), (189, 189, 189), (255, 255, 0), (156, 156, 156), (242, 242, 242)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI):
    assert _c in _farben, _c
RAND0 = A.randpixel(spr)
KNOCHEN = {CB, CD, CF, CH, CE}


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile ──
SCHAEDEL = OPAK & (xx >= 5) & (yy >= 3)                                              # Schädel samt Umriss (zittert)
FUNKE = [(1, 1), (2, 2), (1, 3), (2, 3), (0, 4), (2, 4)]                              # (x, y) der Funkengruppe
FUNKE_MASKE = np.zeros((sh, sw), bool)
for (x, y) in FUNKE:
    FUNKE_MASKE[y, x] = True
assert all(OPAK[y, x] for (x, y) in FUNKE)
FAEDEN = OPAK & ~SCHAEDEL & ~FUNKE_MASKE
AUGEN = [[(8, 8)], [(8, 12)]]                                                         # (y, x): schwarze Augenhöhlen
for a in AUGEN:
    assert all(_col(y, x) == CC for (y, x) in a), [_col(y, x) for (y, x) in a]
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


def _funke(rnd):
    """Gelb-weiße Gruppe am Schnurende (Spitze bei (2,2)); unregelmäßig, keine Kreuzform."""
    muster = rnd.choice([
        [(0, 0, CI), (0, 1, CI), (-1, 1, CG), (-1, -1, CG), (0, 2, CG)],
        [(0, 0, CI), (-1, 0, CG), (0, 1, CG), (-1, 2, CG), (0, -1, CG)],
        [(0, 0, CI), (0, -1, CI), (-1, 0, CG), (-1, 2, CG)],
        [(0, 0, CI), (0, 1, CI), (-1, 0, CG), (-1, 1, CG), (0, 2, CG), (-2, 2, CG)],
        [(0, 0, CI), (-1, -1, CG), (0, 1, CG), (-1, 1, CG), (-2, 2, CG)],
        [(0, 0, CI), (-1, 0, CI), (-1, -1, CG), (0, 1, CG), (-2, 1, CG)],
        [(0, 0, CI), (0, 1, CI), (-1, 2, CG), (-1, 0, CG), (-1, -1, CG), (-2, 2, CG)],
    ])
    return {(2 + dx, 2 + dy): c for dx, dy, c in muster}


def _pose_folge(rnd, n_posen, n=N, tempo=(2, 3)):
    ablauf, rest = [0] * 3, []
    while len(ablauf) < n:
        if not rest:
            rest = list(range(1, n_posen))
            rnd.shuffle(rest)
        ablauf += [rest.pop()] * rnd.randint(*tempo)
    return ablauf[:n]


_rnd = random.Random(31)
FUNKEN_POSE = [None] + [_funke(_rnd) for _ in range(7)]
FOLGE_F = _pose_folge(random.Random(13), 8, tempo=(1, 2))
HOP = [-2 if math.sin(2 * math.pi * i / 24) > 0.8 else (-1 if math.sin(2 * math.pi * i / 24) > 0.3 else 0) for i in range(N)]       # − = hoch
ZITTERN = {4: -1, 5: 1, 6: -1, 7: 1, 8: 0, 28: -1, 29: 1, 30: -1, 31: 1, 32: 0}
BLINZELN_L = {15, 16, 39, 40}
BLINZELN_R = {16, 17, 40, 41}
assert HOP[0] == 0 and FOLGE_F[0] == 0 and 0 not in ZITTERN

ZUENDFUNKEN = [(3, -1), (9, 0), (15, 1), (21, -1), (27, 0), (33, 1), (39, -1), (45, 0)]      # Startframe, seitlicher Weg
PUFFS = [
    dict(x=PAD_L + 3, y=PAD_T + 13, vx=-1, vy=-6, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 15, y=PAD_T + 12, vx=0, vy=-6, off=4, form='k', wackeln=0),
    dict(x=PAD_L + 2, y=PAD_T + 10, vx=-1, vy=-5, off=8, form='s', wackeln=0),
    dict(x=PAD_L + 14, y=PAD_T + 14, vx=0, vy=-7, off=12, form='s', wackeln=0),
    dict(x=PAD_L + 4, y=PAD_T + 14, vx=-1, vy=-6, off=16, form='k', wackeln=1),
    dict(x=PAD_L + 15, y=PAD_T + 9, vx=0, vy=-5, off=20, form='k', wackeln=0),
]
STAUBFARBEN = {'c': CI, 'r': CD}


def sprite_mit_effekten(i):
    sp = spr.copy()
    if FOLGE_F[i]:
        sp[FUNKE_MASKE] = 0
        for (x, y), c in FUNKEN_POSE[FOLGE_F[i]].items():
            if 0 <= x < sw and 0 <= y < sh and not (OPAK[y, x] and not FUNKE_MASKE[y, x]):
                sp[y, x, :3] = c
                sp[y, x, 3] = 255
    for k, a in enumerate(AUGEN):
        if i in (BLINZELN_L if k == 0 else BLINZELN_R):
            for (y, x) in a:
                sp[y, x, :3] = LID[(y, x)]
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    dyb = HOP[i]
    dxs = ZITTERN.get(i, 0)
    schaedel = L.platz(np.where(SCHAEDEL[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    rest = L.platz(np.where(SCHAEDEL[..., None], 0, sp).astype(np.uint8), H, W, PAD_L, PAD_T)
    fig = L.zusammen(H, W, [(rest, 0, dyb), (schaedel, dxs, dyb)])
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
        x = 1 + drift * (a // 3) + int(round(0.7 * math.sin(2 * math.pi * a / 6.0)))
        y = 1 - int(round(0.35 * a))
        pix(x, y, CI if a < 3 else (CG if a < 6 else CH))
    return e


def frame(i):
    f = figur(i)
    dampf = L.puff_ebene(H, W, i, 24, PUFFS, STAUBFARBEN)
    return L.zusammen(H, W, [(dampf, 0, 0), (f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())), '| Schädel:', int(SCHAEDEL.sum()), '| Faden:', int(FAEDEN.sum()), '| Funke:', len(FUNKE))
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
    schlecht = A.ausdruck_pruefen(figs, spr, 'hot-skull-potato')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('hot-skull-potato', 'Hot Skull Potato', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hot-skull-potato-strip.png', frames[::2], spalten=12, scale=8)
