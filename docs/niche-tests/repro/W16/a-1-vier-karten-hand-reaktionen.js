'use strict';
// W16a · Punkt 1 · Al, 19.10.2026: „Sollen Smoke Vial (Trank), Cute Conversion, Mass Routing und Pink Sky ebenfalls die Hand-Reaktionsfenster öffnen?" — „Ja".
//   Diese vier Karten öffnen die Post-Target-Hand-Reaktionsfenster wie die Flächenzauber aus W15a (statusHitSurpriseWindow): was der Text der Reaktion für die
//   jeweilige Kartenart zulässt, geht auf, sonst bleibt das Fenster zu:
//   · Smoke Vial (Trank, trifft Helden):      Divine Gift of Rain + Barrier of Faith („card or effect"); NICHT Anti Magic Shield/Storm Ring/MOE Shield (nur Spells).
//   · Cute Conversion / Mass Routing (Spell, trifft Kreaturen): Divine Gift of Rain, MOE Shield, Storm Ring (ab 2 Zielen), Golden Wings (schützt eine Kreatur);
//     NICHT Anti Magic Shield/Barrier of Faith (verlangen einen getroffenen Helden).
//   · Pink Sky (Artefakt, trifft Kreaturen):  Divine Gift of Rain + Golden Wings; NICHT Storm Ring/MOE Shield/Anti Magic Shield (nur Spells).
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const offen = (t, rx) => t.prompts.some(p => p.d.title === rx);
  const sauber = (R, t, was) => R.check(`${was}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

  // ───────────────────────── Smoke Vial ─────────────────────────
  R.section('Smoke Vial (Trank): Hand-Reaktionen');
  const geblendet = (t, h) => !!t.hero(1, h).statuses.blinded;
  async function vial(rx) {
    const t = await H.fresh({ hand: [['Smoke Vial'], rx ? [rx] : []] });
    if (rx) {
      t.grantFor(1, 0, rx);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    }
    await t.play(0, 'Smoke Vial');
    return t;
  }
  {
    const t = await vial(null);
    R.check('Kontrolle ohne Reaktion: alle 3 Helden geblendet', [0, 1, 2].every(h => geblendet(t, h)), [0, 1, 2].map(h => geblendet(t, h)));
  }
  {
    const t = await vial('Divine Gift of Rain');
    R.check('Rain: Fenster ging auf, Karte verbraucht', offen(t, 'Divine Gift of Rain') && !t.pile(1, 'hand').includes('Divine Gift of Rain'), { p: t.prompts.map(p => p.d.title), h: t.pile(1, 'hand') });
    R.check('Rain: Trank negiert — kein Held geblendet', [0, 1, 2].every(h => !geblendet(t, h)), [0, 1, 2].map(h => geblendet(t, h)));
    R.check('Rain: Trank trotzdem verbraucht (gelöschte Tränke von Sitz 0)', t.pile(0, 'deletedPile').includes('Smoke Vial') && !t.pile(0, 'hand').includes('Smoke Vial'), { d: t.pile(0, 'deletedPile'), h: t.pile(0, 'hand') });
    sauber(R, t, 'Rain');
  }
  {
    const t = await vial('Barrier of Faith');
    R.check('Barrier: Fenster ging auf, Karte verbraucht', offen(t, 'Barrier of Faith') && !t.pile(1, 'hand').includes('Barrier of Faith'), { p: t.prompts.map(p => p.d.title), h: t.pile(1, 'hand') });
    const bl = [0, 1, 2].filter(h => geblendet(t, h));
    R.check('Barrier: genau ein Held (der Geschützte) ist NICHT geblendet', bl.length === 2, [0, 1, 2].map(h => geblendet(t, h)));
    sauber(R, t, 'Barrier');
  }
  for (const rx of ['Anti Magic Shield', 'Storm Ring', 'MOE Shield']) {
    const t = await vial(rx);
    R.check(`${rx}: Fenster bleibt zu (Trank ist kein Zauber)`, !offen(t, rx), t.prompts.map(p => p.d.title));
    R.check(`${rx}: Trank wirkt (alle geblendet)`, [0, 1, 2].every(h => geblendet(t, h)), [0, 1, 2].map(h => geblendet(t, h)));
  }
  {
    // Gegenprobe: reine Schadens-Reaktion / „chosen"-Reaktion bleiben zu
    for (const rx of ['Spectral Armor', 'Invisibility Cloak']) {
      const t = await vial(rx);
      R.check(`${rx}: Fenster bleibt zu`, !offen(t, rx), t.prompts.map(p => p.d.title));
    }
  }

  // ───────────────────────── Kreaturen-Karten ─────────────────────────
  // aufbau: Wirker Sitz 0, Gegner Sitz 1 mit `n` Kreaturen und Reaktion `rx` auf der Hand.
  async function aufbau(src, rx, n = 2) {
    const t = await H.fresh({ hand: [[src], rx ? [rx] : []], gold: [100, 200] });
    if (rx) {
      t.grantFor(1, 0, rx);
      t.setAbilities(1, 0, [['Support Magic', 'Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts', 'Magic Arts'], []]);
    }
    const krs = [];
    for (let i = 0; i < n; i++) krs.push(t.put(1, 1, i, H.INERT.creature));
    if (rx === 'Golden Wings') t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    await t.play(0, src, { hero: 0 });
    return { t, krs };
  }

  const faelle = [
    { src: 'Cute Conversion',
      wirkt: (t, krs) => krs.every(k => k.stolenBy === 0),
      keine: (t, krs) => krs.every(k => k.stolenBy == null && (k.controller ?? k.owner) === 1),
      teils: (t, krs) => krs.filter(k => k.stolenBy === 0).length === krs.length - 1,
      offen: ['Divine Gift of Rain', 'MOE Shield', 'Storm Ring', 'Golden Wings'], zu: ['Anti Magic Shield', 'Barrier of Faith'] },
    { src: 'Mass Routing',
      wirkt: (t, krs) => krs.every(k => !t.engine.cardInstances.includes(k)),
      keine: (t, krs) => krs.every(k => t.engine.cardInstances.includes(k) && k.zone === 'support'),
      teils: (t, krs) => krs.filter(k => !t.engine.cardInstances.includes(k)).length === krs.length - 1,
      offen: ['Divine Gift of Rain', 'MOE Shield', 'Storm Ring', 'Golden Wings'], zu: ['Anti Magic Shield', 'Barrier of Faith'] },
    { src: 'Pink Sky',
      wirkt: (t, krs) => krs.every(k => k.counters.negated || k.statuses?.negated || t.engine.isCreatureNegated?.(k) || k.counters._pink_sky_negated),
      keine: (t, krs) => krs.every(k => !(k.counters.negated || k.statuses?.negated || k.counters._pink_sky_negated)),
      teils: (t, krs) => krs.filter(k => k.counters.negated || k.statuses?.negated || k.counters._pink_sky_negated).length === krs.length - 1,
      offen: ['Divine Gift of Rain', 'Golden Wings'], zu: ['Storm Ring', 'MOE Shield', 'Anti Magic Shield', 'Barrier of Faith'] },
  ];
  for (const f of faelle) {
    R.section(`${f.src}: Hand-Reaktionen`);
    {
      const { t, krs } = await aufbau(f.src, null);
      R.check(`${f.src} ohne Reaktion: wirkt auf beide Kreaturen (Kontrolle)`, f.wirkt(t, krs), krs.map(k => ({ s: k.stolenBy, c: k.counters })));
    }
    for (const rx of ['Divine Gift of Rain', 'MOE Shield', 'Storm Ring']) {
      if (!f.offen.includes(rx)) continue;
      const { t, krs } = await aufbau(f.src, rx);
      R.check(`${f.src} vs ${rx}: Fenster ging auf, Karte verbraucht`, offen(t, rx) && !t.pile(1, 'hand').includes(rx), { p: t.prompts.map(p => p.d.title), h: t.pile(1, 'hand') });
      R.check(`${f.src} vs ${rx}: negiert — keine Kreatur betroffen`, f.keine(t, krs), krs.map(k => ({ s: k.stolenBy, c: k.counters })));
      R.check(`${f.src} vs ${rx}: Karte des Wirkers verbraucht (Ablage bzw. gelöscht)`, !t.pile(0, 'hand').includes(f.src), t.pile(0, 'hand'));
      sauber(R, t, `${f.src} vs ${rx}`);
    }
    {
      const rx = 'Golden Wings';
      const { t, krs } = await aufbau(f.src, rx);
      R.check(`${f.src} vs ${rx}: Fenster ging auf`, offen(t, rx), t.prompts.map(p => p.d.title));
      R.check(`${f.src} vs ${rx}: genau die geschützte Kreatur bleibt unberührt, die andere ist betroffen`, f.teils(t, krs), krs.map(k => ({ s: k.stolenBy, c: k.counters, in: t.engine.cardInstances.includes(k) })));
      sauber(R, t, `${f.src} vs ${rx}`);
    }
    for (const rx of f.zu) {
      const { t, krs } = await aufbau(f.src, rx);
      R.check(`${f.src} vs ${rx}: Fenster bleibt zu`, !offen(t, rx), t.prompts.map(p => p.d.title));
      R.check(`${f.src} vs ${rx}: Karte wirkt (Kontrolle)`, f.wirkt(t, krs), krs.map(k => ({ s: k.stolenBy, c: k.counters })));
    }
  }

  R.section('Storm Ring braucht mehr als ein Ziel (Cute Conversion / Mass Routing / Pink Sky mit nur 1 Kreatur)');
  for (const src of ['Cute Conversion', 'Mass Routing', 'Pink Sky']) {
    const { t } = await aufbau(src, 'Storm Ring', 1);
    R.check(`${src} mit 1 Ziel vs Storm Ring: Fenster bleibt zu`, !offen(t, 'Storm Ring'), t.prompts.map(p => p.d.title));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
