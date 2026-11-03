# -*- coding: utf-8 -*-
"""Idle-Animation für „Tuscan Artist“ (Creature) — der Künstler mit dem Gemälde als Kopf. Das BILD bleibt vollkommen STATISCH (kein Heben, kein Farbwechsel, kein Pinsel im Bild); nur die Figur darunter lebt.

Quelle: src/tuscan-artist.png (24×37 px, 27 Farben).
PICK: [["MotiveGrailWar", 198, 1]]      (Ebene „Tuscan Artist“, Figur 1)
Nutzerfeedback: „Das Bild weder bewegen noch den Stift darstellen.“ → Das Gemälde (Zeilen 0–11: Rahmen + Windrad-Bild) wird in JEDEM Frame pixelgenau aus dem Original gesetzt (keine Hubbewegung, kein Glanz, keine
Farbänderung) und es wird KEIN Pinsel/Stift im oder am Bild gezeichnet (die frühere „Pinselspitze“ am Rahmen ist entfernt). Der Pinsel in der linken Hand des Sprites (x 3–6, y 26–31) bleibt, wie er im Original ist.

Aufruf:   python3 tuscan_artist.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/tuscan-artist.png + .json

Was im Sprite ist (x, y im 24×37-Sprite):
* KOPF = ein gerahmtes Gemälde (x 6–19, y 0–11): goldener Rahmen, darin ein Windrad-Bild (x 8–17, y 3–10): links rot, oben blau, rechts grün, unten rechts orange, in der Mitte ein graulila Fleck. Der Künstler hat KEIN
  Gesicht — keine Augen/Brauen, also kein Blinzeln. STATISCH.
* Schwarzer Kragen/Halstuch (x 4–19, y 12–19) unter dem Bild, graue Puffärmel-Schultern (x 1–5 und 16–23, y 13–20).
* Arme: kurze Ärmel, unten nackte braune Unterarme/Hände J/Y/a links (2–4, 21–25) und rechts (20–21, 21–25); die linke Hand hält einen PINSEL (x 3–6, y 26–31: Griff grau, Zwinge/Spitze hell V/Z bei (4–5,30), dunkle Umrisse).
  Die rechte Hand ist leer.
* Overall/Anzug grau (y 20–34), Beine ab Zeile 34 getrennt, Schuhe mit silbernen/weißen Kappen (V/Z, y 35) — Metall.
Metall im Sprite: nur die Schuhkappen (Regel 14). Der goldene Rahmen bekommt wegen der Vorgabe „Bild statisch“ KEINEN Glanz.

Ablauf (48 Frames à 62 ms = 2,98 s, nahtlos):
* Atmen / Schulterheben (Periode 24 = zweimal pro Schleife): der Körper unter dem Bild steigt 1 px (Schultern, Ärmel, Hände mit Pinsel, Overall; die Schuhe bleiben am Boden): die Anzugzeile 32 wird einmal doppelt
  eingefügt (L.streck_zeile) und die oberste Körperzeile 12 (Halstuch-Oberkante) entfällt — das Halstuch wird dabei 1 px kürzer, das Bild bleibt auf seiner Zeile (Kopf nur senkrecht, hier gar nicht bewegt).
* Rechte Hand zuckt (leere Hand, Frames 4–9 und 28–33): die Hautpixel der Hand (x ≥ 18, y 21–26: braun (156,105,62), hell (245,203,161), orange (239,161,95)) rutschen starr 1 px nach oben in den Ärmelsaum; unten bleibt
  ein Pixel der Kontur, nichts wird aufgerissen.
* Schuhkappen glänzen (Metall): ein heller Pixel (225,215,217) wandert viermal pro Schleife über die Kappen (Frames 3–8 + je 12k), links x 8–10 und rechts x 14–16.
Frame 0 = Original (Ruhepose). Kontrolle: anim_humanoide.ruhepose / eckkontakt_typen / Randpixel-Test (Regel 16).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.
Ergänzungen: keine.
"""
import math
import sys

import numpy as np

import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 62
PAD_L, PAD_R, PAD_T, PAD_B = 3, 4, 3, 2

spr = L.lade('tuscan-artist')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


Z, V = f(7, 35), f(8, 35)                          # Z (225,215,217) weiß, V (189,189,189) silber
UMRISS = f(3, 28)                                  # A (23,21,22)
ERLAUBT = Hm.umrissfarben(spr)

bild = vorhanden & (yy <= 11)                      # das Gemälde (Zeilen 0–11): STATISCH
koerper = vorhanden & (yy >= 12)
HAUTFARBEN = {(156, 105, 62), (245, 203, 161), (239, 161, 95)}                          # J, Y, a (Unterarm/Hand)
arm_r = koerper & (xx >= 18) & (yy >= 21) & (yy <= 26) & np.array([[f(x, y) in HAUTFARBEN if vorhanden[y, x] else False for x in range(sw)] for y in range(sh)])   # rechte Hand (leer)


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L, PAD_T)


KAPPEN = [(8, 35), (9, 35), (10, 35), (14, 35), (15, 35), (16, 35)]


ARM_X0, ARM_Y0, ARM_Y1 = 16, 20, 26                  # rechter Arm unterhalb der Schulterpuffe: Ärmelsaum (Zeile 20) bis Hand/Ärmelzipfel (Zeile 26), x ≥ 16


def arm_senken(k):
    """Den Teil x ≥ ARM_X0, Zeilen ARM_Y0…ARM_Y1 der Körperebene starr 1 px nach unten schieben; die frei werdende Zeile ARM_Y0 wird eine Texturmischung der Zeile darüber
    (L.misch_kopie mischt jedes zweite Pixel der Nachbarzeile ein)."""
    out = k.copy()
    y0, y1, x0 = ARM_Y0 + PAD_T, ARM_Y1 + PAD_T, ARM_X0 + PAD_L
    for y in range(y1, y0 - 1, -1):
        out[y + 1, x0:] = k[y, x0:]
    obere = k[y0 - 1].copy()
    obere[:x0] = 0
    nachbar = k[y0].copy()
    nachbar[:x0] = 0
    out[y0, x0:] = L.misch_kopie(obere, [nachbar, None], 1)[x0:]
    # alte Pixel der Zeile y1 + 1 links von x0 bleiben (Körper); die verschobenen Armpixel überschreiben nur x ≥ x0
    return out


def frame(i, nur=None):
    bi = teil(bild)
    k = teil(koerper)
    # --- Glanz auf den silbernen Schuhkappen (Metall): ein heller Pixel wandert über die Kappen ---
    g = Hm.folge(i % 12, 3, [0, 1, 2, 3, 4, 5])
    if g is not None and not nur:
        x, y = KAPPEN[g]
        Hm.setze(k, {(x, y): Z}, OFF)
    # --- rechter Arm (graue Ärmelspitze samt Hand) senkt sich 1 px (Frames 4–11 und 28–35): der Teil des Arms ab Zeile 20 (x ≥ 16: Ärmelsaum, Ärmelzipfel neben dem Körper, Hand) rutscht starr nach unten, in die
    # entstehende Zeile 20 kommt eine Texturmischung der Ärmelzeile 19 (keine kopierte Spalte, kein dickerer Umriss); die Hand bewegt sich NICHT für sich allein, sie hängt am Arm ---
    if Hm.folge(i, 4, [1] * 8, N) or Hm.folge(i, 28, [1] * 8, N):
        k = arm_senken(k)
    # --- Atmen: Körper steigt 1 px (Zeile 32 doppelt); Schultern/Kragen schieben sich dabei über die Unterkante des Bildes — das Bild liegt UNTER der Figur und bleibt unverändert ---
    brust = Hm.stufe(i, N / 2, 1)
    if brust:
        k = L.streck_zeile(k, PAD_T + 32, brust)
    fig = L.zusammen(H, W, [(bi, 0, 0), (k, 0, 0)])                      # Bild ZUERST (unten), die Figur darüber
    Hm.kontur_schliessen(fig, ERLAUBT, UMRISS)
    return fig


TEST_EBENEN = ('figur',)

if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    # Das Bild muss in jedem Frame pixelgleich sein
    b0 = frames[0][PAD_T:PAD_T + 12, PAD_L:PAD_L + sw]
    print('Bild (Zeilen 0–11) in allen Frames identisch:', all(np.array_equal(fr[PAD_T:PAD_T + 12, PAD_L:PAD_L + sw], b0) for fr in frames))
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('tuscan-artist', 'Tuscan Artist', frames, MS, prev)
    if prev:
        import os
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/tuscan-artist-strip.png', frames, spalten=12, scale=6)
