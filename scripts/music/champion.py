# -*- coding: utf-8 -*-
"""Held-Thema „Champion“ → public/music/bgm_champion.ogg                              Titel: „Eye of the Storm, Hand on the Hilt“

Champion ist der „stärkste Soldat der Welt“: sein Schwert erzeugt bei jedem Schwung einen Sturm, und er musste sich angeblich noch nie
in einem Kampf anstrengen (Card Art: purpurner Panzer, ausgestreckter Arm, dunstiger Windwirbel über Waldwiese und Fluss).
Das Theme verkörpert den Sturm und zugleich Überlegenheit — einen Helden jenseits des Menschlichen.

  • Der Trick: **der Sturm tobt im Orchester, der Held bleibt gelassen.** Streicher-16tel wirbeln als Orkan (Arpeggien über zwei Oktaven,
    Flöten-Böen, Tremolo, Wind-Pad), Pauken und Toms donnern — aber das Thema darüber ist ein *langsames*, breit atmendes Heldenthema in langen
    Noten (Horn, Posaune, Chor, später Trompete). Es hetzt nie. Wer so ruhig singt, während die Welt untergeht, strengt sich nicht an.
  • Jeder Schwerthieb = „Whoosh“ (Pitch-Bend-Glissando eines Wind-Pads von unten nach oben) + Donnerschlag (Becken, Pauke, Tom-Cluster) auf dem
    Folgeschlag: der Schwung erzeugt den Sturm.
  • C-Moll, 148 BPM, 4/4; Progression Cm – A♭ – E♭ – B♭ | Cm – A♭ – Fm – G. Mitte: „Auge des Sturms“ — der Orkan wird flüsterleise,
    nur Chor, Tremolo und Pauke: der Held steht still im Zentrum. Danach bricht der Sturm ein Stück stärker wieder los; Finale einen Ganzton höher (D-Moll).
Form (64 Takte ≈ 1:44): Intro 4 · Sturm A 8 · Sturm A' 8 (Blech) · Auge 8 · Sturm C 8 (Trompeten, Orgel) · Donnerschlag 8 · Finale +2 8 · Finale +2 geschlossen 8 · Coda 4
Ausklang auf G (Dominante) → Wind der C-Moll-Intro.
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

BPM, BARS = 148, 64
song = Song(BPM, BARS)
rng = random.Random(1789)

song.inst('swirl', 'strings', vol=84, pan=30)          # Streicher-Orkan (spiccato 16tel)
song.inst('tremolo', 'tremolo', vol=74, pan=96)
song.inst('flute', 'flute', vol=70, pan=82)             # Böen
song.inst('wind', 'sweep', vol=70, pan=64)              # Whoosh (Pitch-Bend)
song.inst('horn', 'horns', vol=84, pan=48)
song.inst('trombone', 'trombone', vol=88, pan=72)
song.inst('tuba', 'tuba', vol=92, pan=60)
song.inst('trumpet', 'trumpet', vol=86, pan=58)
song.inst('choir', 'choir', vol=78, pan=64)
song.inst('oohs', 'oohs', vol=64, pan=40)
song.inst('organ', 'pipeorgan', vol=62, pan=64)
song.inst('timp', 'timp', vol=104, pan=64)
song.inst('bass', 'bass', vol=98, pan=62)

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def pn(s):
    a, i = 0, 1
    if s[1] in '#b':
        a, i = (1 if s[1] == '#' else -1), 2
    return 12 * (int(s[i:]) + 1) + NAMES[s[0]] + a

CH = {'Cm': (0, 'm'), 'Ab': (8, 'M'), 'Eb': (3, 'M'), 'Bb': (10, 'M'), 'Fm': (5, 'm'), 'G': (7, 'M')}
QUAL = {'M': (0, 4, 7), 'm': (0, 3, 7)}

def tones(ch, oct_, shift=0):
    root, q = CH[ch]
    r = (root + shift) % 12 + 12 * (oct_ + 1)
    return [r + i for i in QUAL[q]]

def hv(v): return int(max(1, min(127, v + rng.randint(-3, 3))))

def mel(inst, bar0, bars, shift=0, vel=92, octave=0, legato=.97):
    for k, bar in enumerate(bars):
        t = song.bar(bar0 + k)
        for name, dur in bar:
            if name is not None:
                song.add(inst, t, max(0.1, dur * legato), pn(name) + shift + 12 * octave, hv(vel))
            t += dur

# Pitch-Bend (±12 Halbtöne) für den Wind
for cc, v in ((101, 0), (100, 0), (6, 12), (38, 0), (101, 127), (100, 127)):
    song.ev.append((0, -2, mido.Message('control_change', channel=song.ch['wind'][0], control=cc, value=v)))

def whoosh(beat, dur=2.0, pitch=60, vel=92, lo=-9.0, hi=9.0, steps=16):
    """Der Schwerthieb: Wind-Pad gleitet in `dur` Schlägen von lo nach hi Halbtönen."""
    ch = song.ch['wind'][0]
    song.add('wind', beat, dur + 0.3, pitch, vel)
    for i in range(steps + 1):
        f = i / steps
        song.ev.append((int(round((beat + dur * f) * TPB)), 0,
                        mido.Message('pitchwheel', channel=ch, pitch=int(max(-8192, min(8191, (lo + (hi - lo) * f) / 12.0 * 8192))))))
    song.ev.append((int(round((beat + dur + 0.35) * TPB)), 0, mido.Message('pitchwheel', channel=ch, pitch=0)))

def thunder(beat, vel=104, big=True):
    """Donnerschlag auf dem Schlag nach dem Hieb: Becken, Pauken-Cluster, Toms, große Trommel."""
    song.dr(beat, CRASH, vel, 2.0); song.dr(beat, KICK, vel, 0.3)
    for j, tom in enumerate((TOM_H, TOM_M, TOM_L, TOM_L)): song.dr(beat + j * 0.125, tom, vel - 6 - j * 2, 0.2)
    song.add('timp', beat, 1.5, pn('C2') + 12, vel)
    if big: song.add('timp', beat, 1.5, pn('G2'), vel - 12)

def sword(beat, shift=0, vel=96, big=True):
    """Hieb + Donner: Whoosh in den Beat hinein, Schlag auf dem Folgebeat."""
    whoosh(beat - 2.0, 2.0, pitch=pn('C4') + shift, vel=vel)
    thunder(beat, vel=vel + 8, big=big)

# ═══ Material (C-Moll) ═════════════════════════════════════════════════════════════════════════════
A_CH = ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'G']
A_CH2 = ['Cm', 'Ab', 'Eb', 'Bb', 'Cm', 'Ab', 'Fm', 'Cm']
H = [
    [('C5', 1.5), ('D5', .5), ('Eb5', 2)],
    [('Eb5', 1.5), ('F5', .5), ('Ab5', 2)],
    [('G5', 1.5), ('F5', .5), ('Eb5', 2)],
    [('D5', 3), ('F5', 1)],
    [('C5', 1.5), ('D5', .5), ('Eb5', 2)],
    [('Eb5', 1.5), ('F5', .5), ('Ab5', 2)],
    [('C6', 2), ('Bb5', 1), ('Ab5', 1)],
]
H_END_OPEN = [('G5', 3), (None, 1)]
H_END_CLOSED = [('C5', 4)]

EYE_CH = ['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G']
EYE = [
    [('G5', 4)], [('Eb5', 2), ('D5', 2)], [('C5', 4)], [('Eb5', 2), ('F5', 2)],
    [('Ab5', 4)], [('G5', 2), ('F5', 2)], [('D5', 2), ('B4', 2)], [('D5', 3), (None, 1)],
]

THUNDER_CH = ['Cm', 'Cm', 'Ab', 'Ab', 'Bb', 'Bb', 'G', 'G']

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def storm(bar0, chords, shift=0, vel=76, level=1.0):
    """Orkan: Streicher-Sechzehntel über zwei Oktaven (auf und ab) + Tremolo-Akkord."""
    order = (0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0, 1, 2, 1)
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        ext = [T[0], T[1], T[2], T[0] + 12, T[1] + 12, T[2] + 12, T[0] + 24]
        t = song.bar(bar0 + k)
        for i, ix in enumerate(order):
            song.add('swirl', t + i * 0.25, 0.2, ext[ix], hv(int((vel + (14 if i % 4 == 0 else (6 if i % 2 == 0 else 0))) * level)))
        for m in (T[0] + 12, T[1] + 12, T[2] + 12):
            song.add('tremolo', t, 3.95, m, int(52 * level))

def gusts(bar0, nbars, every=2, vel=64, shift=0):
    """Flöten-Böen: chromatische 16tel-Läufe nach oben, jeweils zum Taktende hin."""
    for k in range(0, nbars, every):
        t = song.bar(bar0 + k) + 2.5
        start = rng.choice((pn('G5'), pn('A5'), pn('Bb5'))) + shift
        for i in range(6):
            song.add('flute', t + i * 0.25, 0.25, start + i + (i // 3), hv(vel + i * 3))

def bass_line(bar0, chords, shift=0, vel=100):
    for k, ch in enumerate(chords):
        r = tones(ch, 1, shift)[0] + 12
        if r > 48: r -= 12
        t = song.bar(bar0 + k)
        for i in range(8):
            song.add('bass', t + i * 0.5, 0.42, r + (12 if i == 5 else 0), hv(vel + (8 if i % 2 == 0 else -6)))
        song.add('tuba', t, 3.9, r - 12 if r - 12 >= 28 else r, hv(vel - 4))

def timp_beat(bar0, chords, shift=0, vel=100):
    for k, ch in enumerate(chords):
        r = tones(ch, 2, shift)[0] + 12
        if r > 55: r -= 12
        t = song.bar(bar0 + k)
        song.add('timp', t, 0.8, r, hv(vel)); song.add('timp', t + 1.5, 0.4, r, hv(vel - 26))
        song.add('timp', t + 2, 0.8, r, hv(vel - 6)); song.add('timp', t + 3.5, 0.4, r, hv(vel - 22))

def drums(bar0, nbars, level=1.0, crash=True, fills=True):
    """Gewitter-Beat: Kick 1, 2&, 3, 4&; Snare 2/4; offene Hi-Hat-Achtel; Tom-Fill alle 4 Takte."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        for beat, v in ((0, 108), (1.5, 90), (2, 102), (3.5, 86)): song.dr(t + beat, KICK, int(v * L), 0.15)
        for beat in (1, 3): song.dr(t + beat, SNARE, int(108 * L), 0.15)
        for i in range(8): song.dr(t + i * 0.5, HAT, int((100 if i % 2 == 0 else 82) * L), 0.06)
        if k == 0 and crash: song.dr(t, CRASH, int(108 * L), 1.6)
        if fills and k % 4 == 3:
            for j in range(6): song.dr(t + 2.5 + j * 0.25, (TOM_H, TOM_H, TOM_M, TOM_M, TOM_L, TOM_L)[j], int((86 + 5 * j) * L), 0.12)

def roll(bar0, start, end, v0=44, v1=122):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def timp_roll(beat, dur, note, v0=36, v1=112):
    n = int(dur * 4)
    for i in range(n): song.add('timp', beat + i * 0.25, 0.3, note, int(v0 + (v1 - v0) * i / max(1, n - 1)))

def pad(bar0, chords, shift=0, vel=56, inst='oohs', oct_=3):
    for k, ch in enumerate(chords):
        for m in tones(ch, oct_, shift):
            song.add(inst, song.bar(bar0 + k), 3.95, m, vel)

def hero_theme(base, chords, end, shift=0, vel=92, tpt=False, org=False):
    """Das ruhige Heldenthema über dem Sturm: Horn + Posaune (+ Chor) in langen Noten; optional Trompete, Orgel."""
    for inst, o, v in (('horn', 0, vel), ('trombone', -1, vel - 4), ('choir', -1, vel - 14)):
        mel(inst, base, H, shift=shift, vel=v, octave=o); mel(inst, base + 7, [end], shift=shift, vel=v, octave=o)
    if tpt: mel('trumpet', base, H, shift=shift, vel=vel - 6, octave=0); mel('trumpet', base + 7, [end], shift=shift, vel=vel - 6, octave=0)
    if org:
        pad(base, chords, shift=shift, vel=50, inst='organ', oct_=2)
    pad(base, chords, shift=shift, vel=46)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Wind zieht auf, Böen, Donner in der Ferne; der erste Hieb im letzten Takt ──────────────────
whoosh(song.bar(b), 8.0, pitch=pn('C4'), vel=66, lo=-12.0, hi=8.0, steps=32)
for k in range(4):
    for iv in (0, 7): song.add('tremolo', song.bar(b + k), 3.95, pn('C3') + iv + 12, 40 + k * 8)
gusts(b, 4, every=1, vel=52)
timp_roll(song.bar(b + 1), 6.0, pn('C3'), 30, 96)
for k in range(2): song.dr(song.bar(b + k) + 3, TOM_L, 50 + 14 * k, 0.3)
roll(b + 3, 0, 2, 40, 100)
sword(song.bar(b + 3) + 3.0, vel=100)
b += 4

# ── Sturm A (8): Orkan voll, das ruhige Heldenthema in Horn/Posaune/Chor; Hieb am Ende ───────────────────
storm(b, A_CH, vel=78)
hero_theme(b, A_CH, H_END_OPEN, vel=92)
bass_line(b, A_CH)
timp_beat(b, A_CH)
drums(b, 8, level=1.0)
gusts(b, 8)
sword(song.bar(b + 7) + 3.0, vel=98)
b += 8

# ── Sturm A' (8): mehr Wucht — Trompete obendrauf; Hiebe in Takt 4 und 8 ─────────────────────────────────
storm(b, A_CH2, vel=82, level=1.05)
hero_theme(b, A_CH2, H_END_CLOSED, vel=98, tpt=True)
bass_line(b, A_CH2, vel=104)
timp_beat(b, A_CH2, vel=104)
drums(b, 8, level=1.08)
gusts(b, 8)
sword(song.bar(b + 3) + 3.0, vel=96, big=False)
sword(song.bar(b + 7) + 3.0, vel=102)
b += 8

# ── Auge des Sturms (8): Orkan fast still; Chor, Tremolo, einzelne Pauken; Held steht im Zentrum ──────────
mel('choir', b, EYE, vel=84, octave=0)
mel('oohs', b, EYE, vel=68, octave=0)
mel('horn', b, EYE, vel=76, octave=-1)
pad(b, EYE_CH, vel=62, inst='tremolo', oct_=3)
storm(b, EYE_CH, vel=46, level=0.6)
for k in range(8):
    song.add('timp', song.bar(b + k), 3.5, tones(EYE_CH[k], 2)[0] + 12 if tones(EYE_CH[k], 2)[0] + 12 < 55 else tones(EYE_CH[k], 2)[0], 52 + k * 4)
    song.add('bass', song.bar(b + k), 3.9, tones(EYE_CH[k], 1)[0] + 12 if tones(EYE_CH[k], 1)[0] + 12 <= 48 else tones(EYE_CH[k], 1)[0], 88)
whoosh(song.bar(b + 1), 6.0, pitch=pn('G4'), vel=40, lo=-3.0, hi=3.0, steps=16)
gusts(b + 4, 4, every=2, vel=36)
timp_roll(song.bar(b + 6) + 2, 6.0, pn('G2'), 40, 110)
roll(b + 7, 0, 4, 40, 118)
b += 8

# ── Sturm C (8): der Orkan bricht stärker wieder los; Trompeten + Orgel; Hiebe in Takt 2/4/6/8 ─────────────
storm(b, A_CH, vel=86, level=1.1)
hero_theme(b, A_CH, H_END_OPEN, vel=102, tpt=True, org=True)
bass_line(b, A_CH, vel=106)
timp_beat(b, A_CH, vel=106)
drums(b, 8, level=1.12)
gusts(b, 8, every=1, vel=68)
for k in (1, 3, 5):
    sword(song.bar(b + k) + 3.0, vel=96, big=False)
sword(song.bar(b + 7) + 3.0, vel=104)
b += 8

# ── Donnerschlag (8): Blech-Stöße, Pauken-Achtel, Hieb alle zwei Takte — „er streckt nur den Arm aus“ ────────
storm(b, THUNDER_CH, vel=84, level=1.1)
bass_line(b, THUNDER_CH, vel=106)
for k, ch in enumerate(THUNDER_CH):
    T = tones(ch, 3)
    for beat, dur in ((0, 0.9), (2.5, 0.9)):
        for m in T: song.add('trombone', song.bar(b + k) + beat, dur, m, 104); song.add('horn', song.bar(b + k) + beat, dur, m + 12, 98)
        song.add('organ', song.bar(b + k) + beat, dur, T[0] - 12, 92)
    for i in range(8): song.add('timp', song.bar(b + k) + i * 0.5, 0.4, tones(ch, 2)[0] + 12 if tones(ch, 2)[0] + 12 < 55 else tones(ch, 2)[0], 84 + (8 if i % 2 == 0 else 0))
drums(b, 8, level=1.12, fills=True)
for k in (0, 2, 4, 6):
    sword(song.bar(b + k) + 3.0, vel=98, big=False)
roll(b + 7, 1, 4, 56, 126)
b += 8

# ── Finale +2 (8): D-Moll, alles — Chor, Trompete, Orgel, Hiebe ───────────────────────────────────────────
S = 2
storm(b, A_CH, shift=S, vel=90, level=1.15)
hero_theme(b, A_CH, H_END_OPEN, shift=S, vel=106, tpt=True, org=True)
bass_line(b, A_CH, shift=S, vel=108)
timp_beat(b, A_CH, shift=S, vel=108)
drums(b, 8, level=1.15)
gusts(b, 8, every=1, vel=72, shift=S)
for k in (1, 3, 5):
    sword(song.bar(b + k) + 3.0, shift=S, vel=100, big=False)
sword(song.bar(b + 7) + 3.0, shift=S, vel=106)
b += 8

# ── Finale +2 geschlossen (8): Ganzschluss auf D-Moll ─────────────────────────────────────────────────────
storm(b, A_CH2, shift=S, vel=92, level=1.15)
hero_theme(b, A_CH2, H_END_CLOSED, shift=S, vel=108, tpt=True, org=True)
bass_line(b, A_CH2, shift=S, vel=108)
timp_beat(b, A_CH2, shift=S, vel=108)
drums(b, 8, level=1.15)
gusts(b, 8, every=1, vel=72, shift=S)
for k in (1, 3, 5):
    sword(song.bar(b + k) + 3.0, shift=S, vel=100, big=False)
b += 8

# ── Coda (4): G (Dominante zur C-Moll-Intro), letzter Hieb, Wind verebbt ───────────────────────────────────
CODA = ['G', 'G', 'G', 'G']
storm(b, CODA[:3], vel=84, level=1.05)
bass_line(b, CODA[:3], vel=104)
timp_beat(b, CODA[:3], vel=104)
for m in tones('G', 3): song.add('trombone', song.bar(b), 3.9, m, 100); song.add('horn', song.bar(b), 3.9, m + 12, 96)
drums(b, 3, level=1.05, fills=False)
sword(song.bar(b + 2) + 3.0, vel=104)
timp_roll(song.bar(b + 3), 4.0, pn('G2'), 60, 100)
whoosh(song.bar(b + 3), 4.0, pitch=pn('G4'), vel=70, lo=6.0, hi=-12.0, steps=24)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('CHAMP_NORENDER') != '1':
    sf2, out = cli_paths('bgm_champion.ogg')
    song.render(sf2, out, target_rms=0.27, saturate=False, compress=True, air_cut=0.2)
