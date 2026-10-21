'use strict';
// W39a · Leser-Tabelle der Test-Matrix (siehe `_matrix.js`). Jeder Eintrag beschreibt EINE Karte, die „Attack" als Auslöser/Bedingung liest, samt Aufbau und Messung.
// Messung `ok(r, b, k)`: r = Szene mit Leser, b = Baseline ohne Leser (nur bei `vergleich`), k = { me, op, as, vs, held, ziel, zielHeld }.
const L = require('./_helfer.js');
const { H, setzeFrei, gefragt, posHero } = L;
const A = (t, k) => t.hero(k.as, k.held);
const V = (t, k) => t.hero(k.vs, k.zielHeld);
const ZIEL = (r) => r.k.ziel === 'creature' ? r.t.opferKreatur : null;
const hatStatus = (r, s) => r.k.ziel === 'creature' ? !!(r.t.opferKreatur.counters?.[s] || r.t.opferKreatur.statuses?.[s]) : !!V(r.t, r.k).statuses?.[s];

/** Ausrüstung am schlagenden Helden: `name` im ersten freien Slot; `onPlay` ruft den Platzier-Hook (Ausrüstung mit Heldenmarken). */
async function ruesteAus(t, k, name, o = {}) {
  const inst = setzeFrei(t, k.as, k.held, name);
  if (o.onPlay) await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: name, zone: 'support', heroIdx: k.held, _skipReactionCheck: true }));
  return inst;
}
const equip = (name, o = {}) => async (t, k, mit) => { if (mit) await ruesteAus(t, k, name, o); };

const EQUIPS = [
  { id: 'Blade of the Frostbringer', art: 'equip', liest: 'attack', vorbereiten: equip('Blade of the Frostbringer'), ok: (r) => hatStatus(r, 'frozen') },
  { id: 'Blade of the Swamp Witch', art: 'equip', liest: 'attack', vorbereiten: equip('Blade of the Swamp Witch'),
    ok: (r) => r.k.ziel === 'creature' ? !!(r.t.opferKreatur.counters?.poisonStacks || r.t.opferKreatur.counters?.poisoned || r.t.opferKreatur.statuses?.poisoned) : !!V(r.t, r.k).statuses?.poisoned },
  { id: 'The Sun Sword', art: 'equip', liest: 'attack', vorbereiten: equip('The Sun Sword'), ok: (r) => hatStatus(r, 'burned') },
  { id: "Explosivo's Sword", art: 'equip', liest: 'attack', kreaturHp: 30, ohneTreiber: [],
    vorbereiten: async (t, k, mit) => { if (k.ziel === 'hero') V(t, k).hp = 40; if (mit) await ruesteAus(t, k, "Explosivo's Sword"); },
    ok: (r) => r.k.ziel === 'hero' ? r.schadenHeld1 >= 100 : r.t.hp(r.k.vs, 0) <= 700 },
  { id: 'Vampiric Sword', art: 'equip', liest: 'attack', vergleich: true,
    vorbereiten: async (t, k, mit) => { A(t, k).hp = 500; if (mit) await ruesteAus(t, k, 'Vampiric Sword'); },
    ok: (r, b, k) => A(r.t, k).hp > A(b.t, k).hp },
  { id: 'Warhorse', art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'], vorbereiten: equip('Warhorse'), ok: (r, b) => plus(r, b, 50) },
  { id: "The Master's Sword", art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'], vorbereiten: equip("The Master's Sword"), ok: (r, b) => r.dmg > b.dmg },
  { id: 'Glass Sword', art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'], vorbereiten: equip('Glass Sword'),
    ok: (r, b) => r.dmg === b.dmg + 50 && r.t.pile(r.k.as, 'discardPile').includes('Glass Sword') },
  { id: 'Sacred Hammer of the Volcano', art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { if (k.ziel === 'creature') t.opferKreatur.counters.burned = 1; else V(t, k).statuses.burned = { appliedTurn: 0 }; if (mit) await ruesteAus(t, k, 'Sacred Hammer of the Volcano'); },
    ok: (r, b) => r.dmg > b.dmg },
  { id: 'Super-Killing Knife, the Tool of Liquidation', art: 'equip', liest: 'attack', ziele: ['creature'], ohneTreiber: ['Kohta'], kreaturHp: 400,
    vorbereiten: equip('Super-Killing Knife, the Tool of Liquidation'), ok: (r) => r.kreaturTot === true },
];
/** Schadenszuschlag: Duel hat bis zu 3 Schläge (der Zuschlag gilt je Schlag), sonst genau `n`. */
const plus = (r, b, n) => r.k.mehrfach ? r.dmg > b.dmg : r.dmg === b.dmg + n;
const handN = (r, seat) => r.t.gs.players[seat].hand.length;
const hatIn = (r, seat, pile, name) => r.t.gs.players[seat][pile].includes(name);
const zaehleInst = (r, seat, name) => r.t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat && c.name === name).length;

const EQUIPS2 = [
  { id: 'Earth-Shattering Hammer, Relic of Deri', art: 'equip', liest: 'attack', ziele: ['hero'], ohneTreiber: ['Kohta', 'Duel'],
    vorbereiten: async (t, k, mit) => { t.put(k.vs, k.zielHeld, 0, H.INERT.artifact); if (mit) await ruesteAus(t, k, 'Earth-Shattering Hammer, Relic of Deri'); },
    ok: (r) => r.t.zone(r.k.vs, r.k.zielHeld, 0) === null },
  { id: 'The Hands of Big Gwen', art: 'equip', liest: 'attack', vergleich: true, discard: undefined,
    vorbereiten: async (t, k, mit) => { t.gs.players[k.as].discardPile.push('ZZ Trinket'); if (mit) await ruesteAus(t, k, 'The Hands of Big Gwen'); },
    ok: (r, b, k) => r.t.gs.players[k.as].hand.includes('ZZ Trinket') && !b.t.gs.players[k.as].hand.includes('ZZ Trinket') },
  { id: "Skullmael's Greatsword", art: 'equip', liest: 'attack', kreaturHp: 30,
    vorbereiten: async (t, k, mit) => { if (k.ziel === 'hero') V(t, k).hp = 40; t.gs.players[k.as].discardPile.push('ZZ Dummy Big'); if (mit) await ruesteAus(t, k, "Skullmael's Greatsword"); },
    ok: (r, b, k) => zaehleInst(r, k.as, 'ZZ Dummy Big') > 0 },
  { id: 'Future Tech Bazooka', art: 'equip', liest: 'attack', kreaturHp: 30, wahlExtra: true,
    vorbereiten: async (t, k, mit) => {
      if (k.ziel === 'hero') V(t, k).hp = 40;
      t.gs.players[k.as].discardPile.push('Future Tech Bazooka');
      const e = t.put(k.vs, 2, 0, H.INERT.creature); e.turnPlayed = 1; e.counters.currentHp = 400; e.counters.maxHp = 400; t.extra = e;
      if (mit) await ruesteAus(t, k, 'Future Tech Bazooka');
    },
    waehle: (v, cfg, k, t) => (cfg && cfg.title === 'Future Tech Bazooka') ? [(v.find(x => x.cardInstance === t.extra) || v.find(x => x.type === 'equip' && x.owner === k.vs && x.heroIdx === 2) || v[0]).id] : undefined,
    ok: (r) => (r.t.extra.counters.currentHp ?? 0) <= 300 },
  { id: 'Legendary Sword of a Barbarian King', art: 'equip', liest: 'attack', meHand: undefined,
    script: [{ match: d => d && d.type === 'heroAction', answer: (d, pi, t) => ({ cardName: 'ZZ Dummy Big', handIndex: t.pile(pi, 'hand').indexOf('ZZ Dummy Big'), heroIdx: d.heroIdx, zoneSlot: t.gs.players[d.heroOwner ?? pi].supportZones[d.heroIdx].findIndex(z => !z.length) }) }],
    vorbereiten: async (t, k, mit) => { t.gs.players[k.as].hand.push('ZZ Dummy Big'); t.engine._trackCard('ZZ Dummy Big', k.as, 'hand'); if (mit) await ruesteAus(t, k, 'Legendary Sword of a Barbarian King', { onPlay: true }); },
    ok: (r, b, k) => zaehleInst(r, k.as, 'ZZ Dummy Big') > 0 },
  { id: 'Heart-Shaped Bow, the Final Proof of Cuteness', art: 'equip', liest: 'attack', ohneTreiber: ['Siphem', 'Alice'],
    script: [{ match: d => d && d.type === 'heroAction', answer: (d, pi, t) => ({ cardName: 'Love Shot', handIndex: t.pile(pi, 'hand').indexOf('Love Shot'), heroIdx: d.heroIdx }) }],
    vorbereiten: async (t, k, mit) => { t.gs.players[k.as].hand.push('Love Shot'); t.engine._trackCard('Love Shot', k.as, 'hand'); t.grantFor(k.as, k.held, 'Love Shot'); if (mit) await ruesteAus(t, k, 'Heart-Shaped Bow, the Final Proof of Cuteness', { onPlay: true }); },
    ok: (r, b, k) => !r.t.gs.players[k.as].hand.includes('Love Shot') },
  { id: "The Brewer's Blade", art: 'equip', liest: 'attack', potionDeck: [['Elixir of Strength'], ['Elixir of Strength']],
    vorbereiten: equip("The Brewer's Blade"), ok: (r, b, k) => r.t.gs.players[k.as].hand.includes('Elixir of Strength') },
  { id: 'Shattered Trident, Treasure of the Deepsea', art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: equip('Shattered Trident, Treasure of the Deepsea'), ok: (r, b) => r.dmg > b.dmg },
  { id: 'Phalanx Pike', art: 'equip', liest: 'attack', ziele: ['hero'], ohneTreiber: ['Kohta', 'Siphem', 'Alice'],
    vorbereiten: async (t, k, mit) => { t.putSurprise(k.vs, k.zielHeld, 'Flooding'); t.grantFor(k.vs, k.zielHeld, 'Flooding'); if (mit) await ruesteAus(t, k, 'Phalanx Pike', { onPlay: true }); },
    ok: (r) => r.schaden > 0 },
  { id: 'Heart of Ice (Träger wird getroffen)', art: 'equip', liest: 'attack', ziele: ['hero'],
    vorbereiten: async (t, k, mit) => { const inst = t.put(k.vs, k.zielHeld, 0, 'Heart of Ice'); await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: 'Heart of Ice', zone: 'support', heroIdx: k.zielHeld, _skipReactionCheck: true })); },
    ok: (r, b, k) => !!A(r.t, k).statuses?.frozen },
  { id: 'Heart of Ice (Träger stirbt)', art: 'equip', liest: 'attack', ziele: ['hero'],
    vorbereiten: async (t, k, mit) => { V(t, k).hp = 40; const inst = t.put(k.vs, k.zielHeld, 0, 'Heart of Ice'); await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: 'Heart of Ice', zone: 'support', heroIdx: k.zielHeld, _skipReactionCheck: true })); },
    ok: (r, b, k) => !!A(r.t, k).statuses?.frozen },
];
const HELDEN = [];
function heldLeser(id, heldName, o) { HELDEN.push({ id, art: 'held', liest: 'attack', freierHeld: true, ...o, heldName, vorbereiten: async (t, k, mit) => { if (mit) setzeHeld(t, k, heldName); if (o.aufbau) await o.aufbau(t, k, mit); } }); }
function setzeHeld(t, k, name) { t.setHero(k.as, k.held, name, 800); const h = t.hero(k.as, k.held); h.atk = 100; h.baseAtk = 100; }
heldLeser('Nieht, the Blitz Blade', 'Nieht, the Blitz Blade', { vergleich: true, ohneTreiber: [], ok: (r, b, k) => handN(r, k.as) === handN(b, k.as) + 1 });
heldLeser('Reiza, the Chief Tormentor', 'Reiza, the Chief Tormentor', { ohneTreiber: ['Kohta'], ok: (r) => r.k.ziel === 'creature' ? !!(r.t.opferKreatur.counters?.stunned || r.t.opferKreatur.statuses?.stunned) && !!(r.t.opferKreatur.counters?.poisonStacks || r.t.opferKreatur.statuses?.poisoned) : !!(V(r.t, r.k).statuses?.stunned && V(r.t, r.k).statuses?.poisoned) });
heldLeser('Xiong, the Bamboo Guardian', 'Xiong, the Bamboo Guardian', { kreaturHp: 30, script: [{ match: d => d && d.type === 'cardGallery' && d.title === 'Xiong, the Bamboo Guardian', answer: () => ({ cardName: 'ZZ Trinket' }) }], aufbau: async (t, k, mit) => { if (k.ziel === 'hero') V(t, k).hp = 40; t.gs.players[k.vs].discardPile.push('ZZ Trinket'); t.gs.players[k.as].discardPile.push('ZZ Trinket'); }, ok: (r, b, k) => hatIn(r, k.as, 'hand', 'ZZ Trinket') });
heldLeser('Devlin, the Masked Butcher', 'Devlin, the Masked Butcher', { ohneTreiber: ['Kohta'], ok: (r) => r.k.ziel === 'creature' ? !!r.t.opferKreatur.counters?.bleeding : !!V(r.t, r.k).statuses?.bleeding });
heldLeser('Null, the Mage Slayer', 'Null, the Mage Slayer', { ohneTreiber: ['Kohta'], ok: (r) => r.k.ziel === 'creature' ? !!(r.t.opferKreatur.counters?.negated) : !!V(r.t, r.k).statuses?.negated });
heldLeser('Don Quisto, the Gold Seeker', 'Don Quisto, the Gold Seeker', { kreaturHp: 30, aufbau: async (t, k, mit) => { t.setGold(k.as, 100); if (k.ziel === 'hero') V(t, k).hp = 40; }, ok: (r, b, k) => r.t.gs.players[k.as].gold !== 100 });
heldLeser('Bow Sniper Darge', 'Bow Sniper Darge', { vergleich: true, attHand: ['Angelfeather Arrow'], ohneTreiber: ['Kohta'], aufbau: async (t, k) => { t.grantFor(k.as, k.held, 'Angelfeather Arrow'); }, ok: (r, b) => plus(r, b, 50) });
heldLeser('Cute Angel Molinda', 'Cute Angel Molinda', { ziele: ['creature'], ohneTreiber: ['Kohta'], ok: (r, b, k) => !!r.t.opferKreatur && (r.t.opferKreatur.controller ?? r.t.opferKreatur.owner) === k.as && r.t.opferKreatur.zone === 'support' });
heldLeser('Great Detective Doq', 'Great Detective Doq', { vergleich: true, script: [{ match: d => d && d.type === 'optionPicker' && d.title === 'Great Detective Doq', answer: () => ({ optionId: 'action' }) }], vicHand: ['ZZ Dummy'], ohneTreiber: ['Kohta'], ok: (r, b, k) => r.dmg === b.dmg + 150 || handN(r, k.as) >= handN(b, k.as) + 2 });
heldLeser('Güldefaber, the King of Dwarfs', 'Güldefaber, the King of Dwarfs', { liest: 'attackOderSpell', vergleich: true, ok: (r, b, k) => r.t.gs.players[k.as].gold === b.t.gs.players[k.as].gold + 10 });
heldLeser('Thorad, Strength of Coolness', 'Thorad, Strength of Coolness', { liest: 'attackOderSpell', vergleich: true, ohneTreiber: ['Kohta'], aufbau: async (t, k, mit) => { t.gs.players[k.as].coolnessStack = ['ZZ Trinket', 'ZZ Trinket']; }, ok: (r, b) => plus(r, b, 80) });
heldLeser("Zsos'Ssar, the Serpent Warlord", "Zsos'Ssar, the Serpent Warlord", { liest: 'attackOderSpell', vergleich: true, ohneTreiber: ['Kohta'], aufbau: async (t, k, mit) => { t.heroStatus(k.vs, 2, 'poisoned', { stacks: 1 }); }, ok: (r, b) => plus(r, b, 40) });
heldLeser('Taio, the Sun Fencer (Kill-Marke)', 'Taio, the Sun Fencer', { ziele: ['hero'], aufbau: async (t, k) => { V(t, k).hp = 40; }, ok: (r, b, k) => !!t_h(r, k)._taioKilledOppHero });
function t_h(r, k) { return r.t.hero(k.as, k.held); }
heldLeser('Santa Klaus', 'Santa Klaus', { liest: 'attackOderSpell', vergleich: true, attHand: ['ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ok: (r, b, k) => handN(r, k.vs) === handN(b, k.vs) + 2 });
heldLeser('Ghuanjun, the Undead Martial Artist', 'Ghuanjun, the Undead Martial Artist', { kreaturHp: 30, aufbau: async (t, k) => { if (k.ziel === 'hero') V(t, k).hp = 40; }, ok: (r) => r.k.ziel === 'creature' ? !r.kreaturTot : r.t.hp(r.k.vs, r.k.zielHeld) === 1 });
heldLeser('Sorin, the Warden of Blood Rock', 'Sorin, the Warden of Blood Rock', { ohneTreiber: ['Kohta'], vergleich: true, ok: (r, b) => b.schaden > 0 && r.schaden === 0 });

// ───────────── Teil 3: Kreaturen, Flächen, Schutz, Pfeile/Topaz, Hand-Reaktionen, Surprises ─────────────
const EQUIPS3 = [
  { id: 'Club of Gobbo', art: 'equip', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => {
      if (k.ziel === 'creature') t.engine._grantOneShotDamageShield('creature', t.opferKreatur, 80, 'Aquatic Shield', k.vs); else t.engine._grantOneShotDamageShield('hero', V(t, k), 80, 'Aquatic Shield', k.vs);
      if (mit) await ruesteAus(t, k, 'Club of Gobbo');
    }, ok: (r, b) => r.schaden > b.schaden },
  { id: 'Idej Sword - Kunagi', art: 'equip', liest: 'attack', ziele: ['creature'], kreaturHp: 30, vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: equip('Idej Sword - Kunagi'), ok: (r, b, k) => handN(r, k.as) > handN(b, k.as) },
  { id: 'Idej Sword - Onima', art: 'equip', liest: 'attack', ziele: ['hero'], ohneTreiber: ['Kohta', 'Duel'],
    vorbereiten: async (t, k, mit) => { t.setAbilities(k.vs, k.zielHeld, [['Fighting'], ['Toughness'], []]); if (mit) await ruesteAus(t, k, 'Idej Sword - Onima'); },
    ok: (r, b, k) => handN(r, k.vs) >= 2 },
  { id: 'Bow of the Hunt Goddess', art: 'equip', liest: 'attack', deck: [['Angelfeather Arrow', 'Flame Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], ['Angelfeather Arrow', 'Flame Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']], script: [{ match: d => d && d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name, source: 'deck' }), once: true }], ohneTreiber: ['Siphem', 'Alice'],
    vorbereiten: equip('Bow of the Hunt Goddess'), ok: (r, b, k) => r.t.gs.players[k.as].discardPile.some(n => /Arrow/.test(n)) },
  { id: 'Future Tech Doomsday Bomb', art: 'equip', liest: 'attack', ziele: ['hero'], ohneTreiber: ['Siphem', 'Alice'],
    vorbereiten: async (t, k, mit) => { t.gs._deferGameOverCheck = true; if (mit) await ruesteAus(t, k, 'Future Tech Doomsday Bomb'); },
    ok: (r) => r.t.gs.players[r.k.as].discardPile.includes('Future Tech Doomsday Bomb') },
  { id: 'Truth-Seeing Eye', art: 'equip', liest: 'attack', ziele: ['hero'], ohneTreiber: ['Siphem', 'Alice', 'Kohta'],
    vorbereiten: async (t, k, mit) => { V(t, k).statuses.untargetable = true; if (mit) await ruesteAus(t, k, 'Truth-Seeing Eye'); },
    ok: (r) => r.schadenHeld > 0 },
  { id: 'Elixir of Strength (Buff)', art: 'sonst', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { if (mit) A(t, k).buffs = { empowered_strike: { stacks: 1 } }; },
    ok: (r, b, k) => r.dmg === b.dmg + 100 && !A(r.t, k).buffs?.empowered_strike },
  { id: 'Guardian Beast Niu (Buff)', art: 'sonst', liest: 'attack', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { if (mit) A(t, k).buffs = { niu_enhanced: { totalDamage: 50, stacks: 1 } }; },
    ok: (r, b, k) => r.dmg === b.dmg + 50 && !A(r.t, k).buffs?.niu_enhanced },
  { id: 'Elixir of Cold (Buff)', art: 'sonst', liest: 'attackOderSpell', ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { if (mit) A(t, k).buffs = { cold_strike: { label: 'Cold Strike' } }; },
    ok: (r) => hatStatus(r, 'frozen') },
];
const KREATUREN = [
  { id: 'Wavilion', art: 'kreatur', liest: 'attack', kreaturHp: 30, vergleich: true,
    vorbereiten: async (t, k, mit) => { if (k.ziel === 'hero') V(t, k).hp = 40; if (mit) setzeFrei(t, k.as, k.held, 'Wavilion').turnPlayed = 1; },
    ok: (r, b, k) => A(r.t, k).atk === A(b.t, k).atk + 100 || A(r.t, k).baseAtk === A(b.t, k).baseAtk + 100 },
  { id: 'Vinepire', art: 'kreatur', liest: 'attackOderSpell', vergleich: true, ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { A(t, k).hp = 500; if (mit) setzeFrei(t, k.as, k.held, 'Vinepire').turnPlayed = 1; },
    ok: (r, b, k) => A(r.t, k).hp > A(b.t, k).hp },
  { id: 'Gigantisaur Stegon (Opfer)', art: 'kreatur', liest: 'attackOderSpell', ziele: ['creature'], kreaturName: 'Gigantisaur Stegon', vicHand: ['ZZ Filler'], ohneTreiber: ['Kohta', 'Heragas'],
    vorbereiten: async () => {}, ok: (r, b, k) => A(r.t, k).hp < 800 },
  { id: 'Hardy Slime (erzwungene Zielwahl)', art: 'kreatur', liest: 'attackOderSpell', ziele: ['hero'], ohneTreiber: ['Siphem'],
    vorbereiten: async (t, k, mit) => { const s = t.put(k.vs, 2, 0, 'Hardy Slime'); s.turnPlayed = 1; s.counters.currentHp = 400; s.counters.maxHp = 400; s.counters.forcesTargeting = true; s.counters.forcesTargeting_pi = k.as; s.counters.forcesTargeting_untilTurn = t.gs.turn + 1; s.counters.buffs = { forcesTargeting: true }; t.slime = s; },
    ok: (r) => r.schadenHeld === 0 && ((r.t.slime.counters.currentHp ?? 400) < 400 || r.t.slime.zone !== 'support') },
  { id: 'Empty Armor (Umleitung)', art: 'kreatur', liest: 'attackOderSpell', ziele: ['hero'], ohneTreiber: ['Siphem', 'Kohta'],
    vorbereiten: async (t, k, mit) => { const s = t.put(k.vs, k.zielHeld, 0, 'Empty Armor'); s.turnPlayed = 1; s.counters.currentHp = 400; s.counters.maxHp = 400; t.armor = s; },
    ok: (r) => r.schadenHeld === 0 && ((r.t.armor.counters.currentHp ?? 400) < 400 || r.t.armor.zone !== 'support') },
];
const BRETT = [
  { id: 'Rioting Village (Rückstoß)', art: 'area', liest: 'attack', ohneTreiber: ['Kohta', 'Duel', 'Siphem', 'Alice'],
    vorbereiten: async (t, k, mit) => { t.putArea(k.vs, 'Rioting Village'); }, ok: (r, b, k) => A(r.t, k).hp < 800 },
  { id: 'Dark Ocean (Kreaturenschaden)', art: 'area', liest: 'attackOderSpell', ziele: ['creature'], ohneTreiber: ['Kohta'],
    vorbereiten: async (t, k, mit) => { t.putArea(k.vs, 'Dark Ocean'); }, ok: (r) => r.schaden > 0 },
  { id: 'Schutz: untargetable (Butterfly Cloud)', art: 'schutz', liest: 'attackOderSpell', ziele: ['hero'],
    vorbereiten: async (t, k, mit) => { V(t, k).statuses.untargetable = true; }, ok: (r) => r.schadenHeld === 0 && r.schadenHeld1 > 0 },
  { id: 'Schutz: invisible (Invisibility)', art: 'schutz', liest: 'attackOderSpell', ziele: ['hero'],
    vorbereiten: async (t, k, mit) => { V(t, k).statuses.invisible = true; }, ok: (r) => r.schadenHeld === 0 && r.schadenHeld1 > 0 },
];
KREATUREN.push({ id: 'Ghoul Guard (Opfer)', art: 'kreatur', liest: 'attackOderSpell', ziele: ['creature'], kreaturName: 'Ghoul Guard', kreaturHp: 30, ohneTreiber: ['Siphem'],
  vorbereiten: async () => {}, ok: (r, b, k) => [0, 1, 2].every(h => !!r.t.hero(k.as, h).statuses?.bleeding || !!r.t.hero(k.as, h).statuses?.bleed) });
const ATT_HAND = [];
function pfeil(id, o) { ATT_HAND.push({ id, art: 'reaktion', liest: 'attack', ohneTreiber: ['Siphem', 'Alice'], ...o, attHand: o.attHand || [id], vorbereiten: async (t, k, mit) => { if (o.aufbau) await o.aufbau(t, k, mit); } }); }
const gespielt = (id) => (r, b, k) => !r.t.gs.players[k.as].hand.includes(id);
pfeil('Angelfeather Arrow', { vergleich: true, ok: (r, b) => plus(r, b, 60), attHandBasis: [] , ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Magic Topaz', { vergleich: true, ok: (r, b) => plus(r, b, 60), attHandBasis: [], ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Bomb Arrow', { vergleich: true, ok: (r, b) => plus(r, b, 10), attHandBasis: [], ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Flame Arrow', { ok: (r) => hatStatus(r, 'burned'), ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Poisoned Arrow', { ok: (r) => r.k.ziel === 'creature' ? !!(r.t.opferKreatur.counters?.poisonStacks || r.t.opferKreatur.statuses?.poisoned) : !!V(r.t, r.k).statuses?.poisoned, ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil("Rainbow's Arrow", { vergleich: true, ok: (r, b) => plus(r, b, 10), attHandBasis: [], ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Golden Arrow', { ok: gespielt('Golden Arrow'), ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Hydra Blood Arrow', { ok: gespielt('Hydra Blood Arrow'), ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Racket Arrow', { ok: gespielt('Racket Arrow'), ziele: ['hero'], aufbau: async (t, k) => { const e = t.put(k.vs, 2, 0, H.INERT.creature); e.turnPlayed = 1; }, ohneTreiber: ['Siphem', 'Alice'] });
pfeil('Arrow Slit', { vergleich: true, attHand: ['Angelfeather Arrow', 'Arrow Slit'], attHandBasis: ['Angelfeather Arrow'], ok: (r, b) => plus(r, b, 60), ohneTreiber: ['Siphem', 'Alice', 'Kohta'] });
pfeil('Stealthy Pursuit', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Alice', 'Infected Greatmaw'], aufbau: async (t, k) => { t.grantFor(k.as, k.held, 'Stealthy Pursuit'); }, ok: (r) => gefragt(r.t, 'Stealthy Pursuit') >= 1 });
const VIC_HAND = [];
function reakt(id, o) { VIC_HAND.push({ id, art: 'reaktion', liest: 'attackOderSpell', ohneTreiber: ['Siphem'], ...o, vicHand: o.vicHand || [id], vorbereiten: async (t, k, mit) => { if (o.schule !== false && DBsch(id)) t.grantFor(k.vs, o.heldV ?? k.zielHeld, id); if (o.aufbau) await o.aufbau(t, k, mit); } }); }
const DBsch = (id) => { const c = H.DB[id]; return c && (c.cardType === 'Spell' || c.cardType === 'Attack'); };
reakt('Anti-Magnet', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Alice'], ok: (r) => r.schadenHeld === 0 && gefragt(r.t, 'Anti-Magnet') >= 1 });
reakt('Challenge', { ziele: ['hero'], zielHeld: 1, heldV: 0, ok: (r) => gefragt(r.t, 'Challenge') >= 1 });
reakt('Martyry', { ziele: ['hero'], zielHeld: 1, heldV: 0, ok: (r) => gefragt(r.t, 'Martyry') >= 1 });
reakt('Invisibility Cloak', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Kohta'], ok: (r) => r.schadenHeld === 0 && gefragt(r.t, 'Invisibility Cloak') >= 1 });
reakt('Fireshield', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Kohta'], ok: (r, b, k) => A(r.t, k).hp < 800 && gefragt(r.t, 'Fireshield') >= 1 });
reakt('Spiky Armor', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Alice', 'Kohta'], ok: (r, b, k) => A(r.t, k).hp < 800 });
reakt('Escape', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Kohta'], vorb: true, aufbau: async (t, k) => { V(t, k).hp = 40; }, vicHand: ['Escape', 'ZZ Filler'], ok: (r) => gefragt(r.t, 'Escape') >= 1 && (r.k.mehrfach || r.t.hp(r.k.vs, r.k.zielHeld) === 40) });
reakt('Zombified Assault', { ziele: ['creature'], kreaturHp: 30, ohneTreiber: ['Siphem'], heldV: 1, ok: (r) => gefragt(r.t, 'Zombified Assault') >= 1 });
reakt('Corpse Explosion', { ziele: ['creature'], kreaturHp: 30, ohneTreiber: ['Siphem'], heldV: 1, ok: (r) => gefragt(r.t, 'Corpse Explosion') >= 1 });
reakt('Future Tech Escape Device', { ziele: ['hero'], F: 0, ohneTreiber: ['Siphem', 'Alice'], ok: (r) => r.schadenHeld === 0 });
reakt('Test Flight', { ziele: ['hero'], ohneTreiber: ['Siphem'], aufbau: async (t, k) => { t.setAbilities(k.vs, k.zielHeld, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]); }, ok: (r) => r.schadenHeld === 0 });
const SURPRISES = [];
function surprise(id, o) { SURPRISES.push({ id, art: 'surprise', liest: 'attackOderSpell', ziele: ['hero'], ohneTreiber: ['Siphem'], ...o, vorbereiten: async (t, k, mit) => { if (mit) { t.grantFor(k.vs, k.zielHeld, id); t.putSurprise(k.vs, k.zielHeld, id); } if (o.aufbau) await o.aufbau(t, k, mit); } }); }
surprise('Bluff', { vergleich: true, ok: (r, b, k) => handN(r, k.vs) === handN(b, k.vs) + 3 });
surprise('Booby Trap', { ok: (r, b, k) => A(r.t, k).hp <= 700 || A(r.t, k).hp < 800 });
surprise('Crimson Web', { ok: (r) => r.schadenHeld === 0 });
surprise('Firewall', { ok: (r, b, k) => A(r.t, k).hp < 800 && !!A(r.t, k).statuses?.burned });
surprise('Flooding', { ok: (r) => r.schadenHeld === 0 });
surprise('Frost Rune', { ok: (r, b, k) => r.schadenHeld === 0 && !!A(r.t, k).statuses?.frozen });
surprise('Glass Wall', { ok: (r) => r.schadenHeld === 0 });
surprise('Jumper Spider', { vergleich: true, ok: (r, b, k) => handN(r, k.vs) === handN(b, k.vs) + 2 });
surprise('Mountain Tear River', { ok: (r, b, k) => !!A(r.t, k).statuses?.burned });
surprise('Spike Trap', { ok: (r, b, k) => r.schadenHeld === 0 });
surprise('Tharxian Horse', { ok: (r, b, k) => r.schadenHeld === 0 });
surprise('Toxic Trap', { ok: (r, b, k) => !!A(r.t, k).statuses?.poisoned });
surprise('Spider Avalanche', { aufbau: async (t, k) => { for (let i = 0; i < 2; i++) { const c = t.put(k.vs, 2, i, H.INERT.creature); c.turnPlayed = 1; } }, ok: (r, b, k) => A(r.t, k).hp < 800 });
surprise('Jumpscare', { ok: (r, b, k) => [0, 1, 2].some(h => r.t.hero(k.as, h).statuses?.stunned || r.t.hero(k.vs, h).statuses?.stunned) });

reakt('Chaorc Interception', { ziele: ['hero'], ohneTreiber: ['Siphem', 'Kohta'], aufbau: async (t, k) => { const c = t.put(k.vs, 1, 0, 'Chaorc Cannon Fodder'); c.turnPlayed = 1; c.counters.currentHp = 400; c.counters.maxHp = 400; }, ok: (r) => r.schadenHeld === 0 });
BRETT.push(
  { id: 'Future Tech Jetpack (Träger, 0 Kopien)', art: 'equip', liest: 'attack', ziele: ['hero'], F: 0, ohneTreiber: ['Siphem', 'Alice', 'Kohta'],
    vorbereiten: async (t, k, mit) => { t.put(k.vs, k.zielHeld, 0, 'Future Tech Jetpack'); }, ok: (r) => r.schadenHeld === 0 },
  { id: 'Stealth (Ability Lv 1, Angriff Stufe 1)', art: 'ability', liest: 'attack', ziele: ['hero'], F: 1, ohneTreiber: ['Siphem', 'Alice', 'Duel', 'Alluring Light', 'Kohta'],
    vorbereiten: async (t, k, mit) => { t.setAbilities(k.vs, k.zielHeld, [['Stealth'], [], []]); }, ok: (r) => r.schadenHeld === 0 && r.schadenHeld1 > 0 },
);
heldLeser("Taio, Absorber of the Mountain's Heart (Nachguss)", "Taio, Absorber of the Mountain's Heart", { liest: 'attackOderSpell', attHand: ['Fireball', 'Attack'], ohneTreiber: ['Kohta'], aufbau: async (t, k) => { t.grantFor(k.as, k.held, 'Fireball'); }, ok: (r) => gefragt(r.t, "Taio, Absorber of the Mountain's Heart") >= 1 });

// ───────────── Kennzeichnung bewusster Ausnahmen (siehe `_pruefe.js`, `bewusstNein`) ─────────────
//  duelWahlFenster  Fenster/Schutz, der an das WÄHLEN eines Ziels hängt („is chosen"): Duel wählt keine Ziele (die Helden stehen fest; Kopfkommentar `_hero-duel-shared.js`) — W32a-Regel
//  lichtEigeneWahl  Alluring Light: das Opfer wählt der Besitzer des Ziels selbst („a target you control"); Schutz gegen das Wählen DURCH DEN GEGNER greift nicht
//                   (Taio, Absorber: „during your turn" — der gezwungene Held gehört dem Gegner, der Angriff läuft im Zug des Light-Spielers)
const DUEL_WAHL = ['Hardy Slime (erzwungene Zielwahl)', 'Empty Armor (Umleitung)', 'Schutz: untargetable (Butterfly Cloud)', 'Schutz: invisible (Invisibility)', 'Anti-Magnet', 'Challenge', 'Martyry',
  'Future Tech Escape Device', 'Test Flight', 'Crimson Web', 'Flooding', 'Frost Rune', 'Glass Wall', 'Mountain Tear River', 'Spike Trap', 'Tharxian Horse', 'Jumpscare'];
const LICHT_WAHL = ['Hardy Slime (erzwungene Zielwahl)', 'Schutz: untargetable (Butterfly Cloud)', 'Schutz: invisible (Invisibility)', "Taio, Absorber of the Mountain's Heart (Nachguss)"];
const ALLE = [].concat(EQUIPS, EQUIPS2, EQUIPS3, HELDEN, KREATUREN, BRETT, ATT_HAND, VIC_HAND, SURPRISES);
for (const l of ALLE) {
  if (DUEL_WAHL.includes(l.id)) l.duelWahlFenster = true;
  if (LICHT_WAHL.includes(l.id)) l.lichtEigeneWahl = true;
  if (/^Schutz:/.test(l.id)) l.liest = 'allgemein';
}
for (const l of ALLE) {
  if (l.id === 'Crimson Web') l.auditAusnahme = true;   // Harness: die Crimson-Web-Anheftung am Angreifer ist in `t.audit()` nicht als Instanz geführt (auch bei der echten Attack)
  if (['Truth-Seeing Eye', 'Cute Angel Molinda', 'Taio, the Sun Fencer (Kill-Marke)', 'Stealthy Pursuit'].includes(l.id)) l.liest = 'attackOderSpell';   // Kartentext: "Attacks and Spells" / "Attack or Spell"
  if (l.id === 'Spiky Armor') l.liest = 'attack';   // "takes damage from an Attack"
  if (['Glass Wall', 'Future Tech Escape Device'].includes(l.id)) l.ohneTreiber = [...(l.ohneTreiber || []), 'Echter Spell'];   // Stufenbedingung: Fireball (Stufe 2) liegt über der Schwelle
}
for (const l of BRETT) if (l.id.startsWith('Future Tech Jetpack')) l.ohneTreiber = [...(l.ohneTreiber || []), 'Duel'];
module.exports = { EQUIPS3, KREATUREN, BRETT, ATT_HAND, VIC_HAND, SURPRISES, EQUIPS2, HELDEN, EQUIPS, ruesteAus, equip, A, V, ZIEL, hatStatus };
