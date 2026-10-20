'use strict';
// W33a · Punkt 2 · Al, 22.10.2026 (Antwort auf die offene Frage aus W31a, Abschnitt 4): „Reaction-Creatures gelten als Actions (auch wenn sie keine Actions (die Ressource) kosten), diese können
//   also unter bound nicht gespielt werden." → IST-ZUSTAND BESTÄTIGT, hier abgesichert.
// REGEL: Hand-Reaktions-Kreaturen (Doomed Town Guard, Explosive Drone, Enhanced Guard Dog, Ethan the Prodigy, Chaorc Rider Warg) gelten als Actions („as an additional Action"): ein Held mit `bound`
//   („cannot perform an Action") beschwört sie nicht – ihre eigenen Prüfungen (Schule/Stufe, Frozen/Stunned/Webbed, Summon-Sperren) bleiben. Creature-SURPRISES dagegen sind keine Actions
//   (W31a): `bound` sperrt sie nicht (W31/a-04, hier als Gegenprobe im selben Aufbau).
// Aufbau je Seite s (0/1): die Reaktionskreatur liegt auf der Hand von s; alle drei Helden von s tragen `bound` bzw. nur Held 1/2 (Held 0 frei → nur seine Zonen werden angeboten).
// Aufruf: node docs/niche-tests/repro/W33/a-02-reaktionskreaturen-sind-actions-unter-bound.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const D = H.INERT.creature;
const SM3 = [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []];

// [Name, Szene (Auslöser) — s = Seite des Halters, o = Gegner]
const KARTEN = [
  ['Doomed Town Guard', async (t, s, o) => { const c = t.put(s, 0, 0, D); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: o }, c)); }],
  ['Explosive Drone', async (t, s, o) => { const c = t.put(s, 0, 0, D); c.turnPlayed = 1; t.put(o, 0, 0, H.INERT.big); await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: o }, c)); }],
  ['Enhanced Guard Dog', async (t, s, o) => { const c = t.put(s, 0, 0, D); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: o }, c)); }],
  ['Chaorc Rider Warg', async (t, s, o) => { const c = t.put(s, 0, 0, D); c.turnPlayed = 1; await t.run(() => t.engine.actionDestroyCard({ name: 'Quelle', owner: o }, c)); }],
  ['Ethan, the Prodigy', async (t, s) => {
    await t.run(() => t.engine.runHooks('afterSpellResolved', { spellName: 'Hymn of Rebirth', spellCardData: H.DB['Hymn of Rebirth'], heroIdx: 0, heroOwner: s, casterIdx: s, damageTargets: [], isSecondCast: false, _skipReactionCheck: true }));
  }],
];

async function lauf(name, szene, s, gebunden) {
  const o = 1 - s;
  const hand = [[], []]; hand[s] = [name];
  const t = await H.fresh({ hand, deck: [Array(10).fill(H.INERT.filler), Array(10).fill(H.INERT.filler)], active: o });
  for (let h = 0; h < 3; h++) t.setAbilities(s, h, SM3);
  for (const h of gebunden) t.heroStatus(s, h, 'bound');
  t.policy.confirm = true;
  const angebotene = [];
  t.script.push({ match: d => d.type === 'zonePick', answer: d => { for (const z of d.zones) angebotene.push(z.owner ?? s); angebotene.push('|'); return { heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }; } });
  t.targetFn = (v) => [v[0].id];
  await szene(t, s, o);
  const zonen = [];
  t.prompts.filter(p => p.d.type === 'zonePick').forEach(p => p.d.zones.forEach(z => zonen.push(z.heroIdx)));
  return { t, da: !!t.find(name, 'support'), zonenHelden: [...new Set(zonen)] };
}

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) for (const [name, szene] of KARTEN) {
    R.section(`${name} · Halter Sitz ${s}`);
    { const { t, da } = await lauf(name, szene, s, []);
      R.check(`${name}: Gegenprobe – ohne bound wird beschworen`, da, null);
      R.check(`${name}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { const { t, da } = await lauf(name, szene, s, [0, 1, 2]);
      R.check(`${name}: alle drei Helden bound → NICHT beschworen (Reaktions-Kreatur gilt als Action)`, !da && t.pile(s, 'hand').includes(name), { da, hand: t.pile(s, 'hand') });
      R.check(`${name}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
    { const { t, da, zonenHelden } = await lauf(name, szene, s, [1, 2]);
      R.check(`${name}: nur Held 0 frei (Held 1/2 bound) → beschworen, und nur über Held 0${zonenHelden.length ? ' (angebotene Zonen: Helden ' + zonenHelden.join(',') + ')' : ''}`,
        da && zonenHelden.every(h => h === 0) && !!t.find(name, 'support') && t.inst(i => i.name === name && i.zone === 'support').every(i => i.heroIdx === 0), { da, zonenHelden });
      R.check(`${name}: sauber`, sauber(t), { e: t.errors, a: t.audit() }); }
  }

  // Gegenprobe: Creature-SURPRISES sind keine Actions – bound sperrt sie nicht (W31a, Al: „Creature Surprises kosten und gelten als KEINE Actions!")
  R.section('Gegenprobe · Creature-Surprises unter bound');
  for (const s of [0, 1]) for (const name of ['Pure Advantage Camel', 'Cactus Creature', 'Afflicted Vermin', 'Jumper Spider', 'Man-Eater Birds', 'Mischief Militia - Banner Bearer']) {
    const t = await H.fresh({ hand: [[], []], deckSize: 30 });
    t.grantFor(s, 0, name); t.heroStatus(s, 0, 'bound');
    R.check(`${name} / Sitz ${s}: Kreatur-Surprise unter bound aktivierbar`, !!t.engine._canHeroActivateSurprise(s, 0, name, {}), null);
    R.check(`${name} / Sitz ${s}: sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
