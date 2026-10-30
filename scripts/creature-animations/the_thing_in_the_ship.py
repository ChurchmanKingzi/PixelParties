# -*- coding: utf-8 -*-
"""Idle-Animation für „The Thing in the Ship“ (Creature).

PICK: [["MotiveIndia", 390, 2]]   Ebene „The Thing in the Hull“ (MotiveIndia.xcf, Ebene 390, Figur 2 = Bereich x 30–58, y 3–32 der Ebene, 29×30 px; nur Alpha 0/255) → src/the-thing-in-the-ship.png (zugeschnitten auf 27×28 px,
6 Farben, 351 Pixel). Per Pixelvergleich gegen die Kartenkunst (data/card-art/native/The_Thing_in_the_Ship.png, 76×51) abgeglichen: die Figur sitzt dort bei (24,16) mit 100 % Treffer (die Ebene selbst enthält
außerdem vier Mondsichel-Stücke und lose rote Punkte in anderen Zuständen/Lagen — sie gehören nicht zu dieser Figur). Nicht verwendet: das dunkle Schiffsfenster (der „Körper“ des Wesens ist der schwarze Hintergrund
der Karte), die gekreuzten Schwerter, die Schiffswand und die übrigen Kartendekorationen.

Aufruf:   python3 the_thing_in_the_ship.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/the-thing-in-the-ship.png + .json

Was im Sprite ist (Koordinaten im Sprite 27×28, x/y ab 0):
* Vier getrennte Teile (so steht es in der Ebene; das Wesen lauert im Dunkeln): zwei leuchtend rote Augen (je 4×4-Kreis, Ring E=(94,0,0), Kern 2×2 F=(173,0,0), x 8–11 und 16–19, y 0–3) und zwei Tentakelgruppen
  (links 160 px, rechts 167 px; Violettgrau A=(56,22,49) Umriss, B, C, D=(189,165,173) Lichter; Zeilen 5–27), die als „Flügel“ nach unten hängen (außen langer gebogener Arm, innen zweiter Arm).
* Material: Fleisch/Tentakel — KEIN Glanz und keine Glitzersterne (Regel 14); kein Feuer (Regel 15).
Fest bleiben: Umriss, Form der Arme (nur ganze Zeilen werden versetzt), Augen.

Ablauf (48 Frames à 65 ms = 3,12 s, nahtlos):
* Tentakel (Periode 24, rechts um ~46° versetzt zur linken Gruppe — rein gegenläufig würden sich die Gruppen berühren): jede Gruppe pendelt für sich — Zeilenversatz mit nach unten wachsendem Gewicht (oben am „Kopf“ fest, an den Spitzen ±2 px, die Spitze hinkt nach); wo zwei Nachbarzeilen
  einer Gruppe bei verschiedenem Versatz nicht 4-verbunden blieben, teilen sie sich den Versatz. Jede Gruppe bleibt ein 4-verbundenes Teil.
* Blinzeln (zweimal je Schleife, Frames 13–15 und 37–39: halb – Linie – halb): die Augen haben keinen Körper hinter sich (der Hintergrund ist leer, also keine Lidfarbe), deshalb verengen sie sich auf einen
  4×2-Streifen (Kreiszeilen 0 und 3 entfallen) und dann auf eine 4×1-Linie (nur Kreiszeile 1) und gehen wieder auf — nur Pixel der Augen, keine neuen Farben. Beide Augen blinzeln gemeinsam.
Ergänzungen: keine (Umriss und Verbindungen entstehen nur aus Zeilenversatz).
Frame: Sprite plus 4 px links/rechts (Pendeln ±2 + 2 px Rand), 2 px oben, 2 px unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib/anim_amorph werfen ClipError). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 2, 2

spr = L.lade('the-thing-in-the-ship')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
BODEN = PAD_T + sh - 1
OPAK = spr[..., 3] > 0
RAND_FARBEN = A.umrissfarben(spr)

import cv2  # noqa: E402

_n, _lab = cv2.connectedComponents(OPAK.astype(np.uint8), connectivity=8)
_groessen = {k: int((_lab == k).sum()) for k in range(1, _n)}
assert sorted(_groessen.values()) == [12, 12, 160, 167], _groessen
GRP = {}
for _k, _g in _groessen.items():
    ys, xs = np.nonzero(_lab == _k)
    name = ('augeL' if xs.mean() < sw / 2 else 'augeR') if _g == 12 else ('L' if xs.mean() < sw / 2 else 'R')
    GRP[name] = (_lab == _k)
Y_TOP = int(np.nonzero(GRP['L'].any(axis=1))[0].min())                               # oberste Zeile der Tentakelgruppen (5)
Y_BOT = int(np.nonzero(GRP['L'].any(axis=1))[0].max())

AMP = 1.0
PHASE_R = 0.8                                                                       # Phasenversatz der rechten Gruppe (gegenläufig würden sich die Gruppen berühren: Lücke nur 3 px)
LAG = 1.0
BLINK = {13: 1, 14: 3, 15: 1, 37: 1, 38: 3, 39: 1}                                   # 1 = halb (Kreiszeilen 1–2), 3 = Linie (Kreiszeile 1)


def _dx_gruppe(name, i):
    """Versatz je Quellzeile einer Tentakelgruppe: oben fest, nach unten wachsend; Frame 0 überall 0; Nachbarzeilen bleiben 4-verbunden."""
    phi = 0.0 if name == 'L' else PHASE_R
    m = GRP[name]
    ph = 2 * math.pi * i / 24
    dx = [0] * sh
    for y in range(Y_TOP, Y_BOT + 1):
        frac = ((y - Y_TOP) / float(Y_BOT - Y_TOP)) ** 1.3
        lag = LAG * frac
        dx[y] = int(round(AMP * frac * (math.sin(ph + phi - lag) - math.sin(phi - lag))))
    for y in range(Y_BOT - 1, Y_TOP - 1, -1):                                         # von unten nach oben: bei fehlender 4-Verbindung den Versatz der unteren Zeile übernehmen
        if dx[y] == dx[y + 1]:
            continue
        a = {int(x) + dx[y] for x in np.nonzero(m[y])[0]}
        b = {int(x) + dx[y + 1] for x in np.nonzero(m[y + 1])[0]}
        if not (a & b):
            dx[y] = dx[y + 1]
    # Gegenprobe von oben nach unten (die obere Zeile bleibt, die untere folgt notfalls)
    for y in range(Y_TOP + 1, Y_BOT + 1):
        a = {int(x) + dx[y - 1] for x in np.nonzero(m[y - 1])[0]}
        b = {int(x) + dx[y] for x in np.nonzero(m[y])[0]}
        if not (a & b):
            dx[y] = dx[y - 1]
    return dx


def figur(i):
    out = L.leer(H, W)
    # Tentakelgruppen: zeilenweise versetzen
    for name in ('L', 'R'):
        dx = _dx_gruppe(name, i)
        m = GRP[name]
        for y in range(sh):
            for x in np.nonzero(m[y])[0]:
                X = PAD_L + int(x) + dx[y]
                if not 0 <= X < W:
                    raise L.ClipError('Tentakel aus der Leinwand')
                out[PAD_T + y, X] = spr[y, x]
    # Augen: voll (4 Zeilen) → halb (Zeilen 1–2) → Linie (Zeile 1)
    stufe = BLINK.get(i, 0)
    for name in ('augeL', 'augeR'):
        m = GRP[name]
        ys = np.nonzero(m.any(axis=1))[0]
        y0 = int(ys.min())
        for y in range(sh):
            for x in np.nonzero(m[y])[0]:
                ry = y - y0                                                         # 0..3
                if stufe == 1 and ry in (0, 3):
                    continue
                if stufe == 3 and ry != 1:
                    continue
                out[PAD_T + y, PAD_L + int(x)] = spr[y, x]
    fig = out
    return dict(fig=fig)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    figs = [figur(i)['fig'] for i in range(N)]
    frames = figs
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    # die beiden Tentakelgruppen dürfen sich nie berühren (mindestens 1 leere Spalte zwischen ihnen in jeder Zeile)
    for i in range(N):
        dl, dr = _dx_gruppe('L', i), _dx_gruppe('R', i)
        for y in range(sh):
            if GRP['L'][y].any() and GRP['R'][y].any():
                gap = (np.nonzero(GRP['R'][y])[0].min() + dr[y]) - (np.nonzero(GRP['L'][y])[0].max() + dl[y]) - 1
                if gap < 1:
                    print('Gruppen berühren sich: Frame', i, 'Zeile', y, 'Lücke', gap)
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    print('4-Komp je Frame:', sorted({A.komponenten4(f[..., 3] > 0) for f in figs}), '(Original', A.komponenten4(OPAK), ')')
    L.speichern('the-thing-in-the-ship', 'The Thing in the Ship', frames, MS, prev)
    if prev:
        L.streifen(prev + '/the-thing-in-the-ship-strip.png', frames[::2], spalten=12, scale=8)
