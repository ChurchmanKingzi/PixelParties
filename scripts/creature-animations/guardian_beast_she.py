# -*- coding: utf-8 -*-
"""Idle-Animation für „Guardian Beast She“ (Creature) — die Kobra-Wächterin: Haube mit Gesicht auf einem Hals, der aus einer Schalenspirale wächst, der Schwanz
schlingt sich um einen Dreizack-Stab.

Quelle: src/guardian-beast-she.png (34×40 px, 52 Farben).
PICK: [["MotiveGuardianBeasts", 92, 1], ["MotiveGuardianBeasts", 94, 1], ["MotiveGuardianBeasts", 96, 1], ["MotiveGuardianBeasts", 95, 1]]
      (Ebenen „She #5“ = Schalenspirale, „She #3“ = unterer Stab, „She #4“ = Dreizack/oberer Stab, „She #1“ = Kobra mit Haube und Schwanz; die Ebene 53 „Guard Duty #2“ ist dieselbe
      Figur fertig zusammengesetzt, Ebene 97 „She“ ist eine andere Pose (Ansicht von oben), Ebene 93 „She #2“ ein kleiner lila Klecks — nicht verwendet.)
Quelle vollständig: ja. Die vier Ebenen ergeben (Stapelreihenfolge 92 > 94 > 95 > 96) pixelgenau den Sprite.

Aufruf:   python3 guardian_beast_she.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/guardian-beast-she.png + .json

Identifikation (x, y im 34×40-Sprite):
* HAUBE (x 0–17, y 3–22): oben violette Kante (115,64,143)/(131,80,159), darunter schwarzes Haar/Innenfutter (y 5–15); seitlich weiße Haubenflügel (225–237) mit goldenem Saum
  (185,143,43)/(215,188,99)/(175,128,36) bei x 0–1 und 16–17, y 11–22.
* GESICHT (x 6–11, y 11–18): AUGEN je 2×2 — links (6–7, 12–13), rechts (10–11, 12–13): hellgrau/weiß mit dunkelrot-roter Iris ((113,33,32)/(143,42,56)); dazwischen Nasenrücken (grau/lila,
  (8–9, 12–14)); darunter violette Schatten (y 14); MUND (8–9, y 15–18) dunkelrot mit weißen Zähnen bei x 7 und 10 (y 16–18).
* HALS (x 6–11, y 19–30): grauer Zylinder (52,54,53) | (96,100,101) | (174,174,174) | (202,202,202) | (225,229,228) | (52,54,53) — sechs senkrechte Streifen.
* SCHALENSPIRALE (x 0–17, y 28–39): schwarzer Wulst mit weißen/grauen Zacken (Zähnen) bei x 1–3 und 13–15 und einem grauen Auslauf nach unten (x 6–17, y 35–39); gehört zur Figur, bleibt fest.
* SCHWANZ (x 18–31, y 21–39): grauweißer Bogen, der unten aus der Spirale ansteigt, als senkrechter Balken (x 28–31, y 24–29) nach oben läuft und in einer Schlinge
  (x 24–30, y 21–24) um den Stab endet; er liegt im unteren Teil HINTER dem Stab, die Schlinge (y 21–23) VOR dem Stab.
* STAB (x = 27, y 0–38): Spitze (46,46,46)/(210,215,221) y 0–7, violette Muffe (37,18,48) y 8–9, goldener Knoten (108,98,0)/(131,114,26) y 10–12, grüner Schaft (72,116,53) → (9,26,2) y 13–38.
* DREIZACK (x 21–33, y 3–14): violette Zinken (49,31,53)/(109,76,131)/(206,193,213) fächern sich vom Knoten aus.

Ablauf (48 Frames à 80 ms = 3,84 s, nahtlos):
* KOBRA STEIGT UND SCHWANKT: Haube + Hals heben sich in zwei Stufen um bis zu 2 px (Hals-Zeile 25 wird 1–2× eingefügt; die Hals-Streifen sind senkrechte Verläufe, also keine sichtbare
  Zeilenkopie) und schwanken dabei langsam (Periode 48): jede Zeile von y 27 aufwärts wandert waagerecht, oben bis ±2 px (Scherung, benachbarte Zeilen ≤ 1 px Unterschied, die Haube schwingt
  als Ganzes). Das ist eine Schlange, kein Humanoider — sie darf pendeln.
* SCHWANZ: die Schlinge und der Balken (y 21–33) schwingen als Scherung um die Spirale (Periode 16, drei Wellen je Schleife, oben bis ±2 px); die Schlinge bleibt dabei starr beisammen und
  um den Stab gelegt; hinter dem Stab verlaufende Teile werden nur dort sichtbar, wo der Schwanz wirklich liegt.
* BLINZELN: Frames 30–32 (Lid = Hellgrau (174,174,174), erst obere Reihe, dann beide).
* GOLD GLÄNZT (Regel 12): ein Lichtband läuft (Frames 6–19) über das goldene Haubensaum-Paar (eine Stufe auf der Goldrampe); ein vierzackiger Stern blitzt am goldenen Stabknoten (Frames 22–26)
  und an der metallischen Stabspitze (Frames 38–42) auf.
Frame 0 = Ruhepose (Original).

Ergänzungen (Koordinaten im Sprite):
* Stab hinter der Schlinge: (27,21) (57,96,39), (27,22) (57,96,39), (27,23) (44,85,29) — grüner Schaft, den die Schwanzschlinge im Original verdeckt (Ebene 96).
* Schwanz hinter dem Stab: (27,28) (52,54,53), (27,29) (225,229,228), (27,30) (202,202,202), (27,31) (174,174,174), (27,32) (96,100,101), (27,33) (52,54,53) — Schwanzpixel, die der Stab
  verdeckt (Ebene 95); sie sind nur ergänzt, damit der Schwanz beim Schwingen lückenlos bleibt (in der Ruhepose liegt der Stab darüber).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError, wenn etwas herausragen würde). Nur ganze Pixel, nur Farben der Quelle.
"""
import os
import sys

import numpy as np

import anim_amorph as A
import anim_gbb as G
import anim_humanoide as Hm
import anim_lib as L

N, MS = 48, 80
PAD_L, PAD_R, PAD_T, PAD_B = 5, 5, 6, 4

spr = L.lade('guardian-beast-she')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
OFF = (PAD_L, PAD_T)
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
ERLAUBT = Hm.umrissfarben(spr)
UMRISS = (0, 0, 0)

SCHAFT_X = 27
stab_oben = vorhanden & (xx >= 21) & (yy <= 20)                                   # Dreizack + Schaft bis y 20
schaft_vorn = vorhanden & (xx == SCHAFT_X) & (yy >= 24)                           # Schaft vor dem Schwanz (y 24–38)
schwanz_m = vorhanden & ~stab_oben & ~schaft_vorn & (xx >= 19) & (yy >= 21)
kopf_m = vorhanden & ~stab_oben & ~schaft_vorn & ~schwanz_m & (xx <= 18) & (yy <= 27)
unten_m = vorhanden & ~stab_oben & ~schaft_vorn & ~schwanz_m & ~kopf_m          # Spirale, Halsansatz, Schwanzansatz

ERG_STAB = {(27, 21): (57, 96, 39), (27, 22): (57, 96, 39), (27, 23): (44, 85, 29)}
ERG_SCHWANZ = {(27, 28): (52, 54, 53), (27, 29): (225, 229, 228), (27, 30): (202, 202, 202),
               (27, 31): (174, 174, 174), (27, 32): (96, 100, 101), (27, 33): (52, 54, 53)}


def f(x, y):
    return tuple(int(v) for v in spr[y, x, :3])


LID = f(8, 12)                                                                     # Hellgrau neben den Augen
AUGEN = [(6, 12), (7, 12), (10, 12), (11, 12), (6, 13), (7, 13), (10, 13), (11, 13)]
GOLD = [(175, 128, 36), (185, 143, 43), (215, 188, 99)]                           # Goldrampe des Haubensaums
GOLD_M = vorhanden & (xx <= 18) & (yy <= 28) & L.farbmaske(spr, GOLD)


def ebene(m, dx=0, dy=0):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, PAD_L + dx, PAD_T + dy)


def frame(i):
    # ── Stab: Dreizack + oberer Schaft (hinter dem Schwanz) ──
    stab = ebene(stab_oben)
    Hm.setze(stab, ERG_STAB, OFF)
    # Glitzer: Stern am goldenen Knoten und an der Spitze
    st = Hm.folge(i, 22, [0, 1, 2, 1, 0], N)
    if st is not None:
        Hm.stern4(stab, SCHAFT_X, 11, st, (215, 188, 99), (185, 143, 43), (185, 143, 43), OFF)
    st = Hm.folge(i, 38, [0, 1, 2, 1, 0], N)
    if st is not None:
        Hm.stern4(stab, SCHAFT_X, 3, st, (210, 215, 221), (173, 177, 188), (173, 177, 188), OFF)
    vorn = ebene(schaft_vorn)

    # ── Schwanz: Scherung um y 34, Schlinge starr ──
    sw_ = ebene(schwanz_m)
    Hm.setze(sw_, ERG_SCHWANZ, OFF)
    ph = L.sinus(i, 16)
    ys = range(PAD_T + 21, PAD_T + 34)
    dxs = G.gefaelle(ys, PAD_T + 34, 2.0, ph, potenz=1.0)
    for y in range(PAD_T + 21, PAD_T + 25):                                         # Schlinge: starr mit Zeile 25
        dxs[y] = dxs[PAD_T + 25]
    sw_ = G.zeilen_dx(sw_, dxs)

    # ── Kopf: Gold-Lichtband, Blinzeln, Steigen, Schwanken ──
    kopf = ebene(kopf_m)
    Hm.lichtband(kopf, GOLD_M, OFF, i, N, 6, 14, GOLD, stufen=1, breite=3.0, achse=(1.0, 1.0))
    k = Hm.folge(i, 30, [1, 2, 1], N)
    if k:
        Hm.setze(kopf, {p: LID for p in AUGEN if k == 2 or p[1] == 12}, OFF)
    r = int(round(2 * (0.5 - 0.5 * np.cos(L.sinus(i, 24)))))                    # 0…2 px, zweimal je Schleife
    kopf = L.streck_zeile(kopf, PAD_T + 25, r)
    kd = G.gefaelle(range(PAD_T + 3 - r, PAD_T + 28), PAD_T + 27, 2.0, L.sinus(i, N), potenz=1.0)
    kopf = G.zeilen_dx(kopf, kd)

    unten = ebene(unten_m)
    fig = L.zusammen(H, W, [(stab, 0, 0), (sw_, 0, 0), (kopf, 0, 0), (unten, 0, 0), (vorn, 0, 0)])
    fig, _ = A.verbinde4(fig)
    G.rand_schliessen(fig, ERLAUBT, UMRISS)
    return fig


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    diff = Hm.ruhepose(frames[0], spr, OFF)
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    e0 = Hm.eckkontakt_typen(frames[0])
    neu = {i: dict(Hm.eckkontakt_typen(g) - e0) for i, g in enumerate(frames) if Hm.eckkontakt_typen(g) - e0}
    print('neue Eckkontakte gegenüber Frame 0:', neu if neu else 'keine')
    L.speichern('guardian-beast-she', 'Guardian Beast She', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/guardian-beast-she-strip.png', frames, spalten=12, scale=3)
