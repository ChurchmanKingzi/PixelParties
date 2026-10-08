'use strict';
// Idej Lords spawnen beim Aufstellen ihre Karten aus dem Nichts (headless, ohne Server) + Pool-Sperren (Tri Ad/Tri Fecta, reine Zieh-/Such-Karten).
//   node scripts/skilltest-e2e/idej.test.js
const Rules = require('../../public/skilltest-rules.js');
const { getCardDB } = require('../../cards/effects/_card-db');
const { CardPool } = require('../../skilltest/pool');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const cards = getCardDB();
let seed = 7;
const env = { cards, areaLimitOf: () => undefined, random: () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; } };
const PACK = Rules.IDEJ_PACKAGES;
const names = (ps, hi) => ps.supportZones[hi].map(z => z[0] || null);
const withHand = (hand) => { const ps = Rules.emptyPlayer(); ps.hand = [...hand]; return ps; };
const ok = (r) => r && r.ok;
const placeHero = (ps, hero, hi) => Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.indexOf(hero) }, to: { kind: 'hero', hi } });
// Ein normaler Hero zum Auffüllen (kein Idej, kein Hand-only)
const plain = Object.values(cards).filter(c => c.cardType === 'Hero' && c.skilltestLegal && c.archetype !== 'Idej' && !Rules.HAND_ONLY_HEROES.includes(c.name)).slice(0, 4).map(c => c.name);

console.log('Aufstellen: Paket je Lord');
for (const [lord, pack] of Object.entries(PACK)) {
  const ps = withHand([lord, plain[0], plain[1], plain[2]]);
  const r = placeHero(ps, lord, 0);
  check(lord + ': Aufstellen gelingt', ok(r), r.reason);
  const col = names(r.ps, 0);
  const proj = col.filter(n => n === Rules.IDEJ_PROJECTION).length;
  const blades = col.filter(n => Rules.IDEJ_BLADES.includes(n));
  check(`${lord}: ${pack.proj}× Projection, ${pack.blade}× Blade, alle 3 Zonen belegt`, proj === pack.proj && blades.length === pack.blade && col.every(Boolean), col);
  check(lord + ': Blades sind verschieden', new Set(blades).size === blades.length, blades);
  check(lord + ': alle Zonen als erschienen markiert', [0, 1, 2].every(s => Rules.isSpawned(r.ps, 0, s)), r.ps.spawned);
  check(lord + ': Hand enthält nur die übrigen 3 Karten (nichts „zurückgelegt“)', r.ps.hand.length === 3, r.ps.hand);
}

console.log('Normale Heroes: kein Spawn');
{
  const ps = withHand([plain[0], plain[1], plain[2], 'Idej Lord Daiyo']);
  const r = placeHero(ps, plain[0], 0);
  check('Normaler Hero spawnt nichts', ok(r) && names(r.ps, 0).every(n => n === null) && !r.ps.spawned[0].some(Boolean), names(r.ps, 0));
}

console.log('Erschienene Karten: nur löschen, nicht aufnehmen/recyceln/verschieben');
{
  const base = placeHero(withHand(['Idej Lord Nobunakin', plain[0], plain[1], plain[2]]), 'Idej Lord Nobunakin', 1).ps;
  const handLen = base.hand.length;
  let r = Rules.applyMove(env, base, { type: 'unplace', from: { kind: 'support', hi: 1, slot: 0 } });
  check('unplace (zurück auf die Hand) abgelehnt', !ok(r) && /löschen/.test(r.reason), r);
  r = Rules.applyMove(env, base, { type: 'recycle', from: { kind: 'support', hi: 1, slot: 1 } });
  check('recycle abgelehnt', !ok(r) && /recyceln|löschen/.test(r.reason), r);
  r = Rules.applyMove(env, base, { type: 'place', from: { kind: 'support', hi: 1, slot: 0 }, to: { kind: 'support', hi: 0, slot: 0 } });
  check('Verschieben in eine andere Zone abgelehnt', !ok(r), r);
  r = Rules.applyMove(env, base, { type: 'deleteSpawned', hi: 1, slot: 2 });
  check('Löschen (Rechtsklick) klappt: Zone leer, Marke weg', ok(r) && r.ps.supportZones[1][2].length === 0 && !Rules.isSpawned(r.ps, 1, 2), r.ps && r.ps.supportZones[1]);
  check('…Hand und Recycler bleiben unverändert', r.ps.hand.length === handLen && r.ps.recycled === base.recycled && !r.recycledCard, [r.ps.hand.length, r.ps.recycled]);
  check('…die Nachbarn bleiben erschienen', Rules.isSpawned(r.ps, 1, 0) && Rules.isSpawned(r.ps, 1, 1), r.ps.spawned);
  r = Rules.applyMove(env, base, { type: 'deleteSpawned', hi: 0, slot: 0 });
  check('Löschen einer leeren/normalen Zone abgelehnt', !ok(r), r);
  const normal = Rules.clone(base); normal.supportZones[0][0] = ['Idej Sword - Kogarasu'];
  r = Rules.applyMove(env, normal, { type: 'deleteSpawned', hi: 0, slot: 0 });
  check('Normale Support-Karte ist NICHT per deleteSpawned löschbar', !ok(r), r);
  r = Rules.applyMove(env, Object.assign(Rules.clone(base), { ready: true }), { type: 'deleteSpawned', hi: 1, slot: 0 });
  check('Nach „Ready“ gesperrt', !ok(r), r);
}

console.log('Überbauen: Handkarte auf erschienene Zone ersetzt sie (die erschienene verschwindet)');
{
  let ps = placeHero(withHand(['Idej Lord Todugawin', 'Idej Sword - Onima', plain[0], plain[1]]), 'Idej Lord Todugawin', 0).ps;
  const before = ps.hand.length;
  const r = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.indexOf('Idej Sword - Onima') }, to: { kind: 'support', hi: 0, slot: 1 } });
  check('Sword auf erschienene Blade-Zone gelegt', ok(r) && r.ps.supportZones[0][1][0] === 'Idej Sword - Onima', r.reason);
  check('…Zone nicht mehr „erschienen“, Blade nicht auf die Hand', !Rules.isSpawned(r.ps, 0, 1) && r.ps.hand.length === before - 1 && !r.ps.hand.some(n => n.startsWith('Idej Blade')), r.ps.hand);
  check('…die anderen beiden bleiben erschienen', Rules.isSpawned(r.ps, 0, 0) && Rules.isSpawned(r.ps, 0, 2), r.ps.spawned[0]);
}

console.log('Hero verlässt das Brett: die Karten verschwinden');
{
  const ps = placeHero(withHand(['Idej Lord Daiyo', plain[0], plain[1], plain[2]]), 'Idej Lord Daiyo', 0).ps;
  const r = Rules.applyMove(env, ps, { type: 'unplace', from: { kind: 'hero', hi: 0 } });
  check('Hero zurück auf die Hand: Spalte leer', ok(r) && names(r.ps, 0).every(n => n === null) && !r.ps.spawned[0].some(Boolean), names(r.ps, 0));
  check('…auf der Hand landet nur der Hero, keine Projection', r.ps.hand.includes('Idej Lord Daiyo') && !r.ps.hand.includes(Rules.IDEJ_PROJECTION) && r.ps.hand.length === ps.hand.length + 1, r.ps.hand);
  // Ersetzen durch einen normalen Hero
  const withPlain = Rules.clone(ps); withPlain.hand.push(plain[3]);
  const r2 = placeHero(withPlain, plain[3], 0);
  check('Ersetzen durch einen anderen Hero: Karten weg, Idej Lord auf der Hand', ok(r2) && names(r2.ps, 0).every(n => n === null) && r2.ps.hand.includes('Idej Lord Daiyo') && !r2.ps.hand.includes(Rules.IDEJ_PROJECTION), r2.ps && r2.ps.hand);
  // Tausch zweier Zonen nimmt die Karten mit
  const two = placeHero(Object.assign(Rules.clone(ps), { hand: [...ps.hand] }), plain[0], 1).ps;
  const sw = Rules.applyMove(env, two, { type: 'place', from: { kind: 'hero', hi: 0 }, to: { kind: 'hero', hi: 1 } });
  check('Hero-Tausch: Karten und Marken wandern mit', ok(sw) && sw.ps.heroes[1] === 'Idej Lord Daiyo' && names(sw.ps, 1).every(n => n === Rules.IDEJ_PROJECTION) && sw.ps.spawned[1].every(Boolean) && !sw.ps.spawned[0].some(Boolean), sw.ps && [sw.ps.heroes, sw.ps.spawned]);
  // Lord ersetzt Lord: neu gewürfeltes Paket, keine Verdoppelung
  const swapLord = Rules.clone(ps); swapLord.hand.push('Idej Lord Todugawin');
  const r3 = placeHero(swapLord, 'Idej Lord Todugawin', 0);
  check('Lord ersetzt Lord: neues Paket (3 Blades), alte Projections weg', ok(r3) && names(r3.ps, 0).every(n => n && n.startsWith('Idej Blade')) && r3.ps.hand.includes('Idej Lord Daiyo'), r3.ps && names(r3.ps, 0));
}

console.log('Vorhandene Support-Karten werden beim Aufstellen eines Lords auf die Hand zurückgelegt');
{
  let ps = withHand([plain[0], plain[1], 'Idej Lord Shoguwana', 'Idej Sword - Kunagi', 'Snake Race Boat']);
  ps = placeHero(ps, plain[0], 0).ps;
  ps = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.indexOf('Idej Sword - Kunagi') }, to: { kind: 'support', hi: 0, slot: 0 } }).ps;
  check('Vorbereitung: Sword liegt in Zone 0 (normaler Hero)', ps.supportZones[0][0][0] === 'Idej Sword - Kunagi', names(ps, 0));
  const r = placeHero(ps, 'Idej Lord Shoguwana', 0);
  check('Shoguwana ersetzt den Hero: Sword zurück auf der Hand, Spalte hat Paket', ok(r) && r.ps.hand.includes('Idej Sword - Kunagi') && names(r.ps, 0).filter(n => n === Rules.IDEJ_PROJECTION).length === 1 && names(r.ps, 0).filter(n => n && n.startsWith('Idej Blade')).length === 2, r.ps && [names(r.ps, 0), r.ps.hand]);
}

console.log('Zustände ohne `spawned` (ältere Basen) laufen weiter');
{
  const ps = withHand([plain[0], plain[1], plain[2]]); delete ps.spawned;
  const r = placeHero(ps, plain[0], 0);
  check('applyMove ergänzt `spawned`', ok(r) && Array.isArray(r.ps.spawned) && r.ps.spawned.length === 3, r);
  check('isSpawned verträgt fehlendes Feld', Rules.isSpawned({}, 0, 0) === false);
}

console.log('Pool: gesperrte Karten kommen nicht vor');
{
  const MUST_BE_OUT = ['Tri Ad, the Puppet Mistress', 'Tri Fecta, the Puppet Master', 'Idej Projection',
    'Magnetic Potion', 'Magnetic Glove', 'Brilliant Idea', 'The Sacred Jewel', 'Navigation', 'Luck',             // Suchen/Tutoren bleiben draußen
    'Spider Dance', 'Masterpiece', 'Hell Fox', 'Pinaxolotl', 'Cute Dog', 'Garius, the Great Reformer', 'Ska Harpyformer',      // 8.10.: Search-Karten (Nutzer)
    'Pillage', 'Dead Guardian', 'Magic Emerald', "Gravedigger's Shovel", 'Gravedigger', 'Jean, the Pillaging Knight',       // 8.10.: reine Mill-Karten
    'Paraseed Greenhouse',                                                                                                   // 8.10.: alle Paraseed-Karten
    'Rebelliokai Timid Tanuki', 'Tanuki Escape',
    'Bouldor Demon', 'Herbithorn Demon', 'Hydrogen Demon', 'Infernous Demon', 'Serpentous Demon', 'Sandy Blob', 'Festive Werz',   // 8.10.: Cycling Demons, Sandy Blob, Festive Werz
    "Guardian's Appearance",                                                                                                  // 8.10. (später): Mill-Teil wirkungslos
    'Ancient Guardian Statue', 'Begin the Race!', 'Create Secret Room', 'Elven Druid', 'Loyal Rottweiler', 'Monster Nest', 'Unholy Combination', 'Cute Bird',
    'Legendary Explorer Dajan', 'Friedhelm, the Misled Avenger', 'Timeless King Zi', 'Kit, the Shark Researcher', 'Cecilia, the Harrowing Crusader', 'Trapping'];   // 8.10.: Choose-X, die de facto nur Searches sind
  const STAY_AFTER_SEARCH_BAN = ['Idej Lord Daiyo', 'Idej Lord Nobunakin', 'Idej Lord Shoguwana', 'Idej Lord Todugawin', 'Krates, the Smartass', 'Koperniko, the Stargazer', 'Cats of the Pharaoh', 'Trade', 'Deepsea Skeleton'];
  // Seit 8.10. wieder im Pool: reine Draw- und Mulligan-Karten (Ziehen von außerhalb des Spiels, engine-ext.js installDraws)
  const NOW_IN = ['Wheels', 'Elixir of Quickness', 'Haste', 'Supply Chain', 'Alchemy', 'Leadership', 'Horn in a Bottle', 'Staff of the Teleporter', 'Heart of the Mountain'];
  const MUST_STAY = ['Shooting Star', 'Boomerang', 'Elixir of Recovery', 'Pressed Skill', "Rainbow's Arrow", 'Idej Blade - Hakai', 'Idej Lord Daiyo', 'Idej Sword - Kunagi', ...STAY_AFTER_SEARCH_BAN];
  const all = new Set();
  const pool = new CardPool(cards);
  for (const b of Object.keys(pool.buckets)) for (const n of pool.buckets[b]) all.add(n);
  check('Gesperrte Karten sind nicht im Pool', MUST_BE_OUT.every(n => !all.has(n)), MUST_BE_OUT.filter(n => all.has(n)));
  check('Reine Draw-/Mulligan-Karten sind wieder im Pool', NOW_IN.every(n => all.has(n)), NOW_IN.filter(n => !all.has(n)));
  check('Karten mit eigenem Effekt (Ablage-Rückholer u. a.) bleiben im Pool', MUST_STAY.every(n => all.has(n)), MUST_STAY.filter(n => !all.has(n)));
  const flagged = ['blockedByHandLock', 'blockedByDrawLock', 'blockedBySearchLock'];
  const { loadCardEffect } = require('../../cards/effects/_loader');
  const KEEP_BY_HAND = new Set(['Cleansing of the Land', 'Elixir of Recovery', 'Pressed Skill', "Rainbow's Arrow",   // geflaggt, aber mit echtem Zusatzeffekt von Hand geprüft
    'Boomerang', 'Shard of Chaos', 'Elixir of Mana', 'Debt-O-Tron Model Backup Duplicator',
    ...NOW_IN, 'Staff of Uncontrollable Destruction']);                  // Ablage-Rückholer (die Ablage gibt es im Skill Test) bzw. Kreatur-Artefakt
  const leftovers = [...all].filter(n => { const c = cards[n]; if (!c || c.cardType === 'Creature' || c.cardType === 'Hero') return false; let s; try { s = loadCardEffect(n); } catch { return false; } return s && flagged.some(f => s[f]) && !KEEP_BY_HAND.has(n); });
  check('Kein Nicht-Kreatur-Karte mit Zieh-/Such-Sperr-Flag steckt unbesehen im Pool', leftovers.length === 0, leftovers);
  // 8.10. (Nutzer): keine Karte im Pool, deren Effekt ausdrücklich im Deck sucht — außer den Idej Lords (Spawn-Regel) und Karten, die Suchen nur einschränken/verändern
  const searchers = [...all].filter(n => cards[n] && /\bsearch(es|ed|ing)?\b/i.test(cards[n].effect || '') && !STAY_AFTER_SEARCH_BAN.includes(n) && n !== 'Cybug BEE');
  check('Keine Karte mit „search“ im Effekttext im Pool (außer den ausdrücklichen Ausnahmen)', searchers.length === 0, searchers);
  const paraseed = [...all].filter(n => /paraseed/i.test(n) || /paraseed/i.test((cards[n] && cards[n].archetype) || ''));
  check('Keine Paraseed-Karte im Pool', paraseed.length === 0, paraseed);
}

console.log('Kampfstart: erschienene Karten sind echte Support-Karten der Engine');
(async () => {
  try {
    const { runGame } = require('../../skilltest/sim');
    const out = await runGame({
      seats: 3, setupOnly: true, noFast: false, seed: 12,        // fester Tisch: ein Hero mit Start-Effekt in der Spalte würde die erschienenen Karten verändern
      mutatePrep: (prep) => {
        const ps = prep.players[0];
        ps.ready = false;
        ps.hand.push('Idej Lord Nobunakin');
        const idx = ps.hand.indexOf('Idej Lord Nobunakin');
        const r = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx }, to: { kind: 'hero', hi: 0 } });
        if (!r.ok) throw new Error('Idej nicht platzierbar: ' + r.reason);
        prep.players[0] = Object.assign(r.ps, { ready: true });
      },
    });
    const { engine, gs } = out;
    const col = gs.players[0].supportZones[0].map(z => z[0]);
    check('Support Zones des Idej-Heroes im Spielzustand', col.filter(n => n === 'Idej Projection').length === 2 && col.filter(n => n && n.startsWith('Idej Blade')).length === 1, col);
    const inst = engine.cardInstances.filter(i => i.zone === 'support' && i.owner === 0 && i.heroIdx === 0);
    check('…als Karteninstanzen der Engine angelegt', inst.length === 3 && inst.every(i => i.name === 'Idej Projection' || i.name.startsWith('Idej Blade')), inst.map(i => i.name));
    const hero = gs.players[0].heroes[0];
    check('Held in der Spalte ist der Idej Lord', hero && hero.name === 'Idej Lord Nobunakin', hero && hero.name);
  } catch (e) { fails++; console.log('  ✗ Kampfstart-Test:', e && e.stack || e); }

  console.log('Bot-Aufbau: jeder aufgestellte Idej Lord hat sein volles Paket im Kampf');
  try {
    const { runGame } = require('../../skilltest/sim');
    const oL = console.log, oE = console.error;
    const seen = {};
    for (let seed = 1; seed <= 20; seed++) {
      console.log = () => {}; console.error = () => {};
      let o; try { o = await runGame({ seats: 4, setupOnly: true, noProfileSeats: [0, 1, 2, 3], seed }); } finally { console.log = oL; console.error = oE; }
      o.gs.players.forEach((p, i) => (p.heroes || []).forEach((h, hi) => {
        if (!h || !/^Idej Lord/.test(h.name || '')) return;
        const col = (p.supportZones[hi] || []).map(z => z && z[0]).filter(Boolean);
        const pack = PACK[h.name];
        const proj = col.filter(n => n === Rules.IDEJ_PROJECTION).length, bl = col.filter(n => Rules.IDEJ_BLADES.includes(n));
        (seen[h.name] = seen[h.name] || []).push(proj === pack.proj && bl.length === pack.blade && new Set(bl).size === bl.length);
      }));
    }
    const total = Object.values(seen).reduce((a, v) => a + v.length, 0);
    check('Bots stellen Idej Lords auf (' + total + ' in 20 Partien)', total >= 3, seen);
    check('…jeder mit exakt dem Paket seines Effekts (Projections/Blades, Blades verschieden)', Object.values(seen).every(v => v.every(Boolean)), seen);
  } catch (e) { fails++; console.log('  ✗ Bot-Aufbau-Test:', e && e.stack || e); }

  console.log('Kampf: erschienene Idej Projections wirken (negieren Schaden, bis sie verbraucht sind)');
  try {
    const { runGame } = require('../../skilltest/sim');
    const oL = console.log, oE = console.error;
    console.log = () => {}; console.error = () => {};
    let o;
    try {
      o = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 5, mutatePrep: (prep) => {
        const ps = prep.players[1]; ps.ready = false; ps.hand.push('Idej Lord Daiyo');
        const r = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.indexOf('Idej Lord Daiyo') }, to: { kind: 'hero', hi: 0 } });
        if (!r.ok) throw new Error(r.reason);
        prep.players[1] = Object.assign(r.ps, { ready: true });
      } });
    } finally { console.log = oL; console.error = oE; }
    const { gs, engine } = o;
    const hero = gs.players[1].heroes[0];
    const hp = hero.hp, left = () => gs.players[1].supportZones[0].filter(z => z[0] === Rules.IDEJ_PROJECTION).length;
    check('Daiyo startet mit 3 Projections', hero.name === 'Idej Lord Daiyo' && left() === 3, [hero.name, left()]);
    for (let i = 1; i <= 3; i++) await engine.actionDealDamage({ name: 'Test Attack', owner: 0 }, hero, 40, 'attack');
    check('Die ersten 3 Treffer werden negiert (HP unverändert, alle Projections verbraucht)', hero.hp === hp && left() === 0, [hp, hero.hp, left()]);
    await engine.actionDealDamage({ name: 'Test Attack', owner: 0 }, hero, 40, 'attack');
    check('Der vierte Treffer wirkt', hero.hp === hp - 40, [hp, hero.hp]);
  } catch (e) { fails++; console.log('  ✗ Projection-Test:', e && e.stack || e); }
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Idej-/Pool-Tests grün');
  process.exit(fails ? 1 : 0);
})();
