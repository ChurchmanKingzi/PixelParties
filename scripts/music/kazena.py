# -*- coding: utf-8 -*-
"""Held-Thema „Kazena, the Storming Rebel“ → public/music/bgm_kazena.ogg                 Titel: „Where the Wind Goes“

Kazena ist ein freier Geist: vor ihrer Familie „geflüchtet“, erkundet sie auf Abenteuern die Welt; ihre Geschwister suchen sie und sammeln sie irgendwann wieder ein.
Ihr Theme ist **Wind** (Card Art: grünhaariges Mädchen in Grün auf einer Wiese am Fluss).

  • Wind = **Holzbläser**: Flöte (Melodie), Pfeife, Klarinette; Harfe und Marimba-artige Läufe wirbeln als Böen (aufsteigende Arpeggien über zwei Oktaven), Wind-Pad
    mit Pitch-Bend-Whoosh. C-**Lydisch** (Fis!): hell, schwebend, ohne Boden — Dur, das nie ganz landet. 148 BPM, 4/4, federnder Bass, Zupf-Stabs auf den Offbeats,
    tänzelnder Groove (Toms wie eine Rahmentrommel, Hi-Hat-Shaker): fröhlich, abenteuerlustig, treibend.
  • Das Thema steigt in Arpeggien auf (C – D – Em – D | C – D – G – Am), Quint-/Sext-Sprünge, fliegende Achtel — „der Wind trägt sie“.
  • **Die Geschwister**: ein strenger Rufmotiv-Block in Horn und Posaune (absteigend, „Ka-ze-na!“ — Bruder/Schwester rufen), im Marschschritt (Kick 1/3, Snare 2/4), harmonisch geerdet
    (A-Moll, E-Dur als Dominante). Sie jagen den Wind: Verfolgung (Ruf gegen Flötenthema), ein Moment „Eingeholt“ (das Thema in doppelten Notenwerten, Flöte + Kinderchor + Horn warm
    zusammen — Familie, nicht Käfig), und im Finale spielen beide **zusammen**: Kazenas Wind-Thema oben, der Ruf der Geschwister als Gegenstimme in den Hörnern. Sie bleibt frei, sie ist nur nicht mehr allein.
Form (64 Takte ≈ 1:44): Intro 4 · Frei A 8 · A' 8 · Abenteuer B 8 · Verfolgung C 8 · Jagd D 8 · Eingeholt 8 · Finale +2 8 · Coda 4
Ausklang auf G (Dominante) → Wind der C-Lydisch-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 148, 64
song = Song(BPM, BARS)
rng = random.Random(1111)

song.inst('flute', 'flute', vol=98, pan=62)
song.inst('whistle', 'whistle', vol=70, pan=84)
song.inst('clarinet', 'clarinet', vol=80, pan=44)
song.inst('harp', 'harp', vol=84, pan=34)
song.inst('violin', 'violin', vol=76, pan=78)
song.inst('pizz', 'pizz', vol=78, pan=92)
song.inst('tremolo', 'tremolo', vol=62, pan=50)
song.inst('horn', 'horns', vol=84, pan=46)
song.inst('trombone', 'trombone', vol=86, pan=70)
song.inst('bass', 'bass', vol=98, pan=62)
song.inst('timp', 'timp', vol=96, pan=64)
song.inst('glock', 'glock', vol=62, pan=88)
song.inst('wind', 'sweep', vol=56, pan=64)
song.inst('oohs', 'oohs', vol=70, pan=70)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'C': (0, 'M'), 'D': (2, 'M'), 'Em': (4, 'm'), 'G': (7, 'M'), 'Am': (9, 'm'), 'F': (5, 'M'), 'E': (4, 'M'), 'Bb': (10, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=90, octave=0, legato=.93, interval=0, stretch=1.0):
    t = song.bar(bar0)
    for bar in bars:
        for name, dur in bar:
            d = dur * stretch
            if name is not None:
                song.add(inst, t, max(0.1, d * legato), pn(name) + shift + 12 * octave + interval, hv(vel))
            t += d

# Pitch-Bend (±12 Halbtöne) für den Wind
for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
    song.ev.append((0, -2, mido.Message('control_change', channel=song.ch['wind'][0], control=cc, value=v)))

def whoosh(beat, dur=3.0, pitch=72, vel=60, lo=-6.0, hi=7.0, steps=16):
    ch = song.ch['wind'][0]
    song.add('wind', beat, dur + 0.3, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.35) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (C-Lydisch) ══════════════════════════════════════════════════════════════════════════
A_CH = ['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'Am']
A_CH2 = ['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'C']
WIND = [
    [('G4', .5), ('C5', .5), ('E5', .5), ('G5', .5), ('F#5', 1), ('E5', 1)],
    [('A4', .5), ('D5', .5), ('F#5', .5), ('A5', .5), ('G5', 1), ('F#5', 1)],
    [('G5', .5), ('B5', .5), ('G5', .5), ('E5', .5), ('G5', 1), ('B4', 1)],
    [('A4', 1), ('F#5', 1), ('A5', 2)],
    [('E5', .5), ('G5', .5), ('C6', 1), ('B5', .5), ('G5', .5), ('E5', 1)],
    [('F#5', .5), ('A5', .5), ('D6', 1), ('C6', .5), ('A5', .5), ('F#5', 1)],
    [('G5', 1), ('B5', 1), ('D6', 2)],
]
W_END_OPEN = [('C6', 1.5), ('B5', .5), ('A5', 2)]
W_END_CLOSED = [('G5', 1), ('E5', 1), ('C5', 2)]

B_CH = ['Am', 'F', 'C', 'G', 'Am', 'F', 'D', 'G']
B_MEL = [
    [('A4', .5), ('B4', .5), ('C5', .5), ('E5', .5), ('A5', 1), ('G5', 1)],
    [('F5', .5), ('G5', .5), ('A5', .5), ('C6', .5), ('F6', 1), ('E6', 1)],
    [('C6', .5), ('B5', .5), ('G5', .5), ('E5', .5), ('G5', 1), ('C5', 1)],
    [('D5', .5), ('G5', .5), ('B5', .5), ('D6', .5), ('G6', 2)],
    [('A4', .5), ('B4', .5), ('C5', .5), ('E5', .5), ('A5', 1), ('G5', 1)],
    [('F5', .5), ('A5', .5), ('C6', .5), ('A5', .5), ('F5', 1), ('A5', 1)],
    [('F#5', .5), ('A5', .5), ('D6', .5), ('F#6', .5), ('E6', 1), ('D6', 1)],
    [('D6', 2), ('B5', 1), ('G5', 1)],
]

# Der Ruf der Geschwister (Horn/Posaune), geerdet in A-Moll
C_CH = ['Am', 'G', 'F', 'G', 'Am', 'G', 'F', 'E']
CALL = [
    [('E5', 1), ('E5', .5), ('D5', .5), ('C5', 2)],
    [('D5', 1), ('D5', .5), ('C5', .5), ('B4', 2)],
    [('C5', 1), ('C5', .5), ('B4', .5), ('A4', 2)],
    [('B4', 2), ('D5', 2)],
    [('E5', 1), ('E5', .5), ('D5', .5), ('C5', 2)],
    [('D5', 1), ('D5', .5), ('C5', .5), ('B4', 2)],
    [('A5', 1), ('G5', .5), ('F5', .5), ('E5', 2)],
    [('E5', 1), ('G#5', 1), ('B5', 2)],
]

# Finale: derselbe Ruf, aber auf die lydische Harmonik gesetzt (konsonant statt Dominante E)
CALL_FIN = CALL[:6] + [
    [('B5', 1), ('A5', .5), ('G5', .5), ('D5', 2)],
    [('E5', 1), ('G5', 1), ('C5', 2)],
]

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
def root_pitch(ch, shift=0, oct_=1):
    r = tones(ch, oct_, shift)[0]
    while r < 28: r += 12
    while r > 48: r -= 12
    return r

def gusts(bar0, chords, shift=0, vel=66, up=True):
    """Böen: Arpeggio in 16teln über zwei Oktaven (hoch und wieder herunter) — der Wind."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        ext = [T[0], T[1], T[2], T[0] + 12, T[1] + 12, T[2] + 12, T[0] + 24, T[2] + 12]
        t = song.bar(bar0 + k)
        seq = ext + ext[::-1] if up else ext[::-1] + ext
        for i, m in enumerate(seq):
            song.add('harp', t + i * 0.25, 0.9, m, hv(vel + (10 if i % 4 == 0 else 0)))

def bounce(bar0, chords, shift=0, vel=92):
    """Federnder Bass: Grundton, Quinte auf 2&, Grundton, Quinte auf 4&."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift)
        t = song.bar(bar0 + k)
        for beat, off, v in ((0, 0, vel + 8), (1.5, 7, vel - 8), (2, 0, vel), (3.5, 7, vel - 10)):
            song.add('bass', t + beat, 0.45, r + off, hv(v))

def pizz_off(bar0, chords, shift=0, vel=68):
    """Zupf-Stabs auf den Offbeats (Achtel), federnd."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        t = song.bar(bar0 + k)
        for i in range(4):
            for m in (T[1], T[2]):
                song.add('pizz', t + 0.5 + i, 0.15, m, hv(vel))

def drums(bar0, nbars, level=1.0, style='free', fills=True, crash=True):
    """free: Kick auf 1/3, Rahmentrommel-Toms auf den Offbeats, Hi-Hat-Shaker · march: Kick 1/3, Snare 2/4 (der Schritt der Geschwister)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'free':
            song.dr(t, KICK, int(98 * L), 0.15); song.dr(t + 2, KICK, int(92 * L), 0.15)
            song.dr(t + 1.5, TOM_M, int(78 * L), 0.12); song.dr(t + 3.5, TOM_L, int(82 * L), 0.12); song.dr(t + 1, SIDESTICK, int(74 * L), 0.1); song.dr(t + 3, SIDESTICK, int(78 * L), 0.1)
            for i in range(16): song.dr(t + i * 0.25, HAT, int((84 if i % 4 == 0 else (64 if i % 2 == 0 else 50)) * L), 0.05)
        elif style == 'march':
            song.dr(t, KICK, int(108 * L), 0.2); song.dr(t + 2, KICK, int(104 * L), 0.2)
            for beat in (1, 3): song.dr(t + beat, SNARE, int(108 * L), 0.15)
            for i in range(8): song.dr(t + i * 0.5, HAT, int((90 if i % 2 == 0 else 70) * L), 0.06)
        if k == 0 and crash: song.dr(t, CRASH, int(98 * L), 1.6)
        if fills and k % 4 == 3:
            for j in range(4): song.dr(t + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_L, TOM_L)[j], int((80 + 6 * j) * L), 0.12)

def roll(bar0, start, end, v0=44, v1=118):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=108):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def sparkle(bar0, nbars, shift=0, vel=58, density=2):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(density):
            song.add('glock', t + rng.choice((0.5, 1.5, 2.5, 3.5)), 0.4, rng.choice((pn('E6'), pn('G6'), pn('B6'), pn('C7'), pn('F#6'))) + shift, hv(vel))

def pad(bar0, chords, shift=0, vel=44, inst='tremolo', oct_=3):
    for k, ch in enumerate(chords):
        for m in tones(ch, oct_, shift): song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def timp_beat(bar0, chords, shift=0, vel=92):
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift) + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 2, 0.8, r, hv(vel - 6))

def wind_theme(bar0, chords, end, shift=0, vel=96, whistle=True, clar=True, fiddle=False):
    mel('flute', bar0, WIND, shift=shift, vel=vel); mel('flute', bar0 + 7, [end], shift=shift, vel=vel)
    if whistle: mel('whistle', bar0, WIND, shift=shift, vel=60, octave=1); mel('whistle', bar0 + 7, [end], shift=shift, vel=60, octave=1)
    if clar: mel('clarinet', bar0, WIND, shift=shift, vel=66, octave=-1, interval=0); mel('clarinet', bar0 + 7, [end], shift=shift, vel=66, octave=-1)
    if fiddle: mel('violin', bar0, WIND, shift=shift, vel=64, octave=0); mel('violin', bar0 + 7, [end], shift=shift, vel=64, octave=0)

def call_block(bar0, shift=0, vel=96, inst_low=True, bars=None):
    """Der Ruf: Horn + Posaune (eine Oktave tiefer)."""
    bars = bars or CALL
    mel('horn', bar0, bars, shift=shift, vel=vel, octave=0, legato=.88)
    if inst_low: mel('trombone', bar0, bars, shift=shift, vel=vel - 6, octave=-1, legato=.88)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Wind zieht auf, Böen, Pfeife, Schritte; Flötenauftakt ─────────────────────────────────────────
whoosh(song.bar(b), 8.0, pitch=pn('C5'), vel=56, lo=-8.0, hi=6.0, steps=32)
gusts(b, ['C', 'C', 'D', 'D'], vel=54)
sparkle(b, 4, vel=50, density=2)
for k in (2, 3):
    song.dr(song.bar(b + k), KICK, 90, 0.15); song.dr(song.bar(b + k) + 2, KICK, 86, 0.15)
    for i in range(8): song.dr(song.bar(b + k) + i * 0.5, HAT, 70, 0.05)
    song.add('bass', song.bar(b + k), 1.9, pn('C2') if k == 2 else pn('D2'), 84)
mel('whistle', b, [[(None, 4)], [(None, 4)], [(None, 2), ('E5', .5), ('G5', .5), ('C6', 1)], [(None, 2), ('F#5', .5), ('A5', .5), ('D6', 1)]], vel=64)
roll(b + 3, 2.5, 4, 40, 96)
b += 4

# ── Frei A (8): die Flöte trägt das Wind-Thema, Harfe und Zupfer wirbeln, Groove tänzelt ──────────────────────
wind_theme(b, A_CH, W_END_OPEN, whistle=False, clar=False)
gusts(b, A_CH, vel=64)
bounce(b, A_CH)
pizz_off(b, A_CH)
drums(b, 8, level=0.95)
sparkle(b, 8, vel=54)
pad(b, A_CH, vel=34)
b += 8

# ── A' (8): Pfeife, Klarinette, Fiedel kommen dazu; schließt auf C ──────────────────────────────────────────────
wind_theme(b, A_CH2, W_END_CLOSED, fiddle=True)
gusts(b, A_CH2, vel=68, up=False)
bounce(b, A_CH2, vel=96)
pizz_off(b, A_CH2, vel=72)
drums(b, 8, level=1.05)
sparkle(b, 8, vel=60, density=3)
pad(b, A_CH2, vel=42)
timp_beat(b, A_CH2, vel=84)
whoosh(song.bar(b + 7) + 1.0, 3.0, pitch=pn('G5'), vel=58)
b += 8

# ── Abenteuer B (8): Aufstieg durch neue Landschaften — Läufe, Modulation in a-Moll/F, Fiedel jagt ─────────────
mel('flute', b, B_MEL, vel=96)
mel('violin', b, B_MEL, vel=74, octave=0)
mel('whistle', b, B_MEL, vel=56, octave=1)
mel('clarinet', b, B_MEL, vel=62, octave=-1)
gusts(b, B_CH, vel=70)
bounce(b, B_CH, vel=98)
pizz_off(b, B_CH, vel=74)
pad(b, B_CH, vel=44)
sparkle(b, 8, vel=62, density=3)
timp_beat(b, B_CH, vel=88)
drums(b, 8, level=1.1)
roll(b + 7, 2, 4, 50, 112)
b += 8

# ── Verfolgung C (8): die Geschwister — der Ruf in Horn/Posaune im Marschschritt; der Wind flattert darüber ─────
call_block(b)
mel('flute', b, WIND, vel=76, octave=1, stretch=1.0, legato=.85)
gusts(b, C_CH, vel=60)
for k, ch in enumerate(C_CH):
    r = root_pitch(ch)
    t = song.bar(b + k)
    for beat in (0, 1, 2, 3): song.add('bass', t + beat, 0.9, r, hv(100 if beat in (0, 2) else 88))
pad(b, C_CH, vel=50)
timp_beat(b, C_CH, vel=102)
drums(b, 8, level=1.1, style='march')
roll(b + 7, 1, 4, 60, 124)
b += 8

# ── Jagd D (8): Wind und Ruf im Wechsel und übereinander — die zweite Hälfte einen Ganzton höher ───────────────
for blk in range(2):
    sh = 2 * blk
    bb = b + 4 * blk
    mel('flute', bb, B_MEL[:4], shift=sh, vel=100, octave=0)
    mel('violin', bb, B_MEL[:4], shift=sh, vel=70)
    mel('horn', bb, CALL[:4], shift=sh, vel=98, octave=-1, legato=.85)
    mel('trombone', bb, CALL[:4], shift=sh, vel=92, octave=-2, legato=.85)
    gusts(bb, B_CH[:4], shift=sh, vel=70)
    bounce(bb, B_CH[:4], shift=sh, vel=102)
    pizz_off(bb, B_CH[:4], shift=sh, vel=76)
    pad(bb, B_CH[:4], shift=sh, vel=48)
    timp_beat(bb, B_CH[:4], shift=sh, vel=104)
drums(b, 8, level=1.15, style='march')
sparkle(b, 8, vel=66, density=3)
whoosh(song.bar(b + 3), 4.0, pitch=pn('E5'), vel=64)
whoosh(song.bar(b + 7) - 1.0, 5.0, pitch=pn('G5'), vel=68, lo=-8.0, hi=9.0)
roll(b + 7, 0, 4, 60, 126)
b += 8

# ── Eingeholt (8): das Thema in doppelten Notenwerten — Flöte, Kinderchor, Horn zusammen; Harfe, keine Trommeln ────
mel('flute', b, WIND[:4], vel=84, stretch=2.0, legato=1.0)
mel('oohs', b, WIND[:4], vel=70, octave=0, stretch=2.0, legato=1.0, interval=-4)
mel('horn', b, WIND[:4], vel=70, octave=-1, stretch=2.0, legato=1.0)
mel('whistle', b + 4, WIND[4:] + [W_END_CLOSED], vel=58, octave=1, stretch=1.0, legato=.9)
gusts(b, ['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'C'], vel=50)
pad(b, ['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'C'], vel=52, inst='tremolo')
pad(b, ['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'C'], vel=46, inst='oohs', oct_=4)
for k, ch in enumerate(['C', 'D', 'Em', 'D', 'C', 'D', 'G', 'C']):
    song.add('bass', song.bar(b + k), 3.9, root_pitch(ch), 70)
sparkle(b, 8, vel=58, density=2)
for k in range(8):
    song.dr(song.bar(b + k), KICK, 56 + 4 * k, 0.15)
timp_roll(song.bar(b + 6), 8.0, pn('G2') + 12, 36, 112)
roll(b + 7, 0, 4, 36, 118)
b += 8

# ── Finale +2 (8): Wind-Thema oben, der Ruf der Geschwister als Gegenstimme — zusammen; D-Lydisch, Ganzschluss ─────
S = 2
mel('flute', b, WIND, shift=S, vel=106); mel('flute', b + 7, [W_END_CLOSED], shift=S, vel=106)
mel('whistle', b, WIND, shift=S, vel=66, octave=1); mel('whistle', b + 7, [W_END_CLOSED], shift=S, vel=66, octave=1)
mel('violin', b, WIND, shift=S, vel=72); mel('violin', b + 7, [W_END_CLOSED], shift=S, vel=72)
mel('oohs', b, WIND, shift=S, vel=64, octave=-1); mel('oohs', b + 7, [W_END_CLOSED], shift=S, vel=64, octave=-1)
call_block(b, shift=S, vel=88, bars=CALL_FIN)                    # der Ruf als Gegenstimme, auf die lydische Harmonik gesetzt
gusts(b, A_CH2, shift=S, vel=72)
bounce(b, A_CH2, shift=S, vel=104)
pizz_off(b, A_CH2, shift=S, vel=78)
pad(b, A_CH2, shift=S, vel=50)
sparkle(b, 8, shift=S, vel=66, density=4)
timp_beat(b, A_CH2, shift=S, vel=104)
drums(b, 8, level=1.15)
whoosh(song.bar(b + 7), 4.0, pitch=pn('E5'), vel=64)
b += 8

# ── Coda (4): G (Dominante zur C-Lydisch-Intro), Wind weht davon ──────────────────────────────────────────────
mel('flute', b, [[('D6', 1), ('B5', 1), ('G5', 2)], [('G5', 3), (None, 1)]], vel=96)
mel('whistle', b + 2, [[('B5', .5), ('D6', .5), ('G6', 1), (None, 2)]], vel=66)
gusts(b, ['G', 'G'], vel=66)
for k in range(2):
    song.add('bass', song.bar(b + k), 3.9, pn('G1') + 12, 94)
pad(b, ['G', 'G', 'G'], vel=48)
drums(b, 2, level=1.0, fills=False)
whoosh(song.bar(b + 2), 8.0, pitch=pn('G5'), vel=66, lo=6.0, hi=-9.0, steps=32)
gusts(b + 2, ['G', 'G'], vel=50, up=False)
timp_roll(song.bar(b + 3), 4.0, pn('G2') + 12, 40, 96)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('KAZENA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_kazena.ogg')
    song.render(sf2, out, target_rms=0.26, saturate=False, compress=True, air_cut=0.0)
