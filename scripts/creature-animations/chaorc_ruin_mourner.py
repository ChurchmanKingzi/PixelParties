# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Ruin Mourner“ (Creature) — der trauernde Chaorc in der violetten Robe, umgeben von Totenschädeln und Knochen.

Quelle: src/chaorc-ruin-mourner.png (32×33 px, 23 Farben).
PICK: [["MotiveHawaii", 111, 1], ["MotiveHawaii", 110, 1]]      (Ebene 111 „Ruin Mourner“ (26×33 px) = die violette Figur mit den Knochen; Ebene 110 (Figur 1 = zwei Schädel, 32×17 px) liegt in der Kunst obenauf:
  Schädel 1 über dem Kopf, Schädel 2 rechts. Lage aus der Kartenkunst Chaorc_Ruin_Mourner.png (Ebene 111 bei (26,11), Ebene 110 bei (27,14)): das zusammengesetzte Bild trifft die Kunst zu 100 %.
  Nicht verwendet: die Feuerwand rechts, die Treppe links, die Kiste oben. Die Quelle ist vollständig; verdeckt ist nur der obere Teil des Gesichts unter Schädel 1 (siehe Ergänzung).
Aufruf:   python3 chaorc_ruin_mourner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-ruin-mourner.png + .json

Was im Sprite ist (x, y im 32×33-Sprite):
* SCHÄDEL 1 (x 1–21, y 1–11): großer grauweißer Schädel mit Hörnern/Knochenkrone oben (y 0–4), zwei schwarzen Augenhöhlen (9,8–9),(10,9) und (15,9),(16,8–9), Nasenloch (11–14,10) und Kiefer/Zähnen unten (y 10–11); an seiner linken Seite ein Knochenstück (x 0–5, y 11–14).
* SCHÄDEL 2 (x 17–31, y 9–19): zweiter Schädel rechts mit schwarzen Augenhöhlen (20,14–15),(21,15) und (25,14–15),(24,15); an seinem Kinn hängt eine kleine Wirbelsäule/ein Knochen schräg nach links unten (x 20–24, y 20–23).
* CHAORC (x 3–19, y 11–25): violette Kapuzenrobe in Marineblau (23,16,44)/(45,26,70) und Violett (73,39,107)/(103,52,142)/(129,67,173), Gesicht (x 6–17, y 12–16) mit zwei hellblauen Augen
  (184,255,255)/(91,255,255) bei (9,12),(9,13) und (16,12); schwarze Punkte (11,13),(14,13); graue Gürtel/Rippenbänder (40,40,40)…(176,176,176) quer über den Bauch (x 6–16, y 17–21).
* KNOCHEN: ein Knochenstück hängt links unten von der Robe (x 2–6, y 23–28), ein gekreuztes Knochenpaar schwebt darunter (x 8–16, y 27–32, eigene Insel).
Metall/Edelstein: nichts → KEIN Glanz (Knochen, Stoff; Regel 14). Kein Feuer, keine Partikel.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Ebenen: Robe, Schädelgruppe, Wirbel, linkes Knochenstück, Kreuzknochen):
* Atmen der Robe (Periode 24, zweimal pro Schleife): die Robenzeile 22 wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf, Brust und Gürtel steigen 1 px, der Saum (y 23–25) bleibt.
* Schädelgruppe schwebt (Periode 16, dreimal pro Schleife): beide Schädel samt Kronenknochen steigen starr um 1 px und sinken wieder (Heben/Senken); die frei werdende Zeile 11 unter dem Kiefer wird mit dem dunklen Marineblau der Kapuze (23,16,44) gefüllt, solange die Robe darunter nicht mitgestiegen ist.
* Wirbel am Kinn von Schädel 2 pendelt (Periode 12, viermal pro Schleife): Zeilen 20–23 wandern waagerecht (Gelenk Zeile 19, Spitze bis ±2 px), er hängt am Schädel und bobbt mit ihm.
* Linkes Knochenstück an der Robe pendelt (Periode 16 versetzt): Zeilen 24–28 wandern waagerecht (Gelenk Zeile 23, Spitze bis ±2 px), Zeile 23 bleibt an der Robe.
* Kreuzknochen schweben (Periode 24 versetzt): sie sinken von der Ruhelage 0 → 1 px nach unten (nur nach unten, damit sie sich nicht an die Robe heften) und zurück.
* Blinzeln der drei hellblauen Augenpixel (Frames 21–23 und 41–43): sie nehmen das Marineblau (45,26,70) der Kapuze an (Lid = Umgebungsfarbe).
Frame 0 = Original (Ruhepose); Kontrolle: anim_humanoide.ruhepose. Randpixel-Test (Regel 16): Kontur in Umrissfarbe, zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: Zeile 11, x 7–16 in (23,16,44) während der Schädelhub oben ist und die Robe unten (Kapuze unter dem Kiefer); sonst keine.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_untote as U

N, MS = 48, 70
GP = 6

spr = L.lade('chaorc-ruin-mourner')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (49, 24, 0)
MARINE, DUNKEL_I = (23, 16, 44), (45, 26, 70)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


PUR = {(23, 16, 44), (103, 52, 142), (73, 39, 107), (45, 26, 70), (129, 67, 173), (184, 255, 255), (91, 255, 255), (13, 0, 0)}
BRAUN = {(49, 24, 0), (35, 17, 5), (58, 37, 23)}
purpur = np.array([[bool(vorhanden[y, x]) and f(x, y) in PUR for x in range(sw)] for y in range(sh)])
grau = vorhanden & ~purpur
# Robe: violette Pixel (y ≥ 11), die dunklen Bauchbänder (y 16–22, x 5–17) und die schwarzen Gesichtspunkte
robe = purpur & (yy >= 11)
robe |= grau & (yy >= 16) & (yy <= 22) & (xx >= 5) & (xx <= 17)
robe |= vorhanden & (yy >= 12) & (yy <= 16) & (xx >= 6) & (xx <= 17) & (np.array([[f(x, y) == (0, 0, 0) if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)]))
kreuz = np.zeros((sh, sw), bool)
kreuz[27:, 8:17] = True
kreuz &= vorhanden & grau | (kreuz & vorhanden & ~robe)
kreuz &= vorhanden
knochen_l = vorhanden & ~robe & (xx <= 6) & (yy >= 23) & (yy <= 28)
wirbel = vorhanden & ~robe & ~kreuz & (xx >= 20) & (xx <= 24) & (yy >= 20) & (yy <= 23)
schaedel = vorhanden & ~robe & ~kreuz & ~knochen_l & ~wirbel
assert (robe | kreuz | knochen_l | wirbel | schaedel).sum() == vorhanden.sum()
assert not (robe & schaedel).any() and not (robe & knochen_l).any() and not (kreuz & robe).any()

AUGEN = [(9, 12), (9, 13), (16, 12)]
for p in AUGEN:
    assert f(*p) in ((184, 255, 255), (91, 255, 255))


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    # Robe: Blinzeln, Atmen
    r = teil(robe)
    if Hm.folge(i, 21, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(r, {p: DUNKEL_I for p in AUGEN}, OFF)
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        r = L.streck_zeile(r, GP + 22, b)
    # Schädelgruppe schwebt starr 0/−1
    sk = -1 if Hm.welle01(i, 16, 0.0) > 0.55 else 0
    s = L.versetze(teil(schaedel), 0, sk)
    if sk == -1 and not b:
        for x in range(7, 17):
            if not r[GP + 11, GP + x, 3] and not s[GP + 11, GP + x, 3]:
                r[GP + 11, GP + x, :3] = MARINE
                r[GP + 11, GP + x, 3] = 255
    # Wirbel am Kinn von Schädel 2: pendelt, hängt am Schädel
    w = L.zeilen_welle(teil(wirbel), GP + 19, 2.0, L.sinus(i, 12))
    w = L.versetze(w, 0, sk)
    # linkes Knochenstück an der Robe: pendelt
    kl = L.zeilen_welle(teil(knochen_l), GP + 23, 1.6, L.sinus(i, 16, 0.0))
    # Kreuzknochen schweben 0/+1
    kz = L.versetze(teil(kreuz), 0, 1 if Hm.welle01(i, 24, math.pi * 0.0) > 0.5 else 0)
    fr = L.zusammen(H, W, [(r, 0, 0), (kz, 0, 0), (kl, 0, 0), (s, 0, 0), (w, 0, 0)])
    return Hm.kontur_schliessen(fr, ERLAUBT, UMRISS)


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    diff = Hm.ruhepose(frames[0], spr, (BX, BY))
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('chaorc-ruin-mourner', 'Chaorc Ruin Mourner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-ruin-mourner-strip.png', frames, spalten=12, scale=5)
