# -*- coding: utf-8 -*-
"""Sleeve 19 – Die zwei Gesichter der Giftprinzessin (Doppelkopf-Spielkarte ohne Text).

Ersetzt den „Matrjoschka-Turm“ (Runde 3b: gestaffelte 5×→1×-Figuren auf derselben Tiefe = Regel A,
dazu Überlappungen). Neue Idee: ein Hofkartenbild wie bei klassischen Spielkarten – die Karte ist
punktsymmetrisch geteilt. Unten steht Rafflesia in ihrer blühenden Gestalt (roter Blütenhut, wie auf
ihrer Karte) in ihrem violetten Giftsumpf, oben – auf dem Kopf – ihre welke Traumgestalt
(„Rafflesia“-Ebene mit rosa Blütenblättern, dunkler Traumsumpf). Eine goldene Diagonale trennt die
Hälften, Giftblasen steigen auf, Funkel-Sterne des Sets als Ornament, Kartenrahmen in Gold.

Einheitliche Pixelgröße: ALLES 5× (beide Figuren, Funkelsterne, selbst gezeichnete Blasen,
Dithering der Hintergründe, Rahmen und Trennlinie). Keine Überlappung der Figuren.

Quellen (MotiveRussia.xcf):
  Rafflesia blühend = Ebene 229 „Ebene #1“ (Kartenbild „Rafflesia, the Poison Princess“)
  Rafflesia welk    = Ebene 228 „RAFFLESIA“ (Szene 144 – vollständig, 411/411 Pixel; die rosa
                      Umrisslinie 227 ist nur ein Auswahl-Leuchten und gehört nicht zur Figur)
  Funkelstern       = Ebene 217 „Ebene #13“ (5×5)
  Hintergründe, Blasen, Rahmen = selbst gezeichnet in den Farben der Karte (Violett/Giftgrün/Gold)
"""
from c_util import *

K = 5
cv = Canvas(W, H)
bloom = figure('c19_bloom', RU, [229])
wilt = figure('c19_wilt', RU, [228])
star = figure('c19_star', RU, [217])

# Halbbild (unten) auf 50×70-Zellenraster zeichnen, die obere Hälfte ist die um 180° gedrehte
# zweite Variante. Diagonale durch die Mitte: Zelle (x, y) gehört zur unteren Hälfte, wenn
# y > 35 + (25 - x) * 0.3 (native Zellen).
GW, GH = W // K, H // K


def diag(x):
    return GH / 2 + (GW / 2 - x) * 0.3


def half(cols_bg, fig, bubbles, bub_cols, stars):
    """Zeichnet eine vollständige Karte (50×70 Zellen) mit Hintergrund + Figur unten; Rückgabe RGB."""
    c = Canvas(W, H)
    for j in range(GH):
        for i in range(GW):
            t = (j - diag(i)) / (GH - diag(i)) if j > diag(i) else 0
            t = min(max(t, 0), 1)
            n = len(cols_bg) - 1
            q = t * n
            k_ = int(q) + (1 if (q - int(q)) > BAYER4[j % 4, i % 4] else 0)
            c.rect(i * K, j * K, (i + 1) * K, (j + 1) * K, cols_bg[min(k_, n)])
    # Giftblasen (Zellen): Ring mit Glanzpunkt
    shapes = {1: ["o"], 2: ["oo", "oo"], 3: [".o.", "oLo", ".o."], 4: [".oo.", "oLMo", "oMMo", ".oo."]}
    for (i, j, r) in bubbles:
        for dj, row in enumerate(shapes[r]):
            for di, ch in enumerate(row):
                if ch == '.': continue
                col = bub_cols[0] if ch == 'o' else bub_cols[1] if ch == 'L' else bub_cols[2]
                c.rect((i + di) * K, (j + dj) * K, (i + di + 1) * K, (j + dj + 1) * K, col)
    for (i, j) in stars:
        c.paste(up(star, K), i * K, j * K)
    # Figur: steht auf der unteren Kante des Innenfelds, leicht links der Mitte
    fh, fw = fig.shape[:2]
    fx, fy = 8, GH - 3 - fh
    put(c, fig, fx * K, fy * K, K, ol=(26, 10, 30), shadow=(20, 6, 30), sdx=1, sdy=0, salpha=0.6)
    return c.a.copy()


VIO = [(58, 22, 86), (88, 36, 120), (122, 52, 150), (150, 70, 170)]     # blühender Giftsumpf
DRM = [(20, 14, 40), (34, 24, 64), (52, 36, 90), (70, 50, 110)]         # welker Traumsumpf
B_BLOOM = [(96, 200, 90), (220, 255, 200), (150, 230, 120)]             # Giftgrüne Blasen
B_DREAM = [(200, 120, 170), (255, 230, 245), (230, 170, 210)]           # rosa Traumblasen

lower = half(VIO, bloom, [(33, 50, 4), (39, 42, 3), (35, 37, 2), (41, 33, 1), (30, 60, 2), (44, 56, 3)], B_BLOOM,
             [(40, 62), (32, 46)])
upper = half(DRM, wilt, [(33, 50, 4), (39, 42, 3), (35, 37, 2), (41, 33, 1), (30, 60, 2), (44, 56, 3)], B_DREAM,
             [(40, 62), (32, 46)])
upper = upper[::-1, ::-1]                                               # 180° gedreht
jj, ii = np.mgrid[0:H, 0:W]
low_mask = (jj // K) > np.vectorize(diag)(ii // K)
cv.a[:] = np.where(low_mask[..., None], lower, upper)

# Goldene Trennlinie (1 Zelle) mit dunklen Kanten
GOLD, GOLD_L, EDGE = (214, 170, 70), (250, 226, 130), (30, 14, 26)
for i in range(GW):
    j = int(round(diag(i)))
    cv.rect(i * K, (j - 1) * K, (i + 1) * K, j * K, EDGE)
    cv.rect(i * K, j * K, (i + 1) * K, (j + 1) * K, GOLD_L if i % 2 else GOLD)
    cv.rect(i * K, (j + 1) * K, (i + 1) * K, (j + 2) * K, EDGE)

# Kartenrahmen: dunkel – Gold – dunkel (je 1 Zelle), Ecken mit Funkelstern
cv.rect(0, 0, W, K, EDGE); cv.rect(0, H - K, W, H, EDGE)
cv.rect(0, 0, K, H, EDGE); cv.rect(W - K, 0, W, H, EDGE)
for (x0, y0, x1, y1) in [(K, K, W - K, 2 * K), (K, H - 2 * K, W - K, H - K), (K, K, 2 * K, H - K), (W - 2 * K, K, W - K, H - K)]:
    cv.rect(x0, y0, x1, y1, GOLD)
for (x0, y0, x1, y1) in [(2 * K, 2 * K, W - 2 * K, 3 * K), (2 * K, H - 3 * K, W - 2 * K, H - 2 * K),
                         (2 * K, 2 * K, 3 * K, H - 2 * K), (W - 3 * K, 2 * K, W - 2 * K, H - 2 * K)]:
    cv.rect(x0, y0, x1, y1, EDGE)

print(save(cv, '19_poison_card.png'))
