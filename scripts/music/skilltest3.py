# -*- coding: utf-8 -*-
"""Skill Test, Track 3 „Dice of Destiny“ → public/music/bgm_skilltest3.ogg

Würfelglück: eine Casino-/Jahrmarkt-Blaskapelle im Wahnsinn. 188 BPM, 4/4-Galopp (Polka/Can-Can),
Tuba-Oompah, Akkordeon-„Pah“, Trompeten, Posaunen-Glissandi (Pitch-Bend), Klarinetten-Läufe,
Xylophon und Calliope. Das Hauptthema („Würfel-Hook“, zwei Takte: Terz–Quinte–Oktave, fallende
Girlande) wandert mit.

Chaos-Prinzip: DIE TONART WIRD GEWÜRFELT. Am Ende jedes Abschnitts (4, 6 oder 8 Takte) wirft ein
seed-gesetzter Würfel die nächste Tonart (Terz-, Quint- oder Sekundsprung). Der Sprung ist sauber
vorbereitet: der letzte Takt spielt ii–V7 der NEUEN Tonart (Pivot). Bei manchen Sprüngen hält die
Kapelle nach den beiden Akkord-Schlägen an und ein Würfel-Rattern (Woodblock, Toms, Kuhglocke)
läuft in den Neustart. Dazu plötzliche Stimmungswechsel (Moll-„Noir“-Abschnitte mit Walking-Tuba
und gedämpfter Trompete) und das Acht-Spieler-Motiv: acht Stimmen steigen taktweise ein, jede mit
eigenem Gegenrhythmus (Achtel, 3+3+2, Triolen, Fünfer …), alle auf den Akkordtönen.

Form (96 Takte = 122,6 s):  Intro 4 · Thema 8 · Würfe (dice) 4+6 · Noir 4 · Thema 2 8 · Wurf 4 ·
  ACHT SPIELER 8 · Chaos 4+6+4 · Noir 6 · Wurf 8 · Thema 2 8 · Wurf 6 · Finale 8 (→ ii–V7 nach F, Loop)
Seed fest → die Tonartenfolge ist reproduzierbar (wird beim Rendern ausgegeben).
Aufruf:  python3 scripts/music/skilltest3.py <soundfont.sf2> [ausgabe.ogg]
"""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import mido

BPM, BARS = 188, 96                       # 96 × 4 × 60/188 = 122,6 s
SEED = 777
rng = random.Random(SEED)                 # Würfel für Tonarten, Besetzungen, Rattern
vr = random.Random(5)                     # Velocity-Streuung
song = Song(bpm=BPM, bars=BARS)

# ---- Stimmen (Name, Instrument, Lautstärke, Panorama) ---------------------------------
for name, ins, vol, pan in [
        ('tuba', 'tuba', 112, 62), ('acc', 'accordion', 88, 44), ('guitar', 'guitar', 76, 34),
        ('piano', 'piano', 84, 56), ('tpt', 'trumpet', 106, 78), ('brass', 'brass', 92, 68),
        ('calli', 'calliope', 80, 92), ('xylo', 'xylo', 90, 102), ('clar', 'clarinet', 90, 26),
        ('flute', 'flute', 80, 16), ('tbn', 'trombone', 96, 50), ('muted', 'muted', 92, 72),
        ('bassoon', 'bassoon', 88, 56), ('horns', 'horns', 78, 84)]:
    song.inst(name, ins, vol, pan)

song.cc('drum', 0, 7, 92)      # Schlagzeug etwas zurück: weniger Spitzen, mehr Dichte im Blech

# ---- Harmonie / Skalen ----------------------------------------------------------------
SCALE = {'M': {0, 2, 4, 5, 7, 9, 11}, 'm': {0, 2, 3, 5, 7, 8, 10, 11}}     # Moll inkl. Leitton
CH = {'M': {'I': (0, 4, 7), 'IV': (5, 9, 0), 'V7': (7, 11, 2, 5), 'ii': (2, 5, 9, 0)},
      'm': {'I': (0, 3, 7), 'IV': (5, 8, 0), 'V7': (7, 11, 2, 5), 'ii': (2, 5, 8, 0)}}
KEYNAME = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H']

def chord(tonic, mode, deg):
    """Akkord als Tupel absoluter Tonklassen; Element 0 = Grundton."""
    return tuple((tonic + o) % 12 for o in CH[mode][deg])

# ---- Hook (Halbtöne über der Tonika; Beat-1-Töne sind Akkordtöne) -----------------------
HOOK = {
    'M': {'h1': [(4, .5), (7, .5), (12, 1), (11, .5), (9, .5), (7, 1)],
          'h2': [(5, .5), (9, .5), (12, .5), (14, .5), (12, 1), (9, 1)],
          'h3': [(12, 1.5), (11, .5), (7, 1), (9, .5), (7, .5)],
          'h4': [(7, .5), (11, .5), (14, .5), (11, .5), (7, 1), (5, 1)],
          't5': [(7, .5), (12, .5), (16, 1), (14, .5), (12, .5), (7, 1)]},
    'm': {'h1': [(3, .5), (7, .5), (12, 1), (10, .5), (8, .5), (7, 1)],
          'h2': [(5, .5), (8, .5), (12, .5), (14, .5), (12, 1), (8, 1)],
          'h3': [(12, 1.5), (10, .5), (7, 1), (8, .5), (7, .5)],
          'h4': [(7, .5), (11, .5), (14, .5), (11, .5), (7, 1), (5, 1)],
          't5': [(7, .5), (12, .5), (15, 1), (14, .5), (12, .5), (7, 1)]}}
PIV = {'M': [(2, .5), (5, .5), (9, .5), (12, .5), (11, .5), (7, .5), (14, 1)],     # ii7 → V7 der NEUEN Tonart
       'm': [(2, .5), (5, .5), (8, .5), (12, .5), (11, .5), (7, .5), (14, 1)]}
RUN = {'M': [2, 4, 5, 7, 9, 11, 12, 14], 'm': [2, 3, 5, 7, 8, 11, 12, 14]}        # Klarinetten-Lauf über den Pivot

def base(tonic): return 54 + ((tonic - 6) % 12)        # Tonika-MIDI-Note der Melodielage (54–65)

def hv(v): return int(v + vr.randint(-4, 4))

def play(voice, bar, tpl, tonic, mode, vel, octv=0, leg=.9, beat0=0.0):
    t = song.bar(bar) + beat0
    for off, d in tpl:
        assert off % 12 in SCALE[mode], (voice, bar, off, mode)
        song.add(voice, t, d * leg, base(tonic) + off + 12 * octv, hv(vel + (6 if t == song.bar(bar) else 0)))
        t += d

def squeeze(tpl):
    """Beschleunigung: Hook auf halbe Länge (zweimal pro Takt)."""
    return [(o, d / 2) for o, d in tpl]

def run(voice, bar, tonic, mode, vel, octv=1):
    for i, off in enumerate(RUN[mode]):
        assert off % 12 in SCALE[mode]
        song.add(voice, song.bar(bar) + i * .5, .45, base(tonic) + off + 12 * octv, hv(vel))

# ---- Pitch-Bend (Posaunen-Glissandi) ----------------------------------------------------
def bend(voice, beat, semis, prio=0):
    ch = song.ch[voice][0]
    val = max(-8192, min(8191, int(semis / 2.0 * 8192)))      # Bend-Bereich ±2 Halbtöne
    song.ev.append((int(round(beat * TPB)), prio, mido.Message('pitchwheel', channel=ch, pitch=val)))

def gliss_up(voice, beat, dur, pitch, vel, ramp=.3, semis=-2.0):
    """Note startet bis zu 2 Halbtöne zu tief und gleitet hinauf."""
    bend(voice, beat, semis, -1)
    song.add(voice, beat, dur, pitch, vel)
    for i in range(1, 7):
        bend(voice, beat + ramp * i / 6, semis * (1 - i / 6))
    bend(voice, beat + dur - .02, 0)

def gliss_down(voice, beat, dur, pitch, vel, ramp=.6, semis=-2.0):
    """Abwärts-Rutscher am Notenende (Posaunen-Fall)."""
    song.add(voice, beat, dur, pitch, vel)
    for i in range(1, 7):
        bend(voice, beat + dur - ramp + ramp * i / 6, semis * i / 6)
    bend(voice, beat + dur + .02, 0, -1)

# ---- Aufbau: Abschnitte und die gewürfelte Tonartenfolge ---------------------------------
HOME = F
#        Länge  Stil      Tonart    Stopp+Rattern nach dem Abschnitt
PLAN = [(4, 'intro', 'F', False), (8, 'theme', 'F', False), (4, 'dice', 'W', False), (6, 'dice', 'W', True),
        (4, 'noir', 'W', False), (8, 'theme2', 'W', False), (4, 'dice', 'W', True), (8, 'eight', 'W', True),
        (4, 'chaos', 'W', False), (6, 'chaos', 'W', False), (4, 'chaos', 'W', True), (6, 'noir', 'W', False),
        (8, 'dice', 'W', True), (8, 'theme2', 'W', False), (6, 'dice', 'W', True), (8, 'finale', 'W', False)]
assert sum(p[0] for p in PLAN) == BARS
JUMPS = [7, 4, 3, 9, 5, 8, 2, 10]          # Quinte auf, große/kleine Terz auf, Terz ab, Quarte, Sext …
SEGS, start, cur, hist = [], 0, HOME, [HOME]
for i, (L, style, key, stop) in enumerate(PLAN):
    if key == 'W':
        while True:
            nxt = (cur + rng.choice(JUMPS)) % 12
            if nxt not in hist[-8:] and nxt != HOME:
                break
        cur = nxt
    mode = 'm' if style == 'noir' else 'M'
    SEGS.append(dict(L=L, style=style, pc=cur, mode=mode, stop=stop, start=start))
    hist.append(cur); start += L
ROLES = {4: ['h1', 'h2', 'h3', 'piv'], 6: ['h1', 'h2', 'h3', 'h4', 't5', 'piv'],
         8: ['h1', 'h2', 'h3', 'h4', 'h1', 'h2', 't5', 'piv']}
DICE_SETS = [[('tpt', 0, 100), ('clar', 1, 72)], [('xylo', 1, 98), ('calli', 0, 84)],
             [('tbn', -1, 96), ('tpt', 0, 84)], [('flute', 1, 88), ('piano', 0, 86), ('muted', 0, 72)]]
ds_order, ds_last = [], -1
for s in SEGS:
    if s['style'] == 'dice':
        k = rng.choice([x for x in range(4) if x != ds_last]); ds_last = k; s['set'] = DICE_SETS[k]

def seg_at(b):
    for i, s in enumerate(SEGS):
        if s['start'] <= b < s['start'] + s['L']: return i, s

# ---- Begleit-Bausteine ----------------------------------------------------------------------
def chord_at(harm, beat):
    for s, d, c in harm:
        if s <= beat < s + d: return s, c

def voicing(c, lo=55, n=3):
    return sorted(lo + (pc - lo) % 12 for pc in c[:n])

def tuba_bar(b, harm, style):
    t0 = song.bar(b)
    for beat in range(4):
        s, c = chord_at(harm, beat)
        r = 28 + (c[0] - 4) % 12                              # Tuba E1–Es2
        if style == 'noir':                                    # Walking-Bass
            idx = [0, 1, 2, 1][(beat - s) % 4]
            song.add('tuba', t0 + beat, .85, r + (c[idx] - c[0]) % 12, 96 if beat == 0 else 84)
        elif style in ('chaos', 'finale'):                     # Galopp: jeder Schlag
            song.add('tuba', t0 + beat, .7, r if (beat - s) % 2 == 0 else r + 7, 100 if beat == 0 else 88)
        elif beat % 2 == 0:                                    # Oompah
            song.add('tuba', t0 + beat, .8, r if beat == s else r + 7, 100 if beat == 0 else 90)

def comp_bar(b, harm, style):
    t0 = song.bar(b)
    for beat in range(4):
        s, c = chord_at(harm, beat)
        v = voicing(c)
        if style == 'noir':
            if beat % 2 == 1:
                for m in voicing(c, 52): song.add('piano', t0 + beat, .5, m, hv(84))
            continue
        if beat % 2 == 1 or (style == 'chaos' and beat == 2):          # „Pah“
            for m in v: song.add('acc', t0 + beat, .5, m, hv(78))
        if style in ('dice', 'eight', 'chaos', 'theme2'):
            for m in v: song.add('piano', t0 + beat + .5, .3, m, hv(66))
    if style in ('theme', 'theme2', 'finale', 'intro', 'chaos'):       # Gitarren-Achtel auf den Offbeats
        for beat in range(4):
            s, c = chord_at(harm, beat)
            for m in voicing(c, 58)[1:]: song.add('guitar', t0 + beat + .5, .3, m, hv(66))
    if style in ('chaos', 'finale'):                               # Blech-Stabs
        for bt in (0, 1.5, 2.5) if style == 'chaos' else (0, 2):
            s, c = chord_at(harm, int(bt))
            for m in voicing(c, 60): song.add('brass', t0 + bt, .4, m, hv(80))
    if style in ('theme2', 'finale', 'eight'):                     # Hörner-Fläche
        for s, d, c in harm:
            for m in voicing(c, 58, 2): song.add('horns', t0 + s, d * .95, m, 50)

def drum_bar(b, lvl, role, first, k):
    t = song.bar(b)
    kick = [(0, 100), (2, 94)] if lvl <= 2 else [(0, 104), (1, 80), (2, 98), (3, 82)]
    for bt, v in kick: song.dr(t + bt, KICK, v, .2)
    for bt in (1, 3): song.dr(t + bt, SIDESTICK if lvl == 1 else SNARE, 104, .15)
    for i in range(8 if lvl < 4 else 16):                           # Hi-Hat leise → hohe Velocity
        step = .5 if lvl < 4 else .25
        song.dr(t + i * step, HAT, 112 if i % 2 == 0 else 100, .08)
    if lvl >= 3 and k % 2 == 1: song.dr(t + 3.5, COWBELL, 92, .15)
    if lvl >= 3: song.dr(t + 3.75, SNARE, 70, .1)
    if lvl >= 4:
        for bt in (1.5, 2.75): song.dr(t + bt, SNARE, 74, .1)
    if first and lvl >= 3: song.dr(t, CRASH, 104, 1.0)
    if first and lvl < 3 and k >= 0: song.dr(t, COWBELL, 96, .15)   # „Einwurf“ des Würfels
    if role == 'piv':                                               # Fill in den Sprung
        for i, tom in enumerate((TOM_HH, TOM_H, TOM_M, TOM_L)):
            song.dr(t + 3 + i * .25, tom, 86 + i * 8, .12)

def stop_bar(b, harm, tonic):
    """Stopp: ii- und V7-Schlag, dann Würfel-Rattern (Woodblock, Toms, Kuhglocke) bis zum Neustart."""
    t0 = song.bar(b)
    for bt, (s, d, c) in enumerate(harm[:2]):
        for m in voicing(c, 60): song.add('brass', t0 + bt, .55, m, 112)
        for m in voicing(c, 55): song.add('acc', t0 + bt, .55, m, 100)
        song.add('tuba', t0 + bt, .55, 28 + (c[0] - 4) % 12, 108)
        song.dr(t0 + bt, KICK, 108, .2); song.dr(t0 + bt, SNARE, 108, .15)
    pos = [2 + i * .25 for i in range(4)] + [3 + i * .125 for i in range(8)]
    for i, p in enumerate(pos):
        note = rng.choice([TOM_L, TOM_M, TOM_H, TOM_HH, 76, 77])
        song.dr(t0 + p, note, min(124, 74 + i * 4), .1)
        if i % 2 == 0: song.dr(t0 + p, 77 if i % 4 else 76, 112, .06)
    song.dr(t0 + 3.5, COWBELL, 112, .2); song.dr(t0 + 3.75, COWBELL, 120, .2)
    # Würfel-Klänge: Xylophon-Zufallstöne aus der neuen Tonleiter (seed-gesetzt)
    for i in range(8):
        song.add('xylo', t0 + 2 + i * .25, .2, base(tonic) + 12 + rng.choice([0, 4, 7, 12, 16]), 70 + i * 4)

# ---- Acht-Spieler-Motiv: acht Stimmen, acht Gegenrhythmen, alles Akkordtöne ------------------
GRIDS = [[i * .5 for i in range(8)],                                  # Achtel
         [0, .75, 1.5, 2, 2.75, 3.5],                                 # 3+3+2
         [0, 4 / 3, 8 / 3],                                           # Hemiole (3 gegen 4)
         [i * .25 for i in range(16)],                                # Sechzehntel
         [.5, 1.5, 2.5, 3.5],                                         # Offbeat
         [i * .8 for i in range(5)],                                  # Fünfer-Gruppe
         [i / 3 for i in range(12)],                                  # Achteltriolen
         [0, 1.5, 3]]                                                 # punktierte Viertel
EIGHT = [('bassoon', 40, 60, 66), ('tbn', 46, 62, 60), ('horns', 55, 72, 58), ('piano', 60, 79, 64),
         ('clar', 64, 84, 62), ('calli', 64, 84, 56), ('flute', 72, 90, 62), ('xylo', 72, 93, 66)]
rng.shuffle(GRIDS)
class Walker:
    def __init__(self, voice, lo, hi, vel, grid, seed):
        self.v, self.lo, self.hi, self.vel, self.grid = voice, lo, hi, vel, grid
        self.r = random.Random(seed); self.i = self.r.randint(0, 5); self.d = self.r.choice([1, -1])
    def bar(self, b, harm):
        for p in self.grid:
            s, c = chord_at(harm, min(3, int(p + 1e-6)))
            tones = [m for m in range(self.lo, self.hi + 1) if m % 12 in c]
            self.i += self.d
            if self.i >= len(tones) - 1 or self.i <= 0: self.d = -self.d
            self.i = max(0, min(len(tones) - 1, self.i))
            song.add(self.v, song.bar(b) + p, .3, tones[self.i], hv(self.vel))
WALK = [Walker(v, lo, hi, vel, GRIDS[i], 100 + i) for i, (v, lo, hi, vel) in enumerate(EIGHT)]

# ═══════════════════════════════════════════════════════════════════════════════════════════════
LVL = {'intro': 2, 'theme': 2, 'dice': 3, 'theme2': 3, 'noir': 2, 'eight': 3, 'chaos': 4, 'finale': 4}
for si, s in enumerate(SEGS):
    L, style, tonic, mode = s['L'], s['style'], s['pc'], s['mode']
    nxt = SEGS[si + 1] if si + 1 < len(SEGS) else dict(pc=HOME, mode='M')
    for k in range(L):
        b, role = s['start'] + k, ROLES[L][k]
        if role == 'piv':
            harm = [(0, 2, chord(nxt['pc'], nxt['mode'], 'ii')), (2, 2, chord(nxt['pc'], nxt['mode'], 'V7'))]
        else:
            deg = {'h1': 'I', 'h2': 'IV', 'h3': 'I', 'h4': 'V7', 't5': 'I'}[role]
            harm = [(0, 4, chord(tonic, mode, deg))]
        if role == 'piv' and s['stop']:
            stop_bar(b, harm, nxt['pc']); continue
        tuba_bar(b, harm, style); comp_bar(b, harm, style)
        drum_bar(b, LVL[style], role, k == 0 and si > 0, k)
        # -- Melodie ------------------------------------------------------------------------
        if role == 'piv':
            T, M = nxt['pc'], nxt['mode']
            if style == 'noir':
                play('muted', b, PIV[M], T, M, 90); run('clar', b, T, M, 76, 0)
            else:
                play('tpt', b, PIV[M], T, M, 98); run('clar', b, T, M, 84, 1)
                if style in ('chaos', 'finale', 'theme2', 'eight'): play('calli', b, PIV[M], T, M, 76, 1)
            # Posaune: Rutscher ans Ende des Pivots (Fall von der V7-Quinte)
            c = harm[1][2]
            gliss_down('tbn', song.bar(b) + 2, 2, 46 + (c[0] - 10) % 12, 90)
            if style == 'eight':
                for w in WALK: w.bar(b, harm)
            continue
        tpl = HOOK[mode][role]
        sq = style == 'chaos' and role in ('h1', 'h2', 'h3', 'h4', 't5') and k % 2 == 0
        def P(voice, vel, octv=0, leg=.9):
            if sq:
                play(voice, b, squeeze(tpl), tonic, mode, vel, octv, leg)
                play(voice, b, squeeze(tpl), tonic, mode, vel, octv, leg, beat0=2)
            else:
                play(voice, b, tpl, tonic, mode, vel, octv, leg)
        c0 = harm[0][2]
        if style == 'intro':
            if k >= 2:
                P('xylo', 94, 1); P('clar', 70, 0)
        elif style == 'theme':
            P('tpt', 100); P('calli', 62, 1)
            if k % 2 == 0: gliss_up('tbn', song.bar(b), 1.8, 46 + (c0[0] - 10) % 12, 86)
        elif style == 'dice':
            for v, o, vel in s['set']: P(v, vel, o)
            if k == 0 and si > 0: gliss_up('tbn', song.bar(b), 1.5, 46 + (c0[0] - 10) % 12, 88)
        elif style == 'theme2':
            P('calli', 90); P('tpt', 88); P('xylo', 70, 1)
            if k % 2 == 0: gliss_up('tbn', song.bar(b), 1.8, 46 + (c0[0] - 10) % 12, 88)
            if role in ('h3', 'h4'): run('clar', b, tonic, mode, 70, 0)
        elif style == 'noir':
            P('muted', 92)
            for m in voicing(c0, 64, 2): song.add('clar', song.bar(b), 3.7, m + 12 if m < 66 else m, 62)
        elif style == 'eight':
            P('tpt', 100)
            for j, w in enumerate(WALK):
                if k >= j: w.bar(b, harm)
        elif style == 'chaos':
            P('tpt', 100); P('calli', 80, 1)
            if k % 2 == 1: run('clar', b, tonic, mode, 82, 1)
            else: gliss_up('tbn', song.bar(b), 1.5, 46 + (c0[0] - 10) % 12, 92)
            for j in (0, 2, 3, 6):
                WALK[j].bar(b, harm)
        elif style == 'finale':
            P('tpt', 104); P('brass', 80, -1); P('flute', 80, 1); P('calli', 80); P('xylo', 82, 1)
            if k % 2 == 0: gliss_up('tbn', song.bar(b), 1.8, 46 + (c0[0] - 10) % 12, 92)
            if role in ('h4', 't5'): run('clar', b, tonic, mode, 80, 1)

if __name__ == '__main__':
    print('Tonarten:', ' → '.join(f"{KEYNAME[s['pc']]}{'m' if s['mode'] == 'm' else ''}({s['style']},{s['L']})" for s in SEGS))
    if os.environ.get('NORENDER') != '1':
        sf2, out = cli_paths('bgm_skilltest3.ogg')
        song.render(sf2, out, target_rms=0.27, saturate=False, compress=True)
