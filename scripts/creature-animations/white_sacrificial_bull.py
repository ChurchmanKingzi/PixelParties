# -*- coding: utf-8 -*-
"""Idle-Animation für „White Sacrificial Bull“ (Creature).

Quelle: src/white-sacrificial-bull.png — der weiße Stier (37×29 px, 13 Farben) aus MotiveSteamDwarfs.xcf, Ebene 390 „White Sacrificial Bull“. Die Ebene enthält
zusätzlich den rotbehüteten Opferpriester rechts daneben (zweite Komponente, 27×30 px); er gehört zur Kartenszene, nicht zur Creature und wird nicht verwendet.
PICK: [["MotiveSteamDwarfs", 390, 1]]   (Komponente 1 der Ebene = der Stier, bbox (0,1)–(36,29))

Aufruf:   python3 white_sacrificial_bull.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/white-sacrificial-bull.png + .json

Identifikation (Sprite 37×29, weißer Stier im Profil, nach rechts blickend, dunkelbrauner Umriss B (49,24,0)):
* Körper (x 1–25, Zeilen 6–22): weiß A (246,246,246) mit grauer Schattierung C/E/D; Rücken Zeilen 5–9, Bauchlinie Zeile 21–22.
* Kopf (x 22–33, Zeilen 1–18): weiß, auf dem Kopf zwei goldgelbe Hörner J/K/M ((26,3)–(32,1)); das Auge ist als geschlossener dunkler Strich (28–30, 9) gezeichnet
  (der Stier schläft/kaut gemächlich — es gibt kein offenes Auge, also kein Blinzeln); graue Halsschatten D (22–24, 6–11); rosa Maul H/I/L (26–32, 15–17) mit Nasenloch (30,15).
* Vier Beine (Zeilen 23–28): hinten (x 2–7) und (x 8–12), vorn (x 15–19) und (x 20–25), mit dunkelgrauen Hufen F/G.
* Schwanz: schmaler weißer Streifen links hinten (x 1–2, Zeilen 12–22) zwischen zwei Umrissen, am Ende dunkle Quaste F/G (1,19)–(1,21).
Bleibt fest: Auge, Hörner, Nasenloch, Rumpfumriss, Bauchlinie.

Ablauf (56 Frames à 66 ms = 3,7 s), alle Bewegungen unabhängig:
* Atmen zweistufig (Periode 28, 2× pro Schleife): erst hebt sich der Rumpf mit Rücken und Kopf (Zeile 21 wird eingefügt, Frames 3–16), 3 Frames später zusätzlich Hals und Kopf
  (Zeile 12 wird eingefügt, Frames 6–19): Kopf und Hörner steigen insgesamt 2 px, der Rücken 1 px, die Hufe bleiben am Boden. Der Schwanz wird mit gestreckt.
* Wiederkäuen: das Maul (rosa Block samt Kinnumriss, x 25–33, Zeilen 15–18) senkt sich 1 px und hebt sich wieder, 2× pro Schleife als Folge von 6 Kaubewegungen
  (Frames 8–19 und 36–47, je 2 Frames unten/oben); die Lücke wird mit der darüberliegenden Zeile geschlossen.
* Schwanz wedelt: zweimal pro Schleife (Frames 22–35 und 42–55) schwingt der Schwanzstreifen zweimal nach außen (links) bis 2 px und zurück, unten am meisten, als wandernde Welle;
  dazwischen hängt er wie im Original. Der Umriss wird danach nachgezogen (Regel 16).
* Hufe tippen: hinten außen (x 2–7) in Frames 5–6, 31–32; hinten innen (8–12) in 17–18, 44–45; vorn innen (15–19) in 11–12, 38–39; vorn außen (20–25) in 24–25, 50–51. Die Fußzeile 24
  entfällt kurz, der Huf rückt 1 px hoch.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Kein Glanz (Regel 14: die Hörner sind nur gelb eingefärbt, nicht Gold im Sinne
von Metall/Edelstein).

Ergänzungen: Randpixel-Korrektur (Regel 16): wo das Schwanzende wegschwingt, wird ein Umrisspixel (Farbe aus dem Original) am Körper bzw. Schwanz nachgezogen (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 56, 66
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 4, 2

spr = L.lade('white-sacrificial-bull')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (xx <= 2) & (yy >= 12) & (yy <= 22)
bein_maske = [vorhanden & (yy >= 23) & (xx >= a) & (xx <= b) for (a, b) in ((2, 7), (8, 12), (15, 19), (20, 25))]
koerper = vorhanden & ~schwanz
for m in bein_maske:
    koerper = koerper & ~m

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

ZEILE_A, ZEILE_B = 21, 12                     # Zeilen, an denen beim Atmen eine Zeile eingefügt wird
HUF_ZEILE = 24
HUEFE = [(5, 6, 31, 32), (17, 18, 44, 45), (11, 12, 38, 39), (24, 25, 50, 51)]
KAU_FENSTER = [(8, 20), (36, 48)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def zustand(i):
    a = 1 if (i % 28) in range(3, 17) else 0
    b = 1 if (i % 28) in range(6, 20) else 0
    kau = 0
    for s, e in KAU_FENSTER:
        if s <= i < e and ((i - s) // 2) % 2 == 0:
            kau = 1
    huf = [1 if i in h else 0 for h in HUEFE]
    return a, b, kau, huf


SCHWANZ_FENSTER = [(22, 36), (42, 56)]


def schwanz_schwingen(t, i):
    """Schwanzstreifen (Zeilen 12–22) schwingt zweimal nach links und zurück (bis 2 px, je tiefer desto weiter, wandernde Welle) — nur in zwei Wedelphasen
    je Schleife (14 Frames), dazwischen hängt er ruhig wie im Original."""
    out = L.leer(H, W)
    u = None
    for s_, e_ in SCHWANZ_FENSTER:
        if s_ <= i < e_:
            u = (i - s_) / float(e_ - s_)
    for y in range(12, 23):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        dx = 0
        if u is not None:
            f = (y - 12) / 10.0
            g = 0.5 - 0.5 * math.cos(4 * math.pi * u - 1.4 * f)
            dx = -int(round(2.3 * f * math.sin(math.pi * u) * max(0.0, g)))
        if xs_.min() + dx < 0:
            raise L.ClipError(f'Schwanzzeile {y} würde aus der Leinwand geschoben')
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    a, b, kau, huf = zustand(i)
    k = teil(koerper)
    # Wiederkäuen: Maulblock (x 25–33, Zeilen 15–18) 1 px tiefer, die Lücke füllt die Zeile darüber
    if kau:
        sl = (slice(PAD_T + 15, PAD_T + 19), slice(PAD_L + 25, PAD_L + 34))
        blk = k[sl].copy()
        k[PAD_T + 16:PAD_T + 20, PAD_L + 25:PAD_L + 34] = blk
        k[PAD_T + 15, PAD_L + 25:PAD_L + 34] = k[PAD_T + 14, PAD_L + 25:PAD_L + 34]
    sw_ = schwanz_schwingen(teil(schwanz), i)
    ebenen = {'koerper': k, 'schwanz': sw_}
    for n, m in enumerate(bein_maske):
        ebenen[f'bein{n}'] = L.heben_unten(teil(m), PAD_T + HUF_ZEILE, huf[n])
    wahl = nur or tuple(ebenen)
    teile = []
    for n in wahl:
        e = ebenen[n]
        if n in ('koerper', 'schwanz'):
            e = L.streck_zeile(e, PAD_T + ZEILE_B, b)
            e = L.streck_zeile(e, PAD_T + ZEILE_A, a)
        teile.append((e, 0, 0))
    ganz = L.zusammen(H, W, teile)
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('white-sacrificial-bull', 'White Sacrificial Bull', frames, MS, prev)
    if prev:
        L.streifen(prev + '/white-sacrificial-bull-strip.png', frames, spalten=14, scale=6)
