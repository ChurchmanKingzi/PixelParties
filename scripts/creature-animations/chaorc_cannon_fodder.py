# -*- coding: utf-8 -*-
"""Idle-Animation für „Chaorc Cannon Fodder“ (Creature) — das KANONENFUTTER samt seiner KANONE: der Spitzohr-Kopf, der vorne in der schwarzen Kanone sitzt (nicht der rote Chaorc, der die Kanone bedient).

RUNDE 3 (Nutzer: „Beim Cannon Fodder bitte auch die Kanone darstellen.“): die Kanone gehört jetzt zum Sprite. Der Kopf (wie bisher, unverändert animiert) sitzt vor der Mündung der Kanone.

Quelle: src/chaorc-cannon-fodder.png (45×26 px, 21 Farben) = Komposit zweier Ebenen derselben xcf (MotiveHawaii) in der Lage der Kartenkunst Chaorc_Cannon_Fodder.png (76×51; beide Ebenen stimmen dort zu 99 % bzw. 100 %):
PICK: [["MotiveHawaii", 113, 1], ["MotiveHawaii", 114, 1]]
  * Ebene 113 („Cannon Fodder“, Figur 1, 18×17 px bei (52,15) der Kunst): der Kopf mit den spitzen Ohren (src/chaorc-cannon-fodder-kopf.png, 17×16, im Komposit bei (28,1)). Die Ebene enthält links daneben auch den roten Chaorc
    = Figur 2 (gehört nicht zur Figur).
  * Ebene 114 („Ebene #70“, 34×26 px bei (25,14) der Kunst): die KANONE (src/chaorc-cannon-fodder-kanone.png): schwarz-grauer Eisenlauf mit drei Stacheln oben, drei runden Schraubenplatten, Sockel unten und der Zündschnur samt
    brennender Lunte links. Die Ebene 108 („Ebene #77“) ist dieselbe Kanone ohne Lunte (4 px weiter rechts) und wird nicht benutzt.
  Nicht zur Figur gehören: der rote Chaorc, die Kisten und die Schräge der Kunst.
Aufruf:   python3 chaorc_cannon_fodder.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/chaorc-cannon-fodder.png + .json

Was im Sprite ist (x, y im 45×26-Komposit):
* KANONE (x 0–33, y 0–25): Eisenlauf (26,26,26)/(31,31,31)/(38,38,38)/(46,46,46)/(61,61,61)/(92,92,92); drei Stacheln oben (x 12/19/26, y 0–2), je eine runde Platte mit Nietenpunkt, Sockel unten (y 23–25); Mündung rechts bei x 29–33.
  Links eine dünne dunkle Zündschnur ((1,12) → (4,15) schräg nach unten zum Lauf) mit brennender Lunte oben: acht gelbe Pixel (255,255,0) mit hellem Kern (255,255,203) bei (0–2, 7–11) = Feuer (Regel 15/40).
* KOPF (x 28–44, y 1–16): runder Kopf, dunkelbraunes Haar/Umriss A (49,24,0) (oben Haarschopf mit Strähnenpixeln), Haut (246,189,123), Schatten (213,164,98), Licht (255,213,164); SPITZE OHREN links (x 28–32, y 4–7) und rechts (x 40–44, y 4–7);
  ZWEI AUGEN (y 5–6): weiße Augäpfel mit dunkelroten Pupillen (90,8,0); dichte Brauen; HALS/KRAGEN (x 34–39, y 10–14): brauner Kragen (139,82,16), darunter Schulterstück in Haut-/Olivtönen; DUNKELROTER STREIFEN (x 32–33, y 10–16, (50,0,0)/(40,0,0))
  hängt links unter dem Ohr vor der Kanonenmündung herab (nicht eindeutig, bleibt FEST).
Metall im Sprite: die Kanone (Eisen) — Runde 3: sie bekommt KEINEN Glanz (nicht verlangt); kein Dampf, keine weiteren Partikel.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* KANONE: steht fest (starres Gerät; Nutzer: Kanone bleibt fest). Nur die Lunte brennt: die acht Pixel der Quelle werden durch eine von Hand gezeichnete Flamme ersetzt (anim_feuer.py, Zungenposen 2–3 Frames, Spitzen reißen als Funken ab,
  Farben nur Gelb und helles Gelb der Quelle; der Fuß sitzt auf dem obersten Zündschnur-Pixel (1,12)). Frame 0 weicht in der Flamme vom Original ab, der Rest ist exakt das Original.
* Kopf (unverändert gegenüber der alten Fassung; liegt als eigene Ebene VOR der Kanone, der Kopf wandert nie seitlich):
  - Atmen (Periode 24 = zweimal pro Schleife): die Kragenzeile 9 des Kopfs wird einmal doppelt eingefügt (L.streck_zeile): der Kopf mit Ohren und Haar steigt 1 px, das untere Schulterstück und der Streifen bleiben stehen.
  - Schreckzittern (Frames 14–19 und 38–43): in diesen Fenstern steigt der Kopf jeden zweiten Frame 1 px höher (die Kragenzeile wird einmal öfter eingefügt), nur senkrecht.
  - Augen wandern: die Pupillen blicken nach rechts (Frames 8–15 und 32–39), sonst nach links (Original).
  - Ohrzucken: die Spitze des linken Ohrs (Frames 28–31) bzw. des rechten Ohrs (Frames 4–7) knickt 1 px nach unten (Umrisspixel (0,5) → (0,6) bzw. (16,5) → (16,6) des Kopf-Sprites; freigelegt wird, was dahinter liegt = Kanone/Hintergrund).
  - Blinzeln (Frames 20–22 und 44–46): beide Augen nehmen die umgebende Hautfarbe an.
Frame 0 = Original-Komposit (Ruhepose), die Flamme ausgenommen. Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine. Der Frame ist auf die Figur (samt Flamme und abgerissenen Funken) zugeschnitten, Randabstand ≥ 2.
"""
import math
import sys

import numpy as np

import anim_feuer3 as F3
import anim_humanoide as Hm
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)

N, MS = 48, 62
GPL, GPR, GPT, GPB = 8, 6, 12, 4            # große Arbeitsleinwand (Flamme/Funken links oben, Kopf steigt bis 2 px); am Ende wird auf die Figur zugeschnitten

spr = L.lade('chaorc-cannon-fodder')                 # Komposit (Referenz für Farben und Ruhepose)
kanone_src = L.lade('chaorc-cannon-fodder-kanone')   # Ebene 114, 34×26, im Komposit bei (0,0)
kopf_src = L.lade('chaorc-cannon-fodder-kopf')       # Ebene 113 (Kopf), 17×16, im Komposit bei (HX, HY)
HX, HY = 28, 1
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR

HAUT = (246, 189, 123)
PUPILLE = (90, 8, 0)
WEISS = (255, 255, 255)
GELB, HELL = (255, 255, 0), (255, 255, 203)
ERLAUBT = Hm.umrissfarben(kopf_src)                  # Randfarben des Kopfes (Regel 16)
UMRISS = (49, 24, 0)

# --- Kanone: die acht Flammenpixel der Quelle werden entfernt (die Flamme wird neu gezeichnet), alles andere bleibt ---
flamme_alt = np.zeros(kanone_src.shape[:2], bool)
for y in range(kanone_src.shape[0]):
    for x in range(kanone_src.shape[1]):
        if kanone_src[y, x, 3] and tuple(int(v) for v in kanone_src[y, x, :3]) in (GELB, HELL):
            flamme_alt[y, x] = True
assert flamme_alt.sum() == 8
kanone_ohne, _ = L.trenne(kanone_src, ~flamme_alt)
KANONE = L.platz(kanone_ohne, H, W, GPL, GPT)

# --- Flamme an der Lunte (anim_feuer): nur Gelb und helles Gelb stehen im Sprite; Fuß auf dem obersten Zündschnur-Pixel (1,12) ---
RAMPE = {'rand': GELB, 'rot': GELB, 'orange': GELB, 'gelb': GELB, 'hell': HELL}
SPERRE = np.zeros((H, W), bool)
SPERRE[GPT + 12, GPL + 1] = True                      # nur dieses eine Zündschnur-Pixel trägt die Flamme (die schräge Schnur darunter bleibt unberührt)
assert kanone_ohne[12, 1, 3] > 0
# Runde 5 (neues Feuer-System anim_feuer3): die Luntenflamme ist für das Feldverfahren zu klein → handgezeichneter 8-Bilder-Zyklus F3.klein('kerze') (Tropfen 5 px breit, Bauch wandert hoch, Spitze neigt sich und reißt ab),
# Fußzeile (0–2, 11) sitzt direkt auf dem obersten Zündschnur-Pixel (1,12); Gelb außen, helles Gelb als Kern (einzige Feuerfarben der Quelle).


def kopf_frame(i):
    """Der Kopf allein auf der großen Leinwand (Ebene vor der Kanone), unverändert gegenüber der alten Fassung."""
    k = L.platz(kopf_src, H, W, GPL + HX, GPT + HY)
    OFFK = (GPL + HX, GPT + HY)
    # --- Augen: Blick nach rechts (Pupille und Weiß tauschen) bzw. Blinzeln (Hautfarbe) ---
    if Hm.folge(i, 20, [1, 1, 1], N) or Hm.folge(i, 44, [1, 1, 1], N):
        Hm.setze(k, {(x, y): HAUT for (x, y) in ((8, 4), (9, 4), (8, 5), (9, 5), (11, 4), (12, 4), (11, 5), (12, 5))}, OFFK)
    elif Hm.folge(i, 8, [1] * 8, N) or Hm.folge(i, 32, [1] * 8, N):
        Hm.setze(k, {(8, 5): WEISS, (9, 5): PUPILLE, (11, 5): WEISS, (12, 5): PUPILLE}, OFFK)
    # --- Ohrzucken: die Spitze des linken (Frames 28–31) bzw. rechten (Frames 4–7) Ohrs knickt 1 px nach unten (Umrisspixel wandert mit, Kontur bleibt geschlossen) ---
    if Hm.folge(i, 28, [1] * 4, N):
        Hm.setze(k, {(0, 5): None, (0, 6): UMRISS}, OFFK)
    if Hm.folge(i, 4, [1] * 4, N):
        Hm.setze(k, {(16, 5): None, (16, 6): UMRISS}, OFFK)
    # --- Atmen + Schreckzittern: Kragenzeile 9 wird 1× (Atmen) bzw. 2× (Atmen + Zittern, jeden zweiten Frame im Zitterfenster) doppelt eingefügt, der Kopf steigt (nur senkrecht) ---
    zittern = (Hm.folge(i, 14, [1] * 6, N) or Hm.folge(i, 38, [1] * 6, N)) and i % 2 == 1
    n_ = Hm.stufe(i, N / 2, 1) + (1 if zittern else 0)
    if n_:
        k = TX.streck_zeile(k, GPT + HY + 9, n_)
    Hm.kontur_schliessen(k, ERLAUBT, UMRISS)
    return k


def frame_gross(i, flamme=True):
    ebenen = [(KANONE, 0, 0), (kopf_frame(i), 0, 0)]
    if flamme:
        ebenen += [(F3.klein(H, W, GPL + 1, GPT + 11, i, [GELB, HELL, HELL], 'kerze'), 0, 0)]
    return L.zusammen(H, W, ebenen)


def _box():
    """Zuschnitt: Vereinigung aller Frames + 2 px Rand."""
    x0, y0, x1, y1 = W, H, 0, 0
    for i in range(N):
        a = frame_gross(i)[..., 3] > 0
        ys, xs = np.nonzero(a)
        x0, y0, x1, y1 = min(x0, int(xs.min())), min(y0, int(ys.min())), max(x1, int(xs.max()) + 1), max(y1, int(ys.max()) + 1)
    return x0 - 2, y0 - 2, x1 + 2, y1 + 2


BOX = _box()
OFF = (GPL - BOX[0], GPT - BOX[1])                    # Lage des Komposits im zugeschnittenen Frame


def frame(i, nur=None):
    x0, y0, x1, y1 = BOX
    return frame_gross(i, flamme=not nur)[y0:y1, x0:x1].copy()


TEST_EBENEN = ('figur',)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    # Ruhepose: Kopf und Kanone gleich dem Komposit, nur die Flamme darf abweichen
    f0 = frame(0, nur=True)
    ref = L.platz(spr, f0.shape[0], f0.shape[1], OFF[0], OFF[1])
    ref, _ = L.trenne(ref, ~np.pad(flamme_alt, ((OFF[1], f0.shape[0] - OFF[1] - flamme_alt.shape[0]), (OFF[0], f0.shape[1] - OFF[0] - flamme_alt.shape[1]))))
    print('Ruhepose (ohne Flamme) weicht vom Komposit ab bei:',
          int(((f0[..., 3] > 0) != (ref[..., 3] > 0)).sum() + (f0[f0[..., 3] > 0][:, :3] != ref[f0[..., 3] > 0][:, :3]).any(axis=1).sum()), 'Pixeln')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('chaorc-cannon-fodder', 'Chaorc Cannon Fodder', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/chaorc-cannon-fodder-strip.png', frames, spalten=12, scale=6)
