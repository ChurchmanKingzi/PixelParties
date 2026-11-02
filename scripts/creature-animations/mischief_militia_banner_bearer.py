# -*- coding: utf-8 -*-
"""Idle-Animation für „Mischief Militia - Banner Bearer“ (Creature) — der Schneemann mit Spitzhelm und Fahne.

Quelle: src/mischief-militia-banner-bearer.png (21×32 px, 22 Farben, vollständig deckend).
PICK: [["MotiveRussia", 91, 1]]      (Ebene „Ebene #102“, Figur 1; mit der Kartenkunst Mischief_Militia_Banner_Bearer.png Pixel für Pixel gleich; die Nachbarebenen
(90 = kahler Baum, 93 = Bear Rider, 95 = Fackel/Büsche) gehören nicht zur Figur)

Aufruf:   python3 mischief_militia_banner_bearer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mischief-militia-banner-bearer.png + .json

Was im Sprite ist (x, y im 21×32-Sprite):
* HELM (x 2–12, y 12–19): grauer Spitzhelm H/M/O (98,95,114)/(132,132,146)/(176,183,208) mit dunklem Umriss F/K; auf dem Scheitel ein heller Eisdorn N/O (x 7–8, y 8–14).
* GESICHT (y 20–21): zwei schwarze Augenstriche K (x 5–6, x 9–10, y 20) mit braunen Punkten I darunter (6,21)/(10,21) — im Sprite nicht eindeutig (Wimpern/Pupillen?), deshalb KEIN Blinzeln.
* KÖRPER (y 22–30): Schneeball in Lavendel A/B/C/D mit blauem Umriss E, brauner Knopf I/U bei (7–8,23).
* ZWEIGARME I (104,64,32): linker Arm (0,22)-(1,23)-(2,24)-(3,25); rechter Arm (14,23)-(13,24)-(12,25) greift mit (15,22), (15,25), (14,26) die Stange.
* STANGE L (38,38,38) bei x = 15 (y 17–31; oben dahinter verdeckt), Spitze P/T/P (y 0–1: heller Spitzenknopf T (185,185,185)).
* FAHNE (x 10–20, y 2–21): lavendelfarbenes Tuch A/B/C/D/G, zwei Zipfel unten (links x 11–13 bis y 16, rechts x 15–19 bis y 21), hängt vor der Stange.
Material: Schnee, Stoff, Metallhelm (Helm ist matt grau) — KEIN Glanz (Regel 14), kein Feuer.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos), alle Bewegungen unabhängig:
* Atmen (Periode 24, zweimal je Schleife): die Zeile 27 des Schneeballs wird einmal doppelt eingefügt (L.streck_zeile mischt die Textur der Nachbarzeile
  hinein) — Helm, Fahne, Arme, Kopf steigen 1 px, der Boden (Zeilen 28–30) bleibt am Boden.
* Fahne weht (Periode 24, Wellenlauf von oben nach unten, Stärke schwankt mit Periode 48): jede Tuchzeile wird waagerecht verschoben (oben 0, unten bis 2 px
  nach rechts/−1 nach links), benachbarte Zeilen unterscheiden sich um höchstens 1 px (Tuch bleibt zusammenhängend); die Stange dahinter wird
  fertiggezeichnet (siehe Ergänzungen).
* Linker Zweigarm winkt (Periode 32): die Spitze wandert zwischen y 20 und y 24 (Schulter (2,24) fest), die Linie wird 4-verbunden neu gezogen. Der rechte Arm hält die
  Stange und bleibt stehen (er hebt sich nur mit dem Atmen).
* Kalter Dunst (6 Wölkchen ≥ 2×2): steigt langsam links/rechts vom Schneeball auf, Farben B/D des Sprites, hinter der Figur.
Ergänzungen: (a) Stange hinter der Fahne bei (15, 2…15) in L (38,38,38), nur dort, wo das Tuch sie freigibt; (b) Pixel (0,22), (1,23) des linken Arms werden gelöscht,
sobald der Arm sich bewegt (freie Pixel); sonst keine gemalten Pixel.
Frame 0 = Original (Dunst ausgenommen). Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 8, 9, 5, 3
TEST_EBENEN = ('koerper',)

spr = L.lade('mischief-militia-banner-bearer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

A_, B_, C_, D_, G_ = (172, 171, 232), (204, 204, 242), (214, 213, 244), (223, 224, 246), (187, 187, 237)
E_ = (85, 117, 169)
POLE = (38, 38, 38)
ZWEIG = (104, 64, 32)
RAMPE = {A_, B_, C_, D_, G_}

# Fahne: Tuchfarben rechts der Helmkante (x ≥ 11, y ≤ 16) bzw. am Zipfel rechts der Stange (x ≥ 15, y ≤ 21)
flagge = E.maske_aus(spr, lambda x, y, c: c in RAMPE and ((x >= 11 and y <= 16) or (x >= 15 and y <= 21)))
assert 120 < flagge.sum() < 160, int(flagge.sum())
ARM_L_LOESCHEN = [(0, 22), (1, 23)]
ARM_L_BASIS = (2, 24)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


KOERPER = L.platz(L.trenne(spr, flagge)[1], H, W, PAD_L, PAD_T)
FAHNE = teil(flagge)


def flaggen_versatz(i):
    """Versatz je Tuchzeile (Spritezeile → px): wächst nach unten, Wellenlauf von oben nach unten; in Frame 0 überall 0."""
    st = 1.6 + 0.6 * math.sin(L.sinus(i, 48))
    out = {}
    for y in range(2, 22):
        f = ((y - 2) / 19.0) ** 1.1
        v = 0.5 * (1 - math.cos(L.sinus(i, 24) - 1.3 * f)) - 0.5 * (1 - math.cos(-1.3 * f))
        out[y] = int(round(st * 1.7 * f * v))
    out[18] = out[20] = out[19]                                    # der einpixelige Zipfel (Zeilen 18–20) bleibt 4-verbunden
    return out


def koerper(i):
    k = KOERPER.copy()
    # linker Zweigarm winkt: Spitze zwischen y 20 und 24
    ty = 22 + int(round(2.4 * math.sin(L.sinus(i, 32))))
    if ty != 22:
        E.zweig_loeschen(k, OFF, ARM_L_LOESCHEN)
        E.zweig_zeichnen(k, OFF, ARM_L_BASIS, (0, ty), ZWEIG)
    # Stange hinter der Fahne (nur wo sie sichtbar wird) + Fahne
    fl = FAHNE.copy()
    dx = flaggen_versatz(i)
    Hm.zeilen_versatz(fl, OFF, dx)
    pole = L.leer(H, W)
    for y in range(2, 16):
        pole[PAD_T + y, PAD_L + 15, :3] = POLE
        pole[PAD_T + y, PAD_L + 15, 3] = 255
    k = L.zusammen(H, W, [(pole, 0, 0), (k, 0, 0), (fl, 0, 0)])
    # Atmen: Zeile 27 des Schneeballs einmal doppelt
    brust = E.verlauf3(i, 24, 0.0, 1)
    k = Hm.atmen(k, PAD_T + 27, PAD_T + 20, brust, 0)
    Hm.kontur_schliessen(k, ERLAUBT, E_)
    return k


_rnd = random.Random(7)
DUNST = E.dunst_liste(_rnd, N, -3, 17, PAD_T + 29, -15, 6, vx=(-2, 2))
for _p, _x in zip(DUNST, (-2, 17, 0, 14, -3, 16)):
    _p['x'] = _x                                                   # links/rechts vom Schneeball
DUNST_FARBEN = {'c': D_, 'r': B_}


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        d = E.dunst_ebene(H, W, i, N, [dict(p, x=p['x'] + PAD_L, y=p['y']) for p in DUNST], DUNST_FARBEN)
        ebenen.append((d, 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    import anim_amorph as A
    A.ausdruck_pruefen(ohne, spr, 'banner-bearer')
    L.speichern('mischief-militia-banner-bearer', 'Mischief Militia - Banner Bearer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/mischief-militia-banner-bearer-strip.png', frames[::2], spalten=12, scale=6)
