'use strict';
// W18a · Punkt 3 · Al, 19.10.2026 (R01-05): „Nur eigene Ziele werden beschützt!" — Divine Gift of Rain: „Negate any effects that card or effect would have on
//   targets you control." Bei beidseitigen Flächenzaubern (Armageddon, Cataclysm, Snowstorm Mischief, Toxic Fumes …) schützt Rain NUR die Ziele des Reagierenden
//   (Helden UND Kreaturen); die Ziele des Wirkers werden weiter getroffen. Einseitige Zauber (alle Ziele gehören dem Reagierenden) bleiben GANZ negiert
//   (Fireball: Karte in der Ablage, nichts wirkt). Die Schwesterkarten Storm Ring / MOE Shield („Negate that Spell") negieren weiter den ganzen Zauber.
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const RAIN = 'Divine Gift of Rain', INERT = H.INERT.creature;
  const sauber = (t, w) => R.check(w + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  const hps = (t, s) => [0, 1, 2].map(h => t.hp(s, h));
  const kHp = (inst) => 200 - (inst.counters.currentHp !== undefined ? 200 - inst.counters.currentHp : 0);   // currentHp fehlt ohne Treffer = volle HP
  const schaden = (inst) => (inst.counters.currentHp === undefined ? 0 : 200 - inst.counters.currentHp);

  async function aufbau(src, rx) {
    const t = await H.fresh({ hand: [[src], rx ? [rx] : []] });
    if (rx) {
      t.grantFor(1, 0, rx);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    }
    const kEig = t.put(0, 1, 0, INERT);   // Kreatur des Wirkers (Sitz 0)
    const kGeg = t.put(1, 1, 0, INERT);   // Kreatur des Reagierenden (Sitz 1)
    return { t, kEig, kGeg };
  }

  R.section('Armageddon (50 Schaden an allen Zielen, auch dem Wirker)');
  {
    const { t, kEig, kGeg } = await aufbau('Armageddon', null);
    await t.play(0, 'Armageddon', { hero: 0 });
    R.check('Kontrolle ohne Reaktion: alle Helden -50, beide Kreaturen -50', hps(t, 0).every(x => x === 750) && hps(t, 1).every(x => x === 750) && schaden(kEig) === 50 && schaden(kGeg) === 50, { a: hps(t, 0), b: hps(t, 1), ke: kEig.counters.currentHp, kg: kGeg.counters.currentHp });
  }
  {
    const { t, kEig, kGeg } = await aufbau('Armageddon', RAIN);
    await t.play(0, 'Armageddon', { hero: 0 });
    R.check('Rain gespielt (Ablage Sitz 1, Einmal-Stempel gesetzt)', t.pile(1, 'discardPile').includes(RAIN) && t.gs.players[1]._oncePerGameUsed?.has('divineGift'), t.pile(1, 'discardPile'));
    R.check('Helden des Reagierenden (Sitz 1) unversehrt', hps(t, 1).every(x => x === 800), hps(t, 1));
    R.check('Kreatur des Reagierenden unversehrt', schaden(kGeg) === 0, kGeg.counters);
    R.check('Helden des Wirkers (Sitz 0) nehmen weiter 50', hps(t, 0).every(x => x === 750), hps(t, 0));
    R.check('Kreatur des Wirkers nimmt weiter 50', schaden(kEig) === 50, kEig.counters);
    R.check('Armageddon in der Ablage von Sitz 0 (gewirkt, nicht verpufft)', t.pile(0, 'discardPile').includes('Armageddon'), t.pile(0, 'discardPile'));
    sauber(t, 'Armageddon vs Rain');
    // kein Immunitäts-Leck: der Schutz endet mit der Auflösung (nächster Zug: normaler Schaden)
    t.gs._effectImmunities && R.check('Immunitäten nach der Auflösung geräumt', t.gs._effectImmunities.length === 0, t.gs._effectImmunities);
  }

  R.section('Cataclysm (100 Schaden an allen Zielen)');
  {
    const { t, kEig, kGeg } = await aufbau('Cataclysm', RAIN);
    await t.play(0, 'Cataclysm', { hero: 0 });
    R.check('Rain gespielt', t.pile(1, 'discardPile').includes(RAIN), t.pile(1, 'discardPile'));
    R.check('Helden des Reagierenden unversehrt', hps(t, 1).every(x => x === 800), hps(t, 1));
    R.check('Kreatur des Reagierenden unversehrt', schaden(kGeg) === 0, kGeg.counters);
    R.check('Helden des Wirkers nehmen weiter 100', hps(t, 0).every(x => x === 700), hps(t, 0));
    R.check('Kreatur des Wirkers nimmt weiter 100', schaden(kEig) === 100, kEig.counters);
    sauber(t, 'Cataclysm vs Rain');
  }

  R.section('Snowstorm Mischief / Toxic Fumes (nur Kreaturen, beide Seiten)');
  {
    const { t, kEig, kGeg } = await aufbau('Snowstorm Mischief', RAIN);
    await t.play(0, 'Snowstorm Mischief', { hero: 0 });
    R.check('Snowstorm vs Rain: Kreatur des Reagierenden nicht gefroren', !kGeg.counters.frozen, kGeg.counters);
    R.check('Snowstorm vs Rain: Kreatur des Wirkers gefroren', !!kEig.counters.frozen, kEig.counters);
    sauber(t, 'Snowstorm vs Rain');
  }
  {
    const { t, kEig, kGeg } = await aufbau('Toxic Fumes', RAIN);
    await t.play(0, 'Toxic Fumes', { hero: 0 });
    R.check('Toxic Fumes vs Rain: Kreatur des Reagierenden nicht vergiftet', !(kGeg.counters.poisonStacks || 0), kGeg.counters);
    R.check('Toxic Fumes vs Rain: Kreatur des Wirkers vergiftet', (kEig.counters.poisonStacks || 0) > 0, kEig.counters);
    sauber(t, 'Toxic Fumes vs Rain');
  }

  R.section('Einseitiger Zielzauber: Fireball auf zwei Ziele des Reagierenden → GANZ negiert (unverändert)');
  {
    const t = await H.fresh({ hand: [['Fireball'], [RAIN]] });
    t.grantFor(1, 0, RAIN);
    t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    const kGeg = t.put(1, 1, 0, INERT);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id, valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Rain gespielt', t.pile(1, 'discardPile').includes(RAIN), t.pile(1, 'discardPile'));
    R.check('Held und Kreatur unversehrt', t.hp(1, 0) === 800 && schaden(kGeg) === 0, { h: t.hp(1, 0), k: kGeg.counters });
    R.check('Fireball in der Ablage von Sitz 0', t.pile(0, 'discardPile').includes('Fireball'), t.pile(0, 'discardPile'));
    sauber(t, 'Fireball vs Rain');
  }
  {
    const t = await H.fresh({ hand: [['Fireball'], []] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Gegenprobe ohne Rain: Fireball trifft (150)', t.hp(1, 0) === 650, t.hp(1, 0));
  }

  R.section('Schwesterkarten negieren weiter den GANZEN Zauber: Storm Ring, MOE Shield (Armageddon)');
  for (const rx of ['Storm Ring', 'MOE Shield']) {
    const t = await H.fresh({ hand: [['Armageddon'], [rx]], gold: [100, 200] });
    t.grantFor(1, 0, rx);
    await t.play(0, 'Armageddon', { hero: 0 });
    R.check(`${rx}: Fenster ging auf`, t.prompts.some(p => p.d.title === rx), t.prompts.map(p => p.d.title));
    R.check(`${rx}: Armageddon ganz negiert (beide Seiten unversehrt)`, hps(t, 0).every(x => x === 800) && hps(t, 1).every(x => x === 800), { a: hps(t, 0), b: hps(t, 1) });
    sauber(t, rx);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
