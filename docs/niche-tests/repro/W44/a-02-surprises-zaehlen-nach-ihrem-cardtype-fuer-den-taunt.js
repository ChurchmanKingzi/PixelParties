'use strict';
// W44a · Punkt 1 · Al, 22.10.2026: „Bluff müsste eine Attack sein, kein Spell. Aber ja, generell gilt: Eine Surprise, die Ziele wählt oder irgendwie affected, gilt als Attack, Spell oder Creature
//  (eben je nach cardType)."
// Regel: die auflösende Surprise zählt für den Taunt (Hardy Slime, Deepsea Horror Clown: `tauntNurAttackSpellKreatur`) und die Einordnung „Attack/Spell/Creature effect" NACH ihrem `cardType`:
//  Attack → Attack, Spell → Spell, Creature → Creature effect. Eine Surprise mit anderem cardType (Shield of Wisdom: Artifact) bleibt außerhalb. (W43a ließ „Surprises, die keine Kreatur sind" den Taunt umgehen.)
// (A) Klassifikation `engine.tauntGiltFuerQuelle` für ALLE Surprise-Karten der Datenbank (nach cardType)  (B) echte Spielwege: Gold Trap (Wahl einer Kreatur), Jumpscare (Stun-Ziel nach dem Angriff),
//     Telekinesis → Booby Trap / Firewall / Toxic Trap (freie Zielwahl), Mountain Tear River (Zusatz-Brände)  (C) gleiche gemischte Liste, Quelle = jede Surprise (ausdrückliche Quelle)
//  (D) Gegenproben: ohne Taunt, Slime nicht wählbar, Deepsea Horror Clown verhält sich gleich, Doomed Town Guard unverändert
// Beide Sitze. Exit 1 auf der Basis 0e81006a (A: Spell-/Attack-Surprises; B: Gold Trap, Jumpscare, Telekinesis-Wege; C), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W44/a-02-surprises-zaehlen-nach-ihrem-cardtype-fuer-den-taunt.js   (Exit 0 = korrekt)
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
  const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: o.aktiv ?? me, gold: 200 });
  const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
  const eigene = t.put(me, 2, 1, H.INERT.creature); eigene.turnPlayed = 1;
  let slime = null;
  if (!o.ohneSlime) { slime = t.put(op, 2, 2, o.spoetter || 'Hardy Slime'); if (!o.ohneTaunt) stempel(t, slime, me); else slime.turnPlayed = 1; }
  return { t, slime };
}

(async () => {
  const R = H.runner();
  const db = require('../../../../data/cards.json');
  const surprises = (Array.isArray(db) ? db : Object.values(db)).filter(c => /Surprise/.test(JSON.stringify(c.subtype)));
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const slimeId = `equip-${op}-2-2`;

    // ── (A) Klassifikation: alle Surprises nach cardType ──
    {
      const { t } = await szene(me, op, []);
      const e = t.engine;
      let ja = 0, nein = 0;
      for (const c of surprises) {
        const erwartet = /Attack|Spell|Creature/.test(String(c.cardType));
        const ist = e.tauntGiltFuerQuelle({ name: c.name, owner: me, controller: me, heroIdx: 0, zone: 'surprise' });
        R.check(`A ${c.name} (cardType ${c.cardType}) → Taunt ${erwartet ? 'JA' : 'NEIN'}`, ist === erwartet, ist);
        if (erwartet) ja++; else nein++;
      }
      R.note('A Surprise-Karten in der Datenbank', { gesamt: surprises.length, ja, nein });
      R.check('A Bluff ist Attack (nicht Spell) → Taunt JA', e.tauntGiltFuerQuelle({ name: 'Bluff', zone: 'surprise' }) === true && db.find(c => c.name === 'Bluff').cardType === 'Attack');
      // W45a: die Karte Shield of Wisdom als Quelle bleibt Artifact; ihre echte Umleitungswahl trägt die umgeleitete Kreatur als Quelle und bindet den Taunt (W45/a-01).
      R.check('A Shield of Wisdom (Artifact/Surprise) → kein Attack/Spell/Creature → Taunt NEIN', e.tauntGiltFuerQuelle({ name: 'Shield of Wisdom', zone: 'surprise' }) === false);
      // W45a (Al, 22.10.2026, Punkt 2) umgestellt: `sourceEffectKind` liefert für eine auflösende Surprise den Typ nach cardType (vorher immer 'surprise'; Challenge/Martyry/Anti-Magnet/Alleria/Empty Armor lesen ihn).
      // Ein anderer Kartentyp (Shield of Wisdom: Artifact) bleibt 'surprise' — seine Umleitungswahl trägt die umgeleitete Kreatur als Quelle (W45/a-01).
      R.check('A sourceEffectKind nach cardType (W45a): Gold Trap → spell, Bluff → attack, Water Golem → creature, Shield of Wisdom → surprise', e.sourceEffectKind({ name: 'Gold Trap', zone: 'surprise' }) === 'spell' && e.sourceEffectKind({ name: 'Bluff', zone: 'surprise' }) === 'attack'
        && e.sourceEffectKind({ name: 'Water Golem', zone: 'surprise' }) === 'creature' && e.sourceEffectKind({ name: 'Shield of Wisdom', zone: 'surprise' }) === 'surprise');
      // andere Quellen unverändert
      R.check('A Gegenproben: Book of Doom NEIN, Poison Vial NEIN, Fireball JA, Skeleton Archer JA', e.tauntGiltFuerQuelle({ name: 'Book of Doom', zone: 'hand' }) === false && e.tauntGiltFuerQuelle({ name: 'Poison Vial', zone: 'hand' }) === false
        && e.tauntGiltFuerQuelle({ name: 'Fireball', zone: 'hand' }) === true && e.tauntGiltFuerQuelle({ name: 'Skeleton Archer', zone: 'support' }) === true);
    }

    // ── (B) echte Spielwege (Slime = Taunt, gemischte Liste) ──
    {   // Gold Trap: „you may choose any Creature on the board and add it to your hand"
      const { t } = await szene(me, op, []);
      t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
      R.check('B Gold Trap (Spell/Surprise): Taunt JA — von den Gegner-Kreaturen ist nur der Slime wählbar', nurSlime(t, op, slimeId, me), t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
      R.check('B Gold Trap: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Jumpscare: „After the Attack … resolves, choose any target on the board and Stun it for 2 turns."
      const t = await H.fresh({ hand: me === 0 ? [[], ['Attack']] : [['Attack'], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      const andere = t.put(op, 1, 0, H.INERT.creature); andere.turnPlayed = 1;
      stempel(t, t.put(op, 2, 2, 'Hardy Slime'), me);
      t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
      for (let hi = 0; hi < 3; hi++) t.hero(op, hi).atk = 100;
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0); return [(h || v[0]).id]; };
      await t.play(op, 'Attack', { hero: 0 });
      const js = t.targets.filter(x => x.config && x.config.title === 'Jumpscare');
      R.check('B Jumpscare (Spell/Surprise): Taunt JA — Gegnerseite nur der Slime wählbar', js.length === 1 && js[0].who === me && js[0].valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId, t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')));
      R.check('B Jumpscare: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    for (const sname of ['Booby Trap', 'Firewall', 'Toxic Trap']) {   // Telekinesis: „you may choose any target for it" — freie Zielwahl der Surprise
      const { t } = await szene(me, op, ['Telekinesis']);
      t.setAbilities(me, 1, [['Magic Arts'], [], []]);
      t.putSurprise(me, 0, sname); t.grantFor(me, 0, sname);
      const r = await t.play(me, 'Telekinesis', { hero: 1, noGrant: true });
      const w = t.targets.filter(x => x.who === me && x.valid.some(v => v.owner === op));
      R.check(`B Telekinesis → ${sname}: Taunt JA — freie Zielwahl der Surprise bietet auf der Gegnerseite nur den Slime`, w.length >= 1 && w.every(x => x.valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId), { r, titel: t.targets.map(x => (x.config && x.config.title) + ':' + x.valid.map(v => v.id).join('+')) });
      R.check(`B Telekinesis → ${sname}: sauber`, sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Mountain Tear River (Destruction Magic 3): „Burn up to 2 additional targets" nach dem Angreifer-Brand
      const { t } = await szene(me, op, [], { aktiv: op });
      t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
      t.putSurprise(me, 0, 'Mountain Tear River');
      t.setHand(op, ['Attack']);
      for (let hi = 0; hi < 3; hi++) t.hero(op, hi).atk = 100;
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0); return [(h || v[0]).id]; };
      await t.play(op, 'Attack', { hero: 0 });
      const m = t.targets.filter(x => x.config && x.config.title === 'Mountain Tear River' && x.who === me);
      R.check('B Mountain Tear River (Spell/Surprise, DM3): Taunt JA — die Zusatz-Brände bieten auf der Gegnerseite nur den Slime', m.length >= 1 && m.every(x => x.valid.filter(v => v.owner === op).map(v => v.id).join(',') === slimeId), t.targets.map(x => (x.config && x.config.title) + ':' + x.who + ':' + x.valid.map(v => v.id).join('+')));
      R.check('B Mountain Tear River: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── (C) dieselbe gemischte Liste, Quelle = jede Surprise (ausdrückliche Quelle) ──
    {
      for (const c of surprises) {
        const erwartet = /Attack|Spell|Creature/.test(String(c.cardType));
        const { t } = await szene(me, op, []);
        const l = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
        for (const inst of t.engine.cardInstances) if (inst.zone === 'support' && inst.owner === op && inst.name !== 'Test') l.push({ id: `equip-${op}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: op, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
        let angebot = null;
        t.targetFn = (v) => { angebot = v.filter(x => !x.ineligible).map(x => x.id).sort().join(','); return [v[0].id]; };
        await t.run(async () => { await t.engine.promptEffectTarget(me, l, { title: 'Mischliste', sourceCard: { name: c.name, owner: me, controller: me, heroIdx: 0, zone: 'surprise' }, cancellable: true }); });
        R.check(`C Mischliste, Quelle ${c.name} (${c.cardType}): ${erwartet ? 'Taunt (nur der Slime)' : 'KEIN Taunt (alle Gegnerziele)'}`, erwartet ? angebot === slimeId : (angebot || '').split(',').length === 5 && angebot.split(',').includes(slimeId), angebot);
      }
    }

    // ── (D) Gegenproben ──
    {   // ohne Taunt-Stempel: Gold Trap bietet Slime UND weitere Kreaturen
      const { t } = await szene(me, op, [], { ohneTaunt: true });
      t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
      R.check('D ohne Taunt: Gold Trap bietet Slime und weitere Gegner-Kreaturen an', gemischt(t, op, slimeId, me), gegnerListen(t, op, me));
    }
    {   // Slime selbst nicht wählbar (untargetable_all): Gold Trap ohne Taunt, übrige Kreaturen wählbar
      const { t, slime } = await szene(me, op, []);
      slime.counters.untargetable_all = true;
      t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
      const l = gegnerListen(t, op, me);
      R.check('D Slime nicht wählbar: Gold Trap kann die übrige Gegner-Kreatur wählen (kein Taunt)', l.length === 1 && l[0].includes(`equip-${op}-1-0`) && !l[0].split(',').includes(slimeId), l);
    }
    {   // Deepsea Horror Clown: gleiche Einschränkung wie Hardy Slime — Gold Trap (Spell-Surprise) → Taunt, Trank → kein Taunt
      const { t } = await szene(me, op, [], { spoetter: 'Deepsea Horror Clown' });
      t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
      await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
      R.check('D Deepsea Horror Clown: Gold Trap (Spell-Surprise) → Taunt JA (nur der Clown wählbar)', nurSlime(t, op, slimeId, me), gegnerListen(t, op, me));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
