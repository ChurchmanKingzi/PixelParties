# -*- coding: utf-8 -*-
"""Idle-Animation für „Populated Island Turtle“ (Creature).

Quelle: src/populated-island-turtle.png — die Schildkröte mit der Insel auf dem Panzer (50×31 px, 36 Farben), zusammengesetzt aus MotiveGrailWar.xcf:
Ebene 542 „Populated Island Turtle“ (Schildkröte, 48×22, bei (494,393)) + Ebene 538 „Ebene #125“ (Insel-Bewohner: totes Bäumchen, zwei Bäume, Burg und die Augen-Glanzpixel;
nur die linke Komponente, 43×24, bei (492,384)). Dieselbe Ebene 538 enthält rechts ein Segelschiff (Komponente 2) — es steht auf der Karte nicht auf der Schildkröte und wird nicht verwendet.
Die Wasserebene (541, halbtransparent blau) und die Schatten-/Nebelebenen (537, 539, 540) sowie der Mann (Ebene 536-Umfeld) gehören zur Kartenszene, nicht zur Creature.
Zwei Hilfsdateien zeigen, was unter dem anderen Teil liegt (beide auf derselben Leinwand): src/populated-island-turtle-schildkroete.png (nur die Schildkröte) und
src/populated-island-turtle-insel.png (nur die Insel-Bewohner).
PICK: [["MotiveGrailWar", 542, 1], ["MotiveGrailWar", 538, 1]]

Aufruf:   python3 populated_island_turtle.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/populated-island-turtle.png + .json

Identifikation (Sprite 50×31, grüne Meeresschildkröte im Profil, nach links blickend, mit Insel auf dem braunen Panzer):
* Kopf (x 2–13, Zeilen 14–22): hellgrün C (5,149,5) / P (6,173,6) mit dunkelgrünem Umriss B (0,71,0); zwei Augen = je 2×2 Pixel (links x 3–4, rechts x 6–7, Zeilen 16–17): schwarze Pupillenpixel
  und weiße/graue Glanzpixel (die Glanzpixel stammen aus der Insel-Ebene).
* Panzer (x 12–43, Zeilen 12–23): braun A/E/F/I in Schuppenreihen, dunkler Rand G, unten Schattenstreifen.
* Flossen: vorn zwei Lappen unter dem Kopf/Panzer (x 10–30, Zeilen 22–30), hinten eine Flosse rechts (x 36–49, Zeilen 21–27).
* Insel auf dem Panzer: totes Bäumchen (links, x 0–10, Zeilen 7–15, mit kleinem grünem Zweig), zwei Laubbäume (x 11–25, Zeilen 0–15) und eine Burg mit roten und grauen Türmen (x 25–42, Zeilen 4–15).
* Kein Glanz außer den schon gezeichneten Augenpunkten (Pflanzen/Stein/Tier, Regel 14), keine Partikel.
Bleibt fest: Kopf (bis auf die Augen), Panzer, Burg, totes Bäumchen, Baumstämme.

Ablauf (56 Frames à 66 ms = 3,7 s), alle Bewegungen unabhängig:
* Atmen (Periode 28, 2× pro Schleife; oben in Frames 3–16 und 31–44): Zeile 20 wird eingefügt — Insel, Panzer und Kopf heben sich 1 px, die Flossen bleiben im Wasser.
* Bäume wiegen sich: die Kronen (Zeilen 0–13, x 11–25) neigen sich als wandernde Welle bis ±1 px nach links/rechts (2 Wellen pro Schleife), die Stämme bleiben.
* Vorderflossen paddeln: zweimal pro Schleife (Frames 4–19 und 32–47) schwingen die Flossenzeilen 22–30 zweimal bis ±2 px hin und her, die Spitze mehr als der Ansatz.
* Hinterflosse schlägt: zweimal pro Schleife (Frames 14–29 und 42–55) wandern die Flossenspalten x 36–49 auf und ab (bis ±2 px an der Spitze).
* Blinzeln (Frames 12–15 und 38–41): die Augen (3–4 und 6–7, 16–17) verschwinden in der Kopffarbe C: erst die oberen Pixel, dann ganz, dann wieder die oberen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16): wo die Flossen oder Baumkronen eine Füllfarbe an den Rand schieben, wird ein Umrisspixel (Farbe aus dem Original) ergänzt (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 66
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 3, 2

spr = L.lade('populated-island-turtle')
tur = L.lade('populated-island-turtle-schildkroete')
ins = L.lade('populated-island-turtle-insel')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]

gruen_t = L.deckend(tur) & ((tur[..., 1].astype(int) > tur[..., 0].astype(int) + 25) & (tur[..., 1].astype(int) > tur[..., 2].astype(int) + 25))
fl_v = gruen_t & (yy >= 22) & (xx <= 30)
fl_h = gruen_t & (yy >= 21) & (xx >= 36)
t_rest = L.deckend(tur) & ~fl_v & ~fl_h
i_baum = L.deckend(ins) & (xx >= 11) & (xx <= 25) & (yy <= 13)
i_augen = L.deckend(ins) & (yy >= 16) & (yy <= 17) & (xx <= 9)
i_rest = L.deckend(ins) & ~i_baum & ~i_augen

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
KOPF = (5, 149, 5)                                                 # C: Kopffarbe (Lid)
AUGEN_OBEN = [(3, 16), (4, 16), (6, 16), (7, 16)]
AUGEN_UNTEN = [(3, 17), (4, 17), (6, 17), (7, 17)]
ZEILE = 20                                                         # hier wird beim Atmen eine Zeile eingefügt
FENSTER_V = [(4, 20), (32, 48)]
FENSTER_H = [(14, 30), (42, 56)]


def ebene(a, maske):
    t = np.zeros_like(a)
    t[maske] = a[maske]
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def burst(i, fenster):
    for s, e in fenster:
        if s <= i < e:
            return (i - s) / float(e - s)
    return None


def zustand(i):
    atem = 1 if (i % 28) in range(3, 17) else 0
    lid = 0
    for s in (12, 38):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    return atem, lid, burst(i, FENSTER_V), burst(i, FENSTER_H)


def flosse_v(t, u):
    """Vorderflossen: Zeilen 22–30 wandern waagerecht (Spitze mehr als Ansatz), zweimal hin und her, nur im Paddelfenster."""
    if u is None:
        return t
    out = L.leer(H, W)
    for y in range(22, 31):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = (y - 22) / 8.0
        dx = int(round(2.2 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.8 * f)))
        if xs_.min() + dx < 0 or xs_.max() + dx >= W:
            raise L.ClipError(f'Flossenzeile {y} würde aus der Leinwand geschoben')
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def flosse_h(t, u):
    """Hinterflosse: Spalten 36–49 wandern senkrecht (Spitze mehr als Ansatz), zweimal auf und ab, nur im Schlagfenster."""
    if u is None:
        return t
    out = L.leer(H, W)
    for x in range(PAD_L + 36, PAD_L + 50):
        ys_ = np.nonzero(t[:, x, 3])[0]
        if not len(ys_):
            continue
        f = (x - (PAD_L + 36)) / 13.0
        dy = int(round(2.4 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.6 * f)))
        for y in ys_:
            out[y + dy, x] = t[y, x]
    return out


def baeume(t, i):
    """Baumkronen (Zeilen 0–13) neigen sich als wandernde Welle: Zeile y wandert um round(1,3 · f · sin(φ − 0,5 · f)), f = Höhe über Zeile 13 / 13 (Frame 0 = Original)."""
    out = L.leer(H, W)
    ph = 2 * math.pi * i / 28.0 + 0.2
    for y in range(0, 14):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = (13 - y) / 13.0
        dx = int(round(1.3 * f * math.sin(ph - 0.5 * f)))
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    atem, lid, uv, uh = zustand(i)
    fv = flosse_v(ebene(tur, fl_v), uv)
    fh = flosse_h(ebene(tur, fl_h), uh)
    tb = ebene(tur, t_rest)
    ir = ebene(ins, i_rest)
    ib = baeume(ebene(ins, i_baum), i)
    ia = ebene(ins, i_augen)
    if lid:
        for (x, y) in (AUGEN_OBEN if lid == 1 else AUGEN_OBEN + AUGEN_UNTEN):
            ia[PAD_T + y, PAD_L + x] = 0
            tb[PAD_T + y, PAD_L + x, :3] = KOPF
            tb[PAD_T + y, PAD_L + x, 3] = 255
    ebenen = {'flosse_v': fv, 'flosse_h': fh, 'schild': tb, 'insel': ir, 'baeume': ib, 'augen': ia}
    wahl = nur or tuple(ebenen)
    teile = []
    for n in wahl:
        e = ebenen[n]
        if n not in ('flosse_v', 'flosse_h'):
            e = L.streck_zeile(e, PAD_T + ZEILE, atem)
        teile.append((e, 0, 0))
    ganz = L.zusammen(H, W, teile)
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('populated-island-turtle', 'Populated Island Turtle', frames, MS, prev)
    if prev:
        L.streifen(prev + '/populated-island-turtle-strip.png', frames, spalten=12, scale=6)
