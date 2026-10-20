'use strict';
// W33a · Punkt 1 · Al, 22.10.2026 (Frage von W31a: soll bloßer Charme-Schutz das Ziel NICHT ineligible machen, echte Giftimmunität schon?): „Nein, Sickly Cheese kann spezifisch NUR aktiviert werden,
//   wenn das Ziel vergiftbar ist, also in beiden Fällen unspielbar."
// Kartentext: „Choose a Hero you control and inflict 1 Stack of Poison to it to play this card. Choose a Decay Magic Spell from your deck, reveal it and add it to your hand."
// REGEL (NUR Sickly Cheese): ein Ziel, das den Giftstapel nicht annähme, ist ineligible – echte Giftimmunität (W7b) UND der Charme-Schutz eines temporär übernommenen Helden („unaffected by other cards and
//   effects"). Ist KEIN Ziel vergiftbar, ist die Karte unspielbar (bleibt auf der Hand, nichts bezahlt). Dauerhaft übernommene Helden sind normal vergiftbar. Torchure, The Yeeting, Mana Absorbing Crystal,
//   Experimental Potion, Angry Cheese bieten den temporär übernommenen Helden weiter an (W31a, `W31/a-01`).
// Aufruf: node docs/niche-tests/repro/W33/a-01-sickly-cheese-nur-bei-vergiftbarem-ziel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const IMMUN = { negative_status_immune: { source: 'Test' } };
const deck30 = () => ['Accusation'].concat(Array(29).fill('Fireball'));

async function aufbau(s, z) {
  const o = 1 - s;
  const hand = [[], []]; hand[s] = ['Sickly Cheese'];
  const t = await H.fresh({ hand, deck: s === 0 ? [deck30(), Array(30).fill('Fireball')] : [Array(30).fill('Fireball'), deck30()], gold: [100, 100], active: s });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Sickly Cheese', answer: () => ({ cardName: 'Accusation', source: 'deck' }), once: false });
  if (z === 'temporaer') { await t.run(() => t.engine.actionStealHero(s, o, 0)); await sleep(250); }
  if (z === 'dauerhaft') { await t.run(() => t.engine.actionTakeHeroPermanently(s, o, 0)); await sleep(250); }
  return t;
}
const ziele = (t, s) => H.loadCardEffect('Sickly Cheese').getValidTargets(t.gs, s, t.engine);
const eintrag = (liste, owner, hi) => liste.find(z => z.owner === owner && z.heroIdx === hi);
const spielbar = (t, s) => !!H.loadCardEffect('Sickly Cheese').canActivate(t.gs, s, t.engine);

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    const o = 1 - s;
    R.section(`Sitz ${s} · Zielliste und Spielbarkeit`);
    { const t = await aufbau(s, 'normal'); const l = ziele(t, s);
      R.check('normal: alle drei eigenen Helden wählbar, Karte spielbar', [0, 1, 2].every(i => eintrag(l, s, i) && !eintrag(l, s, i).ineligible) && spielbar(t, s), l); }
    { const t = await aufbau(s, 'temporaer'); const l = ziele(t, s);
      R.check(`temporär übernommener Gegnerheld ${o}:0 (Charme-Schutz) ist ineligible`, eintrag(l, o, 0)?.ineligible === true, eintrag(l, o, 0));
      R.check('die eigenen Helden bleiben wählbar, die Karte ist spielbar', [0, 1, 2].every(i => !eintrag(l, s, i)?.ineligible) && spielbar(t, s), l);
      t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === o && v.heroIdx === 0) || valid.find(v => !v.ineligible)).id];
      const r = await t.play(s, 'Sickly Cheese', { hero: 1 });
      R.check(`gespielt (an einem eigenen vergiftbaren Helden): ${o}:0 NICHT gewählt/vergiftet, ein eigener Held vergiftet, Accusation auf der Hand`,
        r === true && !t.hero(o, 0).statuses?.poisoned && [0, 1, 2].some(i => t.hero(s, i).statuses?.poisoned) && t.pile(s, 'hand').includes('Accusation'), { r, st: Object.keys(t.hero(o, 0).statuses || {}) });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { const t = await aufbau(s, 'dauerhaft'); const l = ziele(t, s);
      R.check(`dauerhaft übernommener Gegnerheld ${o}:0 ist wählbar (normal vergiftbar)`, eintrag(l, o, 0) && !eintrag(l, o, 0).ineligible, eintrag(l, o, 0)); }

    R.section(`Sitz ${s} · kein Ziel vergiftbar ⇒ unspielbar`);
    { // (a) einziges Ziel = temporär übernommener Held, alle eigenen Helden giftimmun: unspielbar (Charme-Schutz)
      const t = await aufbau(s, 'temporaer');
      for (let i = 0; i < 3; i++) t.hero(s, i).buffs = { ...(t.hero(s, i).buffs || {}), ...IMMUN };
      const r = await t.play(s, 'Sickly Cheese', { hero: 0 });
      R.check('alle eigenen Helden giftimmun + nur der Charme-Held ⇒ Karte unspielbar (bleibt auf der Hand, Gold unverändert, nichts vergiftet)',
        r === false && t.pile(s, 'hand').includes('Sickly Cheese') && t.gs.players[s].gold === 100 && !t.hero(o, 0).statuses?.poisoned && !spielbar(t, s), { r, hand: t.pile(s, 'hand'), gold: t.gs.players[s].gold });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // (b) nur echte Giftimmunität (keine Übernahme): unspielbar (W7b)
      const t = await aufbau(s, 'normal');
      for (let i = 0; i < 3; i++) t.hero(s, i).buffs = { ...(t.hero(s, i).buffs || {}), ...IMMUN };
      const r = await t.play(s, 'Sickly Cheese', { hero: 0 });
      R.check('alle Helden echt giftimmun ⇒ unspielbar', r === false && t.pile(s, 'hand').includes('Sickly Cheese') && !spielbar(t, s), { r });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // (c) eigene Helden giftimmun, aber ein dauerhaft übernommener Gegnerheld vergiftbar ⇒ spielbar, er wird gewählt
      const t = await aufbau(s, 'dauerhaft');
      for (let i = 0; i < 3; i++) t.hero(s, i).buffs = { ...(t.hero(s, i).buffs || {}), ...IMMUN };
      t.targetFn = (valid) => [valid.find(v => v.owner === o && v.heroIdx === 0 && !v.ineligible).id];
      const r = await t.play(s, 'Sickly Cheese', { hero: 0 });
      R.check(`eigene Helden giftimmun + dauerhaft übernommener ${o}:0 ⇒ spielbar, ${o}:0 wird vergiftet, Accusation auf der Hand`, r === true && !!t.hero(o, 0).statuses?.poisoned && t.pile(s, 'hand').includes('Accusation'), { r });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // (d) eigener Held an den Gegner abgegeben: zählt nicht als Ziel (Kontrolle), der Rest bleibt wählbar
      const t = await aufbau(s, 'normal');
      await t.run(() => t.engine.actionTakeHeroPermanently(o, s, 0)); await sleep(250);
      const l = ziele(t, s);
      R.check(`abgegebener eigener Held ${s}:0 ist kein Ziel; ${s}:1/${s}:2 wählbar`, !eintrag(l, s, 0) && !eintrag(l, s, 1)?.ineligible && !eintrag(l, s, 2)?.ineligible, l); }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
