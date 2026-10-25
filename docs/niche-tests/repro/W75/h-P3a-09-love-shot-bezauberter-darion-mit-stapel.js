'use strict';
// W75 · Darion (Audit P3a) — Love Shot: ein vom Gegner gesteuerter DARION fuehrt eine Attack aus; sein Equip-Stapel bleibt dabei liegen und zaehlt (ATK), danach ist alles wie vorher.
// Kartentext Love Shot: „... choose a Hero your opponent controls and perform an Attack or Spell from your hand with it, if possible. ... For that Attack or Spell only, the Hero is treated as controlled by you."
// Erwartet: Darion (Gegner, Platz 1) traegt Club (+30) und Blade (+10) im Stapel (echtes Ausruesten) -> ATK 140. Die Attack aus der Hand des Wirkers trifft mit 140 Schaden. Danach: keine Charme-Marke,
//   Stapel unveraendert (Namen + Instanzen), Darions ATK wie vorher, Zustandsrauchmelder ruhig.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-09-love-shot-bezauberter-darion-mit-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
(async () => {
  const R = H.runner();
  const me = 0, op = 1;
  R.section('Love Shot -> Attack ueber Darion mit Stapel');
  const hand = [[], []]; hand[me] = ['Love Shot', 'Attack']; hand[op] = ['Club of Gobbo', 'Blade of the Frostbringer'];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me, gold: 500 });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; }
  t.setHero(op, 0, T, 800);
  t.setHero(op, 1, D, 800);
  t.policy.confirm = true;
  await t.play(op, 'Club of Gobbo', { hero: 1, slot: 0 });
  await t.play(op, 'Blade of the Frostbringer', { hero: 1, slot: 2 });
  await t.drain();
  const stapel = JSON.stringify(t.gs.players[op].supportZones[1]);
  const atkVorher = t.hero(op, 1).atk;
  R.check('Ausgangslage: beide Equips in einer Zone, ATK 140', t.gs.players[op].supportZones[1].filter(z => z.length).length === 1 && atkVorher === 140, [stapel, atkVorher]);
  t.gs.activePlayer = me;
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ selectedCards: [{ handIndex: t.pile(me, 'hand').indexOf('Attack'), cardName: 'Attack' }] }) });
  t.targetFn = (v, cfg) => {
    if (/Love Shot/.test((cfg && cfg.title) || '')) return [`hero-${op}-1`];
    return [(v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0) || v[0]).id];
  };
  const hp0 = t.hp(op, 0);
  const r = await t.play(me, 'Love Shot', { hero: 0 });
  await t.drain();
  R.note('lauf', JSON.stringify({ r, schaden: hp0 - t.hp(op, 0), stapel: t.gs.players[op].supportZones[1], atk: t.hero(op, 1).atk }));
  R.check('Love Shot gespielt, die Attack liegt in der Ablage', r === true && t.pile(me, 'discardPile').includes('Attack'), { r, abl: t.pile(me, 'discardPile') });
  R.check('die Attack traf mit Darions ATK inklusive Stapel (140)', hp0 - t.hp(op, 0) === 140, hp0 - t.hp(op, 0));
  R.check('Stapel unveraendert, ATK wie vorher, keine Kontrollmarke', JSON.stringify(t.gs.players[op].supportZones[1]) === stapel && t.hero(op, 1).atk === atkVorher && t.hero(op, 1).charmedBy == null && !t.hero(op, 1).statuses?.charmed, [t.gs.players[op].supportZones[1], t.hero(op, 1).atk]);
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
