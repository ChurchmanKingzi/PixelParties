# -*- coding: utf-8 -*-
"""Klänge der Booster-Öffnungsanimation, synthetisiert (numpy) und als .ogg in public/sounds/ abgelegt (Format wie die übrigen
Spiel-Sounds: Vorbis, mono, 22,05 kHz). Zeitpunkte je Bild stehen in opening.json (`sounds`), erzeugt von build_opening.py.

Aufruf:  python3 scripts/booster/build_opening_sounds.py [--out DIR] [Klangname ...]
Ablage:  public/sounds/ (Wiedergabe im Spiel) und eine Kopie in data/shop/Boosterpacks/opening/sounds/ (zusammen mit Packs und Animation)
Dateien (booster_*.ogg):
  slide      Pack gleitet ein und setzt auf          buildup  Spannungsaufbau (1,4 s) bis zum Blitz: Crescendo, schneller werdender Herzschlag
  rip        Folie reißt (Knistern, wachsendes Zischen)   strip    abgerissener Streifen schießt nach oben
  burst      Blitz: Knall, Luftstoß, Funkelkaskade   glitter  Glitzer-Nachklang
  card_whoosh  Karte fliegt                           card_land  Karte landet (Tonhöhe wird zur Laufzeit je Karte gesteigert)
  ready      Glockenakkord, wenn alle neun liegen
  umpf       Sub-Bass-Schlag (Tonhöhensturz ~120 -> 44 Hz, Anschlagsknack, kurzer Nachhall, ~0,4 s) im Moment, in dem das Pack aufgeht (Blitz, Bild T_FLASH)
"""
import os, shutil, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SR = 22050
RNG = np.random.RandomState(2025)


def T(d):
    return np.arange(int(SR * d)) / SR


def noise(d):
    return RNG.uniform(-1, 1, int(SR * d))


def lp_var(x, fc):
    """Einpol-Tiefpass mit zeitveränderlicher Grenzfrequenz fc (Array oder Zahl)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = 1 - np.exp(-2 * np.pi * np.minimum(fc, SR / 2.5) / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


def hp_var(x, fc):
    return x - lp_var(x, fc)


def bp_var(x, fc, q=1.0):
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    return lp_var(hp_var(x, fc / (1 + q * 0.6)), fc * (1 + q * 0.6))


def exp_sweep(f0, f1, n):
    return f0 * (f1 / f0) ** (np.arange(n) / max(n - 1, 1))


def osc(freq):
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def mix(*parts, n=None):
    n = n or max(len(p[1]) + int(p[0] * SR) for p in parts)
    out = np.zeros(n)
    for at, x in parts:
        i = int(at * SR)
        m = min(len(x), n - i)
        if m > 0:
            out[i:i + m] += x[:m]
    return out


def ping(f, d, amp=1.0, partial=0.0):
    t = T(d)
    e = np.exp(-t * (6.0 / d))
    x = np.sin(2 * np.pi * f * t) + partial * np.sin(2 * np.pi * f * 2.76 * t) * 0.6
    return amp * x * e * np.minimum(t * 400, 1)


def reverb(x, taps=((0.07, 0.35), (0.13, 0.25), (0.21, 0.15))):
    out = x.copy()
    n = len(x)
    out = np.concatenate([out, np.zeros(int(SR * 0.3))])
    for dly, g in taps:
        i = int(dly * SR)
        out[i:i + n] += lp_var(x, 3500) * g
    return out


# ---------------------------------------------------------------- Klänge
def s_slide():
    n = int(SR * 0.3); t = T(0.3)
    sweep = lp_var(noise(0.3), exp_sweep(400, 2600, n // 2).tolist() + exp_sweep(2600, 700, n - n // 2).tolist())
    sweep *= np.sin(np.pi * np.minimum(t / 0.22, 1)) ** 1.5 * 0.5
    th = np.sin(2 * np.pi * np.cumsum(exp_sweep(150, 52, int(SR * 0.1))) / SR) * np.exp(-T(0.1) * 28) * 1.0
    crinkle = hp_var(noise(0.05), 2500) * np.exp(-T(0.05) * 60) * 0.5
    return mix((0, sweep), (0.19, th), (0.2, crinkle), (0.24, crinkle * 0.6), n=n)


def s_buildup():
    """Spannungsaufbau vom Einblenden bis der Streifen weg ist: Crescendo aus steigendem Ton mit immer schnellerem Zittern, Windrauschen,
    Funkeln, Folienknistern und einem Herzschlag, der immer schneller wird. Endet abrupt auf dem Höhepunkt (der Knall folgt sofort)."""
    d = 1.4; n = int(SR * d); t = T(d); u = t / d
    f = 110 * np.exp(np.log(14.0) * u ** 1.3)
    trem = 1 + 0.55 * np.sin(2 * np.pi * np.cumsum(3 + 20 * u) / SR)
    tone = (osc(f) + 0.5 * osc(2 * f) + 0.35 * osc(f * 1.006) + 0.2 * osc(3 * f)) * (u ** 2.0) * 0.55 * trem
    sh = osc(exp_sweep(1500, 5200, n)) * (0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(10 + 28 * u) / SR)) * (u ** 2.5) * 0.28
    wind = bp_var(noise(d), exp_sweep(300, 5200, n), q=1.0) * (u ** 2.0) * 1.1
    rumble = lp_var(noise(d), 110) * (u ** 1.0) * 1.6
    cr = np.zeros(n)
    rate = 6 + 90 * u ** 1.6
    for i in range(n):
        if RNG.rand() < rate[i] / SR:
            L = int(SR * 0.004); m = min(L, n - i)
            cr[i:i + m] += RNG.uniform(-1, 1, m) * RNG.uniform(0.3, 0.9)
    cr = hp_var(cr, 1200) * 0.8
    # Herzschlag: Abstände schrumpfen von 0,42 s auf ~0,07 s, Stärke wächst
    beats = np.zeros(n); tt = 0.12; k = 0
    while tt < d - 0.03:
        th = osc(exp_sweep(78, 42, int(SR * 0.09))) * np.exp(-T(0.09) * 30) * (0.25 + 0.95 * (tt / d) ** 1.1)
        i = int(tt * SR); m = min(len(th), n - i)
        beats[i:i + m] += th[:m]
        tt += max(0.07, 0.42 * (0.17 ** (tt / d)))
        k += 1
    out = tone + sh + wind + rumble + cr + beats * 1.5
    return out * np.minimum(t * 80, 1) * np.minimum((d - t) * 200, 1)


def s_rip():
    d = 0.78; n = int(SR * d); t = T(d); u = np.minimum(t / 0.6, 1.0)
    hiss = hp_var(noise(d), exp_sweep(1400, 3600, n)) * (u ** 1.4) * 0.9
    gate = lp_var((RNG.rand(n) > 0.45).astype(float), 900) * 1.6
    crack = np.zeros(n)
    rate = 20 + 160 * u ** 1.5
    for i in range(n):
        if RNG.rand() < rate[i] / SR and t[i] < 0.62:
            L = int(SR * 0.006)
            m = min(L, n - i)
            crack[i:i + m] += RNG.uniform(-1, 1, m) * RNG.uniform(0.5, 1.0) * np.exp(-np.arange(m) / (SR * 0.0016))
    body = lp_var(noise(d), 700) * (u ** 1.2) * 0.8
    tail = np.exp(-np.maximum(t - 0.6, 0) * 18)
    out = (hiss * gate + crack * 1.1 + body) * tail
    return out * np.minimum(t * 120, 1)


def s_strip():
    d = 0.42; n = int(SR * d); t = T(d)
    x = bp_var(noise(d), exp_sweep(450, 3800, n), q=1.2) * np.sin(np.pi * np.minimum(t / d * 1.1, 1)) ** 1.3 * 1.6
    tone = osc(exp_sweep(260, 1500, n)) * np.sin(np.pi * np.minimum(t / d, 1)) * 0.12
    return (x + tone) * np.minimum((d - t) * 25, 1)


def s_burst():
    d = 1.9; n = int(SR * d)
    boom = osc(exp_sweep(95, 30, int(SR * 0.7))) * np.exp(-T(0.7) * 6.0) * 1.4
    body = lp_var(noise(0.4), 650) * np.exp(-T(0.4) * 9) * 1.1
    crack = hp_var(noise(0.09), 2500) * np.exp(-T(0.09) * 50) * 1.2
    air_n = int(SR * 1.0)
    air = bp_var(noise(1.0), exp_sweep(6500, 800, air_n), q=0.8) * np.exp(-T(1.0) * 3.2) * 0.5
    base = mix((0, boom), (0, body), (0, crack), (0.02, air), n=n)
    # Funkelkaskade: Pentatonik, dichter am Anfang
    penta = [1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3]
    sp = np.zeros(n)
    ts = np.sort(RNG.exponential(0.32, 46))
    for tt in ts:
        if tt > 1.55:
            continue
        f = 1480 * penta[RNG.randint(0, 5)] * (2 if RNG.rand() < 0.45 else 1) * (1.5 if RNG.rand() < 0.2 else 1)
        p = ping(min(f, 5200), 0.32, 0.26 * (1 - tt / 1.7), partial=0.2)
        i = int((0.05 + tt) * SR); m = min(len(p), n - i)
        sp[i:i + m] += p[:m]
    out = reverb(base + sp)[:n]
    return out * np.minimum((d - T(d)) * 6, 1)


def s_glitter():
    d = 1.3; n = int(SR * d)
    penta = [1.0, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2.0]
    sp = np.zeros(n)
    for tt in np.sort(RNG.uniform(0, 0.95, 20)):
        f = 1750 * penta[RNG.randint(0, 6)]
        p = ping(min(f, 5400), 0.28, 0.5 * (1 - tt / 1.4), partial=0.15)
        i = int(tt * SR); m = min(len(p), n - i)
        sp[i:i + m] += p[:m]
    hiss = hp_var(noise(d), 5000) * np.exp(-T(d) * 3.5) * 0.12
    return reverb(sp + hiss)[:n] * np.minimum((d - T(d)) * 8, 1)


def s_card_whoosh():
    d = 0.22; n = int(SR * d); t = T(d)
    x = bp_var(noise(d), exp_sweep(700, 2700, n), q=1.0) * np.sin(np.pi * np.minimum(t / d, 1)) ** 1.2 * 1.5
    tone = osc(exp_sweep(320, 980, n)) * np.sin(np.pi * np.minimum(t / d, 1)) * 0.13
    return (x + tone) * np.minimum((d - t) * 40, 1)


def s_card_land():
    d = 0.2
    th = osc(exp_sweep(210, 85, int(SR * 0.09))) * np.exp(-T(0.09) * 40) * 1.0
    click = hp_var(noise(0.02), 2200) * np.exp(-T(0.02) * 160) * 0.8
    p = mix((0, ping(1318, 0.18, 0.36, partial=0.25)), (0, ping(2637, 0.1, 0.12)))
    return mix((0, th), (0, click), (0.004, p), n=int(SR * d))


def s_ready():
    d = 1.8; n = int(SR * d)
    notes = [1047, 1319, 1568, 2093]
    out = np.zeros(n)
    for k, f in enumerate(notes):
        p = ping(f, 1.4, 0.5, partial=0.45)
        i = int(k * 0.085 * SR); m = min(len(p), n - i)
        out[i:i + m] += p[:m]
    hiss = hp_var(noise(d), 6000) * np.exp(-T(d) * 4) * 0.08
    return reverb(out + hiss)[:n] * np.minimum((d - T(d)) * 6, 1)


def s_umpf():
    """„Umpf“: der Schlag, wenn das Pack aufgeht. Sinus mit Tonhöhensturz (120 -> 44 Hz, exponentiell in ~0,11 s) und schneller Hüllkurve, darüber
    ein kurzer Anschlagsknack (tiefpassgefiltertes Rauschen + Klick) und ein kleiner Raum-Nachhall nur im Bassbereich. Sanfte Sättigung (tanh) erzeugt
    Obertöne bei 90-250 Hz, damit der Schlag auch auf kleinen Lautsprechern ankommt. Eigener Zufallszähler: unabhängig von der Reihenfolge der anderen Klänge."""
    rng = np.random.RandomState(4711)
    d = 0.42; n = int(SR * d); t = T(d)
    f = 44 + (120 - 44) * np.exp(-t / 0.035)                       # Sturz auf 44 Hz, dort bleibt der Ton stehen
    body = osc(f) * (0.35 * np.exp(-t / 0.20) + 0.65 * np.exp(-t / 0.07)) * np.minimum(t * 700, 1)
    sub = osc(f * 0.5 + 22) * 0.18 * np.exp(-t / 0.12) * np.minimum(t * 500, 1)   # leichte Unteroktave für Wucht
    punch = osc(2 * f) * 0.42 * np.exp(-t / 0.065) * np.minimum(t * 600, 1)         # Oktave darüber (88-240 Hz): trägt auf kleinen Lautsprechern
    knock_n = lp_var(rng.uniform(-1, 1, n), 1400) * np.exp(-t * 170)
    click = hp_var(rng.uniform(-1, 1, n), 900) * np.exp(-t * 420) * 0.55
    thump = knock_n * 0.9 + click
    dry = body + sub + punch + thump
    sat = np.tanh(dry * 2.4) / np.tanh(2.4)                          # sanfte Sättigung
    wet = np.zeros(n)
    low = lp_var(sat, 320)
    for dly, g in ((0.037, 0.34), (0.071, 0.22), (0.113, 0.13)):
        i = int(dly * SR)
        wet[i:] += low[:n - i] * g
    out = sat + wet
    return out * np.minimum((d - t) * 40, 1)                         # letzte 25 ms ausblenden


SOUNDS = {
    'slide': s_slide, 'buildup': s_buildup, 'rip': s_rip, 'strip': s_strip, 'burst': s_burst, 'glitter': s_glitter,
    'card_whoosh': s_card_whoosh, 'card_land': s_card_land, 'ready': s_ready, 'umpf': s_umpf,
}


def to_ogg(x, path, peak=0.85):   # peak: Spitzenpegel linear (0,85 = -1,4 dBFS; der Umpf nimmt 0,673, das nach der Begrenzung unten -2 dBFS ergibt)
    x = np.nan_to_num(x)
    x = x / max(np.abs(x).max(), 1e-6) * peak
    x = np.tanh(x * 1.15) / np.tanh(1.15)                      # sanfte Begrenzung
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    wav = path + '.wav'
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'libvorbis', '-q:a', '4', '-ac', '1', '-ar', str(SR), path], check=True)
    os.remove(wav)


def main(argv):
    out = os.path.join(ROOT, 'public', 'sounds')
    args = list(argv)
    if '--out' in args:
        i = args.index('--out'); out = args[i + 1]; del args[i:i + 2]
    os.makedirs(out, exist_ok=True)
    # Kopie bei den Boosterpacks (data/shop/Boosterpacks/opening/sounds), damit Packs, Animation und Klänge zusammenliegen
    pack_dir = os.path.join(ROOT, 'data', 'shop', 'Boosterpacks', 'opening', 'sounds')
    os.makedirs(pack_dir, exist_ok=True)
    only = set(args)   # Namen als Argumente: nur diese Klänge neu bauen (z. B. `umpf`)
    for name, fn in SOUNDS.items():
        if only and name not in only:
            continue
        p = os.path.join(out, 'booster_%s.ogg' % name)
        x = fn()
        to_ogg(x, p, peak=0.673 if name == 'umpf' else 0.85)
        shutil.copyfile(p, os.path.join(pack_dir, os.path.basename(p)))
        print('ok', name, '%.2f s' % (len(x) / SR), os.path.getsize(p) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1:])
