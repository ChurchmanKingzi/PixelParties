# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Engineer“ (Creature) — der gehörnte Zwerg in goldener Dampfrüstung mit dem Ofen im Bauch.

Quelle: src/steam-dwarf-engineer.png (28×38 px, 17 Farben).
PICK: [["MotiveSteamDwarfs", 419, 1]]      (Ebene „Ebene #30“, Figur 1; nur in dieser Karte)
Die Kartenkunst zeigt zwei Figuren: den großen, mittig stehenden gehörnten Zwerg (Ebene 419, 28×38; er füllt die Kartenmitte) und links davon einen kleinen goldkapuzigen Zwerg im Profil mit drei Rauchrohren
und einer Gabel (Ebenen 418 und 417, zusammen 28×28 — nur Brustbild, kein Körper). Ich habe die große, vollständige Figur genommen (sie liegt in der Kartenmitte und ist komplett erhalten);
der kleine Zwerg bleibt unverwendet (Beiwerk der Kunst) und könnte bei Bedarf eine eigene Creature-Animation bekommen.
Aufruf:   python3 steam_dwarf_engineer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-engineer.png + .json

Was im Sprite ist (x, y im 28×38-Sprite, symmetrisch):
* ZWEI HÖRNER (x 6–8 und 19–21, y 0–7): Weiß G (251,250,245) mit grauer Schattenkante D (148,154,154), dunkelgrüner Umriss A (16,32,0); sie wachsen schräg nach oben außen aus dem goldenen Helm.
* HELM/GESICHT: goldener Helm (y 7–9: H (250,245,143) hell, C (234,194,107), F (204,163,83), B (109,84,20) dunkel), darunter ein schwarzes Band E (0,0,0) (y 10–11, x 10–17; Haarband/Visier),
  das Gesicht (y 12–14, x 12–15: Hautgold C) mit zwei braunen Augen Q (150,84,47) bei (12,14) und (15,14). Seitlich graue Ohr-/Schulterstücke (I, P, K).
* BRUSTPANZER (y 15–24): weiß-grau gerippter Stahl (G, I, D, K) zwischen zwei Goldsäulen (Schulterpanzer, x 3–8 und 19–24, H/C/B).
* BAUCHOFEN (y 25–34, x 8–19): runder Ofen mit schwarzem Schlund E (0,0,0), grauen Gitterstäben (M (128,128,128), L (104,104,104)) und dunklem Rand J (45,45,45) — ohne Flammenfarben im Sprite,
  daher wird kein Feuer gezeichnet (Regel 15: es gibt keins).
* ARME/SCHULTERN (x 0–6 und 21–27, y 21–35): große goldene Panzerarme (C, H, F, B) mit dunklem Umriss, an den Seiten hängend. Füße y 35–37 (blasse Cyan-Pixel O/N an den Sohlen).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Brust zuerst 1 px (die Bauchofen-Unterkante, Zeile 34, wird einmal doppelt eingefügt: Rumpf, Arme, Kopf und Hörner steigen, die Füße bleiben am
  Boden), der Kopf läuft 3 Frames nach und hebt sich um ein weiteres px (Gesichtszeile 13, ein glatter Hautstreifen über den Augen, wird verlängert). Kopf/Hörner 0 → 1 → 2 → 1 → 0 px, Rumpf 0 → 1 → 0.
* Blinzeln (Frames 19–21 und 40–42): die zwei braunen Augenpixel Q (12,14)/(15,14) schließen sich — sie nehmen die umgebende Hautfarbe C (234,194,107) an (kein Lid-Extrapixel, nur die Augen verschwinden
  für 3 Frames). Kein Farbtausch, kein Augenglanz.
* Hörnerzucken: erst das linke Horn (Frames 8–13), später das rechte (Frames 31–36): die drei obersten Hornzeilen (0–2) neigen sich gemeinsam 1 px nach außen und zurück (4-verbunden;
  die dabei freigelegte Hornkante wird zum Umriss geschlossen).
* Metall glänzt (Regel 12/14: Gold und Stahl, nicht Haut und Haare): ein Lichtband läuft zweimal pro Schleife (Frames 5–18 und 29–42) diagonal von links oben nach rechts unten über Rüstung, Hörner und
  Ofengitter (Gold B < F < C < H, Stahl J < L < K < D < I < G jeweils 1–2 Stufen heller auf der Rampe des Sprites); nur Innenpixel, das Gesicht und die Umrisse bleiben. Dazu je ein vierzackiger Glitzer-Stern
  (weißer Kern, helle Goldarme) an einer Goldkante: Helm links (Frames 10–13), rechter Panzerarm (26–29), linke Schulter (40–43).
KEIN Dampf und KEIN Feuer (der Sprite enthält weder Rohre noch Flammenfarben). Keine Partikel.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (die Figur ist vollständig; freigelegte Hornkanten werden in Umrissfarbe A geschlossen).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 4, 2          # Figur knapp zugeschnitten: Kopfhub 2 px (oben), Sterne liegen innerhalb der Figurfläche, Randabstand ≥ 2

spr = L.lade('steam-dwarf-engineer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# Farben des Sprites
UMRISS = f(6, 0)                                                   # A (16,32,0)
AUGE, HAUT = f(12, 14), f(13, 14)                                  # Q (150,84,47) Augenpixel, C (234,194,107) umgebende Hautfarbe
GOLD = [(109, 84, 20), (204, 163, 83), (234, 194, 107), (250, 245, 143)]                        # B < F < C < H
STAHL = [(45, 45, 45), (104, 104, 104), (125, 125, 123), (148, 154, 154), (220, 221, 215), (251, 250, 245)]   # J < L < K < D < I < G
WEISS, H_GOLD, C_GOLD = (251, 250, 245), (250, 245, 143), (234, 194, 107)

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                     # Farben der Außenkante im Original (Regel 16)
gesicht = np.zeros((sh, sw), bool)
gesicht[12:15, 12:16] = True                                       # Haut: kein Glanz


def maske(farben):
    m = np.zeros((sh, sw), bool)
    for y in range(sh):
        for x in range(sw):
            if vorhanden[y, x] and f(x, y) in farben and not KANTE0[y, x] and not gesicht[y, x]:
                m[y, x] = True
    return m


m_gold, m_stahl = maske(GOLD), maske(STAHL)
m_metall = m_gold | m_stahl


def frame(i):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    gl = L.leer(H, W)                                              # Glitzer-Sterne (Effekt über der Figur)
    # --- Blinzeln: die Augenpixel nehmen die Hautfarbe an ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(k, {(12, 14): HAUT, (15, 14): HAUT}, OFF)
    # --- Hörnerzucken: Hornzeilen 0–2 gemeinsam 1 px nach außen ---
    if Hm.folge(i, 8, [1, 1, 0, 1, 1, 0], N):
        Hm.bereich_versatz(k, OFF, {0: -1, 1: -1, 2: -1}, 4, 10)
    if Hm.folge(i, 31, [1, 1, 0, 1, 1, 0], N):
        Hm.bereich_versatz(k, OFF, {0: 1, 1: 1, 2: 1}, 17, 23)
    # --- Glanz (Regel 14): Lichtband über Gold und Stahl, nur Innenpixel (ohne Gesicht) ---
    for start in (5, 29):
        Hm.lichtband(k, m_metall, OFF, i, N, start, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(k, m_metall, OFF, i, N, start, 14, STAHL, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    # --- Auf und ab: Bauchofen-Unterkante (Zeile 34) = Rumpf, Gesichtszeile 13 läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 34, PAD_T + 13, brust, kopf)
    gl = Hm.atmen(gl, PAD_T + 34, PAD_T + 13, brust, kopf)
    Hm.kontur_schliessen(k, ERLAUBT, UMRISS)                       # Regel 16: Außenkante in jeder Pose in Umrissfarbe
    # --- Glitzer-Sterne an Goldkanten (mit dem jeweiligen Körperteil gehoben) ---
    hub = brust + kopf
    for (sx, sy, start, dy) in ((10, 8, 10, hub), (25, 26, 26, brust), (4, 14, 40, hub)):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - dy, st, WEISS, H_GOLD, C_GOLD, OFF)
    return L.zusammen(H, W, [(k, 0, 0), (gl, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('steam-dwarf-engineer', 'Steam Dwarf Engineer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-engineer-strip.png', frames, spalten=12, scale=4)
