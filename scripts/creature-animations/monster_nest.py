# -*- coding: utf-8 -*-
"""Idle-Animation für „Monster Nest“ (Creature).

PICK: [["Motive", 831, 1]]   Ebene „Monster Nest“ (Motive.xcf, Ebene 831, 39×33 px, 8 Farben, nur Alpha 0/255) → src/monster-nest.png (ganzes Sprite, ein einziges 4-verbundenes Teil).
Nicht verwendet: die Lava und das Mauerwerk der Karte (andere Ebenen).

Aufruf:   python3 monster_nest.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/monster-nest.png + .json

Was im Sprite ist (Koordinaten im Sprite 39×33, x/y ab 0):
* Ein Haufen aus fünf würfelförmigen, weiß-grauen Kapseln (B=(208,208,208), C=(237,237,237), F=(129,129,129), schwarzer Umriss A=(0,0,0)), jede mit einer roten, achteckigen Raute in der Mitte
  (D=(170,74,76), E=(158,52,55), G=(87,31,32)) und zwei roten Eckmarken oben; die Rautenmitten liegen bei (30.5, 8.5) (oben rechts), (15.5, 11.5) (oben Mitte), (7.5, 17.5) (links), (25.5, 18.5)
  (Mitte rechts) und (16.5, 25.5) (unten). Die Kapseln berühren sich und teilen ihre schwarzen Umrisslinien. Ein einzelnes gelbes Pixel H=(250,213,74) bei (0, 22) gehört zum Original (Lavaschimmer).
* Material: Ei-/Kapselschale in Weißgrau mit roten Marken — kein erkennbarer Edelstein/Gold/Metall: KEIN Glanz (Regel 14), kein Flammenfeuer (Regel 15).
Fest bleiben: Kapselform, Umriss, rote Rauten (keine Farbwechsel).

Zuordnung der Pixel zu den fünf Kapseln: jedes deckende Pixel gehört zur Kapsel mit der nächsten Rautenmitte (Voronoi, deckt sich mit den schwarzen Trennlinien).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Wackeln: jede Kapsel wippt einzeln 1 px auf und ab (Periode 24, je Kapsel eine andere Phase; Frame 0 = Original) — das Nest „atmet“ und die Eier stoßen gegeneinander.
* Rucken: reihum rutscht eine Kapsel für 2 Frames 1 px zur Seite (links Frames 8–9, oben rechts 20–21, unten 32–33, Mitte rechts 42–43), als regte sich etwas darin.
* Dampf (Partikel): sechs runde Wölkchen (2×2 → 4×4 → 2×2, nie einzelne Punkte; Farben Weiß C und Grau B des Sprites) steigen in den leeren Ecken des Nests (links oben, rechts unten, links unten) langsam auf.
Ergänzungen (Regel 16): wo sich zwei Kapseln beim Wackeln trennen, liegt die weiße Schale an der neuen Lücke frei; das leere Nachbarfeld bekommt dann den schwarzen Umriss A (umriss_ergaenzen, 0–10 Pixel je Frame).
Teile, die dadurch nur über eine Ecke hängen, bekommen Brückenpixel (verbinde4/verbinde_luecken, Regel 11).
Frame: Sprite plus 3 px links/rechts, 3 px oben, 3 px unten — Figur zentriert; der Dampf liegt innerhalb des Sprite-Rechtecks (keine zusätzliche Frame-Vergrößerung).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 3, 3

spr = L.lade('monster-nest')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
SCHWARZ = (0, 0, 0)
_farben = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
WOLKEN_FARBEN = {'c': (237, 237, 237), 'r': (208, 208, 208)}
for _c in WOLKEN_FARBEN.values():
    assert _c in _farben, _c

# ── Kapseln (Voronoi um die Rautenmitten) ──
SAMEN = {'A': (30.5, 8.5), 'B': (15.5, 11.5), 'C': (7.5, 17.5), 'D': (25.5, 18.5), 'E': (16.5, 25.5)}
NAMEN = sorted(SAMEN, key=lambda k: SAMEN[k][1])                                       # Zeichenreihenfolge: obere Kapsel zuerst (hinten), untere vorn
yy, xx = np.mgrid[0:sh, 0:sw]
_dist = np.stack([(xx - SAMEN[k][0]) ** 2 + (yy - SAMEN[k][1]) ** 2 for k in NAMEN])
KAPSEL = {k: OPAK & (np.argmin(_dist, axis=0) == j) for j, k in enumerate(NAMEN)}
assert sum(int(m.sum()) for m in KAPSEL.values()) == int(OPAK.sum())

# ── Bewegungen ──
PHASEN = {'A': 0.0, 'B': 1.4, 'C': 2.8, 'D': 4.2, 'E': 5.6}
RUCKEN = {'C': (range(8, 10), -1), 'A': (range(20, 22), 1), 'E': (range(32, 34), -1), 'D': (range(42, 44), 1)}


def versatz(k, i):
    ph = 2 * math.pi * i / 24
    dy = int(round(0.55 * (math.sin(ph + PHASEN[k]) - math.sin(PHASEN[k]))))
    dx = 0
    if k in RUCKEN and i in RUCKEN[k][0]:
        dx = RUCKEN[k][1]
    return dx, dy


# ── Wölkchen: nur 2×2 und 4×4 (nie 1 px), steigen in den leeren Ecken des Sprite-Rechtecks auf ──
WOLKEN = [
    dict(x=5, y=7, vx=-1, vy=-5, off=0, gross=True), dict(x=4, y=6, vx=1, vy=-5, off=8, gross=True), dict(x=6, y=8, vx=-1, vy=-5, off=16, gross=True),
    dict(x=33, y=29, vx=1, vy=-5, off=4, gross=True), dict(x=34, y=28, vx=-1, vy=-5, off=14, gross=True),
    dict(x=5, y=29, vx=1, vy=-5, off=20, gross=True),
]


def wolken_ebene(i):
    e = L.leer(H, W)
    for w in WOLKEN:
        t = ((i + w['off']) % 24) / 24.0
        if t > 0.92:
            continue
        form = 's' if (t < 0.22 or t > 0.72 or not w['gross']) else 'o'
        cx = PAD_L + w['x'] + int(round(w['vx'] * t))
        cy = PAD_T + w['y'] + int(round(w['vy'] * t))
        for (dx, dy, k) in L.PUFF_FORMEN[form]:
            X, Y = cx + dx, cy + dy
            if not (2 <= X < W - 2 and 2 <= Y < H - 2):
                raise L.ClipError(f'Wölkchen bei ({X},{Y}) zu nah am Rand des Frames {W}×{H}')
            e[Y, X, :3] = WOLKEN_FARBEN[k]
            e[Y, X, 3] = 255
    return e


def figur(i):
    ebenen = []
    for k in NAMEN:
        dx, dy = versatz(k, i)
        ebenen.append((L.platz(np.where(KAPSEL[k][..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T), dx, dy))
    fig = L.zusammen(H, W, ebenen)
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: SCHWARZ)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    return dict(fig=fig, neu=neu, brueck=brueck, pfad=pfad, offen=offen)


def frame(i):
    f = figur(i)
    return L.zusammen(H, W, [(wolken_ebene(i), 0, 0), (f['fig'], 0, 0)])


if __name__ == '__main__':
    print('Kapseln (Pixel):', {k: int(KAPSEL[k].sum()) for k in NAMEN})
    frames = [frame(i) for i in range(N)]
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brücken-/Pfadpixel je Frame:', [len(f['brueck']) + len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'monster-nest')
    print('Frames mit Befund:', [(k, n_, offen) for (k, n_, offen) in schlecht][:6])
    L.speichern('monster-nest', 'Monster Nest', frames, MS, prev)
    if prev:
        L.streifen(prev + '/monster-nest-strip.png', frames[::2], spalten=12, scale=6)
