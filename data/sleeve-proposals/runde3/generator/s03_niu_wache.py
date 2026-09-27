# -*- coding: utf-8 -*-
"""Sleeve 03 – Niu hält Wache (Runde 3b überarbeitet: Porträt-Anschnitt statt schwebender Halbfigur).

Brustbild der Guardian Beast Niu mit ihren zwei Lichtklingen, unten vom Bildrand angeschnitten wie ein
Porträt (der Rumpf endet – wie auf der Karte – am Rand; diese Kante liegt jetzt auf dem Bildrand).
Hinter ihr die nächtliche Hofmauer mit dem vergitterten Tor (Karte „Guard Duty“); die Klingen werfen
kaltes Licht auf das Mauerwerk.

Skalierung: Niu 6× (Vordergrund, einziges Element in dieser Tiefe). Hintergrund einheitlich 3×
(Himmel, Sterne, Hofmauer, Tor, Hofboden, Lichtschein der Klingen – alles im 3×-Raster gebaut).
Die Bodenrisse der alten Fassung (3× neben 6×-Klingen) sind entfernt.

Quellen (MotiveGuardianBeasts.xcf): Niu #3 [80] (Niu mit Klingen, vollständig lt. Sichtbar #27 – dort
ebenfalls unten vom Kartenrand angeschnitten), Guard Duty #1 [54] (Hofmauer, Tor, Hofboden).
Himmel/Sterne/Lichtschein: selbst erstellt (Himmel der Vorlage ist weichgezeichnet → ersetzt).
"""
from a_util import *  # noqa

B = 'MotiveGuardianBeasts'
cv = Canvas(250, 350)
G = 3
lo = lowres(G)                                   # 84×117

court = compose(B, [54], crop=False)
niu = sprite('a03_niu', B, [80])                 # 26×45

# --- Himmel (3×-Raster) ------------------------------------------------------------------------------
vgrad(lo, 0, 36, [(4, 6, 24), (10, 16, 48), (22, 34, 82)])
rng = np.random.RandomState(11)
for _ in range(34):
    x, y = rng.randint(0, 84), rng.randint(0, 30)
    lo.px(x, y, (200, 210, 255) if rng.rand() < .3 else (110, 120, 180))

# --- Hofmauer, Tor, Boden (Originalpixel, 3×) ------------------------------------------------------------
WY = 32
band = court[98:144, 52:136].copy()               # 84×46 Mauerband mit Zinnenkante (ohne FPS-Anzeige)
lo.paste(np.dstack([band[..., :3], np.full(band.shape[:2], 255, np.uint8)]), 0, WY)
gate = court[110:144, 146:164].copy(); gate[..., 3] = 255
lo.paste(gate, 84 - 16, WY + 12)
floor = court[146:186, 118:202].copy(); floor[..., 3] = 255
lo.paste(floor, 0, WY + 46)

# Nacht: Mauer/Boden abdunkeln und bläulich tönen
reg = lo.a[WY:].astype(float)
reg = reg * 0.3 + np.array([14, 20, 60]) * 0.3
lo.a[WY:] = reg.clip(0, 255).astype(np.uint8)

# --- Lichtschein der Klingen (im 3×-Raster) --------------------------------------------------------------
K = 6
nx0 = 125 - niu.shape[1] * K // 2
ny0 = 350 - 42 * K                               # Rumpf endet in Zeile 41 → liegt auf dem Bildrand (Klingen laufen darüber hinaus)
white = (niu[..., :3].min(-1) > 170) & (niu[..., 3] > 0)
cols = np.where(white.sum(0) >= 10)[0]
for tc in (cols[cols < niu.shape[1] // 2], cols[cols >= niu.shape[1] // 2]):
    tx = (nx0 + (tc.min() + tc.max() + 1) / 2 * K) / G
    rows = np.where(white[:, tc].any(1))[0]
    t0, t1 = (ny0 + rows.min() * K) / G, (ny0 + (rows.max() + 1) * K) / G
    glow_seg(lo, tx, t0, tx, t1, 14, (200, 215, 255), 0.5)

blow(cv, lo, G)

# --- Niu (6×) ----------------------------------------------------------------------------------------------
put(cv, niu, nx0, ny0, K)

print(save(cv, '03_niu_wache.png'))
