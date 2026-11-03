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
* Feuer (Regel 15/40, Modul anim_feuer2.py — Feuer von Hand, Nutzerkorrektur Runde 3): das gemalte Feuer des Standard-Sprites (Mähne und Schweif) ist die Vorlage, jede Zunge wird einzeln animiert statt neu erfunden.
  MÄHNE (Flamme zeigt nach oben): Streifen von 3 px Breite entlang Rücken, Hals und Kopf (Fuß = Körperkante, Spitze = höchstes Pixel), die Posenfolgen laufen als Welle vom Kopf zum Rücken; SCHWEIF (Zeilen y ≥ 20, zeigt nach links): Streifen von 3 Zeilen,
  Fuß am Hinterteil. Je Zunge 12 handgesetzte Posen (Länge, Neigung, S-Kurve, Kernhub) à 2–3 Frames, zeitversetzt; Spitzen reißen ab und steigen als Funken auf (Mähne nach oben, Schweif: erst nach links, dann aufwärts).
* Atmen zweistufig 0-1-2-1-0 px (Periode 24, zweimal pro Schleife): die Bauchzeile y 25 wird 1–2× eingefügt (anim_lib.streck_zeile mit Texturmischung); Rücken, Hals, Kopf, Mähne und Schweifansatz steigen, Beine und Hufe bleiben am Boden.
* Kopf nickt (je ein Nicken Frame 6–9 und 30–33, +1 px): Hals-/Kopfspalten x ≥ 29 oberhalb y 21 (samt Flamme) sinken 1 px; der Kopf bewegt sich nie seitlich. Keine Ohren im Sprite (von der Mähne verdeckt).
* Blinzeln (Lid = Kopfgrau (46,46,46)): das rote Auge Frame 14–16 und 38–40.
* Vorderhuf scharrt (Frame 18–22 und 42–46): das helle Vorderbein (x 26–29) wird 1 px kürzer (Zeile 36 entfällt), der Huf hebt sich; das Bein bleibt an der Brust.
Kein Glanz (Huf/Fell/Feuer — Regel 14).
ERGÄNZUNG: keine gemalten Pixel nötig (die Flammen entstehen aus der gemalten Vorlage). Randpixel-Test: anim_untote.kontur_schliessen (Umrissfarben der Quelle); Flammenränder = Umrissfarbe (202,44,41).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Zuschnitt auf die Figur (Funken gehören zum Feuer).
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_untote as U
import anim_feuer2 as FE2
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

# --- Feuer (anim_feuer2: die gemalte Flamme der Quelle wird Zunge für Zunge animiert) ---
fixiert = np.zeros((H, W), bool)
fixiert[GPT:GPT + sh, GPL:GPL + sw] = koerper
SPERRE = fixiert.copy()


def flamm_vorlage(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, GPL, GPT)


RGBA_M, RGBA_T = flamm_vorlage(flamme_alt & (yy <= 19)), flamm_vorlage(flamme_alt & (yy >= 20))
# Mähne: Streifen von 3 px Breite (Fuß = Körperkante, Spitze = höchstes Pixel), die Posen laufen als Welle vom Kopf zum Rücken (negative Verzögerung);
# Schweif: waagerechte Streifen von 3 Zeilen, die Zungen zeigen vom Hinterteil nach links (Fuß an der Körperkante), zucken auf und ab.
VL_M = FE2.Vorlage(RGBA_M, FE2.zungen_baender(RGBA_M, 'hoch', breite=3, versatz=0), 'hoch', rand_farbe=ROT, sperre=SPERRE, welle=(-1.3, 1.0), faden=2)
VL_T = FE2.Vorlage(RGBA_T, FE2.zungen_baender(RGBA_T, 'links', breite=3, versatz=0), 'links', rand_farbe=ROT, sperre=SPERRE, welle=(1.5, 1.0), faden=2)
FEUER = FE2.Feuer([VL_M, VL_T], n=N, seed=31, bank='zunge', amp=1.0, max_funken=9)


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
    fl = L.versetze(FEUER.ebene(i), 0, -n)
    f = L.zusammen(H, W, [(bein, 0, 0), (kp, 0, 0)])
    f = L.zusammen(H, W, [(fl, 0, 0), (f, 0, 0)])
    nick = 1 if (6 <= i <= 9 or 30 <= i <= 33) else 0
    f = nicken(f, nick)
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    fk = FEUER.funken(i, dy=lambda f: -U.stufe(f, 24, 2))
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
