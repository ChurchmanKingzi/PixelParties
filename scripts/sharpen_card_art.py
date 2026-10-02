#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Macht die verwaschenen Pixelart-Motive der Karten in ./cards wieder scharf.

MSE speichert Motive als JPEG und skaliert sie weich auf 610x400. Das
Pixelraster der Originale ist aber noch erkennbar: Das Skript sucht es pro
Karte (Spalten/Zeilen), nimmt je Rasterzelle die Mittelwertfarbe aus der
Zellmitte und zeichnet die Zellen als harte Blöcke neu. Nur der Motivbereich
(70,170 / 610x400, innerhalb der Maske) wird verändert.

Aufruf:
    python scripts/sharpen_card_art.py [--cards cards] [--out ORDNER]
                                       [--max-err 7] [--dry-run] [--report r.csv]

Ohne --out werden die Karten überschrieben (vorher Backup anlegen!).
Karten ohne klar erkennbares Raster oder mit hoher Abweichung (Fullart,
Foil-Overlays, uneinheitliches Raster) bleiben unverändert und stehen im Report.
"""
import argparse
import csv
import glob
import os
from multiprocessing import Pool

import numpy as np
from PIL import Image

X0, Y0, W, H = 70, 170, 610, 400
MIN_SCORE = 2.0
MASK_PATH = os.path.join(os.path.dirname(__file__), "mse-art-mask.png")


def _mask():
    return np.asarray(Image.open(MASK_PATH).convert("L").resize((W, H), Image.NEAREST)) > 127


def _edge_profile(art, axis):
    d = np.abs(np.diff(art, axis=axis)).sum(2)
    return d.sum(0) if axis == 1 else d.sum(1)


def _score(prof, length, n, phase):
    step = length / n
    b = np.round(phase + np.arange(1, n) * step).astype(int)
    m = np.round(phase + (np.arange(n) + 0.5) * step).astype(int)
    b, m = b[(b >= 0) & (b < len(prof))], m[(m >= 0) & (m < len(prof))]
    return (prof[b].mean() - prof[m].mean()) / (prof.mean() + 1e-9)


def detect(art, axis, length):
    prof = _edge_profile(art, axis)
    best = (-1.0, 0)
    for n in range(30, 321):
        s = max(_score(prof, length, n, ph) for ph in np.arange(-1.5, 1.6, 0.5))
        if s > best[0]:
            best = (s, n)
    return best[1], best[0]


def rebuild(art, mask, nx, ny):
    xe = np.round(np.arange(nx + 1) * W / nx).astype(int)
    ye = np.round(np.arange(ny + 1) * H / ny).astype(int)
    out = art.copy()
    for j in range(ny):
        for i in range(nx):
            y0, y1, x0, x1 = ye[j], ye[j + 1], xe[i], xe[i + 1]
            qy, qx = max((y1 - y0) // 4, 0), max((x1 - x0) // 4, 0)
            core = (slice(y0 + qy, y1 - qy), slice(x0 + qx, x1 - qx))
            if mask[core].mean() < 0.5:
                continue
            color = np.median(art[core].reshape(-1, 3), axis=0)
            blk = out[y0:y1, x0:x1]
            blk[mask[y0:y1, x0:x1]] = color
    return out


def process(args):
    path, out_dir, max_err, dry = args
    name = os.path.basename(path)
    img = Image.open(path).convert("RGB")
    if img.size != (750, 1050):
        return name, "übersprungen: Größe", 0, 0, 0
    full = np.asarray(img).copy()
    art = full[Y0:Y0 + H, X0:X0 + W].astype(np.float32)
    nx, sx = detect(art, 1, W)
    ny, sy = detect(art, 0, H)
    if min(sx, sy) < MIN_SCORE:
        return name, "übersprungen: kein klares Raster", nx, ny, 0
    mask = _mask()
    new = rebuild(art, mask, nx, ny)
    err = float(np.abs(new - art)[mask].mean())
    if err > max_err:
        return name, "übersprungen: hohe Abweichung", nx, ny, round(err, 2)
    if not dry:
        full[Y0:Y0 + H, X0:X0 + W] = np.where(mask[..., None], new, art).round().astype(np.uint8)
        Image.fromarray(full).save(os.path.join(out_dir, name))
    return name, "ok", nx, ny, round(err, 2)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cards", default="cards")
    ap.add_argument("--out")
    ap.add_argument("--max-err", type=float, default=7.0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", default="sharpen_report.csv")
    ap.add_argument("--only", nargs="*", help="nur diese Dateinamen")
    a = ap.parse_args()
    out_dir = a.out or a.cards
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(a.cards, "*.png")))
    if a.only:
        files = [f for f in files if os.path.basename(f) in a.only]
    with Pool() as pool:
        rows = pool.map(process, [(f, out_dir, a.max_err, a.dry_run) for f in files])
    with open(a.report, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["Datei", "Status", "Spalten", "Zeilen", "Abweichung"])
        w.writerows(rows)
    ok = sum(1 for r in rows if r[1] == "ok")
    print(f"{ok} von {len(rows)} Karten überarbeitet, Report: {a.report}")


if __name__ == "__main__":
    main()
