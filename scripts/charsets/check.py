# -*- coding: utf-8 -*-
"""Qualitätsprüfungen für die Laufsheets (aus scripts/charsets aufrufen: python3 check.py).

  * Grundregel: Mitte vorn (Runter/Stand) == Original-Sprite pixelgenau, sonst nichts in dieser Zelle
  * kein Frame berührt den Zellrand (sonst wäre etwas abgeschnitten)
  * Fußlinie: Stand-Frames enden auf y=30, Schritt-Frames vorn/hinten auf y=30/31 (Referenz-Kontaktpose)
  * gleiche Höhe: keine Ansicht ist höher oder niedriger als das Original (Kopf bis Fuß)
  * Palette: alle Farben stammen aus der Palette der Figur; je Sheet höchstens 255 Farben (+ Transparenz)
"""
import sys
import numpy as np
import rig
import figure
import cast

rig.check()


def main():
    ok = True
    sheet_cols = set()
    for name, fig in cast.CAST.items():
        cw, chh = fig['cell']
        if not figure.center_matches_original(fig):
            print(f'{name}: Mitte vorn ist NICHT das Original'); ok = False
        blk = figure.char_block(fig)
        top0 = fig['y0']                          # Oberkante des Originals
        for di, d in enumerate(rig.DIRS):
            for fi, f in enumerate(rig.FRAMES):
                cell = blk[di * chh:(di + 1) * chh, fi * cw:(fi + 1) * cw]
                a = cell[:, :, 3] > 0
                if not a.any():
                    print(f'{name} {d}/{f}: leer'); ok = False; continue
                ys, xs = np.where(a)
                # unten ist y=31 (letzte Zeile) für den belasteten Fuß der Schritt-Frames vorn/hinten erlaubt (wie in den
                # Referenzsheets); alle anderen Ränder müssen frei bleiben
                if xs.min() == 0 or xs.max() == cw - 1 or ys.min() == 0 or (ys.max() == chh - 1 and not (f != 'stand' and d in ('up', 'down'))):
                    print(f'{name} {d}/{f}: berührt den Zellrand (x {xs.min()}..{xs.max()}, y {ys.min()}..{ys.max()})'); ok = False
                if f == 'stand' and ys.max() != figure.BASE_Y:
                    print(f'{name} {d}/{f}: Fußlinie y={ys.max()} statt {figure.BASE_Y}'); ok = False
                if f != 'stand' and d in ('up', 'down') and ys.max() not in (figure.BASE_Y, figure.BASE_Y + 1):
                    print(f'{name} {d}/{f}: Fußlinie y={ys.max()}'); ok = False
                if d in ('left', 'right') and ys.max() != figure.BASE_Y:
                    print(f'{name} {d}/{f}: Seitenansicht endet auf y={ys.max()} statt {figure.BASE_Y}'); ok = False
                if d in ('up', 'down') and f == 'stand' and ys.min() < top0 - 1:
                    print(f'{name} {d}/{f}: höher als das Original (y={ys.min()} < {top0})'); ok = False
                sheet_cols |= {tuple(int(v) for v in c) for c in cell[a][:, :3]}
    print('Farben gesamt:', len(sheet_cols), '(RM2003: max. 255 + Transparenz je Sheet)')
    print('OK' if ok else 'FEHLER')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
