# -*- coding: utf-8 -*-
"""Idle-Animation für „Elven Archer“ (Creature) — Muster für die Elfen und andere Humanoide mit Bogen/Stab.

Quelle: src/elven-archer.png — die sitzende Elfe mit Bogen (18×26 px, 33 Farben).
PICK: [["MotiveGrailWar", 554, 1]]      (Ebene „Elven Archer“, Figur 1; derselbe Sprite steckt gespiegelt in Ebene 555)

Aufruf:   python3 elven_archer.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elven-archer.png + .json

Was im Sprite ist (Koordinaten x, y im 18×26-Sprite):
* Bogen (x 2–4, y 6/7–25): brauner Schaft mit dunklem Umriss, schwarz-grauer Griff y 14–17. Steht fest (Bogen am Boden/in der Hand).
* Linke Elfenohrspitze (0–1, 8–9): nur ein dunkler Keil, der Rest steckt hinter dem Bogen. Rechtes Ohr (14–17, 8–10).
* Pfeilspitze (13–15, 0–4): hellblau mit weißer Kante (Pfeil im Köcher hinter dem Kopf).
* Haar (x 4–13, y 3–14): gelb/orange, Pony y 7–9, zwei Seitenlocken (links x 5, rechts x 12–13). Gesicht y 9–13.
  Offenes Auge links (6–7, 9–11: schwarz, hellblaue Iris (6,10), weißer Glanz (6,11)); rechtes Auge ist zugekniffen (zwinkert,
  schwarzer Strich (10–11, 11)).
* Hand am Bogengriff (5–7, 15–18), grüne Tunika (8–13, 15–19), Beine/Schuhe braun-grau (5–13, 19–25).
* Orange/rotbraune Pixel (14,14), (15,14), (15,15) am rechten Rand der Schulter: freie Haarsträhne/Zopfende über der Schulter
  (Orange = Haar, rotbraun = Schattenrand) — pendelt im Wind (siehe unten).

Ablauf (40 Frames à 90 ms = 3,6 s):
* Atmen (Periode 40): Der Oberkörper hebt sich um 1 px (die dunkle Gürtelzeile 18 wird einmal doppelt eingefügt: Brust, Hand,
  Kopf und Pfeil steigen, die Beine bleiben). Der Kopf hebt sich damit höchstens 1 px. Der Bogen steht fest (die Hand rutscht am
  Griff 1 px mit).
* Haare im Wind (zwei Böen, Frames 10–18 und 30–38; die Wellenfront läuft von der Locke zur Strähnenspitze, je Stufe 2 Frames später):
  1. Spitze der rechten Locke (12,14): blasser Pixel schlägt nach außen auf (13,14) über die Schulter, (12,14) wird Umrissbraun.
  2. Freie Strähne über der rechten Schulter, Zeile 14: Orange wird 2 px breit ((15,14) orange), der rotbraune Rand rückt nach (16,14).
  3. Strähnenspitze Zeile 15: Rand wird (15,15)+(16,15).
  Alle Zustände (0/1, 1/0, 1/1, 0/1 …) sind 4-verbunden (siehe Zählung in der Prüfung).
* Linke Lockenspitze (5,14): außen liegt der Bogenumriss (4,14), nach außen geht nichts — sie schlägt stattdessen zweimal kurz nach
  innen ((5,14) wird Umrissbraun, der blasse Pixel steht auf (6,14)): Frames 19–21 und 36–38.
* Ohrenzucken: rechtes Ohr Frames 22–26 (Spitze (17,8) → (17,9), zweimal), linkes Ohr Frames 8–10 (Keil (0,8) → (0,9)); beide
  Umrisse bleiben 4-verbunden.
* Blinzeln (Frames 15–17): das offene linke Auge schließt sich über eine Zwischenstufe zum Strich wie das zwinkernde rechte.
* Pfeil funkelt (Frames 27–34): ein kleiner Glanzklecks (Punkt → 2×2 → Punkt, keine Kreuzform) schwebt mit 1 px Abstand über der
  Pfeilspitze; danach gleitet die weiße Kante der Spitze zweimal eine Diagonale tiefer und zurück.
* Haarglanz (Frames 2–9): ein heller Glanzpunkt wandert über den Haarscheitel (y 5) von links nach rechts.
Frame 0 = Original (Ruhepose); Kontrolle per anim_humanoide.ruhepose.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine nötig (Kopf/Hand fahren ohne Lücke, der Bogen bleibt stehen). Einzige neu gesetzte Pixel: Ohrspitzen (17,9)/(0,9)
und Lockenspitzen (12,14)/(5,14) in Umrissfarbe (49,24,0), Strähne (15,14) orange (230,131,16), (16,14)/(15,15)/(16,15)
rotbraun (115,41,16) und das schwebende Funkeln über dem Pfeil. Unter der Hand wird beim Atmen Zeile 19 statt Zeile 18 verdoppelt.
"""
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 40, 90
PAD_L, PAD_R, PAD_T, PAD_B = 4, 5, 9, 3

spr = L.lade('elven-archer')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

# Farben des Sprites
HAUT, SCHWARZ, HELLBLAU, WEISS = (246, 205, 139), (0, 0, 0), (172, 213, 255), (246, 255, 255)
UMRISS, HELLGELB = (49, 24, 0), (255, 246, 172)

# Teile: der Bogen steht fest, alles andere (Körper samt Kopf, Ohren, Pfeil) wird bewegt
bogen = vorhanden & (xx >= 2) & (xx <= 4) & (yy >= 7) | ((xx == 3) & (yy == 6))
koerper = vorhanden & ~bogen

# Blinzeln des offenen linken Auges: offen (6,9) schwarz, (6,10) Iris, (7,10) Pupille, (6,11) Glanz, (7,11) rotbraun.
# zu = Strich auf Zeile 11 wie beim zwinkernden rechten Auge (10–11, 11), darüber Haut.
AUGE_HALB = {(6, 9): HAUT, (6, 11): SCHWARZ}
AUGE_ZU = {(6, 9): HAUT, (6, 10): HAUT, (7, 10): HAUT, (6, 11): SCHWARZ, (7, 11): SCHWARZ}
# Ohren zucken nach unten (Spitze 1 px tiefer); die Umrisse bleiben 4-verbunden:
# rechts (17,8) → (17,9) (hängt über das schon vorhandene (16,9) an (16,8)); links (0,8) → (0,9) (hängt an (1,9))
OHR_R_RUNTER = {(17, 8): None, (17, 9): UMRISS}
OHR_L_RUNTER = {(0, 8): None, (0, 9): UMRISS}
# Haare im Wind (Frames siehe frame()): freie Strähne über der rechten Schulter + die hellgelben Spitzen der Seitenlocken.
# Strähne in Ruhe: (14,14) orange, (15,14) und (15,15) rotbraun. Zeile 14 schwenkt aus (Orange wird 2 px breit, Umriss rückt nach
# (16,14)), zwei Frames später folgt die Spitze in Zeile 15 (Umriss (15,15)+(16,15)) — alle Zustände sind 4-verbunden.
ORANGE, ROTBRAUN = (230, 131, 16), (115, 41, 16)
STRAEHNE_14 = {(15, 14): ORANGE, (16, 14): ROTBRAUN}
STRAEHNE_15 = {(16, 15): ROTBRAUN}
# rechte Locke: die blasse Spitze (12,14) schlägt nach außen auf (13,14) (über die Schulter), (12,14) wird Umrissfarbe;
# (13,14) grenzt oben an (13,13), links an (12,14), rechts an (14,14) — 4-verbunden
SPITZE_R = {(12, 14): UMRISS, (13, 14): HELLGELB}
# linke Locke: außen liegt der Bogenumriss (4,14) → die Spitze schlägt nach innen: (5,14) wird Umrissfarbe, (6,14) blass
SPITZE_L = {(5, 14): UMRISS, (6, 14): HELLGELB}
# Arrow-Glanz: die weiße Kante gleitet diagonal von oben links nach unten rechts
PFEIL_D1 = [(15, 0), (14, 1), (13, 2)]; PFEIL_D2 = [(15, 1), (14, 2), (13, 3)]; PFEIL_D3 = [(14, 3), (13, 4)]


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                      # sofort auf die volle Leinwand


def frame(i):
    k = teil(koerper)
    b = teil(bogen)
    # --- Pixel-Ereignisse am Körper (vor dem Atmen, damit sie mit dem Kopf steigen) ---
    bl = Hm.folge(i, 15, [AUGE_HALB, AUGE_ZU, AUGE_HALB], N)
    if bl:
        Hm.setze(k, bl, OFF)
    if Hm.folge(i, 22, [1, 1, 0, 1, 1], N):
        Hm.setze(k, OHR_R_RUNTER, OFF)
    if Hm.folge(i, 8, [1, 1, 1], N):
        Hm.setze(k, OHR_L_RUNTER, OFF)
    # Haare im Wind: zwei Böen (Start 10 und 30); Locke → Strähne Zeile 14 → Strähnenspitze Zeile 15, je 2 Frames später
    for start in (10, 30):
        if Hm.takt(i, N, start, 5):
            Hm.setze(k, SPITZE_R, OFF)
        if Hm.takt(i, N, start + 2, 5):
            Hm.setze(k, STRAEHNE_14, OFF)
        if Hm.takt(i, N, start + 4, 5):
            Hm.setze(k, STRAEHNE_15, OFF)
    if Hm.takt(i, N, 19, 3) or Hm.takt(i, N, 36, 3):           # linke Lockenspitze schlägt zweimal kurz nach innen
        Hm.setze(k, SPITZE_L, OFF)
    # Haarglanz: ein heller Punkt wandert über (5..12, 5)
    g = Hm.folge(i, 2, list(range(8)), N)
    if g is not None:
        Hm.setze(k, {(5 + g, 5): HELLGELB}, OFF)
    # Pfeilspitze: die weiße Kante gleitet eine Diagonale tiefer (2 Stufen), davor/danach ein Funkeln darüber
    w = Hm.folge(i, 30, [0, 1, 2, 1, 0], N)
    if w:
        Hm.setze(k, {**{p: HELLBLAU for p in PFEIL_D1}, **{p: (WEISS if w == 1 else HELLBLAU) for p in PFEIL_D2},
                     **{p: (WEISS if w == 2 else HELLBLAU) for p in PFEIL_D3}}, OFF)
    s = Hm.folge(i, 27, [1, 2, 2, 1], N)
    if s:
        Hm.klecks(k, 17, -3 if s == 2 else -2, s, WEISS, HELLBLAU, OFF)     # schwebt frei, 1 px Abstand zur Spitze
    # --- Atmen ---
    brust = Hm.stufe(i, N, 1)
    k = Hm.atmen(k, PAD_T + 18, PAD_T + 14, brust, 0)          # Kopf hebt sich höchstens 1 px (mit der Brust)
    if brust:
        # Unter der Hand (x 5–7) soll nicht der dunkle Handumriss (Zeile 18) doppelt stehen, sondern der Saum (Zeile 19) —
        # die eingefügte Zeile 18 wird dort mit der Zeile 19 überschrieben (Hand bleibt einfach hoch, Umriss einfach dick).
        k[PAD_T + 18, PAD_L + 5:PAD_L + 8] = k[PAD_T + 19, PAD_L + 5:PAD_L + 8]
    return L.zusammen(H, W, [(k, 0, 0), (b, 0, 0)])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('elven-archer', 'Elven Archer', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/elven-archer-strip.png', frames, spalten=10, scale=6)
