# -*- coding: utf-8 -*-
"""Kampagnen-Score · Deckbau-Menü → public/music/bgm_score_deckbau.ogg                     Titel: „Shuffle & Think“

Das Deckbau-Menü: konzentriert, tüftelnd, ein bisschen verspielt — man probiert Kombinationen aus, schiebt Karten hin und her, sieht plötzlich eine Synergie. Wie der Shop läuft die Musik lange im
Hintergrund, darum **unaufdringlich**, aber mit klarem, mitnickbarem Puls und einem Motiv, das wie ein Gedanke aufsteigt. D-Dur, 100 BPM, 4/4. Marimba und Zupf-Streicher tickern 16tel-Muster
wie ein arbeitender Kopf, E-Piano und weicher Bass tragen, Vibraphon und Flöte singen das Thema, ein dezenter Lo-Fi-Beat; bei der „Eingebung“ (Bridge) öffnet sich der Klang.

  • **Ohrwurm** (A): ein aufsteigender Gedanke („Fis–A–D“, dann Rückfall und Neuansatz) über D – Hm – G – A | D – Hm – Em – A; Frage und Antwort in jeder Zweiergruppe von Takten.
  • **B** (Kombinieren): dieselbe Gestalt, aber die Akkorde wechseln schneller (G – A – Hm – Fis-Moll | G – A – D – A): Karten werden verschoben, die Marimba-Läufe wandern.
  • **Bridge** (Eingebung): dünner, hoch, Flöte und Vibraphon; ein plötzliches Aufhellen nach Fis-Dur-Dominante und zurück; Teil, in dem alles einrastet.
  • Leitmotiv „Freunde“ (Do–Re–Mi–Sol–La–Sol) als Gedanke in der Intro (Vibraphon) und im Outro (Flöte).
Form (40 Takte ≈ 1:36): Intro 4 · A 8 · B 8 · A' 8 · Bridge 8 · Outro 4
Ausklang auf A (Dominante) → zurück in die D-Dur-Intro.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
from score_common import pn, LEITMOTIVE
from score_kit import Kit

BPM, BARS = 100, 40
song = Song(BPM, BARS)
CH = {'D': (2, 'M'), 'Bm': (11, 'm'), 'G': (7, 'M'), 'A': (9, 'M'), 'Em': (4, 'm'), 'F#m': (6, 'm'), 'A7': (9, '7')}
kit = Kit(song, CH, seed=1969, tonic_pc=2)
hv, rng = kit.hv, kit.rng

song.inst('marimba', 'marimba', vol=76, pan=40)          # tickernder Kopf
song.inst('pizz', 'pizz', vol=66, pan=28)
song.inst('vibes', 'vibes', vol=82, pan=78)
song.inst('flute', 'flute', vol=74, pan=84)
song.inst('epiano', 'epiano', vol=72, pan=52)
song.inst('bass', 'acbass', vol=88, pan=62)
song.inst('guitar', 'guitar', vol=58, pan=22)
song.inst('glock', 'glock', vol=60, pan=92)
song.inst('oohs', 'oohs', vol=46, pan=70)
song.inst('strings', 'slowstr', vol=44, pan=62)
song.inst('harp', 'harp', vol=62, pan=34)

A_CH = ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A']
A_MEL = [
    [('F#5', .5), ('A5', .5), ('D6', 1), ('C#6', .5), ('A5', .5), ('F#5', 1)],
    [('D5', .5), ('F#5', .5), ('B5', 1), ('A5', .5), ('F#5', .5), ('D5', 1)],
    [('G5', .5), ('B5', .5), ('D6', 1), ('B5', .5), ('G5', .5), ('E5', 1)],
    [('E5', 1), ('A5', 1), ('C#6', 2)],
    [('F#5', .5), ('A5', .5), ('D6', 1), ('C#6', .5), ('A5', .5), ('F#5', 1)],
    [('B5', .5), ('D6', .5), ('F#6', 1), ('E6', .5), ('D6', .5), ('B5', 1)],
    [('G5', .5), ('B5', .5), ('E6', 1), ('D6', .5), ('B5', .5), ('G5', 1)],
    [('A5', 1), ('E5', 1), ('C#5', 2)],
]
A_CLOSE = A_MEL[:7] + [[('D6', 2), ('A5', 1), ('F#5', 1)]]
A_CH_CLOSE = A_CH[:7] + ['D']
B_CH = ['G', 'A', 'Bm', 'F#m', 'G', 'A', 'D', 'A']
B_MEL = [
    [('B5', .5), ('D6', .5), ('G6', 1), ('F#6', .5), ('D6', .5), ('B5', 1)],
    [('C#6', .5), ('E6', .5), ('A6', 1), ('G6', .5), ('E6', .5), ('C#6', 1)],
    [('D6', .5), ('F#6', .5), ('B6', 1), ('A6', .5), ('F#6', .5), ('D6', 1)],
    [('C#6', 1), ('A5', 1), ('F#5', 2)],
    [('B5', .5), ('D6', .5), ('G6', 1), ('F#6', .5), ('D6', .5), ('B5', 1)],
    [('C#6', .5), ('E6', .5), ('A6', 1), ('G6', .5), ('E6', .5), ('C#6', 1)],
    [('A5', 1), ('D6', 1), ('F#6', 2)],
    [('E6', 2), ('C#6', 1), ('A5', 1)],
]
BR_CH = ['Bm', 'G', 'D', 'A7', 'Bm', 'G', 'A', 'A']
BR_MEL = [[('D6', 4)], [('B5', 2), ('G5', 2)], [('A5', 2), ('F#5', 2)], [('E5', 3), ('C#5', 1)],
          [('F#6', 4)], [('E6', 2), ('B5', 2)], [('D6', 2), ('C#6', 2)], [('C#6', 3), (None, 1)]]

def tick(bar0, chords, vel=56, pattern=(0, 2, 1, 2, 3, 2, 1, 2), steps=16, step=0.25):
    """Der tickernde Kopf: Marimba-Sechzehntel auf den Akkordtönen (Grundton, Terz, Quinte, Oktave) — leise, gleichmäßig."""
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 4)
        ext = (T[0], T[1], T[2], T[0] + 12)
        t = song.bar(bar0 + k)
        for i in range(steps):
            song.add('marimba', t + i * step, 0.2, ext[pattern[i % len(pattern)]], hv(vel + (10 if i % 4 == 0 else (4 if i % 2 == 0 else 0))))

def keys(bar0, chords, vel=50):
    for k, ch in enumerate(chords):
        T = kit.tones(ch, 3)
        t = song.bar(bar0 + k)
        for pos, dur, f in ((0, 1.4, 1.0), (1.5, 0.9, .8), (2.5, 1.2, .85)):
            for m in T: song.add('epiano', t + pos, dur, m, hv(int(vel * f)))

def bassline(bar0, chords, vel=84):
    for k, ch in enumerate(chords):
        r = kit.root(ch)
        t = song.bar(bar0 + k)
        song.add('bass', t, 1.4, r, hv(vel)); song.add('bass', t + 1.5, 0.9, r + 7, hv(vel - 10)); song.add('bass', t + 2.5, 1.2, r + 12, hv(vel - 8))

def lights(bar0, nbars, vel=48):
    for k in range(nbars):
        if k % 2 == 0:
            song.add('glock', song.bar(bar0 + k) + rng.choice((0.5, 1.5, 2.5, 3.5)), 0.4, pn(rng.choice(('D7', 'A6', 'F#6', 'B6', 'E7'))), hv(vel))

def a_section(bar0, vel=84, closed=False, full=False):
    mel = A_CLOSE if closed else A_MEL
    ch = A_CH_CLOSE if closed else A_CH
    kit.mel('vibes', bar0, mel, vel=vel, legato=.85)
    kit.mel('flute', bar0, mel, vel=vel - 24, octave=1, legato=.9)
    tick(bar0, ch, vel=48)
    keys(bar0, ch, vel=48)
    bassline(bar0, ch)
    kit.drums(bar0, 8, style='lofi', level=0.85)
    lights(bar0, 8)
    if full:
        kit.mel('oohs', bar0, mel, vel=46, legato=1.0)
        kit.pad(bar0, ch, vel=34, inst='strings')
        kit.arp(bar0, ch, vel=42, inst='guitar', steps=8, step=0.5, pattern=(0, 2, 4, 3, 4, 2, 0, 2))

b = 0
# ── Intro (4): ein Gedanke entsteht — das Vibraphon stellt das Leitmotiv „Freunde“ vor, Ticken setzt ein, der Beat folgt ──────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('vibes', t0, d * .95, pn('D5') + off, hv(76)); t0 += d
tick(b + 1, ['D', 'Bm', 'G'], vel=44)
keys(b + 1, ['D', 'Bm', 'G'], vel=42)
bassline(b + 2, ['G', 'A'], vel=72)
kit.drums(b + 2, 2, style='lofi', level=0.7, fills=False)
lights(b, 4, vel=44)
b += 4

# ── A (8): das Motiv wie ein aufsteigender Gedanke — Vibraphon + Flöte, tickernder Kopf, E-Piano, Lo-Fi-Beat ──────────────────────────────────────
a_section(b)
b += 8

# ── B (8): Kombinieren — die Akkorde wechseln schneller, Marimba-Läufe wandern, Flöte führt, Vibraphon in Terzen ───────────────────────────────────
kit.mel('flute', b, B_MEL, vel=84, legato=.9)
kit.mel('vibes', b, B_MEL, vel=62, harm=-2, legato=.85)
kit.mel('marimba', b, B_MEL, vel=52, octave=0, legato=.4)
tick(b, B_CH, vel=52, pattern=(0, 1, 2, 3, 2, 1, 0, 1))
keys(b, B_CH, vel=50)
bassline(b, B_CH, vel=86)
kit.drums(b, 8, style='lofi', level=0.9)
kit.pad(b, B_CH, vel=32, inst='strings')
lights(b, 8, vel=50)
b += 8

# ── A' (8): alles — Oohs, Strings, Gitarren-Arpeggien; geschlossen auf D ───────────────────────────────────────────────────────────────────────────
a_section(b, vel=88, closed=True, full=True)
b += 8

# ── Bridge (8): Eingebung — dünner, höher: Flöte und Vibraphon, Harfe perlt, der Beat verschwindet; zuletzt ein Aufhellen und alles rastet ein ────────────────────
kit.mel('flute', b, BR_MEL, vel=76, legato=1.0)
kit.mel('vibes', b, BR_MEL, vel=58, octave=0, legato=1.0, harm=-2)
kit.mel('oohs', b, BR_MEL, vel=42, legato=1.0)
kit.arp(b, BR_CH, vel=48, inst='harp', steps=8, step=0.5, pattern=(0, 2, 4, 5, 4, 2, 4, 2))
tick(b + 4, BR_CH[4:], vel=40)
keys(b, BR_CH, vel=38)
bassline(b, BR_CH, vel=70)
kit.pad(b, BR_CH, vel=38, inst='strings')
lights(b, 8, vel=52)
kit.drums(b, 4, style='soft', level=0.6)
kit.drums(b + 4, 4, style='lofi', level=0.8, fills=False)
kit.roll(b + 7, 3, 4, 40, 90)
b += 8

# ── Outro (4): A (Dominante zur D-Dur-Intro) — das Leitmotiv „Freunde“ in der Flöte; ein Tick bleibt ─────────────────────────────────────────────────
t0 = song.bar(b)
for off, d in LEITMOTIVE['freunde']:
    song.add('flute', t0, d * .95, pn('A4') + off, hv(66)); t0 += d
tick(b, ['A', 'A', 'A'], vel=44)
keys(b, ['A', 'A', 'A'], vel=40)
bassline(b, ['A', 'A', 'A'], vel=68)
kit.drums(b, 3, style='soft', level=0.65, fills=False)
lights(b, 4, vel=46)
b += 4
assert b == BARS, (b, BARS)

if os.environ.get('SCORE_NORENDER') != '1':
    sf2, out = cli_paths('bgm_score_deckbau.ogg')
    song.render(sf2, out, target_rms=0.2, saturate=False, compress=True, air_cut=0.0)
