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
  (11–13, 8), (3,9), (14,9) …), schwarze Backenränder (2,11–13) und (15,11–13), Visier/„Gesichtsfenster“ (7–10, 9) und 
  Augenschlitze (5–7, 10–11), (10–12, 10–11), durch die der Schleim zu sehen ist.
  Der Helm ist ein starres Teil (= alle Pixel, die vom nackten Körper abweichen: Maske im Skript).
* Schleim darunter/daneben: grüner Gelkörper mit dunkelgrünem Umriss (41,65,0); Augen = dunkle Pupillenpixel (5–6,10), (5,11) und
  (11–12,10), (12,11), schwarzen Pupillenpunkten (7,10), (10,10) und weißen Lichtpunkten (6,11), (11,11); Mund = dunkelgrünes Band (7–10, 14) mit Mundwinkeln (6,13), (10–11,13)
  und Schatten (7–10, 15); unten die Pfütze (y 14–18) mit hellen Glanzflecken (11,15), (4–6,16), (10–11,17).
Fest bleiben: Mundwinkel, Glanzflecken der Pfütze, schwarze Backenränder des Helms (mit dem Helm starr).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Frames 0–15, 24–31): der untere Körper (Zeilen 12–13, Wangen) wird um 1 Zeile gestreckt bzw. gestaucht; der ganze Kopfblock
  (Helm + Gesicht) hebt/senkt sich starr mit — das Gesicht verdoppelt/entfernt nie eine Zeile. Kopf lehnt sich 1–2 px (Periode 24).
* Kleiner Stampfer (16–23, 1 px) und großer Stampfer (32–47, 2 px): Anlauf-Stauchung, Absprung gestreckt, Fallen, Aufprall-Stauchung
  (Wangenzeilen weg), Nachfedern. Bei der Stauchung wird der nackte Schleim unter dem Helm breiter und quillt neben den Backenrändern heraus.
* Helm: starr, aber nicht festgeklebt — er sinkt beim Absprung und beim Aufprall 1 px in den Kopf und federt danach 1 px hoch. Dabei
  wandern die Augenschlitze über das Gesicht (Verdecktes kommt aus dem nackten Körper, siehe oben).
* Blinzeln: Frames 24–26 und 44–46 (Lid → Augenlinie → Lid), am nackten Körper, damit es durch die Schlitze zu sehen ist.
* Stahlglanz (Regel 12): zweimal pro Schleife (Frames 4–14 und 28–38) wandert ein diagonales Lichtband über den Helm (4 px breit,
  Kern 2 px zusätzlich; Stahlrampe H→I→J→M→D→O→Weiß, also bis zu 2 Stufen heller, hellste Lichter blitzen weiß). Dazu blitzen vierzackige
  Glitzersterne (Mitte + 4 Arme, 5 Frames) an Helmspitze, Kuppel, Stirn, Krempe und Wangenschutz auf, jeweils wenn das Band vorbeizieht, dazu
  einzeln dazwischen; ebenso an den Glanzflecken der Pfütze. Die Augen-Lichtpunkte funkeln (Frames 10–12 und 36–38: gedimmt → hell → Mini-Stern).
* Schleimblasen (Partikel): acht Blasen (Funke, Punkt, Kreis) steigen langsam um die Pfütze auf (hinter der Figur).
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

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 8, 8, 10, 3

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
STAHL = {(24, 25, 17): (32, 38, 42), (32, 38, 42): (41, 46, 59), (41, 46, 59): (106, 113, 118), (106, 113, 118): (139, 138, 143),
         (139, 138, 143): (180, 180, 176), (180, 180, 176): (242, 253, 239), (92, 92, 90): (139, 138, 143)}   # Stahlrampe, jeweils eine Stufe heller
assert all(a in _farben and b in _farben for a, b in STAHL.items())
BLASE_C, BLASE_R = (160, 204, 147), (136, 204, 118)
WEISS_T, STAHL_O, STAHL_D = (242, 253, 239), (180, 180, 176), (139, 138, 143)
assert all(c in _farben for c in (BLASE_C, BLASE_R, WEISS_T, STAHL_O, STAHL_D))
STERN_FARBEN = {'m': WEISS_T, 'a': STAHL_O, 's': STAHL_D}

AUGEN_L, AUGEN_R = [(5, 10), (6, 10), (7, 10), (5, 11), (6, 11)], [(10, 10), (11, 10), (12, 10), (11, 11), (12, 11)]   # inkl. schwarzer Pupille

# ── Zeitachsen (Frame → Wert), N = 48 ──
S = [0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1, 0, 0, 0,                       # 0–15 Atmen
     -1, -1, 1, 1, -1, 1, 0, 0,                                                # 16–23 kleiner Stampfer
     0, 0, 1, 1, 1, 1, 0, 0,                                                   # 24–31 Atmen
     -1, -2, -2, 2, 2, 1, 1, 2, -2, -1, 1, 0, 0, 0, 0, 0]                      # 32–47 großer Stampfer
LIFT = {18: 1, 19: 1, 35: 1, 36: 2, 37: 2, 38: 2, 39: 1}
HELM_DY = {18: 1, 19: 1, 20: 1, 21: -1, 35: 1, 36: 1, 40: 1, 41: -1}           # Helm gegenüber dem Kopf (+ = sinkt ein, − = federt hoch)
BLINZELN = {24: 1, 25: 2, 26: 1, 44: 1, 45: 2, 46: 1}
SWEEPS = [4, 28]                                                                # Startframes der Stahl-Lichtbänder (je 11 Frames)
AUGEN_FUNKELN = {10: 0, 11: 1, 12: 2, 36: 0, 37: 1, 38: 2}                      # Frame → Stufe (0 gedimmt, 1 hell, 2 Mini-Stern)
assert len(S) == N

# Körperzeilen: Index 0 = Sprite-Zeile 5 … 13 = Zeile 18; Gesichtszeilen (Index 4–6 = Zeilen 9–11) werden nie verdoppelt
POSEN = {                                                                      # s → (löschen, doppeln, p unten)
    -2: ({7, 8}, (), 1), -1: ({7}, (), 1), 0: ((), (), 0), 1: ((), {7}, 0), 2: ((), {7: 2}, -1),
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
    if 16 <= i <= 19 or 32 <= i <= 39:
        v = 0.0                                                                  # in der Luft kein Lehnen
    elif 20 <= i <= 23:
        k = i - 20
        v = 1.8 * (1 - k / 5) * math.sin(2 * math.pi * k / 6)
    elif i >= 40:
        k = i - 40
        v = 2.4 * (1 - k / 8) * math.sin(2 * math.pi * k / 6)
    else:
        v = 1.4 * math.sin(2 * math.pi * i / 24)
    return max(-2.4, min(2.4, v))


def koerper_mit_augen(i):
    """Nackter Körper mit Blinzeln und Augenfunkeln (Quellkoordinaten); der Helm bleibt unberührt."""
    b = L.leer(sh, sw)
    b[:] = body
    k = BLINZELN.get(i, 0)
    if k:
        for (x, y) in AUGEN_L + AUGEN_R:
            if y == 10:
                b[y, x, :3] = HAUT
            elif k == 2:
                b[y, x, :3] = PUPILLE
    f = AUGEN_FUNKELN.get(i)
    if f is not None and not k:
        for (x, y) in ((6, 11), (11, 11)):
            b[y, x, :3] = BLASE_R if f == 0 else WEISS_T
    return b


def helm_mit_glanz(i):
    """Helm mit Stahl-Lichtband (zweimal pro Schleife): Band 4 breit, Kern 2 breit — 1–2 Stufen auf der Stahlrampe heller, ganz hell → Weiß."""
    h = helm.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 10:
            t = 4 + 3 * (i - s0)
            h = A.glanzband(h, t, STAHL, breite=4)
            h = A.glanzband(h, t + 1, STAHL, breite=2)
    return h


# ── Glitzer: Orte (Sprite-Koordinaten), Lebenslauf und Zeitplan ──
HELM_ORTE = {'spitze': (8, 1), 'kuppe_l': (8, 3), 'kuppe_r': (9, 3), 'stirn': (10, 6), 'krempe_l': (5, 7), 'krempe_r': (12, 7),
             'wange_l': (3, 9), 'wange_r': (14, 9)}
KOERPER_ORTE = {'auge_l': (6, 11), 'auge_r': (11, 11), 'glanz_r': (11, 15), 'glanz_u': (5, 16), 'glanz_m': (10, 17)}
ORTE = {**HELM_ORTE, **KOERPER_ORTE}
STERN_LAUF = [0, 1, 2, 1, 0]


def _stern_zeitplan():
    plan = []
    for s0, orte in ((4, ['spitze', 'kuppe_r', 'krempe_l', 'stirn', 'krempe_r', 'wange_l', 'wange_r', 'glanz_r']),
                     (28, ['kuppe_l', 'wange_r', 'krempe_r', 'stirn', 'krempe_l', 'spitze', 'glanz_u', 'glanz_m'])):
        for o in orte:
            d = sum(ORTE[o])
            peak = s0 + (d - 6) / 3.0
            plan.append((int(round(peak)) - 2, o))
    plan += [(17, 'krempe_r'), (22, 'spitze'), (45, 'kuppe_r'), (47, 'wange_l'), (20, 'stirn')]
    return plan


STERNE = _stern_zeitplan()


def aktive_sterne(i):
    out = []
    for (start, ort) in STERNE:
        k = (i - start) % N
        if k < len(STERN_LAUF):
            out.append((ort, STERN_LAUF[k]))
    if AUGEN_FUNKELN.get(i) == 2 and not BLINZELN.get(i) and HELM_DY.get(i, 0) <= 0:
        out += [('auge_l', 1), ('auge_r', 1)]
    return out


BLASEN = [
    dict(x=PAD_L - 2, y=PAD_T + 17, vx=-1, vy=-8, off=0, form='o', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 16, vx=1, vy=-8, off=3, form='s', wackeln=1),
    dict(x=PAD_L + 20, y=PAD_T + 13, vx=0, vy=-7, off=6, form='k', wackeln=1),
    dict(x=PAD_L - 3, y=PAD_T + 14, vx=0, vy=-7, off=9, form='k', wackeln=1),
    dict(x=PAD_L - 2, y=PAD_T + 10, vx=-1, vy=-7, off=12, form='s', wackeln=1),
    dict(x=PAD_L + 19, y=PAD_T + 18, vx=1, vy=-9, off=15, form='o', wackeln=1),
    dict(x=PAD_L + 3, y=PAD_T + 18, vx=-1, vy=-6, off=18, form='k', wackeln=1),
    dict(x=PAD_L + 15, y=PAD_T + 18, vx=1, vy=-6, off=21, form='s', wackeln=1),
]
BLASENFARBEN = {'c': BLASE_C, 'r': BLASE_R}


def figur(i):
    """Körper + Helm (ohne Partikel/Sterne) → dict(fig, hm, top, kb, hdx, hdy, orte)."""
    s = S[i]
    loesch, dopp, p = POSEN[s]
    kb_sp = koerper_mit_augen(i)
    marken = {}
    for k, (ort, stufe) in enumerate(aktive_sterne(i)):
        if ort in KOERPER_ORTE:
            x, y = ORTE[ort]
            m = (1, 2, 10 + k)
            marken[ort] = (m, tuple(int(v) for v in kb_sp[y, x, :3]))
            kb_sp[y, x, :3] = m
    zeilen = A.zeilen_von(kb_sp, KOERPER_Y0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(zeilen, loeschen=loesch, doppeln=dopp, p=p,
                               paare=PAARE_UNTEN if p >= 0 else PAARE_SCHMAL,
                               paare_je_zeile=PAARE_OBEN, x0=PAD_L, p_je_zeile=breiten(p))
    # Versatz je AUSGABEZEILE: Kopfblock (Zeilen 5–11) voll, erste Wangenzeile halb, letzte Wangenzeile und Pfütze 0 — die letzte
    # Wangenzeile muss mit der Pfütze gehen (Schulter dazwischen hat schon eine Umrissstufe von 1 px), und von Zeile zu Zeile darf der
    # Versatz nur um 1 px springen, sonst läge ein Füllpixel ohne Umriss frei. Bei nur einer Wangenzeile (Stauchung) lehnt der Kopf höchstens 1 px.
    wangen = [j for j, q in enumerate(quelle) if q in (7, 8)]
    lean = lehnen(i)
    if len(wangen) < 2:
        lean = max(-1.4, min(1.4, lean))
    dxq = []
    for j, q in enumerate(quelle):
        w = 1.0 if q < 7 else (0.5 if (q in (7, 8) and j == wangen[0] and len(wangen) > 1) else 0.0)
        dxq.append(int(round(lean * w)))
    z = A.verschiebe_ausgabezeilen(z, dxq)
    kb, top = A.auf_leinwand(z, H, BODEN, LIFT.get(i, 0))
    orte = {}
    for ort, (m, orig) in marken.items():
        orte[ort] = A.suche_marke(kb, m)
        kb[L.farbmaske(kb, [m]), :3] = orig
    hm = L.platz(helm_mit_glanz(i), H, W, PAD_L, PAD_T)
    hdx, hdy = dxq[0], top - KOERPER_Y0 - PAD_T + HELM_DY.get(i, 0)
    hm = L.versetze(hm, hdx, hdy)
    fig = L.zusammen(H, W, [(kb, 0, 0), (hm, 0, 0)])
    return dict(fig=fig, hm=hm, top=top, kb=kb, hdx=hdx, hdy=hdy, orte=orte)


def sterne_ebene(i, f):
    """Glitzersterne dieses Frames (vor der Figur): Helmorte folgen dem Helm, Körperorte dem verfolgten Pixel."""
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        if ort in HELM_ORTE:
            x, y = ORTE[ort]
            cx, cy = PAD_L + x + f['hdx'], PAD_T + y + f['hdy']
        else:
            pos = f['orte'].get(ort)
            if pos is None or HELM_DY.get(i, 0) > 0 and ort.startswith('auge'):
                continue
            cx, cy = pos
        A.stern(e, cx, cy, stufe, STERN_FARBEN)
    return e


def frame(i):
    f = figur(i)
    blasen = L.puff_ebene(H, W, i, 24, BLASEN, BLASENFARBEN)
    return L.zusammen(H, W, [(blasen, 0, 0), (f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    assert (figs[0] == ref).all(), 'Frame 0 weicht vom Original ab'
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    offen = []
    for i in range(N):
        f = figur(i)
        offen += [(i, o) for o in A.offene_koerperkanten(f['fig'], f['hm'][..., 3] > 0, f['top'], UMRISS)]
    print('offene Körperkanten (Frame, (x, y, Farbe)):', offen if offen else 'keine')
    A.ausdruck_pruefen(figs, spr, 'hardy-slime', erlaubt=list(STAHL.values()))
    L.speichern('hardy-slime', 'Hardy Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/hardy-slime-strip.png', frames[::2], spalten=12, scale=5)
