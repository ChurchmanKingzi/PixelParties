# -*- coding: utf-8 -*-
"""Spezial-Packs des Glücksrads: zu jedem der 9 Packs eine goldene und eine Umbra-Fassung (Pixelart, Palette).

Aufruf:  python3 scripts/booster/build_special_packs.py
Eingabe: je Pack die erste normale Variante (<pack>/<pack>-1.png + .shimmer.png, 192x320 bzw. 16 Bilder à 192 nebeneinander).
Ausgabe: <pack>/<pack>-gold.png / -gold.shimmer.png und <pack>/<pack>-umbra.png / -umbra.shimmer.png, dazu Einträge in boosters.json
         (Variante mit `special: "golden" | "umbra"`; der Shop zeigt und verkauft sie nie, nur das Glücksrad vergibt sie).

Umfärbung: Helligkeit -> Farbrampe (Bayer-Dithering zwischen den Stufen), harte Alpha bleibt unverändert, danach Einrasten auf data/palette.json.
Dazu Glitzer-Kreuze (Gold) bzw. Sterne und ein heller Rand (Umbra). Keine Weichzeichnung, keine Drehung.
"""
import json, os, sys
import numpy as np
from PIL import Image
import pal

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DIR = os.path.join(ROOT, 'data', 'shop', 'Boosterpacks')
W, H = 192, 320
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

RAMPS = {
    'golden': ['#1c0f04', '#4a2a08', '#8a5a10', '#c8921c', '#f2c63a', '#fff0a0', '#ffffff'],
    'umbra':  ['#04020a', '#120a26', '#2a1650', '#4f2d94', '#8a5fd0', '#cdb0ff', '#ffffff'],
}


def ramp_apply(lum, ramp, gamma, bay):
    """lum 0..1 (H,W) -> RGB float (H,W,3): Position auf der Rampe + Bayer-Dithering zwischen zwei Stufen."""
    cols = np.array([pal.hexrgb(h) for h in ramp])
    n = len(cols) - 1
    pos = np.clip(lum, 0, 1) ** gamma * n
    lo = np.floor(pos).astype(int)
    frac = pos - lo
    hi = np.minimum(lo + 1, n)
    pick_hi = frac > bay                    # Dithering statt Überblendung
    idx = np.where(pick_hi, hi, lo)
    return cols[idx]


def sparkle(rgb, alpha, cx, cy, r, col):
    for d in range(-r, r + 1):
        for (x, y) in ((cx + d, cy), (cx, cy + d)):
            if 0 <= x < rgb.shape[1] and 0 <= y < rgb.shape[0] and alpha[y, x] > 0:
                rgb[y, x] = col
    if 0 <= cx < rgb.shape[1] and 0 <= cy < rgb.shape[0] and alpha[cy, cx] > 0:
        rgb[cy, cx] = (255, 255, 255)


def recolor(im, kind, strip=False):
    a = np.asarray(im.convert('RGBA')).copy()
    rgb = a[..., :3].astype(float)
    alpha = a[..., 3]
    h, w = alpha.shape
    bay = np.tile(_B4, (h // 4 + 1, w // 4 + 1))[:h, :w]
    lum = (rgb @ np.array([0.299, 0.587, 0.114])) / 255.0
    # Kontrast anheben, damit die Rampe ausgenutzt wird (Schimmer-Streifen sind hell: schwächer anheben)
    lo, hi = (0.0, 1.0) if strip else (np.percentile(lum[alpha > 0], 4), np.percentile(lum[alpha > 0], 98))
    lum = np.clip((lum - lo) / max(1e-6, hi - lo), 0, 1)
    out = ramp_apply(lum, RAMPS[kind], 0.85 if kind == 'golden' else 1.15, bay)
    if kind == 'umbra' and not strip:
        # Rand des Packs hell nachzeichnen (1 Pixel), damit das dunkle Pack auf dunklem Grund steht
        body = alpha > 0
        edge = body & ~(np.roll(body, 1, 0) & np.roll(body, -1, 0) & np.roll(body, 1, 1) & np.roll(body, -1, 1))
        out[edge] = pal.hexrgb('#8a5fd0')
    out = pal.snap(out).astype(np.uint8)
    out_a = np.dstack([out, alpha])
    return out_a


def decorate(arr, kind, seed):
    """Glitzer (Gold) bzw. Sterne (Umbra) auf das Pack zeichnen – nur auf deckenden Pixeln."""
    rng = np.random.RandomState(seed)
    alpha = arr[..., 3]
    rgb = arr[..., :3].copy()
    if kind == 'golden':
        pts = [(22, 40), (168, 56), (30, 150), (160, 172), (46, 236), (150, 232), (96, 100)]
        for (x, y) in pts:
            sparkle(rgb, alpha, x, y, 4, np.array([255, 240, 160]))
            sparkle(rgb, alpha, x, y, 2, np.array([255, 255, 255]))
    else:
        for _ in range(90):
            x, y = rng.randint(6, W - 6), rng.randint(24, H - 30)
            if alpha[y, x] > 0:
                rgb[y, x] = (205, 176, 255) if rng.rand() < 0.7 else (255, 255, 255)
        for (x, y) in [(30, 60), (162, 120), (40, 200), (150, 250)]:
            sparkle(rgb, alpha, x, y, 3, np.array([205, 176, 255]))
    rgb = pal.snap(rgb).astype(np.uint8)
    return np.dstack([rgb, alpha])


def main():
    man_path = os.path.join(DIR, 'boosters.json')
    man = json.load(open(man_path, encoding='utf-8'))
    n = 0
    for pack in man['packs']:
        regular = [v for v in pack['variants'] if not v.get('special')]
        pack['variants'] = regular                         # idempotent: alte Spezialvarianten ersetzen
        src = regular[0]
        base = Image.open(os.path.join(DIR, src['base']))
        shim = Image.open(os.path.join(DIR, src['shimmer']))
        for kind, tag in (('golden', 'gold'), ('umbra', 'umbra')):
            b = decorate(recolor(base, kind), kind, hash(pack['id'] + kind) & 0xffff)
            # Schimmer: Bild für Bild umfärben (alle 16 Streifen auf einmal, gleiche Rampe, ohne Perzentil-Streckung)
            s = recolor(shim, kind, strip=True)
            vid = pack['id'] + '-' + tag
            Image.fromarray(b, 'RGBA').save(os.path.join(DIR, pack['id'], vid + '.png'))
            Image.fromarray(s, 'RGBA').save(os.path.join(DIR, pack['id'], vid + '.shimmer.png'))
            pack['variants'].append({
                'id': vid, 'theme': 'Golden' if kind == 'golden' else 'Umbra', 'template': src.get('template'), 'prism': False, 'special': kind,
                'base': pack['id'] + '/' + vid + '.png', 'shimmer': pack['id'] + '/' + vid + '.shimmer.png', 'motifs': src.get('motifs', []),
            })
            n += 1
    json.dump(man, open(man_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(n, 'Spezial-Packs geschrieben')


if __name__ == '__main__':
    main()
