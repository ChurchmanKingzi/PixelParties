# -*- coding: utf-8 -*-
"""Idle-Animation für „Steam Dwarf Diver“ (Creature) — der Dampfzwerg im Messing-Taucherhelm: Helm MIT dem Zwerg darunter (rote Kapuze/Umhang mit schwarzem Umriss), zwei Dampfrohre.

Quelle: src/steam-dwarf-diver.png (22×24 px, 28 Farben) = die komplette Figur aus zwei Ebenen derselben xcf (Lage per xcf-Koordinaten; gegen die Kartenkunst Steam_Dwarf_Diver.png geprüft: 336 von 340
Pixeln des Komposits stimmen mit der Kunst überein — die Kunst zeigt genau diese Figur):
PICK: [["MotiveSteamDwarfs", 424, 1], ["MotiveSteamDwarfs", 420, 2]]
  * Ebene 424 („Ebene #8“, 22×22 px bei (269,186)): der ZWERG selbst — schwarze Kapuze mit dunkelrotem Umhang, weißer Bart, blaue Augen, Hände, Umhang-Zipfel („Flügel“) links/rechts, zwei kurze Rohre.
    Er liegt unter dem Helm; sichtbar bleiben Kapuzenumriss, Schulter-/Umhangpartien und die Zipfel an den unteren Seiten. (Frühere Fassung: nur Helm + zwei Fremdstücke aus Ebene 437 — der Nutzer:
    „Du hast nur den Helm erwischt“.)
  * Ebene 420 („Ebene #18“, Figur 2 = der Helm samt zwei Rohren, 19×25 px bei (272,183)): liegt oben auf dem Zwerg (kleinerer Ebenenindex = weiter vorn). Die rechte Hälfte derselben Ebene (Drachenpilot) gehört nicht dazu.
  Nicht verwendet: die graue Rauchwolke oben und der beige Dunst unter dem Helm (halbtransparente Ebenen der Kunst), Flammen, Felsen.
Aufruf:   python3 steam_dwarf_diver.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/steam-dwarf-diver.png + .json

Was im Sprite ist (x, y im 22×24-Komposit):
* ZWEI DAMPFROHRE (grau: B (62,62,62) < C (81,81,81) < F (108,108,108)): links nahezu senkrecht (x 9–13, y 0–6), rechts schräg nach oben rechts (x 15–21, y 0–7); oben offen (abgeschnitten, in der Kunst geht der Dampf in die Wolke über).
* TAUCHERHELM aus Messing (x 3–20, y 7–22): Kuppel mit hellen Lichtkanten (K (250,245,143), J (234,194,107)), Rahmen Orange/Gold, Bullauge aus Glas (E (152,207,210), I (185,221,209)) mit olivfarbenem
  Fensterrahmen und vier braunen Nieten (W (121,66,1)); unten ein breites Messingband (y 17–21). Umriss dunkelgrün A (16,32,0). Hinter dem Glas ist KEIN Gesicht und KEIN Auge zu erkennen → kein Blinzeln.
* ZWERG: Kapuzenumriss schwarz B (0,0,0) links bei (3,13–14) und (7,6) sowie die Umhangzipfel („Flügel“) links (x 0–5, y 15–23) und rechts (x 16–21, y 15–23): schwarzer Umriss, Füllung dunkelrot
  (M (84,0,0), Y (110,0,0), S (61,0,0), Q (23,0,0), Z (33,0,0), a (52,0,0)), unten ein dunkelbrauner Saum V (32,24,0). Bart, Gesicht, Augen und Hände liegen hinter dem Helm und sind nicht sichtbar.
Metall im Sprite: Rohre und Helm (Messing, Glas) — nur dort Glanz (Regel 14); Umhang (Stoff) glänzt nicht.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos) — RUNDE 3 (Nutzer: „zwischendurch Hintergrund-Pixel in den Schultern“ und „das Strecken der unteren Helmkante ist nicht schön, einfach lassen“):
* Der Sprite wird jetzt aus ZWEI Ebenen aufgebaut statt aus dem fertigen Komposit: src/steam-dwarf-diver-zwerg.png (Zwergen-Ebene 424: Kapuze, Bart, Umhangzipfel; ihre zwei Rohrstummel sind entfernt) und
  src/steam-dwarf-diver-helm.png (Helm + Rohre; zwei im Komposit sichtbare Rohrpixel (16,3) und (15,5) der Zwergen-Ebene sind hierher gewandert). Komposit der beiden == steam-dwarf-diver.png (Ruhepose pixelgleich).
* Auf und ab (Periode 24 = zweimal pro Schleife): der Helm samt Rohren SINKT als starres Stück um 1 px auf den Zwergen darunter (kein Zeilenstrecken mehr, die untere Helmkante wird nicht gedehnt, jeder Umriss bleibt 1 px
  dick); die Kapuze des Zwergen ist darunter fertig gezeichnet (Quellebene), so dass beim Senken nichts Hintergrund freilegt. Die Umhangzipfel bleiben dabei am Platz (kein Anheben des ganzen Zipfels mehr — das riss die Löcher
  in den Schultern).
* Umhangzipfel wehen (eigener Rhythmus je Seite): der Saum (Zeilen 22–23) pendelt ±1 px waagerecht (links Periode 16, rechts Periode 12, gegenphasig); in den Fenstern links Frames 6–13 und 30–37, rechts 14–21 und 38–45 rückt
  der Saum um 1 Zeile hoch (die Zeile 21 des Zipfels entfällt — der Zipfel wird kürzer, nichts wird gestreckt oder kopiert) und bleibt über Kante 4-verbunden.
* Dampfrohre zittern (Dampfdruck): die obersten drei Rohrzeilen (0–2) jedes Rohrs schlagen gemeinsam ±1 px seitlich aus (links Periode 12, rechts Periode 16, gegenphasig), jedes Rohr bleibt 4-verbunden.
* Dampf: aus beiden Rohrspitzen steigen kleine runde Dampfwölkchen (Form 'm', Wachsen/Schrumpfen 2×2 → 5×3 → 2×2 über anim_dwarf.puff, kein 1-px-Punkt, Farben H/Rohrgrau aus dem Sprite) langsam bis 4 px auf, je Rohr zwei Wölkchen um eine
  halbe Periode versetzt (Periode 24 Frames), hinter der Figur.
* Metall glänzt (Regel 12/14, unverändert): ein Lichtband läuft zweimal pro Schleife diagonal von links oben nach rechts unten — zuerst über die Rohre (Frames 2–9 und 26–33), dann über den Helm
  (Frames 6–19 und 30–43: Messing und olivfarbener Rahmen 1–2 Stufen heller auf der Rampe des Sprites, das Glas E → I). Nur Innenpixel, Umrisse bleiben. Dazu je ein vierzackiger Glitzer-Stern an einer
  Messingkante (Kuppel oben links Frames 10–13, rechter Rand Frames 26–29, unterer rechter Rand Frames 40–43); die Sterne sinken mit dem Helm.
* Fensterform, Nieten, Umhangfüllung und Kapuzenumriss bleiben fest.
Frame 0 = Original (Ruhepose), der Dampf ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16) / $S/../k_dwarf_tools/holes.py (keine neuen Löcher/Kerben).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine.
"""
import math
import sys

import numpy as np

import anim_dwarf as Dw
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 3, 9, 2          # Zipfel-Saum ±1 px seitlich (+2 Rand), Dampf bis 4 px über den Rohren

spr = L.lade('steam-dwarf-diver')                 # Komposit (Referenz für Farben und Ruhepose)
zwerg = L.lade('steam-dwarf-diver-zwerg')         # Zwergen-Ebene (Kapuze, Bart, Umhangzipfel), ohne Rohrstummel
helm = L.lade('steam-dwarf-diver-helm')           # Helm + Rohre
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
vorhanden = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]


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
UMRISS = (16, 32, 0)                                                          # A (dunkelgrüner Helmumriss)
STOFF = {(0, 0, 0), (84, 0, 0), (110, 0, 0), (61, 0, 0), (23, 0, 0), (33, 0, 0), (52, 0, 0), (32, 24, 0)}   # Umhangfarben (Umriss + Füllung)

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                                # Farben der Außenkante im Original (Regel 16)


def maske(bed):
    return np.array([[bool(vorhanden[y, x] and bed(x, y)) for x in range(sw)] for y in range(sh)])


m_rohr = maske(lambda x, y: y <= 9 and f(x, y) in PIPE_RAMPE and not KANTE0[y, x])
m_helm = maske(lambda x, y: y >= 7 and not KANTE0[y, x] and (f(x, y) in MESSING or f(x, y) in OLIV or f(x, y) in GLAS))
# Umhangzipfel (Zwergen-Ebene): Stofffarben am linken (x ≤ 5) bzw. rechten (x ≥ 16) Rand, ab Zeile 15
zv = L.deckend(zwerg)
m_zl = np.array([[bool(zv[y, x] and y >= 15 and x <= 5 and tuple(int(v) for v in zwerg[y, x, :3]) in STOFF) for x in range(sw)] for y in range(sh)])
m_zr = np.array([[bool(zv[y, x] and y >= 15 and x >= sw - 6 and tuple(int(v) for v in zwerg[y, x, :3]) in STOFF) for x in range(sw)] for y in range(sh)])

ROHRE = {'l': (8, 14), 'r': (15, 21)}            # x-Bereich je Rohr für das Zittern (Zeilen 0–2)


def rohr_stufe(i, name):
    if name == 'l':
        v = 2.0 * math.sin(L.sinus(i, N / 4))
    else:
        v = -2.0 * math.sin(L.sinus(i, N / 3))
    return max(-1, min(1, int(round(v))))                                     # nur ±1 px


def zipfel_hub(i, seite):
    """1 = Saum 1 Zeile hochgerückt (Zeile 21 des Zipfels entfällt), sonst 0. Fenster je Seite versetzt, nahtlos."""
    starts = (6, 30) if seite == 'l' else (14, 38)
    return 1 if any(Hm.folge(i, s, [1] * 8, N) for s in starts) else 0


def saum_dx(i, seite):
    """Saumpendel ±1 px (Zeilen 22–23): links Periode 16, rechts Periode 12, gegenphasig."""
    v = math.sin(L.sinus(i, N / 3 if seite == 'l' else N / 4, 0.0 if seite == 'l' else math.pi))
    return max(-1, min(1, int(round(1.4 * v))))


def sinken(i):
    """Helm + Rohre sinken starr um 1 px (Periode 24 = zweimal je Schleife); Frame 0 = Ruhe (oben)."""
    return Hm.stufe(i, N / 2, 1)


TEST_EBENEN = ('figur',)                                                      # für den Randpixel-Test: Figur ohne Dampf und Glitzer


def frame(i, dampf=True, nur=None):
    if nur:
        dampf = False
    zl, _ = L.trenne(zwerg, m_zl)
    zr, _ = L.trenne(zwerg, m_zr)
    _, kapuze = L.trenne(zwerg, m_zl | m_zr)
    kap = L.platz(kapuze, H, W, PAD_L, PAD_T)
    wl = L.platz(zl, H, W, PAD_L, PAD_T)
    wr = L.platz(zr, H, W, PAD_L, PAD_T)
    hl = L.platz(helm, H, W, PAD_L, PAD_T)
    gl = L.leer(H, W)                                                         # Glitzer-Sterne (Effekt über der Figur)
    sink = sinken(i)
    # --- Glanz (Regel 14): Lichtband über Rohre, dann über den Helm (Messing, Rahmen, Glas); nur Innenpixel ---
    for start in (2, 26):
        Hm.lichtband(hl, m_rohr, OFF, i, N, start, 8, PIPE_RAMPE, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
    for start in (6, 30):
        Hm.lichtband(hl, m_helm, OFF, i, N, start, 14, MESSING, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(hl, m_helm, OFF, i, N, start, 14, OLIV, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=2)
        Hm.lichtband(hl, m_helm, OFF, i, N, start, 14, GLAS, stufen=1, breite=3.0, achse=(1.0, 1.0), kern=1)
    # --- Rohrzittern (Zeilen 0–2 gemeinsam ±1 px) ---
    for name, (x0, x1) in ROHRE.items():
        a = rohr_stufe(i, name)
        if a:
            Hm.bereich_versatz(hl, OFF, {y: a for y in (0, 1, 2)}, x0, x1)
    # --- Helm + Rohre sinken starr (nichts wird gestreckt) ---
    if sink:
        hl = L.versetze(hl, 0, sink)
    # --- Zipfel wehen: Saum (Zeilen 22–23) pendelt, Zipfel rückt 1 Zeile hoch (Zeile 21 entfällt) ---
    for seite, w in (('l', wl), ('r', wr)):
        dx = saum_dx(i, seite)
        if dx:
            Hm.bereich_versatz(w, OFF, {22: dx, 23: dx}, 0, sw - 1)
        if zipfel_hub(i, seite):
            w[:] = L.heben_unten(w, PAD_T + 21, 1)
    fig = L.zusammen(H, W, [(kap, 0, 0), (wl, 0, 0), (wr, 0, 0), (hl, 0, 0)])
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)                                # Regel 16
    # --- Glitzer-Sterne an Messingkanten (nur Gold/Metall), sinken mit dem Helm ---
    for (sx, sy, start) in (() if nur else ((8, 8, 10), (16, 12, 26), (15, 19, 40))):
        st = Hm.folge(i, start, [0, 1, 2, 1], N)
        Hm.stern4(gl, sx, sy + sink, st, KERN, ARM1, ARM2, OFF)
    ebenen = []
    if dampf:
        py = PAD_T - 2                                                        # Dampf startet knapp über der Rohrspitze und steigt bis 4 px höher
        spec = []
        for cx, dx2, off0 in ((PAD_L + 11, 1, 0), (PAD_L + 19, 0, 6)):        # Mitte der Rohrspitzen (links x 10–12, rechts x 19–21)
            spec.append(dict(x=cx, y=py, vx=0, vy=-4, off=off0, form='m', wackeln=0.6))
            spec.append(dict(x=cx + dx2, y=py, vx=0, vy=-4, off=off0 + 12, form='m', wackeln=-0.6))
        ebenen.append((Dw.puff(H, W, i % 24, 24, spec, {'c': GLAS_H, 'r': F}), 0, 0))
    ebenen += [(fig, 0, 0), (gl, 0, 0)]
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
