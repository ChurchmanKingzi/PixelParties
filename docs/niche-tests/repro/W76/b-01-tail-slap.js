'use strict';
// W76b-01 · Tail Slap (Attack Normal Lv1, Fighting)
// „Your opponent may defeat any number of Creatures they control. Then, choose a target and deal damage equal to the attacker's Attack stat to it. That damage is increased by 50 for every Creature your opponent controls."
const H = require('../../lib/h.js');
const CARD = 'Tail Slap';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], deckSize: 20, gold: [100, 100], active: 0 });
  t.grantFor(0, 0, CARD);
  t.hero(0, 0).atk = o.atk ?? 40;
  const kinder = [];
  for (let i = 0; i < (o.kreaturen ?? 2); i++) kinder.push(t.put(1, i % 3, i < 3 ? 1 : 2, H.INERT.creature, { counters: { currentHp: 100, maxHp: 100 } }));
  t.opfer = o.opfer || [];                                     // Indizes der Kreaturen, die der Gegner besiegt
  t.targetFn = (valid, config) => {
    if (config && config._tailSlapOpfer) return t.opfer.map(i => valid.find(v => v.cardInstance === kinder[i])).filter(Boolean).map(v => v.id);
    const h = valid.find(v => v.id === 'hero-1-0');
    return h ? [h.id] : undefined;
  };
  return { t, kinder };
}

(async () => {
  const R = H.runner();

  R.section('A · Schaden = ATK + 50 je Creature des Gegners (nach seinem Opfer)');
  for (const [anz, opfer, erwartet] of [[0, [], 40], [2, [], 140], [3, [], 190], [3, [0], 140], [3, [0, 1, 2], 40], [2, [1], 90]]) {
    const { t, kinder } = await aufbau({ kreaturen: anz, opfer });
    const hp0 = t.hp(1, 0);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check(`${anz} Creature(s), ${opfer.length} geopfert → Schaden ${erwartet}`, hp0 - t.hp(1, 0) === erwartet, [hp0, t.hp(1, 0)]);
    R.check(`${anz} Creature(s), ${opfer.length} geopfert: genau diese Creatures sind besiegt`, kinder.every((k, i) => (k.zone !== 'support') === opfer.includes(i)), kinder.map(k => k.zone));
    R.check('sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Details: Angebot an den GEGNER; Abbruch/„keine"; Rammen rückwärts; Karte verbraucht');
  {
    const { t } = await aufbau({ kreaturen: 2, opfer: [] });
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const tp = t.targets.find(x => x.config && x.config._tailSlapOpfer);
    R.check('der Gegner (Sitz 1) bekam die Opfer-Wahl', !!tp && tp.who === 1, tp && tp.who);
    R.check('… mit beiden Creatures als Kandidaten', tp && tp.valid.length === 2, tp && tp.valid.length);
    const ram = t.evs('play_ram_animation').find(e => e.rueckwaerts === true);
    R.check('Rammen RÜCKWÄRTS (`rueckwaerts: true`) vom Angreifer (0:0) ins Ziel (1:0)', !!ram && ram.sourceOwner === 0 && ram.sourceHeroIdx === 0 && ram.targetOwner === 1 && ram.targetHeroIdx === 0, ram);
    R.check('Aufprall-Bild tail_slap_hit am Ziel', t.evs('play_zone_animation').some(e => e.type === 'tail_slap_hit' && e.owner === 1 && e.heroIdx === 0));
    R.check('Karte liegt in der Ablage', t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
  }
  {
    // Ziel kann auch eine Creature sein
    const { t, kinder } = await aufbau({ kreaturen: 2, opfer: [] });
    t.targetFn = (valid, config) => {
      if (config && config._tailSlapOpfer) return [];
      const k = valid.find(v => v.cardInstance === kinder[0]);
      return k ? [k.id] : undefined;
    };
    kinder[0].counters.currentHp = 300; kinder[0].counters.maxHp = 300;
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('Creature als Ziel: 40 + 100 = 140 Schaden (300 → 160)', kinder[0].counters.currentHp === 160, kinder[0].counters.currentHp);
  }
  {
    // Cardinal-Beast-geschützte Creature wird nicht zum Opfer angeboten und zählt weiter mit
    const { t } = await aufbau({ kreaturen: 1, opfer: [] });
    const geschuetzt = t.put(1, 2, 1, H.INERT.creature, { counters: { _cardinalImmune: 1, currentHp: 100, maxHp: 100 } });
    const hp0 = t.hp(1, 0);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    const tp = t.targets.find(x => x.config && x.config._tailSlapOpfer);
    R.check('geschützte Creature nicht angeboten (nur 1 Kandidat)', tp && tp.valid.length === 1, tp && tp.valid.length);
    R.check('… zählt aber für die +50 (40 + 100)', hp0 - t.hp(1, 0) === 140, [hp0, t.hp(1, 0)]);
  }
  {
    // Eigene Creatures des Angreifers zählen nicht
    const { t } = await aufbau({ kreaturen: 0, opfer: [] });
    t.put(0, 1, 1, H.INERT.creature, { counters: { currentHp: 100, maxHp: 100 } });
    const hp0 = t.hp(1, 0);
    await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('eigene Creature zählt nicht: nur 40', hp0 - t.hp(1, 0) === 40, [hp0, t.hp(1, 0)]);
    R.check('keine Opfer-Wahl ohne Creatures des Gegners', !t.targets.some(x => x.config && x.config._tailSlapOpfer), t.targets.length);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
