'use strict';
// ═══════════════════════════════════════════════════════════════════
//  K.-o.-Turnier (Single Elimination) — reine Logik
//
//  state = { name, status: 'signup'|'running'|'finished'|'cancelled', players: [id], rounds: [[{a, b, winner}]], champion }
//  Freilose: Bei ungerader Zahl bzw. Nicht-Zweierpotenz bekommen einzelne Spieler in Runde 1 ein Freilos
//  (b = null, winner sofort = a). Danach ist die Teilnehmerzahl eine Zweierpotenz.
//  Ergebnisse trägt ein Admin ein (kein Abgleich mit dem Spiel).
// ═══════════════════════════════════════════════════════════════════

function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p; };

/** Erste Runde: zufällig gelost; die Freilose verteilen sich auf unterschiedliche Spieler. */
function buildFirstRound(players, rnd = Math.random) {
  if (players.length < 2) throw new Error('Need at least 2 players');
  const size = nextPow2(players.length);
  const byes = size - players.length;
  const order = shuffle(players, rnd);
  const matches = [];
  let i = 0;
  for (let b = 0; b < byes; b++) matches.push({ a: order[i++], b: null, winner: order[i - 1] });
  while (i < order.length) matches.push({ a: order[i++], b: order[i++], winner: null });
  return shuffle(matches, rnd);
}

function start(state, rnd = Math.random) {
  state.status = 'running';
  state.rounds = [buildFirstRound(state.players, rnd)];
  state.champion = null;
  settle(state);
  return state;
}

/** Wenn die aktuelle Runde komplett entschieden ist: nächste Runde bauen bzw. Sieger küren. Wiederholt sich (Freilose). */
function settle(state) {
  for (;;) {
    const round = state.rounds[state.rounds.length - 1];
    if (round.some(m => !m.winner)) return state;
    if (round.length === 1) { state.champion = round[0].winner; state.status = 'finished'; return state; }
    const winners = round.map(m => m.winner);
    const next = [];
    for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1], winner: null });
    state.rounds.push(next);
  }
}

function pendingMatches(state) {
  if (state.status !== 'running') return [];
  return state.rounds[state.rounds.length - 1].filter(m => !m.winner);
}

/** Admin meldet einen Sieger. @returns {{ok:boolean, error?:string, match?:object, newMatches?:object[], champion?:string}} */
function report(state, winnerId) {
  if (state.status !== 'running') return { ok: false, error: 'No tournament is running.' };
  const round = state.rounds[state.rounds.length - 1];
  const match = round.find(m => !m.winner && (m.a === winnerId || m.b === winnerId));
  if (!match) return { ok: false, error: 'That player has no open match right now.' };
  const roundsBefore = state.rounds.length;
  match.winner = winnerId;
  settle(state);
  const created = state.rounds.length > roundsBefore ? state.rounds[state.rounds.length - 1] : [];
  return { ok: true, match, newMatches: created.filter(m => !m.winner), champion: state.champion || undefined };
}

/** Teilnehmer ausschließen: in der Anmeldung entfernen, im laufenden Turnier gewinnt der Gegner. */
function disqualify(state, userId) {
  if (state.status === 'signup') {
    const had = state.players.includes(userId);
    state.players = state.players.filter(p => p !== userId);
    return { ok: had, error: had ? undefined : 'That player isn’t signed up.' };
  }
  if (state.status !== 'running') return { ok: false, error: 'No tournament is running.' };
  const round = state.rounds[state.rounds.length - 1];
  const match = round.find(m => !m.winner && (m.a === userId || m.b === userId));
  if (!match) return { ok: false, error: 'That player has no open match right now.' };
  return report(state, match.a === userId ? match.b : match.a);
}

const roundName = (state, idx) => {
  const fromEnd = Math.log2(nextPow2(state.players.length)) - idx;   // 1 = Finale
  return fromEnd === 1 ? 'Final' : fromEnd === 2 ? 'Semifinals' : fromEnd === 3 ? 'Quarterfinals' : `Round ${idx + 1}`;
};

/** Text-Darstellung (Spieler als Erwähnung; in Embeds pingt das nicht). */
function describe(state, who = id => `<@${id}>`) {
  const out = [];
  state.rounds.forEach((round, idx) => {
    const lines = round.map(m => {
      if (!m.b) return `${who(m.a)} — *bye*`;
      const mark = id => (m.winner === id ? `**${who(id)}** ✅` : (m.winner ? `~~${who(id)}~~` : who(id)));
      return `${mark(m.a)} vs ${mark(m.b)}`;
    });
    out.push({ title: roundName(state, idx), text: lines.join('\n') });
  });
  return out;
}

module.exports = { start, report, disqualify, pendingMatches, describe, buildFirstRound, settle, nextPow2 };
