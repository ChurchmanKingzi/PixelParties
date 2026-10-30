# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Bats“ (Creature) — Regeln 14/15/16 (Fledermäuse: kein Metall, kein Feuer → kein Glanz, keine Funken).

PICK: [["MotiveDeepsea", 121, 1], ["MotiveDeepsea", 121, 2]]
Quelle: src/deepsea-bats.png — die drei Fledermäuse der Kartenkunst in ihrer Anordnung (39×24 px, 4 Farben) aus MotiveDeepsea.xcf, Ebene 121 („Ebene #154“):
Figur 1 (V-Flügel, 19×10 px) kommt zweimal vor (oben links bei Kartenposition (16,14) und rechts bei (38,23)), Figur 2 (Flügel waagerecht, 18×10 px) einmal (unten bei (23,29)).
Alle drei Positionen wurden pixelgenau gegen die Kartenkunst abgeglichen (Farbabstand ≈ 4 = Kartenrauschen), alles vollständig deckend (Alpha nur 255). (Ebene 343 enthält dieselben Figuren, aber mit tieferliegenden Augen: passt nicht zur Karte.)
Das Skript zerlegt die Quelle über die drei 8-verbundenen Teile in die drei Fledermäuse.

Aufruf:   python3 deepsea_bats.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-bats.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; jede Fledermaus von vorn, Flügel = türkise Vorderkante (61,108,122)/(41,75,96) mit dunkelblauer Flughaut (21,34,57), weiße Augen (246,255,255)):
* A (oben links, x 0–15, y 0–8) und B (rechts, x 22–38, y 9–17): Flügel nach oben-außen (V-Haltung), Körper in der Mitte, Augen bei (6,5),(8,5) bzw. (28,14),(30,14), Füße unten.
* C (unten, x 6–23, y 16–23): Flügel waagerecht ausgebreitet (zwei Rauten mit gezackter Hinterkante), Augen bei (13,20),(15,20).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag, jede Fledermaus in ihrem eigenen konstanten Rhythmus (alle teilen sich 48): A Periode 12, B Periode 8 (kleiner, schneller), C Periode 12. Jeder Flügel dreht sich um seine Schulter am Körper;
  die rechte Seite ist das exakte Spiegelbild der linken (Flügel und Körper des Sprites sind spiegelgleich). A und B schlagen aus der V-Haltung (Frame 0 = Original) bis 75° bzw. 70° nach unten (Drehung der Flügel, Rückwärtsabbildung, Nächster Nachbar); bei C (waagerechte Rauten) würde Drehen
  die Raute zerreißen, dort wandert jede Flügelspalte senkrecht (Spaltenversatz bis 4 px an der Spitze nach unten und oben, Frame 0 = Original). Die Flügel behalten ihre Pixeltextur; der Abschlag ist etwas schneller als der Aufschlag.
* Schwebe-Bob je Fledermaus zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0) im Takt ihres Flügelschlags (Periode 12 bzw. 8): der Körper hebt sich im Abschlag.
* Blinzeln, jede Fledermaus einmal pro Schleife zu einer anderen Zeit (3 Frames), Lid = Körperfarbe (21,34,57).
* Kein Glanz, kein Feuer, keine Partikel.

Ergänzungen: keine nötig — die Flügel sitzen außen am Körper, nichts ist verdeckt. Wo das Drehen einen Flügel von der Schulter lösen würde, schließt ein Pixel in der Flughautfarbe (21,34,57) die Lücke (8-verbunden).
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): die Randfarben der Quelle sind alle vier Quellfarben, das Drehen legt nur Quellfarben an den Rand; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 12, 12, 12, 12                   # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('deepsea-bats')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vorhanden = L.deckend(spr)

NAVY = (21, 34, 57)                                           # Körper / Flughaut (Lid)
AUGE = (246, 255, 255)

# Zerlegung in drei Fledermäuse (8-verbundene Teile; Zuordnung über je ein Augenpixel)
n_teile, lab = cv2.connectedComponents(vorhanden.astype(np.uint8), connectivity=8)
assert n_teile == 4, n_teile
BATS = [
    dict(name='A', typ='V', auge=(7, 5), T=12, tief=75.0, blinz=(14, 15, 16)),
    dict(name='B', typ='V', auge=(29, 14), T=8, tief=70.0, blinz=(33, 34, 35)),
    dict(name='C', typ='flat', auge=(13, 20), T=12, amp=4.0, amp_hoch=2.0, blinz=(25, 26, 27)),
]
for b in BATS:
    ax, ay = b['auge']
    assert tuple(spr[ay, ax, :3]) == AUGE, b['name']
    b['maske'] = lab == lab[ay, ax]
    ys, xs = np.nonzero(b['maske'])
    b['x0'], b['y0'] = int(xs.min()), int(ys.min())
    # Schultern/Achse in Sprite-Koordinaten: V: Augen bei Achse ±1 → Achse = Mitte der beiden Augen; flat ebenso
    aug = np.argwhere(b['maske'] & (spr[..., 0] == AUGE[0]) & (spr[..., 1] == AUGE[1]) & (spr[..., 3] > 0))
    b['achse'] = float(aug[:, 1].mean())                      # Spiegelachse (x)
    b['eyes'] = [(int(x), int(y)) for y, x in aug]
    xc, ye = b['achse'], int(aug[0, 0])
    if b['typ'] == 'V':
        sy = ye - 1                                           # Schulterzeile (Zeile über den Augen)
        b['schulter_l'] = (xc - 1.0, sy)                      # Drehpunkt im Körper neben der Flügelwurzel
        b['wurzel_x'] = xc - 2.0                              # Flügel: x ≤ xc − 2 (links) und Zeilen ≤ sy
        b['wing_y'] = sy
    else:
        b['schulter_l'] = (xc - 2.0, ye)                      # flat: Schulter 2 px links der Achse, Augenzeile
        b['wurzel_x'] = xc - 3.0
        b['wing_y'] = ye + 2
    xs_ = np.arange(sw)[None, :].repeat(sh, 0)
    ys_ = np.arange(sh)[:, None].repeat(sw, 1)
    b['flug_l'] = b['maske'] & (xs_ <= b['wurzel_x']) & (ys_ <= b['wing_y'])
    b['flug_r'] = b['maske'] & (xs_ >= 2 * xc - b['wurzel_x']) & (ys_ <= b['wing_y'])
    b['rumpf'] = b['maske'] & ~b['flug_l'] & ~b['flug_r']
    # Spiegelgleichheit prüfen
    fl = b['flug_l']
    spiegel_fl = np.zeros_like(fl)
    for y, x in zip(*np.nonzero(fl)):
        xm = int(round(2 * xc - x))
        spiegel_fl[y, xm] = True
    assert (spiegel_fl == b['flug_r']).all(), f"Bat {b['name']}: Flügel nicht spiegelgleich"


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


for b in BATS:
    b['P_fl'], b['P_rumpf'] = ebene(b['flug_l']), ebene(b['rumpf'])
    b['P_fr'] = ebene(b['flug_r'])
    b['piv'] = (PAD_L + b['schulter_l'][0], PAD_T + b['schulter_l'][1])
    b['axis_c'] = PAD_L + b['achse']
assert (L.zusammen(H, W, [(p, 0, 0) for b in BATS for p in (b['P_fl'], b['P_fr'], b['P_rumpf'])])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
UMRISS = F.umriss_farben(spr)


def spiegeln(a, xc):
    """Ebene an der senkrechten Achse xc (Leinwand-Koordinate, ganz- oder halbzahlig) spiegeln."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    for y, x in zip(*np.nonzero(a[..., 3])):
        xm = int(round(2 * xc - x))
        if not 0 <= xm < w:
            raise L.ClipError('Spiegelbild außerhalb der Leinwand')
        out[y, xm] = a[y, x]
    return out


def bruecken8(f, start):
    """Teile, die nach dem Drehen nicht mehr (8-verbunden) am Hauptteil hängen, bekommen Brückenpixel in Flughautfarbe (kürzeste Strecke)."""
    for _ in range(8):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)
        if n <= 2:
            break
        hl = lab_[start[1], start[0]]
        hp = np.argwhere(lab_ == hl)
        best = None
        for k in range(1, n):
            if k == hl:
                continue
            cp = np.argwhere(lab_ == k)
            d = np.abs(cp[:, None, :] - hp[None, :, :]).max(axis=2)
            i, j = np.unravel_index(int(d.argmin()), d.shape)
            if best is None or d[i, j] < best[0]:
                best = (int(d[i, j]), cp[i], hp[j])
        _, a, b = best
        y, x = int(a[0]), int(a[1])
        while max(abs(b[0] - y), abs(b[1] - x)) > 1:
            y += int(np.sign(b[0] - y))
            x += int(np.sign(b[1] - x))
            f[y, x, :3] = NAVY
            f[y, x, 3] = 255
    return f


def bat_ebenen(b, i, effekte=True):
    """Ebenen einer Fledermaus in Frame i: [(Ebene, dx, dy)] inkl. Bob."""
    T = b['T']
    ph = 2 * math.pi * i / T
    ph2 = ph + 0.3 * math.sin(ph)                              # Abschlag etwas schneller als Aufschlag
    if b['typ'] == 'V':
        delta = -b['tief'] * (1 - math.cos(ph2)) / 2           # Frame 0: V-Haltung (Original), dann nach unten
    else:
        delta = 0.0
    bob = -int(round(2 * (1 - math.cos(ph)) / 2 * 1.0))        # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    if b['typ'] == 'V':
        fl = F.drehen(b['P_fl'], b['piv'][0], b['piv'][1], math.radians(delta), glatt=False)
    else:                                                      # Rautenflügel: Spaltenversatz um die Schulter (Raute bleibt unverändert), Frame 0: waagerecht (Original), erst nach unten, dann nach oben
        fl = F.fluegel_welle(b['P_fl'], b['piv'][0], b['amp'] if math.sin(ph2) >= 0 else b['amp_hoch'], ph2, 1.0, None, 0.0, True)
    rumpf = b['P_rumpf'].copy()
    if effekte and i in b['blinz']:
        for (x, y) in b['eyes']:
            rumpf[PAD_T + y, PAD_L + x, :3] = NAVY
    # Brücken auf der linken Seite berechnen (Flügel + Rumpf), danach spiegeln → beide Seiten bleiben exakt symmetrisch
    links = L.zusammen(H, W, [(fl, 0, 0), (rumpf, 0, 0)])
    ys, xs = np.nonzero(rumpf[..., 3])
    start = (int(xs[len(xs) // 2]), int(ys[len(ys) // 2]))
    mit = bruecken8(links.copy(), start)
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(links[..., 3] > 0)
    brk[neu] = mit[neu]
    fr = spiegeln(fl, b['axis_c'])
    brk_r = spiegeln(brk, b['axis_c'])
    return [(a, 0, bob) for a in (brk, brk_r, fl, fr, rumpf)]


def frame(i, partikel=True, effekte=True):
    ebenen = []
    for b in BATS:
        ebenen += bat_ebenen(b, i, effekte)
    return L.zusammen(H, W, ebenen)


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('deepsea-bats', 'Deepsea Bats', frames, MS, prev)
    if prev:
        L.streifen(prev + '/deepsea-bats-strip.png', frames, spalten=8, scale=6)
