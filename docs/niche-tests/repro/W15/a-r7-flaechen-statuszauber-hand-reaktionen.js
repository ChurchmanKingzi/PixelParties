'use strict';
// W15a · R7 (Befund R01-10) · Al, 16.10.2026: „Ja, sollen sie." — Bei Flächen-Statuszaubern ohne Schaden (Poisoned Well, Iceage, Medusa's Curse) gehen auch die
//   weiteren Hand-Reaktionsfenster (Divine Gift of Rain, Barrier of Faith, Anti Magic Shield) auf, und sie WIRKEN wie bei einem Flächenschlag:
//   Divine Gift of Rain / Anti Magic Shield negieren den Zauber ganz (kein Status, auch nicht bei den Kreaturen); Barrier of Faith schützt genau den einen gewählten Helden
//   (Effekt-Immunität gegen diese Auflösung), die übrigen Ziele bleiben betroffen. „Chosen by"-Surprises (Frost Rune) bleiben zu (W14b).
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = [['Iceage', 'frozen'], ['Poisoned Well', 'poisoned'], ["Medusa's Curse", 'stunned']];
  const status = (t, h, st) => !!t.hero(1, h).statuses[st];

  async function aufbau(src, rx) {
    const t = await H.fresh({ hand: [[src], rx ? [rx] : []] });
    if (rx) {
      t.grantFor(1, 0, rx);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    }
    const kr = t.put(1, 1, 0, H.INERT.creature);   // eine gegnerische Kreatur (Held 1)
    return { t, kr };
  }
  const krStatus = (kr, st) => st === 'poisoned' ? (kr.counters.poisonStacks || 0) > 0 : st === 'frozen' ? !!kr.counters.frozen : !!kr.counters.stunned;

  for (const [src, st] of faelle) {
    R.section(`${src} (${st})`);
    {
      const { t, kr } = await aufbau(src, null);
      await t.play(0, src, { hero: 0 });
      R.check(`Kontrolle ohne Reaktion: alle 3 Helden ${st}`, [0, 1, 2].every(h => status(t, h, st)), [0, 1, 2].map(h => status(t, h, st)));
      R.check('Kontrolle: Kreatur betroffen', krStatus(kr, st), kr.counters);
    }
    for (const rx of ['Divine Gift of Rain', 'Anti Magic Shield']) {
      const { t, kr } = await aufbau(src, rx);
      await t.play(0, src, { hero: 0 });
      R.check(`${rx}: Fenster ging auf, Karte verbraucht`, t.prompts.some(p => p.d.title === rx) && !t.pile(1, 'hand').includes(rx), { prompts: t.prompts.map(p => p.d.title), hand: t.pile(1, 'hand') });
      R.check(`${rx}: Zauber negiert — kein Held ${st}`, [0, 1, 2].every(h => !status(t, h, st)), [0, 1, 2].map(h => status(t, h, st)));
      R.check(`${rx}: auch die Kreatur ist unberührt`, !krStatus(kr, st), kr.counters);
      R.check(`${rx}: der Zauber liegt in der Ablage von Sitz 0`, t.pile(0, 'discardPile').includes(src), t.pile(0, 'discardPile'));
      R.check(`${rx}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const rx = 'Barrier of Faith';
      const { t, kr } = await aufbau(src, rx);
      await t.play(0, src, { hero: 0 });
      R.check(`${rx}: Fenster ging auf, Karte verbraucht`, t.prompts.some(p => p.d.title === rx) && !t.pile(1, 'hand').includes(rx), { prompts: t.prompts.map(p => p.d.title), hand: t.pile(1, 'hand') });
      R.check(`${rx}: Held 0 (der Geschützte) bleibt ohne ${st}`, !status(t, 0, st), t.hero(1, 0).statuses);
      R.check(`${rx}: der Geschützte trägt auch keinen Folge-Buff der Karte`, Object.keys(t.hero(1, 0).buffs || {}).length === 0, t.hero(1, 0).buffs);
      R.check(`${rx}: Held 1 und 2 sind betroffen`, status(t, 1, st) && status(t, 2, st), [1, 2].map(h => status(t, h, st)));
      R.check(`${rx}: die Kreatur ist betroffen (Barrier schützt nur den Helden)`, krStatus(kr, st), kr.counters);
      R.check(`${rx}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }

  R.section('Weitere Hand-Reaktionen, die bei Flächenschlägen aufgehen: Storm Ring, MOE Shield (negieren), Golden Wings (schützt die gewählte Kreatur)');
  for (const rx of ['Storm Ring', 'MOE Shield']) {
    const t = await H.fresh({ hand: [['Iceage'], [rx]], gold: [100, 200] });
    t.grantFor(1, 0, rx);
    await t.play(0, 'Iceage', { hero: 0 });
    R.check(`Iceage vs ${rx}: Fenster geht auf, Zauber negiert (kein Held gefroren)`, t.prompts.some(p => p.d.title === rx) && [0, 1, 2].every(h => !status(t, h, 'frozen')), { prompts: t.prompts.map(p => p.d.title), st: [0, 1, 2].map(h => status(t, h, 'frozen')) });
    R.check(`${rx}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [['Iceage'], ['Golden Wings']] });
    t.grantFor(1, 0, 'Golden Wings');
    const kr = t.put(1, 1, 0, H.INERT.creature);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, 'Iceage', { hero: 0 });
    R.check('Iceage vs Golden Wings: Fenster geht auf', t.prompts.some(p => p.d.title === 'Golden Wings'), t.prompts.map(p => p.d.title));
    R.check('… die geschützte Kreatur bleibt ungefroren, die Helden sind gefroren', !kr.counters.frozen && [0, 1, 2].every(h => status(t, h, 'frozen')), { kr: kr.counters, st: [0, 1, 2].map(h => status(t, h, 'frozen')) });
  }

  R.section('Weitere Flächen-Statuszauber ohne Schaden (gleiche Bauform): Anti Magic Zone, Null Zone, Snowstorm Mischief, Toxic Fumes');
  const weitere = [
    ['Anti Magic Zone', (t, kr, ek) => [0, 1, 2].every(h => t.hero(1, h).statuses.magic_silenced) && !!kr.counters.magic_silenced, (t, kr) => [0, 1, 2].every(h => !t.hero(1, h).statuses.magic_silenced) && !kr.counters.magic_silenced],
    ['Null Zone', (t, kr, ek) => [0, 1, 2].every(h => t.hero(1, h).statuses.nulled) && !!kr.counters.nulled, (t, kr) => [0, 1, 2].every(h => !t.hero(1, h).statuses.nulled) && !kr.counters.nulled],
    // W18a (Al, R01-05: „Nur eigene Ziele werden beschützt!"): Divine Gift of Rain schützt bei diesen beidseitigen Flächenzaubern NUR die Kreatur des Reagierenden (kr);
    // die Kreatur des Wirkers (ek) wird weiter getroffen (`unberuehrt` heißt hier: kr geschützt, ek betroffen).
    ['Snowstorm Mischief', (t, kr, ek) => !!kr.counters.frozen && !!ek.counters.frozen, (t, kr, ek) => !kr.counters.frozen && !!ek.counters.frozen],
    ['Toxic Fumes', (t, kr, ek) => (kr.counters.poisonStacks || 0) > 0 && (ek.counters.poisonStacks || 0) > 0, (t, kr, ek) => !(kr.counters.poisonStacks || 0) && (ek.counters.poisonStacks || 0) > 0],
  ];
  for (const [src, betroffen, unberuehrt] of weitere) {
    // Anti Magic Shield: „a Hero that can use this Spell is hit by an opponent's Spell" — nur bei Zaubern, die einen HELDEN treffen (Anti Magic Zone [Lv2], Null Zone [Lv1]).
    const rxListe = [null, 'Divine Gift of Rain', ...(src === 'Anti Magic Zone' || src === 'Null Zone' ? ['Anti Magic Shield'] : [])];
    for (const rx of rxListe) {
      const t = await H.fresh({ hand: [[src], rx ? [rx] : []] });
      if (rx) t.grantFor(1, 0, rx);
      if (rx === 'Anti Magic Shield') t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]);   // Magic Arts 2 ≥ Stufe des Zaubers
      const kr = t.put(1, 1, 0, H.INERT.creature);   // gegnerische Kreatur
      const ek = t.put(0, 1, 0, H.INERT.creature);   // eigene Kreatur des Wirkers
      await t.play(0, src, { hero: 0 });
      if (!rx) {
        R.check(`${src} ohne Reaktion: wirkt (Kontrolle)`, betroffen(t, kr, ek), { kr: kr.counters, ek: ek.counters });
      } else {
        R.check(`${src} vs ${rx}: Fenster ging auf, Karte verbraucht`, t.prompts.some(p => p.d.title === rx) && !t.pile(1, 'hand').includes(rx), { prompts: t.prompts.map(p => p.d.title), hand: t.pile(1, 'hand') });
        R.check(`${src} vs ${rx}: ` + (rx === 'Divine Gift of Rain' && (src === 'Snowstorm Mischief' || src === 'Toxic Fumes') ? 'nur die Kreatur des Reagierenden geschützt (W18a)' : 'Zauber negiert — nichts wirkt'), unberuehrt(t, kr, ek), { kr: kr.counters, ek: ek.counters, st: t.hero(1, 0).statuses });
        R.check(`${src} vs ${rx}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
      }
    }
  }

  R.section('Gegenprobe: Reaktionen, die nur auf Schaden/Wahl reagieren, bleiben zu');
  for (const src of ['Snowstorm Mischief', 'Toxic Fumes']) {   // trifft nur Kreaturen → Anti Magic Shield (Held muss getroffen werden) bleibt zu
    const t = await H.fresh({ hand: [[src], ['Anti Magic Shield']] });
    t.grantFor(1, 0, 'Anti Magic Shield');
    t.put(1, 1, 0, H.INERT.creature);
    await t.play(0, src, { hero: 0 });
    R.check(`${src} (nur Kreaturen) vs Anti Magic Shield: Fenster bleibt zu`, !t.prompts.some(p => p.d.title === 'Anti Magic Shield'), t.prompts.map(p => p.d.title));
  }
  {
    const { t } = await aufbau('Iceage', 'Cloud in a Bottle');
    t.grantFor(1, 0, 'Cloud in a Bottle');
    await t.play(0, 'Iceage', { hero: 0 });
    R.check('Cloud in a Bottle (halbiert Schaden) geht bei Iceage nicht auf', !t.prompts.some(p => p.d.title === 'Cloud in a Bottle'), t.prompts.map(p => p.d.title));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
