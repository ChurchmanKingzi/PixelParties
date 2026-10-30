# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Reaper“ (Creature).

Quelle: src/skeleton-reaper.png — Ebene „Skeleton Reaper“ (38×40 px, 29 Farben, 499 Pixel) aus Motive.xcf (Ebene 808, Figur 1, eine einzige Figur; Treffer 1.0).
PICK: [["Motive", 808, 1]]

Aufruf:   python3 skeleton_reaper.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-reaper.png + .json

Was ist was (x/y im Sprite):
* Kapuze (x 4–14, y 0–8): schwarz mit grauen Lichtkanten (28,28,28)/(21,21,21), oben eine nach rechts eingerollte Spitze; die Aussparung (11,3) (11,4) (12,5) ist die
  Kapuzenöffnung (transparent, bleibt so). Mantel (x 0–17, y 9–18): schwarz, zwei Ärmel (links x 0–5 mit grauer Knochenhand bei (2,16) (2,17); rechts x 13–17 greift die Sense),
  Saum y 16–18. Ein einzelnes dunkelrotes Pixel (105,0,0) bei (7,11) mitten im Mantel = das rote AUGE/Glutpunkt der Gestalt (Deutung: Auge, das tief im Mantel sitzt).
* Beine (x 4–15, y 19–26): graue Knochen mit Lücke zwischen den Beinen (y 22–23), Füße y 24–26.
* SENSE (Metall, darf glänzen — Regel 12/14): brauner Stiel (33,23,16)/(17,12,8) von der rechten Hand (13,15) schräg nach rechts unten bis zur Zwinge (35–37, 20–21);
  die große Klinge ist ein Bogen: Spitze (31,5), die Kante läuft an der rechten Seite bis (35,20) und schwingt dann nach links unten bis (2,39) (Farben weiß (246,246,246),
  (213,213,213), (189,189,189), Schatten (106,106,106), (82,82,82), (65,65,65), (41,41,41)). Der Stiel ist eine dünne, nur diagonal verbundene Pixelreihe wie in der Quelle
  und bleibt deshalb starr (kein Scheren).
Fest bleiben: Kapuzenform, Beinform, Klingenform, Stielform.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, Partikel und Glanz ausgenommen):
* Atmen zweistufig 0-1-2-1-0 px (Periode 24): die Mantelzeile y 14 wird 1–2× eingefügt, Kapuze, Schultern und Oberarme heben sich, Hand, Saum, Beine und Füße bleiben am Boden.
  Die Kapuzenkuppe atmet 3 Frames später zusätzlich 1 px (Zeile y 6 wird eingefügt; die Kapuzenöffnung wandert mit).
* Mantelsaum (y 16–18) wiegt sich: Zeilenversatz bis 1 px, unten stärker, mit Nachlauf (Periode 12, Hüllkurve zweimal pro Schleife; die breite Zeile y 18 überlappt die Beine immer).
* Blinzeln: das rote Augenpixel wird 3 Frames lang schwarz (Mantelfarbe (4,4,4); Lid = umgebende Körperfarbe), zweimal pro Schleife (Frame 14–16 und 37–39). Sonst kein Glühen.
* SENSE wippt starr: sie hebt sich 0-1-2-1-0 px (Periode 16, drei Hübe pro Schleife) mit der Hand mit; hinter dem Griff steht schwarzer Mantel (ERGÄNZUNG).
* Glanz auf der Klinge (Metall): ein Lichtband (Breite ~3 px, jede getroffene Pixelfarbe eine Stufe heller auf der Rampe (41→65→82→106→189→213→246)) läuft vom unteren Ende
  der Klinge zur Spitze (Lauf 16 Frames, zweimal pro Schleife ab Frame 3 und 27); wenn es die Spitze erreicht, blitzt dort ein vierzackiger Glitzerstern auf (Mitte (246,246,246),
  Arme (213,213,213); 3 Frames, Arme 1 → 2 → 1 px) und geht mit der Sense mit.
* Nebelwölkchen (Partikel, hinter der Figur, 8 Stück, Lebensdauer 48 Frames, langsam aufsteigend, leichtes Wabern, wachsen/schrumpfen, Formen m, o): dunkle Schwaden
  (Kern (28,28,28), Rand (65,65,65)) steigen am Saum, an den Füßen und neben der Kapuze auf. Sie bleiben nah an der Figur (Zuschnitt, s. u.).
Regel 14: Glanz nur auf der Klinge (Metall), nicht auf Knochen/Stoff. Regel 15 entfällt (kein Feuer).
Randpixel-Test (Regel 16): `U.kontur_schliessen` setzt in jeder Pose fehlende Umrisspixel (Schwarz) am wiegenden Saum und an den Ärmeln; im Ruhebild ändert es nichts.
ERGÄNZUNG: schwarze Mantelpixel (4,4,4) hinter dem Griff bei (13–19,15) und (15,16) (dort liegen im Ruhebild die Stielpixel), sichtbar sobald die Sense steigt. Sonst nichts gemalt.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (symmetrisch um die Ruhefigur; Partikel und Stern vergrößern ihn höchstens 2 px über den Figurenrand hinaus, dazu 1 px leerer Rand).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U

N, MS = 48, 65
GPL, GPR, GPT, GPB = 8, 8, 10, 6

spr = L.lade('skeleton-reaper')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])

SCHWARZ = (4, 4, 4)
AUGE = (7, 11)
AUGE_ROT = (105, 0, 0)
assert col(*AUGE) == AUGE_ROT
BRAUN = {(33, 23, 16), (17, 12, 8), (35, 25, 18), (65, 46, 32), (102, 73, 51), (3, 2, 2)}
ist_braun = np.array([[bool(vorhanden[y, x]) and col(x, y) in BRAUN for x in range(sw)] for y in range(sh)])
sense = vorhanden & ((yy >= 27) | (xx >= 19) | (ist_braun & (xx >= 13)))
klinge = sense & ~ist_braun
koerper = vorhanden & ~sense
assert sense.sum() + koerper.sum() == vorhanden.sum()
UMRISS = U.umrissfarben(spr)
GRIFF = [(x, y) for y in range(sh) for x in range(sw) if sense[y, x] and ist_braun[y, x] and x <= 19 and y <= 16]      # Stielpixel im Handbereich
GRIFF_SET = set(GRIFF)
RAMPE = {(41, 41, 41): (65, 65, 65), (65, 65, 65): (82, 82, 82), (82, 82, 82): (106, 106, 106), (106, 106, 106): (189, 189, 189), (189, 189, 189): (213, 213, 213),
         (213, 213, 213): (246, 246, 246)}
assert all(c in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for c in RAMPE)
SPITZE = (31, 5)
ZENTRUM = (12.0, 16.0)                                 # Mittelpunkt des Klingenbogens (Näherung)
WINKEL = {}
for y, x in zip(*np.nonzero(klinge)):
    WINKEL[(int(x), int(y))] = math.degrees(math.atan2(y - ZENTRUM[1], x - ZENTRUM[0]))
W_MIN, W_MAX = min(WINKEL.values()), max(WINKEL.values())
BAND_START = (3, 27)                                    # zwei Läufe pro Schleife, je 16 Frames
BLINZ = {14, 15, 16, 37, 38, 39}
STERN_SPITZE = {(BAND_START[0] + 15 + k): v for k, v in enumerate((2, 3, 2))}
STERN_SPITZE.update({(BAND_START[1] + 15 + k): v for k, v in enumerate((2, 3, 2))})

NEBEL = {'c': (28, 28, 28), 'r': (65, 65, 65)}
assert all(v in {col(x, y) for y in range(sh) for x in range(sw) if vorhanden[y, x]} for v in NEBEL.values())
P = lambda x, y: (GPL + x, GPT + y)
PUFFS = [
    dict(x=P(2, 17)[0], y=P(2, 17)[1], vx=-1, vy=-9, off=0, form='m', wackeln=1),          # links am Saum
    dict(x=P(15, 19)[0], y=P(15, 19)[1], vx=1, vy=-8, off=20, form='o', wackeln=1),         # rechts am Saum
    dict(x=P(17, 10)[0], y=P(17, 10)[1], vx=2, vy=-6, off=10, form='m', wackeln=1),         # rechts neben der Schulter
    dict(x=P(12, 0)[0], y=P(12, 0)[1], vx=1, vy=-4, off=30, form='o', wackeln=1),           # neben der Kapuzenspitze
    dict(x=P(3, 25)[0], y=P(3, 25)[1], vx=-1, vy=-10, off=36, form='m', wackeln=1),         # an den Füßen links
    dict(x=P(14, 25)[0], y=P(14, 25)[1], vx=1, vy=-10, off=6, form='m', wackeln=1),         # … rechts
    dict(x=P(8, 24)[0], y=P(8, 24)[1], vx=0, vy=-12, off=26, form='o', wackeln=1),          # zwischen den Beinen
    dict(x=P(3, 9)[0], y=P(3, 9)[1], vx=-1, vy=-6, off=42, form='m', wackeln=1),            # links neben der Schulter
]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)                                        # Atmen 0-1-2-1-0
    r_c = U.stufe(i - 3, 24, 1)                                  # Kapuzenkuppe atmet 3 Frames später zusätzlich
    hump = U.buckel(i, 0, 24, n=24)                              # Hüllkurve des Saumwiegens (0 bei Frame 0)

    # --- Körper: Griff-Ergänzung (schwarz), Augenblinzeln, Kapuzenatem, Atmen, Saum wiegen ---
    kb = teil(koerper)
    for (x, y) in GRIFF:
        kb[GPT + y, GPL + x, :3] = SCHWARZ
        kb[GPT + y, GPL + x, 3] = 255
    if i in BLINZ:
        kb[GPT + AUGE[1], GPL + AUGE[0], :3] = SCHWARZ
    # Saum y 16–18 wiegt sich (Zeilenversatz, unten stärker, mit Nachlauf); die Griff-Ergänzung bleibt am Platz
    for k, y in enumerate((16, 17, 18)):
        dx = int(round(1.4 * hump * ((k + 1) / 3.0) * math.sin(2 * math.pi * (i - k) / 12)))
        if dx:
            row = kb[GPT + y].copy()
            kb[GPT + y] = 0
            for x in range(W):
                if row[x, 3]:
                    kb[GPT + y, x if (x - GPL, y) in GRIFF_SET else x + dx] = row[x]
    zk = GPT + 14
    if n:
        kb = L.streck_zeile(kb, zk, n)
    if r_c:
        kb = L.streck_zeile(kb, GPT + 6 - n, r_c)
    kb = U.kontur_schliessen(kb, UMRISS, SCHWARZ)                # Regel 16

    # --- Sense: starr, hebt sich mit 0-1-2-1-0 (Periode 16); Lichtband auf der Klinge ---
    sl = teil(sense)
    for start in BAND_START:
        j = i - start
        if 0 <= j <= 15:
            ang = W_MAX - (W_MAX - W_MIN) * j / 15.0              # Winkel des Bandes: läuft vom Ende (großer Winkel) zur Spitze
            for (x, y), a in WINKEL.items():
                if ang - 4.5 <= a <= ang + 4.5:
                    c = col(x, y)
                    if c in RAMPE:
                        sl[GPT + y, GPL + x, :3] = RAMPE[c]
    dy = -U.stufe(i, 16, 2)
    koerper_ges = L.zusammen(H, W, [(kb, 0, 0), (sl, 0, dy)])
    if nur == 'koerper':
        return koerper_ges
    sterne = L.leer(H, W)
    st = STERN_SPITZE.get(i, 0)
    if st:
        L.einsetzen(sterne, U.stern_ebene(H, W, GPL + SPITZE[0], GPT + SPITZE[1] + dy, st, (246, 246, 246), (213, 213, 213)))
    nebel = _glut(H, W, i, N, PUFFS, NEBEL)
    return L.zusammen(H, W, [(nebel, 0, 0), (koerper_ges, 0, 0), (sterne, 0, 0)])


_OHNE_PARTIKEL = [False]


def _glut(*a, **k):
    """Partikelebene (leer, wenn nur die Figur gerendert wird — für den Zuschnitt)."""
    if _OHNE_PARTIKEL[0]:
        return L.leer(a[0], a[1])
    return U.glut_ebene(*a, **k)


def _figur(i):
    _OHNE_PARTIKEL[0] = True
    try:
        return frame_gross(i, 'figur')
    finally:
        _OHNE_PARTIKEL[0] = False


# Zuschnitt auf die Figur: symmetrisch um die Ruhefigur; Partikel (und der Glitzerstern) dürfen den Frame höchstens 2 px über den Figurenrand hinaus vergrößern
def _koerper_ohne_stern(i):
    return frame_gross(i, 'koerper')


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [_koerper_ohne_stern(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('skeleton-reaper', 'Skeleton Reaper', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-reaper-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=4, scale=6)
