# -*- coding: utf-8 -*-
"""Idle-Animation für „Pet Snake“ (Creature) — kleine olivgrüne Schlange, eingerollt: sie richtet den Kopf langsam auf und senkt ihn wieder, nickt kurz zur
Seite, die Schwanzspitze zuckt. Das Schuppenmuster bleibt fest am Körper.

PICK: [["Kartenkunst", "Pet_Snake.png", "nur die Schlange (Kunst x 16–32, y 26–40); keine xcf-/Sprite-Quelle auffindbar (auch Farbsuche über alle Ebenen ohne Treffer)"]]
Die Motiv-Maske der Karte enthält außerdem die kniende Heldin (blaues Haar, grüner Rock), die die Schlange streichelt, und ein rot-weiß gestreiftes Wesen rechts –
beides gehört nicht zur Creature und ist WEGGELASSEN (auch die Hand auf dem Schlangenkopf, Kunst (27–28,25)). Die Kunst ist leicht verrauscht (133 Farbtöne in der
Schlange); die Pixel sind auf die fünf erkennbaren Grundfarben zurückgeführt (Mittelwerte der Farbhaufen): Umriss-Dunkeloliv (49,68,28), Schuppen hell
(100,156,40) und mittel (79,124,30) im Schachbrett, Smaragd-Zeichnung an Kopf und Hals (44,121,57), Augengelb (252,200,47). Quelle vollständig (Kopfoberkante
unter der Hand ist geschlossener Umriss).

Identifikation (17×15): Kopf (x 8–14, y 0–3) mit zwei gelben Augen (11,1), (13,1), Unterkiefer als dunkle Linie (x 11–14, y 3); Hals (x 6–13, y 3–6) führt nach
unten in die liegenden Windungen (y 6–14), Schachbrett-Schuppen hell/mittel.

Ablauf (48 Frames à 80 ms = 3,8 s). Frame 0 = Original:
* Aufrichten: der Hals streckt sich in zwei Stufen um 1 und 2 px (unter Halszeile 4 wird das Schuppen-Schachbrett fortgesetzt: Zeile mit vertauschtem Smaragd/Hell, nicht kopiert),
  Kopf hebt sich, hält, senkt sich wieder (Frames 6–30).
* Kopfnicken zur Seite (Schlange, kein Humanoid): der Kopf (Zeilen 0–3) rückt 1 px nach bildlinks und zurück (Frames 14–19 und 36–41).
* Schwanzspitze (linkes Ende der Windungen, Spalten 0–1, y 9–13 – als Schwanzende gedeutet): zuckt zweimal kurz starr 1 px hoch (Frames 32–33 und 44–45).
* Runde 12 (Nutzer): KEIN Schuppen-Wandern mehr – das Schachbrett der Windungen ist in jedem Frame das der Quelle.
Kein Blinzeln (Schlangen haben keine Lider), keine Zunge (in der Kunst nicht vorhanden – keine neue Farbe erfunden).
"""
import numpy as np

import anim_lib as L
import anim_n11 as G

N, MS = 48, 80
sz = G.Szene('pet-snake', (4, 3, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
HELL, MITTEL, SMARAGD = (100, 156, 40), (79, 124, 30), (44, 121, 57)
KOPF_M = sz.da & (yy <= 3)
KOPF = sz.teil(KOPF_M)
REST = sz.teil(sz.da & ~KOPF_M)
ZUCK = {32, 33, 44, 45}
HUB = [0] * 6 + [1] * 4 + [2] * 14 + [1] * 6 + [0] * 18
NICK = set(range(14, 20)) | set(range(36, 42))


def hals_strecken(f, n):
    """Hals um n Zeilen verlängern: alles bis einschließlich Halszeile 4 rückt n px hoch; die neuen Zeilen setzen das Schachbrett fort
    (Halszeile mit vertauschtem Smaragd/Hell, dann wieder die Halszeile) – Musterfortsetzung statt Zeilenkopie."""
    if not n:
        return f
    z = sz.PT + 4
    out = L.leer(sz.H, sz.W)
    out[z + 1:] = f[z + 1:]
    out[:z - n + 1] = f[n:z + 1]
    for k in range(1, n + 1):
        zeile = f[z].copy()
        if k % 2:
            zeile = G.farbtausch(zeile[None], np.ones((1, sz.W), bool), {HELL: SMARAGD, SMARAGD: HELL})[0]
        out[z - n + k] = zeile
    return out


def frame(i, nur=None):
    rest = REST
    if i in ZUCK:
        rest = G.spalten_schub(rest, lambda x: -1 if x <= sz.PL + 1 else 0)     # Schwanzspitze (Spalten 0–1) zuckt starr 1 px hoch
    f = G.ueber(rest, G.starr(KOPF, -1 if i in NICK else 0, 0))
    return hals_strecken(f, HUB[i])


if __name__ == '__main__':
    G.fertig('pet-snake', 'Pet Snake', frame, N, MS, spr, check=[0, 8, 12, 16, 32, 38], zoom=16)
