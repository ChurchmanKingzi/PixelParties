# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Pteranos“ (Creature) — Regeln 14/15/16 (Fleisch/Haut/Knochen: kein Metall, kein Feuer → kein Glanz, keine Funken).

PICK: [["MotiveGrailWar", 239, 1]] + Kopf, Haube und Flügel aus der Kartenkunst (siehe Quelle)
Quelle: src/gigantisaur-pteranos.png — der ganze Flugsaurier (73×49 px, 14 Farben), zusammengesetzt aus zwei Teilen:
* Körper mit Schnabel, Rumpf und Füßen = Ebene 239 („Ebene #276“) aus MotiveGrailWar.xcf, 52×20 px (Original als src/gigantisaur-pteranos-ebene239.png abgelegt), sitzt bei Kartenposition (1,29);
  in der Kartenkunst pixelgenau wiedergefunden (Farbabstand ≈ 5 = Kartenrauschen).
* Kopf mit Haube und Horn sowie der große Flügel (rechts oben, bis zum Kartenrand) stehen in KEINER xcf-Ebene (alle 748 Ebenen von MotiveGrailWar und alle anderen Dateien nach den Farben durchsucht: keine Treffer) — sie wurden
  aus der Kartenkunst herausgelöst: Pixel mit dunklem Umriss (≈(25,4,3)) oder rosabrauner Füllung (G − B ≤ 30, R ≥ 45) im oberen Teil (y ≤ 31), Komponenten ≥ 10 px, jedes Pixel auf die nächste Palettenfarbe
  der Figur gerastet: (25,4,3)/(77,46,43)/(57,27,25)/(111,67,66)/(122,84,73) stammen aus Ebene 239, dazu aus der Kunst die Haut-Lichtfarbe (151,100,81) und die Augenfarben (158,82,80)/(86,14,12) (bei der Prüfung `erlaubt`:
  Farben der Kartenkunst). Danach: Löcher gefüllt (5 px), 3 verstreute Pixel entfernt, die Flügelspitze am Kartenrand mit zwei Umrisspixeln (71–72, 0) geschlossen.

Aufruf:   python3 gigantisaur_pteranos.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-pteranos.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Kopf (x 12–28, y 10–30): gestreckter Kopf mit großer blattförmiger Haube links (x 12–20, y 11–27), einem Horn (x 21–26, y 11–22), rotem Auge bei (22–23, 23); der Schnabel (hell, zwei Zinken, (255,190,151)/(223,165,117)/(255,240,202))
  geht nach links unten (x 0–22, y 28–41).
* Rumpf (x 22–45, y 28–48): braun mit hellgrauem Bauchstreifen, Rückenlinie, unten rechts die Füße/der Schwanzansatz (x 38–51, y 40–48).
* Flügel (x 39–72, y 0–33): ein langer schmaler Flügel schräg nach rechts oben (≈ 45°), dunkler Umriss (25,4,3) auf beiden Seiten, Füllung in vier Brauntönen; Wurzel am Rücken bei (39–45, 26–33).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag (Periode 12, viermal pro Schleife): der Flügel dreht sich um seine Wurzel im Rücken von der Ausgangshaltung (nach oben-rechts, Frame 0 = Original) 40° nach unten und zurück, Abschlag etwas schneller als Aufschlag.
  Der lange dünne Flügel wird nicht als Pixelfeld gedreht (das zerlegt die Umrisslinien in Treppen): die Füllung dreht sich per Rückwärtsabbildung, die dunklen Umrisslinien als Linien (F.drehen_haut_knochen).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12), das ganze Tier hebt sich im Abschlag.
* Die Haube (oberste Zeilen von Haube und Horn) wippt mit Verzögerung leicht nach (bis 1 px, Periode 12). Die Füße am Rumpf schwingen leicht nach (bis 1–2 px an den Spitzen, Periode 12).
* Blinzeln: das Auge schließt sich für 3 Frames (Frame 32–34), das Lid ist die Kopffarbe (111,67,66).
* Kein Glanz, kein Feuer, keine Partikel.

Ergänzungen: keine verdeckten Teile nötig. Wo die Drehung den Flügel von der Wurzel lösen würde, schließt ein Umrisspixel (25,4,3) die Lücke (8-verbunden), liegt der Flügel hinter dem Rumpf.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Drehung und Pendel legen nur Umriss-/Randfarben der Quelle an die Ränder (alle Randfarben der Quelle sind erlaubt); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle (plus die drei Farben aus der Kartenkunst), Alpha nur 0/255.
"""
import math
import sys

import cv2
import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 26, 8, 10                    # Arbeitsleinwand (am Ende zugeschnitten); rechts Platz für den abgesenkten Flügel

spr = L.lade('gigantisaur-pteranos')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

AUSSEN = (25, 4, 3)                                            # dunkler Umriss
KOPF = (111, 67, 66)                                           # Kopffarbe (Lid)
AUGEN_FARBEN = [(158, 82, 80), (86, 14, 12)]
KUNST_FARBEN = [(151, 100, 81), (158, 82, 80), (86, 14, 12)]    # nur in der Kartenkunst (nicht in Ebene 239)

e239 = L.lade('gigantisaur-pteranos-ebene239')
m239 = np.zeros((sh, sw), bool)
m239[29:29 + e239.shape[0], 0:e239.shape[1]] = e239[..., 3] > 0
assert (spr[m239] == np.concatenate([e239[e239[..., 3] > 0]])).all()
m_fluegel = vorhanden & ~m239 & (xx >= 39)
m_kopf = vorhanden & ~m239 & (xx < 39)
m_koerper = vorhanden & m239
m_auge = vorhanden & L.farbmaske(spr, AUGEN_FARBEN)
m_haube = m_kopf & (yy <= 21) & (xx <= 27)                     # Haube + Horn (obere Zeilen) wippen
m_fuss = m_koerper & (xx >= 38) & (yy >= 40)                    # Füße am Rumpf
m_rumpf = m_koerper & ~m_fuss
m_kopf_rest = m_kopf & ~m_haube
assert int(m_auge.sum()) == 3, int(m_auge.sum())


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


P_FL, P_RUMPF, P_FUSS, P_KOPF, P_HAUBE = ebene(m_fluegel), ebene(m_rumpf), ebene(m_fuss), ebene(m_kopf_rest), ebene(m_haube)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_FL, P_RUMPF, P_FUSS, P_KOPF, P_HAUBE)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
UMRISS = F.umriss_farben(spr)

PIV = (PAD_L + 41.0, PAD_T + 33.0)                             # Flügelwurzel im Rücken
TIEF = 40.0                                                    # Abschlag in Grad nach unten
BLINZ = {32, 33, 34}
Y_FUSS = PAD_T + 40                                            # Füße pendeln unterhalb dieser Zeile
Y_HAUBE = PAD_T + 21                                           # Haube wippt oberhalb dieser Zeile


def bruecken8(f, start):
    """Teile, die nach dem Drehen nicht mehr (8-verbunden) am Hauptteil hängen, bekommen Umrisspixel entlang der kürzesten Strecke."""
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
            f[y, x, :3] = AUSSEN
            f[y, x, 3] = 255
    return f


def verbinde4(f):
    """Teile, die nur über eine Pixelecke am Hauptteil hängen (4er-Nachbarschaft), bekommen ein Eckpixel in der Farbe ihres Randpixels."""
    for _ in range(6):
        n, lab_ = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=4)
        if n <= 2:
            break
        gr = [int((lab_ == k).sum()) for k in range(n)]
        haupt = int(np.argmax(gr[1:])) + 1
        gefunden = False
        for k in range(1, n):
            if k == haupt or gefunden:
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
        if not gefunden:
            break
    return f


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 4)                                     # Periode 12
    ph2 = ph + 0.3 * math.sin(ph)                              # Abschlag etwas schneller als Aufschlag (Frame 0 = Ruhelage)
    delta = math.radians(TIEF) * (1 - math.cos(ph2)) / 2
    bob = -int(round(2 * (1 - math.cos(ph)) / 2))              # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    fl = F.drehen_haut_knochen(P_FL, PIV[0], PIV[1], delta, [AUSSEN])        # im Uhrzeigersinn = Flügel senkt sich
    kopf = P_KOPF.copy()
    if effekte and i in BLINZ:
        for y, x in zip(*np.nonzero(m_auge)):
            kopf[PAD_T + y, PAD_L + x, :3] = KOPF
    # Haube wippt (Zeilen oberhalb Y_HAUBE), kopfüber gespiegelt, damit zeilen_pendel (nur Zeilen UNTER dem Pivot) greift
    hf = P_HAUBE[::-1].copy()
    hf = F.zeilen_pendel(hf, H - 1 - Y_HAUBE, 1.2, ph, 1.0, lauf=1.0)
    haube = hf[::-1].copy()
    fuss = F.zeilen_pendel(P_FUSS, Y_FUSS, 1.8, ph, 1.0, lauf=1.0)
    rumpf = P_RUMPF.copy()

    ganz = L.zusammen(H, W, [(fl, 0, 0), (rumpf, 0, 0), (fuss, 0, 0), (kopf, 0, 0), (haube, 0, 0)])
    start = (PAD_L + 30, PAD_T + 38)
    mit = verbinde4(bruecken8(ganz.copy(), start))
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(ganz[..., 3] > 0)
    brk[neu] = mit[neu]
    fl, rumpf, fuss, kopf, haube, brk = (L.versetze(a, 0, bob) for a in (fl, rumpf, fuss, kopf, haube, brk))
    return L.zusammen(H, W, [(brk, 0, 0), (fl, 0, 0), (rumpf, 0, 0), (fuss, 0, 0), (kopf, 0, 0), (haube, 0, 0)])


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
    n = L.pruefe(frames, quelle=spr, erlaubt=KUNST_FARBEN)
    print('Pixel je Frame:', n)
    L.speichern('gigantisaur-pteranos', 'Gigantisaur Pteranos', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-pteranos-strip.png', frames, spalten=8, scale=4)
