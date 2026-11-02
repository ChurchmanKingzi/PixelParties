# -*- coding: utf-8 -*-
"""Idle-Animation für „Mausoleum Worm“ (Creature) — gepanzerter Grabwurm mit Knochenstacheln, der mit offenem, zahnbewehrtem Schlund aus dem Boden ragt.

Quelle: src/mausoleum-worm.png (26×28 px, 12 Farben) — der Wurm aus der Ebene „Mausoleum Worm“ (Motive.xcf, Ebene 676, 29×41); die Ebene enthält außerdem das Mausoleum (Gebäude rechts unten, x 13–28, y 25–40)
und eine winzige Wächterfigur (x 3–10, y 29–36) — beides gehört NICHT zum Wurm und ist weggelassen (Ausschnitt: Wurm x 0–26, y 0–27, Gebäude/Figur ausgeschnitten). Die Quelle ist vollständig (alles deckend).
PICK: [["Motive", 676, 1]]   (nur der Wurm-Anteil der Figur 1: Zeilen 0–24 ganz, Zeilen 25–27 bis x 14)

Aufruf:   python3 mausoleum_worm.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/mausoleum-worm.png + .json

Was ist was (x, y im 26×28-Sprite):
* KOPF (x 13–25, y 0–15): gepanzerter Kopf in Dunkelgrau (26,26,26)/(34,34,34)/(53,53,53)/(95,95,95)/(128,128,128); oben zwei Knochenhörner (255,255,170)/(255,255,255) bei (17,0–1) und (22,0–1);
  rechts der offene, kreisrunde SCHLUND (x 19–25, y 5–15): Zahnring (230,230,230)/(255,255,255) mit rosa Zahnfleisch (136,95,93) oben (y 6), unten (y 14) und seitlich (x 19, x 24),
  im Inneren dunkelrote Kehle (38,23,24)/(72,44,46)/(3,1,1) mit weiteren weißen Zähnen (21,7), (23,7), (20,11), (23,10), (21,13), (23,13).
* KÖRPER (x 3–18, y 7–27): gepanzerte Ringröhre (Ringe (95,95,95) hell, (53,53,53), (34,34,34) dunkel, (128,128,128) Kante), die vom Kopf nach links unten bis in den Boden (y 27) läuft;
  auf dem Rücken (linke Außenkante) sitzt eine Reihe von KNOCHENSTACHELN (255,255,170)/(255,255,255) paarweise schräg: (10,2–4), (7–9,7), (9,10), (4,12–14), (2,17–18), (2,19), (0,23–25) usw.
* BODEN: der Wurm endet unten flach (y 27) — er steckt im Boden, der Fuß bleibt fest.
Knochen/Panzer des Wurms: kein erkennbares Metall → kein Glanz (Regel 14). Kein Feuer. Keine Partikel (nichts im Sprite, das raucht/funkelt).

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original):
* WINDEN (Periode 24 → zwei Wellen je Schleife, Wellenlänge 16 Zeilen, Welle läuft vom Boden nach oben): jede Körperzeile (y 17–27) wird waagerecht verschoben, am Boden 0, oben bis ±3 px; Gefälle zwischen benachbarten Zeilen ≤ 1 px
  (der Wurm bleibt ein einziger 4-verbundener Körper, für alle 48 Frames geprüft). Der KOPF (y 0–16 samt Schlund und Hörnern) wird nicht geschert, sondern schwingt starr mit der obersten Körperzeile mit.
* AUFRICHTEN (Periode 24, 0 → 1 → 2 → 1 → 0 px): die Ringzeile y 17 wird 0–2× eingefügt (Texturmischung): der Kopf hebt sich, der Wurm reckt sich, der Boden bleibt.
* SCHLUND ARBEITET (Periode 48): die Kehle (x 20–23, y 7–13) dreht sich — das Dunkelrot der Kehle läuft zyklisch eine Zeile nach unten (alle ~7 Frames ein Schritt, nach einer Schleife zurück in der Ausgangslage); die weißen Zähne in der Kehle, die Zahnreihen, das Zahnfleisch und der Rand bleiben fest.
Kein Glanz, kein Funkeln. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine gemalten Pixel; Randpixel-Test (Regel 16) mit `U.kontur_schliessen` (Umrissfarbe (26,26,26)).
"""
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_untote2 as V

N, MS = 48, 65
PAD_L, PAD_R, PAD_T, PAD_B = 6, 5, 5, 2

spr = L.lade('mausoleum-worm')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)
KOMP0 = V.komp4(spr)
UMRISS = U.umrissfarben(spr)
KONTUR = (26, 26, 26)
KEHLE = (20, 23, 7, 13)                                   # x0, x1, y0, y1 (einschließlich)
ZEILE_STRECK = 17                                         # hier wird eingefügt; Zeilen darüber = Kopfblock
BODEN_Y = [OFF[1] + y for y in range(27, ZEILE_STRECK - 1, -1)]          # Boden (y 27) → oben (y 17)
TEST_EBENEN = 'koerper'


def offs(i, kb):
    """Zeilenversatz: Körper (y 17–27) windet sich (Wunschwelle, dann so abgeflacht, dass kein Stachel abreißt), alles darüber schwingt starr mit der Zeile y 17."""
    a = V.wellen_offs(BODEN_Y, 3.0, i, 24, 16.0, 0.0, 1.2)
    res = V.verbunden_offs(kb, BODEN_Y, a)
    kopf = res[BODEN_Y[-1]]
    for y in range(0, BODEN_Y[-1] - 0):
        res[y] = kopf
    return res


def frame(i, nur=None):
    n = V.stufen(i, 24, 2)
    k = L.platz(spr.copy(), H, W, OFF[0], OFF[1])
    # Kehle dreht sich: Zeilen zyklisch nach unten
    s = (i * 7) // N
    x0, x1, y0, y1 = KEHLE
    if s:
        reg = k[OFF[1] + y0:OFF[1] + y1 + 1, OFF[0] + x0:OFF[0] + x1 + 1].copy()
        weiss = (reg[..., 0] == 255) & (reg[..., 1] == 255) & (reg[..., 2] == 255)          # die weißen Zähne bleiben stehen,
        neu = np.roll(reg, s, axis=0)                                                          # nur das Dunkelrot der Kehle läuft
        neu_w = np.roll(weiss, s, axis=0)
        neu[neu_w & ~weiss, :3] = (38, 23, 24)                                                 # (wanderte ein Zahn auf einen dunklen Platz: Kehlenfarbe)
        neu[weiss] = reg[weiss]
        k[OFF[1] + y0:OFF[1] + y1 + 1, OFF[0] + x0:OFF[0] + x1 + 1] = neu
    kb = L.streck_zeile(k, OFF[1] + ZEILE_STRECK, n)
    f = V.zeilen_versatz4(kb, offs(i, kb))
    return U.kontur_schliessen(f, UMRISS, KONTUR)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    for i, fr in enumerate(frames):
        assert V.komp4(fr) == KOMP0, f'Frame {i}: Wurm zerrissen ({V.komp4(fr)} Flecken)'
    L.pruefe(frames, quelle=spr, min_rand=2)
    L.speichern('mausoleum-worm', 'Mausoleum Worm', frames, MS, prev)
    if prev:
        L.streifen(prev + '/mausoleum-worm-strip.png', [frames[k] for k in range(0, N, 4)], spalten=6, scale=8)
