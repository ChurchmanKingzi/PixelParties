# -*- coding: utf-8 -*-
"""Battle-Theme "Cyber-Jagd" → public/music/bgm_battle6.ogg

Chiptune-/Synthwave-Verfolgungsjagd in a-Moll, 160 BPM, 80 Takte (120 s, nahtlos loopbar).
Square-/Saw-Arpeggien in 16teln, Acid-/Square-Bass, Sägezahn-Lead mit Portamento-artigen
Läufen (16tel-Skalenläufe), Wavetable-Pad, elektronische Drums (Clap, offene Hi-Hat).

Hauptmotiv: punktierter Rhythmus (¾ + ¼ + 2×½ + ¾ + ¼ + 1) aus Akkordtönen, danach ein
16tel-Lauf in den nächsten Akkord. Gegenstimme: 3-3-2-Synkope. Harmonie:
  P1 = Am  F  C  G      P2 = Am  F  Dm  E (E-Dur mit Leitton gis)      P3 = Am  G  F  E (andalusisch)

Aufbau (Takte):
  0– 7 Intro        Arpeggio allein, Pad, dann Bass + Kick, Fill
  8–23 Thema        Lead-Motiv, Bass, volle Drums, ab 16 zweites (Echo-)Arpeggio
 24–39 Steigerung   Gegenstimme, Acid-Bass in 16teln, Lead mit Läufen, Snare-Wirbel
 40–47 Breakdown    Drums weg, Pad + Kristall-Pings + Wavetable-Melodie
 48–55 Aufbau       Kick kehrt zurück, Riser, Snare-Wirbel beschleunigt
 56–71 Höhepunkt    alles: Lead, Gegenstimme, zwei Arpeggien, Acid-Bass, Sparkle
 72–79 Rückführung  Ausdünnen, Dominante E, Wirbel → zurück zu Takt 0 (Am)

Aufruf:  python3 scripts/music/battle6.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

song = Song(bpm=160, bars=80)
# Stimmen: Name, Instrument, Lautstärke, Panorama
song.inst('bass',   'squarebass', 100, 62)
song.inst('acid',   'acidbass',    92, 66)
song.inst('pad',    'warm',        66, 64)
song.inst('arp',    'square',      72, 44)
song.inst('arp2',   'saw',         56, 86)
song.inst('lead',   'saw',         84, 68)
song.inst('leadb',  'wavetable',   80, 64)
song.inst('counter', 'bright',     66, 36)
song.inst('spark',  'crystal',     62, 96)
song.inst('riser',  'scifi',       60, 64)
song.inst('stab',   'charang',     58, 30)
add, dr = song.add, song.dr
bar = song.bar

# ---- Harmonie ----------------------------------------------------------
CH_ = {'Am': (A, [A, C, E]), 'F': (F, [F, A, C]), 'C': (C, [C, E, G]), 'G': (G, [G, B, D]),
       'Dm': (D, [D, F, A]), 'E': (E, [E, Ab, B])}      # E-Dur: Ab = gis (Leitton)
P1, P2, P3 = ['Am', 'F', 'C', 'G'], ['Am', 'F', 'Dm', 'E'], ['Am', 'G', 'F', 'E']
PROG = (P1 + P1 +                      # 0-7   Intro
        P1 + P2 + P1 + P2 +            # 8-23  Thema
        P1 + P2 + P3 + P2 +            # 24-39 Steigerung
        ['F', 'C', 'G', 'Am', 'F', 'C', 'Dm', 'E'] +   # 40-47 Breakdown
        P1 + P2 +                      # 48-55 Aufbau
        P1 + P2 + P3 + P3 +            # 56-71 Höhepunkt
        P1 + ['F', 'G', 'E', 'E'])     # 72-79 Rückführung
assert len(PROG) == 80

def tones(chord, lo, count=8):
    """Akkordtöne aufsteigend ab dem tiefsten Ton >= lo."""
    pcs = CH_[chord][1]; out = []; m = lo
    while len(out) < count:
        if m % 12 in pcs: out.append(m)
        m += 1
    return out

def bass_root(chord):
    m = 28
    while m % 12 != CH_[chord][0]: m += 1
    return m

def scale(cur, nxt):
    """A-Moll (natürlich); bei E-Dur harmonisch (gis)."""
    pcs = {A, B, C, D, E, F, G}
    if 'E' in (cur, nxt): pcs = {A, B, C, D, E, F, Ab}
    return [m for m in range(48, 100) if m % 12 in pcs]

# ---- Bausteine ---------------------------------------------------------
def arp(b, vel=64, name='arp', shift=0.0, lo=60):
    t = tones(PROG[b], lo, 5); s = bar(b)
    cyc = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1]     # 16tel, Oktavsprung + Wendung
    for i in range(16):
        add(name, s + shift + i * 0.25, 0.2, t[cyc[i]], vel + (12 if i % 4 == 0 else 0) - (6 if i % 2 else 0))

def pad(b, vel=58, lo=52):
    for m in tones(PROG[b], lo, 3): add('pad', bar(b), 4.0, m, vel)

def bass8(b, vel=100, name='bass'):
    """Achtel-Grundton mit Oktavsprung und Quinte, lässt die Kick auf 1-2-3-4 frei."""
    r = bass_root(PROG[b]); s = bar(b)
    for p, sm in [(0, 0), (0.5, 0), (1.5, 12), (2, 0), (2.5, 0), (3, 0), (3.5, 7 if b % 2 else 12)]:
        add(name, s + p, 0.4, r + sm, vel + (6 if p in (0, 2) else 0))

def bass16(b, vel=100, name='acid'):
    """Acid-Muster in 16teln: Oktavsprünge, Quint-Wendung am Taktende."""
    r = bass_root(PROG[b]); s = bar(b)
    semis = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 7, 10 if PROG[b] != 'E' else 11, 12]
    for i, sm in enumerate(semis):
        add(name, s + i * 0.25, 0.2, r + sm, vel + (10 if i % 4 == 0 else 0) - (8 if sm == 12 else 0))

def bass_long(b, vel=90):
    add('bass', bar(b), 4.0, bass_root(PROG[b]), vel)

RH = [(0, .75), (.75, .25), (1, .5), (1.5, .5), (2, .75), (2.75, .25), (3, 1)]
SHAPES = {'A': [1, 2, 3, 2, 1, 0, 1], 'B': [2, 3, 4, 3, 2, 1, 2], 'C': [4, 3, 2, 3, 1, 2, 0]}

def lead_run(name, b, beat, target, cur, nxt, n16=4, vel=92, up=True):
    """Portamento-artiger Skalenlauf aus n16 16teln, der genau auf `target` zuläuft."""
    S = scale(cur, nxt)
    i = S.index(target) if target in S else min(range(len(S)), key=lambda k: abs(S[k] - target))
    seq = S[i - n16:i] if up else S[i + 1:i + n16 + 1][::-1]
    for k, m in enumerate(seq): add(name, bar(b) + beat + k * 0.25, 0.24, m, vel - 12 + k * 3)

def lead_bar(b, shape, name='lead', vel=94, run=False, lo=69):
    """Ein Takt Hauptmotiv; bei run=True endet er mit 16tel-Lauf auf den nächsten Akkord."""
    cur = PROG[b]; nxt = PROG[(b + 1) % 80]
    t = tones(cur, lo, 8); s = bar(b); idx = SHAPES[shape]
    use = RH[:5] if run else RH
    for (off, dur), k in zip(use, idx):
        add(name, s + off, dur * 0.95 if dur < 1 else 0.95, t[k], vel + (8 if off in (0, 2) else 0))
    if run:
        tg = tones(nxt, 72, 3)[0] if nxt != 'E' else tones(nxt, 71, 3)[0]
        lead_run(name, b, 3, tg, cur, nxt, 4, vel, up=(t[idx[4]] < tg))

def phrase(b0, name='lead', vel=94, shapes='ABAC', lo=69):
    for k, sh in enumerate(shapes): lead_bar(b0 + k, sh, name, vel, run=(k == 3), lo=lo)

def counter(b, vel=62):
    """Gegenstimme in 3-3-2-Synkope (tiefer als der Lead, nur Akkordtöne)."""
    t = [m for m in tones(PROG[b], 55, 8) if m <= 68]
    seq = [t[-1], t[len(t) // 2], t[0]] if b % 2 == 0 else [t[len(t) // 2], t[-1], t[0]]
    for p, d, m in zip((0, 1.5, 3), (1.4, 1.4, 0.9), seq): add('counter', bar(b) + p, d, m, vel)

def stabs(b, vel=56):
    """Synkopierte Akkordstiche (Charang) auf 0.75 / 2.25 / 3.5."""
    t = tones(PROG[b], 57, 3)
    for p in (0.75, 2.25, 3.5):
        for m in t: add('stab', bar(b) + p, 0.3, m, vel)

def spark(b, vel=66):
    t = tones(PROG[b], 84, 3)
    for i, k in enumerate([0, 1, 2, 1, 0, 2, 1, 2]): add('spark', bar(b) + i * 0.5, 0.45, t[k], vel - (10 if i % 2 else 0))

def bd_lead(b, vel=84):
    """Breakdown-Melodie (Wavetable), langsam, Akkordtöne + Lauf am Ende."""
    cur = PROG[b]; t = tones(cur, 69, 6); s = bar(b)
    pat = [(0, 2.0, 2), (2, 1.0, 1), (3, 1.0, 3)] if b % 2 == 0 else [(0, 1.5, 3), (1.5, 1.5, 2), (3, 1.0, 1)]
    for off, d, k in pat: add('leadb', s + off, d * 0.95, t[k], vel)

# ---- Schlagzeug --------------------------------------------------------
def kicks(b, vel=112, extra=False):
    s = bar(b)
    for i, v in enumerate([118, 106, 112, 106]): dr(s + i, KICK, v * vel / 118)
    if extra: dr(s + 2.75, KICK, 88 * vel / 118)

def hats(b, dens=16, vel=1.0):
    s = bar(b)
    if dens == 8:
        for i in range(8): dr(s + i * 0.5, OHAT if i % 2 else HAT, (78 if i % 2 else 64) * vel, 0.2)
    else:
        for i in range(16):
            if i % 4 == 2: dr(s + i * 0.25, OHAT, 80 * vel, 0.25)
            else: dr(s + i * 0.25, HAT, (74 if i % 4 == 0 else 50) * vel, 0.1)

def claps(b, vel=1.0, ghost=False):
    s = bar(b)
    for p in (1, 3):
        dr(s + p, CLAP, 112 * vel); dr(s + p, SNARE, 66 * vel)
    if ghost: dr(s + 3.75, SNARE, 62 * vel); dr(s + 1.75, SNARE, 50 * vel)

def full_beat(b, vel=1.0, dens=16):
    kicks(b, 116 * vel, extra=(b % 2 == 1)); claps(b, vel, ghost=(b % 2 == 1)); hats(b, dens, vel)

def fill(b, kind=0):
    """Fill in der zweiten Taktbälfte (Toms absteigend, Snare-16tel crescendo)."""
    s = bar(b)
    if kind == 0:
        for i, t in enumerate([TOM_HH, TOM_H, TOM_M, TOM_L, SNARE, SNARE, SNARE, SNARE]):
            dr(s + 2 + i * 0.25, t, 84 + i * 5, 0.2)
        dr(s + 3.5, SNARE, 118); dr(s + 3.75, CLAP, 120)
    else:
        for i in range(8): dr(s + 2 + i * 0.25, SNARE, 70 + i * 7, 0.15)

def roll(b, start=0, end=4, v0=50, v1=120, step=0.25, note=SNARE):
    n_ = int((end - start) / step)
    for i in range(n_): dr(bar(b) + start + i * step, note, v0 + (v1 - v0) * i / max(1, n_ - 1), 0.12)

# ---- Arrangement -------------------------------------------------------
# 0-7 Intro
for b in range(0, 8):
    arp(b, 44 + b * 3)
    pad(b, 40 + b * 3)
    if b >= 2: hats(b, 8, 0.7)
    if b >= 4:
        kicks(b, 100 + (b - 4) * 4); bass8(b, 84 + (b - 4) * 4)
        if b >= 5: hats(b, 16, 0.85)
    if b >= 6: claps(b, 0.9)
spark(0, 60); spark(4, 66); spark(6, 72)
dr(bar(0), CRASH, 96)
fill(7, 0)

# 8-23 Thema
dr(bar(8), CRASH, 112)
for b in range(8, 24):
    full_beat(b, 1.0)
    bass8(b, 100)
    arp(b, 62)
    pad(b, 56)
    if b >= 16: arp(b, 46, 'arp2', 0.25, 64)
    if b % 8 == 7: fill(b, 0)
    if b == 16: dr(bar(b), CRASH, 108)
    if b >= 20 and b % 4 == 2: stabs(b, 52)
phrase(8, 'lead', 90); phrase(12, 'lead', 92)
phrase(16, 'lead', 96); phrase(20, 'lead', 98, 'BACA')

# 24-39 Steigerung
dr(bar(24), CRASH, 114)
for b in range(24, 40):
    full_beat(b, 1.05)
    if b < 32: bass8(b, 100) if b % 4 != 3 else bass16(b, 100)
    else: bass16(b, 102)
    arp(b, 66); arp(b, 50, 'arp2', 0.25, 64)
    pad(b, 60)
    counter(b, 60 if b < 32 else 68)
    if b % 4 == 3: fill(b, 0 if b % 8 == 7 else 1)
    if b >= 32: stabs(b, 58)
    if b >= 36: spark(b, 58)
phrase(24, 'lead', 96, 'BACA'); phrase(28, 'lead', 98, 'ABCA')
phrase(32, 'lead', 100, 'BCBC'); phrase(36, 'lead', 102, 'BBCA')
roll(39, 2, 4, 60, 124, 0.25)
dr(bar(32), CRASH, 114)

# 40-47 Breakdown: Drums fast weg, Pad + Pings + Wavetable-Melodie
dr(bar(40), CRASH, 118); dr(bar(40), KICK, 122)
for b in range(40, 48):
    pad(b, 62, 48)
    spark(b, 62 if b < 44 else 70)
    if b >= 40: bd_lead(b, 82)
    if b >= 44:
        bass_long(b, 88)
        for p in (1, 3): dr(bar(b) + p, SIDESTICK, 74)
        arp(b, 42 + (b - 44) * 4)
    if b >= 46:
        for i in range(8): dr(bar(b) + i * 0.5, HAT, 44 + i * 4, 0.1)
dr(bar(47) + 3, SNARE, 90); dr(bar(47) + 3.5, SNARE, 100); dr(bar(47) + 3.75, SNARE, 112)

# 48-55 Aufbau
for b in range(48, 56):
    kicks(b, 100 + (b - 48) * 2)
    hats(b, 8 if b < 52 else 16, 0.8 + (b - 48) * 0.03)
    # Orgelpunkt A im Bass, während die Harmonie darüber wandert
    for p in range(8): add('acid', bar(b) + p * 0.5, 0.4, n(A, 1) if p % 2 == 0 else n(A, 2), 88 + (b - 48) * 2 - (8 if p % 2 else 0))
    arp(b, 58 + (b - 48) * 2); pad(b, 58)
    if b >= 50: arp(b, 46, 'arp2', 0.25, 64)
    if b >= 52: claps(b, 0.9)
    if b >= 52: counter(b, 62)
for k, b in enumerate(range(52, 56)):
    add('riser', bar(b), 4.0, n(A, 3) + k * 3 + (2 if k == 3 else 0), 60 + k * 10)
roll(52, 0, 4, 60, 92, 1.0); roll(53, 0, 4, 70, 100, 0.5); roll(54, 0, 4, 78, 112, 0.25); roll(55, 0, 3.5, 84, 126, 0.125)

# 56-71 Höhepunkt
dr(bar(56), CRASH, 124); dr(bar(64), CRASH, 120)
for b in range(56, 72):
    full_beat(b, 1.1)
    bass16(b, 104) if b % 8 < 4 else bass8(b, 104, 'bass')
    if b % 8 >= 4: bass16(b, 60, 'acid')
    arp(b, 68); arp(b, 54, 'arp2', 0.25, 64)
    pad(b, 62); counter(b, 70); stabs(b, 60); spark(b, 62)
    if b % 4 == 3: fill(b, 0 if b % 8 == 7 else 1)
    if b % 8 == 0 and b > 56: dr(bar(b), CRASH, 112)
phrase(56, 'lead', 104, 'BCBA'); phrase(60, 'lead', 106, 'BCBC')
phrase(64, 'lead', 106, 'ABAC'); phrase(68, 'lead', 108, 'BCBC')
# Höhepunkt: Lead mit Wavetable-Stimme tiefer gedoppelt (dicker Klang)
phrase(64, 'leadb', 54, 'ABAC', lo=57); phrase(68, 'leadb', 56, 'BCBC', lo=57)

# 72-79 Rückführung: ausdünnen, Dominante, Wirbel, zurück zu Am
dr(bar(72), CRASH, 112)
for b in range(72, 80):
    fade = 1.0 - (b - 72) * 0.04
    kicks(b, 108 * fade)
    hats(b, 16 if b < 76 else 8, 0.8)
    if b < 76: claps(b, 0.95); bass8(b, 96)
    else: bass_long(b, 90)
    arp(b, 60 + (b - 72) * 2)
    if b >= 74: pad(b, 56)
    if b < 76: pad(b, 58); counter(b, 62)
    if b == 75: fill(b, 1)
phrase(72, 'lead', 94, 'ABAC')
# Lauf von E abwärts/aufwärts zur Tonika
for k in range(8): add('lead', bar(76) + k * 0.5, 0.45, tones('F', 69, 4)[k % 3] + (0 if k < 4 else 0), 74 + k * 3)
for k in range(8): add('lead', bar(77) + k * 0.5, 0.45, tones('G', 71, 4)[k % 3], 80 + k * 3)
for k in range(8): add('lead', bar(78) + k * 0.5, 0.45, tones('E', 71, 4)[k % 3], 86 + k * 3)
for k in range(16): add('lead', bar(79) + k * 0.25, 0.22, tones('E', 71, 6)[k % 4] + (12 if k % 4 == 3 else 0), 90 + k * 2)
roll(78, 0, 4, 60, 100, 0.25); roll(79, 0, 3.75, 96, 127, 0.125)
add('riser', bar(76), 16.0, n(E, 3), 70)

sf2, out = cli_paths('bgm_battle6.ogg'); song.render(sf2, out)
