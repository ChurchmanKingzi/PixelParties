# -*- coding: utf-8 -*-
"""34 Tormentor's Den – Gegner „Poison Torture“ (sample-Structure Deck Poison Torture), Held: Reiza, the Chief
Tormentor (Base).

Idee: Porträt in ihrem Verlies (Kerker-Karte ihrer Heldenkarte): Reiza schwebt mit weit ausgebreiteten Flügeln
frontal über dem Boden, ihr Schatten liegt unter ihr; hinter ihr die dunkle Kerkerwand mit der hellen Riss-/
Kantenlinie aus ihrer Szene, links und rechts steigen die violett-grünen Decay-Schwaden ihrer Karte auf (Decay Magic).
Auf dem Boden die Stachelfelder des Verlieses, vorn giftig rote Toxic-Trap-Pilze und eine Giftphiole (Poison Vial)
– sie betäubt und vergiftet jedes einzelne Ziel.

Quellen (Motive.xcf):
  Ebene 204 „Reiza #3“ – Base-Reiza mit Flügeln und Schwanz; entspricht Szene 201 „Sichtbar #241“ (Kartenszene;
             die Abweichungen dort stammen nur von der Abdunklungs-Ebene der Szene). Ebene 202 „Reiza #4“ – ihr
             Schwebeschatten. Ebene 203 „Reiza #2“ – die Decay-Schwaden (weiches Alpha je 2×-Pixel wie im Original).
             Nicht verwendet: 205 (dunkle Bodenflecken unter den Schwaden) und 206 (brennendes Bündel rechts oben
             im Kartenbild) – passten maßstäblich nicht neben die 4×-Reiza.
  Ebene 230 „Ebene #492“ – Kerker-Karte: Wandkante mit Rundsteinen und Risslinie, Fels-Textur, Bodenstacheln.
  Ebene 1237 „Toxic Trap“ – rote Giftpilze; Ebene 1064 „Poison Vial“ – violette Giftphiole.
Selbst gezeichnet: Abdunklung/Verlauf, violetter Schein, Bodenkante.

Skalierung (Tiefenebenen):
  Hintergrund: Kerkerwand, Risslinie, Boden, Decay-Schwaden   – 2× (125×175)
  Mittelgrund: Stachelfelder, Giftpilze, Giftphiole           – 3× (84×117)
  Vordergrund: Reiza + Schwebeschatten                        – 4× (63×88); Reiza 200×124 px
"""
import math
import numpy as np
from kit_f import *  # noqa

M = 'Motive'

reiza = sprite('o34_reiza', M, [204])                            # 50×31
rshadow = sprite('o34_reiza_shadow', M, [202])                   # 18×3
smoke = cached('o34_smoke', lambda: trim(layer(M, 203)))          # weiches Alpha, nicht hart geschnitten
dungeon = cached('o34_dungeon', lambda: layer(M, 230)[150:260, 40:230].copy())   # (x40,y150)-Ausschnitt


def _spikes():
    a = layer(M, 230)[193:208, 64:112].copy()
    lum = a[..., :3].astype(int).mean(-1)
    a[lum < 58] = 0
    return a


spikes = cached('o34_spikes', _spikes)                            # drei Stachelgruppen nebeneinander
mush = cached('o34_mush', lambda: parts(layer(M, 1237), dil=1)[0])


def _vial():
    a = layer(M, 1064)[199:217, 323:333].copy()
    return part_at(a, 5, 9, dil=0)


vial = cached('o34_vial', _vial)

# ---------------- Hintergrund 2× (125×175) -------------------------------------------------------------------
bw, bh = grid(2)
bg = rgba(bw, bh, (0, 0, 0))
rockT = cached('o34_rock', lambda: layer(M, 230)[215:245, 69:109].copy())[..., :3].astype(float) * 2.0   # Fels ohne Stacheln
RM = rockT.reshape(-1, 3).mean(0)
FL = 108                                                         # Wandfuß (2×) → y 216
for y in range(bh):
    for x in range(bw):
        c = rockT[y % 30, (x + 7 * (y // 30)) % 40]
        c = RM + (c - RM) * 0.8
        if y < FL:
            f = 0.42 + 0.28 * (y / FL)
            c = c * f * np.array([0.9, 0.95, 1.15])
        else:
            f = 1.0 + 0.45 * (y - FL) / (bh - FL)
            c = c * f * np.array([0.95, 1.0, 1.1])
        bg[y, x, :3] = c.clip(0, 255).astype(np.uint8)
# Wandkante mit Rundsteinen und Risslinie (Originalstreifen der Kerkerkarte), etwas oberhalb von Reizas Flügeln
strip = dungeon[6:44, 20:145].copy()                             # x60..185, y156..194 (38 Zeilen)
lum = strip[..., :3].astype(int).mean(-1)
strip[34:][lum[34:] > 58] = 0                                    # Stachelspitzen am unteren Rand entfernen
strip[34:, :, 3] = np.where(strip[34:, :, 3] > 0, strip[34:, :, 3], 0)
st_ = mul(strip, (0.95, 0.98, 1.12))
put(bg, st_[:34], 0, 26)
for x in range(bw):                                              # Bodenkante
    bg[FL, x, :3] = (bg[FL, x, :3] * 0.5).astype(np.uint8)
    bg[FL + 1, x, :3] = (bg[FL + 1, x, :3] * 0.75).astype(np.uint8)
glow(bg, 62.5, 72, 46, (120, 60, 150), 0.2, ry=46, power=2.0)    # violetter Decay-Schein hinter Reiza
glow(bg, 62.5, 128, 36, (80, 120, 70), 0.14, ry=12)
# Decay-Schwaden links/rechts (weiches Alpha je 2×-Pixel)
sm = smoke
half = sm.shape[1] // 2
cols = (sm[..., 3] > 0).sum(0)
cut = 30 + int(np.argmin(cols[30:sm.shape[1] - 30]))
L, R = sm[:, :cut], sm[:, cut:]


def blend(dst, s, x0, y0, amp=1.0):
    h, w = s.shape[:2]
    for y in range(h):
        for x in range(w):
            X, Y = x0 + x, y0 + y
            if 0 <= X < dst.shape[1] and 0 <= Y < dst.shape[0] and s[y, x, 3] > 0:
                a = min(1.0, s[y, x, 3] / 255 * amp)
                a = math.floor(a * 4 + BAYER[Y % 4, X % 4] * 0.999) / 4       # in Viertelstufen
                if a > 0:
                    dst[Y, X, :3] = (dst[Y, X, :3] * (1 - a) + s[y, x, :3] * a).astype(np.uint8)


blend(bg, L, 4, FL - L.shape[0] + 6, 1.3)
blend(bg, R, bw - 4 - R.shape[1], FL - R.shape[0] + 6, 1.3)

# ---------------- Mittelgrund 3× (84×117): Stacheln, Pilze, Phiole ------------------------------------------------
mw, mh = grid(3)
mg = rgba(mw, mh)
spk = mul(spikes, (0.9, 0.9, 1.0))
g1, g2, g3 = spk[:, 0:16], spk[:, 16:32], spk[:, 32:48]
for gx, gy, gg in [(2, 76, g1), (14, 79, g2), (mw - 18, 76, g3), (mw - 30, 79, g1),
                   (-2, 88, g2), (mw - 14, 88, g3)]:
    put(mg, trim(gg), gx, gy)
MF = 108                                                          # Fußlinie Pilze/Phiole → y 324
for mx, s in [(10, mush), (mw - 10 - mush.shape[1], flip(mush))]:
    put(mg, s, mx, MF - s.shape[0])
put(mg, vial, mw - 31, MF - vial.shape[0] + 1)

# ---------------- Vordergrund 4× (63×88): Reiza ------------------------------------------------------------------
fw, fh = grid(4)
fg = rgba(fw, fh)
RX = (fw - reiza.shape[1]) // 2                                   # 6 → x 24..224
RY = 25                                                           # y 100..224
sh = rshadow.copy(); sh[..., 3] = np.where(sh[..., 3] > 0, 150, 0)
fgs = rgba(fw, fh)
fgs[64:64 + sh.shape[0], RX + 16:RX + 16 + sh.shape[1]] = sh      # Schatten auf dem Boden, y 256
put(fg, reiza, RX, RY)

st = Stack()
st.add(bg, 2)
st.add(mg, 3)
st.add(fgs, 4, ox=1)
st.add(fg, 4, ox=1)
save(st.canvas(), '34_tormentors_den.png')
if __name__ == '__main__':
    print(preview('34_tormentors_den.png', 'bone', 'gothic', 'amethyst', 'lime'))
