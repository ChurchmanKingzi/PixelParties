# -*- coding: utf-8 -*-
"""13 Deepsea Family Portrait – Gruppenbild der Deepsea-Untoten in drei Reihen (Tiefe durch Größe und Licht)
vor dem Blutmond unter dem Meer: hinten Succubus, Siphem und Reaper, in der Mitte Werwolf, Vampir Teppes und
Hexe, vorne Mumie, Zombie und Deepsea-Stein; Fledermäuse und Poltergeister schweben um den Mond.

Quellen (MotiveDeepsea.xcf, jeweils Karte „Deepsea …“):
  Ebene 294 „Succubus“, 301 „Siphem“, 298 „Reaper“ – 2×, abgedunkelt
  Ebene 329 „Werewolf“, 335 „TEPPES“ (Vampir-Teil), 309 „Witch #1“ – 3×
  Ebene 304 „Mummy“, 322 „Zombie“, 362 „Deepsea Stein“ – 4×
  Ebene 346 „Bats“ (2×), 331 „Poltergeister“ (2×), 381 „Ebene #160“ (Blutmond, 3×),
  Ebene 341 „Ebene #150“ (Blasen, Karte „Blood Moon under the Sea“)
  Farben: Deepsea-Meer (Ebene 391) und Blutmond-Rot.
"""
from common import *  # noqa
from bkit import *    # noqa

W, H = 250, 350
D = 'MotiveDeepsea'
cv = Canvas(W, H)

vgrad(cv, [(0, (10, 20, 52)), (0.45, (22, 46, 100)), (0.75, (40, 30, 80)), (1, (20, 12, 36))])
MX, MY = 125, 92
for y in range(H):
    for x in range(W):
        d = math.hypot(x + .5 - MX, y + .5 - MY)
        if d < 86:
            cv.a[y, x] = (96, 44, 74)
        elif d < 98 and 0.5 > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (96, 44, 74)
        elif d < 112 and 0.25 > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (62, 40, 90)
moon = up(compose(D, [381]), 3)
pc(cv, moon, MX, MY)
# Blasenkranz um den Mond
bub = [p for p in parts(compose(D, [341]), dil=0, minpx=1)]
for k in range(14):
    a = k * 2 * math.pi / 14 + 0.2
    r = 92 + (k % 3) * 6
    b = bub[k % len(bub)]
    pc(cv, up(b, 2), MX + int(math.cos(a) * r), MY + int(math.sin(a) * r * 0.95))

# Fledermäuse + Poltergeister
bats = [p for p in parts(compose(D, [346]), dil=0) if p.shape[0] > 6]
for (x, y), b in zip([(30, 30), (196, 22), (160, 8), (70, 12)], bats):
    cv.paste(up(b, 2), x, y)
gh = parts(compose(D, [331]), dil=1)
cv.paste(up(gh[0], 2), 2, 110)
cv.paste(up(flip(gh[1]), 2), 214, 104)


def row(items, k, bottom, xs, dim):
    for key, x, fl in zip(items, xs, [False] * len(items)):
        s = key
        S = up(s, k)
        if dim != 1.0:
            S = lum_tint(S, (6, 10, 30), tuple(int(c * dim) for c in (255, 255, 255))) if dim < 0.7 else darken(S, dim)
        pb(cv, S, x, bottom)


# hintere Reihe
succ = compose(D, [294]); siph = compose(D, [301]); reap = compose(D, [298])
row([succ, reap], 2, 196, [46, 204], 0.72)
row([siph], 2, 190, [125], 0.8)
# Boden/Lichtkante der Reihen: dunkler Schleier nach unten
for y in range(196, H):
    t = min(0.5, (y - 196) / 300)
    for x in range(W):
        if t > BAYER4[y % 4, x % 4]:
            cv.a[y, x] = (cv.a[y, x] * 0.7).astype(np.uint8)

# mittlere Reihe
wolf = compose(D, [329])
tep = [p for p in parts(compose(D, [335]), dil=1) if p.shape[:2] == (23, 24)][0]
witch = compose(D, [309])
row([wolf], 3, 268, [44], 0.9)
row([witch], 3, 266, [212], 0.9)
row([tep], 3, 262, [125], 0.92)

# vordere Reihe
mum = compose(D, [304]); zom = compose(D, [322]); stein = compose(D, [362])
row([mum, zom, flip(stein)], 4, 346, [42, 126, 208], 1.0)

vignette(cv, 0.5, 0.58)
print(save(cv, '13_deepsea_family.png'))
