# -*- coding: utf-8 -*-
"""Held-Thema „Elana, the Rocky Rebel“ → public/music/bgm_elana.ogg                       Titel: „Loud for You“

Elana ist E-Gitarristin und Rockstar — sie „kämpft“ weniger, als dass sie ihre Leute unterstützt. Version 4: Punkrock
statt Heldenhymne. Das „Heldenhafte“ steckte in Dur-Bögen, Chor, Rückung und Fanfaren-Schluss — all das fliegt raus.

  • E-Moll-Pentatonik (geschrieben in G, KEY = -3), 188 BPM, nur Powerchords (E5 – G5 – A5 – D5 – B5), keine Terzen
    im Akkord, keine Orgel, keine Streicher, keine Rückung. Verzerrte Gitarren L/R, Pick-Bass in durchgehenden Achteln.
  • Melodie = Shout-Chant: kurze, synkopierte, wiederholte Töne (Lead-Gitarre + leise Stimme), Gang-„Hey!“ statt Chor.
  • Punk-Schlagzeug: Snare auf 2/4, Hi-Hat-Achtel, im letzten Refrain Kick-Achtel-Galopp; Break mit Halftime-Chug.
Form (80 Takte ≈ 1:42): Intro 4 · Strophe 8 · Pre 4 · Refrain 8 · Strophe 8 · Pre 4 · Refrain 8 · Break 8 · Solo 8 · Refrain 8 · Refrain (Galopp) 8 · Outro 4
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 188, 80
KEY = -3          # Grundton E statt G: offene E-Saite, Standard-Rockgitarren-Tonart
song = Song(BPM, BARS)
rng = random.Random(1977)

song.inst('lead', 'rockgtr', vol=104, pan=64)       # Lead-Gitarre (Riff, Hook, Solo)
song.inst('gtrL', 'rockgtr', vol=100, pan=18)
song.inst('gtrR', 'rockgtr', vol=98, pan=110)
song.inst('clean', 'cleangtr', vol=70, pan=92)
song.inst('bass', 'bass2', vol=102, pan=60)
song.inst('organ', 'rockorgan', vol=60, pan=46)
song.inst('lead2', 'rockgtr', vol=80, pan=30)       # zweite Lead-Gitarre (Twin-Guitar-Oktave)
song.inst('choir', 'choir', vol=44, pan=64)         # Mitgröl-Chor (Aahs, Gang-„Hey!“)
song.inst('oohs', 'oohs', vol=36, pan=74)
song.inst('vox', 'solovoice', vol=70, pan=58)       # Solo-Voice leise als „Gesang“ unter der Gitarre
song.inst('strings', 'slowstr', vol=40, pan=40)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a + KEY

CH = {'G': (7, 'P'), 'Bb': (10, 'P'), 'C': (0, 'P'), 'F': (5, 'P'), 'D': (2, 'P')}
QUAL = {'P': (0, 7, 12)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift + KEY) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return v + rng.randint(-3, 3)

def spans(chords):
    out = []
    for k, c in enumerate(chords):
        if isinstance(c, tuple):
            out += [(k, 0, 2, c[0]), (k, 2, 2, c[1])]
        else:
            out.append((k, 0, 4, c))
    return out

# ── Pitch-Bend: Bends und Vibrato der Lead-Gitarre ────────────────────────────────────────────────
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):      # ±12 Halbtöne
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))

def bend(name, beat, norm):
    ch = song.ch[name][0]
    song.ev.append((int(round(beat * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, norm * 8192))))))

bend_setup('lead')

def vibrato(name, beat, dur, depth=0.028, rate=5.6, delay=0.35):
    """Sanftes Gitarren-Vibrato (≈ ±0,3 Halbton) nach einer kurzen Verzögerung."""
    sec_per_beat = 60.0 / BPM
    n = int(dur * 8)
    for i in range(n + 1):
        t = i / 8.0
        if t < delay: continue
        bend(name, beat + t, depth * math.sin(2 * math.pi * rate * (t - delay) * sec_per_beat) * min(1, (t - delay) / 0.5))
    bend(name, beat + dur + 0.01, 0)

def bend_up(name, beat, semis=1.0, rise=0.25):
    """Ton an (zeitgleich mit der Note gesetzt): von unten angezogen auf Tonhöhe (Pre-Bend) → hochziehen."""
    bend(name, beat, -semis / 12.0); bend(name, beat + rise, 0)

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.95, vib=True, vibmin=2.0):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, dur * legato, pn(name) + shift + 12 * octave, hv(vel))
                if vib and inst == 'lead' and dur >= vibmin:
                    vibrato('lead', t, dur * legato)
            t += dur

# ═══ Material ═══════════════════════════════════════════════════════════════════════════════════
RIFF = [
    [('G4', .5), ('G4', .5), ('Bb4', .5), ('G4', .5), ('C5', 1), ('Bb4', .5), ('G4', .5)],
    [('G4', .5), ('G4', .5), ('Bb4', .5), ('G4', .5), ('D5', 1), ('C5', 1)],
]
INTRO_CH = ['G', 'G', 'G', 'D']

VERSE = [
    [(None, .5), ('G4', .5), ('G4', .5), ('Bb4', .5), ('D5', 1), ('Bb4', 1)],
    [(None, .5), ('G4', .5), ('G4', .5), ('Bb4', .5), ('C5', 1), ('Bb4', 1)],
    [(None, .5), ('Bb4', .5), ('Bb4', .5), ('D5', .5), ('F5', 1), ('D5', 1)],
    [('C5', .5), ('C5', .5), ('D5', .5), ('C5', .5), ('Bb4', 2)],
    [(None, .5), ('G4', .5), ('G4', .5), ('Bb4', .5), ('D5', 1), ('Bb4', 1)],
    [(None, .5), ('G4', .5), ('G4', .5), ('Bb4', .5), ('C5', 1), ('Bb4', 1)],
    [(None, .5), ('F4', .5), ('F4', .5), ('A4', .5), ('C5', 1), ('A4', 1)],
    [('D5', .5), ('C5', .5), ('Bb4', .5), ('G4', .5), (None, 2)],
]
VERSE_CH = ['G', 'G', 'Bb', 'C', 'G', 'G', 'F', 'C']

PRE = [
    [('C5', .5), ('C5', .5), ('F5', 1), ('C5', .5), ('C5', .5), ('F5', 1)],
    [('C5', .5), ('C5', .5), ('F5', 1), ('C5', .5), ('C5', .5), ('G5', 1)],
    [('G5', .5), ('G5', .5), ('G5', .5), ('G5', .5), ('F5', 1), ('D5', 1)],
    [('D5', .5), ('F5', .5), ('D5', .5), ('F5', .5), ('D5', 2)],
]
PRE_CH = ['F', 'F', 'C', 'D']

# Refrain: Shout-Chant über G Bb C C | G Bb F D/G (E5 G5 A5 A5 | E5 G5 D5 B5/E5)
HOOK = [
    [('D5', .5), ('D5', .5), ('F5', .5), ('D5', .5), ('C5', 1), (None, 1)],
    [('Bb4', .5), ('Bb4', .5), ('D5', .5), ('Bb4', .5), ('G4', 1), (None, 1)],
    [('C5', .5), ('C5', .5), ('G5', .5), ('F5', .5), ('D5', 1), ('C5', 1)],
    [('D5', 3), (None, 1)],
    [('D5', .5), ('D5', .5), ('F5', .5), ('D5', .5), ('C5', 1), (None, 1)],
    [('Bb4', .5), ('Bb4', .5), ('D5', .5), ('Bb4', .5), ('G4', 1), (None, 1)],
    [('F5', .5), ('F5', .5), ('A5', .5), ('F5', .5), ('D5', 1), ('C5', 1)],
]
HOOK_END_OPEN = [('D5', .5), ('D5', .5), ('F5', .5), ('D5', .5), (None, 2)]
HOOK_END_CLOSED = [('G5', .5), ('F5', .5), ('D5', .5), ('C5', .5), ('G4', 2)]
HOOK_CH_OPEN = ['G', 'Bb', 'C', 'C', 'G', 'Bb', 'F', 'D']
HOOK_CH_CLOSED = ['G', 'Bb', 'C', 'C', 'G', 'Bb', 'F', 'G']

BREAK_CH = ['G', 'G', 'Bb', 'Bb', 'C', 'C', 'D', 'D']

SOLO = [
    [('D6', .5), ('F6', .5), ('G6', 1), ('F6', .5), ('D6', .5), ('C6', 1)],
    [('Bb5', .5), ('D6', .5), ('Bb5', .5), ('G5', .5), ('Bb5', 2)],
    [('C6', .5), ('D6', .5), ('F6', 1), ('D6', .5), ('C6', .5), ('D6', 1)],
    [('F6', 1), ('G6', 1.5), ('F6', .5), ('D6', 1)],
    [('G6', .5), ('G6', .5), ('F6', .5), ('D6', .5), ('C6', 1), ('D6', 1)],
    [('Bb5', .5), ('C6', .5), ('D6', 1), ('Bb5', .5), ('G5', .5), ('Bb5', 1)],
    [('A5', .5), ('C6', .5), ('F6', 1), ('C6', .5), ('A5', .5), ('F5', 1)],
    [('F6', 1), ('D6', 1), ('F6', 1), ('A6', 1)],
]
SOLO_CH = ['G', 'Bb', 'C', 'C', 'G', 'Bb', 'F', 'D']

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def chug(bar0, chords, shift=0, vel=74):
    """Palm-Mute-Achtel (Powerchord), Betonung auf den Zählzeiten."""
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 2, shift)
        for i in range(int(dur * 2)):
            t = song.bar(bar0 + k) + off + i * 0.5
            for name in ('gtrL', 'gtrR'):
                song.add(name, t, 0.3, T[0] + 12, hv(vel + (12 if i % 2 == 0 else 0)))
                song.add(name, t, 0.3, T[0] + 19, hv(vel - 6 + (12 if i % 2 == 0 else 0)))

def strum(bar0, chords, shift=0, vel=90, hits=((0, 1.4), (1.5, .45), (2, 1.4), (3.5, .45))):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 2, shift)
        for bt, ln in hits:
            if off <= bt < off + dur:
                for name in ('gtrL', 'gtrR'):
                    for m in (T[0] + 12, T[0] + 19, T[0] + 24):
                        song.add(name, song.bar(bar0 + k) + bt, ln, m, hv(vel))

def arps(bar0, chords, shift=0, vel=58, inst='clean', oct_=4):
    pat = (0, 2, 1, 2, 0, 2, 1, 2)
    for k, off, dur, ch in spans(chords):
        T = tones(ch, oct_, shift)
        ext = [T[0], T[1], T[2], T[0] + 12]
        for i in range(int(dur * 2)):
            song.add(inst, song.bar(bar0 + k) + off + i * 0.5, 0.6, ext[pat[i % 8] if pat[i % 8] < 3 else 3], hv(vel + (6 if i % 2 == 0 else 0)))

def bass8(bar0, chords, shift=0, vel=96, gallop=False):
    for k, off, dur, ch in spans(chords):
        r = tones(ch, 1, shift)[0] + 12
        if r > 50: r -= 12
        n8 = int(dur * 2)
        for i in range(n8):
            t = song.bar(bar0 + k) + off + i * 0.5
            m = r + 12 if (i % 4 == 2 and not gallop) else r
            song.add('bass', t, 0.4, m, hv(vel + (8 if i % 2 == 0 else -8)))

def bass_half(bar0, chords, shift=0, vel=84):
    for k, off, dur, ch in spans(chords):
        r = tones(ch, 1, shift)[0] + 12
        if r > 50: r -= 12
        song.add('bass', song.bar(bar0 + k) + off, dur - 0.1, r, vel)

def organ(bar0, chords, shift=0, vel=48):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in T[:3]:
            song.add('organ', song.bar(bar0 + k) + off, dur - 0.05, m, vel)

def strings(bar0, chords, shift=0, vel=56):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('strings', song.bar(bar0 + k) + off, dur - 0.05, m, vel)

def choir_pad(bar0, chords, shift=0, vel=56):
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for m in (T[1], T[2], T[0] + 12):
            song.add('choir', song.bar(bar0 + k) + off, dur - 0.05, m, vel)
        song.add('oohs', song.bar(bar0 + k) + off, dur - 0.05, T[2] + 12, vel - 10)

def hey(bar0, k, beat, ch, shift=0, vel=100, dur=0.3):
    """Gang-„Hey!“ (Aahs + Oohs eine Oktave tiefer)."""
    T = tones(ch, 3, shift)
    for m in (T[0], T[1], T[2]):
        song.add('choir', song.bar(bar0 + k) + beat, dur, m, hv(vel))
    song.add('oohs', song.bar(bar0 + k) + beat, dur, T[0] - 12, hv(vel - 12))

def oh_oh_oh(bar0, k, beat, ch, shift=0, vel=88):
    """Antwort-Chor „Oh-oh-oh!“ — drei kurze Töne (Terz, Quinte, Oktave)."""
    T = tones(ch, 3, shift)
    for j, m in enumerate((T[1], T[2], T[0] + 12)):
        song.add('choir', song.bar(bar0 + k) + beat + j * 0.5, 0.4, m, hv(vel + j * 4))
        song.add('oohs', song.bar(bar0 + k) + beat + j * 0.5, 0.4, m - 12, hv(vel - 10 + j * 4))

def drums(bar0, nbars, style, crash=True, fill_every=4):
    """verse (Rock-Beat) · pre (Snare-Achtel-Crescendo) · chorus (offene Hat, Clap, Doppel-Kick) · half (Halbzeit) · gallop (Punk)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        if style == 'verse':
            song.dr(t, KICK, 100, 0.2); song.dr(t + 2, KICK, 96, 0.2); song.dr(t + 3.5, KICK, 78, 0.2)
            song.dr(t + 1, SNARE, 104, 0.15); song.dr(t + 3, SNARE, 106, 0.15)
            for i in range(8): song.dr(t + i * 0.5, HAT, 100 + (10 if i % 2 == 0 else 0), 0.08)
        elif style == 'pre':
            song.dr(t, KICK, 100, 0.2); song.dr(t + 2, KICK, 98, 0.2)
            for i in range(8): song.dr(t + i * 0.5, SNARE, int(60 + (k * 8 + i) * 2.2), 0.1)
            song.dr(t, CRASH, 60 + k * 10, 1.0) if k == 0 else None
        elif style in ('chorus', 'gallop'):
            song.dr(t, KICK, 106, 0.2); song.dr(t + 1.5, KICK, 84, 0.2); song.dr(t + 2, KICK, 102, 0.2)
            if style == 'gallop':
                for i in range(1, 8):
                    if i not in (2, 6): song.dr(t + i * 0.5, KICK, 80, 0.15)
            song.dr(t + 1, SNARE, 108, 0.15); song.dr(t + 3, SNARE, 110, 0.15)
            song.dr(t + 1, CLAP, 76, 0.1); song.dr(t + 3, CLAP, 80, 0.1)
            for i in range(8): song.dr(t + i * 0.5, HAT if i % 2 == 0 else OHAT, 104 if i % 2 == 0 else 92, 0.12)
        elif style == 'half':
            song.dr(t, KICK, 96, 0.2); song.dr(t + 2, SNARE, 104, 0.15); song.dr(t + 3.5, KICK, 74, 0.2)
            for i in range(4): song.dr(t + i, HAT, 92, 0.08)
        if k == 0 and crash and style != 'pre':
            song.dr(t, CRASH, 104, 1.4)
        if fill_every and k % fill_every == fill_every - 1 and style in ('verse', 'chorus', 'gallop'):
            for j, tom in enumerate((TOM_H, TOM_H, TOM_M, TOM_L)):
                song.dr(t + 2.5 + j * 0.375, tom, 92 + 6 * j, 0.12)

def roll(bar0, start, end, v0=50, v1=122):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n):
        song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
def punk_chorus(base, ch_list, end, vel=100, style='chorus'):
    mel('lead', base, HOOK, vel=vel, vib=False); mel('lead', base + 7, [end], vel=vel, vib=False)
    mel('lead2', base, HOOK, vel=86, octave=-1, vib=False); mel('lead2', base + 7, [end], vel=86, octave=-1, vib=False)
    mel('vox', base, HOOK, vel=50); mel('vox', base + 7, [end], vel=50)
    strum(base, ch_list, vel=96, hits=((0, .9), (1.5, .4), (2, .9), (3, .45), (3.5, .4)))
    bass8(base, ch_list, vel=102, gallop=(style == 'gallop'))
    for k in (3, 7):
        hey(base, k, 3.0, ch_list[k], vel=100)
    hey(base, 0, 0, ch_list[0], vel=100); hey(base, 4, 0, ch_list[4], vel=100)
    drums(base, 8, style)

b = 0
# ── Intro (4) ────────────────────────────────────────────────────────────────────────────────────────
mel('lead', b, RIFF + RIFF, vel=100, vib=False)
chug(b, INTRO_CH, vel=76)
bass8(b + 2, INTRO_CH[2:], vel=96)
for i in range(8): song.dr(song.bar(b + 2) + i * 0.5, HAT, 104, 0.08)
song.dr(song.bar(b), CRASH, 104, 1.4)
for k in (2, 3):
    song.dr(song.bar(b + k), KICK, 104, 0.2); song.dr(song.bar(b + k) + 2, KICK, 98, 0.2)
    song.dr(song.bar(b + k) + 1, SNARE, 106, 0.15); song.dr(song.bar(b + k) + 3, SNARE, 108, 0.15)
for j, tom in enumerate((TOM_H, TOM_H, TOM_M, TOM_L)):
    song.dr(song.bar(b + 3) + 2.5 + j * 0.375, tom, 96 + 6 * j, 0.12)
b += 4

# ── Strophe 1 (8) ────────────────────────────────────────────────────────────────────────────────────
mel('lead', b, VERSE, vel=86, vib=False); mel('vox', b, VERSE, vel=48)
chug(b, VERSE_CH, vel=72)
bass8(b, VERSE_CH, vel=98)
drums(b, 8, 'verse')
b += 8

# ── Pre 1 (4) ────────────────────────────────────────────────────────────────────────────────────────
mel('lead', b, PRE, vel=94, vib=False); mel('vox', b, PRE, vel=50)
chug(b, PRE_CH, vel=80)
bass8(b, PRE_CH, vel=100)
drums(b, 4, 'pre')
roll(b + 3, 2.5, 4, 70, 126)
b += 4

# ── Refrain 1 (8) ────────────────────────────────────────────────────────────────────────────────────
punk_chorus(b, HOOK_CH_OPEN, HOOK_END_OPEN)
b += 8

# ── Strophe 2 (8): + Clean-Gitarre als Kontrapunkt, Lead stärker ─────────────────────────────────────
mel('lead', b, VERSE, vel=90, vib=False); mel('vox', b, VERSE, vel=52)
chug(b, VERSE_CH, vel=76)
arps(b, VERSE_CH, vel=50)
bass8(b, VERSE_CH, vel=100)
drums(b, 8, 'verse')
b += 8

# ── Pre 2 (4) ────────────────────────────────────────────────────────────────────────────────────────
mel('lead', b, PRE, vel=98, vib=False); mel('vox', b, PRE, vel=54)
chug(b, PRE_CH, vel=84)
bass8(b, PRE_CH, vel=102)
drums(b, 4, 'pre')
roll(b + 3, 2.5, 4, 70, 127)
b += 4

# ── Refrain 2 (8) ────────────────────────────────────────────────────────────────────────────────────
punk_chorus(b, HOOK_CH_CLOSED, HOOK_END_CLOSED, vel=102)
b += 8

# ── Break (8): Halftime-Chug, Gang-„Hey!“ auf jeder Zählzeit (erste 4 Takte), dann Aufbau zum Solo ─────
chug(b, BREAK_CH, vel=84)
bass_half(b, BREAK_CH, vel=96)
for k in range(4):
    for beat in range(4):
        hey(b, k, beat, BREAK_CH[k], vel=88, dur=0.25)
strum(b + 4, BREAK_CH[4:], vel=92, hits=((0, 1.8), (2, 1.8)))
drums(b, 8, 'half', fill_every=0)
roll(b + 6, 0, 4, 50, 118)
roll(b + 7, 0, 4, 80, 127)
b += 8

# ── Solo (8): Pentatonik-Shred mit Pre-Bends, Rhythmusgitarren in Achteln ─────────────────────────────
mel('lead', b, SOLO, vel=104, vibmin=1.5)
for k in (1, 3, 5, 7):
    bend_up('lead', song.bar(b + k), semis=2.0, rise=0.2)
chug(b, SOLO_CH, vel=84)
bass8(b, SOLO_CH, vel=102)
drums(b, 8, 'chorus')
b += 8

# ── Refrain 3 (8) und 4 (8, Kick-Galopp) ─────────────────────────────────────────────────────────────
punk_chorus(b, HOOK_CH_OPEN, HOOK_END_OPEN, vel=104)
b += 8
punk_chorus(b, HOOK_CH_CLOSED, HOOK_END_CLOSED, vel=106, style='gallop')
b += 8

# ── Outro (4): C C D D, Chug-Stopp mit Tom-/Snare-Roll zurück in die Intro ─────────────────────────────
OUT_CH = ['C', 'C', 'D', 'D']
mel('lead', b, [[('C5', .5), ('C5', .5), ('F5', 1), ('C5', .5), ('C5', .5), ('F5', 1)], [('G5', 2), ('F5', 1), ('D5', 1)], [('D5', .5), ('F5', .5), ('D5', .5), ('F5', .5), ('D5', 2)], [(None, 4)]], vel=98, vib=False)
chug(b, OUT_CH[:3] + ['D'], vel=80)
bass8(b, OUT_CH, vel=98)
drums(b, 3, 'verse', crash=True, fill_every=0)
roll(b + 3, 0, 4, 50, 126)
song.dr(song.bar(b + 3) + 3.5, CRASH, 90, 0.6)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('ELANA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_elana.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.3)
