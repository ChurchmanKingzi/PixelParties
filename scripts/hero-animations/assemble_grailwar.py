# -*- coding: utf-8 -*-
"""Hero- und Skin-Sprites aus MotiveGrailWar.xcf zusammensetzen (mit dem Nutzer
abgeglichen). Die Zuordnung steht unten in main() – je Figur die Ebenen bzw.
deren Zusammenhangskomponente (near: die Komponente am nächsten zu x, y) und
Ausschnitte (box).

Aufruf:  python3 assemble_grailwar.py <pfad/zu/MotiveGrailWar.xcf>
Schreibt src/<slug>.png und bewegliche Teile deckungsgleich als
src/<slug>-<teil>.png; Geschosse (Brackles Totenschädel) als eigene Datei.
"""
import colorsys
import sys
import numpy as np
import cv2
from PIL import Image
from gimpformats.gimpXcfDocument import GimpDocument

OUT = 'src'


def layer(doc, layers, name):
    hits = [l for l in layers if l.name == name]
    assert len(hits) == 1, (name, len(hits))
    l = hits[0]
    im = l.image.convert('RGBA')
    if l.opacity < 255:                                   # Ebenen-Deckkraft übernehmen
        a = np.array(im)
        a[:, :, 3] = (a[:, :, 3].astype(int) * l.opacity // 255).astype(np.uint8)
        im = Image.fromarray(a)
    c = Image.new('RGBA', (doc.width, doc.height), (0, 0, 0, 0))
    c.paste(im, (l.xOffset, l.yOffset))
    return np.array(c)


def components(a):
    return cv2.connectedComponents((a[:, :, 3] > 0).astype(np.uint8), connectivity=8)


def only(a, keep):
    return np.where(keep[:, :, None], a, 0).astype(np.uint8)


def biggest(a):
    n, lab = components(a)
    k = int(np.argmax([(lab == k).sum() for k in range(1, n)])) + 1
    return only(a, lab == k)


def save_parts(slug, parts):
    """parts: [(teil, Leinwand-RGBA)] von unten nach oben."""
    comp = Image.new('RGBA', (parts[0][1].shape[1], parts[0][1].shape[0]), (0, 0, 0, 0))
    for _, a in parts:
        comp.alpha_composite(Image.fromarray(a))
    bb = comp.getbbox()
    if len(parts) > 1:
        for name, a in parts:
            Image.fromarray(a).crop(bb).save(f'{OUT}/{slug}-{name}.png')
    img = comp.crop(bb)
    img.save(f'{OUT}/{slug}.png')
    print(slug, img.size)


def near(a, x, y):
    """Die Zusammenhangskomponente von a, die (x, y) am nächsten liegt."""
    n, lab = components(a)
    ys, xs = np.nonzero(lab > 0)
    d = (xs - x) ** 2 + (ys - y) ** 2
    k = lab[ys[d.argmin()], xs[d.argmin()]]
    return only(a, lab == k)


def box(a, x0, y0, x1, y1):
    """Nur den Ausschnitt [x0, x1) × [y0, y1) behalten."""
    out = np.zeros_like(a)
    out[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    return out


def shift(a, dx, dy):
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    out[max(0, dy):h + min(0, dy), max(0, dx):w + min(0, dx)] = a[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]
    return out


def rows(a, y0=None, y1=None):
    """Nur Zeilen [y0, y1) behalten (Leinwand-Koordinaten)."""
    out = np.zeros_like(a)
    out[y0:y1] = a[y0:y1]
    return out


def layer_over(*arrs):
    """Ebenen von unten nach oben zusammenlegen."""
    out = np.zeros_like(arrs[0])
    for a in arrs:
        m = a[:, :, 3] > 0
        out[m] = a[m]
    return out


def save_single(name, a):
    ys, xs = np.nonzero(a[:, :, 3])
    Image.fromarray(a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(f'{OUT}/{name}.png')


def paint(a, x0, y0, rows, pal):
    """Pixel-Zeichnung in a (Leinwand-Koordinaten) ab (x0, y0); '.' = nichts."""
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in '. ':
                continue
            c = pal[ch]
            a[y0 + dy, x0 + dx] = (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    return a


def above(a, y):
    """Nur die Zeilen über y (Tischkante) behalten."""
    return rows(a, None, y)


# Unterkörper der drei Alchemisten (in der Ebene vom Tisch verdeckt, nachgezeichnet)
LOWER = {
    'nicolas': (231, 209, dict(Q='000200', V='282927', S='515350', R='696b68', U='414240', T='20211f',
                               K='282b2d', P='9fa8a7', N='c9cbbf'), [
        "....QVSRSSSSVQKPNK",
        "....QVSRSSSSVQ.KK.",
        "....QQVVVVVVQQ",
        "....QUUUQQUUUQ",
        "....QURUQQURUQ",
        "...QTTTTQQTTTTQ",
        "...QQQQQQQQQQQQ"]),
    'saint': (229, 209, dict(G='430e18', E='641121', C='782132', D='9e3b50', A='dcbf87', B='ede0b4',
                             H='606663', T='c3c7b8', J='1a1a1a'), [
        "...GECCCCHTHCCCCEG..",
        "..GECDCCCCHCCCCDCEG.",
        ".GEECDCCCCCCCCCDCEEG",
        ".GEECDCECCCCECCDCEEG",
        ".GAABAABAABAABAABAAG",
        "....JJJJ....JJJJ...."]),
    'edward': (231, 209, dict(R='340404', S='b74346', T='672126', Y='1a1e1f', U='000200', Z='3a4946', z='5d6e69'), [
        "....RTYYYYYYTRRzZR",
        "...RSTYYYYYYTSRZR.",
        "...RSTYYUYYYTSR",
        "..RSTUYYUUYYUTSR",
        "..RRRUYYUUYYURRR",
        ".....UYYUUYYU",
        "....UZZZUUZZZU",
        "....UUUUUUUUUU"]),
}


def lower_body(a, key):
    x0, y0, pal, rws = LOWER[key]
    return paint(above(a, y0), x0, y0, rws, pal)


def marianne_hair(old, fork):
    """Mariannes Haare aus der alten, flach gerenderten Szene (Sichtbar #164, dort 2 px weiter links):
    warme Haarpixel ausschneiden, auf die heutige Haarpalette abbilden, unter der Mistgabel freistellen."""
    out = np.zeros_like(old)
    for y_ in range(242, 254):
        for x_ in range(222, 244):
            if y_ == 242 and x_ < 235 or 229 <= x_ <= 233 and y_ >= 252:     # Baum links oben, Mund
                continue
            r, gg, b = (int(v) for v in old[y_, x_, :3])
            h, s, _ = colorsys.rgb_to_hsv(r / 255, gg / 255, b / 255)
            if x_ >= 239 and r < 0x50 and gg < 0x20 and b < 0x20:    # fast schwarze Kontur des rechten Zopfs
                r = 0x29
            elif not (h < 0.17 and s > 0.75 and r > 0x80 or r >= 0x29 and gg < 0x36 and b < 0x14 and r > gg * 1.6):
                continue
            c = '440000' if r < 0x50 else '73290d' if r < 0xa0 else 'd66107' if gg < 0x80 else 'f8a314' if gg < 0xc8 else 'ffcd2d'
            out[y_, x_ + 2] = (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)
    # linker Zopf (hinter der Mistgabel) = Spiegelbild des rechten; Achse = Gesichtsmitte (x 233,5)
    for y_ in range(242, 250):
        for x_ in range(239, 246):
            out[y_, 467 - x_] = out[y_, x_]
    out[fork[:, :, 3] > 0] = 0
    return out


def main(path):
    doc = GimpDocument(path)
    L = doc.raw_layers
    g = lambda n: layer(doc, L, n)
    # --- Heroes ---
    save_parts('asriel-the-sapling-sacrificer', [('body', near(g('Asriel'), 295, 100))])
    cec = near(g('CECILIA'), 313, 262)
    cec = cec.copy()
    ys_, xs_ = np.nonzero(cec[:, :, 3])
    cx0, cy0 = xs_.min(), ys_.min()
    cyan = (cec[:, :, 2].astype(int) > 180) & (cec[:, :, 0].astype(int) < 60) & (cec[:, :, 3] > 0)
    cec[cyan] = 0                                        # türkiser Einzelpixel links am Kopf
    bhat = g('Ebene #411').copy()
    # Lücke zwischen Hutkrempe und Haaren: Krempe um eine Zeile nach unten verlängern
    hy = np.nonzero(bhat[:, :, 3])[0].max()
    paint(bhat, cx0 + 2, hy + 1, ["ABBBBBBBBBBA"], dict(A='604a1b', B='7a5f23'))
    # Restlücken an den Krempenenden: Pixel mit Hut darüber und Haaren darunter (je ±1 Spalte) schließen
    hx = np.nonzero(bhat[:, :, 3])[1]
    for y_ in range(hy, hy + 3):
        comp = layer_over(cec, bhat)
        op = comp[:, :, 3] > 0
        for x_ in range(hx.min() - 3, hx.max() + 4):
            if not op[y_, x_] and op[y_ - 1, x_ - 1:x_ + 2].any() and op[y_ + 1, x_ - 1:x_ + 2].any():
                xs_up = [x_ + d for d in (0, -1, 1) if op[y_ - 1, x_ + d]]
                bhat[y_, x_] = comp[y_ - 1, xs_up[0]]
    # Hut knapp über der Krempe verbreitern (Zeile 13 war eingeschnürt), Krempe je 1 px länger
    ys_, xs_ = np.nonzero(layer_over(cec, bhat)[:, :, 3])
    paint(bhat, xs_.min() + 1, ys_.min() + 13, [".A..........E", "A............E"], dict(A='604a1b', E='4e30a7'))
    save_parts('bad-birthday-girl-cecilia', [('body', cec), ('hat', bhat)])
    save_parts('barker-the-monster-tamer', [('body', g('Barker')), ('mark', g('Barker #4'))])
    bs = near(g('Blackstache'), 167, 200)
    ys_, xs_ = np.nonzero(bs[:, :, 3])                   # brennende Lunten (Ebene #229) rund um ihn
    fuses = box(g('Ebene #229'), xs_.min() - 8, ys_.min() - 8, xs_.max() + 9, ys_.max() + 9)
    save_parts('blackstache-scourge-of-the-pixel-seas', [('body', bs), ('fuses', fuses)])
    save_parts('brackle-the-catapulting-turtle', [('body', g('Brackle'))])
    save_single('brackle-skull', g('Ebene #265'))
    b472 = near(g('Broghan-Kopie'), 271, 125)
    save_parts('broghan-the-frozen-guardian-of-the-north', [('body', b472)])
    chuck = near(g('Chuck'), 252, 164)
    beer = g('Ebene #244')
    ys_, xs_ = np.nonzero(layer_over(beer, chuck)[:, :, 3])
    arm = paint(np.zeros_like(chuck), xs_.min(), ys_.min(), [
        ".", ".", ".", ".", ".", ".", ".", ".", ".", ".",
        ".........WW",
        "........DWWW",
        "........DWaW",
        ".........WW"], dict(W='0c0d07', a='232415', D='ffd5a4'))
    save_parts('chuck-the-crazy-veteran', [('beer', beer), ('body', chuck), ('arm', arm)])
    save_parts('codumbus-the-clueless-voyager', [('body', near(g('Codumbus #1'), 228, 154))])
    dev = near(g('Devlin'), 244, 165)
    dark = near(g('Devlin-Kopie'), 244, 165)
    sweat = dark.copy()                                  # Schweißtropfen (hellblau) aus der dunklen Version
    m = (sweat[:, :, 2].astype(int) > 180) & (sweat[:, :, 0].astype(int) < 150) & (sweat[:, :, 3] > 0)
    sweat[~m] = 0
    save_parts('devlin-the-masked-butcher', [('body', layer_over(dev, sweat))])
    save_parts('enigma-the-seller-of-secrets', [('body', near(g('Enigma #5'), 429, 235))])
    sw = g('Ebene #402')
    keep = np.zeros(sw.shape[:2], bool)                  # nur das obere der drei Schwertbilder (samt blutiger Spitze)
    keep[218:224, :317] = True
    keep[224:228, :308] = True
    keep[228:231, :301] = True
    sw[~keep] = 0
    # Klingenunterkante rechts vom Lappen springt um 5 px – als Diagonale auffüllen
    ys_, xs_ = np.nonzero(sw[:, :, 3])
    bx, by = xs_.min() - 1, ys_.min() - 10
    edge = sw[by + 15, bx + 21].copy()
    for y_, xa, xb in [(16, 17, 19), (17, 17, 17)]:
        for x_ in range(xa, xb + 1):
            sw[by + y_, bx + x_] = sw[by + y_ - 1, bx + x_]
        sw[by + y_, bx + xb] = edge
    sword = sw
    # Arm samt Lappen: wie beim Skin (Ebene #399), in Froschgrün umgefärbt
    frog = near(g('Fern'), 299, 219)
    skin2frog = {'623a2e': '265f18', 'ba6b5e': '398e23', 'd98a79': '48b32c', 'eba08b': '5cce3f',
                 'ffc1a8': '99e087', '2d0900': '0e2600'}
    rag = g('Ebene #399').copy()
    for y_, x_ in zip(*np.nonzero(rag[:, :, 3])):
        h = '%02x%02x%02x' % tuple(int(v) for v in rag[y_, x_, :3])
        if h in skin2frog:
            c = skin2frog[h]
            rag[y_, x_, :3] = (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
    save_parts('fern-the-ship-slave', [('body', frog), ('sword', sword), ('arm', rag)])
    save_parts('fern-the-liberated-fairy', [('body', near(g('Ascended Fern'), 316, 203))])
    save_parts('fiona-the-princess-of-blackport', [('body', box(g('Fiona'), 247, 150, 282, 182))])
    bunny = g('Bunny')
    rope_cols = {(0x3f, 0x1f, 0x0f), (0xc7, 0x9f, 0x61), (0x67, 0x40, 0x20), (0x88, 0x5f, 0x31), (0xaf, 0x7f, 0x40)}
    hand_cols = {(0x31, 0x18, 0x00), (0xee, 0x9c, 0x7b), (0xff, 0xd5, 0xa4), (0xbd, 0x5a, 0x39)}
    rope = np.zeros_like(bunny)
    for y_, x_ in zip(*np.nonzero(bunny[:, :, 3])):
        c = tuple(int(v) for v in bunny[y_, x_, :3])
        if (c in rope_cols and x_ <= 304) or (c in hand_cols and x_ <= 306 and 145 <= y_ <= 153):
            rope[y_, x_] = bunny[y_, x_]
    save_parts('gabby-the-boarding-broad', [('body', g('Gabby Human')), ('rope', rope)])
    save_parts('gabby-the-pirate-zombie', [('body', rows(near(g('Gabby Zombie'), 244, 178), 178))])
    save_parts('garius-the-great-reformer', [('body', g('Garius'))])
    save_parts('gobbo-chief-of-goblin', [('body', g('Gobbo'))])
    save_parts('hatusbal-the-leader-of-tusca', [('body', near(g('Hatusbal'), 184, 142))])
    save_parts('hulijing-the-foxdemon', [('fire', g('Ebene #76')), ('body', g('Hulijing'))])
    save_parts('ingo-investor-of-evil', [('body', g('Ingo'))])
    save_parts('key-the-cursed-thief', [('body', g('Key #3'))])
    save_parts('krates-the-smartass', [('body', g('Krates'))])
    save_parts('kyli-the-deceptive-sapling', [('body', g('Kyli'))])
    save_parts('madame-guillotine-the-great-equalizer', [('body', near(g('Madame Guillotine'), 121, 212))])
    mar = g('Marianne #1')
    fork = g('Marianne #6')
    save_parts('marianne-the-cocky-caretaker', [('fork', fork), ('cat', near(g('Marianne #3'), 250, 258)),
                                                ('body', mar), ('hair', marianne_hair(g('Sichtbar #164'), fork)),
                                                ('arm', g('Marianne #9')),
                                                ('hat', near(g('Marianne #5'), 234, 244))])
    save_parts('nicolas-the-hidden-alchemist', [('body', lower_body(g('Nicolas'), 'nicolas')), ('flask', g('Ebene #2'))])
    save_parts('saint-nicolas', [('body', lower_body(g('Saint Nicolas'), 'saint')),
                                 ('potions', layer_over(near(g('Ebene #330'), 252, 198), near(g('Ebene #330'), 226, 199)))])
    save_parts('santa-klaus', [('body', near(g('Santa'), 284, 134))])
    save_parts('stellan-the-calm-cat', [('body', near(g('Stellan'), 247, 165))])
    fx = g('Ebene #293')
    fx[:, :295] = 0                                      # Flammen und Dampf nur bei Tazune
    save_parts('tazune-the-angry-hot-blood', [('body', biggest(g('Tazune'))), ('fx', fx)])
    save_parts('timeless-king-zi', [('body', g('Zi'))])
    save_parts('waflav-the-metamorphing-monstrosity', [('body', g('Waflav'))])
    save_parts('xal-the-animated-armor', [('body', near(g('Xal'), 227, 118))])
    save_parts('alleria-the-queen-of-spiders', [('body', near(g('Alleria'), 320, 141))])
    # --- Skins ---
    save_parts('alchemic-xal', [('body', near(g('Xal Skin'), 227, 118))])
    save_parts('alleria-the-octo-princess', [('body', near(g('Octopus Alleria'), 320, 147))])
    save_parts('ancient-hatusbal', [('body', near(g('Jack'), 184, 139))])
    save_parts('barker-the-monster-trainer', [('body', near(g('Ash'), 40, 106))])
    golem = near(g('Ancient Gear Golem'), 271, 124)
    save_parts('broghan-the-ancient-golem', [('body', golem)])
    save_parts('cecilia-the-clown', [('body', g('CECILIA-Kopie'))])
    save_parts('dark-garius', [('body', g('Vader'))])
    save_parts('elegant-ingo', [('body', g('Ingo Skin'))])
    baku = g('Bakugo')
    taz = g('Tazune')
    chair = (taz[:, :, 3] > 0) & (biggest(taz)[:, :, 3] == 0)      # Stuhl = Tazunes Nebenkomponente
    same = chair & (np.abs(baku[:, :, :3].astype(int) - taz[:, :, :3].astype(int)).sum(2) < 8)
    baku[same] = 0
    save_parts('explosive-tazune', [('body', biggest(baku)), ('fx', fx)])
    save_parts('fern-the-elf-slave', [('body', near(g('Dobby'), 300, 222)), ('sword', sword), ('hand', g('Ebene #399'))])
    save_parts('fullmetal-nicolas', [('body', lower_body(g('Edward Elric'), 'edward')), ('flask', g('Ebene #2'))])
    save_parts('gabby-the-chosen-girl', [('body', near(bunny, 308, 135))])
    save_parts('gabby-the-moonlight-warrior', [('body', rows(near(g('Sailor Moon'), 244, 178), 178))])
    save_parts('kyli-the-true-mastermind', [('body', g('Zetsu'))])
    save_parts('mass-murderer-devlin', [('body', dark)])
    save_parts('monster-prince-asriel', [('body', g('Asriel Dreemurr'))])
    save_parts('stellan-the-calm-easter-bunny', [('body', near(g('OSTER STELLAN'), 247, 164))])
    save_parts('wahflav-the-uninvited-fighter', [('body', g('WAFLAV-Kopie'))])
    save_parts('mutated-teenager-brackle', [('body', g('Leonardo'))])


if __name__ == '__main__':
    main(sys.argv[1])
