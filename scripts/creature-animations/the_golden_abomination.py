# -*- coding: utf-8 -*-
"""Idle-Animation für „The Golden Abomination“ (Creature) — unförmiges Wesen aus massivem Gold, funkelt.

PICK: [["Motive", 888, "Ebene „Golden Abomination“, deckende Pixel im Ausschnitt x 108–147, y 198–225 (Figur 1)"]]
Die Ebene ist leinwandgroß; außer der Figur enthält sie nur einen halbtransparenten Schleier (Alpha 102, weggelassen) und den Entdecker mit rotem „!“ (Figur 2, gehört nicht dazu).
In der Kartenkunst (The_Golden_Abomination.png) ist die Figur gelblich überblendet (Treffer „getönt“), Form und Lage stimmen.
  src/the-golden-abomination.png           Original (mit den 9 weißen Funkelsternen der Kunst) – Referenz
  src/the-golden-abomination-koerper.png   ohne Sterne; die 30 Pixel, an denen ein Stern über dem Gold lag, sind mit der Farbe des Nachbarpixels gefüllt (Ergänzung, s. u.)

Identifikation (40×28): alles Gold in Gelb-/Orange-/Brauntönen (211 leicht verrauschte Farben). Runder Klumpen links (x 0–9, y 6–16), Rumpf (x 10–25) mit Höcker oben (x 15–23, y 0–5),
Ring/Öse rechts oben (x 26–37, y 4–12), zwei Beinstümpfe (x 8–17, y 17–25 und x 24–36, y 12–27). Rechts hängt der KOPF herab (Runde 8, Angabe des Nutzers): das eine AUGE = 2×2
dunkle Pupille (x 32–33, y 13–14) mit je einer Spalte rosa/roter Pixel außen daneben (x 31 und x 34, y 13–14); darunter das offene MAUL (x 31–34, y 15–21): dunkelbrauner Lippenrahmen
(Zeile 15, Spalte 31, Zeile 21), helle Zähne (32, 16|17|19|20), dunkler Schlund (x 33–34), rote Zunge (33,20). Weiße Kreuze/Rauten = Funkelsterne der Kunst.

Ablauf (64 Frames à 80 ms = 5,1 s, schweres Wesen → langsam). Frame 0 = Original ohne die Sterne (die Sterne blitzen jetzt einzeln auf):
* Rumpf atmet (Periode 32): in den Spalten x 10–25 wird bei y 12 eine texturierte Zeile eingefügt (TX.streck_zeile), Höcker und Rücken heben sich 1 px; Beine, Ring bleiben stehen.
* Der runde Klumpen links wippt starr ±1 px (Periode 32, versetzt) – er bleibt an der Nahtspalte x 10 angewachsen.
* Gold-Lichtband: zweimal pro Schleife läuft ein schmales diagonales Band über die gelben Flächen (eine Stufe heller, Farben (224,212,79)/(224,216,124) der Quelle).
* Sparkles (Gold → erlaubt): die neun Sterne der Kunst blitzen nacheinander je einmal pro Schleife kurz auf (Punkt → Kreuz → großes Kreuz → zurück, 6 Frames), sonst aus.
* Auge blinzelt (Frames 6–8 und 44–46: halb zu, zu, halb zu): das Lid in der Hautfarbe (177,88,38) senkt sich über Pupille UND die rosa Spalten, geschlossen bleibt eine Lidlinie
  im Rotbraun (131,65,38) des Augenrands. Nur die acht Augenpixel ändern sich.
* Maul schließt und öffnet sich langsam (Frames 14–37: zu in 3 Stufen à 3 Frames, 8 Frames geschlossen, wieder auf): Ober- und Unterlippe (dunkler Rahmen) wandern aufeinander zu,
  frei werdende Zeilen bekommen Hautfarbe ((176,88,37) am Rand, (209,124,61) innen), Zähne/Schlund/Zunge verschwinden; geschlossen bleibt die Lippenlinie in Zeile 18.
  Die Silhouette ändert sich nicht (alles innerhalb x 31–34, y 15–21).
Ergänzungen: 30 Pixel unter den Sternen (Liste: FILL im Skript), Farbe = Nachbarpixel.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n7 as N7

N, MS = 64, 80
sz = N7.Szene('the-golden-abomination-koerper', (3, 4, 4, 3))
spr = sz.spr
quelle = L.lade('the-golden-abomination')
xx, yy = sz.xx, sz.yy
FILL = [(4, 6), (4, 8), (5, 7), (6, 6), (6, 8), (8, 21), (8, 22), (9, 20), (10, 20), (17, 2), (17, 4), (17, 20), (18, 3), (19, 2), (19, 4), (21, 11), (22, 11), (23, 9), (23, 10),
        (23, 12), (23, 13), (24, 11), (25, 11), (26, 23), (27, 22), (27, 24), (34, 5), (35, 4), (35, 6), (36, 5)]
KLUMPEN = sz.teil(xx <= 9)
RUMPF = sz.teil((xx >= 10) & (xx <= 25))
HAUT, HAUT_H, LIPPE, LIDLINIE = (176, 88, 37), (209, 124, 61), (106, 64, 39), (131, 65, 38)
LID = (177, 88, 38)
ZAHN, SCHLUND1, SCHLUND2 = (169, 167, 140), (102, 70, 43), (86, 66, 40)


def kopf(i):
    """Sprite mit Blinzeln und Maulstellung (nur x 31–34, y 13–21)."""
    a = spr
    b = N7.funkel_folge(i, N, 6, (1, 2, 1)) or N7.funkel_folge(i, N, 44, (1, 2, 1))
    k = (i - 14) % N
    m = (1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1)[k] if k < 23 else 0
    if not (b or m):
        return a
    a = a.copy()

    def px(x, y, c):
        if a[y, x, 3]:
            a[y, x, :3] = c
    if b:
        for x in range(31, 35):
            px(x, 13, LID)
            if b == 2:
                px(x, 14, LIDLINIE)
    if m:
        oben, unten = {1: (16, 20), 2: (17, 19), 3: (18, 18)}[m]
        for y in range(15, 22):
            for x in range(31, 35):
                if y in (oben, unten):
                    c = LIPPE
                elif y < oben or y > unten:
                    c = HAUT if (y in (15, 21) or x == 34) else HAUT_H
                elif x == 31:
                    c = LIPPE
                elif x == 32:
                    c = ZAHN
                else:
                    c = SCHLUND1 if y != 18 else SCHLUND2
                px(x, y, c)
    return a


def rechts(i):
    return sz.teil(xx >= 26, kopf(i))


RECHTS = sz.teil(xx >= 26)
WEISS = (255, 255, 255)
HELL1, HELL2 = (224, 212, 79), (224, 216, 124)
# Stern: (x, y, größte Stufe, Teil, Startframe)
STERNE = [(11, 3, 2, 'r', 0), (18, 3, 2, 'r', 7), (5, 7, 2, 'k', 14), (23, 11, 3, 'r', 21), (35, 5, 2, '', 28), (37, 17, 3, '', 35), (8, 20, 3, '', 42), (18, 20, 2, '', 49),
          (26, 23, 2, '', 56)]


TEST_EBENEN = ('figur',)     # Randpixel-Test ohne Lichtband/Sterne


def glanz(a, i):
    out = a.copy()
    r, g, b = (a[..., k].astype(int) for k in range(3))
    gelb = (a[..., 3] > 0) & (r > 205) & (g > 178) & (b < 100)
    H, W = a.shape[:2]
    Y, X = np.mgrid[0:H, 0:W]
    for start in (10, 42):
        k = (i - start) % N
        if k < 16:
            d = X + Y - (sz.PL + sz.PT) - (k * 4 - 2)
            out[gelb & (d == 0)] = HELL2 + (255,)
            out[gelb & ((d == -1) | (d == 1))] = HELL1 + (255,)
    return out


def frame(i, nur=None):
    n = N7.stufe(i, 32, 6, 14)
    kd = N7.sinus_px(i + 20, 32, 1) - N7.sinus_px(20, 32, 1)
    kd = max(-1, min(1, kd))
    rumpf = TX.streck_zeile(RUMPF, sz.PT + 12, n)
    f = L.zusammen(sz.H, sz.W, [(KLUMPEN, 0, kd), (rumpf, 0, 0), (rechts(i), 0, 0)])
    if nur:
        return f
    f = glanz(f, i)
    for (x, y, gr, t, start) in STERNE:
        st = N7.funkel_folge(i, N, start, (1, 2, gr, gr, 2, 1))
        if st:
            dy = -n if t == 'r' else kd if t == 'k' else 0
            N7.funkel(f, sz.PL + x, sz.PT + y + dy, st, WEISS)
    return f


if __name__ == '__main__':
    N7.fertig('the-golden-abomination', 'The Golden Abomination', frame, N, MS, quelle, check=[0, 6, 7, 14, 17, 20, 25, 34], zoom=9)
