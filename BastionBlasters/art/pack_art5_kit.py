"""Gemeinsame Zeichenhilfen fuer pack_art5 (Verteidiger UV-12..17, Zivilisten UZ-03..07)."""
from __future__ import annotations

import math
import random

from pixl import *


def dither_box(c, x0, y0, x1, y1, ramp, a, b, only_filled=True, phase=0):
    """Schachbrett zwischen zwei Tonstufen a/b ueber ein Rechteck (nur auf vorhandenen Pixeln)"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if only_filled and not c.alpha(x, y):
                continue
            c.put_ramp(x, y, ramp, a if (x + y + phase) % 2 == 0 else b)


def hline(c, x0, x1, y, ramp, idx, only_filled=False):
    for x in range(int(x0), int(x1) + 1):
        if only_filled and not c.alpha(x, y):
            continue
        c.put_ramp(x, y, ramp, idx)


def vline(c, x, y0, y1, ramp, idx, only_filled=False):
    for y in range(int(y0), int(y1) + 1):
        if only_filled and not c.alpha(x, y):
            continue
        c.put_ramp(x, y, ramp, idx)


def pts(c, lst, ramp, idx):
    for (x, y) in lst:
        c.put_ramp(x, y, ramp, idx)


def gear(c, cx, cy, r, ramp='gold', lo=1, hi=5, teeth=8, hub=True, hub_ramp='coal', hub_idx=1, rot=0.0):
    """Zahnrad: Koerper + Zaehne + Nabe"""
    for k in range(teeth):
        a = rot + 2 * math.pi * k / teeth
        tx = cx + math.cos(a) * (r + 0.6)
        ty = cy + math.sin(a) * (r + 0.6)
        light = 4 if (math.cos(a) * -0.55 + math.sin(a) * -0.65) > 0 else 2
        c.put_ramp(int(round(tx - 0.5)), int(round(ty - 0.5)), ramp, light)
        c.put_ramp(int(round(tx + 0.4 - 0.5)), int(round(ty + 0.4 - 0.5)), ramp, light)
    ellipse(c, cx, cy, r, r, ramp, lo=lo, hi=hi)
    if hub:
        c.put_ramp(int(cx - 0.5), int(cy - 0.5), hub_ramp, hub_idx)
        c.put_ramp(int(cx + 0.5 - 0.5), int(cy - 0.5), hub_ramp, hub_idx)
        c.put_ramp(int(cx - 0.5), int(cy + 0.5 - 0.5), hub_ramp, hub_idx)
        c.put_ramp(int(cx + 0.5 - 0.5), int(cy + 0.5 - 0.5), hub_ramp, hub_idx)


def eye(c, x, y, big=False, ramp='coal', idx=1):
    """schlichtes Auge: 1x2 oder 2x2"""
    c.put_ramp(x, y, ramp, idx)
    c.put_ramp(x, y + 1, ramp, idx)
    if big:
        c.put_ramp(x + 1, y, ramp, idx)
        c.put_ramp(x + 1, y + 1, ramp, idx)


def note(c, x, y, ramp='gold', hi=5, lo=4):
    """Musiknote (Achtel), 5 x 7, linke obere Ecke"""
    pts(c, [(x + 1, y + 6), (x + 2, y + 6), (x, y + 5), (x + 1, y + 5), (x + 2, y + 5), (x + 1, y + 4), (x + 2, y + 4)], ramp, hi)
    pts(c, [(x + 3, y), (x + 3, y + 1), (x + 3, y + 2), (x + 3, y + 3), (x + 3, y + 4), (x + 3, y + 5)], ramp, lo)
    pts(c, [(x + 4, y + 1), (x + 4, y + 2), (x + 5, y + 3)], ramp, hi)


def puff(c, cx, cy, rx, ry=None, ramp='bone', lo=3, hi=5):
    ellipse(c, cx, cy, rx, ry or rx, ramp, lo=lo, hi=hi, ambient=0.35)


def flame(c, x, base_y, h, f=0, w=5):
    """kleine Flamme: Tropfenform aus fire-Tonstufen, Spitze nach oben, Fuss bei base_y"""
    for dy in range(h):
        t = dy / max(1, h - 1)
        half = (w / 2.0) * (1 - t) ** 0.8 + 0.4
        sway = int(round(math.sin((f + dy) * 0.9) * 0.8 * t))
        for dx in range(-int(half), int(half) + 1):
            tone = 2 + (1 if abs(dx) <= half * 0.6 else 0) + (1 if t < 0.55 and abs(dx) <= half * 0.35 else 0)
            if t < 0.25 and abs(dx) <= half * 0.4:
                tone = 5
            c.put_ramp(x + dx + sway, base_y - dy, 'fire', min(5, tone))


def plume_crest(c, x0, x1, base_y, height, ramp='teamA', jag=1, phase=0):
    """quer liegender Helmkamm (Seitenansicht): Bogen ueber der Helmkuppel mit Borsten"""
    n = x1 - x0
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, n)
        h = int(round(height * math.sin(math.pi * (0.1 + 0.8 * t)))) + (jag if (x + phase) % 2 == 0 else 0)
        for y in range(base_y - h, base_y + 1):
            lit = (y - (base_y - h))
            tone = 4 if lit <= 1 else (3 if lit <= 3 else 2)
            if (x + phase) % 3 == 0:
                tone = max(1, tone - 1)
            c.put_ramp(x, y, ramp, tone)
