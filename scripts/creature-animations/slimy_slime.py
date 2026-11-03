# -*- coding: utf-8 -*-
"""Idle-Animation für „Slimy Slime“ (Creature) — der grüne Schleim. Runde 3: er HÜPFT (Hocke → Absprung → Flug → Landung) statt breiter zu werden.

Nutzerkorrektur (wörtlich): „Slimy [sollte bouncen statt breiter zu werden]. Die früheren Slimes wie Hardy waren besser animiert.“ — Maßstab: hardy_slime.py, rocky_slime.py, infinitely_reproducing_slime.py.

Quelle: src/slimy-slime.png (18×14 px, 11 Farben, deckend).
PICK: [["Motive", 471, "ganze Ebene (Pfütze)"], ["Motive", 472, "Figur 1"]]   Ebene 472 „Slimy Slime“ (16×11, Kopf/Oberkörper) + Ebene 471 „Ebene #551“ (18×5, die untere Körperhälfte/Pfützensaum;
im Spiel halbtransparent) — zusammengesetzt mit anim_slime.ebenen_sprite([(471, None), (472, None)], 'slimy-slime'): die Pfütze liegt unten, der Kopf darüber, beide hier voll deckend (Regel 22).
Die Kartenkunst Slimy_Slime.png zeigt die Figur auf Maßstab 2.

Aufruf:   python3 slimy_slime.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slimy-slime.png + .json

Was im Sprite ist (x, y im 18×14-Sprite):
* Körper: grüner Schleim in Stufen B/C/D/E/F/G (Rampe (106,167,87)…(160,204,147)), dunkelgrüner Umriss A (41,65,0), schwacher Aufheller G/J oben Mitte (7–10, 2–4) und am Saum G unten.
* Augen: je 2×2 dunkles H/J (45,50,44) mit weißem Lichtpunkt K (242,253,239): links (5,5)(6,5)(5,6)+K(6,6), rechts (11,5)(12,5)(12,6)+K(11,6); Mund: dunkles I/H (21,66,9)/(46,89,33) y 8–9 (x 6–12).
* Saum/Pfütze (y 10–13): breiter Fuß, zwei Randzipfel A bei (0,10) und (17,10).
Material: Schleim — KEIN Glanz (Regel 14).

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos; Frame 0 = Original), Hüpfen wie bei Hardy/Rocky/Infinitely Reproducing Slime (anim_hupf.py):
* Großer Sprung (Frames 3–22, 5 px hoch): Hocke (Körperzeilen 7 und 2 — Wangen und Stirn, nie Augen/Brauen/Mund — werden entfernt, der Schleim wird 2 Zeilen niedriger, aber NICHT breiter), Absprung
  (gestreckt: Zeilen 7 und 2 werden mit Texturmischung der Nachbarzeile eingefügt, Gesichtsfarben gesperrt, bis +3 Zeilen), Flug (1–5 px über dem Boden, Parabel, Scheitel 3 Frames), Aufprall
  (tiefste Hocke), Nachfedern. Kleiner Sprung (Frames 27–38, 3 px hoch). Dazwischen Ruhe mit einem kurzen Einatmen (Wangenzeile 7 einmal doppelt).
  Der Sockel (Zeilen 9–13) wird nie verformt.
* Blinzeln (zweimal je Schleife, Frames 24–25 und 42–43, in der Ruhe am Boden): die dunklen Augen und Lichtpunkte werden zu Körpergrün D (97,163,76) (Lid in Körperfarbe).
* Schleimbläschen (Partikel): vier runde Bläschen (2×2 → 4×4 → 2×2, Farben G/E des Sprites) steigen langsam links und rechts neben der Pfütze auf (nicht mehr über dem Kopf, damit der Schleim beim Sprung
  nicht hindurchfährt); sie berühren den Körper nie.
Ergänzungen: wo ein Randpixel durch Stauchen/Strecken ohne Umriss frei liegt, wird die Kontur in A=(41,65,0) geschlossen (kontur_schliessen). Frame 0 = Original (Bläschen ausgenommen).
"""
import sys

import numpy as np

import anim_amorph as A
import anim_eis as E
import anim_humanoide as Hm
import anim_hupf as Hu
import anim_lib as L

N, MS = 48, 65
TEST_EBENEN = ('koerper',)

spr = L.lade('slimy-slime')
sh, sw = spr.shape[:2]
ERLAUBT = Hm.umrissfarben(spr)
AUGEN = [(5, 5), (6, 5), (5, 6), (6, 6), (11, 5), (12, 5), (11, 6), (12, 6)]
SPERRE = ((45, 50, 44), (242, 253, 239), (21, 66, 9), (46, 89, 33))
D_ = (97, 163, 76)
G_, E_ = (160, 204, 147), (136, 204, 118)

# ── Posen (Zeilen löschen, Zeilen verdoppeln, Spalten p je Seite): nur Zeilen 2 (Stirn) und 7 (Wangen) ändern sich, Breite nie ──
POSEN = {
    'R': ((), {}, 0),
    'D1': ({7}, {}, 0),
    'D2': ({7, 2}, {}, 0),
    'D3': ({7, 2}, {}, 0),
    'T1': ((), {7: 1}, 0),
    'T2': ((), {7: 1, 2: 1}, 0),
    'T3': ((), {7: 2, 2: 1}, 0),
}
ABLAUF = Hu.ablauf(N, gross=5, klein=3)
assert ABLAUF[0] == ('R', 0)


def _zeilen(pose):
    lo, do, _ = POSEN[pose]
    return sh - len(lo) + sum(do.values())


PAD_L, PAD_R = 9, 9
PAD_T = max(_zeilen(p) + d for p, d in ABLAUF) - sh + 3
PAD_B = 3
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
BODEN = PAD_T + sh - 1


def koerper(i):
    pose, dy = ABLAUF[i]
    k, top, quelle = Hu.hupf_figur(spr, pose, dy, POSEN, {}, SPERRE, H, W, PAD_L, PAD_T, BODEN)
    if Hm.folge(i, 24, [1, 1], N) or Hm.folge(i, 42, [1, 1], N):
        # Augen suchen (Pixel mit Augenfarben) und mit Körpergrün überdecken
        for y in range(H):
            for x in range(W):
                if k[y, x, 3] and tuple(int(v) for v in k[y, x, :3]) in [tuple(c) for c in SPERRE[:2]]:
                    k[y, x, :3] = D_
    Hm.kontur_schliessen(k, ERLAUBT, (41, 65, 0))
    return k


BLASEN = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-14, off=o, form=f, wackeln=0.6, ph=p) for (x, y, vx, o, f, p) in
          [(-4, 10, 0.0, 0, 'o', 0.0), (22, 10, 0.0, 12, 'o', 0.4), (-4, 10, 0.0, 24, 'o', 0.7), (22, 10, 0.0, 36, 'o', 0.2)]]
DUNST_FARBEN = {'c': G_, 'r': E_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, BLASEN, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    A.ausdruck_pruefen(ohne, spr, 'slimy-slime')
    for i in range(N):                                       # Bläschen dürfen den Körper nie berühren (auch nicht über die Ecke)
        t = E.dunst_ebene(H, W, i, N, BLASEN, DUNST_FARBEN)[..., 3] > 0
        k = ohne[i][..., 3] > 0
        pk = np.pad(k, 1)
        nah = np.zeros_like(k)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                nah |= pk[1 + dy:1 + dy + k.shape[0], 1 + dx:1 + dx + k.shape[1]]
        if (t & nah).any():
            print('Bläschen berührt den Körper in Frame', i, [(int(x), int(y)) for y, x in zip(*np.nonzero(t & nah))][:4])
    print('Höhe über dem Boden je Frame:', [d for _, d in ABLAUF])
    L.speichern('slimy-slime', 'Slimy Slime', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slimy-slime-strip.png', frames[::2], spalten=12, scale=6)
