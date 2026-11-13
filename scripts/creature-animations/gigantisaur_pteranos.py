# -*- coding: utf-8 -*-
"""Idle-Animation für „Gigantisaur Pteranos“ (Creature) — Regeln 14/15/16 (Fleisch/Haut/Knochen: kein Metall, kein Feuer → kein Glanz, keine Funken).

PICK: [["MotiveGrailWar", 239, 1]] + Kopf, Haube und Flügel aus der Kartenkunst (siehe Quelle)
Quelle: src/gigantisaur-pteranos.png — der ganze Flugsaurier (73×49 px, 14 Farben), zusammengesetzt aus zwei Teilen:
* Körper mit Schnabel, Rumpf und Füßen = Ebene 239 („Ebene #276“) aus MotiveGrailWar.xcf, 52×20 px (Original als src/gigantisaur-pteranos-ebene239.png abgelegt), sitzt bei Kartenposition (1,29);
  in der Kartenkunst pixelgenau wiedergefunden (Farbabstand ≈ 5 = Kartenrauschen).
* Kopf mit Haube und Horn sowie der große Flügel (rechts oben, bis zum Kartenrand) stehen in KEINER xcf-Ebene (alle 748 Ebenen von MotiveGrailWar und alle anderen Dateien nach den Farben durchsucht: keine Treffer) — sie wurden
  aus der Kartenkunst herausgelöst: Pixel mit dunklem Umriss (≈(25,4,3)) oder rosabrauner Füllung (G − B ≤ 30, R ≥ 45) im oberen Teil (y ≤ 31), Komponenten ≥ 10 px, jedes Pixel auf die nächste Palettenfarbe
  der Figur gerastet: (25,4,3)/(77,46,43)/(57,27,25)/(111,67,66)/(122,84,73) stammen aus Ebene 239, dazu aus der Kunst die Haut-Lichtfarbe (151,100,81) und die Augenfarben (158,82,80)/(86,14,12) (bei der Prüfung `erlaubt`:
  Farben der Kartenkunst). Danach: Löcher gefüllt (5 px), 3 verstreute Pixel entfernt, die Flügelspitze am Kartenrand mit zwei Umrisspixeln (71–72, 0) geschlossen.

RUNDE 6 (Nutzer: „Funktioniert so leider einfach nicht, der Flügelschlag klappt nicht. Ändere seine Idle-Animation zu einem Gleitflug, bei dem die Flügel nur ganz leicht bewegt werden und sich der komplette
Sprite etwas bewegt.“): Skript schlank neu geschrieben — KEIN Flügelschlag mehr, keine neu gezeichneten Flügel. Beide Flügel bestehen in jedem Frame aus den ORIGINALPIXELN der Quelle.

Aufruf:   python3 gigantisaur_pteranos.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gigantisaur-pteranos.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Kopf (x 12–28, y 10–30) mit dunklem Horn (x 21–26, y 11–22), rotem Auge (22–23, 22–24); heller Schnabel mit zwei Zinken nach links unten (x 0–22, y 26–41).
* Ferner Flügel: das rosabraune Blatt links hinter dem Kopf (x 13–19, y 11–26) — nur seine Spitze schaut hervor.
* Naher Flügel: langer schmaler Flügel nach rechts oben (x 39–72, y 0–33) mit Flügelkralle an der Vorderkante (x 58–62, y 5–10); Ansatz am Rücken.
* Rumpf (x 22–45, y 28–48) mit hellgrauem Bauchstreifen, Füße/Schwanzansatz rechts unten (x 38–51, y 40–48).

Ablauf (64 Frames à 80 ms = 5,12 s; schweres Tier → langsam):
* Gleiten: der KOMPLETTE Sprite fährt eine weiche liegende Acht — auf/ab ±2 px (Sinus, Periode 32 Frames = 2,56 s), seitliches Driften ±2 px (Sinus, Periode 64 Frames); je Frame höchstens 1 px Schritt.
* Naher Flügel: federt ganz leicht, die Spitze ±1 px. Kein Umtasten: nach unten rücken die Spalten ab einer Biegestelle um 1 px nach unten, nach oben rücken die Zeilen oberhalb der Biegestelle um 1 px nach links
  (bei dem 45°-Flügel bleiben so beide Umrisslinien lückenlos und 1 px dick). Die Biegestelle wandert weich von der Spitze (äußeres Drittel) zur Flügelmitte und zurück; die innere Hälfte bis zum Körperansatz
  bleibt fest → keine Knicke, keine Lücken. Im Takt des Auf/Ab mit 1 Frame Nachlauf: liegt der Körper tief, stehen die Spitzen oben; liegt er hoch, hängen sie.
* Ferner Flügel: seine Spitze (Zeilen y ≤ 16) wiegt im selben Takt ±1 px seitlich (gegenläufig zum nahen: beide Spitzen heben/senken sich gemeinsam).
* Blinzeln: das Auge schließt sich für 3 Frames (Lid = Kopffarbe (111,67,66)).
* Entfallen gegenüber Runde 5: Flügelschlag, wippendes Horn, pendelnde Füße (Gleitflug: der Körper ist ruhig). Kein Glanz, keine Partikel.
Frame 0 = Quelle (unverschoben). Nur ganze Pixel, nur Farben der Quelle (drei davon stammen aus der Kartenkunst), Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L

N, MS = 64, 80
PAD = 6                                                        # Arbeitsleinwand (am Ende auf die Figur zugeschnitten)

spr = L.lade('gigantisaur-pteranos')
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

KOPF = (111, 67, 66)                                           # Kopffarbe (Lid)
AUGEN_FARBEN = [(158, 82, 80), (86, 14, 12)]
KUNST_FARBEN = [(151, 100, 81), (158, 82, 80), (86, 14, 12)]   # nur in der Kartenkunst (nicht in Ebene 239)
m_auge = vorhanden & L.farbmaske(spr, AUGEN_FARBEN)
assert int(m_auge.sum()) == 3, int(m_auge.sum())
m_nah = vorhanden & (xx >= 39) & (yy <= 34)                    # naher Flügel (Füße liegen bei y ≥ 40)
m_fern = vorhanden & (xx <= 19) & (yy <= 26)                   # Spitze des fernen Flügels (Blatt hinter dem Kopf)
BLINZ = {40, 41, 42}
# Biegestellen des nahen Flügels: Stufe 1 = äußeres Drittel, Stufe 2 = äußere Hälfte. Abwärts: Spalten x ≥ X_BIEG rücken 1 px nach unten; aufwärts: Zeilen y ≤ Y_BIEG rücken 1 px nach links.
X_BIEG = {1: 63, 2: 55}
Y_BIEG = {1: 4, 2: 15}
Y_FERN = {1: 14, 2: 17}                                        # ferner Flügel: Zeilen y ≤ … rücken 1 px seitlich


def stufe(i):
    """Flügelstellung −2 … +2 (+ = Spitze oben): weicher Sinus im Takt des Auf/Ab, 1 Frame Nachlauf (Frame 0 = Ruhe)."""
    s = math.sin(L.sinus(i - 1, N / 2))                        # > 0, solange der Körper tief liegt → die Spitzen stehen dann oben, liegt er hoch, hängen sie
    return 0 if abs(s) < 0.3 else int(math.copysign(1 if abs(s) < 0.75 else 2, s))


def frame(i, partikel=True, effekte=True):
    st = stufe(i)
    a = spr.copy()
    if effekte and i in BLINZ:
        a[m_auge, :3] = KOPF
    rest = a.copy()
    teile = []
    if st:
        k = abs(st)
        # naher Flügel
        m = m_nah & ((xx >= X_BIEG[k]) if st < 0 else (yy <= Y_BIEG[k]))
        t, rest = L.trenne(rest, m)
        teile.append((L.platz(t, H, W, PAD, PAD), 0, 1) if st < 0 else (L.platz(t, H, W, PAD, PAD), -1, 0))
        # ferner Flügel: Spitze nach links (unten/außen) bzw. rechts (oben/innen)
        m = m_fern & (yy <= Y_FERN[k])
        t, rest = L.trenne(rest, m)
        teile.append((L.platz(t, H, W, PAD, PAD), -1 if st < 0 else 1, 0))
    f = L.zusammen(H, W, [(L.platz(rest, H, W, PAD, PAD), 0, 0)] + teile)
    dy = int(round(2 * math.sin(L.sinus(i, N / 2))))            # auf/ab (+ = nach unten)
    dx = int(round(2 * math.sin(L.sinus(i, N))))                # seitliches Driften
    return L.versetze(f, dx, dy)


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    return [f[ys.min() - rand:ys.max() + rand + 1, xs.min() - rand:xs.max() + rand + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = zuschneiden([frame(i) for i in range(N)])
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=KUNST_FARBEN)
    print('Pixel je Frame:', n)
    L.speichern('gigantisaur-pteranos', 'Gigantisaur Pteranos', frames, MS, prev)
    if prev:
        L.streifen(prev + '/gigantisaur-pteranos-strip.png', frames, spalten=8, scale=4)
