# -*- coding: utf-8 -*-
"""Idle-Animation für „Soul Shard Ba“ (Creature).

PICK: [["MotiveEgypt", 205, 1]]   Ebene „Ba“ (MotiveEgypt.xcf, Ebene 205, 40×35 px, 21 Farben, nur Alpha 0/255, ein einziges 4-verbundenes Teil) → src/soul-shard-ba.png.
Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/Soul_Shard_Ba.png, 76×51) abgeglichen: die Ebene sitzt dort bei (18,11), die Form trifft zu 100 %. In der Kartenkunst liegt über der Kobrahaube eine rote,
halbtransparente Tönung samt Schein (Ebene „Ebene #35“, Deckkraft 80 %), die die graue Haube rot färbt und nicht pixelgenau übernommen werden kann; die Ebene „Ba“ selbst ist pixelsauber und zeigt die Haube in Grau.

Aufruf:   python3 soul_shard_ba.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/soul-shard-ba.png + .json

Was im Sprite ist (Koordinaten im Sprite 40×35, x/y ab 0):
* Ein Skelett mit Kobrakopf: aufgestellte graue Kobrahaube (Zeilen 0–19) mit zwei roten Augen R=(255,0,0)/S=(130,0,0) bei (15,5–6) und (23–24,5–6), weißen Giftzähnen Q und offenem dunkelrotem Maul P/J;
  darunter ein kleiner Rippenkorb (Zeilen 20–31, x 13–24) mit sechs dünnen, schwarz umrandeten hellen Bändern („Bandagen“, Nutzer: „die vielen einzelnen Bandagen“), die an Haube und Rumpf hängen:
  1 = linker Bogen an der Haube (Zeilen 9–15, x 0–5), 2 = rechter Bogen (x 34–39), 3 = langer linker Schulterbogen (vom Schlüsselbein (12,23) nach links unten, hoch über den Scheitel (3–4,19) und hinunter zu (1,24)),
  4 = langer rechter Schulterbogen (von (25,23) über den Scheitel (31–33,19) hinunter zu (35,24)), 5 = linker Hängeschwanz (ab (13,28) bis (11,34)), 6 = kleiner rechter Haken (ab (24,26) bis (23,31)).
  Jedes Band hat 1–2 px hellen Kern (E/F/G/K) und 1 px Umriss (12,12,12).
* Material: Knochen, Stoff, Fell/Schuppen — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15). Keine Partikel.
Fest bleiben: Haubenform, Gesicht, Fänge, Rippenkorb-Umriss.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Atmen (Periode 24): unterhalb der Schultern werden im Rippenkorb 1–2 Zeilen eingefügt (Quellzeile 28, in der Spitze zusätzlich 27; nur Rumpf/Haube, die Bänder sind eigene Ebenen; Textur der Nachbarzeile eingemischt) — Kopf,
  Bänder und Oberkörper heben sich um 1–2 px, der untere Rippenkorb bleibt am Boden.
* Schlangenbänder: jedes der sechs Bänder bewegt sich als laufende Welle mit eigener Phase, eigener Periode (3×, 2× bzw. 4× je Schleife) und eigener Wellenlänge. Wurzel (am Körper) bleibt fest, die Amplitude wächst bis zur Spitze auf
  1,6–2,4 px. Der helle Kern wird in Wellenfronten (Breitensuche ab der Wurzel) senkrecht zum Bandverlauf verschoben, Lücken zwischen Nachbarfronten werden mit Kernpixeln geschlossen und der Umriss (4 Nachbarn, wie im Original) neu
  gezogen → jedes Band bleibt 4-verbunden und lückenlos. In Ruhe (alle Versätze 0, z. B. Frame 0) wird das Original-Band gezeichnet.
* Blinzeln (zweimal je Schleife, Frames 13–15 und 37–39: halb – zu – halb): die roten Augenpixel (je 3) werden zur Haubenfarbe. Lidfarbe = umgebende Körperfarbe.
Frame: Sprite plus 4 px links/rechts/unten, 4 px oben, Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A
import anim_shard as SH

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10          # große Arbeitsleinwand (Bänder schlackern weit); am Ende wird auf die Figur zugeschnitten (RAND px Abstand)
RAND = 3

spr = L.lade('soul-shard-ba')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)
UMRISS = (0, 0, 0)
BAND_UMRISS = (12, 12, 12)

# ── Zerlegung: sechs Bänder + Körper (Haube + Rippenkorb) ──
_Y, _X = np.mgrid[0:sh, 0:sw]
LAB = np.zeros((sh, sw), int)


def _put(k, m):
    LAB[m & OPAK & (LAB == 0)] = k


_put(1, (_Y >= 9) & (_Y <= 15) & (_X <= 5))
_put(2, (_Y >= 9) & (_Y <= 15) & (_X >= 34))
_put(5, ((_Y >= 28) & (_X <= 13)) | ((_Y == 27) & (_X >= 12) & (_X <= 13)))
_put(3, (_Y >= 18) & (_Y <= 27) & (_X <= 12) & ~((_Y <= 20) & (_X >= 11)))
_put(4, (_Y >= 18) & (_Y <= 25) & (_X >= 25) & ~((_Y <= 20) & (_X <= 28)))
_put(6, (_Y >= 26) & (_X >= 24))
WURZEL = {1: (10, 5), 2: (10, 34), 3: (23, 12), 4: (23, 25), 5: (28, 13), 6: (26, 24)}        # (y, x) eines Kernpixels am Körper
GLIEDER = {k: SH.GliedKette(spr, [(int(y), int(x)) for y, x in zip(*np.nonzero(LAB == k))], WURZEL[k], umriss=BAND_UMRISS) for k in WURZEL}
KOERPER = spr.copy(); KOERPER[LAB > 0] = 0

# Schlackern je Band: jedes Band ist eine Gelenkkette aus starren Abschnitten (Oberarm, Unterarm, Hand — die Gelenke liegen an den Knicken des Bandes, `GELENKE` = Frontnummern ab der Wurzel).
# Der Drehwinkel jedes Abschnitts = Winkel des vorigen + eigene Beugung (Amplitude A[k] in rad); jede Beugung schwingt mit der Hauptschwingung (p1 Schwingungen je Schleife, Phase ph1) und einer
# zweiten, schnelleren (p2, ph2, Anteil a2), die Phase hinkt je Gelenk um `lag` hinterher (läuft wie eine Peitsche durch den Arm) → die Bänder schlackern wie schlaffe Arme, ohne ihre Länge zu ändern.
# pos/neg dämpfen die Drehrichtung (pos = im Uhrzeigersinn), damit die unteren Bänder nicht in den Körper schwingen.
GELENKE = {1: [0, 3], 2: [0, 3], 3: [0, 4, 8, 12], 4: [0, 4, 8], 5: [0, 3], 6: [0, 3]}
SCHWUNG = {
    1: dict(A=[0.28, 0.36], p1=3, ph1=0.0, lag=0.9, p2=5, ph2=1.0, a2=0.40),
    2: dict(A=[0.28, 0.36], p1=3, ph1=2.6, lag=0.9, p2=5, ph2=3.8, a2=0.40),
    3: dict(A=[0.15, 0.20, 0.22, 0.22], p1=2, ph1=1.0, lag=0.8, p2=4, ph2=0.4, a2=0.40),
    4: dict(A=[0.15, 0.20, 0.22], p1=2, ph1=4.1, lag=0.8, p2=4, ph2=2.9, a2=0.40),
    5: dict(A=[0.30, 0.38], p1=3, ph1=4.2, lag=0.9, p2=5, ph2=0.2, a2=0.40, pos=1.0, neg=0.15),      # Schwanz links unten: schwingt nach außen (links), kaum in den Körper hinein
    6: dict(A=[0.30, 0.38], p1=4, ph1=0.7, lag=0.9, p2=6, ph2=2.2, a2=0.40, pos=0.15, neg=1.0),      # Haken rechts unten: schwingt nach außen (rechts)
}

# ── Zeitachsen ──
S = []
for _i in range(N):
    _v = math.sin(2 * math.pi * _i / 24)
    S.append(2 if _v >= 0.9 else 1 if _v >= 0.35 else 0)
POSEN = {0: {}, 1: {27: 1}, 2: {27: 1, 29: 1}}                                                                      # s → eingefügte Zeilen (Rippenkorb, unterhalb der Schultern)
assert S[0] == 0
_ext = [(int(np.nonzero(KOERPER[y, :, 3])[0].min()), int(np.nonzero(KOERPER[y, :, 3])[0].max())) for y in range(sh) if KOERPER[y, :, 3].any()]
for _s, _d in POSEN.items():
    for _y in _d:
        assert abs(_ext[_y][0] - _ext[_y - 1][0]) <= 2 and abs(_ext[_y][0] - _ext[_y + 1][0]) <= 3 and _ext[_y][1] == _ext[_y - 1][1] == _ext[_y + 1][1], ('Einfügezeile mit Randstufe', _y, _ext[_y - 1:_y + 2])

# ── Lachen: zwei Ausbrüche je Schleife (Frames 4–19 und 28–43), je vier „Ha“ à 4 Frames (260 ms): Maul offen → halb → fast zu → halb,
#    der Kopf bebt im Takt (Atemzeilen S 1 → 1 → 0 → 0 im Rippenkorb, Kopf hebt/senkt sich um 1 px), die Augen kneifen beim „zu“, die Bänder schlackern stärker ──
LACH_START = (4, 28)
LACH_LEN = 16
KIEFER = [0] * N                       # Kieferhub je Frame (0 offen = Original, 1 halb, 2 fast zu)
KNEIF = set()                          # Frames, in denen die Augen kneifen (obere Augenzeile zu)
ENV = [0.0] * N                        # Anteil „Lachen“ (für die Bandamplitude)
for _s0 in LACH_START:
    for _k in range(LACH_LEN):
        _i = _s0 + _k
        _c = _k % 4
        KIEFER[_i] = (0, 1, 2, 1)[_c]
        S[_i] = (1, 1, 0, 0)[_c]
        if _c == 2:
            KNEIF.add(_i)
        ENV[_i] = 1.0
    for _k in range(-2, 0):                                    # sanftes Anlaufen/Abklingen der Bandamplitude
        ENV[(_s0 + _k) % N] = max(ENV[(_s0 + _k) % N], 0.5)
    for _k in range(LACH_LEN, LACH_LEN + 2):
        ENV[(_s0 + _k) % N] = max(ENV[(_s0 + _k) % N], 0.5)

# ── Maul: unterer Kiefer (Sprite-Koordinaten). Die rote Öffnung liegt in x 17–22, y 12–16, oben von den Reißzähnen (17,12–13)/(22,12–13) eingefasst, unten die
#    kleinen Zähne (18,15–16)/(21,15–16) und die schwarze Unterlippe (18–21,17). Beim „Schließen“ steigt der untere Teil (Zeilen 15–17, Spalten 18–21: Zähne, Rachen, Lippe) starr um d nach oben,
#    die obere Öffnung (Zeilen 12–14) schrumpft; die freigewordenen Felder darunter bekommen das Schachbrettmuster F/H der Haubenhaut (wie Zeile 18). ──
MAUL_X = range(18, 22)
HAUT = {0: tuple(int(v) for v in spr[18, 18, :3]), 1: tuple(int(v) for v in spr[18, 19, :3])}          # Haubenhaut (H / F) je Parität x+y
assert all(tuple(int(v) for v in spr[18, x, :3]) == HAUT[(x + 18) % 2] for x in range(17, 22))
MAUL_RAND = (0, 0, 0)


def maul(fig, top, d):
    """Kiefer um d (0–2) anheben. fig: Leinwand; top: Zeile des Sprite-Kopfes."""
    if d == 0:
        return fig
    out = fig.copy()
    for x in MAUL_X:
        for y in range(15, 18):
            out[top + y - d, PAD_L + x] = spr[y, x]
        for y in range(18 - d, 18):
            out[top + y, PAD_L + x, :3] = HAUT[(x + y) % 2]
            out[top + y, PAD_L + x, 3] = 255
    if d == 2:                                                       # Seitenwände: die Lippenecke liegt jetzt eine Zeile höher
        for x in (17, 22):
            out[top + 15, PAD_L + x, :3] = MAUL_RAND
            out[top + 16, PAD_L + x, :3] = HAUT[(x + 16) % 2]
    return out


# ── Augen und Lidfarben ──
AUGEN = [(5, 15), (6, 15), (6, 16), (5, 24), (6, 24), (6, 23)]                                                                      # (y, x) der Augenpixel
LID_AUS = {(255, 0, 0), (130, 0, 0), (0, 0, 0), (12, 12, 12)}                                                                   # Farben, die nie als Lidfarbe dienen (Umriss, Augenfarben)
BLINK = {13: 1, 14: 2, 15: 1, 37: 1, 38: 2, 39: 1}                                                                      # Frame → Stufe (1: obere Augenzeile, 2: alle)
for _i in KNEIF:
    BLINK.setdefault(_i, 1)


def _winkel(k, i):
    """Absolutwinkel je Abschnitt von Band k in Frame i (Frame 0 = Ruhe, exakt 0)."""
    c = SCHWUNG[k]
    m = 1.0 + 0.55 * ENV[i]

    def g(ii, j):
        return (math.sin(2 * math.pi * c['p1'] * ii / N + c['ph1'] - c['lag'] * j)
                + c['a2'] * math.sin(2 * math.pi * c['p2'] * ii / N + c['ph2'] - 1.5 * c['lag'] * j))
    out, acc = [], 0.0
    for j, a in enumerate(c['A']):
        acc += m * a * (g(i, j) - g(0, j))
        out.append(acc * (c.get('pos', 1.0) if acc > 0 else c.get('neg', 1.0)))
    return out


def baender(i, top, quelle):
    """Alle sechs Bänder (RGBA-Ebene): jedes ein schlaffer Arm, der um seine Wurzel schlackert (Frame 0 = Original). Jedes Band sitzt so hoch wie die Körperzeile,
    an der seine Wurzel hängt (die Körperzeilen heben sich je nach eingefügten Atemzeilen unterschiedlich weit)."""
    e = L.leer(H, W)
    for k, g in GLIEDER.items():
        v = g.verschiebung_pixel(GELENKE[k], _winkel(k, i))
        oy = top + quelle.index(WURZEL[k][0]) - WURZEL[k][0]
        e = L.zusammen(H, W, [(e, 0, 0), (g.zeichne_pixel(H, W, oy, PAD_L, v), 0, 0)])
    return e


_CACHE = {}


def figur_voll(i):
    if i in _CACHE:
        return _CACHE[i]
    ebene, top, quelle = SH.ebene_atmung(KOERPER, POSEN[S[i]], H, W, PAD_L, PAD_T, BODEN)
    fig = L.zusammen(H, W, [(baender(i, top, quelle), 0, 0), (ebene, 0, 0)])
    fig = maul(fig, top, KIEFER[i])
    if i in BLINK:
        ymin = min(y for (y, x) in AUGEN)
        pix = [(top + y, PAD_L + x) for (y, x) in AUGEN if BLINK[i] == 2 or y == ymin]
        fig = SH.lid(fig, pix, LID_AUS, eigen={(top + y, PAD_L + x) for (y, x) in AUGEN})
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    fig, brueck = A.verbinde4(fig)
    fig, pfad, offen = A.verbinde_luecken(fig, 3)
    _CACHE[i] = dict(fig=fig, top=top, quelle=quelle, neu=neu, brueck=brueck, pfad=pfad, offen=offen)
    return _CACHE[i]


_BOX = []


def box():
    """Zuschneidebox (y0, y1, x0, x1) über ALLE Frames, RAND px Abstand zur Figur."""
    if not _BOX:
        a = np.stack([figur_voll(i)['fig'][..., 3] > 0 for i in range(N)])
        ys = np.nonzero(a.any(axis=(0, 2)))[0]
        xs = np.nonzero(a.any(axis=(0, 1)))[0]
        _BOX.extend([int(ys.min()) - RAND, int(ys.max()) + RAND + 1, int(xs.min()) - RAND, int(xs.max()) + RAND + 1])
        assert _BOX[0] >= 0 and _BOX[2] >= 0 and _BOX[1] <= H and _BOX[3] <= W, ('Arbeitsleinwand zu klein', _BOX, H, W)
    return _BOX


def figur(i):
    d = dict(figur_voll(i))
    y0, y1, x0, x1 = box()
    d['fig'] = d['fig'][y0:y1, x0:x1].copy()
    return d


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    figs = [f['fig'] for f in fs]
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    y0, y1, x0, x1 = box()
    ref = L.platz(spr, H, W, PAD_L, PAD_T)[y0:y1, x0:x1]
    print('Zuschneidebox (y0,y1,x0,x1):', box(), '→ Frame', frames[0].shape[1], '×', frames[0].shape[0])
    print('Frame 0 weicht vom Original in', int((figs[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Brückenpixel je Frame:', [len(f['brueck']) for f in fs], '| Pfadpixel:', [len(f['pfad']) for f in fs], '| unverbundene Teile:', [f['offen'] for f in fs if f['offen']])
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    schlecht = A.ausdruck_pruefen(figs, spr, 'soul-shard-ba')
    L.speichern('soul-shard-ba', 'Soul Shard Ba', frames, MS, prev)
    if prev:
        L.streifen(prev + '/soul-shard-ba-strip.png', frames[::2], spalten=12, scale=6)
