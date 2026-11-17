# -*- coding: utf-8 -*-
"""Idle-Animation für „Skeleton Skull Bat“ (Creature) — Regeln 14/15/16 (Metall glänzt, sonst nichts; hier nur Knochen: kein Glanz, kein Feuer).

PICK: [["Motive", 811, 1]]
Quelle: src/skeleton-skull-bat.png — Totenschädel-Fledermaus (22×16 px, 10 Farben) aus Motive.xcf, Ebene 811 („Skeleton Bat“), Figur 1; vollständig deckend (Alpha nur 255),
Maßstab 1, deckt sich mit der Kartenkunst (Überlagerung geprüft, nichts ging bei der Extraktion verloren).

Aufruf:   python3 skeleton_skull_bat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/skeleton-skull-bat.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Schädel (x 7–14, y 2–13): graue Knochenfläche (62,64,64)/(53,53,53)/(47,47,47)/(38,38,38), schwarze Nasen-/Kieferöffnung, braunschwarzer Umriss (13,6,0),
  gelb leuchtende Augen ((232,232,0)/(255,255,61)/(255,255,192), schwarze Pupille (0,0,0)) bei (8–9, 6–7) und (12–13, 6–7).
* Flügel (je Seite x 0–6 bzw. 15–21, y 0–8): zwei dünne Knochenspangen („Fledermausfinger“), die vom Schädelrand schräg nach außen oben laufen (obere bis in die Ecke (0,0)/(21,0), untere bis (1–2,2));
  jede Spange ist eine 1-px-Linie in Grau (29,29,29)/(62,64,64) mit braunschwarzer Schattenlinie (13,6,0) daneben (Textur).
* Beine/Krallen (je Seite y 8–15): gebogene Knochenglieder, die vom Schädelrand nach außen unten laufen und in einer Spitze enden (Zeilen 9–15, bei x 2–5 bzw. 16–19).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Durchgehender Flügelschlag (Periode 12, viermal pro Schleife): beide Flügel schlagen exakt symmetrisch (die rechte Seite ist das Spiegelbild der linken, Sprite-Flügel und -Beine sind spiegelgleich), gedreht wird um die Schulter im Schädel (8, 5,5) bzw. (13, 5,5)
  von leicht abgesenkt (−9°, der Fächer bleibt offen) bis steil nach oben (+34°); der Abschlag ist schneller als der Aufschlag. Die Knochenspangen behalten dabei ihre Pixeltextur (Rückwärtsabbildung, Nächster Nachbar),
  Frame 0 ist die Ruhelage (Original). Gedreht wird ohne Glätten (dünne 1-px-Linien blieben sonst nicht stehen); wo das Drehen eine Spange von der Schulter lösen würde, schließt ein Umrisspixel (13,6,0) die Lücke (8-verbunden).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12): der Körper hebt sich im Abschlag.
* Die Beine pendeln leicht nach (Periode 12, um die Schädelunterkante, bis 1–2 px an der Spitze).
* Blinzeln: die Augen schließen sich für 3 Frames (Frame 30–32), das Lid ist die Schädelfarbe (62,64,64).
* Kein Glanz (Knochen sind kein Metall), kein Feuer, keine Partikel.

Ergänzungen: keine nötig — nichts ist verdeckt, die Flügel sitzen außen am Schädel und werden von ihm nur an der Wurzel überdeckt.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Drehen/Pendeln legt nur Knochen- und Umrissfarben an die Ränder (alle Randfarben der Quelle sind erlaubt); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 12, 12, 12, 10                   # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('skeleton-skull-bat')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

BRAUN = (13, 6, 0)                                            # Umriss / Schattenlinie der Knochen
SCHAEDEL = (62, 64, 64)                                       # Hauptfarbe der Schädelfläche (Lid)
AUGEN_FARBEN = [(232, 232, 0), (255, 255, 61), (255, 255, 192), (0, 0, 0)]

m_fl_l = vorhanden & (xx <= 6) & (yy <= 7)
m_fl_r = vorhanden & (xx >= 15) & (yy <= 7)
m_bn_l = vorhanden & (xx <= 6) & (yy >= 8)
m_bn_r = vorhanden & (xx >= 15) & (yy >= 8)
m_kopf = vorhanden & ~m_fl_l & ~m_fl_r & ~m_bn_l & ~m_bn_r
m_auge = (L.farbmaske(spr, AUGEN_FARBEN)) & (yy >= 6) & (yy <= 7) & (((xx >= 8) & (xx <= 9)) | ((xx >= 12) & (xx <= 13)))
assert int(m_auge.sum()) == 8, int(m_auge.sum())


def ebene(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


P_FL, P_FR, P_BL, P_BR, P_KP = ebene(m_fl_l), ebene(m_fl_r), ebene(m_bn_l), ebene(m_bn_r), ebene(m_kopf)
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_FL, P_FR, P_BL, P_BR, P_KP)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
assert (P_FR == P_FL[:, ::-1]).all() and (P_BR == P_BL[:, ::-1]).all(), 'Flügel/Beine sind nicht spiegelgleich'

UMRISS = F.umriss_farben(spr)
THETA_C, THETA_A = math.radians(12.5), math.radians(21.5)     # Drehwinkel −9° … +34° (Ruhe 0°); positiv = Flügel hebt sich
THETA_P0 = math.acos(-THETA_C / THETA_A)                      # Frame 0: θ = 0, Schlag beginnt mit dem Abschlag
PIV_L = (PAD_L + 8.0, PAD_T + 5.5)                            # Schultern (im Schädel); rechts gespiegelt (x → 21 − x)
PIV_R = (PAD_L + 13.0, PAD_T + 5.5)
Y_BEIN = PAD_T + 8                                            # Beine pendeln unterhalb dieser Zeile
BLINZ = {30, 31, 32}


def bruecken8(f, haupt_start):
    """Hängt ein Teil nur noch lose (nicht einmal über eine Ecke) am Hauptteil, verbinden Umrisspixel (BRAUN) entlang der kürzesten Strecke: macht die Figur wieder 8-verbunden."""
    import cv2
    for _ in range(8):
        n, lab = cv2.connectedComponents((f[..., 3] > 0).astype(np.uint8), connectivity=8)
        if n <= 2:
            break
        hl = lab[haupt_start[1], haupt_start[0]]
        hp = np.argwhere(lab == hl)
        best = None
        for k in range(1, n):
            if k == hl:
                continue
            cp = np.argwhere(lab == k)
            d = np.abs(cp[:, None, :] - hp[None, :, :]).max(axis=2)
            i, j = np.unravel_index(int(d.argmin()), d.shape)
            if best is None or d[i, j] < best[0]:
                best = (int(d[i, j]), cp[i], hp[j])
        _, a, b = best
        y, x = int(a[0]), int(a[1])
        while max(abs(b[0] - y), abs(b[1] - x)) > 1:                 # ein Schritt Richtung Hauptteil (8er-Nachbarn)
            y += int(np.sign(b[0] - y))
            x += int(np.sign(b[1] - x))
            f[y, x, :3] = BRAUN
            f[y, x, 3] = 255
    return f


def frame(i, partikel=True, effekte=True):
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    ph = L.sinus(i, N / 4)                                     # Flügelschlag: viermal pro Schleife (Periode 12)
    ph2 = ph + 0.4 * math.sin(ph + THETA_P0)                   # Abschlag schneller als Aufschlag (Frame 0 bleibt Ruhelage)
    ph2 -= 0.4 * math.sin(THETA_P0)
    theta = THETA_C + THETA_A * math.cos(ph2 + THETA_P0)

    # Nur die linke Seite wird gerechnet, die rechte ist ihr Spiegelbild (Flügel und Beine des Sprites sind spiegelgleich) → beide Seiten bleiben exakt symmetrisch
    fl = F.drehen(P_FL, PIV_L[0], PIV_L[1], theta, glatt=False)
    bl = F.zeilen_pendel(P_BL, Y_BEIN, 1.8, ph, 1.0, lauf=1.2)         # Beine pendeln nach, gegenüber dem Flügelschlag verzögert
    kp = P_KP.copy()
    if effekte and i in BLINZ:
        for y, x in zip(*np.nonzero(m_auge)):
            kp[PAD_T + y, PAD_L + x, :3] = SCHAEDEL
    links = L.zusammen(H, W, [(fl, 0, 0), (bl, 0, 0), (kp, 0, 0)])
    mit = bruecken8(links.copy(), (PAD_L + 10, PAD_T + 8))              # lose Teile über Umrisspixel anbinden (nur Umrisspixel kommen dazu)
    brk = L.leer(H, W)
    neu = (mit[..., 3] > 0) & ~(links[..., 3] > 0)
    brk[neu] = mit[neu]
    spiegel = lambda a: a[:, ::-1].copy()
    brk_l = brk
    fr, br, brk_r = spiegel(fl), spiegel(bl), spiegel(brk)
    fl, fr, bl, br, kp, brk_l, brk_r = (L.versetze(a, 0, bob) for a in (fl, fr, bl, br, kp, brk_l, brk_r))
    f = L.zusammen(H, W, [(brk_l, 0, 0), (brk_r, 0, 0), (fl, 0, 0), (fr, 0, 0), (bl, 0, 0), (br, 0, 0), (kp, 0, 0)])
    return f


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
    L.speichern('skeleton-skull-bat', 'Skeleton Skull Bat', frames, MS, prev)
    if prev:
        L.streifen(prev + '/skeleton-skull-bat-strip.png', frames, spalten=8, scale=6)
