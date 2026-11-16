# -*- coding: utf-8 -*-
"""Gemeinsame Hilfen der Schleim-Gruppe „slime“ (Runde 2): Quellsprites aus mehreren Ebenen der xcf-Zerlegung zusammensetzen.

Hintergrund: Bei manchen Schleimen liegt die untere Körperhälfte auf einer Nachbarebene (halbtransparent, Ebenendeckkraft 50 %).
Für die Animation wird sie voll deckend (Alpha 255) mit dem Kopfteil zu EINER Figur vereinigt.

    ebenen_sprite([(Ebenenindex, auswahl), …], slug)   zusammensetzen → src/<slug>.png; auswahl = None (ganze Ebene) oder
                                                        Funktion maske(a) → Bool-Maske (z. B. nur der größte Teil)
    groesster_teil(a)                                    Maske des größten 8-zusammenhängenden Teils einer Ebene
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

import anim_lib as L
import anim_amorph as A

WORK = os.environ.get('CREATURE_WORK', '/tmp/claude-0/-home-user-PixelParties/d19754f3-9c1f-54fd-aa59-083e17d35f07/scratchpad')
DUMP = WORK + '/dump/Motive/'


def ebene(i):
    a = np.array(Image.open(DUMP + '%03d.png' % i).convert('RGBA'))
    meta = {e['i']: e for e in json.load(open(DUMP + 'meta.json'))}
    return a, meta[i]['bbox']


def groesster_teil(a):
    op = (a[..., 3] > 0).astype(np.uint8)
    n, lab = cv2.connectedComponents(op, connectivity=8)
    if n <= 2:
        return op > 0
    gr = [(lab == k).sum() for k in range(1, n)]
    return lab == (1 + int(np.argmax(gr)))


def teil_mit_punkt(x, y):
    """Auswahl: der 8-zusammenhängende Teil, der das Ebenenpixel (x, y) enthält."""
    def f(a):
        op = (a[..., 3] > 0).astype(np.uint8)
        n, lab = cv2.connectedComponents(op, connectivity=8)
        return lab == lab[y, x]
    return f


def ebenen_sprite(teile, slug, schreibe=True):
    """teile: [(Ebenenindex, auswahl|None), …]; die ERSTE Ebene liegt unten, jede weitere wird darüber gezeichnet (deckend,
    Alpha 255 — Halbtransparenz der Ebene wird ignoriert). Gibt den auf die Figur beschnittenen RGBA-Sprite zurück."""
    ls = []
    for i, ausw in teile:
        a, bb = ebene(i)
        m = (a[..., 3] > 0) if ausw is None else (ausw(a) & (a[..., 3] > 0))
        ls.append((a, bb, m))
    x0 = min(bb[0] for a, bb, m in ls); y0 = min(bb[1] for a, bb, m in ls)
    x1 = max(bb[2] for a, bb, m in ls); y1 = max(bb[3] for a, bb, m in ls)
    can = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    for a, bb, m in ls:
        for y, x in zip(*np.nonzero(m)):
            can[bb[1] + y - y0, bb[0] + x - x0, :3] = a[y, x, :3]
            can[bb[1] + y - y0, bb[0] + x - x0, 3] = 255
    ys, xs = np.nonzero(can[..., 3])
    can = can[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if schreibe:
        Image.fromarray(can).save(os.path.join(L.SRC, slug + '.png'))
    return can


def pixelkarte(a):
    cols = {}
    for p in a.reshape(-1, 4):
        if p[3]:
            c = tuple(int(v) for v in p[:3]); cols[c] = cols.get(c, 0) + 1
    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    sym = {c: chars[k] for k, (c, n) in enumerate(sorted(cols.items(), key=lambda e: -e[1]))}
    print('    ' + ''.join(str(x // 10) for x in range(a.shape[1]))); print('    ' + ''.join(str(x % 10) for x in range(a.shape[1])))
    for y in range(a.shape[0]):
        print('%3d ' % y + ''.join(sym[tuple(int(v) for v in a[y, x, :3])] if a[y, x, 3] else '.' for x in range(a.shape[1])))
    print({s: c for c, s in sym.items()})


def misch_kopie(roh, nachbarn, k, sperre=()):
    """Wie anim_lib.misch_kopie (eingefügte Zeile mischt die Textur der ähnlichsten Nachbarzeile, jede zweite Spalte), aber Pixel mit einer Farbe aus `sperre`
    (Augen, Brauen, Mund, Glanzpunkte …) werden weder übernommen noch überschrieben — so wandern keine Gesichtsmerkmale in die eingefügte Zeile."""
    op = roh[:, 3] > 0
    xs = np.nonzero(op)[0]
    if len(xs) <= 2:
        return roh.copy()
    sp = {tuple(c) for c in sperre}

    def frei(zeile):
        return np.array([tuple(int(v) for v in p[:3]) not in sp for p in zeile])
    beste, bestwert = None, None
    for nb in nachbarn:
        if nb is None:
            continue
        ov = op & (nb[:, 3] > 0)
        if ov.sum() < 0.6 * op.sum():
            continue
        gleich = float((roh[ov, :3] == nb[ov, :3]).all(axis=1).mean())
        if 0.35 <= gleich < 0.98 and (bestwert is None or gleich > bestwert):
            beste, bestwert = nb, gleich
    neu = roh.copy()
    if beste is None:
        return neu
    ov = op & (beste[:, 3] > 0) & frei(roh) & frei(beste)
    ov[xs[0]] = ov[xs[-1]] = False
    spalten = np.nonzero(ov & (((np.arange(len(roh)) + k) % 2) == 1))[0]
    neu[spalten] = beste[spalten]
    return neu


def koerper_pose(zeilen, loeschen=(), doppeln=(), p=0, paare=((8, 9), (7, 10), (6, 11)), paare_je_zeile=None, x0=0, p_je_zeile=None, sperre=()):
    """Wie anim_amorph.koerper_pose (Squash & Stretch durch Zeilen entfernen/verdoppeln und Spalten verdoppeln/entfernen), aber die eingefügten Zeilen
    mischen die Textur der Nachbarzeile OHNE Gesichtsmerkmale: Farben in `sperre` bleiben in der Kopie unangetastet (siehe misch_kopie)."""
    paare_je_zeile = paare_je_zeile or {}
    p_je_zeile = p_je_zeile or {}

    def lv(liste):
        return [(a + x0, b + x0) for a, b in liste]
    out, quelle, proc, kopien = [], [], {}, []
    for k in range(zeilen.shape[0]):
        if k in loeschen:
            continue
        r = A.zeile_umbauen(zeilen[k], p_je_zeile.get(k, p), lv(paare_je_zeile.get(k, paare)))
        out.append(r); quelle.append(k); proc[k] = r
        extra = doppeln.get(k, 0) if isinstance(doppeln, dict) else (1 if k in doppeln else 0)
        for n_ in range(extra):
            out.append(r.copy()); quelle.append(k); kopien.append((len(out) - 1, k, n_ + 1))
    for j, k, n_ in kopien:
        out[j] = misch_kopie(proc[k], [proc.get(k - 1), proc.get(k + 1)], n_, sperre)
    return np.stack(out), quelle


SPRITES = {
    # Shadowy Slime: Kopf/Körper „Darky Slime“ (553) + untere Körperhälfte (552, Deckkraft 50 % → hier voll deckend)
    'shadowy-slime': [(552, None), (553, None)],
    # Splashy Slime: Kopf/Oberkörper (469) + untere Körperhälfte = größter Teil der Pfützen-Ebene 470 (Deckkraft 60 %; die kleinen Spritzer daneben bleiben weg)
    'splashy-slime': [(470, groesster_teil), (469, None)],
}

if __name__ == '__main__':
    for slug in sys.argv[1:] or SPRITES:
        s = ebenen_sprite(SPRITES[slug], slug)
        print(slug, s.shape[1], 'x', s.shape[0]); pixelkarte(s)
