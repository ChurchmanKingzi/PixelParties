# -*- coding: utf-8 -*-
"""Hero-Sprites aus den GIMP-Arbeitsdateien (xcf) zusammensetzen.

Die xcf-Dateien (Repo PixelPartiesSprites, per Git LFS) enthalten pro Datei
viele Karten; jede Ebene ist so groß wie die ganze Leinwand, Sprites sind in
mehrere Ebenen zerlegt (teils unbenannt, z. B. „Ebene #14“).

Benutzung:
    python3 xcf_extract.py <datei.xcf> list [suchbegriff]
        -> Ebenen mit Index, Name, Deckkraft, Sichtbarkeit und Bounding-Box
    python3 xcf_extract.py <datei.xcf> preview <ausgabe.png> <ebene> [...]
        -> einzelne Ebenen nebeneinander (vergrößert) zum Ansehen
    python3 xcf_extract.py <datei.xcf> assemble <ausgabe.png> <ebene> [...]
        -> Ebenen in Stapelreihenfolge (unten zuerst) übereinanderlegen,
           auf die Bounding-Box zuschneiden und als PNG speichern

Ebenen werden per Index (z. B. 489) oder exaktem Namen („Mary“) angegeben.
Die Ebenen-Deckkraft wird berücksichtigt (Modus „Normal“).
"""
import sys
from PIL import Image
import numpy as np
from gimpformats.gimpXcfDocument import GimpDocument


def load(path):
    doc = GimpDocument(path)
    return doc, doc.raw_layers


def resolve(layers, keys):
    idx = []
    for k in keys:
        if k.isdigit():
            idx.append(int(k))
        else:
            hits = [i for i, l in enumerate(layers) if l.name == k]
            if len(hits) != 1:
                raise SystemExit(f'Ebene {k!r}: {len(hits)} Treffer')
            idx.append(hits[0])
    return idx


def layer_rgba(doc, layer):
    """Ebene als RGBA auf voller Leinwand (Versatz + Deckkraft angewendet)."""
    canvas = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    im = layer.image
    if im is None:
        return canvas
    im = im.convert('RGBA')
    if layer.opacity < 255:
        a = np.array(im)
        a[:, :, 3] = (a[:, :, 3].astype(int) * layer.opacity // 255).astype(np.uint8)
        im = Image.fromarray(a)
    tmp = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    tmp.paste(im, (layer.xOffset, layer.yOffset))
    return tmp


def main():
    path, cmd = sys.argv[1], sys.argv[2]
    doc, layers = load(path)
    if cmd == 'list':
        term = sys.argv[3].lower() if len(sys.argv) > 3 else ''
        for i, l in enumerate(layers):
            if term and term not in l.name.lower():
                continue
            bb = layer_rgba(doc, l).getbbox() if term else None
            print(i, repr(l.name), 'op', l.opacity, 'sichtbar' if l.visible else 'versteckt',
                  'bbox', bb if term else '-')
        return
    out = sys.argv[3]
    idx = resolve(layers, sys.argv[4:])
    if cmd == 'preview':
        tiles = []
        for i in idx:
            im = layer_rgba(doc, layers[i])
            bb = im.getbbox()
            if not bb:
                continue
            t = im.crop(bb)
            s = max(1, min(8, 200 // max(t.size)))
            bg = Image.new('RGBA', t.size, (40, 30, 70, 255))
            bg.alpha_composite(t)
            tiles.append(bg.resize((t.width * s, t.height * s), Image.NEAREST))
        w = sum(t.width for t in tiles) + 10 * len(tiles)
        h = max(t.height for t in tiles)
        res = Image.new('RGBA', (w, h), (0, 0, 0, 255))
        x = 0
        for t in tiles:
            res.paste(t, (x, 0))
            x += t.width + 10
        res.save(out)
    elif cmd == 'assemble':
        comp = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
        for i in sorted(idx, reverse=True):              # hoher Index = weiter unten
            comp.alpha_composite(layer_rgba(doc, layers[i]))
        bb = comp.getbbox()
        comp.crop(bb).save(out)
        print('gespeichert:', out, 'Größe', comp.crop(bb).size, 'Position auf der Leinwand', bb[:2])


if __name__ == '__main__':
    main()
