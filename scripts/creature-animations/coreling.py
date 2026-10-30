# -*- coding: utf-8 -*-
"""Idle-Animation für „Coreling“ (Creature).

PICK: [["MotiveGrailWar", 574, 1]]   (Ebene „Coreling“, Sprite 24×27 px, 14 Farben, nur Alpha 0/255, src/coreling.png)
Nicht verwendet: die blauen Blitzbögen, die Flammen und der Wald/Boden der Karte (Kunst-Beiwerk, getrennte Ebenen).

Aufruf:   python3 coreling.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/coreling.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Kopf (Zeilen 0–11, x 6–19): grau gepanzerter Wolfs-/Katzenkopf mit zwei spitzen Ohren (links (7–9, 0–2), rechts (16–18, 0–2)), zwei roten Augen
  J=(213,0,0) zu je 2×2 px bei (10–11, 3–4) und (14–15, 3–4), schwarzblauem Nasen-/Mundschlitz H=(7,8,26) (12–13, 4–9) mit weißem Zahn N=(255,255,255)
  bei (14, 7–8); Hals Zeilen 10–12.
* Rumpf und Arme (Zeilen 13–17): ein waagerechter Panzerbalken von x 0 bis 23 mit dunklem Umriss A=(82,81,82), Arm links x 0–8, Arm rechts x 15–23,
  die Armenden mit je einer schwarzblauen Kappe H bei (3–4, 15–16) und (21–22, 15–16); Brust x 9–16.
* Beine (Zeilen 18–26): zwei schwarze Streben mit grauen Streifen (x 6–9 und x 17–20) und je zwei helle Dornen nach außen — links bei (3–6, 19) / (4–5, 20)
  und (2–5, 22) / (4–5, 23), rechts bei (19–22, 19) / (20, 20) und (20–23, 22) / (20–21, 23).
* Material: kaltes Grau in sechs Stufen (F, E, D, B, C und der Umriss A) mit Schwarz für die Beine — gepanzert, also Metall (Regel 14: leichter Stahlglanz erlaubt).
Fest bleiben: Augenform, Zahn, Schlitz, Beinstreben und Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen: der ganze Coreling hebt sich 1 px (Frames 2–10 und 26–34), sonst steht er (Frame 0 = Original).
* Kopf: wiegt sich seitlich (Zeilenversatz wächst zu den Ohren, bis ±2 px, Periode 24, Nachlauf); die Ohren zucken dazu einzeln 1 px nach außen
  (links Frames 10–11 und 34–35, rechts 20–21 und 44–45).
* Arme: die beiden Armbalken wippen wie Flügel an der Brust (Spalten wandern senkrecht, bis ±2 px an den Kappen, Periode 24, versetzt).
* Dornen: die vier Dornenpaare an den Beinen wippen 1 px auf und ab (links Periode 16, rechts gegenläufig).
* Blinzeln: beide Augen (Frames 16–18 und 40–42, das linke einen Frame früher): rot → halb zu → zu; die Lidfarbe ist die umgebende Körperfarbe
  (je Pixel die häufigste Graustufe in 2 px Umkreis außerhalb der Augen). Kein Farbwechsel der Augen sonst.
* Stahlglanz (Regel 14): zweimal pro Schleife (Frames 4–15 und 28–39) zieht ein schmales diagonales Lichtband über die grauen Panzerflächen (eine Stufe
  heller auf der Grau-Rampe F→E→D→B→C); Umrisse, Schwarz, Augen, Schlitz und Zahn bleiben. Ist Coreling nach Meinung des Nutzers kein Metall: Schalter `GLANZ = False`.
* Funken (Partikel): acht 1-px-Funken (Weiß N und Hellgrau C) flackern kurz (3 Frames) an Armkappen, Ohren und Dornenspitzen auf und hüpfen dabei 1 px.
Ergänzungen: beim Wiegen/Wippen können Füllpixel frei am Rand liegen — sie bekommen den Umriss A (umriss_ergaenzen, Regel 16); schräge Teile, die nur über
eine Ecke hängen, bekommen Brückenpixel (verbinde4/verbinde_luecken, Regel 11). Beides wird je Frame gezählt (Konsole).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Ohren + Atmen + Funken), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2
GLANZ = True

spr = L.lade('coreling')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN = (82, 81, 82), (185, 186, 185), (206, 207, 206), (151, 149, 151), (128, 126, 128), (102, 101, 102), \
    (0, 0, 0), (7, 8, 26), (26, 26, 26), (213, 0, 0), (51, 51, 51), (51, 50, 51), (90, 89, 90), (255, 255, 255)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN):
    assert _c in _farben, _c
RAND_FARBEN = A.umrissfarben(spr)
RAND0 = A.randpixel(spr)
FUNKENFARBEN = {'w': CN, 'g': CC}
HELLER = {CF: CE, CE: CD, CD: CB, CB: CC, CM: CF}                                     # Grau-Rampe (eine Stufe heller)
KOERPERGRAU = {CB, CC, CD, CE, CF, CM}                                                # Lid-/Glanzfarben (graue Flächen)


def _c(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Teile (Masken im Sprite) ──
HEAD = OPAK & (yy <= 11)
ARM_L = OPAK & (yy >= 14) & (yy <= 17) & (xx <= 8)
ARM_R = OPAK & (yy >= 14) & (yy <= 17) & (xx >= 15)
SP_L = OPAK & (((yy >= 19) & (yy <= 20) & (xx <= 5)) | ((yy == 19) & (xx == 6)) | ((yy >= 22) & (yy <= 23) & (xx <= 5)))
SP_R = OPAK & (((yy >= 19) & (yy <= 20) & (xx >= 20)) | ((yy == 19) & (xx == 19)) | ((yy >= 22) & (yy <= 23) & (xx >= 20)))
BODY = OPAK & ~(HEAD | ARM_L | ARM_R | SP_L | SP_R)
assert int((HEAD | ARM_L | ARM_R | SP_L | SP_R | BODY).sum()) == int(OPAK.sum())

# ── Augen (rot 2×2) ──
_red = OPAK & (spr[..., 0] == CJ[0]) & (spr[..., 1] == CJ[1]) & (spr[..., 2] == CJ[2])
import cv2  # noqa: E402
_n, _lab = cv2.connectedComponents(_red.astype(np.uint8), connectivity=8)
AUGEN = sorted([[(int(y), int(x)) for y, x in np.argwhere(_lab == k)] for k in range(1, _n)], key=lambda p: min(x for y, x in p))   # links, rechts
assert [len(a) for a in AUGEN] == [4, 4], [len(a) for a in AUGEN]
_augpix = {p for a in AUGEN for p in a}
LID = {}
for (y, x) in _augpix:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in _augpix or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not OPAK[q]:
                continue
            c = _c(*q)
            if c not in KOERPERGRAU:
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Zeitachsen ──
HOP = [-1 if math.sin(2 * math.pi * i / 24) > 0.3 else 0 for i in range(N)]       # − = hoch
EAR_L = {10: 1, 11: 1, 34: 1, 35: 1}                                              # linkes Ohr 1 px nach links
EAR_R = {20: 1, 21: 1, 44: 1, 45: 1}                                              # rechtes Ohr 1 px nach rechts
BLINZELN_L = {15: 1, 16: 2, 17: 1, 39: 1, 40: 2, 41: 1}
BLINZELN_R = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
SWEEPS = [4, 28]
assert HOP[0] == 0

FUNKEN = [  # (x, y) im Sprite (außerhalb der Figur), Startframe — Zyklus 24 Frames, sichtbar 3 Frames
    (-1, 13, 0), (24, 14, 3), (6, 0, 6), (19, 0, 9), (-1, 18, 12), (24, 18, 15), (1, 24, 18), (22, 24, 21),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    if GLANZ:
        for s0 in SWEEPS:
            if 0 <= i - s0 <= 11:
                t = 5 * (i - s0) - 3
                m = OPAK & ~RAND0 & (xx + yy >= t) & (xx + yy < t + 4)
                sp = A.farb_schritt(sp, HELLER, m)
    for k, a in enumerate(AUGEN):
        b = (BLINZELN_L if k == 0 else BLINZELN_R).get(i, 0)
        if b:
            ys = sorted({y for y, x in a})
            zu = {p for p in a if p[0] in (set(ys[:len(ys) // 2]) if b == 1 else set(ys))}
            for (y, x) in zu:
                sp[y, x, :3] = LID[(y, x)]
    return sp


def _platz(sp, maske):
    return L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


def _kopf(sp, i):
    """Kopf: Zeilenversatz um den Hals (Zeile 12), Frame 0 = Quellform; die Ohren (Zeilen 0–1) zucken zusätzlich."""
    layer = _platz(sp, HEAD)
    out = L.leer(H, W)
    piv = PAD_T + 12
    maxd = piv - PAD_T
    for y in range(PAD_T, piv):
        xs = np.nonzero(layer[y, :, 3])[0]
        if not len(xs):
            continue
        frac = (piv - y) / float(maxd)
        ph = 2 * math.pi * i / 24
        dxk = int(round(1.7 * frac * (math.sin(ph + 0.5 - 0.5 * frac) - math.sin(0.5 - 0.5 * frac))))
        for x in xs:
            dx = dxk
            if y - PAD_T <= 1:
                if x - PAD_L <= 11:
                    dx -= EAR_L.get(i, 0)
                elif x - PAD_L >= 14:
                    dx += EAR_R.get(i, 0)
            if not 0 <= x + dx < W:
                raise L.ClipError(f'Kopfzeile {y} würde um {dx} px aus der Leinwand')
            out[y, x + dx] = layer[y, x]
    return out


def _arm(sp, maske, pivot, i, phi):
    layer = _platz(sp, maske)
    out = L.leer(H, W)
    piv = PAD_L + pivot
    maxd = max(abs(x - piv) for x in range(W) if layer[:, x, 3].any())
    for x in range(W):
        ys = np.nonzero(layer[:, x, 3])[0]
        if not len(ys):
            continue
        frac = abs(x - piv) / float(maxd)
        dy = int(round(2.2 * frac * (math.sin(2 * math.pi * i / 24 + phi - 0.9 * frac) - math.sin(phi - 0.9 * frac))))
        if ys.min() + dy < 0 or ys.max() + dy >= H:
            raise L.ClipError(f'Armspalte {x} würde um {dy} px aus der Leinwand')
        for y in ys:
            out[y + dy, x] = layer[y, x]
    return out


def _dornen(sp, maske, i, phi):
    dy = int(round(0.9 * math.sin(2 * math.pi * i / 16 + phi)))
    return L.versetze(_platz(sp, maske), 0, dy)


def figur(i):
    sp = sprite_mit_effekten(i)
    dyb = HOP[i]
    ebenen = [(_platz(sp, BODY), 0, dyb), (_kopf(sp, i), 0, dyb),
              (_arm(sp, ARM_L, 8, i, 0.0), 0, dyb), (_arm(sp, ARM_R, 15, i, 2.1), 0, dyb),
              (_dornen(sp, SP_L, i, 0.0), 0, dyb), (_dornen(sp, SP_R, i, math.pi), 0, dyb)]
    fig = L.zusammen(H, W, ebenen)
    fig, brueck = A.verbinde4(fig)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    fig, brueck2 = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, neu=neu, brueck=brueck + brueck2, pfad=pfad, offen=offen)


def funken_ebene(i):
    e = L.leer(H, W)
    for (x, y, f0) in FUNKEN:
        a = (i - f0) % 24
        if a >= 3:
            continue
        px = [(0, 0, CN), (0, -1, CC)] if a == 1 else ([(0, 0, CN)] if a == 0 else [(0, -1, CC)])
        for dx, dy, c in px:
            X, Y = PAD_L + x + dx, PAD_T + y + dy + HOP[i]
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Funke bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = c
            e[Y, X, 3] = 255
    return e


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (funken_ebene(i), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())),
          '| Teile:', {n: int(m.sum()) for n, m in (('kopf', HEAD), ('arm_l', ARM_L), ('arm_r', ARM_R), ('dorn_l', SP_L), ('dorn_r', SP_R), ('rumpf', BODY))})
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    A.ausdruck_pruefen(figs, spr, 'coreling')
    L.speichern('coreling', 'Coreling', frames, MS, prev)
    if prev:
        L.streifen(prev + '/coreling-strip.png', frames[::2], spalten=12, scale=6)
