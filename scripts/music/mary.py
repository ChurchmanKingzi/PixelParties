# -*- coding: utf-8 -*-
"""Held-Thema „Cute Princess Mary“ → public/music/bgm_mary.ogg                          Titel: „Sovereign Skies“

Mary ist eine Prinzessin mit Phönixflügeln, die elegant und mächtig über ein weites Reich im Himmel regiert
(Card Art: goldene Flammenflügel vor rosa-orangem Himmel, Krone, weißes Kleid). Der Track soll majestätisch klingen —
edel, weit, strahlend, nie hektisch — und bleibt trotzdem ein Kampf-Track (federnder Streicher-Puls, Pauke, Trommel).

  • D-Dur, 126 BPM, 4/4. Orchester statt Rock/Blech: Solo-Violine + Flöte tragen das Thema, Harfe läuft in Phönix-Arpeggien
    (aufsteigende Skalenläufe), Streicher-Ostinato (Achtel) gibt den Puls, Kontrabass, Pauke, Chor (Aahs/Oohs), Horn nur als
    weiche Stütze, Glockenspiel funkelt, Pfeifenorgel im Finale.
  • Thema: weite Intervalle (Sprung zur Quinte, lange Töne, Abstieg in Stufen) — „würdevoll schreitend“. Zweiter Teil
    (Bridge) schwingt sich in lange Bögen nach oben. Die Schluss-Themen stehen einen Ganzton höher (E-Dur: Sonnenaufgang).
  • Interlude: nur Harfe, Flöte und Chor — der Blick über das Reich — dann bricht das Orchester wieder los.
Form (56 Takte ≈ 1:47): Intro 4 · Thema 8 · Thema 8 (voll) · Bridge 8 · Thema E 8 · Interlude 8 · Thema E 8 (Finale) · Outro 4
Ausklang E → A → A → A (Dominante) führt zurück in die D-Dur-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 126, 56
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

CH = {'D': (2, 'M'), 'A': (9, 'M'), 'Bm': (11, 'm'), 'G': (7, 'M'), 'E': (4, 'M'), 'F#m': (6, 'm'), 'Em': (4, 'm')}
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

# ═══ Material (D-Dur) ═════════════════════════════════════════════════════════════════════════════
THEME = [
    [('D5', 1), ('F#5', 1), ('A5', 2)],
    [('A5', 1.5), ('F#5', .5), ('E5', 2)],
    [('D5', 1), ('F#5', 1), ('B5', 2)],
    [('B5', 1.5), ('A5', .5), ('G5', 2)],
    [('F#5', 1), ('A5', 1), ('D6', 2)],
    [('C#6', 1.5), ('B5', .5), ('A5', 2)],
    [('G5', 1), ('B5', 1), ('A5', 1), ('G5', 1)],
]
THEME_END_OPEN = [('F#5', 2), ('E5', 1), (None, 1)]          # 8 über A
THEME_END_CLOSED = [('D5', 4)]                                # 8 über D
THEME_CH_OPEN = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A']
THEME_CH_CLOSED = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D']

BRIDGE = [
    [('D6', 2), ('B5', 2)],
    [('B5', 1), ('D6', 1), ('G6', 2)],
    [('F#6', 2), ('D6', 2)],
    [('E6', 3), ('C#6', 1)],
    [('D6', 1), ('F#6', 1), ('A6', 2)],
    [('G6', 1.5), ('F#6', .5), ('E6', 2)],
    [('C#6', 1), ('E6', 1), ('A6', 2)],
    [('A6', 3), (None, 1)],
]
BRIDGE_CH = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'A']

# Interlude (Harfe/Flöte/Chor): ruhiger Blick über das Reich
INTER = [
    [('F#5', 2), ('A5', 2)],
    [('E5', 2), ('G5', 2)],
    [('D5', 2), ('F#5', 2)],
    [('E5', 3), ('C#5', 1)],
    [('D5', 2), ('F#5', 2)],
    [('G5', 2), ('B5', 2)],
    [('A5', 2), ('E5', 2)],
    [('E5', 3), (None, 1)],
]
INTER_CH = ['D', 'A', 'Bm', 'A', 'G', 'D', 'A', 'A']

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def spans(chords):
    return [(k, 0, 4, c) for k, c in enumerate(chords)]

def ostinato(bar0, chords, shift=0, vel=70, dur=0.42):
    """Springende Streicher-Achtel: Grundton – Quinte – Oktave – Quinte."""
    for k, off, _, ch in spans(chords):
        T = tones(ch, 3, shift)
        pat = (T[0], T[2], T[0] + 12, T[2])
        for i in range(8):
            song.add('ostinato', song.bar(bar0 + k) + i * 0.5, dur, pat[i % 4], hv(vel + (8 if i % 2 == 0 else 0)))

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
    for k, off, _, ch in spans(chords):
        r = tones(ch, 1, shift)[0] + 12
        if r > 50: r -= 12
        song.add('bass', song.bar(bar0 + k), 1.9, r, vel)
        song.add('bass', song.bar(bar0 + k) + 2, 1.9, r + 7 if k % 2 == 0 else r, vel - 8)

def timp(bar0, chords, shift=0, vel=96):
    for k, off, _, ch in spans(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        song.add('timp', song.bar(bar0 + k), 0.9, r, vel)
        song.add('timp', song.bar(bar0 + k) + 2, 0.9, r, vel - 14)
        song.add('timp', song.bar(bar0 + k) + 3.5, 0.4, r, vel - 30)

def timp_roll(beat, dur, note, v0=40, v1=110):
    n = int(dur * 4)
    for i in range(n):
        song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def drums(bar0, nbars, level=1.0, crash=True):
    """Zurückhaltender Marsch: Kick auf 1/3, kleine Trommel auf 2/4, Crash am Abschnittsanfang; keine Hi-Hat."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.dr(t, KICK, int(78 * level), 0.2); song.dr(t + 2, KICK, int(72 * level), 0.2)
        song.dr(t + 1, SNARE, int(72 * level), 0.15); song.dr(t + 3, SNARE, int(76 * level), 0.15)
        if k % 2 == 1:
            song.dr(t + 3.5, SNARE, int(58 * level), 0.1)
        if k == 0 and crash:
            song.dr(t, CRASH, int(96 * level), 1.6)

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

def theme(base, chords, end, shift=0, vel=96, full=False, closed=False):
    mel('violin', base, THEME, shift=shift, vel=vel); mel('violin', base + 7, [end], shift=shift, vel=vel)
    mel('flute', base, THEME, shift=shift, vel=76, octave=1); mel('flute', base + 7, [end], shift=shift, vel=76, octave=1)
    if full:
        mel('choir', base, THEME, shift=shift, vel=72, octave=-1); mel('choir', base + 7, [end], shift=shift, vel=72, octave=-1)
        mel('horn', base, THEME, shift=shift, vel=64, octave=-1); mel('horn', base + 7, [end], shift=shift, vel=64, octave=-1)
        organ(base, chords, shift=shift, vel=48)
        timp(base, chords, shift=shift, vel=98)
        drums(base, 8, level=1.1)
    else:
        horn_pad(base, chords, shift=shift, vel=52)
        timp(base, chords, shift=shift, vel=84)
        drums(base, 8, level=0.8)
    ostinato(base, chords, shift=shift, vel=68 + (8 if full else 0))
    pad(base, chords, shift=shift, vel=54)
    harp_arp(base, chords, shift=shift, vel=64, rise=True)
    bass(base, chords, shift=shift, vel=96)
    glock(base, chords, shift=shift)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Harfen-Glissando, Flöte, Pauken-Wirbel, Streicher schwellen an ───────────────────────────
INTRO_CH = ['D', 'D', 'G', 'A']
harp_arp(b, INTRO_CH, vel=66, rise=True)
pad(b, INTRO_CH, vel=48)
choir_pad(b + 2, INTRO_CH[2:], vel=48)
mel('flute', b, [[('A5', 2), ('F#5', 1), ('D5', 1)], [('A5', 3), (None, 1)], [('B5', 2), ('G5', 2)], [('E5', 3), (None, 1)]], vel=72)
timp_roll(song.bar(b + 2), 4.0, pn('D3'), 36, 96)
timp_roll(song.bar(b + 3) + 2, 2.0, pn('A2'), 50, 112)
bass(b + 2, INTRO_CH[2:], vel=84)
song.dr(song.bar(b), CRASH, 90, 1.6)
snare_roll(b + 3, 2, 4, 50, 118)
b += 4

# ── Thema 1 (8): leicht ─────────────────────────────────────────────────────────────────────────────
theme(b, THEME_CH_OPEN, THEME_END_OPEN)
b += 8

# ── Thema 2 (8): voll — Chor trägt, Orgel, Horn, Pauke ─────────────────────────────────────────────────
theme(b, THEME_CH_CLOSED, THEME_END_CLOSED, vel=100, full=True)
b += 8

# ── Bridge (8): lange Bögen nach oben, Chor, Streicher voran ───────────────────────────────────────────
mel('violin', b, BRIDGE, vel=100)
mel('flute', b, BRIDGE, vel=70, octave=0)
mel('choir', b, BRIDGE, vel=66, octave=-1)
ostinato(b, BRIDGE_CH, vel=64)
pad(b, BRIDGE_CH, vel=60)
harp_arp(b, BRIDGE_CH, vel=64, rise=True)
horn_pad(b, BRIDGE_CH, vel=58)
timp(b, BRIDGE_CH, vel=88)
bass(b, BRIDGE_CH, vel=96)
glock(b, BRIDGE_CH, vel=54)
drums(b, 8, level=0.9, crash=True)
snare_roll(b + 7, 1, 4, 50, 122)
timp_roll(song.bar(b + 7) + 2, 2.0, pn('A2'), 50, 114)
b += 8

# ── Thema 3 (8): E-Dur — Rückung um einen Ganzton, Sonnenaufgang ─────────────────────────────────────────
theme(b, THEME_CH_OPEN, THEME_END_OPEN, shift=2, vel=102, full=True)
b += 8

# ── Interlude (8): Harfe, Flöte, Chor — der Blick über das Reich (leise, ohne Schlagwerk) ──────────────────
mel('flute', b, INTER, vel=76, octave=0)
mel('violin', b + 4, INTER[4:], vel=70)
choir_pad(b, INTER_CH, vel=58)
harp_arp(b, INTER_CH, vel=68)
pad(b, INTER_CH, vel=46)
bass(b, INTER_CH, vel=78)
glock(b, INTER_CH, vel=60)
for k in range(8):
    song.dr(song.bar(b + k), KICK, 56, 0.2)
timp_roll(song.bar(b + 7) + 0, 4.0, pn('A2'), 36, 100)
snare_roll(b + 7, 2, 4, 40, 120)
b += 8

# ── Thema 4 (8): Finale in E-Dur, alles — Ganzschluss ──────────────────────────────────────────────────
theme(b, THEME_CH_CLOSED, THEME_END_CLOSED, shift=2, vel=106, full=True)
b += 8

# ── Outro (4): E → A → A → A (Dominante zur D-Dur-Intro), Harfenlauf, Pauken-Wirbel ───────────────────────
OUT_CH = ['E', 'A', 'A', 'A']
mel('violin', b, [[('G#5', 1), ('B5', 1), ('E6', 2)], [('E6', 2), ('C#6', 1), ('A5', 1)], [('A5', 3), (None, 1)], [(None, 4)]], vel=98)
choir_pad(b, OUT_CH[:3], vel=66)
horn_pad(b, OUT_CH[:3], vel=62)
harp_arp(b, OUT_CH, vel=66)
pad(b, OUT_CH, vel=58)
bass(b, OUT_CH[:3], vel=96)
timp(b, OUT_CH[:2], vel=96)
drums(b, 2, level=1.0)
timp_roll(song.bar(b + 2), 6.0, pn('A2'), 50, 118)
snare_roll(b + 3, 0, 4, 46, 124)
song.dr(song.bar(b + 3) + 3.5, CRASH, 84, 0.6)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('MARY_NORENDER') != '1':
    sf2, out = cli_paths('bgm_mary.ogg')
    song.render(sf2, out, target_rms=0.25, saturate=False, compress=True, air_cut=0.25)
