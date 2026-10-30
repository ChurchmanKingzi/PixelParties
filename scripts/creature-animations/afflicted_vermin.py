# -*- coding: utf-8 -*-
"""Idle-Animation für „Afflicted Vermin“ (Creature).

PICK: [["MotiveEgypt", 176, 5]]   — Ebene „Infected Vermin“ (MotiveEgypt.xcf). Die Figur enthält zwei Ratten-auf-Topf-Exemplare; genommen ist
das obere linke (Ausschnitt x 0–13, y 0–19 der extrahierten Figur, Rest = das zweite Exemplar): src/afflicted-vermin.png (14×20 px,
23 Farben). Die leeren Töpfe der Szene (Ebene 176 Figuren 1/2/8/9, Ebene 181) sind Beiwerk und bleiben unberührt.
Die Ebene hat nur Alpha 0/255 (keine Halbtransparenz).

Aufruf:   python3 afflicted_vermin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/afflicted-vermin.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Goldener Krug (Zeilen 9–19, x 0–13): Gold in vier Stufen A=(194,150,0), B=(234,180,9), F=(254,197,22), L=(255,219,79) (Lichter bei (1,13),
  (10,13), (12,13), (10,14), (2,12), (11,12)), Schatten C=(125,75,0); zwei Henkelschlitze (dunkelgrau) bei (2,13–15) und (11,13–15);
  Kragen/Rand Zeile 10 (links (3–4,10), rechts (9–10,10)); in der Krugöffnung (5–8, 10) sitzt der dunkle Hals der Ratte.
* Ratte (Zeilen 3–10) schaut über den Krugrand nach rechts: graubrauner Kopf (D, E, G, V), Ohren bei (4–5, 4–5) und (10–11, 4–5)
  mit rosa Ohrinnerem (5,5), zwei rote Augen Q=(255,0,0) bei (8,6) und (10,6), schwarze Schnauzenlinie (9–11, 9), rosa Nase W bei (12,9),
  dunkler Hals H bei (5–8, 10). Zwischen Kapuze und Stirn: hautfarbene Stirn (7–10, 3) und zwei hellgrüne Pixel S/T bei (8–9, 4)
  (nicht eindeutig: Binde/Eiter/Glanz? → bleibt fest).
* Kapuze (Zeilen 0–3): dunkelviolette Stoffkapuze (I, J, K) mit hellvioletten Lichtern N, R bei (7,1), (9,2), (10,0). Stoff → schwingt,
  glänzt nicht.
Fest bleiben: Krug (nur Glanz), Stirn und die grünen Pixel S/T, Schnauzenlinie, Ohren.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Spähen: die Ratte hebt und senkt Kopf samt Kapuze um ±1 px über dem Krugrand (zwei überlagerte Perioden 24 und 12). Hebt sie sich, wächst
  der Hals nach (ergänzt, siehe unten); sinkt sie, verschwindet das Kinn hinter dem Krugrand.
* Kapuze: der Stoff schwingt an der Spitze bis ±2 px seitlich (Periode 16, Versatz wächst zur Spitze, Spitze hinkt nach).
* Nase zuckt (hüpft 1 px nach oben, Frames 6–7, 14–15, 30–31, 38–39); Augen blinzeln (Frames 20–22 und 40–42: rot → Fell) und glimmen
  schwächer (rot → dunkles Rosa, Frames 10–11, 26–27, 44).
* Glanz nur am Gold (Regel 14): zweimal pro Schleife (Frames 4–16 und 28–40) zieht ein diagonales Lichtband über den Krug (1–2 Stufen
  auf der Goldrampe C→A→B→F→L), dazu blitzen vierzackige Glitzersterne an den Krug-Lichtern (5 Frames Lauf) und acht Goldstaub-Punkte steigen
  langsam neben dem Krug auf. Kapuze, Fell und Ratte glänzen nicht.
Ergänzungen: Hals der Ratte im Krugmund bei Zeile 9: (5–8, 9) in Halsfarbe H=(66,60,47), dazu Seitenumriss (4, 9) D=(82,60,38) und (9, 9)
M=(29,20,14) — wird sichtbar, sobald sich der Kopf hebt (liegt bei Ruhe hinter dem Kinn). Außerdem werden Innenpixel, die beim
Schwingen der Kapuze oder Heben des Kopfes am Rand frei liegen, mit der Umrissfarbe eingefasst (Kapuze J, Kopf D, Krug A).
Nähte (Regel 11) und Randpixel (Regel 16): Kopf, Kapuze, Hals und Krug liegen 4-verbunden; je Frame prüft das Skript, dass die Figur aus
genau einem 4-zusammenhängenden Teil besteht (`randtest.py`: 0 Frames mit Randpixeln in Nicht-Umrissfarbe).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 9, 4

spr = L.lade('afflicted-vermin')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R

# ── Farben der Quelle ──
VA, VB, VC, VD, VE, VF, VG, VH, VI, VJ, VK, VL, VM, VN, VO, VP, VQ, VR, VS, VT, VU, VV, VW = (194, 150, 0), (234, 180, 9), (125, 75, 0), (82, 60, 38), \
    (116, 98, 79), (254, 197, 22), (143, 125, 97), (66, 60, 47), (45, 32, 59), (59, 42, 77), (38, 27, 50), (255, 219, 79), (29, 20, 14), (184, 164, 205), \
    (204, 158, 116), (220, 194, 124), (255, 0, 0), (166, 141, 192), (228, 234, 156), (204, 214, 140), (204, 126, 130), (86, 72, 58), (205, 79, 85)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for c in (VA, VB, VC, VD, VE, VF, VG, VH, VI, VJ, VK, VL, VM, VN, VO, VP, VQ, VR, VS, VT, VU, VV, VW):
    assert c in _farben, c
GOLD = {VA, VB, VC, VF, VL}
GOLDRAMPE = {VC: VA, VA: VB, VB: VF, VF: VL}
STERN_FARBEN = {'m': VS, 'a': VL, 's': VF}
STAUBFARBEN = {'c': VL, 'r': VF}

# ── Teile ──
yy, xx = np.mgrid[0:sh, 0:sw]
farbe_ist = lambda cs: L.farbmaske(spr, list(cs))
KRUG = farbe_ist(GOLD) | (farbe_ist([VH]) & ((xx == 2) | (xx == 11)) & (yy >= 13))
RATTE = (spr[..., 3] > 0) & ~KRUG
KAPUZE = farbe_ist([VI, VJ, VK, VN, VR]) & (yy <= 3)
KOPF = RATTE & ~KAPUZE & (yy <= 9)
HALS = RATTE & (yy >= 10)                                                       # (5–8, 10): dunkler Hals im Krugmund
KRUG_INNEN = KRUG & ~A.randpixel(spr)                                           # der Krugrand (Umriss) wird nie aufgehellt
RAND_FARBEN = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(A.randpixel(spr)))}
AUGEN = [(8, 6), (10, 6)]
NASE = (12, 9)

# ── Zeitachsen ──
KOPF_DY = [int(round(0.9 * math.sin(2 * math.pi * i / 24) + 0.5 * math.sin(2 * math.pi * i / 12 + 1.0))) for i in range(N)]    # + = tiefer
BLINZELN = {20, 21, 22, 40, 41, 42}
AUGEN_DIMM = {10, 11, 26, 27, 44}
NASE_ZUCKT = {6, 7, 14, 15, 30, 31, 38, 39}
SWEEPS = [4, 28]
assert KOPF_DY[0] == 0

ORTE = {'l1': (1, 13), 'l2': (10, 13), 'l3': (12, 13), 'l4': (10, 14), 'f1': (2, 12), 'f2': (11, 12)}
STERN_LAUF = [0, 1, 2, 1, 0]


def _zeitplan():
    plan = []
    for s0, orte in ((4, ['f1', 'l1', 'l4', 'l2', 'f2', 'l3']), (28, ['l3', 'f2', 'l2', 'l1', 'f1', 'l4'])):
        for o in orte:
            d = sum(ORTE[o])
            plan.append((int(round(s0 + (d - 4) / 3.0)) - 2, o))
    plan += [(18, 'l2'), (22, 'f1'), (43, 'l3'), (46, 'l4')]
    return plan


STERNE = _zeitplan()


def aktive_sterne(i):
    return [(ort, STERN_LAUF[(i - s) % N]) for (s, ort) in STERNE if (i - s) % N < len(STERN_LAUF)]


STAUB = [
    dict(x=PAD_L - 3, y=PAD_T + 15, vx=-1, vy=-7, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 14, vx=1, vy=-7, off=4, form='s', wackeln=1),
    dict(x=PAD_L - 2, y=PAD_T + 11, vx=-2, vy=-7, off=8, form='k', wackeln=1),
    dict(x=PAD_L + 15, y=PAD_T + 10, vx=2, vy=-7, off=12, form='k', wackeln=1),
    dict(x=PAD_L - 3, y=PAD_T + 18, vx=-1, vy=-8, off=16, form='s', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 18, vx=1, vy=-8, off=20, form='k', wackeln=1),
    dict(x=PAD_L + 2, y=PAD_T + 19, vx=-1, vy=-8, off=2, form='k', wackeln=1),
    dict(x=PAD_L + 11, y=PAD_T + 19, vx=1, vy=-8, off=14, form='k', wackeln=1),
]


def sprite_mit_effekten(i):
    sp = spr.copy()
    # Glanz nur am Krug (Gold): Lichtband 4 px breit + Kern 2 px
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 10:
            t = 2 + 3 * (i - s0)
            sp = A.farb_schritt(sp, GOLDRAMPE, KRUG_INNEN & (xx + yy >= t) & (xx + yy < t + 4))
            sp = A.farb_schritt(sp, GOLDRAMPE, KRUG_INNEN & (xx + yy >= t + 1) & (xx + yy < t + 3))
    # Augen: blinzeln (Fell) oder gedimmt
    for (x, y) in AUGEN:
        if i in BLINZELN:
            sp[y, x, :3] = VE
        elif i in AUGEN_DIMM:
            sp[y, x, :3] = VW
    if i in NASE_ZUCKT:                                                         # Nase hüpft 1 px nach oben (ersetzt den Umrisspixel darüber)
        sp[NASE[1] - 1, NASE[0], :3] = VW
        sp[NASE[1], NASE[0], 3] = 0
    return sp


def figur(i):
    sp = sprite_mit_effekten(i)
    dy = KOPF_DY[i]

    def schicht(maske):
        return L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)

    hals = schicht(HALS)
    # Ergänzung: Hals im Krugmund auch in Zeile 9 (sichtbar, wenn sich der Kopf hebt)
    for x, c in ((4, VD), (5, VH), (6, VH), (7, VH), (8, VH), (9, VM)):          # inkl. Seitenumriss (D links, M rechts), sonst läge der Hals frei
        hals[PAD_T + 9, PAD_L + x, :3] = c
        hals[PAD_T + 9, PAD_L + x, 3] = 255
    kopf = L.versetze(schicht(KOPF), 0, dy)
    kapuze = L.zeilen_welle(schicht(KAPUZE), PAD_T + 4, 1.9, L.sinus(i, 16))
    kapuze = L.versetze(kapuze, 0, dy)
    kapuze, brueck = A.verbinde4(kapuze)
    krug = schicht(KRUG)
    fig = L.zusammen(H, W, [(hals, 0, 0), (kopf, 0, 0), (kapuze, 0, 0), (krug, 0, 0)])
    fig, _ = A.verbinde4(fig)
    # Ergänzung (Regel 16): durch das Schwingen der Kapuze oder das Heben des Kopfes kann ein Innenpixel (Licht, Fell) am Rand frei liegen;
    # die leeren Nachbarfelder bekommen dann den Umriss (Kapuze J, Kopf D, Krug A)
    kap = kapuze[..., 3] > 0
    kop = kopf[..., 3] > 0
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: VJ if kap[y, x] else (VD if kop[y, x] else VA))
    return dict(fig=fig, kopf_dy=dy, brueck=brueck, neu=neu, teile=dict(hals=hals, kopf=kopf, kapuze=kapuze, krug=krug))


def sterne_ebene(i):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        A.stern(e, PAD_L + x, PAD_T + y, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    staub = L.puff_ebene(H, W, i, 24, STAUB, STAUBFARBEN)
    return L.zusammen(H, W, [(staub, 0, 0), (f['fig'], 0, 0), (sterne_ebene(i), 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 = Original:', bool((figs[0] == ref).all()))
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    A.ausdruck_pruefen(figs, spr, 'afflicted-vermin')
    L.speichern('afflicted-vermin', 'Afflicted Vermin', frames, MS, prev)
    if prev:
        L.streifen(prev + '/afflicted-vermin-strip.png', frames[::2], spalten=12, scale=6)
