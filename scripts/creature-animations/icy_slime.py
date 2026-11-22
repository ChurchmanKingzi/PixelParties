# -*- coding: utf-8 -*-
"""Idle-Animation für „Icy Slime“ (Creature) — der türkisfarbene Eiskristall-Schleim. Runde 3: er HÜPFT (bouncet) statt breiter zu werden.

Nutzerkorrektur (wörtlich): „Icy Slime sollte bouncen statt breiter zu werden.“ — Maßstab: Hardy/Rocky/Infinitely Reproducing Slime.

Quelle: src/icy-slime.png (18×18 px, 10 Farben, deckend).
PICK: [["Motive", 487, 1]]      Ebene „Icy Slime“ (xcf Motive, 18×18, Karte Icy_Slime.png zeigt ihn auf Maßstab 2 in der Mitte; keine Nachbarebene gehört zur Figur — die Ebenen 486/488 sind
Hintergrund/Nebel der Karte, Alpha < 255 bzw. 77×75). Die Quelle ist voll deckend (kein Alpha), es ist nichts umzurechnen.
(creature_show.py findet sie unter „Slime Rancher“, Treffer 14.)

Aufruf:   python3 icy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/icy-slime.png + .json

Was im Sprite ist (x, y im 18×18-Sprite):
* Körper: Eisklumpen aus Türkis in Stufen A (5,114,121) Umriss, F/H/D/C/B/E/G (Rampe bis (227,249,255)); die oberen Zipfel (y 0–6) sind gezackte Kristalle, unten (y 14–17) kleine Eisfüße.
* Gesicht: Augen = dunkle Blöcke F (29,141,145) bei (4–5, 7–9) und (12–13, 7–9) mit hellen Lichtpunkten I/J (86,179,184)/(202,249,255); Mund H (21,126,130) y 12 (x 6–11) und F y 13 (x 7–10).
  Die Augen lassen sich nicht sicher von Eiskanten trennen → KEIN Blinzeln.
Material: Eis — KEIN Glanz (Regel 14), kein Lichtband, keine Glitzersterne.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos; Frame 0 = Original), Hüpfen wie bei Hardy/Rocky/Infinitely Reproducing Slime (anim_hupf.py):
* Großer Sprung (Frames 3–22, 5 px hoch): Hocke (Körperzeilen 10, 11 und 4 werden entfernt — der Eisklumpen wird bis 3 Zeilen niedriger, aber NICHT breiter), Absprung (gestreckt: dieselben Zeilen
  werden mit Texturmischung der Nachbarzeile eingefügt, Gesichtsfarben gesperrt, ebenfalls ohne Breitenänderung), Flug (1–5 px über dem Boden, Parabel, Scheitel 3 Frames), Aufprall
  (tiefste Hocke), Nachfedern. Kleiner Sprung (Frames 27–38, 3 px hoch). Dazwischen Ruhe mit einem kurzen Einatmen (Zeile 10 einmal doppelt).
* Kalter Dunst: 6 Wölkchen ≥ 2×2 (Farben E/B des Sprites) steigen langsam seitlich neben dem Schleim auf (bleiben an ihrem Ort, der Schleim hüpft davor).
Ergänzungen: wo ein Randpixel durch Stauchen/Strecken ohne Umriss frei liegt, wird die Kontur in A=(5,114,121) geschlossen (kontur_schliessen). Frame 0 = Original (Dunst ausgenommen).
"""
import sys

import numpy as np

import anim_amorph as A
import anim_eis as E
import anim_humanoide as Hm
import anim_hupf as Hu
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43)

N, MS = 48, 65
TEST_EBENEN = ('koerper',)

spr = L.lade('icy-slime')
sh, sw = spr.shape[:2]
ERLAUBT = Hm.umrissfarben(spr)
SPERRE = ((29, 141, 145), (21, 126, 130), (86, 179, 184), (202, 249, 255))
E_, B_ = (201, 251, 252), (166, 250, 252)

# ── Posen (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite): nur Körperzeilen 4, 10, 11 (über den Augen / unter den Augen), Breite nie ──
POSEN = {
    'R': ((), {}, 0),
    'D1': ({10}, {}, 0),
    'D2': ({10, 4}, {}, 0),
    'D3': ({10, 11, 4}, {}, 0),
    'T1': ((), {10: 1}, 0),
    'T2': ((), {10: 1, 4: 1}, 0),
    'T3': ((), {10: 1, 11: 1, 4: 1}, 0),
}
ABLAUF = Hu.ablauf(N, gross=5, klein=3)
assert ABLAUF[0] == ('R', 0)


def _zeilen(pose):
    lo, do, _ = POSEN[pose]
    return sh - len(lo) + sum(do.values())


PAD_L, PAD_R = 11, 11
PAD_T = max(max(_zeilen(p) + d for p, d in ABLAUF) - sh + 3, 14)
PAD_B = 3
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
BODEN = PAD_T + sh - 1


def koerper(i):
    pose, dy = ABLAUF[i]
    k, top, quelle = TX.hupf_figur(spr, pose, dy, POSEN, {}, SPERRE, H, W, PAD_L, PAD_T, BODEN)
    Hm.kontur_schliessen(k, ERLAUBT, (5, 114, 121))
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-12, off=o, form=f, wackeln=1.0, ph=p) for (x, y, vx, o, f, p) in
         [(-5, 14, -1.0, 0, 'm', 0.0), (22, 15, 1.0, 8, 'o', 0.3), (-5, 7, -1.0, 16, 'o', 0.6), (22, 8, 1.0, 24, 'm', 0.1),
          (-5, 11, -1.0, 32, 'm', 0.8), (22, 12, 1.0, 40, 'o', 0.5)]]
DUNST_FARBEN = {'c': E_, 'r': B_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    A.ausdruck_pruefen(ohne, spr, 'icy-slime')
    # Dunst darf den Körper nie berühren (auch nicht über die Ecke)
    for i in range(N):
        t = E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN)[..., 3] > 0
        k = ohne[i][..., 3] > 0
        pk = np.pad(k, 1)
        nah = np.zeros_like(k)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nah |= pk[1 + dy:1 + dy + k.shape[0], 1 + dx:1 + dx + k.shape[1]]
        if (t & nah).any():
            print('Dunst berührt/überlappt den Körper in Frame', i, [(int(x), int(y)) for y, x in zip(*np.nonzero(t & nah))][:4])
    print('Höhe über dem Boden je Frame:', [d for _, d in ABLAUF])
    L.speichern('icy-slime', 'Icy Slime', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/icy-slime-strip.png', frames[::2], spalten=12, scale=5)
