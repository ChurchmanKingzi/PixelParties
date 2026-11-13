# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Aristocrat“ (Creature) — der tuskische Aristokrat: riesige graue Locken-Perücke aus zwei Wülsten, kleines Gesicht mit blauem Auge und Monokel, Arme in die Seiten gestemmt,
rot-weiße Strümpfe/Stiefel.

Quelle: src/tuscan-aristocrat.png (24×25 px, 25 Farben, 426 Pixel) — MANUELL aus der Ebene herausgeschnitten, Runde 3 um die goldene Frisur ergänzt.
PICK: [["MotiveGrailWar", 197, "manuell: Ebene „Tuscan Aristocrat“ (88×79 px) enthält Lava-Hintergrund UND die Figur unten; Figur = alle nicht-Lava-Pixel im Rechteck x 14–46, y 53–78 der Ebene, größte zusammenhängende Komponente"]]
Warum manuell: creature_show.py findet für die Karte nur Baum/Gestein (Ebene 428 / 426 in MotiveGN, 16×30 bzw. 16×21, „Kunstmatch 97 %“ — das ist der tote Baum links im Bild), weil die Figur in der Ebene an die
Lava stößt und mit ihr zu einer Komponente verschmilzt. Der Ebenenname „Tuscan Aristocrat“ (MotiveGrailWar 197) und die Lage in der Kartenkunst (x 27–50, y 20–45) stimmen mit der Figur überein.
Lavafarben (249,141,19)/(249,203,25)/(247,231,14)/(232,170,0)/(255,254,130)/(255,215,0)/(255,255,94) wurden entfernt, zwei vereinzelte Lava-Glitzerpunkte oben links ebenfalls (nicht verbunden).
RUNDE 3 (Nutzer: „fehlt die goldene Frisur“): dabei ging die GOLDENE FRISUR verloren — der goldene Haarschopf im V zwischen den beiden grauen Wülsten teilt drei Goldtöne mit der Lava
((232,170,0), (255,215,0), (255,255,94)) und wurde mit herausgelöscht. Ebene MotiveGrailWar 197 (Sprite ↔ Ebene: x + 20, y + 54) zeigt ihn eindeutig (Tuft in kräftigerem Gold als die Lava, mit eigener Schattierung G/I/J). Wiederhergestellt
(27 Pixel, 1:1 aus der Ebene, src/tuscan-aristocrat.png): Zeile 0: x 10–15 (232,170,0)(232,170,0)(247,231,14)(232,170,0)(232,170,0)(232,170,0); Zeile 1: x 9–14 G I J G I J; Zeile 2: x 10–13 G I J G; Zeile 3: x 9–14 G I J I J G;
Zeile 4: x 10–13 G I G G; Zeile 5: x 11 G  (G = (232,170,0), I = (255,215,0), J = (255,255,94)). Das Gold gehört nun zum Sprite (24×25 px, 24 Farben, 426 Pixel).

Aufruf:   python3 tuscan_aristocrat.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-aristocrat.png + .json

Was im Sprite ist (x, y im 24×25-Sprite; die Figur ist fast achsensymmetrisch um x = 11,5):
* PERÜCKE (x 0–9 und 14–23, y 0–9): zwei große graue Locken-Wülste (23,21,22)/(161,147,144)/(124,112,112)/(91,82,83) mit dunklen Strähnen (48,44,45) bei x 7–8 und 15–16, beiderseits eines V-Ausschnitts oben.
* GESICHT (x 9–14, y 5–12): grau (124,112,112)/(82,82,82)/(139,139,142)/(159,159,159)/(198,198,198), EIN blaues Auge (0,119,255) bei (10,8), rechts daneben ein MONOKEL (Rand (82,82,82) bei x 12 und 15, Glas hellgrau
  (198,198,198)/(159,159,159), Glanzpunkt (241,241,241) bei (14,7)); dazu der aufgemalte weiße GLITZERSTERN (241,241,241) über der rechten Wulst (9 Pixel bei (17,4–8), (15–16,6), (18–19,6), (14,7)) — Linse und Metallrand blitzen.
  Darunter dunkler Kragen/Rock (23,21,22)/(91,82,83) in der Mitte (x 10–13, y 11–24).
* ARME (x 3–9 und 14–20, y 13–16): Unterarme/Hände in Hauttönen (156,105,62)/(239,161,95)/(245,203,161) in die Seiten gestemmt, Ärmelsaum lila (199,180,218).
* BEINE (x 4–10 und 13–19, y 17–24): rote Strümpfe (49,24,0)/(164,24,0)/(119,8,0)/(193,41,0) mit weißen Streifen (253,249,252)/(189,189,189), lila Kante (199,180,218), schwarze Sohlen (y 24).
Metall/Glas im Sprite: das Monokel (Rahmen + Glas). Nur dort glänzt es (Regel 14); Perücke (Haar), Haut, Stoff nicht.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (Periode 24 = zweimal pro Schleife): Beinzeile 20 wird einmal doppelt eingefügt (Texturmischung): Perücke, Gesicht, Arme und Rumpf steigen 1 px, die Füße bleiben am Boden; der Kopf bleibt starr.
* Perückenlocken wippen (Zeilen 0–3): die Spitzen der beiden Wülste schwingen unabhängig 1–2 px hin und her (links Periode 24, rechts Periode 16), nach unten auslaufend (Gefälle ≤ 1 px je Zeile).
  Die goldene Frisur sitzt als eigene Ebene HINTER den Wülsten (steigt mit dem Atmen mit, wiegt sich nicht seitlich); damit beim Auswärtsschwingen eines Wulstes keine Lücke zum Hintergrund entsteht, ist sie in den Zeilen 1–2 unter dem Wulstumriss
  um 2 px fertiggezeichnet (Gold (232,170,0) auf den Pixeln, die im Ruhebild vom Wulst verdeckt sind: (7,1) (8,1) (15,1) (16,1) (8,2) (9,2) (14,2) (15,2)).
* Blinzeln (Frames 19–21 und 41–43): das einzige Auge, der blaue Pixel (10,8), nimmt die Gesichtsfarbe (124,112,112) an (Lid = umgebendes Grau), kein Glanzpunkt.
* Monokel funkelt (Regel 14): der weiße Glitzerstern auf der rechten Wulst schrumpft zweimal pro Schleife (Frames 8–15 und 32–39) auf einen kleinen Kern und verschwindet kurz (dann zeigt die Wulst ihr
  gespiegeltes Gegenstück der linken Wulst); Frame 0 zeigt den Stern vollständig.
* Fußtippen: der linke Stiefel hebt sich 1 px hinter das Bein (Frames 10–17), später der rechte (Frames 34–41).
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Ergänzungen: unter dem Glitzerstern fehlen die Wulstpixel (der Stern ist über die Figur gemalt); beim Erlöschen des Sterns werden sie aus der gespiegelten linken Wulst (x ↔ 23−x) ersetzt:
(17,4) (17,5) (17,7) (17,8) (15,6) (16,6) (18,6) (19,6) — nur Quellfarben; (14,7) bleibt hell (Glanzpunkt des Glases).
Unsicherheit: ob der Stern Teil der Figur oder nur Lavaglitzer ist; er wurde als Glanz des Monokels gelesen.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_krieger as K
import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen

N, MS = 48, 62
sz = K.Szene('tuscan-aristocrat', (4, 4, 4, 2))               # Locken ±2 px, Wippen 1 px
spr, OFF, H, W = sz.spr, sz.OFF, sz.H, sz.W
PT = sz.pt
TEST_EBENEN = ('figur',)

AUGE = (10, 8)
GRAU = sz.f(11, 8)                                              # (124,112,112) Gesichtsgrau
STERN = [(17, 4), (17, 5), (17, 6 - 0), (15, 6), (16, 6), (18, 6), (19, 6), (17, 7), (17, 8)]
STERN = [(x, y) for (x, y) in STERN if sz.f(x, y) == (241, 241, 241)]
KLEIN = {(16, 6), (18, 6), (17, 5), (17, 7)}                    # Kern des Sterns (nur die Pixel, die im Original weiß sind)

fuss_l = sz.vor & (sz.yy >= 23) & (sz.xx <= 11)
fuss_r = sz.vor & (sz.yy >= 23) & (sz.xx >= 12)
GOLD = [(232, 170, 0), (255, 215, 0), (255, 255, 94), (247, 231, 14)]
m_gold = sz.farben_in(sz.rechteck(8, 0, 15, 5), set(GOLD))          # die goldene Frisur im V zwischen den Wülsten (eigene Ebene HINTER den Wülsten)
koerper = sz.vor & ~fuss_l & ~fuss_r & ~m_gold
# fertiggezeichnet: unter dem Wulstumriss geht das Gold in den Zeilen 1–2 zwei Pixel weiter (nur Pixel, die im Ruhebild vom Wulst verdeckt sind) — so zeigt ein auswärts schwingender Wulst Gold statt Hintergrund
UNTERLAGE = [(7, 1), (8, 1), (15, 1), (16, 1), (8, 2), (9, 2), (14, 2), (15, 2)]


def stern_stufe(i):
    """2 = voller Stern (Original), 1 = Kern, 0 = erloschen."""
    for start in (8, 32):
        s = Hm.folge(i, start, [2, 1, 0, 0, 0, 0, 1, 2], N)
        if s is not None:
            return s
    return 2


def frame(i, nur=None):
    ebenen = nur if nur is not None else ('figur',)
    k = sz.ebene(koerper)
    # --- Blinzeln: das einzige Auge ---
    if Hm.folge(i, 19, [1, 1, 1], N) or Hm.folge(i, 41, [1, 1, 1], N):
        K.blinzeln(k, OFF, {AUGE: GRAU})
    # --- Monokel-Stern funkelt (Original = voll) ---
    st = stern_stufe(i)
    if st < 2:
        for (x, y) in STERN:
            if x == 14:
                continue
            if st == 1 and (x, y) in KLEIN:
                continue
            Hm.setze(k, {(x, y): sz.f(23 - x, y)}, OFF)
    # --- Perückenlocken wippen (Zeilen 0–3, links und rechts unabhängig) ---
    dl = int(round(1.5 * np.sin(2 * np.pi * i / 24)))
    dr = int(round(1.5 * np.sin(2 * np.pi * i / 16)))
    Hm.bereich_versatz(k, OFF, K.gefaelle(list(range(0, 4)), dl), 0, 9)
    Hm.bereich_versatz(k, OFF, K.gefaelle(list(range(0, 4)), dr), 14, 23)
    # --- Auf und ab: Beinzeile 20 doppelt ---
    brust = Hm.stufe(i, N / 2, 1)
    k = K.bob(k, PT + 20, brust)
    # --- Fußtippen ---
    ul = 1 if K.fenster(i, N, 10, 8) is not None else 0
    ur = 1 if K.fenster(i, N, 34, 8) is not None else 0
    fl, fr = sz.ebene(fuss_l, 0, -ul), sz.ebene(fuss_r, 0, -ur)
    # --- goldene Frisur: eigene Ebene hinter den Wülsten, steigt mit ---
    gold = sz.ebene(m_gold)
    Hm.setze(gold, {p: GOLD[0] for p in UNTERLAGE}, OFF)
    gold = K.bob(gold, PT + 20, brust, mischen=False)
    fig = L.zusammen(H, W, [(fl, 0, 0), (fr, 0, 0), (gold, 0, 0), (k, 0, 0)])
    K.kontur(fig, sz.ERLAUBT, lambda c, x, y: (23, 21, 22))      # Regel 16: Umrissfarbe der Figur
    return fig


if __name__ == '__main__':
    K.abschluss(sz, frame, N, MS, 'Tuscan Aristocrat', 'tuscan-aristocrat', K.vorschau_pfad())
