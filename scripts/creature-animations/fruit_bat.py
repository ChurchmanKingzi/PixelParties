# -*- coding: utf-8 -*-
"""Idle-Animation für „Fruit Bat, Nosferapple“ (Creature) — Regeln 14/15/16 (kein Metall/Gold/Edelstein, kein Feuer → kein Glanz, keine Funken).

PICK: [["Motive", 721, 1]]
Quelle: src/fruit-bat.png — Apfel-Fledermaus „Nosferapple“ (40×32 px, 23 Farben) aus Motive.xcf, Ebene 721 („Nosferapple“), Figur 1; vollständig deckend (Alpha nur 255), Maßstab 1.
Überlagerung mit der Kartenkunst geprüft (Farbabstand ≈ 5 = Kartenrauschen): beide Flügel und der Apfel sind vollständig; der Grabstein rechts oben auf der Karte ist ein anderes Motiv.

Aufruf:   python3 fruit_bat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/fruit-bat.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Körper (x 14–30, y 17–31): rosa Apfel (154,98,114) mit dunklem Rand (48,32,34), Gesicht mit zwei hellen Augen (je 2×2 bei (18–19, 23–24) und (27–28, 23–24)), dunkler Maske und Reißzähnen.
* Stiel (x 19–25, y 11–16): zwei dunkle Spitzen (49,49,51)/(34,35,38) mit grauen Lichtern (wie Fledermausohren), sie stehen auf dem Apfel.
* Linker Flügel (x 0–13, y 3–22, 115 px): Fächer aus drei grauen Fingerknochen ((115,110,112)/(140,143,138)) und rosa-magentafarbener Flughaut ((95,55,74)/(122,50,75)/(159,86,107)), Wurzel am Apfel bei (13, 20–22).
* Rechter Flügel (x 27–39, y 0–18, 124 px): ebenso, Wurzel bei (31, 16–18); er ist im Original nicht spiegelgleich zum linken (steht höher), das bleibt so.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag (Periode 12, viermal pro Schleife): jeder Flügel dreht sich als ganzer Fächer um seine Wurzel am Apfel von der Ausgangshaltung (nach oben-außen, Frame 0 = Original) 62° nach unten; beide
  Flügel schlagen gleichzeitig und gegengleich (links gegen den Uhrzeigersinn, rechts im Uhrzeigersinn). Der Fächer bleibt beim Drehen offen (keine Spaltenscherung, die ihn flachdrückt), die Pixeltextur der Knochen und der Haut bleibt
  (Rückwärtsabbildung, Nächster Nachbar); der Abschlag ist etwas schneller als der Aufschlag.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12): der Körper hebt sich im Abschlag.
* Der Stiel (die zwei Spitzen) schwingt mit Verzögerung leicht seitlich nach (um die Apfeloberkante, bis 1–2 px an den Spitzen, Periode 12).
* Blinzeln: die Augen schließen sich für 3 Frames (Frame 26–28), das Lid ist die Apfelfarbe (154,98,114).
* Kein Glanz (Frucht/Haut/Knochen), kein Feuer, keine Partikel.

Ergänzungen: keine nötig — die Flügel sitzen außen am Körper, nichts Verdecktes wird sichtbar. Wo das Drehen den Flügel von der Wurzel lösen würde, schließt ein Pixel in der Flughautfarbe (95,55,74) die Lücke; Teile, die nur über eine Pixelecke hängen, bekommen ein Eckpixel in der Farbe ihres Randpixels (das Original ist durchgehend 4-verbunden).
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Drehen legt nur Farben des Flügels an dessen Ränder, die Flügelrandfarben sind alle in der Quelle Randfarben; zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 26, 26, 22, 22                   # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('fruit-bat')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

HAUT_RAND = (95, 55, 74)                                      # Flughautfarbe am Rand (Brückenpixel)
APFEL = (154, 98, 114)                                        # Apfelfarbe (Lid)
AUGEN_PX = [(18, 23), (19, 23), (18, 24), (19, 24), (27, 23), (28, 23), (27, 24), (28, 24)]

m_stiel = vorhanden & (xx >= 19) & (xx <= 25) & (yy <= 16)
m_apfel = vorhanden & (xx >= 14) & (xx <= 30) & (yy >= 17)
m_koerper = m_stiel | m_apfel
m_fl = vorhanden & ~m_koerper
n_, lab = cv2.connectedComponents(m_fl.astype(np.uint8), connectivity=8)
assert n_ == 3, n_
m_fl_l = lab == lab[21, 13]
m_fl_r = lab == lab[17, 31]
assert m_fl_l.any() and m_fl_r.any() and (m_fl_l | m_fl_r == m_fl).all()
for (x, y) in AUGEN_PX:
    assert vorhanden[y, x] and spr[y, x, 0] > 60, (x, y)      # helle Augenpixel


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


P_FL, P_FR, P_ST, P_AP = ebene(m_fl_l), ebene(m_fl_r), ebene(m_stiel), ebene(m_apfel)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_FL, P_FR, P_ST, P_AP)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
UMRISS = F.umriss_farben(spr)

PIV_L = (PAD_L + 13.0, PAD_T + 21.0)                          # Flügelwurzeln am Apfel
PIV_R = (PAD_L + 31.0, PAD_T + 17.0)
TIEF = 38.0                                                   # Abschlag in Grad nach unten
KNOCHEN = [(115, 110, 112), (140, 143, 138)]                  # graue Fingerknochen (1-px-Linien) — werden als Linien gedreht, nicht als Pixelfeld
BLINZ = {26, 27, 28}


def _naechste_haut(layer, bone):
    """Füllt die Knochenpixel einer Flügelebene mit der Farbe des nächsten Hautpixels (Haut unter dem Knochen), damit die Haut beim Drehen ein geschlossenes Feld bleibt."""
    out = layer.copy()
    haut = (layer[..., 3] > 0) & ~bone
    hy, hx = np.nonzero(haut)
    for y, x in zip(*np.nonzero(bone)):
        k = int(np.argmin((hy - y) ** 2 + (hx - x) ** 2))
        out[y, x] = layer[hy[k], hx[k]]
    return out


def _linie(p, q):
    """Pixel einer 8-verbundenen Linie von p nach q (Bresenham), ohne p, mit q."""
    (x0, y0), (x1, y1) = p, q
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx, sy = (1 if x1 > x0 else -1), (1 if y1 > y0 else -1)
    err = dx - dy
    pts = []
    while (x0, y0) != (x1, y1):
        e2 = 2 * err
        if e2 > -dy:
            err -= dy
            x0 += sx
        if e2 < dx:
            err += dx
            y0 += sy
        pts.append((x0, y0))
    return pts


def drehe_fluegel(layer, piv, winkel):
    """Flügel drehen, ohne ihn zu zerfasern: Die Haut (dicke Fläche) wird per Rückwärtsabbildung gedreht, die grauen Knochen (1-px-Linien) per Vorwärtsabbildung der Linienpunkte
    und mit Linien zwischen den gedrehten Nachbarpunkten neu gezogen (bleiben durchgehend). Danach fallen lose Splitter (≤ 3 px, nicht 4-verbunden mit dem Flügel) weg."""
    if abs(winkel) < 1e-9:
        return layer.copy()
    bone = L.farbmaske(layer, KNOCHEN)
    haut_layer = _naechste_haut(layer, bone)
    haut = F.drehen(haut_layer, piv[0], piv[1], winkel, glatt=False)
    c, s_ = math.cos(winkel), math.sin(winkel)

    def rot(x, y):
        dx, dy = x - piv[0], y - piv[1]
        return (int(math.floor(piv[0] + dx * c - dy * s_ + 0.5)), int(math.floor(piv[1] + dx * s_ + dy * c + 0.5)))
    out = haut.copy()
    ys, xs = np.nonzero(bone)
    pts = set(zip(xs.tolist(), ys.tolist()))
    h, w = layer.shape[:2]
    for (x, y) in sorted(pts):
        px, py = rot(x, y)
        if not (0 <= px < w and 0 <= py < h):
            raise L.ClipError('Knochenpixel außerhalb der Leinwand')
        out[py, px, :3] = layer[y, x, :3]
        out[py, px, 3] = 255
        for dy_, dx_ in ((0, 1), (1, -1), (1, 0), (1, 1)):          # jedes Nachbarpaar einmal
            q = (x + dx_, y + dy_)
            if q in pts:
                qx, qy = rot(*q)
                for (lx, ly) in _linie((px, py), (qx, qy))[:-1]:
                    if not out[ly, lx, 3] or tuple(out[ly, lx, :3]) not in [tuple(k) for k in KNOCHEN]:
                        out[ly, lx, :3] = layer[y, x, :3]
                        out[ly, lx, 3] = 255
    # Splitter entfernen (4-Komponenten ≤ 3 px)
    n, lab_ = cv2.connectedComponents((out[..., 3] > 0).astype(np.uint8), connectivity=4)
    for k in range(1, n):
        m = lab_ == k
        if int(m.sum()) <= 3:
            out[m] = 0
    return out


def bruecken8(f, start):
    """Teile, die nach dem Drehen nicht mehr (8-verbunden) am Hauptteil hängen, bekommen Brückenpixel (Flughautrand) entlang der kürzesten Strecke."""
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
            f[y, x, :3] = HAUT_RAND
            f[y, x, 3] = 255
    return f


def verbinde4(f):
    """Teile, die nur über eine Pixelecke am Hauptteil hängen (4er-Nachbarschaft), bekommen ein Eckpixel in der Farbe ihres Randpixels (wie im Original, das durchgehend 4-verbunden ist)."""
    for _ in range(6):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=4)
        if n <= 2:
            break
        gr = [int((lab_ == k).sum()) for k in range(n)]
        haupt = int(np.argmax(gr[1:])) + 1
        gefunden = False
        for k in range(1, n):
            if k == haupt:
                continue
            for y, x in np.argwhere(lab_ == k):
                for dy, dx in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
                    qy, qx = y + dy, x + dx
                    if 0 <= qy < f.shape[0] and 0 <= qx < f.shape[1] and lab_[qy, qx] == haupt:
                        for cy, cx in ((y, qx), (qy, x)):
                            if not f[cy, cx, 3]:
                                f[cy, cx, :3] = f[y, x, :3]
                                f[cy, cx, 3] = 255
                                gefunden = True
                                break
                    if gefunden:
                        break
                if gefunden:
                    break
            if gefunden:
                break
        if not gefunden:
            break
    return f


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 4)                                     # Periode 12
    ph2 = ph + 0.3 * math.sin(ph)                              # Abschlag etwas schneller als Aufschlag (Frame 0 = Ruhelage)
    u = (1 - math.cos(ph2)) / 2
    delta = math.radians(TIEF) * u
    bob = -int(round(2 * (1 - math.cos(ph)) / 2))              # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    fl = drehe_fluegel(P_FL, PIV_L, -delta)                          # links: gegen den Uhrzeigersinn = Flügel senkt sich
    fr = drehe_fluegel(P_FR, PIV_R, delta)                           # rechts: im Uhrzeigersinn
    ap = P_AP.copy()
    if effekte and i in BLINZ:
        for (x, y) in AUGEN_PX:
            ap[PAD_T + y, PAD_L + x, :3] = APFEL
    # Stiel: Nachschwingen (Zeilen oberhalb der Apfelkante), kopfüber gespiegelt, damit zeilen_pendel (nur Zeilen UNTER dem Pivot) greift
    stf = P_ST[::-1].copy()
    stf = F.zeilen_pendel(stf, H - 1 - (PAD_T + 16), 1.6, ph, 1.0, lauf=1.0)
    st = stf[::-1].copy()

    ganz = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (st, 0, 0), (ap, 0, 0)])
    ys, xs = np.nonzero(ap[..., 3])
    start = (PAD_L + 22, PAD_T + 25)
    mit = verbinde4(bruecken8(ganz.copy(), start))
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(ganz[..., 3] > 0)
    brk[neu] = mit[neu]
    fl, fr, st, ap, brk = (L.versetze(a, 0, bob) for a in (fl, fr, st, ap, brk))
    return L.zusammen(H, W, [(brk, 0, 0), (fl, 0, 0), (fr, 0, 0), (st, 0, 0), (ap, 0, 0)])


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
    L.speichern('fruit-bat', 'Fruit Bat, Nosferapple', frames, MS, prev)
    if prev:
        L.streifen(prev + '/fruit-bat-strip.png', frames, spalten=8, scale=5)
