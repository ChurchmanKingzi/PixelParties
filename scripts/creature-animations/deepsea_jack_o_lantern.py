# -*- coding: utf-8 -*-
"""Idle-Animation für „Deepsea Jack O' Lantern“ (Creature).

Quelle: src/deepsea-jack-o-lantern.png — Ebene „Jack O Lantern“ (33×54 px) aus MotiveDeepsea.xcf (Ebene 330), gegen die Kartenkunst (data/card-art/native/Deepsea_Jack_O_Lantern.png) abgeglichen: Hexenhut-Kopf links,
Laterne rechts daneben, darunter ein weicher violetter Dunst. Der Treffer-Suchlauf fand die Ebene wegen der blauen Tönung nicht. Nachbarebenen (329 „Werewolf“, 331 „Poltergeister“) sind andere Figuren.
Die Ebene ist halbtransparent: Hut, Kopf und Laterne sind (fast) deckend; der Dunst (Alpha 32–224) wurde für die Animation per DITHERING in Pixelart gebracht (Regel 22: kein Alpha): Dunst mit Alpha ≥ 160 deckend, Alpha 100–159 im
Schachbrettmuster (x + y gerade), darunter entfällt er; unterhalb Zeile 38 läuft er aus. Alle Farben stammen aus der Ebene (13 Farben, seltene Zwischentöne eingerastet).
PICK: [["MotiveDeepsea", 330, 1]]   (Alpha-Schwelle 100, Dunst gedithert)

Aufruf:   python3 deepsea_jack_o_lantern.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/deepsea-jack-o-lantern.png + .json

Was ist was (x/y im Sprite, 22×38):
* Ein schwebender Geisterkopf mit Hexenhut: Hutspitze (x 6–13, y 0–5, oben eingerollt, Loch bei (8,3)) in Violett (49,29,88)/(88,53,159)/(128,92,201)/(182,162,224), Hutband (59,13,85)/(82,18,118)/(95,20,138) bei y 6–8,
  Krempe y 8–10, darunter der Kopf (x 1–18, y 11–17) in Teal-Schachbrett (51,93,119)/(77,137,154) mit dunklem Umriss (13,16,49)/(30,48,81) und zwei dunklen Augenhöhlen mit je einem roten Pupillenpixel (164,10,32)
  bei (7,14) und (12,14).
* Die Laterne (x 13–21, y 17–27) hängt rechts neben dem Kopf: Teal-Deckel (51,93,119)/(77,137,154) (y 18–21), violettes Glas (88,53,159)/(128,92,201)/(182,162,224) bei (15–18, 22–24), dunkle Fassung bei y 25–27.
  Im Glas ist keine Flamme gezeichnet — nur violettes Licht.
* Der Dunst (Dunkelviolett (38,26,63), x 0–15, y 14–37) hängt trichterförmig unter dem Kopf, am Rand gedithert.
Fest bleiben: Gesichtsform, Hutband und Krempe, Laternenform.

Ablauf (48 Frames à 70 ms = 3,36 s; Frame 0 = Original, Wölkchen ausgenommen):
* Schweben (er fliegt/schwebt): Kopf und Hut gleiten zweistufig auf und ab (Periode 24, bis 2 px; Kopf zuerst, der Dunst hängt starr daran); die Laterne schwebt mit anderer Periode (16) ±1 px und etwas Nachlauf.
* Hutspitze neigt sich (Zeilengruppen 0–1 / 2–3 / 4–5, Spitze bis ±2 px; benachbarte Gruppen höchstens 1 px verschieden, die Einrollung bleibt heil), Periode 16.
* Dunst wabert: zwei Wellen (Periode 24 und 16) schieben die Zeilen unterhalb des Kopfes waagerecht (bis ±2 px, wächst nach unten, mit Nachlauf); durch die Dither-Ränder flimmert der Rand von selbst.
* Laternenglas flackert unregelmäßig (Kerzenschein, Regel 15 — ohne Funken und Sterne, weil keine Flamme gezeichnet ist): die Pixel des Glases wandern je 2 Frames um eine Stufe auf der Rampe (88,53,159) → (128,92,201) → (182,162,224).
* Blinzeln beider Pupillen (Lid = Augenhöhle (13,16,49)): zweimal (Frame 10–12 und 33–35).
* Partikel (hinter der Figur): zwei kleine violette Lichtwölkchen steigen von der Laterne auf (Kern (128,92,201), Rand (88,53,159)), zwei Teal-Blasen steigen rechts unten neben dem Dunst auf (Kern (77,137,154), Rand (51,93,119)); runde
  Wölkchen 2×2 → 3×3 → 2×2 (`U.wolke_ebene`).
Kein Glanz (Regel 14: Stoff, Haut, Glas ist kein Edelstein/Metall — nur das Flackern des Lichts), Randpixel-Test (Regel 16): `U.kontur_schliessen`.
Ergänzungen: keine gemalten Pixel außer Lidern (Augenhöhlenfarbe) und Umrisspixeln an bewegten Kanten.
Zuschnitt: Frame auf die Figur zugeschnitten (symmetrisch um die Ruhefigur, Wölkchen höchstens 2 px darüber hinaus, dazu 1 px leerer Rand).
"""
import numpy as np

import anim_lib as L
import anim_tiefsee as T
import anim_untote as U

N, MS = 48, 70
spr = L.lade('deepsea-jack-o-lantern')
S = T.Szene('deepsea-jack-o-lantern', "Deepsea Jack O' Lantern", spr, N, MS, rand=(7, 7, 7, 6))
sh, sw, H, W = S.sh, S.sw, S.H, S.W
xx, yy, vorhanden, UMRISS = S.xx, S.yy, S.vorhanden, S.UMRISS
GPL, GPT = S.GPL, S.GPT
P = S.P
col = S.col
DUNST = (38, 26, 63)
AUGE_R, HOEHLE = (164, 10, 32), (13, 16, 49)
KONTUR = (13, 16, 49)
GLAS_RAMPE = [(88, 53, 159), (128, 92, 201), (182, 162, 224)]

mist = vorhanden & (spr[..., :3] == DUNST).all(-1)
lantern = vorhanden & ~mist & (((yy >= 18) & (xx >= 13)) | ((xx == 18) & (yy == 17)) | ((xx == 13) & (yy == 20)))
kopf = vorhanden & ~mist & ~lantern
hut_spitze = kopf & (yy <= 5)
kopf_rest = kopf & ~hut_spitze
AUGEN = [(7, 14), (12, 14)]
assert all(col(x, y) == AUGE_R for x, y in AUGEN)
GLAS = [(x, y) for y in range(22, 25) for x in range(14, 20) if lantern[y, x] and col(x, y) in GLAS_RAMPE]
assert len(GLAS) >= 10, GLAS

MIST_A, SPITZE_A, KOPF_A, LANT_A = S.teil(mist), S.teil(hut_spitze), S.teil(kopf_rest), S.teil(lantern)
BLINZ = {10: 1, 11: 1, 12: 1, 33: 1, 34: 1, 35: 1}
FLACKER = [0, 1, 0, -1, 0, 0, 1, 1, 0, -1, -1, 0]


def frame_gross(i, nur=None):
    # Schweben: Kopf zweistufig (Periode 24), Laterne Periode 16 mit Nachlauf
    hb = int(round(1.4 * T.sinz(i, 24)))
    lb = int(round(1.0 * T.sinz(i, 16, 1.0))) - int(round(1.0 * T.sinz(0, 16, 1.0)))
    # Hutspitze neigt sich
    s = T.sinz(i, 16)
    dxs = [int(round(2.0 * s)), int(round(1.0 * s)), 0]
    sp = T.gruppen_scher(SPITZE_A, [(GPT, GPT + 1), (GPT + 2, GPT + 3), (GPT + 4, GPT + 5)], dxs)
    kp = KOPF_A.copy()
    if BLINZ.get(i):
        for (x, y) in AUGEN:
            kp[GPT + y, GPL + x, :3] = HOEHLE
    kopf_ges = L.zusammen(H, W, [(kp, 0, 0), (sp, 0, 0)])
    # Dunst: zwei Wellen unterhalb des Kopfes
    m1 = T.wehen(MIST_A, GPT + 16, 1.6, i, 24, lag=1.4, potenz=1.2)
    m2 = T.wehen(m1, GPT + 16, 1.0, i, 16, lag=-1.0, potenz=1.4)
    # Laternenglas flackert (Kerzenschein)
    lant = LANT_A.copy()
    for k, (x, y) in enumerate(GLAS):
        base = GLAS_RAMPE.index(col(x, y))
        d = FLACKER[(i // 2 + 3 * k) % 12] - FLACKER[(3 * k) % 12]
        lant[GPT + y, GPL + x, :3] = GLAS_RAMPE[max(0, min(2, base + d))]
    f = L.zusammen(H, W, [(m2, 0, hb), (kopf_ges, 0, hb), (lant, 0, lb)])
    f = U.kontur_schliessen(f, UMRISS, KONTUR)
    if nur == 'koerper':
        return f
    violett = {'c': (128, 92, 201), 'r': (88, 53, 159)}
    teal = {'c': (77, 137, 154), 'r': (51, 93, 119)}
    p1 = U.wolke_ebene(H, W, i, 24, [dict(x=P(19, 15)[0], y=P(19, 15)[1], vx=1, vy=-8, off=0, wackeln=0.6),
                                      dict(x=P(20, 14)[0], y=P(20, 14)[1], vx=-1, vy=-8, off=12, wackeln=0.6)], violett)
    p2 = U.wolke_ebene(H, W, i, 48, [dict(x=P(17, 37)[0], y=P(17, 37)[1], vx=1, vy=-8, off=0, wackeln=0.6),
                                      dict(x=P(20, 35)[0], y=P(20, 35)[1], vx=0, vy=-8, off=24, wackeln=0.6)], teal)
    return L.zusammen(H, W, [(p1, 0, 0), (p2, 0, 0), (f, 0, 0)])


S.bauen(frame_gross)
frame = S.frame
TEST_EBENEN = 'koerper'

if __name__ == '__main__':
    S.main([0, 3, 6, 9, 12, 15, 18, 21])
