'use strict';
// Rarity je physischer Kartenkopie: Identitätsverfolgung über Zonenwechsel (cards/effects/_rarity-track.js, Hinweise in _engine.js).
// Deck mit mehreren gleichnamigen Kopien verschiedener Rarity; Hand → Brett → Ablage → Hand zurück; die Rarity bleibt an der Kopie.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../cards/effects/_engine');
const RT = require('../cards/effects/_rarity-track');
const R = require('../rarities');

function spieler(name, deck, rarities) {
  const d = { mainDeck: deck.main || [], potionDeck: [], sideDeck: deck.side || [], heroes: deck.heroes || [] };
  const r = R.normalizeDeckRarities(d, rarities);
  return {
    username: name, hand: [], mainDeck: (deck.main || []).slice(), potionDeck: [], sideDeck: (deck.side || []).slice(),
    discardPile: [], deletedPile: [], creationZone: [], coolnessStack: [], permanents: [],
    heroes: (deck.heroes || []).map(h => ({ name: h.hero })),
    abilityZones: (deck.heroes || []).map(h => { const z = [[], [], []]; if (h.ability1) z[0] = [h.ability1]; if (h.ability2) z[1] = [h.ability2]; return z; }),
    supportZones: [[[], [], []], [[], [], []], [[], [], []]], surpriseZones: [[], [], []],
    rarityLedger: R.deckLedger(d, r), rarityZones: R.deckZoneInfo(d, r),
  };
}

function spiel(p0, p1) {
  const gs = { turn: 1, activePlayer: 0, currentPhase: 2, log: [], areaZones: [[], []], players: [p0, p1 || spieler('B', { main: [] }, {})] };
  const e = new GameEngine({ gameState: gs }, null, () => {});
  for (let i = 0; i < gs.players.length; i++) { e._installHandRevealInterceptor(i); e._geloeschtVerfolgen(i); e._ablageVerfolgen(i); }
  RT.reconcile(gs);
  return { gs, e };
}
const sicht = (gs, pi) => {
  const ps = gs.players[pi];
  RT.reconcile(gs);
  return RT.annotate(ps, { heroes: ps.heroes, abilityZones: ps.abilityZones, supportZones: ps.supportZones, surpriseZones: ps.surpriseZones, hand: ps.hand,
    creationZone: ps.creationZone, coolnessStack: ps.coolnessStack, discardPile: ps.discardPile, deletedPile: ps.deletedPile, permanents: ps.permanents }, gs.areaZones[pi]);
};
const zeile = (gs, pi, zone) => (sicht(gs, pi) || {})[zone] || [];

const DECK = { main: ['Fireball', 'Fireball', 'Ice', 'Fireball'], heroes: [{ hero: 'Alice', ability1: 'Fighting', ability2: 'Fighting' }, { hero: 'Bob' }, { hero: 'Cara' }] };
const RAR = { main: ['super', 'common', 'rare', 'diamond'], heroes: [{ hero: 'prismatic', ability1: 'rare', ability2: 'uncommon' }, {}, {}] };

function ziehe(gs, pi, n) { const ps = gs.players[pi]; for (let i = 0; i < n; i++) ps.hand.push(ps.mainDeck.shift()); }

test('Startzuordnung: Helden/Fähigkeiten exakt, Deckkopien nach Mehrfachmenge', () => {
  const { gs } = spiel(spieler('A', DECK, RAR));
  const r = sicht(gs, 0);
  assert.equal(r.heroes[0], 'prismatic');
  assert.equal(r.abilityZones[0][0][0], 'rare');
  assert.equal(r.abilityZones[0][1][0], 'uncommon');
  const z = gs.players[0].rarityShadow.z.md;
  assert.deepEqual(z.r.filter((x, i) => z.n[i] === 'Fireball').sort(), ['common', 'diamond', 'super'].sort().map(x => (x === 'common' ? null : x)).sort());
  assert.equal(z.r[z.n.indexOf('Ice')], 'rare');
});

test('Ziehen: die gezogene Kopie bringt die Rarity der Decksspitze mit', () => {
  for (let k = 0; k < 20; k++) {
    const { gs } = spiel(spieler('A', DECK, RAR));
    const z = gs.players[0].rarityShadow.z.md;
    const erwartet = z.r.slice(0, 2).map(x => x || null);
    ziehe(gs, 0, 2);
    assert.deepEqual(zeile(gs, 0, 'hand'), erwartet);
    assert.equal(gs.players[0].rarityShadow.z.md.n.length, 2);
  }
});

test('Hand → Brett → Ablage → Hand: jede Kopie behält ihre Rarity (Spiel von Index 0 und von Index 1)', () => {
  for (const idx of [0, 1]) {
    const { gs } = spiel(spieler('A', { main: ['Fireball', 'Fireball'], heroes: DECK.heroes }, { main: ['super', 'common'], heroes: RAR.heroes }));
    const ps = gs.players[0];
    ps.hand.push('Fireball', 'Fireball');
    // Reihenfolge der Kopien in der Hand festlegen: [super, common]
    const sh = ps.rarityShadow.z.hand;
    sh.n = ['Fireball', 'Fireball']; sh.r = ['super', null];
    ps.rarityShadow.z.md.n = []; ps.rarityShadow.z.md.r = []; ps.mainDeck.length = 0;
    assert.deepEqual(zeile(gs, 0, 'hand'), ['super', null]);
    const gespielt = idx === 0 ? 'super' : null;
    const bleibt = idx === 0 ? null : 'super';
    // Brett (Support-Zone 0/0): erst auf das Brett, dann aus der Hand (Skripte tun beides in beiden Reihenfolgen)
    if (idx === 0) { ps.supportZones[0][0].push('Fireball'); ps.hand.splice(0, 1); } else { ps.hand.splice(1, 1); ps.supportZones[0][0].push('Fireball'); }
    assert.deepEqual(zeile(gs, 0, 'hand'), [bleibt]);
    assert.equal(sicht(gs, 0).supportZones[0][0][0], gespielt);
    // Brett → Ablage
    ps.supportZones[0][0].length = 0; ps.discardPile.push('Fireball');
    assert.deepEqual(zeile(gs, 0, 'discardPile'), [gespielt]);
    assert.deepEqual(zeile(gs, 0, 'hand'), [bleibt]);
    // zweite Kopie ebenfalls ablegen, dann aus der Ablage (per Index) zurück auf die Hand
    ps.hand.splice(0, 1); ps.discardPile.push('Fireball');
    assert.deepEqual(zeile(gs, 0, 'discardPile'), [gespielt, bleibt]);
    ps.discardPile.splice(0, 1); ps.hand.push('Fireball');
    assert.deepEqual(zeile(gs, 0, 'hand'), [gespielt]);
    assert.deepEqual(zeile(gs, 0, 'discardPile'), [bleibt]);
    // Ablage → Gelöscht-Stapel (pop), dann zurück
    ps.discardPile.pop(); ps.deletedPile.push('Fireball');
    assert.deepEqual(zeile(gs, 0, 'deletedPile'), [bleibt]);
    assert.deepEqual(zeile(gs, 0, 'discardPile'), []);
  }
});

test('Zwei gleichnamige Kopien in der Ablage: die per Index entnommene behält ihre Rarity', () => {
  const { gs } = spiel(spieler('A', { main: [], heroes: DECK.heroes }, { heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.discardPile.push('Ice', 'Ice', 'Ice');
  const z = ps.rarityShadow.z; RT.reconcile(gs);
  z.dp.r = ['super', 'rare', null];
  ps.discardPile.splice(1, 1); ps.hand.push('Ice');
  assert.deepEqual(zeile(gs, 0, 'hand'), ['rare']);
  assert.deepEqual(zeile(gs, 0, 'discardPile'), ['super', null]);
  ps.discardPile.shift(); ps.hand.push('Ice');
  assert.deepEqual(zeile(gs, 0, 'hand'), ['rare', 'super']);
});

test('Umsortieren der Hand: die Rarity folgt der Kopie', () => {
  const { gs } = spiel(spieler('A', { main: [], heroes: DECK.heroes }, { heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.hand.push('Ice', 'Fire', 'Ice');
  RT.reconcile(gs);
  const z = ps.rarityShadow.z.hand; z.r = ['super', null, 'rare'];
  const map = [2, 0, 1];   // neu[i] = alt[map[i]]
  RT.permute(gs, 0, 'hand', map);
  ps.hand = map.map(i => ps.hand[i]);
  assert.deepEqual(zeile(gs, 0, 'hand'), ['rare', 'super', null]);
});

test('Kopien tauchen aus dem Nichts auf (Token, erschaffene Kopie): Common; die echten Kopien bleiben unberührt', () => {
  const { gs } = spiel(spieler('A', { main: ['Fireball'], heroes: DECK.heroes }, { main: ['super'], heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.hand.push(ps.mainDeck.shift());
  assert.deepEqual(zeile(gs, 0, 'hand'), ['super']);
  ps.supportZones[1][1].push('Fireball');   // Kopie aus dem Nichts
  assert.equal(sicht(gs, 0).supportZones[1][1][0], null);
  // auch nach weiteren Abgleichen bleibt sie Common und die Handkarte Super
  ps.hand.push('Ice'); RT.reconcile(gs); RT.reconcile(gs); RT.reconcile(gs);
  assert.equal(sicht(gs, 0).hand[0], 'super');
  assert.equal(sicht(gs, 0).supportZones[1][1][0], null);
});

test('Karte in Auflösung (zwischen Hand und Ablage unterwegs) behält ihre Rarity über mehrere Abgleiche', () => {
  const { gs } = spiel(spieler('A', { main: [], heroes: DECK.heroes }, { heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.hand.push('Fireball', 'Fireball'); RT.reconcile(gs);
  ps.rarityShadow.z.hand.r = ['super', 'rare'];
  ps.hand.splice(1, 1);                       // 'rare' wird gespielt, steht in keiner Zone
  RT.reconcile(gs); RT.reconcile(gs);
  ps.discardPile.push('Fireball');
  assert.deepEqual(zeile(gs, 0, 'discardPile'), ['rare']);
  assert.deepEqual(zeile(gs, 0, 'hand'), ['super']);
});

test('Diebstahl: die Karte behält ihre Rarity beim anderen Spieler', () => {
  const a = spieler('A', { main: [], heroes: DECK.heroes }, { heroes: RAR.heroes });
  const b = spieler('B', { main: ['Ice'], heroes: DECK.heroes }, { main: ['umbra'], heroes: RAR.heroes });
  const { gs } = spiel(a, b);
  gs.players[1].hand.push(gs.players[1].mainDeck.shift());
  assert.deepEqual(zeile(gs, 1, 'hand'), ['umbra']);
  gs.players[1].hand.splice(0, 1); gs.players[0].hand.push('Ice');
  assert.deepEqual(zeile(gs, 0, 'hand'), ['umbra']);
});

test('Gegner-Sicht: verdeckte Karten bleiben Common, Namen müssen übereinstimmen', () => {
  const { gs } = spiel(spieler('A', { main: ['Fireball'], heroes: DECK.heroes }, { main: ['super'], heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.hand.push(ps.mainDeck.shift()); ps.supportZones[0][0].push('Fireball');
  RT.reconcile(gs);
  const pv = { heroes: ps.heroes, abilityZones: ps.abilityZones, supportZones: [[['?'], [], []], [[], [], []], [[], [], []]], hand: [], surpriseZones: [[], [], []] };
  const r = RT.annotate(ps, pv, []);
  assert.equal(r.supportZones[0][0][0], null);
  assert.equal(r.heroes[0], 'prismatic');
});

test('Simulation (MCTS/fastMode): Hinweise ändern nichts', () => {
  const { gs, e } = spiel(spieler('A', { main: [], heroes: DECK.heroes }, { heroes: RAR.heroes }));
  const ps = gs.players[0];
  ps.hand.push('Ice', 'Ice'); RT.reconcile(gs);
  ps.rarityShadow.z.hand.r = ['super', 'rare'];
  e._fastMode = true;
  ps.hand.splice(0, 1);
  e._fastMode = false;
  assert.equal(ps.rarityShadow.limbo.length, 0);
});

test('Spieler ohne Rarities: kein Schattenzustand, keine Kosten', () => {
  const { gs } = spiel(spieler('A', { main: ['Fireball'], heroes: DECK.heroes }, {}));
  assert.equal(gs.players[0].rarityLedger, null);
  assert.equal(gs.players[0].rarityShadow, undefined);
  gs.players[0].hand.push('Fireball'); gs.players[0].hand.splice(0, 1);
  assert.equal(gs.players[0].rarityShadow, undefined);
});
