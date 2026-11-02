# -*- coding: utf-8 -*-
"""Idle-Animation für „Cybug LADYBUG“ (Creature) — Regeln 14/15/16 (Metall und Edelstein glänzen, Rotoren/Platine nicht).

PICK: [["Motive", 1364, 1]]   — mit eigener Extraktion: die Flügel haben in der Ebene Alpha 127/204 (durchscheinend) und gingen bei creature_show.py verloren.
Quelle: src/cybug-ladybug.png — die ganze Ebene 1364 („Cybug LADYBUG“, 28×26 px, 28 Farben) aus Motive.xcf, jedes Pixel mit Alpha > 0 deckend übernommen (RGB unverändert, Alpha 127/204 → 255).
Teil-Ebenen (gleiche Größe, aus der Alpha-Information gebildet): src/cybug-ladybug-fluegel-l.png (= linker ROTOR, 85 px), -fluegel-r.png (= rechter ROTOR, 80 px; Dateinamen aus Runde 1 beibehalten), -koerper.png (349 px); zusammen = das Sprite.

Aufruf:   python3 cybug_ladybug.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/cybug-ladybug.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y; Cyborg-Marienkäfer von vorn-oben, Kopf unten) — Runde 2, Nutzerfeedback: „Das Weiße sind keine Flügel, sondern sich drehende ROTOREN, wie bei einer Drohne!“
* ROTOREN (die weißen/durchscheinenden Pixel, früher als Flügel behandelt): zwei flache, kreisrund-ovale Rotorscheiben mit Rand (113,113,113), links x 1–13 / rechts x 14–26, y 0–8 (Halbachsen 6 × 4, Nabe links (7,4),
  rechts (20,4)); Füllung (205,205,205)/(255,255,255) = die verwischte Rotorebene, Adern (152,152,152)/(127,127,127)/(100,100,100) = der senkrechte Mast von der Nabe zum Metallrahmen (x = 7 bzw. 20, y 4–8).
  Die Scheiben sitzen auf den Masten, sie schlagen NICHT.
* Rückenschild (x 9–18, y 3–14): ein Amethyst — dunkelviolette Fassung (46,41,66), Facetten (79,75,116)/(130,97,171)/(166,118,180)/(190,160,195)/(210,186,217)/(233,210,222), weiße Glanzpunkte (254,249,242).
* Metallrahmen und Hals (x 2–25, y 8–18): graues Metall (51,51,51)/(137,137,137)/(160,160,160)/(205,205,205), Rostflecken (129,41,19) bei (10–11,16–17) und (16–17,16–17).
* Kopf (x 12–15, y 18–21) mit zwei roten Leuchtaugen (12,20) und (15,20) (255,0,0).
* Beine: je vier Metallbeine links (x 0–10) und rechts (x 17–27), y 19–25, im Stil dünner Stäbe.

Ablauf (48 Frames à 60 ms = 2,88 s):
* ROTOREN drehen sich schnell und pixelgerecht wie bei einer Drohne: in jeder Scheibe läuft ein durchgehendes zweiblättriges Rotorblatt (1-px-Linie durch die Nabe, dunkelgrau (127,127,127)) und schaltet pro Frame um 45° weiter
  (Stellungen waagerecht, schräg, senkrecht, schräg = 4 der 8 möglichen Stufen à 22,5°, Periode 4 Frames = 240 ms je halbe Umdrehung); dahinter läuft ein helleres Nachbild des Blatts (152,152,152) um 22,5° versetzt (Bewegungsunschärfe ohne Alpha,
  zeigt die Drehrichtung). Die beiden Rotoren drehen GEGENLÄUFIG (links im Uhrzeigersinn, rechts dagegen — wie bei echten Drohnen). Die Füllung der Scheibe (verwischte Rotorfläche), Rand und Mast bleiben unverändert. Kein Flügelschlag mehr.
* Schwebe-Bob zweistufig bis 2 px (Periode 12): Schild und Rotoren zuerst, Beine hinterher; der Unterschied wird in Zeile 18 (reine Metallzeile) durch Verdoppeln/Entfernen einer Zeile ausgeglichen. Die Rotoren sitzen fest am Schild
  (gleicher Versatz, Masten bleiben an den Metallrahmen angeschlossen). Die Beine pendeln dazu seitlich (nur Zeilen ab 19, je tiefer desto mehr, bis 2 px, Periode 24, Verbindung bleibt 4-verbunden).
* Glanz nur auf Edelstein und Metall (Regel 14): ein dezentes Lichtband läuft alle 24 Frames über die Amethyst-Facetten (eine Stufe heller), ein zweites, versetzt, über die grauen Metallflächen;
  dazu zwei kleine weiße Glitzersterne auf dem Amethyst (nur innerhalb der Fassung). Rotoren, Rost, Fassung und dunkle Metallränder glänzen nicht.
* Blinzeln (Frames 38–39): die roten Leuchtaugen schließen sich (Lid = graues Metall des Kopfes (160,160,160)). Keine Partikel.

Ergänzungen: keine. Die Rotorscheiben sind in der Ebene vollständig außerhalb des Schilds; die Rotorblätter werden nur INNERHALB der sichtbaren Scheibe (Pixel der Ebene, ohne Rand und Mast) in Farben des Sprites gezeichnet; unter dem Schild verschwinden sie.
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px Rand, zentriert), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): der Rotorrand bleibt unberührt (Blätter nur im Inneren), das Beinpendel legt Innenfarbe an die Beinränder frei → F.umranden setzt den Metallrand (51,51,51); zusätzlich randtest.py.
Alle Bewegungen laufen auf der vollen (größeren) Arbeitsleinwand (anim_lib wirft ClipError). Nur ganze Pixel, nur Farben der Quelle, Alpha nur 0/255.
"""
import math
import sys

import numpy as np

import anim_lib as L
import anim_flieger as F
import anim_insekt as I

N, MS = 48, 60
PAD_L, PAD_R, PAD_T, PAD_B = 10, 10, 10, 10                 # Arbeitsleinwand (am Ende zugeschnitten)

spr = L.lade('cybug-ladybug')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R


def teil(name):
    return L.platz(L.lade('cybug-ladybug-' + name), H, W, PAD_L, PAD_T)


P_WL, P_WR, P_KP = teil('fluegel-l'), teil('fluegel-r'), teil('koerper')
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_KP)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
S_KP = L.lade('cybug-ladybug-koerper')
S_WL, S_WR = L.lade('cybug-ladybug-fluegel-l'), L.lade('cybug-ladybug-fluegel-r')

# ── Farben (alle aus dem Sprite) ──────────────────────────────────────────────────────────────────────────────────
AMETHYST = [(79, 75, 116), (130, 97, 171), (166, 118, 180), (190, 160, 195), (210, 186, 217), (233, 210, 222), (254, 249, 242)]       # dunkel → hell
METALL = [(137, 137, 137), (160, 160, 160), (205, 205, 205), (254, 249, 242)]
gem_maske = L.farbmaske(S_KP, AMETHYST[:6])
metall_maske = L.farbmaske(S_KP, METALL[:3])
# Rotoren: Nabe, Halbachsen, sichtbare Scheibe (ohne Rand und Mast)
ROTOR_L, ROTOR_R = (7, 4), (20, 4)
RX, RY = 6, 4
BLATT, NACHBILD = (127, 127, 127), (152, 152, 152)
RAND_ROTOR = (113, 113, 113)
yy_, xx_ = np.mgrid[0:sh, 0:sw]
mast_l = (xx_ == 7) & (yy_ >= 4) & (yy_ <= 8)
mast_r = (xx_ == 20) & (yy_ >= 4) & (yy_ <= 8)
INNEN_L = (S_WL[..., 3] > 0) & ~L.farbmaske(S_WL, [RAND_ROTOR]) & ~mast_l
INNEN_R = (S_WR[..., 3] > 0) & ~L.farbmaske(S_WR, [RAND_ROTOR]) & ~mast_r
AUGEN = [(12, 20), (15, 20)]
LID = (160, 160, 160)
WEISS = (254, 249, 242)
STERNE = [(13, 10), (15, 11)]                                # Sterne im Amethyst (Mitte; Arme bleiben in der Fassung)
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (113, 113, 113)
METALLRAND = (51, 51, 51)
ZEILE = PAD_T + 18                                           # reine Metallzeile: hier wird ausgeglichen


def rotor_zeichnen(a, pad_l, pad_t, innen, nabe, stufe, richtung):
    """Rotorblatt (Stellung `stufe` in Schritten von 22,5°) und helleres Nachbild (eine Stufe = 22,5° hinter dem Blatt, je nach Drehrichtung) in die Rotorebene `a` zeichnen — nur auf Pixel der sichtbaren Scheibe."""
    for (x, y) in I.blatt_pixel(nabe[0], nabe[1], RX, RY, stufe - richtung, f=0.95):
        if innen[y, x]:
            a[pad_t + y, pad_l + x, :3] = NACHBILD
    for (x, y) in I.blatt_pixel(nabe[0], nabe[1], RX, RY, stufe, f=0.95):
        if innen[y, x]:
            a[pad_t + y, pad_l + x, :3] = BLATT
    return a


def frame(i, partikel=True, effekte=True, nur=None):
    if nur:
        effekte = False
    pb = L.sinus(i, N / 4)                                    # Schwebe-Bob: Periode 12
    haupt = int(round(-1.3 * math.sin(pb)))                   # Schild/Rotoren zuerst …
    lag = int(round(-1.3 * (math.sin(pb - 0.9) + math.sin(0.9))))   # … Beine hinterher (Frame 0 = Ruhe)
    n_str = max(-1, min(2, lag - haupt))
    oben = lag - n_str                                        # tatsächlicher Versatz von Schild und Rotoren

    kp, wl, wr = P_KP.copy(), P_WL.copy(), P_WR.copy()
    if i in (38, 39):                                          # Blinzeln: Lid = Metall des Kopfes
        F.setze(kp, PAD_L, PAD_T, {p: LID for p in AUGEN})
    if effekte:                                                # Glanz nur auf Edelstein und Metall
        F.lichtband(kp, gem_maske, PAD_L, PAD_T, i, N // 2, 4, 9, AMETHYST, stufen=1, breite=3.0, achse=(1.0, 0.9))
        F.lichtband(kp, metall_maske, PAD_L, PAD_T, i, N // 2, 15, 9, METALL, stufen=1, breite=3.0, achse=(1.0, 0.8))

    # Rotoren: schnell, gegenläufig (links im Uhrzeigersinn, rechts dagegen), 45° je Frame
    st = 2 * i
    wl = rotor_zeichnen(wl, PAD_L, PAD_T, INNEN_L, ROTOR_L, st % 8, +1)
    wr = rotor_zeichnen(wr, PAD_L, PAD_T, INNEN_R, ROTOR_R, (-st) % 8, -1)

    kp = F.zeilen_pendel(kp, PAD_T + 18, 2.0, L.sinus(i, N / 2), 1.0)          # Beine pendeln
    kp, wl, wr = (L.versetze(L.streck_zeile(a, ZEILE, n_str), 0, lag) for a in (kp, wl, wr))
    f = L.zusammen(H, W, [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0)])
    F.umranden(f, [kp], UMRISS, METALLRAND, METALLRAND, METALLRAND)
    if effekte:                                                # zwei Glitzersterne im Amethyst
        for k, (sx, sy) in enumerate(STERNE):
            stufe = F.stern_stufe(i, N // 2, 6 + 12 * k, folge=(0, 1, 1, 0))
            if stufe is not None:
                F.stern(f, PAD_L + sx, PAD_T + sy + oben, stufe, WEISS, WEISS)
    return f


def zuschneiden(frames, rand=2):
    """Frame auf die Figur zuschneiden und zentrieren: Vereinigung aller Frames + `rand` px."""
    a = np.stack([f[..., 3] > 0 for f in frames]).any(axis=0)
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = int(xs.min()) - rand, int(ys.min()) - rand, int(xs.max()) + rand, int(ys.max()) + rand
    print('Figur x', int(xs.min()), '…', int(xs.max()), 'y', int(ys.min()), '…', int(ys.max()))
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


if __name__ == '__main__':
    frames = [frame(i) for i in range(N)]
    frames = zuschneiden(frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr)
    print('Pixel je Frame:', n)
    L.speichern('cybug-ladybug', 'Cybug LADYBUG', frames, MS, prev)
    if prev:
        L.streifen(prev + '/cybug-ladybug-strip.png', frames, spalten=8, scale=6)
