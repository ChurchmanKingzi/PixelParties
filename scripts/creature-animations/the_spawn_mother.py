# -*- coding: utf-8 -*-
"""Idle-Animation für „The Spawn Mother“ (Creature) — das Ungeheuer unter dem Schiff: schwarzer Leib im Wasser mit sechs großen roten Ring-Augen und violettem Fangarm.

Runde 8 (Nutzer: „Ist nicht das Schiff, sondern die großen roten Augen und Tentakel rundrum!“) → komplett NEU aufgebaut. Der frühere Sprite (weißes Ding mit grünem Rumpf,
MotiveIndia 400) war das SCHIFF von oben und ist ersatzlos entfallen.

PICK: [["MotiveIndia", 402, "Ebene #59: schwarzer Leib/Schatten mit Tentakel-Lappen (113×75, Ebenendeckkraft 129 → hier deckend)"],
       ["MotiveIndia", 401, "Ebene #58: die sechs roten Ring-Augen (54×43, Ebenendeckkraft 127 → hier deckend), Lage (37,14) im Leib"],
       ["MotiveIndia", 399, "Ebene #60, Ausschnitt x 0–47, y 0–23: der violette Fangarm (Lage (22,4) im Leib); der Rest der Ebene ist eine andere Karte"]]
Abgleich mit data/card-art/native/The_Spawn_Mother.png: Die Karte zeigt nur den mittleren Ausschnitt (76×51) – sechs Augen im Sechseck, der Fangarm greift von links oben nach dem
Schiff. Das Schiff (Ebene 400 „a“) ist WEGGELASSEN: Leib, Augen und Fangarm halten als Figur auch ohne Träger zusammen (die Augen sitzen im schwarzen Leib).
Quelldateien (alle auf der Leinwand 113×75, gebaut aus dem xcf-Dump):
  src/the-spawn-mother.png            Gesamtbild (Referenz für die Farbprüfung)
  src/the-spawn-mother-koerper.png    Leib, Schwarz (0,0,0), Alpha ≥ 128 → deckend; dünne 1-px-Linien am unteren Rand (Auswahlreste der Ebene) per 3×3-Öffnung entfernt
  src/the-spawn-mother-augen.png      Augen, Farben (38,0,0) (77,0,0) (94,0,0) (173,0,0)
  src/the-spawn-mother-tentakel.png   Fangarm; sein Fuß läuft in der Quelle weich aus (Alpha-Verlauf) → hier binär: deckend bis Alpha 165, darunter zwei Zeilen Schachbrett-/Punkt-Raster
                                      (nur über dem schwarzen Leib), darunter nichts.
Halbtransparenz: Im Sprite ist alles Alpha 0/255. Kein `deckkraft` im JSON (sonst würden Augen und Fangarm mit durchscheinen) – Annahme, im Bericht genannt.

Identifikation: LEIB (ganze Leinwand; links ein großer Lappen mit Loch = eingerollter Tentakel, x 0–33, y 28–68; links oben ein Lappen x 9–33, y 0–26; rechts gezackte Lappen x ≥ 92).
AUGEN: sechs 9×9-Scheiben (dunkler Rand (38,0,0), Hof (77)/(94), heller 5×5-Ring (173,0,0) mit dunkler 3×3-Pupille); der Ring sitzt in jeder Scheibe zur Bildmitte hin (alle
Augen starren auf die Mitte). FANGARM: Bogen x 28–62, y 4–27, Fuß links (x 28–43, y 18–24), Spitze rechts unten (62,27); liegt vor dem Auge links oben.
Riesig → langsam (72 Frames à 80 ms = 5,8 s). Kein Metall → kein Glanz.

Ablauf (nahtlos). Frame 0 = Original:
* Augen BLICKEN: Frames 22–33 schauen alle sechs nach links, Frames 50–61 nach rechts (die Augen, deren Ring auf der anderen Seite sitzt, werden als 9×9-Scheibe gespiegelt –
  nur vorhandene Pixel, die Scheibe selbst bleibt am Platz), dazwischen starren sie wieder auf die Mitte.
* Augen BLINZELN (je Auge versetzt, 4 Frames: halb – zu – zu – halb; einmal je Schleife, Frame 66 alle gemeinsam): der helle Ring wird flacher (3 Zeilen), dann eine dunkle
  Lidlinie im Hof-Rot (94,0,0); nur Pixel innerhalb der Augenscheibe.
* Fangarm WINDET sich (Periode 36, 2×): der Bogen (Zeilen y < 14) wiegt 1 px seitlich, der herabhängende rechte Ast mit der Spitze (y ≥ 14, x ≥ 46) schlängelt mit einer nach unten
  laufenden Welle, zur Spitze hin stärker (bis etwa ±3 px; ganze Zeilenstücke starr versetzt, höchstens 1 px Unterschied zwischen Nachbarzeilen). Der Fuß bleibt stehen.
* Tentakel-Lappen des Leibs wabern (Periode 72 bzw. 36): links (x < 22) und rechts (x > 92) wandern die Spalten des schwarzen Leibs in einer langsamen Welle bis ±2 px auf und ab
  (zur Mitte hin auf 0 auslaufend). Der Leib ist einfarbig schwarz – es bewegt sich nur der Umriss, die Augenzone steht still.
Ergänzungen: keine (Leib unter Augen/Fangarm ist ohnehin vollständig).
"""
import math

import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 72, 80
PAD = 4
QUELLE = L.lade('the-spawn-mother')
KOERPER, AUGEN, TENT = (L.lade('the-spawn-mother' + s) for s in ('-koerper', '-augen', '-tentakel'))
spr = QUELLE
sh, sw = spr.shape[:2]
H, W = sh + 2 * PAD, sw + 2 * PAD
D, HOF, RING = (38, 0, 0), (94, 0, 0), (173, 0, 0)
# Augen: (x0, y0) der 9×9-Scheibe, (rx, ry) linke obere Ecke des 5×5-Rings, Seite des Rings (−1 links, +1 rechts, 0 Mitte), Blinzel-Start
AUGE = [(47, 14, 50, 17, 1, 5), (72, 14, 73, 17, -1, 41), (37, 31, 40, 33, 1, 30), (82, 31, 83, 33, -1, 12), (47, 48, 50, 49, 1, 47), (72, 48, 73, 49, -1, 18)]
TEST_EBENEN = ('figur',)


def augen(i):
    a = AUGEN.copy()
    blick = -1 if 22 <= i < 34 else 1 if 50 <= i < 62 else 0
    for (x0, y0, rx, ry, seite, start) in AUGE:
        if blick and blick != seite:                       # Scheibe spiegeln → Ring wandert auf die andere Seite
            a[y0:y0 + 9, x0:x0 + 9] = AUGEN[y0:y0 + 9, x0:x0 + 9][:, ::-1]
            rx = 2 * x0 + 8 - (rx + 4)
        b = max(N7.funkel_folge(i, N, start, (1, 2, 2, 1)), N7.funkel_folge(i, N, 66, (1, 2, 2, 1)))
        if b:
            ring = a[ry:ry + 5, rx:rx + 5]
            alt = ring.copy()
            ring[..., :3] = HOF
            if b == 1:                                    # halb zu: Ring nur noch 3 Zeilen hoch
                ring[1] = alt[0]; ring[2] = alt[2]; ring[3] = alt[4]
            else:                                         # zu: dunkle Lidlinie
                ring[2, :, :3] = D
    return a


def tentakel(i):
    t = TENT
    out = np.zeros_like(t)
    s1 = N7.sinus_px(i, 36, 1)
    for y in range(sh):
        if y < 14:
            out[y] = np.roll(t[y], s1, axis=0)
            continue
        out[y, :46] = t[y, :46]                            # Fuß (linker Ast) steht
        k = (y - 13) / 14.0
        ph = (y - 14) / 40.0
        d = s1 + int(math.floor(2.4 * k * (math.sin(2 * math.pi * (i / 36.0 - ph)) - math.sin(2 * math.pi * -ph)) + 0.5))   # Frame 0 = Original
        zeile = np.zeros_like(t[y]); zeile[46:] = t[y, 46:]
        zeile = np.roll(zeile, d, axis=0)
        m = zeile[:, 3] > 0
        out[y][m] = zeile[m]
    return out


def leib(i):
    k = L.platz(KOERPER, H, W, PAD, PAD)
    out = np.zeros_like(k)
    for X in range(W):
        x = X - PAD
        if x < 22:
            amp = 2.3 * min(1.0, (22 - x) / 14.0)
            d = amp * (math.sin(2 * math.pi * (i / 72.0 - x / 40.0)) - math.sin(2 * math.pi * (-x / 40.0)))
        elif x > 92:
            amp = 1.2 * min(1.0, (x - 92) / 10.0)
            d = amp * (math.sin(2 * math.pi * (i / 36.0 + x / 60.0)) - math.sin(2 * math.pi * (x / 60.0)))
        else:
            d = 0
        d = max(-3, min(3, int(math.floor(d + 0.5))))
        out[:, X] = np.roll(k[:, X], d, axis=0)
    return out


def frame(i, nur=None):
    return L.zusammen(H, W, [(leib(i), 0, 0), (L.platz(augen(i), H, W, PAD, PAD), 0, 0), (L.platz(tentakel(i), H, W, PAD, PAD), 0, 0)])


if __name__ == '__main__':
    N7.fertig('the-spawn-mother', 'The Spawn Mother', frame, N, MS, QUELLE, check=[0, 6, 9, 18, 27, 56], zoom=4)
