# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Spikeblock“ („Iceblock“) (Creature) — der gleitende Eisblock mit Stacheln. Runde 3: Sprite OHNE Speed Lines, rutscht nach links/rechts und spiegelt sich dabei.

Nutzerkorrektur (wörtlich): „Iceblock (Slippery Spikeblock): schau einmal, ob du einen Sprite von ihm ohne die Speed Lines findest und nimm ggf den. Außerdem auch nach links/rechts bewegen lassen
(und dabei spiegeln)!“ — Suche: In allen 18 xcf-Zerlegungen gibt es genau EINEN Spikeblock (Motive.xcf Ebene 825 „Spikeblock“, 58×24, dazu die Schweifebene 826) und keine zweite Fassung des Blocks
(pixelgenaue Mustersuche über alle 7085 Ebenen: nur Ebene 825 und die Kartenkomposition 824 enthalten ihn; die Kartenkunst zeigt ihn mit langem Fahrtschweif). Die Speed Lines sind in der Ebene selbst
(links auslaufender Schweif/Verlauf, graue Querbänder über dem Block bei y 9–12 und 16–19, Geisterzeilen oben links). Deshalb wird der Sprite SAUBER NACHGEZEICHNET (`python3 slippery_spikeblock.py --quelle-neu`,
aus src/slippery-spikeblock-roh.png = alter Sprite mit Speed Lines): Querbänder durch die Eistextur derselben Spalten ersetzt (Zeilen 14/15/13 als Vorlage, nur vorhandene Pixel), Geisterzeilen
links oben (Zeilen 0–6, x 0–11) entfernt, die Nadelkrone endet mit einem Umrisspixel-Block bei x = 12, linke Außenkante (x = 0, Zeile 7–22) und Ecken in der Umrissfarbe (88,87,131) geschlossen.
Änderungsliste (Sprite-Koordinaten): Spalten 1–13 der Zeilen 10, 11, 12, 17, 18, 19 aus den Zeilen 14, 15, 13, 15, 14, 13; Spalte 0 und Zeile 7 (x 0–13), Zeile 22 (x 0–8) = Umriss; (1,21) = Farbe von (2,21);
(12, 4–6) = Umriss. Keine neuen Farben.

Quelle: src/slippery-spikeblock.png (29×23 px, ≈ 230 Farben, deckend) — Ebene „Spikeblock“ (xcf Motive, 58×24). Die Ebene ist in der xcf halbtransparent (Block großteils Alpha 255, links ein
auslaufender Gleitschweif mit Alpha 5–60 %); für die Animation per Regel 22 deckend gemacht: Alpha ≥ 170 deckend, 40–170 Bayer-Dither nach Alpha, darunter weg; anschließend links der Schweif (Spalten < 7, nur noch einzelne
Dither-Fleckchen, die als lose 1-px-Punkte liefen) abgeschnitten und alle Pixel ohne 4-Nachbarn gelöscht. Es bleibt der Block samt seinem linken Rand. Die Nachbarebene 826 „Ebene #335“ (114×23, reiner Schweif,
nur Alpha < 255) bleibt weg.
PICK: [["Motive", 825, "ganze Ebene, Alpha → Dither (170/40), x ≥ 7, ohne Einzelpixel"]]      (Karte Slippery_Spikeblock.png: der Block gleitet nach rechts, Schweif links)

Aufruf:   python3 slippery_spikeblock.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-spikeblock.png + .json

Was im Sprite ist (x, y im 29×23-Sprite):
* BLOCK (x 0–28, y 4–22): flächiger Eisblock in Lavendelstufen (88,87,131)…(223,224,246), umlaufender dunkler Rand, links Dither-Verlauf zur Mitte; zwei Rauten (Diagonalmuster) in dunklerem Ton bei x 17–20 und x 21–24 (y 8–20).
* STACHELN OBEN: dünne senkrechte Eisnadeln bei x = 11 (y 1–3), 15 (y 0–3), 19 (y 1–3), 23 (y 0–3); STACHELN RECHTS: gezackter Rand (x 23–28, y 7–21).
Material: Eis — KEIN Glanz (Regel 14), kein Lichtband.

Ablauf (48 Frames à 66 ms = 3,17 s, nahtlos), alle Bewegungen unabhängig:
* RUTSCHEN (neu, ersetzt das frühere Rattern ±1 px): der GANZE Block samt Nadeln und Eisdunst gleitet ganzzahlig über das Eis — Frames 0–11 nach rechts (bis +6 px, sanft anfahrend/bremsend; er blickt nach rechts =
  Originalrichtung, der Dunst entsteht links hinter ihm), kurzer Halt, dann (Frame 14) wird der Sprite horizontal gespiegelt und er gleitet Frames 15–30 nach links (bis −6 px, Stacheln jetzt links, Dunst rechts hinter ihm),
  Halt, Rückspiegeln (Frame 33) und Frames 34–47 zurück zur Mitte. Frame 0 = Original. Die Leinwand ist links/rechts gleich breit (Spiegeln um die Mitte).
* Stacheln fahren aus und ein (Perioden 12/16/12/16, versetzt): die Nadelspitzen oben verlängern bzw. verkürzen sich um 1 px (Spitzenpixel in der Farbe der Nadel; nie ablösen: Mindestlänge 2).
* Block atmet (Periode 24): Zeile 14 des Blocks wird einmal doppelt eingefügt (Textur gemischt) — der Block wird 1 px höher, die Unterkante bleibt auf dem Eis; die Nadeln steigen mit.
* Eisdunst (mit dem Block mitgeführt und mit ihm gespiegelt): 5 Wölkchen ≥ 2×2 (hellste Lavendelstufen des Sprites) entstehen am linken Rand (Fahrtrichtung rechts) und steigen langsam nach links oben auf.
Ergänzungen: Nadelspitzen-Pixel (Farben der jeweiligen Nadel). Frame 0 = Original (Dunst ausgenommen).
"""
import math
import random
import sys

import numpy as np

import anim_eis as E
import anim_humanoide as Hm
import anim_lib as L
import anim_rutsch as R

N, MS = 48, 66
PAD_L, PAD_R, PAD_T, PAD_B = 16, 16, 6, 2          # links/rechts gleich (Spiegeln um die Mitte): Rutschweg ±6 px + Eisdunst hinter dem Block
TEST_EBENEN = ('koerper',)
UMRISS = (88, 87, 131)


def sauber(a):
    """Sprite ohne Speed Lines: alter Sprite (src/slippery-spikeblock-roh.png) → Querbänder/Geisterzeilen/Verlaufskante bereinigt (siehe Dateikopf)."""
    b = a.copy()

    def put(x, y, c):
        b[y, x, :3] = c
        b[y, x, 3] = 255
    b[0:7, 0:12] = 0                                        # Geisterzeilen oben links (Schweif) weg
    for y in (4, 5, 6):
        put(12, y, UMRISS)                                   # Nadelkrone endet mit Umriss
    for y, d in {10: 14, 11: 15, 12: 13, 17: 15, 18: 14, 19: 13}.items():
        for x in range(1, 14):
            put(x, y, a[d, x, :3])                           # graue Querbänder → Eistextur derselben Spalten
    # Eistextur beruhigen: einzelne dunkle Flecken der Vorlagezeilen (senkrechte Striche) durch den Median-Nachbarn (3×3, vorhandene Farben) ersetzen
    c = b.copy()
    for y in range(8, 22):
        for x in range(1, 14):
            nb = [c[y + dy, x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1) if c[y + dy, x + dx, 3] and not (x + dx == 0 or y + dy in (7, 22))]
            nb.sort(key=lambda p: int(p[0]) + int(p[1]) + int(p[2]))
            m = nb[len(nb) // 2]
            b[y, x, :3] = m[:3]
    for x in range(0, 14):
        put(x, 7, UMRISS)
    for y in range(7, 23):
        put(0, y, UMRISS)                                    # linke Außenkante
    for x in range(0, 9):
        put(x, 22, UMRISS)
    put(1, 21, a[21, 2, :3])
    return b


if '--quelle-neu' in sys.argv:
    from PIL import Image
    Image.fromarray(sauber(L.lade('slippery-spikeblock-roh'))).save(L.SRC + '/slippery-spikeblock.png')
    print('geschrieben: src/slippery-spikeblock.png (aus -roh)')
    sys.exit(0)

spr = L.lade('slippery-spikeblock')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
ERLAUBT = Hm.umrissfarben(spr)

NADELN = {15: 4, 19: 3, 23: 4}                              # Spalte → Länge (y 3 aufwärts); die Nadel bei x = 11 gehörte zur Schweif-Geisterzone und entfällt
for x, ln in NADELN.items():
    assert all(spr[y, x, 3] for y in range(4 - ln, 4)), x
    assert 3 - ln < 0 or not spr[3 - ln, x, 3]
PERIODE = {15: 16, 19: 12, 23: 16}
VERSATZ = {15: 1.2, 19: 2.4, 23: 3.6}

# hellste Lavendelstufen für den Dunst
_farben = {}
for p in spr.reshape(-1, 4):
    if p[3]:
        c = tuple(int(v) for v in p[:3]); _farben[c] = _farben.get(c, 0) + 1
_hell = sorted([c for c in _farben if sum(c) / 3 > 195], key=lambda c: -_farben[c])
KERN, RAND = _hell[0], _hell[1]


def koerper(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    for x, ln in NADELN.items():
        d = int(round(1.0 * (math.sin(L.sinus(i, PERIODE[x], VERSATZ[x])) - math.sin(VERSATZ[x]))))   # 0 in Frame 0
        d = max(-1, min(1, d))
        top = 4 - ln
        if d > 0:
            Hm.setze(k, {(x, top - 1): tuple(int(v) for v in spr[top, x, :3])}, OFF)
        elif d < 0 and ln >= 3:
            Hm.setze(k, {(x, top): None}, OFF)
    k = Hm.atmen(k, PAD_T + 14, PAD_T + 10, E.verlauf3(i, 24, 0.0, 1), 0)
    Hm.kontur_schliessen(k, ERLAUBT, (88, 87, 131))
    return k


DUNST = [dict(x=PAD_L + x, y=PAD_T + y, vx=vx, vy=vy, off=o, form=f, wackeln=0.8, ph=p) for (x, y, vx, vy, o, f, p) in
         [(1, 18, -7.0, -3.0, 0, 'm', 0.0), (0, 11, -6.0, -4.0, 10, 'o', 0.3), (2, 21, -8.0, -2.0, 20, 'm', 0.6),
          (-1, 14, -7.0, -4.0, 29, 'o', 0.1), (1, 8, -6.0, -3.0, 39, 'm', 0.8)]]
DUNST_FARBEN = {'c': KERN, 'r': RAND}


# Rutschen: blickt nach rechts (Original); rechts 0 → +6, Halt, spiegeln, links +6 → −6 (blickt nach links), Halt, zurückspiegeln, −6 → 0
BAHN, SPIEGEL = R.pfad(N, [('fahrt', 6, 12), ('halt', 2), ('flip',), ('halt', 1), ('fahrt', -6, 16), ('halt', 2), ('flip',),
                           ('halt', 1), ('fahrt', 0, 14)])


def frame(i, nur=None):
    ebenen = []
    if nur is None or 'dunst' in nur:
        ebenen.append((E.dunst_ebene(H, W, i, N, DUNST, DUNST_FARBEN), 0, 0))
    ebenen.append((koerper(i), 0, 0))
    return R.verschieben(L.zusammen(H, W, ebenen), BAHN[i], SPIEGEL[i])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ohne = [frame(i, nur=('koerper',)) for i in range(N)]
    print('Ruhepose weicht vom Original ab bei:', Hm.ruhepose(ohne[0], spr, OFF) or 'nichts')
    print('Position je Frame:', BAHN, '\nGespiegelt:', [int(x) for x in SPIEGEL])
    L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (Figur):', [int((f[..., 3] > 0).sum()) for f in ohne])
    L.speichern('slippery-spikeblock', 'Slippery Spikeblock', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/slippery-spikeblock-strip.png', frames[::2], spalten=8, scale=6)
