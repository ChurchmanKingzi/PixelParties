# -*- coding: utf-8 -*-
"""Archetyp-Theme „Duel in Tusca“ (Tuscan) → public/music/bgm_theme_tuscan.ogg

Tarantella der italienischen Renaissance in a-Moll (harmonisch) mit Wechsel nach A-Dur,
144 BPM, 72 Takte (120,0 s), nahtlos loopbar. Ein 4/4-Takt der Lib entspricht einem 12/8-Takt:
jeder Schlag = ein punktierter Viertel (drei Achteltriolen) – das treibende Tarantella-Wiegen.
Mandoline (Nylon-Gitarre) im Triolen-Tremolo, Cembalo, Geige, Pizzicato-Bass, Tamburello
(Klatschen/Sidestick) und Pauken. Karten: Aristokrat, Künstler, Mystiker, Gefangener, Anführer
Hatusbal → Adelsintrige, Kunst, Mystik, Duell.

Aufbau (Takte, 0-basiert):
   0– 7  Intro            Tamburello + Pauken, Mandolinen-Pedal auf a/E, Cembalo-Läufe, Geigenruf
   8–23  Thema A (a-Moll) Geige mit dem Tarantella-Thema (Läufe in Triolen), zweiter Durchgang mit
                          Blockflöte, Cembalo und Pizzicato-Gegenstimme
  24–31  Intrige B        chromatisch fallender Bass (a-gis-g-fis-f-e), huschende Cembalo-Arpeggien,
                          Pizzicato-Stiche (Adelsintrige), Streicher-Tremolo schwillt an
  32–39  Mystik C         Pfeifenorgel, Chor, Glocken-Arpeggien, Geige sustained (a-Moll natürlich,
                          Am-F-G-Am-F-E), Mandoline pulsiert weiter
  40–55  Kunst D (A-Dur)  Thema in Dur (dieselben Stufen!), Flöte + Geige + Harfe, Hörner-Fanfaren;
                          zweite Hälfte mit neuer Melodie, Akkorde A-E-fis-D
  56–63  Duell E          Geige gegen Mandoline im Frage-Antwort-Wechsel (erst takt-, dann halbtaktweise),
                          Snare, Hörner-Stiche
  64–71  Rückführung F    Dominant-Orgelpunkt auf E, Pauken-/Snare-Wirbel → zurück ins Intro (a)

Harmonie: a-Moll mit Dur-Dominante E (gis = Leitton), chromatischer Bass in B, A-Dur in D.
Der Loop endet auf der Dominante (kein Schluss).
Aufruf:  python3 scripts/music/theme_tuscan.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 72                       # 72 × 4 × 60/144 = 120,0 s
song = Song(bpm=BPM, bars=BARS)
T3 = 1 / 3                                # Achteltriole in Vierteln

song.inst('bass',    'pizz',     100, 60)
song.inst('contra',  'contra',    80, 64)
song.inst('mando',   'guitar',    92, 40)  # Mandoline: Triolen-Tremolo
song.inst('harpsi',  'harpsichord', 88, 90)
song.inst('violin',  'violin',    92, 70)
song.inst('strings', 'strings',   74, 44)
song.inst('tremolo', 'tremolo',   70, 84)
song.inst('recorder','recorder',  84, 78)
song.inst('flute',   'flute',     80, 50)
song.inst('organ',   'pipeorgan', 74, 60)
song.inst('choir',   'oohs',      80, 64)
song.inst('glock',   'glock',     80, 96)
song.inst('harp',    'harp',      82, 30)
song.inst('timp',    'timp',      92, 64)
song.inst('horns',   'horns',     84, 56)

# ---- Tonleitern (Stufe 0 = A4) -----------------------------------------------------------
NAT, HAR, MAJ = [0, 2, 3, 5, 7, 8, 10], [0, 2, 3, 5, 7, 8, 11], [0, 2, 4, 5, 7, 9, 11]
def scale(iv, tonic=A): return [n(tonic + i, o) for o in range(1, 8) for i in iv]
S_NAT, S_HAR, S_MAJ = scale(NAT), scale(HAR), scale(MAJ)
def deg(sc, k): return sc[21 + k]
CH = {'Am': (A, 'm'), 'Dm': (D, 'm'), 'E': (E, 'M'), 'C': (C, 'M'), 'D': (D, 'M'), 'F': (F, 'M'), 'G': (G, 'M'),
      'A': (A, 'M'), 'F#m': (Gb, 'm')}
def tri(ch, o=3):
    pc, k = CH[ch]; r = 12 * (o + 1) + pc
    return [r, r + (3 if k == 'm' else 4), r + 7]
def root(ch, o): return 12 * (o + 1) + CH[ch][0]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)

def cells(b, cl, inst, sc, vel, octs=0, start=0.0, dur_mul=0.92):
    """Melodietakt aus Schlagzellen: 3 Töne = Triolen, 2 Töne = Lang+Kurz, 1 Ton = ganzer Schlag,
    None = Pause. Elemente sind Skalenstufen (0 = A4)."""
    for i, c in enumerate(cl):
        if c is None: continue
        s = song.bar(b) + start + i
        if len(c) == 3: pos = [(0, T3), (T3, T3), (2 * T3, T3)]
        elif len(c) == 2: pos = [(0, 2 * T3), (2 * T3, T3)]
        else: pos = [(0, 1.0)]
        for (o, d), k in zip(pos, c):
            song.add(inst, s + o, d * dur_mul, deg(sc, k) + octs, vel + (6 if o == 0 else 0))

# ---- Schlagzeug ------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel, du=0.15): song.dr(s + off, note, min(127, vel * v), du)
    for q in range(4):                                       # Tamburello: Schlag + 2 leichte pro Schlag
        d(q, CLAP, 92 if q % 2 == 0 else 80); d(q + T3, SIDESTICK, 78); d(q + 2 * T3, SIDESTICK, 88)
    if kind == 'intro':
        d(0, KICK, 108); d(2, KICK, 100); d(1, TOM_M, 92); d(3, TOM_L, 96)
    elif kind == 'a':
        d(0, KICK, 112); d(2, KICK, 102); d(1, SNARE, 90); d(3, SNARE, 96); d(1 + 2 * T3, TOM_H, 84); d(3 + 2 * T3, TOM_M, 90)
    elif kind == 'sneak':
        d(0, KICK, 92); d(2, KICK, 84)
        for q in (1, 3): d(q, COWBELL, 70)
    elif kind == 'myst':
        d(0, KICK, 100); d(2, TOM_L, 96); d(1, TOM_M, 84); d(3, TOM_M, 88); d(3 + 2 * T3, TOM_H, 84)
    elif kind == 'art':
        d(0, KICK, 114); d(2, KICK, 106); d(1, SNARE, 100); d(3, SNARE, 106)
        d(0, CRASH, 84, .5); d(1 + 2 * T3, COWBELL, 84); d(3 + 2 * T3, COWBELL, 88)
    elif kind == 'duel':
        d(0, KICK, 116); d(1, KICK, 96); d(2, KICK, 108); d(3, KICK, 96)
        d(1, SNARE, 108); d(3, SNARE, 112)
        for q in range(4): d(q + T3, TOM_H, 84)
def fill(b, big=False):
    s = song.bar(b); T = [TOM_H, TOM_HH, TOM_M, TOM_L]
    if big:
        for i in range(6): song.dr(s + 1.0 + i * T3, SNARE, ramp(i, 6, 76, 116), .12)
    for i in range(6): song.dr(s + 2.0 + i * T3, T[min(3, i // 2 + 1) if i // 2 < 3 else 3], ramp(i, 6, 92, 122), .15)
    song.dr(s + 3.67, KICK, 122)
def snare_roll(b, a, z, v0, v1):
    s = song.bar(b) + a; c = int((z - a) * 3)
    for i in range(c): song.dr(s + i * T3, SNARE, ramp(i, c, v0, v1), .12)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, .5)

# ---- Begleitung ------------------------------------------------------------------------
def mandolin(b, ch, vel=80, bass=None):
    """Triolen-Tremolo: tief – mittel – hoch je Schlag, Akkord in Oktave 3–4."""
    t = tri(ch, 3); s = song.bar(b)
    for q in range(4):
        for j, p in enumerate((t[2] if q % 2 else t[0], t[1] + 12, t[2] + 12 if q % 2 == 0 else t[0] + 12)):
            song.add('mando', s + q + j * T3, T3 * .9, p, vel + (10 if j == 0 else 0))
def pizz_bass(b, ch, vel=98, bassnote=None):
    r = bassnote if bassnote else root(ch, 2); s = song.bar(b)
    for q, p in enumerate((r, r + 7, r, r + 7)): song.add('bass', s + q, .85, p, vel - (6 if q % 2 else 0) + (6 if q == 0 else 0))
    song.add('bass', s + 3 + 2 * T3, T3, r + 12, vel - 20)            # Triolen-Auftakt
def timp2(b, ch, vel=90):
    for q in (0, 2): song.add('timp', song.bar(b) + q, .6, root(ch, 2), vel)
def pad(inst, b, ch, vel, o=3):
    for p in tri(ch, o): song.add(inst, song.bar(b), 3.95, p, vel)
def harpsi_arp(b, ch, vel=74, o=4):
    t = tri(ch, o); s = song.bar(b)
    pat = [t[0], t[1], t[2], t[0] + 12, t[2], t[1], t[0], t[1], t[2], t[1] + 12, t[2], t[1]]
    for i, p in enumerate(pat): song.add('harpsi', s + i * T3, T3 * .8, p, vel + (8 if i % 3 == 0 else 0))
def harp_arp(b, ch, vel=70, o=4, up=True):
    t = tri(ch, o); s = song.bar(b)
    seq = [t[0], t[1], t[2], t[0] + 12, t[1] + 12, t[2] + 12] if up else [t[2] + 12, t[1] + 12, t[0] + 12, t[2], t[1], t[0]]
    for i, p in enumerate(seq): song.add('harp', s + i * T3, 1.2, p, vel + i * 2)

# ==== Melodien (Zellen à 4 Schläge, Stufe 0 = A4) ===============================================
THEME = [                                                     # Am Am Dm Am | E E Am E
    [(4, 7, 9), (8, 7, 4), (2, 4), (7,)],
    [(9, 8, 7), (4, 7, 4), (2, 4, 7), (6, 7, 8)],
    [(10, 9, 7), (5, 7, 9), (7, 5, 3), (5,)],
    [(4, 7, 9), (11, 10, 9), (8, 7, 4), (7,)],
    [(8, 6, 4), (6, 8, 11), (10, 8, 6), (4,)],
    [(4, 6, 8), (11, 8, 6), (10, 8, 6), (8, 6)],
    [(9, 8, 7), (7, 4, 2), (4, 7, 9), (11,)],
    [(8, 6, 4), (3, 4, 6), (8, 6, 4), (6,)],
]
P_THEME = ['Am', 'Am', 'Dm', 'Am', 'E', 'E', 'Am', 'E']
ART2 = [                                                      # A E F#m D | A D E E
    [(7, 9, 11), (12, 11, 9), (11, 9, 7), (9, 7)],
    [(8, 6, 4), (6, 8, 11), (10, 8, 6), (8,)],
    [(9, 7, 5), (7, 9, 12), (11, 9, 7), (9,)],
    [(10, 8, 7), (5, 7, 10), (12, 10, 7), (10,)],
    [(7, 9, 11), (12, 11, 9), (7, 9, 11), (12,)],
    [(10, 8, 7), (5, 7, 10), (12, 10, 8), (7, 5)],
    [(8, 6, 4), (6, 8, 11), (12, 11, 8), (6, 8)],
    [(11, 8, 6), (4, 6, 8), (11, 8, 6), (4,)],
]
P_ART2 = ['A', 'E', 'F#m', 'D', 'A', 'D', 'E', 'E']

# ============================== Arrangement ===================================================
# ---- 0–7 Intro ---------------------------------------------------------------------------
P_INT = ['Am', 'Am', 'E', 'E', 'Am', 'Am', 'E', 'E']
crash(0, 110)
for i in range(8):
    b, ch = i, P_INT[i]
    groove(b, 'intro', 1.0)
    timp2(b, ch, 90 + i * 2)
    mandolin(b, ch, 72 + i * 3)
    pizz_bass(b, ch, 90 + i * 2)
    if i >= 4: pad('strings', b, ch, 58 + (i - 4) * 6, 3)
    if i in (3, 7): harpsi_arp(b, ch, 80)
cells(6, [(4, 7, 9), (8, 7, 4), (9, 8, 7), (6,)], 'violin', S_HAR, 92)
cells(7, [(8, 6, 4), (6, 4, 3), (4, 6, 8), None], 'violin', S_HAR, 96)
fill(3); snare_roll(7, 0, 3, 70, 120); fill(7, True)

# ---- 8–23 Thema A --------------------------------------------------------------------------
crash(8, 112); crash(16, 108)
for i in range(16):
    b, k, second = 8 + i, i % 8, i >= 8
    ch = P_THEME[k]
    groove(b, 'a', 1.0 + (0.05 if second else 0))
    timp2(b, ch, 92)
    mandolin(b, ch, 80 + (6 if second else 0))
    pizz_bass(b, ch, 98)
    cells(b, THEME[k], 'violin', S_HAR, 94 + (4 if second else 0))
    if second:
        cells(b, THEME[k], 'recorder', S_HAR, 74, 12)
        pad('strings', b, ch, 66, 3)
        if k in (0, 2, 4, 6): harpsi_arp(b, ch, 66)
        # Pizzicato-Gegenstimme: Terz/Quinte auf den Schlägen 2 und 4
        t = tri(ch, 4)
        for q in (1, 3): song.add('harp', song.bar(b) + q, .9, t[2 - (q // 3)], 74)
fill(15); fill(23, True); snare_roll(22, 2, 4, 60, 100)

# ---- 24–31 Intrige B: chromatisch fallender Bass -----------------------------------------------
P_B = ['Am', 'E', 'C', 'D', 'F', 'E', 'Am', 'E']
B_BASS = [45, 44, 43, 42, 41, 40, 45, 40]                     # a gis g fis f e a e
crash(24, 100)
for i in range(8):
    b, ch = 24 + i, P_B[i]
    groove(b, 'sneak', 1.0 + i * 0.02)
    harpsi_arp(b, ch, 74 + i * 2, 4)
    pizz_bass(b, ch, 96, B_BASS[i])
    mandolin(b, ch, 58 + i * 3)
    tr = tri(ch, 4)
    for q in (1, 3):                                            # Streicher-Stiche
        for p in tr: song.add('strings', song.bar(b) + q + 2 * T3, .3, p, 84)
    if i >= 4: pad('tremolo', b, ch, 52 + (i - 4) * 10, 3)
    if i in (3, 7): timp2(b, ch, 96)
    song.add('contra', song.bar(b), 3.95, B_BASS[i] - 12 if B_BASS[i] - 12 >= 28 else B_BASS[i], 84)
fill(27); snare_roll(30, 0, 4, 60, 100); fill(31, True)

# ---- 32–39 Mystik C -----------------------------------------------------------------------
P_C = ['Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'E']
MYST = [                                                       # (Beat, Dauer, Stufe) Naturmoll/harm. bei E
    [(0, 2, 4), (2, 2, 2)], [(0, 3, 3), (3, 1, 5)], [(0, 2, 4), (2, 2, 1)], [(0, 3, 0), (3, 1, 2)],
    [(0, 2, 4), (2, 2, 7)], [(0, 3, 5), (3, 1, 3)], [(0, 2, 6), (2, 2, 8)], [(0, 2, 6), (2, 1, 4), (3, 1, 3)],
]
for i in range(8):
    b, ch = 32 + i, P_C[i]
    groove(b, 'myst', 1.0)
    pad('organ', b, ch, 66, 3); pad('choir', b, ch, 70 + i * 2, 4)
    tr = tri(ch, 5); s = song.bar(b)
    for j in range(12): song.add('glock', s + j * T3, .5, tr[[0, 1, 2, 1][j % 4]], 66 + (8 if j % 3 == 0 else 0))
    mandolin(b, ch, 62)
    pizz_bass(b, ch, 90)
    for off, du, k in MYST[i]: song.add('violin', s + off, du * .97, deg(S_NAT if ch != 'E' else S_HAR, k), 90)
    pad('tremolo', b, ch, 54, 3)
    timp2(b, ch, 84)
crash(32, 104); fill(35); snare_roll(38, 0, 4, 60, 100); fill(39, True)

# ---- 40–55 Kunst D (A-Dur) -----------------------------------------------------------------
P_MAJ1 = ['A', 'A', 'D', 'A', 'E', 'E', 'A', 'E']
crash(40, 118); crash(48, 116)
for i in range(16):
    b, k, second = 40 + i, i % 8, i >= 8
    ch = P_MAJ1[k] if not second else P_ART2[k]
    mel = THEME[k] if not second else ART2[k]
    groove(b, 'art', 1.0 + (0.04 if second else 0))
    timp2(b, ch, 96)
    mandolin(b, ch, 86)
    pizz_bass(b, ch, 100)
    cells(b, mel, 'violin', S_MAJ, 98)
    cells(b, mel, 'flute', S_MAJ, 80, 12)
    if not second: cells(b, mel, 'recorder', S_MAJ, 70, 0)
    pad('strings', b, ch, 74, 3)
    harp_arp(b, ch, 70, 4, up=(i % 2 == 0))
    song.add('horns', song.bar(b), 1.9, tri(ch, 4)[2], 84); song.add('horns', song.bar(b) + 2, 1.9, tri(ch, 4)[1], 80)
    if second: pad('choir', b, ch, 76, 4)
fill(43); fill(47); fill(51); snare_roll(54, 0, 4, 70, 110); fill(55, True)

# ---- 56–63 Duell E: Geige gegen Mandoline --------------------------------------------------------
P_D = ['Am', 'Am', 'Dm', 'E', 'Am', 'Dm', 'E', 'E']
CALL = [[(4, 7, 9), (8, 7, 4)], [(9, 8, 7), (6, 7)], [(10, 9, 7), (5, 7, 9)], [(8, 6, 4), (6, 8)],
        [(9, 11, 9), (8, 7, 4)], [(10, 9, 7), (5, 3)], [(8, 6, 4), (6, 8, 11)], [(11, 8, 6), (4, 6, 8)]]
crash(56, 112)
for i in range(8):
    b, ch = 56 + i, P_D[i]
    groove(b, 'duel', 1.0 + i * 0.01)
    timp2(b, ch, 100)
    pizz_bass(b, ch, 100)
    pad('strings', b, ch, 70 + i * 2, 3)
    if i < 4:                                                   # takt-/halbtaktweise: Geige ruft, Mandoline antwortet
        cells(b, CALL[i] + [None, None], 'violin', S_HAR, 100, 0, 0.0)
        cells(b, CALL[i] + [None, None], 'mando', S_HAR, 96, 0, 2.0)
    else:
        cells(b, CALL[i] + [None, None], 'violin', S_HAR, 102, 0, 0.0)
        cells(b, CALL[i] + [None, None], 'mando', S_HAR, 98, 0, 2.0)
    song.add('horns', song.bar(b) + 1, .5, tri(ch, 4)[0], 90); song.add('horns', song.bar(b) + 3, .5, tri(ch, 4)[2], 90)
fill(59); snare_roll(62, 0, 4, 60, 100); fill(63, True)

# ---- 64–71 Rückführung F -----------------------------------------------------------------
P_R = ['Dm', 'Dm', 'E', 'E', 'E', 'E', 'E', 'E']
for i in range(8):
    b, ch = 64 + i, P_R[i]
    if i < 4: groove(b, 'a', 0.9 + i * 0.04)
    else: snare_roll(b, 0, 4, 50 + (i - 4) * 14, 82 + (i - 4) * 14)
    if i >= 4:
        for j in range(12): song.add('timp', song.bar(b) + j * T3, T3, 40, 80 + (i - 4) * 8 + j)
    else: timp2(b, ch, 96)
    mandolin(b, ch, 70 + i * 4)
    pizz_bass(b, ch, 96 + i)
    pad('strings', b, ch, 66 + i * 4, 3); pad('tremolo', b, ch, 56 + i * 6, 3)
    if i >= 2: pad('choir', b, ch, 60 + i * 3, 4)
cells(66, [(4, 6, 8), (6, 8, 11), (10, 8, 6), (8,)], 'violin', S_HAR, 94)
cells(68, [(4, 6, 8), (6, 8, 11), (10, 8, 6), (8,)], 'violin', S_HAR, 98)
cells(70, [(8, 6, 4), (6, 8, 11), (12, 11, 10), (11,)], 'violin', S_HAR, 102)
cells(71, [(8, 6, 4), (6, 4, 3), (4, 6, 8), None], 'violin', S_HAR, 104)
crash(64, 108); fill(67); fill(71, True)

sf2, out = cli_paths('bgm_theme_tuscan.ogg')
song.render(sf2, out)
