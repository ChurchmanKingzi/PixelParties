# -*- coding: utf-8 -*-
"""Deckbau im Draft-Modus → public/music/bgm_draftbuild.ogg   Titel: „Against the Clock“

Nach dem Draften muss in wenigen Minuten ein Deck aus dem Pool gebaut werden (Countdown-Timer!). Der Track erinnert an
den normalen Deckbau-Track (bgm_deckeditor: D-Dur, ca. 96 BPM, D-Orgelpunkt, kreisende Jazz-Harmonik
D – G – Em7 – A7 – D – Bm7 – G – A7 …), ist aber deutlich stressiger:

  • Tempo 132 statt 96 BPM, unerbittlicher 16tel-Marimba-Ostinato, treibender Bass in Achteln, tickende Uhr
  • Dasselbe Harmoniegerüst (I – IV – ii – V – I – vi – IV/V), dazu ein dringliches Thema: zwei Achtel „Anlauf“,
    punktierte Viertel — auf jedem Akkord neu angesetzt, steigend
  • Mittelteil mit Moll-Beimischung (Gm als geborgtes iv), Steigerung, am Ende ein Riser
  • Schlussrückung um einen Ganzton nach E-Dur (der Druck steigt), Rückweg nach D, Ende auf A7 → Loop

Form (80 Takte = 2:25): Intro 4 · A 8 · A' 8 · B 8 · A'' 8 · C 8 (Uhr beschleunigt) · A 8 · B' 8 · A''' 12 (E-Dur) · Outro 8
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 132, 80
song = Song(BPM, BARS)
rng = random.Random(11)

song.inst('violin', 'violin', vol=96, pan=52)
song.inst('flute', 'flute', vol=88, pan=74)
song.inst('brass', 'brass', vol=84, pan=70)
song.inst('horn', 'horns', vol=76, pan=82)
song.inst('strings', 'strings', vol=76, pan=40)
song.inst('trem', 'tremolo', vol=74, pan=64)
song.inst('mar', 'marimba', vol=74, pan=92)
song.inst('pizz', 'pizz', vol=70, pan=30)
song.inst('piano', 'piano', vol=84, pan=60)
song.inst('bass', 'bass', vol=100, pan=62)
song.inst('glock', 'glock', vol=78, pan=86)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'D': (2, 'M'), 'G': (7, 'M'), 'Em7': (4, 'm7'), 'A7': (9, '7'), 'Bm7': (11, 'm7'), 'Gm': (7, 'm'),
      'A': (9, 'M'), 'Bm': (11, 'm'), 'Em': (4, 'm'), 'E': (4, 'M'), 'B7': (11, '7'), 'F#m7': (6, 'm7')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10), 'm7': (0, 3, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return v + rng.randint(-4, 4)

def spans(chords):
    """[(Takt-Index, Beat-Versatz, Dauer, Akkord)] — ein Eintrag im Takt = ganzer Takt, ein Tupel = zwei Hälften."""
    out = []
    for k, c in enumerate(chords):
        if isinstance(c, tuple):
            out += [(k, 0, 2, c[0]), (k, 2, 2, c[1])]
        else:
            out.append((k, 0, 4, c))
    return out

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.93):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# ── Thema A (D-Dur): „zwei Achtel Anlauf + punktierte Viertel“ auf jedem Akkord, steigend ──────────────
A_BARS = [
    [('A4', .5), ('B4', .5), ('D5', 1.5), ('A4', .5), ('F#4', 1)],      # 1 D
    [('B4', .5), ('D5', .5), ('G5', 1.5), ('D5', .5), ('B4', 1)],       # 2 G
    [('B4', .5), ('E5', .5), ('G5', 1.5), ('E5', .5), ('D5', 1)],       # 3 Em7
    [('C#5', .5), ('E5', .5), ('A5', 1.5), ('G5', .5), ('E5', 1)],      # 4 A7
    [('A4', .5), ('B4', .5), ('D5', 1.5), ('F#5', .5), ('A5', 1)],      # 5 D   Anstieg zum Gipfel
    [('B4', .5), ('D5', .5), ('F#5', 1.5), ('E5', .5), ('D5', 1)],      # 6 Bm7
    [('B4', .5), ('D5', .5), ('G5', 1), ('E5', .5), ('C#5', .5), ('A4', 1)],   # 7 G | A7
]
A_END_OPEN = [('E5', .5), ('E5', .5), ('E5', .5), ('E5', .5), ('E5', 2)]    # 8 A7  — Halbschluss, „tickend“
A_END_CLOSED = [('A5', 1.5), ('F#5', .5), ('D5', 2)]                          # 8 D   — Ganzschluss
A_CH_OPEN = ['D', 'G', 'Em7', 'A7', 'D', 'Bm7', ('G', 'A7'), 'A7']
A_CH_CLOSED = ['D', 'G', 'Em7', 'A7', 'D', 'Bm7', ('G', 'A7'), 'D']

# Mittelteil B: aufsteigende Arpeggien (Dringlichkeit), geborgtes Gm
B_BARS = [
    [('B4', .5), ('D5', .5), ('F#5', .5), ('A5', .5), ('F#5', 1), ('D5', 1)],     # 1 Bm7
    [('B4', .5), ('D5', .5), ('G5', .5), ('B5', .5), ('G5', 1), ('D5', 1)],       # 2 G
    [('E5', .5), ('G5', .5), ('B5', .5), ('D6', .5), ('B5', 1), ('G5', 1)],       # 3 Em7
    [('C#5', .5), ('E5', .5), ('G5', .5), ('A5', .5), ('C#6', 2)],                # 4 A7  Gipfel
    [('D6', 1.5), ('C#6', .5), ('B5', 1), ('A5', 1)],                              # 5 Bm7
    [('D6', 1), ('Bb5', 1), ('G5', 1), ('D5', 1)],                                 # 6 Gm  (Moll-Beimischung)
    [('E5', .5), ('A5', .5), ('C#6', 1), ('E6', 1), ('C#6', 1)],                  # 7 A
]
B_END_A7 = [('A5', 4)]
B_END_B7 = [('F#5', 4)]
B_CH_A7 = ['Bm7', 'G', 'Em7', 'A7', 'Bm7', 'Gm', 'A', 'A7']
B_CH_B7 = ['Bm7', 'G', 'Em7', 'A7', 'Bm7', 'Gm', 'A', 'B7']
C_CH = ['D', 'D', 'Bm7', 'Bm7', 'G', 'G', 'A7', 'A7']
OUTRO_CH = ['E', 'Em', 'G', 'A7', 'D', 'D', 'A', 'A7']
INTRO_CH = ['D', 'D', 'G', 'A7']

# ── Begleit-Bausteine ───────────────────────────────────────────────────────────────────────────────
def bass8(bar0, chords, shift=0, vel=88, sparse=False):
    for k, off, dur, ch in spans(chords):
        root, _ = CH[ch]
        r = (root + shift) % 12 + 36
        r = r - 12 if r >= 45 else r                      # Bass ≈ D1–G#1/A1 (MIDI 33–44)
        n8 = int(dur * 2)
        for i in range(n8):
            t = song.bar(bar0 + k) + off + i * 0.5
            if sparse:
                if i % 4 == 0: song.add('bass', t, 1.6, r, vel)
                continue
            m = r + 12 if i % 4 == 2 else (r + 7 if i == n8 - 1 and dur == 2 else r)
            song.add('bass', t, 0.42, m, vel + (10 if i % 2 == 0 else -6))

def marimba16(bar0, chords, shift=0, vel=50, accent=8):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 4, shift)
        ext = [T[0], T[1], T[2], T[0] + 12, T[1] + 12]
        pat = (0, 2, 1, 3, 1, 2, 4, 2, 0, 2, 1, 3, 4, 3, 2, 1)
        for i in range(int(dur * 4)):
            song.add('mar', song.bar(bar0 + k) + off + i * 0.25, 0.22, ext[pat[i % 16]], hv(vel + (accent if i % 4 == 0 else 0)))

def strings8(bar0, chords, shift=0, vel=50):
    """Staccato-Achtel auf Akkordtönen: das Drängen."""
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        v = [T[1], T[2], T[0] + 12]
        for i in range(int(dur * 2)):
            for m in v:
                song.add('strings', song.bar(bar0 + k) + off + i * 0.5, 0.35, m, hv(vel + (6 if i % 2 == 0 else 0)))

def brass_stabs(bar0, chords, shift=0, vel=72, beats=(0, 2.5)):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for bt in beats:
            if off <= bt < off + dur:
                for m in (T[1], T[2], T[0] + 12):
                    song.add('brass', song.bar(bar0 + k) + bt, 0.45, m, hv(vel))

def piano_chords(bar0, chords, shift=0, vel=60):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 4, shift)
        for bt in (0, 1.5, 2.5) if dur == 4 else (0, 1.5):
            for m in T[:3]:
                song.add('piano', song.bar(bar0 + k) + off + bt, 0.5, m, hv(vel))

def tremolo_pad(bar0, chords, shift=0, vel=46, rise=0.0):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('trem', song.bar(bar0 + k) + off, dur - 0.05, m, min(120, int(vel + rise * k)))

def horn_held(bar0, chords, shift=0, vel=50):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        song.add('horn', song.bar(bar0 + k) + off, dur - 0.05, T[2], vel)
        song.add('horn', song.bar(bar0 + k) + off, dur - 0.05, T[0] + 12, vel - 6)

def drums(bar0, nbars, level, roll_last=True):
    """level 1 Puls + Tick, 2 Beat, 3 Vollgas (Vierviertel-Kick, 16tel-Hats), je Abschnittsende Snare-Wirbel."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if level == 1:
            song.dr(t, KICK, 80, 0.2); song.dr(t + 2, KICK, 70, 0.2)
            song.dr(t + 1, SIDESTICK, 80, 0.15); song.dr(t + 3, SIDESTICK, 86, 0.15)
        elif level >= 2:
            song.dr(t, KICK, 100, 0.2); song.dr(t + 1.5, KICK, 80, 0.2); song.dr(t + 2, KICK, 96, 0.2)
            song.dr(t + 1, SNARE, 100, 0.15); song.dr(t + 3, SNARE, 104, 0.15)
            step = 0.25 if level == 3 else 0.5
            for i in range(int(4 / step)):
                song.dr(t + i * step, HAT, 92 + (14 if i % (2 if level == 3 else 1) == 0 else 0), 0.08)
            if level == 3:
                song.dr(t + 3, KICK, 90, 0.2); song.dr(t + 1, CLAP, 70, 0.1); song.dr(t + 3, CLAP, 76, 0.1)
        if k == 0 and level >= 2:
            song.dr(t, CRASH, 100, 1.0)
        if roll_last and k == nbars - 1 and level >= 2:
            for i in range(8):
                song.dr(t + 2 + i * 0.25, SNARE, 70 + i * 7, 0.12)

def ticks(bar0, nbars, density):
    """Die Uhr: Holzblock/Glockenspiel-D6; density = Schläge pro Takt (4, 8, 12, 16 …)."""
    for k in range(nbars):
        for i in range(density):
            t = song.bar(bar0 + k) + i * 4.0 / density
            song.dr(t, 76 if i % 2 == 0 else 77, 84 + (10 if i == 0 else 0), 0.08)
            song.add('glock', t, 0.1, pn('D6') if i % 4 else pn('A5'), 52)

# ═══════════════════════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): tickende Uhr, D-Orgelpunkt, Streicher-Tremolo steigt ─────────────────────────────────
bass8(b, INTRO_CH, vel=76, sparse=True)
tremolo_pad(b, INTRO_CH, vel=34, rise=5)
ticks(b, 4, 4)
mel('horn', b + 2, [[('A4', .5), ('B4', .5), ('D5', 1.5), ('A4', .5), ('F#4', 1)]], vel=62)   # das Motiv deutet sich an
marimba16(b + 2, ['G', 'A7'], vel=34)
drums(b, 4, 1)
b += 4

# ── A (8): Thema in der Geige, Marimba-Ostinato, treibender Bass ──────────────────────────────────────
mel('violin', b, A_BARS, vel=94); mel('violin', b + 7, [A_END_OPEN], vel=94)
bass8(b, A_CH_OPEN, vel=88)
marimba16(b, A_CH_OPEN, vel=48)
strings8(b, A_CH_OPEN, vel=46)
drums(b, 8, 2)
b += 8

# ── A' (8): Geige + Flöte (Oktave höher), Blech-Stabs, Ganzschluss ─────────────────────────────────
mel('violin', b, A_BARS, vel=96); mel('violin', b + 7, [A_END_CLOSED], vel=96)
mel('flute', b, A_BARS, vel=58, octave=1); mel('flute', b + 7, [A_END_CLOSED], vel=58, octave=1)
bass8(b, A_CH_CLOSED, vel=92)
marimba16(b, A_CH_CLOSED, vel=48)
strings8(b, A_CH_CLOSED, vel=48)
brass_stabs(b, A_CH_CLOSED, vel=68)
drums(b, 8, 2)
b += 8

# ── B (8): Mittelteil, steigende Arpeggien, Moll-Beimischung, Tremolo-Riser ──────────────────────────
mel('violin', b, B_BARS, vel=94, octave=0); mel('violin', b + 7, [B_END_A7], vel=94)
mel('flute', b, B_BARS, vel=60, octave=0); mel('flute', b + 7, [B_END_A7], vel=60)
bass8(b, B_CH_A7, vel=92)
marimba16(b, B_CH_A7, vel=46)
tremolo_pad(b, B_CH_A7, vel=44, rise=3)
horn_held(b, B_CH_A7, vel=52)
piano_chords(b, B_CH_A7, vel=54)
drums(b, 8, 3)
b += 8

# ── A'' (8): Thema im Klavier + Glockenspiel + Geige, alles drückt ────────────────────────────────────
mel('piano', b, A_BARS, vel=92); mel('piano', b + 7, [A_END_CLOSED], vel=92)
mel('violin', b, A_BARS, vel=74, octave=1); mel('violin', b + 7, [A_END_CLOSED], vel=74, octave=1)
mel('glock', b, A_BARS, vel=48, octave=1, legato=.7); mel('glock', b + 7, [A_END_CLOSED], vel=48, octave=1, legato=.7)
bass8(b, A_CH_CLOSED, vel=94)
marimba16(b, A_CH_CLOSED, vel=52)
strings8(b, A_CH_CLOSED, vel=54)
brass_stabs(b, A_CH_CLOSED, vel=74, beats=(0, 1.5, 2.5))
horn_held(b, A_CH_CLOSED, vel=46)
drums(b, 8, 3)
b += 8

# ── C (8): Die Uhr beschleunigt (4 → 8 → 12 → 16 Schläge je Takt), Bass pedalt D, Motivstöße ───────────
for k, (dens, lvl) in enumerate([(4, 1), (4, 1), (8, 1), (8, 1), (12, 2), (12, 2), (16, 2), (16, 2)]):
    ticks(b + k, 1, dens)
    drums(b + k, 1, lvl, roll_last=False)
for k, ch in enumerate(C_CH):
    root, _ = CH[ch]
    song.add('bass', song.bar(b + k), 3.9, 38, 84)                  # D2-Orgelpunkt wie im normalen Deckbau-Track
    for i in range(8):
        song.add('bass', song.bar(b + k) + i * 0.5, 0.4, 38 if i % 4 != 2 else 50, 70)
    T = tones(ch, 4)
    for bt in (0, 0.5, 1.5, 2.5):
        song.add('brass', song.bar(b + k) + bt, 0.3, T[2], hv(70))
tremolo_pad(b, C_CH, vel=44, rise=4)
marimba16(b + 4, C_CH[4:], vel=44)
for i in range(16):
    song.dr(song.bar(b + 7) + 2 + i * 0.125, SNARE, 60 + i * 4, 0.08)
b += 8

# ── A (8): wieder da, schärfer — Geige + Flöte + Klavier-Akkorde + Stabs ───────────────────────────────
mel('violin', b, A_BARS, vel=96); mel('violin', b + 7, [A_END_OPEN], vel=96)
mel('flute', b, A_BARS, vel=62, octave=1); mel('flute', b + 7, [A_END_OPEN], vel=62, octave=1)
bass8(b, A_CH_OPEN, vel=94)
marimba16(b, A_CH_OPEN, vel=50)
strings8(b, A_CH_OPEN, vel=52)
brass_stabs(b, A_CH_OPEN, vel=72, beats=(0, 1.5, 2.5))
piano_chords(b, A_CH_OPEN, vel=52)
drums(b, 8, 3)
b += 8

# ── B' (8): Mittelteil, noch voller, endet auf B7 (Dominante von E) ──────────────────────────────────
mel('violin', b, B_BARS, vel=96); mel('violin', b + 7, [B_END_B7], vel=96)
mel('flute', b, B_BARS, vel=66, octave=1); mel('flute', b + 7, [B_END_B7], vel=66, octave=1)
mel('brass', b, B_BARS, vel=50, octave=-1); mel('brass', b + 7, [B_END_B7], vel=50, octave=-1)
bass8(b, B_CH_B7, vel=96)
marimba16(b, B_CH_B7, vel=52)
tremolo_pad(b, B_CH_B7, vel=48, rise=4)
horn_held(b, B_CH_B7, vel=56)
piano_chords(b, B_CH_B7, vel=58)
drums(b, 8, 3)
b += 8

# ── A''' (12): E-Dur (Rückung um einen Ganzton), Vollgas; die zweite Phrase kommt noch einmal ──────────
S = 2
mel('violin', b, A_BARS, shift=S, vel=98); mel('violin', b + 7, [A_END_CLOSED], shift=S, vel=98)
mel('flute', b, A_BARS, shift=S, vel=70, octave=1); mel('flute', b + 7, [A_END_CLOSED], shift=S, vel=70, octave=1)
mel('brass', b, A_BARS, shift=S, vel=52, octave=-1); mel('brass', b + 7, [A_END_CLOSED], shift=S, vel=52, octave=-1)
bass8(b, A_CH_CLOSED, shift=S, vel=98)
marimba16(b, A_CH_CLOSED, shift=S, vel=54)
strings8(b, A_CH_CLOSED, shift=S, vel=56)
brass_stabs(b, A_CH_CLOSED, shift=S, vel=78, beats=(0, 1.5, 2.5))
piano_chords(b, A_CH_CLOSED, shift=S, vel=58)
drums(b, 8, 3, roll_last=False)
tag_mel = A_BARS[4:7] + [A_END_CLOSED]
tag_ch = A_CH_CLOSED[4:8]
mel('violin', b + 8, tag_mel, shift=S, vel=98)
mel('flute', b + 8, tag_mel, shift=S, vel=72, octave=1)
mel('brass', b + 8, tag_mel, shift=S, vel=54, octave=-1)
bass8(b + 8, tag_ch, shift=S, vel=98)
marimba16(b + 8, tag_ch, shift=S, vel=54)
strings8(b + 8, tag_ch, shift=S, vel=56)
brass_stabs(b + 8, tag_ch, shift=S, vel=78, beats=(0, 1.5, 2.5))
drums(b + 8, 4, 3)
b += 12

# ── Outro (8): zurück nach D, löst sich auf, Ende auf A7 (→ Loop) ─────────────────────────────────────
mel('violin', b, [[('B4', 2), ('G#4', 2)], [('B4', 2), ('G4', 2)], [('B4', 2), ('D5', 2)], [('E5', 2), ('C#5', 2)]], vel=76)
mel('violin', b + 4, [[('A4', .5), ('B4', .5), ('D5', 1.5), ('A4', .5), ('F#4', 1)], [('A4', 4)], [('E5', 2), ('C#5', 2)], [('E5', 4)]], vel=74)
bass8(b, OUTRO_CH, vel=80, sparse=True)
tremolo_pad(b, OUTRO_CH, vel=46, rise=0)
ticks(b + 4, 4, 8)
marimba16(b, OUTRO_CH[:4], vel=40)
drums(b, 4, 2, roll_last=False)
drums(b + 4, 4, 1)
for i in range(16):
    song.dr(song.bar(b + 7) + 2 + i * 0.125, SNARE, 55 + i * 4, 0.08)
b += 8
assert b == BARS, (b, BARS)

if os.environ.get('DRAFT_NORENDER') != '1':
    sf2, out = cli_paths('bgm_draftbuild.ogg')
    song.render(sf2, out, target_rms=0.24, saturate=False, compress=True)
