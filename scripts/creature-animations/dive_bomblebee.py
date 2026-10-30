# -*- coding: utf-8 -*-
"""Idle-Animation für „Dive Bomblebee“ (Creature).

PICK: [["MotiveDeepsea", 65, 1]]   — mit eigener Extraktion (wie bei Bomblebee): die Flügel haben in der Kunst Alpha 204/245 (durchscheinend)
und gingen bei creature_show.py verloren. Quelle: src/dive-bomblebee.png = die ganze Ebene 65 („Dive Bomblebee“, 39×16 px, 35 Farben)
aus MotiveDeepsea.xcf, jedes Pixel mit Alpha > 0 deckend übernommen (Alpha 204/245 → 255, RGB unverändert).

Aufruf:   python3 dive_bomblebee.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/dive-bomblebee.png + .json

Identifikation (Sprite-Koordinaten x, y; Hummel von der Seite, Kopf rechts):
* Flügel (y 0–5, x 7–32): ein großer durchscheinender Flügel, nach hinten gelegt über dem Rücken; beige (213,197,146) mit braunen Adern
  (135,100,60), hellem Rand (235,231,232) und dunklem Oberrand (47,59,59); x 12–13 in Zeile 5 sind Flügelwurzel-Adern.
* Körper (y 6–15, x 10–38): oben flauschiger beige/brauner Brustabschnitt (y 6–9, x 13–31), darunter gestreifter Hinterleib: schwarzbraun
  (20,13,0)/(24,15,0) mit goldenen Streifen (153,120,0), (255,201,0), (255,222,102); Kopf rechts (x 33–38) mit Augen
  (weiße Pixel (35,8), (34,9), (36,9)).
* Stachel: eine 1 px dünne schwarze Linie (x 0–9, y 10), geht vom Hinterleib (x 10) nach links.
* Fühler: kleiner schwarzer Bogen (35–37, 4), (34, 5), (38, 5) auf dem Kopf.
* Fest/unklar: der Fühlerbogen bleibt starr (bewegt sich nur mit dem Körper), der flauschige Brustabschnitt bleibt unverändert.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Flügelschlag: 8× pro Schleife (Periode 6 Frames); die Spalten links vom Gelenk (x < 22) wandern senkrecht (Spitze etwa −2 … +4 px),
  die Spitze hinkt nach (F.fluegel_welle); die Spalten x ≥ 22 am Rücken stehen fest, der Flügel bleibt an der Hummel angewachsen.
* Kippen (Wippe): die ganze Hummel (Körper, Flügel, Fühler) wippt um x = 24: Hinterleib hebt sich, Kopf senkt sich und umgekehrt (±2 px an den
  Enden, Periode 12 Frames), jede Spalte als Ganzes. Dazu Schwebe-Bob bis 2 px (Periode 12 Frames, andere Phase).
* Stachel wedelt: die dünne Linie schwingt mit Nachlauf bis ±2 px an der Spitze; die Stufen sind mit senkrechten Verbindungspixeln 4-verbunden gezeichnet.
* Glanz: Lichtband über die goldenen Streifen und über den Flügel (Beige → Hellgold → Weiß, zweimal pro Schleife); Streifen pulsieren; vier vierzackige
  Glitzer-Sterne (Mitte weiß, Arme hellgelb/gelb) am Flügelende, am Auge, an einem Streifen und an der Flügelvorderkante. Blinzeln (zweimal pro Schleife).
* Goldene Pollenfunken (acht kleine runde Funken und Punkte) steigen langsam auf.

Ergänzungen: keine nötig — der Flügel überdeckt im Original keinen Körper (Zeilen 0–5 nur Flügel, ab Zeile 6 nur Körper). Beim Heben des Flügels
liegt der Brustabschnitt (beige Fell) oben frei; er hat im Original keinen dunklen Umriss und bleibt so.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 8, 18, 10

spr = L.lade('dive-bomblebee')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# ── Masken ────────────────────────────────────────────────────────────────────────────────────────────────────────
fuehler = vorhanden & (yy <= 5) & (xx >= 33)
fluegel = vorhanden & (yy <= 5) & (xx <= 32)
stachel = vorhanden & (yy == 10) & (xx <= 9)
koerper = vorhanden & ~fuehler & ~fluegel & ~stachel
assert int((fuehler | fluegel | stachel | koerper).sum()) == int(vorhanden.sum())

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
SCHWARZ = (0, 0, 0)
GOLD_D, GOLD, GOLD_H, WEISS = (153, 120, 0), (255, 201, 0), (255, 222, 102), (255, 255, 255)
DUNKEL = (20, 13, 0)
GOLDR = [GOLD_D, GOLD, GOLD_H, WEISS]
FLUEGELR = [(194, 180, 136), (213, 197, 146), (239, 225, 185), (238, 229, 205), WEISS]
streifen_m = L.farbmaske(spr, [GOLD_D, GOLD, GOLD_H]) & (yy >= 7)
AUGEN = [(35, 8), (34, 9), (36, 9)]

PIVOT, MAXD = 24, 14
STERNE = [((7, 3), 3), ((35, 8), 15), ((24, 12), 27), ((31, 3), 39)]       # (x, y) im Sprite, Start-Frame; Art siehe stern_pos()


def px(x, y):
    return PAD_L + x, PAD_T + y


def puffs(liste):
    return [dict(x=px(x, y)[0], y=px(x, y)[1], vx=vx, vy=vy, off=off, form=f, wackeln=wk) for (x, y, vx, vy, off, f, wk) in liste]


POLLEN = {'c': GOLD, 'r': GOLD_D}
POLLEN2 = {'c': WEISS, 'r': GOLD_H}
PUFFS1 = puffs([(14, 3, -1, -12, 0, 'k', 1), (28, 2, 0, -12, 14, 's', 1), (8, 6, -1, -11, 24, 'k', 1), (36, 3, 1, -11, 32, 'k', 1),
                (20, 0, 0, -12, 40, 's', 1)])
PUFFS2 = puffs([(24, 1, 0, -12, 6, 'k', 1), (11, 4, -1, -11, 19, 'k', 1), (33, 2, 1, -11, 44, 'k', 1)])


def stachel_ebene(wag_ph, basis_y):
    """Stachel (schwarze 1-px-Linie, x 0–9) als Pfad zeichnen: die Spitze wedelt mit Nachlauf, Stufen werden senkrecht verbunden."""
    e = L.leer(H, W)
    ys = {}
    for x in range(10, -1, -1):
        frac = (10 - x) / 10.0
        ys[x] = basis_y + int(round(1.8 * frac * (math.sin(wag_ph - 0.9 * frac) - math.sin(-0.9 * frac))))
    for x in range(0, 10):                                    # Spalte x reicht von ihrer Höhe bis zur Höhe der Nachbarspalte (4-verbunden)
        a, b = ys[x], ys[x + 1]
        for y in range(min(a, b), max(a, b) + 1):
            e[y, PAD_L + x, :3] = SCHWARZ
            e[y, PAD_L + x, 3] = 255
    return e


def frame(i, partikel=True):
    ph = L.sinus(i, N / 8)                                    # Flügelschlag: achtmal pro Schleife (Periode 6)
    pk = L.sinus(i, N / 4)                                    # Kippen und Bob: Periode 12
    bob = int(round(-1.2 * (math.sin(pk - 1.2) + math.sin(1.2))))         # Frame 0 = Ruhe
    kipp = pk
    pivx = PAD_L + PIVOT

    kp = F.ebene(spr, koerper, H, W, PAD_L, PAD_T)
    fl = F.ebene(spr, fluegel, H, W, PAD_L, PAD_T)
    fh = F.ebene(spr, fuehler, H, W, PAD_L, PAD_T)

    # Blinzeln (zweimal pro Schleife)
    if i in (22, 23, 46, 47):
        F.setze(kp, PAD_L, PAD_T, {p: DUNKEL for p in AUGEN})

    # Glanz: goldene Streifen (Lichtband + Puls), Flügel (Lichtband)
    F.lichtband(kp, streifen_m, PAD_L, PAD_T, i, N // 2, 4, 12, GOLDR, stufen=1, breite=4.0, achse=(1.0, 0.3), kern_stufen=2)
    if i % 12 >= 3:
        for (x, y) in zip(*np.nonzero(streifen_m)[::-1]):
            if F.puls(i, N, int(x), int(y), periode=4, versatz=0.8):
                kp[PAD_T + y, PAD_L + x, :3] = F.heller(kp[PAD_T + y, PAD_L + x, :3], GOLDR, 1)
    F.lichtband(fl, fluegel, PAD_L, PAD_T, i, N // 2, 10, 12, FLUEGELR, stufen=1, breite=4.5, achse=(-1.0, 0.4), kern_stufen=2)

    # Kippen (ganze Hummel), dann Flügelschlag, dann Bob
    kp = F.spalten_kippen(kp, pivx, 2.0, kipp, MAXD)
    fh = L.versetze(fh, 0, F.kipp_dy(34, PIVOT, 2.0, kipp, MAXD))            # Fühlerbogen starr mit der Kopfspalte x = 34
    fl = F.spalten_kippen(fl, pivx, 2.0, kipp, MAXD)
    fl = F.fluegel_welle(fl, PAD_L + 22, 3.2, ph, potenz=1.2, nur_rechts=False, lauf=0.3, zusammenhang=True)
    st = stachel_ebene(L.sinus(i, N / 3), PAD_T + 10 + F.kipp_dy(10, PIVOT, 2.0, kipp, MAXD))

    pol = L.zusammen(H, W, [(L.puff_ebene(H, W, i, N, PUFFS1, POLLEN), 0, 0), (L.puff_ebene(H, W, i, N, PUFFS2, POLLEN2), 0, 0)]) \
        if partikel else L.leer(H, W)
    f = L.zusammen(H, W, [(pol, 0, 0), (st, 0, bob), (kp, 0, bob), (fh, 0, bob), (fl, 0, bob)])

    # Glitzer-Sterne (bleiben AM Objekt)
    for k, ((cx, cy), start) in enumerate(STERNE):
        stu = F.stern_stufe(i, N, start)
        if stu is None:
            continue
        if k in (0, 3):                                       # Flügel: oberste belegte Zeile der Flügelspalte
            ys = np.nonzero(fl[:, PAD_L + cx, 3])[0]
            sy = int(ys.min()) + bob
        else:                                                 # Körper: Sprite-Position + Kippen + Bob
            sy = PAD_T + cy + F.kipp_dy(cx, PIVOT, 2.0, kipp, MAXD) + bob
        F.stern(f, PAD_L + cx, sy, stu, WEISS, GOLD_H, GOLD)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('dive-bomblebee', 'Dive Bomblebee', frames, MS, prev)
    if prev:
        L.streifen(prev + '/dive-bomblebee-strip.png', frames, spalten=8, scale=5)
