# -*- coding: utf-8 -*-
"""Hilfen zum Feilen an Pixeln: Zellen mit Koordinatengitter, Stand-Frames aller Richtungen nebeneinander."""
import numpy as np
from PIL import Image, ImageDraw
import rig
import figure
import cast


def cell(fig, view, frame):
    return figure.render(fig, view, frame).rgba(fig['pal'])


def grid_view(rgba, k=18, x0=0, y0=0, x1=None, y1=None):
    """Ausschnitt vergrößert, mit Koordinatenbeschriftung (Zellkoordinaten)."""
    x1 = x1 or rgba.shape[1]
    y1 = y1 or rgba.shape[0]
    sub = rgba[y0:y1, x0:x1]
    big = rig.zoom(sub, k)
    pad = 16
    im = Image.new('RGBA', (big.width + pad, big.height + pad), (20, 22, 22, 255))
    im.alpha_composite(big, (pad, pad))
    d = ImageDraw.Draw(im)
    for x in range(x1 - x0 + 1):
        d.line([(pad + x * k, pad), (pad + x * k, im.height)], fill=(255, 255, 255, 36))
    for y in range(y1 - y0 + 1):
        d.line([(pad, pad + y * k), (im.width, pad + y * k)], fill=(255, 255, 255, 36))
    for x in range(x1 - x0):
        d.text((pad + x * k + 2, 2), str(x0 + x), fill=(255, 230, 120, 255))
    for y in range(y1 - y0):
        d.text((0, pad + y * k + 2), str(y0 + y), fill=(120, 230, 255, 255))
    return im


def stands(name, k=16, frames=('stand',), dirs=('up', 'right', 'down', 'left'), crop=(2, 4, 22, 32), path=None):
    """Stand-Frames (oder weitere) der gewählten Richtungen nebeneinander mit Gitter."""
    fig = cast.CAST[name]
    tiles = []
    for d in dirs:
        for f in frames:
            tiles.append(grid_view(cell(fig, d, f), k, *crop))
    w = sum(t.width for t in tiles) + 8 * (len(tiles) - 1)
    im = Image.new('RGBA', (w, max(t.height for t in tiles)), (10, 10, 10, 255))
    x = 0
    for t in tiles:
        im.alpha_composite(t, (x, 0)); x += t.width + 8
    if path:
        im.save(path)
    return im
