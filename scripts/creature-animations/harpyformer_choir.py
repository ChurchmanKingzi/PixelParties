# -*- coding: utf-8 -*-
"""Idle-Animation für „Harpyformer Choir“ (Creature) — drei Harpyien stehen als Chor und singen; violette Noten steigen auf.

PICK: [["MotiveMoe", 129, "Ebene „Harpyformer Choir“, Figur 1 (die drei Harpyien, 66×42 px)"], ["MotiveMoe", 127, "Ebene #178: sechs violette Noten"]]
Abgleich mit data/card-art/native/Harpyformer_Choir.png: Harpyien 96,5 %, Noten 100 %. Bühne, Vorhang, Lichterkette = Szene (nicht verwendet); Ebene 128 = halbtransparenter Schatten.
  src/harpyformer-choir.png        die drei Harpyien (Ruhepose, Referenz)
  src/harpyformer-choir-noten.png  Notenebene (64×45; liegt um (+3, −8) versetzt zum Harpyien-Sprite)

Identifikation (66×42), alle drei stehen von vorn, Augen geschlossen (schwarze Striche), Mund weit offen (schwarzes 2×3-Rechteck):
* Hintere Harpyie (Mitte oben, x 23–48, y 0–25): lila Haar, braunes Kleid, Flügel hochgereckt (links x 23–29, rechts x 42–48, y 0–15), Mund (35–36, 10–12), Krallenfüße y 21–25.
* Vordere linke Harpyie (x 0–36, y 15–40): rote Nikolausmütze mit weißem Rand und Bommel (x 12–25, y 15–22), rosa Haar, Flügel waagerecht ausgebreitet (links x 0–13, rechts x 22–36,
  y 24–32; der rechte liegt vor den Füßen der hinteren), Mund (18–19, 25–27).
* Vordere rechte Harpyie (x 40–65, y 15–41): gleiche Mütze, Flügel hängen angelegt herab (links x 40–46, rechts x 59–65, y 26–41; ab y 32 durch eine Lücke vom Körper getrennt), Mund (52–53, 25–27).
Flügel haben keinen dunklen Umriss (weiß/grau). Bodenwesen: nichts schwebt, Köpfe bleiben gerade.

Ablauf (64 Frames à 70 ms = 4,5 s). Frame 0 = Original:
* Singen: jede Harpyie öffnet/schließt den Mund in eigenem Rhythmus (3 Stufen: weit – halb – schmal; die unteren Mundzeilen nehmen die Kinnfarbe der Nachbarpixel an).
* Flügel im Takt (Periode 16, je Harpyie versetzt; immer der ganze Flügel ab Körperansatz, nichts wird gestreckt):
  – hinten: die hochgereckten Flügel wippen starr ±1 px (äußere 5 Spalten; die 2 Ansatzspalten bleiben am Körper),
  – links: die ausgebreiteten Flügel heben sich (Spaltenversatz 0 … −2 px zur Spitze hin; nur nach oben, damit vor den Füßen der hinteren Harpyie nichts frei wird),
  – rechts: die angelegten Flügel spreizen sich unten 1 px nach außen (Zeilen ab y 32, dort ohnehin vom Körper getrennt).
* Noten (Teil der Kartenkunst, 4–8 px groß): die sechs Noten steigen langsam auf (6 px in 32 Frames, leichtes Pendeln), erscheinen/vergehen als Notenkopf; in Frame 0 stehen sie am Ort der Vorlage.
Ergänzungen: keine.
"""
import math

import numpy as np

import anim_lib as L
import anim_n7 as N7

N, MS = 64, 70
sz = N7.Szene('harpyformer-choir', (5, 6, 16, 2))
spr = sz.spr
xx, yy = sz.xx, sz.yy
NOTEN = L.lade('harpyformer-choir-noten')
FED = sz.ist((252, 252, 252), (227, 227, 227), (200, 200, 200), (212, 212, 212), (243, 243, 243))
FL_HL = FED & (xx <= 27) & (yy <= 15) & (xx >= 23)
FL_HR = FED & (xx >= 44) & (xx <= 48) & (yy <= 15)
FL_LL = FED & (xx <= 12) & (yy >= 24) & (yy <= 32)
FL_LR = FED & (xx >= 23) & (xx <= 36) & (yy >= 24) & (yy <= 32) & ~((yy == 24) & (xx >= 30) & (xx <= 34))     # (33,24) ist die Kralle der hinteren Harpyie
FL_RL = FED & (xx >= 40) & (xx <= 46) & (yy >= 32)
FL_RR = FED & (xx >= 59) & (yy >= 32)
REST = sz.da & ~(FL_HL | FL_HR | FL_LL | FL_LR | FL_RL | FL_RR)
L_REST = sz.teil(REST)
T = {k: sz.teil(m) for k, m in dict(hl=FL_HL, hr=FL_HR, ll=FL_LL, lr=FL_LR, rl=FL_RL, rr=FL_RR).items()}
HAUT_N, HAUT_T = (238, 156, 123), (205, 115, 57)
MUND = [((35, 10), [3, 3, 3, 2, 1, 2, 3, 3, 3, 3, 2, 1, 1, 2, 3, 3]), ((18, 25), [3, 3, 2, 1, 1, 2, 3, 3, 2, 2, 3, 3, 3, 2, 1, 2]), ((52, 25), [3, 2, 1, 2, 3, 3, 3, 2, 1, 1, 2, 3, 3, 3, 2, 3])]
# Noten als Einzelsprites
import cv2
_n, _lab, _st, _ = cv2.connectedComponentsWithStats((NOTEN[..., 3] > 0).astype(np.uint8), connectivity=8)
NOTE = []
for k in range(1, _n):
    x, y, w, h, _a = _st[k]
    NOTE.append((int(x) + 3, int(y) - 8, np.where((_lab[y:y + h, x:x + w] == k)[..., None], NOTEN[y:y + h, x:x + w], 0).astype(np.uint8)))
NOTE.sort(key=lambda e: e[0])
T0 = [0.5, 0.15, 0.8, 0.35, 0.65, 0.25]
TEST_EBENEN = ('figur',)


def spalten(a, fn):
    out = L.leer(sz.H, sz.W)
    for x in range(sz.W):
        ys = np.nonzero(a[:, x, 3])[0]
        if len(ys):
            out[ys + int(fn(x - sz.PL)), x] = a[ys, x]
    return out


def pfad(t):
    return int(round(1.2 * math.sin(2 * math.pi * t))), -int(round(6 * t))


def frame(i, nur=None):
    rest = L_REST.copy()
    for (mx, my), folge in MUND:
        st = folge[(i // 2) % 16]
        if st <= 2:
            rest[sz.PT + my + 2, sz.PL + mx:sz.PL + mx + 2, :3] = HAUT_T
        if st <= 1:
            rest[sz.PT + my + 1, sz.PL + mx:sz.PL + mx + 2, :3] = HAUT_N
    a = N7.sinus_px(i, 16, 1)
    heb = -int(round(1.0 - math.cos(2 * math.pi * (i + 4) / 16) * 1.0 - (1.0 - math.cos(2 * math.pi * 4 / 16))))      # 0 … −2, in Frame 0 = 0
    heb = min(0, max(-2, heb))
    sp = N7.stufe(i, 16, 6, 6)
    eb = [(T['hl'], 0, a), (T['hr'], 0, a),
          (rest, 0, 0),
          (spalten(T['ll'], lambda x: 0 if x >= 10 else (heb + 1) // 2 if x >= 5 else heb), 0, 0),
          (spalten(T['lr'], lambda x: 0 if x <= 25 else (heb + 1) // 2 if x <= 30 else heb), 0, 0),
          (T['rl'], -sp, 0), (T['rr'], sp, 0)]
    f = L.zusammen(sz.H, sz.W, eb)
    if nur:
        return f
    for k, (nx, ny, bild) in enumerate(NOTE):
        t = (T0[k] + i / 32.0) % 1.0
        dx, dy = pfad(t); dx0, dy0 = pfad(T0[k])
        b = bild
        if t < 0.08 or t > 0.9:
            b = bild.copy(); b[:bild.shape[0] - 4] = 0
        L.einsetzen(f, b, sz.PL + nx + dx - dx0, sz.PT + ny + dy - dy0)
    return f


if __name__ == '__main__':
    N7.fertig('harpyformer-choir', 'Harpyformer Choir', frame, N, MS, np.concatenate([spr.reshape(-1, 1, 4), NOTEN.reshape(-1, 1, 4)]), check=[0, 4, 8, 12, 20, 28], zoom=7)
