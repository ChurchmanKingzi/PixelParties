# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Thaw Blader“ (Creature) — der Schneemann mit Fasshelm und der glühend heißen Zackenklinge.

Quelle: src/mischief-militia-thaw-blader.png (23×34 px) — aus DREI Ebenen zusammengesetzt (von Hand, creature_show.py findet nur den Schneemann):
PICK: [["MotiveRussia", 53, 2], ["MotiveRussia", 52, "ganze Ebene"], ["MotiveRussia", 51, "ganze Ebene"]]
  Ebene 53 (Figur 2 = Schneemann mit Fasshelm, Karte (19,29)) + Ebene 52 (graues Schwert mit Parierstange/Griff, Karte (29,11)) + Ebene 51 (rote Zackenklinge (255,0,0) über dem Schwert, Karte (33,11)).
  Die Lage der Ebenen zueinander ist per Abgleich mit data/card-art/native/Mischief_Militia_Thaw_Blader.png bestimmt (Ebene 51: 102 von 102 Pixeln deckungsgleich, Ebene 52 Griff 48 von 48).
  Nicht übernommen: Ebene 50 (großer roter, halbtransparenter Glutschein hinter der Klinge, Alpha < 255) und der Rotor-Schneemann rechts oben in der Ebene 53 (anderer Kartenteil).

RUNDE 3 (Nutzer-Feedback): „die eigentliche Klinge ist unter einer Schicht Rot verdeckt – das Rot in der Vorlage ist halbtransparent, um Hitze zu signalisieren, NICHT komplett opak!
Außerdem soll von der heißen Klinge Hitze ausgehen und keine Kaltluft-Particles.“
  * Die rote Ebene 51 hat in der xcf nur 35 % Deckkraft (Ebenen-Opazität 89/255) und liegt über dem GRAUEN Schwert der Ebene 52. Der Sprite enthält deshalb jetzt das graue Schwert (dunkler Umriss (57), helle Mittellinie (181),
    helle Zackenkerne (204/232)) mit dem Rot als feste, auf die Spielpalette gerastete Mischfarbe (E.mische): Umriss = 50 % Rot, Inneres = 35 % Rot (so sieht die Karte aus). Die Klinge bleibt als Klinge lesbar.
  * Hitze: das Rot im Inneren läuft als Welle (Stufen 35/50/65/80 % Rot) von unten nach oben die Klinge hinauf; der Umriss bleibt fest dunkelrot (Kante der Klinge in JEDER Pose geschlossen).
  * Hitzeschein: ein gedithertes (Schachbrett) rotes Glühen direkt um die Klinge (Ring 1 und 2), pulsiert mit der Hitzewelle (Ersatz für die halbtransparente Ebene 50).
  * Aufsteigende Hitzewölkchen (≥ 2×2) in Orange/Gelb (Palettenfarben (255,125,0)/(255,198,28), in L.pruefe freigegeben) statt des kalten Dunstes; am Boden bleibt nur der kalte Dunst des Schneemanns (links unten).

Aufruf:   python3 mischief_militia_thaw_blader.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-thaw-blader.png + .json

Was im Sprite ist (x, y im 23×34-Sprite):
* KLINGE (x 14–22, y 0–19): graue Zackenklinge wie ein Thermometer (Umriss (57,57,57), Mittellinie x 15, Zackenkerne x 16–19 in den Zeilen 5/9/13/17), unter 35 % Rot (s. o.): Rücken x 14–16, kurze Zacken (bis x 19), je Dreiergruppe eine lange Spitze bis x 22 bei y 5/9/13/17.
* PARIERSTANGE/GRIFF (x 11–21, y 20–29): sehr dunkle Brauntöne B/M/N/O/R (6,4,4)…(57,35,35), Knauf bei y 28–29.
* HELM (x 3–11, y 19–27): runder brauner Fasshelm F/J/L (134,62,22)/(175,97,51)/(189,115,68) mit dunklem Visierschlitz D/S/T/U/W/X/Y und zwei grauen Augenpunkten V (162,165,171) bei (6,24)/(10,24).
* SCHNEEMANN (y 25–33): Schneeball G/H/I/E/P mit blauem Umriss G (85,117,169); linker Zweigarm K (104,64,32): (0,25) (1,26) (2,27).
Material: Schnee, Holz-Helm, heiße Klinge (Metall, aber KEIN Glanz-/Sparkle-Effekt gewünscht — Hitze statt Glanz), keine Flammen.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* Hitzewelle in der Klinge (Periode 24, läuft nach oben): Rotanteil des Klingeninneren 35 → 80 %.
* Hitzeflimmern der Klingenform (Periode 12, Wellenlauf von unten nach oben): die langen Zackenspitzen verlängern/verkürzen sich um 1 px (x 22…23), die kurzen Zacken wachsen gegenphasig um 1 px (x 20); eingezogen werden sie nicht (der helle Zackenkern bliebe offen).
* Schwert wiegt sich (Periode 24): die Klingenzeilen y 0–19 neigen sich bis ±1 px, Griffbereich (y ≥ 20) bleibt in der Hand; Zeilenversatz ≤ 1 px je Zeile (Klinge bleibt zusammenhängend).
* Atmen (Periode 24): die Zeile 31 des Schneeballs wird einmal doppelt eingefügt — Helm, Schwert (in der Hand) und Zweigarm steigen 1 px mit.
* Linker Zweigarm schlenkert (Periode 32): Spitze zwischen y 21 und 27, Linie 4-verbunden von der Schulter (2,27).
* Heiß: gedithertes rotes Glühen um die Klinge (pulsiert mit der Hitzewelle) + 7 aufsteigende orange/gelbe Hitzewölkchen. Kalt: 2 Wölkchen kalter Dunst am Fuß des Schneemanns (links).
Ergänzungen: Zacken-Verlängerung (Pixel in der Umrissfarbe der Klinge) und Zweigarm (K); die Blendfarben der Klinge und die Hitzefarben sind Palettenfarben. Dither-Halo und Wölkchen sind Effekt-Ebenen (nicht Teil der Figur).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 8, 12, 20, 4
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-thaw-blader')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

ROT = (255, 0, 0)
ZWEIG = (104, 64, 32)
LANG = [5, 9, 13, 17]                                             # Zeilen der langen Zackenspitzen (x 14–22)
KURZ = [4, 6, 8, 10, 12, 14, 16, 18]                              # Zeilen der kurzen Zacken (x 14–19)
UMRISS_KL = (140, 0, 20)                                          # Klingenumriss (57,57,57) unter 50 % Rot, auf die Palette gerastet
for y in LANG:
    assert all(tuple(spr[y, x, :3]) == UMRISS_KL for x in (14, 20, 21, 22)) and tuple(spr[y, 15, :3]) != UMRISS_KL
for y in KURZ:
    assert all(tuple(spr[y, x, :3]) == UMRISS_KL for x in (14, 16, 17, 18, 19)) and not spr[y, 20, 3]
# Klingeninneres (hell, halbtransparent rot überdeckt): Mittellinie x 15 (y 3–19) = grau 181, Zackenkerne x 16–17 = 204, x 18–19 = 232 (Zeilen LANG)
KERN = {}
for y in range(3, 20):
    KERN[(15, y)] = 181
for y in LANG:
    for x, g in ((16, 204), (17, 204), (18, 232), (19, 232)):
        KERN[(x, y)] = g
for (x, y) in KERN:
    assert tuple(spr[y, x, :3]) != UMRISS_KL and spr[y, x, 3]
STUFEN_ROT = (0.20, 0.35, 0.55, 0.78)                             # Rotanteil des Klingeninneren je Hitzestufe (Quelle: Ebene 51 hat 35 % Deckkraft)
RAMPE_KL = {g: [E.mische((g, g, g), ROT, f) for f in STUFEN_ROT] for g in (181, 204, 232)}
HEISS_ORANGE, HEISS_GELB = E.palette_snap((255, 125, 0)), E.palette_snap((255, 198, 28))       # Hitzewölkchen (Palettenfarben, bewusst freigegeben)
GLUT_1, GLUT_2 = (140, 0, 20), (106, 28, 20)                       # Dither-Halo (Palettenfarben, Umrissrot der Klinge bzw. dunkler)
ERLAUBT_PAL = [c for r in RAMPE_KL.values() for c in r] + [HEISS_ORANGE, HEISS_GELB, GLUT_1, GLUT_2]
BLOCK = {y + d: y for y in LANG for d in (-1, 0, 1)}              # Zackenblöcke (Umriss oben, Kern/Spitze, Umriss unten) → Mittelzeile
ARM_L = [(0, 25), (1, 26)]
E_, I_ = (214, 213, 244), (204, 204, 242)


def lauf(i, y):
    """Wellenwert −1…1 der Zeile y (läuft nach oben), 0 in Frame 0 für alle Zeilen."""
    return math.sin(L.sinus(i, 12) + 0.5 * (19 - y)) - math.sin(0.5 * (19 - y))


def hitze_stufe(i, y):
    """Hitzestufe 0…3 des Klingeninneren in Zeile y: zwei Wellen je Schleife laufen nach oben (Phase wächst mit y → Wellenberg wandert mit i nach oben), dazu ein schnelleres Flackern."""
    v = 1.5 + 1.25 * math.sin(L.sinus(i, N / 2.0, 0.55 * y)) + 0.45 * math.sin(L.sinus(i, N / 3.0, 1.9 * y + 1.0))
    return max(0, min(3, int(round(v))))


def klinge_heizen(k, i):
    for (x, y), g in KERN.items():
        Hm.setze(k, {(x, y): RAMPE_KL[g][hitze_stufe(i, y)]}, OFF)


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    klinge_heizen(k, i)
    # Hitzeflimmern: lange Spitzen ±1 px (x 21…23), kurze Zacken x 19 ±1 gegenphasig
    for y in LANG:
        d = int(round(lauf(i, y) / 1.2))
        if d >= 1:
            Hm.setze(k, {(23, y): UMRISS_KL}, OFF)
        elif d <= -1:
            Hm.setze(k, {(22, y): None}, OFF)
    for y in KURZ:
        d = int(round(-lauf(i, y) / 1.2))
        if d >= 1:
            Hm.setze(k, {(20, y): UMRISS_KL}, OFF)
        # (kein Einziehen der kurzen Zacken: das Ende (19, y) liegt über/unter dem hellen Kern der langen Zacke — er würde als offene Kante sichtbar)
    # Schwert wiegt sich: Klingenzeilen kippen (Griff ab y 20 bleibt)
    amp = 1.5
    dx = {}
    for y in range(0, 20):
        yy = BLOCK.get(y, y)                      # alle drei Zeilen eines Zackenblocks kippen gleich: sonst liegt der Umriss (Zeile darüber/darunter) neben dem Zackenkern → offene Kante
        f = (20 - yy) / 20.0
        dx[y] = int(round(amp * f * math.sin(L.sinus(i, 24))))
    for y, d in dx.items():
        Y = y + OFF[1]
        xs = [x for x in range(W) if k[Y, x, 3]]
        if d and xs:
            row = k[Y].copy(); k[Y] = 0
            for x in xs:
                k[Y, x + d] = row[x]
    # Zweigarm
    ty = 25 + int(round(2.6 * math.sin(L.sinus(i, 32))))
    if ty != 25:
        E.zweig_loeschen(k, OFF, ARM_L)
        E.zweig_zeichnen(k, OFF, (2, 27), (0, ty), ZWEIG, nur_leer=False)
    k = Hm.atmen(k, PAD_T + 31, PAD_T + 22, E.verlauf3(i, 24, 0.0, 1), 0)
    Hm.kontur_schliessen(k, ERLAUBT, (85, 117, 169))
    return k


# Hitzewölkchen (orange Rand, gelber Kern) steigen von der heißen Klinge auf: Start entlang der rechten Klingenseite / über der Spitze
HITZE = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=-15, off=o, form=f, wackeln=1.0, ph=p) for (x, y, vx, o, f, p) in
         [(15, 0, 0.0, 0, 'm', 0.0), (26, 14, 1.0, 5, 's', 0.3), (12, 12, -1.0, 11, 's', 0.6), (25, 6, 1.5, 17, 'm', 0.1),
          (13, 5, -1.5, 23, 'm', 0.8), (16, 1, 1.0, 29, 's', 0.4), (27, 10, 1.0, 35, 'm', 0.2), (11, 16, -1.0, 41, 's', 0.7)]]
HITZE_FARBEN = {'c': HEISS_GELB, 'r': HEISS_ORANGE}
# Kalter Dunst nur noch am Fuß des Schneemanns (links, weit weg von der Klinge)
DUNST = [dict(x=PAD_L + x, y=PAD_T + 32, vx=vx, vy=-10, off=o, form=f, wackeln=1.0, ph=p) for (x, vx, o, f, p) in
         [(-2, -1.5, 5, 'm', 0.0), (1, -1.0, 37, 'm', 0.7)]]
DUNST_FARBEN = {'c': E_, 'r': I_}


def halo(k, i):
    """Rotes Glühen (Dither statt Alpha) direkt um die Klinge: Ring 1 (Schachbrett, flackert alle 2 Frames) wo es heiß ist (Stufe ≥ 2), Ring 2 (jedes 4. Pixel) bei Stufe 3.
    Nur auf leere Felder, nur um den Klingenteil (Spritespalten ≥ 13, Zeilen ≤ 19 sowie die Luft über der Spitze)."""
    e = L.leer(H, W)
    belegt = k[..., 3] > 0
    klinge = np.zeros_like(belegt)
    klinge[:PAD_T + 20, PAD_L + 14:] = belegt[:PAD_T + 20, PAD_L + 14:]
    d1 = np.zeros_like(belegt); d2 = np.zeros_like(belegt)
    ys, xs = np.nonzero(klinge)
    for y, x in zip(ys, xs):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                Y, X = y + dy, x + dx
                if not (0 <= Y < H and 0 <= X < W):
                    continue
                (d1 if max(abs(dx), abs(dy)) == 1 else d2)[Y, X] = True
    for y in range(H):
        for x in range(W):
            if belegt[y, x] or y >= PAD_T + 20 or x < PAD_L + 12:
                continue
            v = hitze_stufe(i, min(19, max(0, y - PAD_T)))
            if d1[y, x] and v >= 3 and (x + y + i // 2) % 2 == 0:
                e[y, x, :3] = GLUT_1; e[y, x, 3] = 255
    return e


def frame(i, nur=None):
    ebenen = []
    k = koerper(i)
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
        ebenen.append((halo(k, i), 0, 0))
        ebenen.append((E.dunst_ebene(H, W, i, N, HITZE, HITZE_FARBEN), 0, 0))
    ebenen.append((k, 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    L.pruefe(frames, quelle=spr, erlaubt=ERLAUBT_PAL)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'thaw-blader', erlaubt=ERLAUBT_PAL)
    L.speichern('mischief-militia-thaw-blader', 'Mischief Militia - Thaw Blader', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-thaw-blader-strip.png', frames[::2], spalten=12, scale=5)
