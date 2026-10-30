# -*- coding: utf-8 -*-
"""Idle-Animation für „Bonded Companion Humby“ (Creature).

Quelle: src/bonded-companion-humby.png — das goldene Löwenjunge (23×20 px, 9 Farben, 271 px) der Ebene 1387 „Humby #3“ aus Motive.xcf, Figur 3; mit der Kartenkunst
(data/card-art/native/Bonded_Companion_Humby.png: Mitte links, Pixel für Pixel gleich) abgeglichen. Die Ebene enthält außerdem mehrere Posen der Heldin (Figur 2, 24×24, geflügelt mit roten
Haaren) — sie ist der Held und gehört nicht zur Creature. Hinweis: Das Tier hat Mähne und einen eingerollten Schwanz mit Quaste (Löwenjunges, kein Hund); die Zunge hängt heraus.
PICK: [["Motive", 1387, 3]]

Aufruf:   python3 bonded_companion_humby.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/bonded-companion-humby.png + .json

Identifikation (Sprite 23×20, Chibi-Löwe im Profil, schaut nach RECHTS):
* Kopf samt Mähne (x 9–22, Zeilen 1–14): großer runder Kopf, Mähne aus hellgelb B (251,221,110) / creme C (248,248,189) mit braunem Umriss A (125,52,32); Gesicht rechts (x 16–22):
  Auge = „^“ aus drei schwarzen Pixeln F (17,5) (16,6) (18,6) um das cremefarbene C (17,6) — geschlossenes Lachauge; Nase = schwarzer 2×2-Block F (20–21, 6–7);
  Zunge = rot G/H/I (19–20, 9–10).
* Körper (x 9–20, Zeilen 11–19): kleiner Rumpf/Brust (15–20, 11–16) unter dem Kopf, vorn zwei Beine (x 9–14, Zeilen 12–19), hinten ein Beinpaar (x 1–6, Zeilen 13–19).
* Schwanz (x 0–8, Zeilen 0–13): Eingerollt wie ein „C“ — setzt am Rumpf unten links an ((4–9,12) orange E / D), läuft an der linken Seite (x 0–2) hoch, oben im Bogen (3–6, 0–1) nach rechts
  und endet mit einer Quaste/Spitze (7–8, 1–3).
* Kein Glanz (Fell, Regel 14), keine Partikel. Ohren/Beine nicht eindeutig lesbar → fest. Auge ist schon geschlossen (Lachauge) → kein Blinzeln, kein Blick.
Bleibt fest: Gesicht (Auge, Nase, Zunge), Beine, Rumpf unter Zeile 11.

Ablauf (48 Frames à 70 ms = 3,4 s), alle Bewegungen unabhängig:
* Schwanzwiegen (Periode 16, 3× pro Schleife): die Zeilen des Schwanzes oberhalb von Zeile 8 (x ≤ 8) wandern waagerecht, je höher desto mehr (die diagonale Schwanzwurzel darunter bleibt, sonst reißt sie diagonal auf) (Quaste bis 3 px nach links, höchstens 1 px nach rechts, damit sie nicht am Kopf anliegt); der Ansatz am Rumpf bleibt.
* Hüpfer (Periode 24, 2× pro Schleife): das ganze Tier hebt 1–2 px ab und landet wieder.
* Kopf hebt sich (Periode 24, Frames 10–18): Kopf samt Mähne steigt 1 px — in den Spalten x ≥ 9 wird die Mähnenunterkante (Zeile 11) einmal eingefügt (anim_tiere.spalten_hub),
  Beine und Rumpf darunter bleiben stehen, der Schwanz bleibt am Rumpf.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16) und die eingefügte Mähnenzeile beim Kopfheben (Duplikat vorhandener Pixel). Sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 4, 2

spr = L.lade('bonded-companion-humby')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (xx <= 8) & (yy <= 11)
koerper = vorhanden & ~schwanz

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HUEPFER = [0, 0, 0, 1, 2, 2, 1, 0] + [0] * 16                       # Periode 24
KOPF = [0] * 10 + [1] * 9 + [0] * 5                                 # Periode 24: Kopf hebt sich


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def wiegen(a, pivot_y, amp, phase):
    """Zeilenscherung des Schwanzes: Zeile y wandert um round(amp · f · v), f = Abstand zum Pivot / größter Abstand, v = sin(phase) — nach links voll,
    nach rechts nur zu 40 % (sonst läge die Quaste am Kopf an). Der Ansatz (Pivot) bleibt stehen."""
    out = L.leer(*a.shape[:2])
    h, w = a.shape[:2]
    maxd = max(1, max(pivot_y - y for y in range(h) if a[y, :, 3].any() and y < pivot_y))
    v = math.sin(phase)
    v = v if v < 0 else 0.4 * v
    for y in range(h):
        xs_ = np.nonzero(a[y, :, 3])[0]
        if not len(xs_):
            continue
        dx = int(round(amp * (max(0, pivot_y - y) / maxd) * v))        # unterhalb des Pivots (Diagonale zum Rumpf) fest
        if xs_.min() + dx < 0 or xs_.max() + dx >= w:
            raise L.ClipError(f'Zeile {y} würde um {dx} px aus der Leinwand geschoben')
        for x in xs_:
            out[y, x + dx] = a[y, x]
    return out


def frame(i, nur=None):
    hub = HUEPFER[i % 24]
    kopf = KOPF[i % 24]
    amp = 3.2 + 0.6 * (0.5 - 0.5 * math.cos(2 * math.pi * i / N))
    k = T.spalten_hub(teil(koerper), PAD_T + 11, lambda x: kopf if x >= PAD_L + 9 else 0)
    s = wiegen(teil(schwanz), PAD_T + 8, amp, L.sinus(i, 16))
    ebenen = {'koerper': k, 'schwanz': s}
    wahl = nur or ('koerper', 'schwanz')
    ganz = L.zusammen(H, W, [(ebenen[n], 0, -hub) for n in wahl])
    return T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bonded-companion-humby', 'Bonded Companion Humby', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bonded-companion-humby-strip.png', frames, spalten=12, scale=6)
