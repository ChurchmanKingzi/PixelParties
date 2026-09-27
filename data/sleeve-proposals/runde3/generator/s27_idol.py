# -*- coding: utf-8 -*-
"""27 Idol Live – Blick aus dem dunklen Publikum auf die Sängerin im Scheinwerferlicht.

Quellen (MotiveMoe.xcf):
  - Ebene 479 „Singing #2“ + 480 „Singing #1“: Sängerin mit Heiligenschein + Schmetterlingsflügeln (Karte „Singing“)
  - Ebene 474 „Singing #3“: Fans von hinten mit Leuchtstäben (Karte „Singing“), als dunkle Silhouetten,
    Leuchtstäbe bleiben hell
  - Ebene 463 „Megu #3“: Superfan mit Bewegungsstrichen (Karte „Cute Starlet Megu“)
  - Ebene 263 „Ebene #82“: weiße Strahlenlinien (Lichtkranz hinter der Sängerin, rosa eingefärbt)
  - Ebene 129 „Ebene #174“ (Weihnachtsdorf): Holzdielen der Bühne (Karte „Harpyformer Choir“)
  - Ebene 126 „Ebene #178“: Musiknoten (Karte „Harpyformer Choir“)
  Scheinwerferkegel: gedithert aufgehellte Dreiecke (selbst erstellt).
"""
from common import *
import numpy as np

F = 'MotiveMoe'
W_, H_ = 250, 350


def cone(cv, apex, left, right, col, t, y1):
    """Lichtkegel von apex zu den Punkten left/right (auf Höhe y1), gedithert mit Stärke t."""
    ax, ay = apex
    Y, X = np.mgrid[0:H_, 0:W_]
    f = (Y - ay) / max(1, (y1 - ay))
    xl = ax + (left - ax) * f; xr = ax + (right - ax) * f
    inside = (Y >= ay) & (Y < y1) & (X >= np.minimum(xl, xr)) & (X <= np.maximum(xl, xr))
    tt = t * np.clip(1 - 0.5 * f, 0.3, 1)
    lit = inside & (tt > BAYER4[Y % 4, X % 4])
    a = cv.a.astype(float)
    a[lit] = a[lit] * 0.5 + np.array(col) * 0.5
    cv.a[:] = a.clip(0, 255).astype(np.uint8)


def glowfans(f, dark):
    """Fan von hinten abdunkeln, Leuchtstab (gesättigte Pixel oben links) hell lassen."""
    out = darken(f, dark)
    c = f[..., :3].astype(int)
    sat = c.max(-1) - c.min(-1)
    h, w = f.shape[:2]
    Y, X = np.mgrid[0:h, 0:w]
    stick = (X < 2) & (Y < 12) & ((sat > 60) | (c.min(-1) > 150)) & (f[..., 3] > 0)
    out[stick] = f[stick]
    return out


def glowfans_region(body):
    """wie glowfans, aber Leuchtstab relativ zur Figur (oberstes linkes Stück) suchen."""
    ys, xs = np.where(body[..., 3] > 0)
    y0, x0 = ys.min(), xs.min()
    out = darken(body, 0.14)
    c = body[..., :3].astype(int); sat = c.max(-1) - c.min(-1)
    h, w = body.shape[:2]; Y, X = np.mgrid[0:h, 0:w]
    stick = (X < x0 + 4) & (Y < y0 + 12) & ((sat > 60) | (c.min(-1) > 150)) & (body[..., 3] > 0)
    out[stick] = body[stick]
    return out


def build():
    cv = Canvas(W_, H_, (12, 6, 24))
    ordered(cv, 0, 0, W_, H_, (8, 4, 18), (40, 16, 58), lambda x, y: 1 - abs(y - 150) / 170)

    # Strahlenkranz hinter der Sängerin (Linien aus Ebene 263, rosa)
    rays = compose(F, [263])
    rays = silhouette(rays, (255, 120, 210))
    cv.paste(rays, 125 - rays.shape[1] // 2, 150 - rays.shape[0] // 2 - 20)
    rays2 = silhouette(compose(F, [264]), (120, 50, 150))
    cv.paste(flip(rays2), 125 - rays2.shape[1] // 2 - 1, 150 - rays2.shape[0] // 2 - 21)
    cv.paste(rays, 125 - rays.shape[1] // 2, 150 - rays.shape[0] // 2 - 20)

    # Bühnenboden: Holzdielen aus der Weihnachtsdorf-Bühne 3x, auf Breite gespiegelt
    vil = layer(F, 129); b = bbox(vil)
    wood = vil[b[1] + 78:b[1] + 95, b[0] + 83:b[0] + 148, :3]
    wood = widen(np.repeat(np.repeat(wood, 3, 0), 3, 1), W_)
    floor_y = 206
    cv.a[floor_y:floor_y + wood.shape[0]] = wood[:min(wood.shape[0], H_ - floor_y)]

    # Scheinwerfer von oben
    cone(cv, (-10, -10), 95, 170, (255, 150, 220), 0.6, 222)
    cone(cv, (260, -10), 80, 155, (150, 220, 255), 0.6, 222)

    # Musiknoten
    notes = parts(sprite('e27_notes', F, [126]), dil=0)
    for (n, x, y, kk) in [(0, 22, 44, 3), (3, 198, 28, 3), (1, 32, 128, 2), (5, 206, 120, 3), (4, 60, 12, 2)]:
        cv.paste(up(notes[n], kk), x, y)

    # Sängerin mit Flügeln 4x auf dem Podest
    idol = sprite('e27_idol', F, [479, 480])
    I = up(idol, 4)
    paste(cv, I, 125, floor_y + 18, anchor='b')

    # Publikum von hinten: hintere Reihe 3x, vordere Reihe 4x (dunkle Silhouetten, Leuchtstäbe hell)
    fans = parts(sprite('e27_fans', F, [474]), dil=0)[:6]
    for j in range(6):
        f = fans[(j * 5 + 1) % 6]
        s3 = up(glowfans(f, 0.25), 3)
        s3 = s3 if j % 2 == 0 else flip(s3)
        cv.paste(s3, -16 + j * 46, 240 + (j % 2) * 4)
    for j, (idx, x) in enumerate(((2, -20), (4, 58))):
        s4 = up(glowfans(fans[idx], 0.13), 4)
        cv.paste(s4 if j else flip(s4), x, 286 + j * 4)
    # Superfan rechts vorn, 5x, mit Bewegungsstrichen
    sup = sprite('e27_superfan', F, [463])
    # Fan-Teil (größte Komponente) abdunkeln, Bewegungsstriche bleiben
    import cv2
    m = (sup[..., 3] > 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    body = sup.copy(); body[lab != big] = 0
    d = glowfans_region(body)
    S5 = up(np.where((lab == big)[..., None], d, sup), 5)
    cv.paste(S5, W_ - S5.shape[1] + 12, H_ - S5.shape[0] + 26)
    vignette(cv, 0.3, 0.6)
    return cv


if __name__ == '__main__':
    print(save(build(), '27_idol_live.png'))
