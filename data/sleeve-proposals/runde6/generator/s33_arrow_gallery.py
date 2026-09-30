# -*- coding: utf-8 -*-
"""33 Arrow Gallery – Gegner „Pew-Pew!“ (sample-Structure Deck Pew-Pew), Held: Bow Sniper Darge (Base).

Idee (Schaukasten, keine fliegenden Pfeile): Abends in seiner Turmkammer in Deri steht Darge frontal mit seinem
Bogen, wie auf der Heldenkarte bereit zum Schuss nach vorn. Hinter ihm hängt an der Ziegelwand seine Trophäe: ein
Brett aus Torbohlen, auf dem seine Spezialpfeile auf Holzstiften liegen – oben der weiße Angelfeather Arrow
(Cover-Karte), darunter Poisoned Arrow und der (nicht entzündete) Bomb Arrow; jedes „Arrow“-Artefakt macht seinen
Schuss stärker. Warmes Abendlicht fällt auf Brett und Wand.

Quellen:
  MotiveDeri.xcf Ebene 248 „Darge“ + mittlerer Bogen aus Ebene 244 „Darge #1“ (x 244–248) – Base-Darge, geprüft
                 gegen Szene 53 (Kartenbild „Bow Sniper Darge“, Lage 203,273; dort bis zu den Knien hinter Zinnen,
                 das Sprite ist vollständig).
                 Ebene 253 „Hintergrund“ – Ziegelwand (Kachel 32×16), Pflaster (16×16), Torbohlen.
  Motive.xcf     Ebene 1107 linker Teil (Angelfeather Arrow), 1102 (Poisoned Arrow), 1111 (Bomb Arrow; gelbe
                 Zündfunken entfernt – ausgestellt, nicht abgeschossen).
Selbst gezeichnet: Lichtschein, Holzstifte, Brett- und Pfeilschatten, Bodenschatten.

Skalierung (Tiefenebenen):
  Hintergrund: Ziegelwand, Lichtschein, Pflasterboden                  – 2× (125×175)
  Mittelgrund: Pfeilbrett mit Stiften und drei Pfeilen                – 3× (84×117); Brett 150×108 px
  Vordergrund: Darge + Bodenschatten                                   – 6× (42×59); Darge 138×162 px
"""
import math
import numpy as np
from kit_f import *  # noqa

D = 'MotiveDeri'


def _darge():
    a = compose(D, [248], crop=False)
    bow = layer(D, 244).copy(); bow[:, :244] = 0; bow[:, 249:] = 0
    a = xcfkit.over(bow, a)                       # Darge liegt über dem Bogen (Stapel: 244 unter 248)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return trim(a[272:330, 219:276].copy())


darge = cached('o33_darge', _darge)
wall = cached('o33_wall', lambda: layer(D, 253)[262:278, 70:102].copy())
cobble = cached('o33_cobble', lambda: layer(D, 253)[210:226, 190:206].copy())
planks = cached('o33_planks', lambda: layer(D, 253)[252:288, 440:490].copy())  # 50×36 Torbohlen
angel = cached('o33_angel', lambda: parts(layer('Motive', 1107), dil=1)[0])


def _bomb():
    a = parts(layer('Motive', 1111), dil=1)[0].copy()
    c = a[..., :3].astype(int)
    spark = ((c[..., 0] > 190) & (c[..., 1] > 170) & (c[..., 2] < 140)) | (c.min(-1) > 170)
    a[spark] = 0
    a = part_at(a, a.shape[1] // 2, a.shape[0] // 2 + 2, dil=0) if a[a.shape[0] // 2 + 2, a.shape[1] // 2, 3] else a
    return trim(a)


bomb = cached('o33_bomb', _bomb)
poison = cached('o33_poison', lambda: parts(layer('Motive', 1102), dil=1)[0])

# ---------------- Hintergrund 2× (125×175) -------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
FL = 132                                                         # Wandfuß (2×) → y 264
for y in range(bh):
    for x in range(bw):
        if y < FL:
            c = wall[y % 16, x % 32, :3].astype(float) * (0.36 + 0.3 * (y / FL))
            c = c * np.array([1.0, 0.94, 0.95])
        else:
            c = cobble[y % 16, x % 16, :3].astype(float) * (0.5 + 0.35 * (y - FL) / (bh - FL))
        bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
for x in range(bw):
    bg[FL, x, :3] = (bg[FL, x, :3] * 0.5).astype(np.uint8)
glow(bg, 62.5, 50, 56, (150, 110, 80), 0.22, ry=46)             # warmes Abendlicht auf Brett und Wand

# ---------------- Mittelgrund 3× (84×117): Pfeilbrett -------------------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
BX, BY = (mw - planks.shape[1]) // 2, 12                        # Brett x 51..201, y 36..144
for y in range(BY + 1, BY + planks.shape[0] + 2):                # Schlagschatten des Bretts auf der Wand
    for x in range(BX + 2, BX + planks.shape[1] + 2):
        mg[y, x] = (0, 0, 0, 120)
board = mul(planks, (0.82, 0.74, 0.68))
for x in range(board.shape[1]):                                  # Rahmenleisten oben/unten dunkler
    board[0, x, :3] = (board[0, x, :3] * 0.6).astype(np.uint8)
    board[-1, x, :3] = (board[-1, x, :3] * 0.55).astype(np.uint8)
put(mg, board, BX, BY)
PEG, PEGH = (78, 52, 34), (120, 84, 56)


def mount(s, cy):
    """Pfeil waagrecht mittig aufs Brett, auf zwei Holzstiften."""
    x0 = BX + (planks.shape[1] - s.shape[1]) // 2
    y0 = BY + cy - s.shape[0] // 2
    rows = np.where(s[..., 3].any(1))[0]
    shaft_y = y0 + int(np.median(np.where(s[:, s.shape[1] // 2, 3] > 0)[0])) + 1
    for px in (x0 + s.shape[1] // 4, x0 + 3 * s.shape[1] // 4):
        mg[shaft_y, px] = PEG + (255,); mg[shaft_y, px + 1] = PEG + (255,)
        mg[shaft_y + 1, px] = (0, 0, 0, 110); mg[shaft_y + 1, px + 1] = (0, 0, 0, 110)
        mg[shaft_y - 1, px] = PEGH + (255,)
    sh = s.copy(); sh[..., :3] = 0                               # kleiner Schatten des Pfeils
    for y in range(s.shape[0]):
        for x in range(s.shape[1]):
            if s[y, x, 3] and 0 <= y0 + y + 1 < mh and mg[y0 + y + 1, x0 + x + 1, 3]:
                mg[y0 + y + 1, x0 + x + 1, :3] = (mg[y0 + y + 1, x0 + x + 1, :3] * 0.6).astype(np.uint8)
    put(mg, s, x0, y0)


mount(angel, 7)
mount(poison, 18)
mount(bomb, 28)

# ---------------- Vordergrund 5× (50×70): Darge -------------------------------------------------------------------
fw, fh = grid(6)
fg = rgba(fw, fh)
DF = 55                                                          # Füße → y 330
DX = (fw - darge.shape[1]) // 2
for y in range(DF - 1, DF + 1):
    for x in range(DX - 1, DX + darge.shape[1] + 1):
        d = ((x + .5 - DX - darge.shape[1] / 2 - 1) / (darge.shape[1] / 2 - 2)) ** 2 + ((y + .5 - DF + 0.3) / 1.1) ** 2
        if d < 1: fg[y, x] = (0, 0, 0, 120)
put(fg, darge, DX, DF - darge.shape[0])

st = Stack()
st.add(bg, 2)
st.add(mg, 3, ox=1)
st.add(fg, 6, ox=-23)
save(st.canvas(), '33_arrow_gallery.png')
if __name__ == '__main__':
    print(preview('33_arrow_gallery.png', 'twist', 'bronze', 'emerald', 'amber'))
