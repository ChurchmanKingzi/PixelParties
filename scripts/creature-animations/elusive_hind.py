# -*- coding: utf-8 -*-
"""Idle-Animation für „Elusive Hind“ (Creature) — Runde 2: die Hirschkuh glänzt als Ganzes, glitzert und läuft am Ort.

Nutzerkorrektur (wörtlich): „soll als Ganzes glänzen und sparkeln und die Beine sollen sich bewegen.“ (Glanz/Glitzer ist hier AUSDRÜCKLICH gewünscht und gilt als Ausnahme von Regel 14.)

Quelle: src/elusive-hind.png — die goldene Hirschkuh (24×23 px, 9 Farben, 270 px) aus der Ebene 48 „Ebene #298“ von MotiveSteamDwarfs.xcf, Figur 1; mit der Kartenkunst
(data/card-art/native/Elusive_Hind.png: Mitte, auf Steinpflaster, nach rechts schauend; Pixel für Pixel gleich) abgeglichen. Die gelben Glitzersterne rings um das Tier (Ebene 43 „Ebene #299“: drei
vierzackige Sterne 9×8 / 8×9 / 9×8 in (255,224,54)/(255,255,181) plus drei kleine Kreuz-/Rautenfunken) sind eigene Ebenen (Beiwerk); ihre Farben stehen nicht im Sprite — als Vorbild der Glitzerform
benutzt, gemalt wird in den Farben des Sprites (siehe Ergänzungen).
PICK: [["MotiveSteamDwarfs", 48, 1]]

Aufruf:   python3 elusive_hind.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/elusive-hind.png + .json

Identifikation (Sprite 24×23, goldgelbe Hirschkuh im Profil, schaut nach RECHTS; Farben A (187,79,31) Umriss/Schatten, B (218,138,55) orange, C (225,192,66) gelb, D (222,222,86) hellgelb, E (222,222,156) creme):
* Ohr (x 12–15, Zeilen 0–2) über dem Kopf; Kopf (x 14–23, Zeilen 2–8) mit hellem Halsstreifen (14–15, 3–9).
* Auge: weiß (255,255,255) (18,4) (19,4) (19,5) mit grüner Iris (0,230,79) (18,5); Schnauze rot: (193,0,0) (22,6) (22–23,7), (255,0,0) (23,6) — die rote Nase.
* Rumpf (x 1–17, Zeilen 8–14): Rückenlinie A (4–12, 8), Fell B/C/D; Hinterteil links mit hellen Pixeln D (0–2, 10–13).
* VIER Beine, je 3 px breit (Umriss A, Füllung 1 px, Umriss A), Zeilen 17–22: hinten links x 1–3, hinten rechts x 4–6 (oben verschmolzen, ab Zeile 17 getrennt), vorn links x 13–15, vorn rechts x 16–19 (läuft ab Zeile 18 ein Pixel
  nach rechts). Die Hüftzeile 16 gehört zum Rumpf und bleibt stehen.
Bleibt fest: Rumpf (bis auf Wippen), Nase, Halsstreifen.

Ablauf (48 Frames à 66 ms = 3,2 s), alle Bewegungen unabhängig:
* LAUFEN am Ort (Periode 16 Frames, 3 Zyklen pro Schleife): die vier Beine sind eigene Ebenen und laufen im Diagonalgang (hinten links + vorn rechts / hinten rechts + vorn links, ½ Zyklus Versatz):
  jede Zeile unter der Hüfte wandert waagerecht (Scherung, Fuß bis ±2 px nach vorn/hinten), in der Schwungphase (40 %) hebt der Fuß bis 2 px (Beinzeilen entfallen). Der Boden bleibt: die Standbeine stehen auf Zeile 22.
* Körper wippt: 2× pro Zyklus hebt sich der Rumpf 1 px (die Beine strecken sich dabei um eine Zeile, Zeile 19 wird eingefügt); der frühere Schreckhüpfer (ganzes Tier abgehoben) entfällt — ein Bodentier hüpft nicht.
* Kopf nickt (Periode 16, 3× pro Schleife): die Kopfzeilen 0–7 wandern waagerecht, je höher desto mehr (bis ±1 px; benachbarte Zeilen höchstens 1 px Unterschied); Rücken (ab Zeile 8) bleibt.
* Ohr zuckt (Frames 4–6, 20–22 und 36–38): die Ohrzeilen 0–1 kippen 1 px nach hinten (links); Ohr (Zeile 2) und Kopf bleiben.
* Blinzeln (Frames 12–15 und 30–33): die Augenpixel (weiß + grün) schließen sich in der Fellfarbe (oben D, unten C) — Lid = Fellfarbe; erst die untere Augenzeile, dann beide, dann wieder auf.
* GLANZ als Ganzes: ein diagonales Lichtband (von hinten-unten nach vorn-oben, ≈ 3 px breit) läuft zweimal pro Schleife (Frames 2–20 und 26–44) über die ganze Figur — Fellpixel gehen im Kern zwei, am Rand eine Stufe
  der Fellrampe B → C → D → E hoch (Umriss A, Auge und Nase bleiben).
* GLITZERN: sechs vierzackige Sterne (Mitte weiß, Arme creme/hellgelb/gelb, wachsen von 3×3 über 5×5 auf 7×7 und schrumpfen wieder; je 10 Frames, zweimal pro Schleife, zeitlich versetzt) blitzen AN der Figur
  auf (Hinterteil, Rücken, Schulter, Hals, Stirn, unter dem Bauch); sie liegen vor dem Tier und wippen mit dem Rumpf.
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben des Sprites (die Sterne nutzen Weiß (255,255,255) der Augen, E, D und C des Fells).

Ergänzungen: Randpixel-Korrektur (Regel 16) über anim_tiere.umriss_schliessen; die Glitzersterne (Pixel in Spritefarben, keine neuen Farben). Beine/Hüfte: keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_textur as TX   # texturierte Streckzeilen statt Zeilenkopien (Regel 43/49)
TX.umleiten()               # auch Streckaufrufe innerhalb der Gruppenmodule liefern texturierte Zeilen
import anim_tiere as T
import anim_tier as G

N, MS = 48, 66
ZYKLUS = 16
PAD_L, PAD_R, PAD_T, PAD_B = 6, 6, 6, 3

spr = L.lade('elusive-hind')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

ohr = vorhanden & (xx <= 15) & (yy <= 1)
bein_hl = vorhanden & (yy >= 17) & (xx <= 3)                         # hinten links
bein_hr = vorhanden & (yy >= 17) & (xx >= 4) & (xx <= 6)             # hinten rechts
bein_vl = vorhanden & (yy >= 17) & (xx >= 13) & (xx <= 15)           # vorn links
bein_vr = vorhanden & (yy >= 17) & (xx >= 16)                        # vorn rechts
beine = bein_hl | bein_hr | bein_vl | bein_vr
koerper = vorhanden & ~ohr & ~beine

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

FELL_O, FELL_U = (222, 222, 86), (225, 192, 66)                  # D (oben), C (unten)
AUGE = [(18, 4), (19, 4), (18, 5), (19, 5)]
BLINK = {12: 1, 13: 2, 14: 2, 15: 1, 30: 1, 31: 2, 32: 2, 33: 1}
OHR = {4, 5, 6, 20, 21, 22, 36, 37, 38}
WIPPEN = [0, 0, 1, 1, 1, 0, 0, 0]                                  # Periode 8: 1 = Rumpf 1 px höher

RAMPE = [(218, 138, 55), (225, 192, 66), (222, 222, 86), (222, 222, 156)]      # B → C → D → E (Fellrampe des Sprites)
WEISS = (255, 255, 255)
SCHUTZ = [(187, 79, 31), (255, 255, 255), (0, 230, 79), (193, 0, 0), (255, 0, 0)]   # Umriss, Auge, Nase: kein Glanz
# Glitzersterne: (x, y) im Sprite, Phase (Frame-Versatz im 24er-Takt)
STERNE = [(3, 11, 0), (10, 9, 4), (14, 12, 8), (14, 6, 12), (20, 1, 16), (9, 16, 20)]
STERN_DAUER, STERN_PERIODE = 10, 24
STERN_FARBEN = [WEISS, (222, 222, 156), (222, 222, 86), (225, 192, 66)]         # Mitte, Arm 1, Arm 2, Arm 3


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)                         # sofort auf die volle Leinwand


def setze(k, x, y, farbe):
    k[PAD_T + y, PAD_L + x, :3] = farbe
    k[PAD_T + y, PAD_L + x, 3] = 255


def gesicht(k, i):
    lid = BLINK.get(i, 0)
    if lid:
        for (x, y) in AUGE:
            if lid == 2 or y == 5:
                setze(k, x, y, FELL_O if y == 4 else FELL_U)


def bein_pose(i, versatz):
    dx, lift = G.gang(i / float(ZYKLUS) + versatz, 2.0, 0.4, 2.0)
    return -G.runde(dx), int(round(lift))                           # Tier schaut nach rechts: Schwung = vorwärts = rechts


def bein_ebene(maske, i, versatz, hub):
    dx, lift = bein_pose(i, versatz)
    t = teil(maske)
    rows = {PAD_T + 17 + k: G.runde(dx * (k + 1) / 6.0) for k in range(6)}        # Zeilen 17–22
    t = G.zeilen_versatz(t, rows)
    if lift:
        t = L.heben_unten(t, PAD_T + 19, lift)
    return TX.streck_zeile(t, PAD_T + 19, hub) if hub else t           # Rumpf höher → Beine länger, Füße bleiben am Boden


def glanz(f, i):
    """Diagonales Lichtband über die ganze Figur (Fellrampe B→C→D→E, Kern 2 Stufen, Rand 1)."""
    for a, e in ((2, 20), (26, 44)):
        if a <= i < e:
            u = (i - a) / float(e - a - 1)
            break
    else:
        return f
    out = f.copy()
    mitte = -3.0 + u * (sw + 0.6 * sh + 9.0)
    rampe_idx = {c: k for k, c in enumerate(RAMPE)}
    h_, w_ = f.shape[:2]
    for y in range(h_):
        for x in range(w_):
            if not f[y, x, 3]:
                continue
            c = tuple(int(v) for v in f[y, x, :3])
            if c not in rampe_idx:
                continue
            d = (x - PAD_L) + 0.6 * (sh - 1 - (y - PAD_T)) - mitte
            stufe = 2 if abs(d) <= 0.9 else (1 if abs(d) <= 2.0 else 0)
            if stufe:
                out[y, x, :3] = RAMPE[min(len(RAMPE) - 1, rampe_idx[c] + stufe)]
    return out


def stern(f, cx, cy, groesse):
    """Vierzackiger Stern: groesse 1 = Plus aus 5 px, 2 = Arme 2 px, 3 = Arme 3 px; Mitte weiß, Arme nach außen creme → hellgelb → gelb."""
    h_, w_ = f.shape[:2]
    pts = [(0, 0, 0)]
    for a in range(1, groesse + 1):
        pts += [(a, 0, a), (-a, 0, a), (0, a, a), (0, -a, a)]
    for dx, dy, k in pts:
        x, y = cx + dx, cy + dy
        if not (0 <= x < w_ and 0 <= y < h_):
            raise L.ClipError(f'Stern bei ({x},{y}) außerhalb der Leinwand {w_}×{h_}')
        f[y, x, :3] = STERN_FARBEN[k]
        f[y, x, 3] = 255
    return f


STERN_STUFEN = [1, 1, 2, 2, 3, 3, 2, 2, 1, 1]


def sterne(f, i, hub):
    for (x, y, off) in STERNE:
        t = (i + off) % STERN_PERIODE
        if t < STERN_DAUER:
            stern(f, PAD_L + x, PAD_T + y - hub, STERN_STUFEN[t])
    return f


def frame(i, nur=None):
    hub = WIPPEN[i % 8]
    v = math.sin(L.sinus(i, 16))
    k = teil(koerper)
    gesicht(k, i)
    k = T.scherung_zeilen(k, PAD_T + 0, PAD_T + 7, PAD_T + 8, 1.4, v)                          # Kopf nickt (Zeilen 0–7 wandern, Zeile 8 bleibt)
    o = T.scherung_zeilen(teil(ohr), PAD_T + 0, PAD_T + 7, PAD_T + 8, 1.4, v)
    if i in OHR:
        o = L.versetze(o, -1, 0)
    ebenen = {'koerper': L.versetze(k, 0, -hub), 'ohr': L.versetze(o, 0, -hub),
              'bein_hl': bein_ebene(bein_hl, i, 0.0, hub), 'bein_vr': bein_ebene(bein_vr, i, 0.0, hub),
              'bein_hr': bein_ebene(bein_hr, i, 0.5, hub), 'bein_vl': bein_ebene(bein_vl, i, 0.5, hub)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, 0) for n in wahl])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)
    if nur is None:                                                  # Glanz und Glitzer nur im fertigen Bild
        ganz = glanz(ganz, i)
        ganz = sterne(ganz, i, hub)
    return ganz


TEST_EBENEN = ['koerper', 'ohr', 'bein_hl', 'bein_vr', 'bein_hr', 'bein_vl']


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('elusive-hind', 'Elusive Hind', frames, MS, prev)
    if prev:
        L.streifen(prev + '/elusive-hind-strip.png', frames, spalten=12, scale=6)
