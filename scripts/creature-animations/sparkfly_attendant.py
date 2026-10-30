# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparkfly Attendant“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveRussia", 160, 2], ["MotiveRussia", 159, 2], ["MotiveRussia", 158, 1], ["MotiveRussia", 158, 2]]
Eigenes Sprite (Mehrebenen-Bau, wie Sparkfly Worker): Die Karte zeigt drei gleiche rote Fliegen (je 21×19 px, vollständig sichtbar, Wabe-Silhouette per Farbabstand) und darüber die
dunkle Rüstungsfigur der Königin (nur angeschnitten, Dunst). Das ist der Attendant, die gleiche rote Fliege steht auf der Karte „Sparkfly Queen“ unten Mitte. Ich habe die mittlere Fliege gewählt
und aus den sauberen Ebenen von MotiveRussia.xcf gebaut (Platzierung per Silhouetten-Abgleich mit der Karte; die Flügel der Karte sind durch die Wabe getönt, die Ebenenfarben sind die sauberen):
  src/sparkfly-attendant-koerper.png     Ebene 160, Figur 2 (Käfer von oben: dunkler Kopf mit Fühlern, Brust, gestreifter Hinterleib, sechs Beine; 18×18 px) an Kartenposition (30,24),
                                         Abgleich der dunklen Teile 0,81
  src/sparkfly-attendant-rot.png         Ebene 159, Figur 2 (rote Brustzeichnung, 10×9 px) an (33,31)
  src/sparkfly-attendant-fluegel-l / -r  Ebene 158, Figuren 1 und 2 (Blattflügel 9×13 px, 80 Pixel) an (28,31) und (40,31) — decken 110 der 128 Restpixel der Fliege (die übrigen 18: Beine/Fühler)
  src/sparkfly-attendant.png             das fertige Sprite (21×20 px, 15 Farben) = alle Ebenen übereinander (Flügel hinter dem Körper, Rot oben)
Die Flügel der Karte sind weich durchscheinend; hier deckend (wie bei den Bomblebees und den anderen Sparkflies).

Aufruf:   python3 sparkfly_attendant.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparkfly-attendant.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Körper (x 2–18, y 0–16): dunkler Kopf mit zwei Fühlern (y 0–6), Brust (y 7–14) mit je drei Beinen links und rechts, gestreifter Hinterleib (Gelb (191,186,24)/(161,157,20), Schwarzbraun) y 11–16.
* Rote Zeichnung auf der Brust (x 5–13, y 7–14): Rottöne (128,0,0)/(157,0,0)/(191,0,0)/(215,0,0)/(251,0,0).
* Flügel: zwei olivgrüne Blätter (Rand (58,56,6), Füllung (147,151,11)/(160,160,21)), links x 0–8, rechts x 12–20, y 7–19, hängen nach außen unten.

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: achtmal pro Schleife (Periode 6): jedes Blatt dreht sich als Ganzes um seine Wurzel an der Oberseite der Brust (links (7,8), rechts (13,8)) und die Spitze beschreibt
  einen großen Bogen: Aufschlag bis weit über die Waagerechte (+100°), Abschlag bis fast senkrecht nach unten (−24°), Abschlag schneller als Aufschlag, Ruhepose (Frame 0) = Original.
  Drehung per Rückrechnung (Nächster-Nachbar, Alpha 0/255, Kanten geglättet); die Blätter bleiben vollständig und liegen hinter dem Körper. Beide Flügel gespiegelt gleichzeitig.
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12).
* Der Hinterleib atmet: er wird beim Einatmen 1 px länger (Periode 24, eine Streifenzeile wird verdoppelt).
* Kein Glanz (Chitin/Flügel sind kein Metall), kein Feuer, keine Partikel; der Käfer hat keine Augen im Sprite (kein Blinzeln).

Ergänzungen: keine nötig — die Blätter sind vollständig (der Körper deckt nur ihre Wurzel), nichts Verdecktes fehlt.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 1 px freier Rand), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Die Drehung kann Innenfarbe an die Flügelkanten legen → F.umranden setzt den Flügelrand (58,56,6); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 12, 12, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('sparkfly-attendant')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R


def teil(name):
    return L.platz(L.lade('sparkfly-attendant-' + name), H, W, PAD_L, PAD_T)


P_WL, P_WR, P_KP, P_ROT = teil('fluegel-l'), teil('fluegel-r'), teil('koerper'), teil('rot')
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_KP, P_ROT)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()

UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (58, 56, 6)
KOERPERRAND = (17, 11, 5)
THETA_C, THETA_A = math.radians(38.0), math.radians(62.0)    # Drehwinkel −24° … +100° (Ruhe 0°)
THETA_P0 = math.asin(-THETA_C / THETA_A)
PIV_L, PIV_R = (PAD_L + 7.0, PAD_T + 8.0), (PAD_L + 13.0, PAD_T + 8.0)     # Flügelwurzeln
Y_ABD = PAD_T + 14                                           # Zeile im Hinterleib, die beim Atmen verdoppelt wird


def streck_unten(a, zeile, n):
    """Zeile `zeile` n-mal zusätzlich einfügen: alles oberhalb bleibt, alles darunter rückt nach unten."""
    if n == 0:
        return a.copy()
    h = a.shape[0]
    if a[h - n:, :, 3].any():
        raise L.ClipError('streck_unten würde belegte Zeilen am unteren Rand abschneiden')
    rows = list(range(zeile + 1)) + [zeile] * n + list(range(zeile + 1, h - n))
    return a[rows].copy()


def frame(i, partikel=True, effekte=True):
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)
    bauch = int(round(1.2 * (1 - math.cos(L.sinus(i, N / 2))) / 2))      # Hinterleib 0 … 1 px länger

    wl, wr, kp, rot = P_WL.copy(), P_WR.copy(), P_KP.copy(), P_ROT.copy()

    # Flügelschlag: jedes Blatt dreht sich um seine Wurzel
    ph2 = ph + 0.4 * math.sin(ph)                              # Abschlag schneller als Aufschlag
    theta = THETA_C + THETA_A * math.sin(ph2 + THETA_P0)       # links: im Uhrzeigersinn (+) = Spitze hebt sich über die Waagerechte; Ruhe (Frame 0) = 0
    wl = F.drehen(wl, PIV_L[0], PIV_L[1], theta, glatt=True)
    wr = F.drehen(wr, PIV_R[0], PIV_R[1], -theta, glatt=True)

    kp = streck_unten(kp, Y_ABD, bauch)                        # Hinterleib atmet
    wl, wr, kp, rot = (L.versetze(a, 0, bob) for a in (wl, wr, kp, rot))
    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0), (rot, 0, 0)])
    F.umranden(f, [wl, wr], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)       # Randpixel-Test (Regel 16)
    F.umranden(f, [kp], UMRISS, KOERPERRAND, KOERPERRAND, KOERPERRAND)
    return f


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 1 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 1, ey0 - 1, ex1 + 1, ey1 + 1
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    koerper_frames = [frame(i, False, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=[(33, 30, 5)], min_rand=1)      # (33,30,5): dunkler Blattrand aus Ebene 158, im Ruhebild vom Körper verdeckt
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-attendant', 'Sparkfly Attendant', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-attendant-strip.png', frames, spalten=8, scale=6)
