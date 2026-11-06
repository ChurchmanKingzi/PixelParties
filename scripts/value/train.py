#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Wertnetz für die CPU (Stufe 2): DeepSets-MLP in reinem numpy, mit handgeschriebener Rückwärtsrechnung.

    node scripts/value/export-dataset.js            # einmal: Datensatz aus den Zustandslogs
    python3 scripts/value/train.py                  # trainieren + messen (Holdout nach Spiel und nach Deck)
    python3 scripts/value/train.py --gradcheck      # Gradientenprobe (Rückwärtsrechnung gegen endliche Differenzen)
    python3 scripts/value/train.py --mode all       # Endtraining auf allen Daten (ohne Holdout), schreibt die Gewichte

Warum numpy statt PyTorch: läuft überall, wo Python und numpy da sind (also auch auf der Sandbox und dem Trainingsrechner ohne
Installation), und das Netz ist klein genug (rund 300k Parameter). Die Gewichte gehen als `net.json` (Kopf) + `net.f32` (Float32)
nach `<out>/`; `cards/effects/_value-net.js` liest sie.

Aufbau (siehe Konzept): je Token  h = relu(E[id] + Eo[own] + x·Wg + bg)  mit Gewichten je Gruppe (für beide Seiten gleich),
Summe über die Token je Seite und Gruppe, dann [Summen ich | Summen Gegner | globale Zahlen] → MLP → drei Ausgaben:
(0) Logit „mein Sitz gewinnt", (1) Wert des handgeschriebenen Evaluators (Destillation), (2) Züge bis Spielende (Hilfsziel).
"""
import argparse
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
POOL_SCALE = 0.25          # Summen über Token werden vor dem MLP gestaucht (bis zu ~25 Token je Gruppe)
EV_CLIP = 6000.0           # Bewertungspunkte, darüber abgeschnitten
EV_SCALE = 1000.0
REM_CLIP = 40.0
REM_SCALE = 10.0
TURN_BUCKETS = [(1, 5), (6, 10), (11, 15), (16, 20), (21, 999)]


# ── Daten ────────────────────────────────────────────────────────────
class Data:
    def __init__(self, folder):
        self.folder = folder
        with open(os.path.join(folder, 'manifest.json'), encoding='utf-8') as f:
            self.m = json.load(f)
        dt = {'u8': np.uint8, 'f32': np.float32, 'i16': np.int16, 'i32': np.int32}
        self.a = {}
        for name, spec in self.m['arrays'].items():
            arr = np.fromfile(os.path.join(folder, spec['file']), dtype=dt[spec['dtype']])
            self.a[name] = arr.reshape(spec['shape']) if len(spec['shape']) > 1 else arr
        self.N = self.m['nExamples']
        self.groups = self.m['groups']
        self.ng = len(self.groups)
        self.nglob = self.m['nGlob']
        self.vocab = self.m['vocabSize']
        # Pro Gruppe: Offsets je (Beispiel, Seite) in die Token-Arrays (Token sind nach Beispiel, dann Seite sortiert).
        self.off = []
        for g in range(self.ng):
            key = self.a[f'g{g}_ex'].astype(np.int64) * 2 + self.a[f'g{g}_side']
            self.off.append(np.searchsorted(key, np.arange(2 * self.N + 1)))
        y = self.a['y'].astype(np.float32)
        self.y = y
        ev = self.a['ev'].astype(np.float32)
        self.ev_ok = np.isfinite(ev)
        self.ev_t = np.where(self.ev_ok, np.clip(ev, -EV_CLIP, EV_CLIP) / EV_SCALE, 0.0).astype(np.float32)
        self.rem_t = (np.clip(self.a['rem'].astype(np.float32), 0, REM_CLIP) / REM_SCALE)
        self.turn = self.a['turn'].astype(np.int32)

    def batch(self, idx, dtype=np.float32):
        """Eingabe für die Beispiele `idx`: je Gruppe (Karten, Besitzer, Zahlen, Segmente), globale Zahlen, Ziele."""
        B = len(idx)
        groups = []
        for g in range(self.ng):
            o = self.off[g]
            s = o[2 * idx]
            ln = o[2 * idx + 2] - s
            tot = int(ln.sum())
            if tot == 0:
                groups.append(None)
                continue
            cs = np.cumsum(ln) - ln
            tok = np.repeat(s - cs, ln) + np.arange(tot)
            seg = np.repeat(np.arange(B), ln) * 2 + self.a[f'g{g}_side'][tok]
            first = np.flatnonzero(np.r_[True, seg[1:] != seg[:-1]])
            groups.append({
                'ids': self.a[f'g{g}_id'][tok], 'own': self.a[f'g{g}_own'][tok],
                'x': self.a[f'g{g}_x'][tok].astype(dtype), 'seg': seg, 'first': first, 'uniq': seg[first],
            })
        return {
            'B': B, 'groups': groups, 'glob': self.a['glob'][idx].astype(dtype),
            'y': self.y[idx].astype(dtype), 'ev': self.ev_t[idx].astype(dtype), 'ev_ok': self.ev_ok[idx],
            'rem': self.rem_t[idx].astype(dtype),
        }


# ── Netz ─────────────────────────────────────────────────────────────
def init_params(data, dim, hidden, seed, dtype=np.float32, emb_init=0.1):
    rng = np.random.default_rng(seed)
    p = {}
    p['E'] = (rng.standard_normal((data.vocab, dim)) * emb_init).astype(dtype)
    p['Eo'] = (rng.standard_normal((data.vocab, dim)) * emb_init).astype(dtype)
    for g, spec in enumerate(data.groups):
        p[f'Wg{g}'] = (rng.standard_normal((spec['nx'], dim)) / np.sqrt(max(spec['nx'], 1)) * 0.7).astype(dtype)
        p[f'bg{g}'] = np.zeros(dim, dtype)
    nin = 2 * data.ng * dim + data.nglob
    sizes = [nin] + list(hidden) + [3]
    for i in range(len(sizes) - 1):
        p[f'W{i + 1}'] = (rng.standard_normal((sizes[i], sizes[i + 1])) * np.sqrt(2.0 / sizes[i])).astype(dtype)
        p[f'b{i + 1}'] = np.zeros(sizes[i + 1], dtype)
    p['W%d' % (len(sizes) - 1)] *= 0.1
    return p


def n_params(p):
    return int(sum(v.size for v in p.values()))


def forward(p, data, bt, dim, nh, drop=0.0, rng=None):
    """Vorwärtsrechnung; liefert Ausgabe (B,3) und den Zwischenspeicher für `backward`."""
    B = bt['B']
    feats = []
    gc = []
    for g in range(data.ng):
        gb = bt['groups'][g]
        pooled = np.zeros((2 * B, dim), p['E'].dtype)
        if gb is not None:
            pre = p['E'][gb['ids']] + p['Eo'][gb['own']] + gb['x'] @ p[f'Wg{g}'] + p[f'bg{g}']
            h = np.maximum(pre, 0)
            pooled[gb['uniq']] = np.add.reduceat(h, gb['first'], axis=0)
            gc.append(pre)
        else:
            gc.append(None)
        feats.append(pooled.reshape(B, 2 * dim) * POOL_SCALE)
    X = np.concatenate(feats + [bt['glob']], axis=1)
    acts = [X]
    masks = []
    a = X
    for i in range(1, nh + 1):
        z = a @ p[f'W{i}'] + p[f'b{i}']
        a = np.maximum(z, 0)
        if drop > 0:
            m = (rng.random(a.shape) >= drop).astype(a.dtype) / (1 - drop)
            a = a * m
            masks.append(m)
        else:
            masks.append(None)
        acts.append(a)
    out = a @ p[f'W{nh + 1}'] + p[f'b{nh + 1}']
    return out, {'acts': acts, 'masks': masks, 'gc': gc}


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def losses(out, bt, w):
    """Verlust und Ableitung nach der Ausgabe. w = Gewichte (Ausgang, Evaluator, Restzüge)."""
    B = bt['B']
    z = out[:, 0]
    y = bt['y']
    pr = sigmoid(z)
    eps = 1e-7
    l_out = -np.mean(y * np.log(pr + eps) + (1 - y) * np.log(1 - pr + eps))
    d = np.zeros_like(out)
    d[:, 0] = (pr - y) / B * w[0]
    ok = bt['ev_ok'].astype(out.dtype)
    r = out[:, 1] - bt['ev']
    hub = np.where(np.abs(r) <= 1.0, 0.5 * r * r, np.abs(r) - 0.5)
    n_ok = max(ok.sum(), 1.0)
    l_ev = float((hub * ok).sum() / n_ok)
    d[:, 1] = np.clip(r, -1.0, 1.0) * ok / n_ok * w[1]
    r2 = out[:, 2] - bt['rem']
    l_rem = float(np.mean(r2 * r2))
    d[:, 2] = 2 * r2 / B * w[2]
    return float(l_out), l_ev, l_rem, d


def backward(p, data, bt, cache, dout, dim, nh):
    B = bt['B']
    gr = {k: np.zeros_like(v) for k, v in p.items()}
    acts, masks = cache['acts'], cache['masks']
    da = dout @ p[f'W{nh + 1}'].T
    gr[f'W{nh + 1}'] = acts[-1].T @ dout
    gr[f'b{nh + 1}'] = dout.sum(0)
    for i in range(nh, 0, -1):
        if masks[i - 1] is not None:
            da = da * masks[i - 1]
        dz = da * (acts[i] > 0)
        gr[f'W{i}'] = acts[i - 1].T @ dz
        gr[f'b{i}'] = dz.sum(0)
        da = dz @ p[f'W{i}'].T
    dX = da
    for g in range(data.ng):
        gb = bt['groups'][g]
        if gb is None:
            continue
        dP = dX[:, g * 2 * dim:(g + 1) * 2 * dim].reshape(2 * B, dim) * POOL_SCALE
        dh = dP[gb['seg']]
        dpre = dh * (cache['gc'][g] > 0)
        gr[f'Wg{g}'] = gb['x'].T @ dpre
        gr[f'bg{g}'] = dpre.sum(0)
        np.add.at(gr['E'], gb['ids'], dpre)
        np.add.at(gr['Eo'], gb['own'], dpre)
    return gr


# ── Messung ──────────────────────────────────────────────────────────
def auc(score, y):
    """AUC über Rangsumme, Gleichstände gemittelt."""
    y = np.asarray(y)
    n1 = int(y.sum())
    n0 = len(y) - n1
    if n1 == 0 or n0 == 0:
        return float('nan')
    order = np.argsort(score, kind='mergesort')
    s = np.asarray(score)[order]
    new = np.r_[True, s[1:] != s[:-1]]
    grp = np.cumsum(new) - 1
    cnt = np.bincount(grp)
    last = np.cumsum(cnt)
    avg = last - (cnt - 1) / 2.0
    ranks = avg[grp]
    return float((ranks[y[order] == 1].sum() - n1 * (n1 + 1) / 2.0) / (n1 * n0))


def auc_within(score, y, group):
    """AUC nur zwischen Beispielen DERSELBEN Paarung (Deck gegen Deck, Seite gleich): entfernt den Deck-Prior und misst, ob das Modell
    Stellungen aus gewonnenen höher einstuft als solche aus verlorenen Spielen derselben Paarung. Gewicht = Zahl der Paare."""
    order = np.argsort(group, kind='mergesort')
    g = np.asarray(group)[order]
    sc = np.asarray(score)[order]
    yy = np.asarray(y)[order]
    cuts = np.flatnonzero(np.r_[True, g[1:] != g[:-1], True])
    num, den = 0.0, 0.0
    for a, b in zip(cuts[:-1], cuts[1:]):
        ys = yy[a:b]
        n1 = int(ys.sum())
        n0 = (b - a) - n1
        if n1 == 0 or n0 == 0:
            continue
        w = float(n1) * n0
        num += auc(sc[a:b], ys) * w
        den += w
    return float(num / den) if den else float('nan')


def logloss(p, y):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def calibration(p, y, bins=10):
    """(ECE, größte Abweichung einer Klasse mit mindestens 200 Beispielen) in Prozentpunkten."""
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    ece, worst = 0.0, 0.0
    for b in range(bins):
        m = idx == b
        if m.sum() == 0:
            continue
        gap = abs(p[m].mean() - y[m].mean())
        ece += m.mean() * gap
        if m.sum() >= 200:
            worst = max(worst, gap)
    return float(100 * ece), float(100 * worst)


def fit_logistic(X, y, l2=1.0, iters=30):
    """Logistische Regression (Newton), Eingaben bereits standardisiert; letzte Spalte Achsenabschnitt wird intern ergänzt."""
    n, d = X.shape
    A = np.c_[X, np.ones(n)]
    w = np.zeros(d + 1)
    reg = np.eye(d + 1) * l2
    reg[-1, -1] = 0
    for _ in range(iters):
        z = A @ w
        pr = sigmoid(z)
        g = A.T @ (pr - y) + reg @ w
        H = (A * (pr * (1 - pr))[:, None]).T @ A + reg + 1e-9 * np.eye(d + 1)
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-8:
            break
    return w


def predict_logistic(w, X):
    return sigmoid(np.c_[X, np.ones(len(X))] @ w)


def fit_platt(z, y):
    """Nachträgliche Kalibrierung: logistische Anpassung z' = a·z + b der Roh-Logits an die Ausgänge. Gibt (a, b) zurück."""
    w = fit_logistic(np.asarray(z, np.float64)[:, None], np.asarray(y, np.float64), l2=1e-6)
    return float(w[0]), float(w[1])


def make_split(data, rng, holdout_decks=4, val_frac=0.1):
    """Aufteilung nach Spiel und Deck: (Training, Validierung neuer Spiele bekannter Decks, ungesehene Decks, Holdout-Decks).
    Verbraucht `rng` in fester Reihenfolge — derselbe Startwert ergibt immer dieselbe Aufteilung (auch in `calibrate.py`)."""
    game = data.a['game']
    ds, do = data.a['deckSelf'].astype(np.int64), data.a['deckOpp'].astype(np.int64)
    held = rng.choice(len(data.m['decks']), size=holdout_decks, replace=False)
    in_held = np.isin(ds, held) | np.isin(do, held)
    games = np.unique(game[~in_held])
    val_games = rng.choice(games, size=int(len(games) * val_frac), replace=False)
    is_val = np.isin(game, val_games) & ~in_held
    return np.flatnonzero(~in_held & ~is_val), np.flatnonzero(is_val), np.flatnonzero(in_held), held


def load_net(folder):
    """Gewichte aus `net.json` + `net.f32` zurück in ein Parameter-Wörterbuch (wie `init_params`). Gibt (p, head) zurück."""
    with open(os.path.join(folder, 'net.json'), encoding='utf-8') as f:
        head = json.load(f)
    blob = np.fromfile(os.path.join(folder, 'net.f32'), dtype='<f4')
    p = {}
    for t in head['tensors']:
        n = int(np.prod(t['shape']))
        p[t['name']] = blob[t['offset']:t['offset'] + n].reshape(t['shape']).astype(np.float32)
    return p, head


def evaluate(p, data, idx, dim, nh, bs=4096):
    outs = []
    for i in range(0, len(idx), bs):
        bt = data.batch(idx[i:i + bs])
        out, _ = forward(p, data, bt, dim, nh)
        outs.append(out)
    return np.concatenate(outs) if outs else np.zeros((0, 3), np.float32)


def bucket_report(name, idx, data, scores, probs):
    """AUC je Spielphase für mehrere Vorhersager. scores: {Name: Bewertung}, probs: {Name: Wahrscheinlichkeit}."""
    y = data.y[idx]
    turn = data.turn[idx]
    rows = []
    for lo, hi in TURN_BUCKETS + [(1, 999)]:
        m = (turn >= lo) & (turn <= hi)
        if m.sum() < 50:
            continue
        row = {'bucket': f'{lo}-{hi}' if hi < 999 else (f'{lo}+' if lo > 1 else 'alle'), 'n': int(m.sum())}
        for k, s in scores.items():
            row[f'auc_{k}'] = round(float(auc(s[m], y[m])), 4)
        for k, pr in probs.items():
            row[f'll_{k}'] = round(float(logloss(pr[m], y[m])), 4)
        rows.append(row)
    return rows


def print_table(title, rows):
    print(f'\n── {title}')
    if not rows:
        print('   (leer)')
        return
    keys = list(rows[0].keys())
    print('   ' + ' '.join(k.rjust(11) for k in keys))
    for r in rows:
        print('   ' + ' '.join(str(r.get(k, '')).rjust(11) for k in keys))


# ── Gradientenprobe ──────────────────────────────────────────────────
def gradcheck(data, dim, hidden):
    idx = np.arange(0, min(data.N, 4000), 61)[:48]
    p = init_params(data, dim, hidden, 5, np.float64)
    nh = len(hidden)
    # Zufällige Gewichte so ändern, dass alle Ausgaben etwas bewirken
    rng = np.random.default_rng(3)
    for k in p:
        if k.startswith('b'):
            p[k] = rng.standard_normal(p[k].shape) * 0.05
    bt = data.batch(idx, np.float64)
    w = (1.0, 0.5, 0.2)

    def loss_fn(pp):
        out, _ = forward(pp, data, bt, dim, nh)
        a, b, c, _ = losses(out, bt, w)
        return w[0] * a + w[1] * b + w[2] * c

    out, cache = forward(p, data, bt, dim, nh)
    _, _, _, dout = losses(out, bt, w)
    gr = backward(p, data, bt, cache, dout, dim, nh)
    worst = 0.0
    eps = 1e-6
    for k in sorted(p):
        flat = p[k].reshape(-1)
        gflat = gr[k].reshape(-1)
        nz = np.flatnonzero(np.abs(gflat) > 1e-12)
        pick = rng.choice(nz, size=min(6, len(nz)), replace=False) if len(nz) else []
        for j in pick:
            old = flat[j]
            flat[j] = old + eps
            lp = loss_fn(p)
            flat[j] = old - eps
            lm = loss_fn(p)
            flat[j] = old
            num = (lp - lm) / (2 * eps)
            rel = abs(num - gflat[j]) / max(1e-8, abs(num) + abs(gflat[j]))
            worst = max(worst, rel)
            if rel > 1e-4:
                print(f'  ✗ {k}[{j}]  analytisch {gflat[j]:.6g}  numerisch {num:.6g}')
    print(f'Gradientenprobe: größte relative Abweichung {worst:.2e}', '→ OK' if worst < 1e-4 else '→ FEHLER')
    return worst < 1e-4


# ── Export ───────────────────────────────────────────────────────────
def export(p, data, dim, hidden, folder, extra=None):
    os.makedirs(folder, exist_ok=True)
    order = ['E', 'Eo'] + [f'{k}{g}' for g in range(data.ng) for k in ('Wg', 'bg')]
    nh = len(hidden)
    for i in range(1, nh + 2):
        order += [f'W{i}', f'b{i}']
    tensors, blob, pos = [], [], 0
    for k in order:
        a = np.ascontiguousarray(p[k], dtype='<f4')
        tensors.append({'name': k, 'shape': list(a.shape), 'offset': pos})
        blob.append(a.tobytes())
        pos += a.size
    head = {
        'format': 'pp-value-net', 'version': 1, 'featuresVersion': data.m['featuresVersion'], 'dim': dim, 'hidden': list(hidden),
        'poolScale': POOL_SCALE, 'groups': data.groups, 'nGlob': data.nglob, 'vocabSize': data.vocab,
        'outputs': ['logit', 'ev', 'rem'], 'evScale': EV_SCALE, 'remScale': REM_SCALE, 'tensors': tensors, 'floats': pos,
    }
    if extra:
        head.update(extra)
    with open(os.path.join(folder, 'net.f32'), 'wb') as f:
        f.write(b''.join(blob))
    with open(os.path.join(folder, 'net.json'), 'w', encoding='utf-8') as f:
        json.dump(head, f, ensure_ascii=False)


# ── Training ─────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=os.path.join(ROOT, 'data', 'training', 'value', 'dataset'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'training', 'value', 'net'))
    ap.add_argument('--dim', type=int, default=32)
    ap.add_argument('--hidden', type=int, nargs='+', default=[256, 128])
    ap.add_argument('--epochs', type=int, default=20)
    ap.add_argument('--batch', type=int, default=512)
    ap.add_argument('--lr', type=float, default=2e-3)
    ap.add_argument('--wd', type=float, default=1e-4)
    ap.add_argument('--drop', type=float, default=0.0)
    ap.add_argument('--emb-init', type=float, default=0.1, help='Streuung der Start-Einbettungen (0: nie gesehene Karten bleiben „unbekannt")')
    ap.add_argument('--id-drop', type=float, default=0.0, help='Anteil der Kartennummern, die im Training auf 0 (unbekannt) gesetzt werden')
    ap.add_argument('--w-out', type=float, default=1.0, help='Gewicht des Ausgang-Ziels')
    ap.add_argument('--w-ev', type=float, default=0.5, help='Startgewicht des Evaluator-Ziels (sinkt linear auf 20 Prozent)')
    ap.add_argument('--w-rem', type=float, default=0.1)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--mode', choices=['split', 'all'], default='split')
    ap.add_argument('--holdout-decks', type=int, default=4)
    ap.add_argument('--val-frac', type=float, default=0.1)
    ap.add_argument('--max-train', type=int, default=0, help='nur zum Ausprobieren: weniger Trainingsbeispiele')
    ap.add_argument('--gradcheck', action='store_true')
    args = ap.parse_args()

    t0 = time.time()
    data = Data(args.data)
    print(f'Daten: {data.N} Beispiele, {data.m["nGames"]} Spiele, {len(data.m["decks"])} Decks ({time.time() - t0:.0f} s)')
    if args.gradcheck:
        sys.exit(0 if gradcheck(data, 8, [16, 8]) else 1)

    rng = np.random.default_rng(args.seed)
    game = data.a['game']
    decks = len(data.m['decks'])
    ds, do = data.a['deckSelf'].astype(np.int64), data.a['deckOpp'].astype(np.int64)
    if args.mode == 'split':
        train_idx, val_idx, test_idx, held = make_split(data, rng, args.holdout_decks, args.val_frac)
        print(f'Holdout-Decks: {[data.m["decks"][i] for i in held]}')
        print(f'Training {len(train_idx)} · Validierung (neue Spiele) {len(val_idx)} · ungesehene Decks {len(test_idx)}')
    else:
        train_idx = np.arange(data.N)
        val_idx = np.flatnonzero(np.isin(game, rng.choice(np.unique(game), size=int(len(np.unique(game)) * 0.02), replace=False)))
        test_idx = np.array([], dtype=np.int64)
        print(f'Endtraining auf allen {len(train_idx)} Beispielen (Kontrolle: {len(val_idx)} davon)')
    if args.max_train:
        train_idx = rng.choice(train_idx, size=min(args.max_train, len(train_idx)), replace=False)

    # Vergleichsmodelle auf denselben Daten
    lin = data.a['lin'].astype(np.float64)
    mu, sd = lin[train_idx].mean(0), lin[train_idx].std(0) + 1e-9
    wl = fit_logistic((lin[train_idx] - mu) / sd, data.y[train_idx].astype(np.float64))
    lin_p = lambda idx: predict_logistic(wl, (lin[idx] - mu) / sd)
    ev_all = data.a['ev'].astype(np.float64)
    okt = np.isfinite(ev_all[train_idx])
    we = fit_logistic(np.clip(ev_all[train_idx][okt], -EV_CLIP, EV_CLIP)[:, None] / EV_SCALE, data.y[train_idx][okt].astype(np.float64), l2=1e-3)
    ev_p = lambda idx: predict_logistic(we, np.clip(np.nan_to_num(ev_all[idx]), -EV_CLIP, EV_CLIP)[:, None] / EV_SCALE)

    # Deck-Prior: wie gut sagt allein die Paarung (welche Decks spielen) den Ausgang voraus? Das ist kein Stellungswissen —
    # im Spiegel (gleiches Deck auf beiden Seiten, Stufe 3) fällt es weg, im Datensatz steckt es aber in jedem Beispiel.
    def deck_onehot(idx):
        X = np.zeros((len(idx), 2 * decks))
        X[np.arange(len(idx)), ds[idx]] = 1
        X[np.arange(len(idx)), decks + do[idx]] = 1
        return X
    wp = fit_logistic(deck_onehot(train_idx), data.y[train_idx].astype(np.float64), l2=5.0)
    prior_p = lambda idx: predict_logistic(wp, deck_onehot(idx))
    logit = lambda q: np.log(np.clip(q, 1e-6, 1 - 1e-6) / (1 - np.clip(q, 1e-6, 1 - 1e-6)))
    def stack_X(idx, prior):
        cols = [np.clip(np.nan_to_num(ev_all[idx]), -EV_CLIP, EV_CLIP) / EV_SCALE, (lin[idx] - mu) / sd]
        X = np.column_stack([cols[0], cols[1]])
        return np.column_stack([X, logit(prior_p(idx))]) if prior else X
    ws = fit_logistic(stack_X(train_idx, False), data.y[train_idx].astype(np.float64), l2=1.0)
    wsp = fit_logistic(stack_X(train_idx, True), data.y[train_idx].astype(np.float64), l2=1.0)
    stack_p = lambda idx: predict_logistic(ws, stack_X(idx, False))
    stackp_p = lambda idx: predict_logistic(wsp, stack_X(idx, True))

    dim, hidden, nh = args.dim, args.hidden, len(args.hidden)
    p = init_params(data, dim, hidden, args.seed, emb_init=args.emb_init)
    print(f'Netz: {n_params(p)} Parameter (dim {dim}, hidden {hidden})')
    m1 = {k: np.zeros_like(v) for k, v in p.items()}
    m2 = {k: np.zeros_like(v) for k, v in p.items()}
    step = 0
    steps_total = args.epochs * (len(train_idx) // args.batch)
    best = (1e9, None, -1)
    drop_rng = np.random.default_rng(args.seed + 100)

    for ep in range(args.epochs):
        te = time.time()
        perm = rng.permutation(train_idx)
        w = (args.w_out, args.w_ev * (1 - 0.8 * ep / max(1, args.epochs - 1)), args.w_rem)
        acc = np.zeros(3)
        nb = 0
        for i in range(0, len(perm) - args.batch + 1, args.batch):
            bt = data.batch(perm[i:i + args.batch])
            if args.id_drop > 0:
                for gb in bt['groups']:
                    if gb is not None:
                        gb['ids'] = np.where(drop_rng.random(len(gb['ids'])) < args.id_drop, 0, gb['ids'])
                        gb['own'] = np.where(drop_rng.random(len(gb['own'])) < args.id_drop, 0, gb['own'])
            out, cache = forward(p, data, bt, dim, nh, args.drop, drop_rng)
            lo, le, lr_, dout = losses(out, bt, w)
            gr = backward(p, data, bt, cache, dout, dim, nh)
            step += 1
            lr = args.lr * (0.05 + 0.95 * 0.5 * (1 + np.cos(np.pi * step / steps_total)))
            for k in p:
                g = gr[k]
                m1[k] = 0.9 * m1[k] + 0.1 * g
                m2[k] = 0.999 * m2[k] + 0.001 * g * g
                upd = (m1[k] / (1 - 0.9 ** step)) / (np.sqrt(m2[k] / (1 - 0.999 ** step)) + 1e-8)
                if args.wd and p[k].ndim == 2:
                    upd = upd + args.wd * p[k]
                p[k] -= (lr * upd).astype(p[k].dtype)
            acc += (lo, le, lr_)
            nb += 1
        acc /= max(nb, 1)
        ov = evaluate(p, data, val_idx, dim, nh)
        pv = sigmoid(ov[:, 0])
        yv = data.y[val_idx]
        ll = logloss(pv, yv)
        a_all = auc(ov[:, 0], yv)
        evm = data.ev_ok[val_idx]
        corr = float(np.corrcoef(ov[evm, 1], data.ev_t[val_idx][evm])[0, 1])
        print(f'Epoche {ep + 1:2d}/{args.epochs}  Verlust Ausgang {acc[0]:.4f} Evaluator {acc[1]:.4f} Restzüge {acc[2]:.4f}'
              f'  │ Val: Log-Loss {ll:.4f} AUC {a_all:.4f} r(Evaluator) {corr:.3f}  ({time.time() - te:.0f} s)', flush=True)
        if ll < best[0] or args.mode == 'all':
            best = (ll, {k: v.copy() for k, v in p.items()}, ep + 1)
    ll_best, p_best, ep_best = best
    print(f'\nBeste Epoche: {ep_best} (Val-Log-Loss {ll_best:.4f})')

    report = {'epochBest': ep_best, 'params': n_params(p), 'args': vars(args)}
    # Nachträgliche Kalibrierung (Platt): Faktor und Versatz auf den Roh-Logits, angepasst an den Validierungsspielen bekannter Decks.
    # Die ungesehenen Decks gehen NICHT in die Anpassung ein — an ihnen zeigt sich, ob sie auch auf neue Decks trägt.
    calib = None
    if args.mode == 'split' and len(val_idx):
        zv = evaluate(p_best, data, val_idx, dim, nh)[:, 0].astype(np.float64)
        calib = fit_platt(zv, data.y[val_idx])
        print(f'Kalibrierung: z\' = {calib[0]:.3f}·z {calib[1]:+.3f}')
    for title, idx in (('Validierung (neue Spiele, bekannte Decks)', val_idx), ('Ungesehene Decks', test_idx)):
        if len(idx) == 0:
            continue
        o = evaluate(p_best, data, idx, dim, 2 if False else nh)
        pn = sigmoid(o[:, 0])
        if calib:
            pc = sigmoid(calib[0] * o[:, 0].astype(np.float64) + calib[1])
            ec, wc = calibration(pc, data.y[idx])
            e0, w0 = calibration(pn, data.y[idx])
            print(f'   {title}: nach Kalibrierung mittlere Abweichung {ec:.1f} Pp, größte {wc:.1f} Pp (vorher {e0:.1f} / {w0:.1f}) · '
                  f'Log-Loss {logloss(pc, data.y[idx]):.4f} (vorher {logloss(pn, data.y[idx]):.4f})')
            report.setdefault('calib', {})[title] = {'ece': round(ec, 2), 'worst': round(wc, 2), 'll': round(logloss(pc, data.y[idx]), 4)}
        seen = idx is val_idx
        sc = {'netz': o[:, 0], 'netzEv': o[:, 1], 'evaluator': np.nan_to_num(ev_all[idx]), 'linear': lin_p(idx), 'stapel': stack_p(idx)}
        pr = {'netz': pn, 'evaluator': ev_p(idx), 'linear': lin_p(idx), 'stapel': stack_p(idx)}
        if seen:    # Deck-Prior nur für Decks, die das Modell kennt
            sc['prior'] = prior_p(idx); sc['stapel+P'] = stackp_p(idx)
            pr['prior'] = sc['prior']; pr['stapel+P'] = sc['stapel+P']
        rows = bucket_report(title, idx, data, sc, pr)
        print_table(f'{title}: AUC je Spielphase (Zugnummer) und Log-Loss', rows)
        pair = ds[idx] * decks + do[idx]
        within = {k: round(auc_within(v, data.y[idx], pair), 4) for k, v in sc.items() if k in ('netz', 'netzEv', 'evaluator', 'linear', 'stapel')}
        print('   AUC innerhalb derselben Paarung (ohne Deck-Prior): ' + ' · '.join(f'{k} {v:.4f}' for k, v in within.items()))
        e1, w1 = calibration(pn, data.y[idx])
        e2, w2 = calibration(ev_p(idx), data.y[idx])
        print(f'   Kalibrierung Netz: mittlere Abweichung {e1:.1f} Pp, größte {w1:.1f} Pp · Evaluator (logistisch kalibriert): {e2:.1f} / {w2:.1f} Pp')
        report[title] = {'rows': rows, 'within': within, 'ece': round(float(e1), 2), 'worst': round(float(w1), 2)}
    extra = {'epochs': ep_best, 'trainExamples': int(len(train_idx)), 'mode': args.mode}
    if calib:
        extra['calib'] = {'a': calib[0], 'b': calib[1]}
    export(p_best, data, dim, hidden, args.out, extra)
    with open(os.path.join(args.out, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(f'\nGewichte: {args.out}/net.json + net.f32  ({time.time() - t0:.0f} s gesamt)')


if __name__ == '__main__':
    main()
