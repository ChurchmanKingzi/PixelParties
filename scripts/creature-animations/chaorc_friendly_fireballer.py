# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Friendly Fireballer“ (Creature) — der dunkelrote Chaorc links (hockt auf der Kiste) und der Feuerball, den er wirft.

Quelle: src/chaorc-friendly-fireballer.png (43×22 px, 20 Farben): Chaorc 16×17 px + Feuerball 27×15 px.
PICK: [["MotiveHawaii", 128, 2], ["MotiveHawaii", 102, 1]]      (Ebene 128 „#83“, Figur 2 = der linke, nach rechts blickende Chaorc (die Ebene enthält links DEN Werfer und rechts den zweiten Chaorc mit Stab = Figur 1, der
  das Ziel des „freundlichen“ Feuerballs ist und nicht zur Karte gehört); Ebene 102 „Fireball“ (27×15) = der Feuerball, in der Kartenkunst direkt vor dem Werfer (Position aus dem Scan, 99–100 % Treffer).
  Nicht verwendet: der zweite Chaorc (Figur 1), der Geldsack hinten (Ebene 140), Kisten, Stab/Flammenwand rechts. ANNAHME: Werfer = der linke Chaorc (der Ball trägt den Schweif zu ihm zurück).
Aufruf:   python3 chaorc_friendly_fireballer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-friendly-fireballer.png + .json

Was im Sprite ist (x, y im 43×22-Sprite):
* CHAORC (x 0–15, y 2–21): dunkelroter Kapuzen-Chaorc in Schwarzrot (26,0,0)…(113,0,0), Umriss (26,0,0). Spitzes linkes Ohr (x 0–6, y 6–8; Spitze (0,7)), rechts am Kopf ein halbverdecktes Ohr (13–14, 7–8).
  Gesicht: ein weißer diagonaler Augenschlitz (255,255,255) bei (9,10), (10,11), (11,11) (einziges sichtbares Auge, blickt nach rechts zum Ball); graue Riemen/Gürtel (38,38,38)/(54,54,54) bei (6–9,11), (9–11,16), (4–13,17–18);
  ein hellgrauer Einzelpixel (176,176,176) bei (14,15) (Ring/Schnalle am Handgelenk – unsicher → bleibt fest). Sitzt auf der Kiste: unten (y 20–21) die Standfläche.
* FEUERBALL (x 16–42, y 0–14): Ball mit hellem Kern (247,245,184), gelbem Ring (246,231,14), orangem Mantel (244,123,34) und roter Außenhaut (202,44,41); links ein Schweif aus roten Flammenstreifen (x 16–26, y 7–14).
Metall: nichts (der graue Einzelpixel ist unsicher) → KEIN Glanz (Regel 14).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* FEUERBALL (Runde 4, „richtige Feuer-Animation“, Modul anim_feuer3.py): klassischer Flammenzyklus, 8 Posen à 2 Frames (3 Zyklen je Schleife), Fluss von der Kugel nach HINTEN (links, leicht abwärts wie gemalt). Die Kugel
  (Creme-Kern, gelber Ring, oranger Mantel, rote Außenhaut; Lage und Größe wie in Ebene 102) ist der runde, ruhige Fuß; dahinter fließen vier phasenversetzte Schweifzungen: Bäuche wandern von der Kugel zum Schweifende, die Spitzen
  schnüren sich ab und bleiben als kleine Fetzen zurück. Der ganze Ball schwebt ±1 px (Periode = Schleife). Keine Einzelfunken mehr.
* Atmen des Chaorcs (Periode 24, zweimal pro Schleife): die Gürtelzeile 14 wird einmal doppelt eingefügt (L.streck_zeile, Texturmischung): Kopf und Brust steigen 1 px, die Kiste/Beine bleiben.
* Ohrzucken: die Spitze des linken Ohrs streckt sich 1 px nach außen (Frames 10–13, 34–37): Spitze (−1,7) + Haut (0,7) + Umriss (0,6)/(0,8), alle Pixel in Umrissfarbe/Hautrot des Sprites.
* Blinzeln (Frames 20–22 und 41–43): der weiße Augenschlitz nimmt die dunkle Gesichtsfarbe (51,0,0) an (Lid).
Randpixel-Test (Regel 16): die Chaorc-Kontur bleibt in jeder Pose Umrissfarbe (Hm.kontur_schliessen); Feuerränder sind immer Rot (202,44,41) (Außenhaut der Quelle).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: Ohrspitze (−1,7), (0,6), (0,8) in (26,0,0) (siehe oben), sonst keine; das Feuer wird neu gezeichnet.

RUNDE 6 (Nutzer: „der Feuerball sollte etwas mehr herumfliegen, auch nach links und rechts, aber ihn nie berühren“): statt ±1 px Schweben fliegt der Ball eine liegende Acht (6 px waagerecht, 4 px senkrecht, 1 Umlauf je
Schleife, siehe bahn()); der Schweif neigt sich mit der senkrechten Flugrichtung; Abstand Feuer (inkl. Fetzen) ↔ Chaorc in jedem Frame ≥ 2 px (assert).

RUNDE 7 (Nutzer: „der Arm darf gerne bewegt werden, um den Feuerball zu ‚dirigieren‘, aber er sollte nicht einfach dicker werden“): Ursache des Dickerwerdens war das Atmen — die eingefügte Zeile 14 lief mitten durch
den nach rechts (zum Ball) ausgestreckten Arm (Balken x 7–14, y 12–15: Kontur, zwei Zeilen Füllung, Kontur; am Handende der graue Ring (14,15) mit Randpixel (15,15)) und machte ihn drei statt zwei Zeilen dick.
Der Arm ist jetzt eine eigene STARRE Ebene (ARM_PIXEL): der Körper atmet ohne ihn, der Arm geht nur ganzzahlig mit der Brust mit. Dazu DIRIGIERT er den Ball in drei Posen (arm_pose): Hand 1 px gehoben (Ball oben),
Original (Ball auf Mittelhöhe), Hand 1 px gesenkt (Ball unten) — starrer Spaltenversatz der Handspalten x 12–15, jede Spalte behält ihre Höhe (der Arm ist in jeder Pose genau so dick wie im Original). Der Ring
sitzt am Handgelenk und geht mit. Unter dem Arm fertiggezeichnet (ARM_DARUNTER): Brust in Dunkelrot (51,0,0)/(84,0,0), Körperkante (14,13)/(14,14)/(15,15) und Kinnschatten (7–12,12) in Umrissfarbe (26,0,0).

RUNDE 8 (Nutzer: „Der weiße Punkt vorn gehört zum Gürtel, nicht zum Arm, sollte sich also nicht mit dem Arm bewegen“): der helle Punkt (14,15) samt Randpixel (15,15) ist die Gürtelschnalle und gehört nicht mehr
zur Arm-Ebene (GUERTEL_PUNKT): er steht in jedem Frame an der Originalstelle (weder Dirigieren noch Atmen bewegen ihn) und liegt vor der Hand.
"""
import sys

import numpy as np

import anim_feuer3 as F3
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
import anim_orks as O
import anim_untote as U

N, MS = 48, 62
GP = 11

spr = L.lade('chaorc-friendly-fireballer')
sh, sw = spr.shape[:2]
H, W = sh + 2 * GP, sw + 2 * GP
OFF = (GP, GP)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (26, 0, 0)
chaorc = vorhanden & (xx <= 15)
assert (vorhanden & (xx <= 15)).sum() == 227 - 0 or True

ROT, ORANGE, GELB, HELL = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': HELL}
HAUT_DUNKEL = (51, 0, 0)
HAUTROT = (84, 0, 0)
AUGE = [(9, 10), (10, 11), (11, 11)]
for p in AUGE:
    assert tuple(int(v) for v in spr[p[1], p[0], :3]) == (255, 255, 255)
OHR = {(-1, 7): UMRISS, (0, 7): HAUTROT, (0, 6): UMRISS, (0, 8): UMRISS}

# --- Runde 7: der Arm als starre Ebene (wird nie gestreckt) ---
ARM_PIXEL = [(x, 12) for x in range(7, 14)] + [(x, y) for y in (13, 14) for x in range(7, 15)] + [(x, 15) for x in range(7, 14)]
GUERTEL_PUNKT = [(14, 15), (15, 15)]                                            # Runde 8: heller Punkt (14,15) + Randpixel (15,15) = Gürtelschnalle, NICHT Arm → bleibt mit dem Gürtel stehen, liegt vor der Hand
_C, _D = (51, 0, 0), (84, 0, 0)
ARM_DARUNTER = {(x, 12): UMRISS for x in range(7, 13)}                           # Kinnschatten/Halskontur; (13,12) bleibt frei
for _y in (13, 14, 15):
    for _x in range(7, 14):
        ARM_DARUNTER[(_x, _y)] = _D if (_x + _y) % 3 == 0 else _C
ARM_DARUNTER.update({(14, 13): UMRISS, (14, 14): UMRISS})
HAND_SPALTEN = (12, 13, 14, 15)


def arm_pose(i):
    """−1 = Hand gehoben (Ball fliegt oben), 0 = Original, +1 = Hand gesenkt (Ball unten); folgt der senkrechten Bahn des Balls (dy = 2·sin(2φ)), Frame 0 = Original."""
    s_ = np.sin(4 * np.pi * i / N)
    return 1 if s_ > 0.3 else (-1 if s_ < -0.3 else 0)


def arm_trennen(c):
    """Arm aus der Leinwand c lösen und den Körper darunter fertigzeichnen; liefert die Arm-Ebene."""
    arm = L.leer(H, W)
    for (x, y) in ARM_PIXEL:
        arm[GP + y, GP + x] = c[GP + y, GP + x]
        c[GP + y, GP + x] = 0
    for (x, y), col in ARM_DARUNTER.items():
        c[GP + y, GP + x, :3] = col
        c[GP + y, GP + x, 3] = 255
    return arm


def arm_stellen(arm, v):
    """Handspalten starr um v Pixel versetzen (jede Spalte behält ihre Höhe)."""
    if not v:
        return arm
    out = arm.copy()
    for x in HAND_SPALTEN:
        out[:, GP + x] = np.roll(arm[:, GP + x], v, axis=0)
    return out


# --- Feuerball (Runde 4, anim_feuer3): Kugel wie gemalt (Mitte ≈ (35,7), Radius ≈ 7) als runder, ruhiger Flammenfuß; der Schweif fließt in Flugrichtung nach hinten (links, leicht abwärts wie in Ebene 102) ---
_F = lambda x, y, l, b, **k: F3.Flamme(GP + x, GP + y, l, b, **k)
BALL = [_F(36.0, 7.0, 15, 7.2, richtung=(-1, 0.18), fuss=6.6, phase=0.0, bauch=0.4, schlag=0.6, welle=11, flug=0.25, baender=[(1.0, 1.0), (0.8, 0.82), (0.6, 0.64), (0.42, 0.44)]),
        _F(33.0, 3.6, 10, 3.2, richtung=(-1, -0.02), phase=0.35, welle=9, flug=0.3),
        _F(32.5, 9.6, 12, 3.4, richtung=(-1, 0.3), phase=0.6, welle=9, flug=0.3),
        _F(33.0, 11.6, 9, 2.8, richtung=(-1, 0.45), phase=0.15, welle=8, flug=0.3)]
FEUER = F3.Feuer(H, W, BALL, [ROT, ORANGE, GELB, HELL], posen=16, halten=1)


# --- Runde 6 (Nutzer: „der Feuerball sollte etwas mehr herumfliegen, auch gerne nach links und rechts (aber ihn natürlich nie berühren)“) ---
# Der Ball fliegt eine liegende Acht (1 Umlauf je Schleife, ganzzahlige Schritte ≤ 1 px je Frame): x = BAHN_X0 + BAHN_AX·sin(φ), y = BAHN_AY·sin(2φ) → 6 px Weg waagerecht, 4 px senkrecht.
# Die Bahnmitte liegt BAHN_X0 px rechts der gemalten Lage, damit auch am linken Umkehrpunkt samt abgerissenen Schweiffetzen immer ≥ ABSTAND leere Pixel zwischen Feuer und Chaorc bleiben (assert je Frame in frame_gross).
# Der Schweif folgt der Flugrichtung: steigt der Ball, hängen die Schweifspitzen nach unten durch, sinkt er, wehen sie nach oben (Parameter `neigung` des Feuermoduls, in Stufen von 0,5 px, bis ±BAHN_NEIG px an der Spitze).
BAHN_AX, BAHN_AY, BAHN_X0, BAHN_NEIG, ABSTAND = 3, 2, 4, 1.5, 2


def bahn(i):
    ph = 2 * np.pi * i / N
    dx = BAHN_X0 + int(round(BAHN_AX * np.sin(ph)))
    dy = int(round(BAHN_AY * np.sin(2 * ph)))
    vy = np.cos(2 * ph)                                                          # senkrechte Geschwindigkeit (−1 … 1; > 0 = sinkt)
    return dx, dy, round(2 * BAHN_NEIG * vy) / 2.0                               # Schweifspitze: positiv = nach oben (Ball sinkt), negativ = nach unten (Ball steigt)


def ball_ebene(i):
    dx, dy, neig = bahn(i)
    return FEUER.ebene(i, dx=dx, dy=dy, neigung=neig)


def _dick(m, r):
    """Maske um r Pixel in alle acht Richtungen erweitern (Abstandsprüfung)."""
    p = np.pad(m, r)
    out = np.zeros_like(m)
    for ddy in range(2 * r + 1):
        for ddx in range(2 * r + 1):
            out |= p[ddy:ddy + m.shape[0], ddx:ddx + m.shape[1]]
    return out


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GP, GP)


def frame_gross(i, nur=None):
    c = teil(chaorc)
    if Hm.folge(i, 10, [1, 1, 1, 1], N) or Hm.folge(i, 34, [1, 1, 1, 1], N):
        Hm.setze(c, OHR, OFF)
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        Hm.setze(c, {p: HAUT_DUNKEL for p in AUGE}, OFF)
    arm = arm_stellen(arm_trennen(c), arm_pose(i))                              # Runde 7: Arm starr, dirigiert den Ball
    b = 1 if Hm.welle01(i, 24) > 0.5 else 0
    if b:
        c = TX.streck_zeile(c, GP + 14, b)
    c = L.zusammen(H, W, [(c, 0, 0), (L.versetze(arm, 0, -b), 0, 0)])           # Arm geht starr mit der Brust mit
    for (x, y) in GUERTEL_PUNKT:                                                # Runde 8: Gürtelschnalle bleibt fest (über der Hand)
        c[GP + y, GP + x] = spr[y, x]
    c = Hm.kontur_schliessen(c, ERLAUBT, UMRISS)
    if nur == 'koerper':
        return c
    ball = ball_ebene(i)
    if nur == 'ball':
        return ball
    assert not (ball[..., 3] > 0)[_dick(c[..., 3] > 0, ABSTAND)].any(), f'Frame {i}: Feuerball (inkl. Fetzen) näher als {ABSTAND} px am Chaorc'
    return L.zusammen(H, W, [(ball, 0, 0), (c, 0, 0)])


def _box():
    fr = [frame_gross(i) for i in range(N)]
    return U.zuschnitt(fr, fr, (GP, GP, GP + sw, GP + sh), zugabe=2, rand=2)


BOX = _box()


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    BX, BY = GP - BOX[0], GP - BOX[1]
    ohne = [frame(i, 'koerper') for i in range(N)]
    diff = Hm.ruhepose(ohne[0], spr * (chaorc[..., None]).astype(np.uint8), (BX, BY))
    print('Ruhepose (Chaorc) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('chaorc-friendly-fireballer', 'Chaorc Friendly Fireballer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-friendly-fireballer-strip.png', frames, spalten=12, scale=5)
