# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Ankylos“ (Creature).

Quelle: src/gigantisaur-ankylos.png — der Ankylosaurus (60×41 px, 24 Farben) aus MotiveGrailWar.xcf, Ebene 511 „Dinos“, Figur 4 (die Ebene ist ein Sammelbogen mehrerer Dinosaurier;
verwendet wird nur dieser, wie auf der Karte).
PICK: [["MotiveGrailWar", 511, 4]]

Aufruf:   python3 gigantisaur_ankylos.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-ankylos.png + .json

Identifikation (Sprite 60×41, braungrauer Ankylosaurus im Profil, nach rechts blickend, schräg-schattiert mit Schachbrett-Rasterung C/D):
* Schwanzkeule oben links (x 0–13, Zeilen 0–9): großer runder Knochenklumpen mit Rasterfläche C (105,74,56) / D (130,107,76), schwarzer Umriss A/B; daran ein langer, nach unten rechts
  abfallender dunkelgrauer Schwanz E/F (x 3–15, Zeilen 9–21), am Becken angewachsen.
* Panzerrücken (x 15–59, Zeilen 11–28): sehr dunkler Rücken (A/B/G/I) mit grauen Stachelspitzen J (150,136,127) / K / Q (z. B. (16,17) (24,19) (33,13) (40,14) …) und schwarzen Stachelspitzen B;
  hellbraunes Rasterband am Bauch (x 18–45, Zeilen 23–27).
* Kopf rechts (x 47–59, Zeilen 17–29): dunkel, mit zwei schwarzen Augenpunkten (53,22) (57,22) und hellen Lichtpunkten darunter; Maul/Schnauze unten rechts.
* Vier Beine: hinten ein breites Doppelbein (x 9–19, Zeilen 26–35), vorn (x 33–43, Zeilen 29–40) und (x 47–56, Zeilen 29–37) mit schwarzen Zehenlinien.
* Kein Glanz (Panzer/Knochen/Haut, Regel 14), keine Partikel. Die hellen Stachelpunkte sind schon gezeichnet und bleiben fest.
Bleibt fest: Panzerrücken (bis auf das Heben), Stacheln, Kopf (außer Hub), Zehenlinien, die hellbraune Rasterfläche.

Runde 2 (Nutzerkorrektur wörtlich: „Der Unterkiefer bewegt sich nie mit dem Rest des Kopfes mit.“): Kopf UND Unterkiefer sind jetzt EIN starres Teil (eigene Ebene). Der Kopf umfasst alles ab x ≥ 47 bis
Zeile 27 (Schädel, Augen, Schnauze, Kinnumriss) und rechts von x ≥ 51 auch die Zeilen 28–29 (Unterkiefer: Ober-/Unterlippe, Kieferfläche S/T/U und Unterkante D, x 51–58, Zeilen 26–29). Die Oberkante der Vorderbeine
(x 47–50, Zeilen 28–29) bleibt beim Körper. Hebt sich der Kopf (Atmen und Schnüffeln), wandert der ganze Kopf samt Kiefer starr 1 px (bzw. 2 px) nach oben; die dabei freiwerdende Kehlzeile (x 47–50) wird
mit dem Beinpixel darunter gefüllt (Ergänzung), unter dem Kiefer bleibt es leer (freie Luft).

Ablauf (60 Frames à 66 ms = 3,96 s), alle Bewegungen unabhängig:
* Atmen (Periode 30, 2× pro Schleife; oben in Frames 3–16 und 33–46): Zeile 24 (Flanke) wird eingefügt — Rücken, Schwanz und Stacheln heben sich 1 px und der KOPF (samt Unterkiefer, starr) hebt sich mit, die Beine bleiben am Boden.
* Schwanz schwingt: zweimal pro Schleife (Frames 3–26 und 32–55) schwingt der Schwanz mit der Keule zweimal seitlich hin und her (bis ±3 px an der Keule, wandernde Welle, am Becken fest);
  dazwischen hängt er wie im Original.
* Kopf hebt sich (Schnüffeln): zweimal pro Schleife (Frames 18–29 und 48–59) hebt sich der ganze Kopf samt Unterkiefer 1 px gegenüber dem Rücken (starre Ebene), dann senkt er sich wieder.
* Beine heben (Runde 3, Nutzerkorrektur wörtlich: „das Heben von Füßen nicht durch das Einziehen seiner Krallen darstellen, sondern wirklich das Bein leicht heben!“): früher fiel beim „Treten“ eine Zeile des FUSSES (der Zehen/Krallen) weg,
  die Krallen schrumpften. Jetzt wird das ganze Bein samt FUSS starr angehoben: aus dem glatten MITTELTEIL des Beins (nie aus Fuß oder Zehenlinien) entfallen 1–2 Zeilen, alles darunter (Unterschenkel, Fuß, alle Zehenlinien unverändert) rückt um 1–2 px nach oben —
  wie ein angewinkeltes Bein. Verlauf je Hub 7 Frames: 1-1-2-2-2-1-1 px (schweres Tier: langsam, heben und senken weich). Hinten (x 9–21, Zeilen 29–35, Zeilen 29 und 30 entfallen) in Frames 6–12 und 36–42;
  vorn innen (x 32–42, ab Zeile 30, Zeilen 31–32 entfallen) in 14–20 und 44–50; vorn außen (x 45–56, ab Zeile 30, Zeilen 30–31 entfallen) in 22–28 und 52–58. Frame 0 = Original.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16): wo die Schwanzbewegung oder das Kopfheben eine Füllfarbe an den Rand schiebt, wird ein Umrisspixel (Farbe aus dem Original) ergänzt (anim_tiere.umriss_schliessen);
beim Kopfheben werden die freiwerdenden Kehlpixel (x 47–50 unter dem Kopf) mit dem Pixel des Beins darunter gefüllt (Pixel (47..50, 28) werden nach (47..50, 27) bzw. (47..50, 26) kopiert).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 60, 66
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 3, 2

spr = L.lade('gigantisaur-ankylos')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (yy <= 17) & (xx <= 14)
kopf_m = vorhanden & (xx >= 47) & ((yy <= 27) | ((xx >= 51) & (yy <= 29)))        # Kopf samt Unterkiefer (starr)
# Beine (Runde 3): das GANZE Bein unterhalb des Körpers (inkl. Fuß mit Zehenlinien) ist ein starres Teil; gehoben wird durch Entfernen glatter Mittelzeilen
bein_h = vorhanden & (yy >= 29) & (xx >= 9) & (xx <= 21)
bein_a = vorhanden & (yy >= 30) & (xx >= 32) & (xx <= 42)
bein_b = vorhanden & (yy >= 30) & (xx >= 45) & (xx <= 57) & ~kopf_m
BEIN_ZEILE = {'h': 30, 'a': 32, 'b': 31}                                         # Zeile, bis zu der (einschließlich) die k Mittelzeilen entfallen
HUB = [1, 1, 2, 2, 2, 1, 1]                                                      # Hub in px je Frame (7 Frames)
HUB_FENSTER = {'h': (6, 36), 'a': (14, 44), 'b': (22, 52)}
koerper = vorhanden & ~schwanz & ~bein_h & ~bein_a & ~bein_b & ~kopf_m

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 24                                                         # hier wird beim Atmen eine Zeile eingefügt
KOPF_ZEILE = 26                                                    # hier wird beim Kopfheben (nur x ≥ 47) eine Zeile eingefügt
FENSTER_SCHWANZ = [(3, 27), (32, 56)]
FENSTER_KOPF = [(18, 30), (48, 60)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def burst(i, fenster):
    for s, e in fenster:
        if s <= i < e:
            return (i - s) / float(e - s)
    return None


def hub(i, bein):
    """Hub (px) des Beins in Frame i: in den zwei Fenstern je Schleife der Verlauf HUB, sonst 0."""
    for s in HUB_FENSTER[bein]:
        if 0 <= i - s < len(HUB):
            return HUB[i - s]
    return 0


def zustand(i):
    atem = 1 if (i % 30) in range(3, 17) else 0
    u_s = burst(i, FENSTER_SCHWANZ)
    u_k = burst(i, FENSTER_KOPF)
    kopf = 0 if u_k is None else int(round(math.sin(math.pi * u_k) ** 0.6))
    return atem, u_s, kopf, hub(i, 'h'), hub(i, 'a'), hub(i, 'b')


def schwanz_schwingen(t, u):
    """Schwanz (Zeilen 0–17, x 0–14): Zeile y wandert waagerecht um round(3,2 · f · sin(πu) · sin(4πu − 0,9 f)), f = (17 − y)/17 (Keule oben am meisten, Ansatz am Becken fest)."""
    if u is None:
        return t
    out = L.leer(H, W)
    for y in range(0, 18):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = (17 - y) / 17.0
        dx = int(round(3.2 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.9 * f)))
        if xs_.min() + dx < 0 or xs_.max() + dx >= W:
            raise L.ClipError(f'Schwanzzeile {y} würde aus der Leinwand geschoben')
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    atem, u_s, kopf, tipp_h, tipp_a, tipp_b = zustand(i)
    k = teil(koerper)
    kp = teil(kopf_m)
    d = atem + kopf                                                # Kopf steigt starr um d Pixel (Atmen + Schnüffeln)
    kp = L.versetze(kp, 0, -d)
    # frei werdende Kehlzeilen (x 47–50) unter dem Kopf mit dem Pixel des Beins darunter füllen
    for x in range(47, 51):
        ys_ = np.nonzero(kopf_m[:, x])[0]
        if not len(ys_) or not d:
            continue
        yb = int(ys_.max())
        unter = spr[yb + 1, x] if yb + 1 < sh and vorhanden[yb + 1, x] and not kopf_m[yb + 1, x] else None
        if unter is not None:
            for dy in range(d):
                k[PAD_T + yb - dy, PAD_L + x] = unter
    sw_ = schwanz_schwingen(teil(schwanz), u_s)
    bh = L.heben_unten(teil(bein_h), PAD_T + BEIN_ZEILE['h'], tipp_h)
    ba = L.heben_unten(teil(bein_a), PAD_T + BEIN_ZEILE['a'], tipp_a)
    bb = L.heben_unten(teil(bein_b), PAD_T + BEIN_ZEILE['b'], tipp_b)
    k = L.streck_zeile(k, PAD_T + ZEILE, atem)
    sw_ = L.streck_zeile(sw_, PAD_T + ZEILE, atem)
    ebenen = {'koerper': k, 'schwanz': sw_, 'bein_h': bh, 'bein_a': ba, 'bein_b': bb, 'kopf': kp}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


TEST_EBENEN = None


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('gigantisaur-ankylos', 'Gigantisaur Ankylos', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-ankylos-strip.png', frames, spalten=12, scale=5)
