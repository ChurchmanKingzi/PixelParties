# -*- coding: utf-8 -*-
"""Held-Thema „Elana, the Rocky Rebel“ → public/music/bgm_elana.ogg                       Titel: „Loud for You“

Elana ist E-Gitarristin und Rockstar — sie „kämpft“ weniger, als dass sie ihre Leute unterstützt (Karte: Creativity,
Hand mischen und eins mehr ziehen). Der Track soll wie ein echter Song klingen, der im Radio laufen könnte:
Power-Pop-Punk-Rock mit Strophe, Pre-Chorus, Hymnen-Refrain mit Mitgröl-Chor, Bridge, Gitarrensolo und
Schluss-Refrain eine Stufe höher — und natürlich loopend.

  • G-Dur, 156 BPM, 4/4. (Version 2: E-Dur, 168 BPM, Gitarren/Bass statt Chor/Streicher) Gitarren: Palm-Mute-Achtel in der Strophe, offene Powerchords im Refrain; ein Lead-Gitarren-Riff
    eröffnet und hält das Stück zusammen; Clean-Gitarre als Gegenpol (Bridge, Strophe 2); Bass pumpt Achtel.
  • Refrain mit rockiger Mixolydisch-Wendung (G – F – C – G | G – F – C – D): das ♭VII (F) gibt den „Rebel“-Biss. Die
    Hook-Melodie sitzt im Lead (Gitarre, dazu die Solo-Voice-Stimme leise) und wird vom Chor (Aahs, Gang-„Hey!“,
    „Oh-oh-oh“-Antworten) getragen — der Chor ist das „Support“-Motiv: Elana singt für ihr Publikum, nicht gegen jemanden.
  • Pre-Chorus (Am – C – D – D): Snare-Achtel-Crescendo, Gitarren-Chug wird lauter, Spannung auf dem Dominantklang.
  • Bridge: Halbzeit, Clean-Gitarre und Streicher, ruhig-emotional; dann Gitarrensolo (Pentatonik, Bends, Vibrato).
  • Schluss-Refrain zweimal in A-Dur (Rückung um einen Ganzton); Ausklang A → G → D → D7 führt zurück in die G-Dur-Intro.
Form (80 Takte = 2:03): Intro 4 · Strophe 8 · Pre 4 · Refrain 8 · Strophe 8 · Pre 4 · Refrain 8 · Bridge 8 · Solo 8 · Refrain 8 (A) · Refrain 8 (A) · Outro 4
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 168, 80
KEY = -3          # Grundton E statt G: offene E-Saite, Standard-Rockgitarren-Tonart (Finale in F#)
song = Song(BPM, BARS)
rng = random.Random(1977)

song.inst('lead', 'rockgtr', vol=104, pan=64)       # Lead-Gitarre (Riff, Hook, Solo)
song.inst('gtrL', 'rockgtr', vol=100, pan=18)
song.inst('gtrR', 'rockgtr', vol=98, pan=110)
song.inst('clean', 'cleangtr', vol=80, pan=92)
song.inst('bass', 'bass2', vol=102, pan=60)
song.inst('organ', 'rockorgan', vol=60, pan=46)
song.inst('lead2', 'rockgtr', vol=80, pan=30)       # zweite Lead-Gitarre (Twin-Guitar-Oktave)
song.inst('acou', 'guitar', vol=84, pan=100)        # Schlaggitarre (Western-Gitarre)
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

CH = {'G': (7, 'M'), 'F': (5, 'M'), 'C': (0, 'M'), 'D': (2, 'M'), 'D7': (2, '7'), 'Em': (4, 'm'),
      'Am': (9, 'm'), 'E': (4, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

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

# ═══ Material (G-Dur) ═══════════════════════════════════════════════════════════════════════════
# Intro-Riff (Lead-Gitarre), 2 Takte, wird wiederholt
RIFF = [
    [('G5', .5), ('G5', .5), ('D5', .5), ('G5', .5), ('A5', 1), ('G5', .5), ('D5', .5)],
    [('B5', .5), ('B5', .5), ('A5', .5), ('G5', .5), ('D5', 2)],
]
INTRO_CH = ['G', 'G', 'F', 'D']

# Strophe (Em C G D | Em C G D)
VERSE = [
    [('B4', 1), ('G4', .5), ('B4', .5), ('E5', 2)],
    [('E5', 1), ('D5', .5), ('C5', .5), ('G4', 2)],
    [('D5', 1), ('B4', .5), ('D5', .5), ('G5', 2)],
    [('F#5', 1.5), ('E5', .5), ('D5', 1), ('A4', 1)],
    [('B4', 1), ('G4', .5), ('B4', .5), ('E5', 2)],
    [('E5', 1), ('D5', .5), ('C5', .5), ('G4', 2)],
    [('B4', 1), ('D5', 1), ('G5', 2)],
    [('F#5', 1), ('A4', 1), ('D5', 2)],
]
VERSE_CH = ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D']

# Pre-Chorus (Am C D D)
PRE = [
    [('A4', 1), ('C5', 1), ('E5', 2)],
    [('E5', 1), ('G5', 1), ('G5', 2)],
    [('A5', .5), ('A5', .5), ('A5', .5), ('F#5', .5), ('A5', 2)],
    [('A5', .5), ('F#5', .5), ('D5', 1), (None, 2)],
]
PRE_CH = ['Am', 'C', 'D', 'D']

# Refrain (G F C G | G F C D) — der Hook
HOOK = [
    [('D5', 1), ('D5', .5), ('B4', .5), ('D5', 1), ('G5', 1)],
    [('C5', 1.5), ('A4', .5), ('C5', 1), ('F5', 1)],
    [('E5', 1), ('G5', 1), ('E5', .5), ('C5', .5), ('E5', 1)],
    [('D5', 2), ('B4', 1), ('G4', 1)],
    [('D5', 1), ('D5', .5), ('B4', .5), ('D5', 1), ('G5', 1)],
    [('A5', 1.5), ('G5', .5), ('F5', 1), ('C5', 1)],
    [('E5', 1.5), ('G5', .5), ('C6', 2)],
]
HOOK_END_OPEN = [('A5', 1), ('F#5', 1), ('D5', 2)]           # 8 über D (Dominante)
HOOK_END_CLOSED = [('D5', 1), ('B4', 1), ('G4', 2)]          # 8 über G (zu Hause)
HOOK_CH_OPEN = ['G', 'F', 'C', 'G', 'G', 'F', 'C', 'D']
HOOK_CH_CLOSED = ['G', 'F', 'C', 'G', 'G', 'F', 'C', 'G']

# Bridge (Em Em C C Am Am D D)
BRIDGE = [
    [('B4', 4)], [('E5', 2), ('G5', 2)], [('G5', 2), ('E5', 2)], [('C5', 4)],
    [('A4', 2), ('C5', 2)], [('E5', 4)], [('F#5', 2), ('A5', 2)], [('A5', .5), ('F#5', .5), ('D5', 1), (None, 2)],
]
BRIDGE_CH = ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'D', 'D']

# Solo (G F C G | G F C E): Pentatonik, am Ende auf E (Dominante von A) → Rückung
SOLO = [
    [('B5', .5), ('D6', .5), ('E6', 1), ('D6', 1), ('B5', 1)],
    [('A5', 1), ('C6', 1), ('A5', 1), ('F5', 1)],
    [('G5', .5), ('C6', .5), ('E6', 1), ('D6', 1), ('C6', 1)],
    [('D6', 2), ('B5', 1), ('G5', 1)],
    [('B5', .5), ('D6', .5), ('G6', 1), ('E6', 1), ('D6', 1)],
    [('C6', 1.5), ('A5', .5), ('F5', 1), ('A5', 1)],
    [('E6', 1.5), ('D6', .5), ('C6', 1), ('G5', 1)],
    [('E6', 2), ('B5', 2)],
]
SOLO_CH = ['G', 'F', 'C', 'G', 'G', 'F', 'C', 'E']

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

def acou_strum(bar0, chords, shift=0, vel=84):
    """Achtel-Schlag der Akustikgitarre (Ab-Auf-Muster) unter dem Refrain."""
    for k, off, dur, ch in spans(chords):
        T = tones(ch, 3, shift)
        for i in range(int(dur * 2)):
            if i % 4 in (0, 1, 3) or True:
                for j, m in enumerate((T[0], T[1] + (0), T[2], T[0] + 12)):
                    song.add('acou', song.bar(bar0 + k) + off + i * 0.5 + j * 0.012, 0.45, m, hv(vel + (10 if i % 2 == 0 else -6)))

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
b = 0
# ── Intro (4): das Riff, ab Takt 3 mit Bass + Hats, Fill in den Vers ───────────────────────────────────
mel('lead', b, RIFF + RIFF, vel=96)
chug(b, INTRO_CH, vel=70)
bass8(b + 2, INTRO_CH[2:], vel=94)
for i in range(8): song.dr(song.bar(b + 2) + i * 0.5, HAT, 100, 0.08)
song.dr(song.bar(b), CRASH, 100, 1.4)
for k in (2, 3):
    song.dr(song.bar(b + k), KICK, 100, 0.2); song.dr(song.bar(b + k) + 2, KICK, 96, 0.2)
    song.dr(song.bar(b + k) + 1, SNARE, 100, 0.15); song.dr(song.bar(b + k) + 3, SNARE, 104, 0.15)
for j, tom in enumerate((TOM_H, TOM_H, TOM_M, TOM_L)):
    song.dr(song.bar(b + 3) + 2.5 + j * 0.375, tom, 94 + 6 * j, 0.12)
b += 4

# ── Strophe 1 (8): Palm-Mute, Gesangslinie in der Lead-Gitarre ─────────────────────────────────────
mel('lead', b, VERSE, vel=84, vib=True)
mel('vox', b, VERSE, vel=44)
chug(b, VERSE_CH, vel=66)
bass8(b, VERSE_CH, vel=94)
drums(b, 8, 'verse')
b += 8

# ── Pre-Chorus (4): Snare-Crescendo, Spannung auf D ───────────────────────────────────────────────────
mel('lead', b, PRE, vel=90); mel('vox', b, PRE, vel=50)
chug(b, PRE_CH, vel=74)
bass8(b, PRE_CH, vel=98)

drums(b, 4, 'pre')
roll(b + 3, 2.5, 4, 70, 126)
b += 4

# ── Refrain 1 (8): der Hook — Lead + Stimme, offene Powerchords, Chor ────────────────────────────────
def chorus(base, ch_list, end, shift=0, vel=96, big=False, style='chorus'):
    mel('lead', base, HOOK, shift=shift, vel=vel); mel('lead', base + 7, [end], shift=shift, vel=vel)
    mel('vox', base, HOOK, shift=shift, vel=54); mel('vox', base + 7, [end], shift=shift, vel=54)
    mel('lead2', base, HOOK, shift=shift, vel=84, octave=-1, vib=False); mel('lead2', base + 7, [end], shift=shift, vel=84, octave=-1, vib=False)
    acou_strum(base, ch_list, shift=shift)
    strum(base, ch_list, shift=shift, vel=90 + (6 if big else 0))
    bass8(base, ch_list, shift=shift, vel=100, gallop=(style == 'gallop'))
    for k in (3, 7):                                                  # Antwort-Chor nach den langen Tönen
        oh_oh_oh(base, k, 2.5, ch_list[k] if k != 7 or ch_list[7] != ch_list[0] else ch_list[7], shift=shift, vel=84 + (8 if big else 0))
    for k in (0, 4):
        hey(base, k, 0, ch_list[k], shift=shift, vel=96)
    drums(base, 8, style)

chorus(b, HOOK_CH_OPEN, HOOK_END_OPEN)
b += 8

# ── Strophe 2 (8): + Clean-Arpeggios, Stimme zweistimmig ─────────────────────────────────────────────
mel('lead', b, VERSE, vel=88); mel('vox', b, VERSE, vel=52)
chug(b, VERSE_CH, vel=70)
arps(b, VERSE_CH, vel=52)
bass8(b, VERSE_CH, vel=96)
acou_strum(b, VERSE_CH, vel=70)
drums(b, 8, 'verse')
b += 8

# ── Pre-Chorus 2 (4) ──────────────────────────────────────────────────────────────────────────────
mel('lead', b, PRE, vel=94); mel('vox', b, PRE, vel=54)
chug(b, PRE_CH, vel=78)
bass8(b, PRE_CH, vel=100)

drums(b, 4, 'pre')
roll(b + 3, 2.5, 4, 70, 127)
b += 4

# ── Refrain 2 (8): größer — Chor lauter, Streicher, Ganzschluss ───────────────────────────────────────
chorus(b, HOOK_CH_CLOSED, HOOK_END_CLOSED, big=True)
b += 8

# ── Bridge (8): Halbzeit, Clean-Gitarre + Streicher, ruhig-emotional, Aufbau zum Solo ────────────────────
mel('clean', b, BRIDGE, vel=80, octave=0, vib=False)
mel('vox', b, BRIDGE, vel=62)
arps(b, BRIDGE_CH, vel=48, oct_=3)
acou_strum(b, BRIDGE_CH, vel=60)
bass_half(b, BRIDGE_CH, vel=84)
drums(b, 8, 'half', fill_every=0)
roll(b + 7, 2, 4, 50, 124)
b += 8

# ── Solo (8): Lead-Gitarre — Pentatonik, Pre-Bends und Vibrato; Rhythmusgitarren tragen ─────────────────
mel('lead', b, SOLO, vel=100, vibmin=1.5)
for k in (1, 3, 5, 7):
    bend_up('lead', song.bar(b + k), semis=2.0, rise=0.2)
strum(b, SOLO_CH, vel=88)
bass8(b, SOLO_CH, vel=100)
acou_strum(b, SOLO_CH, vel=70)
drums(b, 8, 'chorus')
b += 8

# ── Schluss-Refrain 1 (8): A-Dur, Rückung um einen Ganzton — jetzt mit allem ──────────────────────────────
chorus(b, HOOK_CH_OPEN, HOOK_END_OPEN, shift=2, vel=100, big=True)
b += 8

# ── Schluss-Refrain 2 (8): zweimal, diesmal im Punk-Galopp (Kick in Achteln), Ganzschluss ────────────────
chorus(b, HOOK_CH_CLOSED, HOOK_END_CLOSED, shift=2, vel=102, big=True, style='gallop')
b += 8

# ── Outro (4): A → G → D → D7 (zurück zur G-Dur-Intro), Riff-Zitat, Chor hält ─────────────────────────────
OUT_CH = ['A', 'G', 'D', 'D7']
CH['A'] = (9, 'M')
mel('lead', b, [[('E5', 1.5), ('C#5', .5), ('E5', 2)], [('D5', 1.5), ('B4', .5), ('D5', 2)], [('A4', 1), ('D5', 1), ('F#5', 2)], [('A5', .5), ('F#5', .5), ('D5', 1), (None, 2)]], vel=94)
strum(b, OUT_CH, vel=92, hits=((0, 1.8), (2, 1.8)))
bass8(b, OUT_CH, vel=96)
acou_strum(b, OUT_CH, vel=78)
drums(b, 3, 'half', crash=True, fill_every=0)
for k in (3,):
    roll(b + k, 0, 4, 50, 126)
song.dr(song.bar(b + 3) + 3.5, CRASH, 90, 0.6)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('ELANA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_elana.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.3)
