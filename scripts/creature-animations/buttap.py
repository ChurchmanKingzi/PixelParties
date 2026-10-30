# -*- coding: utf-8 -*-
"""Idle-Animation für „Buttap“ (Creature).

PICK: [["MotiveDeepsea", 153, 2]]   (Sprite 31×36 px, 22 Farben, Ebene „Ebene #130“ aus MotiveDeepsea.xcf; nur Alpha 0/255)
Nicht verwendet: der Mann mit dem roten Stab (Figur 1 derselben Ebene) und der blaue Strudel hinter Buttap (Hintergrund der Karte).

Aufruf:   python3 buttap.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/buttap.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Körper: rosa-violettes Gel (ein runder Klumpen, x 7–21, y 8–23) mit dunkelviolettem Umriss F=(51,27,51), Farbstufen L/J/H/M, hellerer
  Seite rechts oben. Vier Augen: senkrechte Ovale aus hellblauen Rändern (N/O/P/T/U) mit dunklem Schlitz (P/T) — zwei oben ((10–12, 12–14) und
  (15–17, 11–14)), zwei unten ((10–12, 17–20) und (14–17, 17–19)); die hellen Pixel an den Rändern sind die Lichtpunkte.
* Vier Kettenarme aus dunkelblauem Umriss A=(41,49,86) und grauen Gliedern (E/G/I/Q), je mit einem blaugrauen Metallgewicht am Ende
  (B/C/D = (127,146,188), (109,128,168), (74,98,132)): oben links (Ansatz (7,15–17) am Körper, Kette läuft nach links hoch zum Gewicht bei
  (3–6, 4–7), darüber dünne Kettenreste bis y 0), oben rechts (Ansatz (21,11–13), Kette läuft rechts nach unten zum Gewicht bei (27–29, 23–24)),
  unten links (Ansatz (9–11, 22–23), hängt zum Gewicht bei (7–9, 31–34)) und unten rechts (Ansatz (19–21, 20–22), hängt zum Gewicht bei (21–23, 31–33)).
Fest bleiben: Augenform und Lichtpunkte, Körperumriss (nur Gel-Verformung).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Schweben: Körper samt Armen hebt und senkt sich um ±2 px (Periode 24); die Arme hängen mit eigenem Takt daran.
* Gel-Körper: Zeilen 15 und 16 (zwischen den Augenpaaren, ohne Details) werden verdoppelt/entfernt, dazu je Zeile Spalten am Wangenrand
  (x 9 und 19) verdoppelt (Stauchung breiter); Pulsieren in 16-Frame-Takt (−2 … +2 Zeilen). Die Arme wandern mit ihrem Ansatz mit
  (oben links/rechts folgen den Körperzeilen, unten bleiben sie am Körperfuß; beidseitig mit dem Umriss nach außen/innen).
* Kettenarme: jede Kette pendelt als Ganzes seitlich (Zeilenversatz wächst mit dem Abstand zum Ansatz, bis ±3 px an den Gewichten), vier
  verschiedene Takte (Perioden 24/16) und Phasen; die Gewichte schwingen nach.
* Blinzeln: alle vier Augen (Frames 16–18 und 40–42, Lid halb → zu → halb): die Lidfarbe ist die Körperfarbe rund um das jeweilige Auge.
* Metallglanz (Regel 14: Ketten und Gewichte sind Metall): zweimal pro Schleife (Frames 4–14 und 28–38) zieht ein diagonales Lichtband über die
  Ketten und Gewichte (Stahlrampe G→Q→D→C→B, Kettenglieder I→E→B; die Umrisse bleiben), dazu blitzen vierzackige Glitzersterne an den vier
  Gewichten auf. Der Gelkörper glänzt nicht.
* Dunst (Partikel): acht runde Violett-Punkte (`'k'`, `'s'`, `'o'`) steigen langsam um den Körper auf (hinter der Figur).
Ergänzungen: Beim Pendeln können dünne Kettenstücke nur über eine Pixelecke zusammenhängen: Brückenpixel in Kettenfarbe (anim_amorph.verbinde4).
Randpixel (Regel 16): Innenpixel der Ketten, die beim Pendeln am Rand frei liegen, werden mit dem Umriss A eingefasst (umriss_ergaenzen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 10, 8

spr = L.lade('buttap')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
ORB_Y0, ORB_Y1 = 8, 23
BODEN = PAD_T + ORB_Y1                       # Leinwandzeile der Körper-Unterkante im Ruhezustand

# ── Farben ──
def _c(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


PURPLE = {(51, 27, 51), (107, 57, 108), (118, 61, 112), (88, 47, 89), (129, 86, 139), (134, 107, 162)}
_pm = np.zeros((sh, sw), np.uint8)
for _y in range(sh):
    for _x in range(sw):
        if spr[_y, _x, 3] and _c(_x, _y) in PURPLE:
            _pm[_y, _x] = 1
_ff = _pm.copy()
cv2.floodFill(_ff, np.zeros((sh + 2, sw + 2), np.uint8), (0, 0), 2)
ORB = (_ff != 2) & (spr[..., 3] > 0)                                            # Körper samt Augen (Löcher im Violett)
AUGENMASKE = ORB & ~(_pm > 0)
_n, _lab = cv2.connectedComponents(AUGENMASKE.astype(np.uint8), connectivity=8)
AUGEN = [np.argwhere(_lab == k) for k in range(1, _n)]                          # je Auge: Array (y, x)
ARME_ROH = (spr[..., 3] > 0) & ~ORB
_n2, _lab2 = cv2.connectedComponents(ARME_ROH.astype(np.uint8), connectivity=8)
assert _n2 - 1 == 4, 'vier Arme erwartet'
# Arme sortiert: oben links, oben rechts, unten links, unten rechts
_arme = []
for k in range(1, _n2):
    ys, xs = np.nonzero(_lab2 == k)
    _arme.append((k, xs.min(), xs.max(), ys.min(), ys.max()))
_ol = [a for a in _arme if a[2] <= 12 and a[3] <= 5][0]
_or = [a for a in _arme if a[1] >= 21 and a[3] <= 12][0]
_ul = [a for a in _arme if a[3] >= 20 and a[2] <= 12 and a[0] != _ol[0]][0]
_ur = [a for a in _arme if a[3] >= 20 and a[1] >= 17 and a[0] != _or[0]][0]
ARM = {'ol': _lab2 == _ol[0], 'or': _lab2 == _or[0], 'ul': _lab2 == _ul[0], 'ur': _lab2 == _ur[0]}
# Ansatzzeile (Pivot des Pendels), Seite (−1 links/+1 rechts), Takt und Phase
ARMDATA = {'ol': dict(pivot=16, seite=-1, P=24, phi=0.0, amp=2.4, attach=17),
           'or': dict(pivot=12, seite=1, P=16, phi=1.3, amp=2.4, attach=12),
           'ul': dict(pivot=22, seite=-1, P=24, phi=2.4, amp=2.6, attach=23),
           'ur': dict(pivot=21, seite=1, P=16, phi=3.6, amp=2.6, attach=22)}
ORBBILD = np.where(ORB[..., None], spr, 0).astype(np.uint8)
RAND0 = A.randpixel(spr)

# Lidfarbe je Auge = häufigste Körperfarbe der Nachbarpixel außerhalb des Auges
LID = []
for pix in AUGEN:
    s_ = {(int(y), int(x)) for y, x in pix}
    cnt = {}
    for (y, x) in s_:
        for dy_, dx_ in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            q = (y + dy_, x + dx_)
            if q not in s_ and 0 <= q[0] < sh and 0 <= q[1] < sw and spr[q[0], q[1], 3] and ORB[q] and _c(q[1], q[0]) in PURPLE:
                cnt[_c(q[1], q[0])] = cnt.get(_c(q[1], q[0]), 0) + 1
    LID.append(max(cnt, key=cnt.get))

# Metallrampe (Ketten + Gewichte)
STAHL = {(48, 66, 90): (76, 96, 121), (76, 96, 121): (74, 98, 132), (74, 98, 132): (109, 128, 168), (109, 128, 168): (127, 146, 188),
         (112, 123, 127): (124, 132, 143), (124, 132, 143): (127, 146, 188)}
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(a in _farben and b in _farben for a, b in STAHL.items())
STERN_FARBEN = {'m': (170, 189, 228), 'a': (127, 146, 188), 's': (109, 128, 168)}
STAUBFARBEN = {'c': (134, 107, 162), 'r': (129, 86, 139)}
UMRISS_A = (41, 49, 86)
yy, xx = np.mgrid[0:sh, 0:sw]
ARMENALLE = ARM['ol'] | ARM['or'] | ARM['ul'] | ARM['ur']

# ── Zeitachsen ──
S = [int(round(1.7 * math.sin(2 * math.pi * i / 16))) for i in range(N)]
BOB = [int(round(2 * math.sin(2 * math.pi * i / 24))) for i in range(N)]        # + = hoch
BLINZELN = {16: 1, 17: 2, 18: 1, 40: 1, 41: 2, 42: 1}
SWEEPS = [4, 28]
POSEN = {-2: ({7, 8}, (), 1), -1: ({7}, (), 1), 0: ((), (), 0), 1: ((), {7}, 0), 2: ((), {7, 8}, 0)}
PAARE = ((9, 19),)

ORTE = {'gewicht_ol': (4, 5), 'gewicht_or': (28, 23), 'gewicht_ul': (8, 32), 'gewicht_ur': (22, 32)}
ORT_ARM = {'gewicht_ol': 'ol', 'gewicht_or': 'or', 'gewicht_ul': 'ul', 'gewicht_ur': 'ur'}
STERN_LAUF = [0, 1, 2, 1, 0]
STERNE = [(5, 'gewicht_ol'), (7, 'gewicht_or'), (9, 'gewicht_ul'), (11, 'gewicht_ur'),
          (29, 'gewicht_ur'), (31, 'gewicht_ul'), (33, 'gewicht_or'), (35, 'gewicht_ol'), (18, 'gewicht_or'), (44, 'gewicht_ul')]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


def armdx(name, y, i):
    """Seitlicher Versatz der Kettenzeile y (Sprite-Koordinate) in Frame i: Pendel, wächst mit dem Abstand zum Ansatz; Frame 0 = Quellform."""
    d = ARMDATA[name]
    maxd = ARMMAXD[name]
    frac = abs(y - d['pivot']) / float(maxd)
    ph = 2 * math.pi * i / d['P']
    return int(round(d['amp'] * frac * (math.sin(ph + d['phi']) - math.sin(d['phi']))))


ARMMAXD = {k: max(abs(int(y) - ARMDATA[k]['pivot']) for y in np.nonzero(ARM[k].any(axis=1))[0]) for k in ARM}
PUFFS = [
    dict(x=PAD_L - 3, y=PAD_T + 20, vx=-1, vy=-9, off=0, form='s', wackeln=1),
    dict(x=PAD_L + 33, y=PAD_T + 18, vx=1, vy=-9, off=3, form='k', wackeln=1),
    dict(x=PAD_L + 6, y=PAD_T + 26, vx=-1, vy=-8, off=6, form='o', wackeln=1),
    dict(x=PAD_L + 26, y=PAD_T + 28, vx=1, vy=-8, off=9, form='k', wackeln=1),
    dict(x=PAD_L + 2, y=PAD_T + 12, vx=-2, vy=-9, off=12, form='k', wackeln=1),
    dict(x=PAD_L + 30, y=PAD_T + 8, vx=2, vy=-9, off=15, form='s', wackeln=1),
    dict(x=PAD_L + 12, y=PAD_T + 25, vx=-1, vy=-8, off=18, form='k', wackeln=1),
    dict(x=PAD_L + 18, y=PAD_T + 26, vx=1, vy=-8, off=21, form='o', wackeln=1),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    # Lichtband nur auf Metall (Ketten/Gewichte), Umrisse bleiben
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 10:
            t = 2 + 4 * (i - s0)
            m = ARMENALLE & ~RAND0
            sp = A.farb_schritt(sp, STAHL, m & (xx + yy >= t) & (xx + yy < t + 5))
            sp = A.farb_schritt(sp, STAHL, m & (xx + yy >= t + 1) & (xx + yy < t + 4))
    b = BLINZELN.get(i, 0)
    if b:
        for k, pix in enumerate(AUGEN):
            ys = sorted({int(y) for y, x in pix})
            for (y, x) in pix:
                oben = (y <= ys[len(ys) // 2 - (1 if len(ys) % 2 == 0 else 0)]) if len(ys) > 1 else True
                if b == 2 or oben:
                    sp[y, x, :3] = LID[k]
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    s = S[i]
    loesch, dopp, p = POSEN[s]
    korper = A.zeilen_von(np.where(ORB[..., None], sp, 0).astype(np.uint8), ORB_Y0, ORB_Y1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(korper, loeschen=loesch, doppeln=dopp, p=p, paare=PAARE, x0=PAD_L)
    kb, top = A.auf_leinwand(z, H, BODEN, BOB[i])

    def neu_y(idx):
        """Leinwandzeile der Quellzeile idx (gelöschte Zeile → Nachbarzeile)."""
        for j, q in enumerate(quelle):
            if q >= idx:
                return top + j - (1 if q > idx else 0)
        return top + len(quelle) - 1

    schicht = [(kb, 0, 0)]
    arm_off = {}
    for name, d in ARMDATA.items():
        layer = L.platz(np.where(ARM[name][..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
        out = L.leer(H, W)
        for y in range(sh):
            xs = np.nonzero(layer[PAD_T + y, :, 3])[0]
            if not len(xs):
                continue
            dx = armdx(name, y, i)
            if xs.min() + dx < 0 or xs.max() + dx >= W:
                raise L.ClipError(f'Armzeile {y} würde um {dx} aus der Leinwand')
            for x in xs:
                out[PAD_T + y, x + dx] = layer[PAD_T + y, x]
        out, _ = A.verbinde4(out)
        dy = neu_y(d['attach'] - ORB_Y0) - (PAD_T + d['attach'])
        if name in ('ul', 'ur'):
            dy = top - PAD_T - ORB_Y0 + (BOB[i] if False else 0) if False else (BODEN - BOB[i] - (PAD_T + ORB_Y1))
        arm_off[name] = (-p if d['seite'] < 0 else p, dy)
        schicht.append((out, arm_off[name][0], arm_off[name][1]))
    fig = L.zusammen(H, W, schicht)
    # Randpixel (Regel 16): frei liegende Innenpixel der Ketten bekommen den Umriss A
    armm = np.zeros((H, W), bool)
    for (a_, dx_, dy_) in schicht[1:]:
        armm |= L.versetze(a_, dx_, dy_)[..., 3] > 0
    erlaubt = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(RAND0))}
    fig, neu = A.umriss_ergaenzen(fig, erlaubt, lambda x, y: UMRISS_A if armm[y, x] else (51, 27, 51))
    return dict(fig=fig, top=top, kb=kb, arm_off=arm_off, armm=armm, neu=neu)


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        name = ORT_ARM[ort]
        dxo, dyo = f['arm_off'][name]
        A.stern(e, PAD_L + x + armdx(name, y, i) + dxo, PAD_T + y + dyo, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    dunst = L.puff_ebene(H, W, i, 24, PUFFS, STAUBFARBEN)
    return L.zusammen(H, W, [(dunst, 0, 0), (f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    print('Augen:', [len(a) for a in AUGEN], 'Lidfarben:', LID)
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    A.ausdruck_pruefen(figs, spr, 'buttap')
    L.speichern('buttap', 'Buttap', frames, MS, prev)
    if prev:
        L.streifen(prev + '/buttap-strip.png', frames[::2], spalten=12, scale=4)
