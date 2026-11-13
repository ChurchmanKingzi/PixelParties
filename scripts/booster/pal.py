# -*- coding: utf-8 -*-
"""Spiel-Palette (data/palette.json): alles, was die Booster-Skripte ausgeben, rastet exakt auf diese 256 Farben ein."""
import json, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
HEX = [f['hex'] for f in json.load(open(os.path.join(ROOT, 'data', 'palette.json'), encoding='utf-8'))['farben']]
PAL = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in HEX], np.uint8)


def _lab(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


PAL_LAB = _lab(PAL)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def snap(arr):
    """(…,3) beliebige Zahlen -> (…,3) uint8, jede Farbe die nächste Palettenfarbe (Lab-Abstand)."""
    a = np.clip(np.rint(np.asarray(arr, float)), 0, 255).astype(np.int64)
    shp = a.shape[:-1]
    flat = a.reshape(-1, 3)
    key = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    uk, inv = np.unique(key, return_inverse=True)
    u = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], -1)
    lab = _lab(u)
    d = ((lab[:, None, :] - PAL_LAB[None, :, :]) ** 2).sum(-1)
    idx = d.argmin(1)
    return PAL[idx][inv].reshape(shp + (3,))


def snap1(h):
    """Hex-Farbe -> Palettenfarbe als float-Vektor."""
    return snap(hexrgb(h)[None, :])[0].astype(float)


def mix(a, b, t):
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


def lighten(c, t):
    return mix(c, (255, 255, 255), t)


def darken(c, t):
    return mix(c, (0, 0, 0), t)
