#!/usr/bin/env python3
# Retro-Oberflaechenpalette: ein kleiner Satz klarer Farbfamilien mit je 3-6 Schattierungen (dunkel -> hell).
# Jede Zielfarbe unten wird auf die NAECHSTE Farbe der 256er-Spielpalette (data/palette.json) gesetzt, die Oberflaeche nutzt also nur
# Farben, die es auch im Spiel gibt — und die Kartenfarben bleiben die Zentralfarben.   Ergebnis: data/palette-retro.json
# Schreibt ausserdem den Block RETRO:BEGIN/END in public/retro-core.js.
import json, re, math
import numpy as np
FAMILIEN = {
  'tinte':   ['#000000', '#08060c', '#12101f', '#1a1a2e', '#291f3d', '#3a3550'],
  'grau':    ['#59606e', '#7e7d9b', '#9aa3b6', '#c4c8d6', '#e5edfa', '#ffffff'],
  'cyan':    ['#0b8d9c', '#1aedff', '#8ff6ff'],
  'blau':    ['#17306b', '#2f5fb8', '#66b6ff', '#bddcef'],
  'violett': ['#2b0b47', '#58238c', '#903ae6', '#ba74ff', '#dcc0ff'],
  'magenta': ['#6e0a4a', '#b31478', '#fb1ea9', '#ff8fd8'],
  'rot':     ['#4a0010', '#8a0a1c', '#e0202c', '#ff5c5c', '#ffb0a8'],
  'orange':  ['#6a3410', '#c0561a', '#ff8b1a'],
  'gold':    ['#5a4000', '#a87000', '#f9ac20', '#ffd61a', '#fff0a0'],
  'muenze':  ['#b62600', '#ee6428', '#f29a3e', '#fad54a', '#f7f7ad'],      # die exakten Gold-Farben (data/palette-fest.json)
  'gruen':   ['#0f3a1a', '#1f7a3a', '#4ceb70', '#b1ff1a'],
  'braun':   ['#3a2210', '#7a4a20', '#b8885a', '#e0c498'],
}
def rgb(h): return [int(h[i:i+2], 16) for i in (1, 3, 5)]
def lab(c):
    c = np.array(c, float) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    x = (0.4124*c[0] + 0.3576*c[1] + 0.1805*c[2]) / 0.95047; y = 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; z = (0.0193*c[0] + 0.1192*c[1] + 0.9505*c[2]) / 1.08883
    f = lambda t: t ** (1/3) if t > 0.008856 else 7.787*t + 16/116
    x, y, z = f(x), f(y), f(z)
    return np.array([116*y - 16, 500*(x - y), 200*(y - z)])
pal = [p['hex'] for p in json.load(open('data/palette.json'))['farben']]
PL = np.array([lab(rgb(h)) for h in pal])
out = {}; gesehen = set()
for fam, ziele in FAMILIEN.items():
    reihe = []
    for z in ziele:
        d = ((PL - lab(rgb(z))) ** 2).sum(1)
        for i in np.argsort(d):
            if pal[i] not in gesehen: gesehen.add(pal[i]); reihe.append(pal[i]); break
    out[fam] = reihe
alle = [h for r in out.values() for h in r]
json.dump({'beschreibung': 'Reduzierte Retro-Oberflaechenpalette (Teilmenge von palette.json) — erzeugt von scripts/retro/build_palette.py',
           'groesse': len(alle), 'familien': out, 'farben': alle}, open('data/palette-retro.json', 'w'), indent=1)
src = open('public/retro-core.js', encoding='utf-8').read() if __import__('os').path.exists('public/retro-core.js') else None
if src:
    blk = '// RETRO:BEGIN — erzeugt, nicht von Hand aendern\n  const RETRO = ' + json.dumps(alle) + ';\n  // RETRO:END'
    src = re.sub(r'// RETRO:BEGIN.*?// RETRO:END', lambda m: blk, src, flags=re.S)
    open('public/retro-core.js', 'w', encoding='utf-8').write(src)
print(len(alle), 'Farben')
for fam, r in out.items(): print(fam.ljust(8), ' '.join(r))
