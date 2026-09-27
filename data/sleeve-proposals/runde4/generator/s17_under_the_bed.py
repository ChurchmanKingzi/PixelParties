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

Skalierung: EIN gemeinsames 4×-Raster (63×88 Zellen = Originalpixel des Zimmers) für Zimmer, Bett,
Prinzessin, Schattenwesen und Lichteffekte.
"""
import cv2
from dkit16_20 import *  # noqa

B = 'MotiveGrailWar'
K = 4
gw, gh = grid(K)                             # 63×88
X0, Y0 = 232, 150                            # Ausschnitt im xcf-Koordinatensystem

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
night = (f * 0.30 + L * np.array([0.10, 0.12, 0.30]))
lo.a[:] = night.clip(0, 255).astype(np.uint8)
orig = room[..., :3].astype(float)

# Kamin: Glut-Farbe erhalten, Umgebung warm beleuchtet (Viertelstufen, gedithert)
FX, FY = 265.5 - X0, 160 - Y0
for y in range(gh):
    for x in range(gw):
        d = math.hypot((x + .5 - FX) / 30, (y + .5 - FY) / 24)
        t = max(0, 1 - d) ** 1.3 * 0.9
        q = min(1, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
        if q > 0:
            warm = orig[y, x] * np.array([0.95, 0.72, 0.55])
            lo.a[y, x] = (lo.a[y, x] * (1 - q) + warm * q).astype(np.uint8)
fy0, fy1, fx0, fx1 = 150 - Y0, 168 - Y0, 255 - X0, 276 - X0      # Kaminöffnung
fire = np.zeros(orig.shape[:2], bool)
_o = orig[max(0, fy0):fy1, fx0:fx1]
fire[max(0, fy0):fy1, fx0:fx1] = ((_o[..., 0] > 170) & (_o[..., 1] > 90)) | (_o.mean(-1) > 150)
lo.a[fire] = orig[fire].astype(np.uint8)

# --- Bett + Prinzessin (Glut leicht von oben) -------------------------------------------------
bb = bbox(bed)
bed_n = bed.copy()
bf = bed_n[..., :3].astype(float)
Lb = bf.mean(-1, keepdims=True)
bed_n[..., :3] = (bf * 0.42 + Lb * np.array([0.08, 0.10, 0.26])).clip(0, 255).astype(np.uint8)
for y in range(bb[1], bb[3]):                 # obere Betthälfte (Kopfende, Gesicht) vom Feuer erhellt
    t = max(0, 1 - (y - bb[1]) / 26) * 0.75
    for x in range(bb[0], bb[2]):
        if bed[y, x, 3] == 0: continue
        q = min(1, math.floor(t * 4 + BAYER4[y % 4, x % 4]) / 4)
        if q > 0:
            bed_n[y, x, :3] = (bed_n[y, x, :3] * (1 - q) + bed[y, x, :3] * np.array([1.0, .86, .72]) * q).astype(np.uint8)

# Schatten unter dem Bett (vor dem Fußende, dunkle Zunge)
BY = bb[3]                                    # Unterkante Bett
cxb = (bb[0] + bb[2]) / 2
shade(lo, lambda x, y: (0.7 if (BY - 2 <= y < BY + 3 and abs(x + .5 - cxb) < 26 - (y - BY) * 1.5) else 0),
      col=(6, 4, 14))

# Schattenwesen: kriecht unter dem Fußende hervor (Ohren noch unter dem Bett)
mx, my = int(cxb - mon.shape[1] / 2), BY - 6
# rotes Glimmen der Augen auf dem Boden
glow(lo, cxb, my + 10, 15, (150, 40, 90), 0.55, ry=12)
lo.paste(mon, mx, my)
lo.paste(bed_n, 0, 0)

# kleiner Glanz der Augen (je ein hellerer Pixel)
eyes = np.where((mon[..., 0] > 180) & (mon[..., 1] < 60))
for yy, xx in zip(*eyes):
    if yy == eyes[0].min() and (xx == eyes[1].min() or xx == eyes[1].max()):
        lo.px(mx + xx, my + yy, (255, 120, 120))

vignette(lo, 0.55, 0.5)
cv = Canvas(W, H)
blit(cv, lo, K, ox=1, oy=1)
print(save(cv, '17_under_the_bed.png'))
