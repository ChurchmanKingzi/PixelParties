"""
Elana, the Rocky Rebel — High-Res-Pixelart-Hero für das Promo-Motiv.

Native Auflösung: 128×128 px pro Frame (Szene später 640×360, ×3 → 1920×1080).
Aufbau und Animation sind rein prozedural; build(t) liefert einen Frame für
die Animationsphase t ∈ [0, 1).
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from pixelkit import (Sprite, pillow_shade, sphere_shade, shift, dilate,  # noqa: E402
                      ascii_mask, place, stamp, erode, rim_light)

W, H = 128, 128


def rot(v, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


def add(p, v, k=1.0):
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def norm(v):
    L = math.hypot(*v) or 1e-9
    return (v[0] / L, v[1] / L)


def perp(v):
    return (-v[1], v[0])


def make_ramps(sp):
    R = {}
    R['hair'] = sp.add_ramp([(10, 48, 20), (18, 84, 22), (26, 124, 28), (40, 164, 38),
                             (86, 204, 58), (170, 240, 110)], (6, 28, 12), mid=3)
    R['skin'] = sp.add_ramp([(150, 92, 110), (208, 150, 150), (238, 196, 180),
                             (252, 226, 208), (255, 244, 232)], (74, 30, 50), mid=3)
    R['leather'] = sp.add_ramp([(12, 12, 18), (24, 24, 34), (40, 40, 54), (64, 64, 84),
                                (104, 104, 128), (160, 160, 184)], (6, 6, 10), mid=2)
    R['denim'] = sp.add_ramp([(16, 12, 24), (28, 22, 40), (44, 36, 62), (66, 56, 90)],
                             (6, 4, 10), mid=1)
    R['tank'] = sp.add_ramp([(120, 116, 150), (178, 180, 204), (222, 226, 240), (250, 252, 255)],
                            (48, 44, 70), mid=2)
    R['red'] = sp.add_ramp([(88, 0, 16), (140, 4, 18), (196, 24, 32), (232, 52, 48),
                            (252, 110, 90), (255, 190, 170)], (48, 0, 12), mid=2)
    R['metal'] = sp.add_ramp([(70, 72, 86), (128, 134, 148), (186, 192, 204), (236, 240, 246),
                              (255, 255, 255)], (30, 30, 40), mid=2)
    R['glove'] = sp.add_ramp([(52, 26, 10), (88, 44, 12), (132, 76, 30), (184, 124, 64),
                              (236, 180, 112)], (30, 14, 4), mid=2)
    R['pink'] = sp.add_ramp([(120, 10, 120), (196, 28, 200), (236, 70, 236), (255, 140, 250),
                             (255, 214, 255)], (70, 0, 70), mid=2)
    R['fret'] = sp.add_ramp([(20, 16, 18), (36, 30, 30), (58, 50, 48)], (10, 6, 8), mid=1)
    R['check'] = sp.add_ramp([(170, 164, 160), (222, 216, 208), (250, 246, 240)], (10, 6, 8), mid=1)
    R['boot'] = sp.add_ramp([(12, 10, 14), (26, 22, 28), (44, 38, 46), (72, 64, 74), (116, 108, 118)],
                            (6, 4, 8), mid=2)
    R['sole'] = sp.add_ramp([(40, 36, 44), (70, 64, 74), (100, 94, 104)], (10, 8, 12), mid=1)
    R['lace'] = sp.add_ramp([(140, 4, 18), (210, 30, 34), (250, 90, 80)], (48, 0, 12), mid=1)
    R['mouth'] = sp.add_ramp([(20, 6, 20), (44, 14, 40), (80, 30, 70)], (20, 6, 20), mid=1)
    R['eye'] = sp.add_ramp([(14, 10, 20), (40, 30, 60), (255, 255, 255)], (14, 10, 20), mid=0)
    return R


# Stern-Make-up (13×13), Mittelpunkt (6, 6) = Auge
STAR = [
    "......#......",
    "......#......",
    ".....###.....",
    ".....###.....",
    "#############",
    ".###########.",
    "..#########..",
    "...#######...",
    "...#######...",
    "..#########..",
    "..###...###..",
    ".##.......##.",
    ".#.........#.",
]

# Auge, Braue, Nase und Mund — gleiche Verankerung wie STAR
EYE = [
    ".............",
    ".............",
    "....hhhhh....",
    "...h.....hh..",
    "..........k..",
    "..kkkkkkkk...",
    "..kwwwKgKk...",
    "...WwwKKKk...",
    "....aaaaa....",
    ".............",
    "..........nn.",
    "...........n.",
    ".............",
    ".........m...",
    "..mmmmmmm....",
    "...lLLLl.....",
    "......i......",
]


def build(t=0.0):
    """Ein Frame der Idle-Animation (Headbang + Anschlag), t ∈ [0, 1)."""
    sp = Sprite(W, H)
    S = sp.S
    R = make_ramps(sp)
    ps = pillow_shade

    ph = 2 * math.pi * t
    bob = round(1.0 - 1.0 * math.cos(ph * 2))          # Körper federt 2× pro Loop
    hbob = round(1.5 - 1.5 * math.cos(ph * 2 - 0.7))    # Kopf nickt leicht verzögert
    sway = math.sin(ph * 2 - 1.4)                       # Haare schwingen nach
    strum = math.sin(ph * 4)                            # Schlaghand
    lag = 1.6 * math.sin(ph * 2 - 2.2)                  # Haarspitzen hängen hinterher

    hip_y = 88 + bob
    sh_y = 63 + bob
    hx, hy = 57, 44 + hbob          # Kopfmitte

    # ── Haare hinten: einzelne Stachel-Strähnen ──────────────────
    hc = (hx - 1, hy - 1)
    spikes = [  # (Winkel°, Länge, Breite, Krümmung) — von hinten nach vorn
        (-100, 36, 13, 1), (-78, 35, 13, 3), (-122, 34, 13, -2), (-56, 32, 13, 4),
        (-143, 32, 13, -3), (-35, 28, 12, 5), (-162, 29, 12, -4), (-14, 23, 11, 5),
        (178, 27, 12, -3), (8, 19, 10, 4), (160, 28, 12, -2), (142, 26, 11, -1),
        (124, 22, 10, 0),
    ]
    blob = S.ellipse(hc[0], hc[1] - 2, 17, 16)
    sp.fill(blob, R['hair'], 'hair_core', shade=ps(blob, sigma=2.5, gain=2.0) - 1)
    for i, (ang, ln, wd, bend) in enumerate(spikes):
        a = math.radians(ang)
        amp = 1.2 if -150 < ang < -30 else 2.2
        tip = (hc[0] + math.cos(a) * ln + sway * amp, hc[1] + math.sin(a) * ln - lag * (0.5 - math.sin(a) * 0.5))
        base = (hc[0] + math.cos(a) * 6, hc[1] + math.sin(a) * 6)
        m = S.spike(base, tip, wd, bend)
        sp.fill(m, R['hair'], f'spike{i}', shade=ps(m, sigma=1.1, gain=2.6) - (1 if i < 6 else 0))
        # Glanzlinie auf der Lichtseite der Strähne
        v = norm((tip[0] - base[0], tip[1] - base[1]))
        side = perp(v)
        if side[0] * -0.55 + side[1] * -0.7 < 0:
            side = (-side[0], -side[1])
        g0 = add(add(base, v, ln * 0.35), side, wd * 0.12)
        g1 = add(add(base, v, ln * 0.72), side, wd * 0.05 + bend * 0.25)
        sp.detail(S.capsule(g0, g1, 0.55) & m, R['hair'], 4 + (1 if i < 3 else 0))

    # ── Beine ─────────────────────────────────────────────────────
    lk, rk = (42, 102), (68, 101)
    leg_l = S.chain([(50, hip_y - 1), lk, (37, 111)], [5.4, 4.3, 4.0])
    leg_r = S.chain([(62, hip_y - 1), rk, (73, 111)], [5.4, 4.3, 4.0])
    for nm, m in (('leg_r', leg_r), ('leg_l', leg_l)):
        sp.fill(m, R['denim'], nm, shade=ps(m, sigma=1.2, gain=1.8))
    for kx, ky in (lk, rk):
        tear = S.ellipse(kx + 0.5, ky, 2.4, 1.3)
        sp.detail(tear & (leg_l | leg_r), R['skin'], 2)
        sp.px([(kx - 1, ky - 1), (kx + 1, ky + 1), (kx + 2, ky - 1)], R['denim'], 0)

    # ── Stiefel ───────────────────────────────────────────────────
    boot_l = S.poly([(32, 106), (42, 106), (42, 119), (26, 119), (25, 116), (31, 113)])
    boot_r = S.poly([(68, 106), (78, 106), (79, 113), (85, 116), (84, 119), (68, 119)])
    sole_l = S.poly([(24, 118), (43, 118), (43, 122), (25, 122)])
    sole_r = S.poly([(67, 118), (86, 118), (85, 122), (67, 122)])
    for nm, b, so in (('boot_l', boot_l, sole_l), ('boot_r', boot_r, sole_r)):
        sp.fill(b, R['boot'], nm, shade=ps(b, sigma=1.2, gain=2.0))
        sp.fill(so, R['sole'], nm + 's', shade=ps(so, sigma=0.7, gain=1.0))
    for bx in (36, 72):
        for i, yy in enumerate(range(107, 116, 2)):
            sp.px([(bx, yy), (bx + 1, yy), (bx + (i % 2) * 1, yy + 1)], R['lace'], 1)
        sp.fill(S.rect(bx - 4, 108, bx + 6, 109), R['metal'], 'buckle', idx=1)
    sp.px([(28, 115), (29, 114), (30, 114), (82, 115), (81, 114), (80, 114)], R['boot'], 4)
    for x in range(26, 43, 3):
        sp.px([(x, 121)], R['sole'], 0)
    for x in range(69, 86, 3):
        sp.px([(x, 121)], R['sole'], 0)

    # ── Torso / Lederjacke ────────────────────────────────────────
    torso = S.poly([(43, sh_y), (71, sh_y), (68, hip_y - 1), (47, hip_y - 1)])
    torso |= S.ellipse(44, sh_y + 3, 5, 4) | S.ellipse(70, sh_y + 3, 5, 4)
    sp.fill(torso, R['leather'], 'torso', shade=ps(torso, sigma=2.2, gain=2.4))
    for g0, g1 in (((45, sh_y + 6), (47, sh_y + 17)), ((66, sh_y + 5), (64, sh_y + 14))):
        sp.detail(S.capsule(g0, g1, 0.6) & torso, R['leather'], 4)
    tank = S.poly([(52, sh_y), (62, sh_y), (60, hip_y - 3), (55, hip_y - 3)])
    sp.fill(tank, R['tank'], 'tank', shade=ps(tank, sigma=1.2, gain=1.4))
    sp.detail(S.star(57.5, sh_y + 11, 4.6, 2.0) & tank, R['pink'], 1)
    sp.detail(S.star(57.3, sh_y + 10.7, 3.0, 1.3) & tank, R['pink'], 2)
    # hochgestellter Kragen + Revers
    col_l = S.poly([(44, sh_y - 5), (52, sh_y - 1), (55, sh_y + 13), (48, sh_y + 3)])
    col_r = S.poly([(70, sh_y - 5), (62, sh_y - 1), (60, sh_y + 13), (66, sh_y + 3)])
    for nm, m in (('col_l', col_l), ('col_r', col_r)):
        sp.fill(m, R['leather'], nm, shade=ps(m, sigma=0.9, gain=1.8) + 1)
    # Reißverschluss-Kante
    sp.detail(S.capsule((52.5, sh_y + 13), (54.5, hip_y - 3), 0.5) & torso & ~tank, R['metal'], 1)
    # Schulter-Nieten
    for sx, sy in ((39, sh_y + 2), (43, sh_y - 0.5), (71, sh_y - 0.5), (75, sh_y + 2)):
        stud = S.poly([(sx - 1.6, sy + 1.6), (sx + 1.6, sy + 1.6), (sx, sy - 3.0)])
        sp.fill(stud, R['metal'], 'studs', shade=ps(stud, sigma=0.6, gain=1.5) + 1)
    belt = S.rect(47, hip_y - 4, 68, hip_y - 1)
    sp.fill(belt, R['boot'], 'belt', idx=1)
    for x in range(48, 68, 3):
        sp.px([(x, hip_y - 3)], R['metal'], 3)

    # ── Hals + Kopf ───────────────────────────────────────────────
    neck = S.capsule((57, hy + 9), (57, sh_y + 1), 3.2)
    sp.fill(neck, R['skin'], 'neck', idx=1)
    choker = S.rect(53, hy + 13, 62, hy + 15) & dilate(neck, 1)
    sp.fill(choker, R['leather'], 'choker', idx=1)
    sp.px([(55, hy + 13), (58, hy + 13), (61, hy + 13)], R['metal'], 3)

    face = S.ellipse(hx, hy - 1, 12.0, 12.0)
    face |= S.poly([(46.5, hy + 1), (68.5, hy - 1), (68, hy + 5), (65, hy + 10), (61, hy + 13),
                    (56, hy + 12), (49, hy + 7)])
    face |= S.rect(hx + 11, hy + 4, hx + 13, hy + 6)          # Nasenspitze im Profil
    sp.fill(face, R['skin'], 'face', shade=sphere_shade(S, hx - 1, hy - 4, 17, gain=1.6, bias=0.4))

    # Auge mit pinkem Stern-Make-up (handgepixelt)
    ex, ey = hx + 5, hy + 1           # Augenmitte
    ox, oy = ex - 6, ey - 6
    star = place(sp, ascii_mask(STAR), ox, oy) & face
    st_sh = pillow_shade(star, sigma=0.7, gain=2.0)
    sp.detail(star, R['pink'], np.clip(2 + st_sh, 1, 4))
    edge = star & ~(shift(star, 1, 0) & shift(star, -1, 0) & shift(star, 0, 1) & shift(star, 0, -1))
    sp.shade_offset(edge & ~shift(star, 1, 1), -1)
    stamp(sp, EYE, ox, oy, {
        'k': (R['eye'], 0), 'K': (R['eye'], 1), 'g': (R['eye'], 2),
        'w': (R['tank'], 3), 'W': (R['tank'], 2), 'a': (R['pink'], 0),
        'h': (R['hair'], 0), 'm': (R['mouth'], 0), 'l': (R['mouth'], 1), 'L': (R['mouth'], 2),
        'z': (R['tank'], 3), 'i': (R['metal'], 4), 'n': (R['skin'], 1), 'x': (R['skin'], 4),
    }, clip=face)

    # ── Pony (verdeckt das linke Auge) ───────────────────────────
    bang = S.poly([(43, hy - 12), (63, hy - 15), (64, hy - 9), (57, hy - 6),
                   (53, hy - 1), (51, hy + 6), (47, hy + 12), (44, hy + 7), (42, hy + 15), (40, hy)])
    bang |= S.spike((62, hy - 11), (68 + sway, hy - 4), 6, 1)
    bang |= S.spike((58, hy - 10), (60 + sway, hy - 1), 6, 1)
    bang |= S.spike((51, hy - 8), (51 + sway, hy + 9), 7, -1)
    bang |= S.spike((45, hy - 6), (41 + sway, hy + 17), 8, -2)
    sp.fill(bang, R['hair'], 'bangs', shade=ps(bang, sigma=1.3, gain=2.6))
    for g0, g1 in (((46, hy - 9), (44, hy + 6)), ((52, hy - 10), (51, hy + 2)), ((58, hy - 12), (61, hy - 6))):
        sp.detail(S.capsule(g0, g1, 0.55) & bang, R['hair'], 5)

    # ── Gitarre (Flying V) ────────────────────────────────────────
    A = (64, 82 + bob)
    u = norm((1.0, -0.95))
    w_ = (-u[0], -u[1])
    n_ = perp(u)                      # zeigt nach rechts unten
    d1, d2 = rot(w_, 28), rot(w_, -28)
    T1, T2 = add(A, d1, 38), add(A, d2, 35)
    p1, p2 = perp(d1), perp(d2)
    N = add(A, w_, 17)
    vbody = S.poly([add(A, u, 5), add(A, n_, -7.5), add(T1, p1, 5.0), add(T1, p1, -5.0), N,
                    add(T2, p2, 5.0), add(T2, p2, -5.0), add(A, n_, 7.5)])
    sp.fill(vbody, R['red'], 'guitar', shade=ps(vbody, sigma=1.8, gain=2.6))
    # weiße Einfassung (Binding) als zweite Kante innen
    binding = erode(vbody, 1) & ~erode(vbody, 2)
    lit = ps(vbody, sigma=2.0, gain=4.0)
    sp.detail(binding & (lit > 0), R['tank'], 3)
    sp.detail(binding & (lit < 0), R['red'], 1)
    # Schlagbrett
    pg = S.poly([add(A, n_, -4), add(A, n_, 4), add(add(A, w_, 12), n_, 3), add(add(A, w_, 12), n_, -3)]) & vbody
    sp.fill(pg, R['tank'], 'pickguard', shade=ps(pg, sigma=0.8, gain=1.2))
    for k in (2.5, 8.5):
        c = add(A, w_, k)
        pu = S.capsule(add(c, n_, -3.0), add(c, n_, 3.0), 1.4)
        sp.fill(pu, R['fret'], 'pickups', idx=1)
        sp.detail(S.capsule(add(c, n_, -2.4), add(c, n_, 2.4), 0.35) & pu, R['metal'], 1)
    br = add(A, w_, 14)
    sp.fill(S.capsule(add(br, n_, -3), add(br, n_, 3), 0.9), R['metal'], 'bridge', idx=2)
    for k in (20, 25, 30):   # Regler auf dem unteren Flügel
        kc = add(add(A, d2, k), p2, -1.8)
        kn = S.ellipse(kc[0], kc[1], 1.1, 1.1)
        sp.fill(kn, R['metal'], 'knobs', idx=1)
        sp.px([(int(kc[0]) - 1, int(kc[1]) - 1)], R['metal'], 3)
    # Saiten über dem Korpus
    for o in (-1.2, 1.2):
        sp.detail(S.capsule(add(A, n_, o), add(br, n_, o), 0.3) & (pg | vbody), R['metal'], 3)

    # Hals mit Karo-Griffbrett
    nut = add(A, u, 50)
    neck_m = S.capsule(add(A, u, 2), nut, 2.7)
    sp.fill(neck_m, R['fret'], 'neck', shade=ps(neck_m, sigma=0.8, gain=1.2))
    d, tt = S.seg_dist(add(A, u, 3), nut)
    along = (tt * 47).astype(int) // 3
    side = ((S.xx - A[0]) * n_[0] + (S.yy - A[1]) * n_[1]) > 0
    chk = neck_m & (d <= 2.0) & (((along % 2) == 0) ^ side)
    sp.detail(chk, R['check'], 1)
    # Kopfplatte
    hs_tip = add(nut, u, 16)
    head_m = S.poly([add(nut, n_, 3.2), add(nut, n_, -3.2), add(add(nut, u, 7), n_, -6.0),
                     hs_tip, add(add(nut, u, 11), n_, 5.5)])
    sp.fill(head_m, R['red'], 'headstock', shade=ps(head_m, sigma=1.0, gain=2.0))
    for k in (3, 6, 9):
        pc = add(add(nut, u, k), n_, -5.0)
        sp.fill(S.ellipse(pc[0], pc[1], 1.1, 1.1), R['metal'], 'pegs', idx=3)
        pc2 = add(add(nut, u, k + 1), n_, 4.6)
        sp.fill(S.ellipse(pc2[0], pc2[1], 1.1, 1.1), R['metal'], 'pegs', idx=3)

    # ── Greifarm (rechts im Bild) ─────────────────────────────────
    fret_hand = add(A, u, 27)
    elbow_r = (79, 77 + bob)
    arm_r = S.chain([(69, sh_y + 4), elbow_r, fret_hand], [5.0, 4.0, 3.2])
    sp.fill(arm_r, R['leather'], 'arm_r', shade=ps(arm_r, sigma=1.4, gain=2.2))
    fd = norm((fret_hand[0] - elbow_r[0], fret_hand[1] - elbow_r[1]))
    sp.fill(S.capsule(add(elbow_r, fd, 7), add(elbow_r, fd, 9), 3.7), R['boot'], 'cuff_r', idx=1)
    hand_r = S.ellipse(fret_hand[0] + 0.5, fret_hand[1] + 0.5, 3.6, 3.2, angle=-0.8)
    sp.fill(hand_r, R['glove'], 'hand_r', shade=ps(hand_r, sigma=0.9, gain=1.8))
    for k in (-2.4, 0, 2.4):
        fp = add(add(fret_hand, u, k), n_, -3.2)
        sp.fill(S.ellipse(fp[0], fp[1], 1.2, 1.2), R['skin'], 'fingers_r', idx=2)

    # ── Schlagarm (links im Bild) ─────────────────────────────────
    strum_hand = add(add(A, w_, 5.5), n_, -1 + 2.4 * strum)
    elbow_l = (38, 80 + bob)
    arm_l = S.chain([(45, sh_y + 4), elbow_l, strum_hand], [5.0, 4.2, 3.4])
    sp.fill(arm_l, R['leather'], 'arm_l', shade=ps(arm_l, sigma=1.4, gain=2.2))
    dirv = norm((strum_hand[0] - elbow_l[0], strum_hand[1] - elbow_l[1]))
    cuff = S.capsule(add(elbow_l, dirv, 11), add(elbow_l, dirv, 14), 3.9)
    sp.fill(cuff, R['boot'], 'cuff_l', idx=1)
    for k in (11.5, 13.5):
        c = add(add(elbow_l, dirv, k), perp(dirv), -3.6)
        stud = S.poly([add(c, perp(dirv), 1.2), add(add(c, dirv, -1.1), perp(dirv), -0.2),
                       add(add(c, dirv, 1.1), perp(dirv), -0.2), add(c, perp(dirv), -2.4)])
        sp.fill(stud, R['metal'], 'cuffstud', idx=3)
    hand_l = S.ellipse(strum_hand[0], strum_hand[1], 3.7, 3.3)
    sp.fill(hand_l, R['glove'], 'hand_l', shade=ps(hand_l, sigma=0.9, gain=1.8))
    sp.px([(int(strum_hand[0]) + 1, int(strum_hand[1]) - 2), (int(strum_hand[0]) + 2, int(strum_hand[1]) - 1)], R['skin'], 3)
    pk = add(strum_hand, (0.8, 1.0), 3.2)
    sp.fill(S.poly([add(pk, (-1.4, -1.2)), add(pk, (1.8, -0.8)), add(pk, (0.4, 2.2))]), R['pink'], 'pick', idx=3)

    img = sp.render()
    # Randlicht: warm von rechts (Flammensäulen), kühl-violett von links (Bühne)
    img = rim_light(img, (255, 176, 72), 0.5, dx=1, dy=0, outline=sp.outline_mask)
    img = rim_light(img, (160, 130, 255), 0.25, dx=-1, dy=0, outline=sp.outline_mask)
    return img


FRAMES = 8          # Idle-Loop
FRAME_MS = 90
SCALE = 3           # Promo-Skalierung (640×360 → 1920×1080)


def export(out_dir):
    from PIL import Image
    from pixelkit import upscale, over, save_gif
    os.makedirs(out_dir, exist_ok=True)
    frames = [build(i / FRAMES) for i in range(FRAMES)]

    # Spritesheet (nativ + ×3, transparent)
    sheet = np.concatenate(frames, axis=1)
    Image.fromarray(sheet).save(os.path.join(out_dir, 'elana_idle_sheet.png'))
    Image.fromarray(upscale(sheet, SCALE)).save(os.path.join(out_dir, 'elana_idle_sheet_x3.png'))
    Image.fromarray(upscale(frames[0], SCALE)).save(os.path.join(out_dir, 'elana_x3.png'))

    # Vorschau-GIF auf dunklem Bühnenverlauf
    bg = np.zeros_like(frames[0])
    for y in range(H):
        k = y / (H - 1)
        bg[y] = (int(22 + 26 * k), int(16 + 12 * k), int(34 + 30 * k), 255)
    bg[123:] = (20, 14, 28, 255)
    gif = [upscale(over(bg, f), SCALE) for f in frames]
    save_gif(gif, os.path.join(out_dir, 'elana_idle.gif'), FRAME_MS)
    return frames


if __name__ == '__main__':
    export(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'elana'))
    print('Elana exportiert.')
