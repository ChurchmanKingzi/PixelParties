'use strict';
// W52a · Punkt 2 (Al, 22.10.2026): „In ihrem Effekt steht nichts davon, dass die Fee als Equip zählt – das wäre ungewollt!"
//   Tempeluna: „You may once per turn ATTACH a "Fairy" Hero from your hand to this Hero. This Hero gains the effects of all "Fairy" Heroes attached to it." → die Fee ist ANGEHÄNGT, nicht
//   ausgerüstet (anders als Initiation Ritual: „While a Hero is equipped via this effect, it is treated as an equippable Artifact" — das bleibt).
// Erwartung (beide Sitze):
//   • Die Fee trägt die Marke `_keinEquip`: `engine.isEquipInZone` false, `istUmhaengbaresEquip` false → Slippery Fridge kann sie nicht umhängen und bietet sie nicht an, Anti Magic
//     Enchantment wird nicht angeboten, Afflicted Pests öffnet nicht (W50-Entscheidung bleibt), `onEquipLost` meldet sie als `kind: 'attachment'`.
//   • Sie bleibt ein Anhängsel; die Ceremony nimmt sie seit W53a NICHT mit (Al: „Nein.").
//   • Tempelunas Effekt-Gewinn/-Verlust beim Anhängen/Entfernen funktioniert weiter (zerstört, abgelegt, Wirt besiegt).
//   • Gegenprobe: ein per Initiation Ritual angelegter Held ist weiter ein Equip (Fridge bietet ihn an, `isEquipInZone` true).
// Auf dem Stand vor W52a rot (Fridge hängte die Fee um). Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
const { istUmhaengbaresEquip } = require(U.H.ROOT + '/cards/effects/_equip-shared');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const TEMPELUNA = 'Tempeluna, the Convergence Fairy', FEE = 'Maya, the Nature Fairy', PESTS = 'Afflicted Pests', AME = 'Anti Magic Enchantment', FRIDGE = 'Slippery Fridge';
const CLUB = 'Club of Gobbo';
const pestsAktiv = (t) => t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d))) || t.inst(c => c.name === PESTS && c.zone === 'support').length > 0;
const ameGefragt = (t) => t.prompts.some(p => p.d && p.d.title === AME);

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    /** Echter Weg: Tempeluna bei Held 0, Maya auf der Hand, Heldeneffekt aktivieren (Fee anhängen). `extra`: weitere Handkarten des Besitzers. */
    const aufbau = async (extra = [], opts = {}) => {
      const t = await U.fresh(me, { hand: [FEE, ...extra], heroes: { [me]: [TEMPELUNA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] }, opts: { deckSize: 30 } });
      t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: FEE, source: 'hand' }) });
      await t.run(() => t.engine.runHooks('onGameStart', {}));
      if (opts.vorher) await opts.vorher(t);
      t.reset();
      const r = await t.activateHero(me, 0, {});
      return { t, r, fee: t.inst(c => c.name === FEE && c.zone === 'support')[0] };
    };

    // ── 1. Die angehängte Fee ist KEIN Equip ──
    { const { t, r, fee } = await aufbau();
      R.check('Fee angehängt (liegt in Tempelunas Support Zone, Effekt gewonnen)', r === true && !!fee && fee.heroIdx === 0 && (t.hero(me, 0).gainedEffectNames || []).includes(FEE), { r, fee: !!fee, g: t.hero(me, 0).gainedEffectNames });
      R.check('Fee: Marke _keinEquip, bleibt aber Träger des Heldeneffekts (treatAsEquip + _tempelunaAttached)', fee.counters._keinEquip === true && fee.counters.treatAsEquip === true && fee.counters._tempelunaAttached === true, fee.counters);
      R.check('engine.isEquipInZone(Fee) ist false (kein Artifact/Equip für Taio, Disarm, Blind Destruction …)', t.engine.isEquipInZone(fee.name, fee) === false, t.engine.isEquipInZone(fee.name, fee));
      R.check('istUmhaengbaresEquip(Fee) ist false', istUmhaengbaresEquip(t.engine, fee) === false, 0);
      R.check('sauber', t.errors.length === 0, t.errors); }

    // ── 2. Slippery Fridge kann die Fee nicht umhängen / bietet sie nicht an ──
    { const { t, fee } = await aufbau([FRIDGE, CLUB]);
      await U.lege(t, me, CLUB, 0);
      t.reset();
      U.wahl(t, { name: null, nach: 1 });
      const r = await t.play(me, FRIDGE, { hero: 1, active: me });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Fridge: angeboten wird der Club, NICHT die Fee', angeboten.includes(CLUB) && !angeboten.includes(FEE), angeboten);
      R.check('Fridge: Fee bleibt bei Tempeluna (Held 0), Club liegt an Held 1', U.wo(t, me, FEE).join() === '0' && U.wo(t, me, CLUB).join() === '1' && r === true, { fee: U.wo(t, me, FEE), club: U.wo(t, me, CLUB), r });
      R.check('Fridge: Tempeluna behält den Effekt der Fee', (t.hero(me, 0).gainedEffectNames || []).includes(FEE), t.hero(me, 0).gainedEffectNames);
      R.check('Fridge: sauber', t.errors.length === 0, t.errors); }
    { // nur die Fee liegt: die Fridge ist gar nicht spielbar (kein umhängbares Equip)
      const { t } = await aufbau([FRIDGE]);
      t.reset();
      const r = await t.play(me, FRIDGE, { hero: 1, active: me });
      R.check('Fridge mit der Fee als einzigem „Equip": nicht spielbar / wirkungslos, Fee bleibt', U.wo(t, me, FEE).join() === '0' && (t.hero(me, 0).gainedEffectNames || []).includes(FEE), { r, fee: U.wo(t, me, FEE) }); }

    // ── 3. Equip-Beobachter sehen die Fee nicht (Pests, AME) ──
    { const { t, r } = await aufbau([AME], { vorher: async (t) => {
        t.putSurprise(op, 0, PESTS); t.grantFor(op, 0, PESTS); t.put(op, 0, 0, U.H.INERT.creature);
        t.script.push({ match: d => d.type === 'confirm' && d.title === AME, answer: () => false });
      } });
      R.check('Fee anhängen: Afflicted Pests öffnet NICHT (W50-Entscheidung bleibt)', r === true && !pestsAktiv(t), t.prompts.map(p => p.d.title || p.d.type));
      R.check('Fee anhängen: Anti Magic Enchantment wird NICHT angeboten (kein Equip-Artifact)', !ameGefragt(t), t.prompts.map(p => p.d.title || p.d.type)); }

    // ── 4. Tempelunas Effekt-Gewinn/-Verlust bleibt: Fee zerstört / abgelegt / Wirt besiegt → Effekt weg; onEquipLost meldet 'attachment' ──
    for (const [wid, los, grund] of [
      ['zerstört', (t, fee) => t.engine.actionDestroyCard({ name: 'Test', owner: op }, fee, {}), 'destroyed'],
      ['abgelegt', (t, fee) => t.engine.actionMoveCard(fee, 'discard', -1, -1, { source: 'Test' }), 'discarded'],
      ['Wirt besiegt', (t) => t.engine.actionDealDamage({ name: 'Test', owner: op }, t.hero(me, 0), 5000, 'attack'), 'hostDefeated'],
    ]) {
      const { t, fee } = await aufbau();
      const lost = []; const orig = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (n, c) => { if (n === 'onEquipLost') lost.push({ name: c.lostName, kind: c.kind, reason: c.reason }); return orig(n, c); };
      await t.run(() => los(t, fee));
      R.check(`Fee ${wid}: Effekt weg (Ruling ①), genau ein onEquipLost als attachment mit Grund ${grund}`, !(t.hero(me, 0).gainedEffectNames || []).includes(FEE) && lost.length === 1 && lost[0].name === FEE && lost[0].kind === 'attachment' && lost[0].reason === grund,
        { g: t.hero(me, 0).gainedEffectNames, lost });
      R.check(`Fee ${wid}: sauber`, t.errors.length === 0, t.errors);
    }

    // ── 5. Ceremony nimmt die Fee NICHT mit (W53a, Al: „Soll Ceremony die Fee überhaupt als Anhängsel mitnehmen?" — „Nein."); Details und weitere Wege: W53/a-01 ──
    { const { t } = await aufbau(['Inheritance Ceremony']);
      t.reset();
      U.wahl(t, { name: FEE, nach: 1 });
      await t.play(me, 'Inheritance Ceremony', { hero: 0, active: me });
      const angeboten = t.targets.flatMap(x => x.valid).filter(v => v.type === 'equip').map(v => v.cardName);
      R.check('Ceremony bietet die Fee NICHT an', !angeboten.includes(FEE), angeboten);
      R.check('Ceremony: Fee bleibt bei Tempeluna, Tempeluna behält den Effekt', U.wo(t, me, FEE).join() === '0' && (t.hero(me, 0).gainedEffectNames || []).includes(FEE) && !(t.hero(me, 1).gainedEffectNames || []).includes(FEE),
        { fee: U.wo(t, me, FEE), g0: t.hero(me, 0).gainedEffectNames, g1: t.hero(me, 1).gainedEffectNames });
      R.check('Ceremony: sauber', t.errors.length === 0, t.errors); }

    // ── 6. Gegenprobe: ein per Initiation Ritual angelegter HELD ist weiter ein Equip ──
    { const t = await U.fresh(me, { hand: [FRIDGE] });
      const held = t.put(me, 0, 0, 'Atta, Speaker of Desires', { counters: { treatAsEquip: true } });
      R.check('Initiation-Held: isEquipInZone true, umhängbar', t.engine.isEquipInZone(held.name, held) === true && istUmhaengbaresEquip(t.engine, held) === true, 0);
      t.reset();
      U.wahl(t, { name: held.name, nach: 1 });
      const r = await t.play(me, FRIDGE, { hero: 2, active: me });
      R.check('Initiation-Held: Slippery Fridge hängt ihn um (Ruling bleibt)', r === true && U.wo(t, me, held.name).join() === '1', { r, w: U.wo(t, me, held.name) }); }
  }
  R.finish();
})();
