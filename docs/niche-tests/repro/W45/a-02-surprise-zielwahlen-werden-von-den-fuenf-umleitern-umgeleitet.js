'use strict';
// W45a · Punkt 2 · Al, 22.10.2026: „Ja, das soll genauso umgestellt werden." (Challenge, Martyry, Anti-Magnet, Alleria, Empty Armor leiten künftig auch die Zielwahl einer auflösenden SURPRISE um —
// nach demselben Grundsatz „Surprise zählt nach cardType": Attack → Attack, Spell → Spell, Creature → Creature effect; alle fünf Kartentexte decken „Attack, Spell or Creature effect" ab.)
// Regel: `engine.sourceEffectKind` liefert für eine auflösende Surprise den Typ nach cardType ('attack' | 'spell' | 'creature'; nur ein anderer Kartentyp — Shield of Wisdom, Artifact — bleibt 'surprise'),
// und die Zielwahl der Surprise (`promptEffectTarget` ohne eigene Quelle: Gold Trap, Jumpscare) nennt die auflösende Surprise als Quelle des Umleitungsfensters (`_surpriseQuelleFuer`).
// Repros je Umleiter (beide Sitze; `me` hält die Surprise, `op` den Umleiter und ist Ziel):
//   A  Challenge    × Jumpscare (Stun-Ziel op-Held 0 → ein anderer op-Held)            · × Booby Trap mit Telekinesis (100 Schaden → anderer op-Held)
//   B  Martyry      × Mountain Tear River (Zusatz-Brand auf op-Held 1 → op-Held 2)
//   C  Anti-Magnet  × Gold Trap (Kreaturenwahl A → andere Kreatur B); 2 Gold Kosten
//   D  Alleria      × Jumpscare (op-Held 0 = Alleria → Held mit Surprise)
//   E  Empty Armor  × Jumpscare (op-Held 0 → Empty Armor)
//   F  Gegenproben: ohne Umleiter freie Wahl (A–E); Quelle vom nicht abgedeckten Typ (Shield of Wisdom: Artifact/Surprise) → `canRedirect`/`canHeroRedirect`/`canBoardRedirect` = false,
//      dieselbe Karte als Spell-Surprise (Jumpscare) = true; Klassifikation aller 47 Surprise-Karten nach cardType.
// Exit 1 auf der Basis e1489df1 (Surprise-Quelle = 'surprise' bzw. keine Quelle), Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W45/a-02-surprise-zielwahlen-werden-von-den-fuenf-umleitern-umgeleitet.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ALLERIA = 'Alleria, the Queen of Spiders';
const stunned = (t, s, hi) => !!(t.hero(s, hi).statuses && t.hero(s, hi).statuses.stunned);
const burned = (t, s, hi) => !!(t.hero(s, hi).statuses && t.hero(s, hi).statuses.burned);

/** Jumpscare: `op` greift mit Attack den Helden 0 von `me` an; Jumpscare (me) wählt danach `wahl(v)`. */
async function jumpscare(me, op, o = {}) {
  const hand = ['Attack'].concat(o.hand || []);
  const t = await H.fresh({ hand: me === 0 ? [[], hand] : [hand, []], hp: 800, deckSize: 20, active: op, gold: 200 });
  t.putSurprise(me, 0, 'Jumpscare'); t.grantFor(me, 0, 'Jumpscare');
  for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; if (o.hand) t.grantFor(op, hi, o.hand[0]); }
  if (o.vorbereiten) o.vorbereiten(t, me, op);
  t.targetFn = (v, c) => {
    if (c && c.title === 'Jumpscare') return [o.wahl(v)];
    if (c && o.umleiterTitel && c.title === o.umleiterTitel) return [v.find(x => !x.ineligible && x.owner === op).id];
    const h = v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0); return [(h || v[0]).id];
  };
  await t.play(op, 'Attack', { hero: 0 });
  return t;
}

(async () => {
  const R = H.runner();
  const db = require('../../../../data/cards.json');
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' hält die Surprise, Sitz ' + op + ' den Umleiter');
    const heroOp0 = `hero-${op}-0`;

    // ── A Challenge × Jumpscare ──
    {
      const t = await jumpscare(me, op, { hand: ['Challenge'], wahl: () => heroOp0, umleiterTitel: 'Challenge' });
      const ch = t.prompts.filter(p => p.d && p.d.title === 'Challenge' && /targeted by Jumpscare/.test(p.d.message));
      R.check('A Challenge × Jumpscare: Challenge wird für die Stun-Wahl angeboten (Jumpscare = Spell)', ch.length === 1 && ch[0].pi === op, t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('A Challenge × Jumpscare: der Stun trifft einen anderen op-Helden, nicht den gewählten Helden 0', !stunned(t, op, 0) && (stunned(t, op, 1) !== stunned(t, op, 2)), [0, 1, 2].map(i => stunned(t, op, i)));
      R.check('A Challenge × Jumpscare: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Gegenprobe: ohne Challenge freie Wahl
      const t = await jumpscare(me, op, { wahl: () => heroOp0 });
      R.check('A ohne Challenge: Held 0 wird betäubt (freie Wahl)', stunned(t, op, 0) && !stunned(t, op, 1) && !stunned(t, op, 2), [0, 1, 2].map(i => stunned(t, op, i)));
    }
    {   // Challenge × Booby Trap mit Telekinesis (ctx.promptDamageTarget, Quelle = die Surprise-Instanz)
      const hands = [[], []]; hands[me] = ['Telekinesis']; hands[op] = ['Challenge'];
      const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: me, gold: 200 });
      t.setAbilities(me, 1, [['Magic Arts'], [], []]);
      t.putSurprise(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Booby Trap');
      for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Challenge');
      t.targetFn = (v, c) => {
        if (c && c.title === 'Booby Trap') return [heroOp0];
        if (c && c.title === 'Challenge') return [v.find(x => !x.ineligible && x.owner === op).id];
        return [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      };
      await t.play(me, 'Telekinesis', { hero: 1, noGrant: true });
      const ch = t.prompts.filter(p => p.d && p.d.title === 'Challenge');
      R.check('A Challenge × Booby Trap (Telekinesis): Challenge wird angeboten (Booby Trap = Spell)', ch.length >= 1 && ch[0].pi === op, t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('A Challenge × Booby Trap (Telekinesis): die 100 Schaden treffen einen anderen op-Helden, Held 0 bleibt heil', t.hp(op, 0) === 800 && (t.hp(op, 1) === 700) !== (t.hp(op, 2) === 700), [0, 1, 2].map(i => t.hp(op, i)));
      R.check('A Challenge × Booby Trap: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }

    // ── B Martyry × Mountain Tear River (Destruction Magic 3: bis zu 2 Zusatz-Brände) ──
    {
      const hands = [[], []]; hands[op] = ['Attack', 'Martyry'];
      const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: op, gold: 200 });
      t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
      t.putSurprise(me, 0, 'Mountain Tear River');
      for (let hi = 0; hi < 3; hi++) { t.hero(op, hi).atk = 100; t.grantFor(op, hi, 'Martyry'); }
      t.targetFn = (v, c) => {
        if (c && c.title === 'Mountain Tear River') return [`hero-${op}-1`];
        if (c && c.title === 'Martyry') return [v.find(x => !x.ineligible && x.owner === op).id];
        return [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      };
      await t.play(op, 'Attack', { hero: 0 });
      const m = t.prompts.filter(p => p.d && p.d.title === 'Martyry');
      R.check('B Martyry × Mountain Tear River: Martyry wird für den Zusatz-Brand angeboten (Mountain Tear River = Spell)', m.length === 1 && m[0].pi === op && /targeted by Mountain Tear River/.test(m[0].d.message), t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('B Martyry × Mountain Tear River: der Zusatz-Brand trifft Held 2 statt Held 1', burned(t, op, 2) && !burned(t, op, 1), [0, 1, 2].map(i => burned(t, op, i)));
      R.check('B Martyry × Mountain Tear River: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
    }
    {   // Gegenprobe: ohne Martyry freie Wahl
      const hands = [[], []]; hands[op] = ['Attack'];
      const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: op, gold: 200 });
      t.setAbilities(me, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
      t.putSurprise(me, 0, 'Mountain Tear River');
      for (let hi = 0; hi < 3; hi++) t.hero(op, hi).atk = 100;
      t.targetFn = (v, c) => (c && c.title === 'Mountain Tear River') ? [`hero-${op}-1`] : [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Attack', { hero: 0 });
      R.check('B ohne Martyry: der Zusatz-Brand trifft Held 1 (freie Wahl)', burned(t, op, 1) && !burned(t, op, 2), [0, 1, 2].map(i => burned(t, op, i)));
    }

    // ── C Anti-Magnet × Gold Trap ──
    {
      const run = async (mitAM) => {
        const hands = [[], []]; if (mitAM) hands[op] = ['Anti-Magnet'];
        const t = await H.fresh({ hand: hands, hp: 800, deckSize: 20, active: me, gold: 200 });
        const a = t.put(op, 1, 0, H.INERT.creature); a.turnPlayed = 1;
        const b = t.put(op, 2, 1, H.INERT.creature); b.turnPlayed = 1;
        t.putSurprise(me, 0, 'Gold Trap'); t.grantFor(me, 0, 'Gold Trap');
        const idA = `equip-${op}-1-0`, idB = `equip-${op}-2-1`;
        t.targetFn = (v, c) => (c && c.title === 'Gold Trap') ? [idA] : [(v.find(x => !x.ineligible && x.id === idB) || v.find(x => !x.ineligible)).id];
        await t.run(() => t.engine.actionGainGold(op, 30, { name: 'x', owner: op }));
        return { t, a, b };
      };
      const mit = await run(true);
      const am = mit.t.prompts.filter(p => p.d && p.d.title === 'Anti-Magnet');
      R.check('C Anti-Magnet × Gold Trap: Anti-Magnet wird für die Kreaturenwahl angeboten (Gold Trap = Spell)', am.length === 1 && am[0].pi === op && /targeted by Gold Trap/.test(am[0].d.message), mit.t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('C Anti-Magnet × Gold Trap: statt Kreatur A kommt Kreatur B auf die Hand von me', !!mit.t.zone(op, 1, 0) && !mit.t.zone(op, 2, 1) && mit.t.pile(me, 'hand').filter(n => n === H.INERT.creature).length === 1, { a: !!mit.t.zone(op, 1, 0), b: !!mit.t.zone(op, 2, 1), hand: mit.t.pile(me, 'hand') });
      R.check('C Anti-Magnet × Gold Trap: sauber', sauber(mit.t), { errors: mit.t.errors, audit: mit.t.audit() });
      const ohne = await run(false);
      R.check('C ohne Anti-Magnet: Kreatur A (freie Wahl) landet auf der Hand von me', !ohne.t.zone(op, 1, 0) && !!ohne.t.zone(op, 2, 1) && ohne.t.pile(me, 'hand').filter(n => n === H.INERT.creature).length === 1, { a: !!ohne.t.zone(op, 1, 0), b: !!ohne.t.zone(op, 2, 1), hand: ohne.t.pile(me, 'hand') });
    }

    // ── D Alleria × Jumpscare ──
    {
      const vorb = (t, me2, op2) => { t.setHero(op2, 0, ALLERIA, 800); t.putSurprise(op2, 1, 'Glass Wall'); };
      const t = await jumpscare(me, op, { wahl: () => heroOp0, vorbereiten: vorb });
      const al = t.prompts.filter(p => p.d && p.d.title === ALLERIA);
      R.check('D Alleria × Jumpscare: Alleria bietet die Umleitung der Stun-Wahl an (Jumpscare = Spell)', al.length === 1 && al[0].pi === op, t.prompts.map(p => p.d.title + '|' + p.d.message));
      R.check('D Alleria × Jumpscare: der Stun trifft den Helden mit der Surprise (Held 1), nicht Alleria', !stunned(t, op, 0) && stunned(t, op, 1), [0, 1, 2].map(i => stunned(t, op, i)));
      R.check('D Alleria × Jumpscare: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
      const g = await jumpscare(me, op, { wahl: () => heroOp0, vorbereiten: (t2, m2, o2) => { t2.setHero(o2, 0, ALLERIA, 800); } });
      R.check('D Gegenprobe Alleria ohne zweiten Helden mit Surprise: keine Umleitung, Alleria wird betäubt', stunned(g, op, 0) && !g.prompts.some(p => p.d && p.d.title === ALLERIA), g.prompts.map(p => p.d.title));
    }

    // ── E Empty Armor × Jumpscare ──
    {
      let armor = null;
      const t = await jumpscare(me, op, { wahl: () => heroOp0, vorbereiten: (t2, m2, o2) => { armor = t2.put(o2, 0, 0, 'Empty Armor'); armor.turnPlayed = 1; } });
      const armorStun = !!(armor.statuses && armor.statuses.stunned) || !!(armor.counters && (armor.counters.stunned || (armor.counters.statuses && armor.counters.statuses.stunned)));
      R.check('E Empty Armor × Jumpscare: die Stun-Wahl auf den Helden 0 wird auf Empty Armor umgeleitet (Held 0 bleibt unbetäubt)', !stunned(t, op, 0) && armorStun, { held: stunned(t, op, 0), armor: armor.statuses, c: armor.counters });
      R.check('E Empty Armor × Jumpscare: sauber', sauber(t), { errors: t.errors, audit: t.audit() });
      const g = await jumpscare(me, op, { wahl: () => heroOp0 });
      R.check('E ohne Empty Armor: Held 0 wird betäubt', stunned(g, op, 0), [0, 1, 2].map(i => stunned(g, op, i)));
    }

    // ── F Gegenproben: Quelle vom nicht abgedeckten Typ (Shield of Wisdom: Artifact) bzw. Klassifikation ──
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      const e = t.engine;
      const sel = { id: `hero-${op}-0`, type: 'hero', owner: op, heroIdx: 0, cardName: 'x' };
      const valid = [0, 1, 2].map(i => ({ id: `hero-${op}-${i}`, type: 'hero', owner: op, heroIdx: i, cardName: 'x' }));
      const quelle = (name) => ({ name, owner: me, controller: me, heroIdx: 0, zone: 'surprise' });
      t.hand = t.gs.players[op].hand; t.gs.players[op].hand.push('Challenge', 'Martyry', 'Anti-Magnet');
      for (let hi = 0; hi < 3; hi++) { t.grantFor(op, hi, 'Challenge'); t.grantFor(op, hi, 'Martyry'); }
      for (const n of ['Challenge', 'Martyry', 'Anti-Magnet']) {
        const sc = loadCardEffect(n);
        if (n === 'Anti-Magnet') valid.push({ id: `hero-${op}-9`, type: 'hero', owner: op, heroIdx: 9, cardName: 'y' });
        const mit = (name) => sc.canRedirect(t.gs, op, sel, valid, {}, e, quelle(name));
        R.check(`F ${n}.canRedirect: Spell-Surprise Jumpscare → ${n === 'Anti-Magnet' ? 'Gold-/Ziel-abhängig, nicht durch den Typ gesperrt' : 'true'}; Artifact-Surprise Shield of Wisdom → false`, mit('Shield of Wisdom') === false && (n === 'Anti-Magnet' ? true : mit('Jumpscare') === true), { shield: mit('Shield of Wisdom'), jump: mit('Jumpscare') });
      }
      const al = loadCardEffect(ALLERIA);
      R.check('F Alleria.canHeroRedirect: Shield of Wisdom als Quelle → false', al.canHeroRedirect(t.gs, op, 0, sel, valid, {}, e, quelle('Shield of Wisdom')) === false);
      const ea = loadCardEffect('Empty Armor');
      const inst = t.put(op, 0, 0, 'Empty Armor'); inst.turnPlayed = 1;
      const v2 = valid.concat([{ id: `equip-${op}-0-0`, type: 'equip', owner: op, heroIdx: 0, slotIdx: 0, cardName: 'Empty Armor', cardInstance: inst }]);
      R.check('F Empty Armor.canBoardRedirect: Jumpscare (Spell-Surprise) → true, Shield of Wisdom (Artifact-Surprise) → false', ea.canBoardRedirect(t.gs, op, inst, sel, v2, {}, quelle('Jumpscare'), e) === true && ea.canBoardRedirect(t.gs, op, inst, sel, v2, {}, quelle('Shield of Wisdom'), e) === false);
    }
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 200 });
      const e = t.engine;
      const surprises = (Array.isArray(db) ? db : Object.values(db)).filter(c => /Surprise/.test(JSON.stringify(c.subtype)));
      let n = 0;
      for (const c of surprises) {
        const erwartet = /Attack/.test(c.cardType) ? 'attack' : /Spell/.test(c.cardType) ? 'spell' : /Creature/.test(c.cardType) ? 'creature' : 'surprise';
        const ist = e.sourceEffectKind({ name: c.name, owner: me, controller: me, heroIdx: 0, zone: 'surprise' });
        if (ist !== erwartet) R.check(`F sourceEffectKind(${c.name}, zone surprise) = ${erwartet}`, false, ist);
        n++;
      }
      R.check(`F sourceEffectKind: alle ${n} Surprise-Karten der Datenbank nach cardType (Attack → attack, Spell → spell, Creature → creature, Artifact → surprise)`, n >= 40);
      R.check('F Gegenproben: Karten in anderen Zonen unverändert (Fireball spell, Skeleton Archer creature, Poison Vial potion, Book of Doom artifact)', e.sourceEffectKind({ name: 'Fireball', zone: 'hand' }) === 'spell' && e.sourceEffectKind({ name: 'Skeleton Archer', zone: 'support' }) === 'creature'
        && e.sourceEffectKind({ name: 'Poison Vial', zone: 'hand' }) === 'potion' && e.sourceEffectKind({ name: 'Book of Doom', zone: 'hand' }) === 'artifact');
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
