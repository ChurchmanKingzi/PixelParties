# -*- coding: utf-8 -*-
"""Held-Thema „Alex, Trainer of Heroes“ → public/music/bgm_alex.ogg                       Titel: „Retired, Not Done“

Alex ist Ausbilder, Trainer und „pensionierter Profi-Held“ (Card Art: breit grinsender Kerl in Blau vor goldenem Boden,
Schwert am Boden). Der Track mischt Heroik (helle, laute, energetische Blechbläser) mit Militär (Marsch, Trommeln, Drill).

  • B-Dur, 132 BPM, 4/4 als Marsch: Tuba „Umpa“ (Grundton auf 1, Quinte auf 3), Posaune + Horn „Pa“ auf 2 und 4, Marsch-
    Snare mit Vorschlägen und Wirbeln, große Trommel auf 1 und 3, Becken-Crashes, Pauke. Trompeten + Horn tragen die Melodie,
    Flöte (Piccolo-Ersatz) und Glockenspiel setzen Glanz obenauf.
  • Aufbau wie ein echter Marsch: Fanfare-Intro → Strain A (Melodie, wird wiederholt, zweimal: leicht, dann voll) → Strain B
    (Kontrast, c-Moll/Es-Dur-Anstieg) → Trio (Es-Dur, weich und warm: Horn/Klarinette/Flöte — der „pensionierte Profi“ erinnert
    sich) → Drill (Ruf der Trompete, Antwort der Kompanie, Rufe steigen) → Reprise einen Ganzton höher (C-Dur) → Coda auf F (Dominante).
Form (64 Takte ≈ 1:56): Intro 4 · A 8 · A' 8 · B 8 · Trio 8 · Drill 8 · A'' +2 8 · B' +2 8 · Coda 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 132, 64
song = Song(BPM, BARS)
rng = random.Random(1944)

song.inst('trumpet', 'trumpet', vol=100, pan=62)
song.inst('brass', 'brass', vol=76, pan=54)            # zweite Stimme (Terz tiefer)
song.inst('horn', 'horns', vol=78, pan=46)
song.inst('trombone', 'trombone', vol=84, pan=76)
song.inst('tuba', 'tuba', vol=96, pan=60)
song.inst('flute', 'flute', vol=74, pan=84)
song.inst('clarinet', 'clarinet', vol=78, pan=40)
song.inst('glock', 'glock', vol=60, pan=70)
song.inst('timp', 'timp', vol=100, pan=64)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Bb': (10, 'M'), 'Eb': (3, 'M'), 'F7': (5, '7'), 'Gm': (7, 'm'), 'Cm': (0, 'm'), 'Ab': (8, 'M'),
      'Bb7': (10, '7'), 'C': (0, 'M'), 'F': (5, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(v + rng.randint(-3, 3))

MAJOR = (0, 2, 4, 5, 7, 9, 11)
def scale_step(midi, tonic_pc, steps):
    """Diatonisch um `steps` Stufen verschieben (negativ = abwärts); Töne außerhalb der Tonleiter: 1,5 Halbtöne pro Stufe."""
    pcs = {(tonic_pc + d) % 12 for d in MAJOR}
    if midi % 12 not in pcs: return midi + int(steps * 1.5)
    notes = [p for p in range(0, 128) if p % 12 in pcs]
    return notes[notes.index(midi) + steps]

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.85, harm=None, tonic='Bb'):
    tpc = (pn(tonic + '1') + shift) % 12
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                p = pn(name) + shift + 12 * octave
                if harm: p = scale_step(p, tpc, harm)
                song.add(inst, t, max(0.12, dur * legato), p, hv(vel))
            t += dur

# ═══ Material (B-Dur) ═════════════════════════════════════════════════════════════════════════════
A_CH = ['Bb', 'Eb', 'F7', 'Bb', 'Bb', 'Gm', 'F7', 'Bb']
A_MEL = [
    [('F5', .5), ('F5', .5), ('Bb5', 1), ('A5', .5), ('Bb5', .5), ('D6', 1)],
    [('C6', .5), ('C6', .5), ('Eb6', 1), ('D6', .5), ('C6', .5), ('Bb5', 1)],
    [('A5', .5), ('A5', .5), ('C6', 1), ('Bb5', .5), ('A5', .5), ('G5', 1)],
    [('Bb5', 3), (None, 1)],
    [('F5', .5), ('F5', .5), ('Bb5', 1), ('A5', .5), ('Bb5', .5), ('D6', 1)],
    [('Bb5', .5), ('Bb5', .5), ('D6', 1), ('C6', .5), ('Bb5', .5), ('G5', 1)],
    [('A5', 1), ('C6', 1), ('Eb6', 1), ('D6', 1)],
    [('D6', 3), (None, 1)],
]

B_CH = ['Cm', 'Gm', 'F7', 'Bb', 'Eb', 'Bb', 'F7', 'F7']
B_MEL = [
    [('Eb5', .5), ('G5', .5), ('C6', 1), ('Bb5', .5), ('G5', .5), ('Eb5', 1)],
    [('D5', .5), ('G5', .5), ('Bb5', 1), ('A5', .5), ('G5', .5), ('D5', 1)],
    [('C5', .5), ('F5', .5), ('A5', 1), ('G5', .5), ('F5', .5), ('Eb5', 1)],
    [('D5', 2), ('F5', 2)],
    [('G5', 1), ('Bb5', 1), ('Eb6', 2)],
    [('D6', 1), ('Bb5', 1), ('F5', 2)],
    [('A5', .5), ('C6', .5), ('Eb6', 1), ('D6', .5), ('C6', .5), ('A5', 1)],
    [('F6', .5), ('Eb6', .5), ('D6', .5), ('C6', .5), ('A5', 2)],
]

# Trio (Es-Dur): warm, singend — der Ausbilder erinnert sich
T_CH = ['Eb', 'Ab', 'Bb', 'Eb', 'Cm', 'Ab', 'Bb7', 'Bb']
T_MEL = [
    [('G5', 1.5), ('Bb5', .5), ('Eb6', 2)],
    [('C6', 1.5), ('Eb6', .5), ('Ab5', 2)],
    [('D6', 1), ('F6', 1), ('D6', 1), ('Bb5', 1)],
    [('G5', 3), (None, 1)],
    [('G5', 1.5), ('C6', .5), ('Eb6', 2)],
    [('Eb6', 1), ('C6', 1), ('Ab5', 2)],
    [('F5', 1), ('Ab5', 1), ('D6', 1), ('F6', 1)],
    [('D6', 2), ('F6', 2)],
]

# Drill: Ruf (Trompete) – Antwort (Kompanie); steigt Bb → C → D → F
CALLS = [('Bb4', 'Bb'), ('C5', 'Cm'), ('D5', 'Gm'), ('F5', 'Bb')]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def spans(chords): return list(enumerate(chords))

def umpa(bar0, chords, shift=0, vel=92, pah=True):
    """Tuba: Grundton auf 1, Quinte (tiefer) auf 3; Posaune + Horn: Akkord als „Pa“ auf 2 und 4."""
    for k, ch in spans(chords):
        T = tones(ch, 1, shift)
        r = T[0] + 12
        t = song.bar(bar0 + k)
        song.add('tuba', t, 1.0, r, hv(vel)); song.add('tuba', t + 2, 1.0, r - 5 if k % 2 == 0 else r, hv(vel - 6))
        if pah:
            tr, hn = tones(ch, 3, shift), tones(ch, 4, shift)
            for beat in (1, 3):
                for m in tr[:3]: song.add('trombone', t + beat, 0.45, m, hv(vel - 12))
                for m in (hn[1], hn[2]): song.add('horn', t + beat, 0.45, m, hv(vel - 22))

def snare(bar0, nbars, level=1.0, roll_every=4):
    """Marsch-Snare: Achtel, 16tel-Vorschläge vor 2 und 4, Akzente auf 2/4, Wirbel im letzten Takt einer Gruppe."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.dr(t, KICK, int(104 * level), 0.2); song.dr(t + 2, KICK, int(100 * level), 0.2)
        for i in range(8):
            v = 104 if i in (2, 6) else (82 if i % 2 == 0 else 68)
            song.dr(t + i * 0.5, SNARE, int(v * level), 0.1)
        for beat in (0.75, 1.75, 2.75, 3.75):
            song.dr(t + beat, SNARE, int(58 * level), 0.07)
        if k % 2 == 0: song.dr(t, CRASH, int(84 * level), 1.4)
        if roll_every and k % roll_every == roll_every - 1:
            for i in range(8):
                song.dr(t + 2 + i * 0.25, SNARE, int((62 + 6 * i) * level), 0.08)

def snare_soft(bar0, nbars, level=0.7):
    """Trio: leiserer Marschschritt — große Trommel auf 1 und 3, Snare nur auf 2 und 4."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.dr(t, KICK, int(92 * level), 0.2); song.dr(t + 2, KICK, int(88 * level), 0.2)
        for beat in (1, 3): song.dr(t + beat, SNARE, int(86 * level), 0.1)
        for i in range(8): song.dr(t + i * 0.5, SNARE, int(40 * level), 0.07)
        if k % 4 == 0: song.dr(t, CRASH, int(60 * level), 1.4)

def timp_march(bar0, chords, shift=0, vel=92):
    for k, ch in spans(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 2, 0.8, r, hv(vel - 8))
        song.add('timp', t + 3.5, 0.4, r, hv(vel - 24))

def roll(bar0, start, end, v0=50, v1=122):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def hit(beat, chord, shift=0, vel=104, dur=0.6, oct_=3):
    """Voller Blech-Stoß (Trompete, Horn, Posaune, Tuba)."""
    T = tones(chord, oct_, shift)
    for m in (T[0], T[1], T[2]):
        song.add('horn', beat, dur, m + 12, vel - 6); song.add('trombone', beat, dur, m, vel - 4)
    song.add('trumpet', beat, dur, T[0] + 24, vel); song.add('trumpet', beat, dur, T[2] + 12, vel - 6)
    song.add('tuba', beat, dur, T[0] - 12, vel)

def glock(bar0, chords, shift=0, vel=56):
    for k, ch in spans(chords):
        T = tones(ch, 5, shift)
        song.add('glock', song.bar(bar0 + k), 0.9, T[2] + 12, hv(vel))
        song.add('glock', song.bar(bar0 + k) + 2, 0.9, T[1] + 12, hv(vel - 8))

def strain(base, chords, melody, shift=0, vel=96, full=False, tonic='Bb'):
    """Marsch-Strain: Trompete (+Terz tiefer, Horn) tragen die Melodie; full: Flöte, Glockenspiel, Posaunen-Gegenlinie, Pauke."""
    mel('trumpet', base, melody, shift=shift, vel=vel, octave=-1, tonic=tonic)
    mel('brass', base, melody, shift=shift, vel=vel - 22, octave=-1, harm=-2, tonic=tonic)
    mel('horn', base, melody, shift=shift, vel=vel - 24, octave=-1, tonic=tonic)
    if full:
        mel('flute', base, melody, shift=shift, vel=76, octave=0, tonic=tonic)
        glock(base, chords, shift=shift)
        timp_march(base, chords, shift=shift, vel=98)
    umpa(base, chords, shift=shift, vel=94 if full else 88)
    snare(base, 8, level=1.1 if full else 0.95)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Wirbel, Trompetenruf, Blech-Stoß, Drill-Schläge ─────────────────────────────────────────
roll(b, 0, 8, 40, 118)
mel('trumpet', b + 2, [[('F5', .5), ('F5', .5), ('Bb5', 1), (None, 2)], [('F5', .5), ('F5', .5), ('Bb5', 1), ('D6', 2)]][0:2], vel=100, octave=-1, legato=.8)
mel('flute', b + 2, [[('F6', .5), ('F6', .5), ('Bb6', 1), (None, 2)], [('F6', .5), ('F6', .5), ('Bb6', 1), ('D7', 2)]][0:2], vel=70, octave=-1)
hit(song.bar(b + 1) + 2, 'Bb', vel=108, dur=1.8)
song.dr(song.bar(b + 1) + 2, CRASH, 108, 1.6)
timp_march(b + 2, ['Bb', 'F7'], vel=100)
umpa(b + 2, ['Bb', 'F7'], vel=92)
snare(b + 2, 2, level=1.0, roll_every=0)
roll(b + 3, 2, 4, 60, 126)
b += 4

# ── Strain A (8): Melodie, leicht ──────────────────────────────────────────────────────────────────────
strain(b, A_CH, A_MEL)
b += 8

# ── Strain A' (8): Wiederholung, voll — Flöte, Glockenspiel, Pauke ──────────────────────────────────────
strain(b, A_CH, A_MEL, vel=102, full=True)
b += 8

# ── Strain B (8): Kontrast, sprunghaft, Anstieg nach Es und F7 ──────────────────────────────────────────
strain(b, B_CH, B_MEL, vel=100, full=True)
roll(b + 7, 2, 4, 60, 124)
b += 8

# ── Trio (8): Es-Dur, warm — Horn und Klarinette singen, Flöte darüber, leiser Marschschritt ──────────────
mel('horn', b, T_MEL, vel=84, octave=-1, legato=.97, tonic='Eb')
mel('clarinet', b, T_MEL, vel=72, octave=0, legato=.97, tonic='Eb')
mel('flute', b, T_MEL, vel=62, octave=0, legato=.97, tonic='Eb')
mel('brass', b, T_MEL, vel=60, octave=-1, harm=-2, legato=.97, tonic='Eb')
for k, ch in spans(T_CH):
    T = tones(ch, 3)
    for m in T[:3]: song.add('trombone', song.bar(b + k), 3.9, m, 60)
umpa(b, T_CH, vel=78, pah=False)
snare_soft(b, 8)
glock(b, T_CH, vel=52)
timp_march(b, T_CH, vel=70)
b += 8

# ── Drill (8): Ruf (Trompete) – Antwort (Blech-Stoß + Wirbel); die Rufe steigen ──────────────────────────
for i, (note, ch) in enumerate(CALLS):
    base = b + 2 * i
    mel('trumpet', base, [[(note, .5), (note, .5), (note, 1), (None, 2)]], vel=104, legato=.8)
    song.add('trumpet', song.bar(base) + 1.0, 0.9, pn(note) + 7, 106)
    for beat in (0, 1): song.dr(song.bar(base) + beat, SNARE, 96, 0.1)
    hit(song.bar(base + 1), ch, vel=108, dur=0.8)
    song.dr(song.bar(base + 1), CRASH, 100, 1.2)
    song.dr(song.bar(base + 1), KICK, 110, 0.2); song.dr(song.bar(base + 1) + 1, KICK, 104, 0.2)
    for j in range(8): song.dr(song.bar(base + 1) + 2 + j * 0.25, SNARE, 70 + j * 7, 0.08)
    timp_march(base, [ch, ch], vel=88 + 4 * i)
    tuba_r = tones(ch, 1)[0] + 12
    for beat in (0, 2): song.add('tuba', song.bar(base) + beat, 0.9, tuba_r, 90)
roll(b + 7, 0, 4, 70, 127)
b += 8

# ── Reprise (8): einen Ganzton höher (C-Dur) — alles, noch lauter ───────────────────────────────────────
strain(b, A_CH, A_MEL, shift=2, vel=106, full=True)
mel('trombone', b, A_MEL, shift=2, vel=70, octave=-2, legato=.9)
b += 8

# ── Strain B' (8): +2, Ganzschluss ────────────────────────────────────────────────────────────────────
strain(b, B_CH, B_MEL, shift=2, vel=106, full=True)
mel('trombone', b, B_MEL, shift=2, vel=70, octave=-2, legato=.9)
roll(b + 7, 2, 4, 60, 124)
b += 8

# ── Coda (4): C-Dur-Fanfare, dann F-Dominante zurück in die B-Dur-Intro ─────────────────────────────────
OUT = ['C', 'F', 'F', 'F']
mel('trumpet', b, [[('G5', .5), ('G5', .5), ('C6', 1), ('E6', 2)], [('F6', 3), ('C6', 1)], [('A5', 4)], [('A5', 1.5), (None, 2.5)]], vel=104, octave=-1, legato=.9)
mel('brass', b, [[('G5', .5), ('G5', .5), ('C6', 1), ('E6', 2)], [('F6', 3), ('C6', 1)], [('A5', 4)], [('A5', 1.5), (None, 2.5)]], vel=84, octave=-1, harm=-2, legato=.9, tonic='C')
mel('flute', b, [[('G6', .5), ('G6', .5), ('C7', 1), ('E7', 2)], [('F7', 3), ('C7', 1)], [('A6', 4)], [('A6', 1.5), (None, 2.5)]], vel=66, octave=-1)
umpa(b, OUT[:3], vel=96)
timp_march(b, OUT[:3], vel=100)
snare(b, 3, level=1.05, roll_every=0)
hit(song.bar(b + 3), 'F', vel=108, dur=1.4)
song.dr(song.bar(b + 3), CRASH, 106, 1.5)
roll(b + 3, 2, 4, 60, 124)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('ALEX_NORENDER') != '1':
    sf2, out = cli_paths('bgm_alex.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.35)
