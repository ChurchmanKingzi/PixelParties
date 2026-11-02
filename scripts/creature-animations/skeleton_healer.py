# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Healer“ (Creature) — Runde 2: ohne den kopflosen Körper und ohne den braunen Schuh, Kinn bewegt sich mit dem Kopf.

Quelle: src/skeleton-healer.png — zwei Ebenen aus Motive.xcf (beide heißen „Healer Skele“), 24×32 px, 375 px, auf einer Leinwand:
  A = Ebene 64 „Healer Skele #2“ (20×24 px, 255 px): stehendes Skelett mit rotem Federbusch, grünen Augen, Handschuhen und Stiefeln — der Heiler,
  B = Ebene 63 „Healer Skele #1“ (14×18 px, 152 px): Totenkopf mit olivgrünem Stahlhelm und grünem Blatt, liegt in der Kunst vor dem Heiler (obenauf).
Nutzer-Korrektur: „der kopflose Körper daneben soll nicht mit ins Bild, der braune Schuh unten auch nicht, und das Kinn wird viel zu dick, das muss sich mit dem Kopf mitbewegen.“
→ ENTFERNT: Ebene 65 Figur 2 (C: das liegende, kopflose Skelett „Patient“, 25×17 px) und das kleine braune Häufchen darunter (Schuh, x 17–21, y 30–34 des alten Komposits).
PICK: [["Motive", 64, 1], ["Motive", 63, 1]]   (src/skeleton-healer-a.png / -b.png = die Teile einzeln, mit ihren verdeckten Pixeln — A hat 32 Pixel unter dem Helmkopf B;
src/skeleton-healer-c.png ist nicht mehr in Gebrauch)

Aufruf:   python3 skeleton_healer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-healer.png + .json

Was ist was (x/y im Sprite):
* A (Heiler, x 0–19, y 8–31): roter Federbusch (x 7–12, y 8–12; die Spitze (9–10, 8–9) ist 2×2 hell), Schädel y 12–17 mit grünen Augen (8,15) (7–8,16) und (12,15) (11–12,16), das KINN
  ist die Kieferzeile y 17 (x 6–13); darunter Hals/Wirbelsäule (y 18–19, helle Mitte (9–10)), Rippen y 19–22 mit weißer Wirbelsäule (9–10, y 19–21), Becken y 23–26, Beine y 27–29,
  grüne Stiefel (4–6,30–31) und (12–15,28–31); grüner Handschuh unten links (0–3, 23–25) mit Armknochen darüber, und ein erhobener grüner Handschuh rechts (16–19, 13–16) mit Handgelenk (16–18, 17)
  auf dem Armknochen (15–17, 18–19). Der Handschuh liegt größtenteils hinter dem Helmkopf B.
* B (Helmkopf, x 10–23, y 0–17): Stahlhelm (Olivtöne, helle Bänder y 3 und y 7), grünes Blatt oben rechts (20–22, 0–3), darunter der Schädel mit schwarzen Augenhöhlen und offenem Kiefer.
Fest bleiben: Helmform, Stiefel, Beine, Becken, Handschuh unten links.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel ausgenommen):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): Der ganze Oberkörper des Heilers — Federbusch, Kopf MIT Kinn, Hals, Schultern, Rippen bis y 21, Arme — hebt sich STARR um 0–2 px; die Zeile y 22 (Rippenunterkante, keine
  Wirbelsäule, keine Kieferpartie) wird 1–2× eingefügt (L.streck_zeile, Texturmischung), Becken, Beine und Stiefel bleiben am Boden. Hals und Kinn werden nicht länger (früher wurde Zeile y 21 mit der weißen
  Wirbelsäule gedoppelt: das war das „zu dicke Kinn“).
* Federbuschspitze (2×2 bei (9–10, 8–9)) wippt seitlich −1/0/+1 px (Periode 16, hängt an der Buschbasis, wandert mit dem Kopf).
* Blinzeln des Heilers (Lidfarbe = umgebendes Knochenweiß (246,255,255)): beide grünen Augen werden 3 Frames weiß, zweimal pro Schleife (Frame 13–15 und 37–39).
* Erhobene Hand (rechts) winkt/segnet: Handschuh + Handgelenk heben sich 0-1-2-1-0 px (Periode 16, 3× pro Schleife; das Handgelenk wird dabei nur länger, nicht dicker) zusätzlich zum Atmen.
* Helmkopf B hebt sich mit dem Atem des Heilers (gleiche 0–2 px, damit der Federbusch nie über den Helmrand lugt) plus kleiner Hub 0/1 px (Periode 16); KEIN seitliches Treiben. Das Blatt wippt (die Spitze (22,0) springt für 4 Frames nach (21,0), Frame 10–13 und 34–37).
  B liegt über A; die unter B verdeckten Pixel von A sind aus der Ebene vorhanden (nichts neu gemalt).
* Heilwölkchen (Partikel, hinter den Figuren, 5 Stück, Lebensdauer 48 Frames, langsam aufsteigend, 2×2 → 3×3 → 2×2): grün (Kern Handschuhgrün (0,135,0), Rand (0,90,0) / (20,130,17)), steigen von der erhobenen Hand,
  vom Handschuh links und neben dem Blatt auf.
Kein Glanz (Knochen/Stoff), kein Feuer. Randpixel-Test (Regel 16): `U.kontur_schliessen` in jeder Pose; im Ruhebild nichts.
Zuschnitt: symmetrisch um die Ruhefigur; Wölkchen vergrößern ihn höchstens 2 px, dazu 1 px leerer Rand.
ERGÄNZUNG: keine gemalten Pixel außer den Handgelenks-Kopien (Zeile y 17, x 16–18 des Originals) bei gehobener Hand. Alle Bewegungen laufen auf der vollen Leinwand (ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 8, 6

spr = L.lade('skeleton-healer')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
A_SP, B_SP = L.lade('skeleton-healer-a'), L.lade('skeleton-healer-b')
_komp = np.zeros_like(spr)
for _t in (A_SP, B_SP):
    _m = _t[..., 3] > 0
    _komp[_m] = _t[_m]
assert np.array_equal(_komp, spr), 'Teile ergeben nicht den Sprite'
UMRISS = U.umrissfarben(spr)
col = lambda a, x, y: tuple(int(v) for v in a[y, x, :3])
yy, xx = np.mgrid[0:sh, 0:sw]

WEISS = (246, 255, 255)
AUGEN = [(8, 15), (7, 16), (8, 16), (12, 15), (11, 16), (12, 16)]
assert col(A_SP, 8, 15) == (20, 130, 17) and col(A_SP, 7, 16) == (8, 56, 7)
BLATT = (22, 0)
assert col(B_SP, *BLATT) == (0, 90, 0)
BLINZ = {13, 14, 15, 37, 38, 39}
BLATT_FRAMES = {10, 11, 12, 13, 34, 35, 36, 37}
SCHWARZ_AUSSEN = (26, 26, 26)
assert SCHWARZ_AUSSEN in {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}

ROT = {(255, 0, 0), (255, 59, 59), (216, 0, 0), (153, 0, 0), (95, 0, 0)}
a_da = L.deckend(A_SP)
plume = np.array([[bool(a_da[y, x]) and col(A_SP, x, y) in ROT for x in range(sw)] for y in range(sh)])
handschuh = a_da & (xx >= 15) & (yy <= 17) & ~plume              # erhobener Handschuh + Handgelenk (Zeile y 17)
koerper = a_da & ~plume & ~handschuh
WRIST_Y = 17
assert plume.sum() > 0 and handschuh.sum() > 0
ZEILE_STRECK = 22                                                 # Rippenunterkante: ohne Wirbelsäule, ohne Kiefer

GRUEN1 = {'c': (0, 135, 0), 'r': (0, 90, 0)}          # Kugeln: Kern Handschuhgrün, Rand dunkles Blattgrün
_alle = {col(spr, x, y) for y in range(sh) for x in range(sw) if spr[y, x, 3]}
assert all(v in _alle for v in GRUEN1.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(20, 13)[0], y=P(20, 13)[1], vx=1, vy=-9, off=0, wackeln=1),        # von der erhobenen Hand
    dict(x=P(2, 22)[0], y=P(2, 22)[1], vx=-1, vy=-8, off=14, wackeln=1),        # vom Handschuh unten links
    dict(x=P(22, 6)[0], y=P(22, 6)[1], vx=1, vy=-6, off=28, wackeln=1),         # neben dem Blatt
    dict(x=P(19, 15)[0], y=P(19, 15)[1], vx=2, vy=-8, off=38, wackeln=1),       # zweite von der Hand
    dict(x=P(3, 18)[0], y=P(3, 18)[1], vx=-1, vy=-6, off=6, wackeln=1),         # links an der Schulter
]


def teil(a, maske):
    t, _ = L.trenne(a, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def verschieben_y(a, dy):
    return L.versetze(a, 0, dy)


def frame_gross(i, nur=None):
    n_a = U.stufe(i, 24, 2)                                      # Heiler atmet 0-1-2-1-0
    hub_b = U.stufe(i, 16, 1)                                    # kleiner Hub 0/1 (Periode 16)
    wink = U.stufe(i - 4, 16, 2)                                 # erhobene Hand winkt 0-1-2-1-0 (Periode 16)
    tip = U.stufe(i, 16, 2, form='sin') - 1                      # Federbuschspitze −1/0/+1

    # --- A: Körper (alles ohne Federbusch und erhobene Hand) atmet: Oberkörper starr hoch, Zeile 22 wird gedoppelt ---
    pk = teil(A_SP, koerper)
    if i in BLINZ:
        for (x, y) in AUGEN:
            pk[GPT + y, GPL + x, :3] = WEISS
    if n_a:
        pk = L.streck_zeile(pk, GPT + ZEILE_STRECK, n_a)
    # --- Federbusch: hebt sich starr mit dem Kopf; die Spitze (2×2) wippt seitlich ---
    pp = teil(A_SP, plume)
    if tip:
        for y in (8, 9):
            row = pp[GPT + y].copy()
            pp[GPT + y] = 0
            for x in range(W):
                if row[x, 3]:
                    pp[GPT + y, x + tip] = row[x]
    pp = verschieben_y(pp, -n_a)
    # --- erhobene Hand: hebt sich mit dem Oberkörper und winkt zusätzlich; das Handgelenk wird nur länger (Zeile y 17 kopiert) ---
    ph = teil(A_SP, handschuh)
    wrist = ph[GPT + WRIST_Y].copy()
    ph = verschieben_y(ph, -n_a - wink)
    for k in range(1, wink + 1):
        ph[GPT + WRIST_Y - n_a - wink + k] = np.where(wrist[:, 3:4] > 0, wrist, ph[GPT + WRIST_Y - n_a - wink + k])
    # --- B: Helmkopf ---
    pb = teil(B_SP, L.deckend(B_SP))
    if i in BLATT_FRAMES:
        pb[GPT + BLATT[1], GPL + BLATT[0] - 1] = pb[GPT + BLATT[1], GPL + BLATT[0]]
        pb[GPT + BLATT[1], GPL + BLATT[0]] = 0
    koerper_ges = L.zusammen(H, W, [(pk, 0, 0), (pp, 0, 0), (ph, 0, 0), (pb, 0, -n_a - hub_b)])
    koerper_ges = U.kontur_schliessen(koerper_ges, UMRISS, SCHWARZ_AUSSEN)
    if nur == 'koerper':
        return koerper_ges
    k1 = _wolke(H, W, i, N, PUFFS, GRUEN1)
    return L.zusammen(H, W, [(k1, 0, 0), (koerper_ges, 0, 0)])


_OHNE_PARTIKEL = [False]
TEST_EBENEN = 'koerper'


def _wolke(*a, **k):
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.wolke_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Wölkchen dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('skeleton-healer', 'Skeleton Healer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-healer-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
