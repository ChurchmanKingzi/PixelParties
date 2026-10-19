'use strict';
// A02-deepsea-25 · Deepsea Monstrosity kopiert Deepsea Siren: die Verknüpfung wird gesetzt, wirkt aber nie
//
// Kartentext (Monstrosity): „When you summon this Creature, you may choose one of your other "Deepsea" Creatures in play.
// Add it back to your hand. Then, this Creature activates that Creature's on-summon effect as if it was its own."
// Kartentext (Siren): „When you summon this Creature, choose any target on the board. Any damage this Creature takes is also
// applied to that target. When this Creature is defeated by an opponent's card or effect, also defeat the chosen target."
// Die beiden Folgesätze hängen am Einsatz-Effekt (sie beschreiben, was die Wahl bedeutet). Das Skript der Monstrosity ruft nur
// `copiedScript.hooks.onPlay` auf: Der Einsatz-Teil läuft (Zielwahl, Link-Marken auf der Monstrosity-Instanz), die Wirkung
// (`beforeCreatureDamageBatch`, Tod-Teil) liegt aber im Hook-Satz der Siren und fehlt der Monstrosity.
//
// Aufbau: Seat 0: Siren (Held 1, eine Runde alt), Monstrosity auf der Hand; Seat 1: Dummy Big (Ziel der Verknüpfung).
// Schritte: Monstrosity normal beschwören, Siren bouncen/kopieren, Dummy Big als Ziel; danach 30 Schaden auf Monstrosity.
// Erwartung: Die Monstrosity ist mit dem Dummy verknüpft: der Dummy nimmt die 30 Schaden mit.
// Beobachtet: Die Monstrosity trägt `sirenLinked`/`_sirenLink*`, nimmt 30 Schaden, der Dummy bleibt unverletzt; bei Tod der Monstrosity
// lebt der Dummy.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Deepsea Monstrosity'], []], deck: [['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  const x = t.put(0, 1, 0, 'Deepsea Siren'); x.turnPlayed = 1;
  const victim = t.put(1, 0, 0, H.INERT.big); victim.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.owner === 1 && v.type === 'equip').id];
  t.script.push({ match: d => d.type === 'zonePick' && /Monstrosity/.test(d.title || ''), answer: (d) => { const z = d.zones.find(z => /Siren/.test(z.label)) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  await t.play(0, 'Deepsea Monstrosity', { hero: 0, slot: 0 });
  const m = t.find('Deepsea Monstrosity', 'support');
  R.check('Vorbedingung: Monstrosity steht auf dem Brett, Siren ist auf der Hand', !!m && t.pile(0, 'hand').includes('Deepsea Siren'), { hand: t.pile(0, 'hand') });
  R.note('Link-Marken auf der Monstrosity', Object.keys(m.counters).filter(k => /siren/i.test(k)));
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, m, 30, 'creature', { sourceOwner: 1 }));
  R.check('Der verknüpfte Dummy nimmt die 30 Schaden der Monstrosity mit', (victim.counters.currentHp ?? 1000) === 970, { monstrosity: m.counters.currentHp, dummy: victim.counters.currentHp ?? 1000 });
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Src', owner: 1 }, m, 500, 'creature', { sourceOwner: 1 }));
  // ★ W16b: ein per Schaden gestorbenes Ziel behält am Objekt `zone === 'support'` — gemessen wird wie in 27 an der Instanzliste der Engine.
  const dummyLebt = t.engine.cardInstances.includes(victim) && victim.zone === 'support';
  R.check('Stirbt die Monstrosity durch den Gegner, stirbt auch der Dummy', !dummyLebt, { dummyZone: victim.zone, getrackt: t.engine.cardInstances.includes(victim) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
