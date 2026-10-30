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

Ablauf (60 Frames à 66 ms = 3,96 s), alle Bewegungen unabhängig:
* Atmen (Periode 30, 2× pro Schleife; oben in Frames 3–16 und 33–46): Zeile 24 (Flanke) wird eingefügt — Rücken, Kopf, Schwanz und Stacheln heben sich 1 px, die Beine bleiben am Boden.
* Schwanz schwingt: zweimal pro Schleife (Frames 3–26 und 32–55) schwingt der Schwanz mit der Keule zweimal seitlich hin und her (bis ±3 px an der Keule, wandernde Welle, am Becken fest);
  dazwischen hängt er wie im Original.
* Kopf hebt sich (Schnüffeln): zweimal pro Schleife (Frames 19–26 und 49–56) hebt sich der Kopf (x ≥ 47) 1 px gegenüber dem Rücken (Zeile 26 wird nur dort eingefügt), dann senkt er sich wieder.
* Beine treten: hinten (x 9–19) in Frames 10–11 und 40–41; vorn innen (x 33–43) in 18–19 und 48–49; vorn außen (x 47–56) in 27–28 und 57–58 (je eine Fußzeile entfällt kurz, der Fuß rückt 1 px hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16): wo die Schwanzbewegung oder das Kopfheben eine Füllfarbe an den Rand schiebt, wird ein Umrisspixel (Farbe aus dem Original) ergänzt (anim_tiere.umriss_schliessen).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 60, 66
PAD_L, PAD_R, PAD_T, PAD_B = 5, 2, 3, 2

spr = L.lade('gigantisaur-ankylos')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (yy <= 19) & (xx <= 17)
bein_h = vorhanden & (yy >= 33) & (xx >= 9) & (xx <= 19)
bein_a = vorhanden & (yy >= 37) & (xx >= 32) & (xx <= 43)
bein_b = vorhanden & (yy >= 35) & (xx >= 46) & (xx <= 56)
koerper = vorhanden & ~schwanz & ~bein_h & ~bein_a & ~bein_b

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]
ZEILE = 24                                                         # hier wird beim Atmen eine Zeile eingefügt
KOPF_ZEILE = 26                                                    # hier wird beim Kopfheben (nur x ≥ 47) eine Zeile eingefügt
FENSTER_SCHWANZ = [(3, 27), (32, 56)]
FENSTER_KOPF = [(19, 27), (49, 57)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def burst(i, fenster):
    for s, e in fenster:
        if s <= i < e:
            return (i - s) / float(e - s)
    return None


def zustand(i):
    atem = 1 if (i % 30) in range(3, 17) else 0
    u_s = burst(i, FENSTER_SCHWANZ)
    u_k = burst(i, FENSTER_KOPF)
    kopf = 0 if u_k is None else int(round(math.sin(math.pi * u_k) ** 0.6))
    return atem, u_s, kopf, 1 if i in (10, 11, 40, 41) else 0, 1 if i in (18, 19, 48, 49) else 0, 1 if i in (27, 28, 57, 58) else 0


def schwanz_schwingen(t, u):
    """Schwanz (Zeilen 0–19, x 0–17): Zeile y wandert waagerecht um round(3,2 · f · sin(πu) · sin(4πu − 0,9 f)), f = (19 − y)/19 (Keule oben am meisten, Ansatz am Becken fest)."""
    if u is None:
        return t
    out = L.leer(H, W)
    for y in range(0, 20):
        xs_ = np.nonzero(t[PAD_T + y, :, 3])[0]
        if not len(xs_):
            continue
        f = (19 - y) / 19.0
        dx = int(round(3.2 * f * math.sin(math.pi * u) * math.sin(4 * math.pi * u - 0.9 * f)))
        if xs_.min() + dx < 0 or xs_.max() + dx >= W:
            raise L.ClipError(f'Schwanzzeile {y} würde aus der Leinwand geschoben')
        for x in xs_:
            out[PAD_T + y, x + dx] = t[PAD_T + y, x]
    return out


def frame(i, nur=None):
    atem, u_s, kopf, tipp_h, tipp_a, tipp_b = zustand(i)
    k = teil(koerper)
    if kopf:
        k = T.spalten_hub(k, PAD_T + KOPF_ZEILE, lambda x: 1 if x >= PAD_L + 47 else 0)
    sw_ = schwanz_schwingen(teil(schwanz), u_s)
    bh = L.heben_unten(teil(bein_h), PAD_T + 33, tipp_h)
    ba = L.heben_unten(teil(bein_a), PAD_T + 37, tipp_a)
    bb = L.heben_unten(teil(bein_b), PAD_T + 35, tipp_b)
    k = L.streck_zeile(k, PAD_T + ZEILE, atem)
    sw_ = L.streck_zeile(sw_, PAD_T + ZEILE, atem)
    ebenen = {'koerper': k, 'schwanz': sw_, 'bein_h': bh, 'bein_a': ba, 'bein_b': bb}
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
