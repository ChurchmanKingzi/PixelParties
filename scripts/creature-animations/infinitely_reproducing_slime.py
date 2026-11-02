# -*- coding: utf-8 -*-
"""Idle-Animation für „Infinitely Reproducing Slime“ (Creature) — Runde 2: kräftigeres Squash & Stretch.

PICK: [["Motive", 554, 4]]   Ebene „Infinitely Reproducing Slime“ (Motive.xcf, Ebene 554; die Ebene zeigt vier Schleime in verschiedenen Zuständen — Figur 4 = der glockenförmige Schleim unten links der
Karte, 17×16 px, 8 Farben, nur Alpha 0/255) → src/infinitely-reproducing-slime.png. Nicht verwendet: die anderen drei Schleime der Ebene (hoher Schleim oben, runder Schleim rechts, „M“-förmiger
Schleim in der Mitte — der ist der Shadowy Slime) samt ihren halbtransparenten Pfützen (Alpha 102, nicht pixelgenau mischbar, wie beim Slimy Slime). Die breite dunkle Pfütze (Ebene 551) unter dem
Schleim ist Kulisse/Boden, kein Körperteil.

Aufruf:   python3 infinitely_reproducing_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/infinitely-reproducing-slime.png + .json

Was im Sprite ist (Koordinaten im Sprite 17×16, x/y ab 0):
* Ein violetter Glockenschleim: Kuppel (Zeilen 0–8, x 1–12) mit dunklem Umriss A=(31,9,74) (am Rand nur diese Farbe), Violettstufen B=(64,20,153), C=(87,27,208), D=(106,46,227), E=(44,14,105),
  F=(125,73,230), hellen Glanzlichtern G=(165,129,238), H=(154,113,236) oben links bei (3–5, 1–3) und am Fuß; unten breitet sich der Schleim als Fuß nach rechts aus (Zeilen 9–13, bis x 16).
* Keine Augen im Sprite (kein Blinzeln). Material: Gel — kein Metall/Gold/Edelstein: KEIN Glanz und keine Glitzersterne (Regel 14); kein Flammenfeuer (Regel 15).
Fest bleiben: Umriss, Kuppelform, Lichter (sie wandern nur mit dem Gel); die Fußzeilen 12–15 werden nicht verformt außer in der Breite.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos) — Nutzerwunsch „mehr Squash and Stretch“: der Schleim federt in zwei Sprüngen (ein großer, ein kleiner) mit deutlicher Verformung:
* Anlauf-Stauchung: 1–3 Körperzeilen (Zeilen 5–7) werden entfernt und jede Zeile um 1–2 Spalten je Seite breiter (die Spalten neben dem Umriss werden verdoppelt, nie der Umriss).
* Strecken im Sprung: bis zu 4 Körperzeilen (5, 6, 7, 8) werden zusätzlich eingefügt (Texturmischung mit der Nachbarzeile — keine 1:1-Kopie, `A.koerper_pose`) und jede Zeile 1 Spalte je Seite
  schmaler (Spaltenpaare werden entfernt) → hoch und schlank; der Schleim hebt dabei bis zu 5 px (großer Sprung) bzw. 3 px (kleiner Sprung) vom Boden ab.
* Landung: Stauchung (breit und flach), Rückfederung (kurz gestreckt), Ausschwingen. Pose und Höhe wechseln alle 1–2 Frames, Frame 0 = Original.
* Schleimperlen (Partikel): zwei runde Wölkchen (2×2 → 4×4 → 2×2, nie einzelne Punkte; Farben D und C des Sprites) quellen rechts neben dem Schleim auf und steigen langsam auf.
Ergänzungen: wo ein Randpixel durch die Verformung ohne Umriss frei liegt, bekommen die leeren Nachbarfelder den Umriss A (umriss_ergaenzen, Regel 16).
Frame: Sprite plus 5 px links/rechts, 11 px oben (Strecken + Sprung), 2 px unten. Alle Bewegungen laufen auf der vollen Leinwand. Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 11, 2
TEST_EBENEN = ('fig',)

spr = L.lade('infinitely-reproducing-slime')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)
UMRISS = (31, 9, 74)
RAND_FARBEN = A.umrissfarben(spr)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
PERLEN_FARBEN = {'c': (87, 27, 208), 'r': (106, 46, 227)}
for _c in PERLEN_FARBEN.values():
    assert _c in _farben, _c
assert {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(RAND0))} == {UMRISS}
GLANZ = ((165, 129, 238), (154, 113, 236))


def _col(y, x):
    return tuple(int(v) for v in spr[y, x, :3])


# ── Spaltenpaare je Zeile: zwei Paare, je ein Pixel neben dem Umriss (nie der Umriss, nie ein Glanzlicht G/H) ──
PAARE_ZEILE = {}
for y in range(sh):
    xs = np.nonzero(OPAK[y])[0]
    l, r = int(xs.min()), int(xs.max())
    kante = y in (0, sh - 2, sh - 1)                                       # Zeilen, die nur Oberkante/Fußkante sind: dort darf Umriss verdoppelt werden (nie die Endpixel)
    ok = lambda x: OPAK[y, x] and (l < x < r or (y in (0, sh - 1) and l <= x <= r)) and _col(y, x) not in GLANZ and (kante or _col(y, x) != UMRISS)
    links = [x for x in (l + 2, l + 1, l + 3, l + 4, l + 5, l + 6, l) if 0 <= x < sw and ok(x)]
    rechts = [x for x in (r - 2, r - 1, r - 3, r - 4, r - 5, r - 6, r) if 0 <= x < sw and ok(x)]
    paare, benutzt = [], set()
    for a_, b_ in zip(links, rechts):
        if a_ < b_ and a_ not in benutzt and b_ not in benutzt:
            paare.append((a_, b_)); benutzt |= {a_, b_}
    assert len(paare) >= 2, (y, paare)
    PAARE_ZEILE[y] = paare

# ── Posen: Name → (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite) ──
POSEN = {
    'R':  ((), {}, 0),
    'S1': ({6}, {}, 1),                       # leicht gestaucht
    'S2': ({6, 7}, {}, 2),                    # stark gestaucht: 2 Zeilen kürzer, 4 px breiter
    'S3': ({5, 6, 7}, {}, 2),                 # tiefste Stauchung (Aufprall / Anlauf)
    'T1': ((), {6: 1}, 0),                    # leicht gestreckt
    'T2': ((), {5: 1, 7: 1}, -1),             # gestreckt und schlanker
    'T3': ((), {5: 1, 6: 1, 8: 1}, -1),       # stark gestreckt
    'T4': ((), {5: 1, 6: 1, 7: 1, 8: 1}, -1), # maximal gestreckt (+4 Zeilen, 2 px schmaler)
}
# Ablauf (Pose, Höhe über dem Boden in px) je Frame: großer Sprung (3–24), kleiner Sprung (28–40), Ausschwingen (41–47)
ABLAUF = [
    ('R', 0), ('R', 0), ('R', 0),                                              # 0–2   Ruhe
    ('S1', 0), ('S2', 0), ('S3', 0), ('S3', 0), ('S2', 0),                     # 3–7   Anlauf: duckt sich
    ('T1', 1), ('T3', 2), ('T4', 4), ('T4', 5),                                # 8–11  Absprung, streckt sich
    ('T3', 5), ('T3', 5), ('T2', 5), ('T2', 4),                                # 12–15 Scheitel
    ('T3', 3), ('T3', 3), ('T4', 2), ('T3', 1),                                # 16–19 fällt, gestreckt
    ('T1', 0), ('S2', 0), ('S3', 0), ('S3', 0), ('S2', 0), ('S1', 0),          # 20–25 Aufprall: Stauchung, federt zurück
    ('T1', 0), ('R', 0),                                                       # 26–27
    ('S1', 0), ('S2', 0), ('S2', 0),                                           # 28–30 kleiner Anlauf
    ('T1', 1), ('T2', 2), ('T3', 3), ('T2', 3), ('T2', 2), ('T1', 1),          # 31–36 kleiner Sprung
    ('S1', 0), ('S2', 0), ('S1', 0),                                           # 37–39 Landung
    ('T1', 0), ('R', 0), ('S1', 0), ('R', 0), ('T1', 0), ('R', 0),             # 40–45 Ausschwingen
    ('R', 0), ('R', 0),                                                        # 46–47
]
assert len(ABLAUF) == N, len(ABLAUF)
assert ABLAUF[0] == ('R', 0)
MAX_DY = max(d for _, d in ABLAUF)

# ── Perlen (nur 2×2 / 4×4), rechts neben der Kuppel (x 17–20 im Sprite-Raster) ──
PERLEN = [
    dict(x=17, y=10, vx=0, vy=-8, off=0), dict(x=16, y=10, vx=1, vy=-8, off=12),
]


def perlen_ebene(i):
    e = L.leer(H, W)
    for w in PERLEN:
        t = ((i + w['off']) % 24) / 24.0
        if t > 0.92:
            continue
        form = 's' if (t < 0.25 or t > 0.7) else 'o'
        cx = PAD_L + w['x'] + int(round(w['vx'] * t))
        cy = PAD_T + w['y'] + int(round(w['vy'] * t))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Perle bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = PERLEN_FARBEN[k]
            e[Y, X, 3] = 255
    return e


def figur(i):
    pose, dy = ABLAUF[i]
    loeschen, doppeln, p = POSEN[pose]
    koerper = A.zeilen_von(spr, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, loeschen=loeschen, doppeln=doppeln, p=p, paare_je_zeile=PAARE_ZEILE, x0=PAD_L)
    fig, top = A.auf_leinwand(z, H, BODEN, dy)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, top=top, neu=neu)


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    return L.zusammen(H, W, [(perlen_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Paare:', PAARE_ZEILE)
    frames = [frame(i) for i in range(N)]
    figs = [figur(i)['fig'] for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(figur(i)['neu']) for i in range(N)])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'infinitely-reproducing-slime')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('infinitely-reproducing-slime', 'Infinitely Reproducing Slime', frames, MS, prev)
    if prev:
        L.streifen(prev + '/infinitely-reproducing-slime-strip.png', frames[::2], spalten=12, scale=8)
