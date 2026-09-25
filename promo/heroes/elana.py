"""
Elana, the Rocky Rebel — High-Res-Pixelart-Hero für das Promo-Motiv.

Maßstab: Szene nativ 960×540, Export ×2 → 1920×1080.
Hero-Frame nativ 224×224 px (Figur ≈ 190 px inkl. Iro).
Aufbau und Animation sind prozedural (Skelett + IK), Gesicht und Hände
handgepixelt. build(t) liefert einen Frame für die Animationsphase t ∈ [0, 1).
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from pixelkit import (Sprite, pillow_shade, shift, dilate, erode,  # noqa: E402
                      ascii_mask, place, stamp, rim_light, tube_shade,
                      ellipsoid_shade, ik)

W, H = 224, 224
GROUND = 216


# ─────────────────────────────── Vektorhilfen ───────────────────────────────

def rot(v, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


def add(p, v, k=1.0):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def norm(v):
    L = math.hypot(*v) or 1e-9
    return (v[0] / L, v[1] / L)


def perp(v):
    return (-v[1], v[0])


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ──────────────────────────────── Farbrampen ────────────────────────────────

def make_ramps(sp):
    R = {}
    R['hair'] = sp.add_ramp([(8, 38, 24), (12, 66, 30), (18, 98, 34), (28, 132, 38), (46, 168, 44),
                             (92, 204, 62), (168, 238, 110)], (6, 24, 16), mid=3)
    R['paint'] = sp.add_ramp([(92, 84, 122), (136, 130, 166), (182, 180, 208), (220, 220, 236),
                              (242, 242, 250), (255, 255, 255)], (46, 34, 62), mid=4)
    R['skin'] = sp.add_ramp([(112, 56, 70), (160, 92, 96), (206, 134, 122), (234, 170, 146),
                             (248, 202, 176), (255, 228, 206)], (70, 28, 40), mid=3)
    R['leather'] = sp.add_ramp([(10, 10, 16), (20, 20, 30), (34, 34, 48), (52, 52, 70), (78, 78, 104),
                                (118, 118, 150), (176, 176, 206)], (6, 6, 12), mid=2)
    R['denim'] = sp.add_ramp([(14, 10, 22), (24, 18, 36), (38, 30, 56), (56, 46, 80), (80, 68, 110),
                              (112, 98, 144)], (6, 4, 12), mid=2)
    R['tank'] = sp.add_ramp([(106, 100, 136), (156, 156, 188), (204, 206, 228), (234, 236, 248),
                             (255, 255, 255)], (48, 40, 70), mid=3)
    R['red'] = sp.add_ramp([(66, 0, 14), (108, 2, 18), (152, 10, 24), (196, 26, 34), (230, 54, 50),
                            (250, 104, 86), (255, 176, 156)], (38, 0, 10), mid=3)
    R['metal'] = sp.add_ramp([(54, 56, 72), (96, 100, 118), (146, 152, 168), (196, 202, 216),
                              (236, 240, 248), (255, 255, 255)], (24, 24, 34), mid=2)
    R['glove'] = sp.add_ramp([(36, 18, 8), (64, 32, 12), (98, 54, 22), (136, 84, 40), (180, 124, 70),
                              (222, 168, 110)], (22, 10, 4), mid=2)
    R['pink'] = sp.add_ramp([(96, 6, 100), (156, 20, 164), (212, 40, 214), (244, 98, 244),
                             (255, 166, 250), (255, 222, 255)], (58, 0, 62), mid=2)
    R['fret'] = sp.add_ramp([(18, 14, 16), (32, 26, 28), (52, 44, 44), (74, 64, 62)], (8, 6, 8), mid=1)
    R['check'] = sp.add_ramp([(160, 154, 152), (214, 208, 202), (244, 240, 234), (255, 255, 250)],
                             (8, 6, 8), mid=2)
    R['boot'] = sp.add_ramp([(10, 8, 12), (22, 18, 24), (38, 32, 42), (58, 50, 64), (88, 80, 96),
                             (132, 124, 142)], (6, 4, 8), mid=2)
    R['sole'] = sp.add_ramp([(34, 30, 38), (58, 54, 64), (86, 82, 94), (116, 112, 124)], (10, 8, 12), mid=1)
    R['lace'] = sp.add_ramp([(120, 4, 20), (190, 24, 34), (244, 80, 70)], (40, 0, 10), mid=1)
    R['mouth'] = sp.add_ramp([(14, 4, 16), (34, 10, 34), (62, 24, 58), (96, 50, 90)], (14, 4, 16), mid=1)
    R['eye'] = sp.add_ramp([(10, 8, 16), (34, 26, 52), (70, 50, 100), (255, 255, 255)], (10, 8, 16), mid=0)
    return R


# ─────────────────────────────────── Pose ───────────────────────────────────

def pose(t):
    """Skelett für Phase t. Füße bleiben stehen, der Rest federt/bangt."""
    ph = 2 * math.pi * t
    beat = 0.5 - 0.5 * math.cos(ph * 2)            # 0 → 1 → 0, zwei Beats pro Loop
    bang = 0.5 - 0.5 * math.cos(ph * 2 - 0.8)       # Kopf leicht verzögert
    j = {}
    j['beat'], j['bang'] = beat, bang
    j['sway'] = math.sin(ph * 2 - 1.6)              # Haare schwingen nach
    j['lag'] = math.sin(ph * 2 - 2.4)
    j['strum'] = math.sin(ph * 4)

    dy = 3.0 * beat                                  # Knie beugen
    dx = -1.0 * beat
    j['pelvis'] = (106 + dx, 131 + dy)
    j['hip_b'] = (95 + dx, 132 + dy)
    j['hip_f'] = (116 + dx, 130 + dy)
    j['ankle_b'] = (50, 201)
    j['ankle_f'] = (153, 200)
    j['knee_b'] = ik(j['hip_b'], j['ankle_b'], 45, 45, bend=1)
    j['knee_f'] = ik(j['hip_f'], j['ankle_f'], 44, 44, bend=-1)

    lean = 6.0 + 1.5 * beat                          # Rücklage, wippt mit dem Beat
    j['chest'] = (98 + dx - lean * 0.6, 98 + dy)
    j['neck'] = (96 + dx - lean, 79 + dy)
    j['sh_b'] = (80 + dx - lean, 85 + dy)
    j['sh_f'] = (114 + dx - lean, 80 + dy)
    j['head'] = (93 + dx - lean * 1.3 + 3.5 * bang, 60 + dy + 4.0 * bang)
    j['head_tilt'] = bang
    return j


# ───────────────────────────────── Zeichnen ─────────────────────────────────

def build(t=0.0):
    sp = Sprite(W, H)
    S = sp.S
    R = make_ramps(sp)
    j = pose(t)

    draw_hair_back(sp, S, R, j)
    draw_legs(sp, S, R, j)
    draw_torso(sp, S, R, j)
    draw_head(sp, S, R, j)
    draw_hair_front(sp, S, R, j)
    g = draw_guitar(sp, S, R, j)
    draw_fret_arm(sp, S, R, j, g)
    draw_strum_arm(sp, S, R, j, g)

    img = sp.render()
    img = rim_light(img, (255, 172, 70), 0.5, dx=1, dy=0, outline=sp.outline_mask)
    img = rim_light(img, (160, 130, 255), 0.22, dx=-1, dy=0, outline=sp.outline_mask)
    return img


# Iro: (Winkel°, Länge, Breite, Krümmung) — Winkel 0 = rechts, -90 = oben.
# Die Mähne weht nach hinten (links), weil Elana sich zurücklehnt.
SPIKES = [
    (-96, 46, 18, -6), (-74, 42, 17, -2), (-118, 48, 18, -8), (-52, 34, 15, 2),
    (-140, 50, 18, -9), (-160, 50, 17, -8), (-178, 46, 16, -6), (-30, 26, 13, 3),
    (164, 42, 15, -4), (146, 36, 14, -2), (-106, 30, 12, -5), (-84, 28, 12, -3),
    (-128, 34, 13, -6), (-150, 36, 13, -6), (-64, 24, 11, -1), (130, 28, 12, 0),
]


def draw_hair_back(sp, S, R, j):
    hx, hy = j['head']
    hc = (hx - 3, hy - 4)
    core = S.ellipse(hc[0], hc[1], 20, 18)
    sp.fill(core, R['hair'], 'hair_core', shade=ellipsoid_shade(S, hc[0], hc[1] - 4, 22, 20, gain=2.4) - 1)
    for i, (ang, ln, wd, bend) in enumerate(SPIKES):
        a = math.radians(ang)
        amp = 1.0 + 1.6 * max(0.0, -math.cos(a))     # hintere Strähnen schwingen stärker
        tip = (hc[0] + math.cos(a) * ln + j['sway'] * amp * 1.5,
               hc[1] + math.sin(a) * ln + j['lag'] * amp * 1.2)
        base = (hc[0] + math.cos(a) * 8, hc[1] + math.sin(a) * 8)
        m = S.spike(base, tip, wd, bend)
        mid = lerp(base, tip, 0.4)
        sh = tube_shade(S, [base, mid, tip], [wd * 0.5, wd * 0.33, 0.8], gain=3.0)
        front = i >= 10
        sp.fill(m, R['hair'], f'spike{i}', shade=sh - (0 if front else 1))
        # Glanzsträhne auf der Lichtseite
        v = norm(sub(tip, base))
        side = perp(v)
        if side[0] * -0.5 + side[1] * -0.75 < 0:
            side = (-side[0], -side[1])
        g0 = add(add(base, v, ln * 0.30), side, wd * 0.14)
        g1 = add(add(base, v, ln * 0.75), side, wd * 0.04 + bend * 0.3)
        sp.detail(S.capsule(g0, g1, 0.6) & m, R['hair'], 5 if front else 4)
        # dunkle Trennlinie auf der Schattenseite
        s0 = add(add(base, v, ln * 0.25), side, -wd * 0.22)
        s1 = add(add(base, v, ln * 0.65), side, -wd * 0.08)
        sp.detail(S.capsule(s0, s1, 0.55) & m, R['hair'], 1)


def draw_legs(sp, S, R, j):
    for side in ('b', 'f'):
        hip, knee, ank = j['hip_' + side], j['knee_' + side], j['ankle_' + side]
        pts = [hip, knee, ank]
        rad = [11.0, 7.4, 5.8]
        leg = S.chain(pts, rad)
        # Oberschenkel etwas voller
        leg |= S.capsule(lerp(hip, knee, 0.1), lerp(hip, knee, 0.55), 10.0, 8.5)
        sh = tube_shade(S, pts, rad, gain=3.4) - (1 if side == 'b' else 0)
        sp.fill(leg, R['denim'], 'leg_' + side, shade=sh)
        # Falten an Knie und Hüfte
        kv = norm(sub(ank, knee))
        kp = perp(kv)
        for k in (-4, 0, 4):
            c = add(knee, kv, k * 0.6 - 2)
            sp.detail(S.capsule(add(c, kp, -4), add(add(c, kp, 3), kv, 2), 0.5) & leg, R['denim'], 1)
        # Riss am Knie: Haut blitzt durch, Fäden quer
        tear = S.ellipse(knee[0], knee[1] - 1, 4.2, 2.6, angle=math.atan2(kv[1], kv[0]) + math.pi / 2)
        sp.detail(tear & leg, R['skin'], 3)
        sp.detail(S.ellipse(knee[0] - 1, knee[1] - 2, 2.0, 1.0) & tear, R['skin'], 4)
        for k in (-1.5, 1.5):
            c = add(knee, kv, k)
            sp.detail(S.capsule(add(c, kp, -3.5), add(c, kp, 3.5), 0.4) & tear, R['denim'], 3)
        draw_boot(sp, S, R, j, side, knee, ank)


def draw_boot(sp, S, R, j, side, knee, ank):
    ps = pillow_shade
    fwd = -1 if side == 'b' else 1                  # Fußspitze zeigt nach außen
    top = lerp(knee, ank, 0.45)
    shaft = S.chain([top, ank], [7.0, 6.4])
    toe = (ank[0] + fwd * 15, GROUND - 7)
    heel = (ank[0] - fwd * 6, GROUND - 6)
    foot = S.poly([add(ank, (-7, -2)), add(ank, (7, -2)), (toe[0] + fwd * 3, toe[1] - 1),
                   (toe[0] + fwd * 4, GROUND - 3), (heel[0] - fwd * 2, GROUND - 3), (heel[0] - fwd * 2, ank[1])])
    foot |= S.ellipse(toe[0], toe[1] + 0.5, 8.0, 5.6)
    boot = shaft | foot
    sp.fill(boot, R['boot'], 'boot_' + side, shade=ps(boot, sigma=2.4, gain=2.6))
    sole = S.rect(min(heel[0], toe[0]) - 8, GROUND - 5, max(heel[0], toe[0]) + 8, GROUND + 1) & dilate(boot, 3)
    sp.fill(sole, R['sole'], 'sole_' + side, shade=ps(sole, sigma=1.0, gain=1.4))
    for x in range(int(min(heel[0], toe[0])) - 6, int(max(heel[0], toe[0])) + 8, 3):
        sp.px([(x, GROUND)], R['sole'], 0)
    # Stulpe oben umgeschlagen
    cuff = S.capsule(add(top, (0, -1)), add(top, (0, 2)), 7.6)
    sp.fill(cuff, R['boot'], 'bootcuff_' + side, shade=ps(cuff, sigma=1.2, gain=2.0) + 1)
    # Schnürung
    v = norm(sub(ank, top))
    L = math.hypot(*sub(ank, top))
    for k in range(4, int(L) + 2, 3):
        c = add(top, v, k)
        sp.px([(int(c[0]) - 2, int(c[1])), (int(c[0]) - 1, int(c[1]) + 1), (int(c[0]), int(c[1]) + 1),
               (int(c[0]) + 1, int(c[1]))], R['lace'], 1)
    # Schnallen
    for k in (0.35, 0.7):
        c = lerp(top, ank, k)
        sp.fill(S.rect(c[0] - 7, c[1], c[0] + 7, c[1] + 1.5) & dilate(shaft, 1), R['leather'], 'strap_' + side, idx=1)
        sp.fill(S.rect(c[0] + 2 * fwd - 1.5, c[1] - 1, c[0] + 2 * fwd + 1.5, c[1] + 2.5), R['metal'], 'buckle_' + side, idx=3)
    # Stahlkappe
    sp.detail(S.ellipse(toe[0] + fwd, toe[1] - 2, 3.0, 1.3) & foot, R['boot'], 5)


def draw_torso(sp, S, R, j):
    ps = pillow_shade
    sb, sf = j['sh_b'], j['sh_f']
    hb, hf = add(j['hip_b'], (-2, 2)), add(j['hip_f'], (3, 1))
    waist_b = lerp(sb, hb, 0.62)
    waist_f = lerp(sf, hf, 0.62)
    waist_b = (waist_b[0] + 3, waist_b[1])
    waist_f = (waist_f[0] - 3, waist_f[1])
    torso = S.poly([add(sb, (-2, -2)), add(sf, (2, -3)), add(sf, (5, 4)), waist_f, hf, add(hf, (-2, 6)),
                    add(hb, (2, 7)), hb, waist_b, add(sb, (-6, 5))])
    cx, cy = j['chest']
    sp.fill(torso, R['leather'], 'torso', shade=ellipsoid_shade(S, cx + 2, cy + 6, 22, 34, gain=3.0))

    # Tanktop im offenen Reißverschluss
    n = j['neck']
    tank = S.poly([add(n, (-7, 3)), add(n, (8, 2)), add(lerp(sf, hf, 0.6), (-10, 0)),
                   add(lerp(hf, hb, 0.35), (0, 2)), add(lerp(hf, hb, 0.62), (0, 3)), add(lerp(sb, hb, 0.6), (9, 0))])
    sp.fill(tank, R['tank'], 'tank', shade=ellipsoid_shade(S, cx + 2, cy, 16, 26, gain=2.6))
    sc = add(j['chest'], (3, 4))
    for r_o, r_i, idx in ((8.5, 3.6, 1), (6.6, 2.8, 2), (3.8, 1.6, 3)):
        sp.detail(S.star(sc[0], sc[1], r_o, r_i) & tank, R['pink'], idx)
    # Falten im Top
    for a0, a1 in (((cx - 4, cy + 14), (cx + 6, cy + 18)), ((cx - 2, cy + 20), (cx + 8, cy + 23))):
        sp.detail(S.capsule(a0, a1, 0.5) & tank, R['tank'], 1)

    # Revers + hochgestellter Kragen
    col_b = S.poly([add(n, (-16, -5)), add(n, (-6, 1)), add(n, (-2, 20)), add(n, (-11, 8))])
    col_f = S.poly([add(n, (15, -7)), add(n, (8, 0)), add(n, (8, 22)), add(n, (14, 8))])
    for nm, m in (('col_b', col_b), ('col_f', col_f)):
        sp.fill(m, R['leather'], nm, shade=ps(m, sigma=1.2, gain=2.4) + 1)
    # Reißverschlusskanten
    zb = S.capsule(add(n, (-2, 20)), add(lerp(sb, hb, 0.6), (9, 0)), 0.6) & torso
    zf = S.capsule(add(n, (8, 22)), add(lerp(sf, hf, 0.6), (-10, 0)), 0.6) & torso
    sp.detail((zb | zf) & ~tank, R['metal'], 2)
    # Leder-Glanz
    for g0, g1 in ((add(sb, (-2, 8)), add(sb, (0, 26))), (add(sf, (3, 8)), add(sf, (0, 22)))):
        sp.detail(S.capsule(g0, g1, 0.7) & torso, R['leather'], 5)
    # Schulter-Nieten (Pyramiden)
    for base in (sb, sf):
        for k in range(3):
            c = add(base, (-6 + k * 5, -2 - (1 if k == 1 else 0)))
            stud = S.poly([(c[0] - 2.2, c[1] + 2), (c[0] + 2.2, c[1] + 2), (c[0], c[1] - 3.5)])
            sp.fill(stud, R['metal'], 'studs', shade=ps(stud, sigma=0.7, gain=2.0) + 1)

    # Nietengürtel + Kette
    bl, br = add(j['hip_b'], (-4, -4)), add(j['hip_f'], (6, -5))
    belt = S.capsule(bl, br, 3.0) & dilate(torso, 2)
    sp.fill(belt, R['boot'], 'belt', shade=ps(belt, sigma=1.0, gain=1.6))
    for k in range(1, 8):
        c = lerp(bl, br, k / 8)
        sp.fill(S.ellipse(c[0], c[1], 1.2, 1.2), R['metal'], 'beltstud', idx=3)
    chain = S.empty()
    for k in range(9):
        tt = k / 8
        c = (bl[0] + 6 + tt * 16, bl[1] + 5 + math.sin(tt * math.pi) * 9 + 2 * j['beat'] * math.sin(tt * math.pi))
        chain |= S.ellipse(c[0], c[1], 1.3, 1.0)
    sp.fill(chain, R['metal'], 'chain', shade=ps(chain, sigma=0.6, gain=1.6) + 1)


def draw_head(sp, S, R, j):
    ps = pillow_shade
    hx, hy = j['head']
    # Hals + Choker
    neck = S.capsule((hx + 3, hy + 12), j['neck'], 5.2)
    sp.fill(neck, R['paint'], 'neck', shade=ps(neck, sigma=1.4, gain=2.0) - 1)
    cy_ = hy + 17
    ch = S.capsule((hx - 3, cy_), (hx + 9, cy_ - 1), 1.8) & dilate(neck, 1)
    sp.fill(ch, R['leather'], 'choker', idx=1)
    for k in (-4, 0, 4):
        sp.fill(S.poly([(hx + 3 + k - 1.2, cy_), (hx + 3 + k + 1.2, cy_), (hx + 3 + k, cy_ + 3)]),
                R['metal'], 'chokerstud', idx=3)
    # Kopf: Schädel + Kiefer, 3/4 nach rechts, leicht in den Nacken gelegt
    skull = S.ellipse(hx, hy - 1, 13.0, 13.5, angle=-0.2)
    jaw = S.poly([(hx - 12, hy + 2), (hx + 13, hy - 3), (hx + 14, hy + 4), (hx + 12, hy + 10),
                  (hx + 7, hy + 15), (hx + 4, hy + 17), (hx - 1, hy + 15), (hx - 7, hy + 10)])
    face = skull | jaw | S.rect(hx + 13, hy + 2, hx + 15, hy + 5)   # Nase im Profil
    sp.fill(face, R['paint'], 'face', shade=ellipsoid_shade(S, hx - 2, hy - 3, 16, 17, gain=2.2, bias=0.2))
    ox, oy = int(round(hx)) - 14, int(round(hy)) - 14
    rows = FACE_OPEN if j['bang'] > 0.55 else FACE
    stamp(sp, rows, ox, oy, face_legend(R), clip=face)
    # Stern-Make-up um das rechte Auge (weich schattiert), Auge bleibt frei
    star = place(sp, ascii_mask(STAR), ox + STAR_AT[0], oy + STAR_AT[1]) & face
    eye_keep = place(sp, ascii_mask(rows, chars='kKigwWa'), ox, oy)
    st = star & ~eye_keep
    sp.detail(st, R['pink'], np.clip(2 + ps(star, sigma=0.9, gain=2.2), 1, 4))
    sp.shade_offset(st & ~shift(star, 1, 1), -1)


def face_legend(R):
    return {
        'k': (R['eye'], 0), 'K': (R['eye'], 1), 'i': (R['eye'], 2), 'g': (R['eye'], 3),
        'w': (R['tank'], 4), 'W': (R['tank'], 2), 'a': (R['pink'], 0),
        'h': (R['hair'], 1), 'm': (R['mouth'], 0), 'l': (R['mouth'], 1), 'L': (R['mouth'], 2),
        'M': (R['mouth'], 3), 'z': (R['tank'], 4), 'Z': (R['tank'], 2),
        's': (R['paint'], 2), 'S': (R['paint'], 1), 'x': (R['paint'], 5), 'o': (R['metal'], 4),
        'r': (R['red'], 2),
    }


# Gesicht 30×32, Ursprung = Kopfmitte − (14, 14). Legende siehe face_legend().
FACE = [
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "...hhhh............hhhh.......",
    "......hhhhh......hh....h......",
    "..............................",
    ".....kkkkkk......kkkkk........",
    "...kkwwwwKKkk...kwwKKkk.......",
    "....kwwwKKgKk...kwKgKk........",
    "....kwwWKKKKk....WKKKk........",
    ".....WWWKKKk......SSS.........",
    "......SSSSS...................",
    "..............................",
    ".........................SS...",
    "........................SS....",
    "..............................",
    "..............................",
    ".....................m........",
    "............mmmmmmmmm.........",
    ".............lLLMMLl..........",
    "..............llll............",
    ".................o............",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
]

# Beim Headbang: Mund offen (Schrei), Augen zusammengekniffen
FACE_OPEN = [
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "..............................",
    "....hhhh...........hhhh.......",
    "........hh.......hh...........",
    "..............................",
    "...kkkkkkkkk.....kkkkkkk......",
    "....kkkkKKkk......kkkKk.......",
    "......WwwK.........wWK........",
    "..............................",
    "..............................",
    "..............................",
    ".........................SS...",
    "........................SS....",
    "..............................",
    "............mmmmmmmmm.........",
    "...........mzzzzzzzzm.........",
    "...........mmmmmmmmmm.........",
    "...........mmmMMMMmm..........",
    "............mlLLLLlm..........",
    ".............llll.............",
    "................o.............",
    "..............................",
    "..............................",
    "..............................",
]

STAR_AT = (13, 8)     # Stern relativ zum Gesichtsursprung (um das rechte Auge)
STAR = [
    ".......#.......",
    ".......#.......",
    "......###......",
    "......###......",
    ".....#####.....",
    "###############",
    ".#############.",
    "..###########..",
    "...#########...",
    "...#########...",
    "..###########..",
    "..####...####..",
    ".####.....####.",
    ".###.......###.",
    ".##.........##.",
    ".#...........#.",
]


def draw_hair_front(sp, S, R, j):
    hx, hy = j['head']
    sw = j['sway']
    # Pony: fransig über der Stirn, eine lange Strähne fällt links an der Wange herab
    m = S.poly([(hx - 15, hy - 8), (hx - 8, hy - 16), (hx + 2, hy - 19), (hx + 12, hy - 16),
                (hx + 15, hy - 11), (hx + 11, hy - 10), (hx + 6, hy - 11), (hx + 1, hy - 9),
                (hx - 5, hy - 10), (hx - 10, hy - 7)])
    for base, tip, wd, bend in (((hx + 10, hy - 13), (hx + 19 + sw, hy - 8), 7, 2),
                                ((hx + 4, hy - 13), (hx + 8 + sw, hy - 7), 6, 1),
                                ((hx - 2, hy - 13), (hx + 1 + sw, hy - 6), 6, 0),
                                ((hx - 8, hy - 12), (hx - 9 + sw, hy - 4), 7, -1),
                                ((hx - 11, hy - 8), (hx - 16 + sw, hy + 19), 8, -3)):
        m = m | S.spike(base, tip, wd, bend)
    sp.fill(m, R['hair'], 'bangs', shade=pillow_shade(m, sigma=1.8, gain=3.0))
    for g0, g1 in (((hx - 10, hy - 8), (hx - 14, hy + 8)), ((hx - 4, hy - 14), (hx - 6, hy - 7)),
                   ((hx + 4, hy - 15), (hx + 11, hy - 10))):
        sp.detail(S.capsule(g0, g1, 0.6) & m, R['hair'], 5)


def draw_guitar(sp, S, R, j):
    ps = pillow_shade
    A = add(j['pelvis'], (14, -13))                   # Halsansatz am Korpus
    u = rot(norm((0.62, -1.0)), -5.0 * j['beat'])   # Hals reißt im Beat hoch
    w_ = (-u[0], -u[1])
    n_ = perp(u)                                     # zeigt nach rechts unten
    d1, d2 = rot(w_, 27), rot(w_, -27)
    T1, T2 = add(A, d1, 60), add(A, d2, 55)
    p1, p2 = perp(d1), perp(d2)
    N = add(A, w_, 27)
    vbody = S.poly([add(A, u, 7), add(A, n_, -12), add(T1, p1, 7.5), add(T1, p1, -7.0), N,
                    add(T2, p2, 7.0), add(T2, p2, -7.5), add(A, n_, 12)])
    sp.fill(vbody, R['red'], 'guitar', shade=ps(vbody, sigma=2.6, gain=3.2))
    # Lack-Glanz entlang der Flügel
    for dd, pp, sgn in ((d1, p1, 1), (d2, p2, -1)):
        g0 = add(add(A, dd, 14), pp, 3.5 * sgn)
        g1 = add(add(A, dd, 46), pp, 3.0 * sgn)
        sp.detail(S.capsule(g0, g1, 0.7) & vbody, R['red'], 5)
        sp.detail(S.capsule(lerp(g0, g1, 0.2), lerp(g0, g1, 0.45), 0.5) & vbody, R['red'], 6)
    binding = erode(vbody, 1) & ~erode(vbody, 2)
    lit = ps(vbody, sigma=2.4, gain=4.0)
    sp.detail(binding & (lit > 0), R['tank'], 4)
    sp.detail(binding & (lit < 0), R['red'], 1)
    # Schlagbrett
    pg = S.poly([add(A, n_, -6), add(A, n_, 6), add(add(A, w_, 20), n_, 5), add(add(A, w_, 20), n_, -5)]) & erode(vbody, 2)
    sp.fill(pg, R['tank'], 'pickguard', shade=ps(pg, sigma=1.0, gain=1.6) - 1)
    for k in (4.0, 13.0):
        c = add(A, w_, k)
        pu = S.capsule(add(c, n_, -4.6), add(c, n_, 4.6), 2.2)
        sp.fill(pu, R['fret'], 'pickups', shade=ps(pu, sigma=0.8, gain=1.4))
        for o in (-3, -1, 1, 3):
            q = add(c, n_, o)
            sp.px([(int(q[0]), int(q[1]))], R['metal'], 3)
    br = add(A, w_, 21)
    sp.fill(S.capsule(add(br, n_, -4.5), add(br, n_, 4.5), 1.3), R['metal'], 'bridge', idx=2)
    for k in (34, 41, 48):
        kc = add(add(A, d2, k), p2, -3)
        kn = S.ellipse(kc[0], kc[1], 1.8, 1.8)
        sp.fill(kn, R['metal'], 'knobs', shade=ps(kn, sigma=0.6, gain=1.6))
    # Saiten über dem Korpus
    for o in (-2.4, -0.8, 0.8, 2.4):
        sp.detail(S.capsule(add(add(A, u, 3), n_, o * 0.8), add(br, n_, o), 0.3) & (vbody | pg), R['metal'], 3)

    # Hals mit Karo-Griffbrett
    nut = add(A, u, 74)
    neck = S.capsule(add(A, u, 3), nut, 3.6)
    sp.fill(neck, R['fret'], 'neck', shade=ps(neck, sigma=1.0, gain=1.4))
    d, tt = S.seg_dist(add(A, u, 4), nut)
    along = (tt * 70).astype(int) // 4
    side = ((S.xx - A[0]) * n_[0] + (S.yy - A[1]) * n_[1]) > 0
    chk = neck & (d <= 2.9) & (((along % 2) == 0) ^ side)
    sp.detail(chk, R['check'], 2)
    for k in range(4, 71, 4):
        c = add(A, u, k)
        sp.detail(S.capsule(add(c, n_, -2.8), add(c, n_, 2.8), 0.35) & neck, R['metal'], 2)
    # Kopfplatte (spitz) mit Mechaniken
    hs_tip = add(nut, u, 24)
    head = S.poly([add(nut, n_, 4.2), add(nut, n_, -4.2), add(add(nut, u, 10), n_, -8.5),
                   hs_tip, add(add(nut, u, 15), n_, 8.0)])
    sp.fill(head, R['red'], 'headstock', shade=ps(head, sigma=1.4, gain=2.6))
    sp.detail(S.capsule(add(nut, u, 3), add(nut, u, 18), 0.6) & head, R['red'], 5)
    for k in (4, 9, 14):
        for pc in (add(add(nut, u, k), n_, -7.0 + k * 0.1), add(add(nut, u, k + 2), n_, 6.6 - k * 0.2)):
            peg = S.ellipse(pc[0], pc[1], 1.6, 1.6)
            sp.fill(peg, R['metal'], 'pegs', shade=ps(peg, sigma=0.5, gain=1.5) + 1)
    return {'A': A, 'u': u, 'w': w_, 'n': n_, 'nut': nut}


def draw_arm(sp, S, R, name, sh, hand, l1, l2, bend):
    ps = pillow_shade
    el = ik(sh, hand, l1, l2, bend=bend)
    pts = [sh, el, hand]
    rad = [7.0, 5.4, 4.2]
    arm = S.chain(pts, rad)
    tsh = tube_shade(S, pts, rad, gain=3.4)
    sp.fill(arm, R['leather'], 'arm_' + name, shade=tsh)
    # Ärmelfalten am Ellbogen
    v1, v2 = norm(sub(el, sh)), norm(sub(hand, el))
    for k in (-3, 0, 3):
        c = add(el, v2, k)
        sp.detail(S.capsule(add(c, perp(v2), -3), add(c, perp(v2), 2), 0.45) & arm, R['leather'], 1)
    sp.detail(S.capsule(add(sh, v1, 6), add(sh, v1, 18), 0.6) & arm & (tsh > 0), R['leather'], 5)
    # Nieten-Armband
    c0, c1 = add(hand, v2, -9), add(hand, v2, -4)
    cuff = S.capsule(c0, c1, 5.0)
    sp.fill(cuff, R['boot'], 'cuff_' + name, shade=ps(cuff, sigma=1.0, gain=2.0))
    for k in (0.2, 0.8):
        c = lerp(c0, c1, k)
        for o in (-3, 0, 3):
            q = add(c, perp(v2), o)
            sp.fill(S.ellipse(q[0], q[1], 1.1, 1.1), R['metal'], 'cuffstud_' + name, idx=3)
    return el, v2


def draw_fret_arm(sp, S, R, j, g):
    ps = pillow_shade
    A, u, n_ = g['A'], g['u'], g['n']
    hand = add(A, u, 50)
    draw_arm(sp, S, R, 'f', j['sh_f'], add(hand, n_, 3), 31, 30, bend=1)
    # Handfläche (fingerloser Handschuh) unter dem Hals, Finger krümmen sich übers Griffbrett
    pc = add(hand, n_, 4.5)
    palm = S.ellipse(pc[0], pc[1], 6.0, 4.4, angle=math.atan2(u[1], u[0]))
    sp.fill(palm, R['glove'], 'palm_f', shade=ps(palm, sigma=1.2, gain=2.4))
    sp.detail(S.capsule(add(pc, u, -4), add(pc, u, 4), 0.5) & palm & shift(palm, 0, 2), R['glove'], 4)
    for i, k in enumerate((-4.8, -1.6, 1.6, 4.8)):
        f0 = add(add(hand, u, k), n_, 2.5)
        f1 = add(add(hand, u, k * 0.8 + 0.8), n_, -3.4)
        fm = S.capsule(f0, f1, 1.5)
        sp.fill(fm, R['skin'], f'finger_f{i}', shade=ps(fm, sigma=0.6, gain=1.8))
        sp.fill(S.capsule(f0, lerp(f0, f1, 0.3), 1.6), R['glove'], f'fglove_f{i}', idx=2)
    for k in (-3.2, 0.0, 3.2):                         # Fugen zwischen den Fingern
        g0 = add(add(hand, u, k), n_, 1.5)
        g1 = add(add(hand, u, k * 0.8 + 0.8), n_, -4.2)
        sp.detail(S.capsule(g0, g1, 0.45) & sp.occupied(), R['skin'], 0)


def draw_strum_arm(sp, S, R, j, g):
    ps = pillow_shade
    A, w_, n_ = g['A'], g['w'], g['n']
    hand = add(add(A, w_, 9), n_, -2 + 4.0 * j['strum'])
    draw_arm(sp, S, R, 'b', j['sh_b'], hand, 33, 31, bend=1)
    fist = S.ellipse(hand[0] + 1, hand[1], 6.0, 5.2, angle=0.3)
    sp.fill(fist, R['glove'], 'fist', shade=ellipsoid_shade(S, hand[0], hand[1] - 1, 7, 6, gain=2.6))
    # Knöchel + Finger (Fingerspitzen aus dem Handschuh)
    for k in range(4):
        c = (hand[0] + 4.5 - k * 0.6, hand[1] - 3 + k * 2.2)
        sp.fill(S.ellipse(c[0], c[1], 1.8, 1.3), R['skin'], 'knuckle', idx=3 if k < 2 else 2)
    thumb = S.capsule((hand[0] - 1, hand[1] - 4), (hand[0] + 4, hand[1] - 6), 1.7)
    sp.fill(thumb, R['skin'], 'thumb_b', shade=ps(thumb, sigma=0.6, gain=1.6))
    pk = (hand[0] + 6.5, hand[1] - 6.5)
    pick = S.poly([(pk[0] - 2, pk[1] - 1), (pk[0] + 2.5, pk[1] - 2), (pk[0] + 1, pk[1] + 3)])
    sp.fill(pick, R['pink'], 'pick', idx=3)


# ────────────────────────────────── Export ──────────────────────────────────

FRAMES = 8          # Idle-Loop
FRAME_MS = 90
SCALE = 2           # Szene 960×540 → 1920×1080


def preview_bg():
    """Dunkelvioletter Hintergrund mit Bodenschatten (wie in der Referenz)."""
    bg = np.zeros((H, W, 4), np.uint8)
    bg[...] = (76, 44, 70, 255)
    yy, xx = np.mgrid[0:H, 0:W]
    shadow = ((xx - 104) / 70.0) ** 2 + ((yy - GROUND) / 7.0) ** 2 <= 1
    bg[shadow] = (56, 30, 54, 255)
    return bg


def export(out_dir):
    from PIL import Image
    from pixelkit import upscale, over, save_gif
    os.makedirs(out_dir, exist_ok=True)
    frames = [build(i / FRAMES) for i in range(FRAMES)]

    sheet = np.concatenate(frames, axis=1)
    Image.fromarray(sheet).save(os.path.join(out_dir, 'elana_idle_sheet.png'))
    Image.fromarray(upscale(sheet, SCALE)).save(os.path.join(out_dir, 'elana_idle_sheet_x2.png'))
    Image.fromarray(upscale(frames[0], SCALE)).save(os.path.join(out_dir, 'elana_x2.png'))

    bg = preview_bg()
    gif = [upscale(over(bg, f), SCALE) for f in frames]
    save_gif(gif, os.path.join(out_dir, 'elana_idle.gif'), FRAME_MS)
    return frames


if __name__ == '__main__':
    export(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'elana'))
    print('Elana exportiert.')
