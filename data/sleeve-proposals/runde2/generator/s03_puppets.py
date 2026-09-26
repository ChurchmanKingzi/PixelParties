# -*- coding: utf-8 -*-
"""Sleeve: Puppentheater – Tri Ad & Tri Fecta auf ihren Brücken, darunter die sechs Puppets
an Fäden, Laki unter ihrem Regenbogen. Vorhang, Bordüre, Bühne und Fäden stammen aus den Puppet-Karten."""
import numpy as np
from kit import *

NW, NH = 125, 175
cv = Canvas(NW, NH)

def ds(n):
    a = nat(n); return inpaint_h(a, string_mask(a))

pavi = ds('Loving Puppet Pavi')
pink = (pavi[..., 0].astype(int) > 200) & (pavi[..., 2].astype(int) > 150) & (pavi[..., 1] < 180)
pavi = inpaint_h(pavi, pink)
# --- Vorhang: Faltenband (Zeilen 26..37) senkrecht gespiegelt wiederholt, waagerecht gekachelt (Periode 70)
band = pavi[18:36, 48:68]
colb = np.concatenate([band, band[::-1]], 0)
for y in range(NH):
    for x in range(NW):
        cv.a[y, x] = colb[y % len(colb), x % 20]
# leichte Abdunklung nach oben (Tiefe)
for y in range(0, 60):
    f = 0.62 + 0.38 * y / 60
    for x in range(NW):
        if (y + x) % 2 == 0 or f < 0.8: cv.a[y, x] = (cv.a[y, x] * f).astype(np.uint8)
# --- Bordüre (Zeilen 0..7) und Bühne (Zeilen 38..50)
val = pavi[0:8, 0:70]
floor = nat('Loving Puppet Pavi')[37:50, 0:70]
for x in range(NW):
    cv.a[0:8, x] = val[:, x % 70]
    cv.a[NH - 13:NH, x] = floor[:, (x + 20) % 70]

# --- Regenbogen aus Lucky Puppet Laki
laki = nat('Lucky Puppet Laki').astype(int)
hsv = cv2.cvtColor(laki.astype(np.uint8).reshape(-1, 1, 3), cv2.COLOR_RGB2HSV_FULL).reshape(laki.shape)
rb = (hsv[..., 1] > 110) & (hsv[..., 2] > 150) & ~((hsv[..., 0] > 170) & (hsv[..., 0] < 215))
rb[37:, :] = False
pv = nat('Loving Puppet Pavi')[0:8].reshape(-1, 3).astype(int)
pv = pv[(pv.max(-1) - pv.min(-1)) > 60]
top = np.zeros_like(rb); top[:8] = True
d = np.sqrt(((laki[..., None, :] - pv[None, None]) ** 2).sum(-1)).min(-1)
rb &= ~(top & (d < 18))
rb = pp.keep_largest(rb, 1)
rain = np.zeros(laki.shape[:2] + (4,), np.uint8); rain[..., :3] = laki; rain[..., 3] = rb * 255
rain = trim(rain)
RX, RY = (NW - rain.shape[1]) // 2, NH - 11 - rain.shape[0]
cv.paste(rain, RX, RY)

STR = [(131, 124, 155), (106, 99, 129)]
def string(x, y0, y1):
    for y in range(y0, y1):
        cv.px(x, y, STR[y % 2])

# --- Puppets
def pup(n, box, clear=()):
    return cutf(n, box, tol=34, src=ds(n), largest=1, clear=clear)
P = {
    'saras': pup('Clever Puppet Saras', (22, 7, 56, 38)),
    'brammi': pup('Creative Puppet Brammi', (10, 7, 42, 38)),
    'shishi': pup('Destructive Puppet Shishi', (18, 7, 58, 38)),
    'laki': pup('Lucky Puppet Laki', (26, 8, 46, 38), clear=[(36, 8, 46, 17)]),
    'pavi': pup('Loving Puppet Pavi', (24, 7, 50, 38)),
    'vinny': pup('Preserving Puppet Vinny', (22, 7, 50, 38)),
}
ad = cutf('Tri Ad the Puppet Mistress', (10, 5, 66, 34), tol=34, src=ds('Tri Ad the Puppet Mistress'), largest=1)
fe = cutf('Tri Fecta the Puppet Master', (10, 5, 66, 34), tol=34, src=ds('Tri Fecta the Puppet Master'), largest=1)
BY = 8 + ad.shape[0] - 3   # Unterkante der Brücken
# Positionen (x, y) links oben
pos = {'saras': (4, 48), 'shishi': (44, 44), 'brammi': (90, 46),
       'pavi': (6, 92), 'laki': (52, 134), 'vinny': (94, 94)}
# Fäden zuerst (hinter den Figuren): je 3 Fäden vom Kopf/den Händen nach oben
for k, (x, y) in pos.items():
    s = P[k]; w = s.shape[1]
    for fx in (x + 2, x + w // 2, x + w - 3):
        # oberster deckender Pixel dieser Spalte
        col = s[:, fx - x, 3]
        top = int(np.argmax(col > 0)) if col.any() else 0
        string(fx, BY, y + top)
for k, (x, y) in pos.items():
    s = P[k]
    cv.paste(silhouette(s, (20, 10, 40)), x + 1, y + 2, alpha=0.45)
    cv.paste(s, x, y)
# Brücken mit Spielern
cv.paste(ad, 2, 8); cv.paste(fe, NW - fe.shape[1] - 2, 8)
# Bordüre wieder über alles
for x in range(NW):
    cv.a[0:8, x] = np.where((val[:, x % 70].max(-1) > 0)[:, None], val[:, x % 70], cv.a[0:8, x])

big = Canvas(W, H)
big.a[:] = up(np.dstack([cv.a, np.full(cv.a.shape[:2], 255, np.uint8)]), 2)[..., :3]
print(save(big, '03_puppet_theater.png'))
