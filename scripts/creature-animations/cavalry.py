# -*- coding: utf-8 -*-
"""Idle-Animation für „Cavalry“ (Creature) — Lanzenreiterin auf braunem Pferd, wartet auf den Angriffsbefehl: das Pferd scharrt mit dem Huf und schlägt mit dem Schweif.

PICK: [["MotiveDeri", 162, "Ebene „Cavalry“, oberste Reiterin (zusammenhängende Figur bei x 32–65, y 4–33); sie ist die einzige der sieben, die keine andere berührt/überdeckt"]]
Abgleich mit data/card-art/native/Cavalry.png (Reitergruppe gegen Speerreihe; die Speerträger rechts und die übrigen Reiter sind nicht Teil des Sprites). Quelle vollständig.

Identifikation (34×30): Reiterin im Profil nach rechts, langes schwarzes Haar (x 8–18, y 0–10), Gesicht (x 13–16, y 4–9), EIN Auge (hellblau (14,6), weiß (14,7)),
dunkle Rüstung (x 9–17, y 9–20), Stiefel mit hellem Steigbügel (15,19). Lanze waagerecht (Schaft y 14, x 7–25; Eisenspitze x 24–33, y 12–16; Metallfuß x 3–8, y 13–15) mit
weißem Wimpel am Lanzenende (x 0–9, y 9–15, dunkelgrüner Umriss). Pferd: Kopf mit Zaumzeug (x 18–25, y 7–15), Ohr ((20,7), (19–22,8)), Rumpf (y 16–23), Schweif (dunkel, x 3–5,
y 20–28), Hinterbein (x 7–9, y 24–29), Vorderbein (x 16–18, y 24–29, grauer Huf (17,28)), abgewandtes Vorderbein (x 20–22, y 24–28). Kopf der Reiterin bleibt fest zum Körper.

Ablauf (48 Frames à 60 ms = 2,9 s; Runde 8: „Beine müssen sich bewegen, ganze Figur läuft relativ schnell nach rechts und links“). Frame 0 = Original:
* Frames 0–3 Stand (Blick rechts) → 4–15 Trab nach rechts (18 px, abwechselnd 2/1 px je Bild) → 16–19 Stand → 20–23 gewendet (Sprite waagerecht gespiegelt um die Pferdemitte x 13)
  → 24–35 Trab nach links zurück → 36–43 Stand (Blick links) → 44–47 wieder Blick rechts. ANNAHME: Beim Richtungswechsel wird gespiegelt, damit das Pferd in Blickrichtung läuft
  (Rückwärtslaufen sähe falsch aus).
* Trabzyklus (6 Bilder je Schritt, diagonale Beinpaare gegenphasig: Vorderbein nah + Hinterbein fern / Vorderbein fern + Hinterbein nah). Jedes Bein ist ab dem Knie (y ≥ 26)
  eine starre Pose HINTER dem Rumpf: aufsetzen vorn (+2 px) → Stand → hinten (−2 px) → angehoben zurück → angehoben Mitte → angehoben vor; Versatz höchstens 1 px je Zeile,
  angehobene Beine verschwinden 1–2 px hinter dem Rumpf (nichts wird gestreckt oder verbreitert). In den Schwebephasen hebt sich die ganze Figur 1 px.
* Wimpel flattert (die äußeren Spalten x ≤ 2 gehen 1 px hoch/runter, Periode 10; im Trab Periode 4) – die Lanze selbst bleibt starr.
* Im Stand: Ohrzucken (Frames 17–18), Blinzeln (Frames 1–2 und 38–39).
Ergänzungen: abgewandtes HINTERBEIN (in der Quelle vom nahen Hinterbein verdeckt): Kopie des abgewandten Vorderbeins (dunkel, y 26–28) an x 7–9 – im Stand unsichtbar hinter dem nahen
Hinterbein, im Trab sichtbar. Beim Ohrzucken wird (20,8) zur Umrissfarbe (49,24,0); hängt der Wimpel 1 px tiefer, bleibt die Umrissecke (2,12) (dunkelgrün) stehen.
"""
import numpy as np

import anim_lib as L
import anim_textur as TX
TX.umleiten()
import anim_n9 as N9

N, MS = 48, 60
LAUF = 18                                            # Laufweg in px
sz = N9.Szene('cavalry', (12, 3 + LAUF, 5, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
KNIE = 26                                            # ab dieser Zeile sind die Beine eigene Posen
BEIN_VN_M = (xx >= 16) & (xx <= 18) & (yy >= KNIE) & sz.da          # Vorderbein nah
BEIN_HN_M = (xx >= 7) & (xx <= 9) & (yy >= KNIE) & sz.da            # Hinterbein nah
BEIN_VF_M = (xx >= 20) & (xx <= 22) & (yy >= KNIE) & sz.da          # Vorderbein fern (dunkel)
WIMPEL_M = (xx <= 2) & (yy >= 9) & (yy <= 15) & sz.da
REST_M = sz.da & ~BEIN_VN_M & ~BEIN_HN_M & ~BEIN_VF_M & ~WIMPEL_M
BEIN_VN, BEIN_HN, BEIN_VF, WIMPEL, REST = (sz.teil(m) for m in (BEIN_VN_M, BEIN_HN_M, BEIN_VF_M, WIMPEL_M, REST_M))
BEIN_HF = L.versetze(BEIN_VF, -13, 0)                # ergänztes abgewandtes Hinterbein (im Stand hinter dem nahen Hinterbein verborgen)
UMRISS, HAUT = (49, 24, 0), (246, 189, 123)
FLATTER = (0, 0, -1, -1, -1, 0, 0, 1, 1, 1)
TEST_EBENEN = ('figur',)
MITTE = 13                                           # Spiegelachse (Pferdemitte, Sprite-x)
#        Phase:  0 aufsetzen  1 Stand  2 hinten  3 hoch/zurück  4 hoch/Mitte  5 hoch/vor     (dx am Huf, Hub)
POSE = ((2, 0), (0, 0), (-2, 0), (-1, 2), (0, 2), (2, 1))
SCHRITT = (2, 1)


def bein(ebene, phase):
    """Bein-Pose: Zeile KNIE fest, darunter starrer Versatz (höchstens 1 px je Zeile), um `hub` px hinter den Rumpf gehoben."""
    if phase is None:
        return ebene
    dx, hub = POSE[phase]
    vers = {}
    for y in range(KNIE, sz.sh):
        j = y - KNIE
        d = 0 if j == 0 or dx == 0 else (dx if j >= 2 or abs(dx) == 1 else dx // abs(dx))
        vers[sz.PT + y] = d
    out = L.leer(sz.H, sz.W)
    for y, d in vers.items():
        out[y] = np.roll(ebene[y], d, axis=0)
    return L.versetze(out, 0, -hub) if hub else out


def lage(i):
    """(x-Versatz, gespiegelt?, Laufphase oder None)."""
    weg = [sum(SCHRITT[k % 2] for k in range(j + 1)) for j in range(12)]
    if i < 4 or i >= 44:
        return 0, False, None
    if i < 16:
        return weg[i - 4], False, (i - 4) % 6
    if i < 20:
        return LAUF, False, None
    if i < 24:
        return LAUF, True, None
    if i < 36:
        return LAUF - weg[i - 24], True, (i - 24) % 6
    return 0, True, None


def figur(i, ph):
    """Die nach rechts blickende Figur an der Ausgangsstelle (volle Leinwand)."""
    r = REST.copy()
    px = lambda x, y, c: r.__setitem__((sz.PT + y, sz.PL + x), tuple(c) + (255,))
    if i in (17, 18):
        r[sz.PT + 7, sz.PL + 20] = 0; px(20, 8, UMRISS)
    if i in (1, 2, 38, 39):
        px(14, 6, HAUT); px(15, 6, HAUT); px(14, 7, (0, 0, 0)); px(15, 7, (0, 0, 0))
    fl = FLATTER[i % 10] if ph is None else (0, -1, 0, 1)[i % 4]
    if fl > 0:                                       # Wimpel unten: die Umrissecke (2,12) bleibt stehen, sonst läge (3,12) weiß am Rand
        px(2, 12, (2, 25, 3))
    a, b = (ph, (ph + 3) % 6) if ph is not None else (None, None)
    f = L.zusammen(sz.H, sz.W, [(bein(BEIN_HF, a), 0, 0), (bein(BEIN_VF, b), 0, 0), (bein(BEIN_HN, b), 0, 0), (bein(BEIN_VN, a), 0, 0), (r, 0, 0), (WIMPEL, 0, fl)])
    return L.versetze(f, 0, -1) if ph in (2, 5) else f


def frame(i, nur=None):
    x, gespiegelt, ph = lage(i)
    f = figur(i, ph)
    if gespiegelt:                                   # um die Pferdemitte spiegeln: Leinwand-x → 2·(PL+MITTE) − x
        g = L.leer(sz.H, sz.W)
        achse = 2 * (sz.PL + MITTE)
        xs = np.arange(sz.W)
        ok = (achse - xs >= 0) & (achse - xs < sz.W)
        if (f[:, ~ok, 3] > 0).any():
            raise L.ClipError('Spiegelbild außerhalb')
        g[:, achse - xs[ok]] = f[:, xs[ok]]
        f = g
    return L.versetze(f, x, 0) if x else f


if __name__ == '__main__':
    N9.fertig('cavalry', 'Cavalry', frame, N, MS, spr, check=[0, 4, 5, 6, 7, 8, 9, 20, 27, 38], zoom=10)
