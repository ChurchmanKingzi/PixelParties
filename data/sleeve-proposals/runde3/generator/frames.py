# -*- coding: utf-8 -*-
"""Verzierte Rahmen für alle Runde-3-Sleeves und Export unter englischem Namen nach runde3/final/.

Der Rahmen wird auf dem 250×350-Grundraster (1 Rasterpixel = 3 Bildpixel) gezeichnet und über das fertige
Sleeve gelegt: Band mit Fase (Licht oben/links, Schatten unten/rechts), stiltypisches Muster, Eckplatten mit
Edelstein und Zierspornen, Kartuschen in der Seitenmitte, innen eine Schattenkante auf dem Bild.
Aufruf: python3 frames.py            (alle)   |   python3 frames.py 13 34   (nur diese Nummern)
"""
import os, sys, glob
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, '..'))
DST = os.path.join(SRC, 'final')
os.makedirs(DST, exist_ok=True)
GW, GH = 250, 350

# Paletten: outline, dunkel, mittel, hell, Glanz
PAL = {
    'gold':    [(40, 22, 4), (138, 84, 16), (206, 146, 36), (246, 204, 84), (255, 246, 190)],
    'bronze':  [(34, 20, 10), (112, 62, 26), (170, 104, 48), (214, 150, 86), (246, 214, 160)],
    'silver':  [(26, 28, 38), (98, 104, 122), (156, 164, 182), (206, 212, 226), (250, 252, 255)],
    'lacquer': [(30, 6, 6), (110, 14, 16), (170, 26, 26), (214, 60, 48), (246, 204, 84)],
    'ebony':   [(8, 8, 10), (30, 28, 34), (52, 48, 58), (78, 72, 86), (246, 204, 84)],
    'bamboo':  [(22, 34, 10), (70, 100, 30), (118, 150, 48), (166, 196, 82), (222, 238, 150)],
    'brass':   [(36, 20, 8), (120, 72, 26), (184, 124, 50), (226, 176, 92), (252, 230, 170)],
    'sea':     [(8, 26, 36), (20, 78, 96), (36, 128, 146), (84, 182, 190), (200, 244, 240)],
    'wood':    [(30, 16, 8), (86, 50, 24), (128, 80, 40), (168, 114, 62), (206, 158, 100)],
    'stone':   [(26, 26, 30), (82, 80, 86), (122, 120, 126), (160, 158, 164), (200, 198, 204)],
    'iron':    [(10, 10, 14), (40, 42, 50), (64, 68, 78), (96, 100, 112), (160, 166, 180)],
    'ice':     [(30, 56, 96), (110, 156, 206), (160, 200, 236), (206, 232, 250), (255, 255, 255)],
    'gothic':  [(14, 4, 6), (58, 10, 16), (92, 18, 26), (130, 34, 40), (214, 170, 90)],
    'cosmic':  [(8, 6, 20), (32, 20, 66), (56, 36, 104), (92, 64, 150), (220, 210, 255)],
    'bone':    [(40, 34, 26), (150, 138, 112), (196, 186, 160), (228, 220, 198), (255, 252, 240)],
}
# Musterart je Stil
PATTERN = {'gold': 'beads', 'bronze': 'beads', 'silver': 'beads', 'lacquer': 'goldline', 'ebony': 'goldline',
           'bamboo': 'nodes', 'brass': 'rivets', 'sea': 'waves', 'wood': 'grain', 'stone': 'blocks',
           'iron': 'rivets', 'ice': 'sparkle', 'gothic': 'studs', 'cosmic': 'stars', 'bone': 'notches'}

GEM = {'ruby': [(90, 0, 10), (200, 20, 40), (255, 120, 130)], 'emerald': [(0, 60, 30), (30, 170, 80), (160, 250, 180)],
       'sapphire': [(10, 20, 90), (40, 90, 220), (150, 200, 255)], 'amethyst': [(50, 10, 80), (150, 60, 210), (230, 180, 255)],
       'amber': [(90, 40, 0), (230, 140, 20), (255, 220, 120)], 'jade': [(10, 70, 60), (40, 170, 140), (170, 250, 220)],
       'pearl': [(120, 120, 130), (220, 220, 230), (255, 255, 255)], 'topaz': [(110, 70, 0), (240, 190, 40), (255, 245, 170)],
       'rose': [(110, 20, 60), (240, 90, 160), (255, 200, 230)], 'onyx': [(0, 0, 0), (50, 50, 60), (150, 150, 170)],
       'lava': [(110, 20, 0), (250, 110, 20), (255, 220, 120)], 'cyan': [(0, 70, 100), (40, 200, 230), (200, 255, 255)],
       'lime': [(40, 80, 0), (140, 220, 40), (230, 255, 170)], 'magenta': [(90, 0, 70), (230, 50, 200), (255, 190, 245)]}

# Nr: (englischer Name, Stil, Edelstein[, zweiter Edelstein])
SLEEVES = {
    1: ('Lunar New Year', 'lacquer', 'topaz'), 2: ('Heavenly Throne', 'lacquer', 'jade'),
    3: ('Guardian Niu', 'bronze', 'ruby'), 4: ('Yokai Parade', 'bamboo', 'ruby'),
    5: ('Moonlit Duel', 'ebony', 'ruby', 'sapphire'), 6: ('Fox Pond', 'silver', 'rose'),
    7: ('Porthole', 'brass', 'sapphire'), 8: ('Into the Deep', 'sea', 'topaz'),
    9: ('Sirens Song', 'sea', 'pearl'), 10: ('Luau', 'wood', 'lava'),
    11: ('Fire and Storm', 'gold', 'lava', 'cyan'), 12: ('Aquatic Crest', 'silver', 'sapphire'),
    13: ('Count of the Deep', 'gothic', 'ruby'), 14: ('Lava Diver', 'brass', 'lava'),
    15: ('Steam Crest', 'brass', 'topaz'), 16: ('Dwarf King', 'gold', 'ruby'),
    17: ('Hydra Duel', 'ice', 'sapphire'), 18: ('White Parade', 'ice', 'ruby'),
    19: ('Poison Card', 'gold', 'emerald', 'amethyst'), 20: ('T-Rex Breach', 'stone', 'lava'),
    21: ('Skulltop Storm', 'iron', 'cyan'), 22: ('The Summoning', 'gothic', 'magenta'),
    23: ('Generals Duel', 'gold', 'ruby'), 24: ('Crossing the Alps', 'silver', 'amber'),
    25: ('Blackstaches Bow', 'wood', 'topaz'), 26: ('Weapon Storm', 'iron', 'ruby'),
    27: ('Rift in the Sky', 'cosmic', 'ruby'), 28: ('Fun Fun Circus', 'lacquer', 'topaz'),
    29: ('Dragon Flight', 'bronze', 'emerald', 'sapphire'), 30: ('Close Encounter', 'cosmic', 'lime'),
    31: ('Rise of the Phoenix', 'gold', 'lava'), 32: ('Ladder to the Sky', 'wood', 'sapphire'),
    33: ('Life Serum', 'iron', 'rose'), 34: ('Blood Eclipse', 'gothic', 'ruby'),
    35: ('Rotten Mastermind', 'gothic', 'amethyst'), 36: ('Vanitas', 'wood', 'ruby'),
    37: ('Travelers Portal', 'cosmic', 'topaz'), 38: ('Class Photo', 'wood', 'ruby'),
    39: ('Inferno', 'iron', 'lava'), 40: ('Angel Mirror', 'silver', 'topaz', 'onyx'),
    41: ('Raise the Minions', 'bone', 'lime'), 42: ('Slime Drive', 'bamboo', 'lime'),
    43: ('Cybug Case', 'gold', 'amber'), 44: ('Dragons Hoard', 'gold', 'emerald'),
    45: ('Last Round', 'wood', 'amber'), 46: ('Midnight in London', 'iron', 'topaz'),
    47: ('Frozen Throne', 'ice', 'cyan'), 48: ('Trojan Gift', 'stone', 'topaz'),
    49: ('Curtain Call', 'gold', 'ruby'), 50: ('Nile Night', 'gold', 'sapphire'),
    51: ('Circle of Fuses', 'lacquer', 'amber'), 52: ('Trident Shrine', 'sea', 'amethyst'),
    53: ('Dragon Pilot', 'brass', 'lava'), 54: ('Witching Hour', 'wood', 'lime'),
    55: ('Twin Reapers', 'gothic', 'topaz'), 56: ('Heart Bow', 'silver', 'rose'),
    57: ('Exploding Skull', 'bone', 'amber'), 58: ('Mammoth Trek', 'bone', 'sapphire'),
    59: ('Qinglong Storm', 'bronze', 'jade'), 60: ('Bone Wyrm', 'bone', 'lava'),
}


FS = 2                      # 1 Rahmenpixel = 2 Rasterpixel = 6 Bildpixel (Rahmen im 125×175-Raster)
FW, FH = GW // FS, GH // FS


def build_frame(style, gem, gem2=None):
    """Rahmen im 125×175-Raster: Band (5 px) mit Fase und Muster, Eckplatten, Kartuschen, Edelsteine."""
    P = PAL[style]; O, D, M, L, G = [np.array(c) for c in P]
    rgb = np.zeros((FH, FW, 3), np.uint8); a = np.zeros((FH, FW), np.uint8)   # 1 = Rahmen, 2 = Schatten aufs Bild
    yy, xx = np.mgrid[0:FH, 0:FW]
    dist = np.minimum.reduce([xx, yy, FW - 1 - xx, FH - 1 - yy])
    side = np.argmin(np.stack([yy, xx, FH - 1 - yy, FW - 1 - xx]), 0)
    lit = (side == 0) | (side == 1)
    along = np.where((side == 0) | (side == 2), xx, yy)
    band = dist < 5
    a[band] = 1
    def put(mask, col): rgb[mask] = col
    put(band & (dist == 0), O)
    put(band & (dist == 1) & lit, L); put(band & (dist == 1) & ~lit, D)
    put(band & (dist == 2), M)
    put(band & (dist == 3) & lit, D); put(band & (dist == 3) & ~lit, L)
    put(band & (dist == 4), O)
    mid = band & (dist == 2)
    pat = PATTERN[style]; rng = np.random.default_rng(7)
    if pat == 'beads':
        put(mid & (along % 3 == 0), G); put(mid & (along % 3 == 1), L)
    elif pat == 'goldline':
        put(mid, np.array(PAL['gold'][2])); put(mid & (along % 4 == 0), np.array(PAL['gold'][4]))
    elif pat == 'nodes':
        put(band & (dist >= 1) & (dist <= 3) & (along % 9 == 0), O); put(mid & (along % 9 == 1), G)
    elif pat == 'rivets':
        put(mid & (along % 8 == 4), G); put(mid & (along % 8 == 5), O)
    elif pat == 'waves':
        put(mid & (along % 4 == 0), G); put(mid & (along % 4 == 2), L)
    elif pat == 'grain':
        put(mid & (rng.random(band.shape) < 0.3), D); put(mid & (along % 13 == 6), O)
    elif pat == 'blocks':
        put(band & (dist >= 1) & (dist <= 3) & (along % 7 == 0), O)
    elif pat == 'sparkle':
        put(mid & (rng.random(band.shape) < 0.3), G)
    elif pat == 'studs':
        put(mid & (along % 6 == 3), G)
    elif pat == 'stars':
        put(mid & (rng.random(band.shape) < 0.18), G)
    elif pat == 'notches':
        put(mid & (along % 5 == 0), D)
    a[(dist == 5) & (a == 0)] = 2

    def plate(x0, y0, w, h):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                e = min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y)
                top_left = (y - y0) <= (h - 1) / 2 and (x - x0) <= (w - 1) / 2
                if e == 0: c = O
                elif e == 1: c = L if ((y - y0 == 1) or (x - x0 == 1)) else D
                else: c = M
                rgb[y, x] = c; a[y, x] = 1

    def gem_at(cx, cy, r, g):
        cols = GEM[g]
        for y in range(cy - r - 1, cy + r + 2):
            for x in range(cx - r - 1, cx + r + 2):
                d = abs(x - cx) + abs(y - cy)
                if d == r + 1: rgb[y, x] = O
                elif d <= r:
                    s_ = (x - cx) + (y - cy)
                    rgb[y, x] = cols[2] if s_ < 0 else (cols[0] if s_ > 0 and d == r else cols[1])
        rgb[cy - 1, cx - 1 if r > 1 else cx] = (255, 255, 255) if r > 1 else cols[2]

    C = 9
    g2 = gem2 or gem
    for k, (cx, cy) in enumerate([(0, 0), (FW - C, 0), (FW - C, FH - C), (0, FH - C)]):
        plate(cx, cy, C, C)
        gem_at(cx + C // 2, cy + C // 2, 2, gem if k % 2 == 0 else g2)
    for (cx, cy, horiz) in [(FW // 2, 3, True), (FW // 2, FH - 4, True), (3, FH // 2, False), (FW - 4, FH // 2, False)]:
        if horiz: plate(cx - 7, cy - 3, 15, 7)
        else: plate(cx - 3, cy - 7, 7, 15)
        gem_at(cx, cy, 1, g2 if horiz else gem)
        for s_ in (-4, 4):     # zwei Nieten neben dem Stein
            x, y = (cx + s_, cy) if horiz else (cx, cy + s_)
            rgb[y, x] = G
    return rgb, a


def frame_sleeve(nr):
    src = glob.glob(os.path.join(SRC, f'{nr:02d}_*.png'))
    src = [s for s in src if not os.path.basename(s).startswith('00_')]
    assert len(src) == 1, (nr, src)
    name, style, gem, *rest = SLEEVES[nr]
    rgb, a = build_frame(style, gem, rest[0] if rest else None)
    im = np.array(Image.open(src[0]).convert('RGB')).astype(np.float32)
    R = np.repeat(np.repeat(rgb, 3 * FS, 0), 3 * FS, 1).astype(np.float32)
    A = np.repeat(np.repeat(a, 3 * FS, 0), 3 * FS, 1)
    out = im.copy()
    out[A == 1] = R[A == 1]
    out[A == 2] = im[A == 2] * 0.45
    p = os.path.join(DST, f'{name}.png')
    Image.fromarray(out.astype(np.uint8)).save(p, optimize=True)
    return p


if __name__ == '__main__':
    nrs = [int(x) for x in sys.argv[1:]] or sorted(SLEEVES)
    for n in nrs:
        print(frame_sleeve(n))
