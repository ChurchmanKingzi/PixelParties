'use strict';
// W12 / Q89 (F01-09) · Blood-Soaked Coin: dauerhaft KONTROLLIERTE Ziele zählen (Al: „Ja, dauerhafte Kontrolle via z.B. Dark Gear oder Paraseed Control zählt!")
// Kartentext: „Choose a target you permanently control and deal up to 300 damage to it. You gain 1 Gold for every 10 points of damage dealt by this effect. …"
// (a) Dark-Gear-Kreatur (controller/owner = Sitz 0, originalOwner = Sitz 1) ist wählbar, Schaden und Gold laufen.
// (b) Paraseed-Held (`permaControlBy` = 0, steht in der Spalte von Sitz 1) ist wählbar.
// (c) Gegenproben: vorübergehend gestohlene Kreatur (`actionStealCreature`) und vorübergehend gecharmter Gegnerheld sind NICHT wählbar; eigene Karten bleiben wählbar.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // (a)
    const t = await H.fresh({ hand: [['Blood-Soaked Coin', 'Dark Gear'], []], gold: [100, 100] });
    t.put(1, 0, 0, 'Albrecht, the Nerd');
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    await t.play(0, 'Dark Gear', { hero: 0 });
    const inst = t.find('Albrecht, the Nerd', 'support');
    let seen = null;
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'equip').map(v => v.cardName); const v = valid.find(x => x.cardName === 'Albrecht, the Nerd'); return v ? [v.id] : null; };
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'dmg-10' }) });
    const g0 = t.gs.players[0].gold;
    await t.play(0, 'Blood-Soaked Coin', { hero: 0 });
    R.check('(a) Dark-Gear-Kreatur (owner ' + inst.owner + ', originalOwner ' + inst.originalOwner + ') ist Coin-Ziel', (seen || []).includes('Albrecht, the Nerd'), seen);
    R.check('(a) 10 Schaden → +1 Gold', t.gs.players[0].gold === g0 + 1, { g0, g: t.gs.players[0].gold });
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b)
    const t = await H.fresh({ hand: [['Blood-Soaked Coin'], []], gold: [30, 100] });
    await t.engine.actionTakeHeroPermanently(0, 1, 0, {});
    let seen = null;
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'hero').map(v => v.owner + '/' + v.heroIdx); const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'dmg-50' }) });
    const hp = t.hp(1, 0), g0 = t.gs.players[0].gold;
    await t.play(0, 'Blood-Soaked Coin', { hero: 0 });
    R.check('(b) dauerhaft übernommener Held (permaControlBy ' + t.hero(1, 0).permaControlBy + ') ist Coin-Ziel', (seen || []).includes('1/0'), seen);
    R.check('(b) 50 Schaden am übernommenen Helden, +5 Gold', t.hp(1, 0) === hp - 50 && t.gs.players[0].gold === g0 + 5, { hp: t.hp(1, 0), gold: t.gs.players[0].gold });
    R.check('(b) eigene Helden 0/1 bleiben wählbar', (seen || []).includes('0/0'), seen);
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (c)
    const t = await H.fresh({ hand: [['Blood-Soaked Coin'], []], gold: [30, 100] });
    const feind = t.put(1, 0, 0, H.INERT.creature);
    const eigene = t.put(0, 0, 0, H.INERT.big);
    t.engine.actionStealCreature(0, feind);          // vorübergehend (stolenBy)
    t.hero(1, 1).charmedBy = 0;                      // vorübergehender Charme (kein permaControlBy)
    let seen = null;
    t.targetFn = (valid) => { seen = valid.map(v => v.id); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, 'Blood-Soaked Coin', { hero: 0 });
    R.check('(c) vorübergehend gestohlene Kreatur nicht wählbar', !(seen || []).some(id => id === `equip-${feind.owner}-${feind.heroIdx}-${feind.zoneSlot}`), seen);
    R.check('(c) vorübergehend gecharmter Held nicht wählbar', !(seen || []).includes('hero-1-1'), seen);
    R.check('(c) eigene Kreatur und eigene Helden wählbar', (seen || []).includes(`equip-0-0-${eigene.zoneSlot}`) && (seen || []).includes('hero-0-0'), seen);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
