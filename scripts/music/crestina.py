# -*- coding: utf-8 -*-
"""Held-Thema „Fairy Queen Crestina, the Creation Fairy“ → public/music/bgm_crestina.ogg              Titel: „Let There Be Fun“

Crestina ist die Schöpfungsgottheit des Kosmos. Feen sind die höchsten Gottheiten und allesamt ihre Kinder. Ihr höchstes Gesetz: **alle sollen Spaß haben** — darum teilen alle Feen die Fähigkeit
Friendship. Das Theme klingt nach Schöpfung *und* nach Party: festlich, kosmisch, tanzbar, strahlend — ein göttlicher Dance-Kampf, bei dem alle mitfeiern.

  • As-Dur (lydisch: das D!), 150 BPM, 4/4. **Genesis**: aus Stille zündet ein einzelner Glockenton, Funken (Glockenspiel, Kristall) steigen auf, Chor schwillt, ein Harfenlauf — dann der „Drop“:
    4-auf-den-Boden-Kick, Klatschen auf 2 und 4, Offbeat-Hi-Hat, Oktav-Synth-Bass (federnd), Vibraphon-Arpeggien, Marimba-Hüpfer.
  • **Der Spaß-Hook** (Dur-Pentatonik As–B–C–Es–F, synkopierte Wiederholungen, springende Quinte): Square-Lead + Flöte; dahinter Choräle auf „Aah“.
  • **Friendship**: Kanon — die Stimmen kommen eine nach der anderen dazu, derselbe Hook versetzt (zwei, vier Schläge später) in Kinderchor, Glockenspiel, Flöte: jede Fee ein Freund mehr.
  • **Kosmos**: groß und weit — Streicher, Hörner, Chor, Pauke, Harfenglissandi tragen die langen Töne (Db–As–Es), die Galaxie dreht sich.
  • **Tanz der Kinder** (Break): Spieluhr-Melodie in Glockenspiel und Vibraphon, nur Klatschen, Aufbau mit Snare-Wirbel und steigendem Synth-Riser; danach der große Drop.
  • Finale einen Ganzton höher (B-Dur), alles zusammen; Ausklang auf Es (Dominante) → zurück in die As-Dur-Genesis.
Form (64 Takte ≈ 1:42): Genesis 4 · Spaß A 8 · A' 8 · Friendship B 8 · Kosmos C 8 · Tanz der Kinder 8 · Alle +2 8 · Finale +2 8 · Coda 4
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 150, 64
song = Song(BPM, BARS)
rng = random.Random(1001)

song.inst('square', 'square', vol=70, pan=62)            # Synth-Lead (Hook)
song.inst('flute', 'flute', vol=84, pan=80)
song.inst('glock', 'glock', vol=76, pan=36)
song.inst('harp', 'harp', vol=82, pan=90)
song.inst('bass', 'sbass2', vol=94, pan=62)              # Synth-Bass (Oktav-Bounce)
song.inst('pizz', 'pizz', vol=70, pan=28)
song.inst('choir', 'choir', vol=78, pan=60)              # Aah
song.inst('oohs', 'oohs', vol=76, pan=70)                # Kinderchor (La-la, Kanon)
song.inst('strings', 'slowstr', vol=72, pan=44)
song.inst('bell', 'bell', vol=64, pan=76)
song.inst('vibes', 'vibes', vol=74, pan=48)              # Arpeggien
song.inst('timp', 'timp', vol=96, pan=64)
song.inst('sweep', 'sweep', vol=60, pan=64)              # Riser
song.inst('marimba', 'marimba', vol=70, pan=40)          # Hüpfer
song.inst('horn', 'horns', vol=74, pan=52)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Ab': (8, 'M'), 'Bb': (10, 'M'), 'Fm': (5, 'm'), 'Eb': (3, 'M'), 'Db': (1, 'M'), 'Cm': (0, 'm')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=90, octave=0, legato=.93, delay=0.0):
    t = song.bar(bar0) + delay
    for bar in bars:
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# Pitch-Bend für den Riser (±12 Halbtöne)
for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
    song.ev.append((0, -2, mido.Message('control_change', channel=song.ch['sweep'][0], control=cc, value=v)))

def riser(beat, dur, pitch=60, vel=60, lo=-12.0, hi=12.0, steps=32):
    ch = song.ch['sweep'][0]
    song.add('sweep', beat, dur + 0.2, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.3) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (As-Dur, lydisch gefärbt) ═══════════════════════════════════════════════════════════
A_CH = ['Ab', 'Bb', 'Ab', 'Eb', 'Ab', 'Bb', 'Fm', 'Eb']
A_CH2 = ['Ab', 'Bb', 'Ab', 'Eb', 'Ab', 'Bb', 'Fm', 'Ab']
HOOK = [
    [('Eb5', .5), ('Eb5', .5), ('Ab5', 1), ('G5', .5), ('Eb5', .5), ('C5', 1)],
    [('F5', .5), ('F5', .5), ('Bb5', 1), ('A5', .5), ('F5', .5), ('D5', 1)],
    [('Eb5', .5), ('Eb5', .5), ('Ab5', 1), ('C6', 1), ('Bb5', 1)],
    [('G5', 1), ('Bb5', 1), ('Eb6', 2)],
    [('Eb5', .5), ('Eb5', .5), ('Ab5', 1), ('G5', .5), ('Eb5', .5), ('C5', 1)],
    [('F5', .5), ('F5', .5), ('Bb5', 1), ('D6', 1), ('C6', 1)],
    [('C6', 1), ('Ab5', .5), ('F5', .5), ('Ab5', 1), ('C6', 1)],
]
H_END_OPEN = [('Bb5', 2), ('G5', 1), ('Eb5', 1)]
H_END_CLOSED = [('Ab5', 3), (None, 1)]

C_CH = ['Db', 'Ab', 'Db', 'Eb', 'Fm', 'Db', 'Bb', 'Eb']
COSMOS = [
    [('F5', 2), ('Ab5', 2)], [('Eb6', 3), ('C6', 1)], [('Db6', 2), ('Bb5', 2)], [('G5', 2), ('Bb5', 2)],
    [('Ab5', 2), ('C6', 2)], [('F6', 3), ('Db6', 1)], [('D6', 2), ('F6', 2)], [('Eb6', 3), (None, 1)],
]

DANCE_CH = ['Ab', 'Fm', 'Db', 'Eb', 'Ab', 'Fm', 'Db', 'Eb']
DANCE = [
    [('Ab5', .5), ('C6', .5), ('Eb6', .5), ('C6', .5), ('Ab5', 2)],
    [('F5', .5), ('Ab5', .5), ('C6', .5), ('Ab5', .5), ('F5', 2)],
    [('Db6', .5), ('F6', .5), ('Ab6', .5), ('F6', .5), ('Db6', 2)],
    [('Eb6', .5), ('G6', .5), ('Bb6', .5), ('G6', .5), ('Eb6', 2)],
]

# ═══ Bausteine ═══════════════════════════════════════════════════════════════════════════════════
def root_pitch(ch, shift=0):
    r = tones(ch, 1, shift)[0]
    while r < 28: r += 12
    while r > 48: r -= 12
    return r

def bounce(bar0, chords, shift=0, vel=96):
    """Oktav-Bounce: Achtel, geradzahlig Grundton, ungeradzahlig Oktave (Offbeats lauter) — federnder Dance-Bass."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift)
        t = song.bar(bar0 + k)
        for i in range(8):
            song.add('bass', t + i * 0.5, 0.42, r + (12 if i % 2 else 0), hv(vel + (10 if i % 2 else 0)))

def arps(bar0, chords, shift=0, vel=62):
    """Vibraphon-Sechzehntel: Grundton–Terz–Quinte–Oktave und zurück (Lydisch durch die große Septime der II-Stufe)."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        pat = (T[0], T[1], T[2], T[0] + 12, T[2], T[1], T[0] + 12, T[2])
        t = song.bar(bar0 + k)
        for i in range(16):
            song.add('vibes', t + i * 0.25, 0.22, pat[i % 8], hv(vel + (10 if i % 4 == 0 else 0)))

def hops(bar0, chords, shift=0, vel=60):
    """Marimba-Hüpfer auf den Offbeats (Terz/Quinte) + Pizzicato-Stabs."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        t = song.bar(bar0 + k)
        for i in range(4):
            song.add('marimba', t + 0.5 + i, 0.2, T[(i % 2) + 1] + 12, hv(vel))
            for m in (T[1], T[2]): song.add('pizz', t + 0.5 + i, 0.15, m, hv(vel - 8))

def pad(bar0, chords, shift=0, vel=50, inst='strings', oct_=3):
    for k, ch in enumerate(chords):
        for m in tones(ch, oct_, shift): song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def sparkle(bar0, nbars, shift=0, vel=60, density=3):
    """Feenstaub: hohe Einzeltöne im Glockenspiel/Bell (As-Dur-Pentatonik)."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(density):
            n = rng.choice(('Ab6', 'Bb6', 'C7', 'Eb7', 'F6', 'Eb6', 'C6'))
            song.add('glock', t + rng.choice((0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75)), 0.3, pn(n) + shift, hv(vel))
        if k % 2 == 0: song.add('bell', t, 2.0, pn('Ab5') + shift, hv(vel - 12))

def fairy_run(beat, shift=0, vel=70, inst='harp', up=True):
    """Harfenlauf: As-Dur-Skala in Sechzehnteln über zwei Oktaven (Feenstaub-Spirale)."""
    sc = [pn(n) + shift for n in ('Ab4', 'Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'Ab5', 'Bb5', 'C6', 'D6', 'Eb6')]
    seq = sc if up else sc[::-1]
    for i, m in enumerate(seq): song.add(inst, beat + i * 0.25, 0.5, m, hv(vel + (i if up else -i)))

def drums(bar0, nbars, level=1.0, crash=True, claps=True, fills=True):
    """Dance: Kick auf jeder Zählzeit, Klatschen auf 2 und 4, Offbeat-Hi-Hat (offen), Sechzehntel-Shaker; Crash am Abschnittsanfang."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        for beat in range(4): song.dr(t + beat, KICK, int((106 if beat in (0, 2) else 94) * L), 0.15)
        if claps:
            for beat in (1, 3): song.dr(t + beat, CLAP, int(100 * L), 0.12); song.dr(t + beat, SNARE, int(70 * L), 0.12)
        for i in range(4): song.dr(t + 0.5 + i, OHAT, int(88 * L), 0.12)
        for i in range(16): song.dr(t + i * 0.25, HAT, int((62 if i % 2 == 0 else 44) * L), 0.04)
        if k == 0 and crash: song.dr(t, CRASH, int(100 * L), 1.8)
        if fills and k % 4 == 3:
            for j in range(6): song.dr(t + 2.5 + j * 0.25, SNARE, int((66 + 9 * j) * L), 0.1)

def roll(bar0, start, end, v0=44, v1=120):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_beat(bar0, chords, shift=0, vel=90):
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift) + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 2, 0.8, r, hv(vel - 6))

def hook_layer(bar0, chords, end, shift=0, vel=94, flute=True, choir=True):
    mel('square', bar0, HOOK, shift=shift, vel=vel - 18, legato=.9); mel('square', bar0 + 7, [end], shift=shift, vel=vel - 18, legato=.9)
    if flute: mel('flute', bar0, HOOK, shift=shift, vel=vel); mel('flute', bar0 + 7, [end], shift=shift, vel=vel)
    if choir:
        for k, ch in enumerate(chords):
            for m in tones(ch, 4, shift): song.add('choir', song.bar(bar0 + k), 3.95, m, 50)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Genesis (4): Stille, ein Glockenton, Funken steigen auf, Chor schwillt, Harfenlauf, Riser — dann der Drop ─────────
song.add('bell', song.bar(b), 4.0, pn('Ab4'), 70)
song.add('bell', song.bar(b), 4.0, pn('Eb5'), 60)
for i, n in enumerate(('Ab5', 'C6', 'Eb6', 'Ab6', 'C7', 'Eb7')):
    song.add('glock', song.bar(b + 1) + i * 0.5, 0.6, pn(n), 54 + 4 * i)
for k in range(1, 4):
    for m in tones('Ab', 3): song.add('choir', song.bar(b + k), 3.95, m, 30 + 12 * k)
    song.add('oohs', song.bar(b + k), 3.95, pn('Eb5'), 28 + 10 * k)
    for m in tones('Ab', 3): song.add('strings', song.bar(b + k), 3.95, m, 24 + 10 * k)
fairy_run(song.bar(b + 2), vel=60)
fairy_run(song.bar(b + 3), shift=0, vel=66)
riser(song.bar(b + 1), 12.0, pitch=pn('Ab4'), vel=50, lo=-12.0, hi=12.0, steps=48)
timp_beat(b + 2, ['Ab', 'Eb'], vel=70)
for k in (2, 3):
    for i in range(4): song.dr(song.bar(b + k) + i, KICK, 70 + 6 * k, 0.15)
roll(b + 3, 1, 4, 40, 118)
song.dr(song.bar(b + 3) + 3.5, CRASH, 90, 0.6)
b += 4

# ── Spaß A (8): der Drop — Dance-Beat, Bounce-Bass, Vibraphon-Arpeggien; der Hook in Square + Flöte ─────────────────────
hook_layer(b, A_CH, H_END_OPEN)
bounce(b, A_CH)
arps(b, A_CH, vel=58)
hops(b, A_CH)
pad(b, A_CH, vel=40)
drums(b, 8, level=1.0)
sparkle(b, 8, vel=56, density=2)
fairy_run(song.bar(b + 7) + 1.0, vel=66)
b += 8

# ── A' (8): Hook mit Kinderchor-Verdopplung, geschlossen auf As; Glockenspiel wirbelt ─────────────────────────────
hook_layer(b, A_CH2, H_END_CLOSED, vel=98)
mel('oohs', b, HOOK, vel=66, octave=1); mel('oohs', b + 7, [H_END_CLOSED], vel=66, octave=1)
mel('glock', b, HOOK, vel=60, octave=1); mel('glock', b + 7, [H_END_CLOSED], vel=60, octave=1)
bounce(b, A_CH2, vel=98)
arps(b, A_CH2, vel=62)
hops(b, A_CH2, vel=64)
pad(b, A_CH2, vel=46)
drums(b, 8, level=1.08)
sparkle(b, 8, vel=60, density=3)
timp_beat(b, A_CH2, vel=82)
b += 8

# ── Friendship B (8): Kanon — jede Stimme kommt später dazu (2, 4, 6 Schläge Versatz): ein Freund mehr ──────────────────
mel('flute', b, HOOK, vel=96); mel('flute', b + 7, [H_END_OPEN], vel=96)
mel('oohs', b, HOOK, vel=74, delay=2.0); mel('oohs', b + 7, [H_END_OPEN], vel=74, delay=2.0)
mel('glock', b, HOOK, vel=68, octave=1, delay=4.0); mel('glock', b + 7, [H_END_OPEN], vel=68, octave=1, delay=4.0)
mel('square', b, HOOK, vel=70, octave=-1, delay=6.0, legato=.9); mel('square', b + 7, [H_END_OPEN], vel=70, octave=-1, delay=6.0, legato=.9)
bounce(b, A_CH, vel=98)
arps(b, A_CH, vel=60)
hops(b, A_CH, vel=64)
pad(b, A_CH, vel=46)
for k, ch in enumerate(A_CH):
    for m in tones(ch, 4): song.add('choir', song.bar(b + k), 3.95, m, 48)
drums(b, 8, level=1.05)
sparkle(b, 8, vel=62, density=3)
for k in (3, 7): fairy_run(song.bar(b + k) + 2.0, vel=64)
b += 8

# ── Kosmos C (8): groß und weit — Streicher, Hörner, Chor, Pauke; lange Töne, Harfenglissandi; Beat bleibt ─────────────────
mel('strings', b, COSMOS, vel=84, legato=1.0)
mel('horn', b, COSMOS, vel=82, octave=-1, legato=1.0)
mel('choir', b, COSMOS, vel=80, legato=1.0)
mel('flute', b, COSMOS, vel=70, octave=1, legato=1.0)
mel('oohs', b, COSMOS, vel=64, octave=0, legato=1.0)
bounce(b, C_CH, vel=92)
arps(b, C_CH, vel=52)
pad(b, C_CH, vel=48, inst='strings')
timp_beat(b, C_CH, vel=96)
drums(b, 8, level=1.1)
sparkle(b, 8, vel=62, density=4)
for k in (1, 3, 5, 7): fairy_run(song.bar(b + k), vel=60, up=(k % 4 == 1), inst='harp')
roll(b + 7, 2, 4, 44, 112)
b += 8

# ── Tanz der Kinder (8): Spieluhr-Melodie, nur Klatschen; ab Takt 5 baut sich der Drop auf (Wirbel, Riser) ──────────────────
mel('glock', b, DANCE, vel=86, octave=0); mel('glock', b + 4, DANCE, vel=88, octave=0)
mel('vibes', b, DANCE, vel=70, octave=-1); mel('vibes', b + 4, DANCE, vel=72, octave=-1)
mel('oohs', b + 4, DANCE, vel=62, octave=0)
pad(b, DANCE_CH, vel=34, inst='strings')
for k, ch in enumerate(DANCE_CH):
    t = song.bar(b + k)
    for i in range(4): song.dr(t + i, CLAP, int(78 + (14 if k >= 4 else 0)), 0.12)
    song.add('bass', t, 1.9, root_pitch(ch), 70)
    if k >= 4:
        for beat in range(4): song.dr(t + beat, KICK, 84 + 3 * k, 0.15)
riser(song.bar(b + 4), 16.0, pitch=pn('Ab4'), vel=56, lo=-12.0, hi=14.0, steps=48)
roll(b + 6, 0, 8, 40, 126)
timp_beat(b + 4, DANCE_CH[4:], vel=86)
b += 8

# ── Alle +2 (8): B-Dur — alle Stimmen gleichzeitig, der Hook in Square, Flöte, Kinderchor, Glockenspiel, Hörnern ────────────
S = 2
hook_layer(b, A_CH, H_END_OPEN, shift=S, vel=102)
mel('oohs', b, HOOK, shift=S, vel=70, octave=1); mel('oohs', b + 7, [H_END_OPEN], shift=S, vel=70, octave=1)
mel('glock', b, HOOK, shift=S, vel=64, octave=1); mel('glock', b + 7, [H_END_OPEN], shift=S, vel=64, octave=1)
mel('horn', b, HOOK, shift=S, vel=66, octave=-1); mel('horn', b + 7, [H_END_OPEN], shift=S, vel=66, octave=-1)
bounce(b, A_CH, shift=S, vel=100)
arps(b, A_CH, shift=S, vel=64)
hops(b, A_CH, shift=S, vel=66)
pad(b, A_CH, shift=S, vel=48)
timp_beat(b, A_CH, shift=S, vel=90)
drums(b, 8, level=1.15)
sparkle(b, 8, shift=S, vel=64, density=4)
fairy_run(song.bar(b + 7) + 1.0, shift=S, vel=70)
b += 8

# ── Finale +2 (8): alles, geschlossen auf B; Kanon-Echo im Kinderchor ─────────────────────────────────────────────────────────
hook_layer(b, A_CH2, H_END_CLOSED, shift=S, vel=106)
mel('oohs', b, HOOK, shift=S, vel=72, octave=1, delay=2.0); mel('oohs', b + 7, [H_END_CLOSED], shift=S, vel=72, octave=1, delay=2.0)
mel('glock', b, HOOK, shift=S, vel=66, octave=1); mel('glock', b + 7, [H_END_CLOSED], shift=S, vel=66, octave=1)
mel('horn', b, HOOK, shift=S, vel=68, octave=-1); mel('horn', b + 7, [H_END_CLOSED], shift=S, vel=68, octave=-1)
mel('strings', b, HOOK, shift=S, vel=60, octave=-1); mel('strings', b + 7, [H_END_CLOSED], shift=S, vel=60, octave=-1)
bounce(b, A_CH2, shift=S, vel=102)
arps(b, A_CH2, shift=S, vel=66)
hops(b, A_CH2, shift=S, vel=66)
pad(b, A_CH2, shift=S, vel=50)
timp_beat(b, A_CH2, shift=S, vel=96)
drums(b, 8, level=1.18)
sparkle(b, 8, shift=S, vel=66, density=5)
b += 8

# ── Coda (4): Es (Dominante zur As-Dur-Genesis) — letzter Funkenschauer, dann Stille für den Schlussglockenton ────────────────
for k in range(2):
    for m in tones('Eb', 3): song.add('strings', song.bar(b + k), 3.95, m, 56); song.add('choir', song.bar(b + k), 3.95, m, 52)
    song.add('bass', song.bar(b + k), 3.9, pn('Eb2'), 90)
drums(b, 2, level=1.0, fills=False)
arps(b, ['Eb', 'Eb'], vel=58)
sparkle(b, 2, vel=62, density=4)
fairy_run(song.bar(b + 1) + 2.0, vel=70)
fairy_run(song.bar(b + 2), shift=0, vel=62, up=False, inst='glock')
song.add('bell', song.bar(b + 2), 4.0, pn('Eb5'), 66)
riser(song.bar(b + 2), 8.0, pitch=pn('Ab4'), vel=40, lo=8.0, hi=-12.0, steps=24)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('CRESTINA_NORENDER') != '1':
    sf2, out = cli_paths('bgm_crestina.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.0)
