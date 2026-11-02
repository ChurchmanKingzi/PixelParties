# -*- coding: utf-8 -*-
"""Idle-Animation für „Night Mare“ (Creature) — schwarzes Reittier mit brennender Mähne und brennendem Schweif, Regeln 14/15/16 (Feuer wie Feuer, kein Glanz).

Quelle: src/night-mare.png — Ebene „Night Mare“ (42×40 px, 956 Pixel, 12 Farben) aus MotiveSteamDwarfs.xcf (Ebene 25, Figur 1; Treffer 0.972, getönt). Die Kartenkunst (data/card-art/native/Night_Mare.png) zeigt dasselbe Pferd im Profil nach RECHTS.
PICK: [["MotiveSteamDwarfs", 25, 1]]
Die Quelle war vollständig (Pferd mit Flammenmähne und Flammenschweif, eine Ebene, kein Beiwerk).

Aufruf:   python3 night_mare.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/night-mare.png + .json

Was ist was (x/y im Sprite):
* Pferdekörper (x 8–41, y 8–39): schwarz (0,0,0) mit grauen Schattierungen ((29,29,29)/(34,34,34)/(46,46,46)/(58,58,58)); Kopf rechts (x 28–41, y 8–20) mit Schnauze nach rechts, rotes Auge (156,0,0)/(102,0,0) bei (34,13) (34,14) (35,14);
  Hals steigt von (25,18) zum Kopf (31,8); Rumpf (x 11–33, y 20–32); Vorderbeine (hell: x 26–29, y 33–39; dunkle Fernseite x 31–34), Hinterbeine (x 12–16; Fernseite x 8–10) mit grauen Hufen (106,106,106) (y 38).
* Flammenmähne (x 4–41, y 0–19): auf dem Rücken, am Hals und über dem Kopf; Farben Rot (202,44,41) = Außenhaut, Orange (244,123,34), Gelb (246,231,14), Creme (247,245,184) = heller Kern (am Gesicht entlang).
* Flammenschweif (x 0–12, y 20–39): hängt am Hinterteil schräg nach unten links, oben breit, nach unten spitz.
Fest bleiben: Beine (außer dem anhebbaren Vorderhuf), Körperform.

Ablauf (48 Frames à 65 ms = 3,12 s; Frame 0 = Original, die Flammen sind ausgenommen):
* Feuer (Regel 15, Modul anim_feuer.py unverändert benutzt): die MÄHNE wird NEU gezeichnet aus 13 Flammenzungen, deren Füße auf der Körperkontur (Rücken, Hals, Kopf) stehen (Höhe 6–14 px, am Hals am höchsten);
  der SCHWEIF aus 3 Zungen, deren Fuß am Hinterteil steht; weil er nach unten hängt, läuft das Modul dafür auf einer senkrecht gespiegelten Leinwand (wie bei Ifrit/Future Tech Drone). Jede Zunge: fünf Farbschichten
  (Rot-Außenhaut, Orange, Gelb, Creme-Kern), 12 Posen à 2–3 Frames, gegeneinander versetzt, Spitzen laufen spitz zu und reißen als Funken (1 px, Regel 15) ab, die steigen (Mähne) bzw. fallen (Schweif) und abkühlen.
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 25 wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Rücken, Hals, Kopf, Mähne und Schweifansatz steigen, Beine und Hufe bleiben am Boden.
* Kopf nickt (je ein Nicken Frame 6–9 und 30–33, +1 px): Hals-/Kopfspalten x ≥ 29 oberhalb y 21 (samt Flamme) sinken 1 px; der Kopf bewegt sich nie seitlich. Keine Ohren im Sprite (von der Mähne verdeckt).
* Blinzeln (Lid = Kopfgrau (46,46,46)): das rote Auge Frame 14–16 und 38–40.
* Vorderhuf scharrt (Frame 18–22 und 42–46): das helle Vorderbein (x 26–29) wird 1 px kürzer (Zeile 36 entfällt), der Huf hebt sich; das Bein bleibt an der Brust.
Kein Glanz (Huf/Fell/Feuer — Regel 14).
ERGÄNZUNG: keine gemalten Pixel nötig (die Flammen werden neu aus Quellfarben gezeichnet). Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle); Flammenränder = Umrissfarbe (202,44,41).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Funken gehören zum Feuer).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer as FEU
import anim_daemon as D

N, MS = 48, 65
GPL, GPR, GPT, GPB = 5, 5, 13, 9

spr = L.lade('night-mare')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
col = lambda x, y: tuple(int(v) for v in spr[y, x, :3])
UMRISS = U.umrissfarben(spr)
KONTUR = (0, 0, 0)
ROT, ORANGE, GELB, CREME = (202, 44, 41), (244, 123, 34), (246, 231, 14), (247, 245, 184)
KOPFGRAU = (46, 46, 46)
AUGE = [(34, 13), (34, 14), (35, 14)]
assert all(col(x, y) in {(156, 0, 0), (102, 0, 0)} for (x, y) in AUGE)
flamme_alt = vorhanden & L.farbmaske(spr, [ROT, ORANGE, GELB, CREME])
koerper = vorhanden & ~flamme_alt
bein1 = koerper & (xx >= 26) & (xx <= 29) & (yy >= 33)
bein1[:, :] &= True
rest = koerper & ~bein1

# --- Feuer ---
RAMPE = {'rand': ROT, 'rot': ROT, 'orange': ORANGE, 'gelb': GELB, 'hell': CREME}
fy = lambda y: H - 1 - y
fixiert = np.zeros((H, W), bool)
fixiert[GPT:GPT + sh, GPL:GPL + sw] = koerper
SPERRE = fixiert.copy()
SPERRE_F = fixiert[::-1].copy()
# Mähne: (x, Fußzeile (Körperoberkante), Höhe, Halbbreite)
MAEHNE = [(8.5, 20, 6.0, 1.6), (11.0, 20, 7.0, 1.7), (13.5, 19, 8.0, 1.8), (16.0, 19, 9.0, 1.9), (18.5, 19, 9.0, 1.9), (21.0, 19, 12.0, 2.0), (23.5, 19, 14.0, 2.1),
          (26.0, 17, 14.0, 2.1), (28.2, 14, 11.0, 1.9), (30.6, 9, 8.0, 1.8), (33.0, 8, 7.0, 1.8), (35.3, 10, 8.0, 1.8), (37.6, 12, 7.0, 1.7), (39.8, 14, 6.0, 1.5)]
FEUER_M = FEU.Feuer(H, W, [FEU.Zunge(GPL + x, GPT + b, h, w) for (x, b, h, w) in MAEHNE], RAMPE, n=N, seed=31, posen=12, amplitude=1.0, sperre=SPERRE)
BASIS_T = fy(GPT + 21)
SCHWEIF = [(3.2, 11.5, 1.8), (5.8, 17.0, 2.2), (8.6, 12.0, 1.9)]
FEUER_T = FEU.Feuer(H, W, [FEU.Zunge(GPL + x, BASIS_T, h, w) for (x, h, w) in SCHWEIF], RAMPE, n=N, seed=32, posen=12, amplitude=0.95, sperre=SPERRE_F)


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)                           # sofort auf die volle Leinwand


T_REST, T_BEIN1 = teil(rest), teil(bein1)


def nicken(f, dy):
    """Hals-/Kopfspalten x ≥ 29 oberhalb y 21 (samt Flamme darüber) sinken dy px (nur nach unten: die Pixel darunter werden überdeckt)."""
    if not dy:
        return f
    out = f.copy()
    x0, y1 = GPL + 29, GPT + 21
    blk = f[:y1, x0:].copy()
    out[:y1, x0:] = 0
    for y in range(blk.shape[0]):
        for x in range(blk.shape[1]):
            if blk[y, x, 3]:
                out[y + dy, x0 + x] = blk[y, x]
    # unterhalb y1 liegende Pixel bleiben: das Nicken überdeckt dort nur
    unten = f[y1:, x0:]
    m = unten[..., 3] > 0
    keep = m & ~(out[y1:, x0:, 3] > 0)
    out[y1:, x0:][keep] = unten[keep]
    return out


def frame_gross(i, nur=None):
    n = U.stufe(i, 24, 2)
    kp = T_REST.copy()
    if i in (14, 15, 16, 38, 39, 40):
        for (x, y) in AUGE:
            kp[GPT + y, GPL + x, :3] = KOPFGRAU
    kp = L.streck_zeile(kp, GPT + 25, n)
    bein = T_BEIN1
    if (18 <= i <= 22) or (42 <= i <= 46):
        bein = L.heben_unten(T_BEIN1, GPT + 36, 1)
    mae = FEUER_M.ebene(i)
    sch = D.flip_v(FEUER_T.ebene(i))
    fl = L.zusammen(H, W, [(sch, 0, -n), (mae, 0, -n)])
    f = L.zusammen(H, W, [(bein, 0, 0), (kp, 0, 0)])
    f = L.zusammen(H, W, [(fl, 0, 0), (f, 0, 0)])
    nick = 1 if (6 <= i <= 9 or 30 <= i <= 33) else 0
    f = nicken(f, nick)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    fk = L.zusammen(H, W, [(FEUER_M.funken(i, dy=-n, leben=12), 0, 0), (D.flip_v(FEUER_T.funken(i, dy=0, leben=10)), 0, -n)])
    return L.zusammen(H, W, [(fk, 0, 0), (f, 0, 0)])


BOX = U.zuschnitt([frame_gross(i) for i in range(N)], [frame_gross(i) for i in range(N)], (GPL, GPT, GPL + sw, GPT + sh))
PAD_L, PAD_T = GPL - BOX[0], GPT - BOX[1]
TEST_EBENEN = 'koerper'


def frame(i, nur=None):
    return U.beschneiden(frame_gross(i, nur), BOX)


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.pruefe(frames, quelle=spr, min_rand=1)
    L.speichern('night-mare', 'Night Mare', frames, MS, prev)
    if prev:
        L.streifen(prev + '/night-mare-strip.png', [frames[k] for k in (0, 6, 12, 18, 24, 30, 36, 42)], spalten=2, scale=8)
