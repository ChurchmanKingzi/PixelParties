# -*- coding: utf-8 -*-
"""Idle-Animation für „Sparkfly Worker“ (Creature) — Regeln 14/15/16.

PICK: [["MotiveRussia", 165, 3], ["MotiveRussia", 165, 1], ["MotiveRussia", 167, 1]] + Körper aus der Kartenkunst (siehe unten)
Eigenes Sprite (creature_show.py findet nur Beutel/Teile): Die Karte zeigt vier gleiche Fliegen (je 17×22 px, aus mehreren Ebenen von MotiveRussia.xcf zusammengesetzt, die Flügel
durchscheinend über der Wabe). Ich habe die obere linke Fliege gewählt (vollständig sichtbar, Komponente der Karte x 18–34, y 3–24) und so gebaut:
  * Flügel: die zwei sauberen Blattflügel aus Ebene 165 (Figur 3 links, Figur 1 rechts; je 9×13 px, 80 Pixel, Farben (58,56,6)/(147,151,11)/(160,160,21)) an ihrer Kartenposition
    (Abgleich der Silhouette mit der Fliege der Karte; die Flügel der Karte sind durch die Wabe getönt, die Ebenenfarben sind die sauberen).
  * Beutel: Ebene 167, Figur 1 (10×8, 42 Pixel), exakt an Kartenposition (22,18) (Farbabweichung ~9, also exakt bis auf das Rauschen der Kunst).
  * Körper (Kopf/Brust mit grünen Augen, Beine): aus den Pixeln der Karte (Silhouette per Abstand zur Wabenfarbe), jede Farbe auf die nächste Farbe der Körperebenen
    (Ebene 155/177: (42,27,14)/(17,11,5)/(51,33,16)/…, Augen (140,159,0)/(166,181,59)) eingerastet — keine Farbe erfunden, keine Rauschpixel.
  src/sparkfly-worker.png            das fertige Sprite (17×22 px, 19 Farben) = alle Teile übereinander
  src/sparkfly-worker-fluegel-l / -r  die Blattflügel (hinter dem Körper)
  src/sparkfly-worker-koerper         Kopf und Brust mit Augen
  src/sparkfly-worker-beutel          Beine und Beutel (hängen am Körper)

Aufruf:   python3 sparkfly_worker.py [--preview <ordner>]
Ausgabe:  ../../data/creature-animations/sparkfly-worker.png + .json  (Frame auf die Figur zugeschnitten)

Identifikation (Sprite-Koordinaten x, y):
* Flügel: links x 0–8, y 0–12 (Blatt, Spitze oben links), rechts x 8–16, y 1–13 (Blatt, Spitze oben rechts); Rand (58,56,6), Füllung (147,151,11)/(160,160,21).
* Körper: Kopf und Brust (x 6–14, y 5–13), dunkelbraun (17,11,5)/(42,27,14)/(51,33,16); zwei Augen grün (140,159,0) mit hellem Glanzpixel (166,181,59) bei (11,8–9) und (13,8–9).
* Beine: fünf kurze Striche (x 3–11, y 14–15); Beutel (x 5–12, y 15–21) hängt darunter, braun (85,46,11)/(105,63,25), Rand (33,20,7), zwei graue Schnallen (83,81,79).
* Die Flügel der Karte sind weich durchscheinend; hier deckend (wie bei den Bomblebees und dem Sparkfly Architect).

Ablauf (48 Frames à 60 ms = 2,88 s):
* Kräftiger Flügelschlag: achtmal pro Schleife (Periode 6): jedes Blatt dreht sich als Ganzes um seine Wurzel (links (6,12), rechts (9,13)), die Spitze beschreibt einen großen Bogen:
  Aufschlag bis +16° (die beiden Blätter bleiben getrennt, früher +35°: sie verschmolzen zu einem Blatt), Abschlag bis unter die Waagerechte (−70°), Abschlag schneller als Aufschlag, Ruhepose (Frame 0) = Original.
  Drehung per Rückrechnung (Nächster-Nachbar, keine Mischfarben, Alpha 0/255, Kanten geglättet), die Blätter bleiben vollständig und liegen hinter dem Körper. Beide Flügel schlagen gleichzeitig (gespiegelt).
* Schwebe-Bob zweistufig bis 2 px nach oben (0 → 1 → 2 → 1 → 0, Periode 12): Körper, Beine, Flügelwurzeln und Beutelaufhängung bekommen den GLEICHEN Versatz.
* Beutel (Runde 2, Nutzerfeedback „Körper fehlt/Lücke zwischen Körper und Beutel“): Ursache war, dass die fünf Beine (Zeilen 14–15) zusammen mit dem Beutel pendelten und sich vom Körper lösten.
  Jetzt gehören die Beine fest zum Körper (starr, gleicher Bob); NUR der Beutel (Zeilen ab 16 und (7–9,15)) schwingt an seinen beiden Aufhängebeinen (x = 7 und 9) waagerecht, je tiefer desto mehr (bis 2 px, Periode 24,
  hinkt unten nach), und hinkt dem Bob um bis zu 1 px hinterher: dabei wachsen die beiden Aufhängebeine um 1 px (ergänzte Pixel (7,15), (9,15) in der Beinfarbe (17,11,5)). Jede Beutelzeile behält in JEDEM Frame mindestens
  eine Spalte gemeinsam mit der Zeile darüber, die oberste mit den Beinen (anim_insekt.haengen_pendeln) → nirgends eine Lücke; ein Test im Skript (ZUSAMMENHANG-Test) prüft das für alle Frames.
* Blinzeln (Frames 33–34): die Augen schließen sich — Lid in Körperfarbe (42,27,14), die Augenpixel werden zu Körper.
* Kein Glanz, keine Partikel (Fell/Stoff/Chitin glänzen nicht; es gibt kein Feuer oder Staub).

Ergänzungen: nur die beiden Verlängerungspixel der Aufhängebeine (7,15) und (9,15) in (17,11,5), sichtbar nur in Frames, in denen der Beutel 1 px unter dem Körper hängt. Sonst nichts — die Flügel
liegen vollständig hinter dem Körper (die ganzen Blätter sind in der Ebene vorhanden), nichts Verdecktes fehlt. Die beiden äußeren Beine (3,14–15) und (11,14) hängen wie im Original nur diagonal am Körper (Künstlerstil, Frame 0 = Original).
Rahmen: auf die Figur zugeschnitten (Vereinigung aller Frames + 2 px freier Rand), keine Effekte außerhalb der Figur.
Randpixel-Test (Regel 16): Die Drehung kann Innenfarbe an die Kanten legen → F.umranden setzt den Flügelrand (58,56,6); zusätzlich randtest.py.
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

spr = L.lade('sparkfly-worker')
sh, sw = spr.shape[:2]
H, W = sh + PAD_T + PAD_B, sw + PAD_L + PAD_R


def teil(name):
    return L.platz(L.lade('sparkfly-worker-' + name), H, W, PAD_L, PAD_T)


P_WL, P_WR, P_KP, P_BEUTELALT = teil('fluegel-l'), teil('fluegel-r'), teil('koerper'), teil('beutel')
# Runde 3 (Nutzerfeedback „weiterhin einfach Lücken, wenn die Flügel bewegt werden“): Die Flügel drehen sich jetzt um einen Drehpunkt IM Körper (links (7,11), rechts (10,10)) und
# bekommen dort eine Wurzelscheibe (Radius 2, Farbe (147,151,11)), die im Ruhebild und in jeder Pose HINTER dem Körper steckt: die Wurzel ist damit fest am Rumpf angewachsen, das
# Blatt wächst immer aus dem Körper heraus, nie von ihm weg.
PIV_L, PIV_R = (7, 11), (10, 10)
WURZEL = (147, 151, 11)
for _p, (_cx, _cy) in ((P_WL, PIV_L), (P_WR, PIV_R)):
    for _y in range(-3, 4):
        for _x in range(-3, 4):
            if _x * _x + _y * _y <= 5 and not _p[PAD_T + _cy + _y, PAD_L + _cx + _x, 3]:
                _p[PAD_T + _cy + _y, PAD_L + _cx + _x, :3] = WURZEL
                _p[PAD_T + _cy + _y, PAD_L + _cx + _x, 3] = 255
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_KP, P_BEUTELALT)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()      # Wurzelscheiben sind im Ruhebild vom Körper verdeckt
yy, xx = np.mgrid[0:H, 0:W]
beutel_maske = (yy >= PAD_T + 16) | ((yy == PAD_T + 15) & (xx >= PAD_L + 7))      # Beutel: Zeilen ab 16 und (7–9,15) (Oberkante hängt an den Beinen x = 7 und 9)
P_BEUTEL = np.where(beutel_maske[..., None], P_BEUTELALT, 0).astype(np.uint8)
P_BEINE = np.where(beutel_maske[..., None], 0, P_BEUTELALT).astype(np.uint8)          # fünf Beine (x = 3, 5, 7, 9, 11), starr am Körper
P_KPB = L.zusammen(H, W, [(P_KP, 0, 0), (P_BEINE, 0, 0)])                        # Körper + Beine = eine starre Ebene
assert (L.zusammen(H, W, [(p, 0, 0) for p in (P_WL, P_WR, P_KPB, P_BEUTEL)])[PAD_T:PAD_T + sh, PAD_L:PAD_L + sw] == spr).all()
BEIN_FARBE = (17, 11, 5)
BEIN_SPALTEN = [PAD_L + 7, PAD_L + 9, PAD_L + 11]                          # Beine in Zeile 14, an denen der Beutel hängt

KOERPER = (42, 27, 14)
AUGEN = [(11, 8), (13, 8), (11, 9), (13, 9)]
UMRISS = F.umriss_farben(spr)
FLUEGELRAND = (58, 56, 6)
BEUTELRAND = (33, 20, 7)
THETA_C, THETA_A = math.radians(-27.0), math.radians(43.0)    # Drehwinkel −70° … +16° (Ruhe 0°); Aufschlag nur so weit, dass die beiden Blätter getrennt bleiben
THETA_P0 = math.asin(-THETA_C / THETA_A)
Y_AUFH = PAD_T + 13                                          # Körperunterkante: darunter hängen Beine und Beutel


def frame(i, partikel=True, effekte=True, nur_koerper=False, teile=None):
    ph = L.sinus(i, N / 8)                                     # Flügelschlag: achtmal pro Schleife (Periode 6)
    u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2     # Bob: Periode 12
    bob = -int(round(2 * u(i)))                                # 0 → −1 → −2 → −1 → 0 (nur nach oben, zweistufig)

    wl, wr, kp, bt = P_WL.copy(), P_WR.copy(), P_KPB.copy(), P_BEUTEL.copy()
    if i in (33, 34):                                          # Blinzeln: Lid = Körperfarbe
        F.setze(kp, PAD_L, PAD_T, {p: KOERPER for p in AUGEN})

    # Flügelschlag: jedes Blatt dreht sich um seine Wurzel (Spitze beschreibt einen Bogen): Aufschlag fast senkrecht, Abschlag bis unter die Waagerechte
    ph2 = ph + 0.4 * math.sin(ph)                              # Abschlag schneller als Aufschlag
    theta = THETA_C + THETA_A * math.sin(ph2 + THETA_P0)       # links: im Uhrzeigersinn (+) = Spitze richtet sich auf; Ruhe (Frame 0) = 0
    wl = F.drehen(wl, PAD_L + PIV_L[0], PAD_T + PIV_L[1], theta, glatt=True)
    wr = F.drehen(wr, PAD_L + PIV_R[0], PAD_T + PIV_R[1], -theta, glatt=True)
    # Beutel: hinkt dem Bob um 0 … 1 px hinterher (die Aufhängebeine wachsen dann um 1 px) und schwingt waagerecht an den Beinen
    bob_b = -int(round(2 * u(i - 1.3)))
    d = max(0, min(1, bob_b - bob))                            # 0 = Beutel hängt direkt am Körper, 1 = 1 px tiefer
    spalten = BEIN_SPALTEN
    if d:
        F.setze(kp, PAD_L, PAD_T, {(7, 15): BEIN_FARBE, (9, 15): BEIN_FARBE})
        spalten = BEIN_SPALTEN[:2]
    bt = I.haengen_pendeln(bt, PAD_T + 14, 2.4, L.sinus(i, N / 2), 0.6, oben_spalten=spalten)
    bt = L.versetze(bt, 0, d)

    wl, wr, kp, bt = (L.versetze(a, 0, bob) for a in (wl, wr, kp, bt))
    # Reste weg: Einzelne sichtbare Flügelpixel (Wurzelscheibe/Kontur, die unter dem Körper hervorlugt) sind keine Flügelfläche — Komponenten < 3 px entfallen
    _kor = (kp[..., 3] > 0) | (bt[..., 3] > 0)
    for _w in (wl, wr):
        _v = _w.copy()
        _v[_kor] = 0
        _n, _gr, _lab = I.komponenten4(_v)
        for _c in range(1, _n + 1):
            if (_lab == _c).sum() < 3:
                _w[_lab == _c] = 0
    f = L.zusammen(H, W, [(kp, 0, 0), (bt, 0, 0)] if nur_koerper else [(wl, 0, 0), (wr, 0, 0), (kp, 0, 0), (bt, 0, 0)])
    if not nur_koerper:                                        # Lücke fertigzeichnen: waagerechter 1-px-Spalt zwischen Flügel und Körper wird mit der Flügelfarbe geschlossen
        kor = (kp[..., 3] > 0) | (bt[..., 3] > 0)
        kor[PAD_T + 14 + bob:] = False                         # nur Kopf/Brust zählen (die dünnen Beine unter dem Flügelrand nicht)
        fl = ((wl[..., 3] > 0) | (wr[..., 3] > 0)) & ~((kp[..., 3] > 0) | (bt[..., 3] > 0))
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if f[y, x, 3] == 0:
                    if fl[y, x - 1] and kor[y, x + 1]:
                        f[y, x] = f[y, x - 1]
                    elif kor[y, x - 1] and fl[y, x + 1]:
                        f[y, x] = f[y, x + 1]
    F.umranden(f, [wl, wr], UMRISS, FLUEGELRAND, FLUEGELRAND, FLUEGELRAND)       # Randpixel-Test (Regel 16)
    F.umranden(f, [bt], UMRISS, BEUTELRAND, BEUTELRAND, BEUTELRAND)
    if teile is not None:
        teile.update(wl=wl, wr=wr, kp=kp, bt=bt, bob=bob)
    return f


def zuschneiden(frames, koerper_frames, max_ueber=3):
    """Frame auf die Figur zuschneiden: Vereinigung aller Frames + 2 px freier Rand; Effekte ragen höchstens max_ueber px über die Körper-Frames hinaus."""
    def bbox(fs):
        a = np.stack([f[..., 3] > 0 for f in fs]).any(axis=0)
        ys, xs = np.nonzero(a)
        return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    bx0, by0, bx1, by1 = bbox(koerper_frames)
    ex0, ey0, ex1, ey1 = bbox(frames)
    ueber = (bx0 - ex0, by0 - ey0, ex1 - bx1, ey1 - by1)
    print('Figur (Körper-Frames) x', bx0, '…', bx1, 'y', by0, '…', by1, '| Effekte ragen hinaus (links, oben, rechts, unten):', ueber)
    assert max(ueber) <= max_ueber, f'Effekte ragen mehr als {max_ueber} px über die Figur: {ueber}'
    x0, y0, x1, y1 = ex0 - 2, ey0 - 2, ex1 + 2, ey1 + 2
    return [f[y0:y1 + 1, x0:x1 + 1].copy() for f in frames]


def zusammenhang_test(frames):
    """ZUSAMMENHANG-Test (Nutzerfeedback: Lücke zwischen Körper und Beutel / fehlendes Körperteil): in JEDEM Frame
    (1) bilden Körper, Beine und Beutel ohne die Flügel eine einzige 4-verbundene Fläche — bis auf die beiden diagonal angesetzten Außenbeine (3,14–15) und (11,14), wie im Original;
    (2) ist die ganze Figur inklusive Flügel genauso verbunden (kein Flügel löst sich vom Körper);
    (3) steht jedes Körperpixel des Ruhebilds (verschoben um den Bob) unverändert im Frame (nichts Verdecktes, nichts fehlt)."""
    soll0 = I.komponenten4(L.zusammen(H, W, [(P_KPB, 0, 0), (P_BEUTEL, 0, 0)]))[1]
    for k, f in enumerate(frames):
        u = lambda t: (1 - math.cos(2 * math.pi * t / (N / 4))) / 2
        bob = -int(round(2 * u(k)))
        wl, wr, kp, bt = P_WL.copy(), P_WR.copy(), P_KPB.copy(), P_BEUTEL.copy()
        n_all, gr_all, _ = I.komponenten4(f)
        assert n_all <= 3 and gr_all[0] >= 100 and sum(gr_all[1:]) <= 3, f'Frame {k}: Figur zerfällt in Teile {gr_all}'
        # Körperpixel vollständig sichtbar (außer den bewusst geblinzelten Augen)
        sicht = P_KPB[..., 3] > 0
        for y, x in zip(*np.nonzero(sicht)):
            if (x - PAD_L, y - PAD_T) in AUGEN and k in (33, 34):
                continue
            assert f[y + bob, x, 3] and (f[y + bob, x, :3] == P_KPB[y, x, :3]).all(), f'Frame {k}: Körperpixel ({x - PAD_L},{y - PAD_T}) fehlt oder ist überdeckt'
    print('ZUSAMMENHANG-Test bestanden: Körper+Beine+Beutel in allen', len(frames), 'Frames verbunden (außer den 2 diagonalen Außenbeinen), alle Körperpixel sichtbar')


def anschluss_test(min_kontakt=4):
    """ANSCHLUSS-Test (Runde 3: „Lücken, wenn die Flügel bewegt werden“): In JEDEM Frame hat jeder Flügel mindestens `min_kontakt` sichtbare Pixel, die waagerecht/senkrecht
    (4-verbunden) an Körper/Beine grenzen — der Flügel hängt breit am Rumpf, nicht nur über eine Pixelecke —, und es gibt KEIN leeres Pixel, das links und rechts (bzw. oben und unten)
    zwischen einem Flügel- und einem Körperpixel eingeklemmt ist (waagerechter 1-px-Spalt; Beine unter dem Flügelrand zählen nicht)."""
    worst = {'l': 99, 'r': 99}
    for k in range(N):
        t = {}
        f = frame(k, False, False, teile=t)
        kor = (t['kp'][..., 3] > 0) | (t['bt'][..., 3] > 0)
        kor_oben = kor.copy()
        kor_oben[PAD_T + 14 + t['bob']:] = False
        for nm in ('l', 'r'):
            fl = t['w' + nm][..., 3] > 0
            sichtbar = fl & ~kor
            p = np.pad(kor, 1)
            nachbar = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
            kontakt = int((sichtbar & nachbar).sum())
            worst[nm] = min(worst[nm], kontakt)
            assert kontakt >= min_kontakt, f'Frame {k}: Flügel {nm} grenzt nur mit {kontakt} Pixel(n) an den Körper'
        alle_f = (t['wl'][..., 3] > 0) | (t['wr'][..., 3] > 0) | ((f[..., 3] > 0) & ~kor)
        leer = ~(alle_f | kor)
        kor = kor_oben
        h, w = leer.shape
        spalte = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if leer[y, x] and ((alle_f[y, x - 1] and kor[y, x + 1]) or (kor[y, x - 1] and alle_f[y, x + 1])):
                    spalte.append((x - PAD_L, y - PAD_T))
        if k == 0:
            basis = len(spalte)                               # Ruhebild = Original: so viele 1-px-Spalte (Flügelunterkante über einem Bein) sind schon in der Kunst
        assert len(spalte) <= basis, f'Frame {k}: neue 1-px-Spalte zwischen Flügel und Körper {spalte}'
    print('ANSCHLUSS-Test bestanden: Flügel grenzen in allen', N, 'Frames mit ≥', worst, 'Pixeln an den Körper, kein 1-px-Spalt')


def beutel_test(frames):
    """Der Beutel (Zeilen unterhalb der Beine) ist in jedem Frame 4-verbunden mit den Beinen/dem Körper (ohne die Flügel gerechnet)."""
    for k in range(N):
        f = frame(k, False, False, nur_koerper=True)
        n, gr, _ = I.komponenten4(f)
        assert n <= 3 and gr[0] >= 100 and sum(gr[1:]) <= 3, f'Frame {k}: Beutel oder Körper abgetrennt {gr}'
    print('BEUTEL-Test bestanden: Körper+Beine+Beutel ohne Flügel in allen', N, 'Frames zusammenhängend', gr)


if __name__ == '__main__':
    koerper_frames = [frame(i, False) for i in range(N)]
    frames = [frame(i) for i in range(N)]
    beutel_test(frames)
    anschluss_test()
    zusammenhang_test(frames)
    frames = zuschneiden(frames, koerper_frames)
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    n = L.pruefe(frames, quelle=spr, erlaubt=[(33, 30, 5)])      # (33,30,5): dunkler Flügelrand aus Ebene 165, im Ruhebild vom Körper verdeckt
    print('Pixel je Frame:', n)
    L.speichern('sparkfly-worker', 'Sparkfly Worker', frames, MS, prev)
    if prev:
        L.streifen(prev + '/sparkfly-worker-strip.png', frames, spalten=8, scale=6)
