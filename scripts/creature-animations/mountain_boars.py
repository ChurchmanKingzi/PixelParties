# -*- coding: utf-8 -*-
"""Idle-Animation für „Mountain Boars“ (Creature) — Runde 2: der Eber LÄUFT am Ort (Laufzyklus mit vier Beinen).

Quelle: src/mountain-boars.png — ein Wildschwein (31×18 px, 9 Farben) aus MotiveSteamDwarfs.xcf, Ebene 38 „Ebene #303“. Die Ebene enthält fünf leicht unterschiedlich gezeichnete Eber
(wie auf der Karte), alle in derselben Pose (nur Schwanz/Borsten weichen ab; keine andere Beinstellung vorhanden); verwendet wird der erste (Komponente 1, oben links).
PICK: [["MotiveSteamDwarfs", 38, 1]]

Aufruf:   python3 mountain_boars.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mountain-boars.png + .json

Identifikation (Sprite 31×18, braunes Wildschwein im Profil, nach links blickend; Farben: A (57,31,33) dunkler Umriss/Borsten, B (138,72,54) Fell, C (191,111,74) helle Fellstreifen,
D (90,8,0) dunkelrote Narbe, E (93,44,40) Bauchschatten/Beinfüllung, F/I Schnauze, G (245,85,93) rosa Nasenloch/Zahnfleisch, H (32,24,0) Huf-/Beinumriss):
* Kopf (x 0–8, Zeilen 4–15): Schnauze F/I mit Hauern F (0,10) (0,11) (0,12), rosa G (2,10) (3,12); Auge = dunkle Pupille A (5,10) + helles Augenweiß F (6,10); Narbe/Braue D (3,8) (3,9).
* Rücken mit Borstenkamm (acht einzelne dunkle Borsten oben), helle Rückenlinie C, Bauchschatten E (x 11–17, Zeilen 10–13), Bauchlinie H (x 11–16, Zeile 14).
* Beine: vorderes Standbein (x 7–10, Zeilen 15–17: Umriss H, Füllung E, Huf = Fußzeile 17), hinteres Standbein (x 16–20, Zeilen 15–17, oben mit dem Oberschenkelpixel B (17,15));
  das Rumpfende (x 20–23, Zeilen 11–15: Umriss + kleiner Stumpf A/E mit Unterkante H) ist die Kruppe — ein angehobener Hinterlauf der Gegenseite.
* Schwanz: dünner dunkler Strich rechts hinten (24,10) (25–28,11) (28–29,10) (30,9). Kein Glanz (Fell, Regel 14), keine Partikel.
Bleibt fest: Kopfform, Schnauze, Hauer, Mähne, Bauchschatten, Kruppe (bis auf die Hüpfbewegung des ganzen Körpers).

Ablauf (48 Frames à 64 ms = 3,1 s), alle Bewegungen unabhängig:
* LAUFZYKLUS am Ort (Periode 16 Frames = ein ganzer Schrittzyklus, 3 Zyklen pro Schleife; 16 Beinposen, je Bein 4-Takt-Gang in diagonaler Folge: vorn nah → hinten fern → vorn fern → hinten nah):
  jedes Bein hebt ab, schwingt nach vorn (links), setzt auf und wandert am Boden nach hinten (rechts), Schrittweite ±2 px, Hub bis 2 px. Die Beine sind EIGENE Ebenen, prozedural gezeichnet
  (Füllung + neu gezogener, geschlossener Umriss in jeder Pose; anim_tier.bein_zeichnen). Die beiden Beine der Gegenseite (vorn/hinten fern) kommen neu dazu — sie liegen hinter dem Körper
  und sind in Farben des Sprites gehalten (Füllung A, Umriss H); das hintere ferne Bein ist im Original als angehobener Stumpf an der Kruppe schon angelegt.
  Der Boden bleibt: der Huf des Standbeins steht stets auf Zeile 17 (Fußlinie), nur der Fuß wandert.
* Körper wippt: 2× pro Zyklus (alle 8 Frames) hebt sich der ganze Eber 1 px (die Beine strecken sich dabei um eine Zeile), dazwischen senkt er sich in die Ruhelage des Originals.
* Borsten sträuben sich: die acht einzelnen Rückenborsten wachsen nacheinander von links nach rechts für je 4 Frames 1 px nach oben (Welle ab Frame 8 und ab Frame 30, 2 Frames Versatz je Borste).
* Schwanz wedelt: zweimal pro Schleife (Frames 4–16 und 26–38) schwingt der Schwanzstrich zweimal auf und ab (bis 2 px an der Spitze, wandernde Welle), der Ansatz am Körper bleibt.
* Blinzeln (Frames 10–13 und 33–36): das Auge (Augenweiß (6,10), Pupille (5,10)) verschwindet in der Fellfarbe B (138,72,54): erst das Augenweiß, dann beide, dann das Augenweiß wieder.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen (gemalt): die zwei Gegenseiten-Beine (vorn fern, hinten fern) samt Umriss — nicht im Original sichtbar, Farben A/H aus dem Sprite; die gesträubten Borsten sind Duplikate der vorhandenen
Borstenpixel (1 px darüber); die Beinumrisse werden in jeder Pose um die Füllung neu gezogen; Randpixel-Korrektur (Regel 16) über anim_tiere.umriss_schliessen.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_tier as G

N, MS = 48, 64
ZYKLUS = 16                                                         # Frames je Schrittzyklus (3 Zyklen pro Schleife)
START = 7                                                           # Zyklusphase von Frame 0 (beide Standbeine nahe der senkrechten Ruhestellung)
PAD_L, PAD_R, PAD_T, PAD_B = 4, 3, 5, 2

spr = L.lade('mountain-boars')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (xx >= 24) & (yy >= 9)
bein_v = vorhanden & (yy >= 15) & (xx >= 7) & (xx <= 10)                              # vorderes Standbein (Zeilen 15–17)
bein_h = vorhanden & (((yy == 15) & (xx >= 16) & (xx <= 19)) | ((yy >= 16) & (xx >= 17) & (xx <= 20)))   # hinteres Standbein
koerper = vorhanden & ~schwanz & ~bein_v & ~bein_h

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
FELL = tuple(int(v) for v in spr[10, 3, :3])                         # B (138,72,54): Fellfarbe (Lid)
BORSTE = tuple(int(v) for v in spr[0, 10, :3])                       # A (57,31,33)
BEINFUELL = tuple(int(v) for v in spr[16, 8, :3])                    # E (93,44,40): Füllung der Standbeine
HUF = tuple(int(v) for v in spr[17, 8, :3])                          # H (32,24,0): Beinumriss/Huf
OBERSCHENKEL = tuple(int(v) for v in spr[15, 17, :3])                # B: Oberschenkelpixel
FERN = BORSTE                                                        # Füllung der Gegenseiten-Beine (dunkler als die nahen)
BORSTEN = [(7, 1), (9, 1), (10, 0), (12, 1), (13, 0), (15, 1), (16, 0), (18, 1)]     # von links nach rechts
AUGE = [(6, 10), (5, 10)]                                          # Auge: weißer Fleck F (6,10) und dunkle Pupille A (5,10)

# Beine: (Zeilen-Vorlage, Hüftspalte ...) — Zeilen = (x_links, [Farben]) je Füllzeile von oben
NF = dict(zeilen=[(8, [BEINFUELL, BEINFUELL])], ecke='L')                       # vorn nah, Füllung x 8–9
NR = dict(zeilen=[(17, [OBERSCHENKEL, BEINFUELL, BEINFUELL]), (18, [BEINFUELL, BEINFUELL])], ecke='R')   # hinten nah
FF = dict(zeilen=[(9, [FERN, FERN])], ecke='L')                                  # vorn fern, 1 px hinter dem nahen
FR = dict(zeilen=[(19, [FERN, FERN])], ecke='R')                                 # hinten fern
# Phasenversatz je Bein im Zyklus (Viertakt, diagonale Folge): vorn nah, hinten fern, vorn fern, hinten nah
VERSATZ = {'NF': 0.0, 'FR': 0.25, 'FF': 0.5, 'NR': 0.75}
HEBEN = [0, 0, 1, 1, 1, 0, 0, 0]                                   # Wippen (Periode 8): 1 = der Körper ist 1 px höher


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def bein_pose(i, name):
    dx, lift = G.gang((i + START) / ZYKLUS - VERSATZ[name])
    return G.runde(dx), int(round(lift))


def schwanz_wedeln(t, u, dy0):
    """Schwanzstrich (Spalten 24–30): jede Spalte wandert senkrecht, je weiter vom Körper desto mehr (bis 2 px), zweimal auf/ab; ohne Ausschlag (u=None) wie im Original."""
    if u is None:
        return t
    out = L.leer(H, W)
    for x in range(PAD_L + 24, PAD_L + 31):
        ys_ = np.nonzero(t[:, x, 3])[0]
        if not len(ys_):
            continue
        f = (x - (PAD_L + 24)) / 6.0
        dy = int(round(2.2 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.8 * f)))
        for y in ys_:
            out[y + dy, x] = t[y, x]
    return out


def zustand(i):
    gestr = [any(s + 2 * k <= i < s + 2 * k + 4 for s in (8, 30)) for k in range(len(BORSTEN))]
    lid = 0
    for s in (10, 33):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    u = None
    for a_, e_ in ((4, 16), (26, 38)):
        if a_ <= i < e_:
            u = (i - a_) / float(e_ - a_)
    return gestr, lid, u


def frame(i, nur=None):
    gestr, lid, u = zustand(i)
    b = -HEBEN[i % 8]                                              # Körper-Versatz (0 = Ruhelage, −1 = 1 px höher)
    k = teil(koerper)
    for (x, y), g in zip(BORSTEN, gestr):
        if g:
            k[PAD_T + y - 1, PAD_L + x, :3] = BORSTE
            k[PAD_T + y - 1, PAD_L + x, 3] = 255
    if lid:
        for (x, y) in (AUGE[:1] if lid == 1 else AUGE):
            k[PAD_T + y, PAD_L + x, :3] = FELL
    sw_ = schwanz_wedeln(teil(schwanz), u, b)
    k = L.versetze(k, 0, b)
    sw_ = L.versetze(sw_, 0, b)
    # Beine als eigene Ebenen (Sprite-Koordinaten, Versatz PAD_L/PAD_T)
    ferne = L.leer(H, W)
    nahe = L.leer(H, W)
    for name, spec, y0, ziel in (('FF', FF, 11, ferne), ('FR', FR, 11, ferne), ('NF', NF, 15, nahe), ('NR', NR, 15, nahe)):
        dx, lift = bein_pose(i, name)
        if ziel is nahe:
            n0 = 16 - (14 + b)                                     # Füllzeilen unter dem Bauch (2 in Ruhelage, 3 gehoben)
            lift = min(lift, n0 - 1)
            G.bein_zeichnen(ziel, spec['zeilen'], 15 + b, 16 - lift, dx, HUF, spec['ecke'], PAD_L, PAD_T)
        else:
            G.bein_zeichnen(ziel, spec['zeilen'], y0 + b, 16 - lift, dx, HUF, spec['ecke'], PAD_L, PAD_T)
    ebenen = {'fern': ferne, 'koerper': k, 'schwanz': sw_, 'nah': nahe}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('mountain-boars', 'Mountain Boars', frames, MS, prev)
    if prev:
        L.streifen(prev + '/mountain-boars-strip.png', frames, spalten=12, scale=6)
