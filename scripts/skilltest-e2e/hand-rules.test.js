'use strict';
// Hand-Garantien und Recycler-Regeln (skilltest/hand-rules.js): Heldenpartner, Spell-School-Mindestlevel, Recycler-Spells passend zu den
// Schulen der Board-Heroes, Recycler-Inhalt → Ablage zu Spielbeginn.
//   node scripts/skilltest-e2e/hand-rules.test.js
process.env.PP_ST_SIM = '1';
const { getCardDB } = require('../../cards/effects/_card-db');
const { CardPool, dealHand } = require('../../skilltest/pool');
const HR = require('../../skilltest/hand-rules');
const Rules = require('../../public/skilltest-rules.js');
const { runGame, mulberry32 } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const cards = getCardDB();
  const LUNA = 'Luna, the Flame Fairy', SOL = 'Sol Rym, the Thunder Djinn', MARY = 'Cute Princess Mary';

  console.log('Heldenpartner');
  const P = (h) => HR.partnersOf(cards, h);
  check('Luna → Firewall', P(LUNA).includes('Firewall'), P(LUNA));
  check('Sol Rym → Chain Lightning', P(SOL).includes('Chain Lightning'), P(SOL));
  check('Damus → Armageddon, Natas → The Master\'s Plan', P('Damus, the Prophet of Apocalypse').includes('Armageddon') && P('Natas, the Master of Hell').includes("The Master's Plan"));
  check('Mary → Cute Phoenix (Sonderfall)', P(MARY).includes('Cute Phoenix'), P(MARY));
  check('Heroes ohne Kartenverweis haben keinen Partner', P('Maya, the Nature Fairy').length === 0, P('Maya, the Nature Fairy'));

  const fresh = () => new CardPool(cards, mulberry32(11));
  {
    const pool = fresh();
    const hand = [LUNA, SOL, MARY, 'Cute Bunny'];
    const rules = {};
    const added = HR.onHeroesInHand({ pool, cards, hand, state: rules, rng: mulberry32(3) });
    check('Firewall, Chain Lightning und Cute Phoenix liegen mit ihren Heroes auf der Hand', ['Firewall', 'Chain Lightning', 'Cute Phoenix'].every(n => hand.includes(n)), hand);
    check('Partner kamen aus dem Pool (nicht mehr darin)', ['Firewall', 'Chain Lightning', 'Cute Phoenix'].every(n => pool.takeNamed(n) === null));
    const again = HR.onHeroesInHand({ pool, cards, hand, state: rules, rng: mulberry32(4) });
    check('Garantie greift je Hero nur einmal (kein Nachschub nach Recyceln)', again.length === 0, again);
    const h2 = [LUNA]; HR.onHeroesInHand({ pool: fresh(), cards, hand: h2, state: {}, rng: mulberry32(5) });
    check('bereits vorhandener Partner wird nicht doppelt gegeben', (() => { const h = [LUNA, 'Firewall']; HR.onHeroesInHand({ pool: fresh(), cards, hand: h, state: {}, rng: mulberry32(5) }); return h.filter(n => n === 'Firewall').length === 1; })());
    check('Partner ist vergeben (nicht im Pool) → erscheint als Zusatzkarte', (() => { const p = fresh(); p.takeNamed('Firewall'); const h = [LUNA]; HR.onHeroesInHand({ pool: p, cards, hand: h, state: {}, rng: mulberry32(5) }); return h.includes('Firewall'); })());
  }

  console.log('Spell-School-Mindestlevel');
  const levelSum = (hand, schools) => hand.reduce((s, n) => { const c = cards[n]; return s + (c && c.cardType === 'Spell' && HR.spellSchools(c).some(x => schools.has(x)) ? (c.level || 0) : 0); }, 0);
  {
    const school = 'Decay Magic';
    const hero = Object.values(cards).find(c => c.cardType === 'Hero' && c.skilltestLegal && [c.startingAbility1, c.startingAbility2].includes(school) && !HR.partnersOf(cards, c.name).length);
    const targets = new Set(); let allOk = true, noAdd = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const pool = fresh(); const hand = [hero.name]; const st = {};
      HR.onHeroesInHand({ pool, cards, hand, state: st, rng: mulberry32(seed) });
      const sum = levelSum(hand, new Set([school]));
      if (sum < 1) allOk = false;
      targets.add(Math.min(5, sum));
      const spells = hand.filter(n => cards[n].cardType === 'Spell');
      if (spells.some(n => (cards[n].level || 0) > 3)) allOk = false;
      if (spells.length === 0) noAdd++;
    }
    check(`${hero.name} (${school}): immer Spells mit Gesamtlevel ≥ 1 auf der Hand`, allOk && noAdd === 0, { noAdd });
    check('Mindestlevel streut über 1–5 (zufällig)', targets.size >= 3, [...targets]);
    const sm = Object.values(cards).find(c => c.cardType === 'Hero' && c.skilltestLegal && [c.startingAbility1, c.startingAbility2].includes('Summoning Magic') && ![c.startingAbility1, c.startingAbility2].some(a => HR.GUARANTEE_SCHOOLS.includes(a)) && !HR.partnersOf(cards, c.name).length);
    const h = [sm.name]; HR.onHeroesInHand({ pool: fresh(), cards, hand: h, state: {}, rng: mulberry32(9) });
    check(`${sm.name}: nur Summoning Magic → keine Spells garantiert`, h.length === 1, h);
    const ph = { rules: {}, hand: [] };
    const pool = fresh(); const d = dealHand(pool, mulberry32(21), { cards, ps: ph });
    check('dealHand wendet die Regeln an (ps.rules gesetzt)', !!ph.rules && !!ph.rules.given);
  }

  console.log('Recycler: Spells passend zu den Schulen der Board-Heroes');
  {
    const destr = Object.values(cards).find(c => c.cardType === 'Hero' && c.skilltestLegal && [c.startingAbility1, c.startingAbility2].includes('Destruction Magic'));
    const ps = Rules.emptyPlayer(); ps.heroes[0] = destr.name; ps.rules = { given: { [destr.name]: 1 }, schools: { 'Destruction Magic': 1 } };
    const want = new Set(HR.heroSchools(destr));
    const pool = fresh(); let spells = 0, bad = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const r = HR.eject({ pool, cards, ps, weights: null, rng: mulberry32(100 + i) });
      if (!r.ejected) break;
      n++;
      const c = cards[r.ejected];
      if (c.cardType === 'Spell') { spells++; if (!HR.spellSchools(c).some(s => want.has(s))) bad++; }
    }
    check(`${n} Auswürfe: ${spells} Spells, alle aus den Schulen von ${destr.name} (${[...want].join(', ')})`, n >= 250 && spells > 5 && bad === 0, { n, spells, bad });
    const none = Rules.emptyPlayer(); none.heroes[0] = 'Maya, the Nature Fairy'; none.rules = {};
    const pool2 = fresh(); let sp2 = 0;
    if (!HR.heroSchools(cards['Maya, the Nature Fairy']).length) {
      for (let i = 0; i < 200; i++) { const r = HR.eject({ pool: pool2, cards, ps: none, weights: null, rng: mulberry32(500 + i) }); if (r.ejected && cards[r.ejected].cardType === 'Spell') sp2++; }
      check('ohne Spell-School-Hero auf dem Brett gilt keine Einschränkung', sp2 > 0, sp2);
    }
    const hp = Rules.emptyPlayer(); hp.heroes[0] = destr.name; hp.rules = { given: { [destr.name]: 1 } };
    const pool3 = fresh(); pool3.takeNamed(LUNA);
    const ps3 = Rules.emptyPlayer(); ps3.heroes[0] = destr.name; ps3.rules = {};
    // Ein Hero aus dem Recycler bringt seinen Partner mit
    const poolH = fresh(); poolH.buckets.hero = poolH.buckets.hero.filter(x => x === LUNA); poolH.buckets.ability = []; poolH.buckets.creature = []; poolH.buckets.artifact = []; poolH.buckets.potion = []; poolH.buckets.attackSpell = poolH.buckets.attackSpell.filter(x => x === 'Firewall' || cards[x].cardType === 'Spell' && HR.spellSchools(cards[x]).includes('Destruction Magic'));
    const psH = Rules.emptyPlayer(); psH.heroes[0] = 'Maya, the Nature Fairy'; psH.hand = []; psH.rules = {};
    let got = null;
    for (let i = 0; i < 40 && !got; i++) { const r = HR.eject({ pool: poolH, cards, ps: psH, weights: { hero: 1 }, rng: mulberry32(7 + i) }); if (r.ejected === LUNA) got = r; }
    check('Luna aus dem Recycler bringt Firewall mit', !!got && psH.hand.includes('Firewall'), psH.hand);
  }

  console.log('Spielbeginn: Recycler → eigene Ablage');
  {
    const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
    const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 5, mutatePrep: (prep) => { prep.players[1].recycledCards = ['Cute Bunny', 'Fireball']; prep.players[1].recycled = 2; } });
    console.log = oL; console.error = oE;
    const gs = out.gs;
    check('Ablage von Sitz 1 = sein Recycler-Inhalt', JSON.stringify(gs.players[1].discardPile) === JSON.stringify(['Cute Bunny', 'Fireball']), gs.players[1].discardPile);
    check('andere Sitze: nur ihr eigener Recycler-Inhalt (nicht der von Sitz 1)', !gs.players[0].discardPile.includes('Fireball') && !gs.players[2].discardPile.includes('Fireball'));
    const bots = [0, 2].map(i => gs.players[i].discardPile.length);
    check('Bots: Ablage = recycelte Karten', bots.every(n => n >= 0), bots);
  }

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Hand-Regel-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
