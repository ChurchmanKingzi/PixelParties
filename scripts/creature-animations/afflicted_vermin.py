# -*- coding: utf-8 -*-
"""Idle-Animation für „Afflicted Vermin“ (Creature).

PICK: [["MotiveEgypt", 176, 5]]   — Ebene „Infected Vermin“ (MotiveEgypt.xcf). Die Figur enthält zwei Ratten-auf-Topf-Exemplare; genommen ist
das obere linke (Ausschnitt x 0–13, y 0–19 der extrahierten Figur, Rest = das zweite Exemplar): src/afflicted-vermin.png (14×20 px,
23 Farben). Die leeren Töpfe der Szene (Ebene 176 Figuren 1/2/8/9, Ebene 181) sind Beiwerk und bleiben unberührt.
Die Ebene hat nur Alpha 0/255 (keine Halbtransparenz).

Aufruf:   python3 afflicted_vermin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/afflicted-vermin.png + .json   (Frame 22×25 px, 48 Frames)

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Tongefäß (Zeilen 9–19, x 0–13): Krug in vier ocker-gelben Stufen A=(194,150,0), B=(234,180,9), F=(254,197,22), L=(255,219,79) (Lichtpunkte bei
  (1,13), (10,13), (12,13), (10,14), (2,12), (11,12)), Schatten C=(125,75,0); zwei Henkelschlitze (dunkelgrau) bei (2,13–15) und (11,13–15);
  Kragen/Rand Zeile 10 (links (3–4,10), rechts (9–10,10)); in der Krugöffnung (5–8, 10) sitzt der dunkle Hals der Ratte.
  Der Krug ist KEIN Gold und Metall, sondern Ton: kein Glanz (Regel 14).
* Ratte (Zeilen 3–10) schaut über den Krugrand nach rechts: graubrauner Kopf (D, E, G, V), Ohren bei (4–5, 4–5) und (10–11, 4–5)
  mit rosa Ohrinnerem (5,5), zwei rote Augen Q=(255,0,0) bei (8,6) und (10,6), schwarze Schnauzenlinie (9–11, 9), rosa Nase W bei (12,9),
  dunkler Hals H bei (5–8, 10). Zwischen Pilz und Stirn: hautfarbene Stirn (7–10, 3) und zwei hellgrüne Pixel S/T bei (8–9, 4)
  (nicht eindeutig: Pilzbefall/Eiter/Glanz? → bleibt fest).
* Pilz auf dem Kopf (Zeilen 0–3; im Sprite „Kapuze“ genannt): dunkelvioletter Hut (I, J, K) mit hellvioletten Lichtern N=(184,164,205),
  R=(166,141,192) bei (7,1), (9,2), (10,0). Weicher Pilzkörper → schwingt, glänzt nicht.
Fest bleiben: Krug, Stirn und die grünen Pixel S/T, Schnauzenlinie, Ohren.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Spähen: die Ratte hebt und senkt Kopf samt Pilz um ±1 px über dem Krugrand (zwei überlagerte Perioden 24 und 12). Hebt sie sich, wächst
  der Hals nach (ergänzt, siehe unten); sinkt sie, verschwindet das Kinn hinter dem Krugrand.
* Pilz: der Hut schwingt an der Spitze bis ±2 px seitlich (Periode 16, Versatz wächst zur Spitze, Spitze hinkt nach).
* Nase zuckt (hüpft 1 px nach oben, Frames 6–7, 14–15, 30–31, 38–39); Augen blinzeln (Frames 20–22 und 40–42: rot → Fell) und glimmen
  schwächer (rot → dunkles Rosa, Frames 10–11, 26–27, 44).
* Sporen (Partikel): acht kleine runde Sporen lösen sich links und rechts unter dem Pilzhut und regnen langsam (0,5 px/Frame) nach unten, seitlich
  leicht auswärts treibend: erst 1 px (Pilzviolett R), dann 2×2 (Kern N, Rand R), vor dem Verschwinden wieder 1 px und blinkend (verglimmt).
  Sie fallen neben der Figur und die letzten Pixel vor dem Krug-Rand; nie unter den Rand des Frames (Fallhöhe ≤ Spritehöhe). Zwei Zyklen je 48 Frames.
* KEIN Glanz (Regel 14): weder Lichtband noch Glitzersterne noch Goldstaub — Krug (Ton), Fell und Pilz glänzen nicht.
Ergänzungen: Hals der Ratte im Krugmund bei Zeile 9: (5–8, 9) in Halsfarbe H=(66,60,47), dazu Seitenumriss (4, 9) D=(82,60,38) und (9, 9)
M=(29,20,14) — wird sichtbar, sobald sich der Kopf hebt (liegt bei Ruhe hinter dem Kinn). Außerdem werden Innenpixel, die beim
Schwingen des Pilzes oder Heben des Kopfes am Rand frei liegen, mit der Umrissfarbe eingefasst (Pilz J, Kopf D, Krug A).
Nähte (Regel 11) und Randpixel (Regel 16): Kopf, Pilz, Hals und Krug liegen 4-verbunden; je Frame prüft das Skript, dass die Figur aus
genau einem 4-zusammenhängenden Teil besteht (`randtest.py`: 0 Frames mit Randpixeln in Nicht-Umrissfarbe).
Frame: nur so groß wie nötig — Figur 14×20 px mit 4 px Rand links/rechts (Platz für die Sporen), 3 px oben, 2 px unten (Mindestabstand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 3, 2

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
KRUGFARBEN = {VA, VB, VC, VF, VL}                                               # Tongefäß (kein Glanz)
SPOREN_FARBEN = {'c': VN, 'r': VR}                                               # helle Pilzfarben des Sprites

# ── Teile ──
yy, xx = np.mgrid[0:sh, 0:sw]
farbe_ist = lambda cs: L.farbmaske(spr, list(cs))
KRUG = farbe_ist(KRUGFARBEN) | (farbe_ist([VH]) & ((xx == 2) | (xx == 11)) & (yy >= 13))
RATTE = (spr[..., 3] > 0) & ~KRUG
PILZ = farbe_ist([VI, VJ, VK, VN, VR]) & (yy <= 3)
KOPF = RATTE & ~PILZ & (yy <= 9)
HALS = RATTE & (yy >= 10)                                                       # (5–8, 10): dunkler Hals im Krugmund
RAND_FARBEN = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(A.randpixel(spr)))}
AUGEN = [(8, 6), (10, 6)]
NASE = (12, 9)

# ── Zeitachsen ──
KOPF_DY = [int(round(0.9 * math.sin(2 * math.pi * i / 24) + 0.5 * math.sin(2 * math.pi * i / 12 + 1.0))) for i in range(N)]    # + = tiefer
BLINZELN = {20, 21, 22, 40, 41, 42}
AUGEN_DIMM = {10, 11, 26, 27, 44}
NASE_ZUCKT = {6, 7, 14, 15, 30, 31, 38, 39}
assert KOPF_DY[0] == 0

# Sporen: (x, y) = Startpunkt im Sprite (unter dem Pilzhut), (vx, vy) = Gesamtweg über die Lebensdauer, Phase = Startframe
LEBEN, PERIODE = 20, 24
SPOREN = [
    dict(x=5, y=3, vx=-3, vy=10, f0=0), dict(x=12, y=2, vx=2, vy=10, f0=3), dict(x=3, y=1, vx=-2, vy=11, f0=6), dict(x=13, y=1, vx=1, vy=12, f0=9),
    dict(x=5, y=2, vx=-2, vy=9, f0=12), dict(x=12, y=4, vx=2, vy=8, f0=15), dict(x=4, y=0, vx=-1, vy=12, f0=18), dict(x=13, y=3, vx=2, vy=10, f0=21),
]


def sporen_ebene(i):
    """Fallende Sporen (runde Punkte, kein Alpha): 1 px → 2×2 → 1 px blinkend → weg (nie unter den Frame)."""
    e = L.leer(H, W)
    for sp in SPOREN:
        a = (i - sp['f0']) % PERIODE
        if a >= LEBEN:
            continue
        x = sp['x'] + int(round(sp['vx'] * a / float(LEBEN))) + int(round(0.7 * math.sin(2 * math.pi * a / 10.0)))
        y = sp['y'] + int(round(sp['vy'] * a / float(LEBEN)))
        if a < 3:
            pix = [(0, 0, VR)]
        elif a < LEBEN - 6:
            pix = [(0, 0, VN), (1, 0, VR), (0, 1, VR), (1, 1, VR)]
        elif a < LEBEN - 1 and a % 2 == 0:
            pix = [(0, 0, VR)]
        else:
            pix = []
        for dx, dy, c in pix:
            X, Y = PAD_L + x + dx, PAD_T + y + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Spore bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = c
            e[Y, X, 3] = 255
    return e


def sprite_mit_effekten(i):
    sp = spr.copy()
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
    pilz = L.zeilen_welle(schicht(PILZ), PAD_T + 4, 1.9, L.sinus(i, 16))
    pilz = L.versetze(pilz, 0, dy)
    pilz, brueck = A.verbinde4(pilz)
    krug = schicht(KRUG)
    fig = L.zusammen(H, W, [(hals, 0, 0), (kopf, 0, 0), (pilz, 0, 0), (krug, 0, 0)])
    fig, _ = A.verbinde4(fig)
    # Ergänzung (Regel 16): durch das Schwingen der Kapuze oder das Heben des Kopfes kann ein Innenpixel (Licht, Fell) am Rand frei liegen;
    # die leeren Nachbarfelder bekommen dann den Umriss (Kapuze J, Kopf D, Krug A)
    kap = pilz[..., 3] > 0
    kop = kopf[..., 3] > 0
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: VJ if kap[y, x] else (VD if kop[y, x] else VA))
    return dict(fig=fig, kopf_dy=dy, brueck=brueck, neu=neu, teile=dict(hals=hals, kopf=kopf, pilz=pilz, krug=krug))


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(f['fig'], 0, 0), (sporen_ebene(i), 0, 0)])        # Sporen vor der Figur (nur neben dem Körper, nie über dem Gesicht)


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
