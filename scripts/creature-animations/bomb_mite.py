# -*- coding: utf-8 -*-
"""Idle-Animation für „Bomb Mite“ (Creature).

Quelle: src/bomb-mite.png — Ebene „Bomb Mite“ (26×17 px, 230 Pixel, 18 Farben) aus MotiveGrailWar.xcf (Ebene 558; alle Pixel deckend, Alpha nur 0/255). Die Ebene wurde direkt aus dem Dump
genommen (der Treffer-Suchlauf findet sie bei dieser Karte nicht als eigene Figur).
PICK: [["MotiveGrailWar", 558, 1]]

Aufruf:   python3 bomb_mite.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bomb-mite.png + .json

Was ist was (x/y im Sprite):
* Eine MILBE, deren Körper eine runde schwarze Eisenbombe ist (x 1–15, y 2–12): dunkelgraue Kugel (43,38,34)/(59,54,50)/(69,64,60) mit hellem Glanzfleck oben links (145,137,134)/(100,92,89) bei (7–11, 4–7)
  — Eisen, darf glänzen.
* Kopf mit Zangen links unten (x 0–4, y 10–15, hellgraue Töne (151,145,142)/(120,115,112)/(172,163,150)), vier Beine unten (x 5–13, y 13–16, beige (107,101,86)/(140,131,114)).
* LUNTE (x 13–22, y 0–8): beigefarbene Schnur (156,147,108)/(107,101,86) mit dunklen Seiten (87,83,74) von der Bombenoberseite (13–15, 0–5) nach rechts unten; am Ende (22–25, 6–9) brennt sie:
  ein Funkenstern aus Gelb (255,255,0) und zwei weißen Pixeln (255,255,255) (Feuer, Regel 15).
Fest bleiben: Bombenform, Lunte (starr), Kopf- und Beinform.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Funken und Glanz ausgenommen):
* Brennende Lunte (Regel 15) mit anim_feuer.py NEU gezeichnet: eine kleine Flamme (Gelb (255,255,0) mit weißem Kern (255,255,255); mehr Farben hat der Sprite nicht, deshalb Rand, Rot, Orange und Gelb
  im Modul gleich Gelb), zwei Zungen, Fuß fest auf dem Lunten-Ende; Spitzen reißen als runde Funken ab. Frame 0 weicht in der Flamme vom Original ab (Funkenstern → kleine Flamme); der Rest ist exakt das Original.
* Lunte wippt starr (Periode 12, ±1 px senkrecht, 4× pro Schleife) und steigt mit dem Pumpen mit; der Funken sitzt am Lunten-Ende.
* Pumpen der Bombe (Periode 16, 0/1 px, dreimal pro Schleife): die Zeile y 6 der Kugel wird eingefügt, die obere Bombenhälfte samt Lunte hebt sich 1 px; Kopf und Beine bleiben stehen.
* Beine trippeln starr im Wechsel (je 3 Frames 1 px hoch, Periode 12: linkes Bein Frame 3–5, rechtes Bein Frame 9–11), der Kopf mit den Zangen nickt 1 px (Periode 24, Frame 8–11 und 20–23 nach unten).
* Glanz auf dem Eisen (Regel 12/14): ein Lichtband läuft diagonal über die Bombe (zweimal pro Schleife, Start Frame 4 und 28, 12 Frames, zwei Stufen heller auf der Rampe der Grautöne der Bombe), dazu blitzt
  ein vierzackiger Glitzerstern am Glanzfleck (9,5) (Mitte (172,163,150), Arme (151,145,142); 3 Frames, Frame 9–11 und 33–35).
* Funken (Partikel, hinter der Figur, 4 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, 1-px-Funken k): gelbe Funken (255,255,0) und weiße (255,255,255) steigen am Lunten-Ende auf; dazu die
  vom Feuermodul abgerissenen Funken (Teil der Flamme).
Randpixel-Test (Regel 16): `U.kontur_schliessen` (Umrissfarbe (43,38,34)) am Körper; die Flammenränder sind die Randfarbe Gelb der Quelle. Kein Auge erkennbar, kein Blinzeln, kein Farbtausch.
ERGÄNZUNG: keine gemalten Pixel außer der neu gezeichneten Flamme (Farben der Quelle). Zuschnitt: der Frame ist auf die Figur (samt Flamme und abgerissenen Funken) zugeschnitten, symmetrisch um die Ruhefigur;
die 1-px-Funken und der Stern vergrößern ihn höchstens 2 px darüber hinaus, dazu 1 px leerer Rand. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer as FEU

N, MS = 48, 65
GPL, GPR, GPT, GPB = 6, 6, 10, 4

spr = L.lade('bomb-mite')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (43, 38, 34)
GELB, WEISS = (255, 255, 0), (255, 255, 255)
assert KONTUR in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

funke_alt = np.array([[bool(vorhanden[y, x]) and col(x, y) in (GELB, WEISS) for x in range(sw)] for y in range(sh)])
assert funke_alt.sum() == 7
lunte = vorhanden & (xx >= 16) & (yy <= 9) & ~funke_alt
kopf = vorhanden & (xx <= 4) & (yy >= 10)
bein_l = vorhanden & (xx >= 5) & (xx <= 8) & (yy >= 13)
bein_r = vorhanden & (xx >= 10) & (yy >= 13)
koerper = vorhanden & ~funke_alt & ~lunte & ~kopf & ~bein_l & ~bein_r
assert (funke_alt | lunte | kopf | bein_l | bein_r | koerper).sum() == vorhanden.sum()

# --- Flamme am Lunten-Ende (anim_feuer): nur Gelb und Weiß stehen im Sprite ---
RAMPE = {'rand': GELB, 'rot': GELB, 'orange': GELB, 'gelb': GELB, 'hell': WEISS}
SPERRE = np.zeros((H, W), bool)
SPERRE[GPT:GPT + sh, GPL:GPL + sw] = lunte & (xx >= 19)                  # die Lunte selbst bleibt (zählt als festes Material), die Flamme sitzt dahinter/darüber
ZUNGEN = [FEU.Zunge(23.0 + GPL, 8 + GPT, 3.5, 1.5), FEU.Zunge(25.0 + GPL, 8 + GPT, 3.0, 1.2)]
FEUER = FEU.Feuer(H, W, ZUNGEN, RAMPE, n=N, seed=4, posen=12, amplitude=0.6, sperre=SPERRE)

# --- Glanz auf der Bombe (Eisen) ---
KUGEL = (xx >= 1) & (xx <= 15) & (yy >= 2) & (yy <= 12) & koerper
GRAU = sorted({col(x, y) for y in range(sh) for x in range(sw) if KUGEL[y, x]}, key=lambda c: sum(c))
RAMPE_B = {c: GRAU[min(len(GRAU) - 1, k + 2)] for k, c in enumerate(GRAU)}
GLANZ = (9, 5)
STERN_MITTE, STERN_ARM = (172, 163, 150), (151, 145, 142)
assert STERN_MITTE in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} and STERN_ARM in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]}

FUNKE1 = {'c': GELB, 'r': GELB}
FUNKE2 = {'c': WEISS, 'r': WEISS}
P = lambda x, y: (GPL + x, GPT + y)
PUFFS1 = [
    dict(x=P(23, 5)[0], y=P(23, 5)[1], vx=1, vy=-7, off=0, form='k', wackeln=1),
    dict(x=P(25, 7)[0], y=P(25, 7)[1], vx=1, vy=-6, off=24, form='k', wackeln=1),
    dict(x=P(21, 6)[0], y=P(21, 6)[1], vx=-1, vy=-7, off=36, form='k', wackeln=1),
]
PUFFS2 = [dict(x=P(24, 6)[0], y=P(24, 6)[1], vx=1, vy=-8, off=12, form='k', wackeln=1)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    pump = 1 if (i % 16) in range(4, 12) else 0                  # Bombe pumpt: obere Hälfte 1 px höher (Frame 4–11 je 16er-Takt)
    wipp = int(round(1.0 * math.sin(2 * math.pi * i / 12)))      # Lunte wippt ±1 (0 bei Frame 0)
    bl = 1 if (i % 12) in (3, 4, 5) else 0
    br = 1 if (i % 12) in (9, 10, 11) else 0
    nick = 1 if (i % 24) in (8, 9, 10, 11, 20, 21, 22, 23) else 0
    kb = teil(koerper)
    for start in (4, 28):                                         # Lichtband über die Bombe
        j = i - start
        if 0 <= j <= 11:
            d = 4 + 2 * j
            for y in range(sh):
                for x in range(sw):
                    if KUGEL[y, x] and d <= x + y < d + 3:
                        c = col(x, y)
                        if c in RAMPE_B:
                            kb[GPT + y, GPL + x, :3] = RAMPE_B[c]
    kb = L.streck_zeile(kb, GPT + 6, pump)
    lu = teil(lunte)
    fl = FEUER.ebene(i)
    dy_l = -pump + wipp
    koerper_ges = L.zusammen(H, W, [(teil(bein_l), 0, -bl), (teil(bein_r), 0, -br), (teil(kopf), 0, nick), (kb, 0, 0), (lu, 0, dy_l)])
    koerper_ges = U.kontur_schliessen(koerper_ges, UMRISS, KONTUR)
    fl = L.versetze(fl, 0, dy_l)
    funken = FEUER.funken(i, dy=dy_l, leben=8)
    figur = L.zusammen(H, W, [(koerper_ges, 0, 0), (fl, 0, 0), (funken, 0, 0)])
    if nur == 'koerper':
        return figur
    sterne = L.leer(H, W)
    for start in (9, 33):
        k = i - start
        if 0 <= k <= 2:
            L.einsetzen(sterne, U.stern_ebene(H, W, GPL + GLANZ[0], GPT + GLANZ[1] - pump, (2, 3, 2)[k], STERN_MITTE, STERN_ARM))
    g1 = _glut(H, W, i, N, PUFFS1, FUNKE1)
    g2 = _glut(H, W, i, N, PUFFS2, FUNKE2)
    return L.zusammen(H, W, [(g1, 0, 0), (g2, 0, 0), (figur, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


# Zuschnitt auf die Figur (samt Flamme und abgerissenen Funken): symmetrisch um die Ruhefigur; 1-px-Funken und Stern dürfen den Frame höchstens 2 px darüber hinaus vergrößern
BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i, 'koerper') for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('bomb-mite', 'Bomb Mite', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bomb-mite-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
