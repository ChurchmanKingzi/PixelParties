# -*- coding: utf-8 -*-
"""Idle-Animation für „Hardy Slime“ (Creature).

PICK: [["Motive", 467, 1]]   (Sprite, 18×19 px, 22 Farben, Motive.xcf Ebene „Hardy Slime“)
Verdeckter Körper unter dem Helm: src/hardy-slime-body.png — Ebene „Slimy Slime“ (472, Kopf 16×11) bei (+1, +5) und Ebene „Ebene #551“
(471, Pfütze 18×5) bei (0, 14) derselben Motive.xcf, Pfütze über dem Kopf (Reihenfolge der xcf). Das ist derselbe Schleim ohne Helm:
überall, wo der Hardy-Sprite grün ist, stimmt er pixelgenau mit diesem Körper überein (Prüfung im Skript). Neu erzeugen:
    python3 hardy_slime.py --koerper-neu <dump-ordner>      (dump/Motive/472.png und 471.png)

Aufruf:   python3 hardy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/hardy-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite):
* Helm, Zeilen 0–13: dunkler Spitzhelm mit Stahlglanz (graue Lichter (8,3), (9,3), (8,4), (9,4), (7–10,6), (5,7), (12,7), Krempe (4–6, 8),
  (11–13, 8), (3,9), (14,9) …), schwarze Backenränder (2,11–13) und (15,11–13), zwei schwarze Punkte (7,10), (10,10) zwischen den
  Augenschlitzen, Visier/„Gesichtsfenster“ (7–10, 9) und Augenschlitze (5–6, 10–11), (11–12, 10–11), durch die der Schleim zu sehen ist.
  Der Helm ist ein starres Teil (= alle Pixel, die vom nackten Körper abweichen: Maske im Skript).
* Schleim darunter/daneben: grüner Gelkörper mit dunkelgrünem Umriss (41,65,0); Augen = dunkle Pupillenpixel (5–6,10), (5,11) und
  (11–12,10), (12,11) mit weißen Lichtpunkten (6,11), (11,11); Mund = dunkelgrünes Band (7–10, 14) mit Mundwinkeln (6,13), (10–11,13)
  und Schatten (7–10, 15); unten die Pfütze (y 14–18) mit hellen Glanzflecken (11,15), (4–6,16), (10–11,17).
Fest bleiben: Mundwinkel, Glanzflecken der Pfütze, die schwarzen Helmpunkte.

Ablauf (40 Frames à 75 ms = 3,0 s, nahtlos):
* Atmen (Frames 0–19): der untere Körper (Zeilen 12–13, Wangen) wird um 1 Zeile gestreckt bzw. gestaucht; der ganze Kopfblock
  (Helm + Gesicht) hebt/senkt sich starr mit — das Gesicht verdoppelt/entfernt nie eine Zeile.
* Stampfer (Frames 20–31): Anlauf-Stauchung, Absprung gestreckt, 2 px Höhe, Aufprall-Stauchung (−2: Wangenzeilen weg, je Seite 2 px
  breiter), Nachfedern. Bei der Stauchung wird der nackte Schleim unter dem Helm breiter und quillt neben den Backenrändern heraus.
* Helm: starr, aber nicht festgeklebt — er sinkt beim Absprung (22–23) und beim Aufprall (26) 1 px in den Kopf und federt danach
  (27) 1 px hoch. Dabei wandern die Augenschlitze über das Gesicht (Verdecktes kommt aus dem nackten Körper, siehe oben).
* Wabbeln: Kopfblock lehnt sich 1–2 px seitlich (Zeilen 12–13 mit abnehmendem Versatz, Pfütze fest); im Leerlauf langsam,
  nach der Landung schnell und abklingend.
* Blinzeln: Frames 16–18 und 34–36 (Lid → Augenlinie → Lid), am nackten Körper, damit es durch die Schlitze zu sehen ist.
* Stahlglanz: Frames 2–14 wandert ein diagonales Band über den Helm (Stahlrampe H→I→J→M→D→O um 1–2 Stufen heller).
* Schleimblasen (Partikel): drei kleine runde Blasen steigen langsam links/rechts der Pfütze auf (hinter der Figur).
Ergänzungen: keine gezeichnet — alles Verdeckte stammt aus den xcf-Ebenen des Schleims (siehe oben). Nähte (Regel 11): Helm und Körper
liegen vertikal 4-verbunden aufeinander; pro Frame prüft das Skript, dass die Figur aus genau einem 4-zusammenhängenden Teil besteht
und kein Körper-Randpixel außer in der Umrissfarbe frei liegt.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import os
import sys

import numpy as np
from PIL import Image

import anim_lib as L
import anim_amorph as A

N, MS = 40, 75
PAD_L, PAD_R, PAD_T, PAD_B = 7, 7, 8, 3

spr = L.lade('hardy-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
KOERPER_Y0 = 5                              # erste Zeile des nackten Schleimkopfes (Zeilen 0–4 sind nur Helmspitze)


def koerper_neu(dump):
    """src/hardy-slime-body.png aus den xcf-Ebenen 472 (Kopf) und 471 (Pfütze) bauen."""
    kopf = np.array(Image.open(os.path.join(dump, 'Motive', '472.png')).convert('RGBA'))
    pfuetze = np.array(Image.open(os.path.join(dump, 'Motive', '471.png')).convert('RGBA'))
    out = np.zeros((sh, sw, 4), np.uint8)
    for a, ox, oy in ((kopf, 1, 5), (pfuetze, 0, 14)):
        m = a[..., 3] > 0
        for y, x in zip(*np.nonzero(m)):
            out[y + oy, x + ox] = a[y, x]
            out[y + oy, x + ox, 3] = 255
    Image.fromarray(out).save(os.path.join(L.SRC, 'hardy-slime-body.png'))
    print('geschrieben: src/hardy-slime-body.png', int((out[..., 3] > 0).sum()), 'px')


if '--koerper-neu' in sys.argv:
    koerper_neu(sys.argv[sys.argv.index('--koerper-neu') + 1])
    sys.exit(0)

body = L.lade('hardy-slime-body')
# Die zwei schwarzen Pupillenpunkte (7,10), (10,10) gehören zu den Augen (neben dem weißen Lichtpunkt), nicht zum Helm
for (x, y) in ((7, 10), (10, 10)):
    body[y, x] = spr[y, x]
# Helm = alles, was vom nackten Körper abweicht (Farbe anders oder dort gar kein Körperpixel)
gleich = (body[..., 3] > 0) & (spr[..., 3] > 0) & (body[..., :3] == spr[..., :3]).all(axis=2)
helm_maske = (spr[..., 3] > 0) & ~gleich
helm = np.where(helm_maske[..., None], spr, 0).astype(np.uint8)
_re = L.leer(sh, sw)
_re[body[..., 3] > 0] = body[body[..., 3] > 0]
_re[helm_maske] = spr[helm_maske]
assert (_re == spr).all(), 'Körper + Helm ergeben nicht den Hardy-Sprite'
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert {tuple(int(v) for v in p[:3]) for p in body.reshape(-1, 4) if p[3]} <= _farben, 'Körperfarben nicht im Sprite'

# ── Farben der Quelle ──
UMRISS = (41, 65, 0)                         # dunkelgrüner Umriss des Schleims
HAUT = (106, 167, 87)                        # Gesichtsgrün (Lid)
PUPILLE = (45, 50, 44)                       # Augenlinie
STAHL = {(24, 25, 17): (32, 38, 42), (32, 38, 42): (41, 46, 59), (41, 46, 59): (106, 113, 118),
         (106, 113, 118): (139, 138, 143), (139, 138, 143): (180, 180, 176), (92, 92, 90): (139, 138, 143)}   # Stahlrampe, jeweils eine Stufe heller
assert all(a in _farben and b in _farben for a, b in STAHL.items())
BLASE_C, BLASE_R = (160, 204, 147), (136, 204, 118)
assert BLASE_C in _farben and BLASE_R in _farben

AUGEN_L, AUGEN_R = [(5, 10), (6, 10), (5, 11), (6, 11)], [(11, 10), (12, 10), (11, 11), (12, 11)]

# ── Zeitachsen (Frame → Wert) ──
S = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0,          # Atmen
     -1, -2, 2, 1, 0, 1, -2, -1, 1, 0, 0, 0,                                  # Stampfer
     0, 0, 0, 0, 0, 0, 0, 0]
LIFT = {22: 1, 23: 2, 24: 2, 25: 1}
HELM_DY = {22: 1, 23: 1, 26: 1, 27: -1}                                       # Helm gegenüber dem Kopf (+ = sinkt ein)
BLINZELN = {16: 1, 17: 2, 18: 1, 34: 1, 35: 2, 36: 1}
GLANZ = {i: 6 + 2 * (i - 2) for i in range(2, 15)}                            # Frame → Diagonale x+y
assert len(S) == N

# Körperzeilen: Index 0 = Sprite-Zeile 5 … 13 = Zeile 18; Gesichtszeilen (Index 4–6 = Zeilen 9–11) werden nie verdoppelt
GEWICHT = [1.0] * 7 + [0.6, 0.2] + [0] * 5
POSEN = {                                                                      # s → (löschen, doppeln, p unten)
    -2: ({7, 8}, (), 2), -1: ({7}, (), 1), 0: ((), (), 0), 1: ((), {7}, 0), 2: ((), {7: 2}, -1),
}


def breiten(p):
    """p je Körperzeile: Zeilen 5–8 (Index 0–3, ganz unter der Helmkuppe) bleiben schmal, die Gesichtszeilen 9–11 (Index 4–6) werden
    höchstens 1 px je Seite breiter (neben dem Helmrand liegt dann nur der Umrisspixel frei), Wangen/Mund/Pfütze (ab Zeile 12) voll."""
    return {k: 0 for k in range(0, 4)} | {k: (min(p, 1) if p > 0 else 0) for k in range(4, 7)}
PAARE_UNTEN = ((8, 9), (7, 10), (6, 11))
PAARE_SCHMAL = ((3, 14), (4, 13))
PAARE_OBEN = {k: [(3, 14), (4, 13)] for k in range(0, 7)}                      # Zeilen 5–11: Spalten unter dem Helm (Wange), nie das Gesicht


def lehnen(i):
    """Seitliche Neigung des Kopfblocks an der Oberkante (Pixel, vor dem Runden)."""
    if i < 20:
        v = 1.4 * math.sin(2 * math.pi * i / 20)
    elif i < 26:
        v = 0.0
    else:
        k = i - 26
        v = 2.4 * (1 - k / 14) * math.sin(2 * math.pi * k / 8)
    return max(-2.4, min(2.4, v))


def koerper_mit_augen(i):
    """Nackter Körper mit Blinzeln (Quellkoordinaten); der Helm bleibt unberührt."""
    b = L.leer(sh, sw)
    b[:] = body
    k = BLINZELN.get(i, 0)
    if k:
        for (x, y) in AUGEN_L + AUGEN_R:
            if y == 10:
                b[y, x, :3] = HAUT
            elif k == 2:
                b[y, x, :3] = PUPILLE
    return b


def helm_mit_glanz(i):
    h = helm.copy()
    if i in GLANZ:
        t = GLANZ[i]
        h = A.glanzband(h, t, STAHL, breite=2)
        h = A.glanzband(h, t, STAHL, breite=1)
    return h


BLASEN = [
    dict(x=PAD_L - 2, y=PAD_T + 17, vx=-1, vy=-8, off=0, form='o', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 16, vx=1, vy=-8, off=7, form='k', wackeln=1),
    dict(x=PAD_L + 20, y=PAD_T + 13, vx=0, vy=-7, off=13, form='o', wackeln=1),
    dict(x=PAD_L - 3, y=PAD_T + 14, vx=0, vy=-7, off=18, form='k', wackeln=1),
]
BLASENFARBEN = {'c': BLASE_C, 'r': BLASE_R}


def figur(i):
    """Körper + Helm (ohne Partikel) → (Figur, Helmebene, Körperoberkante, Körperebene)."""
    s = S[i]
    loesch, dopp, p = POSEN[s]
    zeilen = A.zeilen_von(koerper_mit_augen(i), KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(zeilen, loeschen=loesch, doppeln=dopp, p=p,
                               paare=PAARE_UNTEN if p >= 0 else PAARE_SCHMAL,
                               paare_je_zeile=PAARE_OBEN, x0=PAD_L, p_je_zeile=breiten(p))
    dxq = A.dx_zeilen(GEWICHT, lehnen(i), math.pi / 2)
    z = A.verschiebe_zeilen(z, quelle, dxq)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    hm = L.platz(helm_mit_glanz(i), H, W, PAD_L, PAD_T)
    hm = L.versetze(hm, dxq[0], top - KOERPER_Y0 - PAD_T + HELM_DY.get(i, 0))
    return L.zusammen(H, W, [(kb, 0, 0), (hm, 0, 0)]), hm, top, kb


def frame(i):
    blasen = L.puff_ebene(H, W, i, 20, BLASEN, BLASENFARBEN)
    return L.zusammen(H, W, [(blasen, 0, 0), (figur(i)[0], 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)[0] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    assert (figs[0] == ref).all(), 'Frame 0 weicht vom Original ab'
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = []
    for i in range(N):
        fig, hm, top, _ = figur(i)
        offen += [(i, o) for o in A.offene_koerperkanten(fig, hm[..., 3] > 0, top, UMRISS)]
    print('offene Körperkanten (Frame, (x, y, Farbe)):', offen if offen else 'keine')
    A.ausdruck_pruefen(figs, spr, 'hardy-slime', erlaubt=list(STAHL.values()))
    L.speichern('hardy-slime', 'Hardy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hardy-slime-strip.png', frames[::2], spalten=10, scale=5)
