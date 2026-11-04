#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Macht die verwaschenen Vollauflösungs-Motive der Karten (kind "b") wieder scharf.

Karten, deren Kunst kein sauberes ganzzahliges Pixelraster hat, liegen als
public/cardgen/art/<id>.webp in 610x400 (siehe scripts/build-card-art.py). Kommt ein
solches Bild als JPEG oder weich skaliert an, tragen die Pixel Ränder und
Farbrauschen ("JPEG-Fragmente"). Das Pixelraster ist aber noch erkennbar:

  1. je Achse wird die Zellgröße STUFENLOS (nicht nur ganze Zellzahlen) samt Versatz
     gesucht (Kantenprofil, Kanten gegen Zellmitten) — das Raster darf gebrochene
     Schritte und einen Versatz vom Bildrand haben (z. B. 6,36 x 6,16 px je Zelle);
  2. jede Zelle bekommt den Median ihres Kerns (Zellrand ausgespart) und wird als
     harter Block gezeichnet;
  3. fast gleiche Farben (Lab-Abstand <= --farben, Standard 3) werden auf die
     häufigere Farbe gezogen: das nimmt das Rauschen in flachen Flächen, ohne
     sichtbar etwas zu verändern.

Aufruf:
    python scripts/sharpen_full_art.py [--dir public/cardgen/art] [--only Empty_Armor ...]
                                       [--farben 3] [--dry-run]

Ohne --dry-run werden die webp-Dateien überschrieben (verlustfrei). Läuft idempotent:
ein bereits gesäubertes Bild ändert sich nicht mehr. Kunst MIT sauberem ganzzahligem
Raster gehört stattdessen als natives PNG nach data/card-art/native (kind "a").
"""
import argparse
import glob
import os
from multiprocessing import Pool

import numpy as np
from PIL import Image

W, H = 610, 400
SCHRITT_MIN, SCHRITT_MAX = 5.9, 8.7        # Zellgröße in Bildpixeln (entspricht ~70..103 Zellen je Zeile)


def _profil(art, axis):
    d = np.abs(np.diff(art, axis=axis)).sum(2)
    p = d.sum(0) if axis == 1 else d.sum(1)           # p[i] = Sprung zwischen Pixel i und i+1
    return np.convolve(p, [0.25, 0.5, 0.25], mode="same")


def _passung(p, laenge, schritt, phase):
    k = np.arange(-1, int((laenge - phase) / schritt) + 2)
    kante = phase + k * schritt
    mitte = kante + schritt / 2
    bi = np.round(kante).astype(int) - 1
    mi = np.round(mitte).astype(int) - 1
    bi = bi[(bi >= 0) & (bi < len(p))]
    mi = mi[(mi >= 0) & (mi < len(p))]
    return (p[bi].mean() - p[mi].mean()) / (p.mean() + 1e-9)


def raster_suchen(art, axis, laenge):
    """Beste (Passung, Zellgröße, Versatz) für eine Achse."""
    p = _profil(art, axis)
    best = (-9.0, 0.0, 0.0)
    for schritt in np.arange(SCHRITT_MIN, SCHRITT_MAX, 0.01):
        for phase in np.arange(0, schritt, 0.25):
            s = _passung(p, laenge, schritt, phase)
            if s > best[0]:
                best = (s, float(schritt), float(phase))
    return best


def kanten(laenge, schritt, phase):
    e = {0, laenge}
    for k in range(0, int((laenge - phase) / schritt) + 2):
        e.add(min(max(int(round(phase + k * schritt)), 0), laenge))
    return sorted(e)


def zellen_neu_zeichnen(art, ex, ey):
    out = art.copy()
    for j in range(len(ey) - 1):
        for i in range(len(ex) - 1):
            y0, y1, x0, x1 = ey[j], ey[j + 1], ex[i], ex[i + 1]
            if y1 - y0 < 3 or x1 - x0 < 3:          # Randreste bleiben beim Nachbarn
                continue
            qy, qx = (y1 - y0) // 4, (x1 - x0) // 4
            kern = art[y0 + qy:y1 - qy, x0 + qx:x1 - qx].reshape(-1, 3)
            out[y0:y1, x0:x1] = np.median(kern, axis=0)
    return out


def _lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def farben_zusammenfassen(img, schwelle):
    """Fast gleiche Farben auf die häufigere Farbe ziehen (JPEG-Rauschen in flachen Flächen)."""
    if schwelle <= 0:
        return img
    cols, inv, cnt = np.unique(img.reshape(-1, 3), axis=0, return_inverse=True, return_counts=True)
    lab = _lab(cols)
    behalten, abb = [], np.zeros(len(cols), int)
    for i in np.argsort(-cnt, kind="stable"):
        if behalten:
            d = np.linalg.norm(lab[behalten] - lab[i], axis=1)
            j = int(np.argmin(d))
            if d[j] <= schwelle:
                abb[i] = behalten[j]
                continue
        behalten.append(i)
        abb[i] = i
    return cols[abb][inv.reshape(-1)].reshape(img.shape)


def bearbeiten(args):
    pfad, farben, trocken = args
    name = os.path.basename(pfad)
    img = Image.open(pfad).convert("RGB")
    if img.size != (W, H):
        return name, "übersprungen: Größe %dx%d" % img.size, 0, 0
    art = np.asarray(img).astype(np.float32)
    sx, stx, phx = raster_suchen(art, 1, W)
    sy, sty, phy = raster_suchen(art, 0, H)
    neu = zellen_neu_zeichnen(art, kanten(W, stx, phx), kanten(H, sty, phy))
    neu = farben_zusammenfassen(neu.round().astype(np.uint8), farben)
    if not trocken:
        Image.fromarray(neu).save(pfad, "WEBP", lossless=True, quality=100, method=6)
    return name, "ok", round(W / stx, 1), round(H / sty, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "cardgen", "art"))
    ap.add_argument("--only", nargs="*", help="nur diese Dateien (mit oder ohne .webp)")
    ap.add_argument("--farben", type=float, default=3.0, help="Lab-Abstand für das Zusammenfassen ähnlicher Farben (0 = aus)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    dateien = sorted(glob.glob(os.path.join(a.dir, "*.webp")))
    if a.only:
        wanted = {o if o.endswith(".webp") else o + ".webp" for o in a.only}
        dateien = [f for f in dateien if os.path.basename(f) in wanted]
    with Pool() as pool:
        zeilen = pool.map(bearbeiten, [(f, a.farben, a.dry_run) for f in dateien])
    for n, status, zx, zy in zeilen:
        print("%-45s %s%s" % (n, status, "  Raster %.1f x %.1f Zellen" % (zx, zy) if status == "ok" else ""))
    print("%d von %d Bildern %s" % (sum(1 for z in zeilen if z[1] == "ok"), len(zeilen), "geprüft (dry-run)" if a.dry_run else "gesäubert"))


if __name__ == "__main__":
    main()
