# -*- coding: utf-8 -*-
"""Idle-Animation für „Slippery Whoolmoth“ (Creature) — Wollmammut, KEIN Falter (Regeln 14/16).

PICK: [["Motive", 791, 1]]
Quelle: src/slippery-whoolmoth.png — Ebene „Ebene #367“ (67×45 px, 16 Farben) aus Motive.xcf, Figur 1: vollständiges, deckendes Mammut in Seitenansicht.
Die Kartenkunst verwendet die Schwesterebene 792 („Whoolmoth“, gleiche Figur, gleiche Lage, aber mit gedithertem Fell und einem WEICHEN Tempo-Schweif
(Alphaverlauf) am Hinterteil); der Schweif ist nicht als Pixelart darstellbar (Alpha nur 0/255), deshalb ist die deckende Ebene 791 die Quelle.

Aufruf:   python3 slippery_whoolmoth.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/slippery-whoolmoth.png + .json

Identifikation (Sprite-Koordinaten x, y):
* Kopf (x 12–31, y 0–31): nach links gewandt; Stirn-/Rüsselstreifen heller (E/F) bei x 17–22, y 3–20; Auge (23–25, 9–11): 2×2 Schwarz + Glanzpunkt (23,9), Lidschatten (25,9–10),
  (23–24,11); fernes Auge nur 1 px breit am Kopfrand (16, 9–11). Die dunkle Diagonale G/B/D (x 31 → 26, y 3–20) ist die Nackenfalte zwischen Kopf und Körper.
* Rüssel (x 11–17, y 22–44): hängt vor der Brust, dunkelbraun (B), unten Spitze mit Nüstern-Pixel (15,42). Zwischen y 27 und 35 liegt der VORDERE Stoßzahn
  vor ihm (V-Form: lange Diagonale von (7,20) nach (21,34), senkrechter Arm bei x 21–24, y 24–33).
* Stoßzähne (Elfenbein J/K/L, Umriss C): vorderer V-Zahn und hinterer U-Zahn (x 0–11, y 20–35, Spitze bei (1,20), Boden y 34–35) — starr am Kopf.
* Körper (x 26–66, y 2–31): Höcker, Rückenlinie, helle Fellbänder (E/F) von (30,3) bis (62,20), Bauch dunkler (D/B/H), senkrechte Haarsträhnen (G).
* Beine: vorn x 28–38 (nah/fern, y 22–44), hinten x 50–65 (y 27–43) mit dunklen Füßen (I/M); Schwanz x 62–66, y 27–33 (hängt am Hinterteil).

Ablauf (48 Frames à 70 ms = 3,36 s):
* ATMEN (zweistufig, 2× pro Schleife, Periode 24): Kopf, Rüsselansatz und Rumpf heben sich um 0 → 1 → 2 px und senken sich wieder; die Füße bleiben am Boden (am Rumpf wird in Zeile 37
  eine Zeile verdoppelt, die Beine werden länger), der Rüssel hebt sich starr mit dem Kopf mit.
* RÜCKENWELLE: auf dem Rücken (x ≥ 35) läuft pro Atemzug eine Welle von der Schulter zur Kruppe, die die Rückenlinie spaltenweise um 1 px hebt (je Spalte eine Zeile 12 verdoppelt;
  Fell „atmet“ nacheinander). Der Rumpf steigt nur relativ zum Kopf (nie darunter) → hinter der Nackenfalte entsteht keine Lücke.
* RÜSSEL: der untere Rüssel (ab Zeile 36, unterhalb der Stoßzähne) pendelt einmal pro Schleife um ±3 px (Wurzel fest, Spitze hinkt nach, je tiefer desto weiter); die Stoßzähne bleiben
  starr am Kopf (der Rüssel liegt dort hinter ihnen und bleibt oberhalb von Zeile 36 fest).
* SCHWANZ: schlägt 2× pro Schleife nach hinten aus (0 … +2 px an der Spitze, Wurzel am Hinterteil fest, Spitze hinkt nach) — nur nach außen, damit er nicht in das Hinterbein fährt.
* FUSSWECHSEL: der nahe Vorderfuß hebt sich einmal pro Schleife (Frames 20–31) um bis 2 px und setzt wieder auf (am Schaft werden 1–2 Zeilen entnommen, der Fuß rückt starr nach oben).
* BLINZELN (Frames 33–34): Auge schließt sich (Lid-Hautfarbe über dem Auge, dunkle Lidlinie), fernes Auge ebenso.
* ATEMWÖLKCHEN: zwei kleine, runde, hellgraue Wölkchen steigen mit jedem Ausatmen an der Rüsselspitze auf und lösen sich nach links oben auf (Form m → s → k; keine Kreuze).
  Kein Glanz/Glitzer (Elfenbein ist kein Metall).
Rest = Original: Frame 0 ist das unveränderte Sprite (alle Bewegungen sind auf die Ruhepose bezogen).

Ergänzungen: keine nötig. Der Rüssel liegt vor der Brust, ändert aber nur unterhalb der Stoßzähne die Lage; alles Verdeckte bleibt verdeckt.
Randpixel-Test (Regel 16): Zeilenversatz (Rüssel, Schwanz) und Spaltendopplung (Rückenwelle) lassen die Umrissfarbe an den Rändern; F.umranden prüft zusätzlich jedes Frame.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 9, 9, 8, 4

spr = L.lade('slippery-whoolmoth')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

UMRISS = F.umriss_farben(spr)
C_ = (34, 21, 20)          # Umriss
A_ = (125, 70, 52)         # Fell (Haut)
O_ = (85, 65, 61)          # Lidschatten
NEBEL = {'c': (234, 231, 230), 'r': (141, 125, 120)}

X_SPLIT = 25               # links: Kopf/Rüssel/Stoßzähne, rechts: Rumpf/Beine
Y_RUESSEL = 36             # ab hier (unterhalb der Stoßzähne) pendelt der Rüssel
Y_STRECK = 37              # hier werden die Beine beim Atmen gestreckt
Y_WELLE = 12               # hier wird die Rückenlinie spaltenweise gedoppelt
X_WELLE0 = 35              # Rückenwelle ab dieser Spalte
SCHWANZ_X, SCHWANZ_Y = 62, 27

m_ruessel = vorhanden & (xx < X_SPLIT) & (yy >= Y_RUESSEL)
m_links = vorhanden & (xx < X_SPLIT) & ~m_ruessel
m_schwanz = vorhanden & (xx >= SCHWANZ_X) & (yy >= SCHWANZ_Y) & (yy <= 33)
m_rechts = vorhanden & (xx >= X_SPLIT) & ~m_schwanz


def lay(m):
    return F.ebene(spr, m, H, W, PAD_L, PAD_T)


def atem(i):
    """Atemkurve 0…1 (2× pro Schleife, Einatmen etwas langsamer als Ausatmen); Frame 0 = 0 (Ruhe)."""
    ph = 2 * math.pi * i / (N / 2)
    ph = ph + 0.35 * math.sin(ph)
    return (1 - math.cos(ph)) / 2


def welle_an(i, x):
    """Rückenwelle: 1 = Spalte x ist zum Frame i um 1 px angehoben. Läuft pro Atemzug von der Schulter zur Kruppe."""
    ph = 2 * math.pi * i / (N / 2) - 0.085 * (x - X_WELLE0)
    return 1 if (1 - math.cos(ph)) / 2 > 0.58 else 0


FUSS_X0, FUSS_X1 = 32, 39      # nahes Vorderbein (x 32–38; die Haarlinie G bei x 32 gehört zum nahen Bein)


def fuss_hub(i):
    """Fußhebung 0 … 2 px: Gewichtsverlagerung des nahen Vorderfußes, Frames 20–31 (sonst 0; Frame 0 = Ruhe)."""
    if not 20 <= i < 32:
        return 0
    return int(round(2 * math.sin(math.pi * (i - 20) / 12) ** 2 + 1e-9))


def rueckenwelle(a, i):
    out = a.copy()
    for x in range(PAD_L + X_WELLE0, W):
        if not a[PAD_T + Y_WELLE, x, 3]:
            continue
        w = welle_an(i, x - PAD_L) - welle_an(0, x - PAD_L)             # relativ zur Ruhepose (Frame 0 = Original)
        if w:
            out[:, x:x + 1] = L.streck_zeile(a[:, x:x + 1], PAD_T + Y_WELLE, w)
    return out


def frame(i, partikel=True):
    ph = 2 * math.pi * i / N
    k1 = int(round(2 * atem(i)))                                        # 0 → 1 → 2 → 1 → 0 (zweistufig)

    ln = lay(m_links)
    ru = lay(m_ruessel)
    re = lay(m_rechts)
    sw_ = lay(m_schwanz)

    # Blinzeln: Auge schließt sich (nur vorhandene Farben)
    if i in (33, 34):
        F.setze(ln, PAD_L, PAD_T, {(23, 9): A_, (24, 9): A_, (23, 10): C_, (24, 10): C_, (16, 9): A_, (16, 10): C_})

    # Rüssel pendelt (Wurzel fest, Spitze hinkt nach), Schwanz schlägt nach außen aus
    ru = F.zeilen_pendel(ru, PAD_T + Y_RUESSEL - 1, 3.8, ph, potenz=1.1, lauf=0.9)
    sw_ = F.zeilen_pendel(sw_, PAD_T + SCHWANZ_Y - 1, 2.8, 2 * math.pi * i / (N / 2), potenz=1.0, lauf=0.8, einseitig=True)

    # Rücken atmet in einer Welle, Beine strecken sich beim Atmen, Kopf-Gruppe hebt sich starr mit
    rumpf = L.zusammen(H, W, [(re, 0, 0), (sw_, 0, 0)])
    rumpf = rueckenwelle(rumpf, i)
    kf = fuss_hub(i)                                                    # der vordere (nahe) Fuß hebt sich einmal pro Schleife
    if kf:
        x0, x1 = PAD_L + FUSS_X0, PAD_L + FUSS_X1
        rumpf[:, x0:x1] = L.heben_unten(rumpf[:, x0:x1], PAD_T + Y_STRECK, kf)
    rumpf = L.streck_zeile(rumpf, PAD_T + Y_STRECK, k1)
    kopf = L.versetze(L.zusammen(H, W, [(ln, 0, 0), (ru, 0, 0)]), 0, -k1)

    f = L.zusammen(H, W, [(rumpf, 0, 0), (kopf, 0, 0)])
    F.umranden(f, [rumpf, kopf], UMRISS, C_, C_, C_)                    # Randpixel-Test (Regel 16)
    if partikel:
        nebel = L.puff_ebene(H, W, i, N, PUFFS, NEBEL)
        f = L.zusammen(H, W, [(nebel, 0, 0), (f, 0, 0)])
    return f


# Atemwölkchen an der Rüsselspitze (Ruhelage x 13–15, y 43): steigen links hoch, zwei pro Schleife, Start beim Ausatmen (Atemspitze bei Frame 12 und 36)
PUFFS = [dict(x=PAD_L + 11, y=PAD_T + 42, vx=-5, vy=-7, off=(N - 12) % N, form='o', wackeln=1),
         dict(x=PAD_L + 11, y=PAD_T + 42, vx=-5, vy=-7, off=(N - 36) % N, form='o', wackeln=1)]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('slippery-whoolmoth', 'Slippery Whoolmoth', frames, MS, prev)
    if prev:
        L.streifen(prev + '/slippery-whoolmoth-strip.png', frames, spalten=8, scale=4)
