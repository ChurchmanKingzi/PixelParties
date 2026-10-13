'use strict';
// C05-creatures-05 · Water Golem nimmt beim Abgang auch eine FREMDE Negierung des Ziels mit (Stowaway wird dabei gelöscht)
// Kartentext (Water Golem): „… choose a target your opponent controls. While this Creature remains on the board, that target's effects are negated."
//   Kartentext (Stowaway): „… if the status effect it inflicted is removed from the corresponding Hero, it is deleted."
// Erwartung: Der Golem nimmt nur SEINE eigene Negierung zurück. Eine Negierung, die ein anderer Effekt gelegt hat (Stowaway, Decisive Defeat,
//   Null …), bleibt, wenn der Golem geht; ein Stowaway-Wirt bleibt also negiert und der Stowaway auf dem Brett.
// Beobachtet: Der Golem legt keine eigene Negierung an, wenn das Ziel schon negiert ist (water-golem.js ~58). Beim Abgang ruft `negationLoesen`
//   `removeHeroStatus(…, 'negated', { bypassUnhealable: true })` trotzdem auf und entfernt die FREMDE Negierung; der Stowaway reagiert darauf und
//   wird gelöscht. Dieselbe Folge bei einer zeitlich begrenzten Fremd-Negierung (z. B. Null): sie ist mit dem Golem sofort weg statt erst zum Zugende.
// Ursache: `cards/effects/water-golem.js:85-87` prüft nicht, ob die vorhandene `negated`-Marke vom Golem stammt (`source === 'Water Golem'` / `sourceBound`);
//   für Kreaturen-Ziele entsprechend Z. 88-91 (`delete counters.negated`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WG = 'Water Golem';
  const SRC = { name: 'Test', owner: 1 };
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  async function trigger(t) {          // Golem wird durch das Ablegen einer eigenen Surprise (Glass Wall) per Effekt ausgelöst
    t.grantFor(0, 0, WG);
    t.putSurprise(0, 0, WG);
    const gw = t.putSurprise(0, 1, 'Glass Wall');
    await t.run(() => t.engine.actionMoveCard(gw, 'discard', -1, -1, { source: 'Test', sourceOwner: 1 }));
  }

  R.section('A) Ziel = Wirt eines Stowaway (Negierung durch den Stowaway)');
  let t = await H.fresh({ hand: [[], ['Stowaway']] });
  await t.play(1, 'Stowaway', { hero: 0, slot: 0 });
  R.check('Aufbau: Held 1/0 durch Stowaway negiert', !!t.hero(1, 0).statuses.negated && !!t.find('Stowaway', 'support'));
  t.gs.activePlayer = 0;
  t.targetFn = pickHero(1, 0);
  await trigger(t);
  const g = t.find(WG, 'support');
  R.check('Aufbau: Golem liegt, Ziel gewählt', !!g && !!g.counters._golemTarget, g && g.counters);
  await t.engine.actionDestroyCard(SRC, g);
  R.check('Golem weg: Stowaway-Negierung bleibt', !!t.hero(1, 0).statuses.negated, Object.keys(t.hero(1, 0).statuses));
  R.check('Golem weg: Stowaway liegt noch auf dem Brett', !!t.find('Stowaway', 'support'), t.pile(1, 'deletedPile'));

  R.section('B) Ziel mit zeitlich begrenzter Fremd-Negierung (duration 1, z. B. Null)');
  t = await H.fresh({});
  t.targetFn = pickHero(1, 0);
  await t.engine.addHeroStatus(1, 0, 'negated', { duration: 1, appliedBy: 0 });
  await trigger(t);
  await t.engine.actionDestroyCard(SRC, t.find(WG, 'support'));
  R.check('Golem weg: fremde (zeitlich begrenzte) Negierung läuft weiter', !!t.hero(1, 0).statuses.negated, Object.keys(t.hero(1, 0).statuses));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
