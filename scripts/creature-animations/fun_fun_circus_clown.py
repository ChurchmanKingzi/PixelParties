# -*- coding: utf-8 -*-
"""Idle-Animation für „Fun-Fun Circus Clown“ (Creature) — der Clown mit rosa Spitzhut, bunt gescheckter Jacke und grünen Handschuhen, der mit ausgebreiteten Armen auf einem bunten Zirkusball balanciert; um ihn Konfetti und „Ta-da“-Strahlen.

Quelle: src/fun-fun-circus-clown.png (32×50 px, 47 Farben).
PICK: [["MotiveMoe", 35, 1], ["MotiveMoe", 36, 1], ["MotiveMoe", 37, 1]]
  Ebenen der Datei MotiveMoe: 37 „Fun Circus Clown #1“ (20×40 px) = Clown + Ball (Figur 1, in der Treffersuche 100 %); 35 „Fun Circus Clown #6“ = die weißen Strahlen über dem Hut (nur die obere der beiden Strahlengruppen
  gehört zum Clown, die untere sitzt über der Feuerwerksrakete der Kulisse); 36 „#5“ = acht kleine Konfettistücke (nur die um den Clown, x 218–250; die Rakete bei x 258–270 und die zwei halbtransparenten Stücke sind Kulisse/Alpha ≠ 255).
  Nicht übernommen: Ebene 39 „#7“ (Feuerwerk-Sterne) und Ebene 38 (Glüh-Kulisse). Karte: Fun_Fun_Circus_Clown.png zeigt den Clown mit Strahlen und Konfetti. Quelle vollständig.

Aufruf:   python3 fun_fun_circus_clown.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fun-fun-circus-clown.png + .json

Was im Sprite ist (x, y im 32×50-Sprite):
* STRAHLEN (weiß, x 8–23, y 0–11): ein senkrechter Doppelstrich (x 15–16, y 0–8) und zwei Schrägstriche (links (8–12, 6–11), rechts (19–23, 6–11)) über der Hutspitze — „Ta-da“-Strahlen, keine Partikel.
* KONFETTI: sieben 2×2-Stücke (violett (4,11) und (22,15), gelb (0,15) und (26,19), blau (8,15), rot (4,19) und (30,15)) — jedes 2×2 mit vier Farbtönen. Ein einzelnes halbtransparentes Pixel (26,11) wurde weggelassen (Alpha ≠ 255).
* HUT (x 12–21, y 10–17): rosa-roter Spitzhut mit Lichtern (Rampe (130,38,53) < (205,50,79) < (212,67,67) < (255,87,90) < (224,123,123) < (255,139,141)).
* GESICHT (x 11–20, y 17–25): dunkle Maske mit blauen Augen-Quadraten (28,161,220)/(34,93,197), weißen Zähnen/Augäpfeln (255,255,255), rosa Zunge/Nase (232,108,136)/(251,158,151), schwarzem Lächeln (14,15,17) — bleibt fest (Regel 21: nicht geraten).
* ÄRMEL/HANDSCHUHE: links ein hellgrüner Handschuh (x 6–10, y 21–24) an blauem Ärmel (x 8–12, y 24–28); rechts ein hellgrüner Handschuh (x 21–26, y 21–24) an goldgelbem Ärmel (x 21–24, y 24–30).
* JACKE (x 11–21, y 25–32): links blau (G/T/I), Mitte violett, rechts goldgelb; Hosenbund/Schuhe (y 33–36) mit schwarzem Umriss.
* BALL (x 6–27, y 34–49): Kugel mit Sektoren in Violett, Hellblau, Rot/Rosa, Gelb/Gold, Grün; schwarzer Umriss.
Stoff/Ball/Hut: kein Metall/Gold/Edelstein → KEIN Glanz (Regel 14). Konfetti und Strahlen sind Teil der Figur (Kartenkunst).

Ablauf (72 Frames à 62 ms = 4,46 s, nahtlos):
* BALL ROLLT: in jeder Ballzeile (y 36–48) kreisen die Innenpixel zyklisch waagerecht, je Zeile um round(Phase · Zeilenbreite) — eine Umdrehung je Schleife (schmale Zeilen oben/unten kommen langsamer vorbei: wie eine sich drehende Kugel).
* ATMEN/BALANCIEREN (Periode 36, bis 2 px): die Jackenzeile 31 wird bis zu 2× eingefügt (Texturmischung): Hut, Gesicht, Arme und Strahlen steigen, Ball und Schuhe bleiben unten.
* ARME WINKEN: linker Arm (Periode 24) und rechter Arm (Periode 36) schwingen unabhängig: jede Spalte der Arme (links x ≤ 10, rechts x ≥ 21, y 20–31) wandert um round(±2 · Abstand/6) senkrecht (starr, Gefälle ≤ 1 px je Spalte); die Handschuhe bewegen sich am meisten.
* STRAHLEN BLITZEN: die weißen Strahlen schrumpfen von außen (zuerst die Spitzen, dann ganz) und kehren zurück (Frames 20–29 und 52–61), alles pixelweise.
* KONFETTI fällt: jedes Stück sinkt 20 px tief (zweimal je Schleife bzw. einmal, je Stück) hinter dem Clown, flattert ±1 px und blendet oben/unten per Schachbrett-Dithering ein/aus (nie ein einzelner Punkt).
Frame 0 = Original (Ruhepose). Ergänzungen: keine (der Arm bewegt sich vor dem Körper, die Lücke zum Rumpf bleibt wegen des Gefälles geschlossen).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_schach as Sc
import anim_zirkus as Z

N, MS = 72, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 5, 2

spr = L.lade('fun-fun-circus-clown')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vor = L.deckend(spr)

# Konfetti (x, y, Umlaufanzahl je Schleife, Flatterzyklen)
KONFETTI = [(4, 11, 2, 2), (0, 15, 1, 3), (8, 15, 2, 3), (4, 19, 1, 2), (22, 15, 1, 2), (30, 15, 2, 3), (26, 19, 1, 3)]
konf_maske = np.zeros((sh, sw), bool)
STUECK = []
for (x, y, m, c) in KONFETTI:
    cols = [[tuple(int(v) for v in spr[y + dy, x + dx, :3]) for dx in (0, 1)] for dy in (0, 1)]
    STUECK.append((x, y, m, c, cols))
    konf_maske[y:y + 2, x:x + 2] = True
konf_maske[11, 26] = True                                          # das einzelne halbtransparente Randpixel
strahlen = vor & (yy <= 11) & (spr[..., 0] == 255) & (spr[..., 1] == 255) & (spr[..., 2] == 255) & ~konf_maske
senkrecht = strahlen & (xx >= 15) & (xx <= 16) & (yy <= 8)
schraeg = strahlen & ~senkrecht
ball = vor & (yy >= 36) & ~konf_maske
KOERPER = vor & ~konf_maske & ~strahlen & (yy <= 32)
UNTEN = vor & ~konf_maske & ~strahlen & (yy >= 33)
ARM_L = KOERPER & (xx <= 10) & (yy >= 20)
ARM_R = KOERPER & (xx >= 21) & (yy >= 20)
RUMPF = KOERPER & ~ARM_L & ~ARM_R
ERLAUBT = Hm.umrissfarben(L.trenne(spr, ~konf_maske & ~strahlen)[0])
UMRISS = (0, 0, 0)

# Ball: Innenpixel je Zeile (zwischen den schwarzen Randpixeln)
BALL_INNEN = np.zeros((sh, sw), bool)
for y in range(36, 49):
    xs = [x for x in range(sw) if ball[y, x] and tuple(spr[y, x, :3]) != (0, 0, 0)]
    if xs:
        BALL_INNEN[y, min(xs):max(xs) + 1] = ball[y, min(xs):max(xs) + 1] & (spr[y, min(xs):max(xs) + 1, :3].sum(axis=1) > 0)


def eb(a, m=None):
    t = a if m is None else L.trenne(a, m)[0]
    return L.platz(t, H, W, OFF[0], OFF[1])


def arm(a, links, dy_spitze):
    out = L.leer(*a.shape[:2])
    for X in range(a.shape[1]):
        ys = np.nonzero(a[:, X, 3])[0]
        if not len(ys):
            continue
        x = X - OFF[0]
        f = (11 - x) / 6.0 if links else (x - 20) / 6.0
        dy = Z.rund(dy_spitze * max(0.0, min(1.0, f)))
        if ys.min() + dy < 0 or ys.max() + dy >= a.shape[0]:
            raise L.ClipError('Arm würde aus der Leinwand geschoben')
        out[ys + dy, X] = a[ys, X]
    return out


def strahlen_ebene(i, hub):
    k = None
    for s0 in (20, 52):
        k = Hm.folge(i, s0, ['m', 'm', 'k', 'x', 'x', 'x', 'x', 'k', 'm', 'm'], N) or k
    if k == 'x':
        return L.leer(H, W)
    keep = strahlen.copy()
    if k == 'm':
        keep = (senkrecht & (yy >= 3)) | (schraeg & (yy >= 7))
    elif k == 'k':
        keep = (senkrecht & (yy >= 6)) | (schraeg & (yy >= 9))
    return L.versetze(eb(spr, keep), 0, -hub)


def konfetti_ebene(i):
    a = L.leer(H, W)
    R, YT = 20, 8
    for (x0, y0, m, c, cols) in STUECK:
        step = (i * R * m) // N
        yp = YT + ((y0 - YT) + step) % R
        dx = Z.rund(math.sin(L.sinus(i, N / c) * 1.0))
        for dy in (0, 1):
            for dxx in (0, 1):
                if yp - YT < 2 and (dxx + dy) % 2 == 1:
                    continue                                      # oben einblenden (Dither)
                if (YT + R - 1) - yp < 3 and (dxx + dy) % 2 == 0:
                    continue                                      # unten ausblenden (Dither)
                a[yp + dy + OFF[1], x0 + dxx + dx + OFF[0], :3] = cols[dy][dxx]
                a[yp + dy + OFF[1], x0 + dxx + dx + OFF[0], 3] = 255
    return a


def frame(i, nur=None):
    hub = Hm.stufe(i, 36, 2)
    # Ball + Schuhe (unten) : Ball rollt
    un = eb(spr, UNTEN)
    Z.kugel_drehen(un, OFF, BALL_INNEN & UNTEN, i / float(N))
    # Rumpf mit Hut/Gesicht: Atmen über Jackenzeile 31
    rumpf = Hm.atmen(eb(spr, RUMPF), OFF[1] + 31, OFF[1] + 20, hub, 0)
    # Arme winken
    dl = Z.rund(2.0 * math.sin(L.sinus(i, 24)))
    dr = Z.rund(2.0 * math.sin(L.sinus(i, 36)))
    al = L.versetze(arm(eb(spr, ARM_L), True, dl), 0, -hub)
    ar = L.versetze(arm(eb(spr, ARM_R), False, dr), 0, -hub)
    fig = L.zusammen(H, W, [(un, 0, 0), (rumpf, 0, 0), (al, 0, 0), (ar, 0, 0)])
    fig = Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    if nur:
        return fig
    return L.zusammen(H, W, [(konfetti_ebene(i), 0, 0), (fig, 0, 0), (strahlen_ebene(i, hub), 0, 0)])


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne Konfetti und Strahlen

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_clown', 'Fun-Fun Circus Clown', frames, MS, prev, spr, OFF)
