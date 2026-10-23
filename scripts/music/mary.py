# -*- coding: utf-8 -*-
"""Held-Thema „Cute Princess Mary“ → public/music/bgm_mary.ogg                          Titel: „Sovereign Skies“

Mary ist eine Prinzessin mit Phönixflügeln, die elegant und mächtig über ein weites Reich im Himmel regiert
(Card Art: goldene Flammenflügel vor rosa-orangem Himmel, Krone, weißes Kleid). Majestätisch — aber ein echter
Kampf-Track: schnell, treibend, dramatisch. Version 2 (v1 war zu langsam und friedlich).

  • D-Moll, 156 BPM, 4/4. Orchester-Action: rasende Streicher-16tel als Motor, Pauken- und Tom-Galopp, scharfe Snare auf 2/4,
    Hörner und Chor tragen das Thema mit der Solo-Violine; Harfe/Flöte nur noch als Glanz. Der Himmelsglanz kommt über
    Majestät und Höhe, nicht über Ruhe.
  • Thema: markant, rhythmisch (Repetition + Sprung zur Quinte, Aufstieg zur hohen Oktave) — Fanfare statt Schreiten.
    Bridge: lange, hohe Bögen über Bb–F–C–Dm. Der „Phönix steigt auf“-Moment: Schluss-Themen einen Ganzton höher (E-Moll)
    und am Ende Picardische Terz (E-Dur) → A (Dominante) → zurück zur D-Moll-Intro.
Form (64 Takte ≈ 1:38): Intro 4 · Charge 8 · Thema 8 · Thema voll 8 · Bridge 8 · Thema +2 8 · Break 8 · Finale 8 · Outro 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 156, 64
song = Song(BPM, BARS)
rng = random.Random(1812)

song.inst('violin', 'violin', vol=100, pan=60)       # Solo-Violine (Thema)
song.inst('flute', 'flute', vol=84, pan=76)
song.inst('harp', 'harp', vol=90, pan=44)
song.inst('glock', 'glock', vol=62, pan=84)
song.inst('ostinato', 'strings', vol=84, pan=34)     # spiccato Achtel
song.inst('pad', 'slowstr', vol=80, pan=94)
song.inst('horn', 'horns', vol=66, pan=52)
song.inst('choir', 'choir', vol=80, pan=64)
song.inst('oohs', 'oohs', vol=70, pan=72)
song.inst('organ', 'pipeorgan', vol=58, pan=64)
song.inst('bass', 'contra', vol=100, pan=62)
song.inst('timp', 'timp', vol=100, pan=64)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Dm': (2, 'm'), 'Bb': (10, 'M'), 'F': (5, 'M'), 'C': (0, 'M'), 'Gm': (7, 'm'), 'A': (9, 'M'), 'E': (4, 'M'), 'Em': (4, 'm')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return v + rng.randint(-3, 3)

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.97):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# ═══ Material (D-Moll) ═════════════════════════════════════════════════════════════════════════════
THEME = [
    [('D5', .5), ('D5', .5), ('A5', 1), ('G5', .5), ('F5', .5), ('E5', 1)],
    [('D5', .5), ('D5', .5), ('F5', 1), ('E5', .5), ('D5', .5), ('Bb4', 1)],
    [('C5', .5), ('C5', .5), ('A5', 1), ('G5', .5), ('F5', .5), ('C5', 1)],
    [('E5', 1.5), ('G5', .5), ('C6', 2)],
    [('D5', .5), ('D5', .5), ('A5', 1), ('D6', 1.5), ('C6', .5)],
    [('Bb5', 1.5), ('A5', .5), ('G5', 1), ('F5', 1)],
    [('G5', 1), ('Bb5', 1), ('D6', 2)],
]
THEME_END_OPEN = [('C#6', 1.5), ('E6', .5), ('A5', 2)]          # 8 über A (Dominante, Leitton)
THEME_END_CLOSED = [('D6', .5), ('A5', .5), ('F5', .5), ('D5', .5), ('D5', 2)]   # 8 über Dm
THEME_CH_OPEN = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A']
THEME_CH_CLOSED = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'Dm']

# Charge: Hörner-Motiv über dem Streichermotor, noch ohne vollständiges Thema
CHARGE_CH = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A']
CHARGE = [
    [('D5', .5), ('D5', .5), ('F5', 1), ('E5', .5), ('D5', .5), ('A4', 1)],
    [('D5', .5), ('D5', .5), ('F5', 1), ('E5', .5), ('D5', .5), ('A4', 1)],
    [('D5', .5), ('D5', .5), ('F5', 1), ('D5', .5), ('Bb4', .5), ('F4', 1)],
    [('E5', .5), ('E5', .5), ('G5', 1), ('E5', .5), ('C5', .5), ('G4', 1)],
    [('D5', .5), ('D5', .5), ('F5', 1), ('E5', .5), ('D5', .5), ('A4', 1)],
    [('D5', .5), ('D5', .5), ('A5', 1), ('G5', .5), ('F5', .5), ('E5', 1)],
    [('D5', .5), ('D5', .5), ('F5', 1), ('D5', .5), ('Bb4', .5), ('F4', 1)],
    [('E5', .5), ('E5', .5), ('A5', 1), ('G5', .5), ('E5', .5), ('C#5', 1)],
]

BRIDGE = [
    [('D6', 2), ('F6', 2)],
    [('C6', 1), ('F6', 1), ('A6', 2)],
    [('G6', 2), ('E6', 2)],
    [('F6', 3), ('D6', 1)],
    [('D6', 1), ('F6', 1), ('Bb6', 2)],
    [('A6', 1.5), ('G6', .5), ('F6', 2)],
    [('E6', 1), ('A6', 1), ('G6', 1), ('E6', 1)],
    [('C#6', 1), ('E6', 1), ('A6', 2)],
]
BRIDGE_CH = ['Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A', 'A']

# Break (8): Dichte nimmt ab, Spannung baut sich auf (Pauke + Streicher + Chor), kein Schlagzeug bis zum Wirbel
BREAK = [
    [('A5', 4)], [('A5', 2), ('G5', 2)], [('F5', 4)], [('F5', 2), ('G5', 2)],
    [('G5', 2), ('Bb5', 2)], [('D6', 4)], [('C#6', 2), ('E6', 2)], [('A5', 3), (None, 1)],
]
BREAK_CH = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'Gm', 'A', 'A']

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def spans(chords):
    return [(k, 0, 4, c) for k, c in enumerate(chords)]

def ostinato(bar0, chords, shift=0, vel=70, dur=0.2, eighth=False):
    """Treibende Streicher-Sechzehntel (spiccato): Grundton – Grundton – Quinte – Grundton | Grundton – Quinte – Oktave – Quinte."""
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        pat = (T[0], T[0], T[2], T[0], T[0], T[2], T[0] + 12, T[2])
        steps = 8 if eighth else 16
        for i in range(steps):
            t = song.bar(bar0 + k) + i * (0.5 if eighth else 0.25)
            song.add('ostinato', t, dur * (2 if eighth else 1), pat[i % 8], hv(vel + (14 if i % 4 == 0 else (6 if i % 2 == 0 else 0))))

def pad(bar0, chords, shift=0, vel=58, inst='pad'):
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[0], T[1], T[2], T[0] + 12):
            song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def harp_arp(bar0, chords, shift=0, vel=70, rise=False):
    """Harfen-Arpeggio in Achteln über zwei Oktaven (hoch und wieder herunter); mit rise=True ein Skalenlauf in 16teln zum Taktanfang."""
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        notes = [T[0], T[1], T[2], T[0] + 12, T[1] + 12, T[2] + 12, T[0] + 24, T[2] + 12]
        for i, m in enumerate(notes):
            song.add('harp', song.bar(bar0 + k) + i * 0.5, 1.2, m, hv(vel + (6 if i % 2 == 0 else 0)))
        if rise and k % 2 == 1:
            run = [T[0] + 12, T[1] + 12, T[2] + 12, T[0] + 24, T[1] + 24, T[2] + 24]
            for i, m in enumerate(run):
                song.add('harp', song.bar(bar0 + k) + 3.0 + i * 0.1667, 0.5, m, hv(vel + 4 + 2 * i))

def bass(bar0, chords, shift=0, vel=96):
    """Kontrabass in pumpenden Achteln, Oktavsprung auf 3&."""
    for k, off, _, ch in spans(chords):
        r = tones(ch, 1, shift)[0] + 12
        if r > 50: r -= 12
        for i in range(8):
            song.add('bass', song.bar(bar0 + k) + i * 0.5, 0.42, r + (12 if i == 5 else 0), hv(vel + (8 if i % 2 == 0 else -6)))

def timp(bar0, chords, shift=0, vel=96):
    """Pauken-Galopp: 1 · 1& · 2& · 3 · 3& · 4&."""
    for k, off, _, ch in spans(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        for beat, v in ((0, 0), (0.5, -26), (1.5, -16), (2, -4), (2.5, -26), (3.5, -16)):
            song.add('timp', song.bar(bar0 + k) + beat, 0.4, r, hv(vel + v))

def timp_roll(beat, dur, note, v0=40, v1=110):
    n = int(dur * 4)
    for i in range(n):
        song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def drums(bar0, nbars, level=1.0, crash=True, fills=True):
    """Orchester-Action-Beat: Kick auf 1, 2&, 3; Snare auf 2 und 4; Hi-Hat-Achtel; Tom-Fill alle 4 Takte."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.dr(t, KICK, int(104 * level), 0.2); song.dr(t + 1.5, KICK, int(88 * level), 0.2); song.dr(t + 2, KICK, int(100 * level), 0.2)
        song.dr(t + 1, SNARE, int(104 * level), 0.15); song.dr(t + 3, SNARE, int(108 * level), 0.15)
        for i in range(8): song.dr(t + i * 0.5, HAT, int((98 if i % 2 == 0 else 84) * level), 0.08)
        if k == 0 and crash:
            song.dr(t, CRASH, int(108 * level), 1.6)
        if fills and k % 4 == 3:
            for j, tom in enumerate((TOM_H, TOM_H, TOM_M, TOM_L)):
                song.dr(t + 2.5 + j * 0.375, tom, int((92 + 6 * j) * level), 0.12)

def snare_roll(bar0, start, end, v0=44, v1=116):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n):
        song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def glock(bar0, chords, shift=0, vel=58):
    for k, off, _, ch in spans(chords):
        T = tones(ch, 5, shift)
        song.add('glock', song.bar(bar0 + k), 1.0, T[2] + 12, hv(vel))
        song.add('glock', song.bar(bar0 + k) + 2, 1.0, T[1] + 12 if ch[-1] != 'm' else T[1] + 12, hv(vel - 8))

def choir_pad(bar0, chords, shift=0, vel=62):
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('choir', song.bar(bar0 + k), 3.9, m, vel)
        song.add('oohs', song.bar(bar0 + k), 3.9, T[2] + 12, vel - 12)

def horn_pad(bar0, chords, shift=0, vel=58):
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[0], T[2]):
            song.add('horn', song.bar(bar0 + k), 3.9, m, vel)

def organ(bar0, chords, shift=0, vel=50):
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[0] - 12, T[0], T[2], T[0] + 12):
            song.add('organ', song.bar(bar0 + k), 3.95, m, vel)

def theme(base, chords, end, shift=0, vel=96, full=False):
    mel('violin', base, THEME, shift=shift, vel=vel); mel('violin', base + 7, [end], shift=shift, vel=vel)
    mel('flute', base, THEME, shift=shift, vel=70, octave=1); mel('flute', base + 7, [end], shift=shift, vel=70, octave=1)
    mel('horn', base, THEME, shift=shift, vel=78 if full else 64, octave=-1); mel('horn', base + 7, [end], shift=shift, vel=78 if full else 64, octave=-1)
    if full:
        mel('choir', base, THEME, shift=shift, vel=74, octave=-1); mel('choir', base + 7, [end], shift=shift, vel=74, octave=-1)
        organ(base, chords, shift=shift, vel=46)
    timp(base, chords, shift=shift, vel=100 if full else 90)
    drums(base, 8, level=1.1 if full else 1.0)
    ostinato(base, chords, shift=shift, vel=72 + (8 if full else 0))
    pad(base, chords, shift=shift, vel=50)
    bass(base, chords, shift=shift, vel=98)
    glock(base, chords, shift=shift, vel=50)
    if full: harp_arp(base, chords, shift=shift, vel=54)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Pauken-Wirbel, Streicher-Motor setzt ein, Hörner-Stoß ─────────────────────────────────
INTRO_CH = ['Dm', 'Dm', 'Bb', 'A']
ostinato(b, INTRO_CH, vel=60)
bass(b + 2, INTRO_CH[2:], vel=92)
timp_roll(song.bar(b), 8.0, pn('D3'), 40, 108)
for m in (pn('D4'), pn('A4'), pn('D5')): song.add('horn', song.bar(b + 2), 3.9, m, 84)
choir_pad(b + 2, INTRO_CH[2:], vel=56)
mel('flute', b, [[(None, 4)], [(None, 4)], [('D6', 2), ('A5', 2)], [('E6', 3), (None, 1)]], vel=72)
song.dr(song.bar(b), CRASH, 100, 1.6); song.dr(song.bar(b + 2), CRASH, 96, 1.6)
snare_roll(b + 3, 0, 4, 56, 124)
b += 4

# ── Charge (8): Hörner-Motiv, Motor, Bass, Pauke — Aufmarsch ────────────────────────────────────────
mel('horn', b, CHARGE, vel=86)
mel('violin', b + 4, CHARGE[4:], vel=76, octave=1)
ostinato(b, CHARGE_CH, vel=74)
bass(b, CHARGE_CH, vel=98)
timp(b, CHARGE_CH, vel=96)
drums(b, 8, level=1.0)
pad(b, CHARGE_CH, vel=46)
b += 8

# ── Thema 1 (8) ──────────────────────────────────────────────────────────────────────────────────────
theme(b, THEME_CH_OPEN, THEME_END_OPEN)
b += 8

# ── Thema 2 (8): voll — Chor, Orgel, Harfe ───────────────────────────────────────────────────────────
theme(b, THEME_CH_CLOSED, THEME_END_CLOSED, vel=102, full=True)
b += 8

# ── Bridge (8): lange hohe Bögen, Chor, Motor läuft weiter ───────────────────────────────────────────
mel('violin', b, BRIDGE, vel=102)
mel('flute', b, BRIDGE, vel=66)
mel('choir', b, BRIDGE, vel=66, octave=-1)
mel('horn', b, BRIDGE, vel=66, octave=-1)
ostinato(b, BRIDGE_CH, vel=72)
pad(b, BRIDGE_CH, vel=56)
bass(b, BRIDGE_CH, vel=96)
timp(b, BRIDGE_CH, vel=94)
drums(b, 8, level=1.0)
glock(b, BRIDGE_CH, vel=54)
harp_arp(b, BRIDGE_CH, vel=58, rise=True)
snare_roll(b + 7, 1, 4, 56, 126)
timp_roll(song.bar(b + 7) + 2, 2.0, pn('A2'), 50, 118)
b += 8

# ── Thema 3 (8): +2 (E-Moll) — der Phönix steigt auf ─────────────────────────────────────────────────
theme(b, THEME_CH_OPEN, THEME_END_OPEN, shift=2, vel=104, full=True)
b += 8

# ── Break (8): Spannung — Streicher-Achtel, Pauke, Chor, kein Schlagzeug, dann Wirbel ─────────────────
mel('violin', b, BREAK, vel=84)
mel('choir', b, BREAK, vel=64, octave=-1)
mel('flute', b, BREAK, vel=60, octave=1)
ostinato(b, BREAK_CH, vel=58, eighth=True)
pad(b, BREAK_CH, vel=56)
bass(b, BREAK_CH, vel=88)
for k in range(8):
    r = tones(BREAK_CH[k], 2)[0] + 12
    if r > 55: r -= 12
    song.add('timp', song.bar(b + k), 1.8, r, 64 + k * 5)
    song.add('timp', song.bar(b + k) + 2, 1.8, r, 56 + k * 5)
harp_arp(b, BREAK_CH, vel=52)
timp_roll(song.bar(b + 6), 8.0, pn('A2'), 40, 120)
snare_roll(b + 6, 0, 8, 40, 124)
b += 8

# ── Finale (8): E-Moll, alles — Ganzschluss ───────────────────────────────────────────────────────────
theme(b, THEME_CH_CLOSED, THEME_END_CLOSED, shift=2, vel=108, full=True)
b += 8

# ── Outro (4): E-Dur (Picardische Terz) → A → A → A (Dominante zur D-Moll-Intro) ───────────────────────
OUT_CH = ['E', 'A', 'A', 'A']
mel('violin', b, [[('G#5', 1), ('B5', 1), ('E6', 2)], [('E6', 2), ('C#6', 1), ('A5', 1)], [('A5', 3), (None, 1)], [(None, 4)]], vel=100)
choir_pad(b, OUT_CH[:3], vel=68)
horn_pad(b, OUT_CH[:3], vel=66)
ostinato(b, OUT_CH, vel=70)
pad(b, OUT_CH, vel=58)
bass(b, OUT_CH[:3], vel=96)
timp(b, OUT_CH[:2], vel=98)
drums(b, 2, level=1.05, fills=False)
timp_roll(song.bar(b + 2), 6.0, pn('A2'), 50, 120)
snare_roll(b + 3, 0, 4, 46, 126)
song.dr(song.bar(b + 3) + 3.5, CRASH, 84, 0.6)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('MARY_NORENDER') != '1':
    sf2, out = cli_paths('bgm_mary.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.2)
