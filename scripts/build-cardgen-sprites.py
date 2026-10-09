#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baut den Sprite-Atlas fuer den dynamischen Karten-Renderer (public/card-render.js).

Quelle sind die Bild-Dateien des Karten-Templates (Rahmen, Icons, Masken, Ecken-
Stempel), das Al ausserhalb des Repos pflegt. Ergebnis: EIN kleines PNG plus eine
JSON-Karte der Rechtecke — der Browser laedt statt dutzender Einzelbilder genau
diese zwei Dateien.

    python scripts/build-cardgen-sprites.py --src <Ordner mit PixelParties-standard.mse-style> --out public/cardgen

Alle Rahmen/Icons sind Pixel-Art in 1/10 der Kartengroesse (Rahmen 75x105 fuer
750x1050, Icons 10x10/11x11 fuer 100x100/110x110). Sie werden NICHT hochskaliert
gespeichert, sondern erst beim Zeichnen (nearest neighbour). Von den Foil-Bildern
bleiben nur die goldenen Rahmenelemente (Vorgabe: die Foils selbst ersetzt spaeter
der dynamische Foil-Effekt des Spiels).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True, help='Ordner mit den Dateien des MSE-Styles (…/PixelParties-standard.mse-style)')
ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'cardgen'))
args = ap.parse_args()

def find(name):
    """Dateiname ohne Beachtung der Gross-/Kleinschreibung (MSE laeuft auf Windows)."""
    want = name.lower()
    for f in os.listdir(args.src):
        if f.lower() == want:
            return os.path.join(args.src, f)
    sys.exit('fehlt im Template-Ordner: ' + name)

def load(name):
    return Image.open(find(name)).convert('RGBA')

def gold_only(name):
    """Hochaufgeloeste Foil-Datei (750x1050, 10x10-Bloecke) -> nur die opaken goldenen Pixel, als 75x105-Sprite."""
    a = np.asarray(load(name))
    gold = (a[:, :, 3] >= 200) & (a[:, :, 0] >= 190) & (a[:, :, 1] >= 150)
    out = np.zeros((105, 75, 4), np.uint8)
    for j in range(105):
        for i in range(75):
            blk = gold[j * 10:(j + 1) * 10, i * 10:(i + 1) * 10]
            if blk.mean() > 0.5:
                px = a[j * 10:(j + 1) * 10, i * 10:(i + 1) * 10][blk]
                out[j, i, :3] = np.median(px[:, :3], axis=0)
                out[j, i, 3] = 255
    return Image.fromarray(out, 'RGBA')

SPRITES = {}
def add(key, img): SPRITES[key] = img

# Rahmen (Kartentyp -> Datei)
for key, f in {
    'frame.hero': 'card-hero.png', 'frame.superhero': 'card-superhero.png', 'frame.fullartHero': 'card-fullHero.png',
    'frame.skill': 'card-skill.png', 'frame.skill3': 'card-skill3.png', 'frame.spell': 'card-spell.png',
    'frame.artifact': 'card-artifact.png', 'frame.artifactCreature': 'card-artifact-creature.png',
    'frame.potion': 'card-potion.png', 'frame.summon': 'card-summon.png',
    'frame.token': 'card-token.png', 'frame.tokenCreature': 'card-token-creature.png',
    # Rahmen-Elemente der Foils: nur Silber (rare) und Gold (super rare) als schmale Raender
    'rim.rare': 'superfoil.png', 'rim.superRare': 'ultrafoil.png',
}.items():
    add(key, load(f))
# Masken der Kunst: MSE wertet die Helligkeit aus (weiss = sichtbar, grau = teilweise) -> als Alpha speichern
for key, f in {'mask.art': 'mask.png', 'mask.hero': 'mask-hero.png', 'mask.fullart': 'mask-fullart.png'}.items():
    lum = np.asarray(load(f).convert('L'))
    m = np.zeros(lum.shape + (4,), np.uint8)
    m[:, :, :3] = 255
    m[:, :, 3] = lum
    add(key, Image.fromarray(m, 'RGBA'))
add('rim.goldSuperhero', gold_only('superheroFoil.png'))
add('rim.goldFullart', gold_only('fullartFoil.png'))

# Ecken-Stempel (Seltenheit) — schwarze Variante und weisse fuer Artefakte
for key, f in {
    'corner.common': 'cornersupercommon.png', 'corner.uncommon': 'cornercommon.png',
    'corner.rare': 'corneruncommon.png', 'corner.superRare': 'cornerrare.png',
    'corner.diamond': 'cornerdiamond.png', 'corner.sapphire': 'cornersapphire.png',
    'cornerW.common': 'cornersupercommonWhite.png', 'cornerW.uncommon': 'cornercommonWhite.png',
    'cornerW.rare': 'corneruncommonWhite.png', 'cornerW.superRare': 'cornerrareWhite.png',
}.items():
    add(key, load(f))

# Zauberschulen-Symbole (spell_symbol_field, 11x11)
SCHOOL = {
    'destruction': 'icon_destruction.png', 'support': 'icon_support.png', 'summoning': 'icon_summoning.png',
    'decay': 'icon_decay.png', 'arts': 'icon_arts.png', 'fight': 'icon_sword.png',
    'decayDestruction': 'icon_decayDestruction.png', 'decayArts': 'icon_decayArts.png',
    'decaySummoning': 'icon_decaySummoning.png', 'decaySupport': 'icon_decaySupport.png',
    'destructionArts': 'icon_destructionArts.png', 'destructionSummoning': 'icon_destructionSummoning.png',
    'destructionSupport': 'icon_destructionSupport.png', 'artsSummoning': 'icon_artsSummoning.png',
    'artsSupport': 'icon_artsSupport.png', 'summoningSupport': 'icon_summoningSupport.png',
}
for k, f in SCHOOL.items(): add('school.' + k, load(f))

# Kartenart-Symbole (spell_symbol_field2, 10x10): Falle / Reaktion / Fläche / Anhang je Kartenart
KIND = {
    'trap': 'icon_trap.png', 'quick': 'icon_instant.png', 'area': 'icon_area.png', 'attachment': 'icon_attach.png',
    'quickArti': 'icon_instant_artifact.png', 'attachmentArti': 'icon_attach_artifact.png',
    'trapArti': 'icon_trap_artifact.png', 'areaArti': 'icon_area_artifact.png',
    'trapPotion': 'icon_trap_potion.png', 'quickPotion': 'icon_instant_potion.png',
    'areaPotion': 'icon_area_potion.png', 'attachmentPotion': 'icon_attach_potion.png',
}
for k, f in KIND.items(): add('kind.' + k, load(f))

# Regelmaessiges Regalpacking (Zeilen), Breite 256
keys = sorted(SPRITES, key=lambda k: (-SPRITES[k].height, k))
W = 256
x = y = rowh = 0
rects = {}
for k in keys:
    im = SPRITES[k]
    if x + im.width > W:
        x = 0; y += rowh + 1; rowh = 0
    rects[k] = [x, y, im.width, im.height]
    x += im.width + 1
    rowh = max(rowh, im.height)
H = y + rowh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for k, (rx, ry, rw, rh) in rects.items():
    atlas.paste(SPRITES[k], (rx, ry))
os.makedirs(args.out, exist_ok=True)
atlas.save(os.path.join(args.out, 'sprites.png'), optimize=True)
with open(os.path.join(args.out, 'sprites.json'), 'w', encoding='utf-8') as fh:
    json.dump({'width': W, 'height': H, 'rects': rects}, fh, ensure_ascii=False, separators=(',', ':'))
print('sprites.png %dx%d, %d Sprites' % (W, H, len(rects)))
