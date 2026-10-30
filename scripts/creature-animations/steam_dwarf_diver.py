# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Diver“ (Creature) — der Dampfzwerg im Messing-Taucherhelm mit zwei Dampfrohren.

Quelle: src/steam-dwarf-diver.png (24×24 px, 21 Farben) = Komposit aus zwei Ebenen derselben Datei (Positionen per Template-Matching mit Farbtoleranz aus der
Kartenkunst Steam_Dwarf_Diver.png abgeglichen):
PICK: [["MotiveSteamDwarfs", 420, 2], ["MotiveSteamDwarfs", 437, 1]]
  * Ebene 420 (Figur 2, 18×23 px): Taucherhelm samt zwei Rohren bei (4, 0)            → src/steam-dwarf-diver-helm.png
  * Ebene 437 (20×5 px, ein Baustein, der in 19 Karten vorkommt): zwei gespiegelte dunkelrote Umhang-/Ärmelstücke bei (0, 19) und (18, 19) → src/steam-dwarf-diver-umhang.png
  Die Stücke liegen in der Kunst an den unteren Helmseiten (kein Überlapp mit dem Helm, 4-verbunden über (5,20)–(6,20) bzw. (17,20)–(18,20)).
  Nicht verwendet: die graue Rauchwolke oben und die hell-beige Pfütze/Dunst unter dem Helm (eigene, halbtransparente Ebenen der Kunst), die Flammen und Felsen.
Aufruf:   python3 steam_dwarf_diver.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-diver.png + .json

Was im Sprite ist (x, y im 24×24-Komposit):
* ZWEI DAMPFROHRE (grau: B (62,62,62) < C (81,81,81) < F (108,108,108)): links nahezu senkrecht (x 10–13, y 0–6), rechts schräg nach oben rechts (x 14–21, y 0–9). Beide Spitzen sind oben
  offen und abgeschnitten (links mit zwei Randzacken (10,0)/(13,0)); in der Kunst geht der Dampf hier in die graue Wolke über.
* TAUCHERHELM aus Messing (x 4–21, y 7–22): Kuppel mit hellen Lichtkanten (J (250,245,143), I (234,194,107)), Rahmen Orange/Gold (G, M, K, O, L, E), Bullauge aus Glas (D (152,207,210), H (185,221,209),
  Diagonalspiegelung) mit olivfarbenem Fensterrahmen (N, Q, S) und vier braunen Nieten (R (121,66,1)) an den Fensterecken; unten ein breites Messingband (y 17–21). Umriss A (16,32,0) (dunkelgrün).
  Hinter dem Glas ist KEIN Gesicht und KEIN Auge zu erkennen → kein Blinzeln, kein Blick.
* UMHANGSTÜCKE links (x 0–5, y 19–23) und rechts (x 18–23, y 19–23): dunkelrot (T (33,0,0), (61,0,0), (23,0,0) …) mit schwarzem Umriss, hängen unter dem Helm an den Seiten.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Die untere Messingband-Zeile 21 wird einmal doppelt eingefügt (Brust-Stufe): Helm, Rohre und der obere Teil der Umhangstücke steigen um 1 px,
  der Rand unten (y 22/23) bleibt am Boden. Die Kuppelzeile 9 läuft 3 Frames nach und wird ebenfalls einmal verlängert (Kopf-Stufe): Rohre und Kuppel steigen um ein weiteres px —
  Kuppel/Rohre 0 → 1 → 2 → 1 → 0 px, Helm/Fenster 0 → 1 → 0. Das Bullauge selbst wird nicht gestreckt.
* Dampfrohre zittern (Dampfdruck): die obersten drei Rohrzeilen (0–2) jedes Rohrs schlagen gemeinsam ±1 px seitlich aus (links Periode 12, rechts Periode 16, gegenphasig), jedes Rohr bleibt 4-verbunden.
* Dampf: aus beiden Rohrspitzen steigen kleine runde Dampfwölkchen (Form 'm', Wachsen/Schrumpfen über L.puff_ebene, Pixel in Hellgrün-Weiß H (185,221,209) mit Rand F (108,108,108)) langsam bis 2 px auf (über einer Lücke von 1 px zur Rohrspitze),
  je Rohr zwei Wölkchen um eine halbe Periode versetzt (Periode 24 Frames), hinter der Figur. Höchstens 2 px über der Figur (Frame knapp zugeschnitten).
* Metall glänzt (Regel 12/14: Metall, Gold und Glas): ein Lichtband läuft zweimal pro Schleife diagonal von links oben nach rechts unten — zuerst über die Rohre (Frames 2–9 und 26–33), dann über den Helm
  (Frames 6–19 und 30–43: Messing und olivfarbener Rahmen 1–2 Stufen heller auf der Rampe des Sprites, das Glas D → H). Nur Innenpixel, Umrisse bleiben. Dazu je ein vierzackiger Glitzer-Stern an einer Messingkante
  (Kuppel oben links Frames 10–13, rechter Rand Frames 26–29, linker Nietenrand Frames 40–43).
* Umhangstücke, Nieten und Fensterform bleiben fest (außer Hub).
Frame 0 = Original (Ruhepose), der Dampf ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine (der Helm ist vollständig; die Umhangstücke sind die vollständige Ebene 437).
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 2, 2, 6, 2          # Figur knapp zugeschnitten: Kopfhub 2 px + Dampf 2 px über der Figur, Randabstand 2

spr = L.lade('steam-dwarf-diver')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


# Farben des Sprites
B, C, F = (62, 62, 62), (81, 81, 81), (108, 108, 108)                         # Rohrgrau
GLAS_D, GLAS_H = (152, 207, 210), (185, 221, 209)
PIPE_RAMPE = [B, C, F]
MESSING = [(109, 84, 20), (169, 115, 25), (206, 133, 28), (205, 156, 80), (234, 194, 107), (250, 245, 143)]   # E < L < G < K < I < J
OLIV = [(129, 114, 31), (156, 134, 12), (169, 141, 6)]                         # Q < N < S (Fensterrahmen)
GLAS = [GLAS_D, GLAS_H]
KERN, ARM1, ARM2 = (250, 245, 143), GLAS_H, GLAS_D                              # Stern: heller Kern, helle Glasfarben als Arme (heben sich vom Messing ab)
UMRISS = f(8, 7)                                                              # A (16,32,0)

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                                # Farben der Außenkante im Original (Regel 16)


def maske(bed):
    return np.array([[bool(vorhanden[y, x] and bed(x, y)) for x in range(sw)] for y in range(sh)])


m_rohr = maske(lambda x, y: y <= 9 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x])
m_helm = maske(lambda x, y: y >= 7 and not KANTE0[y, x] and (f(x, y) in MESSING or f(x, y) in OLIV or f(x, y) in GLAS))

ROHRE = {'l': (8, 15), 'r': (17, 23)}            # x-Bereich je Rohr für das Zittern (Zeilen 0–2)


def rohr_stufe(i, name):
    if name == 'l':
        v = 2.0 * math.sin(L.sinus(i, N / 4))
    else:
        v = -2.0 * math.sin(L.sinus(i, N / 3))
    return max(-1, min(1, int(round(v))))                                     # nur ±1 px


def frame(i, dampf=True):
    k = L.platz(spr, H, W, PAD_L, PAD_T)
    gl = L.leer(H, W)                                                         # Glitzer-Sterne (Effekt über der Figur)
    # --- Glanz (Regel 14): Lichtband über Rohre, dann über den Helm (Messing, Rahmen, Glas); nur Innenpixel ---
    for start in (2, 26):
        Hm.lichtband(k, m_rohr, OFF, i, N, start, 8, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for start in (6, 30):
        Hm.lichtband(k, m_helm, OFF, i, N, start, 14, MESSING, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(k, m_helm, OFF, i, N, start, 14, OLIV, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(k, m_helm, OFF, i, N, start, 14, GLAS, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=1)
    # --- Rohrzittern (Zeilen 0–2 gemeinsam ±1 px) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a:
            Hm.bereich_versatz(k, OFF, {y: a for y in (0, 1, 2)}, x0, x1)
    # --- Auf und ab: Messingband (Zeile 21) = Brust, Kuppel (Zeile 9) läuft 3 Frames nach ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 21, PAD_T + 9, brust, kopf)
    hub = brust + kopf
    Hm.kontur_schliessen(k, ERLAUBT, UMRISS)                                  # Regel 16
    # --- Glitzer-Sterne an Messingkanten (nur Gold/Metall), mit dem Helm gehoben ---
    for (sx, sy, start, hubart) in ((9, 8, 10, 'kopf'), (17, 12, 26, 'brust'), (6, 17, 40, 'brust')):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy - (hub if hubart == 'kopf' else brust), st, KERN, ARM1, ARM2, OFF)
    ebenen = []
    if dampf:
        py = PAD_T - 2                                                        # Dampf startet 1 px über der Rohrspitze (Lücke), steigt bis 2 px höher
        spec = []
        for cx, dx2, off0 in ((PAD_L + 11, 1, 0), (PAD_L + 19, 0, 6)):        # Mitte der Rohrspitzen (links x 11, rechts x 19–20)
            spec.append(dict(x=cx, y=py, vx=0, vy=-2, off=off0, form='m', wackeln=0.6))
            spec.append(dict(x=cx + dx2, y=py, vx=0, vy=-2, off=off0 + 12, form='m', wackeln=-0.6))
        ebenen.append((L.puff_ebene(H, W, i % 24, 24, spec, {'c': GLAS_H, 'r': F}), 0, 0))
    ebenen += [(k, 0, 0), (gl, 0, 0)]
    return L.zusammen(H, W, ebenen)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frame(0, dampf=False), spr, OFF)
    print('Ruhepose (ohne Dampf) weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ohne = [frame(i, dampf=False) for i in range(N)]
    e0 = Hm.eckkontakt_typen(ohne[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(ohne) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte (Figur ohne Dampf) gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('steam-dwarf-diver', 'Steam Dwarf Diver', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/steam-dwarf-diver-strip.png', frames, spalten=12, scale=6)
