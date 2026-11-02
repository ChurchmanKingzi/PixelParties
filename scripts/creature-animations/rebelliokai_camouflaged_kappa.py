# -*- coding: utf-8 -*-
"""Idle-Animation für „Rebelliokai Camouflaged Kappa“ (Creature) — der im Wasser getarnte Kappa mit Kopfschale, grünem Gesicht und Schwert.

Quelle: src/rebelliokai-camouflaged-kappa.png (44×16 px, 31 Farben).
PICK: [["MotiveJapan", 42, 1]]      (Ebene „Kappa“, Figur 1; nur in dieser Karte. Die Ebenen 40/41/45 enthalten dieselben Teile in sauberen Farben — Kopf mit Bauch, Schwert, Schwimmflossen —, die Karte zeigt aber die
Ebene 42, in der der Körper vom Wasser abgedunkelt ist; die weißen Ebenen 43/44 sind Masken. Das Wasser/der Schilf der Kunst gehört nicht zur Figur.)
Quelle vollständig: ja für das, was die Karte zeigt (die Beine unter der Wasserlinie sind in der Kunst abgeschnitten; es wird nichts ergänzt).

Aufruf:   python3 rebelliokai_camouflaged_kappa.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rebelliokai-camouflaged-kappa.png + .json

Was im Sprite ist (x, y im 44×16-Sprite):
* KOPFSCHALE (x 6–17, y 0–4): ein brauner/beiger Rand (128,99,82)/(161,148,119) um blaues Wasser (52,102,176)/(113,181,219) mit hellen Spiegelungen (158,228,239)/(209,251,240) — die Schüssel eines Kappa mit Wasser.
* GESICHT (x 7–16, y 4–7): grüne Haut (80,205,144)/(106,226,145), zwei AUGEN je 2×2 bei (8–9, 6–7) und (14–15, 6–7): grauweißer Punkt (175,181,187)/(203,210,217), rosa-roter Punkt (195,67,92) bzw. dunkelrot (129,11,11),
  dunkelbraune Braue (51,39,33); schwarzer Rand (0,0,0) bei (7,7) und (16,7).
* KÖRPER (x 7–16, y 8–13): vom Wasser abgedunkelter Rumpf (26,25,24)/(43,42,40)/(80,66,57)/(88,94,60) mit hellbraunem Bauchfleck (180,166,129)/(161,148,119) und unten am Rand Bauch-/Panzerpixel (138,64,40)/(218,181,128)/(243,231,168)/(179,121,77).
* LINKE SCHWIMMFLOSSE/HAND (x 0–7, y 10–15): grün-türkis (23,117,110)/(80,205,144)/(106,226,145) mit dunklem Umriss (11,59,68), hängt unten am Rumpf.
* RECHTE HAND (x 17–23, y 7–13) hält den GRIFF des Schwerts (dunkelrot (59,15,16)/(81,21,29)/(78,44,45), Parierstange (131,109,112)) bei (20–23, 9–12).
* SCHWERT (x 24–43, y 10–11): Klinge oben hellgrau (204,204,196), unten grau (122,121,117), Spitze dunkler (42–43, 10). METALL → Glanz erlaubt.
Kein Feuer, kein Stein: nur die Klinge glänzt (Regel 12/14); Gesicht, Wasser und Haut nicht.

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos; Frame 0 = Original):
* KLINGE PENDELT: das Schwert schwingt mit der Hand (Hand samt Griff starr 0…±1 px, die Klingenspalten wachsen bis ±3 px an der Spitze, Gefälle ≤ 0,15 px je Spalte → die zwei Klingenzeilen bleiben 4-verbunden);
  eine Welle je Schleife plus ein kleines schnelles Zittern (3 je Schleife).
* LINKE FLOSSE: paddelt (2 Wellen je Schleife): die Spalten wandern mit dem Abstand zur Schulter (x 7) bis 2 px, mit Nachlauf zur Spitze.
* ATMEN (2× je Schleife): die dunkle Zeile 12 des Rumpfes wird einmal doppelt eingefügt → Kopf und Schale steigen 1 px, Hand und Schwert steigen starr mit, die Flosse mit.
* BLINZELN (Frames 12–14, 36–38): die Augenpunkte nehmen die Hautfarbe an, die untere Zeile wird zum dunklen Lidstrich (51,39,33).
* WASSER IN DER SCHALE: ein heller Wellenpunkt (113,181,219) wandert zweimal je Schleife über die blaue Zeile (y 2) der Schale (kein Lichtband, nur das Schwappen des Wassers).
* KLINGENGLANZ (Regel 12, Metall): zweimal je Schleife läuft ein Lichtband (1 Stufe heller auf der Rampe (122,121,117) → (204,204,196) → (243,231,168)) über die Klinge, danach blitzt an der Spitze ein 4-zackiger Stern auf (wächst/schrumpft, bleibt an der Klinge).
Keine Partikel, kein Wasserdampf. Alle Bewegungen laufen auf der vollen Leinwand (ClipError statt Abschneiden). Nur ganze Pixel, nur Quellfarben.
Ergänzungen: keine gemalten Pixel (Frame 0 = Original).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_rebel as R

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 2, 3, 3, 4

spr = L.lade('rebelliokai-camouflaged-kappa')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
f = lambda x, y: R.farbe(spr, x, y)

ERLAUBT = set(Hm.umrissfarben(spr))
HAUT = f(10, 6)                                                     # (80,205,144) Gesichtsgrün, Lidfarbe
LID = f(9, 6)                                                       # (51,39,33) dunkelbraun
WASSER, WELLE = f(9, 2), f(8, 2)                                    # (52,102,176) / (113,181,219)
KLINGE_HELL, KLINGE_DUNKEL, SPITZE = f(30, 10), f(30, 11), f(42, 10)
GLANZ = f(12, 13)                                                   # (243,231,168) helles Cremeweiß des Bauchs (Randfarbe der Quelle) = hellste Stufe des Klingenglanzes
RAMPE = [KLINGE_DUNKEL, KLINGE_HELL, GLANZ]                          # (122,121,117) < (204,204,196) < (243,231,168)
WEISS = GLANZ
UMRISS = f(7, 5)                                                    # (11,59,68) türkis-dunkel (Randfarbe der Haut)
ERLAUBT |= set(RAMPE)                                               # Klingenglanz-Stufen dürfen am Rand der Klinge stehen

flosse = vorhanden & (xx <= 6) & (yy >= 10)
flosse[11, 7] = flosse[12, 7] = vorhanden[11, 7] and vorhanden[12, 7]
klinge = vorhanden & (xx >= 24)
hand = vorhanden & (xx >= 17) & (xx <= 23) & (yy >= 7) & (yy <= 13)
kern = vorhanden & ~flosse & ~klinge & ~hand
AUGEN_HAUT = [(8, 6), (15, 6)]
AUGEN_LID = [(8, 7), (9, 7), (14, 7), (15, 7)]
STERN_X, STERN_Y = 41, 10


def stern(a, x, y, stufe, dy):
    """Vierzackiger Glanzstern (Spritekoordinaten) an der Klinge: stufe 0 = Mitte, 1 = Arme 1 px, 2 = Arme 2 px; dy = aktuelle Klingenverschiebung."""
    if stufe is None:
        return a
    pts = {(x, y + dy): WEISS}
    if stufe >= 1:
        pts.update({(x + 1, y + dy): WEISS, (x - 1, y + dy): WEISS, (x, y + dy + 1): KLINGE_HELL, (x, y + dy - 1): KLINGE_HELL})
    if stufe >= 2:
        pts.update({(x + 2, y + dy): KLINGE_HELL, (x - 2, y + dy): KLINGE_HELL, (x, y + dy + 2): KLINGE_DUNKEL, (x, y + dy - 2): KLINGE_DUNKEL})
    return Hm.setze(a, pts, OFF)


def klinge_ebene(i, a):
    """Klinge mit Spaltenversatz (Spitze stärker), Glanzband; a = Auslenkung der Spitze."""
    kl = R.teil(spr, klinge, H, W, OFF)
    out = L.leer(H, W)
    for x in range(24, sw):
        dy = int(round(a * (0.3 + 0.7 * (x - 24) / (sw - 25))))
        for y in range(sh):
            if klinge[y, x]:
                px = kl[y + PAD_T, x + PAD_L].copy()
                out[y + PAD_T + dy, x + PAD_L] = px
    return out


def frame(i):
    # Auslenkung: eine Welle je Schleife + schnelles Zittern (3 je Schleife)
    a = 2.0 * math.sin(L.sinus(i, N)) + 0.7 * math.sin(L.sinus(i, N / 3))
    hdy = int(round(0.3 * a))
    b = Hm.stufe(i, N / 2, 1)
    k = R.teil(spr, kern, H, W, OFF)
    fl = R.teil(spr, flosse, H, W, OFF)
    ha = R.teil(spr, hand, H, W, OFF, dy=hdy)
    kl = klinge_ebene(i, a)
    # Blinzeln
    if Hm.folge(i, 12, [1, 1, 1], N) or Hm.folge(i, 36, [1, 1, 1], N):
        Hm.setze(k, {p: HAUT for p in AUGEN_HAUT}, OFF)
        Hm.setze(k, {p: LID for p in AUGEN_LID}, OFF)
    # Wasser in der Schale: heller Wellenpunkt läuft über die blaue Zeile y=2 (x 9–14), zweimal je Schleife
    for start in (3, 27):
        k_ = (i - start) % N
        if 0 <= k_ < 12:
            x0 = 9 + (k_ // 3) * 1.25
            Hm.setze(k, {(int(round(x0)), 2): WELLE}, OFF)
    # Klingenglanz: Band über die Klinge (zweimal je Schleife), danach Stern an der Spitze
    for start in (6, 30):
        k_ = (i - start) % N
        if 0 <= k_ < 12:
            xc = 24 + k_ * 1.7
            for x in range(24, sw):
                if abs(x - xc) <= 1.2:
                    for y in (10, 11):
                        if klinge[y, x] and kl[y + PAD_T + int(round(a * (0.3 + 0.7 * (x - 24) / (sw - 25)))), x + PAD_L, 3]:
                            yy_ = y + PAD_T + int(round(a * (0.3 + 0.7 * (x - 24) / (sw - 25))))
                            kl[yy_, x + PAD_L, :3] = Hm.farbe_stufe(kl[yy_, x + PAD_L, :3], RAMPE, 1)
    st = Hm.folge(i, 18, [0, 1, 2, 2, 1, 0], N) if True else None
    if st is None:
        st = Hm.folge(i, 42, [0, 1, 2, 2, 1, 0], N)
    # Flosse paddelt
    fl = R.spalten_pendel(fl, PAD_L + 7, 1.1, L.sinus(i, N / 2), lauf=1.0, ruhe0=True)
    # Atmen: Zeile 12 (Kern + Flosse), Hand + Klinge starr hoch
    if b:
        k = L.streck_zeile(k, PAD_T + 12, 1)
        fl = L.streck_zeile(fl, PAD_T + 12, 1)
        ha = L.versetze(ha, 0, -1)
        kl = L.versetze(kl, 0, -1)
    fig = L.zusammen(H, W, [(fl, 0, 0), (k, 0, 0), (ha, 0, 0), (kl, 0, 0)])
    if st is not None:
        stern(fig, STERN_X, STERN_Y, st, int(round(a * (0.3 + 0.7 * (STERN_X - 24) / (sw - 25)))) - b)
    fig, _br = R.verbinde(fig)                                       # Klingenstufe: Eckkontakt → 4-verbunden
    kk = Hm.kantenmaske(fig)
    for y, x in zip(*np.nonzero(kk)):
        c = tuple(int(v) for v in fig[y, x, :3])
        if c not in ERLAUBT:
            fig[y, x, :3] = UMRISS
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = R.vorschau_arg()
    R.abschluss('rebelliokai-camouflaged-kappa', 'Rebelliokai Camouflaged Kappa', frames, MS, spr, OFF, prev,
                check_frames=[0, 6, 9, 12, 18, 21, 24, 30, 36, 42])
