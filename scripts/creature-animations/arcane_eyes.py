# -*- coding: utf-8 -*-
"""Idle-Animation für „Arcane Eyes“ (Creature).

Quelle: src/arcane-eyes.png — Ebene „Arcane Eyes“ (54×18 px, 11 Farben) aus MotiveBoons.xcf (Ebene 1398): ZWEI schwebende Augen (links x 0–18, rechts x 35–53, y 0–10)
und darunter je ein flacher Bodenschatten (y 15–17). Die Augen sind Spiegelbilder voneinander (Weißes außen, Iris innen).
Die Schatten sind in der Quelle halbtransparent (Alpha 204, Farbe (17,20,21)); der Extraktor hatte sie fallengelassen — ich habe sie DECKEND (Alpha 255) wieder
eingesetzt (46 Pixel, einzige ERGÄNZUNG an der Quelle, siehe unten). Schalter SCHATTEN = False lässt sie ganz weg.
PICK: [["MotiveBoons", 1398, 1], ["MotiveBoons", 1398, 2]]  (wie creature_show/creature_extract; Augen als eine Ebene)

Aufruf:   python3 arcane_eyes.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/arcane-eyes.png + .json

Was ist was (je Auge, Koordinaten relativ zum Auge 0..18 × 0..10):
* Mandelförmiger Augapfel mit 1-px-Umriss (Grautöne A (127), B (84), oben heller); Lederhaut weiß/hellgrau (E, F, G, J-frei) mit Schattierung zur Rückseite.
* Iris: violetter Ring (H dunkel links/unten, C mittel, D hell rechts/oben), schwarze Pupille (I, 5 px rund) mit hellem Glanzpunkt J (3 px, (8,4) (9,4) (9,5)).
  Der Glanzpunkt ist ein schlichter Augen-Lichtpunkt, kein Stern, kein Glitzer (Regel 14: Auge = kein Metall/Edelstein).
* Schatten unter jedem Auge: 7/9/7 px breite Ellipse (K), liegt am Boden, folgt dem Auge seitlich.
Fest bleiben: Augapfelform + Umriss (Randpixel unverändert), Irisform, Pupillenform im Ruhebild.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Funken ausgenommen; jedes Auge für sich, versetzt):
* Schweben: jedes Auge steigt starr bis 2 px, zweistufig 0-1-2-1-0 (Auge 1 Periode 24, Auge 2 Periode 16 — laufen auseinander); dazu ein langsames seitliches Treiben
  −1/0/+1 px (Periode 48, die Augen gegenläufig). Der Schatten schrumpft, wenn das Auge steigt (7/9/7 → 5/9/5 → 3/7/3 px) und wandert seitlich mit.
* Iris-Blick (Sakkaden): die Iris samt Pupille und Glanzpunkt springt ±1 px (waagerecht, und ±1 px senkrecht), jedes Auge nach eigenem Plan, das zweite 2 Frames
  später; Lederhaut-Farbe füllt die frei werdenden Stellen (ERGÄNZUNG, nur Farben der Lederhaut des Sprites), am Lid wird die Iris abgeschnitten (nie über den Umriss).
* Pupille weitet/verengt sich (Verengen: Randring der Pupille wird zur Irisfarbe; Weiten: innerer Irisring wird schwarz), je Auge zwei Phasen pro Schleife.
* Iris leuchtet auf: ein runder Leuchtring läuft von der Pupille zum Irisrand (Ring-Pixel eine Stufe heller: H → C → D), je Auge zweimal pro Schleife, gegeneinander versetzt.
* Blinzeln: Oberlid und Unterlid schließen sich (Lidfarbe A (127), Lidkante B (84), nur auf dem Augapfel-Inneren, nie über den Umriss), je Auge zweimal pro Schleife
  (5 Frames), das zweite Auge 2–6 Frames versetzt; Auge 2 kneift einmal kurz (Oberlid halb, 6 Frames).
* Arkane Funken (Partikel, hinter den Augen, 10 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, Formen k, o): violette Kugeln/Funken (D, C) und weiße
  Lichtfunken (E), alles Farben aus dem Sprite; einige zwischen den Augen, andere an den Außenseiten.
Randpixel-Test (Regel 16): kein Randpixel der Augen ändert sich (Augapfel starr, alles Innere liegt im Augapfel-Inneren); die Schatten-Randpixel haben die Quellfarbe K.
ERGÄNZUNG: (1) 46 Schattenpixel K deckend statt Alpha 204; (2) Lederhaut-Füllung unter der verschobenen Iris (Farben E/F/G des Sprites), nur sichtbar, wenn die Iris blickt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, kein Alpha.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Partikel vergrößern ihn höchstens 2 px über den Figurenrand hinaus, dazu 1 px leerer Rand). Die Figur selbst ist
in jedem Frame pixelgleich zur Fassung vor dem Zuschnitt (automatisch geprüft); nur die Leinwand ist kleiner; die Partikel laufen kürzere Wege.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)

N, MS = 48, 60
GPL, GPR, GPT, GPB = 9, 8, 9, 5
SCHATTEN = True

spr = L.lade('arcane-eyes')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, B_, C_, D_, E_, F_, G_, H_, I_, J_, K_ = (127, 127, 127), (84, 84, 84), (71, 0, 142), (127, 0, 255), (255, 255, 255), (196, 196, 196), (153, 153, 153), \
    (45, 0, 91), (0, 0, 0), (204, 204, 204), (17, 20, 21)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (A_, B_, C_, D_, E_, F_, G_, H_, I_, J_, K_))
RING = {C_, D_, H_}
IRIS_FARBEN = {C_, D_, H_, I_, J_}
RAMPE = {H_: C_, C_: D_}                               # Leuchten: eine Stufe heller
OX = [0, 35]                                            # linke Kante jedes Auges im Sprite (19 px breit, y 0–10)
SCH_CX = [9, 44]                                        # Mitte des Schattens


def farbe(a, x, y):
    return tuple(int(v) for v in a[y, x, :3])


def nachbarn4(x, y):
    return ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))


AUGE, SCHAT, INNEN, IRISP, BG, ZENTRUM = [], [], [], [], [], []
for ox in OX:
    m = vorhanden & (yy <= 10) & (xx >= ox) & (xx < ox + 19)
    AUGE.append(m)
    SCHAT.append(vorhanden & (yy >= 15) & (xx >= ox) & (xx < ox + 19))
    teilsp = np.zeros_like(spr)
    teilsp[m] = spr[m]
    rand = U.kanten(teilsp)
    innen = m & ~rand
    INNEN.append(innen)
    iris = {(x, y): farbe(spr, x, y) for y, x in zip(*np.nonzero(m)) if farbe(spr, x, y) in IRIS_FARBEN}
    assert all(innen[y, x] for (x, y) in iris), 'Irispixel am Rand'
    IRISP.append(iris)
    ZENTRUM.append((sum(p[0] for p in iris) / len(iris), sum(p[1] for p in iris) / len(iris)))
    # Hintergrund: Auge, aber unter der Iris Lederhaut-Farbe (nächstes Lederhautpixel, bei Gleichstand das weiter vom Irismittelpunkt entfernte)
    leder = [(x, y) for y, x in zip(*np.nonzero(innen)) if (x, y) not in iris]
    bg = np.zeros_like(spr)
    bg[m] = spr[m]
    zx, zy = ZENTRUM[-1]
    for (x, y) in iris:
        best = min(leder, key=lambda q: (abs(q[0] - x) + abs(q[1] - y), -(abs(q[0] - zx) + abs(q[1] - zy))))
        bg[y, x, :3] = spr[best[1], best[0], :3]
    BG.append(bg)
assert sum(int(m.sum()) for m in AUGE) + sum(int(m.sum()) for m in SCHAT) == int(vorhanden.sum())

# --- Pläne je Auge (Frame-Nummern; Frame 0 = Ruhe) ---
BLICK = [[(0, 0, 0), (8, 1, 0), (16, 1, 1), (22, 0, 0), (28, -1, 0), (36, -1, -1), (42, 0, 0)],
         [(0, 0, 0), (10, 1, 0), (18, 1, 1), (24, 0, 0), (30, -1, 0), (38, -1, -1), (44, 0, 0)]]       # (ab Frame, Iris-dx, Iris-dy)
PUPILLE = [{**{t: 1 for t in range(7, 15)}, **{t: -1 for t in range(26, 34)}},
           {**{t: -1 for t in range(10, 18)}, **{t: 1 for t in range(34, 43)}}]                        # +1 verengt, −1 weitet
LEUCHT = [(3, 27), (11, 35)]                                                                          # Start der zwei Leuchtringe je Auge (je 11 Frames)
BLINZ = [{16: 0, 38: 0}, {18: 0, 44: 0}]                                                              # Start der Lidschläge (5 Frames: 1 2 3 2 1)
LIDFOLGE = [1, 2, 3, 2, 1]
KNEIF = range(28, 34)                                                                                 # Auge 2: Oberlid halb (nur Auge 2)


def blick(k, i):
    cur = BLICK[k][0]
    for kf in BLICK[k]:
        if i >= kf[0]:
            cur = kf
    return cur[1], cur[2]


def lidstufe(k, i):
    for start in BLINZ[k]:
        if 0 <= i - start < len(LIDFOLGE):
            return LIDFOLGE[i - start]
    if k == 1 and i in KNEIF:
        return 1
    return 0


def iris_pixel(k, i):
    """Iris-Pixel des Auges k in Frame i (Pupille weiten/verengen, Leuchtring) vor dem Verschieben."""
    pix = dict(IRISP[k])
    zx, zy = ZENTRUM[k]
    pu = PUPILLE[k].get(i, 0)
    if pu == 1:                                        # verengen: Pupillenrand wird Irisfarbe
        neu = {}
        for (x, y), c in pix.items():
            if c == I_:
                ring = [pix[q] for q in nachbarn4(x, y) if q in pix and pix[q] in RING]
                if ring:
                    neu[(x, y)] = H_ if H_ in ring else max(set(ring), key=ring.count)
        pix.update(neu)
    elif pu == -1:                                     # weiten: innerer Irisring wird schwarz
        neu = {}
        for (x, y), c in pix.items():
            if c in RING and all(q in pix for q in nachbarn4(x, y)) and any(pix[q] == I_ for q in nachbarn4(x, y)):
                neu[(x, y)] = I_
        pix.update(neu)
    for s in LEUCHT[k]:                                # Leuchtring von innen nach außen
        j = i - s
        if 0 <= j <= 10:
            front = 1.5 + 0.45 * j
            for (x, y), c in pix.items():
                if c in RAMPE and front - 1.1 <= math.hypot(x - zx, y - zy) <= front + 0.4:
                    pix[(x, y)] = RAMPE[c]
    return pix


def auge(k, i):
    img = BG[k].copy()
    ix, iy = blick(k, i)
    for (x, y), c in iris_pixel(k, i).items():
        tx, ty = x + ix, y + iy
        if INNEN[k][ty, tx]:                           # am Lid abgeschnitten, nie über den Umriss
            img[ty, tx, :3] = c
            img[ty, tx, 3] = 255
    t = lidstufe(k, i)
    if t:
        for y, x in zip(*np.nonzero(INNEN[k])):
            top = {1: 3, 2: 4, 3: 5}[t]
            if y < top:
                img[y, x, :3] = A_
            elif y == top:
                img[y, x, :3] = B_
            if t == 2:
                if y > 8:
                    img[y, x, :3] = A_
                elif y == 8:
                    img[y, x, :3] = B_
            elif t == 3 and y > 5:
                img[y, x, :3] = A_
    return img


def schatten(k, b):
    cx = SCH_CX[k]
    out = L.leer(sh, sw)
    if not SCHATTEN:
        return out
    halb = {0: (3, 4), 1: (2, 4), 2: (1, 3)}[b]       # Halbbreite oben/unten, Halbbreite Mitte
    for y, h in ((15, halb[0]), (16, halb[1]), (17, halb[0])):
        for x in range(cx - h, cx + h + 1):
            out[y, x, :3] = K_
            out[y, x, 3] = 255
    return out


assert all(np.array_equal(schatten(k, 0)[SCHAT[k]], spr[SCHAT[k]]) for k in range(2)) or not SCHATTEN
assert all(np.array_equal(auge(k, 0)[AUGE[k]], spr[AUGE[k]]) for k in range(2))

PUR = {'c': D_, 'r': C_}
WEISS = {'c': E_, 'r': F_}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS_PUR = [
    dict(x=P(1, 11)[0], y=P(1, 11)[1], vx=-1, vy=-9, off=0, form='o', wackeln=1),        # außen links, steigt am linken Auge auf
    dict(x=P(22, 12)[0], y=P(22, 12)[1], vx=1, vy=-10, off=17, form='k', wackeln=1),      # zwischen den Augen
    dict(x=P(30, 10)[0], y=P(30, 10)[1], vx=0, vy=-9, off=33, form='o', wackeln=1),
    dict(x=P(27, 13)[0], y=P(27, 13)[1], vx=0, vy=-10, off=8, form='k', wackeln=1),
    dict(x=P(53, 11)[0], y=P(53, 11)[1], vx=1, vy=-9, off=25, form='o', wackeln=1),       # außen rechts
    dict(x=P(36, 12)[0], y=P(36, 12)[1], vx=-1, vy=-9, off=40, form='k', wackeln=1),
]
PUFFS_WEISS = [
    dict(x=P(19, 8)[0], y=P(19, 8)[1], vx=1, vy=-8, off=12, form='k', wackeln=1),
    dict(x=P(-1, 5)[0], y=P(-1, 5)[1], vx=-1, vy=-8, off=30, form='k', wackeln=1),
    dict(x=P(33, 6)[0], y=P(33, 6)[1], vx=-1, vy=-8, off=3, form='k', wackeln=1),
    dict(x=P(54, 6)[0], y=P(54, 6)[1], vx=1, vy=-9, off=21, form='k', wackeln=1),
]
PERIODE_BOB = [24, 16]


def frame_gross(i, nur=None):
    ebenen = []
    for k in range(2):
        b = U.stufe(i, PERIODE_BOB[k], 2)                                  # 0-1-2-1-0 px Schweben
        dx = (U.stufe(i, N, 2, form='sin') - 1) * (1 if k == 0 else -1)       # langsames Treiben, die Augen gegenläufig
        ebenen.append((L.platz(schatten(k, b), H, W, GPL, GPT), dx, 0))
        ebenen.append((L.platz(auge(k, i), H, W, GPL, GPT), dx, -b))
    koerper = L.zusammen(H, W, ebenen)
    if nur == 'koerper':
        return koerper
    pur = _glut(H, W, i, N, PUFFS_PUR, PUR)
    weiss = _glut(H, W, i, N, PUFFS_WEISS, WEISS)
    return L.zusammen(H, W, [(pur, 0, 0), (weiss, 0, 0), (koerper, 0, 0)])


# Zuschnitt auf die Figur (Nutzerwunsch): symmetrisch um die Ruhefigur; Partikel dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
def _figur(i):
    _OHNE_PARTIKEL[0] = True
    try:
        return frame_gross(i, 'figur')
    finally:
        _OHNE_PARTIKEL[0] = False


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [_figur(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('arcane-eyes', 'Arcane Eyes', frames, MS, prev)
    if prev:
        L.streifen(prev + '/arcane-eyes-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
