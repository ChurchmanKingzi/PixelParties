'use strict';
// W44a · Punkte 2, 4, 5, 6 · Antworten von Al, 22.10.2026 (Absicherung des Ist-Zustands bzw. Angleichung des Deepsea Horror Clown):
//  2. Artefakte mit Subtyp Creature (Debt-O-Tron, Scrap Plow, Powder Keg, Pollution Spewer): „Ja, die gelten, solange sie auf dem Board sind, als Creatures mit Creature-Effekten." → Taunt JA.
//  4. Deepsea Horror Clown: „Ja, und füge beiden auch ‚Creature effects' hinzu, genau wie beim Slime." → Skript `tauntNurAttackSpellKreatur`; Text: „…all Attacks, Spells and Creature effects they use during their
//     next turn, if possible." — kein Taunt bei Trank, Artefakt, Ability, Heldeneffekt (ohne Attack-/Spell-Wertung), Equip, Reaktions-Artefakt; Taunt bei Attack, Spell, Creature effect, Surprise nach cardType.
//  5. Bomb Arrow, Racket Arrow: „Nein, die gehören NICHT zum Attack, das sind eigene separate Artifact-Effekte und umgehen damit den Taunt." → Attack bindet, Arrow-Kreaturenwahl nicht.
//  6. Spell/Area- und Spell/Attachment-Karten auf dem Brett: „Korrekt, ja." → Dauer-/Trigger-Effekt kein Taunt; als Spell aus der Hand ausgespielt schon.
// Beide Sitze. Exit 0 auf der Basis 0e81006a für 2, 5, 6; Exit 1 für 4 (Clown ohne Einschränkung); Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W44/a-03-absicherung-artefakt-kreaturen-pfeile-areas-und-deepsea-horror-clown.js   (Exit 0 = korrekt)
const L = require('../W39/_helfer.js');
const { H } = L;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

function stempel(t, slime, gegen) {
  slime.turnPlayed = 1;
  slime.counters.forcesTargeting = true; slime.counters.forcesTargeting_pi = gegen; slime.counters.forcesTargeting_untilTurn = (t.gs.turn || 0) + 1;
  slime.counters.buffs = { ...(slime.counters.buffs || {}), forcesTargeting: true };
  return slime;
}
const gegnerListen = (t, op, wer) => t.targets.filter(x => (wer == null || x.who === wer) && x.valid.some(v => v.owner === op)).map(x => x.valid.filter(v => v.owner === op).map(v => v.id).sort().join(','));
const nurSlime = (t, op, slimeId, wer) => { const l = gegnerListen(t, op, wer); return l.length >= 1 && l.every(x => x === slimeId); };
const gemischt = (t, op, slimeId, wer) => { const l = gegnerListen(t, op, wer); return l.some(x => x.split(',').includes(slimeId) && x.split(',').length >= 2); };

async function szene(me, op, hand, o = {}) {
  const hands = [[], []]; hands[o.handSeite ?? me] = hand.slice();
  const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: o.aktiv ?? me, gold: o.gold ?? 200 });
  const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
  const eigene = t.put(me, 2, 1, H.INERT.creature); eigene.turnPlayed = 1;
  const slime = t.put(op, 2, 2, o.spoetter || 'Hardy Slime'); stempel(t, slime, me);
  return { t, slime };
}
const mischliste = (t, op) => {
  const l = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
  for (const inst of t.engine.cardInstances) if (inst.zone === 'support' && inst.owner === op && inst.name !== 'Test') l.push({ id: `equip-${op}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: op, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
  return l;
};
/** Mischliste mit ausdrücklicher Quelle → angebotene (nicht ausgegraute) IDs. */
async function angebot(t, me, op, quelle) {
  let a = null;
  t.targetFn = (v) => { a = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
  await t.run(async () => { await t.engine.promptEffectTarget(me, mischliste(t, op), { title: 'Mischliste', sourceCard: quelle, cancellable: true }); });
  return a;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-2-2`;

    // ── Punkt 2: Artefakte mit Subtyp Creature gelten auf dem Brett als Creatures (Creature effect → Taunt JA) ──
    {
      const { t } = await szene(me, op, []);
      for (const n of ['Debt-O-Tron Model Missing Parts', 'Debt-O-Tron Model Scrap Plow', 'Debt-O-Tron Model Loan Shredder', 'Powder Keg', 'Pollution Spewer']) {
        R.check(`2 ${n} (Artifact/Creature, auf dem Brett) → Taunt JA`, t.engine.tauntGiltFuerQuelle({ name: n, owner: me, controller: me, heroIdx: 0, zone: 'support' }) === true);
      }
      const a = await angebot(t, me, op, { name: 'Debt-O-Tron Model Missing Parts', owner: me, controller: me, heroIdx: 0, zone: 'support' });
      R.check('2 gemischte Liste, Quelle Debt-O-Tron Missing Parts: nur der Slime (Taunt)', a === slimeId, a);
    }
    {   // echter Weg: Missing Parts („choose a target and deal damage equal to 10 times the amount of negative Gold")
      const { t } = await szene(me, op, [], { gold: 0 });
      t.setGold(me, -50);
      t.put(me, 0, 0, 'Debt-O-Tron Model Missing Parts').turnPlayed = 1;
      t.gs.activePlayer = me; t.phase(2);
      await t.activateCreature(me, 0, 0);
      R.check('2 Debt-O-Tron Missing Parts (echter Weg): nur der Slime wählbar', nurSlime(t, op, slimeId, me), t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
      R.check('2 Missing Parts: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── Punkt 4: Deepsea Horror Clown wie Hardy Slime ──
    {
      const { t } = await szene(me, op, [], { spoetter: 'Deepsea Horror Clown' });
      const ja = { 'Attack (Hand)': { name: 'Attack', zone: 'hand' }, 'Spell (Hand): Fireball': { name: 'Fireball', zone: 'hand' }, 'Creature effect: Skeleton Archer': { name: 'Skeleton Archer', zone: 'support' },
        'Surprise (Spell): Gold Trap': { name: 'Gold Trap', zone: 'surprise' }, 'Surprise (Attack): Bluff': { name: 'Bluff', zone: 'surprise' }, 'Kreatur-Surprise: Water Golem': { name: 'Water Golem', zone: 'surprise' } };
      const nein = { 'Trank: Poison Vial': { name: 'Poison Vial', zone: 'hand' }, 'Artefakt: Book of Doom': { name: 'Book of Doom', zone: 'hand' }, 'Ability: Occultism': { name: 'Occultism', zone: 'ability' },
        'Ausrüstung: Pocket Catapult': { name: 'Pocket Catapult', zone: 'support' }, 'Reaktions-Artefakt: Racket Arrow': { name: 'Racket Arrow', zone: 'hand' } };
      for (const [k, q] of Object.entries(ja)) {
        const a = await angebot(t, me, op, { ...q, owner: me, controller: me, heroIdx: 0 });
        R.check(`4 Deepsea Horror Clown, Quelle ${k}: Taunt JA (nur der Clown)`, a === slimeId, a);
      }
      for (const [k, q] of Object.entries(nein)) {
        const a = await angebot(t, me, op, { ...q, owner: me, controller: me, heroIdx: 0 });
        R.check(`4 Deepsea Horror Clown, Quelle ${k}: KEIN Taunt (alle Gegnerziele)`, (a || '').split(',').length === 5 && a.split(',').includes(slimeId), a);
      }
      const dbText = require('../../../../data/cards.json').find(c => c.name === 'Deepsea Horror Clown').effect;
      R.check('4 Kartentext: „…all Attacks, Spells and Creature effects they use during their next turn, if possible."', /choose it as the target of all Attacks, Spells and Creature effects they use during their next turn, if possible\./.test(dbText), dbText);
      R.check('4 Skript deklariert tauntNurAttackSpellKreatur', require('../../../../cards/effects/_loader').loadCardEffect('Deepsea Horror Clown').tauntNurAttackSpellKreatur === true);
    }
    {   // echte Wege mit dem Clown: Trank → kein Taunt; Attack → Taunt
      const t = await H.fresh({ hand: me === 0 ? [['Poison Vial', 'Attack'], []] : [[], ['Poison Vial', 'Attack']], hp: 800, deckSize: 20, active: me, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Deepsea Horror Clown'), me);
      await t.play(me, 'Poison Vial');
      R.check('4 Clown, Trank Poison Vial (echter Weg): KEIN Taunt (Clown und weitere Gegnerziele wählbar)', gemischt(t, op, slimeId, me), gegnerListen(t, op, me));
      t.reset();
      for (let hi = 0; hi < 3; hi++) t.hero(me, hi).atk = 100;
      await t.play(me, 'Attack', { hero: 0 });
      R.check('4 Clown, Attack (echter Weg): Taunt JA (nur der Clown wählbar)', nurSlime(t, op, slimeId, me), gegnerListen(t, op, me));
      R.check('4 Clown: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── Punkt 5: Bomb Arrow / Racket Arrow — eigene Artifact-Effekte, kein Taunt; der Attack selbst bindet ──
    for (const pfeil of ['Racket Arrow', 'Bomb Arrow']) {
      const { t } = await szene(me, op, ['Attack', pfeil]);
      for (let hi = 0; hi < 3; hi++) t.hero(me, hi).atk = 100;
      await t.play(me, 'Attack', { hero: 0 });
      const atk = t.targets.filter(x => x.who === me && !(x.config && x.config.title === pfeil) && x.valid.some(v => v.owner === op));
      const arr = t.targets.filter(x => x.config && x.config.title === pfeil);
      R.check(`5 ${pfeil}: der Attack selbst bindet (Gegnerseite nur der Slime)`, atk.length >= 1 && atk.every(x => x.valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId), t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
      R.check(`5 ${pfeil}: die Kreaturenwahl des Pfeils umgeht den Taunt (Slime und die andere Gegner-Kreatur wählbar)`, arr.length === 1 && arr[0].valid.filter(v => v.owner === op).map(v => v.id).sort().join(',') === ['equip-' + op + '-1-0', slimeId].sort().join(','), t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
      R.check(`5 ${pfeil}: sauber`, sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── Punkt 6: Area-/Anhang-Karten: auf dem Brett kein Taunt, aus der Hand als Spell ja ──
    {
      const { t } = await szene(me, op, []);
      for (const [n, z] of [['The Seventh Circle of Hell', 'area'], ['Acid Rain', 'area'], ['Overheal Shock', 'support'], ['Anti Magic Enchantment', 'support']]) {
        R.check(`6 ${n} (${z}, auf dem Brett) → Taunt NEIN`, t.engine.tauntGiltFuerQuelle({ name: n, owner: me, controller: me, heroIdx: 0, zone: z }) === false);
        R.check(`6 ${n} (Hand, als Spell gespielt) → Taunt JA`, t.engine.tauntGiltFuerQuelle({ name: n, owner: me, controller: me, heroIdx: 0, zone: 'hand' }) === true);
      }
      const a1 = await angebot(t, me, op, { name: 'The Seventh Circle of Hell', owner: me, controller: me, heroIdx: -1, zone: 'area' });
      R.check('6 Seventh Circle of Hell auf dem Brett (Trigger-Zielwahl): KEIN Taunt', (a1 || '').split(',').length === 5 && a1.split(',').includes(slimeId), a1);
      const a2 = await angebot(t, me, op, { name: 'The Seventh Circle of Hell', owner: me, controller: me, heroIdx: -1, zone: 'hand' });
      R.check('6 Seventh Circle of Hell aus der Hand (Spell): Taunt JA', a2 === slimeId, a2);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
