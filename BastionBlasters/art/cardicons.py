"""Kleine Symbole (7 Zeilen hoch) für Kartenwerte, aus der Master-Palette."""
from __future__ import annotations

import numpy as np

from pixl import *

# Zeichen -> (Rampe, Index) oder 'INK'
_COL = {
    'k': 'INK',
    'R': ('teamA', 4), 'r': ('teamA', 2), 'p': ('teamA', 5),
    's': ('metal', 4), 'S': ('metal', 2), 'h': ('metal', 5),
    'b': ('wood', 3), 'B': ('wood', 2),
    'g': ('gold', 4), 'G': ('gold', 2), 'y': ('gold', 5),
    'c': ('ice', 4), 'C': ('ice', 2), 'i': ('ice', 5),
    'l': ('leaf', 4), 'L': ('leaf', 2), 'm': ('leaf', 5),
    'o': ('fire', 4), 'O': ('fire', 2), 'q': ('fire', 5),
    'n': ('stone', 3), 'N': ('stone', 1), 'M': ('stone', 5),
    'u': ('purple', 4), 'U': ('purple', 2), 'v': ('purple', 5),
    'w': 'WHITE',
}

ICONS = {
    'heart': [
        ".kk.kk.",
        "kppRRRk",
        "kpRRRRk",
        "kRRRRrk",
        ".kRRrk.",
        "..krk..",
        "...k...",
    ],
    'sword': [
        "....kwk",
        "...kwhk",
        "k.kshk.",
        "kkshk..",
        ".kssk..",
        "kbkk...",
        "kBk....",
    ],
    'clock': [
        "..kkk..",
        ".kyyyk.",
        "kyykyyk",
        "kyykkyk",
        "kyyyyyk",
        ".kyyyk.",
        "..kkk..",
    ],
    'target': [
        "..kkk..",
        ".kooOk.",
        "kokkkOk",
        "kokqkOk",
        "kokkkOk",
        ".kooOk.",
        "..kkk..",
    ],
    'boot': [
        ".kkk...",
        ".kyk...",
        ".kyk...",
        ".kyk...",
        ".kyykk.",
        ".kyyyyk",
        ".kkkkkk",
    ],
    'person': [
        "..kkk..",
        ".kppRk.",
        ".kRRrk.",
        "..kkk..",
        ".kRRRk.",
        ".kRrRk.",
        ".kk.kk.",
    ],
    'reinforce': [
        "...k...",
        "..klk..",
        ".kmmlk.",
        "kkklkkk",
        "..klk..",
        "..klk..",
        "..kkk..",
    ],
    'star': [
        "...k...",
        "..kyk..",
        "kkkygkk",
        "kyyyggk",
        ".kyggk.",
        ".kygGk.",
        "..k.k..",
    ],
    'star_empty': [
        "...k...",
        "..knk..",
        "kkknNkk",
        "knnnNNk",
        ".knNNk.",
        ".knNNk.",
        "..k.k..",
    ],
    'room': [
        "...kk..",
        "..kRRk.",
        ".kRRRRk",
        "kkkkkkk",
        ".kbbbk.",
        ".kbkbk.",
        ".kkkkk.",
    ],
    'tower': [
        "k.k.k.k",
        "kkkkkkk",
        ".knnNk.",
        ".knnNk.",
        ".kn.Nk.",
        ".knnNk.",
        "kkkkkkk",
    ],
    'yard': [
        ".......",
        "..l.l..",
        ".lLllL.",
        "kkkkkkk",
        "kbbkbbk",
        "kkkkkkk",
        ".......",
    ],
    'wall': [
        "kkkkkkk",
        "knnknnk",
        "kkkkkkk",
        "nnknnkn",
        "kkkkkkk",
        "knnknnk",
        "kkkkkkk",
    ],
    'plus': [
        "..kkk..",
        "..klk..",
        "kkklkkk",
        "klmmmlk",
        "kkklkkk",
        "..klk..",
        "..kkk..",
    ],
    'cannon': [
        ".......",
        "..kkkk.",
        "kkSsssk",
        "kShhssk",
        "kkSsssk",
        ".kbbk..",
        ".kkkk..",
    ],
}


# Schwert-Varianten: die Klingenfarbe zeigt die Schadensart (Impact = Stahl)
_BLADE = {'fire': ('o', 'q'), 'ice': ('c', 'i'), 'lightning': ('g', 'y'), 'poison': ('l', 'm'), 'arcane': ('u', 'v')}
for _name, (_mid, _light) in _BLADE.items():
    ICONS['sword_' + _name] = [r.replace('s', _mid).replace('h', _light) for r in ICONS['sword']]


def _color(ch):
    v = _COL[ch]
    if v == 'INK':
        return INK
    if v == 'WHITE':
        return WHITE
    return RAMPS[v[0]][v[1]]


def icon_canvas(name: str) -> np.ndarray:
    rows = ICONS[name]
    h, w = len(rows), max(len(r) for r in rows)
    px = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.':
                px[y, x, :3] = _color(ch)
                px[y, x, 3] = 255
    return px


def blit_icon(img: np.ndarray, name: str, x: int, y: int):
    ic = icon_canvas(name)
    h, w = ic.shape[:2]
    sub = img[y:y + h, x:x + w]
    m = ic[:, :, 3] > 0
    sub[m] = ic[m]
    return w
