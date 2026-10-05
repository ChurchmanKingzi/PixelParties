# -*- coding: utf-8 -*-
"""Erzeugt alle Ausgaben nach scripts/charsets/out/ (aus diesem Ordner aufrufen:  python3 build.py).

  charset_campaign.png        RM2000/2003-Format: 288x256, 8-Bit-Palette, Index 0 = Transparenz (RTP-Grün)
  charset_campaign_alpha.png  dieselben Pixel mit Alphakanal (für das Spiel im Browser)
  charset_campaign.json       Zellgröße, Spalten-/Zeilenfolge und Platz jeder Figur
  <Name>_walk.png             einzelne Figur, 3 Spalten x 4 Zeilen (RGBA); Crum: Zellen 32x32
  preview_sheet.png           vergrößerter Überblick
  preview_walk.gif            Laufzyklus aller Figuren in allen vier Richtungen
  preview_center_vs_original.png   Beleg der Grundregel: Mitte vorn == Original-Sprite
"""
import json
import os
import numpy as np
from PIL import Image
import rig
import figure
import native
import cast

rig.check()
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ORDER = ['Tobi', 'Wendy', 'Mithuru', 'Ethan', 'Ellie', 'Georgie']      # RM2003-Sheet (24x32), Plätze 1-6 von 8
BIG = ['Crum']                                                          # 28 px breit: eigene Datei mit 32x32-Zellen
GREEN = rig.KEY + (255,)


def on_green(rgba, k):
    im = Image.fromarray(rgba, 'RGBA').resize((rgba.shape[1] * k, rgba.shape[0] * k), Image.NEAREST)
    bg = Image.new('RGBA', im.size, GREEN)
    bg.alpha_composite(im)
    return bg


def gif(path, names, k=4, ms=150):
    """Laufzyklus A - Stand - B - Stand, alle Figuren (Spalten) in allen Richtungen (Zeilen)."""
    blocks = {n: figure.char_block(cast.CAST[n]) for n in names}
    cw = max(cast.CAST[n]['cell'][0] for n in names)
    chh = 32
    frames = []
    for fi in (0, 1, 2, 1):
        canvas = np.zeros((4 * chh, len(names) * cw, 4), np.uint8)
        for ci, n in enumerate(names):
            fw, fh = cast.CAST[n]['cell']
            blk = blocks[n]
            for di in range(4):
                cell = blk[di * fh:(di + 1) * fh, fi * fw:(fi + 1) * fw]
                canvas[di * chh:di * chh + fh, ci * cw + (cw - fw) // 2:ci * cw + (cw - fw) // 2 + fw] = cell
        im = Image.fromarray(canvas, 'RGBA').resize((canvas.shape[1] * k, canvas.shape[0] * k), Image.NEAREST)
        bg = Image.new('RGBA', im.size, (52, 66, 56, 255))
        bg.alpha_composite(im)
        frames.append(bg.convert('P', palette=Image.ADAPTIVE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=2)


def main():
    os.makedirs(OUT, exist_ok=True)
    figs = [cast.CAST[n] for n in ORDER]
    sheet = figure.sheet_rgba(figs)
    ncol = rig.save_rm2k3(sheet, os.path.join(OUT, 'charset_campaign.png'))
    Image.fromarray(sheet).save(os.path.join(OUT, 'charset_campaign_alpha.png'))
    for n, fig in cast.CAST.items():
        Image.fromarray(figure.char_block(fig)).save(os.path.join(OUT, f'{n}_walk.png'))

    meta = dict(
        format='RPG Maker 2000/2003 Charset', sheet=[288, 256], cell=list(rig.CELL),
        columns=['Schritt A', 'Stand', 'Schritt B'], rows=list(rig.DIRS),
        slots={str(i): n for i, n in enumerate(ORDER)},
        large=[dict(name=n, cell=list(cast.CAST[n]['cell']), file=f'{n}_walk.png') for n in BIG],
        palette_colors=ncol)
    with open(os.path.join(OUT, 'charset_campaign.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # Überblick: RM-Sheet auf RTP-Grün (3x) + Crum
    a = on_green(sheet, 3)
    crum = on_green(figure.char_block(cast.CAST['Crum']), 3)
    ov = Image.new('RGBA', (a.width + 16 + crum.width, a.height), (30, 36, 32, 255))
    ov.alpha_composite(a, (0, 0))
    ov.alpha_composite(crum, (a.width + 16, 0))
    ov.save(os.path.join(OUT, 'preview_sheet.png'))

    gif(os.path.join(OUT, 'preview_walk.gif'), ORDER + BIG)

    # Beleg: Original-Sprite (links) und Mitte vorn (rechts), 6x, gleiche Pixel
    tiles = []
    for n, fig in cast.CAST.items():
        nat = native.load(n)
        cell = figure.render(fig, 'down', 'stand').rgba(fig['pal'])
        x0, y0 = fig['x0'], fig['y0']
        sub = cell[y0:y0 + fig['H'], x0:x0 + fig['W']]
        assert np.array_equal(np.where(nat[..., 3:4] == 0, 0, nat), np.where(sub[..., 3:4] == 0, 0, sub)), n
        k = 6
        l = Image.fromarray(nat, 'RGBA').resize((nat.shape[1] * k, nat.shape[0] * k), Image.NEAREST)
        r = Image.fromarray(cell, 'RGBA').resize((cell.shape[1] * k, cell.shape[0] * k), Image.NEAREST)
        t = Image.new('RGBA', (l.width + 10 + r.width, max(l.height, r.height)), (52, 66, 56, 255))
        t.alpha_composite(l, (0, t.height - l.height))
        t.alpha_composite(r, (l.width + 10, t.height - r.height))
        tiles.append(t)
    W = max(t.width for t in tiles) * 4 + 5 * 12
    rows = [tiles[:4], tiles[4:]]
    H = sum(max(t.height for t in r) for r in rows) + 3 * 12
    im = Image.new('RGBA', (W, H), (30, 36, 32, 255))
    y = 12
    for r in rows:
        x = 12
        for t in r:
            im.alpha_composite(t, (x, y + max(q.height for q in r) - t.height)); x += t.width + 12
        y += max(q.height for q in r) + 12
    im.save(os.path.join(OUT, 'preview_center_vs_original.png'))
    print('RM2003-Sheet:', ncol, 'Farben inkl. Transparenz;', len(cast.CAST), 'Figuren; Ausgabe:', OUT)


if __name__ == '__main__':
    main()
