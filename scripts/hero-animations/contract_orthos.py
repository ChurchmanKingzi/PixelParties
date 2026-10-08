# -*- coding: utf-8 -*-
"""Skin „Contract-Bound Orthos“ (Kyubey aus Madoka Magica) für Orthos, the Loyal Guard Dog — Idle-Animation
mit Lichtschein, auf dem Sprite des Users (Ebenen: glow, aura, body, bag, ear; alle 88x70, deckungsgleich).

Ebenen (unten -> oben): glow (weißer Lichtschein mit Strahlen), aura (gelbe Umrandung, 20 % deckend),
body (Kyubey samt linkem Ohr), bag (Papiertüte), ear (rechtes Ohr, hängt vor der Tüte).
Frame 0 = Ruhepose = der Sprite genau.

* Lichtschein: atmet (2x pro Loop), dazu läuft ein Schimmer rundherum durch die Strahlen (1x pro Loop,
  nach außen versetzt). Der Schein wird nur DUNKLER als im Sprite, nie heller — so bleibt die deckende
  Fläche (Alpha >= 160), nach der das Spiel die Figur einpasst, immer gleich.
* gelbe Umrandung: pulsiert von 20 % bis etwa 35 % im Takt des Lichts.
* Kyubey: federt (Kopf und Rücken heben sich um 1 px, die Beine bleiben stehen), blinzelt, beide Ohren
  schwingen als Wellen (Reifen wandern mit); alles flott (Federn 4x, Ohren 4 Zyklen pro Loop).
* Tüte: raschelt oben, die Augenlöcher glimmen rot auf, der Kopf darunter blinzelt (2 Frames nach Kyubey).
Aufruf (aus scripts/hero-animations):  python3 contract_orthos.py final 90
"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image
from anim_common import save_outputs

N = 48
NAME = 'contract-bound-orthos'


def load(part):
    return np.array(Image.open(f'src/{NAME}-{part}.png').convert('RGBA')).astype(int)


GLOW, AURA, BODY, BAG, EAR = (load(p) for p in ('glow', 'aura', 'body', 'bag', 'ear'))
H, W = BODY.shape[:2]
AURA_A = 51                                           # 20 % von 255
_ys, _xs = np.mgrid[0:H, 0:W]

# Lichtschein: Mittelpunkt (nach Deckkraft gewichtet) und Polarkoordinaten
_ga = GLOW[:, :, 3].astype(float)
CX, CY = (_xs * _ga).sum() / _ga.sum(), (_ys * _ga).sum() / _ga.sum()
THETA = np.arctan2(_ys - CY, _xs - CX)
RAD = np.hypot(_xs - CX, _ys - CY)

# Kyubey: linkes Ohr = Streifen links am Kopf; Augen
HEAD_BOTTOM = 39                                      # ab dieser Zeile stehen die Beine (fest)
EAR_MASK = (BODY[:, :, 3] > 0) & (((_xs <= 37) & (_ys >= 31)) | ((_xs <= 38) & (_ys >= 36)))
EYE_RED = {(208, 16, 60), (255, 128, 152)}
EYE_M = np.zeros((H, W), bool)
for y, x in zip(*np.nonzero(BODY[:, :, 3] > 0)):
    if tuple(BODY[y, x, :3]) in EYE_RED and x >= 39 and y <= 33:
        EYE_M[y, x] = True
_eys = np.nonzero(EYE_M)[0]
EYE_ROWS = (int(_eys.min()), int(_eys.max()))
FUR_LIGHT, OUTLINE = (217, 228, 229, 255), (66, 72, 74, 255)
BAG_PUPIL = [(y, x) for y, x in zip(*np.nonzero(BAG[:, :, 3] > 0)) if tuple(BAG[y, x, :3]) == (112, 0, 0)]
BAG_TOP = int(np.nonzero(BAG[:, :, 3] > 0)[0].min())
EAR_Y = {'l': (31, 40), 'r': (30, 41)}                # Spanne der Ohren in Zeilen (Aufhängung -> Spitze)
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
BAG_BLINK = {i + 2: v for i, v in BLINK.items()}      # der Tütenkopf blinzelt zwei Frames später
HOLE = [(y, x) for y, x in zip(*np.nonzero(BAG[:, :, 3] > 0)) if tuple(BAG[y, x, :3]) in ((0, 0, 0), (112, 0, 0))]
HOLE_ROWS = (min(y for y, _ in HOLE), max(y for y, _ in HOLE))
BAG_FILL, BAG_LINE = (154, 106, 56, 255), (85, 59, 31, 255)


def over(dst, src):
    """Straight-alpha-Komposition src über dst (beide HxWx4 int)."""
    a = src[:, :, 3:4] / 255.0
    b = dst[:, :, 3:4] / 255.0
    ao = a + b * (1 - a)
    rgb = np.where(ao > 0, (src[:, :, :3] * a + dst[:, :, :3] * b * (1 - a)) / np.maximum(ao, 1e-9), 0)
    return np.concatenate([np.rint(rgb), np.rint(ao * 255)], axis=2).astype(int)


def bob(layer, dy):
    """Kopf und Rücken heben sich um dy Zeilen (Beine bleiben): Zeilen oberhalb der Beine rücken nach oben, die Zeile
    an der Kante wird verdoppelt."""
    if not dy:
        return layer
    out = layer.copy()
    for y in range(0, HEAD_BOTTOM):
        out[y] = layer[min(HEAD_BOTTOM, y + dy)]
    return out


def shear_rows(layer, mask, y0, y1, amp, cycles, ph, lo=-2, hi=1):
    """Ohr als Welle: jede Zeile (Aufhängung y0 -> Spitze y1) wird um dx Pixel verschoben; Frame 0 -> dx = 0."""
    return layer, mask, (y0, y1, amp, cycles, ph, lo, hi)


def ear_dx(i, y, y0, y1, amp, cycles, ph, lo=-2, hi=1):
    k = min(1.0, max(0.0, (y - y0) / max(1, y1 - y0)))
    w = 2 * math.pi * cycles * i / N
    d = amp * k ** 1.3 * (math.sin(w - 2.2 * k + ph) - math.sin(-2.2 * k + ph))
    return int(max(lo, min(hi, round(d))))


def shifted(layer, mask, i, spec, dy):
    """Ebene mit Ohr-Welle: Zeilen der Maske seitlich verschoben, Rest unverändert."""
    out = np.zeros_like(layer)
    for y in range(H):
        for x in np.nonzero(mask[y])[0]:
            dx = ear_dx(i, y, *spec[:5]) if True else 0
            lo, hi = spec[5], spec[6]
            xx = x + dx
            if 0 <= xx < W:
                out[y, xx] = layer[y, x]
    return out


def glow_mult(i):
    """0..1: Atmen + umlaufender Schimmer; Frame 0 = 1 (nur dunkler, nie heller als im Sprite)."""
    breath = 1.0 - 0.16 * (1 - math.cos(2 * math.pi * 4 * i / N)) / 2
    s0 = np.cos(3 * THETA - 0.13 * RAD)
    si = np.cos(3 * THETA - 0.13 * RAD - 2 * math.pi * 2 * i / N)
    shimmer = np.minimum(1.0, 1.0 - 0.38 * (s0 - si) / 2.0)
    return np.clip(breath * shimmer, 0.0, 1.0)


def frame(i):
    dy = int(round(0.5 + 0.5 * math.sin(2 * math.pi * i / 24 + math.pi / 2 - math.pi / 2 * 0))) if False else 0
    k = (1 - math.cos(2 * math.pi * i / 12)) / 2                    # 0 in Frame 0, 1 nach 12 Frames
    dy = 1 if k > 0.5 else 0
    out = np.zeros((H, W, 4), int)
    g = GLOW.copy()
    g[:, :, 3] = np.rint(GLOW[:, :, 3] * glow_mult(i)).astype(int)
    out = over(out, g)
    a = AURA.copy()
    pulse = (1 - math.cos(2 * math.pi * 4 * i / N)) / 2
    a[:, :, 3] = int(round(AURA_A * (1 + 0.7 * pulse))) * (AURA[:, :, 3] > 0)
    out = over(out, a)
    # Kyubey: Ohr (hinter dem Kopf), dann Körper
    body = BODY.copy()
    emask = EAR_MASK
    rest = body.copy(); rest[emask] = 0
    ear_l = np.zeros_like(body); ear_l[emask] = body[emask]
    st = BLINK.get(i)
    if st:
        for y in range(EYE_ROWS[0], EYE_ROWS[1] + 1):
            for x in np.nonzero(EYE_M[y])[0]:
                if st == 'zu':
                    rest[y, x] = OUTLINE if y == EYE_ROWS[1] else FUR_LIGHT
                elif y == EYE_ROWS[0]:
                    rest[y, x] = FUR_LIGHT
    ear_l = bob(ear_l, dy)
    ear_mask = ear_l[:, :, 3] > 0
    ear_l = shifted(ear_l, ear_mask, i, (EAR_Y['l'][0] - dy, EAR_Y['l'][1] - dy, 2.4, 4, 0.0, -2, 1), dy)
    out = over(out, ear_l)
    out = over(out, bob(rest, dy))
    # Papiertüte
    bag = bob(BAG, dy)
    flap = int(round(math.sin(2 * math.pi * 6 * i / N))) if i else 0
    if flap:
        top = bag.copy()
        for y in range(BAG_TOP - dy, BAG_TOP - dy + 2):
            top[y] = 0
            for x in range(W):
                if 0 <= x - flap < W:
                    top[y, x] = bag[y, x - flap]
        bag = top
    pupil_glow = (i % 6) in (2, 3)
    if pupil_glow:
        for y, x in BAG_PUPIL:
            yy = y - dy if dy and y < HEAD_BOTTOM else y
            bag[yy, x] = (208, 16, 60, 255)
    bst = BAG_BLINK.get(i)
    if bst:
        for y, x in HOLE:
            yy = y - dy if dy and y < HEAD_BOTTOM else y
            if bst == 'zu':
                bag[yy, x] = BAG_LINE if y == HOLE_ROWS[1] else BAG_FILL
            elif y == HOLE_ROWS[0]:
                bag[yy, x] = BAG_FILL
    out = over(out, bag)
    # rechtes Ohr (vor der Tüte)
    er = bob(EAR, dy)
    emask = er[:, :, 3] > 0
    er = shifted(er, emask, i, (EAR_Y['r'][0] - dy, EAR_Y['r'][1] - dy, 1.8, 4, 1.7, -1, 1), dy)
    out = over(out, er)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    frames = [frame(i) for i in range(N)]
    sprite = over(over(over(over(over(np.zeros((H, W, 4), int), GLOW), np.where(AURA[:, :, 3:4] > 0, np.concatenate([AURA[:, :, :3], np.full((H, W, 1), AURA_A)], 2), 0)), BODY), BAG), EAR)
    Image.fromarray(sprite.astype(np.uint8)).save(f'src/{NAME}.png')
    print('frame0 == Sprite:', bool((frames[0] == sprite).all()))
    save_outputs(f'contract_orthos_idle_{tag}', frames, ms, scale=6, check_edges=True)
    core = np.zeros((H, W), bool)
    for f in frames:
        core |= f[:, :, 3] >= 160
    ys, xs = np.nonzero(core)
    eye_x = (np.nonzero(EYE_M)[1].min() + np.nonzero(EYE_M)[1].max() + 1) / 2
    foot = int(np.nonzero(BODY[:, :, 3] > 0)[0].max()) + 1
    meta = {"hero": "Contract-Bound Orthos", "sheet": f"{NAME}.png", "frameWidth": W, "frameHeight": H, "frames": N, "frameMs": ms,
            "loop": True, "layout": "horizontal", "skinOf": "Orthos, the Loyal Guard Dog",
            "padTop": int(ys.min()), "padLeft": int(xs.min()), "padRight": int(W - 1 - xs.max()), "padBottom": int(H - 1 - ys.max()),
            "faceX": float(eye_x), "footY": float(foot)}
    print('JSON:', json.dumps(meta, ensure_ascii=False))
