# -*- coding: utf-8 -*-
"""Idle-Animation für „Cactus Creature“ (Creature).

PICK: [["MotiveEgypt", 52, 1], ["MotiveEgypt", 52, 2], ["MotiveEgypt", 52, 3], ["MotiveEgypt", 54, 1], ["MotiveEgypt", 53, 1], ["MotiveEgypt", 54, 2]]
Zusammengesetzt aus sechs Ebenenteilen (src/cactus-creature.png, 44×50 px, 11 Farben, nur Alpha 0/255):
  Ebene 53 Figur 1 = der Kaktus (Körper, Platten, Blüten), Ebene 52 Figuren 1–3 = die drei Augen (Rahmen + schwarze Pupille),
  Ebene 54 Figuren 1 und 2 = die Beinpaare. Der Treffer-Abgleich legt das Auge von Figur 2 (rechte Platte) fälschlich auf die linke Platte;
  die richtige Stelle ergibt sich aus der Ebenenbox: Position der Figur 1 (29, 18) + Box-Versatz (14, 0) = Kunst-Koordinate (43, 18) — so ist
  das Sprite hier zusammengesetzt (alle drei Augen sitzen an ihrer Stelle). Nicht verwendet: die Kakteen im Hintergrund der Karte (Stiele links/rechts,
  Kugelkaktus unten links) — Kunst-Beiwerk, keine Creature.

Aufruf:   python3 cactus_creature.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cactus-creature.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Ein Feigenkaktus (Opuntie) aus ovalen Platten (dunkelgrüner Umriss A=(35,50,19), Fülltöne B/E/F/G/D, helle Dornenpunkte C=(193,191,163)),
  der auf vier Beinen steht, mit drei Augen und fünf rosa Blüten (H=(255,42,244), I=(196,30,181), K=(255,128,245)):
  - Platte links (x 10–22, y 12–30) mit Auge (Pupille 16–17 × 21–23), Platte rechts (x 26–37, y 12–28) mit Auge (Pupille 31–32 × 20–22),
    Basisplatte unten (x 15–31, y 27–49) mit liegendem Auge (Pupille 22–24 × 36–37) und Blüte oben (23–25, 25–28).
  - Obere Platten: Armplatte links oben (schräg, x 0–12, y 2–14, Blüte bei (0–4, 2–5)), Platte oben Mitte (x 14–22, y 0–11, Blüte (17–22, 0–3)),
    Platte oben rechts (x 22–34, y 1–12, Blüte (28–33, 1–4)) samt kurzem Seitenarm links (Blüte (21–25, 7–10)), Armplatte rechts oben
    (schräg, x 35–43, y 7–13, Blüte (38–43, 7–10)).
  - Beine: je Seite ein senkrechter Stab (x 6–8 links, x 37–39 rechts, bis Zeile 49) mit zwei Bögen zur Basisplatte (Zeilen 28–35 und 37–44).
* Augen: ovaler Rahmen aus Umriss A mit Dornenpunkten, Innenfüllung grün, Pupille = zwei Spalten × drei Zeilen Schwarz J=(0,0,0)
  (das liegende Auge: drei Spalten × zwei Zeilen). Die Pupille ist der einzige schwarze Teil.
Fest bleiben: Augenrahmen, Dornenpunkte, Umrissfarbe, die Beinstäbe (nur Anheben).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Hüpfer (Atmen): der ganze Kaktus hebt sich 1 px (Frames 2–10 und 26–34), sonst steht er (Frame 0 = Original).
* Armplatten (links oben und rechts oben) schlagen wie Flügel: die Spalten wandern senkrecht, der Versatz wächst mit dem Abstand zum Gelenk
  (bis ±2 px an den Blüten), die Spitze hinkt nach; Perioden 24, gegenläufig. Frame 0 = Quellform (Phasenversatz abgezogen).
* Aufrechte Platten (oben Mitte, oben rechts samt Seitenarm) wiegen sich im Wind: die Zeilen wandern waagerecht, der Versatz wächst mit dem
  Abstand zum Ansatz (bis ±2 px an den Blüten), beide Periode 24 und fast im Gleichtakt (so stoßen die Blüten nicht zusammen), mit Nachlauf an der Spitze.
* Beine: abwechselnd hebt sich das linke Bein 1 px (Frames 14–17, 38–41) und das rechte (20–23, 44–47) wie ein Tritt auf der Stelle; die Bögen
  zur Basisplatte bleiben 4-verbunden.
* Augen: alle drei blinzeln (Frames 16–18 und 40–42, das liegende Auge einen Frame später): Pupille → halb zu → zu; die Lidfarbe ist die umgebende
  Körperfarbe (je Pupillenpixel die häufigste Grünstufe der Augeninnenfläche). Dazu schauen sie: Pupille rutscht 1 px nach rechts (Frames 6–10),
  nach links (26–31), nach oben (34–37) und nach unten (44–46); das frei werdende Pupillenpixel bekommt die Lidfarbe.
* Blütenstaub (Partikel): acht kleine runde Rosa-Punkte (Formen k/s) schweben langsam aus den Blüten auf — vier in der Lücke zwischen den beiden
  oberen Platten (aus der Basisblüte), je einer an den Blüten links oben, rechts oben und oben Mitte/rechts. Sie bleiben in der 2-px-Zone um die
  Figur (Frame nur 3 px (4 px oben) größer als das Sprite).
* KEIN Glanz (Regel 14): der Kaktus und seine Blüten glitzern nicht.
Ergänzungen: beim Wiegen und Flügeln können Füllpixel frei am Rand liegen — sie bekommen den Umriss A (umriss_ergaenzen, Regel 16); schräge
Teile, die nur über eine Ecke hängen, bekommen Brückenpixel (verbinde4/verbinde_luecken, Regel 11). Beides wird je Frame gezählt (Konsole).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2

spr = L.lade('cactus-creature')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0

# ── Farben ──
CA, CB, CC, CD, CE, CF, CG = (35, 50, 19), (88, 125, 61), (193, 191, 163), (51, 76, 31), (114, 162, 81), (137, 161, 78), (95, 117, 57)
CH, CI, CJ, CK = (255, 42, 244), (196, 30, 181), (0, 0, 0), (255, 128, 245)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK):
    assert _c in _farben, _c
RAND_FARBEN = A.umrissfarben(spr)
POLLENFARBEN = {'c': CK, 'r': CH}

# ── Teile (Masken im Sprite) ──
TLA = OPAK & (((xx <= 12) & (yy <= 13)) | ((xx <= 11) & (yy == 14)))                       # Armplatte links oben samt Blüte
RA = OPAK & (xx >= 35) & (yy <= 13)                                                           # Armplatte rechts oben samt Blüte
M = OPAK & (((xx >= 14) & (xx <= 22) & (yy <= 6)) | ((xx >= 14) & (xx <= 21) & (yy >= 7) & (yy <= 11)))   # Platte oben Mitte samt Blüte
ST = OPAK & (xx >= 22) & (xx <= 34) & (yy <= 12) & ~M & ~RA                                  # Platte oben rechts samt Seitenarm und Blüten
LEGL = OPAK & (xx <= 15) & (yy >= 28)
LEGR = OPAK & (xx >= 31) & (yy >= 28)
BASE = OPAK & ~(TLA | RA | M | ST | LEGL | LEGR)
assert int((TLA | RA | M | ST | LEGL | LEGR | BASE).sum()) == int(OPAK.sum())

# ── Augen: Pupillen (schwarz) ──
_pup = OPAK & (spr[..., 0] == 0) & (spr[..., 1] == 0) & (spr[..., 2] == 0)
import cv2  # noqa: E402
_n, _lab = cv2.connectedComponents(_pup.astype(np.uint8), connectivity=8)
AUGEN = sorted([[(int(y), int(x)) for y, x in np.argwhere(_lab == k)] for k in range(1, _n)], key=lambda p: (p[0][0] // 10, p[0][1]))  # links, rechts, unten
assert [len(a) for a in AUGEN] == [6, 6, 6], [len(a) for a in AUGEN]


def _c(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


LID = {}                                                                          # je Pupillenpixel: häufigste Grünstufe der Augeninnenfläche
_pupset = {p for a in AUGEN for p in a}
for a in AUGEN:
    ys = [y for y, x in a]
    xs = [x for y, x in a]
    cnt = {}
    for y in range(min(ys) - 1, max(ys) + 2):
        for x in range(min(xs) - 1, max(xs) + 2):
            if (y, x) in _pupset:
                continue
            c = _c(y, x)
            if c in (CB, CE, CF, CG):
                cnt[c] = cnt.get(c, 0) + 1
    best = max(cnt, key=cnt.get)
    for p in a:
        LID[p] = best

# ── Zeitachsen ──
HOP = [-1 if math.sin(2 * math.pi * i / 24) > 0.3 else 0 for i in range(N)]       # − = hoch
LIFT_L = {14, 15, 16, 17, 38, 39, 40, 41}
LIFT_R = {20, 21, 22, 23, 44, 45, 46, 47}
BLINZELN = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
BLINZELN_UNTEN = {17: 1, 18: 2, 19: 1, 41: 1, 42: 2, 43: 1}
BLICK = {}                                                                         # Frame → (dx, dy)
for _i in range(6, 11):
    BLICK[_i] = (1, 0)
for _i in range(26, 32):
    BLICK[_i] = (-1, 0)
for _i in range(34, 38):
    BLICK[_i] = (0, -1)
for _i in range(44, 47):
    BLICK[_i] = (0, 1)
assert HOP[0] == 0 and 0 not in BLICK and 0 not in BLINZELN

# Pendel der Teile: (Achse, Pivot im Sprite, Amplitude, Periode, Phase, Nachlauf)
TEILE = {
    'tla': dict(maske=TLA, achse='spalten', pivot=13, amp=2.4, P=24, phi=0.0, lag=0.9),
    'ra': dict(maske=RA, achse='spalten', pivot=34, amp=2.4, P=24, phi=2.2, lag=0.9),
    'm': dict(maske=M, achse='zeilen', pivot=12, amp=2.0, P=24, phi=0.5, lag=0.9),
    'st': dict(maske=ST, achse='zeilen', pivot=13, amp=2.0, P=24, phi=1.0, lag=0.9),
}

POLLEN = [
    dict(x=PAD_L + 23, y=PAD_T + 24, vx=0, vy=-9, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 24, y=PAD_T + 23, vx=1, vy=-9, off=6, form='s', wackeln=0),
    dict(x=PAD_L + 24, y=PAD_T + 24, vx=-1, vy=-9, off=12, form='k', wackeln=1),
    dict(x=PAD_L + 23, y=PAD_T + 23, vx=0, vy=-9, off=18, form='k', wackeln=0),
    dict(x=PAD_L + 0, y=PAD_T + 2, vx=-1, vy=-3, off=3, form='k', wackeln=0),
    dict(x=PAD_L + 43, y=PAD_T + 7, vx=1, vy=-4, off=9, form='k', wackeln=0),
    dict(x=PAD_L + 20, y=PAD_T + 0, vx=0, vy=-2, off=15, form='k', wackeln=0),
    dict(x=PAD_L + 31, y=PAD_T + 1, vx=1, vy=-3, off=21, form='k', wackeln=0),
]


def pendel(t, i):
    """Pendel-Versatz je Abstand: frac ∈ [0,1] → ganze Pixel; Frame 0 = Quellform (Phasenversatz abgezogen)."""
    return lambda frac: int(round(t['amp'] * frac * (math.sin(2 * math.pi * i / t['P'] + t['phi'] - t['lag'] * frac) - math.sin(t['phi'] - t['lag'] * frac))))


def teil_ebene(sp, name, i):
    t = TEILE[name]
    layer = L.platz(np.where(t['maske'][..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    out = L.leer(H, W)
    f = pendel(t, i)
    if t['achse'] == 'zeilen':
        piv = PAD_T + t['pivot']
        maxd = max(abs(y - piv) for y in range(H) if layer[y, :, 3].any())
        for y in range(H):
            xs = np.nonzero(layer[y, :, 3])[0]
            if not len(xs):
                continue
            dx = f(abs(y - piv) / float(maxd))
            if xs.min() + dx < 0 or xs.max() + dx >= W:
                raise L.ClipError(f'{name}: Zeile {y} würde um {dx} px aus der Leinwand')
            for x in xs:
                out[y, x + dx] = layer[y, x]
    else:
        piv = PAD_L + t['pivot']
        maxd = max(abs(x - piv) for x in range(W) if layer[:, x, 3].any())
        for x in range(W):
            ys = np.nonzero(layer[:, x, 3])[0]
            if not len(ys):
                continue
            dy = f(abs(x - piv) / float(maxd))
            if ys.min() + dy < 0 or ys.max() + dy >= H:
                raise L.ClipError(f'{name}: Spalte {x} würde um {dy} px aus der Leinwand')
            for y in ys:
                out[y + dy, x] = layer[y, x]
    return out


def sprite_mit_augen(i):
    """Blinzeln und Blick: nur die Pupillenpixel ändern sich (Lidfarbe = umgebende Körperfarbe)."""
    sp = spr.copy()
    for k, a in enumerate(AUGEN):
        b = (BLINZELN_UNTEN if k == 2 else BLINZELN).get(i, 0)
        ys = sorted({y for y, x in a})
        if b:
            zu = {p for p in a if p[0] in (set(ys[:len(ys) // 2]) if b == 1 else set(ys))}
            for (y, x) in zu:
                sp[y, x, :3] = LID[(y, x)]
        elif i in BLICK:
            dx, dy = BLICK[i]
            neu = {(y + dy, x + dx) for (y, x) in a}
            if all(0 <= y < sh and 0 <= x < sw and _c(y, x) not in (CA,) for (y, x) in neu):
                for (y, x) in a:
                    sp[y, x, :3] = LID[(y, x)]
                for (y, x) in neu:
                    sp[y, x, :3] = CJ
    return sp


def figur(i):
    sp = sprite_mit_augen(i)
    dyb = HOP[i]
    ebenen = [(L.platz(np.where(BASE[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T), 0, dyb)]
    for maske, lift in ((LEGL, -1 if i in LIFT_L else 0), (LEGR, -1 if i in LIFT_R else 0)):
        ebenen.append((L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T), 0, dyb + lift))
    for name in TEILE:
        ebenen.append((teil_ebene(sp, name, i), 0, dyb))
    fig = L.zusammen(H, W, ebenen)
    fig, brueck = A.verbinde4(fig)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    fig, brueck2 = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, neu=neu, brueck=brueck + brueck2, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    pollen = L.puff_ebene(H, W, i, 24, POLLEN, POLLENFARBEN)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (pollen, 0, 0)])


if __name__ == '__main__':
    print('Augen (Pupillenpixel):', [len(a) for a in AUGEN], '| Lidfarben:', sorted(set(LID.values())), '| Teile:', {k: int(v['maske'].sum()) for k, v in TEILE.items()})
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
    A.ausdruck_pruefen(figs, spr, 'cactus-creature')
    L.speichern('cactus-creature', 'Cactus Creature', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cactus-creature-strip.png', frames[::2], spalten=12, scale=4)
