'use strict';
// W51b · Der Hook `onEquipLost` (Gegenstück zu `onEquipGained` für das UMHÄNGEN) und das Vertragsstück `equipZustandHooks`:
//   (1) Nutzlast: Fridge / Ceremony (Equip UND Anhängsel) / `actionTransferAttachment` — Leave-Felder (`leavingCard`, `fromZone`, `fromOwner` = Brettseite, `fromHeroIdx`,
//       `fromZoneSlot`) + neuer Platz + Ausführender + Quelle; immer `isMove`.
//   (2) Reihenfolge: erst alle Abgänge (`onEquipLost`), dann alle Ankünfte (`onEquipGained`); bereits gemeldete Mitbewegte stehen beim nächsten Abgang „unterwegs".
//   (3) (seit W52a) auch das Zerstören meldet onEquipLost (ein Ereignis, kein Umhängen); kein Gained/Lost für Kreaturen/Abilities.
//   (4) Ruling W51a bleibt: das echte `onCardEnterZone`/`onCardLeaveZone` eines Umhängens geht NUR an die bewegte Karte (`_onlyCard`) — Zähler wie Luck feuern nicht.
//   (5) Eigen-Bonus des Equips (Club of Gobbo +30 ATK) wandert wie bisher; Taio/Toras daneben stimmen.
//   (6) Tempeluna: die angelegte Fee verlässt Tempeluna per Fridge → Tempeluna verliert den gewonnenen Effekt (Ruling ①), vorher blieb er stehen.
// Beide Sitze. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const P1 = 'Wanted Poster', P2 = 'Truth-Seeing Eye', CLUB = 'Club of Gobbo', AURA = 'Energy Aura';

/** Spion auf runHooks: sammelt onEquipLost/onEquipGained (mit Zustand der Mitbewegten) und prüft die rohen Enter/Leave-Ereignisse. */
function spion(t) {
  const lost = [], gained = [], roh = [];
  const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => {
    if (n === 'onEquipLost') lost.push({ name: c.lostName, kind: c.kind, move: c.isMove, leaving: c.leavingCard === c.lostCard, fromZone: c.fromZone, fromOwner: c.fromOwner, fromHero: c.fromHeroIdx, fromSlot: c.fromZoneSlot, toZone: c.toZone, toOwner: c.toOwner, toHero: c.toHeroIdx, toSlot: c.toZoneSlot, by: c.equipOwner, src: c.source, zonen: t.engine.cardInstances.filter(i => i.name === P1 || i.name === P2 || i.name === CLUB || i.name === AURA).map(i => i.name + ':' + i.zone + ':' + i.heroIdx).sort().join('|') });
    if (n === 'onEquipGained') gained.push({ name: c.equipName, move: c.isMove, hero: c.equipHeroIdx, fromHero: c.fromHeroIdx, zonen: t.engine.cardInstances.filter(i => i.name === P1 || i.name === P2 || i.name === CLUB || i.name === AURA).map(i => i.name + ':' + i.zone + ':' + i.heroIdx).sort().join('|'), seq: lost.length });
    if ((n === 'onCardEnterZone' && c._isMove) || (n === 'onCardLeaveZone' && c.toZone === 'support' && c.fromZone === 'support')) roh.push({ n, nurKarte: !!c._onlyCard });
    return orig(n, c);
  };
  return { lost, gained, roh };
}

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    // ── (1) Nutzlast Fridge ──
    { const t = await U.fresh(me, { hand: [] }); await U.lege(t, me, P1, 0); const s = spion(t); t.reset();
      await U.bewege(t, me, 'fridge', { name: P1, nach: 1 });
      const l = s.lost[0] || {};
      R.check('Fridge: genau ein onEquipLost, ein onEquipGained', s.lost.length === 1 && s.gained.length === 1, { l: s.lost.length, g: s.gained.length });
      R.check('Fridge: Lost-Nutzlast (leavingCard, fromZone, Brettseite, alter Platz, neuer Platz, Ausführender, Quelle, kind, isMove)',
        l.leaving && l.fromZone === 'support' && l.fromOwner === me && l.fromHero === 0 && l.fromSlot === 0 && l.toZone === 'support' && l.toOwner === me && l.toHero === 1 && l.toSlot === 0
        && l.by === me && l.src === U.F && l.kind === 'equip' && l.move === true, l);
      R.check('Fridge: Reihenfolge Abgang vor Ankunft; die Karte steht beim Abgang noch am alten Platz', !!l.zonen && l.zonen.includes(P1 + ':support:0') && !!s.gained[0] && s.gained[0].seq === 1 && s.gained[0].zonen.includes(P1 + ':support:1'), { l: l && l.zonen, g: s.gained[0] });
      R.check('Fridge: rohe Enter/Leave-Ereignisse des Umhängens gehen NUR an die bewegte Karte (Ruling W51a)', s.roh.length >= 2 && s.roh.every(e => e.nurKarte), s.roh);
      R.check('Fridge: sauber', U.sauber(t), { e: t.errors, a: t.audit() }); }

    // ── (1b) Nutzlast Ceremony: Equip UND Anhängsel ──
    { const t = await U.fresh(me, { hand: [] }); await U.lege(t, me, P1, 0); await U.haenge(t, me, AURA, 0); const s = spion(t); t.reset();
      await U.bewege(t, me, 'ceremony', { name: null, nach: 1 });
      const eq = s.lost.find(x => x.name === P1), an = s.lost.find(x => x.name === AURA);
      R.check('Ceremony: onEquipLost für Equip (kind equip) UND Anhängsel (kind attachment), Quelle Inheritance Ceremony', !!eq && !!an && eq.kind === 'equip' && an.kind === 'attachment' && eq.src === U.C && an.src === U.C && eq.by === me && an.by === me && eq.move && an.move, s.lost);
      R.check('Ceremony: onEquipGained für beide (isMove)', s.gained.length === 2 && s.gained.every(g => g.move && g.hero === 1 && g.fromHero === 0), s.gained);
      R.check('Ceremony: rohe Ereignisse nur an die Karten selbst', s.roh.length >= 2 && s.roh.every(e => e.nurKarte), s.roh);
      R.check('Ceremony: sauber', U.sauber(t), { e: t.errors, a: t.audit() }); }

    // ── (1c) actionTransferAttachment direkt (Cybug LOCUST, Secret Spell Book …) ──
    { const t = await U.fresh(me, { hand: [] }); await U.haenge(t, me, AURA, 0); const s = spion(t); t.reset();
      const inst = t.find(AURA, 'support');
      const r = await t.run(() => t.engine.actionTransferAttachment(inst, me, 1, 0, { sourceName: 'Test', anleger: me }));
      const l = s.lost[0] || {};
      R.check('actionTransferAttachment: onEquipLost mit Platz, Ausführendem und Quelle', r && r.success && s.lost.length === 1 && l.name === AURA && l.kind === 'attachment' && l.fromOwner === me && l.fromHero === 0 && l.toHero === 1 && l.by === me && l.src === 'Test' && l.move, { r, s: s.lost });
      R.check('actionTransferAttachment: Abgang vor Ankunft', s.gained.length === 1 && s.gained[0].seq === 1, s.gained); }

    // ── (2) Mehrere gleichzeitig: erst alle Abgänge, dann alle Ankünfte; Gemeldete stehen „unterwegs" ──
    { const t = await U.fresh(me, { hand: [] }); await U.lege(t, me, P1, 0); await U.lege(t, me, P2, 0); const s = spion(t); t.reset();
      await U.bewege(t, me, 'fridge', { name: null, nach: 1 });
      R.check('Zwei Equips: zwei Abgänge, dann zwei Ankünfte', s.lost.length === 2 && s.gained.length === 2 && s.gained.every(g => g.seq === 2), { l: s.lost.length, g: s.gained });
      const zweite = s.lost[1] || { zonen: '', name: '?' }; const erste = s.lost[0] || { name: '?' };
      R.check('Zwei Equips: beim zweiten Abgang steht das erste schon „unterwegs" (zone _umhaengen), das zweite noch am alten Platz',
        zweite.zonen.includes(erste.name + ':_umhaengen:0') && zweite.zonen.includes(zweite.name + ':support:0'), { z: zweite.zonen, erste: erste.name });
      R.check('Zwei Equips: bei den Ankünften liegen alle wieder in einer Zone (support) am Zielhelden', s.gained.every(g => g.zonen.includes(P1 + ':support:1') && g.zonen.includes(P2 + ':support:1')), s.gained.map(g => g.zonen));
      R.check('Zwei Equips: nach dem Umhängen keine Karte „unterwegs"', t.inst(c => c.zone === '_umhaengen').length === 0, t.inst(c => c.zone === '_umhaengen').map(c => c.name)); }

    // ── (3) W52a: JEDER Abgang meldet onEquipLost (nicht nur das Umhängen) — Zerstören: ein Ereignis, Grund 'destroyed', kein Umhängen (Details: W52/a-01) ──
    { const t = await U.fresh(me, { hand: [] }); await U.lege(t, me, P1, 0); const s = spion(t);
      await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, t.find(P1, 'support'), {}));
      R.check('Zerstören: genau ein onEquipLost, kein Umhängen (isMove false)', s.lost.length === 1 && s.lost[0].move === false && !U.wo(t, me, P1).length, { l: s.lost, w: U.wo(t, me, P1) }); }

    // ── (4) Zähler-Lauscher bleiben still: Luck (Ability) zählt gespielte Karten über onCardEnterZone — beim Umhängen darf nichts gezählt werden ──
    { const t = await U.fresh(me, { hand: [] }); t.setAbilities(me, 0, [['Luck'], [], []]); t.setAbilities(me, 1, [['Luck'], [], []]);
      await U.lege(t, me, P1, 0); const vorher = JSON.stringify(t.inst(c => c.name === 'Luck').map(c => [c.heroIdx, c.counters])); t.reset();
      await U.bewege(t, me, 'fridge', { name: P1, nach: 1 });
      const nachher = JSON.stringify(t.inst(c => c.name === 'Luck').map(c => [c.heroIdx, c.counters]));
      R.check('Luck: Zähler nach dem Umhängen unverändert (Umhängen ist kein Spielen)', vorher === nachher && U.wo(t, me, P1).join() === '1', { vorher, nachher }); }

    // ── (5) Eigen-Bonus des Equips + Taio nebenan ──
    { const t = await U.fresh(me, { hand: [], heroes: { [me]: ['Taio, the Sun Fencer'] } }); const a1 = U.atk(t, me, 1);
      await U.lege(t, me, CLUB, 0);
      const a0 = U.atk(t, me, 0);
      R.check('Club of Gobbo an Taio: +30 (Club) +20 (Taio)', a0 === 80 + 30 + 20, { a0 });
      t.reset();
      await U.bewege(t, me, 'fridge', { name: CLUB, nach: 1 });
      R.check('Club umgehängt: Quellheld ATK 80 (Club- UND Taio-Bonus weg), Zielheld +30', U.atk(t, me, 0) === 80 && U.atk(t, me, 1) === a1 + 30, { a0: U.atk(t, me, 0), a1: U.atk(t, me, 1), vorher1: a1 }); }

    // ── (6) Tempeluna: angelegte Fee verlässt Tempeluna → Effekt weg (Ruling ① der Karte) ──
    for (const via of ['ceremony']) {   // W52a: die Fee ist ANGEHÄNGT, kein Equip (`_keinEquip`) — die Fridge nimmt sie nicht mehr (W52/a-02), die Ceremony als Anhängsel schon
      const FEE = 'Maya, the Nature Fairy';
      const aufbau = async () => {
        const t = await U.fresh(me, { hand: [], heroes: { [me]: ['Tempeluna, the Convergence Fairy'] } });
        const inst = t.put(me, 0, 0, FEE, { counters: { treatAsEquip: true, _tempelunaAttached: true, _keinEquip: true } });
        t.engine.grantHeroEffect(me, 0, FEE, { traeger: inst });
        return t;
      };
      const t = await aufbau();
      R.check(`Tempeluna/${via}: Ausgang — Tempeluna hat den Effekt der Fee gewonnen`, (t.hero(me, 0).gainedEffectNames || []).includes(FEE), t.hero(me, 0).gainedEffectNames);
      t.reset();
      const r = await U.bewege(t, me, via, { name: FEE, nach: 1 });
      R.check(`Tempeluna/${via}: Fee wurde umgehängt`, r === true && U.wo(t, me, FEE).join() === '1', { r, w: U.wo(t, me, FEE) });
      R.check(`Tempeluna/${via}: Tempeluna hat den gewonnenen Effekt NICHT mehr`, !(t.hero(me, 0).gainedEffectNames || []).includes(FEE), t.hero(me, 0).gainedEffectNames);
      R.check(`Tempeluna/${via}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
