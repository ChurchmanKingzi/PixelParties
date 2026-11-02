# -*- coding: utf-8 -*-
"""Idle-Animation für „The Thing in the Ship“ (Creature) — Runde 2: das schwarze Loch gehört jetzt zum Sprite, jeder Tentakel schwingt unabhängig.

PICK: [["MotiveIndia", 390, 2], ["MotiveIndia", 395, "Loch 16×24 bei (444,243) der Ebene 'Ebene #2'"]]
  * Ebene „The Thing in the Hull“ (MotiveIndia.xcf, Ebene 390, Figur 2 = Bereich x 30–58, y 3–32 der Ebene, nur Alpha 0/255): zwei rote Augen + zwei Tentakelgruppen (zugeschnitten 27×28 px, 6 Farben). Per Pixelvergleich gegen die
    Kartenkunst (data/card-art/native/The_Thing_in_the_Ship.png, 76×51) abgeglichen: die Figur sitzt dort bei (24,16). Die Ebene selbst enthält außerdem vier Mondsichel-Stücke und lose rote Punkte (gehören nicht zu dieser Figur).
  * Das Schwarze der Karte (Nutzer: „das Loch, aus dem die Tentakel kommen“) ist KEIN Teil dieser Ebene, sondern ein schwarzes Fenster der Schiffswand auf einer Nachbarebene: MotiveIndia.xcf, Ebene 395 („Ebene #2“, ein Fensterrechteck mit braunem Sims,
    Bereich um (444,243)): ein Rechteck aus 16×24 Pixeln in der Karten-Dunkelfarbe H=(25,20,25) (die sichtbare Schwesterebene 394 „Ebene #45“ hat dasselbe Rechteck in Reinschwarz (0,0,0); die Kartenkunst zeigt (25,20,25)). Es sitzt in der Kartenkunst
    bei x 30–45, y 12–35, also im Sprite (Ursprung (24,16)) bei x 6–21, y −4…19: die Augen liegen 4 Zeilen unter seiner Oberkante, die Tentakel hängen vor/neben ihm und ragen unten heraus. Der braune Sims unter dem Fenster (in der Kartenkunst
    von den Tentakeln verdeckt) und die Schiffswand bleiben weg.
  → src/the-thing-in-the-ship.png = Figur (27×28) um 4 Zeilen nach unten gesetzt (Sprite jetzt 27×32) + dieses Rechteck (x 6–21, y 0–23) dahinter; Aufbau des Sprites (einmalig, so entstanden):
        out[0:24, 6:22] = (25,20,25); out[4:, :][figur_alpha] = figur
Nicht verwendet: die gekreuzten Schwerter, die Schiffswand und die übrigen Kartendekorationen.

Aufruf:   python3 the_thing_in_the_ship.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/the-thing-in-the-ship.png + .json

Was im Sprite ist (Koordinaten im Sprite 27×32, x/y ab 0):
* Das Loch: ein ruhiges, dunkles Rechteck H=(25,20,25) (x 6–21, y 0–23), in dem das Wesen lauert.
* Zwei leuchtend rote Augen (je 4×4-Kreis, Ring E=(94,0,0), Kern 2×2 F=(173,0,0), x 8–11 und 16–19, y 4–7) im Loch.
* Vier Tentakel (Violettgrau A=(56,22,49) Umriss, B=(88,57,68), C=(135,103,116), D=(189,165,173) Lichter; Zeilen 9–31): links außen LO (oben ein Haken über dem Loch, dann ein langer gebogener Arm x 0–4, Zeilen 14–23),
  links innen LI (Zeilen 14–31, x 5–11, am Ende nach links gebogen), rechts innen RI (Zeilen 14–30, x 14–21) und rechts außen RO (oben ein Haken, dann ein Arm bis x 26, Zeilen 9–25). Die inneren Tentakel hängen unter dem Haken der äußeren am Loch.
* Material: Fleisch/Tentakel — KEIN Glanz, keine Glitzersterne (Regel 14); kein Feuer (Regel 15).
Fest bleiben: das Loch, die Augen (außer beim Blinzeln), die Wurzeln (Haken und obere Zeilen) der Tentakel.

Ablauf (72 Frames à 70 ms = 5,04 s, nahtlos):
* Jeder der vier Tentakel schwingt ganz für sich (eigene Periode UND eigene Phase): LO Periode 36 Frames, LI 24, RI 72, RO 18. Der Versatz (Zeilen werden als Ganzes waagerecht verschoben, nie kopiert) wächst von der Wurzel (0 px) zur Spitze
  (bis ±4 px) mit Nachlauf (die Spitze hinkt hinterher); dazu kommt ein schnelleres kleines Zucken der Spitze (Periode 12/9 Frames, ±1 px, nur das untere Drittel). Frame 0 = Original. Wo zwei Nachbarzeilen eines Tentakels bei verschiedenem Versatz nicht mehr 4-verbunden wären,
  teilen sie sich den Versatz (jeder Tentakel bleibt ein 4-verbundenes Teil). Äußere Tentakel liegen hinter den inneren (wo sie sich kreuzen, verdeckt der innere den äußeren), das Loch liegt hinter allen.
* Blinzeln (zweimal je Schleife, Frames 14–18 und 50–54: halb – Linie – zu – Linie – halb): beide Augen gemeinsam; Lid = Farbe des Lochs (das Auge „schließt“ sich ins Dunkel): halb = die Kreiszeilen 0 und 3 entfallen (4×2), Linie = nur Kreiszeile 1 in Ringrot E,
  zu = ganz verschwunden. Nur Augenpixel, nur Farben der Quelle.
Ergänzungen (Regel 16): wo beim Zeilenversatz ein Füllpixel (B/C/D) frei am Rand liegt, weil die Nachbarzeile weggerutscht ist, bekommt das leere Nachbarfeld den Tentakelumriss A=(56,22,49) (A.umriss_ergaenzen, je Frame
  einige Pixel; Frame 0 keine). Das Loch ist ein Rechteck der Quelle.
Frame: Sprite plus 6 px links/rechts (die Tentakelspitzen schwingen bis 4 px nach außen), 3 px oben und unten — Figur zentriert.
Alle Bewegungen laufen auf der vollen Leinwand (ClipError bei Überlauf). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_amorph as A

N, MS = 72, 70
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 3, 3

spr = L.lade('the-thing-in-the-ship')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OPAK = spr[..., 3] > 0
LOCH_F = (25, 20, 25)
UMRISS = (56, 22, 49)                                                                 # A: Tentakelumriss
RING = (94, 0, 0)                                                                     # E: Ring der Augen
LOCH = np.zeros((sh, sw), bool)
LOCH[0:24, 6:22] = True                                                               # das Fenster/Loch
assert (spr[LOCH][:, 3] > 0).all()
RAND_FARBEN = A.umrissfarben(spr)
FIGUR = OPAK & ~((spr[..., :3] == np.array(LOCH_F)).all(axis=2) & LOCH)               # alles, was kein reines Lochpixel ist (Tentakel + Augen)

_n, _lab = cv2.connectedComponents(FIGUR.astype(np.uint8), connectivity=8)
_groessen = {k: int((_lab == k).sum()) for k in range(1, _n)}
assert sorted(_groessen.values()) == [12, 12, 160, 167], _groessen
GRP = {}
for _k, _g in _groessen.items():
    ys, xs = np.nonzero(_lab == _k)
    GRP[('augeL' if xs.mean() < sw / 2 else 'augeR') if _g == 12 else ('L' if xs.mean() < sw / 2 else 'R')] = (_lab == _k)

yy, xx = np.mgrid[0:sh, 0:sw]
# ── die vier Tentakel (Schnitt entlang der gemeinsamen Umrisse, siehe Docstring) ──
_RO_X0 = {15: 20}                                                                     # rechts außen: erste Spalte je Zeile ab Zeile 15 (sonst 21, ab Zeile 24 → 22)
_ro = np.zeros((sh, sw), bool)
for _y in range(sh):
    if _y <= 14:
        _ro[_y] = GRP['R'][_y] & (xx[_y] >= 18)                                       # Haken + Kopf des Außenarms
    else:
        _x0 = _RO_X0.get(_y, 22 if _y >= 24 else 21)
        _ro[_y] = GRP['R'][_y] & (xx[_y] >= _x0)
T = {
    'LO': GRP['L'] & ((yy <= 13) | ((xx <= 4) & (yy <= 23)) | ((xx == 7) & (yy == 14))),                  # Haken + Außenarm (+ das Pixel (7,14) unter dem Haken)
    'RO': _ro,
}
T['LI'] = GRP['L'] & ~T['LO']
T['RI'] = GRP['R'] & ~T['RO']
assert sum(int(m.sum()) for m in T.values()) == int(GRP['L'].sum() + GRP['R'].sum())
for _k, _m in T.items():
    assert A.komponenten4(_m) == 1, (_k, A.komponenten4(_m))
WURZEL = {'LO': 14, 'RO': 14, 'LI': 15, 'RI': 14}                                     # bis hierher (einschl.) fest; darunter wächst der Versatz
# ── Bewegung je Tentakel: Periode (Frames), Phase, Amplitude (px an der Spitze), Nachlauf ──
BEW = {
    'LO': dict(per=36, phi=0.0, amp=1.9, lag=1.0, zuck=(12, 0.7)),
    'LI': dict(per=24, phi=2.6, amp=1.9, lag=1.1, zuck=(9, 0.6)),
    'RI': dict(per=72, phi=3.7, amp=2.0, lag=1.2, zuck=(12, 0.7)),
    'RO': dict(per=18, phi=0.5, amp=1.8, lag=0.9, zuck=(9, 0.6)),
}
INNEN = {'LO': 1, 'LI': 1, 'RI': -1, 'RO': -1}                                           # Richtung (Vorzeichen von dx) zur Mitte des Lochs
BLINK = {14: 1, 15: 2, 16: 3, 17: 2, 18: 1, 50: 1, 51: 2, 52: 3, 53: 2, 54: 1}       # 1 = halb (Kreiszeilen 1–2), 2 = Linie (Kreiszeile 1), 3 = zu


def _dx(name, i):
    """Versatz je Quellzeile eines Tentakels: Wurzel fest, nach unten wachsend; Frame 0 überall 0; Nachbarzeilen bleiben 4-verbunden."""
    b = BEW[name]
    m = T[name]
    ys = np.nonzero(m.any(axis=1))[0]
    y_w, y_b = WURZEL[name], int(ys.max())
    ph = 2 * math.pi * i / b['per']
    zp = 2 * math.pi * i / b['zuck'][0]
    dx = [0] * sh
    for y in range(y_w + 1, y_b + 1):
        f = (y - y_w) / float(y_b - y_w)
        w = f ** 1.25
        lag = b['lag'] * f
        haupt = b['amp'] * w * (math.sin(ph + b['phi'] - lag) - math.sin(b['phi'] - lag))
        zuck = 0.0
        if f > 0.6:
            g = (f - 0.6) / 0.4
            zuck = b['zuck'][1] * g * (math.sin(zp + b['phi'] * 2 - 2 * lag) - math.sin(b['phi'] * 2 - 2 * lag))
        c = haupt + zuck
        if c * INNEN[name] > 0:                                                       # Bewegung zum Nachbartentakel hin wird gedämpft, damit sich die Tentakel nicht durchkreuzen
            c *= 0.5
        dx[y] = int(round(c))
    # von oben nach unten: fehlt die 4-Verbindung zur Zeile darüber, übernimmt die Zeile deren Versatz; höchstens 1 px Sprung je Zeile
    for y in range(y_w + 1, y_b + 1):
        if not m[y].any() or not m[y - 1].any():
            continue
        if abs(dx[y] - dx[y - 1]) > 1:
            dx[y] = dx[y - 1] + (1 if dx[y] > dx[y - 1] else -1)
        a = {int(x) + dx[y - 1] for x in np.nonzero(m[y - 1])[0]}
        c = {int(x) + dx[y] for x in np.nonzero(m[y])[0]}
        if not (a & c):
            dx[y] = dx[y - 1]
    return dx


def tentakel(name, i):
    dx = _dx(name, i)
    out = L.leer(H, W)
    m = T[name]
    for y in range(sh):
        for x in np.nonzero(m[y])[0]:
            X = PAD_L + int(x) + dx[y]
            if not 0 <= X < W:
                raise L.ClipError('Tentakel aus der Leinwand')
            out[PAD_T + y, X] = spr[y, x]
    return out


def augen(i):
    out = L.leer(H, W)
    stufe = BLINK.get(i, 0)
    for name in ('augeL', 'augeR'):
        m = GRP[name]
        y0 = int(np.nonzero(m.any(axis=1))[0].min())
        for y in range(sh):
            for x in np.nonzero(m[y])[0]:
                ry = y - y0                                                         # 0..3
                if stufe == 1 and ry in (0, 3):
                    continue
                if stufe == 2 and ry != 1:
                    continue
                if stufe == 3:
                    continue
                out[PAD_T + y, PAD_L + int(x)] = spr[y, x]
                if stufe:
                    out[PAD_T + y, PAD_L + int(x), :3] = RING                       # verengte Augen zeigen nur den dunkelroten Ring (der helle Kern lag in der Mitte, nie am Rand)
    return out


def loch():
    return L.platz(np.where(LOCH[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


def figur(i):
    teile = {n: tentakel(n, i) for n in T}
    fig = L.zusammen(H, W, [(loch(), 0, 0), (teile['LO'], 0, 0), (teile['RO'], 0, 0), (teile['LI'], 0, 0), (teile['RI'], 0, 0), (augen(i), 0, 0)])
    # Regel 16: wo beim Zeilenversatz ein Füllpixel (B/C/D) frei am Rand liegt (die Nachbarzeile ist weggerutscht), bekommt das leere Nachbarfeld den Umriss A
    fig, neu = A.umriss_ergaenzen(fig, RAND_FARBEN, lambda x, y: UMRISS)
    return dict(fig=fig, teile=teile, neu=neu)


def frame(i):
    return figur(i)['fig']


if __name__ == '__main__':
    fs = [figur(i) for i in range(N)]
    frames = [f['fig'] for f in fs]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    ref = L.platz(spr, H, W, PAD_L, PAD_T)
    print('Frame 0 weicht vom Original in', int((frames[0] != ref).any(axis=2).sum()), 'Pixeln ab')
    print('ergänzte Umrisspixel je Frame:', [len(f['neu']) for f in fs])
    print('Tentakelgrößen (Pixel):', {k: int(m.sum()) for k, m in T.items()}, '| Loch', int(LOCH.sum()))
    # jeder Tentakel bleibt ein 4-verbundenes Teil, in jedem Frame
    for n in T:
        ks = sorted({A.komponenten4(f['teile'][n][..., 3] > 0) for f in fs})
        print(f'  {n}: 4-Komponenten je Frame {ks}, größter Versatz {max(abs(v) for i in range(N) for v in _dx(n, i))} px')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame (schwankt, weil Tentakel sich überdecken können):', sorted(set(n)))
    L.speichern('the-thing-in-the-ship', 'The Thing in the Ship', frames, MS, prev)
    if prev:
        L.streifen(prev + '/the-thing-in-the-ship-strip.png', frames[::3], spalten=12, scale=6)
