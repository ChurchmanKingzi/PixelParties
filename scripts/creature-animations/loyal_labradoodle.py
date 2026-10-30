# -*- coding: utf-8 -*-
"""Idle-Animation für „Loyal Labradoodle“ (Creature).

Quelle: src/loyal-labradoodle.png — Ebene „Labradoodle“ (14×16 px, 15 Farben) aus MotiveGN.xcf.
PICK: [["MotiveGN", 178, 2]]

Aufruf:   python3 loyal_labradoodle.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/loyal-labradoodle.png + .json

Identifikation (Sprite 14×16, Hund von vorn, dunkelbraun-schwarz, lockig):
* Kopf (Innenfläche x 5–8, Zeilen 1–6, Umriss A bei x = 4 und 9): dunkle Fellflächen B/E, hellerer Stirnfleck F/J (6–8, 2),
  zwei BRAUNE Augen als senkrechte 1×2-Pixel (links x 5, rechts x 8; oben K (102,65,47), unten L (84,45,28), je y 4–5) — sie sitzen
  unmittelbar an den schwarzen Kopfrändern (x 4 und 9), seitlich ist daher kein Platz zum Blicken, nur hoch/runter.
* Locken-/Fellbüschel oben: drei einzelne dunkle Pixel (3,0), (7,0), (10,0) über der Kopfoberkante (Zeile 1).
* Lockige Schlappohren (links x 1–3, rechts x 10–12, Zeilen 1–5), mit schwarzem Umriss; unten wird die Kontur schmaler.
* Schnauze: Nase fast schwarz G (23,24,18) bei (6,7), (6–7,8), O (59,49,47) Schimmer; braune Seiten M (69,35,25) (5,8) und N (89,55,43) (8,8).
* Halsband: silbergraue U-Linie H (137,130,122) (4,9) (5,10) (6,11) und I (169,165,154) (7,11) (8,10) (9,9) — Metall, daher Glanz.
* Brust (Zeile 12), zwei Vorderbeine (links x 3–5, rechts x 8–10, Zeilen 13–14) mit Fußlinie Zeile 15.
* Kein Schwanz, keine Zunge sichtbar — nichts davon erfunden.
Bleibt fest: Stirnfleck, Schnauze/Nase, Brust, Beine bis auf die Pfoten.

Ablauf (50 Frames à 70 ms = 3,5 s), alle Bewegungen unabhängig; der Kopf bleibt als Ganzes stehen:
* Atmen (Periode 25, 2× pro Schleife; oben in Frames 3–14 und 28–39): Zeile 12 (Brust) wird eingefügt — Kopf, Ohren und Halsband heben
  sich 1 px, die Füße bleiben am Boden.
* Lockige Ohren schwingen: links in Frames 2, 14, 27, 39, rechts in 8, 20, 33, 44 (je 6 Frames) nach außen und zurück: erst nur die
  Unterkante (Zeile 6 = Umrisspixel (2–3, 6) gehören zum Ohr), dann die Zeilen 4–6 gemeinsam je 1 px (glatte Außenkante); der Umriss außen,
  unten und an der Spitze wandert mit, die Lücke zum Kopf wird mit dem Randpixel des Ohres geschlossen. Kein Quell-Umrisspixel fehlt.
* Locken wippen: die drei Fellbüschel oben (3,0) (7,0) (10,0) sind zugleich der Umriss über der Kopf-/Ohroberkante (Zeile 1) — sie dürfen deshalb
  nicht wegrutschen (das legte den Ohrrand frei). Stattdessen kringelt sich jede Locke unabhängig: ein zweites Pixel erscheint 1 px seitlich
  (über dem Umrisspixel von Zeile 1) und verschwindet wieder (Frames 4–8, 30–34 links/rechts, 16–20, 37–41, 8–12, 23–27).
* Kein Blickwechsel: die Augen bleiben auf ihrer Ruhezeile (Nutzerwunsch; der frühere Hoch-/Runterblick ist entfernt). Beim Blinzeln ersetzt das Lid nur die
  Augenpixel, danach stehen sie wieder genau dort, wo sie vorher standen.
* Blinzeln (Frames 9–12 und 34–37, alle 25 Frames ≈ 1,75 s): Die braunen Augen schließen sich mit dem DUNKLEN Lid in der Fellfarbe des Gesichts
  (B (51,47,44), wie das Fell neben den Augen): erst nur das obere Augenpixel (halb), dann beide (ganz, zwei Frames), dann wieder das obere. Der
  Wechsel ist gut sichtbar, weil die braunen Augen für diese Frames verschwinden.
* Halsbandglanz (Regel 12): ein Lichtband läuft in Frames 14–25 und 40–51 über die U-Linie von links nach rechts (jedes Pixel 2 Frames
  in der jeweils anderen Stufe H ↔ I der silbergrauen Rampe).
* Pfoten tippen: linker Fuß in Frames 5–6, 19–20 und 36–37, rechter Fuß in 12–13, 29–30 und 45–46 (die Beinzeile 14 des Fußes entfällt,
  die Fußlinie rückt 1 px hoch).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: keine gemalten Pixel (Ohr-Lücken werden mit dem Randpixel des Ohres geschlossen, siehe anim_tiere.ohr_haengend).
"""
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T

N, MS = 50, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 4, 4, 3

spr = L.lade('loyal-labradoodle')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

locke = {x: vorhanden & (xx == x) & (yy == 0) for x in (3, 7, 10)}
ohr_l = vorhanden & (xx <= 3) & (yy >= 1) & (yy <= 6)          # inkl. Unterkante (2–3, 6): gehört zum Ohrumriss
ohr_r = vorhanden & (xx >= 10) & (yy >= 1) & (yy <= 6)
koerper = vorhanden & ~ohr_l & ~ohr_r & (yy >= 1)

HELL, MITTEL = (169, 165, 154), (137, 130, 122)                   # I / H: silbergraue Rampe (Halsbandglanz)
LID = (51, 47, 44)                                                # B: dunkle Fellfarbe des Gesichts neben den Augen (geschlossenes Lid)
AUGE_OBEN, AUGE_UNTEN = (102, 65, 47), (84, 45, 28)               # K, L
AUGEN_X = (5, 8)
# Beim Blick frei werdende Augenpixel bekommen die Farbe des Fellnachbarn auf der Seite, von der das Auge weggeht:
FELL_HOCH = {(5, 5): (51, 47, 44), (8, 5): (63, 58, 54)}          # Auge ging nach oben (Zeilen 3–4): (x,5) ← Zeile 6
FELL_RUNTER = {(5, 4): (63, 58, 54), (8, 4): (51, 47, 44)}        # Auge ging nach unten (Zeilen 5–6): (x,4) ← Zeile 3
HALSBAND = [(4, 9), (5, 10), (6, 11), (7, 11), (8, 10), (9, 9)]
BAUCHZEILE = 12                                                   # hier wird beim Atmen eine Zeile eingefügt


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def ohr_profil(env, richtung):
    """Lockenohr schwingt nach außen: erst nur die Unterkante (Zeile 6), dann Zeilen 4–6 gemeinsam. Die Außenkante des Ohres läuft im
    Original bei x = 1, 0, 1, 1, 2 (Zeilen 2–6): nach Stufe 2 bei 1, 0, 0, 0, 1 — glatt; Umriss und Unterkante wandern mit."""
    stufe = 0 if env < 0.2 else (1 if env < 0.5 else 3)
    return {PAD_T + y: richtung for y in range(7 - stufe, 7)} if stufe else {}


def im_fenster(i, *fenster):
    return any(a <= i < b for a, b in fenster)


PFOTE_L = (5, 6, 19, 20, 36, 37)
PFOTE_R = (12, 13, 29, 30, 45, 46)
LOCKEN = {3: ((4, 9, -1), (30, 35, 1)), 7: ((16, 21, 1), (37, 42, -1)), 10: ((8, 13, 1), (23, 28, -1))}   # x: ((von, bis, dx), …)


def zustand(i):
    atem = 1 if (i % 25) in range(3, 15) else 0
    blick = 0                                                       # kein Hoch-/Runterblicken: die Augen bleiben auf ihrer Ruhezeile (Nutzerwunsch)
    ohr_li = max(T.huellkurve(i, N, s, 6) for s in (2, 14, 27, 39))
    ohr_re = max(T.huellkurve(i, N, s, 6) for s in (8, 20, 33, 44))
    lid = 0
    for s in (9, 34):
        if 0 <= i - s < 4:
            lid = (1, 2, 2, 1)[i - s]
    glanz = -1
    for s in (14, 40):
        if 0 <= i - s < 12:
            glanz = (i - s) // 2
    locken = {x: next((dx for a, b, dx in f if a <= i < b), 0) for x, f in LOCKEN.items()}
    return atem, blick, ohr_li, ohr_re, lid, glanz, locken, 1 if i in PFOTE_L else 0, 1 if i in PFOTE_R else 0


def frame(i, nur=None):
    atem, blick, ohr_li, ohr_re, lid, glanz, locken, tipp_l, tipp_r = zustand(i)
    k = teil(koerper)
    # Blick (hoch/runter, nur die Augen) und Blinzeln — auf dem Körper-Layer, bevor er gestreckt wird
    if blick:
        for x in AUGEN_X:
            if blick > 0:
                k[PAD_T + 3, PAD_L + x, :3] = AUGE_OBEN
                k[PAD_T + 4, PAD_L + x, :3] = AUGE_UNTEN
                k[PAD_T + 5, PAD_L + x, :3] = FELL_HOCH[(x, 5)]
            else:
                k[PAD_T + 5, PAD_L + x, :3] = AUGE_OBEN
                k[PAD_T + 6, PAD_L + x, :3] = AUGE_UNTEN
                k[PAD_T + 4, PAD_L + x, :3] = FELL_RUNTER[(x, 4)]
    if lid:
        y0 = 3 if blick > 0 else (5 if blick < 0 else 4)
        for x in AUGEN_X:
            k[PAD_T + y0, PAD_L + x, :3] = LID
            if lid == 2:
                k[PAD_T + y0 + 1, PAD_L + x, :3] = LID
    if glanz >= 0:
        x, y = HALSBAND[glanz]
        alt = tuple(int(v) for v in spr[y, x, :3])
        k[PAD_T + y, PAD_L + x, :3] = MITTEL if alt == HELL else HELL
    r = L.streck_zeile(k, PAD_T + BAUCHZEILE, atem)
    cols = np.arange(W)[None, :]
    fuss = (np.arange(H)[:, None] >= PAD_T + 14) & (cols >= PAD_L + 3) & (cols <= PAD_L + 10)
    fl, rest = L.trenne(r, fuss & (cols <= PAD_L + 5))
    fr_, rest = L.trenne(rest, fuss & (cols >= PAD_L + 8))
    fl = L.heben_unten(fl, PAD_T + 14, tipp_l)
    fr_ = L.heben_unten(fr_, PAD_T + 14, tipp_r)
    ol = L.streck_zeile(T.ohr_haengend(teil(ohr_l), ohr_profil(ohr_li, -1), 'links'), PAD_T + BAUCHZEILE, atem)
    orr = L.streck_zeile(T.ohr_haengend(teil(ohr_r), ohr_profil(ohr_re, 1), 'rechts'), PAD_T + BAUCHZEILE, atem)
    lo = L.leer(H, W)
    for x, m in locke.items():
        lo = L.zusammen(H, W, [(lo, 0, 0), (L.versetze(teil(m), 0, -atem), 0, 0)])
        if locken[x]:                                              # zweites Pixel seitlich, über dem Umrisspixel von Zeile 1 (Umriss bleibt geschlossen)
            lo = L.zusammen(H, W, [(lo, 0, 0), (L.versetze(teil(m), locken[x], -atem), 0, 0)])
    ebenen = {'rumpf': rest, 'fuss_l': fl, 'fuss_r': fr_, 'ohr_l': ol, 'ohr_r': orr, 'locken': lo}
    wahl = nur or ('rumpf', 'fuss_l', 'fuss_r', 'ohr_l', 'ohr_r', 'locken')
    return L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('loyal-labradoodle', 'Loyal Labradoodle', frames, MS, prev)
    if prev:
        L.streifen(prev + '/loyal-labradoodle-strip.png', frames, spalten=13, scale=8)
