# -*- coding: utf-8 -*-
"""Held-Thema „Kyli, the Deceptive Sapling“ → public/music/bgm_kyli.ogg                  Titel: „Come Closer, Little One“

Kyli ist durch und durch bösartig, aus dem Holz eines untoten Baumes, der die ganze Welt befallen will. Sie nimmt die Gestalt eines jungen Mädchens an, lockt
Schüler zum Baum und opfert sie dort (Card Art: weißhaariges Mädchen mit roten Augen vor Stadtkulisse, links Holzmaske, rechts der tote Baum mit roter Frucht).
Das Theme klingt bösartig, finster, furchteinflößend — aber **subtil und verborgen**.

  • Die Maske: ein **süßes Wiegenlied** (G-Dur, pentatonisch, Kinderchor-Oohs + Flöte) im schaukelnden **12/8** — ein Takt = vier punktierte Viertel (116er-Puls, ★ 126 BPM
    pro punktierter Viertel, drei Triolenachtel je Schlag). Darunter wiegt eine Marimba den Rhythmus wie eine Wiege.
  • Das Verborgene: ein leiser Pedalton und ein **fast unhörbares As** (♭II) im Glas-Streicher, Herzschlag in der Pauke, flüsternde tiefe Chor-Cluster. Von Abschnitt zu
    Abschnitt „verrottet“ das Lied: aus G-Dur wird G-Moll (H→B, E→Es), Fagott und Kontrabass kriechen chromatisch unter der Melodie (Wurzeln), Xylophon klopft wie Holz.
  • Die Enthüllung: im Baum-Teil singt das Lied tief in Posaune und Männerchor in Moll, das Mädchen singt oben unverändert weiter — süß über dem Grauen.
    Opfer-Break: Solo-Stimme, Glocke, kein Schlagzeug. Ernte: das Lied steigt halbtonweise („Befall“). Reprise: wieder das süße Wiegenlied — aber jetzt weiß man, was darunter liegt.
Form (56 Takte ≈ 1:47): Intro 4 · „Komm spielen“ A 8 · Wurzeln B 8 · Der Baum C 8 · Opfer 8 · Ernte E 8 (+1/+2) · Reprise F 8 · Coda 4
Ausklang auf D7 (Dominante) → zurück in die G-Dur-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 126, 56
song = Song(BPM, BARS)
rng = random.Random(1348)
T3 = 1.0 / 3.0

song.inst('oohs', 'oohs', vol=80, pan=62)              # Kinderchor (Wiegenlied)
song.inst('flute', 'flute', vol=70, pan=84)
song.inst('marimba', 'marimba', vol=76, pan=44)         # Wiege (Triolen)
song.inst('xylo', 'xylo', vol=62, pan=90)               # Klopfen auf Holz
song.inst('pizz', 'pizz', vol=70, pan=30)
song.inst('bassoon', 'bassoon', vol=78, pan=52)
song.inst('bass', 'contra', vol=94, pan=62)
song.inst('choir', 'choir', vol=70, pan=70)             # tiefer Männerchor
song.inst('goblins', 'goblins', vol=54, pan=86)
song.inst('bowed', 'bowed', vol=56, pan=26)
song.inst('tremolo', 'tremolo', vol=58, pan=46)
song.inst('trombone', 'trombone', vol=80, pan=40)
song.inst('timp', 'timp', vol=100, pan=64)
song.inst('bell', 'bell', vol=70, pan=68)
song.inst('violin', 'violin', vol=60, pan=78)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'G': (7, 'M'), 'Em': (4, 'm'), 'C': (0, 'M'), 'D': (2, 'M'), 'Gm': (7, 'm'), 'Eb': (3, 'M'),
      'Cm': (0, 'm'), 'D7': (2, '7'), 'Ab': (8, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7), '7': (0, 4, 7, 10)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def minorize(bars):
    """Das Lied „verrottet“: H→B, E→Es (große Terz/Sexte werden klein); Fis vor D bleibt."""
    out = []
    for bar in bars:
        nb = []
        for name, d in bar:
            if name is not None and name[0] in 'BE' and name[1] not in '#b':
                name = name[0] + 'b' + name[1:]
            nb.append((name, d))
        out.append(nb)
    return out

def mel(inst, bar0, bars, shift=0, vel=88, octave=0, legato=.96, interval=0):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave + interval, hv(vel))
            t += dur

# Pitch-Bend (±12 Halbtöne) für Goblins, Posaune, Violine
def bend_setup(name):
    ch = song.ch[name][0]
    for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
        song.ev.append((0, -2, mido.Message('control_change', channel=ch, control=cc, value=v)))
for _n in ('goblins', 'trombone', 'violin'): bend_setup(_n)

def glide(name, beat, dur, pitch, vel, lo, hi, steps=16):
    ch = song.ch[name][0]
    song.add(name, beat, dur + 0.2, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.25) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

# ═══ Material (G) ═════════════════════════════════════════════════════════════════════════════════
A_CH = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D']
A_CH2 = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'G']
LULL = [
    [('B4', 1), ('D5', 2 * T3), ('E5', T3), ('D5', 2)],
    [('E5', 1), ('D5', 2 * T3), ('B4', T3), ('G4', 2)],
    [('G4', 1), ('C5', 2 * T3), ('E5', T3), ('G5', 2)],
    [('F#5', 1), ('E5', 2 * T3), ('D5', T3), ('A4', 2)],
    [('B4', 1), ('D5', 2 * T3), ('E5', T3), ('D5', 2)],
    [('E5', 1), ('G5', 2 * T3), ('E5', T3), ('D5', 2)],
    [('E5', 1), ('D5', 2 * T3), ('C5', T3), ('G4', 2)],
]
L_END_OPEN = [('A4', 1), ('F#4', 2 * T3), ('A4', T3), ('D5', 2)]
L_END_CLOSED = [('G4', 4)]

B_CH = ['Gm', 'Eb', 'Cm', 'D7', 'Gm', 'Eb', 'Ab', 'D7']
C_CH = ['Gm', 'Ab', 'Gm', 'D7', 'Gm', 'Eb', 'Ab', 'D7']
O_CH = ['Gm', 'Gm', 'Ab', 'Ab', 'Cm', 'Cm', 'D7', 'D7']
O_MEL = [
    [('Bb4', 2), ('D5', 2)], [('G5', 4)], [('F5', 2), ('Eb5', 2)], [('C5', 4)],
    [('Eb5', 2), ('G5', 2)], [('F5', 4)], [('F#5', 2), ('A5', 2)], [('A5', 3), (None, 1)],
]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root_pitch(ch, shift=0, oct_=1):
    r = tones(ch, oct_, shift)[0]
    while r < 28: r += 12
    while r > 48: r -= 12
    return r

def cradle(bar0, chords, shift=0, vel=58, inst='marimba'):
    """Wiege: 12 Triolenachtel pro Takt (Grundton–Quinte–Terz), Betonung auf jeder punktierten Viertel."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        pat = (T[0], T[2], T[1] if ch != 'D7' else T[1])
        t = song.bar(bar0 + k)
        for i in range(12):
            song.add(inst, t + i * T3, 0.3, pat[i % 3], hv(vel + (12 if i % 3 == 0 else 0)))

def knock(bar0, nbars, vel=62):
    """Xylophon klopft auf Holz: Zählzeit 2 und 4, Doppelschlag."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for beat in (1, 3):
            song.add('xylo', t + beat, 0.1, pn('G6'), hv(vel)); song.add('xylo', t + beat + T3, 0.1, pn('D6'), hv(vel - 10))

def drone(bar0, nbars, shift=0, vel=50):
    """Pedalton G (Kontrabass) — das Lied hat festen Boden."""
    for k in range(nbars):
        song.add('bass', song.bar(bar0 + k), 3.95, pn('G1') + shift, vel)

def poison(bar0, nbars, shift=0, vel=26):
    """Das fast Unhörbare: As (♭II) und Es im Glas-Streicher, hoch, ppp."""
    for k in range(nbars):
        song.add('bowed', song.bar(bar0 + k), 3.95, pn('Ab5') + shift, vel)
        if k % 2 == 1: song.add('bowed', song.bar(bar0 + k), 3.95, pn('D6') + shift, vel - 4)

def whispers(bar0, nbars, vel=34):
    """Geflüsterte tiefe Chor-Cluster (phrygisch: G, As, D)."""
    for k in range(nbars):
        t = song.bar(bar0 + k) + rng.choice((0, 1, 2))
        base = rng.choice((pn('G3'), pn('D4'), pn('Bb3')))
        for iv in (0, 1, 7):
            song.add('choir', t, 1.6 + rng.random(), base + iv, vel + rng.randint(-4, 4))

def heartbeat(bar0, nbars, vel=44):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.4, pn('G2') + 12, vel); song.add('timp', t + T3 * 1.5, 0.4, pn('G2') + 12, vel - 14)

def creep(bar0, chords, shift=0, vel=70):
    """Wurzeln: Fagott und Kontrabass kriechen chromatisch (Grundton → Halbton → zurück), langsam."""
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift, 2)
        t = song.bar(bar0 + k)
        for i, off in enumerate((0, 1, 0, -1)):
            song.add('bassoon', t + i, 0.9, r + off, hv(vel + (6 if i == 0 else 0)))
        song.add('bass', t, 1.9, root_pitch(ch, shift), hv(vel + 8)); song.add('bass', t + 2, 1.9, root_pitch(ch, shift) + 7, hv(vel))

def pizz_trip(bar0, chords, shift=0, vel=58):
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        t = song.bar(bar0 + k)
        for beat in (1, 3):
            for j, m in enumerate((T[0], T[1], T[2])):
                song.add('pizz', t + beat + j * T3, 0.2, m, hv(vel))

def drums(bar0, nbars, level=1.0, style='quiet', fills=False):
    """12/8: Backbeat auf den punktierten Vierteln 2 und 4; quiet: Sidestick-Ticks, leiser Herzschlag; heavy: Kick 1+3, Snare 2+4, Triolen-Hi-Hat."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        if style == 'quiet':
            song.dr(t, KICK, int(64 * L), 0.15)
            for beat in (1, 3): song.dr(t + beat, SIDESTICK, int(56 * L), 0.1)
            for i in range(4): song.dr(t + i, HAT, int(58 * L), 0.06)
        else:
            song.dr(t, KICK, int(106 * L), 0.2); song.dr(t + 2, KICK, int(100 * L), 0.2); song.dr(t + 2 + 2 * T3, KICK, int(80 * L), 0.15)
            for beat in (1, 3): song.dr(t + beat, SNARE, int(106 * L), 0.15)
            for i in range(12): song.dr(t + i * T3, HAT, int((88 if i % 3 == 0 else 66) * L), 0.06)
            if k == 0: song.dr(t, CRASH, int(100 * L), 1.8)
            if fills and k % 4 == 3:
                for j in range(6): song.dr(t + 2 + j * T3, (TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L)[j], int((84 + 5 * j) * L), 0.12)

def roll(bar0, start, end, v0=44, v1=120):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 3)
    for i in range(n): song.dr(t0 + i * T3, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=112):
    n = int(dur * 3)
    for i in range(n): song.add('timp', beat + i * T3, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def tolls(bar0, nbars, every=2, vel=66, shift=0):
    for k in range(0, nbars, every):
        song.add('bell', song.bar(bar0 + k), 3.9, pn('G4') + shift, vel)
        song.add('bell', song.bar(bar0 + k), 3.9, pn('Db5') + shift, vel - 14)

def tremolo_pad(bar0, chords, shift=0, vel=46):
    for k, ch in enumerate(chords):
        for m in tones(ch, 3, shift): song.add('tremolo', song.bar(bar0 + k), 3.95, m, vel)

def hits(bar0, chords, shift=0, vel=96):
    """Posaune + Männerchor-Stoß auf der 1 jedes zweiten Takts."""
    for k, ch in enumerate(chords):
        if k % 2: continue
        T = tones(ch, 3, shift)
        t = song.bar(bar0 + k)
        for m in (T[0], T[2]): song.add('trombone', t, 1.8, m, hv(vel)); song.add('choir', t, 1.8, m + 12, hv(vel - 14))
        song.add('timp', t, 1.2, root_pitch(ch, shift) + 12, hv(vel + 6))

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): das Mädchen summt allein; im letzten Takt ein falscher Ton (As) und ein einzelner Herzschlag ───────
mel('oohs', b, LULL[:2], vel=60)
mel('flute', b + 2, [LULL[2], [('D5', 1), ('C5', 2 * T3), ('B4', T3), ('G4', 2)]], vel=50, octave=1)
drone(b, 4, vel=40)
song.add('bowed', song.bar(b + 3), 3.95, pn('Ab5'), 30)
heartbeat(b + 3, 1, vel=52)
song.add('bell', song.bar(b + 3) + 2, 2.0, pn('Db5'), 44)
b += 4

# ── „Komm spielen“ A (8): das süße Wiegenlied, Wiege, kaum hörbares Gift ────────────────────────────────
for inst, o, v in (('oohs', 0, 80), ('flute', 1, 60)):
    mel(inst, b, LULL, vel=v, octave=o); mel(inst, b + 7, [L_END_OPEN], vel=v, octave=o)
cradle(b, A_CH, vel=54)
drone(b, 8, vel=54)
poison(b, 8)
heartbeat(b, 8, vel=40)
drums(b, 8, level=0.8, style='quiet')
whispers(b, 8, vel=26)
glide('goblins', song.bar(b + 7), 3.9, pn('G5'), 30, 0.0, -6.0)
b += 8

# ── Wurzeln B (8): die Maske rutscht — das Lied in Moll, Wurzeln kriechen, Holz klopft, Pizzicato-Triolen ───────
B_LULL = minorize(LULL)
for inst, o, v in (('oohs', 0, 76), ('flute', 1, 54)):
    mel(inst, b, B_LULL, vel=v, octave=o); mel(inst, b + 7, minorize([L_END_OPEN]), vel=v, octave=o)
cradle(b, B_CH, vel=58)
creep(b, B_CH)
knock(b, 8)
pizz_trip(b, B_CH)
poison(b, 8, vel=34)
heartbeat(b, 8, vel=52)
drums(b, 8, level=0.95, style='quiet')
whispers(b, 8, vel=34)
tremolo_pad(b, B_CH, vel=34)
roll(b + 7, 2, 4, 44, 100)
b += 8

# ── Der Baum C (8): Enthüllung — das Lied tief in Posaune und Männerchor, das Mädchen singt oben unverändert weiter ──
mel('trombone', b, minorize(LULL), vel=96, octave=-1); mel('trombone', b + 7, minorize([L_END_OPEN]), vel=96, octave=-1)
mel('choir', b, minorize(LULL), vel=80, octave=-1); mel('choir', b + 7, minorize([L_END_OPEN]), vel=80, octave=-1)
mel('oohs', b, LULL, vel=66, octave=1); mel('oohs', b + 7, [L_END_OPEN], vel=66, octave=1)      # unverändert, süß, darüber
cradle(b, C_CH, vel=60)
creep(b, C_CH, vel=84)
hits(b, C_CH)
tremolo_pad(b, C_CH, vel=56)
knock(b, 8, vel=70)
for k in (1, 3, 5, 7): glide('violin', song.bar(b + k), 3.8, pn('G5'), 70, 0.0, 2.0 if k % 4 == 3 else -2.0)
drums(b, 8, level=1.05, style='heavy', fills=True)
poison(b, 8, vel=48)
tolls(b, 8)
b += 8

# ── Opfer (8): kein Schlagzeug — Solostimme, Glocke, Herzschlag, wachsender Cluster; am Ende Wirbel ────────────
mel('oohs', b, O_MEL, vel=72, legato=1.0)
mel('flute', b, O_MEL, vel=44, octave=1, legato=1.0)
for k, ch in enumerate(O_CH):
    for m in tones(ch, 3): song.add('tremolo', song.bar(b + k), 3.95, m, 36 + 5 * k)
    song.add('choir', song.bar(b + k), 3.95, tones(ch, 3)[0], 34 + 6 * k)
drone(b, 8, vel=56)
heartbeat(b, 8, vel=54)
tolls(b, 8, every=1, vel=70)
poison(b, 8, vel=52)
whispers(b, 8, vel=40)
glide('goblins', song.bar(b + 4), 15.0, pn('G5'), 52, -6.0, 6.0, steps=32)
timp_roll(song.bar(b + 6), 8.0, pn('G2') + 12, 36, 112)
roll(b + 7, 0, 4, 40, 122)
b += 8

# ── Ernte E (8): das Lied steigt halbtonweise (+0, +1 pro 2 Takte, … ) — der Befall; alles voll; oben süß ───────
FULL = LULL + [L_END_OPEN]
for blk in range(4):
    sh = blk
    bb = b + 2 * blk
    sub = minorize(FULL)[2 * blk:2 * blk + 2]
    mel('trombone', bb, sub, shift=sh, vel=100, octave=-1)
    mel('choir', bb, sub, shift=sh, vel=84, octave=-1)
    mel('bassoon', bb, sub, shift=sh, vel=80, octave=-1)
    mel('oohs', bb, FULL[2 * blk:2 * blk + 2], shift=sh, vel=66, octave=1)
    mel('violin', bb, sub, shift=sh, vel=70, octave=1)
cradle(b, C_CH, vel=62)
creep(b, C_CH, vel=88)
hits(b, C_CH, vel=102)
tremolo_pad(b, C_CH, vel=58)
knock(b, 8, vel=74)
drums(b, 8, level=1.12, style='heavy', fills=True)
poison(b, 8, vel=54)
tolls(b, 8, every=1)
whispers(b, 8, vel=44)
b += 8

# ── Reprise F (8): wieder das süße Wiegenlied — jetzt weiß man, was darunter liegt ──────────────────────────
for inst, o, v in (('oohs', 0, 84), ('flute', 1, 64)):
    mel(inst, b, LULL, vel=v, octave=o); mel(inst, b + 7, [L_END_CLOSED], vel=v, octave=o)
cradle(b, A_CH2, vel=58)
drone(b, 8, vel=62)
creep(b, ['Gm'] * 8, vel=58)
poison(b, 8, vel=40)
heartbeat(b, 8, vel=58)
drums(b, 8, level=0.9, style='quiet')
hits(b, ['Gm'] * 8, vel=70)
whispers(b, 8, vel=34)
b += 8

# ── Coda (4): D7 (Dominante) — das letzte Lächeln, der As-Cluster, ein Schlag ───────────────────────────────
mel('oohs', b, [[('A4', 1), ('F#4', 2 * T3), ('A4', T3), ('D5', 2)], [('F#5', 3), (None, 1)]], vel=64)
for k in range(3):
    for m in tones('D7', 3): song.add('tremolo', song.bar(b + k), 3.95, m, 44 + 6 * k)
    song.add('bass', song.bar(b + k), 3.95, pn('D2'), 70)
poison(b, 3, vel=44)
heartbeat(b, 3, vel=64)
drums(b, 3, level=0.8, style='quiet')
timp_roll(song.bar(b + 2), 5.0, pn('D2') + 12, 40, 100)
roll(b + 3, 0, 3, 40, 110)
song.add('bell', song.bar(b + 3), 3.0, pn('D5'), 72)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('KYLI_NORENDER') != '1':
    sf2, out = cli_paths('bgm_kyli.ogg')
    song.render(sf2, out, target_rms=0.25, saturate=False, compress=True, air_cut=0.15)
