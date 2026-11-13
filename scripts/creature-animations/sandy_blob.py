# -*- coding: utf-8 -*-
"""Idle-Animation für „Sandy Blob“ (Creature) — Runde 2: Augen samt weißem Glanzpixel, Maul schließt periodisch.

PICK: [["MotiveEgypt", 57, 1]]   Ebene „Ebene #133“ (MotiveEgypt.xcf, Ebene 57, 18×17 px, nur Alpha 0/255) → src/sandy-blob.png (77 Farben: ein Sandklumpen mit
vielen eng benachbarten Sandtönen; beim Randtest zählt nur der braune Umriss). Nicht verwendet: der Sandboden, der Kugelkaktus und die Wüstenwellen der Karte.

Aufruf:   python3 sandy_blob.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sandy-blob.png + .json

Was im Sprite ist (Koordinaten im Sprite 18×17, x/y ab 0):
* Körper: ein runder Sandklumpen (Zeilen 0–16) mit braunem Umriss A=(125,99,45)/D=(120,97,43) (am Rand immer nur diese zwei Farben) und gemustertem Sand in rund 70 Gelb-/Braun-Tönen.
* Augen (Nutzerkorrektur: die weißen Pixel gehören zu den Augen!): je EIN Auge = ein schwarzes Pixel + das weiße Pixel diagonal darüber: links Pupille (6, 3) + Weiß (5, 2), rechts Pupille (11, 3) + Weiß (12, 2).
  Beide Pixel eines Auges werden immer gemeinsam behandelt (Blinzeln: beide werden zur umgebenden Sandfarbe; Blick: beide rutschen gemeinsam 1 px zur Seite) — die Weißpixel sind keine Partikel/Glanzpunkte.
* Maul (x 5–12, y 5–12): weit aufgerissener, dunkelroter Rachen (Lippen (91,21,23), Innenraum (31,7,8)/(13,3,3)) mit zwölf weißen Reißzähnen (255,255,255): oben (7, 5–6) und (10, 5–6), an den Seiten (5, 7), (12, 7),
  (5, 10), (12, 10), unten (7, 11–12) und (10, 11–12). Sie sind Zähne, keine Partikel.
* Material: Sand — kein Metall/Gold/Edelstein: KEIN Glanz, keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15 trifft nicht zu).
Fest bleiben: Umrissfarben, Zahnform (die Zähne werden nie gedehnt oder kopiert), Augenform.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* MAUL SCHLIESST PERIODISCH (Nutzerwunsch), Periode 24 Frames: der Klumpen beißt zu — Frames 12–18 je Halbschleife: 12 halb zu (Zeilen 8–9 des Rachens entfallen), 13 fast zu (nur eine Rachenzeile zwischen
  den Zähnen), 14–16 ganz zu (nur ein dunkler Mundstrich mit je einem Zahnpaar darüber/darunter; Sandfarbe zwischen den Zähnen), 17–18 öffnet sich wieder, danach wieder ganz offen. Der Kopf wird dabei
  um bis zu 5 Zeilen niedriger (Unterkante am Boden fest, die Augen sinken mit), der Umriss behält jede Stufe ≤ 1 px.
* Gel-Körper (Squash & Stretch, Periode 24): beim Strecken (Frames 2–10 und 26–34) werden Körperzeile 8 (mitten im Rachen, ohne Zahn) und Zeile 13 (unten) verdoppelt (Texturmischung mit der Nachbarzeile, Zähne
  und Pupillen werden nie hineingemischt) — der Rachen öffnet sich um 1–2 px weiter; beim Stauchen (Frames 15–21 und 39–45) wird der Klumpen je Zeile 1 Spalte je Seite breiter (die Spalte neben dem Umriss wird
  verdoppelt, nie der Umriss, nie Augen/Zähne). Der Klumpen sitzt am Boden (Unterkante fest).
* Blinzeln: beide Augen (Frames 15–16 und 39–40, das rechte einen Frame später): Pupille UND Weißpixel werden für 2 Frames zur umgebenden Sandfarbe (je Pixel die häufigste Sandstufe im 2-px-Umkreis
  außerhalb der Augen). Blick: beide Augen rutschen mit Pupille und Weißpixel gemeinsam 1 px nach rechts (Frames 6–10) bzw. links (28–32); das freiwerdende Pixel wird Sandfarbe.
* Keine Partikel mehr: die früheren 1-px-Sandkörner entfallen (Regel 25: keine isolierten 1-px-Punkte; 2×2-Körner in Sandfarbe verschmolzen mit dem gleichfarbigen Körperrand und lasen sich als Beulen).
Ergänzungen: Umrisspixel (125,99,45) dort, wo beim geschlossenen Maul (Frames 14–16/38–40) die Backe eine Umrissstufe von 2 px hätte (je 1–2 Pixel an der Wange, umriss_ergaenzen); beim Schließen des Mauls werden die Mundzellen von zwei Zeilen (Oberlippe, Unterlippe) zwischen den Zähnen mit der Sandfarbe der Umgebung gefüllt (jeweils (8,5),(9,5) und (8,12),(9,12) → Sandpixel
der Nachbarzeile); sonst nichts Neues gezeichnet (jede Farbe stammt aus dem Sprite).
Frame: Sprite plus 3 px links/rechts, 4 px oben (Strecken), 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)
import anim_amorph as A
import anim_slime as SL

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2
TEST_EBENEN = ('fig',)

spr = L.lade('sandy-blob')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
UMRISS = {(125, 99, 45), (120, 97, 43)}
WEISS = (255, 255, 255)
SCHWARZ = (0, 0, 0)


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


def _klasse(c):
    r, g, b = c
    if r >= 250 and g >= 250 and b >= 250:
        return 'w'
    if r < 30 and g < 30 and b < 30:
        return 'k'
    if r < 110 and g < 40:
        return 'r'
    if c in UMRISS:
        return 'o'
    return 's'


KL = np.full((sh, sw), '.', dtype='<U1')
for _y in range(sh):
    for _x in range(sw):
        if OPAK[_y, _x]:
            KL[_y, _x] = _klasse(_col(_y, _x))
assert set(_col(y, x) for y, x in zip(*np.nonzero(RAND0))) <= UMRISS, 'Randfarben'

# ── Augen: je Auge ein Pixelpaar (Weißpixel (y, x), Pupille (y, x)) — das Weiß liegt diagonal über der Pupille und gehört zum Auge ──
AUGEN = [((2, 5), (3, 6)), ((2, 12), (3, 11))]
for (w_, p_) in AUGEN:
    assert _col(*w_) == WEISS and _col(*p_) == SCHWARZ
AUGEN_ZELLEN = {c for pr in AUGEN for c in pr}
LID = {}
for c0 in AUGEN_ZELLEN:
    y, x = c0
    cnt, dist = {}, {}
    for dy_ in range(-2, 3):
        for dx_ in range(-2, 3):
            q = (y + dy_, x + dx_)
            if q in AUGEN_ZELLEN or not (0 <= q[0] < sh and 0 <= q[1] < sw) or KL[q] != 's':
                continue
            c = _col(*q)
            cnt[c] = cnt.get(c, 0) + 1
            dist[c] = min(dist.get(c, 9), max(abs(dy_), abs(dx_)))
    LID[c0] = max(cnt, key=lambda c: (cnt[c], -dist[c]))

# ── Spaltenpaare je Zeile: reine Sandpixel neben dem Umriss (nie Umriss, Augen, Zähne, Rachen) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    if r - l < 5:
        PAARE_ZEILE[y] = [(l + 1, r - 1)]
        continue
    links = [x for x in (l + 2, l + 1, l + 3, l + 4) if KL[y, x] == 's' and x < r - 3]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4) if KL[y, x] == 's' and x > l + 3]
    if not links or not rechts:                                                      # reine Umrisszeilen (Zeile 0, 16): beliebige Spalten im Inneren
        links, rechts = [l + 2], [r - 2]
    PAARE_ZEILE[y] = [(links[0], rechts[0])]
    assert PAARE_ZEILE[y][0][0] < PAARE_ZEILE[y][0][1]

# ── Maul: Höhe h = Zeilen des Rachenbands (Quellzeilen 5–12). Welche Quellzeilen entfallen, damit der Umriss jede Stufe ≤ 1 px behält ──
MUND_LOESCHEN = {8: (), 6: (8, 9), 5: (7, 8, 10), 3: (6, 7, 8, 10, 11)}
MUND = {}
for _i in range(N):
    _k = _i % 24
    MUND[_i] = {12: 6, 13: 5, 14: 3, 15: 3, 16: 3, 17: 5, 18: 6}.get(_k, 8)
assert MUND[0] == 8
# ganz geschlossen: die zwei Rachenzellen (x 8, 9) der Ober- und Unterlippenzeile bekommen die Sandfarbe der Nachbarzeile (Zähne bleiben, dazwischen Sand)
ZU_FUELLEN = [((5, 8), (4, 8)), ((5, 9), (4, 9)), ((12, 8), (13, 8)), ((12, 9), (13, 9))]
for (ziel, quelle) in ZU_FUELLEN:
    assert KL[quelle] == 's'

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.85 else 1 if _v >= 0.35 else -1 if _v <= -0.5 else 0)
POSEN = {-1: ({}, 1), 0: ({}, 0), 1: ({8: 1}, 0), 2: ({8: 1, 13: 1}, 0)}               # s → (Zeilen verdoppeln {Zeile: Kopien}, Spalten p je Seite)
BLINZELN_L = {15, 16, 39, 40}
BLINZELN_R = {16, 17, 40, 41}
BLICK = {i: 1 for i in range(6, 11)}
BLICK.update({i: -1 for i in range(28, 33)})
assert S[0] == 0 and 0 not in BLICK

def sprite_mit_effekten(i):
    sp = spr.copy()
    h = MUND[i]
    if h == 3:
        for (ziel, quelle) in ZU_FUELLEN:
            sp[ziel[0], ziel[1], :3] = spr[quelle[0], quelle[1], :3]
    b = (i in BLINZELN_L, i in BLINZELN_R)
    g = BLICK.get(i, 0)
    for k, (w_, p_) in enumerate(AUGEN):
        if b[k]:                                                                      # Lid zu: Weiß UND Pupille werden zur umgebenden Sandfarbe
            sp[w_[0], w_[1], :3] = LID[w_]
            sp[p_[0], p_[1], :3] = LID[p_]
        elif g:                                                                       # Blick: das ganze Auge (Weiß + Pupille) rutscht gemeinsam 1 px zur Seite
            nw, npu = (w_[0], w_[1] + g), (p_[0], p_[1] + g)
            assert KL[nw] == 's' and KL[npu] == 's' and nw not in AUGEN_ZELLEN and npu not in AUGEN_ZELLEN
            sp[w_[0], w_[1], :3] = LID[w_]
            sp[p_[0], p_[1], :3] = LID[p_]
            sp[nw[0], nw[1], :3] = WEISS
            sp[npu[0], npu[1], :3] = SCHWARZ
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    h = MUND[i]
    s_ = S[i] if h == 8 else min(S[i], 0)                                            # Strecken nur bei offenem Maul
    doppeln, p = POSEN[s_]
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = TX.koerper_pose(koerper, loeschen=set(MUND_LOESCHEN[h]), doppeln=doppeln, p=p,
                                paare_je_zeile={k: v for k, v in PAARE_ZEILE.items()}, x0=PAD_L, sperre={WEISS, SCHWARZ})
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    fig, neu = A.umriss_ergaenzen(fig, UMRISS, lambda x, y: (125, 99, 45))             # Umrissstufen > 1 px (nur beim geschlossenen Maul an der Backe) schließen
    return dict(fig=fig, top=top, neu=neu)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    return f['fig']


if __name__ == '__main__':
    print('Augen:', AUGEN, '| Lidfarben:', {k: v for k, v in LID.items()}, '| Farben im Sprite:', len({_col(y, x) for y in range(sh) for x in range(sw) if OPAK[y, x]}))
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'sandy-blob')
    print('Frames mit Befund (Teile ≠ 1 oder offene Randpixel):', [(k, n_) for (k, n_, offen) in schlecht])
    L.speichern('sandy-blob', 'Sandy Blob', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sandy-blob-strip.png', frames[::2], spalten=12, scale=8)
