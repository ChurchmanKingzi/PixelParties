'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { rankFor, desiredRoleNames, managedRoleDefs } = require('../lib/roles-logic');
const cfg = { skinCollectorMin: 50, veteranGames: 300 };

test('Rang-Stufen wie im Spiel', () => {
  const cases = [[0, 'Bronze'], [1000, 'Bronze'], [1199, 'Bronze'], [1200, 'Silver'], [1399, 'Silver'], [1400, 'Gold'], [1600, 'Platinum'],
    [1800, 'Diamond'], [2000, 'Master'], [2200, 'Grandmaster'], [3000, 'Grandmaster']];
  for (const [elo, name] of cases) assert.equal(rankFor(elo).name, name, 'elo ' + elo);
});

test('Skin Collector ab 50, Erfolge nach Rangliste', () => {
  const base = { elo: 1500, skins: 49, wins: 10, losses: 5, leaderboardRank: null };
  assert.deepEqual(desiredRoleNames(base, cfg), ['Gold']);
  assert.deepEqual(desiredRoleNames({ ...base, skins: 50 }, cfg), ['Gold', 'Skin Collector']);
  assert.deepEqual(desiredRoleNames({ ...base, leaderboardRank: 7 }, cfg), ['Gold', 'Top 10']);
  assert.deepEqual(desiredRoleNames({ ...base, leaderboardRank: 1, wins: 200, losses: 100 }, cfg), ['Gold', 'Veteran', 'Top 10', 'Champion']);
});

test('verwaltete Rollen: 7 Ränge + Erfolge, Namen eindeutig', () => {
  const defs = managedRoleDefs(cfg);
  assert.equal(defs.filter(d => d.kind === 'rank').length, 7);
  assert.equal(new Set(defs.map(d => d.name.toLowerCase())).size, defs.length);
});
