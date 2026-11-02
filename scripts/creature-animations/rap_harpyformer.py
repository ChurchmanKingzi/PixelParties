# -*- coding: utf-8 -*-
"""Idle-Animation für „Rap Harpyformer“ (Creature) — Runde 2: Harpyie mit roter Kappe und Mikrofon rappt am Boden stehend: Mund öffnet/schließt sich im Rap-Rhythmus, Körper federt im Takt, Flügel winkt.

PICK: [["MotiveDeepsea", 271, "Ebene „Hiphop Harpyformer #2“ (22×24 px)"]]
Quelle: MotiveDeepsea.xcf, Ebene 271 „Hiphop Harpyformer #2“ (Versatz (167, 141)); sie liegt unverändert als src/rap-harpyformer.png (22×24, 364 Pixel).
Abgleich mit der Kartenkunst (data/card-art/native/Rap_Harpyformer.png, 76×51): alle 364 Pixel der Ebene stehen in der Karte genauso. Die Figur LINKS im Kartenbild („Gloomy Villager-Kopie #1“, Ebene 272) und die
Eissplitter rechts (Hintergrundebenen) gehören nicht zur Creature. Der zweite Kandidat „Ebene #224“ (MotiveGN 196) ist nur ein 56-Pixel-Detail ohne Bezug.

Aufruf:   python3 rap_harpyformer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/rap-harpyformer.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Rote Kappe (x 2–17, y 1–6): Töne (111,12,35) (208,19,62) (235,25,71) (240,78,92), Schirm unten (y 5–6).
* Gesicht (x 2–15, y 7–11): Blick nach links; gelbe Stirnfransen (255,255,146), Augen = weißer Lichtpunkt (246,255,255) + dunkelrote Pupille (123,8,24) bei (6,8) (7,8) und (10,8) (11,8), dazwischen blaugrüne
  Maske (77,137,154) (51,93,119); Ohren (246,205,139) (238,156,123) links (x 2–4) und rechts (x 13–14); oranger Schnabel/Nase (238,100,40) bei (6,11) (7,12).
* MIKROFON (x 8–12, y 10–14): schwarzer, runder Kopf (0,0,0) mit dunkelgrauem Gittermuster (38,38,38) (51,51,51) in den Pixeln (9–11, 11–13), steht vor dem Mund/Kinn.
* MUND = der EINE dunkelrote Pixel (123,8,24) bei (8,10), links oben neben dem Mikro (halb dahinter) — er wird nach Nutzerwunsch geöffnet/geschlossen.
* Körper (x 1–16, y 10–19): schwarze Kapuzenjacke (0,0,0) (23,23,23) (38,38,38) (52,52,52) mit blaugrauen Armteilen (51,93,119) (77,137,154), cremeweißer Saum (255,255,227) (255,255,255) an beiden Seiten
  (y 14–19, Lichtsaum, kein Metall); unten dunkelgrüner Gürtel/Saum (30,40,27) … (67,90,59) (y 17–19).
* Flügel (x 16–21, y 0–13): schwarz-graue, nach oben gekrümmte Klinge (0,0,0) (23,23,23) (60,60,60) mit blauer Schneide (51,93,119) (77,137,154), hochgereckt; der Ansatz sitzt an der rechten Schulter (x 13–18, y 12–13).
* Beine/Füße (x 2–15, y 20–23): braune Beine (148,65,24) (189,90,57), Zehen (230,131,82), weiße Krallenspitzen bei (3,23) (6,23) (11,23) (14,23).

Ablauf (48 Frames à 65 ms = 3,12 s); Frame 0 = Ruhepose = Original. Kein Flug, kein Hover-Bob, Füße fest am Boden:
* MUND (Nutzerwunsch): der rote Pixel (8,10) wird im Rap-Rhythmus abwechselnd gezeigt (offen) und durch die Hautfarbe (246,205,139) ersetzt (zu): Silben von 1–2 Frames Dauer, kurze Pausen, am Ende der Schleife ein
  Atemholen mit geschlossenem Mund (siehe MUND_OFFEN). Frame 0 = offen (Original).
* Federn im Takt: alle 6 Frames (acht Mal pro Schleife) sinkt der Oberkörper 1 px (Knie beugen, Füße bleiben): die Jackenzeile y 17 entfällt, alles darüber (Kappe, Gesicht, Mikro, Flügel) rückt 1 px runter.
  Kopf, Mikro und Flügel sinken als EIN Block (das Mikro reißt nicht entzwei).
* Flügelklinge (Hand): klappt im festen Rhythmus nach außen: 12 Frames je Zug (4 pro Schleife), jede Zeile der Klinge (y 0–11) wandert als Ganzes waagerecht nach rechts, bis 4 px an der Spitze (Exponent 1,15,
  Spitze hinkt 1 Frame nach), der Ansatz bleibt fest. Die Klingentextur bleibt, nichts wird kopiert.
* Blinzeln: Frames 19–21 und 41–42; Lid = Hautfarbe der Maske (77,137,154) / (51,93,119) auf den Augenpixeln.
* Kein Glanz (Kappe = Stoff, Saum = Lichtsaum), keine Partikel.

Ergänzungen: keine nötig — die Ebene enthält die Figur vollständig.
Randpixel-Test (Regel 16): `B.umriss_je_ebene` setzt Randpixel in Nicht-Umrissfarbe auf die Umrissfarbe der Ebene.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_flieger_b as B
import anim_harpyb as HB

N, MS = 48, 65
BEAT, DOWN = 12, 5                                         # Frames je Flügelschlag, davon Abschlag
PAD_L, PAD_R, PAD_T, PAD_B = 2, 5, 2, 2                    # rechts: die Klinge klappt bis 4 px nach außen

spr = L.lade('rap-harpyformer')                            # Ebene 271 (Ruhepose / Referenz für den Randpixel-Test)
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
fig = spr[..., 3] > 0

KAPPE = [(111, 12, 35), (208, 19, 62), (235, 25, 71), (240, 78, 92)]
M_KAPPE = fig & L.farbmaske(spr, KAPPE)
M_KLINGE = fig & (xx >= 16) & (yy <= 11) & ~M_KAPPE            # das rechte Ende des Kappenschirms (x 16–17, y 4–6) gehört zum Kopf, nicht zur Klinge
M_FUESSE = fig & (yy >= 22)
M_KOPF = fig & (yy <= 11) & ~M_KLINGE
M_KOERPER = fig & ~(M_KLINGE | M_FUESSE | M_KOPF)


def teil(maske):
    return L.platz(np.where(maske[..., None], spr, 0).astype(np.uint8), H, W, PAD_L, PAD_T)


KLINGE, FUESSE, KOPF, KOERPER, KAPPE = teil(M_KLINGE), teil(M_FUESSE), teil(M_KOPF & ~M_KAPPE), teil(M_KOERPER), teil(M_KOPF & M_KAPPE)
LID = {(6, 8): (51, 93, 119), (7, 8): (77, 137, 154), (10, 8): (51, 93, 119), (11, 8): (77, 137, 154)}      # Augenpixel → Lid (Hautfarbe der Maske)
_m = spr[..., 3] > 0
_p = np.pad(_m, 1)
_kante = _m & (~_p[:-2, 1:-1] | ~_p[2:, 1:-1] | ~_p[1:-1, :-2] | ~_p[1:-1, 2:])
ERLAUBT = {tuple(int(v) for v in spr[y, x, :3]) for y, x in zip(*np.nonzero(_kante))}
UMRISS = {1: (0, 0, 0), 2: (49, 24, 0), 3: (0, 0, 0), 4: (49, 24, 0), 5: (111, 12, 35)}          # 1 Körper, 2 Füße, 3 Klinge, 4 Gesicht (Rand dunkelbraun), 5 Kappe


# ── Flügelschlag (Klinge klappt nach außen) ──────────────────────────────────────────────────────────────────────────
POT, LAG = 1.15, 1.0
A_KL = 4.0
Y_PIV = PAD_T + 12                                         # Ansatz der Klinge (Zeile 12 fest)


def welle(t):
    """Schlagphase 0 (Original) … 1 (außen): Abschlag in DOWN Frames, Aufschlag in BEAT − DOWN Frames; an den Wendepunkten weich."""
    u = t % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / (BEAT - DOWN))


def klinge(a, t):
    """Jede Zeile oberhalb des Ansatzes wandert als Ganzes nach rechts: dx = A · (s(t − Lag·f) − s(−Lag·f)) · f^Pot, f = Abstand zum Ansatz (0…1)."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    ys = [y for y in range(h) if a[y, :, 3].any()]
    maxd = max(1, Y_PIV - min(ys))
    for y in ys:
        f = max(0.0, (Y_PIV - y) / maxd)
        dx = int(round(A_KL * (welle(t - LAG * f) - welle(-LAG * f)) * f ** POT))
        xs_ = np.nonzero(a[y, :, 3])[0]
        if xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand (Breite {w}) geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


# ── Federn im Takt, Mund, Blinzeln ─────────────────────────────────────────────────────────────────────────────────
Y_STAUCH = PAD_T + 17                                      # Jackenzeile, die beim Einfedern entfällt (Textur, kein Gesicht/Mund)
MUND = (8, 10)                                             # der eine rote Pixel hinter dem Mikro
MUND_ROT, MUND_ZU = (123, 8, 24), (246, 205, 139)
# 1 = Mund offen (roter Pixel), 0 = zu; Rap-Silben à 1–2 Frames, kurze Pausen, am Schluss Atemholen (12 Frames je Zeile, 4 Zeilen)
MUND_OFFEN = ([1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1] +
              [1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0] +
              [1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0] +
              [1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0])
assert len(MUND_OFFEN) == N and MUND_OFFEN[0] == 1


def einfedern(t):
    """Oberkörper sinkt im Takt (alle 6 Frames) um 1 px: 0 = Ruhe, 1 = eingefedert."""
    return 1 if t % 6 in (2, 3) else 0


def blinzeln(i):
    return (19 <= i <= 21) or (41 <= i <= 42)


TEST_EBENEN = ('figur',)


def frame(i, partikel=True, nur=None):
    ebenen = nur if nur is not None else TEST_EBENEN
    d = einfedern(i)
    schichten = []
    if 'figur' in ebenen:
        kopf = KOPF
        if blinzeln(i) or not MUND_OFFEN[i]:
            kopf = kopf.copy()
            if blinzeln(i):
                for (x, y), c in LID.items():
                    kopf[PAD_T + y, PAD_L + x, :3] = c
            if not MUND_OFFEN[i]:
                kopf[PAD_T + MUND[1], PAD_L + MUND[0], :3] = MUND_ZU
        koerper = HB.stauche_zeile(KOERPER, Y_STAUCH, d)
        kopf = HB.stauche_zeile(kopf, Y_STAUCH, d)
        kappe = HB.stauche_zeile(KAPPE, Y_STAUCH, d)
        klinge_ = HB.stauche_zeile(klinge(KLINGE, i), Y_STAUCH, d)
        schichten += [(koerper, 0, 0, 1), (FUESSE, 0, 0, 2), (klinge_, 0, 0, 3), (kopf, 0, 0, 4), (kappe, 0, 0, 5)]
    f, karte = B.zusammen_mit_karte(H, W, schichten)
    B.umriss_je_ebene(f, karte, ERLAUBT, UMRISS)
    return f


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('rap-harpyformer', 'Rap Harpyformer', frames, MS, prev)
    if prev:
        L.streifen(prev + '/rap-harpyformer-strip.png', frames, spalten=8, scale=8)
