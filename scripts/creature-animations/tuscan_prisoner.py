# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Prisoner“ (Creature) — der gefangene Elefantenmensch hinter den Gitterstäben: riesige graue Ohren, leuchtend cyanfarbene Augen, die Hände an den Stäben.

Quelle: src/tuscan-prisoner.png (24×25 px, 17 Farben).
PICK: [["MotiveRussia", 132, 1]]      (Ebene „Ebene #96“, Figur 1, nur in dieser Karte; die Gitterstäbe sind eine eigene Ebene (131), der Herrscher mit der Krone von hinten Ebene 130)
Abgleich mit der Kartenkunst Tuscan_Prisoner.png (76×51): Sprite sitzt dort bei (26,7). Die Stäbe (Ebene 131) verdecken 167 der 388 Pixel; von den 221 sichtbaren Pixeln stimmen 100 % mit der Kunst überein
(nächstbester Treffer 44 %). Auf der Karte stehen außerdem die Stäbe und die Krone des Aristokraten von hinten am unteren Rand: beides gehört nicht zur Figur.

Aufruf:   python3 tuscan_prisoner.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-prisoner.png + .json

Was im Sprite ist (x, y im 24×25-Sprite):
* OHREN (x 0–6 links, 17–23 rechts, y 0–12): riesige graue Ohren (91,82,83)/(124,112,112)/(161,147,144) mit schwarzem Umriss (23,21,22).
* KOPF (x 7–16, y 1–12): braungrauer Elefantenkopf (73,68,59)/(132,119,105) mit dunkler Seitenkante (47,44,38)/(18,21,20); schwarze Lidblöcke (y 7–8) und die leuchtenden AUGEN: je ein
  2-Pixel-Strich in Cyan (193,255,255) über (73,255,255) bei (9,9–10) und (14,9–10).
* ARME/HÄNDE (y 13–17): orangefarbene Hände (156,105,62)/(239,161,95)/(245,203,161) bei (3–4,13–14) und (19–20,13–15), innere Handteile bei (7–8,13–14) und (15–16,13–14), weiße Manschetten
  (225,215,217)/(189,189,189) bei (5–6,15–16) und (17–18,15–16) — die Hände halten die Stäbe.
* KÖRPER (y 13–22): dunkler Kittel mit schwarzer Mittelnaht (32,29,30)/(47,44,38), graue Seiten; Beine y 22–24 mit weißen Stiefelspitzen (225,215,217)/(189,189,189) bei (7–9,23) und (14–16,23).
Metall/Gold/Edelsteine im Sprite: keine (die Augen sind Leuchtpixel, kein Edelstein). Also kein Glanz (Regel 14), kein Farbtausch an den Augen außer dem Blinzeln. Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 125 ms = 6 s, nahtlos; bewusst langsam und traurig — Rückmeldung des Spielgestalters):
* DIE CYANFARBENEN PIXEL SIND TRÄNEN (nicht Augen): je 2 Pixel (193,255,255) über (73,255,255) unter den schwarzen Augen. Jede Träne rollt einmal pro Schleife die Wange hinab (zwei Schritte à 2 Frames),
  ist dann kurz weg und sitzt danach wieder an der Ruheposition. Links ab Frame 6, rechts ab Frame 30 (nie gleichzeitig). Nur Farben der Quelle, die Wange wird aus den Originalfarben wiederhergestellt.
* Langsames Atmen: die glatte Kittelzeile 20 wird in den Frames 4–11 einmal doppelt eingefügt (Körper, Arme, Kopf steigen 1 px, Beine bleiben); die eingefügte Zeile mischt Nachbartextur.
* Kopf sinkt: Kopf samt Ohren hängt in den Frames 18–39 um 1 px tiefer (traurig, gesenkter Kopf); der Hals wird nicht gedehnt, der Kopf schiebt sich über die Schulterzeile.
* Langsames Blinzeln (Frames 14–16 und 38–40): die oberen Augenpixel nehmen die Kopffarbe an (Lid), die untere Pixelzeile bleibt.
* Kein Kopfneigen, keine Gewichtsverlagerung, kein Fußtippen mehr; Ohren und Hände bleiben am Kopf bzw. an den Stäben.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter dem Saum).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 125
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Verlagerung/Ohr/Arm ±1 px seitlich, Kopfhub 2 px oben, Randabstand ≥ 2

spr = L.lade('tuscan-prisoner')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


ERLAUBT = Hm.umrissfarben(spr)                                      # Farben der Außenkante im Original (Regel 16)
KOPF = f(10, 10)                                                    # Kopffarbe um die Augen: Lid = umgebende Körperfarbe
UMRISS = (23, 21, 22)                                                 # Umrissschwarz der Quelle
TRAENE_OBEN, TRAENE_UNTEN = f(9, 9), f(9, 10)                          # (193,255,255) über (73,255,255)
LID = [(9, 7), (10, 7), (13, 7), (14, 7)]                              # obere Zeile der schwarzen Augenblöcke (y 7–8)

ohr_l = vorhanden & (xx <= 6) & (yy <= 12)
ohr_r = vorhanden & (xx >= 17) & (yy <= 12)
arm_l = vorhanden & (xx <= 8) & (yy >= 13) & (yy <= 17)
arm_r = vorhanden & (xx >= 15) & (yy >= 13) & (yy <= 17)
fuss_l = vorhanden & (xx <= 10) & (yy >= 23)
fuss_r = vorhanden & (xx >= 13) & (yy >= 23)
rumpf = vorhanden & ~ohr_l & ~ohr_r & ~arm_l & ~arm_r & ~fuss_l & ~fuss_r
kopf_m = rumpf & (yy <= 12)
unterkoerper = rumpf & (yy > 12)


def ebene(m, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T + dy)


def traene(i, start):
    """Tränen-Phase im Frame i für eine Träne, die in Frame `start` zu rollen beginnt: 0 = Ruhe, 1/2 = fällt, 3 = weg."""
    k = (i - start) % N
    if k < 2:
        return 1
    if k < 4:
        return 2
    if k < 10:
        return 3
    return 0


def frame(i):
    k, ol, orr, al, ar = ebene(unterkoerper), ebene(ohr_l), ebene(ohr_r), ebene(arm_l), ebene(arm_r)
    kopf = ebene(kopf_m)
    # --- Tränen: je Seite 2 Pixel (oben hell, unten cyan) rollen die Wange hinab; die Wange wird aus den Originalfarben wiederhergestellt ---
    for x, start in ((9, 6), (14, 30)):
        ph = traene(i, start)
        if ph == 0:
            continue
        wange = {(x, 9): KOPF, (x, 10): KOPF}
        if ph == 1:
            wange.update({(x, 10): TRAENE_OBEN, (x, 11): TRAENE_UNTEN})
        elif ph == 2:
            wange.update({(x, 11): TRAENE_OBEN, (x, 12): TRAENE_UNTEN})
        Hm.setze(kopf, wange, OFF)
    # --- langsames Blinzeln: obere Augenzeile (y 7) nimmt die Kopffarbe an ---
    if Hm.folge(i, 14, [1, 1, 1], N) or Hm.folge(i, 38, [1, 1, 1], N):
        Hm.setze(kopf, {p: KOPF for p in LID}, OFF)
    # --- Atmen (Brustzeile 20) und gesenkter Kopf ---
    brust = 1 if Hm.folge(i, 4, [1] * 8, N) else 0
    sink = 1 if Hm.folge(i, 18, [1] * 22, N) else 0
    k = Hm.atmen(k, PAD_T + 20, PAD_T + 11, brust, 0)
    ol = Hm.atmen(ol, PAD_T + 20, PAD_T + 11, brust, 0)
    orr = Hm.atmen(orr, PAD_T + 20, PAD_T + 11, brust, 0)
    kopf = Hm.atmen(kopf, PAD_T + 20, PAD_T + 11, brust, 0)
    al = Hm.atmen(al, PAD_T + 20, PAD_T + 11, brust, 0)
    ar = Hm.atmen(ar, PAD_T + 20, PAD_T + 11, brust, 0)
    if sink:
        ol, orr, kopf = L.versetze(ol, 0, 1), L.versetze(orr, 0, 1), L.versetze(kopf, 0, 1)
    fl, fr = ebene(fuss_l), ebene(fuss_r)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (al, 0, 0), (ar, 0, 0), (k, 0, 0), (ol, 0, 0), (orr, 0, 0), (kopf, 0, 0)])
    # Regel 16: Randpixel in Nicht-Umrissfarbe werden Umriss
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('tuscan-prisoner', 'Tuscan Prisoner', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tuscan-prisoner-strip.png', frames, spalten=12, scale=6)
