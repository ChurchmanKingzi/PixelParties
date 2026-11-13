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
* JONGLIEREN (Runde 4, mit Handkontakt): je Hand vier Bälle, alle 6 Frames landet einer im Handschuh ((8,20) links / (22,20) rechts: in der Handschuh-Öffnung, VOR dem Handschuh gezeichnet), liegt dort 3 Frames und geht mit der Hand mit,
  dann wirft ihn die Hand hoch: Tropfenschleife (innen hoch, außen herunter, Wurfparabel 9 px hoch, 21 Flugframes, hinter dem Clown). 24 Frames je Umlauf, rechts um 3 Frames versetzt (die Hände fangen abwechselnd).
* ARME/HÄNDE: im Takt der Bälle (6 Frames ab dem Fang: Hand gibt nach +1, +1, Mitte, wirft −1, Mitte, Mitte); der Handschuh bewegt sich starr um ±1 px, der Arm kippt dazu (Gefälle ≤ 1 px je Spalte).
* ATMEN (Periode 36, bis 2 px): die Jackenzeile 31 wird bis zu 2× eingefügt (Texturmischung): Hut, Gesicht, Arme und Strahlen steigen, Ball und Schuhe bleiben unten.
* BEINE BALANCIEREN (Runde 4, Periode 18): die Unterschenkel (Zeilen 31–32 direkt über den Schuhen) weichen kurz 1 px nach rechts, später 1 px nach links aus; Schuhe (stehen auf dem Ball) und Oberkörper bleiben.
* STRAHLEN (Runde 4, „Freude/Aufregung“): Mittelstrahl und die beiden Schrägstrahlen poppen abwechselnd auf (Periode 12, um 6 Frames versetzt): Stummel → halb → voll → 1 px nach außen gesprungen → voll → halb → Stummel; nur ganze Pixel.
Frame 0: Körper = Original; die Bälle sind auf der neuen Wurfbahn (nicht mehr die Rauten der Quelle), die Strahlen im Pop-Takt. Ergänzungen: der vierte Ball rechts oben ist voll deckend (3 Pixel); Ballfarben unter dem Fußschatten zum Durchlaufen aus dem Nachbarpixel.
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


# Runde 4 — STRAHLEN („Freude/Aufregung“): der Mittelstrahl und die beiden Schrägstrahlen poppen ABWECHSELND auf (Periode 12, um 6 Frames versetzt): Stummel → halb → voll → 1 px nach außen gesprungen → voll → halb → Stummel.
STRAHL_FOLGE = ['k', 'm', 'F', 'P', 'P', 'F', 'm', 'k', 'k', 'k', 'k', 'k']
SCHRAEG_L, SCHRAEG_R = schraeg & (xx <= 14), schraeg & (xx >= 17)


def strahlen_ebene(i, hub):
    a = L.leer(H, W)
    for teil, versatz, aussen, grenzen in ((senkrecht, 0, (0, -1), (3, 6)), (SCHRAEG_L, 6, (-1, -1), (7, 9)), (SCHRAEG_R, 6, (1, -1), (7, 9))):
        k = STRAHL_FOLGE[(i + versatz) % 12]
        keep = teil & (yy >= grenzen[0]) if k == 'm' else teil & (yy >= grenzen[1]) if k == 'k' else teil
        dx, dy = aussen if k == 'P' else (0, 0)
        L.einsetzen(a, L.trenne(spr, keep)[0], OFF[0] + dx, OFF[1] + dy - hub)
    return a


# Runde 4 — JONGLIEREN MIT HANDKONTAKT: jeder Ball landet wirklich im Handschuh, liegt dort 3 Frames (geht mit der Hand mit) und wird von dort wieder hochgeworfen.
# Je Hand vier Bälle, alle 6 Frames ein Fang (UMLAUF 24). Hand-Takt (6 Frames, ab dem Fang): gibt nach (+1, +1), Mitte (0), wirft (−1), Mitte (0, 0).
HAND_TAKT = [1, 1, 0, -1, 0, 0]
HAND_L, HAND_R = (8, 20), (22, 20)          # Ball (obere linke Ecke) im Handschuh: er sitzt in der Handschuh-Öffnung (über dem Grün (8–9,22) bzw. (22–23,22))
FLUGHOEHE = 9


def hand_dy(i, links):
    return HAND_TAKT[(i if links else i + 3) % 6]


def ball_ort(i, links, b):
    """(x, y, in_der_hand) des Balls b (0–3) einer Hand. Flugbahn: Tropfenschleife mit der Spitze in der Hand — innen (kopfseitig) hoch, außen herunter, Wurfparabel (unten schnell, oben langsam)."""
    k = ((i if links else i + 3) - 6 * b) % UMLAUF
    hx, hy = HAND_L if links else HAND_R
    if k <= 2:
        return hx, hy + hand_dy(i, links), True
    s = (k - 2) / 22.0
    aus = 2.0 * math.sin(math.pi * s) - 3.0 * math.sin(2 * math.pi * s)          # nach außen positiv
    x = hx + (-1 if links else 1) * aus
    y = hy - FLUGHOEHE * 4 * s * (1 - s)
    return Z.rund(x), Z.rund(y), False


def baelle_ebenen(i, hub):
    """(hinten, vorn): fliegende Bälle liegen hinter dem Clown, der gerade gehaltene Ball liegt vor dem Handschuh."""
    hinten, vorn = L.leer(H, W), L.leer(H, W)
    for k, (x0, y0, cols) in enumerate(STUECK):
        links = k < 4
        x, y, gehalten = ball_ort(i, links, k % 4)
        a = vorn if gehalten else hinten
        for dy in (0, 1):
            for dx in (0, 1):
                a[y + dy + OFF[1] - hub, x + dx + OFF[0], :3] = cols[dy][dx]
                a[y + dy + OFF[1] - hub, x + dx + OFF[0], 3] = 255
    return hinten, vorn


# Runde 4 — BEINE balancieren: die Unterschenkel (Zeilen 31–32 über den Schuhen; Schuhe und Oberkörper bleiben) weichen kurz 1 px nach rechts bzw. links aus (Periode 18).
BEIN_FOLGE = [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, -1, -1, -1, -1, 0, 0]


def frame(i, nur=None):
    hub = Hm.stufe(i, 36, 2)
    # Ball + Schuhe (unten) : Ball rollt, Fußkontur und Fußschatten bleiben stehen
    un = eb(spr, UNTEN)
    Z.kugel_drehen_fest(un, OFF, BALL_INNEN & UNTEN, FEST, i / float(N))
    # Rumpf mit Hut/Gesicht: Atmen über Jackenzeile 31
    rumpf = Hm.atmen(eb(spr, RUMPF), OFF[1] + 31, OFF[1] + 20, hub, 0)
    bein = BEIN_FOLGE[i % 18]
    if bein:
        Hm.zeilen_versatz(rumpf, OFF, {y: bein for y in range(31 - hub, 33)})
    # Arme: die Hände fangen/werfen im Takt der Bälle (Handschuh starr ±1 px)
    al = L.versetze(arm(eb(spr, ARM_L), True, 1.5 * hand_dy(i, True)), 0, -hub)
    ar = L.versetze(arm(eb(spr, ARM_R), False, 1.5 * hand_dy(i, False)), 0, -hub)
    fig = L.zusammen(H, W, [(un, 0, 0), (rumpf, 0, 0), (al, 0, 0), (ar, 0, 0)])
    fig = Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    if nur:
        return fig
    hinten, vorn = baelle_ebenen(i, hub)
    return L.zusammen(H, W, [(hinten, 0, 0), (fig, 0, 0), (vorn, 0, 0), (strahlen_ebene(i, hub), 0, 0)])


TEST_EBENEN = ('koerper',)          # Randpixel-Test (randtest.py) ohne Konfetti und Strahlen

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    Sc.lauf('fun_fun_circus_clown', 'Fun-Fun Circus Clown', frames, MS, prev, spr, OFF)
