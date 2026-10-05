# -*- coding: utf-8 -*-
"""Die Kampagnen-Figuren als RM2003-Laufsheets. Mitte vorn = Original-Sprite 1:1 (siehe figure.py).

Pro Figur: Palette des Originals (Buchstabe -> Hex, abzulesen mit `python3 native.py Name`), Flicken für die
Rückansicht (über dem Original) und eine handgezeichnete Seitenansicht in derselben Palette.
Sprite-Koordinaten: linke obere Ecke des Originals = (0,0).
"""
from figure import make, front_rows, sub, build, patched
from recipes import side_body
from rig import G, flip

CAST = {}

# Rumpf im Profil: 8 Spalten des Originals ohne den vorderen Mittelstreifen (Spalte 8); Spalte 10 doppelt
TORSO8 = [4, 5, 6, 7, 9, 10, 10, 11]

# ══════════════════════════════════════════════════════════════════════════════
#  TOBI — 16x24
# ══════════════════════════════════════════════════════════════════════════════
TOBI_PAL = {'a': '9e9c00', 'b': 'd3d433', 'c': 'f5f680', 'd': 'b2b400', 'e': 'ffffc5', 'f': 'd2a369',
            'g': 'acd6ff', 'h': '264763', 'i': 'f8bc77', 'j': 'f2ffff', 'k': '5198d4', 'l': 'fce7d6',
            'm': '311800', 'n': 'f5ce88', 'o': '020501', 'p': '212320', 'q': '3d3f3c', 'r': '373936',
            's': '161815', 't': '464845', 'u': '2c2d2b', 'v': '4f6c05', 'w': 'deff4a', 'x': 'b6ff00',
            'y': '4a4b49', 'z': 'd5a464', 'A': '171816', 'B': '0a0c08', 'C': '1c1d1b', 'D': '151614',
            'E': '10120f', 'F': '7a2a11', 'G': '5a2001', 'H': '2f0800', 'I': 'cc7238'}
F_TOBI = front_rows('Tobi', TOBI_PAL)
# Rückansicht (wird gespiegelt): Hinterkopf statt Gesicht (Zeilen 6-10), Rückseite statt Revers/Krawatte
# (Zeilen 11-19). '_' löscht ein Pixel, '.' lässt das Original stehen.
TOBI_BACK = [
    (G("""
acabcdbcdba
abdbabcdada
.bdbcdbcdb.
..abdbcdba.
..acbdbbca.
"""), 2, 6),
    (G("""
opopbbpopo
oqrpssprqo
quvpuupvuq
"""), 3, 11),
    (G("""
u
.
u
x
"""), 8, 15),
]
# Seitenansicht (nach rechts): Rumpf, Arm und Hose aus den Original-Pixeln (gleiche Zeilen für Bänder,
# Manschetten und Schuhe); neu gezeichnet ist nur das Profil-Gesicht (Vorlage in recipes.py).
TOBI_SIDE_BODY = side_body(
    F_TOBI, hair_rows=6, mapping={}, torso_rows=(12, 21), torso_cols=TORSO8,
    patches=[(G("""
p
"""), 6, 12), (G("""
u
"""), 7, 13)],
    shoes=(G("""
oFFGFo
HzIFIH
HHHHHH
"""), 5, 21))
TOBI_ARM = (sub(F_TOBI, 1, 4, 13, 18), 6, 13)         # naher Arm = linker Arm des Originals (3 Spalten)
CAST['Tobi'] = make('Tobi', TOBI_PAL, x0=4, legs_top=21, split_x=8, back=TOBI_BACK,
                    side=dict(body=TOBI_SIDE_BODY, arm=TOBI_ARM, legs_top=20, stride=3,
                              far_shade={'F': 'G', 'I': 'F', 'z': 'G'}))

# ══════════════════════════════════════════════════════════════════════════════
#  ETHAN — 16x26
# ══════════════════════════════════════════════════════════════════════════════
ETHAN_PAL = {'a': '020501', 'b': '161815', 'c': '282927', 'd': '414240', 'e': '20211f', 'f': '50524f',
             'g': '6a6c69', 'h': 'f8bc77', 'i': '311800', 'j': '293803', 'k': 'f5ce88', 'l': 'f2ffff',
             'm': '4f6c05', 'n': 'fce7d6', 'o': '3d3f3c', 'p': '373936', 'q': '212320', 'r': '464845',
             's': '2c2d2b', 't': 'deff4a', 'u': '4a4b49', 'v': 'b6ff00', 'w': '171816', 'x': 'd5a464',
             'y': '0a0c08', 'z': '1c1d1b', 'A': '151614', 'B': '10120f', 'C': '7a2a11', 'D': '5a2001',
             'E': '2f0800', 'F': 'cc7238'}
F_ETHAN = front_rows('Ethan', ETHAN_PAL)
# Rückansicht: Hinterkopf statt Gesicht (Zeilen 8-12, Ohren bleiben), weißer Nackenkragen, glatter Rücken
ETHAN_BACK = [
    (G("""
aacdbfdfdcaa
ihaadbfdachi
ihacdfbdcahi
.ihadcfdahi.
..ihacdahi..
"""), 2, 8),
    (G("""
llll
"""), 6, 14),
    (G("""
sqqqqs
oussuo
sussos
......
ssssss
"""), 5, 15),
]
ETHAN_MAP = {'a': 'a', 'b': 'c', 'c': 'd', 'd': 'b', 'f': 'x', 'i': 'h', 'n': 'k', 'm': 'i',
             'g': 'j', 'h': 'a', 'j': 'l', 'k': 'm', 'o': 'a', 'p': 'b'}
ETHAN_SIDE_BODY = side_body(
    F_ETHAN, hair_rows=9, mapping=ETHAN_MAP, skip=(3,), torso_rows=(14, 23), torso_cols=TORSO8,
    cap_patches=[(G("""
..aacdbfdfdcaa..
"""), 0, 8)],
    patches=[(G("""
q
"""), 6, 14), (G("""
q
"""), 7, 15)],
    shoes=(G("""
aCCDCa
ExFCFE
EEEEEE
"""), 5, 23))
ETHAN_ARM = (sub(F_ETHAN, 1, 4, 15, 21), 6, 15)
CAST['Ethan'] = make('Ethan', ETHAN_PAL, x0=4, legs_top=23, split_x=8, back=ETHAN_BACK,
                     side=dict(body=ETHAN_SIDE_BODY, arm=ETHAN_ARM, legs_top=22, stride=3,
                               far_shade={'C': 'D', 'F': 'C', 'x': 'D'}))

# ══════════════════════════════════════════════════════════════════════════════
#  MITHURU — 16x28 (größte Figur), Tasse in der linken Hand
# ══════════════════════════════════════════════════════════════════════════════
MITHURU_PAL = {'a': '684d00', 'b': '725500', 'c': '927000', 'd': '7b5d00', 'e': '8c6b05', 'f': '543d00',
               'g': 'f8bc77', 'h': 'acd6ff', 'i': 'f5cf88', 'j': 'e7f4f4', 'k': 'd4e0e0', 'l': 'f2ffff',
               'm': 'fde7d6', 'n': '311800', 'o': '282927', 'p': '3d3f3c', 'q': 'c5c7c4', 'r': '4f6c05',
               's': '5c5e5b', 't': 'f6f8f4', 'u': 'b6ff00', 'v': 'e9eae7', 'w': 'd3cecd', 'x': 'aeadb0',
               'y': 'f6ffe3', 'z': 'ed6564', 'A': 'df5a5a', 'B': 'ecf0e3', 'C': 'deff4a', 'D': 'd0cbca',
               'E': 'faffea', 'F': 'd5a464', 'G': '171816', 'H': 'cfc7c4', 'I': 'ebece9', 'J': 'a59e9b',
               'K': '0a0c08', 'L': 'b0b1aa', 'M': 'a9a8ab', 'N': '20211f', 'O': '838582', 'P': '414240'}
F_MITHURU = front_rows('Mithuru', MITHURU_PAL)
# Rückansicht (wird gespiegelt, die Tasse landet dabei auf der linken Bildseite): Hinterkopf statt Gesicht
# (Zeilen 6-12, auch die Stirn-Haut des Originals), Revers/Mittelstreifen weg
MITHURU_BACK = [
    (G("""
aaacabecadaecaa.
.acadaaeaedaba..
..adafeaeffaaea.
.abaaedcbedaea..
..aaaedcbedaa...
....aedcbdea....
.....adcbda.....
"""), 0, 6),
    (G("""
osppso
"""), 5, 15),
    (G("""
osppo
"""), 5, 16),
    (G("""
o
"""), 8, 17),
    (G("""
ss
"""), 7, 19),
]
MITHURU_MAP = {'a': 'a', 'b': 'd', 'c': 'c', 'd': 'f', 'f': 'F', 'i': 'g', 'n': 'i', 'm': 'n',
               'g': 'h', 'h': 'f', 'j': 'l', 'k': 'h', 'o': 'o', 'p': 'p'}
MITHURU_COLS = [4, 5, 6, 7, 9, 9, 10, 10]               # (Spalte 8 = Mittelstreifen, ab Spalte 11 die Tasse)
MITHURU_SIDE_BODY = side_body(
    F_MITHURU, hair_rows=8, mapping=MITHURU_MAP, torso_rows=(14, 26), torso_cols=MITHURU_COLS,
    patches=[(G("""
ss
"""), 10, 16)],
    shoes=(G("""
NOOOPN
NNNNNN
"""), 5, 26))
MITHURU_ARM = (sub(F_MITHURU, 1, 4, 15, 21), 6, 15)
MITHURU_ARM_CUP = (sub(F_MITHURU, 11, 16, 15, 21), 9, 15)       # linke Hand mit Tasse (nur in der Linksansicht nah)
_m_side = dict(legs_top=22, stride=3, shifts_front=[0, 1, 1, 2, 2, 2], shifts_back=[0, -1, -1, -2, -2, -2], far_shade={})
CAST['Mithuru'] = make('Mithuru', MITHURU_PAL, x0=4, legs_top=26, split_x=8, back=MITHURU_BACK,
                       side=dict(body=MITHURU_SIDE_BODY, arm=MITHURU_ARM, **_m_side),
                       left=dict(body=MITHURU_SIDE_BODY, arm=MITHURU_ARM_CUP, **_m_side))

# ══════════════════════════════════════════════════════════════════════════════
#  ELLIE — 16x24
# ══════════════════════════════════════════════════════════════════════════════
ELLIE_PAL = {'a': '202020', 'b': '2f2f2f', 'c': '2a2a2a', 'd': '383838', 'e': '242424', 'f': '413704',
             'g': 'f7bc97', 'h': 'c2cccc', 'i': '55331c', 'j': 'f5ce88', 'k': 'f2ffff', 'l': '6a4023',
             'm': 'fce7d6', 'n': '311800', 'o': 'ff9595', 'p': '020501', 'q': 'deff4a', 'r': '9eb535',
             's': '3d3f3c', 't': '000000', 'u': '313331', 'v': '212320', 'w': 'f7ce8c', 'x': 'ffe0c0',
             'y': '7a2b00', 'z': 'c64600'}
F_ELLIE = front_rows('Ellie', ELLIE_PAL)
ELLIE_BACK = [
    (G("""
..abecdcedceba..
.accecdbcdcecca.
.eebdcbdcbdcbee.
aaebcdbcdbcdbeaa
..aaacdbcdcaaa..
"""), 0, 6),
    (G("""
qq
"""), 7, 12),
]
ELLIE_MAP = {'a': 'a', 'b': 'b', 'c': 'd', 'd': 'c', 'f': 'j', 'i': 'g', 'n': 'm', 'm': 'n',
             'g': 'h', 'h': 'i', 'j': 'k', 'k': 'l', 'o': 'p', 'p': 'q'}
ELLIE_SIDE_BODY = side_body(
    F_ELLIE, hair_rows=6, mapping=ELLIE_MAP, torso_rows=(12, 22), torso_cols=TORSO8,
    patches=[(G("""
o
"""), 10, 9)],
    shoes=(G("""
pyzzyp
pppppp
"""), 5, 22))
ELLIE_ARM = (sub(F_ELLIE, 2, 5, 12, 18), 6, 12)
CAST['Ellie'] = make('Ellie', ELLIE_PAL, x0=4, legs_top=22, split_x=8, back=ELLIE_BACK,
                     side=dict(body=ELLIE_SIDE_BODY, arm=ELLIE_ARM, legs_top=20, stride=3,
                               shifts_front=[1, 1, 2, 2], shifts_back=[-1, -1, -2, -2], far_shade={}))

# ══════════════════════════════════════════════════════════════════════════════
#  WENDY — 16x23
# ══════════════════════════════════════════════════════════════════════════════
WENDY_PAL = {'a': '4e300c', 'b': '633c15', 'c': '784d19', 'd': '6c4316', 'e': 'b47320', 'f': '88551c',
             'g': 'f7bc97', 'h': '413704', 'i': '935e1f', 'j': '5a2001', 'k': 'f5ce88', 'l': 'f8feff',
             'm': '954018', 'n': 'fce7d6', 'o': 'ff9595', 'p': '311800', 'q': '020501', 'r': 'deff4a',
             's': '9eb535', 't': '3d3f3c', 'u': '212320', 'v': 'ffe0c0', 'w': 'f7ce8c'}
F_WENDY = front_rows('Wendy', WENDY_PAL)
WENDY_BACK = [
    (G("""
bd
"""), 6, 5),
    (G("""
..afaacbdcaafa..
..aibcdecdcbia..
..aebcdcecdbea..
..aidcedcdcdia..
..adicdecdcida..
"""), 0, 6),
    (G("""
rr
"""), 7, 12),
    (G("""
qq......qq
qq......qq
"""), 3, 15),
]
WENDY_MAP = {'a': 'a', 'b': 'c', 'c': 'i', 'd': 'b', 'f': 'k', 'i': 'g', 'n': 'n', 'm': 'p',
             'g': 'i', 'h': 'j', 'j': 'l', 'k': 'm', 'o': 'q', 'p': 's'}
WENDY_SIDE_BODY = side_body(
    F_WENDY, hair_rows=6, mapping=WENDY_MAP, torso_rows=(12, 19), torso_cols=TORSO8,
    patches=[(G("""
bd
"""), 6, 5), (G("""
o
"""), 10, 9), (G("""
p
p
"""), 4, 15), (G("""
ppp
ppp
"""), 8, 15)],
    extra=[(G("""
pvwwvp
pvwwvp
"""), 5, 19)],
    shoes=(G("""
qtuutq
qqqqqq
"""), 5, 21))
WENDY_ARM = (sub(F_WENDY, 2, 6, 12, 18), 5, 12)
CAST['Wendy'] = make('Wendy', WENDY_PAL, x0=4, legs_top=19, split_x=8, back=WENDY_BACK,
                     side=dict(body=WENDY_SIDE_BODY, arm=WENDY_ARM, legs_top=19, stride=3,
                               shifts_front=[1, 2, 2, 2], shifts_back=[-1, -2, -2, -2], far_shade={}))

# ══════════════════════════════════════════════════════════════════════════════
#  GEORGIE — 17x23, Schleife auf ihrer rechten Kopfseite (im Original links im Bild)
# ══════════════════════════════════════════════════════════════════════════════
GEORGIE_PAL = {'a': '000000', 'b': '525252', 'c': '414141', 'd': '292929', 'e': '202020', 'f': '2a2d4e',
               'g': '13152e', 'h': '212443', 'i': '0b0203', 'j': 'f6ffff', 'k': '160000', 'l': 'f1c298',
               'm': '4d0e05', 'n': 'f5c9ae', 'o': '794f36', 'p': '976b52', 'q': 'ff9899', 'r': '232227',
               's': 'edad7f', 't': 'fbfbfb', 'u': '7d0715', 'v': '960c1c', 'w': '610003', 'x': '3b0000',
               'y': '240105', 'z': '2f1600', 'A': '831522', 'B': '4f080c', 'C': '360206', 'D': '0e0000',
               'E': '42312a', 'F': '331f1e'}
F_GEORGIE = front_rows('Georgie', GEORGIE_PAL)
# Rückansicht (wird gespiegelt, die Schleife wandert dabei auf die andere Bildseite): Hinterkopf statt Gesicht,
# weißer Kragen statt Schleife/Revers
GEORGIE_BACK = [
    (G("""
dcbdcb
cbdcbd
dcbdcb
dcbbcd
"""), 6, 8),
    (G("""
tttttt
"""), 6, 12),
    (G("""
vuuv
"""), 7, 13),
    (G("""
uu
"""), 8, 14),
]
# Profil: Kopf ohne Schleife (sie kommt als Seitenschleife nur in der Rechtsansicht wieder dazu); '_' löscht
NOBOW = [
    (G("""
_
"""), 3, 4),
    (G("""
__cd
"""), 2, 5),
    (G("""
___cdb
"""), 1, 6),
]
F_GEORGIE_NOBOW = patched(F_GEORGIE, NOBOW)
GEORGIE_MAP = {'a': 'a', 'b': 'c', 'c': 'b', 'd': 'd', 'f': 's', 'i': 'l', 'n': 'n', 'm': 'z',
               'g': 'j', 'h': 'k', 'j': 'j', 'k': 'm', 'o': 'a', 'p': 'r'}
GEORGIE_SIDE_ARGS = dict(
    hair_rows=7, mapping=GEORGIE_MAP, head_dx=1, torso_rows=(13, 20), torso_cols=[5, 6, 7, 7, 10, 11, 11, 12],
    torso_x=5,
    extra=[(G("""
zssssz
"""), 6, 20)],
    shoes=(G("""
DEFFED
.DDDD.
"""), 6, 21))
GEORGIE_BOW = [''.join(ch if ch in 'fgh' else '.' for ch in r[:7]) for r in F_GEORGIE[4:10]]
# Die Haarflügel des Originals (Zeilen 5-6) stünden im Profil als Zipfel 3 px vor dem Gesicht: kappen
GEORGIE_TRIM = [
    (G("""
a_
"""), 15, 5),
    (G("""
a__
"""), 15, 6),
]
GEORGIE_SIDE_BODY = patched(side_body(F_GEORGIE_NOBOW, **GEORGIE_SIDE_ARGS), GEORGIE_TRIM)
GEORGIE_SIDE_BOW = build(18, 23, [(GEORGIE_SIDE_BODY, 0, 0), (GEORGIE_BOW, 4, 4)])
GEORGIE_ARM = (sub(F_GEORGIE, 3, 6, 14, 18), 7, 14)
_g_side = dict(arm=GEORGIE_ARM, legs_top=20, stride=3, shifts_front=[1, 2, 2], shifts_back=[-1, -2, -2], far_shade={})
CAST['Georgie'] = make('Georgie', GEORGIE_PAL, x0=3, legs_top=20, split_x=9, back=GEORGIE_BACK,
                       side=dict(body=GEORGIE_SIDE_BOW, **_g_side),
                       left=dict(body=GEORGIE_SIDE_BODY, **_g_side))


# Crum hat eine eigene Datei (breiteres Format) und wird hier eingehängt.
import crum  # noqa: E402
CAST.update(crum.CAST)
