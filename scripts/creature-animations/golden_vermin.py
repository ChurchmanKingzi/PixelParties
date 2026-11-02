# -*- coding: utf-8 -*-
"""Idle-Animation für „Golden Vermin“ (Creature).

PICK: [["MotiveSteamDwarfs", 114, 2]]   Ebene „Ebene #222“ (MotiveSteamDwarfs.xcf, Ebene 114, drei Figuren desselben Ungeziefers; Figur 2 = die Figur der Karte mit dem schwarzen Fleck am Kopf,
15×15 px, 8 Farben, nur Alpha 0/255) → src/golden-vermin.png. Nicht verwendet: die zwei Wächterstatuen daneben (Ebene 115), die gespiegelte Figur 3 und die schwarzenlose Figur 1 derselben Ebene, Mauerwerk und Boden.

Aufruf:   python3 golden_vermin.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/golden-vermin.png + .json

Was im Sprite ist (Koordinaten im Sprite 15×15, x/y ab 0):
* Ein goldenes Ungeziefer (Ratte/Nager) in sitzender Haltung: Kopf oben (x 3–8, y 0–4), der Körper läuft diagonal nach rechts unten (Zeilen 4–11), unten ein eingerollter Schwanz (Zeilen 10–14).
  Gold in vier Stufen B=(255,174,0), C=(255,231,57), E=(255,255,228), G=(255,255,255) (Lichter), Umriss/Schatten in Dunkelrot A=(148,27,0), F=(228,54,0), H=(105,19,0).
* Ein schwarzer Fleck D=(0,0,0) links am Kopf bei (0–3, 2–7): das ist das LOCH (in der Kartenkunst ein schwarzes Loch in der Wand/Statue), an dem das Ungeziefer knabbert; direkt daneben zwei weiße Pixel
  G bei (4, 4–5) = die Nagezähne an der Schnauze. RUNDE 2 (Nutzerwunsch „das Loch soll sich nie bewegen“): das Loch (alle schwarzen Pixel, 22 Stück) liegt jetzt auf einer EIGENEN, festen Ebene
  (wird nie verschoben, nie gestreckt, nie überzeichnet — es liegt über dem Ungeziefer); nur das Ungeziefer (alle anderen Pixel) bewegt sich.
* Gold → Glanz und Glitzer sind erlaubt, aber nur auf den goldenen Teilen (Umriss, schwarzer Fleck und Randpixel bleiben).
Hinweis Verbund: Das Sprite ist nur 8-verbunden (der Schwanz hängt über eine Pixelecke); je Frame prüft das Skript, dass die Figur aus genau einem 8-zusammenhängenden Teil besteht und dass es keine offenen
Randpixel gibt.
Fest bleiben: das Loch (eigene Ebene, nie bewegt), der Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): der Körper streckt sich 1 px nach oben (Frames 2–10 und 26–34: Körperzeile 7 verdoppelt — mit Texturmischung der Nachbarzeile —, Kopf und Schultern heben sich), der Schwanz bleibt am Boden.
  Das Loch bleibt dabei an seinem Platz (nur das Ungeziefer steigt).
* Knabbern (Periode 8 = sechsmal je Schleife): der Kopf (Zeilen 0–4) zieht sich 1 px nach rechts vom Loch zurück (Frames 3–5 jeder Periode) und beißt wieder zu; die Zeilen 0–4 laufen waagerecht, der Hals
  (Zeile 5) bleibt — die rechte Umrisskante passt dabei nahtlos an (Zeile 4 → Zeile 5 liegt dann auf demselben x). Die freiwerdenden Kopfkanten am Loch bekommen den Umriss A (siehe Ergänzungen).
* Schwanzschlag: der eingerollte Schwanz und der Körperfuß (Zeilen 9–14) schwingen seitlich (Zeilenversatz wächst nach unten, bis ±1 px, Periode 16, Nachlauf); Frame 0 = Quellform.
* Goldglanz (Regel 14: Gold): zweimal pro Schleife (Frames 4–13 und 28–37) zieht ein schmales diagonales Lichtband über das Gold (eine Stufe heller auf der Gold-Rampe B→C→E→G, nur Innenpixel);
  dazu blitzen vierzackige Glitzersterne an vier Lichtpunkten (4,1), (7,9), (13,10), (6,13) auf (5 Frames Lauf, wachsen/schrumpfen). Umriss, schwarzer Fleck und Randpixel glänzen nicht.
* Goldstaub (Partikel): vier runde 2×2-Wölkchen (nie einzelne Punkte; Farben C und B des Sprites) steigen rechts und links neben dem Sprite langsam auf; sie berühren die Figur und das Loch nie (≥ 1 px Abstand, im Skript geprüft).
* Keine Augeneffekte: die Augen sind im Sprite nicht eindeutig (kein Blinzeln).
Ergänzungen: beim Zurückziehen des Kopfes bekommen freiliegende linke Kopfkanten (am Loch) den Umriss A=(148,27,0) (umriss_ergaenzen, 0–3 Pixel je Frame); Frame 0 unverändert.
Frame: Sprite plus 5 px links, 6 px rechts (Goldstaub), 4 px oben (Strecken + Sterne), 3 px unten (Stern am Schwanz) — Figur zentriert; Sterne und Wölkchen liegen in der 2-px-Zone um die Figur.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 5, 6, 4, 3

spr = L.lade('golden-vermin')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
yy, xx = np.mgrid[0:sh, 0:sw]
OPAK = spr[..., 3] > 0
RAND0 = A.randpixel(spr)

TEST_EBENEN = ('fig',)
CA, CB, CC, CD, CE, CF, CG, CH = (148, 27, 0), (255, 174, 0), (255, 231, 57), (0, 0, 0), (255, 255, 228), (228, 54, 0), (255, 255, 255), (105, 19, 0)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
for _c in (CA, CB, CC, CD, CE, CF, CG, CH):
    assert _c in _farben, _c
GOLD = (spr[..., :3] == np.array(CB)).all(axis=2) | (spr[..., :3] == np.array(CC)).all(axis=2) | (spr[..., :3] == np.array(CE)).all(axis=2)
HOLE = OPAK & (spr[..., :3] == np.array(CD)).all(axis=2)                                # das Loch: alle schwarzen Pixel (feste Ebene)
RAND_FARBEN = A.umrissfarben(spr)
GOLD &= OPAK & ~RAND0                                                                 # nur Innenpixel glänzen
HELLER = {CB: CC, CC: CE, CE: CG}
STERN_FARBEN = {'m': CG, 'a': CE, 's': CC}
WOLKEN_FARBEN = {'c': CC, 'r': CB}
SWEEPS = [4, 28]
ORTE = {'a': (4, 1), 'b': (7, 9), 'c': (13, 10), 'd': (6, 13)}
for _k, (_x, _y) in ORTE.items():
    assert OPAK[_y, _x] and tuple(int(v) for v in spr[_y, _x, :3]) in (CE, CC, CB), (_k, spr[_y, _x])
STERN_LAUF = [0, 1, 2, 1, 0]
STERNE = [(s0 + d, o) for s0 in SWEEPS for (o, d) in (('a', 0), ('b', 3), ('c', 5), ('d', 6))]


def aktive_sterne(i):
    return [(o, STERN_LAUF[(i - s) % N]) for (s, o) in STERNE if (i - s) % N < len(STERN_LAUF)]


# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(1 if _v >= 0.3 else 0)
assert S[0] == 0
SCHWANZ_Y0 = 9                                                                         # Zeilen 9–14 schwingen


KOPF_ZEILEN = 4                                                                        # Quellzeilen 0–4 gehören zum knabbernden Kopf
KNABBERN = [1 if (i % 8) in (3, 4, 5) else 0 for i in range(N)]                       # 1 = Kopf 1 px nach rechts zurückgezogen
assert KNABBERN[0] == 0


def zeilen_dx(i):
    out = [0] * sh
    for k in range(SCHWANZ_Y0, sh):
        frac = (k - SCHWANZ_Y0 + 1) / float(sh - SCHWANZ_Y0)
        ph = 2 * math.pi * i / 16
        out[k] = int(round(1.0 * frac * (math.sin(ph - 0.8 * frac) - math.sin(-0.8 * frac))))
    for k in range(KOPF_ZEILEN + 1):
        out[k] = KNABBERN[i]
    return out


# ── Wölkchen (nur 2×2 / 4×4) rechts und links neben dem Sprite ──
WOLKEN = [
    dict(x=17, y=11, vx=0, vy=-6, off=0), dict(x=17, y=9, vx=0, vy=-6, off=12),
    dict(x=-3, y=12, vx=0, vy=-6, off=6), dict(x=-3, y=10, vx=0, vy=-6, off=18),
]


def wolken_ebene(i):
    e = L.leer(H, W)
    for w in WOLKEN:
        t = ((i + w['off']) % 24) / 24.0
        if t > 0.92:
            continue
        form = 's'
        cx = PAD_L + w['x'] + int(round(w['vx'] * t))
        cy = PAD_T + w['y'] + int(round(w['vy'] * t))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Wölkchen bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = WOLKEN_FARBEN[k]
            e[Y, X, 3] = 255
    return e


def sprite_mit_effekten(i):
    sp = spr.copy()
    for s0 in SWEEPS:
        if 0 <= i - s0 <= 9:
            t = 3 * (i - s0) + 2
            sp = A.farb_schritt(sp, HELLER, GOLD & (xx + yy >= t) & (xx + yy < t + 4))
    return sp


HOLE_EBENE = L.platz(np.where(HOLE[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)   # feste Ebene, nie bewegt


def figur(i):
    sp = sprite_mit_effekten(i)
    sp = np.where(HOLE[..., None], 0, sp).astype(np.uint8)                              # nur das Ungeziefer wird verformt
    koerper = A.zeilen_von(sp, 0, sh - 1, H, W, PAD_L, PAD_T)
    z, quelle = A.koerper_pose(koerper, doppeln={7: 1} if S[i] else {}, p=0, x0=PAD_L)
    z = A.verschiebe_zeilen(z, quelle, zeilen_dx(i))
    fig, top = A.auf_leinwand(z, H, BODEN, 0)
    verm = fig.copy()
    fig = L.zusammen(H, W, [(fig, 0, 0), (HOLE_EBENE, 0, 0)])                             # Loch liegt fest über dem Ungeziefer
    fig, pfad, offen = A.verbinde_luecken8(fig, 3)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: CA)
    fig = L.zusammen(H, W, [(fig, 0, 0), (HOLE_EBENE, 0, 0)])
    return dict(fig=fig, top=top, pfad=pfad, offen=offen, quelle=quelle, neu=neu, verm=verm)


def sterne_ebene(i, f):
    e = L.leer(H, W)
    for ort, stufe in aktive_sterne(i):
        x, y = ORTE[ort]
        # Zeile y im Quell-Sprite → Ausgabezeile (erste Kopie) + Schwanzversatz
        yo = f['top'] + f['quelle'].index(y) - PAD_T
        dx = zeilen_dx(i)[y]
        A.stern(e, PAD_L + x + dx, PAD_T + yo, stufe, STERN_FARBEN)
    return e


def frame(i, nur=None):
    f = figur(i)
    if nur is not None:
        return f['fig']
    return L.zusammen(H, W, [(wolken_ebene(i), 0, 0), (f['fig'], 0, 0), (sterne_ebene(i, f), 0, 0)])


if __name__ == '__main__':
    print('Farben im Sprite:', len(_farben), '| Goldpixel (Glanzmaske):', int(GOLD.sum()), '| Randfarben:', sorted(A.umrissfarben(spr)))
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Loch unverändert in allen Frames:', all(((f[..., :3] == HOLE_EBENE[..., :3]).all(axis=2) | (HOLE_EBENE[..., 3] == 0))[HOLE_EBENE[..., 3] > 0].all() for f in figs))
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('Pfadpixel je Frame:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    k8 = [int(cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)[0] - 1) for f in figs]
    print('8-Komponenten je Frame (soll überall 1):', sorted(set(k8)), '| 4-Komponenten Original:', A.komponenten4(OPAK), '| je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}))
    schlecht = A.ausdruck_pruefen(figs, spr, 'golden-vermin')
    print('offene Randpixel (Frames):', [k for (k, n_, offen) in schlecht if offen])
    L.speichern('golden-vermin', 'Golden Vermin', frames, MS, prev)
    if prev:
        L.streifen(prev + '/golden-vermin-strip.png', frames[::2], spalten=12, scale=8)
