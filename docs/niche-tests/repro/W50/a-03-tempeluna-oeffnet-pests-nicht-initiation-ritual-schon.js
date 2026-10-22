'use strict';
// W50a · Punkt 3 · Al, 22.10.2026: „Initiation Ritual ja (Hero wird als Equip-Artifact behandelt), Tempeluna aber nicht!"
// Kartentexte: Initiation Ritual: „… equip it to another Hero you control … While a Hero is equipped via this effect, it is treated as an equippable Artifact."
//   Tempeluna: „You may once per turn attach a "Fairy" Hero from your hand to this Hero." Afflicted Pests: „Activate this Surprise when your opponent equips or attaches a card into a Hero's Support Zone."
// Erwartung (beide Sitze, Pests liegt beim Gegner des Anlegers): Initiation Ritual öffnet das Equip-Fenster; Tempeluna (Fee anhängen) öffnet es NICHT, die Fee liegt trotzdem
// angehängt in der Support Zone und der Effekt geht über. Gegenprobe Tempeluna ohne Pests: Anhängen funktioniert. Exit 0 = korrekt (auf W49 ✗ bei Tempeluna).
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PESTS = 'Afflicted Pests';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const pestsGefragt = (t) => t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d)));
const pestsAktiv = (t) => pestsGefragt(t) || t.inst(c => c.name === PESTS && c.zone === 'support').length > 0;
const stuetz = (t, s, hi) => (t.gs.players[s].supportZones[hi] || []).flat();

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' legt an, Pests bei Sitz ' + op);
    const mit = (t) => {
      t.putSurprise(op, 0, PESTS); t.grantFor(op, 0, PESTS); t.put(op, 0, 0, H.INERT.creature);
      const vorher = t.targetFn;
      t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorher ? vorher(v, cfg) : undefined);
    };

    // Initiation Ritual: öffnet das Fenster (der gefallene Held wird als Equip-Artifact behandelt)
    { const t = await H.fresh({ hand: me === 0 ? [['Initiation Ritual'], []] : [[], ['Initiation Ritual']], gold: [100, 100], ...(me ? { active: 1 } : {}), abilities: { [me]: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
      mit(t);
      const gefallen = t.hero(me, 1).name;
      await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: op }, t.hero(me, 1), 9999, 'true'));
      t.gs.turn = 7; t.hero(me, 1).diedOnTurn = 5;
      const r = await t.play(me, 'Initiation Ritual', { noAutoConfirm: true });
      let pt = t.gs.potionTargeting;
      const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
      if (v) await t.run(() => t.host.doConfirmPotion(t.room, me, { selectedIds: [v.id] }));
      pt = t.gs.potionTargeting;
      if (pt) { const w = (pt.validTargets || []).filter(x => !x.ineligible).find(x => x.heroIdx === 0 && (x.type === 'hero' || x.type === 'equip')); if (w) await t.run(() => t.host.doConfirmPotion(t.room, me, { selectedIds: [w.id] })); }
      R.check('Initiation Ritual: Gefallener liegt als Ausrüstung am lebenden Helden', r === true && stuetz(t, me, 0).includes(gefallen), { r, zone: stuetz(t, me, 0) });
      R.check('Initiation Ritual: Afflicted Pests des Gegners öffnet (Hero = Equip-Artifact)', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check('Initiation Ritual: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // Tempeluna: Fee anhängen öffnet das Fenster NICHT
    const aufbau = async () => {
      const heroes = [null, null]; heroes[me] = ['Tempeluna, the Convergence Fairy', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
      const t = await H.fresh({ heroes, hand: me === 0 ? [['Maya, the Nature Fairy'], []] : [[], ['Maya, the Nature Fairy']], deckSize: 30, ...(me ? { active: 1 } : {}) });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Maya, the Nature Fairy', source: 'hand' }) });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      return t;
    };
    { const t = await aufbau(); mit(t); t.reset();
      const r = await t.activateHero(me, 0, {});
      R.check('Tempeluna: Maya wurde angehängt (liegt in der Support Zone, Effekt geht über)', r === true && stuetz(t, me, 0).includes('Maya, the Nature Fairy'), { r, z: stuetz(t, me, 0) });
      R.check('Tempeluna: Afflicted Pests öffnet NICHT', !pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check('Tempeluna: keine Engine-Fehler (die Audit-Meldung zu den Geister-Instanzen Luna/Tempeste stammt vom Harness-Aufbau mit onGameStart, nicht vom Anhängen)', t.errors.length === 0, t.errors); }
    { const t = await aufbau(); t.reset();   // ohne Pests: Anhängen funktioniert wie gehabt
      const r = await t.activateHero(me, 0, {});
      R.check('Tempeluna ohne Pests: Maya angehängt', r === true && stuetz(t, me, 0).includes('Maya, the Nature Fairy') && t.errors.length === 0, { r, z: stuetz(t, me, 0), e: t.errors }); }
  }
  R.finish();
})();
