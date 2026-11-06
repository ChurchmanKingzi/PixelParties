# -*- coding: utf-8 -*-
"""Held-Thema „Key, the Cursed Thief“ → public/music/bgm_key.ogg                       Titel: „Wrong Place, Wrong Curse“

Key ist eine flinke, sarkastische, burschikose Diebin, die sich mit Mächten eingelassen hat, die weit über ihrem Kopf stehen.
Sie will No-Nonsense sein und stolpert ständig in absurde Situationen und Lebensgefahr (Card Art: dunkler Wald, Feuerball,
rotäugige Gestalt am Rand, Key selbst trocken und unbeeindruckt).

  • A-Moll / Phrygisch-Dominant (E7, ♭II = B♭), 144 BPM, 4/4. Heist-Funk-Rock mit Occult-Unterton:
    – „Schleichen“: federnder Pick-Bass in 16teln mit chromatischem Anschleich-Ton in den nächsten Grundton, Cembalo (Clavinet-Ersatz)
      und gedämpfte Gitarre als Stabs, Zupfstreicher auf den Offbeats; Funk-Schlagzeug mit Geisternoten und 16tel-Hi-Hat.
    – Sarkasmus: gedämpfte Trompete, Fagott und Klarinette, Pfeifen-Pings; trockene Stopps.
    – Der Fluch: Chor-Cluster mit Tritonus, Pauken-Schläge, Orchester-Hit und das ♭II (B♭) im Refrain.
  • Absurd-Break: Stop-Time, Zupf-Schleichen, Klarinetten-Panikläufe, Fagott-„Wah-Wah“, plötzlicher schwerer Halbzeit-Doom und
    wieder zurück — Key wird von einer Absurdität in die nächste geworfen.
  • Schluss-Refrain einen Halbton höher (B♭-Moll): jetzt wird’s ernst. Ausklang auf E7 (Dominante) → zurück in die A-Moll-Intro.
Form (64 Takte ≈ 1:47): Intro 4 · Riff A 8 · Refrain 8 · Riff A' 8 · Absurd-Break 8 · Refrain 8 · Chase-Solo 8 · Refrain +1 8 · Outro 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 144, 64
song = Song(BPM, BARS)
rng = random.Random(404)

song.inst('bass', 'bass2', vol=104, pan=60)
song.inst('clav', 'harpsichord', vol=84, pan=40)
song.inst('gtr', 'cleangtr', vol=74, pan=96)
song.inst('pizz', 'pizz', vol=82, pan=30)
song.inst('trumpet', 'muted', vol=96, pan=64)
song.inst('vibes', 'vibes', vol=72, pan=84)
song.inst('bassoon', 'bassoon', vol=84, pan=50)
song.inst('clarinet', 'clarinet', vol=84, pan=76)
song.inst('whistle', 'whistle', vol=72, pan=70)
song.inst('choir', 'choir', vol=62, pan=64)
song.inst('hit', 'hit', vol=96, pan=64)
song.inst('timp', 'timp', vol=100, pan=64)
song.inst('strings', 'slowstr', vol=64, pan=46)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Am': (9, 'm'), 'F': (5, 'M'), 'Dm': (2, 'm'), 'E7': (4, '7'), 'Bb': (10, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(v + rng.randint(-3, 3))

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.9):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.12, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# ═══ Material (A-Moll) ════════════════════════════════════════════════════════════════════════════
A_CH = ['Am', 'Am', 'F', 'E7', 'Am', 'Am', 'Bb', 'E7']
A_MEL = [
    [(None, .5), ('E5', .25), ('E5', .25), ('G5', .5), ('E5', .5), ('C5', .5), ('A4', .5), (None, .5), ('A4', .5)],
    [('B4', .5), ('C5', .5), ('B4', .5), ('G#4', .5), ('A4', 2)],
    [(None, .5), ('C5', .25), ('C5', .25), ('E5', .5), ('C5', .5), ('A4', .5), ('F4', .5), (None, 1)],
    [('G#4', .5), ('B4', .5), ('D5', .5), ('B4', .5), ('G#4', 1), (None, 1)],
    [(None, .5), ('E5', .25), ('E5', .25), ('G5', .5), ('E5', .5), ('C5', .5), ('A4', .5), (None, .5), ('A4', .5)],
    [('B4', .5), ('C5', .5), ('B4', .5), ('G#4', .5), ('A4', 1), (None, 1)],
    [(None, .5), ('D5', .25), ('D5', .25), ('F5', .5), ('D5', .5), ('Bb4', .5), ('F4', .5), (None, 1)],
    [('G#4', .5), ('B4', .5), ('D5', .5), ('F5', .5), ('E5', 2)],
]

HOOK_CH = ['Am', 'F', 'Dm', 'E7', 'Am', 'Bb', 'E7', 'E7']
HOOK = [
    [('A5', 1), ('G5', .5), ('E5', .5), ('C5', 1), ('E5', 1)],
    [('F5', 1), ('E5', .5), ('C5', .5), ('A4', 1), ('C5', 1)],
    [('D5', 1), ('F5', .5), ('A5', .5), ('G5', 1), ('F5', 1)],
    [('E5', 1.5), ('G#5', .5), ('B5', 2)],
    [('A5', 1), ('G5', .5), ('E5', .5), ('C5', 1), ('E5', 1)],
    [('Bb5', 1), ('A5', .5), ('F5', .5), ('D5', 1), ('F5', 1)],
    [('G#5', .5), ('G#5', .5), ('B5', 1), ('D6', 1), ('B5', 1)],
    [('E6', .5), ('D6', .5), ('B5', .5), ('G#5', .5), ('E5', 2)],
]

SOLO_CH = ['Am', 'Am', 'F', 'E7', 'Am', 'Dm', 'Bb', 'E7']
SOLO = [
    [('A4', .25), ('C5', .25), ('E5', .25), ('A5', .25), ('G#5', .25), ('E5', .25), ('C5', .25), ('E5', .25), ('A5', .5), ('G5', .5), ('E5', 1)],
    [('F5', .25), ('E5', .25), ('D#5', .25), ('E5', .25), ('C5', .5), ('A4', .5), ('B4', .5), ('G#4', .5), ('A4', 1)],
    [('A5', .25), ('G5', .25), ('F5', .25), ('E5', .25), ('F5', .5), ('A5', .5), ('C6', 1), ('A5', 1)],
    [('B5', .25), ('G#5', .25), ('E5', .25), ('G#5', .25), ('B5', .25), ('D6', .25), ('B5', .25), ('G#5', .25), ('E6', 2)],
    [('A5', .5), ('A5', .25), ('C6', .25), ('E6', .5), ('C6', .5), ('A5', 1), ('E5', 1)],
    [('D6', .25), ('C6', .25), ('Bb5', .25), ('A5', .25), ('F5', .5), ('A5', .5), ('D6', 2)],
    [('F6', .5), ('D6', .5), ('Bb5', .5), ('D6', .5), ('F6', 2)],
    [('G#5', .25), ('B5', .25), ('D6', .25), ('F6', .25), ('E6', .5), ('B5', .5), ('G#5', .5), ('E5', .5), (None, 1)],
]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root1(ch, shift=0):
    r = tones(ch, 1, shift)[0]
    return r + 12 if r < 28 else r

def bass(bar0, chords, shift=0, vel=100, sneak=False):
    """Funk-Bass in 16teln; auf 4& ein chromatischer Anschleichton unter dem nächsten Grundton."""
    pat = [(0, .45, 0), (.75, .2, 0), (1, .2, 12), (1.5, .4, 0), (2, .45, 0), (2.75, .2, 0), (3, .4, 7), (3.5, .4, None)]
    for k, ch in enumerate(chords):
        r = root1(ch, shift)
        nxt = root1(chords[(k + 1) % len(chords)], shift)
        for beat, dur, off in pat:
            if sneak and beat in (1, 2.75): continue
            p = (nxt - 1) if off is None else r + off
            song.add('bass', song.bar(bar0 + k) + beat, dur, p, hv(vel + (8 if beat % 1 == 0 else -6)))

def clav(bar0, chords, shift=0, vel=78, beats=(0.75, 1.5, 2.75, 3.5)):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        for beat in beats:
            for m in (T[0], T[1], T[2]):
                song.add('clav', song.bar(bar0 + k) + beat, 0.16, m, hv(vel))

def scratch(bar0, chords, shift=0, vel=70):
    """Gedämpfte Gitarre: 16tel-Chucks (laut-leise), Akkord kurz."""
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        for i in range(16):
            v = vel + (14 if i % 4 == 2 else (4 if i % 2 == 0 else -22))
            for m in (T[1], T[2], T[0] + 12):
                song.add('gtr', song.bar(bar0 + k) + i * 0.25, 0.1, m, hv(v))

def pizz(bar0, chords, shift=0, vel=66):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        for i, beat in enumerate((0.5, 1.5, 2.5, 3.5)):
            song.add('pizz', song.bar(bar0 + k) + beat, 0.2, T[(i + 1) % 3] + (12 if i % 2 else 0), hv(vel))

def curse_pad(bar0, chords, shift=0, vel=50):
    """Chor-Cluster mit Tritonus (Grundton, Quinte, ♭5 eine Oktave höher) + Streicher."""
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        for m in (T[0], T[2], T[0] + 18):
            song.add('choir', song.bar(bar0 + k), 3.9, m, vel)
        song.add('strings', song.bar(bar0 + k), 3.9, T[1] + 12, vel - 8)

def doom(bar0, chords, shift=0, vel=92):
    for k, ch in enumerate(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        song.add('timp', song.bar(bar0 + k), 0.8, r, vel)
        song.add('timp', song.bar(bar0 + k) + 2.5, 0.4, r, vel - 22)

def drums(bar0, nbars, style='funk', level=1.0, fills=True, crash=True):
    """funk (Geisternoten, 16tel-Hat) · hook (kräftiger, offene Hat) · sneak (Sidestick, leise) · half (Halbzeit-Doom)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'sneak':
            for beat in (1, 3): song.dr(t + beat, SIDESTICK, int(88 * L), 0.1)
            for i in range(8): song.dr(t + i * 0.5, HAT, int((84 if i % 2 == 0 else 70) * L), 0.06)
            song.dr(t, KICK, int(80 * L), 0.15)
        elif style == 'half':
            song.dr(t, KICK, int(108 * L), 0.2); song.dr(t + 2, SNARE, int(112 * L), 0.15); song.dr(t + 3.5, KICK, int(90 * L), 0.2)
            for i in range(4): song.dr(t + i, HAT, int(96 * L), 0.08)
            if k % 2 == 0: song.dr(t, CRASH, int(100 * L), 1.4)
        else:
            heavy = style == 'hook'
            for beat, v in ((0, 106), (1.75, 90), (2.5, 96)): song.dr(t + beat, KICK, int(v * L), 0.15)
            if heavy: song.dr(t + 3.75, KICK, int(80 * L), 0.15)
            for beat in (1, 3): song.dr(t + beat, SNARE, int((108 if heavy else 102) * L), 0.15)
            song.dr(t + 2.75, SNARE, int(40 * L), 0.08); song.dr(t + 3.75, SNARE, int(36 * L), 0.08)
            for i in range(16):
                if heavy and i == 6: song.dr(t + i * 0.25, OHAT, int(96 * L), 0.2); continue
                song.dr(t + i * 0.25, HAT, int((104 if i % 4 == 0 else (92 if i % 2 == 0 else 78)) * L), 0.06)
            if k == 0 and crash: song.dr(t, CRASH, int(106 * L), 1.5)
            if fills and k % 4 == 3:
                for j in range(6):
                    song.dr(t + 2.5 + j * 0.25, SNARE, int((70 + j * 10) * L), 0.1)
                song.dr(t + 2.5, TOM_H, 90, 0.1); song.dr(t + 3, TOM_M, 96, 0.1)

def roll(bar0, start, end, v0=50, v1=122):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n):
        song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def hit(beat, chord='Am', shift=0, vel=100, dur=0.5):
    T = tones(chord, 3, shift)
    for m in (T[0], T[2], T[0] + 12):
        song.add('hit', beat, dur, m, vel)

def hook_section(base, shift=0, vel=96, big=False, drumstyle='hook'):
    mel('trumpet', base, HOOK, shift=shift, vel=vel)
    mel('vibes', base, HOOK, shift=shift, vel=64, octave=1)
    mel('bassoon', base, HOOK, shift=shift, vel=70, octave=-1)
    if big: mel('clarinet', base, HOOK, shift=shift, vel=60, octave=1)
    bass(base, HOOK_CH, shift=shift, vel=104)
    clav(base, HOOK_CH, shift=shift, vel=76)
    scratch(base, HOOK_CH, shift=shift, vel=62)
    curse_pad(base, HOOK_CH, shift=shift, vel=54 + (8 if big else 0))
    doom(base, HOOK_CH, shift=shift)
    drums(base, 8, drumstyle)
    roll(base + 7, 3, 4, 70, 120)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Schleichen — Bass + Zupfstreicher, dann Cembalo, dann Band; Fill + Hit ─────────────────────
I_CH = ['Am', 'Am', 'F', 'E7']
bass(b, I_CH, vel=88, sneak=True)
pizz(b, I_CH, vel=60)
clav(b + 1, I_CH[1:], vel=60)
drums(b, 2, 'sneak')
drums(b + 2, 2, 'funk', level=0.9, fills=False, crash=False)
scratch(b + 2, I_CH[2:], vel=54)
for j in range(6): song.dr(song.bar(b + 3) + 2.5 + j * 0.25, SNARE, 70 + j * 10, 0.1)
song.dr(song.bar(b + 3) + 2.5, TOM_H, 92, 0.1); song.dr(song.bar(b + 3) + 3, TOM_M, 98, 0.1)
b += 4

# ── Riff A (8): Trompete trägt das Schleich-Motiv ──────────────────────────────────────────────────────
def riff_section(base, extra=False):
    mel('trumpet', base, A_MEL, vel=92)
    bass(base, A_CH, vel=102)
    clav(base, A_CH, vel=74)
    scratch(base, A_CH, vel=58)
    pizz(base, A_CH, vel=64)
    if extra:
        mel('vibes', base, A_MEL, vel=58, octave=1)
        mel('bassoon', base, A_MEL, vel=62, octave=-1)
    drums(base, 8, 'funk')

riff_section(b)
b += 8

# ── Refrain (8): der Fluch schlägt zu — Hook, Chor-Cluster, Pauken, ♭II (B♭) ───────────────────────────
hook_section(b)
b += 8

# ── Riff A' (8): mit Vibes und Fagott, Whistle-Pings auf den Pausen ───────────────────────────────────
riff_section(b, extra=True)
for k in (0, 4):
    song.add('whistle', song.bar(b + k) + 3.5, 0.3, pn('E6'), 80)
    song.add('whistle', song.bar(b + k) + 3.75, 0.2, pn('A6'), 84)
b += 8

# ── Absurd-Break (8): Stop-Time, Zupf-Schleichen, Panikläufe, Wah-Wah, Doom, Stopp ──────────────────────
hit(song.bar(b), 'Am', vel=104, dur=0.4)                                         # Takt 1: Hit, Stille
song.dr(song.bar(b), CRASH, 104, 1.0); song.dr(song.bar(b), KICK, 110, 0.2)
creep = [pn(n) for n in ('A3', 'A#3', 'B3', 'C4', 'C#4', 'D4', 'D#4', 'E4')]    # Takt 2: Schleich-Chromatik
for i, m in enumerate(creep):
    song.add('pizz', song.bar(b + 1) + i * 0.5, 0.3, m + 12, 56 + i * 3)
    song.add('bass', song.bar(b + 1) + i * 0.5, 0.35, m - 24, 60 + i * 3)
for beat in (1, 3): song.dr(song.bar(b + 1) + beat, SIDESTICK, 70, 0.1)
hit(song.bar(b + 2), 'E7', vel=110, dur=0.3)                                     # Takt 3: Hit + Klarinetten-Panik
song.dr(song.bar(b + 2), CRASH, 110, 1.0)
panic = ['E5', 'F5', 'E5', 'D#5', 'E5', 'G5', 'F#5', 'A5', 'G#5', 'B5', 'A#5', 'C#6', 'B5', 'D6']
for i, n in enumerate(panic):
    song.add('clarinet', song.bar(b + 2) + 0.5 + i * 0.25, 0.22, pn(n), 88 + (i % 3) * 4)
wah = [('A4', 1), ('G4', 1), ('F4', 1), ('E4', 1)]                               # Takt 4: Fagott „Wah-Wah“ abwärts, Pfeifen-Ping
mel('bassoon', b + 3, [wah], vel=92, legato=.7)
song.add('whistle', song.bar(b + 3) + 3.0, 0.5, pn('B6'), 84)
song.dr(song.bar(b + 3), SNARE, 80, 0.1); song.dr(song.bar(b + 3) + 2, SNARE, 90, 0.1)
doomch = ['Am', 'Am', 'F', 'E7']                                                 # Takte 5-8: schwerer Halbzeit-Doom
curse_pad(b + 4, doomch, vel=62)
doom(b + 4, doomch, vel=104)
clav(b + 4, doomch, vel=70, beats=(0, 2))
bass(b + 4, doomch, vel=102, sneak=True)
mel('trumpet', b + 4, [[('A4', 4)], [('C5', 3), ('B4', 1)], [('A4', 4)], [('G#4', 2), ('B4', 2)]], vel=96, legato=1.0)
drums(b + 4, 4, 'half', level=1.0)
roll(b + 7, 1, 4, 40, 124)
song.dr(song.bar(b + 7) + 3.5, CRASH, 100, 0.4)
b += 8

# ── Refrain 2 (8): mit Klarinette obendrauf ─────────────────────────────────────────────────────────
hook_section(b, vel=98, big=True)
b += 8

# ── Chase-Solo (8): gedämpfte Trompete jagt Sechzehntel durch die Harmonik ─────────────────────────────
mel('trumpet', b, SOLO, vel=100, legato=.85)
mel('clarinet', b, SOLO, vel=58, octave=1, legato=.85)
bass(b, SOLO_CH, vel=104)
clav(b, SOLO_CH, vel=78)
scratch(b, SOLO_CH, vel=64)
pizz(b, SOLO_CH, vel=62)
drums(b, 8, 'hook')
b += 8

# ── Refrain 3 (8): einen Halbton höher — jetzt wird’s ernst ─────────────────────────────────────────────
hook_section(b, shift=1, vel=104, big=True)
b += 8

# ── Outro (4): Hook-Zitat, E7-Dominante, Stopp ─────────────────────────────────────────────────────────
O_CH = ['Am', 'F', 'E7', 'E7']
mel('trumpet', b, [[('A5', 1), ('G5', .5), ('E5', .5), ('C5', 1), ('E5', 1)], [('F5', 1), ('E5', .5), ('C5', .5), ('A4', 1), ('C5', 1)], [('E5', 1.5), ('G#5', .5), ('B5', 2)], [('B5', 1), (None, 3)]], vel=100)
mel('bassoon', b, [[('A4', 1), ('G4', .5), ('E4', .5), ('C4', 1), ('E4', 1)], [('F4', 4)], [('E4', 4)], [('E4', 1), (None, 3)]], vel=76)
bass(b, O_CH, vel=104)
clav(b, O_CH, vel=74)
curse_pad(b, O_CH[:3], vel=60)
drums(b, 3, 'hook', fills=False)
doom(b, O_CH[:3], vel=98)
hit(song.bar(b + 3) + 1.0, 'E7', vel=110, dur=0.3)
song.dr(song.bar(b + 3) + 1.0, CRASH, 100, 0.8)
roll(b + 3, 2, 4, 50, 118)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('KEY_NORENDER') != '1':
    sf2, out = cli_paths('bgm_key.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.2)
