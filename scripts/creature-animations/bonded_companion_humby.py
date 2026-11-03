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
* Das Fell ist GOLD (Runde 3 Nutzerwunsch: „braucht noch Goldglanz, sonst passt er.“) → Goldglanz, siehe unten. Keine Partikel. Ohren/Beine nicht eindeutig lesbar → fest. Auge ist schon geschlossen (Lachauge) → kein Blinzeln, kein Blick.
Bleibt fest: Gesicht (Auge, Nase, Zunge), Rumpf unter Zeile 11.

Runde 2 (Nutzerkorrektur wörtlich: „soll seine Beine bewegen.“): Die vier Beinchen sind jetzt EIGENE Ebenen (Zeilen 15–19; die Hüftzeile 15 bleibt am Rumpf) und laufen am Ort im Diagonalgang:
* Hinterbeine: hinten-nah x 1–3 (Umriss x 1, Füllung x 2 (rosa/orange C/D/I), Fußumriss (2–3,18)), hinten-fern x 4–6 (Füllung x 4, Fuß mit hellem Pixel B (4,18), Fußumriss (4–5,19)).
  Vorderbeine: vorn-nah x 9–11 (Füllung x 10–11 C/D/B, Fuß (11,18) C, Umriss unten (11–12,19)), vorn-fern x 12–14 (Füllung x 12–13 I/D, Fußumriss (13,18)). Je Bein 1 px breite Füllung, Umriss rechts/links.
* Gang: hinten-nah und vorn-fern laufen in Phase 0, hinten-fern und vorn-nah um ½ Zyklus versetzt (Periode 12 Frames = 0,84 s, 4 Zyklen pro Schleife): jede Zeile unter der Hüfte wandert waagerecht (Fuß bis ±2 px (meist ±1)
  nach vorn/hinten, Schwungphase 45 %), in der Schwungphase hebt der Fuß 1 px (eine Beinzeile entfällt).
* Der frühere Hüpfer (das ganze Tier hebt ab) ist durch ein 1-px-Wippen im Schritttakt ersetzt (Bodenwesen, kein Hüpfen).

Ablauf (48 Frames à 70 ms = 3,4 s), alle Bewegungen unabhängig:
* Schwanzwiegen (Periode 16, 3× pro Schleife): die Zeilen des Schwanzes oberhalb von Zeile 8 (x ≤ 8) wandern waagerecht, je höher desto mehr (die diagonale Schwanzwurzel darunter bleibt, sonst reißt sie diagonal auf) (Quaste bis 3 px nach links, höchstens 1 px nach rechts, damit sie nicht am Kopf anliegt); der Ansatz am Rumpf bleibt.
* (ersetzt) Hüpfer → Wippen 1 px im Schritttakt, siehe oben.
* Kopf hebt sich (Periode 24, Frames 10–18): Kopf samt Mähne steigt 1 px — in den Spalten x ≥ 9 wird die Mähnenunterkante (Zeile 11) einmal eingefügt (anim_tiere.spalten_hub),
  Beine und Rumpf darunter bleiben stehen, der Schwanz bleibt am Rumpf.
* Randpixel-Korrektur (Regel 16): anim_tiere.umriss_schliessen.
* GOLDGLANZ (Runde 3, nur auf den goldenen Fellteilen im Inneren (Randpixel bleiben unverändert) — Orange (241,131,83)/(244,174,100), Gelb (251,221,110), Creme (248,248,189); NICHT auf braunem Umriss, schwarzer Nase/Auge und roter Zunge):
  (a) Lichtband: zweimal je Schleife (Frames 4–15 und 28–39, je 12 Frames) wandert ein 4 px breites diagonales Band (x + y) über das fertig zusammengesetzte Tier (Bildschirmkoordinaten, nimmt also das Wippen/Laufen mit):
      die Fellpixel im Band werden eine Stufe heller auf der Gold-Rampe Orange → Orange hell → Gelb → Creme (Creme bleibt, das ist schon die hellste Quellfarbe).
  (b) Glitzersterne: zwei kurze Sparkles (4 Frames: Mitte → kleines Kreuz → Kreuz → Mitte, dann weg; lange Pausen) an der Mähne (Frames 20–23) und an der Brust (Frames 41–44); das Zentrum wird je Frame auf das nächstgelegene goldene Fellpixel (±1 px)
      gesetzt, damit der Stern auch beim Wippen am Fell sitzt; Farben: Creme (Mitte und Arme, heben sich vom Gelb/Orange des Fells ab).
Alle Bewegungen laufen auf der vollen Leinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle.

Ergänzungen: Randpixel-Korrektur (Regel 16) und die eingefügte Mähnenzeile beim Kopfheben (Duplikat vorhandener Pixel). Sonst keine gemalten Pixel.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_tiere as T
import anim_tier as G

N, MS = 48, 70
PAD_L, PAD_R, PAD_T, PAD_B = 4, 2, 4, 2

spr = L.lade('bonded-companion-humby')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R
yy, xx = np.mgrid[0:sh, 0:sw]
vorhanden = L.deckend(spr)

schwanz = vorhanden & (xx <= 8) & (yy <= 11)
bein_hn = vorhanden & (yy >= 15) & (xx >= 1) & (xx <= 3)                        # hinten nah
bein_hf = vorhanden & (yy >= 15) & (xx >= 4) & (xx <= 6)                        # hinten fern
bein_vn = vorhanden & (yy >= 15) & (xx >= 9) & (xx <= 11)                       # vorn nah
bein_vf = vorhanden & (yy >= 15) & (xx >= 12) & (xx <= 14)                      # vorn fern
beine = bein_hn | bein_hf | bein_vn | bein_vf
koerper = vorhanden & ~schwanz & ~beine

RAND = T.rand_farben(spr)
REGEL = T.umriss_regeln(spr, RAND)[2]

ZYKLUS = 12                                                        # Frames je Schrittzyklus (4 pro Schleife)
WIPPEN = [0, 1, 1, 0, 0, 0]                                        # Periode 6 (2× je Zyklus): 1 = Tier 1 px höher
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


def bein_ebene(maske, i, versatz):
    dx, lift = G.gang(i / float(ZYKLUS) + versatz, 1.7, 0.45, 1.0)
    dx, lift = -G.runde(dx), int(round(lift))                      # Tier schaut nach rechts: Schwung = vorwärts = rechts
    t = teil(maske)
    rows = {PAD_T + 16: G.runde(dx * 0.25), PAD_T + 17: G.runde(dx * 0.5), PAD_T + 18: G.runde(dx * 0.75), PAD_T + 19: dx}
    t = G.zeilen_versatz(t, rows)
    return L.heben_unten(t, PAD_T + 17, lift) if lift else t


# ── Goldglanz (Runde 3) ──
GOLD_RAMPE = {(241, 131, 83): (244, 174, 100), (244, 174, 100): (251, 221, 110), (251, 221, 110): (248, 248, 189)}
GOLD_FARBEN = set(GOLD_RAMPE) | {(248, 248, 189)}
for _c in GOLD_FARBEN:
    assert any(tuple(int(v) for v in p[:3]) == _c for p in spr.reshape(-1, 4) if p[3]), _c
GLANZ_FENSTER = [(4, 12), (28, 12)]
GLITZER = [(20, (11, 6)), (41, (16, 13))]                          # (Startframe, Sternmitte im Sprite)
GLITZER_LAUF = [0, 1, 1, 0]
STERN_KERN, STERN_ARM = (248, 248, 189), (248, 248, 189)


def goldglanz(fr, i):
    """Lichtband + Glitzer auf den goldenen Fellpixeln des fertigen Frames (nur Farben der Quelle)."""
    gold = np.zeros(fr.shape[:2], bool)
    for c in GOLD_FARBEN:
        gold |= (fr[..., :3] == np.array(c)).all(axis=2) & (fr[..., 3] > 0)
    op = np.pad(fr[..., 3] > 0, 1)
    rand = (fr[..., 3] > 0) & ~(op[:-2, 1:-1] & op[2:, 1:-1] & op[1:-1, :-2] & op[1:-1, 2:])
    gold &= ~rand                                                                    # Außenkante (Umriss/Randpixel) glänzt nicht und bleibt unverändert (Regel 16)
    for (s0, dauer) in GLANZ_FENSTER:
        k = (i - s0) % N
        if k < dauer:
            ys, xs = np.nonzero(fr[..., 3] > 0)
            u = xs + ys
            umin, umax = float(u.min()), float(u.max())
            mitte = umin - 4 + (k + 0.5) / dauer * (umax - umin + 8)
            for y, x in zip(*np.nonzero(gold)):
                if abs((x + y) - mitte) <= 2.0:
                    c = tuple(int(v) for v in fr[y, x, :3])
                    if c in GOLD_RAMPE:
                        fr[y, x, :3] = GOLD_RAMPE[c]
    for (s0, (sx, sy)) in GLITZER:
        k = (i - s0) % N
        if k < len(GLITZER_LAUF):
            stufe = GLITZER_LAUF[k]
            hub_ = WIPPEN[i % 6]
            cx, cy = PAD_L + sx, PAD_T + sy - hub_
            best = None
            for dy in (0, -1, 1):
                for dx in (0, -1, 1):
                    if gold[cy + dy, cx + dx] and best is None:
                        best = (cx + dx, cy + dy)
            if best is None:
                continue
            cx, cy = best
            pts = {(cx, cy): STERN_KERN}
            if stufe >= 1:
                for (ax, ay) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if gold[cy + ay, cx + ax]:                                   # Arme nur auf Goldfell (nie über Umriss/Rand hinaus)
                        pts[(cx + ax, cy + ay)] = STERN_ARM
            for (x, y), c in pts.items():
                fr[y, x, :3] = c
    return fr


def frame(i, nur=None):
    hub = WIPPEN[i % 6]
    kopf = KOPF[i % 24]
    amp = 3.2 + 0.6 * (0.5 - 0.5 * math.cos(2 * math.pi * i / N))
    k = T.spalten_hub(teil(koerper), PAD_T + 11, lambda x: kopf if x >= PAD_L + 9 else 0)
    s = wiegen(teil(schwanz), PAD_T + 8, amp, L.sinus(i, 16))
    ebenen = {'koerper': k, 'schwanz': s, 'bein_hn': bein_ebene(bein_hn, i, 0.0), 'bein_hf': bein_ebene(bein_hf, i, 0.5),
              'bein_vn': bein_ebene(bein_vn, i, 0.5), 'bein_vf': bein_ebene(bein_vf, i, 0.0)}
    wahl = nur or tuple(ebenen)
    ganz = L.zusammen(H, W, [(ebenen[n], 0, -hub) for n in wahl])
    ganz = T.umriss_schliessen(ganz, RAND, REGEL)                  # Randpixel-Test (Regel 16)
    return goldglanz(ganz, i) if not nur else ganz


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    n = L.pruefe(frames, quelle=spr, erlaubt=[])
    print('Pixel je Frame:', n)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    L.speichern('bonded-companion-humby', 'Bonded Companion Humby', frames, MS, prev)
    if prev:
        L.streifen(prev + '/bonded-companion-humby-strip.png', frames, spalten=12, scale=6)
