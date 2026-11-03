# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Snobbit“ (Creature) — das Schneehobbit-Gefährt (von oben/vorn gesehen). Runde 3: es RUTSCHT hoch und runter.

Nutzerkorrektur (wörtlich): „Snobbit sollte hoch und runter sliden.“

Quelle: src/slippery-snobbit.png (13×17 px, 17 Farben, deckend).
PICK: [["Motive", 801, 1]]      Ebene „Snobbit“ (xcf Motive, 13×17, vollständig deckend). Die Nachbarebene 802 „Ebene #359“ (13×64, halbtransparente Fahrspur/Schweif, Alpha < 255) liegt in der Karte
(Slippery_Snobbit.png) über dem Snobbit und gehört nicht zur Figur; da die Figur selbst voll deckend ist, gab es hier nichts umzurechnen.

Aufruf:   python3 slippery_snobbit.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-snobbit.png + .json

Was im Sprite ist (x, y im 13×17-Sprite) — die Figur ist nicht eindeutig lesbar (Gefährt/Schlitten oder Wesen), deshalb wird nur Unstrittiges bewegt:
* ZWEI HOHE LAVENDELSÄULEN (x 1–4 und x 8–11, y 0–7): B/I/J/F (137,136,204)…(193,193,230), oben je ein schwarzer Strich N (11,7,0) bei (3, 0–1)/(9, 0–1); dazwischen grauer Steg A/D/H.
* RAHMEN (y 8–16): grau A/D/E/H (94,101,107)…(218,215,208) mit dunklem Innenrand C (46,46,54) und einem orangenen Fenster K/L/M/O/P (156,64,13)…(236,170,118) bei (3–9, 9–11);
  darunter dunkler Schlitz G (4,4,6) und ein einzelnes weißes Pixel Q (255,255,255) bei (6, 12–13) — nicht zu deuten (Zahn/Licht?) → FEST.
* FÜSSE/KUFEN: zwei Ecken A bei (1–2, 16) und (10–11, 16).
Bleibt fest: Fenster, Schlitz, weißes Pixel, Rahmen. Material: Eis/Stein/Metallrahmen matt — KEIN Glanz (Regel 14).

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* RUTSCHEN (neu): das GANZE Gefährt samt Säulen und Schneestaub gleitet ganzzahlig senkrecht über das Eis — Frames 0–11 nach unten (bis +5 px, sanft anfahrend/bremsend; in der Kartenkunst fährt es nach
  unten, die Spur liegt oben), Halt, Frames 15–30 nach oben (bis −5 px), Halt, Frames 34–47 zurück zur Mitte. Frame 0 = Original. Kein Spiegeln (von vorn gesehen), kein Verformen, keine Gehbewegung.
* Säulen wippen gegenläufig (Periode 16): die linke Säule (x 1–4, y 0–7) wächst um 1 px nach oben (Zeile 5 doppelt, Mischtextur) oder schrumpft um 1 px (Zeile 5 entfällt), die rechte gegenphasig; der Steg bleibt.
* Kufen wippen (Periode 24, abwechselnd 8 Frames): links (1–2, 16) bzw. rechts (10–11, 16) verliert die unterste Pixelzeile (Umriss darüber wird in Umrissfarbe A geschlossen) — der Rahmen kippt leicht.
* Schneestaub (5 Wölkchen ≥ 2×2, Farben H/E) stäubt hinten (oben) auf und steigt langsam auf.
Ergänzungen: Umrisspixel A (94,101,107) in Zeile 15 (x 1–2 / 10–11), wenn eine Kufe sich hebt. Frame 0 = Original (Staub ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L
import anim_rutsch as R

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 20, 7            # oben: Schneestaub + 5 px Rutschweg nach oben; unten: 5 px Rutschweg nach unten
TEST_EBENEN = ('koerper',)

spr = L.lade('slippery-snobbit')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)
yy, xx = np.mgrid[0:sh, 0:sw]
vorh = L.deckend(spr)
links = vorh & (yy <= 7) & (xx <= 4)
rechts = vorh & (yy <= 7) & (xx >= 8)
rest = vorh & ~links & ~rechts
A_ = (94, 101, 107)
H_, E_ = (218, 215, 208), (204, 200, 191)


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


R_, SL, SR = teil(rest), teil(links), teil(rechts)


def saeule(a, lev):
    if lev > 0:
        return L.streck_zeile(a, PAD_T + 5, 1)
    if lev < 0:
        return L.streck_zeile(a, PAD_T + 5, -1)
    return a


def koerper(i):
    s = math.sin(L.sinus(i, 16))
    ll = int(round(s))
    lr = -ll
    k = L.zusammen(H, W, [(R_, 0, 0), (saeule(SL, ll), 0, 0), (saeule(SR, lr), 0, 0)])
    if Hm.takt(i, 24, 4, 8):
        Hm.setze(k, {(1, 16): None, (2, 16): None}, OFF)
    if Hm.takt(i, 24, 16, 8):
        Hm.setze(k, {(10, 16): None, (11, 16): None}, OFF)
    Hm.kontur_schliessen(k, ERLAUBT, A_)
    return k


STAUB = [dict(x=PAD_L + x, y=PAD_T + 0 + dy, vx=vx, vy=-12, off=o, form=f, wackeln=1.0, ph=p) for (x, dy, vx, o, f, p) in
         [(1, -1, -1.5, 0, 'm', 0.0), (10, 0, 1.5, 10, 'o', 0.3), (5, -2, -0.5, 20, 'o', 0.6), (8, 0, 1.0, 29, 'm', 0.1), (3, -1, -1.0, 39, 'm', 0.8)]]
STAUB_FARBEN = {'c': H_, 'r': E_}


# Rutschen senkrecht: 0 → +5 (nach unten), Halt, +5 → −5 (nach oben), Halt, −5 → 0
BAHN, _SPIEGEL = R.pfad(N, [('fahrt', 5, 12), ('halt', 3), ('fahrt', -5, 16), ('halt', 3), ('fahrt', 0, 14)])


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, STAUB, STAUB_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return R.verschieben(L.zusammen(H, W, ebenen), BAHN[i], False, achse='y')


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    print('Versatz (y) je Frame:', BAHN)
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'snobbit')
    L.speichern('slippery-snobbit', 'Slippery Snobbit', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slippery-snobbit-strip.png', frames[::2], spalten=12, scale=6)
