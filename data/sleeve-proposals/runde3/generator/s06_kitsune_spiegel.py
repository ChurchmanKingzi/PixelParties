# -*- coding: utf-8 -*-
"""Sleeve 06 – Der Spiegel der Kitsune (Runde 3b überarbeitet: Spiegelteich statt Handspiegel).

Nachts steht die Kitsune mit ihren Fuchsfeuer-Schwänzen am Ufer eines stillen Teichs zwischen zwei
Kirschbäumen. Das Wasser spiegelt Bäume und Himmel – doch an ihrer Stelle zeigt die Spiegelung ihre
wahre, verwandelte Gestalt: den Kirin (vgl. Karte „Kitsune Transformation“). Die Spiegelung ist
halbtransparent (ganze Rasterzellen gemischt) und von Wellenlinien zerteilt.
Kitsune und Kirin erscheinen im Block A nur noch hier (Doppelung mit 04 aufgelöst).

Skalierung: ALLES einheitlich 5× (Szene im 5×-Raster = 50×70 Zellen): Himmel, Sterne, Kirschbäume,
Ufer, Kitsune, Teich, Spiegelung (Kirin, Bäume), Lichtschein. Verläufe ohne Dithering.

Quellen (MotiveJapan.xcf): Kitsune [223] + Ebene #129 [222] (Fuchsfeuer; vollständig lt. Sichtbar #25),
Kirin [166] (vollständig lt. Sichtbar #20, dort nur von Blütenblättern überlagert), Ebene #17 [183]
(Kirschbaum = unterster Baum einer Baumreihe). Himmel, Ufer, Wasser, Wellen, Lichtschein: selbst
erstellt im 5×-Raster.
"""
from a_util import *  # noqa

B = 'MotiveJapan'
cv = Canvas(250, 350)
G = 5
lo = lowres(G)                                        # 50×70
W_, H_ = lo.w, lo.h

kitsune = sprite('a06_kitsune', B, [223, 222])        # 29×37 inkl. Fuchsfeuer
kirin = sprite('a06_kirin', B, [166])                 # 31×26
col = parts(sprite('a06_cherry_rows', B, [183]), dil=0)[0]
tree = col[104:]
tb = bbox(tree); tree = tree[tb[1]:tb[3], tb[0]:tb[2]]
print(kitsune.shape, kirin.shape, tree.shape)

WL = 38                                               # Uferlinie / Spiegelachse

# --- Himmel ----------------------------------------------------------------------------------------------
sgrad(lo, 0, WL, [(8, 4, 22), (24, 10, 46), (54, 22, 70)])
rng = np.random.RandomState(8)
for _ in range(16):
    lo.px(rng.randint(0, W_), rng.randint(0, 24), (200, 180, 240) if rng.rand() < .4 else (110, 90, 150))

# --- Kirschbäume am Ufer (nachtdunkel) ----------------------------------------------------------------------
nt = lambda s, f: tint(darken(s, f), (50, 10, 70), 0.3)
lo.paste(nt(tree, 0.55), -12, WL - tree.shape[0] + 1)
lo.paste(nt(flip(tree), 0.55), W_ - tree.shape[1] + 12, WL - tree.shape[0] + 1)

# --- Ufer: dunkles Gras mit Blütenblättern (2 Zellen hoch) --------------------------------------------------
for x in range(W_):
    lo.px(x, WL - 1, (40, 18, 46))
    lo.px(x, WL, (28, 12, 34))
    if (x * 5) % 7 == 0: lo.px(x, WL - 1, (200, 110, 170))

# --- Kitsune (Fuß auf der Uferlinie) + warmer Schein --------------------------------------------------------
KX = 25
sglow(lo, KX, WL - 14, 16, (255, 140, 70), 0.3)
lo.paste(kitsune, KX - kitsune.shape[1] // 2, WL - kitsune.shape[0])

# --- Teich: Spiegelung der Szene, aber mit dem Kirin statt der Kitsune ------------------------------------------
above = lo.a[:WL].copy()
# Kitsune aus der Spiegelvorlage entfernen: Bereich mit Himmel/Bäumen ohne Figur neu aufbauen
clean = Canvas(W_, WL)
sgrad(clean, 0, WL, [(8, 4, 22), (24, 10, 46), (54, 22, 70)])
clean.paste(nt(tree, 0.55), -12, WL - tree.shape[0] + 1)
clean.paste(nt(flip(tree), 0.55), W_ - tree.shape[1] + 12, WL - tree.shape[0] + 1)
sglow(clean, KX, WL - 14, 16, (80, 200, 230), 0.3)                          # kühles Licht statt Feuer
refl = clean.a[::-1].astype(float)
water = (refl * 0.45 + np.array([10, 14, 50]) * 0.55).astype(np.uint8)
n = min(H_ - WL - 1, water.shape[0])
lo.a[WL + 1:WL + 1 + n] = water[:n]

# Kirin gespiegelt (auf dem Kopf), Füße an der Uferlinie, halbtransparent, bläulich
kr = tint(kirin[::-1].copy(), (90, 200, 255), 0.25)
kx, ky = KX - kr.shape[1] // 2, WL + 1
wave = Canvas(W_, H_ - WL - 1)
wave.a[:] = lo.a[WL + 1:]
# zeilenweise versetzt einsetzen (Wellen): jede 4. Zeile um eine Zelle verschoben
for r in range(kr.shape[0]):
    dx = 1 if (r // 3) % 2 else 0
    row = kr[r:r + 1]
    lo.paste(row, kx + dx, ky + r, alpha=0.7)

# Wellenlinien quer über den Teich (hell, unterbrochen)
for y in range(WL + 3, H_, 4):
    for x in range(W_):
        if (x + y * 3) % 11 < 4:
            lo.a[y, x] = (lo.a[y, x] * 0.5 + np.array([150, 170, 230]) * 0.5).astype(np.uint8)

blow(cv, lo, G)
print(save(cv, '06_kitsune_spiegel.png'))
