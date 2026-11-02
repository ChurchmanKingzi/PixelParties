# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast Gou“ (Creature, Archetyp Guardian Beasts) — der gepanzerte Hunde-Wächter (Zeichen „Gou“ = Hund) mit blauem Helm, goldenem Stirnband und goldenen Schulterplatten.

Quelle: src/guardian-beast-gou.png (20×26 px, 31 Farben).
PICK: [["MotiveGuardianBeasts", 118, 1]]      (Ebene „Gou #1“, Figur 1; Ebene 117 „Gou“ = Mond-Halbkreis mit Ring, Ebene 119 „Gou #2“ = frei liegender Hammer, Ebene 116 = zweite Mondphase)
Abgleich mit der Kartenkunst Guardian_Beast_Gou.png (76×51): Sprite sitzt dort bei (28,13), 97 % Pixeltreffer (nächstbester Treffer: andere Ebene derselben Datei). Mond (halbtransparent, hinter der Figur) und Hammer (links
im Bild, wird von keiner Hand gehalten) sind Beiwerk der Karte und keine Teile der Figur → nicht übernommen.

Aufruf:   python3 guardian_beast_gou.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-gou.png + .json

Identifikation (x, y im 20×26-Sprite; die Figur ist fast spiegelsymmetrisch, Licht von links oben):
* ANTENNE/Kamm (10, 0–1): zwei Pixel Dunkelblau (34,57,98) auf dem Helmscheitel.
* HELM (y 2–10): Blau (130,141,195)/(146,160,209)/(170,179,234) mit dunklem Umriss (34,57,98); goldenes STIRNBAND y 5–8 (117,98,19)/(184,160,72)/(216,204,82)/(242,229,99), Mitte heller.
* OHRPLATTEN (x 2–5 bzw. 14–17, y 6–9): graugrüne Helmflügel (74,77,64) mit hellen Lichtpixeln (240,244,229)/(194,197,186)/(136,143,125).
* AUGEN (y 8–9): schwarze Schlitze (17,13,14) bei (7–8,8)/(11–12,8) und (6–10…13,9); darunter je ein weißer Lichtpixel (246,255,255) bei (7,9)/(12,9) und ein rotbrauner Pixel (110,44,12) bei (8,9)/(11,9).
* SCHNAUZE (x 7–12, y 10–13): zwei weiße Fangzahn-Streifen (240,244,229)/(194,197,186) bei x 7–8 und 11–12 (y 10–12), dazwischen die dunkelrote Nase/der Mund (66,16,16)/(99,23,23)/(44,10,10) bei (9–10, 10–12) — Zähne, bleiben fest.
* SCHULTERPLATTEN (x 0–4 bzw. 15–19, y 10–14): große goldene Pauldrons (117,98,19)…(242,229,99) mit Umriss.
* ARME (y 14–18): hellblaue Panzerärmel (130,141,195)/(170,179,234), Lila Stoff (156,123,180)/(188,158,212), Fäuste (136,143,125)/(240,244,229) vor dem Bauch bei (7–8,16–17)/(11–12,16–17).
* RUMPF (y 13–18): violetter Brustlatz (39,20,39)/(97,75,124), goldene Gürtelschnalle (242,229,99) bei (9–10,18).
* BEINE (y 19–22) dunkelblau/hellblau, STIEFEL (y 23–25) graugrün (74,77,64)/(102,106,89) mit weißen Spitzen, schwarze Zehenkrallen (0,1,0) bei (2–4,24–25) und (15–17,24–25).
Gold im Sprite: Stirnband, Schulterplatten, Gürtelschnalle → nur sie glänzen (Lichtband + Glitzersterne, Regel 12/14). Kein Feuer, kein Dampf, keine Partikel.

Ablauf (48 Frames à 64 ms = 3,07 s, nahtlos):
* Atmen (Periode 24, zwei Atemzüge): die Zeile 20 (Hosenfalte) wird einmal doppelt eingefügt, Rumpf, Arme, Schultern und Kopf steigen 1 px, Beine/Stiefel bleiben.
* Antenne zuckt: der Kamm wird 1 px länger (Frames 6–9 und 30–33); sonst unverändert.
* Ohrplatten zucken (links Frames 10–15, rechts Frames 34–39): die Platte rutscht 1 px nach unten und wieder hoch (zweimal, ruckhaft); sie bleibt am Helm.
* Blinzeln (Frames 19–21 und 41–43): die vier hellen Augenpixel (Weiß/Rotbraun) nehmen die Schlitzfarbe (17,13,14) an.
* Fußtippen: der linke Stiefel hebt sich zweimal 1 px (Frames 14–21), später der rechte (Frames 38–45); er verschwindet teilweise hinter dem Bein.
* Gold glänzt (Regel 12/14): ein Lichtband läuft diagonal über Schultern/Stirnband (Frames 6–17 und Frames 30–41), dazu Glitzersterne an der linken Schulterplatte (Frame 20–24), am Stirnband (Frame 38–42)
  und an der rechten Schulterplatte (Frame 44–48 → Schleifenende).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (nichts Verdecktes wird freigelegt; die Stiefel liegen beim Heben hinter den Beinen, die Ohrplatten hinter Schulter/Kopf).
"""
import sys

import numpy as np

import anim_gb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 64
sz = G.Szene('guardian-beast-gou', (4, 4, 4, 2))                 # Rand: Antenne +1, Atem −1, Ohrplatte/Stern ±1, Randabstand ≥ 2
spr, OFF, H, W, f = sz.spr, sz.off, sz.H, sz.W, sz.f

DUNKELBLAU = f(10, 0)                                            # (34,57,98) Umriss/Antenne
SCHLITZ = f(7, 8)                                                # (17,13,14) Augenschlitz
GOLD = [(117, 98, 19), (184, 160, 72), (216, 204, 82), (242, 229, 99), (246, 249, 170)]   # Rampe dunkel → hell (alle im Sprite)
AUGEN_HELL = [(7, 9), (8, 9), (11, 9), (12, 9)]
WEISS = f(7, 9)                                                  # (246,255,255) Glanzpixel der Quelle (Kern der Glitzersterne)

ohr_l = sz.maske(2, 6, 5, 9)
ohr_r = sz.maske(14, 6, 17, 9)
fuss_l = sz.maske(0, 23, 9, 25)
fuss_r = sz.maske(10, 23, 19, 25)
rumpf = sz.vorhanden & ~ohr_l & ~ohr_r & ~fuss_l & ~fuss_r
m_gold = sz.vorhanden & L.farbmaske(spr, GOLD) & (sz.yy <= 19)


def frame(i):
    k = sz.ebene(rumpf)
    ol, orr = sz.ebene(ohr_l), sz.ebene(ohr_r)
    # --- Blinzeln: helle Augenpixel → Schlitzfarbe ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        sz.setze(k, {p: SCHLITZ for p in AUGEN_HELL})
    # --- Gold glänzt: Lichtband + Glitzersterne (nur Gold) ---
    Hm.lichtband(k, m_gold, OFF, i, N, 6, 12, GOLD, stufen=1, breite=2.6, achse=(1.0, 1.0), kern=2)
    Hm.lichtband(k, m_gold, OFF, i, N, 30, 12, GOLD, stufen=1, breite=2.6, achse=(-1.0, 1.0), kern=2)
    for (x, y), start in (((3, 13), 20), ((10, 7), 38), ((16, 13), 44)):
        st = Hm.folge(i, start, [0, 1, 1, 0], N)
        if st is not None:
            Hm.stern4(k, x, y, st, WEISS, GOLD[4], off=OFF)
    # --- Atmen: Hosenzeile 20 doppelt, alles darüber steigt ---
    brust = Hm.stufe(i, N / 2, 1)
    # --- Ohrplatten zucken (1 px nach unten, ruckhaft), liegen hinter dem Kopf ---
    zuck_l = 1 if Hm.folge(i, 10, [1, 1, 0, 1, 1, 0], N) else 0
    zuck_r = 1 if Hm.folge(i, 34, [1, 1, 0, 1, 1, 0], N) else 0
    ol = sz.ebene(ohr_l, 0, zuck_l)
    orr = sz.ebene(ohr_r, 0, zuck_r)
    k, ol, orr = sz.atmen([k, ol, orr], 20, brust)
    # --- Antenne wird länger ---
    if Hm.folge(i, 6, [1] * 4, N) or Hm.folge(i, 30, [1] * 4, N):
        sz.setze(k, {(10, -1 - brust): DUNKELBLAU})
    # --- Fußtippen ---
    pat = [1, 1, 0, 0, 1, 1, 0, 0]
    ul = 1 if Hm.folge(i, 14, pat, N) else 0
    ur = 1 if Hm.folge(i, 38, pat, N) else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul), sz.ebene(fuss_r, 0, -ur)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (ol, 0, 0), (orr, 0, 0), (k, 0, 0)])
    return sz.kontur(fig, DUNKELBLAU)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    G.abschluss(sz, frames, 'guardian-beast-gou', 'Guardian Beast Gou', MS, prev)
