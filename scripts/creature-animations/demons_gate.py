# -*- coding: utf-8 -*-
"""Idle-Animation für „Demon's Gate“ (Creature).

PICK: [["Motive", 1518, 1]]   Ebene „Demons Gate“ (Motive.xcf, Ebene 1518, 38×33 px, 23 Farben, nur Alpha 0/255; die Ebene „Demons Gate-Kopie“ (1517) ist pixelgleich) → src/demons-gate.png.
Nicht verwendet: die Flügel („Demons Gate #2“ und „#4“, dunkelgraue Schwingen links und rechts), die Lava und die Kunstumgebung (andere Ebenen) sowie das halbtransparente „Demons Gate #1“ (Alpha 102).

Aufruf:   python3 demons_gate.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/demons-gate.png + .json

Was im Sprite ist (Koordinaten im Sprite 38×33, x/y ab 0):
* Ein roter Dämon in Frontansicht, spiegelsymmetrisch: Kopf (x 11–26, y 0–9) mit zwei gebogenen weißgrauen Hörnern L=(242,240,240)/P/N/H und zwei gelben Augen W=(248,246,32) bei (17, 8) und (20, 8);
  Rumpf (x 12–25, y 10–24) mit einer sandfarbenen Brustplatte (F=(167,138,59), K=(203,171,95), M=(220,200,146), J=(95,81,49)) und dunkelroten Schatten A=(51,1,1), E=(64,0,0), D=(108,0,0), G=(133,0,0), I=(158,0,0), O=(196,0,0).
* Waagerecht ausgestreckte Arme (x 0–11 und 26–37, y 10–16) mit hellroten Muskeln (O, S=(196,59,59)) und weißgrauen Klauen B=(64,64,64), H=(192,192,192), L bei (0–5, 10–16) und (32–37, 10–16).
* Beine (y 24–32) breit gestellt, am Ende weißgraue Zehenklauen (B, H, T, N) bei (8–14, 29–32) und (23–29, 29–32).
* Es gibt kein Flammenfeuer im Sprite (Rottöne sind Haut/Schatten); Material: Haut und Horn — KEIN Glanz (Regel 14).
Fest bleiben: Kopf mit Hörnern, Gesicht, Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): der Rumpf streckt sich 1–2 px nach oben (Frames 2–10 und 26–34 wird Rumpfzeile 19, in der Spitze 4–8 und 28–32 zusätzlich Zeile 20 verdoppelt; die Zeilen 18–21 haben gleiche Ränder,
  keine offene Kante); Kopf, Arme und Hörner heben sich mit, die Füße bleiben am Boden. Frame 0 = Original.
* Arme: beide Arme wiegen sich wie Flügel an der Schulter (Spalten wandern senkrecht, bis ±2 px an den Klauen, Periode 24, die Spitze hinkt nach, gegenläufig); Frame 0 = Quellform.
* Fußtritt: abwechselnd hebt sich die linke Zehenklaue 1 px (Frames 12–15, 36–39) und die rechte (24–27, 44–47).
* Blinzeln: beide Augen (Frames 15–17 und 39–41, das rechte einen Frame später): Gelb → die umgebende Hautfarbe (je Pixel die häufigste dunkelrote Stufe im 2-px-Umkreis); sonst kein Farbwechsel.
* Glut (Partikel): sechs runde Wölkchen (2×2 → 4×4 → 2×2, nie einzelne Punkte; Farben O und G des Sprites) steigen in den freien Flächen links und rechts vom Rumpf zwischen Armen und Beinen langsam auf.
Ergänzungen (Regel 16): wo sich beim Armwiegen oder Fußtritt ein Innenpixel am Rand frei legt, bekommt das leere Nachbarfeld den Umriss A=(51,1,1) bzw. an den Klauen B=(64,64,64) (umriss_ergaenzen).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken), 2 px unten — Figur zentriert; die Glut liegt innerhalb des Sprite-Rechtecks (keine zusätzliche Frame-Vergrößerung).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('demons-gate')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS_ROT = (51, 1, 1)
UMRISS_KLAUE = (64, 64, 64)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
GLUT = {'c': (196, 0, 0), 'r': (133, 0, 0)}
for _c in GLUT.values():
    assert _c in _farben, _c
CW = (248, 246, 32)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Augen (gelb) und Lidfarben (häufigste dunkelrote Stufe im Umkreis) ──
AUGEN = [(8, 17), (8, 20)]                                                           # (y, x)
for (y, x) in AUGEN:
    assert _col(y, x) == CW
LID = {}
for (y, x) in AUGEN:
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in AUGEN or not (0 <= q[0] < sh and 0 <= q[1] < sw) or not OPAK[q]:
                continue
            c = _col(*q)
            r, g, b = c
            if not (r > 40 and g < 20 and b < 20):                                   # nur die rote Haut (D, E, G, I, A …), keine Hörner/Weiß
                continue
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[(y, x)] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.3 else 0)
POSEN = {0: {}, 1: {19: 1}, 2: {19: 1, 20: 1}}
BLINZELN_L = {15, 16, 17, 39, 40, 41}
BLINZELN_R = {16, 17, 18, 40, 41, 42}
LIFT_L = {12, 13, 14, 15, 36, 37, 38, 39}
LIFT_R = {24, 25, 26, 27, 44, 45, 46, 47}
assert S[0] == 0 and 0 not in BLINZELN_L

ARM_PIVOT = {'l': 11, 'r': 26}                                                       # Schulterspalten
ARM_ZEILEN = (10, 16)
FUSS_ZEILEN = (29, 32)

GLUT_WOLKEN = [
    dict(x=5, y=26, vx=1, vy=-8, off=0), dict(x=32, y=26, vx=-1, vy=-8, off=4), dict(x=4, y=22, vx=1, vy=-7, off=12),
    dict(x=33, y=22, vx=-1, vy=-7, off=16), dict(x=6, y=28, vx=0, vy=-8, off=20), dict(x=31, y=28, vx=0, vy=-8, off=8),
]


def glut_ebene(i):
    e = L.leer(H, W)
    for w in GLUT_WOLKEN:
        t = ((i + w['off']) % 24) / 24.0
        if t > 0.92:
            continue
        form = 's' if (t < 0.22 or t > 0.72) else 'o'
        cx = PAD_L + w['x'] + int(round(w['vx'] * t))
        cy = PAD_T + w['y'] + int(round(w['vy'] * t))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Glutwölkchen bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = GLUT[k]
            e[Y, X, 3] = 255
    return e


def sprite_mit_effekten(i):
    sp = spr.copy()
    for k, (y, x) in enumerate(AUGEN):
        if i in (BLINZELN_L if k == 0 else BLINZELN_R):
            sp[y, x, :3] = LID[(y, x)]
    return sp


def _arm_ebene(fig, seite, top, i):
    """Arm aus der fertigen Figur herauslösen (Zeilen 10–16 der Quelle, links x ≤ 11 / rechts x ≥ 26) und spaltenweise senkrecht wiegen; Frame 0 = Quellform."""
    y0, y1 = top + ARM_ZEILEN[0], top + ARM_ZEILEN[1]
    xs = range(0, PAD_L + ARM_PIVOT['l'] + 1) if seite == 'l' else range(PAD_L + ARM_PIVOT['r'], W)
    arm = L.leer(H, W)
    rest = fig.copy()
    for x in xs:
        for y in range(y0, y1 + 1):
            if fig[y, x, 3]:
                arm[y, x] = fig[y, x]
                rest[y, x] = 0
    piv = PAD_L + ARM_PIVOT[seite]
    maxd = max(abs(x - piv) for x in range(W) if arm[:, x, 3].any())
    out = L.leer(H, W)
    phi = 0.0 if seite == 'l' else math.pi
    ph = 2 * math.pi * i / 24
    for x in range(W):
        ys = np.nonzero(arm[:, x, 3])[0]
        if not len(ys):
            continue
        frac = abs(x - piv) / float(maxd)
        dy = int(round(2.0 * frac * (math.sin(ph + phi - 0.9 * frac) - math.sin(phi - 0.9 * frac))))
        if ys.min() + dy < 0 or ys.max() + dy >= H:
            raise L.ClipError(f'Armspalte {x} würde um {dy} px aus der Leinwand')
        for y in ys:
            out[y + dy, x] = arm[y, x]
    return rest, out


def _fuss_ebene(fig, seite, hoch):
    """Zehenklaue (Zeilen 29–32 der Quelle am Boden) um 1 px heben."""
    boden = BODEN
    y0, y1 = boden - (FUSS_ZEILEN[1] - FUSS_ZEILEN[0]), boden
    xs = range(0, PAD_L + 15) if seite == 'l' else range(PAD_L + 22, W)
    fuss = L.leer(H, W)
    rest = fig.copy()
    for x in xs:
        for y in range(y0, y1 + 1):
            if fig[y, x, 3]:
                fuss[y, x] = fig[y, x]
                rest[y, x] = 0
    return rest, fuss


def figur(i):
    sp = sprite_mit_effekten(i)
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln=POSEN[S[i]], p=0, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig_start = fig
    ebenen_roh = []
    for seite in ('l', 'r'):
        fig_start, arm = _arm_ebene(fig_start, seite, top, i)
        ebenen_roh.append(arm)
    for seite, lift in (('l', LIFT_L), ('r', LIFT_R)):
        fig_start, fuss = _fuss_ebene(fig_start, seite, i in lift)
        ebenen_roh.append((fuss, -1 if i in lift else 0))
    ebenen = [(fig_start, 0, 0), (ebenen_roh[0], 0, 0), (ebenen_roh[1], 0, 0), (ebenen_roh[2][0], 0, ebenen_roh[2][1]), (ebenen_roh[3][0], 0, ebenen_roh[3][1])]
    fin = L.zusammen(H, W, ebenen)
    klaue = np.zeros((H, W), bool)
    for (_, _, _) in ebenen[3:]:
        pass
    fin, neu = A.umriss_ergaenzen(fin, RAND_FARBEN, lambda x, y: UMRISS_KLAUE if (y >= BODEN - 4 or x < PAD_L + 6 or x > PAD_L + sw - 7) else UMRISS_ROT)
    fin, pfad, offen = A.verbinde_luecken8(fin, 3)
    return dict(fig=fin, top=top, neu=neu, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(glut_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Farben:', len(_farben), '| Lidfarben:', sorted(set(LID.values())), '| Randfarben:', sorted(RAND_FARBEN))
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    k8 = [int(cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)[0] - 1) for f in figs]
    print('8-Komponenten je Frame (soll überall 1):', sorted(set(k8)), '| 4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, "demons-gate")
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('demons-gate', "Demon's Gate", frames, MS, prev)
    if prev:
        L.streifen(prev + '/demons-gate-strip.png', frames[::2], spalten=12, scale=4)
