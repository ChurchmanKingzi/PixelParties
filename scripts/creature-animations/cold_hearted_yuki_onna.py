# -*- coding: utf-8 -*-
"""Idle-Animation für „Cold-Hearted Yuki-Onna“ (Creature).

Quelle: src/cold-hearted-yuki-onna.png — Ebene „Yuki Onna“ (Motive.xcf, Ebene 760). Die Ebene ist in der Quelle selbst ein 2×-vergrößerter Sprite (32×46 px, jedes Bildpunkt-Paar ein
exakter 2×2-Block; 1040 Pixel, Ebenen-Deckkraft 204 → in der Karte halbtransparent); ich arbeite deshalb auf dem ECHTEN Raster 16×23 (260 Pixel, 19 Farben, 1 Komponente) und vergrößere jeden
Frame am Ende um den Faktor 2 (nearest) — alle Bewegungen sind damit ganze Vielfache von 2 Ausgabepixeln und die Figur behält ihre groben 2×2-Pixel. Der Frame ist 2×-Raster.
Nicht Teil dieses Sprites: das „Heart of Ice“ (Ebene 757, 10×8) und die durchscheinenden Geisterkinder links/rechts/auf der Brust der Karte (andere Ebenen).
PICK: [["Motive", 760, 1]]

Aufruf:   python3 cold_hearted_yuki_onna.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cold-hearted-yuki-onna.png + .json

Was ist was (im 16×23-Raster; Ausgabe = ×2):
* Lange schwarze Haare (x 2–13, y 0–11; Töne (15,3,7)/(17,15,18)/(29,27,38)/(54,50,71)/(5,4,10)): Scheitel oben, zwei Strähnen links (x 2–3) und rechts (x 12–13) bis y 10.
* Gesicht (x 6–9, y 4–11): schmale, nach unten spitze Raute in blassem Lavendel (188,198,233) mit hellen Flecken (220,217,235)/(207,213,233) und zwei weißen Pixeln (248,254,255) bei (6,8) (9,8); kein Auge erkennbar.
* Kimono (x 2–13, y 11–22): dunkles Blaugrün (19,45,58)/(14,30,46) mit weißen Kragenstreifen (243,254,255) bei y 12–13, eisblauen Zierpixeln (198,225,234)/(99,153,181) und blauen
  Brust-Pixeln (36,50,85)/(67,76,117)/(15,31,65) in der Mitte (7–8, 15–16) (dort liegt in der Karte das Herz aus Eis); Ärmel/Hände (x 0–3 und 12–15, y 14–17) in Lavendel (188,198,233)/(220,217,235); Saum y 19–22.
Fest bleiben: Gesicht, Kimonoform, Kragen, Brustmitte.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Nebel ausgenommen) — Eis glänzt nicht (Regel 14), kein Feuer (Regel 15):
* Atmen (Periode 24, 0/1 Rasterpixel = 2 Ausgabepixel): die dunkle Kragenzeile y 13 wird eingefügt, Kopf mit Haaren und Schultern heben sich, Hände, Kimono unten und Saum bleiben stehen.
* Haare wehen: die beiden äußeren Strähnen (x 2–3 und x 12–13, y 4–10; starre Teile, vorab auf 4-Verbundenheit geprüft) schwingen ±1 Rasterpixel (Periode 24, die rechte Strähne 2 Frames später): nach innen überlappen sie das Haar, nach außen bleibt das Original stehen und die verschobene Kopie liegt daneben
  (die Strähne wird 1 Rasterpixel breiter, keine Lücke zum Haar).
* Ärmel/Hände schwingen starr ±1 Rasterpixel (links Periode 16, rechts Periode 24), der Saum (y ≥ 21) weht ±1 Rasterpixel mit Nachlauf (Periode 16).
* Eisnebel (Partikel, hinter der Figur, 6 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern): runde Eiswölkchen aus 1×1 bis 2×2 Rasterpixeln (= 2×2 bis 4×4 Ausgabepixel, nie kleiner als 2×2),
  Kern (198,225,234) bzw. (243,254,255), Rand (188,198,233) bzw. (198,225,234); sie steigen an den Seiten der Figur auf.
Randpixel-Test (Regel 16): `U.kontur_schliessen` auf dem Raster (Umrissfarbe (15,3,7)); im Ruhebild nichts. ERGÄNZUNG: keine gemalten Pixel.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; der Nebel vergrößert ihn höchstens 2 Rasterpixel = 4 Ausgabepixel darüber hinaus, dazu 1 Rasterpixel leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Rasterpixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 5, 3                                  # Leinwand im 16×23-Raster

lo = L.lade('cold-hearted-yuki-onna')                            # echtes Raster 16×23
lh, lw = lo.shape[:2]
H, W = lh + GPT + GPB, lw + GPL + GPR
yy, xx = np.mgrid[0:lh, 0:lw]
vorhanden = L.deckend(lo)
col = lambda x, y: tuple(int(v) for v in lo[y, x, :3])
UMRISS = U.umrissfarben(lo)
KONTUR = (15, 3, 7)
assert KONTUR in UMRISS


def hoch(a):
    """2×-Vergrößerung (nearest): jedes Rasterpixel = 2×2 Ausgabepixel."""
    return np.repeat(np.repeat(a, 2, axis=0), 2, axis=1)


spr = hoch(lo)                                                   # der Sprite in Ausgabeauflösung (32×46, wie in der Ebene)
sh, sw = spr.shape[:2]

haar_l = vorhanden & (xx <= 3) & (yy >= 4) & (yy <= 10)
haar_r = vorhanden & (xx >= 12) & (yy >= 4) & (yy <= 10)
hand_l = vorhanden & (xx <= 3) & (yy >= 14) & (yy <= 17)
hand_r = vorhanden & (xx >= 12) & (yy >= 14) & (yy <= 17)
saum = vorhanden & (yy >= 21)
basis_m = vorhanden & ~haar_l & ~haar_r & ~hand_l & ~hand_r & ~saum

NEBEL1 = {'c': (198, 225, 234), 'r': (188, 198, 233)}
NEBEL2 = {'c': (243, 254, 255), 'r': (198, 225, 234)}
assert all(v in {col(x, y) for y in range(lh) for x in range(lw) if vorhanden[y, x]} for v in (*NEBEL1.values(), *NEBEL2.values()))
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(0, 18)[0], y=P(0, 18)[1], vx=-1, vy=-10, off=0, form='s', wackeln=0.5),
    dict(x=P(14, 20)[0], y=P(14, 20)[1], vx=1, vy=-10, off=20, form='s', wackeln=0.5),
    dict(x=P(1, 8)[0], y=P(1, 8)[1], vx=-1, vy=-6, off=36, form='k', wackeln=0.5),
]
PUFFS2 = [
    dict(x=P(14, 8)[0], y=P(14, 8)[1], vx=1, vy=-6, off=10, form='k', wackeln=0.5),
    dict(x=P(0, 12)[0], y=P(0, 12)[1], vx=-1, vy=-8, off=26, form='s', wackeln=0.5),
    dict(x=P(15, 14)[0], y=P(15, 14)[1], vx=1, vy=-8, off=42, form='s', wackeln=0.5),
]


def teil(maske):
    t, _ = L.trenne(lo, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def pend(i, amp, lag, per):
    f = lambda t: math.sin(2 * math.pi * (t - lag) / per)
    return int(round(amp * (f(i) - f(0))))                       # 0 bei Frame 0


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 1)                                        # Atmen 0/1 Rasterpixel
    d_hl, d_hr = pend(i, 1.0, 0, 24), pend(i, 1.0, 2, 24)         # Haarsträhnen
    d_al, d_ar = pend(i, 1.0, 0, 16), pend(i, 1.0, 5, 24)         # Hände
    d_s = pend(i, 1.0, 3, 16)                                    # Saum
    bs = L.streck_zeile(teil(basis_m), GPT + 13, n)
    hl, hr = teil(haar_l), teil(haar_r)
    # Strähne nach außen: Original bleibt stehen, die verschobene Kopie liegt darüber (Strähne wird 1 Rasterpixel breiter, keine Lücke); nach innen: nur die verschobene Strähne
    ebenen = [(teil(saum), d_s, 0), (teil(hand_l), d_al, 0), (teil(hand_r), d_ar, 0), (bs, 0, 0)]
    if d_hl < 0:
        ebenen.append((hl, 0, -n))
    if d_hr > 0:
        ebenen.append((hr, 0, -n))
    ebenen += [(hl, d_hl, -n), (hr, d_hr, -n)]
    koerper = L.zusammen(H, W, ebenen)
    koerper = U.kontur_schliessen(koerper, UMRISS, KONTUR)
    if nur == 'koerper':
        return koerper
    n1 = _glut(H, W, i, N, PUFFS1, NEBEL1)
    n2 = _glut(H, W, i, N, PUFFS2, NEBEL2)
    return L.zusammen(H, W, [(n1, 0, 0), (n2, 0, 0), (koerper, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur im Raster: symmetrisch um die Ruhefigur; der Nebel darf den Frame höchstens 2 Rasterpixel über den Figurenrand hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + lw, GPT + lh))
PAD_L, PAD_T = 2 * (GPL - BOX[0]), 2 * (GPT - BOX[1])           # Versatz des Sprites im AUSGABE-Frame (2×-Raster)


def frame(i, nur=None):
    return hoch(U.beschneiden(frame_gross(i, nur), BOX))


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('cold-hearted-yuki-onna', 'Cold-Hearted Yuki-Onna', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cold-hearted-yuki-onna-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=4)
