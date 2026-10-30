# -*- coding: utf-8 -*-
"""Idle-Animation für „Analyzer from the Cosmic Depths“ (Creature).

Quelle: src/analyzer-from-the-cosmic-depths.png — Ebene „Ebene #32“ (42×46 px, 9 Farben) aus MotiveBoons.xcf: DREI gleiche fliegende Augäpfel, wie in der
Karte angeordnet (oben links, Mitte rechts, unten). Die Treffer von `creature_show.py` (Figur 1 = ein Auge, Figur 2 = zwei Augen) überlappen sich, deshalb
habe ich die ganze Ebene genommen (alle Pixel deckend, Alpha nur 0/255, nichts fehlt). Das rote Augenmotiv links in der Karte und die weißblauen Lichtpunkte
rechts sind andere Ebenen/Hintergrund.
PICK: [["MotiveBoons", 34, 1], ["MotiveBoons", 34, 2]]  (= die ganze Ebene 34)

Aufruf:   python3 analyzer_from_the_cosmic_depths.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/analyzer-from-the-cosmic-depths.png + .json

Was ist was (je Auge, Koordinaten relativ zum Auge 0..17 × 0..16; die drei Augen liegen bei (0,0), (24,11) und (10,29) im Sprite):
* Augapfel: braun-beige Kugel (Schattierung B (82,61,58) < C (104,86,66) < D (129,109,84), Lichtkante H (184,174,121) oben rechts bei (13–15,4) und (15–16,5)),
  dunkler Umriss A (36,13,33).
* Smaragd-Iris am rechten Rand: weißer Fassungsring E (252,252,255), Edelstein aus Dunkelgrün F (14,139,71), Hellgrün G (1,251,153) und hellem Glanzpunkt
  I (187,252,246) bei (16–17,7) und (17,8) — ein Edelstein (Regel 14: er darf glänzen).
* Zwei geschwungene Stachel-Flossen links (oberer Fächer y 0–11, unterer y 12–16, x 0–13): Umrisslinien A, Füllung B — der Schwanz des Schwimmers.
Fest bleiben: Kugelform, Fassungsring, die Edelsteinform.

Ablauf (48 Frames à 60 ms = 2,88 s; Frame 0 = Original, Staub und Sterne ausgenommen):
* Jedes Auge schwimmt für sich: es steigt (Auge 3: sinkt, damit es Auge 2 nie berührt) starr bis 2 px (zweistufig 0-1-2-1-0 innerhalb von 24 Frames), die Augen zeitversetzt (Start Frame 0, 12, 24).
* Der Schwanz (Flossen links vom Augapfel, x < 10) schlägt wie ein Fischschwanz: je Fächer (oben/unten) zwei STARRE Teile — Basis (x 5–9) bis ±1 px, Spitze (x 0–4)
  zusätzlich bis ±1 px mit Nachlauf (also bis ±2 px) —, oberer und unterer Fächer mit leicht versetzter Phase (Periode 12 innerhalb der Schlagphase Frame 0–24 und
  24–48), die drei Augen mit 1/3-Phasenversatz. Warum starr statt Spaltenversatz: die Flossen bestehen aus 1–2 px dünnen Linien, jede Spaltenscherung riss sie auf;
  die Aufteilung bei x = 4 / x = 9 hält alle Kombinationen 4-verbunden.
* Glanz am Edelstein (Regel 12/14): ein Lichtband (Rampe F → G → I) läuft diagonal über die Iris, zweimal pro Schleife je Auge (Augen 1/2/3: Start Frame 2+24,
  10+21, 18+19); ein vierzackiger Glitzerstern (Mitte I, Arme G; 3 Frames) blitzt am Glanzpunkt (17,7) auf (Auge 1 Frame 14–16 und 40–42, Auge 2 Frame 22–24 und 6–8
  ab Frame 6, Auge 3 Frame 30–32 und 4–6). Er bleibt am Edelstein.
* Kosmosstaub (Partikel, hinter den Augen, 9 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, Formen k, o): hellcyan Funken (Kern I) und grüne
  Kugeln (Kern G, Rand F), alle Farben aus dem Sprite.
Randpixel-Test (Regel 16): `U.kontur_schliessen` ergänzt in jeder Pose fehlende Umrisspixel (A) an den schlagenden Flossen; im Ruhebild ändert es nichts.
ERGÄNZUNG: keine gemalten Pixel außer den Randpixeln der Kontur-Schließung (Farbe A).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 8, 9, 10, 8

spr = L.lade('analyzer-from-the-cosmic-depths')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

A_, F_, G_, I_ = (36, 13, 33), (14, 139, 71), (1, 251, 153), (187, 252, 246)
_vorh = {tuple(int(v) for v in p[:3]) for p in spr.reshape(-1, 4) if p[3]}
assert all(col in _vorh for col in (A_, F_, G_, I_))
RAMPE = {F_: G_, G_: I_}                              # Edelsteinrampe: eine Stufe heller
UMRISS = U.umrissfarben(spr)

AUGEN = [(0, 0), (24, 11), (10, 29)]                  # linke obere Ecke jedes Auges im Sprite (18×17 px)
masken = [vorhanden & (xx >= ox) & (xx < ox + 18) & (yy >= oy) & (yy < oy + 17) for (ox, oy) in AUGEN]
assert sum(int(m.sum()) for m in masken) == int(vorhanden.sum())
gem = [[(x, y) for y in range(sh) for x in range(sw) if m[y, x] and tuple(spr[y, x, :3]) in (F_, G_, I_)] for m in masken]
# Schwanzflossen als vier starre Teile je Auge (Regel 11): oberer Fächer (y ≤ 11) und unterer (y ≥ 12), jeder in Spitze (x ≤ 4) und Basis (5 ≤ x ≤ 9);
# alle Kombinationen von je ±2 px Versatz bleiben 4-verbunden (für diese Aufteilung vorab geprüft). Der Augapfel (x ≥ 10) bleibt am Auge.
FLOSSEN = []
for (ox, oy), m in zip(AUGEN, masken):
    lx, ly = xx - ox, yy - oy
    FLOSSEN.append([m & (ly <= 11) & (lx <= 4), m & (ly <= 11) & (lx >= 5) & (lx <= 9), m & (ly >= 12) & (lx <= 4), m & (ly >= 12) & (lx >= 5) & (lx <= 9)])
    assert FLOSSEN[-1][0].any() and FLOSSEN[-1][3].any()
BOB_START = [0, 12, 24]                               # Start des Schwimm-Hubs je Auge (Dauer 24 Frames)
BAND = [(2, 24), (10, 31), (18, 37)]                  # Start der zwei Lichtband-Läufe je Auge (je 10 Frames, enden vor Frame 48)
STERN = [{14: 1, 15: 2, 16: 1, 40: 1, 41: 2, 42: 1}, {22: 1, 23: 2, 24: 1, 6: 1, 7: 2, 8: 1}, {30: 1, 31: 2, 32: 1, 4: 1, 5: 2, 6: 1}]
GLANZPUNKT = (17, 7)                                  # I (Glanzpunkt der Iris), relativ zum Auge

STAUB = {'c': I_, 'r': G_}                            # Cyan-Funken
KUGEL = {'c': G_, 'r': F_}                            # grüne Kugeln
P = lambda x, y: (PAD_L + x, PAD_T + y)
PUFFS_CYAN = [
    dict(x=P(19, 8)[0], y=P(19, 8)[1], vx=2, vy=-10, off=0, form='k', wackeln=1),
    dict(x=P(43, 18)[0], y=P(43, 18)[1], vx=2, vy=-10, off=18, form='k', wackeln=1),
    dict(x=P(29, 38)[0], y=P(29, 38)[1], vx=2, vy=-11, off=33, form='k', wackeln=1),
    dict(x=P(4, 20)[0], y=P(4, 20)[1], vx=-2, vy=-9, off=8, form='k', wackeln=1),
]
PUFFS_GRUEN = [
    dict(x=P(21, 3)[0], y=P(21, 3)[1], vx=3, vy=-11, off=12, form='o', wackeln=1),
    dict(x=P(30, 30)[0], y=P(30, 30)[1], vx=2, vy=-12, off=40, form='o', wackeln=1),
    dict(x=P(8, 40)[0], y=P(8, 40)[1], vx=-2, vy=-10, off=24, form='o', wackeln=1),
    dict(x=P(34, 8)[0], y=P(34, 8)[1], vx=-2, vy=-10, off=4, form='o', wackeln=1),
    dict(x=P(14, 24)[0], y=P(14, 24)[1], vx=-1, vy=-9, off=28, form='k', wackeln=1),
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                       # sofort auf die volle Leinwand


def frame(i, nur=None):
    env = U.buckel(i, 0, 24, n=24)                              # Schlagstärke: 0 bei Frame 0 (Ruhepose)
    augen = []
    sterne = L.leer(H, W)
    bobs = []
    for k, (ox, oy) in enumerate(AUGEN):
        lay = teil(masken[k] & ~(FLOSSEN[k][0] | FLOSSEN[k][1] | FLOSSEN[k][2] | FLOSSEN[k][3]))   # Augapfel samt Edelstein
        b0, b1 = BAND[k][0], BAND[k][1]
        for start in (b0, b1):                                  # Lichtband über den Edelstein
            if 0 <= i - start <= 10:
                U.band_diagonal(lay, gem[k], RAMPE, ox + oy + 19 + (i - start), 2, PAD_L, PAD_T)
        bob = int(round(2 * U.buckel(i, BOB_START[k], 24, n=48))) * (-1 if k == 2 else 1)      # Auge 3 sinkt statt zu steigen (Abstand zu Auge 2)
        bobs.append(bob)
        augen.append((lay, 0, -bob))
        # Schwanzflossen: starre Teile, Fächer oben/unten mit leicht versetzter Phase (Wellenlauf: die Spitze hinkt hinterher)
        ph = L.sinus(i, 12, 2 * math.pi * k / 3)
        for fan, (basis_ph, spitzen_ph) in ((0, (ph, ph - 0.9)), (1, (ph + 0.8, ph - 0.1))):
            d_basis = int(round(1.4 * env * math.sin(basis_ph)))
            d_spitze = d_basis + int(round(1.0 * env * math.sin(spitzen_ph)))
            for teilmaske, dy in ((FLOSSEN[k][2 * fan], d_spitze), (FLOSSEN[k][2 * fan + 1], d_basis)):
                augen.append((teil(teilmaske), 0, dy - bob))
    koerper = L.zusammen(H, W, augen)
    koerper = U.kontur_schliessen(koerper, UMRISS, A_)           # Regel 16: Umriss an den Flossen in jeder Pose geschlossen
    if nur == 'koerper':
        return koerper
    for k, (ox, oy) in enumerate(AUGEN):
        st = STERN[k].get(i, 0)
        if st:
            L.einsetzen(sterne, U.stern_ebene(H, W, PAD_L + ox + GLANZPUNKT[0], PAD_T + oy + GLANZPUNKT[1] - bobs[k], st, I_, G_))
    cyan = U.glut_ebene(H, W, i, N, PUFFS_CYAN, STAUB)
    gruen = U.glut_ebene(H, W, i, N, PUFFS_GRUEN, KUGEL)
    return L.zusammen(H, W, [(gruen, 0, 0), (cyan, 0, 0), (koerper, 0, 0), (sterne, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr)
    L.speichern('analyzer-from-the-cosmic-depths', 'Analyzer from the Cosmic Depths', frames, MS, prev)
    if prev:
        L.streifen(prev + '/analyzer-from-the-cosmic-depths-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
