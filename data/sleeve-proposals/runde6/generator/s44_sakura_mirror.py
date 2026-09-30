# -*- coding: utf-8 -*-
"""44 Sakura Mirror – Gegner „Grand Rebellion!“ (Structure Deck), Held: Champion, the Stormbringer.

Abendstille vor dem Aufstand: Champion steht auf einem Trittstein mitten im Fluss, das Schwert gesenkt, den
Arm ausgestreckt; das Wasser spiegelt ihn und den Abendhimmel. Am anderen Ufer unter den Kirschbäumen wartet
der Rebelliokai Courtly Kirin (Cover-Karte), über dem Hain gleitet der Rebelliokai Terror Tengu mit seinem
Fächer heran, Blüten treiben auf dem Wasser – die Rebellen sammeln sich um ihren Anführer.
(Bewusst anders als „Stormdraw“: kein Tornado, keine Karten, kein Hügel, ein Ruhemoment statt Aktion.)

Quellen:
  MotiveJapan.xcf  Ebene 121 „Champion“ + 119 „Ebene #167“ (Schwerthand) + 120 „Ebene #166“ (Schwert) –
                   Base-Karte „Champion, the Stormbringer“ (Sichtbar #38 = Ebene 1, Lage 307,237; dort zusätzlich
                   von der weichen Schattenebene 118 überlagert, daher die Farbabweichungen im Szenenvergleich;
                   wie in Runde 5 „Stormdraw“ geprüft). NICHT MotiveHawaii „Ascended Champion“.
  MotiveJapan.xcf  Ebene 166 „Kirin“ (Rebelliokai Courtly Kirin, Sichtbar 29 Lage 185,175),
                   Ebene 200 „Ebene #99“ (Rebelliokai Terror Tengu mit Fächer, Sichtbar 37),
                   Ebene 181 „Ebene #18“ (drei Kirschbäume aus der Kirin-Szene),
                   Ebene 142 „KIRSCHBLÜTEN“ (einzelne Blütenblätter – ein Ausschnitt treibt auf dem Wasser).
Selbst gezeichnet: Abendhimmel, Ufer, Wasser mit Spiegelungen (Himmel, Hain, Champion), Wellenlinien, Trittstein.

Skalierung (Tiefenebenen):
  Hintergrund (Himmel, Hain, Kirin 26×31 → 52×62, Tengu, Ufer, fernes Wasser, Blüten)   – 2×-Raster (125×175)
  Vordergrund (Champion 28×31 → 112×124, Trittstein, seine Spiegelung, Wellen)         – 4×-Raster (63×88)
"""
import math, random
import numpy as np
from kitH import *  # noqa

BJ = 'MotiveJapan'
rnd = random.Random(44)

champ = sprite('o44_champion', BJ, [119, 120, 121])
kirin = sprite('o44_kirin', BJ, [166])
tengu = sprite('o44_tengu', BJ, [200])
grove = sprite('o44_grove', BJ, [181])
petals = sprite('o44_petals', BJ, [142])

# ================================================================== Hintergrund 2× (125×175)
w2, h2 = grid(2)
bg = rgba(w2, h2)
bg[..., 3] = 255
WL = 92                                              # Wasserlinie am fernen Ufer (y 184)
SKY = [(40, 26, 66), (70, 38, 88), (118, 56, 102), (176, 84, 108), (226, 128, 110), (246, 176, 128)]
for y in range(WL):
    t = y / (WL - 1) * (len(SKY) - 1)
    i = min(int(t), len(SKY) - 2)
    f = t - i
    for x in range(w2):
        bg[y, x, :3] = SKY[i + 1] if f > BAY[y % 4, x % 4] else SKY[i]
# ferne Hügel im Dunst
for x in range(w2):
    top = int(WL - 14 - 6 * math.sin(x * 0.045 + 0.8) - 3 * math.sin(x * 0.13))
    for y in range(top, WL):
        bg[y, x, :3] = (150, 82, 110) if y == top else (122, 66, 100)

# Ufer: Grasstreifen, darauf der Kirschhain
BANK0 = WL - 5
for y in range(BANK0, WL + 1):
    for x in range(w2):
        bg[y, x, :3] = (74, 96, 64) if y == BANK0 else ((52, 72, 50) if y < WL else (30, 40, 36))
gh, gw = grove.shape[:2]
put(bg, grove, -14, BANK0 - gh + 2)
put(bg, flip(grove), w2 - gw + 20, BANK0 - gh + 3)
put(bg, grove[:, 26:], 46, BANK0 - gh + 1)           # mittlere Baumgruppe (zwei Bäume), etwas zurückgesetzt
# Kirin (Cover-Karte) am Ufer, links der Mitte zwischen den Bäumen
kh, kw = kirin.shape[:2]
KX = 11
for i in range(4, kw - 4):
    setp(bg, KX + i, BANK0 + 1, (36, 52, 40))
put(bg, kirin, KX, BANK0 + 1 - kh)

# Wasser: gespiegelter Himmel/Hain, abgedunkelt und blaugrün getönt, mit waagrechten Wellenlinien
WATER = np.array((34, 52, 84))
for y in range(WL + 1, h2):
    k = y - WL
    sy = WL - k
    fade = max(0.62 - 0.006 * k, 0.28)
    for x in range(w2):
        sx = x + (1 if (k // 3 + x // 9) % 5 == 0 else 0)
        c = bg[max(sy, 0), min(sx, w2 - 1), :3].astype(float) if sy >= 0 else WATER
        col = WATER * (1 - fade) + c * fade
        if (k + (x // 13) * 2) % 9 == 0 and k > 2:
            col = col * 1.18 + 6
        bg[y, x, :3] = np.clip(col, 0, 255)
for x in range(w2):                                  # Uferkante
    bg[WL + 1, x, :3] = (22, 30, 34)

# Tengu gleitet über den Hain heran (rechts oben; erst nach dem Wasser gesetzt, hoch in der Luft)
put(bg, tengu, 86, 18)

# treibende Blüten: ein Ausschnitt der Blütenblatt-Ebene als lockere Drift quer über das Wasser
drift = petals[40:62, 10:120]
for j in range(drift.shape[0]):
    for i in range(drift.shape[1]):
        if drift[j, i, 3]:
            X, Y = 8 + i, WL + 6 + int(j * 0.9) + int(4 * math.sin(i * 0.08))
            if 0 <= X < w2 and WL + 2 < Y < h2:
                bg[Y, X, :3] = drift[j, i, :3]

# ================================================================== Vordergrund 4× (63×88)
w4, h4 = grid(4)
fg = rgba(w4, h4)
ch, cw = champ.shape[:2]
FEET = 54                                            # Standzeile (y 216–220)
CX = 19
# Füße: unterste deckende Zeile des Sprites
feet_row = np.where(champ[..., 3].any(1))[0].max()
CY = FEET - feet_row
# Trittstein: flache, ovale Oberseite (von schräg oben gesehen), auf der beide Füße stehen –
# der linke Fuß (Sprite-Zeile 25) weiter hinten, der rechte (Zeile 30) vorn –, darunter eine Seitenkante.
STONE = [(58, 54, 66), (84, 78, 88), (116, 104, 110), (36, 34, 46), (140, 122, 120)]
ECX, ECY, ERX, ERY = CX + 15.0, CY + 28.0, 13.5, 4.2
RIM = 2
top_rows = {}
for y in range(int(ECY - ERY) - 1, int(ECY + ERY) + 2):
    for x in range(int(ECX - ERX) - 1, int(ECX + ERX) + 2):
        d = ((x + .5 - ECX) / ERX) ** 2 + ((y + .5 - ECY) / ERY) ** 2
        if d <= 1:
            top_rows[x] = max(top_rows.get(x, -1), y)
            c = STONE[4] if d > 0.72 and y + .5 < ECY else (STONE[2] if d < 0.5 else STONE[1])
            fg[y, x, :3] = c
            fg[y, x, 3] = 255
BOT = int(ECY + ERY) + 1                             # Unterkante der Seitenwand = Wasserlinie
for x, yb in top_rows.items():
    for y in range(yb + 1, yb + 1 + RIM):
        fg[y, x, :3] = STONE[0]
        fg[y, x, 3] = 255
    setp(fg, x, yb + 1 + RIM, STONE[3])
    if x % 2:
        setp(fg, x + 1, yb + 2 + RIM, (120, 150, 180))
WLINE = max(top_rows.values()) + 1 + RIM
# Spiegelung unter dem Stein: vertikal gespiegelt, ins Wasser getönt, jede 3. Zeilengruppe versetzt, gedithert
refl = champ[::-1].copy()
feet_off = ch - 1 - feet_row
for j in range(refl.shape[0]):
    for i in range(cw):
        if refl[j, i, 3]:
            col = refl[j, i, :3] * 0.45 + np.array((30, 50, 90)) * 0.55
            dx = 1 if (j // 3) % 3 == 1 else 0
            X, Y = CX + i + dx, WLINE + 1 + j - feet_off
            if 0 <= X < w4 and WLINE + 1 < Y < h4 and fg[Y, X, 3] == 0 and BAY[Y % 4, X % 4] < 0.8:
                fg[Y, X, :3] = col
                fg[Y, X, 3] = 255
SX0, SX1 = int(ECX - ERX), int(ECX + ERX)
put(fg, champ, CX, CY)
# ein paar Wellenlinien um den Stein (hell/dunkel)
for (x0, y0, ln) in [(SX0 - 7, WLINE + 2, 5), (SX1 + 2, WLINE + 3, 6), (SX0 - 4, WLINE + 6, 4), (SX1, WLINE + 8, 4)]:
    for i in range(ln):
        setp(fg, x0 + i, y0, (130, 160, 190) if 0 < i < ln - 1 else (80, 104, 140))

cv = Canvas(W, H)
blit(cv, bg, 2)
blit(cv, fg, 4)
print(save(cv, '44_sakura_mirror.png'))
