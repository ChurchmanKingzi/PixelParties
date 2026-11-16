# -*- coding: utf-8 -*-
"""Idle-Animation für „Gerrymander“ (Creature) — der grüne Salamander, der (von oben gesehen) mit gespreizten Beinen an der Holzwand klebt und züngelt.

Quelle: src/gerrymander.png (32×21 px, 6 Farben).
PICK: [["MotiveGrailWar", 277, 1]]     (Ebene „Gerrymander“, Figur 1; 100 % Treffer, nur in dieser Karte; vollständig. Ebene 284 „Ebene #239“ ist die Holzwand = Kulisse.)

Aufruf:   python3 gerrymander.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/gerrymander.png + .json

Was im Sprite ist (x, y im 32×21-Sprite; der Kopf zeigt nach RECHTS):
* SCHWANZ (x 0–11, y 9–14): läuft nach links dünn aus, Spitze bei (0–3, 12).
* RUMPF (x 12–22, y 8–12): grün (110,141,107)/(87,112,83) mit hellen Rückenflecken (177,200,174) in zwei Reihen (y 9 und y 11).
* VIER BEINE: vorn (x 19–27) nach oben (y 0–8) und unten (y 12–20), hinten (x 10–17) ebenso; je zwei Zehen an den Enden. Sie kleben an der Wand → bleiben völlig fest.
* KOPF (x 23–27, y 8–12) mit zwei gelben AUGEN (251,213,44) bei (26,9) und (26,11).
* ZUNGE (199,93,80): (28–29,10), (30,11), (31,12–13) – hängt aus dem Maul und biegt nach unten.
Kein Metall → kein Glanz. Keine Partikel.

Idee: Der Salamander klebt reglos an der Wand – nur die ZUNGE schnellt immer wieder heraus (züngeln) und der SCHWANZ schlängelt träge.
Ablauf (60 Frames à 70 ms = 4,2 s, nahtlos):
* Züngeln (zweimal je Schleife, ab Frame 8 und ab Frame 38): Zunge zieht sich ein (nur noch (28,10)) → weg → schnellt gerade heraus (28–31,10) → biegt nach oben ((30,9), (31,8), (31,7)) → gerade → zurück
  in die Ruheform (Original, nach unten gebogen). Die Zunge wird in jeder Pose als Ganzes neu gesetzt (nur Zungenfarbe), nie gedehnt.
* Schwanz (x ≤ 11): schlängelt als laufende Welle senkrecht (L.spalten_welle, Gelenk am Rumpf x 12, Ausschlag ±2 px an der Spitze, Periode 30, Gefälle ≤ 1 px je Spalte) – der Ansatz am Rumpf bleibt stehen.
* Blinzeln (Frames 24–26 und 54–56): beide Augen nehmen das Kopfgrün (110,141,107) an.
Frame 0 = Original. Ergänzungen: keine.

RUNDE 8 (Nutzer: „Sollte mit allen vier Pfoten hin und her laufen“): Der Salamander LÄUFT jetzt wirklich – 12 px vorwärts (Frames 0–23), kurzer Halt (24–29), 12 px rückwärts (30–53), Halt (54–59); der ganze
Sprite verschiebt sich dabei (1 px je 2 Frames). Die vier Beine gehen im Wechselschritt der diagonalen Paare (vorn-oben + hinten-unten gegen vorn-unten + hinten-oben) als fünf saubere Posen je Bein: der Fuß
steht −2 … +2 px hinter/vor dem Ansatz (die Pfote mit den Zehen geht als starrer Block mit, nur die drei Oberschenkelzeilen stufen sich ab, Gefälle ≤ 1 px je Zeile; nichts wird gestreckt). Ein Paar steht jeweils am Boden – seine Füße
bleiben in der Welt genau stehen, während der Rumpf darüber weiterzieht –, das andere Paar schwingt mit doppelter Geschwindigkeit nach vorn (Schrittlänge 4 px, ein Zyklus = 8 px = 16 Frames). In den Halten
stehen alle Beine wieder wie im Original. Schwanz (schlängelt), Zunge und Blinzeln unverändert, sie wandern mit. Die Leinwand ist rechts um den Laufweg breiter.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L
import anim_n3 as N3
import anim_n4 as N4

N, MS = 60, 70
WEG = 12                                                       # Laufweg in Pixeln (nach rechts und zurück)
G = N4.Figur('gerrymander', 2, 2 + WEG, 2, 2)
spr, H, W, OFF = G.spr, G.H, G.W, G.OFF
f = G.f
GRUEN, ZUNGE_F, SCHWARZ = f(25, 10), f(28, 10), (0, 0, 0)
zunge = L.farbmaske(spr, [ZUNGE_F])
schwanz = G.da & (G.xx <= 11)
# Runde 8: vier Beine als eigene Ebenen (oben: Zeilen 0–7, unten: Zeilen 13–20; vorn x ≥ 19, hinten x 9–18); Ansatzzeilen 8 und 12 gehören zum Rumpf
BEINE = {'vo': G.da & (G.yy <= 7) & (G.xx >= 19), 'ho': G.da & (G.yy <= 7) & (G.xx <= 18),
         'vu': G.da & (G.yy >= 13) & (G.xx >= 19) & ~zunge, 'hu': G.da & (G.yy >= 13) & (G.xx >= 9) & (G.xx <= 18)}
PAAR = {'vo': 1, 'hu': 1, 'vu': -1, 'ho': -1}                  # diagonale Paare gehen gegengleich
bein_alle = BEINE['vo'] | BEINE['ho'] | BEINE['vu'] | BEINE['hu']
rumpf = G.da & ~zunge & ~schwanz & ~bein_alle


def weg(i):
    """Zurückgelegter Weg des Rumpfs in px: 0 → 12 (Frames 0–23), Halt, 12 → 0 (Frames 30–53), Halt."""
    if i < 24:
        return (i + 1) // 2
    if i < 30:
        return WEG
    if i < 54:
        return WEG - (i - 30 + 1) // 2
    return 0


def fuss(s_):
    """Fußversatz des Paars +1 gegenüber dem Ansatz beim Weg s_ (Paar −1: Vorzeichen umgekehrt): Stand = Fuß bleibt in der Welt stehen (Versatz sinkt 1:1 mit dem Weg), Schwung = Fuß holt nach vorn auf."""
    t = s_ % 8
    return -t if t <= 2 else (t - 4 if t <= 6 else 8 - t)


def bein(name, v):
    """Beinpose: der FUSS (Pfote mit Zehen, ab 4 Zeilen vom Ansatz) geht als starrer Block um v px mit; nur die Zeilen des Oberschenkels dazwischen stufen sich ab
    (zwei Ansatzzeilen 0, dann ±1, Fuß v) – nichts wird gestreckt, jede Zeile bleibt, wie sie ist."""
    a = G.ebene(BEINE[name])
    if not v:
        return a
    sg, out = (1 if v > 0 else -1), L.leer(H, W)
    for y in range(H):
        d = (G.PT + 8 - y) if name[1] == 'o' else (y - (G.PT + 12))
        if d < 1 or not a[y, :, 3].any():
            continue
        dx = 0 if d <= 2 else (sg if d == 3 else v)
        out[y] = np.roll(a[y], dx, axis=0)
    return out


ZUNGE = {
    'ruhe': [(28, 10), (29, 10), (30, 11), (31, 12), (31, 13)],
    'kurz': [(28, 10)],
    'weg': [],
    'gerade': [(28, 10), (29, 10), (30, 10), (31, 10)],
    'hoch': [(28, 10), (29, 10), (30, 9), (31, 8), (31, 7)],
}
FLICK = ['kurz', 'weg', 'weg', 'gerade', 'gerade', 'hoch', 'hoch', 'gerade', 'kurz', 'gerade', 'hoch', 'hoch', 'gerade']


def umranden(a):
    """Kontur nach der Bein-Scherung schließen, ohne die schmale grüne Füllung zu schwärzen: liegt ein Füllpixel frei an der Außenkante, bekommt der freie Nachbar die Umrissfarbe
    (die Kontur läuft dort eine Stufe weiter, wie bei jeder steileren Pixel-Diagonale)."""
    da = a[..., 3] > 0
    innen = da & ~((a[..., :3] == SCHWARZ).all(-1)) & ~((a[..., :3] == ZUNGE_F).all(-1))
    neu = np.zeros_like(da)
    neu[1:, :] |= innen[:-1, :]; neu[:-1, :] |= innen[1:, :]; neu[:, 1:] |= innen[:, :-1]; neu[:, :-1] |= innen[:, 1:]
    neu &= ~da
    a[neu, :3] = SCHWARZ
    a[neu, 3] = 255
    lo = N3.loecher(a)                                           # von der verschobenen Pfote eingeschlossene Einzelpixel (Kerbe zwischen Zeh und Schenkel) schließen sich zur Kontur
    a[lo, :3] = SCHWARZ
    a[lo, 3] = 255
    return a


def frame(i):
    k = G.ebene(rumpf)
    if Hm.folge(i, 24, [1] * 3, N) or Hm.folge(i, 54, [1] * 3, N):
        Hm.setze(k, {(26, 9): GRUEN, (26, 11): GRUEN}, OFF)
    z = Hm.folge(i, 8, FLICK, N) or Hm.folge(i, 38, FLICK, N) or 'ruhe'
    Hm.setze(k, {p: ZUNGE_F for p in ZUNGE[z]}, OFF)
    s = G.ebene(schwanz)
    env = math.sin(math.pi * i / N) ** 2                           # Frame 0 = Ruhe
    s = L.spalten_welle(s, G.PL + 12, 2.2 * min(1.0, 3 * env), L.sinus(i, N / 2), potenz=1.3, lauf=1.6)
    w_ = weg(i)
    v = fuss(w_)
    beine = [(bein(nm, v * PAAR[nm]), 0, 0) for nm in ('ho', 'hu', 'vo', 'vu')]
    fig = L.zusammen(H, W, [(s, 0, 0)] + beine + [(k, 0, 0)])
    return L.versetze(umranden(fig), w_, 0)


if __name__ == '__main__':
    N4.abschluss(G, 'Gerrymander', [frame(i) for i in range(N)], MS, sys.argv, scale=5)
