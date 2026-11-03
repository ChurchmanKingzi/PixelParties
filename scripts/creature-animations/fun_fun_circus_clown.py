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
* JONGLIERBÄLLE (Runde 3: vorher fälschlich als Konfetti gelesen): ZWEIMAL VIER 2×2-Bälle, je Hand eine Raute — links violett (4,11), gelb (0,15), blau (8,15), rot (4,19); rechts blau (26,11), violett (22,15), rot (30,15), gelb (26,19) — jeder mit vier Farbtönen.
  Der rechte obere Ball (26,11) ist in der xcf halbtransparent (Alpha 127 bei drei Pixeln): voll deckend übernommen (Regel 22), src/fun-fun-circus-clown.png entsprechend ergänzt (Farben (100,151,174), (75,177,223), (75,177,223), (164,215,238) aus Ebene 36).
* HUT (x 12–21, y 10–17): rosa-roter Spitzhut mit Lichtern (Rampe (130,38,53) < (205,50,79) < (212,67,67) < (255,87,90) < (224,123,123) < (255,139,141)).
* GESICHT (x 11–20, y 17–25): dunkle Maske mit blauen Augen-Quadraten (28,161,220)/(34,93,197), weißen Zähnen/Augäpfeln (255,255,255), rosa Zunge/Nase (232,108,136)/(251,158,151), schwarzem Lächeln (14,15,17) — bleibt fest (Regel 21: nicht geraten).
* ÄRMEL/HANDSCHUHE: links ein hellgrüner Handschuh (x 6–10, y 21–24) an blauem Ärmel (x 8–12, y 24–28); rechts ein hellgrüner Handschuh (x 21–26, y 21–24) an goldgelbem Ärmel (x 21–24, y 24–30).
* JACKE (x 11–21, y 25–32): links blau (G/T/I), Mitte violett, rechts goldgelb; Hosenbund/Schuhe (y 33–36) mit schwarzem Umriss.
* BALL (x 6–27, y 34–49): Kugel mit Sektoren in Violett, Hellblau, Rot/Rosa, Gelb/Gold, Grün; schwarzer Umriss.
Stoff/Ball/Hut: kein Metall/Gold/Edelstein → KEIN Glanz (Regel 14). Konfetti und Strahlen sind Teil der Figur (Kartenkunst).

Ablauf (72 Frames à 62 ms = 4,46 s, nahtlos):
* BALL ROLLT: in jeder Ballzeile (y 36–48) kreisen die Innenpixel zyklisch waagerecht, je Zeile um round(Phase · Zeilenbreite) — eine Umdrehung je Schleife (schmale Zeilen oben/unten kommen langsamer vorbei: wie eine sich drehende Kugel).
  Runde 3: die Kontur der Schuhsohle (12–14, 36) und der türkise Fußschatten auf dem Ball ((11,36), (15,36), (12–14,37)) gehören zum Clown und bleiben FEST; die Ballfarben laufen unter ihnen durch (`Z.kugel_drehen_fest`, verdeckte Texturstellen aus dem Nachbarpixel ergänzt).
* JONGLIEREN (Runde 3): jede Hand hält vier Bälle in der Luft: die Bälle kreisen auf einer Kreisbahn (Radius 4, Mitte (4,15) links / (26,15) rechts, 24 Frames je Umlauf = drei Umläufe je Schleife, ein Fang/Wurf je Hand alle 6 Frames);
  links gegen den Uhrzeigersinn, rechts im Uhrzeigersinn (innen hoch, außen herunter), rechts um 3 Frames versetzt (die Hände fangen abwechselnd). Die tiefste Stelle der Bahn liegt über dem Handschuh; die Bahnmitte folgt dem Handschuh und dem Atemhub. Bälle hinter dem Clown.
* ATMEN/BALANCIEREN (Periode 36, bis 2 px): die Jackenzeile 31 wird bis zu 2× eingefügt (Texturmischung): Hut, Gesicht, Arme und Strahlen steigen, Ball und Schuhe bleiben unten.
* ARME: beim Jonglieren fangen/werfen die Hände im Takt (Periode 12, rechts um 3 Frames versetzt): jede Spalte der Arme (links x ≤ 10, rechts x ≥ 21, y 20–31) wandert um round(±2 · Abstand/6) senkrecht (starr, Gefälle ≤ 1 px je Spalte); die Handschuhe bewegen sich am meisten.
* STRAHLEN BLITZEN: die weißen Strahlen schrumpfen von außen (zuerst die Spitzen, dann ganz) und kehren zurück (Frames 20–29 und 52–61), alles pixelweise.
Frame 0 = Original auf der linken Seite (die rechte Hand ist 3 Frames versetzt, die Arme stehen im Takt schon in Bewegung). Ergänzungen: der vierte Ball rechts oben ist voll deckend (3 Pixel); Ballfarben unter dem Fußschatten zum Durchlaufen aus dem Nachbarpixel.
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

# Jonglierbälle: zweimal vier 2×2-Stücke (Ebene 36 der xcf), je Hand vier. Ruhelage = Raute um (4,15) bzw. (26,15) (Bälle als obere linke Ecke): oben −90°, links 180°, rechts 0°, unten 90°.
# (Bis Runde 2 waren es „Konfetti“; der Nutzer: „Der Clown soll jonglieren, dafür sind die zweimal vier Bälle da – mit jeder Hand je vier Bälle in der Luft halten.“)
BALL_WINKEL = [-math.pi / 2, math.pi, 0.0, math.pi / 2]
LINKS = [(4, 11), (0, 15), (8, 15), (4, 19)]
RECHTS = [(26, 11), (22, 15), (30, 15), (26, 19)]
BAHN_L, BAHN_R, RADIUS = (4, 15), (26, 15), 4          # Bahnmitte (x, y) je Hand und Radius der Kreisbahn
UMLAUF = 24                                             # Frames je Umlauf (3 Umläufe je Schleife → alle 6 Frames wirft/fängt jede Hand einen Ball)
konf_maske = np.zeros((sh, sw), bool)
STUECK = []
for lst in (LINKS, RECHTS):
    for (x, y) in lst:
        cols = [[tuple(int(v) for v in spr[y + dy, x + dx, :3]) for dx in (0, 1)] for dy in (0, 1)]
        STUECK.append((x, y, cols))
        konf_maske[y:y + 2, x:x + 2] = True
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

# Ball: Innenpixel je Zeile (zwischen den schwarzen Randpixeln). FEST = Pixel, die beim Rollen NICHT mitlaufen: die Schuhe (Kontur (12–14,36) am Ballrand) und der türkise Schatten der Füße auf dem Ball
# ((11,36), (15,36), (12–14,37)) — Runde 3: „die untere Kontur seines Fußes dreht sich mit dem Ball mit“. Die Ballfarben laufen unter ihnen durch (verdeckte Stellen aus dem Nachbarpixel ergänzt).
BALL_INNEN = np.zeros((sh, sw), bool)
for y in range(36, 49):
    xs = [x for x in range(sw) if ball[y, x] and tuple(spr[y, x, :3]) != (0, 0, 0)]
    if xs:
        BALL_INNEN[y, min(xs):max(xs) + 1] = ball[y, min(xs):max(xs) + 1] & (spr[y, min(xs):max(xs) + 1, :3].sum(axis=1) > 0)
FEST = np.zeros((sh, sw), bool)
FEST[36, 11:16] = True
FEST[37, 12:15] = True


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


def baelle_ebene(i, dy_l, dy_r):
    """Jonglieren: je Hand vier Bälle auf einer Kreisbahn (links gegen den Uhrzeigersinn, rechts im Uhrzeigersinn: innen hoch, außen herunter); die Bahnmitte
    folgt der Hand (dy_l/dy_r in px). Die unterste Stelle der Bahn liegt über dem Handschuh (Fang), die Bälle liegen hinter dem Clown. Rechts um 3 Frames versetzt,
    damit die Hände abwechselnd fangen."""
    a = L.leer(H, W)
    for k, (x0, y0, cols) in enumerate(STUECK):
        links = k < 4
        w0 = BALL_WINKEL[LINKS.index((x0, y0)) if links else RECHTS.index((x0, y0))]
        t = (i if links else i + 3) / float(UMLAUF)
        ang = w0 - 2 * math.pi * t if links else w0 + 2 * math.pi * t
        (mx, my) = BAHN_L if links else BAHN_R
        x, y = Z.kreisbahn(mx, my + (dy_l if links else dy_r), RADIUS, ang)
        for dy in (0, 1):
            for dx in (0, 1):
                a[y + dy + OFF[1], x + dx + OFF[0], :3] = cols[dy][dx]
                a[y + dy + OFF[1], x + dx + OFF[0], 3] = 255
    return a


def frame(i, nur=None):
    hub = Hm.stufe(i, 36, 2)
    # Ball + Schuhe (unten) : Ball rollt, Fußkontur und Fußschatten bleiben stehen
    un = eb(spr, UNTEN)
    Z.kugel_drehen_fest(un, OFF, BALL_INNEN & UNTEN, FEST, i / float(N))
    # Rumpf mit Hut/Gesicht: Atmen über Jackenzeile 31
    rumpf = Hm.atmen(eb(spr, RUMPF), OFF[1] + 31, OFF[1] + 20, hub, 0)
    # Arme: die Hände fangen/werfen (kurzer Takt), Bahnmitte der Bälle folgt dem Handschuh
    dl = Z.rund(2.0 * math.sin(L.sinus(i, 12)))
    dr = Z.rund(2.0 * math.sin(L.sinus(i, 12, math.pi / 2)))
    al = L.versetze(arm(eb(spr, ARM_L), True, dl), 0, -hub)
    ar = L.versetze(arm(eb(spr, ARM_R), False, dr), 0, -hub)
    fig = L.zusammen(H, W, [(un, 0, 0), (rumpf, 0, 0), (al, 0, 0), (ar, 0, 0)])
    fig = Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    if nur:
        return fig
    bl = baelle_ebene(i, Z.rund(0.45 * dl) - hub, Z.rund(0.45 * dr) - hub)
    return L.zusammen(H, W, [(bl, 0, 0), (fig, 0, 0), (strahlen_ebene(i, hub), 0, 0)])


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne Konfetti und Strahlen

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_clown', 'Fun-Fun Circus Clown', frames, MS, prev, spr, OFF)
