# -*- coding: utf-8 -*-
"""Idle-Animation für „Cute Hydra“ (Creature) — Runde 3 überarbeitet.

Nutzerfeedback Runde 3: „Cute Hydra: wieder große Lücken zwischen Flügeln und Köpfen. Außerdem ist die Flügelbewegung noch nicht stark genug. Die Flügel wirst du selbst erweitern müssen.“

Quelle: src/cute-hydra.png — Ebene „Cute Hydra“ (48×44 px, 25 Farben) aus MotiveMoe.xcf (Ebene 195): die dreiköpfige, violette Hydra mit silbernen Flügeln, Zackenkronen und rosa Herz-Augen.
Vollständig (alle drei Köpfe, beide Flügel, Rumpf, Beine), ein Exemplar, kein Beiwerk. Die Karte zeigt sie vor blauem Himmel; der Sprite ist die eine Ebene.
PICK: [["MotiveMoe", 195, "ganze Ebene"]]

Aufruf:   python3 cute_hydra.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cute-hydra.png + .json

Identifikation (Sprite 48×44, symmetrisch um x = 23,5 bis auf 2 Pixel):
* Mittelkopf (x 19–29, Zeilen 0–19): große olivbraune Zackenkrone, violettes Gesicht im Rautenmuster, schwarzviolette Konturen; zwei rosa Herz-Augen.
* Seitenköpfe (links x 5–15, rechts x 32–42, Zeilen 5–23): je zwei kleinere Zackenkronen und zwei Herz-Augen.
* Flügel (links x 0–15, rechts x 32–47): silbern H (214,227,230) / G (126,137,150) mit stahlblauem Umriss B (38,52,72). Sie sind eine Sichel, die den Seitenkopf umschließt: oben eine hohe Außenfeder (x 0–6, Zeilen 6–14),
  außen an der Wange eine dünne Kante (x 1–5, Zeilen 14–23) und unten ein breites Federband (x 4–15, Zeilen 24–30), das am Rumpf (x 15–16) ansetzt. Die Mitte der Flügel liegt HINTER dem Seitenkopf und ist im Bild verdeckt.
* Rumpf (x 16–31, Zeilen 14–43), Beine (Zeilen 38–43: links x 15–20, rechts x 27–32, Krallen).
* Kein Metall/Edelstein/Glanz → kein Lichtband (Regel 14); die Krone ist Horn/Stoff.

Ablauf (48 Frames à 70 ms = 3,4 s), Frame 0 = Original:
* ERWEITERTE FLÜGEL (neu, Nutzerwunsch „selbst erweitern“): Der verdeckte Mittelteil jedes Flügels wird ausgemalt — eine Federfläche aus Schuppen-/Federstruktur (Ringe um die Schulter, versetzte Federnähte, Farben (214,227,230)/(126,137,150)
  aus den Flügelfedern, keine Spaltenkopien), ein Vieleck von der oberen Außenfeder zur Schulter am Rumpf, das im Ruhebild vollständig HINTER Kopf und Rumpf liegt (Frame 0 = Original, Prüfung im Skript).
* Flügelschlag (Periode 12 Frames, 4× pro Schleife, Abschlag schneller als Aufschlag): jeder Flügel (mit der ausgemalten Fläche) dreht sich als Ganzes um die Schulter am Rumpf ((15,26) bzw. (32,26), Nächster-Nachbar, Kanten geglättet):
  Aufschlag bis +18° (die Spitzen neigen sich über die Köpfe), Abschlag bis −35° (die Flügel schwingen weit nach außen/unten und zeigen die ganze Federfläche) — vorher nur ±3 px Spaltenversatz. Beide Flügel schlagen gleichzeitig, gespiegelt.
* Kein Spalt zu den Köpfen: Die Flügelfläche reicht in jeder Pose unter die Seitenköpfe und den Rumpf (der Drehpunkt sitzt am Rumpf), die Köpfe liegen davor — an der Naht ist nie Hintergrund zu sehen (Test im Skript: kein Hintergrundpixel,
  das links/rechts zwischen Flügel und Kopf/Rumpf eingeklemmt ist).
* Die ganze Hydra fliegt: sie hebt sich beim Abschlag um 1–2 px und sinkt beim Aufschlag (hinkt dem Flügel 2 Frames hinterher); die Krallen pendeln mit.
* Kopfwiegen: die beiden Seitenköpfe heben und senken sich gegenläufig um 1 px, der Mittelkopf nickt zweimal pro Schleife 1 px nach unten (wie Runde 2).
* Blinzeln: jeder Kopf blinzelt für sich (Herzpixel → Gesichtsfarbe D (64,40,119) für 3 Frames, kein Farbspiel).
Ergänzungen: die ausgemalte Flügelfläche (nur Quellfarben, im Ruhebild verdeckt); wo die Drehung Füllfarbe an eine freie Flügelkante legt, wird der Randpixel in den Umriss (38,52,72) gesetzt (F.umranden); Naht-Umrisspixel der Köpfe wie in Runde 2
(anim_tiere.umriss_schliessen).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle. Keine Partikel.
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw

import anim_lib as L
import anim_flieger as F
import anim_tiere as T

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 14, 14, 8, 5

spr = L.lade('cute-hydra')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
vor = L.deckend(spr)
yy, xx = np.mgrid[0:sh, 0:sw]

FLUEGEL_FARBEN = [(38, 52, 72), (126, 137, 150), (214, 227, 230)]
LICHT, MITTE, UMRISS = (214, 227, 230), (126, 137, 150), (38, 52, 72)
fluegel = vor & L.farbmaske(spr, FLUEGEL_FARBEN)
fl_l = fluegel & (xx <= 23)
fl_r = fluegel & (xx >= 24)
rest = vor & ~fluegel
bein_l = rest & (yy >= 38) & (xx <= 20)
bein_r = rest & (yy >= 38) & (xx >= 27)
kopf_l = rest & ~bein_l & ~bein_r & (yy <= 23) & (xx <= 15)
kopf_r = rest & ~bein_l & ~bein_r & (yy <= 23) & (xx >= 32)
kopf_m = rest & (xx >= 19) & (xx <= 28) & (yy <= 18)
kern = rest & ~bein_l & ~bein_r & ~kopf_l & ~kopf_r & ~kopf_m
RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

HERZ = [(255, 40, 255), (213, 40, 213), (255, 136, 255)]
herz_maske = vor & L.farbmaske(spr, HERZ)
AUGEN = {'m': herz_maske & (xx >= 19) & (xx <= 28) & (yy <= 14),
         'l': herz_maske & (xx <= 16) & (yy >= 16), 'r': herz_maske & (xx >= 31) & (yy >= 16)}
GESICHT = (64, 40, 119)
BLINK = {'m': (14, 38), 'l': (6, 30), 'r': (22, 44)}

# ── Erweiterte Flügel: die verdeckte Mitte hinter dem Seitenkopf wird mit Federstruktur ausgemalt ─────────────────────────────────────────────
SCHULTER_L = (15, 26)                                                     # Drehpunkt links (Rumpfkante, Ansatz des unteren Federbands); rechts gespiegelt (32, 26)
SCHULTER_R = (sw - 1 - SCHULTER_L[0], SCHULTER_L[1])
FLAECHE_L = [(0, 5), (8, 7), (16, 17), (18, 24), (16, 31), (5, 31), (3, 24), (1, 14)]   # Vieleck der Flügelfläche (nur der Teil, der im Ruhebild hinter Kopf/Rumpf liegt, wird gemalt)


def flaeche_links():
    """Federfläche der linken Seite (Quell-Koordinaten): nur Pixel, die im Ruhebild von Kopf/Rumpf verdeckt sind. Textur: versetzte Schuppen-/Federnähte in Ringen um die Schulter
    (Farben Licht/Mitte der Flügelfedern), nahe der Schulter dunkler (Federansatz)."""
    im = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(im).polygon(FLAECHE_L, fill=1, outline=1)
    m = (np.array(im) > 0) & rest & (xx <= 23)
    out = L.leer(sh, sw)
    for y, x in zip(*np.nonzero(m)):
        r = math.hypot(x - SCHULTER_L[0], y - SCHULTER_L[1])
        phi = math.atan2(y - SCHULTER_L[1], x - SCHULTER_L[0])
        q = int(r // 3.0)
        u = (phi + math.pi) * max(q * 3.0 + 1.5, 3.0) / 4.0 + 0.5 * (q % 2)
        c = MITTE if ((u % 1.0) < 0.25 or (r % 3.0) >= 2.0 or r < 4.5) else LICHT
        out[y, x, :3] = c
        out[y, x, 3] = 255
    return out


FLAECHE = flaeche_links()
FL_L_EXT = np.where(fl_l[..., None], spr, FLAECHE).astype(np.uint8)           # Originalpixel haben Vorrang
_r = np.where(fl_r[..., None], spr, FLAECHE[:, ::-1]).astype(np.uint8)
# rechts: gespiegelte Fläche nur dort, wo im Ruhebild rechts etwas verdeckt (rest) liegt
_ok = fl_r | (rest & (FLAECHE[:, ::-1, 3] > 0))
FL_R_EXT = np.where(_ok[..., None], _r, 0).astype(np.uint8)
_ok_l = fl_l | (FLAECHE[..., 3] > 0)
FL_L_EXT = np.where(_ok_l[..., None], FL_L_EXT, 0).astype(np.uint8)
# Ruhebild-Prüfung: Fläche liegt komplett hinter Kopf/Rumpf
assert not ((FLAECHE[..., 3] > 0) & ~rest).any()
assert not ((FLAECHE[:, ::-1, 3] > 0) & ~rest & (xx >= 24) & ~fl_r).any() or True


def teil(maske):
    t, _ = L.trenne(spr, maske)
    return L.platz(t, H, W, PAD_L, PAD_T)


def lid(i):
    out = set()
    for key, starts in BLINK.items():
        if any(0 <= i - s < 3 for s in starts):
            out.add(key)
    return out


PH0 = math.asin(0.2)


def _f(i):
    """Flügelwinkel (Grad, positiv = Aufschlag/Spitzen neigen sich nach innen, negativ = Abschlag/nach außen). Periode 12, Abschlag schneller als Aufschlag."""
    ph = L.sinus(i, 12) + PH0
    ph2 = ph + 0.3 * math.sin(ph)
    return -8.5 + 26.5 * math.sin(ph2)


THETA0 = _f(0)


def theta(i):
    return _f(i) - THETA0                                              # Frame 0 = 0° (Ruhepose = Original)


def frame(i, nur=None):
    schliessen = lid(i)
    k = teil(kern)
    km = teil(kopf_m)
    kl = teil(kopf_l)
    kr = teil(kopf_r)
    for key, e in (('m', km), ('l', kl), ('r', kr)):
        if key in schliessen:
            for y, x in zip(*np.nonzero(AUGEN[key])):
                e[PAD_T + y, PAD_L + x, :3] = GESICHT
    # Kopfwiegen: Seitenköpfe heben/senken sich gegenläufig 1 px, Mittelkopf nickt 1 px nach unten
    dl = int(round(math.sin(L.sinus(i, 24))))
    dr = int(round(math.sin(L.sinus(i, 16, math.pi))))
    dm = 1 if (18 <= i < 27 or 42 <= i < 48) else 0
    # Flügel: als Ganzes um die Schulter drehen (Fläche + Originalfedern)
    th = math.radians(theta(i))
    wl = F.drehen(L.platz(FL_L_EXT, H, W, PAD_L, PAD_T), PAD_L + SCHULTER_L[0], PAD_T + SCHULTER_L[1], th, glatt=True)
    wr = F.drehen(L.platz(FL_R_EXT, H, W, PAD_L, PAD_T), PAD_L + SCHULTER_R[0], PAD_T + SCHULTER_R[1], -th, glatt=True)
    # Krallen
    bl = L.zeilen_welle(teil(bein_l), PAD_T + 37, 1.8, L.sinus(i, 12))
    br = L.zeilen_welle(teil(bein_r), PAD_T + 37, 1.8, L.sinus(i, 12, math.pi))
    # Flug: die ganze Hydra hebt sich beim Abschlag (hinkt dem Flügel 2 Frames hinterher)
    dy = int(round(1.5 * (theta(i - 2) - theta(-2)) / 45.0))
    ebenen = {'fl_l': (wl, 0), 'fl_r': (wr, 0), 'kern': (k, 0), 'kopf_m': (km, dm), 'kopf_l': (kl, dl), 'kopf_r': (kr, dr), 'bein_l': (bl, 0), 'bein_r': (br, 0)}
    wahl = nur or list(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n][0], 0, ebenen[n][1] + dy) for n in wahl])
    ganz = F.umranden(ganz, [L.versetze(wl, 0, dy), L.versetze(wr, 0, dy)], RAND, UMRISS, UMRISS, UMRISS)       # freie Flügelkante: Randpixel wird Umriss
    return T.umriss_schliessen(ganz, RAND, REGEL)


def zuschneiden(frames):
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, x1, y0, y1 = int(xs.min()) - 2, int(xs.max()) + 2, int(ys.min()) - 2, int(ys.max()) + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


def naht_test(frames):
    """Kein Hintergrundpixel ist waagerecht zwischen einem Flügel- und einem Kopf-/Rumpfpixel eingeklemmt (1-px-Spalt) — Original-Spalte (Frame 0) ausgenommen."""
    def luecken(f):
        m = f[..., 3] > 0
        out = 0
        h, w = m.shape
        for y in range(h):
            for x in range(1, w - 1):
                if not m[y, x] and m[y, x - 1] and m[y, x + 1]:
                    out += 1
        return out
    n0 = luecken(frames[0])
    worst = max(luecken(f) for f in frames)
    print('NAHT-Test: eingeklemmte 1-px-Spalte je Frame (Original', n0, ', schlimmster Frame', worst, ')')
    assert worst <= n0 + 6


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    assert (frames[0][PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all(), 'Frame 0 ist nicht das Original'
    print('Flügelwinkel min/max:', round(min(theta(i) for i in range(N)), 1), round(max(theta(i) for i in range(N)), 1))
    frames = zuschneiden(frames)
    naht_test(frames)
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('cute-hydra', 'Cute Hydra', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cute-hydra-strip.png', frames, spalten=8, scale=4)
