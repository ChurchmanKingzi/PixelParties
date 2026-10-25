'use strict';
// W75 · Audit P4a · Clone × Darion (geteilte Equip-Zone)
// Kartentext Clone: „Once per turn, when the corresponding Hero uses a Normal Attack or Spell, this Creature may perform an exact copy of it against the same target(s) … "
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Szene: Hero 0 (Sitz 0) hat Clone und wirkt „Pressure Projectile" (150 Schaden auf Darion, dann „choose any number of … Artifacts equipped to the target and send them to the discard pile").
//   Darion (Sitz 1) traegt den Stapel Club / Blade / Crown; im Original wird die MITTLERE Karte (Blade) abgeworfen.
// Beobachtung (Soll aus Lesart „jede Karte ist eine eigene Karte"): die Kopie trifft dasselbe Ziel (Darion, 150 Schaden). Die abgeworfene Karte ist weg, „dasselbe Ziel" gibt es nicht mehr —
//   wie bei einem normalen Helden mit getrennten Zonen (dort ist die Zone nach dem Abwurf leer und das Ziel nicht mehr waehlbar) wird NICHT eine andere Karte des Stapels getroffen.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-07-clone-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, PP = 'Pressure Projectile';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const stapelModus of [true, false]) {
    R.section(stapelModus ? 'Darion-Stapel Club / Blade / Crown' : 'Baseline: dieselben drei Karten in getrennten Zonen');
    const t = await H.fresh({ active: 0, heroes: [['Tushu, the Knowledge Keeper', null, null], [D, null, null]], hand: [[PP, F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const klon = t.put(0, 0, 0, 'Clone'); klon.turnPlayed = 1;
    const ps = t.gs.players[1];
    const insts = [];
    if (stapelModus) { ps.supportZones[0][1] = []; for (const n of NAMEN) { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; insts.push(i); } }
    else NAMEN.forEach((n, k) => insts.push(t.put(1, 0, k, n)));
    const fragen = [];
    let zaehler = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { zaehler++; fragen.push(d.instances.map(i => i.name)); const mitte = d.instances.find(i => i.name === NAMEN[1]); return mitte ? { instId: mitte.instId } : { done: true }; } });
    t.targetFn = (valid, cfg) => {
      const eq = valid.find(v => v.type === 'equip' && v.owner === 1 && v.heroIdx === 0 && (!stapelModus || v.slotIdx === 1) && (stapelModus || v.cardName === NAMEN[1]));
      const ho = valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
      return [(/Artifact|equipped|Spells attached/i.test((cfg && (cfg.description || cfg.title)) || '') && eq ? eq : (ho || valid[0])).id];
    };
    t.policy.confirm = true;
    const hp0 = t.hp(1, 0);
    await t.play(0, PP, { hero: 0 });
    await t.drain();
    const rest = insts.filter(i => i.zone === 'support').map(i => i.name);
    R.note('lauf', JSON.stringify({ hp: [hp0, t.hp(1, 0)], rest, ablage: t.pile(1, 'discardPile'), fragen, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || p.d.message || '')) }));
    R.check('Original: Blade abgeworfen', t.pile(1, 'discardPile').includes(NAMEN[1]), t.pile(1, 'discardPile'));
    R.check('Clone hat kopiert (Darion hat 2 x 150 Schaden genommen)', hp0 - t.hp(1, 0) === 300, [hp0, t.hp(1, 0)]);
    R.check('Die Kopie wirft KEINE weitere Karte ab: Club und Crown bleiben', rest.length === 2 && rest.includes(NAMEN[0]) && rest.includes(NAMEN[2]), rest);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
