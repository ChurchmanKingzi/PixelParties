# -*- coding: utf-8 -*-
"""Idle-Animation für „Man-Eater Birds“ (Creature) — Regeln 14/15/16 (Vögel: kein Metall, kein Feuer → kein Glanz, keine Funken).

PICK: [["Motive", 290, 1], ["Motive", 290, 2], ["Motive", 290, 3]]
Quelle: src/man-eater-birds.png — die drei Vögel der Kartenkunst in ihrer Kartenanordnung (56×47 px, 11 Farben) aus Motive.xcf, Ebene 290 („Man-Eater Birds“), Figuren 1, 2, 3 (24×14, 22×21, 22×18 px bei den Kartenpositionen (18,1), (47,13), (13,30));
pixelgenau gegen die Kartenkunst abgeglichen, vollständig deckend (Alpha nur 255), Maßstab 1. Das Skript zerlegt die Quelle über die drei 8-verbundenen Teile in die drei Vögel.

Aufruf:   python3 man_eater_birds.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/man-eater-birds.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; jeder Vogel: dunkler Kopf links mit gelbem Auge, weißen Reißzähnen oben und unten, waagerechtem Rumpf, kleiner Schwanzspitze und einem großen dreieckigen Flügel):
* A (oben, x 6–26, y 0–12): Flügel schräg nach oben-rechts (ca. 56° über der Waagerechten), Auge bei (9–10, 7).
* B (rechts, x 35–55, y 13–29): Flügel hängt schräg nach unten-rechts (ca. −69°), Auge bei (38–39, 17).
* C (unten links, x 0–21, y 30–46): Flügel steil nach oben (ca. 76°), Auge bei (3–4, 39).
Die drei Vögel sind dieselbe Figur in drei Flügelstellungen (oben, schräg, unten): Kopf und Rumpf sind in allen drei gleich gezeichnet.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag im konstanten Rhythmus (Periode 12, viermal pro Schleife), alle drei Vögel gleich schnell, aber gegeneinander versetzt: Jeder Flügel schwingt zwischen −69° (unten) und +80° (oben) um die Flügelwurzel am Rumpf,
  die Phase ist je Vogel so gewählt, dass in Frame 0 jeder Vogel genau in seiner Stellung der Karte steht (A schräg nach oben, auf dem Weg nach unten; B ganz unten; C fast ganz oben). Abschlag etwas schneller als Aufschlag.
  Der Flügel dreht sich als ganzes Dreieck (Rückwärtsabbildung, Nächster Nachbar, Silhouette geglättet), liegt dabei hinter dem Rumpf; wo ein Flügel den Rumpfrand freigibt, bekommt die freie Kante den dunklen Umriss (27,27,27).
* Schwebe-Bob je Vogel zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12), gegeneinander um einen Frame verschoben (A 0, B +1, C −1; die Ruhestufe dauert 3 Frames, Frame 0 bleibt Original).
* Blinzeln einmal pro Schleife je Vogel zu verschiedener Zeit (3 Frames: A 14–16, B 36–38, C 26–28), das Lid ist die Kopffarbe (45,45,45).
* Kein Glanz, kein Feuer, keine Partikel; die weißen Zähne bleiben stehen.

Ergänzungen: keine nötig — die Flügel sitzen außen am Rumpf, nichts Verdecktes wird sichtbar.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Drehung gibt Rumpfkanten frei, F.umranden setzt dort den Umriss (27,27,27); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 14, 14, 14, 14                   # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('man-eater-birds')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS_DUNKEL = (27, 27, 27)
KOPF = (45, 45, 45)                                           # Kopffarbe (Lid)
AUGE_FARBEN = [(119, 119, 0), (255, 255, 27)]

PHI_C, PHI_A = 5.5, 74.5                                      # Flügelhöhe in Grad über der Waagerechten: −69° … +80°
n_, lab = cv2.connectedComponents(vorhanden.astype(np.uint8), connectivity=8)
assert n_ == 4, n_
BIRDS = [
    dict(name='A', auge=(10, 7), phi_orig=56.0, richtung=+1, bob_v=0, blinz=(14, 15, 16), pivot=(18.5, 8.0),
         fluegel=lambda x, y: (y <= 7) & (x >= 16)),
    dict(name='B', auge=(39, 17), phi_orig=-69.0, richtung=+1, bob_v=+1, blinz=(36, 37, 38), pivot=(47.0, 21.5),
         fluegel=lambda x, y: (y >= 22) & (x >= 43) & (x <= 50)),
    dict(name='C', auge=(4, 39), phi_orig=76.0, richtung=+1, bob_v=-1, blinz=(26, 27, 28), pivot=(12.5, 37.5),
         fluegel=lambda x, y: (y <= 37) & (x >= 9)),
]
for b in BIRDS:
    ax, ay = b['auge']
    assert tuple(spr[ay, ax, :3]) == (255, 255, 27), b['name']
    b['maske'] = lab == lab[ay, ax]
    b['fl'] = b['maske'] & b['fluegel'](xx, yy)
    b['rumpf'] = b['maske'] & ~b['fl']
    b['eyes'] = [(int(x), int(y)) for y, x in np.argwhere(b['maske'] & L.farbmaske(spr, AUGE_FARBEN))]
    assert len(b['eyes']) == 2, b['eyes']
    c = (b['phi_orig'] - PHI_C) / PHI_A
    assert -1.0 - 1e-9 <= c <= 1.0 + 1e-9
    b['phi0'] = math.acos(max(-1.0, min(1.0, c)))             # Frame 0 = Stellung der Karte, danach zunächst nach unten (B ist ganz unten)


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


for b in BIRDS:
    b['P_fl'], b['P_rumpf'] = ebene(b['fl']), ebene(b['rumpf'])
    b['piv'] = (PAD_L + b['pivot'][0], PAD_T + b['pivot'][1])
assert (L.zusammen(H, W, [(p, 0, 0) for b in BIRDS for p in (b['P_fl'], b['P_rumpf'])])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
UMRISS = F.umriss_farben(spr)


def bruecken8(f, start):
    """Teile, die nach dem Drehen nicht mehr (8-verbunden) am Hauptteil hängen, bekommen Umrisspixel entlang der kürzesten Strecke."""
    for _ in range(8):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)
        if n <= 2:
            break
        hl = lab_[start[1], start[0]]
        hp = np.argwhere(lab_ == hl)
        best = None
        for k in range(1, n):
            if k == hl:
                continue
            cp = np.argwhere(lab_ == k)
            d = np.abs(cp[:, None, :] - hp[None, :, :]).max(axis=2)
            i, j = np.unravel_index(int(d.argmin()), d.shape)
            if best is None or d[i, j] < best[0]:
                best = (int(d[i, j]), cp[i], hp[j])
        _, a, b = best
        y, x = int(a[0]), int(a[1])
        while max(abs(b[0] - y), abs(b[1] - x)) > 1:
            y += int(np.sign(b[0] - y))
            x += int(np.sign(b[1] - x))
            f[y, x, :3] = UMRISS_DUNKEL
            f[y, x, 3] = 255
    return f


def bird_ebenen(b, i, effekte=True):
    """Ebenen eines Vogels in Frame i: [(Ebene, dx, dy)] inkl. Bob; Flügel hinten, Rumpf vorn."""
    ph = 2 * math.pi * i / 12.0
    ph2 = ph + 0.3 * math.sin(ph + b['phi0'])                  # Abschlag etwas schneller als Aufschlag
    ph2 -= 0.3 * math.sin(b['phi0'])                           # Frame 0 = Ruhelage
    phi = PHI_C + PHI_A * math.cos(ph2 + b['phi0'])
    delta = phi - b['phi_orig']                                # + = Flügel hebt sich (gegen den Uhrzeigersinn)
    t = i - b['bob_v']
    bob = -int(round(2 * (1 - math.cos(2 * math.pi * t / 12.0)) / 2))      # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    fl = F.drehen(b['P_fl'], b['piv'][0], b['piv'][1], -math.radians(delta), glatt=True)
    rumpf = b['P_rumpf'].copy()
    if effekte and i in b['blinz']:
        for (x, y) in b['eyes']:
            rumpf[PAD_T + y, PAD_L + x, :3] = KOPF
    ganz = L.zusammen(H, W, [(fl, 0, 0), (rumpf, 0, 0)])
    ys, xs = np.nonzero(rumpf[..., 3])
    start = (int(xs[len(xs) // 2]), int(ys[len(ys) // 2]))
    mit = bruecken8(ganz.copy(), start)
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(ganz[..., 3] > 0)
    brk[neu] = mit[neu]
    return [(a, 0, bob) for a in (brk, fl, rumpf)]


def frame(i, partikel=True, effekte=True):
    ebenen = []
    teile = []
    for b in BIRDS:
        e = bird_ebenen(b, i, effekte)
        ebenen += e
        teile += [L.versetze(a, dx, dy) for a, dx, dy in e[:2]]
    f = L.zusammen(H, W, ebenen)
    F.umranden(f, teile, UMRISS, UMRISS_DUNKEL, UMRISS_DUNKEL, UMRISS_DUNKEL)             # Randpixel-Test (Regel 16)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('man-eater-birds', 'Man-Eater Birds', frames, MS, prev)
    if prev:
        L.streifen(prev + '/man-eater-birds-strip.png', frames, spalten=8, scale=5)
