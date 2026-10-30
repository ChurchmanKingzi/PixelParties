# -*- coding: utf-8 -*-
"""Idle-Animation für „Cloudy Slime“ (Creature).

PICK: [["Motive", 477, 1]]
Quelle: src/cloudy-slime.png — Ebene „Cloudy Slime“ (34×17 px, 17 Farben) aus Motive.xcf.
Die Ebene hat nur Alpha 0/255 (keine Halbtransparenz, Ebenendeckkraft 255): Die Pixel stammen direkt aus der Ebene.

Aufruf:   python3 cloudy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cloudy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Zwei Flügel (links x 0–10, rechts x 23–33): schmale Federflügel in hellem Türkis (E, G, H, I, J, L) mit dunklem Umriss A=(12,116,107),
  Spitze oben außen bei (0,0)/(33,0), Hauptfeder bis zur Schulter (10,5)/(23,5), unterer Federlappen bei (4–8, 6–8)/(25–29, 6–8); helle
  Kantenlichter G bei (1,1), (4–5,3) und (30,1), (28–29,3). Sie hängen nur über (10,5)↔(11,5) bzw. (23,5)↔(22,5) am Körper.
* Schleimkörper (x 8–25, Zeilen 3–16): türkises Gel mit dunklem Umriss B=(27,130,137), runde Kuppel (Zeilen 3–4), Stirnglanz J bei
  (16–17, 5–6); Augen = dunkle graue Ovale (14–15, 8–9) und (18–19, 8–9) mit weißen Lichtpunkten Q=(237,243,243) bei (15,9) und (18,9),
  helle Lidränder M darüber (14–15, 7), (18–19, 7); Mund = breite dunkle Zone (13–20, 10–13) aus Dunkeltürkis K, Grau N/O (links
  dunkler, rechts heller — schiefes Maul); unten verbreitert sich der Körper bis Zeile 13 (x 8–25) und rundet sich bis Zeile 16 ab
  (kein Pfützenrand: er schwebt).
Fest bleiben: Mundzone und Körperumriss (nur Gel-Verformung), Lidränder.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Schweben: der ganze Schleim hebt und senkt sich um ±2 px (Periode 24), die Flügel hängen mit Nachlauf daran (Periode 16 → eigener Takt).
* Flügelschlag: Spaltenversatz wächst vom Schultergelenk zur Spitze (bis ±4 px), die Spitze hinkt nach (lauf); die Federn selbst werden
  nur verschoben, nicht kopiert; beim Verbreitern/Verschmälern des Körpers wandern die Flügel mit der Schulter nach außen/innen.
* Gel-Körper: Zeile 6 (Stirn) und Zeile 10 (Wangenband) werden verdoppelt/entfernt, dazu Spalten in der Mitte verdoppelt (Stauchung
  breiter) bzw. am Wangenrand entfernt (Streckung schmaler); Pulsieren in 12-Frame-Takt, Streckung bis +2, Stauchung bis −2.
* Blinzeln: Frames 14–16 und 38–40; die weißen Lichtpunkte sind in den Frames 22–23 und 44–45 kurz gedimmt (normaler Augenfunke).
* Kein Glanz/Glitzer: Wolken und Schleim glänzen nicht (Regel 14) — kein Lichtband, keine Sterne.
* Wolkendunst (Partikel): zehn runde Wölkchen/Punkte (`'m'`, `'o'`, `'s'`, `'k'`) steigen langsam seitlich der Flügel und unter dem
  Körper auf (hinter der Figur).
Ergänzungen: Nach dem Spaltenversatz liegt hier und da ein Federpixel ohne Umriss frei (in der Quelle ist der Rand immer A bzw. B); die leeren
Nachbarfelder bekommen dann den Umriss (Flügel A=(12,116,107), Körper B=(27,130,137)), 2–25 Pixel je Frame. Sonst nichts. Nähte (Regel 11): Flügel und Körper berühren sich nur über (10,5)↔(11,5) bzw. (23,5)↔(22,5); das Gelenk
bleibt beim Schlag (Versatz 0 an der Schulter) und folgt der Körperkuppel; je Frame prüft das Skript, dass die Figur aus genau einem
4-zusammenhängenden Teil besteht und kein Körperrandpixel ohne Umrissfarbe frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 12, 6

spr = L.lade('cloudy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1                      # Leinwandzeile der Körper-Unterkante im Ruhezustand
KOERPER_Y0 = 3                              # erste Körperzeile (Zeile 3 = Kuppel)
yy, xx = np.mgrid[0:sh, 0:sw]
FLUEGEL_L = (xx <= 9) | ((xx == 10) & (yy == 5))
FLUEGEL_R = (xx >= 24) | ((xx == 23) & (yy == 5))
KOERPER = ~FLUEGEL_L & ~FLUEGEL_R

# ── Farben der Quelle ──
CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO, CP, CQ = (12, 116, 107), (27, 130, 137), (85, 190, 173), (140, 216, 206), \
    (130, 193, 185), (45, 151, 137), (187, 232, 225), (153, 218, 210), (154, 217, 209), (169, 222, 216), (36, 137, 121), (32, 153, 162), \
    (134, 181, 175), (66, 100, 96), (90, 133, 128), (76, 108, 103), (237, 243, 243)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for c in (CA, CB, CC, CD, CE, CF, CG, CH, CI, CJ, CK, CL, CM, CN, CO, CP, CQ):
    assert c in _farben
UMRISS_KOERPER = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(A.randpixel(spr))) if KOERPER[y, x]}
AUGEN_L, AUGEN_R = [(14, 8), (15, 8), (14, 9), (15, 9)], [(18, 8), (19, 8), (18, 9), (19, 9)]
GLINTS = [(15, 9), (18, 9)]

# ── Zeitachsen ──
BOB = [int(round(2 * math.sin(2 * math.pi * i / 24))) for i in range(N)]               # + = hoch
S = [int(round(1.7 * math.sin(2 * math.pi * i / 12))) for i in range(N)]
BLINZELN = {14: 1, 15: 2, 16: 1, 38: 1, 39: 2, 40: 1}
AUGEN_DIMM = {22, 23, 44, 45}                                                   # Augenlichtpunkte kurz gedimmt (normaler Augenfunke, ohne Stern)
FLAP_AMP, FLAP_N = 2.8, 16
assert len(S) == N

POSEN = {                                                                       # s → (löschen, doppeln, p)
    -2: ({3, 7}, (), 1), -1: ({3}, (), 1), 0: ((), (), 0), 1: ((), {3}, 0), 2: ((), {3: 1, 7: 1}, -1),
}
PAARE_BREIT = ((16, 17), (15, 18))
PAARE_SCHMAL = ((11, 22),)

def sprite_mit_effekten(i):
    """Sprite (Quellkoordinaten) mit Blinzeln und Augenfunkeln. Kein Lichtband/Glitzer: Wolken glänzen nicht (Regel 14)."""
    sp = spr.copy()
    b = BLINZELN.get(i, 0)
    if b:
        for (x, y) in AUGEN_L + AUGEN_R:
            if y == 8:
                sp[y, x, :3] = CM
            elif b == 2:
                sp[y, x, :3] = CP
    elif i in AUGEN_DIMM:
        for (x, y) in GLINTS:
            sp[y, x, :3] = CH
    return sp


def fluegel_welle(a, pivot_x, i):
    """Flügelschlag wie L.spalten_welle (Versatz wächst mit dem Abstand zum Gelenk, die Spitze hinkt nach), aber so verschoben, dass
    Frame 0 genau die Quellform ist: dy = round(amp · frac · (sin(φ − lauf·frac) − sin(−lauf·frac))), positiv = nach unten."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(abs(x - pivot_x) for x in range(w) if a[:, x, 3].any())
    ph = L.sinus(i, FLAP_N)
    for x in range(w):
        ys = np.nonzero(a[:, x, 3])[0]
        if not len(ys):
            continue
        frac = abs(x - pivot_x) / maxd
        dy = int(round(FLAP_AMP * frac * (math.sin(ph - 0.9 * frac) - math.sin(-0.9 * frac))))
        if ys.min() + dy < 0 or ys.max() + dy >= h:
            raise L.ClipError(f'Flügelspalte {x} würde um {dy} px aus der Leinwand (Höhe {h}) geschoben')
        for y in ys:
            out[y + dy, x] = a[y, x]
    return out


PUFFS = [
    dict(x=PAD_L + 9, y=PAD_T + 16, vx=-2, vy=-10, off=0, form='m', wackeln=1),
    dict(x=PAD_L + 24, y=PAD_T + 16, vx=2, vy=-10, off=3, form='m', wackeln=1),
    dict(x=PAD_L + 6, y=PAD_T + 12, vx=-2, vy=-9, off=6, form='o', wackeln=1),
    dict(x=PAD_L + 27, y=PAD_T + 12, vx=2, vy=-9, off=9, form='o', wackeln=1),
    dict(x=PAD_L + 3, y=PAD_T + 9, vx=-1, vy=-9, off=12, form='s', wackeln=1),
    dict(x=PAD_L + 30, y=PAD_T + 9, vx=1, vy=-9, off=15, form='s', wackeln=1),
    dict(x=PAD_L + 12, y=PAD_T + 19, vx=-1, vy=-8, off=18, form='k', wackeln=1),
    dict(x=PAD_L + 21, y=PAD_T + 19, vx=1, vy=-8, off=21, form='s', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 20, vx=0, vy=-9, off=8, form='k', wackeln=1),
    dict(x=PAD_L + 18, y=PAD_T + 20, vx=1, vy=-9, off=16, form='k', wackeln=1),
]
PUFFFARBEN = {'c': CJ, 'r': CH}


def figur(i):
    sp = sprite_mit_effekten(i)
    s = S[i]
    loesch, dopp, p = POSEN[s]
    kspr = np.where(KOERPER[..., None], sp, 0).astype(np.uint8)
    koerper = A.zeilen_von(kspr, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p,
                               paare=PAARE_BREIT if p >= 0 else PAARE_SCHMAL, x0=PAD_L)
    kb, top = A.auf_leinwand(z, H, BODEN, BOB[i])
    wdy = top - KOERPER_Y0 - PAD_T                                              # Flügelgelenk folgt der Kuppel
    schicht = [(kb, 0, 0)]
    for links, maske, pivot in ((True, FLUEGEL_L, 10), (False, FLUEGEL_R, 23)):
        fl = L.platz(np.where(maske[..., None], sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
        fl = fluegel_welle(fl, PAD_L + pivot, i)
        fl, _ = A.verbinde4(fl)
        schicht.append((fl, -p if links else p, wdy))
    fig = L.zusammen(H, W, schicht)
    flm = np.zeros((H, W), bool)                                                # Flügelpixel (für Umriss und Kontrolle)
    for (fl, dx_, dy_) in schicht[1:]:
        flm |= L.versetze(fl, dx_, dy_)[..., 3] > 0
    # Ergänzung: nach dem Spaltenversatz liegt hier und da ein Federpixel ohne Umriss frei (in der Quelle ist der Rand immer A bzw. B):
    # die leeren Nachbarfelder bekommen den Umriss (Flügel: A, Körper: B)
    fig, neu = A.umriss_ergaenzen(fig, {CA, CB}, lambda x, y: CA if flm[y, x] else CB)
    return dict(fig=fig, top=top, kb=kb, wdy=wdy, p=p, flm=flm, neu=neu)


def frame(i):
    f = figur(i)
    dunst = L.puff_ebene(H, W, i, 24, PUFFS, PUFFFARBEN)
    return L.zusammen(H, W, [(dunst, 0, 0), (f['fig'], 0, 0)])


def koerper_offen(f):
    """Randpixel (Körper und Flügel) mit einer Farbe außer den Umrissfarben A/B (so ist es in der Quelle überall)."""
    r = A.randpixel(f['fig'])
    out = []
    for y, x in zip(*np.nonzero(r)):
        c = tuple(int(v) for v in f['fig'][y, x, :3])
        if c not in (CA, CB):
            out.append((int(x), int(y), c))
    return out


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = [(i, koerper_offen(fs[i])) for i in range(N) if koerper_offen(fs[i])]
    print('offene Körperkanten (Frame, [(x, y, Farbe)]):', offen if offen else 'keine')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    A.ausdruck_pruefen(figs, spr, 'cloudy-slime')
    L.speichern('cloudy-slime', 'Cloudy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cloudy-slime-strip.png', frames[::2], spalten=12, scale=4)
