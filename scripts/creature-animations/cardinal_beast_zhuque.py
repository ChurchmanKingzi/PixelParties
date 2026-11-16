# -*- coding: utf-8 -*-
"""Idle-Animation für „Cardinal Beast Zhuque“ (Creature) — der Vermilion-Vogel des Südens: ein roter Feuervogel von vorn mit zum V gespreizten Flügeln, Federkleid in Rot/Lachs/Pfirsich,
gelb-pfirsichfarbenen Flügelvorderkanten, einem Kopf mit Krone in der Mitte und zwei gekrümmten dunklen Fängen (Krallen) unten.

Quelle: src/cardinal-beast-zhuque.png (59×44 px, 16 Farben).
PICK: [["MotiveEgypt", 4, 1]]      (Ebene „Zhuque #1“, Figur 1; Ebene 3 „Zhuque #2“ ist der weich verlaufende Feuerring der Kartenkunst (Alpha 50 %), Ebene 5 „Zhuque“ ein Bodenschatten — beides Szene)
Quelle vollständig: ja (Flügel, Körper, Kopf, Krallen in einer Ebene).

Aufruf:   python3 cardinal_beast_zhuque.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cardinal-beast-zhuque.png + .json

Identifikation (x, y im 59×44-Sprite, spiegelsymmetrisch um x = 29):
* FLÜGEL (links x 0–25, rechts x 34–58, y 0–38): zum V gespreizte Flügel mit gezackter Außenkante (dunkelrot (111,19,8) / braun (123,62,0)); Federreihen in Dunkelrot (134,51,37), Lachs (160,74,61)/(201,103,64)/
  (216,129,101), Pfirsich (230,138,87)/(247,145,83); die VORDERKANTE (von den oberen Flügelspitzen bei (0–9, 0) schräg nach innen unten bis (24, 23)) ist ein helles Band aus
  Pfirsich/Gelb (255,190,91)/(255,200,131)/(247,145,83) mit braunem Innenrand (123,62,0).
* KÖRPER (x 26–33, y 18–43): schmaler Körper mit dunkelrotem Umriss (111,19,8); Kopf mit Federkrone (y 18–21, Zacken bei x 28/30/32), Gesicht y 22–27 mit vier hellrosa Pixeln (220,160,149) bei (27,24), (32,24),
  (27,26), (32,26) — sie könnten Augen sein; sicher ist es nicht, deshalb bleiben sie fest; Brustfedern y 28–35.
* KRALLEN (x 21–28 und 31–38, y 35–42): zwei gekrümmte dunkelgraue Fänge (55,59,70)/(68,73,79)/(90,90,92) mit schwarzem Umriss (35,12,0); Schwanzspitze/Schnabel mittig bei (28–30, 41–43).
Metall/Gold/Edelsteine: keine → kein Glanz (Regel 14). Feuer: der Vogel trägt kein Feuer im Sprite. RUNDE 3 (Nutzer: „muss mehr mit den Flügeln schlagen, die Flammen weg“): die früheren Flammen an den Flügelspitzen sind
ENTFERNT (Code und Funken gestrichen).

Ablauf (48 Frames à 70 ms = 3,36 s, nahtlos) — RUNDE 3:
* FLÜGELSCHLAG (kräftig): drei Schläge pro Schleife (Periode 16 Frames = 1,12 s; Abschlag 6 Frames, Aufschlag 10). Jeder Flügel schwingt als Ganzes um die Schulter ((24,27) links, (34,27) rechts) — von fast senkrecht nach oben
  (25° über der Ruhelage) bis weit nach unten außen (70° unter die Ruhelage: Spitze zeigt dann waagerecht nach außen, der Flügel hängt dabei). Vorher nur ein Spaltenversatz um ±5 px. Technik wie beim Lunatic Hawk: Rückwärtsabbildung (Nächster-Nachbar,
  `F.drehen(glatt=True)`), keine Mischfarben, keine Löcher. Die SCHULTER (Flügelpixel im Umkreis von 9 px um (24,27)/(34,27) sowie der Flügelansatz am Körper) bleibt als Teil des Körpers stehen und hebt sich nur mit ihm — so reißt der Flügel
  nie vom Rumpf ab (keine Lücke); am frei liegenden Rand der Schulter werden fehlende Umrisspixel in Dunkelrot (111,19,8) ergänzt. Frame 0 liegt auf dem Aufschlag bei 26 % des Hubs und ist exakt die Originalpose.
  RUNDE 4 (Nutzer: „Die Flügel beginnen näher am Körper.“): Das Gelenk sitzt jetzt direkt am Körperrand ((25,27) links, (33,27) rechts; Körper x 26–33) und nur noch ein 3-px-Gelenkkern (statt 9 px Schulter) sowie der
  2 px breite Ansatzstreifen am Rumpf (x 24–25 / 34–35, y ≥ 24) bleiben stehen — der GANZE Flügel ab Körperansatz schlägt (Regel 46). Die beiden Fänge (Farben (55,59,70)/(68,73,79)/(90,90,92)/(35,12,0)) und der Unterleib
  zwischen ihnen (x 22–37, y ≥ 33) gehören zum Körper und schlagen nicht mit. Die Angaben „(24,27)/(34,27)“ und „Umkreis 9 px“ oben sind damit überholt.
  RUNDE 5 (Nutzer: „Unten entstehen jetzt sehr große Lücken zwischen Flügeln und Körper.“): KEINE starre Drehung mehr (alles oben zu Drehung/Schulterkern ist überholt). Die Flügel werden GEFÄCHERT
  (anim_r5_fluegel2.faechern): Gelenk (25,5|24) / (32,5|24) am oberen Ende des Flügelansatzes, die Körperkante des Flügels bleibt stehen, die Vorderkante schwingt als Ganzes um das Gelenk (25° über bis 55° unter
  die Ruhelage), alle Federn dazwischen folgen anteilig — der Flügel liegt in jeder Pose auf ganzer Länge am Rumpf an. Rechter Flügel = exaktes Spiegelbild (Sprite ist um x = 29 spiegelgleich).
  Federn hinter Unterleib/Fängen stehen zusätzlich im Flügel-Layer; Kerben neben dem Unterleib werden geschlossen. Schweben: Hub 2 px (±1 um die Ruhelage).
* SCHWEBEN: der ganze Vogel hebt sich beim Abschlag um bis zu 2 px (Schulter, Körper, Krallen), zweistufig, Krallen schwingen dabei ein Frame nach.
* Keine Flammen, keine Partikel, kein Glanz.
Ergänzungen: nur Umrisspixel (Dunkelrot) an der freigelegten Schulterkante; Randpixel (Regel 16): anim_flieger.umranden. Alle Bewegungen laufen auf der vollen Leinwand (anim_lib / F.drehen werfen ClipError). Nur Farben der Quelle.
Zuschnitt: der Frame ist auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px).
"""
import math
import sys

import numpy as np

import anim_flieger as F
import anim_lib as L
import anim_flieger_r3 as R3
import anim_r4_fluegel as AR
import anim_r5_fluegel2 as R5

N, MS = 48, 70
BEAT, DOWN, UP = 16, 6, 10
AUF, AB = 25.0, 55.0                                    # Runde 5: Vorderkante hebt sich bis 25° über die Ruhelage und senkt sich bis 55° darunter (dann etwa waagerecht)
HUB = AUF + AB
P0 = DOWN + (math.acos(2.0 * AUF / HUB - 1.0) / math.pi) * UP    # Frame 0: Aufschlag an der Stelle, an der der Fächer genau die Originalpose ist
GPL, GPR, GPT, GPB = 16, 16, 14, 8

spr = L.lade('cardinal-beast-zhuque')
sh, sw = spr.shape[:2]
H, W = sh + GPT + GPB, sw + GPL + GPR
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)
UMRISS = F.umriss_farben(spr)
DUNKEL, BRAUN = (111, 19, 8), (123, 62, 0)

# Runde 5 (Nutzer: „Unten entstehen jetzt sehr große Lücken zwischen Flügeln und Körper.“): Die Flügel werden nicht mehr starr um die Schulter gedreht (dabei schwenkte der untere, am Rumpf
# angewachsene Flügelteil vom Körper weg), sondern GEFÄCHERT (anim_r5_fluegel2.faechern): Gelenk am oberen Ende des Flügelansatzes ((25,5|24) links, (32,5|24) rechts; der Sprite ist um x = 29
# spiegelgleich, Körper x 26–32), die Körperkante des Flügels (vom Gelenk senkrecht nach unten) bleibt stehen, die Vorderkante schwingt als Ganzes um das Gelenk, alle Federn dazwischen folgen
# anteilig. So liegt der Flügel in JEDER Pose auf ganzer Länge am Rumpf an. Die Federn hinter Unterleib/Fängen (x 22–36, y ≥ 33) stehen zusätzlich im Flügel-Layer (Federtextur des Originals),
# damit auch dort nie Hintergrund frei wird.
ACHSE2 = sw - 1                                          # Spiegelachse x = 29
wing_l = vorhanden & (xx <= 25)
wing_r = vorhanden & (xx >= ACHSE2 - 25)
koerper_m = vorhanden & ~wing_l & ~wing_r
PIV_L, PIV_R = (25.5, 24.0), (ACHSE2 - 25.5, 24.0)
KRALLE_F = L.farbmaske(spr, [(55, 59, 70), (68, 73, 79), (90, 90, 92), (35, 12, 0)])
UNTERLEIB = vorhanden & (xx >= 22) & (xx <= ACHSE2 - 22) & (yy >= 33)
fl_l_m, fl_r_m = wing_l & ~KRALLE_F, wing_r & ~KRALLE_F
WINKEL0 = math.degrees(math.atan2(25.5 - 8.0, 24.0 - 1.0)) + 90.0     # Winkel der Vorderkante zur Körperkante in der Ruhelage (≈ 127°)


def teil(m):
    t, _ = L.trenne(spr, m)
    return L.platz(t, H, W, GPL, GPT)


FL_L, FL_R, KP0 = teil(fl_l_m), teil(fl_r_m), teil(koerper_m | KRALLE_F | UNTERLEIB)
assert (L.zusammen(H, W, [(FL_L, 0, 0), (FL_R, 0, 0), (KP0, 0, 0)])[GPT:GPT + sh, GPL:GPL + sw] == spr).all()


def _orig_loecher():
    """Schon im Original vorhandene eingeschlossene Lücken (Leinwandkoordinaten): bleiben unangetastet."""
    m = np.zeros((H, W), bool)
    m[GPT:GPT + sh, GPL:GPL + sw] = vorhanden
    return R3.eingeschlossen(m)


ORIG_LOECHER = _orig_loecher()


def welle(t):
    """0 = Flügel ganz oben … 1 = ganz unten: Abschlag in DOWN Frames, Aufschlag in UP Frames (Cosinus-weich)."""
    u = (t + P0) % BEAT
    if u < DOWN:
        return 0.5 - 0.5 * math.cos(math.pi * u / DOWN)
    return 0.5 + 0.5 * math.cos(math.pi * (u - DOWN) / UP)


def winkel(t):
    """Auslenkung der Flügelvorderkante in Grad (positiv = gehoben, negativ = gesenkt); 0 bei Frame 0."""
    return AUF - HUB * welle(t)


def faktor(t):
    """Fächerfaktor: Winkel jeder Feder zur Körperkante × faktor (1 = Original)."""
    w = winkel(t)
    return 1.0 if abs(w) < 0.5 else (WINKEL0 + w) / WINKEL0


def bob(t):
    """Schweben: der ganze Vogel steigt kurz nach dem Abschlag und sinkt beim Aufschlag (Hub 2 px, ganzzahlig); Frame 0 = 0."""
    return int(round(2.0 * welle(-1.5))) - int(round(2.0 * welle(t - 1.5)))


_fl_cache = {}


def fluegel(t):
    k = round(faktor(t), 4)
    if k not in _fl_cache:
        wl = R5.faechern(FL_L, GPL + PIV_L[0], GPT + PIV_L[1], k, 1)
        if k != 1.0:
            wl = R5.glatt(wl)
        _fl_cache[k] = (wl, AR.spiegeln(wl, 2 * GPL + ACHSE2))            # rechter Flügel = exaktes Spiegelbild
    return _fl_cache[k]


def frame_gross(i, nur=None):
    wl, wr = fluegel(i)
    b = bob(i)
    wl, wr, kp = L.versetze(wl, 0, b), L.versetze(wr, 0, b), L.versetze(KP0, 0, b)
    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0)])
    f = R3.luecken_fuellen(f, 8, ausser=np.roll(ORIG_LOECHER, b, axis=0))
    # Kerben zwischen Flügelunterkante und Unterleib (Zeilen y 24–39): Hintergrundpixel, die in ihrer Zeile links und rechts Figur haben, mit der Farbe des äußeren Nachbarn schließen
    cx = GPL + ACHSE2 // 2
    sp = R5.zeilen_luecken(f, cx - 14, cx + 14)
    sp[:GPT + b + 24] = False
    sp[GPT + b + 40:] = False
    sp &= ~np.roll(ORIG_LOECHER, b, axis=0)
    for y, x in sorted(zip(*np.nonzero(sp)), key=lambda q: abs(q[1] - cx), reverse=True):
        xa = x - 1 if x < cx else x + 1
        f[y, x] = f[y, xa]
    if faktor(i) != 1.0:
        F.umranden(f, [wl, wr, f * sp[..., None]], UMRISS, BRAUN, DUNKEL, DUNKEL)
    return f


def zuschneiden(frames, rand=2):
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames], (x0, y0)


_alle = [frame_gross(i) for i in range(N)]
_zug, _off = zuschneiden(_alle)
PAD_L, PAD_T = GPL - _off[0], GPT - _off[1]


def frame(i, nur=None):
    return _zug[i % N].copy()


if __name__ == '__main__':
    import os
    frames = [frame(i) for i in range(N)]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, min_rand=2)
    print('Pixel je Frame:', n)
    r0 = frames[0]
    ox, oy = PAD_L, PAD_T
    diff = [(x, y) for y in range(sh) for x in range(sw)
            if bool(r0[y + oy, x + ox, 3]) != bool(spr[y, x, 3]) or (spr[y, x, 3] and not np.array_equal(r0[y + oy, x + ox, :3], spr[y, x, :3]))]
    print('Ruhepose weicht vom Original ab bei:', diff if diff else 'nichts')
    L.speichern('cardinal-beast-zhuque', 'Cardinal Beast Zhuque', frames, MS, prev)
    if prev:
        os.makedirs(prev, exist_ok=True)
        L.streifen(prev + '/cardinal-beast-zhuque-strip.png', frames, spalten=8, scale=3)
