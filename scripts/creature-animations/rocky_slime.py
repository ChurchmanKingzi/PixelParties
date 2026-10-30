# -*- coding: utf-8 -*-
"""Idle-Animation für „Rocky Slime“ (Creature).

PICK: [["Motive", 480, 1]]
Quelle: src/rocky-slime.png — Ebene „Rocky Slime“ (20×18 px, 13 Farben) aus Motive.xcf.

Aufruf:   python3 rocky_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rocky-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite, x/y ab 0):
* Steine, graue Felsbrocken mit schwarzem Umriss (Farben C, E, H, I = (102,96,80), (114,107,91), (153,144,122), (78,72,58)):
  eine Steinkrone auf dem Kopf (Zeilen 0–6, Brocken bei x 3–5, 7–9, 10–11, 13–14, 16–17; helle Kanten (5,1), (9,1), (15,1)),
  Schulterbrocken links (0–3, 4–6) und rechts (16–18, 4–6), je ein Brocken am Fuß links (1–3, 12–16), unten rechts (13–15, 15–16)
  und seitlich rechts (17–18, 11–12).
* Schleimkörper, Zeilen 7–16: brauner Lehmschleim (B, D, F, G, J, K, L = (115,101,55), (73,64,35), (44,38,22), (48,42,23),
  (153,134,73), (204,179,98), (38,32,19)) mit schwarzem Umriss (26,22,13); Augen = weiße Lichtpunkte (7,9) und (12,9) in dunklem Braun;
  Mund = schwarzes Band (7–12, 12) mit dunklem Saum (8–11, 13); goldene Glanzlichter (K) bei (9,6), (12,13), (11–12,14), (6–7,15);
  unten die breite Pfütze (Zeilen 13–16).
* Zwischen den Steinen der Krone sind die Lücken schwarz (der Kopf darunter ist verdeckt); bei (7–9, 6) und (12–14, 5–6) schaut Schleim
  hervor. Bedeutung der dunklen Brauntöne um die Augen ist nicht eindeutig → Augen werden nur über die Lichtpunkte animiert.
Fest bleiben: Mund, Pfütze (sie atmet nur mit), Steine an den Seiten und am Fuß (gehen starr mit dem Körper).

Aufbau (wie bei Hardy Slime): Kopfblock K = Zeilen 0–6 (Steinkrone samt Schulterbrocken und Kopfansatz) ist starr; der Körper
(Zeilen 7–17) wird wie ein Gelkörper verformt: Zeile 8 (und 7) verdoppelt/entfernt, dazu Spalten in der Mitte verdoppelt (Stauchung
breiter) bzw. am Wangenrand entfernt (Streckung schmaler); die Seitensteine verschieben sich dabei mit dem Umriss nach außen/innen.
Der Kopfblock sitzt auf dem Körper und kann gegen ihn 1 px einsinken oder hochfedern (Steine hüpfen auf dem Gel); beim Hochfedern
wird die Fuge zwischen Kopfblock und Körper mit der Umrissfarbe (26,22,13) gefüllt (siehe Ergänzungen).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Frames 0–23, 40–47): Körper streckt sich/staucht sich um 1–2 Zeilen (Steinkrone hebt/senkt sich mit), Periode ≈ 12–16 Frames.
* Stampfer (24–39): Anlauf-Stauchung (−1, −2), Absprung gestreckt (+2), 2 px Höhe, Aufprall (−2, 1 px breiter), Nachfedern.
* Steinkrone federt: sie hinkt beim Strecken 1 px hinterher (sinkt ein) und überschwingt danach (springt 1 px hoch) — Gel wackelt, Steine klappern.
* Wabbeln: der Körper pendelt als Ganzes bis ±1 px, der Kopfblock (Steinkrone) lehnt sich bis ±2 px — also bis 1 px gegen den Körper
  (im Leerlauf Periode 24, nach dem Aufprall schnell abklingend); kein Zeilenscher, weil die Seitensteine waagerechte Umrisskanten haben.
* Blinzeln: die weißen Augen-Lichtpunkte gehen kurz aus (Frames 20–21 und 44–45) bzw. sind gedimmt (Frames 9–10 und 33–34).
* Kein Glanz/Glitzer: Fels und Lehm glänzen nicht (Regel 14) — kein Lichtband, keine Glitzersterne, kein Glimmern der K-Pixel.
* Steinstaub (Partikel, Farben der Steine): acht winzige Krümel rieseln langsam an Schultern und Krone herab.
Ergänzungen: Beim Hochfedern des Kopfblocks entsteht zwischen Block (Zeile 6) und Körper (Zeile 7) eine 1 px hohe Fuge: sie wird mit der
Umrissfarbe (26,22,13) gefüllt, überall dort, wo über und unter der Fuge ein Pixel liegt (die schwarzen Lücken zwischen den Steinen der
Krone sind ohnehin schwarz). Sonst nichts.
Nähte (Regel 11): Kopfblock und Körper liegen vertikal 4-verbunden aufeinander (oder über die Fugenfüllung); je Frame prüft das Skript,
dass die Figur aus genau einem 4-zusammenhängenden Teil besteht und kein Lehm-Randpixel frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 9, 3

spr = L.lade('rocky-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
KOERPER_Y0 = 7                              # erste Körperzeile; darüber (0–6) der Kopfblock

# ── Farben der Quelle ──
A_ = (26, 22, 13)                           # schwarzer Umriss
SB, SD, SF, SG, SJ, SK, SL, WEISS = (115, 101, 55), (73, 64, 35), (44, 38, 22), (48, 42, 23), (153, 134, 73), (204, 179, 98), (38, 32, 19), (229, 227, 221)
SC, SE, SH, SI = (102, 96, 80), (114, 107, 91), (153, 144, 122), (78, 72, 58)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for c in (A_, SB, SD, SF, SG, SJ, SK, SL, WEISS, SC, SE, SH, SI):
    assert c in _farben, f'Farbe {c} nicht im Sprite'
SCHLEIM = {SB, SD, SF, SG, SJ, SK, SL}
STEINE = {SC, SE, SH, SI}
GLINT = [(7, 9), (12, 9)]

# ── Zeitachsen (Frame → Wert), N = 48 ──
S = [0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0,                       # 0–15 Atmen
     1, 1, 0, -1, -1, 0, 1, 0,                                                 # 16–23 zweiter, flacherer Puls
     0, -1, -2, -2, 2, 2, 1, 1, 2, -2, -1, 1, 0, 0, 0, 0,                      # 24–39 Stampfer
     1, 1, 1, 0, 0, -1, -1, 0]                                                 # 40–47 Atmen
LIFT = {28: 1, 29: 2, 30: 2, 31: 2, 32: 1}
KOPF_DY = {2: 1, 4: -1, 9: -1, 11: 1, 16: 1, 18: -1, 28: 1, 29: 1, 33: 1, 34: -1, 35: -1, 40: 1, 42: -1, 45: -1}   # + = Block sinkt ein, − = federt hoch
BLINZELN = {20, 21, 44, 45}
AUGEN_DIMM = {9, 10, 33, 34}                                                   # Augenlichtpunkte kurz gedimmt
assert len(S) == N

# Körperzeilen: Index 0 = Sprite-Zeile 7 … 10 = Zeile 17
POSEN = {                                                                       # s → (löschen, doppeln, p)
    -2: ({0, 1}, (), 1), -1: ({1}, (), 1), 0: ((), (), 0), 1: ((), {1}, 0), 2: ((), {0: 1, 1: 1}, -1),
}
PAARE_BREIT = ((9, 10), (8, 11))
PAARE_SCHMAL = {k: [(4, 15)] for k in range(0, 5)} | {k: [(9, 10)] for k in range(5, 11)}


def lehnen(i):
    if 24 <= i <= 32:
        return 0.0
    if 33 <= i <= 39:
        k = i - 33
        return 2.4 * (1 - k / 7) * math.sin(2 * math.pi * k / 6)
    if 16 <= i <= 23:
        return 1.6 * math.sin(2 * math.pi * i / 16)
    return 1.4 * math.sin(2 * math.pi * i / 24)


def sprite_mit_effekten(i):
    """Sprite (Quellkoordinaten) mit Blinzeln/Augenfunkeln. Kein Lichtband/Glitzer: Fels und Lehm glänzen nicht (Regel 14)."""
    sp = spr.copy()
    if i in BLINZELN:                                     # Augen-Lichtpunkte gehen aus
        for (x, y) in GLINT:
            sp[y, x, :3] = SF
    elif i in AUGEN_DIMM:                                 # …oder sind kurz gedimmt (normaler Augenfunke, ohne Stern)
        for (x, y) in GLINT:
            sp[y, x, :3] = SH
    return sp


STAUB = [
    dict(x=PAD_L + 1, y=PAD_T + 6, vx=-1, vy=8, off=0, form='k', wackeln=1),
    dict(x=PAD_L + 18, y=PAD_T + 6, vx=1, vy=8, off=3, form='s', wackeln=1),
    dict(x=PAD_L + 4, y=PAD_T + 3, vx=-2, vy=9, off=6, form='k', wackeln=1),
    dict(x=PAD_L + 16, y=PAD_T + 3, vx=2, vy=9, off=9, form='k', wackeln=1),
    dict(x=PAD_L + 0, y=PAD_T + 8, vx=-1, vy=7, off=12, form='s', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 9, vx=1, vy=7, off=15, form='k', wackeln=1),
    dict(x=PAD_L + 8, y=PAD_T - 1, vx=-1, vy=7, off=18, form='s', wackeln=1),
    dict(x=PAD_L + 13, y=PAD_T - 1, vx=1, vy=7, off=21, form='k', wackeln=1),
]
STAUBFARBEN = {'c': SH, 'r': SE}


def figur(i):
    """Kopfblock + Körper (ohne Partikel/Sterne) → dict(fig, kr, top, kb, kdx, kdy, orte)."""
    sp = sprite_mit_effekten(i)
    loesch, dopp, p = POSEN[S[i]]
    koerper = A.zeilen_von(sp, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    if p >= 0:
        # Beim Stauchen (Zeilen entfallen) wächst die Umrissstufe zwischen Nachbarzeilen; Zeile 7 bleibt deshalb schmal, die Zeilen darunter
        # werden breiter (Stufe ≤ 1 px, unten breiter = Gel quillt)
        z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p, paare=PAARE_BREIT, x0=PAD_L,
                                   p_je_zeile={0: 0} if loesch else None)
    else:
        z, quelle = A.koerper_pose(koerper, loeschen=loesch, doppeln=dopp, p=p, paare=((9, 10),), paare_je_zeile=PAARE_SCHMAL, x0=PAD_L)
    lean = lehnen(i)
    # Der Körper schwankt als Ganzes (kein Zeilenscher: die Seitensteine haben waagerechte Umrisskanten, die sonst aufrissen); der Kopfblock
    # lehnt sich gegen ihn um höchstens 1 px (Steine wackeln auf dem Gel) — Eckpixel ohne Unterkante werden unten ergänzt (siehe Ergänzungen).
    dxq = [int(round(lean * 0.5))] * len(quelle)
    z = A.verschiebe_ausgabezeilen(z, dxq)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    kr = L.platz(np.where((np.arange(sh)[:, None, None] < KOERPER_Y0), sp, 0).astype(np.uint8), H, W, PAD_L, PAD_T)
    kdx, kdy = int(round(lean)), top - KOERPER_Y0 - PAD_T + KOPF_DY.get(i, 0)
    kr = L.versetze(kr, kdx, kdy)
    fig = L.zusammen(H, W, [(kb, 0, 0), (kr, 0, 0)])
    # Ergänzung: Fuge zwischen Kopfblock (unterste Zeile) und Körper (oberste Zeile) beim Hochfedern mit Umrissfarbe füllen
    for x in range(W):
        ys_k = np.nonzero(kr[:, x, 3])[0]
        ys_b = np.nonzero(kb[:, x, 3])[0]
        if len(ys_k) and len(ys_b):
            yk, yb = int(ys_k.max()), int(ys_b.min())
            if yb - yk == 2 and not fig[yk + 1, x, 3]:
                fig[yk + 1, x, :3] = A_
                fig[yk + 1, x, 3] = 255
    # Ergänzung: unter jedem frei hängenden Steinpixel (Randpixel in Steinfarbe ohne Nachbar darunter) sitzt in der Quelle immer der
    # schwarze Umriss — nach dem Zeilenumbau/Einsinken fehlt er an den Ecken des Kopfblocks, dort wird er mit der Umrissfarbe ergänzt.
    rand = A.randpixel(fig)
    for y, x in zip(*np.nonzero(rand)):
        if tuple(int(v) for v in fig[y, x, :3]) in STEINE and y + 1 < H and not fig[y + 1, x, 3]:
            fig[y + 1, x, :3] = A_
            fig[y + 1, x, 3] = 255
    return dict(fig=fig, kr=kr, top=top, kb=kb, kdx=kdx, kdy=kdy)


def frame(i):
    f = figur(i)
    staub = L.puff_ebene(H, W, i, 24, STAUB, STAUBFARBEN)
    return L.zusammen(H, W, [(staub, 0, 0), (f['fig'], 0, 0)])


def steine_haengen(fig):
    """Randpixel in Steinfarbe ohne Pixel darunter (fehlender Unterumriss) — in der Quelle gibt es keins."""
    r = A.randpixel(fig)
    return [(int(x), int(y)) for y, x in zip(*np.nonzero(r)) if tuple(int(v) for v in fig[y, x, :3]) in STEINE and y + 1 < H and not fig[y + 1, x, 3]]


def lehm_am_rand(fig):
    """Randpixel in Lehmfarben (= freiliegender Schleim ohne Umriss)."""
    r = A.randpixel(fig)
    return [(int(x), int(y)) for y, x in zip(*np.nonzero(r)) if tuple(int(v) for v in fig[y, x, :3]) in SCHLEIM | {WEISS}]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    assert (figs[0] == ref).all(), 'Frame 0 weicht vom Original ab'
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = [(i, lehm_am_rand(figs[i])) for i in range(N) if lehm_am_rand(figs[i])]
    print('freiliegender Lehm am Rand (Frame, Pixel):', offen if offen else 'keiner')
    haengt = [(i, steine_haengen(figs[i])) for i in range(N) if steine_haengen(figs[i])]
    print('Steinpixel ohne Unterumriss (Frame, Pixel):', haengt if haengt else 'keine')
    A.ausdruck_pruefen(figs, spr, 'rocky-slime', erlaubt=[A_])
    L.speichern('rocky-slime', 'Rocky Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/rocky-slime-strip.png', frames[::2], spalten=12, scale=5)
