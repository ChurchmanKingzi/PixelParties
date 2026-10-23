#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Baut die 256-Farben-Palette des Spiels → data/palette.json (+ public/palette.js).

    python3 scripts/palette/build_palette.py

1. ZENTRALFARBEN: die Farben der Karten-Elemente (Rahmen, Symbole, Ecken in public/cardgen/sprites.png sowie die Farbkonstanten des Kartenrenderers),
   nach Haeufigkeit gewichtet; fast gleiche Toene (ΔE < 7 in CIE Lab) werden zur haeufigsten zusammengefasst. Diese Farben stehen UNVERAENDERT in der Palette.
2. AUFSTOCKUNG: bis 256 Farben. Kandidaten sind Schattierungen (gleicher Farbton und gleiche Saettigung, andere Helligkeit) aller Zentralfarben UND der Haupt-
   farben der Oberflaeche (Farb-Literale in CSS/JSX, siehe farben-sammeln.js), dazu Graustufen. Gewaehlt wird gierig die Farbe, die den gewichteten Abstand aller
   Oberflaechenfarben zur Palette am staerksten senkt — so deckt die Palette jede Farbfamilie in mehreren Schattierungen ab.
Weder Kartenrahmen noch -motive werden angefasst: sie sind die Quelle, nicht das Ziel.
"""
import json, os, re, subprocess, sys, colorsys, math
import numpy as np
from PIL import Image

WURZEL = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ZIEL_GROESSE = 256
KERN_MAX = 72          # hoechstens so viele Zentralfarben (der Rest sind Schattierungen)
MERGE_DE = 7.0

def rgb2lab(rgb):
    rgb = np.asarray(rgb, dtype=float) / 255.0
    lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)

def hex2rgb(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def rgb2hex(c): return '#%02x%02x%02x' % tuple(int(round(max(0, min(255, v)))) for v in c)

# ── 1. Zentralfarben aus den Karten-Elementen ───────────────────────────────────────────────────
sp = Image.open(os.path.join(WURZEL, 'public/cardgen/sprites.png')).convert('RGBA')
roh = {}
for p in sp.getdata():
    if p[3] >= 200: roh[p[:3]] = roh.get(p[:3], 0) + 1
# Farbkonstanten des Kartenrenderers (rgb(...) und #hex ausserhalb von Kommentaren)
src = open(os.path.join(WURZEL, 'public/card-render.js'), encoding='utf-8').read()
src = re.sub(r'//[^\n]*', '', src)
for m in re.finditer(r'rgb\((\d+),\s*(\d+),\s*(\d+)\)', src):
    c = (int(m.group(1)), int(m.group(2)), int(m.group(3))); roh[c] = roh.get(c, 0) + 4000     # Konstanten zaehlen wie haeufige Rahmenfarben
for m in re.finditer(r"'(#[0-9a-fA-F]{6})'", src):
    c = tuple(hex2rgb(m.group(1))); roh[c] = roh.get(c, 0) + 4000
farben = sorted(roh.items(), key=lambda kv: -kv[1])
print('Karten-Elemente:', len(farben), 'verschiedene Farben')
kern = []   # [(rgb, gewicht)]
for c, n in farben:                                   # haeufigste zuerst: sie bleiben, Aehnliche gehen in sie ein
    lab = rgb2lab(c)
    for i, (k, w) in enumerate(kern):
        if np.linalg.norm(rgb2lab(k) - lab) < MERGE_DE:
            kern[i] = (k, w + n); break
    else:
        kern.append((c, n))
kern.sort(key=lambda kw: -kw[1])
if len(kern) > KERN_MAX: kern = kern[:KERN_MAX]
KERN = [tuple(k) for k, w in kern]
for c in [(0, 0, 0), (255, 255, 255)]:
    if c not in KERN and not any(np.linalg.norm(rgb2lab(c) - rgb2lab(k)) < 3 for k in KERN): KERN.append(c)
print('Zentralfarben:', len(KERN))

# ── 2. Oberflaechenfarben (Gewichte) ────────────────────────────────────────────────────────────
# Gewichte = Farben der OBERFLAECHE VOR dem Einrasten (data/palette-ui-gewichte.json). Neu erfassen (nur sinnvoll, wenn die Quellen NICHT auf die Palette gerastet sind,
# etwa aus einem Git-Stand): node scripts/palette/farben-sammeln.js --json --git <ref> > data/palette-ui-gewichte.json
gewichte_pfad = os.path.join(WURZEL, 'data/palette-ui-gewichte.json')
ui = json.load(open(gewichte_pfad, encoding='utf-8'))       # { "#rrggbb": anzahl }
UI_FARBEN = np.array([hex2rgb(h) for h in ui], dtype=float); UI_GEW = np.array(list(ui.values()), dtype=float)
UI_LAB = rgb2lab(UI_FARBEN)
print('Oberflaeche:', len(ui), 'verschiedene Farben,', int(UI_GEW.sum()), 'Literale')

# ── 3. Kandidaten: Schattierungen ───────────────────────────────────────────────────────────────
def schattierungen(rgb, stufen=(0.10, 0.18, 0.28, 0.40, 0.55, 0.70, 0.84, 0.94)):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
    out = []
    for L in stufen:
        # an den Raendern der Helligkeit verliert Saettigung Sinn: sanft abdunkeln/aufhellen
        s2 = s * (1 - max(0, (L - 0.75)) * 1.6) if L > 0.75 else s
        out.append(tuple(round(v * 255) for v in colorsys.hls_to_rgb(h, L, max(0, min(1, s2)))))
    return out

# Hauptfarben der Oberflaeche: Cluster nach Farbton/Saettigung (grob), je Cluster der gewichtete Mittelwert
def hauptfarben(n=48):
    chrom = [(i, colorsys.rgb_to_hls(*[v / 255 for v in UI_FARBEN[i]])) for i in range(len(UI_FARBEN))]
    kisten = {}
    for i, (h, l, s) in chrom:
        if s < 0.18 or l < 0.04 or l > 0.97: continue
        key = (int(h * 24) % 24, int(s * 3))
        kisten.setdefault(key, []).append(i)
    res = []
    for key, idx in kisten.items():
        w = UI_GEW[idx]; c = (UI_FARBEN[idx] * w[:, None]).sum(0) / w.sum()
        res.append((w.sum(), tuple(c)))
    res.sort(reverse=True)
    return [c for w, c in res[:n]]

kandidaten = set()
for c in KERN: kandidaten.update(schattierungen(c))
for c in hauptfarben(): kandidaten.update(schattierungen(c))
for g in range(0, 256, 8): kandidaten.add((g, g, g))              # Graustufen
# Nacht-Neutrale (dunkle Blau-/Violett-Toene der Oberflaeche): Familie aus den haeufigsten dunklen UI-Farben
for i in np.argsort(-UI_GEW)[:400]:
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in UI_FARBEN[i]])
    if l < 0.30: kandidaten.add(tuple(int(v) for v in UI_FARBEN[i]))
kandidaten = [c for c in kandidaten if c not in KERN]
print('Kandidaten:', len(kandidaten))
KAND_LAB = rgb2lab(np.array(kandidaten, dtype=float))

palette = list(KERN)
pal_lab = rgb2lab(np.array(palette, dtype=float))
fehler = np.min(np.linalg.norm(UI_LAB[:, None, :] - pal_lab[None, :, :], axis=2), axis=1)
abst_kand = np.linalg.norm(UI_LAB[:, None, :] - KAND_LAB[None, :, :], axis=2)         # UI x Kandidaten
# Gierig: die Farbe mit dem groessten gewichteten Fehlerabbau; Fehler wird mit ΔE^1.3 gewichtet, damit grosse Ausreisser zuerst fallen
while len(palette) < ZIEL_GROESSE:
    gewinn = (UI_GEW[:, None] * (np.maximum(fehler[:, None], 0) ** 1.3 - np.minimum(fehler[:, None], abst_kand) ** 1.3)).sum(0)
    # Kandidaten, die einer Palettenfarbe fast gleichen (ΔE < 4), nicht nehmen
    gewinn[np.min(np.linalg.norm(KAND_LAB[:, None, :] - pal_lab[None, :, :], axis=2), axis=1) < 4] = -1
    j = int(np.argmax(gewinn))
    if gewinn[j] <= 0: break
    palette.append(kandidaten[j]); pal_lab = np.vstack([pal_lab, KAND_LAB[j]])
    fehler = np.minimum(fehler, abst_kand[:, j])
print('Palette:', len(palette), 'Farben; mittlerer ΔE der Oberflaeche', round(float((fehler * UI_GEW).sum() / UI_GEW.sum()), 2), ', 95 %-Perzentil', round(float(np.percentile(np.repeat(fehler, np.maximum(1, UI_GEW.astype(int))), 95)), 1))

# Sortierung: Neutrale nach Helligkeit, dann Farbfamilien nach Farbton, je Familie nach Helligkeit
def sortkey(c):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c])
    if s < 0.12: return (0, 0, l)
    return (1, round(h * 24) % 24, l)
palette_sortiert = sorted(palette, key=sortkey)
kernset = set(KERN)
out = {'version': 1, 'groesse': len(palette_sortiert),
       'beschreibung': 'Spiel-Palette: Zentralfarben = Farben der Karten-Elemente (kern: true), dazu Schattierungen und Oberflaechenfarben. Nicht von Hand aendern — scripts/palette/build_palette.py.',
       'farben': [{'hex': rgb2hex(c), 'kern': tuple(c) in kernset} for c in palette_sortiert]}
json.dump(out, open(os.path.join(WURZEL, 'data/palette.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(WURZEL, 'data/palette.json'), 'a').write('\n')
print('→ data/palette.json')

# ── Laufzeit-Skript: Palette in public/palette.js eintragen ──
pjs = os.path.join(WURZEL, 'public/palette.js')
t = open(pjs, encoding='utf-8').read()
daten = "  const PALETTE = " + json.dumps([f['hex'] for f in out['farben']]) + ";"
t = re.sub(r"(// PALETTE:BEGIN[^\n]*\n).*?(\n\s*// PALETTE:END)", lambda m: m.group(1) + daten + m.group(2), t, flags=re.S)
open(pjs, 'w', encoding='utf-8').write(t)
print('→ public/palette.js')
