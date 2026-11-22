'use strict';
// Aufladen vor dem Dash (public/app-fx-68.jsx): das Ramm-Ereignis eines HELDEN trägt `lade`, die nächste Wartezeit (`_delay`) wächst um genau diese Zeit.
// Dazu: `hero_cast` beim Commit der Karte (Held-Pose, nur Optik).
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../cards/effects/_engine');

function engine() {
  const e = Object.create(GameEngine.prototype);
  Object.assign(e, { gs: { turn: 1, players: [{ socketId: 's0' }, { socketId: 's1' }] }, _fastMode: false, _aborted: false });
  return e;
}
const held = (o = {}) => ({ sourceOwner: 0, sourceHeroIdx: 1, targetOwner: 1, targetHeroIdx: 1, duration: 600, ...o });

test('Ramm-Ereignis eines Helden bekommt `lade` (8 Bilder) und die nächste Wartezeit wächst darum — genau einmal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const e = engine();
  const d = e._rammLadenAnmelden(held());
  assert.equal(d.lade, 267);
  assert.equal(e._rammLadeSchuld, 267);
  let fertig = false;
  const p = e._delay(100).then(() => { fertig = true; });
  t.mock.timers.tick(366); await Promise.resolve();
  assert.equal(fertig, false, '100 ms + 267 ms Ladezeit');
  t.mock.timers.tick(2); await p;
  assert.equal(fertig, true);
  assert.equal(e._rammLadeSchuld, 0, 'Schuld ist eingelöst');
  let zweite = false; const p2 = e._delay(50).then(() => { zweite = true; });
  t.mock.timers.tick(50); await p2;
  assert.equal(zweite, true, 'die nächste Wartezeit ist normal');
});

test('kein Aufladen: Kreatur als Rammer, Rückwärtsrammen, Jetpack/fire_stars, ausdrücklich lade: 0', () => {
  for (const ev of [held({ sourceZoneSlot: 2 }), held({ rueckwaerts: true }), held({ trailType: 'fire' }), held({ trailType: 'fire_stars' }), held({ lade: 0 })]) {
    const e = engine();
    const d = e._rammLadenAnmelden(ev);
    assert.ok(!d.lade, JSON.stringify(ev));
    assert.ok(!e._rammLadeSchuld, 'keine Schuld ' + JSON.stringify(ev));
  }
});

test('Folgedash derselben Figur binnen 1,8 s lädt nicht neu (Whirlwind Strike); andere Figur oder später schon', () => {
  const e = engine();
  assert.equal(e._rammLadenAnmelden(held()).lade, 267);
  e._rammLadeSchuld = 0;
  assert.equal(e._rammLadenAnmelden(held({ targetHeroIdx: 2 })).lade, 0, 'zweites Ziel derselben Figur: Serie');
  assert.ok(!e._rammLadeSchuld);
  assert.equal(e._rammLadenAnmelden(held({ sourceHeroIdx: 2 })).lade, 267, 'andere Figur lädt');
  e._rammLadeSchuld = 0;
  e._rammLadeLetzte.set('0:1', Date.now() - 2000);
  assert.equal(e._rammLadenAnmelden(held()).lade, 267, 'nach 2 s wieder ein neuer Angriff');
});

test('`hero_cast` beim Commit: nur mit `wirker` (Spell/Attack/Fähigkeit), mit Held und Art', () => {
  for (const [pend, erwartet] of [[{ cardName: 'Heal', ownerIdx: 0, wirker: { owner: 0, heroIdx: 1, art: 'spell' } }, { owner: 0, heroIdx: 1, art: 'spell' }], [{ cardName: 'Cute Cat', ownerIdx: 0 }, null]]) {
    const e = engine();
    const gesendet = [];
    Object.assign(e, { room: { spectators: [] }, io: { to: () => ({ emit() {} }) }, playerCount: () => 2, _feuereZusageAuftritte() {}, _firePendingPlayLog() {}, _fuehreCommitAktionenAus() {}, _auftrittAusliefern() {},
      _broadcastEvent: (ev, data) => gesendet.push([ev, data]) });
    e.gs._pendingCardReveal = pend; e.gs.currentPhase = 3; e.gs.activePlayer = 0;
    e._firePendingCardReveal();
    const cast = gesendet.find(([ev]) => ev === 'hero_cast');
    if (erwartet) assert.deepEqual(cast && cast[1], erwartet); else assert.equal(cast, undefined);
  }
});
