'use strict';
// W16b · A01-pollution-09 (Erweiterung) · Warrior of Teocuilatl: das Schutzfenster vor Status-Effekten lässt ein „Nein" zu
// Kartentext: „Whenever a Creature either player controls would be affected by a card or effect, you may remove 1 Doom Counter … to negate all effects …"
// (a) „Nein" (Abbruch der Optionswahl / Ablehnen): Cold Coffin friert die Kreatur ein, die Uhr behält alle Counter.
// (b) Eine Kreatur OHNE Warrior auf dem Brett wird ohne Rückfrage gefroren (kein Angebot ohne Warrior).
// (c) Ohne Doom Counter auf der Uhr entfällt das Angebot.
const H = require('../../lib/h.js');
const tgt = (v) => [v.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0 && x.slotIdx === 0).id];
(async () => {
  const R = H.runner();

  R.section('(a) Nein');
  {
    const t = await H.fresh({ hand: [['Cold Coffin'], []] });
    const uhr = t.putArea(0, 'Doom Clock'); uhr.counters.doom = 5;
    t.put(1, 0, 0, 'Soul Shard Ba'); t.put(1, 0, 1, 'Warrior of Teocuilatl');
    t.targetFn = tgt;
    t.script.push({ match: d => d && d.type === 'confirm' && d.title === 'Warrior of Teocuilatl', answer: () => null });   // echtes „Nein"
    await t.play(0, 'Cold Coffin', { hero: 0 });
    const ba = t.find('Soul Shard Ba', 'support');
    R.check('Warrior hat angeboten', t.prompts.some(p => p.d.title === 'Warrior of Teocuilatl'), t.prompts.map(p => p.d.title));
    R.check('„Nein": Ba ist gefroren', !!ba && !!ba.counters.frozen, ba && ba.counters);
    R.check('„Nein": Uhr behält 5 Counter', uhr.counters.doom === 5, uhr.counters.doom);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b) ohne Warrior kein Angebot');
  {
    const t = await H.fresh({ hand: [['Cold Coffin'], []] });
    const uhr = t.putArea(0, 'Doom Clock'); uhr.counters.doom = 5;
    t.put(1, 0, 0, 'Soul Shard Ba');
    t.targetFn = tgt;
    await t.play(0, 'Cold Coffin', { hero: 0 });
    const ba = t.find('Soul Shard Ba', 'support');
    R.check('kein Warrior-Angebot', !t.prompts.some(p => p.d.title === 'Warrior of Teocuilatl'), t.prompts.map(p => p.d.title));
    R.check('Ba gefroren', !!ba && !!ba.counters.frozen, ba && ba.counters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(c) Uhr ohne Counter');
  {
    const t = await H.fresh({ hand: [['Cold Coffin'], []] });
    const uhr = t.putArea(0, 'Doom Clock'); uhr.counters.doom = 0;
    t.put(1, 0, 0, 'Soul Shard Ba'); t.put(1, 0, 1, 'Warrior of Teocuilatl');
    t.targetFn = tgt;
    await t.play(0, 'Cold Coffin', { hero: 0 });
    const ba = t.find('Soul Shard Ba', 'support');
    R.check('kein Angebot ohne Counter', !t.prompts.some(p => p.d.title === 'Warrior of Teocuilatl'), t.prompts.map(p => p.d.title));
    R.check('Ba gefroren', !!ba && !!ba.counters.frozen, ba && ba.counters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
