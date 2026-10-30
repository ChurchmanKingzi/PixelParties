# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Archer“ (Creature) — Muster für die Elfen und andere Humanoide mit Bogen/Stab.

Quelle: src/elven-archer.png — die sitzende Elfe mit Bogen (18×26 px, 33 Farben).
PICK: [["MotiveGrailWar", 554, 1]]      (Ebene „Elven Archer“, Figur 1; derselbe Sprite steckt gespiegelt in Ebene 555)

Aufruf:   python3 elven_archer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-archer.png + .json

Was im Sprite ist (Koordinaten x, y im 18×26-Sprite):
* Bogen (x 2–4, y 6/7–25): brauner Schaft mit dunklem Umriss, schwarz-grauer Griff y 14–17. Hebt sich als Einheit mit Arm/Hand (Brust).
* Linke Elfenohrspitze (0–1, 8–9): nur ein dunkler Keil, der Rest steckt hinter dem Bogen. Rechtes Ohr (14–17, 8–10).
* FEDER (13–15, 0–4): hellblau mit weißer Kante, steckt hinter dem Kopf im Haar (Haarschmuck, kein Pfeil).
* Haar (x 4–13, y 3–14): gelb/orange, Pony y 7–9, zwei Seitenlocken (links x 5, rechts x 12–13). Gesicht y 9–13.
  Offenes Auge links (6–7, 9–11: schwarz, hellblaue Iris (6,10), weißer Glanz (6,11)); rechtes Auge ist zugekniffen (zwinkert,
  schwarzer Strich (10–11, 11)).
* Hand am Bogengriff (5–7, 15–18), grüne Tunika (8–13, 15–19), Beine/Schuhe braun-grau (5–13, 19–25).
* Orange/rotbraune Pixel (14,14), (15,14), (15,15) am rechten Rand der Schulter: freie Haarsträhne/Zopfende über der Schulter
  (Orange = Haar, rotbraun = Schattenrand) — pendelt im Wind (siehe unten).

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Auf und ab (zweistufig, Periode 24 = zweimal pro Schleife): Die Brust hebt sich zuerst um 1 px (die dunkle Gürtelzeile 18 wird
  einmal doppelt eingefügt: Brust, Hand, Kopf und Feder steigen, die Beine bleiben). Der Kopf läuft 3 Frames nach und hebt sich um ein
  weiteres px (Halszeile 14 verlängert): Der Kopf hebt sich also 0 → 1 → 2 → 1 → 0 px, die Brust 0 → 1 → 0. Der Bogen steigt als Einheit mit Arm/Hand und
  Brust (starr um dieselben 0 → 1 → 0 px, die Hand rutscht nicht am Griff); nur der Kopf-Nachlauf kommt obendrauf. Wo sich dabei der Kopf von der Bogenspitze löst, wird die Lücke mit Haar gefüllt (Lücke (4,5)/(4,6) → Farbe der
  anliegenden Locke (5,y), siehe Funktion luecke_bogen).
* Haare im Wind (drei Böen, alle 16 Frames, Start 4/20/36; die Welle läuft von der Locke zur Strähnenspitze, je Stufe 2 Frames später):
  1. Spitze der rechten Locke (12,14): blasser Pixel schlägt nach außen auf (13,14) über die Schulter, (12,14) wird Umrissbraun.
  2. Freie Strähne über der rechten Schulter, Zeile 14: Orange wird 1–2 px breiter, der rotbraune Rand rückt nach (16,14)/(17,14).
  3. Strähnenspitze Zeile 15: Rand wird 2–3 px lang ((15..17,15)).
  4. Feder: biegt sich mit der Böe leicht nach rechts (1 px, 2 Stufen), ohne dass etwas aus ihr ausströmt.
  Alle Zustände sind 4-verbunden (Eckkontakt-Kontrolle in der Prüfung).
* Linke Lockenspitze (5,14): außen liegt der Bogenumriss (4,14), nach außen geht nichts — sie schlägt dreimal pro Schleife kurz nach
  innen ((5,14) wird Umrissbraun, der blasse Pixel steht auf (6,14)).
* Haarglanz (zwei Lichtbänder pro Schleife, Frames 1–12 und 25–36): ein diagonales Band läuft über das Haar; die Haarpixel dort sind
  eine (im Kern zwei) Stufe(n) der Haarrampe heller (nur Farben des Sprites).
* Augenglanz (Frames 13–15 und 37–39): Hellblau und Weiß des offenen Auges tauschen kurz den Platz (der Glanzpunkt „wandert“).
* Ohrenzucken: rechtes Ohr Frames 7–11 und 40–42 (Spitze (17,8) → (17,9)), linkes Ohr Frames 28–30 (Keil (0,8) → (0,9)); beide
  Umrisse bleiben 4-verbunden.
* Blinzeln (Frames 17–19 und 38–40): das offene linke Auge schließt sich über eine Zwischenstufe zum Strich wie das zwinkernde rechte.
Frame 0 = Original (Ruhepose); Kontrolle per anim_humanoide.ruhepose.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: Lücke zwischen Kopf und Bogenspitze (4,5)/(4,6) in Haarfarbe, Ohrspitzen (17,9)/(0,9) und Lockenspitzen (12,14)/(5,14)
in Umrissfarbe (49,24,0), Strähne (orange (230,131,16), rotbraun (115,41,16)), Feder-Biegung in Hellblau/Weiß, Augenstufen in Haut/Schwarz.
Unter der Hand wird beim Atmen Zeile 19 statt Zeile 18 verdoppelt (sonst würde der dunkle Handumriss doppelt dick).
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 4, 5, 6, 3

spr = L.lade('elven-archer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# Farben des Sprites
HAUT, SCHWARZ, HELLBLAU, WEISS = (246, 205, 139), (0, 0, 0), (172, 213, 255), (246, 255, 255)
UMRISS = (49, 24, 0)
ORANGE, ROTBRAUN = (230, 131, 16), (115, 41, 16)
HAARRAMPE = [(115, 41, 16), (189, 57, 8), (213, 98, 16), (230, 131, 16), (255, 180, 24), (255, 222, 90), (255, 246, 172)]
HELLGELB = HAARRAMPE[-1]

KANTE0 = Hm.kantenmaske(spr)
ERLAUBT = Hm.umrissfarben(spr)                                  # Farben der Außenkante im Original (Regel 16)
# Teile: der Bogen steht fest, alles andere (Körper samt Kopf, Ohren, Feder) wird bewegt
bogen = vorhanden & (xx >= 2) & (xx <= 4) & (yy >= 7) | ((xx == 3) & (yy == 6))
koerper = vorhanden & ~bogen
BOGEN_OBEN = 7                                                # erste Zeile mit Bogenpixeln bei x 2–4 (davor nur der Nubbel (3,6))

# Blinzeln des offenen linken Auges: offen (6,9) schwarz, (6,10) Iris, (7,10) Pupille, (6,11) Glanz, (7,11) rotbraun.
AUGE_HALB = {(6, 9): HAUT, (6, 11): SCHWARZ}
AUGE_ZU = {(6, 9): HAUT, (6, 10): HAUT, (7, 10): HAUT, (6, 11): SCHWARZ, (7, 11): SCHWARZ}
AUGE_GLANZ = {(6, 10): WEISS, (6, 11): HELLBLAU}              # Hellblau und Weiß tauschen den Platz
# Ohren zucken nach unten (Spitze 1 px tiefer); die Umrisse bleiben 4-verbunden
OHR_R_RUNTER = {(17, 8): None, (17, 9): UMRISS}
OHR_L_RUNTER = {(0, 8): None, (0, 9): UMRISS}
# Haare im Wind: Locken-Spitzen und freie Strähne (Zustände 4-verbunden, siehe Kopf)
SPITZE_R = {(12, 14): UMRISS, (13, 14): HELLGELB}
SPITZE_L = {(5, 14): UMRISS, (6, 14): HELLGELB}
def straehne(l14, l15):
    """Freie Haarsträhne über der rechten Schulter mit geschlossener Kontur (Regel 16): Zeile 14 orange von x 14 bis 14 + l14, rotbrauner Abschluss rechts,
    rotbraune Oberkante in Zeile 13 (x 15 … 14 + l14) und rotbraune Unterkante in Zeile 15 (x 15 … 15 + max(l14, l15))."""
    px = {}
    for x in range(15, 15 + l14):
        px[(x, 14)] = ORANGE
        px[(x, 13)] = ROTBRAUN
    px[(15 + l14, 14)] = ROTBRAUN
    for x in range(15, 16 + max(l14, l15)):
        px[(x, 15)] = ROTBRAUN
    return px
# Feder biegt sich mit der Böe (Ruhe: weiß (15,0),(14,1),(13,2); hellblau (15,1),(14,2),(13,3),(14,3),(13,4))
FEDER = {1: {(15, 0): None, (16, 0): WEISS, (16, 1): HELLBLAU},
         2: {(15, 0): None, (14, 1): None, (16, 0): WEISS, (15, 1): WEISS, (16, 1): HELLBLAU, (14, 2): WEISS, (15, 2): HELLBLAU}}
# Böe: Verlauf je Frame nach dem Böenstart (Locke → Strähne Zeile 14 → Strähnenspitze Zeile 15, Feder eilt 1 Frame voraus)
BOE_SPITZE = [1, 1, 1, 1, 1, 1]
BOE_S14 = [0, 0, 1, 2, 2, 2, 1, 1]
BOE_S15 = [0, 0, 0, 0, 1, 2, 2, 1]
BOE_FEDER = [1, 2, 2, 2, 2, 1]
BOEN = (4, 20, 36)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def luecke_bogen(k, bogen_hub=0):
    """Hebt sich der Kopf schneller als der Bogen (Kopf-Nachlauf), löst sich die linke Haarkante von der Bogenspitze: In Spalte x = 4
    (rechter Bogenumriss) fehlen dann Pixel zwischen dem obersten Haarpixel und der ersten Bogenzeile (7 − bogen_hub). Sie werden in der
    Farbe der anliegenden Locke (x = 5) gefüllt, damit Kopf und Bogen 4-verbunden bleiben."""
    xc, yb = PAD_L + 4, PAD_T + BOGEN_OBEN - bogen_hub
    ys = [y for y in range(yb) if k[y, xc, 3]]
    if not ys:
        return k
    for y in range(min(ys) + 1, yb):
        if not k[y, xc, 3] and k[y, xc + 1, 3]:
            if k[y, xc - 1, 3]:                                  # links liegt die Bogenspitze (Nubbel): Lücke in Haarfarbe der anliegenden Locke
                k[y, xc] = k[y, xc + 1]
            else:                                                # links frei: Außenkante → Umrissfarbe (Regel 16)
                k[y, xc, :3] = UMRISS
                k[y, xc, 3] = 255
    return k


def frame(i):
    k = teil(koerper)
    b = teil(bogen)
    # --- Haarglanz: zwei diagonale Lichtbänder (Position s = x + 0,6·y), Haarpixel 1–2 Stufen heller ---
    for start in (1, 25):
        mitte = Hm.boe_mitte(i, N, start, 12, 3.0, 24.0)
        if mitte is not None:
            Hm.heller(k, lambda x, y: (not KANTE0[y, x]) and Hm.boe_aktiv(x, y, mitte, 1.3), HAARRAMPE, OFF)      # Randpixel (Umriss) bleiben unverändert
            Hm.heller(k, lambda x, y: (not KANTE0[y, x]) and Hm.boe_aktiv(x, y, mitte, 0.6), HAARRAMPE, OFF)
    # --- Pixel-Ereignisse am Körper (vor dem Atmen, damit sie mit dem Kopf steigen) ---
    bl = Hm.folge(i, 17, [AUGE_HALB, AUGE_ZU, AUGE_HALB], N) or Hm.folge(i, 38, [AUGE_HALB, AUGE_ZU, AUGE_HALB], N)
    if bl:
        Hm.setze(k, bl, OFF)
    elif Hm.takt(i, N, 13, 3) or Hm.takt(i, N, 37, 3):
        Hm.setze(k, AUGE_GLANZ, OFF)
    if Hm.folge(i, 7, [1, 1, 0, 1, 1], N) or Hm.folge(i, 40, [1, 1, 1], N):
        Hm.setze(k, OHR_R_RUNTER, OFF)
    if Hm.folge(i, 28, [1, 1, 1], N):
        Hm.setze(k, OHR_L_RUNTER, OFF)
    # --- Böen: Locke → Strähne → Strähnenspitze, Feder ---
    l14 = l15 = 0
    for start in BOEN:
        if Hm.folge(i, start, BOE_SPITZE, N):
            Hm.setze(k, SPITZE_R, OFF)
        l14 = max(l14, Hm.folge(i, start, BOE_S14, N) or 0)
        l15 = max(l15, Hm.folge(i, start, BOE_S15, N) or 0)
        f = Hm.folge(i, start - 1, BOE_FEDER, N)
        if f:
            Hm.setze(k, FEDER[f], OFF)
    if l14 or l15:
        Hm.setze(k, straehne(l14, l15), OFF)
    if Hm.takt(i, N, 10, 3) or Hm.takt(i, N, 26, 3) or Hm.takt(i, N, 42, 3):     # linke Lockenspitze schlägt nach innen
        Hm.setze(k, SPITZE_L, OFF)
    # --- Auf und ab: Brust zuerst, Kopf 3 Frames später ---
    brust = Hm.stufe(i, N / 2, 1)
    kopf = Hm.stufe(i - 3, N / 2, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 14, brust, kopf)
    if brust:
        # Unter der Hand (x 5–7) soll nicht der dunkle Handumriss (Zeile 18) doppelt stehen, sondern der Saum (Zeile 19) —
        # die eingefügte Zeile 18 wird dort mit der Zeile 19 überschrieben (Hand bleibt einfach hoch, Umriss einfach dick).
        k[PAD_T + 18, PAD_L + 5:PAD_L + 8] = k[PAD_T + 19, PAD_L + 5:PAD_L + 8]
    # Der Bogen steigt mit Arm/Hand und Brust (Einheit: Hand sitzt am Griff, rutscht nicht), nur der Kopf-Nachlauf kommt obendrauf
    b = L.versetze(b, 0, -brust)
    k = luecke_bogen(k, brust)
    fig = L.zusammen(H, W, [(k, 0, 0), (b, 0, 0)])
    return Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    ecke0 = Hm.eckkontakte(frames[0])
    neu = {i: sorted(Hm.eckkontakte(f) - ecke0) for i, f in enumerate(frames) if Hm.eckkontakte(f) - ecke0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('elven-archer', 'Elven Archer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-archer-strip.png', frames, spalten=12, scale=6)
