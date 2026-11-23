# -*- coding: utf-8 -*-
"""Kampagnen-Score · „Gespräche unter Freunden“ → public/music/bgm_score_gespraeche_unter_freunden.ogg      Titel: „Sunny Side Talk“

Fröhlich, voller Energie, wie eine gute Zeit an einem Sommertag. Der erste Test für den Kampagnen-Score (Regeln und Hausklang: score_common.py).

Konzept: **ein Gespräch**. Jedes Instrument ist ein Freund mit eigener Stimme — die Pfeife (ungestüm, fröhlich), die Klarinette (witzig, Zwischenrufe), die Flöte (verträumt-lyrisch),
das Marimba (kichert), die Mundharmonika (warm, brummt zustimmend). Sie reichen sich in der Strophe die Melodie weiter, fallen sich in der Bridge im Frage-Antwort-Spiel ins Wort
und sprechen im letzten Refrain alle gleichzeitig — vor Freude. Die Pfeife trägt den **Ohrwurm** (ein Refrain, den man pfeifen will).

  • G-Dur, 126 BPM, 4/4. Folk-Pop-Groove: Nylon-Gitarre im Wechselschlag, Kontrabass, Klatschen auf 2 und 4, Stampf-Kick, Shaker; Klavier-Offbeats im Refrain.
  • **Refrain (Ohrwurm)**: ein Kern aus vier Achteln und einer langen Note („da-da-da-da DAAA“), jeden Takt eine Stufe höher versetzt (G–D–Em–C | G–D–C–D) — singbar, wiederholbar, schwer loszuwerden.
  • **Strophe**: sprechend, mit Pausen (Synkopen), als würde einer erzählen; Instrumente wechseln sich je zwei Takte ab; das Marimba „lacht“ in den Pausen.
  • **Bridge**: Frage und Antwort im Zwei-Schläge-Wechsel (Am–Em–C–G | Am–Em–C–D), leichter Groove.
  • **Leitmotiv „Freunde“** (Do–Re–Mi–Sol–La–Sol): eröffnet den Track in der Pfeife und schließt ihn in der Pfeife — und ist die Visitenkarte für andere Score-Tracks.
  • Schluss-Refrain einen Ganzton höher (A-Dur), alle Freunde reden durcheinander, Gang-„Hey!“ (Chor) und Klatschen; Ausklang auf D (Dominante) → zurück in die G-Dur-Intro.
Form (56 Takte ≈ 1:47): Intro 4 · Strophe A 8 · Refrain B 8 · Strophe A' 8 · Refrain B 8 · Bridge C 8 · Schluss-Refrain +2 8 · Outro 4
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE, make_tones, make_hv, scale_step

BPM, BARS = 126, 56
song = Song(BPM, BARS)
rng, hv = make_hv(1126)

song.inst('whistle', 'whistle', vol=92, pan=64)          # Freund 1: ungestüm, fröhlich — trägt den Ohrwurm
song.inst('clarinet', 'clarinet', vol=84, pan=40)        # Freund 2: witzig, Zwischenrufe
song.inst('flute', 'flute', vol=84, pan=84)              # Freund 3: verträumt
song.inst('marimba', 'marimba', vol=84, pan=34)          # Freund 4: kichert
song.inst('harmonica', 'harmonica', vol=70, pan=54)      # Freund 5: warm, brummt zu
song.inst('guitar', 'guitar', vol=84, pan=26)            # Nylon-Gitarre (Wechselschlag)
song.inst('cleangtr', 'cleangtr', vol=64, pan=98)        # zarte Arpeggien
song.inst('piano', 'piano', vol=72, pan=46)              # Offbeat-Akkorde
song.inst('bass', 'acbass', vol=96, pan=62)
song.inst('glock', 'glock', vol=64, pan=90)
song.inst('oohs', 'oohs', vol=66, pan=70)
song.inst('choir', 'choir', vol=70, pan=58)              # Gang-„Hey!“
song.inst('xylo', 'xylo', vol=62, pan=76)

CH = {'G': (7, 'M'), 'D': (2, 'M'), 'Em': (4, 'm'), 'C': (0, 'M'), 'Am': (9, 'm')}
tones = make_tones(CH)

def mel(inst, bar0, bars, shift=0, vel=88, octave=0, legato=.92, harm=None, delay=0.0):
    tpc = (7 + shift) % 12                                   # Grundton G (+ Rückung)
    t = song.bar(bar0) + delay
    for bar in bars:
        for name, dur in bar:
            if name is not None:
                p = pn(name) + shift + 12 * octave
                if harm: p = scale_step(p, tpc, harm)
                song.add(inst, t, max(0.1, dur * legato), p, hv(vel))
            t += dur

# ═══ Material (G-Dur) ═════════════════════════════════════════════════════════════════════════════
A_CH = ['G', 'G', 'C', 'D', 'G', 'Em', 'C', 'D']
A_MEL = [
    [(None, .5), ('B4', .5), ('D5', .5), ('B4', .5), ('A4', 1), ('G4', 1)],
    [(None, .5), ('B4', .5), ('D5', .5), ('E5', .5), ('D5', 2)],
    [(None, .5), ('C5', .5), ('E5', .5), ('C5', .5), ('B4', 1), ('A4', 1)],
    [(None, .5), ('A4', .5), ('B4', .5), ('C5', .5), ('D5', 2)],
    [(None, .5), ('B4', .5), ('D5', .5), ('B4', .5), ('A4', 1), ('G4', 1)],
    [(None, .5), ('B4', .5), ('E5', .5), ('G5', .5), ('E5', 2)],
    [('C5', .5), ('E5', .5), ('G5', .5), ('E5', .5), ('D5', 1), ('C5', 1)],
    [('A4', 1), ('B4', 1), ('C5', .5), ('D5', .5), (None, 1)],
]

B_CH = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D']
B_MEL = [                                                    # der Ohrwurm: „da-da-da-da DAAA“, jeden Takt eine Stufe höher
    [('D5', .5), ('D5', .5), ('B4', .5), ('D5', .5), ('G5', 2)],
    [('F#5', .5), ('F#5', .5), ('E5', .5), ('F#5', .5), ('A5', 2)],
    [('G5', .5), ('G5', .5), ('E5', .5), ('G5', .5), ('B5', 1), ('A5', 1)],
    [('G5', 1), ('E5', 1), ('C5', 2)],
    [('D5', .5), ('D5', .5), ('B4', .5), ('D5', .5), ('G5', 1), ('A5', 1)],
    [('B5', .5), ('B5', .5), ('A5', .5), ('F#5', .5), ('A5', 2)],
    [('G5', .5), ('G5', .5), ('E5', .5), ('G5', .5), ('C6', 2)],
    [('A5', 1), ('F#5', 1), ('D5', 2)],
]

C_CH = ['Am', 'Em', 'C', 'G', 'Am', 'Em', 'C', 'D']
# Bridge: jeder Takt zwei Slots à zwei Schläge — (Instrument, Noten); Frage und Antwort, die Freunde fallen sich ins Wort
C_TALK = [
    [('whistle', [('E5', .5), ('E5', .5), ('C5', 1)]), ('clarinet', [('D5', .5), ('D5', .5), ('B4', 1)])],
    [('flute', [('G5', .5), ('G5', .5), ('E5', 1)]), ('marimba', [('F#5', .5), ('F#5', .5), ('D5', 1)])],
    [('whistle', [('E5', .5), ('G5', .5), ('C6', 1)]), ('clarinet', [('B5', .5), ('G5', .5), ('E5', 1)])],
    [('flute', [('D5', 1), ('B4', 1)]), ('harmonica', [('G4', 2)])],
    [('whistle', [('A5', .5), ('A5', .5), ('E5', 1)]), ('clarinet', [('G5', .5), ('G5', .5), ('D5', 1)])],
    [('flute', [('B5', .5), ('B5', .5), ('G5', 1)]), ('marimba', [('A5', .5), ('A5', .5), ('F#5', 1)])],
    [('whistle', [('C6', .5), ('B5', .5), ('G5', .5), ('E5', .5)]), ('clarinet', [('D5', .5), ('E5', .5), ('G5', 1)])],
    [('whistle', [('A5', 1), ('F#5', 1)]), ('flute', [('D6', 2)])],
]

# ═══ Begleit-Bausteine ═══════════════════════════════════════════════════════════════════════════
def root_pitch(ch, shift=0):
    r = tones(ch, 1, shift)[0]
    while r < 28: r += 12
    while r > 46: r -= 12
    return r

def strum(bar0, chords, shift=0, vel=70, light=False):
    """Wechselschlag (Ab–Ab–Auf–Auf–Ab–Auf) der Nylon-Gitarre; light: nur Ab auf 1 und 3."""
    pat = ((0, 1.0, 1.0), (1, .5, .8), (1.5, .5, .65), (2.5, .5, .65), (3, .5, .85), (3.5, .5, .65)) if not light else ((0, 1.5, 1.0), (2, 1.5, .85))
    for k, ch in enumerate(chords):
        T = tones(ch, 3, shift)
        notes = (T[0], T[2], T[0] + 12, T[1] + 12, T[2] + 12)
        t = song.bar(bar0 + k)
        for beat, dur, f in pat:
            for j, m in enumerate(notes):
                song.add('guitar', t + beat + j * 0.012, dur + 0.1, m, hv(int(vel * f)))

def pick(bar0, chords, shift=0, vel=52):
    """Clean-Gitarre: sanfte Achtel-Arpeggien (Grundton–Quinte–Oktave–Terz)."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        pat = (T[0], T[2], T[0] + 12, T[1] + 12, T[0] + 12, T[2], T[0], T[2])
        for i in range(8):
            song.add('cleangtr', song.bar(bar0 + k) + i * 0.5, 0.45, pat[i], hv(vel + (8 if i % 2 == 0 else 0)))

def bass_line(bar0, chords, shift=0, vel=92):
    for k, ch in enumerate(chords):
        r = root_pitch(ch, shift)
        nxt = root_pitch(chords[(k + 1) % len(chords)], shift)
        t = song.bar(bar0 + k)
        song.add('bass', t, .95, r, hv(vel + 8)); song.add('bass', t + 1.5, .45, r + 7, hv(vel - 8))
        song.add('bass', t + 2, .95, r, hv(vel)); song.add('bass', t + 3.5, .45, nxt - 1 if nxt > r else nxt + 1, hv(vel - 12))

def piano_off(bar0, chords, shift=0, vel=62):
    """Klavier-Offbeats (Achtel-Auftakte) — der „Sommer-Swing“ im Refrain."""
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        for i in range(4):
            for m in (T[1], T[2], T[0] + 12):
                song.add('piano', song.bar(bar0 + k) + 0.5 + i, 0.3, m, hv(vel))

def harmonica_pad(bar0, chords, shift=0, vel=50):
    for k, ch in enumerate(chords):
        T = tones(ch, 4, shift)
        song.add('harmonica', song.bar(bar0 + k), 3.9, T[1], vel); song.add('harmonica', song.bar(bar0 + k), 3.9, T[2], vel - 4)

def drums(bar0, nbars, level=1.0, style='verse', fills=True, crash=True):
    """verse: Stampf-Kick auf 1 und 3, Klatschen auf 2 und 4, Shaker-Achtel · chorus: dichter (Kick + Doppelklatschen, 16tel-Shaker, offene Hi-Hat) · light: Sidestick statt Klatschen."""
    for k in range(nbars):
        t = song.bar(bar0 + k)
        L = level
        song.dr(t, KICK, int(96 * L), 0.2); song.dr(t + 2, KICK, int(88 * L), 0.2)
        if style == 'light':
            for beat in (1, 3): song.dr(t + beat, SIDESTICK, int(80 * L), 0.1)
        else:
            for beat in (1, 3): song.dr(t + beat, CLAP, int(100 * L), 0.12)
        if style == 'chorus':
            song.dr(t + 1.5, KICK, int(78 * L), 0.15); song.dr(t + 3.5, KICK, int(74 * L), 0.15)
            for i in range(16): song.dr(t + i * 0.25, HAT, int((74 if i % 4 == 0 else (58 if i % 2 == 0 else 44)) * L), 0.05)
            for i in range(4): song.dr(t + 0.5 + i, OHAT, int(70 * L), 0.12)
        else:
            for i in range(8): song.dr(t + i * 0.5, HAT, int((76 if i % 2 else 56) * L), 0.05)
        if k == 0 and crash and style == 'chorus': song.dr(t, CRASH, int(96 * L), 1.6)
        if fills and k % 4 == 3:
            for j in range(4): song.dr(t + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_M, TOM_L)[j], int((76 + 6 * j) * L), 0.12)

def roll(bar0, start, end, v0=44, v1=112):
    t0 = song.bar(bar0) + start
    n = int((end - start) * 4)
    for i in range(n): song.dr(t0 + i * 0.25, SNARE, int(v0 + (v1 - v0) * i / max(1, n - 1)), 0.1)

def giggle(bar0, bars, shift=0, vel=78):
    """Das Marimba kichert: vier schnelle Töne (Dur-Pentatonik) im 3.–4. Schlag."""
    for k in bars:
        t = song.bar(bar0 + k) + 3.0
        for i, n in enumerate(('G5', 'B5', 'D6', 'B5')):
            song.add('marimba', t + i * 0.25, 0.2, pn(n) + shift, hv(vel - i * 3))

def sparkle(bar0, nbars, shift=0, vel=56):
    for k in range(nbars):
        t = song.bar(bar0 + k)
        for _ in range(2):
            song.add('glock', t + rng.choice((0.5, 1.5, 2.5, 3.5)), 0.35, rng.choice((pn('D6'), pn('G6'), pn('B6'), pn('E6'), pn('A6'))) + shift, hv(vel))

def hey(bar0, ks, ch_list, shift=0, vel=100):
    """Gang-„Hey!“ auf der 1 (Chor) + Klatscher."""
    for k in ks:
        t = song.bar(bar0 + k)
        for m in tones(ch_list[k], 4, shift): song.add('choir', t, 0.35, m, hv(vel))
        song.dr(t, CLAP, 110, 0.15)

def chorus(bar0, shift=0, vel=96, full=False, talk_all=False):
    """Der Ohrwurm: Pfeife + (Klarinette in der Terz darunter) + Oohs, Glockenspiel obendrauf; bei full: Flöte, Marimba, Mundharmonika dazu."""
    mel('whistle', bar0, B_MEL, shift=shift, vel=vel)
    mel('clarinet', bar0, B_MEL, shift=shift, vel=vel - 22, harm=-2)
    mel('oohs', bar0, B_MEL, shift=shift, vel=vel - 28)
    mel('glock', bar0, B_MEL, shift=shift, vel=vel - 38, octave=1)
    strum(bar0, B_CH, shift=shift, vel=76)
    bass_line(bar0, B_CH, shift=shift, vel=96)
    piano_off(bar0, B_CH, shift=shift)
    drums(bar0, 8, level=1.05 if not full else 1.15, style='chorus')
    sparkle(bar0, 8, shift=shift, vel=56)
    hey(bar0, (0, 4), B_CH, shift=shift, vel=96 if not full else 104)
    if full:
        mel('flute', bar0, B_MEL, shift=shift, vel=vel - 14, octave=1)
        mel('marimba', bar0, B_MEL, shift=shift, vel=vel - 24, octave=0, legato=.5)
        mel('harmonica', bar0, B_MEL, shift=shift, vel=vel - 36, octave=0, harm=-4)
        pick(bar0, B_CH, shift=shift, vel=50)

# ═══ Arrangement ══════════════════════════════════════════════════════════════════════════════════
b = 0
# ── Intro (4): Stampfen und Klatschen, die Nylon-Gitarre kommt dazu; die Pfeife stellt das Leitmotiv „Freunde“ vor ─────────────
I_CH = ['G', 'G', 'C', 'D']
for k in range(2):
    t = song.bar(b + k)
    song.dr(t, KICK, 94, 0.2); song.dr(t + 1, CLAP, 100, 0.12); song.dr(t + 2, KICK, 90, 0.2); song.dr(t + 3, CLAP, 100, 0.12)
    for i in range(8): song.dr(t + i * 0.5, HAT, 52 + (14 if i % 2 else 0), 0.05)
strum(b + 1, ['G'], vel=64, light=True)
strum(b + 2, ['C', 'D'], vel=72)
bass_line(b + 2, ['C', 'D'], vel=88)
motif_notes = [pn('G4') + off for off, _ in LEITMOTIVE['freunde']]
t0 = song.bar(b + 2)
for (off, d), n in zip(LEITMOTIVE['freunde'], motif_notes):
    song.add('whistle', t0, d * .92, n, hv(94)); t0 += d
mel('whistle', b + 3, [[('D5', .5), ('E5', .5), ('G5', 1), (None, 2)]], vel=92)
drums(b + 2, 2, level=0.95, style='verse', fills=False, crash=False)
for j in range(4): song.dr(song.bar(b + 3) + 2.5 + j * 0.375, (TOM_H, TOM_M, TOM_M, TOM_L)[j], 80 + 6 * j, 0.12)
b += 4

# ── Strophe A (8): die Freunde reichen die Erzählung weiter: Pfeife – Klarinette – Flöte – Pfeife; das Marimba kichert ──────────
for k0, inst, vel in ((0, 'whistle', 90), (2, 'clarinet', 84), (4, 'flute', 84), (6, 'whistle', 90)):
    mel(inst, b + k0, A_MEL[k0:k0 + 2], vel=vel, octave=0 if inst != 'flute' else 1)
strum(b, A_CH, vel=66)
pick(b, A_CH, vel=46)
bass_line(b, A_CH, vel=88)
drums(b, 8, level=0.95, style='verse')
giggle(b, (1, 3, 5), vel=74)
harmonica_pad(b, A_CH, vel=40)
b += 8

# ── Refrain B (8): der Ohrwurm ──────────────────────────────────────────────────────────────────────────────
chorus(b)
b += 8

# ── Strophe A' (8): jetzt erzählt zuerst die Klarinette, die Flöte antwortet höher; Klavier, Mundharmonika, mehr Gekicher ─────────
for k0, inst, vel, o in ((0, 'clarinet', 86, 0), (2, 'flute', 86, 1), (4, 'whistle', 90, 0), (6, 'clarinet', 86, 0)):
    mel(inst, b + k0, A_MEL[k0:k0 + 2], vel=vel, octave=o)
mel('oohs', b + 7, [[('A4', 1), ('B4', 1), ('C5', .5), ('D5', .5), (None, 1)]], vel=60)
strum(b, A_CH, vel=70)
pick(b, A_CH, vel=48)
bass_line(b, A_CH, vel=92)
piano_off(b, A_CH, vel=50)
drums(b, 8, level=1.0, style='verse')
giggle(b, (1, 3, 5, 7), vel=78)
harmonica_pad(b, A_CH, vel=46)
b += 8

# ── Refrain B (8): mit Flöten-Obertönen und Mundharmonika ──────────────────────────────────────────────────────
chorus(b, vel=98, full=False)
mel('flute', b, B_MEL, vel=82, octave=1, delay=0.0)
harmonica_pad(b, B_CH, vel=50)
b += 8

# ── Bridge C (8): Frage und Antwort im Zwei-Schläge-Wechsel — die Freunde fallen sich ins Wort ───────────────────────────────
for k, slots in enumerate(C_TALK):
    t = song.bar(b + k)
    for slot, (inst, notes) in enumerate(slots):
        tt = t + slot * 2.0
        for name, dur in notes:
            o = 0
            if name is not None: song.add(inst, tt, max(0.1, dur * .88), pn(name) + 12 * o, hv(92 if inst == 'whistle' else 82))
            tt += dur
strum(b, C_CH, vel=60, light=True)
pick(b, C_CH, vel=56)
bass_line(b, C_CH, vel=84)
harmonica_pad(b, C_CH, vel=44)
drums(b, 8, level=0.9, style='light')
sparkle(b, 8, vel=50)
roll(b + 7, 2, 4, 50, 104)
b += 8

# ── Schluss-Refrain +2 (8): A-Dur — alle Freunde reden durcheinander, Gang-„Hey!“, Klatschen ────────────────────────────────────
chorus(b, shift=2, vel=104, full=True)
for k in (2, 3, 6, 7):                                          # zusätzliche Zwischenrufe der Klarinette (Kichern der anderen)
    song.add('clarinet', song.bar(b + k) + 3.0, 0.3, pn('A5') + 2, hv(86)); song.add('clarinet', song.bar(b + k) + 3.5, 0.3, pn('E6') + 2, hv(90))
hey(b, (2, 6), B_CH, shift=2, vel=96)
b += 8

# ── Outro (4): D (Dominante zur G-Dur-Intro) — das Leitmotiv „Freunde“ ein letztes Mal, dann Klatscher in den Loop ─────────────────
O_CH = ['D', 'D', 'D', 'D']
strum(b, O_CH, vel=72)
bass_line(b, O_CH, vel=88)
motif_D = [pn('D5') + off for off, _ in LEITMOTIVE['freunde']]
for rep in range(2):
    t0 = song.bar(b + rep)
    for (off, d), n in zip(LEITMOTIVE['freunde'], motif_D):
        song.add('whistle', t0, d * .92, n, hv(94)); t0 += d
mel('flute', b + 2, [[('F#5', 1), ('E5', 1), ('D5', 2)]], vel=86)
mel('clarinet', b + 2, [[('A4', 1), ('G4', 1), ('F#4', 2)]], vel=76)
drums(b, 2, level=0.95, style='verse', fills=False, crash=False)
song.dr(song.bar(b + 3), CLAP, 100, 0.12); song.dr(song.bar(b + 3) + 1, CLAP, 104, 0.12)
for j in range(4): song.dr(song.bar(b + 3) + 2.0 + j * 0.5, SNARE, 70 + 14 * j, 0.1)
for m in tones('D', 4): song.add('guitar', song.bar(b + 3), 2.0, m, 70)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_gespraeche_unter_freunden.ogg')
    song.render(sf2, out, target_rms=0.25, saturate=False, compress=True, air_cut=0.0)
