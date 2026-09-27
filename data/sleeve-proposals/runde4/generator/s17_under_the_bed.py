# -*- coding: utf-8 -*-
"""17 Under the Bed – Nachts im Schlafgemach: die Prinzessin schläft friedlich im großen Bett vor dem
Kamin, dessen Glut nur noch schwach glimmt – doch unter dem Fußende kriecht ein Schattenwesen mit
roten Augen hervor.

Quellen (MotiveGrailWar.xcf), alle im gemeinsamen Koordinatensystem, Lage wie auf der Karte
„Sleeping Beauty“ (Sichtbar #159):
  Ebene 716 „Fionas Zimmer-Kopie“ – Schlafgemach mit Kamin (Hintergrund)
  Ebene 710 „Ebene #33“ – Himmelbett;  Ebene 709 „Sleeping Beauty“ – schlafende Prinzessin im Bett
  Ebene 718 „Gaestezimmer #5“ – Schattenwesen; der weiße Riss-Rahmen um die Figur wurde entfernt
          (nur der schwarze Körper mit Augen, Zähnen, Ohren und Beinen bleibt).
Selbst gezeichnet: Nachtfärbung, Glutschein, Schatten unter dem Bett, rotes Augenglimmen.

Skalierung: EIN gemeinsames 3×-Raster (84×117 Zellen = Originalpixel des Zimmers) für Zimmer, Bett,
Prinzessin, Schattenwesen und Lichteffekte.
"""
import cv2
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
K = 3
gw, gh = grid(K)                             # 84×117
X0, Y0 = 223, 129                            # Ausschnitt im xcf-Koordinatensystem

room = compose(B, [716], crop=False)[Y0:Y0 + gh, X0:X0 + gw]
bed = compose(B, [709, 710], crop=False)[Y0:Y0 + gh, X0:X0 + gw]

lo = Canvas(gw, gh)
lo.a[:] = room[..., :3]

# --- Schattenwesen: schwarzen Körper aus dem Riss-Rahmen lösen ------------------------------
mon_full = sprite('d17_monster_raw', B, [718])
v = mon_full[..., :3].max(-1).astype(int); sat = v - mon_full[..., :3].min(-1)
op = mon_full[..., 3] > 0
bright = op & (v >= 70) & (sat < 40)
n, lab = cv2.connectedComponents((op & ~bright).astype(np.uint8), connectivity=4)
ys, xs = np.where((mon_full[..., 0] > 180) & (mon_full[..., 1] < 60))
body = lab == lab[ys[0], xs[0]]
h, w = body.shape
pad = np.zeros((h + 2, w + 2), np.uint8); pad[1:-1, 1:-1] = body
ff = pad.copy(); cv2.floodFill(ff, np.zeros((h + 4, w + 4), np.uint8), (0, 0), 2)
keep = body | (ff[1:-1, 1:-1] == 0)          # eingeschlossene Zähne bleiben
mon = mon_full.copy(); mon[~keep] = 0
b = bbox(mon); mon = mon[b[1]:b[3], b[0]:b[2]]

# --- Nachtfärbung + Glut ---------------------------------------------------------------------
f = lo.a.astype(float)
L = f.mean(-1, keepdims=True)
night = (f * 0.22 + L * np.array([0.07, 0.08, 0.24]))
lo.a[:] = night.clip(0, 255).astype(np.uint8)
orig = room[..., :3].astype(float)

# Kamin: Glut-Farbe erhalten, Umgebung warm beleuchtet (Viertelstufen, gedithert)
FX, FY = 265.5 - X0, 160 - Y0


def warm_light(x, y):
    d = math.hypot((x + .5 - FX) / 58, (y + .5 - FY) / 62)
    return min(1, max(0, 1 - d) ** 0.9 * 1.25)


fy0, fy1, fx0, fx1 = 150 - Y0, 168 - Y0, 255 - X0, 276 - X0      # Kaminöffnung
fire = np.zeros(orig.shape[:2], bool)
_o = orig[fy0:fy1, fx0:fx1]
fire[fy0:fy1, fx0:fx1] = ((_o[..., 0] > 170) & (_o[..., 1] > 90)) | (_o.mean(-1) > 150)

bb = bbox(bed)
BY = bb[3]                                    # erste Zeile unter dem Fußende
cxb = (bb[0] + bb[2]) / 2


def in_bed_shadow(x, y):
    """Schlagschatten des Betts: vom Feuer (hinter dem Kopfende) nach vorne geworfen, wird breiter."""
    if y < bb[1] + 4: return 0
    half = (bb[2] - bb[0]) / 2 - 1 + max(0, y - BY) * 0.35
    dx = abs(x + .5 - cxb) - half
    if dx > 1.5: return 0
    edge = 1 if dx < -1.5 else 0.5                        # weicher Rand (Halbschatten)
    return edge * (1 if y < BY + 8 else max(0.45, 1 - (y - BY - 8) / 40))


for y in range(gh):
    for x in range(gw):
        t = warm_light(x, y) * (1 - 0.85 * in_bed_shadow(x, y))
        q = min(1, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
        if q > 0:
            warm = orig[y, x] * np.array([1.0, 0.78, 0.58])
            lo.a[y, x] = (lo.a[y, x] * (1 - q) + warm * q).astype(np.uint8)
# Schlagschatten: Boden unter/vor dem Bett zusätzlich abdunkeln, am dunkelsten an der Bettkante
shade(lo, lambda x, y: (in_bed_shadow(x, y) * (0.65 - 0.3 * min(1, max(0, y - BY) / 16)) if y >= BY - 1 else 0),
      col=(8, 3, 16))
lo.a[fire] = orig[fire].astype(np.uint8)

# --- Bett + Prinzessin: Kopfende vom Feuer erhellt, Fußende im Nachtblau -----------------------
bed_n = bed.copy()
bf = bed_n[..., :3].astype(float)
Lb = bf.mean(-1, keepdims=True)
bed_n[..., :3] = (bf * 0.34 + Lb * np.array([0.06, 0.08, 0.22])).clip(0, 255).astype(np.uint8)
for y in range(bb[1], bb[3]):
    t = max(0, 1 - (y - bb[1]) / 30) ** 1.2 * 0.9
    for x in range(bb[0], bb[2]):
        if bed[y, x, 3] == 0: continue
        q = min(1, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
        if q > 0:
            bed_n[y, x, :3] = (bed_n[y, x, :3] * (1 - q) + bed[y, x, :3] * np.array([1.0, .84, .68]) * q).astype(np.uint8)

# --- Schattenwesen: lugt unter der Bettkante hervor (Ohren und Stirn noch unter dem Bett) -------
eyes = np.where((mon[..., 0] > 180) & (mon[..., 1] < 60))
eye_row = eyes[0].min()
mx, my = int(round(cxb - mon.shape[1] / 2)), BY + 1 - eye_row
mon_n = mon.copy()                            # Körper leicht violett aufgehellt, damit er sich vom Schatten löst
body_px = (mon[..., 3] > 0) & (mon[..., :3].max(-1) < 60)
mon_n[body_px, :3] = np.clip(mon[body_px, :3].astype(int) + np.array([40, 18, 58]), 0, 255)
glow(lo, cxb, BY + 2, 12, (190, 30, 60), 0.5, ry=5)       # rotes Glimmen der Augen auf dem Boden
lo.paste(mon_n, mx, my)
lo.paste(bed_n, 0, 0)
for yy, xx in zip(*eyes):                      # Augenglanz
    if yy == eye_row and (xx == eyes[1].min() or xx == eyes[1].max()):
        lo.px(mx + xx, my + yy, (255, 130, 130))

vignette(lo, 0.5, 0.55)
cv = Canvas(W, H)
blit(cv, lo, K, ox=1, oy=0)
print(save(cv, '17_under_the_bed.png'))
