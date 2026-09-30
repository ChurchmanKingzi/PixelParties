# -*- coding: utf-8 -*-
"""Battle-Track „The Final Trial“ (Trials) → public/music/bgm_theme_trials.ogg

Zeremonielle Prüfung in Es-Dur / c-Moll (rein diatonisch), 124 BPM, 60 Takte (116,1 s),
nahtlos loopbar. Feierliche Hörner rufen das Prüfungs-Motiv (Bb-Es-G-Bb, aufsteigender Dreiklang),
große Pauken und Chor tragen den Ernst. Die fünf Prüfungen der Karten sind je ein 8-Takte-Abschnitt
mit eigener Klangfarbe, danach folgt „The Final Trial“ als Tutti, das alles zusammenführt.

Aufbau (Takte, 0-basiert):
   0– 3  Prüfungsruf     Orgel + Hörner rufen das Motiv, Pauke und Marsch-Trommel von Anfang an
   4–11  Dominance       c-Moll: Posaune/Tuba/Hörner, Galopp-Pauken, schwerer Marsch (Defeat all)
  12–19  Loyalty         Es-Dur: Chor-Hymne, Streicher, Harfe (Treue, Gefolgschaft)
  20–27  Knowledge       Cembalo + Klarinette/Oboe im Kanon (Stufenläufe), Orgel, Holzblock-Sechzehntel
  28–35  Annoyance       Spöttisches „Nänä-nänä“ (Piccolo/Klarinette/Xylophon), Fagott-Oom-Pah, Kuhglocke
  36–43  Coolness        Gedämpfte Trompete + Saxophon, gehender Kontrabass, Vibraphon, lässiger Backbeat
  44–55  The Final Trial Tutti: Trompeten/Blech/Chor/Orgel, Pauken-Wirbel, Motiv + Hymne + Spott kombiniert
  56–59  Rückführung     Ruf-Motiv in den Hörnern, Dominante Bb → Sprung auf Takt 0

Aufruf:  python3 scripts/music/theme_trials.py <soundfont.sf2> [ausgabe.ogg]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 124, 60                       # 60 × 4 × 60/124 = 116,1 s
song = Song(bpm=BPM, bars=BARS)

song.inst('contra',  'contra',   92, 64)
song.inst('acbass',  'acbass',   96, 60)    # Coolness-Walking-Bass
song.inst('tuba',    'tuba',     92, 56)
song.inst('timp',    'timp',    100, 64)
song.inst('organ',   'pipeorgan', 78, 64)
song.inst('strings', 'strings',  80, 44)
song.inst('harp',    'harp',     84, 88)
song.inst('harpsi',  'harpsichord', 88, 76)
song.inst('horns',   'horns',    92, 40)
song.inst('trombone','trombone', 90, 78)
song.inst('trumpet', 'trumpet',  90, 72)
song.inst('brass',   'brass',    82, 54)
song.inst('choir',   'choir',    86, 64)
song.inst('winds',   'clarinet', 90, 34)    # Kanon / Spott / Bassoon-Ersatz je nach Abschnitt
song.inst('cool',    'sax',      92, 82)    # Coolness-Lead (dazu gedämpfte Trompete über 'muted')
song.inst('hit',     'hit',      98, 64)

NAMES = {'C': C, 'D': D, 'Eb': Eb, 'E': E, 'F': F, 'G': G, 'Ab': Ab, 'A': A, 'Bb': Bb, 'B': B, 'Db': Db, 'Gb': Gb}
def nt(s): return n(NAMES[s[:-1]], int(s[-1]))
SCALE = {Eb, F, G, Ab, Bb, C, D}          # Es-Dur / c-Moll natürlich

CH = {'Eb': (Eb, 4), 'Cm': (C, 3), 'Fm': (F, 3), 'Ab': (Ab, 4), 'Bb': (Bb, 4), 'Gm': (G, 3)}
def rootb(ch): return 36 + CH[ch][0]
def rootc(ch):
    p = 24 + CH[ch][0]; return p + 12 if p < 28 else p
def tri(ch, o=3):
    r = 12 * (o + 1) + CH[ch][0]; return [r, r + CH[ch][1], r + 7]
def ramp(i, cnt, a, b): return a + (b - a) * i / max(1, cnt - 1)
STEPS = sorted(p for p in range(36, 100) if p % 12 in SCALE)
def step(ch, k, o=4):
    """Skalenton k Stufen über dem Akkordgrundton (Oktave o) – immer diatonisch"""
    r = 12 * (o + 1) + CH[ch][0]
    i = min(range(len(STEPS)), key=lambda j: abs(STEPS[j] - r))
    return STEPS[i + k]

def line(b, notes, insts, vels, shift=0):
    for off, dur, p in notes:
        assert NAMES[p[:-1]] in SCALE, p
        for inst, v in zip(insts, vels): song.add(inst, song.bar(b) + off, dur * 0.94, nt(p) + shift, v)

# ---- Bausteine ---------------------------------------------------------------------------
def pedal(b, ch, vel=88): song.add('contra', song.bar(b), 3.98, rootc(ch), vel)
def sustain(b, ch, inst, vel, o=3, up=0):
    for p in tri(ch, o): song.add(inst, song.bar(b), 3.98, p + up, vel)
def march_bass(b, ch, vel=92):
    s, r = song.bar(b), rootb(ch)
    for off, p in ((0, r), (1, r), (2, r + 7), (3, r)): song.add('tuba', s + off, 0.8, p, vel + (8 if off == 0 else 0))
def timp(b, ch, kind='q', vel=98, v1=None):
    s, p = song.bar(b), rootb(ch)
    if kind == 'q':
        for off in (0, 2): song.add('timp', s + off, 0.6, p, vel)
    elif kind == 'march':
        for off, v in ((0, 4), (1.5, -12), (2, 0), (3, -6), (3.5, -12)): song.add('timp', s + off, 0.4, p, vel + v)
    elif kind == 'gallop':
        for off, v in ((0, 6), (0.75, -12), (1, -4), (1.5, -12), (2, 4), (2.75, -12), (3, -4), (3.5, -12)): song.add('timp', s + off, 0.35, p, vel + v)
    elif kind == 'roll':
        for i in range(16): song.add('timp', s + i * 0.25, 0.25, p, ramp(i, 16, vel, v1 if v1 else vel))
def strum_march(b, ch, vel=74):
    """Streicher: Marschakkorde auf 1, 2, 3, 4 mit Akzent"""
    for k in range(4):
        for p in tri(ch, 3)[1:] + [tri(ch, 4)[0]]: song.add('strings', song.bar(b) + k, 0.8, p, vel + (10 if k in (0, 2) else 0))
def harp_arp(b, ch, vel=80):
    s = song.bar(b); t = tri(ch, 3); cyc = [t[0], t[2], t[0] + 12, t[1] + 12, t[2] + 12, t[1] + 12, t[0] + 12, t[2]]
    for i in range(8): song.add('harp', s + i * 0.5, 0.9, cyc[i], vel + (10 if i % 4 == 0 else 0))
def hit(b, beat, ch, vel=110, dur=1.2):
    for p in tri(ch, 3) + [tri(ch, 3)[0] + 12, tri(ch, 3)[2] + 12]: song.add('hit', song.bar(b) + beat, dur, p, vel)

# ---- Schlagzeug --------------------------------------------------------------------------
def groove(b, kind, v=1.0):
    s = song.bar(b)
    def d(off, note, vel): song.dr(s + off, note, min(127, vel * v))
    if kind == 'march':                       # feierlicher Marsch: Snare-Tritt
        d(0, KICK, 112); d(1, SNARE, 96); d(1.5, SNARE, 64); d(2, KICK, 100); d(3, SNARE, 100); d(3.5, SNARE, 66); d(3.75, SNARE, 82)
        for i in range(4): d(i, COWBELL if False else SIDESTICK, 72)
    elif kind == 'heavy':
        d(0, KICK, 120); d(0, TOM_L, 112); d(1, SNARE, 112); d(1, CLAP, 88); d(1.5, TOM_M, 96)
        d(2, KICK, 108); d(2, TOM_L, 100); d(3, SNARE, 114); d(3, CLAP, 92); d(3.5, TOM_L, 100); d(3.75, TOM_M, 96)
    elif kind == 'hymn':                      # ruhiger, aber tragender Puls
        d(0, KICK, 108); d(1, SNARE, 84); d(2, KICK, 96); d(2.5, KICK, 80); d(3, SNARE, 88)
        for i in range(4): d(i, SIDESTICK, 64)
    elif kind == 'knowledge':                 # trocken: Holzblock-16tel (Sidestick) + Kick
        d(0, KICK, 110); d(2, KICK, 96); d(1, SNARE, 90); d(3, SNARE, 92)
        for i in range(16):
            if i % 4: d(i * 0.25, SIDESTICK, 74 if i % 2 == 0 else 58)
    elif kind == 'annoy':                     # Hüpfer: Clap auf Off-Beats, Kuhglocke
        d(0, KICK, 112); d(1.5, CLAP, 100); d(2, KICK, 100); d(3.5, CLAP, 100); d(1, SNARE, 90); d(3, SNARE, 94)
        for i in range(8): d(i * 0.5 + (0.25 if i % 2 else 0), COWBELL, 70 if i % 2 == 0 else 54)
    elif kind == 'cool':                      # laid-back Backbeat, hohe Velocity auf Hi-Hat/Ride
        d(0, KICK, 104); d(1, SIDESTICK, 96); d(2.5, KICK, 88); d(3, SIDESTICK, 100); d(1, CLAP, 62); d(3, CLAP, 66)
        for i in range(8): d(i * 0.5, HAT, 118 if i % 2 == 0 else 100)
        d(3.75, TOM_H, 70)
    elif kind == 'final':
        d(0, KICK, 122); d(0, TOM_L, 108); d(0, CRASH, 96); d(1, SNARE, 116); d(1, CLAP, 94); d(1.5, KICK, 100)
        d(2, KICK, 112); d(2, TOM_M, 100); d(3, SNARE, 118); d(3, CLAP, 96); d(3.5, TOM_L, 104); d(3.75, TOM_M, 98)
        for i in range(8): d(i * 0.5, RIDE, 104 if i % 2 == 0 else 88)

def fill(b, big=False):
    s = song.bar(b); seq = [TOM_H, TOM_HH, TOM_M, TOM_M, TOM_L, TOM_L, TOM_L, TOM_L]
    st = 1.5 if big else 2.0
    for i in range(8): song.dr(s + st + i * ((4 - st - 0.25) / 7), seq[i], ramp(i, 8, 84, 120), 0.2)
    song.dr(s + 3.75, KICK, 120)
def snare_roll(b, start, end, v0, v1):
    s = song.bar(b) + start; cnt = int((end - start) * 4)
    for i in range(cnt): song.dr(s + i * 0.25, SNARE, ramp(i, cnt, v0, v1), 0.15)
def crash(b, vel=112): song.dr(song.bar(b), CRASH, vel, 0.5)

# ---- Melodien ----------------------------------------------------------------------------
CALL = [(0, 1, 'Bb3'), (1, 1, 'Eb4'), (2, 1, 'G4'), (3, 1, 'Bb4')]         # Prüfungsruf
CALL_B = [(0, 1, 'Bb3'), (1, 1, 'D4'), (2, 1, 'F4'), (3, 1, 'Bb4')]
CH_I = ['Eb', 'Eb', 'Cm', 'Bb']

CH_1 = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'Bb', 'Bb']          # Dominance
MEL_1 = [
    [(0, 1, 'C4'), (1, 1, 'Eb4'), (2, 1.5, 'G4'), (3.5, .5, 'F4')],
    [(0, 2, 'Eb4'), (2, 1, 'D4'), (3, 1, 'C4')],
    [(0, 1, 'Ab3'), (1, 1, 'C4'), (2, 1.5, 'Eb4'), (3.5, .5, 'D4')],
    [(0, 2, 'C4'), (2, 2, 'Eb4')],
    [(0, 1, 'F4'), (1, 1, 'Ab4'), (2, 1.5, 'C5'), (3.5, .5, 'Bb4')],
    [(0, 2, 'Ab4'), (2, 1, 'G4'), (3, 1, 'F4')],
    [(0, 1, 'D4'), (1, 1, 'F4'), (2, 1, 'Bb4'), (3, 1, 'D5')],
    [(0, 3, 'Bb4'), (3, 1, 'G4')],
]
CH_2 = ['Eb', 'Bb', 'Cm', 'Gm', 'Ab', 'Eb', 'Fm', 'Bb']          # Loyalty
MEL_2 = [
    [(0, 2, 'G4'), (2, 1, 'Bb4'), (3, 1, 'Eb5')],
    [(0, 3, 'D5'), (3, 1, 'Bb4')],
    [(0, 2, 'C5'), (2, 1, 'Eb5'), (3, 1, 'D5')],
    [(0, 2, 'Bb4'), (2, 2, 'D5')],
    [(0, 2, 'C5'), (2, 1, 'Eb5'), (3, 1, 'Ab5')],
    [(0, 2, 'G5'), (2, 2, 'Eb5')],
    [(0, 1, 'F5'), (1, 1, 'Eb5'), (2, 1, 'C5'), (3, 1, 'Ab4')],
    [(0, 3, 'Bb4'), (3, 1, 'D5')],
]
CH_3 = ['Cm', 'Gm', 'Ab', 'Eb', 'Fm', 'Cm', 'Bb', 'Bb']          # Knowledge (Kanon aus Stufenläufen)
CH_4 = ['Eb', 'Fm', 'Eb', 'Fm', 'Ab', 'Bb', 'Cm', 'Bb']          # Annoyance
TAUNT = {'Eb': ('G5', 'Eb5'), 'Fm': ('Ab5', 'F5'), 'Ab': ('C6', 'Ab5'), 'Bb': ('D6', 'Bb5'), 'Cm': ('G5', 'Eb5')}
CH_5 = ['Cm', 'Fm', 'Bb', 'Eb', 'Ab', 'Fm', 'Bb', 'Bb']          # Coolness
MEL_5 = [
    [(0.5, 1, 'G4'), (1.5, .5, 'Eb4'), (2.5, 1, 'C5'), (3.5, .5, 'Bb4')],
    [(0.5, 1, 'Ab4'), (1.5, .5, 'F4'), (2.5, 1, 'C5'), (3.5, .5, 'Ab4')],
    [(0.5, 1, 'F4'), (1.5, .5, 'D4'), (2.5, 1, 'Bb4'), (3.5, .5, 'F4')],
    [(0.5, 1.5, 'G4'), (2.5, 1.5, 'Bb4')],
    [(0.5, 1, 'C5'), (1.5, .5, 'Eb5'), (2.5, 1, 'Ab4'), (3.5, .5, 'C5')],
    [(0.5, 1, 'C5'), (1.5, .5, 'Ab4'), (2.5, 1, 'F4'), (3.5, .5, 'Ab4')],
    [(0.5, 1, 'D5'), (1.5, .5, 'F5'), (2.5, 1.5, 'D5')],
    [(0.5, 1, 'Bb4'), (2, 2, 'D5')],
]
CH_6 = ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'Bb']          # Final Trial
MEL_6 = [
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 1.5, 'G5'), (3.5, .5, 'F5')],
    [(0, 1, 'Ab4'), (1, 1, 'C5'), (2, 2, 'Eb5')],
    [(0, 1, 'Bb4'), (1, 1, 'Eb5'), (2, 1.5, 'G5'), (3.5, .5, 'F5')],
    [(0, 1, 'D5'), (1, 1, 'F5'), (2, 2, 'Bb5')],
    [(0, 1, 'C5'), (1, 1, 'Eb5'), (2, 1.5, 'G5'), (3.5, .5, 'Bb5')],
    [(0, 1.5, 'Ab5'), (1.5, .5, 'G5'), (2, 1, 'Eb5'), (3, 1, 'C5')],
    [(0, 1, 'F5'), (1, 1, 'Ab5'), (2, 1, 'C6'), (3, 1, 'Ab5')],
    [(0, 2, 'Bb5'), (2, 1, 'F5'), (3, 1, 'D5')],
]
CH_6B = ['Eb', 'Ab', 'Bb', 'Bb']
MEL_6B = [
    [(0, 1, 'G5'), (1, 1, 'Bb5'), (2, 2, 'Eb6')],
    [(0, 1, 'Eb6'), (1, 1, 'C6'), (2, 2, 'Ab5')],
    [(0, 1, 'D6'), (1, 1, 'Bb5'), (2, 1, 'F5'), (3, 1, 'D5')],
    [(0, .5, 'Bb4'), (.5, .5, 'D5'), (1, .5, 'F5'), (1.5, .5, 'Bb5'), (2, 2, 'D6')],
]
CH_R = ['Cm', 'Ab', 'Bb', 'Bb']

# ==== Arrangement ==========================================================================
# ---- Prüfungsruf 0–3 ----------------------------------------------------------------------
hit(0, 0, 'Eb', 116, 1.6); crash(0, 108)
for i, ch in enumerate(CH_I):
    pedal(i, ch, 92); timp(i, ch, 'march', 92 + i * 3); groove(i, 'march', 0.95 + i * 0.03)
    sustain(i, ch, 'organ', 74 + i * 4); strum_march(i, ch, 66 + i * 3); march_bass(i, ch, 84)
    line(i, CALL_B if i == 3 else CALL, ['horns', 'trumpet'], [96, 78 + (i // 2) * 6])
    if i >= 2: sustain(i, ch, 'choir', 52 + (i - 2) * 16, 4)
fill(3, big=True)

# ---- Dominance 4–11 ---------------------------------------------------------------------------
hit(4, 0, 'Cm', 112, 1.0); crash(4, 112)
for i in range(8):
    b, ch = 4 + i, CH_1[i]
    pedal(b, ch, 100); march_bass(b, ch, 96); timp(b, ch, 'gallop', 100); groove(b, 'heavy', 1.0 + (i // 4) * 0.04)
    line(b, MEL_1[i], ['trombone', 'horns'], [98, 88]); line(b, MEL_1[i], ['tuba'], [90], shift=-12)
    if i >= 4: sustain(b, ch, 'choir', 60 + (i - 4) * 8, 3); strum_march(b, ch, 66)
fill(7); fill(11, big=True)

# ---- Loyalty 12–19 ----------------------------------------------------------------------------
hit(12, 0, 'Eb', 110, 1.2); crash(12, 108)
for i in range(8):
    b, ch = 12 + i, CH_2[i]
    pedal(b, ch, 90); timp(b, ch, 'q', 86); groove(b, 'hymn', 1.0)
    sustain(b, ch, 'choir', 88, 4); sustain(b, ch, 'strings', 76, 3); harp_arp(b, ch, 78)
    line(b, MEL_2[i], ['horns', 'trumpet'], [90, 72] if i < 4 else [96, 84])
    song.add('tuba', song.bar(b), 1.9, rootb(ch), 80); song.add('tuba', song.bar(b) + 2, 1.9, rootb(ch) + 7, 76)
    if i >= 4: sustain(b, ch, 'organ', 66, 3)
fill(15); fill(19, big=True)

# ---- Knowledge 20–27: Kanon aus Stufenläufen (Cembalo, Klarinette, Oboe-artig durch Streicher) -----
hit(20, 0, 'Cm', 104, 0.8); crash(20, 100)
SUBJ = [0, 1, 2, 3, 4, 3, 2, 1]      # Skalenstufen über dem Akkordgrundton, betonte Achtel = Akkordtöne
INV = [4, 3, 2, 1, 0, 1, 2, 3]
for i in range(8):
    b, ch = 20 + i, CH_3[i]
    pedal(b, ch, 90); march_bass(b, ch, 84); timp(b, ch, 'q', 86); groove(b, 'knowledge', 1.0)
    sustain(b, ch, 'organ', 72, 3)
    for k in range(8):
        song.add('harpsi', song.bar(b) + k * 0.5, 0.45, step(ch, SUBJ[k], 4), 96 if k % 2 == 0 else 84)
        if i >= 2: song.add('winds', song.bar(b) + k * 0.5, 0.45, step(ch, INV[k], 4), 84 if k % 2 == 0 else 76)
        if i >= 4: song.add('strings', song.bar(b) + k * 0.5, 0.45, step(ch, SUBJ[k], 3), 82 if k % 2 == 0 else 74)
        if i >= 6: song.add('trumpet', song.bar(b) + k * 0.5, 0.45, step(ch, INV[k], 5), 80 if k % 2 == 0 else 72)
    if i >= 4: sustain(b, ch, 'choir', 58 + (i - 4) * 6, 4)
fill(23); fill(27, big=True)

# ---- Annoyance 28–35 ----------------------------------------------------------------------------
hit(28, 0, 'Eb', 104, 0.6); crash(28, 100)
for i in range(8):
    b, ch = 28 + i, CH_4[i]; s = song.bar(b); r = rootb(ch)
    pedal(b, ch, 88); timp(b, ch, 'q', 84); groove(b, 'annoy', 1.0)
    for k in range(4):        # Fagott-artiger Oom-Pah (Posaune/Tuba)
        song.add('tuba' if k % 2 == 0 else 'trombone', s + k, 0.5, (r if k % 2 == 0 else tri(ch, 3)[2]), 92)
        if k % 2: song.add('trombone', s + k, 0.5, tri(ch, 3)[1], 84)
    hi, lo = TAUNT[ch]
    pat = [(0, .5, hi), (.5, .5, lo), (1, .5, hi), (1.5, .5, lo), (2, .5, hi), (2.5, .25, lo), (2.75, .25, hi), (3, 1, lo)]
    line(b, pat, ['winds', 'harpsi'] if i < 4 else ['winds', 'harpsi', 'trumpet'], [90, 84] if i < 4 else [96, 90, 74])
    if i >= 4:
        for k in range(8): song.add('harp', s + k * 0.5, 0.3, tri(ch, 5)[k % 3], 70)
fill(31); fill(35, big=True)

# ---- Coolness 36–43 ---------------------------------------------------------------------------------
hit(36, 0, 'Cm', 100, 0.6); crash(36, 96)
song.inst('muted', 'muted', 86, 46); song.inst('vibes', 'vibes', 80, 90)
for i in range(8):
    b, ch = 36 + i, CH_5[i]; s = song.bar(b)
    r, t = rootb(ch), tri(ch, 2)
    for k, p in enumerate((r, r + CH[ch][1], r + 7, r + CH[ch][1])): song.add('acbass', s + k, 0.9, p, 98)
    song.add('contra', s, 3.9, rootc(ch), 76)
    timp(b, ch, 'q', 74); groove(b, 'cool', 1.0)
    for off in (0.5, 2.5): song.add('vibes', s + off, 0.9, tri(ch, 4)[1], 82); song.add('vibes', s + off, 0.9, tri(ch, 4)[2], 78)
    line(b, MEL_5[i], ['cool'], [96])
    if i >= 4: line(b, MEL_5[i], ['muted'], [80])
    sustain(b, ch, 'strings', 56, 3)
fill(39); fill(43, big=True)

# ---- The Final Trial 44–55 ---------------------------------------------------------------------------
hit(44, 0, 'Cm', 124, 1.6); crash(44, 120)
for i in range(12):
    b = 44 + i
    ch, mel = (CH_6[i], MEL_6[i]) if i < 8 else (CH_6B[i - 8], MEL_6B[i - 8])
    pedal(b, ch, 104); march_bass(b, ch, 100); timp(b, ch, 'gallop', 104); groove(b, 'final', 1.0)
    line(b, mel, ['trumpet', 'brass', 'horns'], [100, 88, 86]); line(b, mel, ['trombone'], [90], shift=-24)
    sustain(b, ch, 'choir', 92, 4); sustain(b, ch, 'organ', 76, 3); strum_march(b, ch, 74)
    if i >= 8: harp_arp(b, ch, 84)
    if i in (0, 4, 8): crash(b, 108)
    if i >= 4 and i < 8:        # Spott-Echo als Kontrapunkt (Prüfung Annoyance)
        hi, lo = TAUNT.get(ch, ('G5', 'Eb5'))
        for p in ((0, hi), (0.5, lo), (1, hi), (1.5, lo)): song.add('winds', song.bar(b) + 2 + p[0], 0.4, nt(p[1]), 70)
fill(47); fill(51); fill(55, big=True); snare_roll(54, 0, 4, 60, 100); snare_roll(55, 0, 1.5, 90, 122)

# ---- Rückführung 56–59 ----------------------------------------------------------------------------------
crash(56, 100)
for i in range(4):
    b, ch = 56 + i, CH_R[i]
    pedal(b, ch, 96); march_bass(b, ch, 90); timp(b, ch, 'march' if i < 3 else 'roll', 94 if i < 3 else 104, 124)
    groove(b, 'march', 1.0 + i * 0.04) if i < 3 else snare_roll(b, 0, 4, 60, 108)
    line(b, CALL if i < 2 else CALL_B, ['horns'], [90]); sustain(b, ch, 'organ', 70 + i * 4); strum_march(b, ch, 64 + i * 4)
    sustain(b, ch, 'choir', 58 + i * 8, 4)
fill(58)

sf2, out = cli_paths('bgm_theme_trials.ogg')
song.render(sf2, out)
