# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Skeleton“ (Creature).

Quelle: src/deepsea-skeleton.png — Ebene „Skeleton“ (29×19 px, 265 Pixel, 5 Farben) aus MotiveDeepsea.xcf (Ebene 320; in der Kartenkunst im Maßstab 2:1 und blau getönt, deshalb
vom Treffer-Suchlauf nur als „getönt“ geführt; ich habe die Ebene direkt aus dem Dump genommen: alle Pixel deckend (Alpha 255), nichts fehlt).
PICK: [["MotiveDeepsea", 320, 1]]

Aufruf:   python3 deepsea_skeleton.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-skeleton.png + .json

Was ist was (x/y im Sprite):
* Ein FISCHSKELETT, das nach rechts schwimmt (Kopf rechts): Gräten und Schwanz in Teal (77,137,154)/(51,93,119) mit dunkelblauem Umriss (13,16,49) (132 Pixel).
* Schwanzflosse (x 0–7, y 0–8): zwei schräge Lappen; Wirbelsäule: schräge Linie von (4,4) nach rechts unten; Rippen: senkrechte Gräten bei x 10–21 (y 3–16), nach rechts länger;
  Kopf (x 22–28, y 7–15) mit dem Schädeldach (22–26, 8–11) und einer leuchtenden Köderlampe: 2×2 Pixel in hellem Seegrün (159,222,211) bei (27–28, 9–10) (Tiefsee-Leuchtorgan, kein Auge).
* Zwei einzelne Pixel (25–26, 6) und (25, 17) gehören zu Flossen/Kopf (im Sprite nicht verbunden, bleiben bei ihrem Teil).
Fest bleiben: Gräten- und Umrissform, die Lampe als 2×2-Block (sie wechselt nur die Helligkeit).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel ausgenommen):
* Schwimmwelle in drei STARREN Teilen (die Gräten bestehen aus 1-px-Linien; eine Spaltenscherung würde sie zerreißen, die Teilung bei x 6 / x 20 hält jede Kombination 4-verbunden —
  vorab für alle Versätze bis ±2 px geprüft): Schwanz (x < 6) schlägt ±2 px senkrecht, Körper (x 6–19) ±1 px 3 Frames später, Kopf (x ≥ 20) ±1 px 6 Frames später (Periode 24, also
  zweimal pro Schleife; die Welle läuft vom Schwanz zum Kopf), jeweils so versetzt, dass Frame 0 genau das Original ist. Dazu treibt das ganze Skelett langsam senkrecht ±1 px
  (Periode 48) und waagerecht 0/1 px (Periode 48, zweistufig).
* Köderlampe pulsiert weich in drei Stufen (hell → Schachbrett aus hell/teal → teal → Schachbrett → hell), Periode 16 (dreimal pro Schleife); nur die zwei Farben der Lampe/Gräten.
  Kein Glanz, keine Sterne (Regel 14: Knochen sind kein Metall; Lampe = Leuchten, kein Edelstein-Glitzer).
* Blasen und Leuchtstaub (Partikel, hinter dem Skelett, 8 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen k, o): runde Blasen (Kern (159,222,211),
  Rand (77,137,154)) steigen vom Kopf und vom Schwanz auf; hellgrüne Funken an der Lampe. Alle Farben aus dem Sprite, rund, nicht kreuzförmig.
Regel 15 entfällt (kein Feuer). Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (13,16,49)) in jeder Pose; im Ruhebild nichts.
ERGÄNZUNG: keine gemalten Pixel. Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel vergrößern ihn höchstens 2 px über den Figurenrand hinaus,
dazu 1 px leerer Rand). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 7, 7, 7, 7

spr = L.lade('deepsea-skeleton')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (13, 16, 49)
HELL, TEAL = (159, 222, 211), (77, 137, 154)
LAMPE = [(27, 9), (28, 9), (27, 10), (28, 10)]
assert all(col(x, y) == HELL for (x, y) in LAMPE) and KONTUR in UMRISS

schwanz = vorhanden & (xx < 6)
koerper = vorhanden & (xx >= 6) & (xx < 20)
kopf = vorhanden & (xx >= 20)
assert (schwanz | koerper | kopf).sum() == vorhanden.sum()

BLASE = {'c': HELL, 'r': TEAL}
FUNKE = {'c': HELL, 'r': HELL}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS_BLASE = [
    dict(x=P(24, 6)[0], y=P(24, 6)[1], vx=1, vy=-7, off=0, form='o', wackeln=1),            # vom Kopf
    dict(x=P(22, 14)[0], y=P(22, 14)[1], vx=1, vy=-8, off=24, form='o', wackeln=1),
    dict(x=P(2, 9)[0], y=P(2, 9)[1], vx=-1, vy=-8, off=12, form='o', wackeln=1),            # vom Schwanz
    dict(x=P(12, 2)[0], y=P(12, 2)[1], vx=0, vy=-5, off=36, form='o', wackeln=1),           # über dem Rücken
]
PUFFS_FUNKE = [
    dict(x=P(29, 9)[0], y=P(29, 9)[1], vx=2, vy=-6, off=6, form='k', wackeln=1),            # an der Lampe
    dict(x=P(28, 12)[0], y=P(28, 12)[1], vx=2, vy=-7, off=22, form='k', wackeln=1),
    dict(x=P(28, 8)[0], y=P(28, 8)[1], vx=1, vy=-6, off=34, form='k', wackeln=1),
    dict(x=P(6, 14)[0], y=P(6, 14)[1], vx=-1, vy=-7, off=42, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def welle(i, amp, lag, per=24):
    """senkrechter Versatz in ganzen Pixeln; am Frame 0 genau 0 (der Wert bei i = 0 wird abgezogen)"""
    f = lambda t: math.sin(2 * math.pi * (t - lag) / per)
    return int(round(amp * (f(i) - f(0))))


def frame_gross(i, nur=None):
    dy_s, dy_k, dy_h = welle(i, 1.6, 0), welle(i, 0.8, 3), welle(i, 0.9, 6)
    drift_y = int(round(1.0 * math.sin(2 * math.pi * i / 48)))          # 0 bei Frame 0
    drift_x = U.stufe(i, 48, 1)                                          # 0/1
    lam = teil(kopf)
    ph = i % 16                                                          # Lampe: 0 hell, 1 Schachbrett, 2 teal
    stufe = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 2, 8: 2, 9: 2, 10: 1, 11: 0}.get(ph, 0)
    for k, (x, y) in enumerate(LAMPE):
        dunkel = stufe == 2 or (stufe == 1 and (x + y) % 2 == 1)
        if dunkel:
            lam[GPT + y, GPL + x, :3] = TEAL
    koerper_ges = L.zusammen(H, W, [(teil(schwanz), drift_x, drift_y + dy_s), (teil(koerper), drift_x, drift_y + dy_k), (lam, drift_x, drift_y + dy_h)])
    koerper_ges = U.kontur_schliessen(koerper_ges, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper_ges
    blasen = _glut(H, W, i, N, PUFFS_BLASE, BLASE)
    funken = _glut(H, W, i, N, PUFFS_FUNKE, FUNKE)
    return L.zusammen(H, W, [(blasen, 0, 0), (funken, 0, 0), (koerper_ges, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('deepsea-skeleton', 'Deepsea Skeleton', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-skeleton-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
