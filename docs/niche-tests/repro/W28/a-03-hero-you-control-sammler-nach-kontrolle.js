'use strict';
// W28a · Audit „you control = aktuelle Kontrolle (Kontrolleur), nie Besitzer" · Al, 21.10.2026: „'you control' bezieht sich IMMER auf aktuelle Kontrolle, also Kontrolleur und nicht Besitzer."
// Karten mit „Choose a Hero you control …" (Wirt-/Zielsammler): Elixir of Cold, Elixir of Strength, Future Tech Doping, Divine Gift of Skill, Torchure, Sickly Cheese, The Yeeting, Mana Absorbing Crystal.
// Regel: angeboten werden die Helden, die der Spieler GERADE KONTROLLIERT — ein an den Gegner abgegebener eigener Held (dauerhaft oder gecharmt) NICHT, ein übernommener Gegnerheld (dauerhaft/temporär) JA.
//   Die Wirkung landet beim gewählten Helden auf SEINER Brettseite (Divine Gift of Skill: übernommener Gegnerheld bleibt ausgenommen — Bonus-Zähler nach Index der eigenen Spalte, gemeldet).
// Aufbau: Sitz 0 mit drei Helden 0:0/0:1/0:2, Sitz 1 mit 1:0. Zustände von Held 0:0 bzw. 1:0: normal · abgegeben (dauerhaft / temporär) · übernommen (dauerhaft / temporär).
// Aufruf: node docs/niche-tests/repro/W28/a-03-hero-you-control-sammler-nach-kontrolle.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ZUSTAENDE = ['normal', 'abgegeben-dauerhaft', 'abgegeben-temporaer', 'uebernommen-dauerhaft', 'uebernommen-temporaer'];

async function aufbau(karte, z, o = {}) {
  const t = await H.fresh({ hand: [[karte, ...(o.hand || [])], []], deckSize: 30, deck: [o.deck || Array(30).fill('Fireball'), Array(30).fill('Fireball')], discard: [o.discard || [], []] });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of the Forgotten', 800); t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  t.put(1, 2, 0, H.INERT.creature);   // irgendeine Nicht-Helden-Karte auf dem Brett (The Yeeting)
  if (!o.keinGrant) for (const hi of [0, 1, 2]) t.grantFor(0, hi, karte);
  if (z === 'abgegeben-dauerhaft') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (z === 'abgegeben-temporaer') { await t.engine.actionStealHero(1, 0, 0); await sleep(250); }
  if (z === 'uebernommen-dauerhaft') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  if (z === 'uebernommen-temporaer') { await t.engine.actionStealHero(0, 1, 0); await sleep(250); }
  return t;
}
// UMGESTELLT in W31a (Al, 22.10.2026: „Doch, auch temporäre Heroes sind mögliche Ziele, auch wenn der Schaden verpufft"): ein TEMPORÄR übernommener Gegnerheld (Charme) ist auch bei
// den Karten mit Kosten am Helden (Torchure, The Yeeting, Mana Absorbing Crystal, Sickly Cheese) ein gültiges Ziel (W28a schloss ihn aus); die Wirkung verpufft (s. `W31/a-01`).
const erwartet = (z, fremdOk = true, gift = false) => {
  if (z === 'normal') return ['0:0', '0:1', '0:2'];
  if (z.startsWith('abgegeben')) return ['0:1', '0:2'];
  return fremdOk ? ['0:0', '0:1', '0:2', '1:0'] : ['0:0', '0:1', '0:2'];
};
const adr = (valid) => valid.filter(v => v.type === 'hero').map(v => `${v.owner}:${v.heroIdx}`).sort();
const gleich = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...b].sort());

// Karten mit Heldenwahl über die Standard-Zielwahl: Name · Optionen · Wirkungsprüfung am gewählten Helden (Brettseite 1, Held 0 / Brettseite 0, Held 1)
const KARTEN = [
  { name: 'Elixir of Cold', wirkt: (t, s, h) => !!t.hero(s, h).buffs?.cold_strike },
  { name: 'Elixir of Strength', wirkt: (t, s, h) => !!t.hero(s, h).buffs?.empowered_strike },
  { name: 'Future Tech Doping', discard: ['Future Tech Gun', 'Future Tech Bazooka'], wirkt: (t, s, h) => t.hero(s, h).maxHp === 860 },
  { name: 'Divine Gift of Skill', fremdOk: false, wirkt: (t, s, h) => (t.gs.players[0]._bonusAbilityAttachments || {})[h] === 4 },
  { name: 'Torchure', gift: true, wirkt: (t, s, h) => !!t.hero(s, h).statuses?.poisoned },
  { name: 'Sickly Cheese', gift: true, deck: ['Accusation'], wirkt: (t, s, h) => !!t.hero(s, h).statuses?.poisoned },
  { name: 'The Yeeting', gift: true, wirkt: (t, s, h) => t.hp(s, h) === 650 },
];

(async () => {
  const R = H.runner();
  for (const k of KARTEN) {
    for (const z of ZUSTAENDE) {
      R.section(`${k.name} · ${z}`);
      const t = await aufbau(k.name, z, { discard: k.discard, deck: k.deck ? k.deck.concat(Array(25).fill('Fireball')) : null });
      let angeboten = null;
      t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
      t.policy.cancelTargets = true;
      const r = await t.play(0, k.name, { hero: 1 });
      const soll = erwartet(z, k.fremdOk !== false, !!k.gift);
      R.check(`${k.name} / ${z}: angeboten ${soll.join(', ')}`, gleich(angeboten, soll), { angeboten, r });
      R.check(`${k.name} / ${z}: nach Abbruch nichts verbraucht (Karte auf der Hand)`, t.pile(0, 'hand').includes(k.name) || r === false, t.pile(0, 'hand'));
      R.check(`${k.name} / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
    }
    // Wirkung am übernommenen Gegnerhelden (Brettseite 1) bzw. am eigenen Helden 0:2
    if (k.fremdOk !== false) {
      for (const z of (k.gift ? ['uebernommen-dauerhaft'] : ['uebernommen-dauerhaft', 'uebernommen-temporaer'])) {
        const t = await aufbau(k.name, z, { discard: k.discard, deck: k.deck ? k.deck.concat(Array(25).fill('Fireball')) : null });
        t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0); return [(h || valid[0]).id]; };   // 2. Wahl (The Yeeting: Brettkarte) = erste angebotene
        const r = await t.play(0, k.name, { hero: 1 });
        R.check(`${k.name} / ${z}: Wirkung landet beim übernommenen Gegnerhelden 1:0`, k.wirkt(t, 1, 0), { r, buffs: Object.keys(t.hero(1, 0).buffs || {}), st: Object.keys(t.hero(1, 0).statuses || {}), hp: t.hp(1, 0), max: t.hero(1, 0).maxHp });
        R.check(`${k.name} / ${z}: Wirkung NICHT beim gleich indizierten eigenen Helden 0:0`, !k.wirkt(t, 0, 0) || k.name === 'The Yeeting' && t.hp(0, 0) === 800, { buffs: Object.keys(t.hero(0, 0).buffs || {}), hp: t.hp(0, 0) });
        R.check(`${k.name} / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
      }
    }
    { const t = await aufbau(k.name, 'normal', { discard: k.discard, deck: k.deck ? k.deck.concat(Array(25).fill('Fireball')) : null });
      t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 2); return [(h || valid[0]).id]; };
      const r = await t.play(0, k.name, { hero: 1 });
      R.check(`${k.name} / normal: Wirkung beim gewählten eigenen Helden 0:2 (Gegenprobe)`, k.wirkt(t, 0, 2), { r });
      R.check(`${k.name} / normal: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }

  R.section('Mana Absorbing Crystal (Handaktivierung)');
  for (const z of ZUSTAENDE) {
    const t = await aufbau('Mana Absorbing Crystal', z, { keinGrant: true });
    let angeboten = null;
    t.targetFn = (valid) => { if (!angeboten) angeboten = adr(valid); return null; };
    t.phase(2);   // Handaktivierung nur in einer Main Phase
    await t.run(() => t.engine.doHandActivate(0, 'Mana Absorbing Crystal', 0));
    R.check(`Mana Absorbing Crystal / ${z}: angeboten ${erwartet(z, true, true).join(', ')}`, gleich(angeboten, erwartet(z, true, true)), { angeboten, prompts: t.prompts.map(p => p.d.type) });
    R.check(`Mana Absorbing Crystal / ${z}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  { const t = await aufbau('Mana Absorbing Crystal', 'uebernommen-dauerhaft', { keinGrant: true });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.phase(2);
    await t.run(() => t.engine.doHandActivate(0, 'Mana Absorbing Crystal', 0));
    R.check('Mana Absorbing Crystal / übernommen: 200 Selbstschaden beim Gegnerhelden 1:0, der gleich indizierte eigene 0:0 bleibt heil', t.hp(1, 0) === 600 && t.hp(0, 0) === 800, [t.hp(1, 0), t.hp(0, 0)]);
    R.check('Mana Absorbing Crystal / übernommen: Karte gelöscht', !t.pile(0, 'hand').includes('Mana Absorbing Crystal') && t.pile(0, 'deletedPile').includes('Mana Absorbing Crystal'), { hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

  R.finish();
})();
