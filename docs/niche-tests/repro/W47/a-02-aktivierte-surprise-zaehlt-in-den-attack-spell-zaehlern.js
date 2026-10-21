'use strict';
// W47a · Punkt 6 · Al, 22.10.2026: „Eine aktivierte, ja" — eine AKTIVIERTE Spell-/Attack-Surprise zählt (genau einmal) in den „Spells/Attacks diesen Zug"-Zählern: `spellsPlayedThisTurn`,
// `attacksPlayedThisTurn`, `heroesAttackedThisTurn`, `hero._attacksThisTurn` und `onEffectCountedAsArt` (Mirjam, Güldefaber, Brewer's Blade …); daran hängen Teleportal („first Spell"), Fire Bolts
// („first Destruction Magic Spell"), der Silence-Bonus, der Eraser-Beam-Stempel („nur Spells"), Berserk (2 Attacks), Rioting Village (1 Attack). Eine nur GESETZTE Surprise zählt nicht; Creature-Surprises
// zählen nie; eine negierte Aktivierung zählt wie jede gespielte Karte einmal. Gezählt, nicht gesperrt: eine Attack-/Spell-Grenze verhindert die Aktivierung nie (kein Spielzug, keine Aktion) — sie sperrt
// danach die NÄCHSTEN Attacks/Spells. Exit 1 auf der Basis 70453312, Exit 0 auf dem Branch.
// Aufruf: node docs/niche-tests/repro/W47/a-02-aktivierte-surprise-zaehlt-in-den-attack-spell-zaehlern.js   (Exit 0 = korrekt)
const { H, loadCardEffect, szene, angeboten, anzahlAngebote, surprise, waehleHeld, quelle } = require('./_w47.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const MIRJAM = 'Mirjam, the Fallen Cute Angel', GULDE = 'Güldefaber, the King of Dwarfs';
const DM3 = [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []];

/** Aktiviert die Surprise `name` von `me` an Held `hi` direkt (Auslöser: ein Fireball des Gegners auf Held 0). `me` ist am Zug. */
async function aktiviere(t, me, op, name, hi = 1) {
  t.targetFn = (v) => [(v.find(x => !x.ineligible) || v[0]).id];
  const info = name === 'Water Golem' ? { cardName: 'x', owner: op, heroIdx: 0 } : name === 'Gold Trap' ? { activatorIdx: op, amount: 30 } : { cardName: 'Fireball', owner: op, heroIdx: 0 };
  return t.run(() => t.engine._activateSurprise(me, hi, name, info, loadCardEffect(name)));
}
const zaehler = (t, s, hi = 1) => ({ sp: t.gs.players[s].spellsPlayedThisTurn || 0, at: t.gs.players[s].attacksPlayedThisTurn || 0, hat: [...(t.gs.players[s].heroesAttackedThisTurn || [])], ha: t.hero(s, hi)._attacksThisTurn || 0 });
const phase2 = (t) => { t.gs.currentPhase = 2; };

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    // ───────── A · die vier Zähler ─────────
    R.section(`Sitz ${me}: Zähler je Surprise-Art`);
    for (const [name, art] of [['Booby Trap', 'Spell'], ['Gold Trap', 'Spell'], ['Bluff', 'Attack'], ['Water Golem', 'Creature']]) {
      const t = await szene(me, op, { active: me });
      t.putSurprise(me, 1, name); t.grantFor(me, 1, name);
      const vor = zaehler(t, me);
      await aktiviere(t, me, op, name);
      const nach = zaehler(t, me);
      const sollSp = art === 'Spell' ? 1 : 0, sollAt = art === 'Attack' ? 1 : 0;
      R.check(`${name} (${art}): spellsPlayedThisTurn +${sollSp}`, nach.sp - vor.sp === sollSp, { vor, nach });
      R.check(`${name} (${art}): attacksPlayedThisTurn +${sollAt}, heroesAttackedThisTurn ${sollAt ? 'enthält den Wirt (Held 1)' : 'unverändert'}, hero._attacksThisTurn +${sollAt}`,
        nach.at - vor.at === sollAt && (sollAt ? nach.hat.includes(1) : nach.hat.length === vor.hat.length) && nach.ha - vor.ha === sollAt, { vor, nach });
      R.check(`${name}: der Gegner zählt nichts`, (t.gs.players[op].spellsPlayedThisTurn || 0) === 0 && (t.gs.players[op].attacksPlayedThisTurn || 0) === 0, null);
      R.check(`${name}: Surprise wurde aktiviert, sauber`, surprise(t, me, name) && sauber(t), { e: t.errors, a: t.audit() });
    }
    {   // genau EINMAL je Aktivierung — auch in der echten Spielkette (Fireball des Gegners → Booby Trap), keine Doppelzählung mit der Spell-Kette
      const t = await quelle('Booby Trap', me, op);
      R.check('echter Weg (Fireball des Gegners → Booby Trap): spellsPlayedThisTurn von me == 1 (op zählt seinen Fireball: 1)', (t.gs.players[me].spellsPlayedThisTurn || 0) === 1 && (t.gs.players[op].spellsPlayedThisTurn || 0) === 1, { me: t.gs.players[me].spellsPlayedThisTurn, op: t.gs.players[op].spellsPlayedThisTurn });
      const tb = await quelle('Bluff', me, op);
      R.check('echter Weg (Bluff): attacksPlayedThisTurn von me == 1, hero._attacksThisTurn des Wirts (Held 0) == 1', (tb.gs.players[me].attacksPlayedThisTurn || 0) === 1 && (tb.hero(me, 0)._attacksThisTurn || 0) === 1, { at: tb.gs.players[me].attacksPlayedThisTurn, ha: tb.hero(me, 0)._attacksThisTurn });
      const tj = await quelle('Jumpscare', me, op);
      R.check('echter Weg (Jumpscare, aufgeschobene Wirkung): spellsPlayedThisTurn von me == 1', (tj.gs.players[me].spellsPlayedThisTurn || 0) === 1, tj.gs.players[me].spellsPlayedThisTurn);
    }
    {   // nur GESETZT zählt nicht
      const t = await szene(me, op, { active: me });
      t.addHand(me, 'Booby Trap'); t.addHand(me, 'Bluff'); t.grantFor(me, 0, 'Booby Trap'); t.grantFor(me, 0, 'Bluff');
      await t.play(me, 'Booby Trap', { hero: 0 }); await t.play(me, 'Bluff', { hero: 1 });
      const z = zaehler(t, me, 1);
      R.check('nur gesetzte (verdeckt gelegte) Surprises zählen nicht: alle Zähler 0', z.sp === 0 && z.at === 0 && z.hat.length === 0 && z.ha === 0, z);
    }
    {   // negierte Aktivierung (Silence in der Kette) zählt einmal
      const t = await quelle('Booby Trap', me, op, (t) => { t.addHand(op, 'Silence'); for (let hi = 0; hi < 3; hi++) t.grantFor(op, hi, 'Silence'); t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) }); });
      R.check('negierte Surprise (Silence): zählt als aktivierter Spell einmal (wie jede gespielte, negierte Karte)', (t.gs.players[me].spellsPlayedThisTurn || 0) === 1 && t.hp(op, 0) === 800, { sp: t.gs.players[me].spellsPlayedThisTurn, hp: t.hp(op, 0) });
    }

    {   // Lunar Eclipse (als Reaktion in der Kette aktivierte Spell-Surprise) zählt ebenfalls einmal
      const t = await szene(me, op);
      t.putSurprise(me, 0, 'Lunar Eclipse'); t.grantFor(me, 0, 'Lunar Eclipse'); t.put(me, 0, 0, 'Lunatic Cycle - New Moon');
      t.addHand(op, 'Fireball'); t.targetFn = waehleHeld(me, 0);
      await t.play(op, 'Fireball', { hero: 0 });
      R.check('Lunar Eclipse (Kettenreaktion aus der Surprise Zone): aktiviert, spellsPlayedThisTurn von me == 1, sauber', t.logs.some(l => l.type === 'lunar_eclipse_negate') && (t.gs.players[me].spellsPlayedThisTurn || 0) === 1 && sauber(t), { sp: t.gs.players[me].spellsPlayedThisTurn, e: t.errors, a: t.audit() });
    }

    // ───────── B · was an den Zählern hängt ─────────
    R.section(`Sitz ${me}: Mirjam („1 Attack pro Zug")`);
    {
      const t = await szene(me, op, { active: me });
      t.setHero(me, 1, MIRJAM, 800); t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff');
      const vorher = t.engine.heroKannAngreifen(me, 1, me, { name: 'Fireball' });
      await aktiviere(t, me, op, 'Bluff');
      R.check('Mirjam: vor der Aktivierung kann sie angreifen, nach der aktivierten Attack-Surprise nicht mehr (Zähler 1 = Limit); Zählung kam über onEffectCountedAsArt', vorher === true && (t.hero(me, 1)._mirjamAttacksUsed || 0) === 1 && t.engine.heroKannAngreifen(me, 1, me, { name: 'Fireball' }) === false, { vorher, n: t.hero(me, 1)._mirjamAttacksUsed });
      R.check('Mirjam: sauber', sauber(t), { e: t.errors, a: t.audit() });
    }
    R.section(`Sitz ${me}: Berserk (2 Attacks je Held) und Rioting Village (1 Attack je Spieler)`);
    {
      const t = await szene(me, op, { active: me });
      t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff'); t.heroStatus(me, 1, 'berserked'); t.hero(me, 1)._attacksThisTurn = 1;
      R.check('Berserk: vor der Aktivierung (1 Attack) darf der Held noch angreifen', t.engine.heroKannAngreifen(me, 1, me, { name: 'Fireball' }) === true, null);
      await aktiviere(t, me, op, 'Bluff');
      R.check('Berserk: nach der aktivierten Attack-Surprise (2 Attacks) ist er gesperrt', t.hero(me, 1)._attacksThisTurn === 2 && t.engine.heroKannAngreifen(me, 1, me, { name: 'Fireball' }) === false, t.hero(me, 1)._attacksThisTurn);
    }
    {
      const t = await szene(me, op, { active: me });
      t.putArea(me, 'Rioting Village'); t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff');
      R.check('Rioting Village: vor der Aktivierung darf angegriffen werden', t.engine.heroKannAngreifen(me, 2, me, { name: 'Fireball' }) === true, null);
      await aktiviere(t, me, op, 'Bluff');
      R.check('Rioting Village: nach der aktivierten Attack-Surprise (1 Attack) ist jede weitere Attack des Spielers gesperrt', t.engine.heroKannAngreifen(me, 2, me, { name: 'Fireball' }) === false, null);
    }
    {   // Zählen ≠ blockiert werden: die Aktivierung selbst scheitert nie an der Grenze (echter Weg: Fireball des Gegners trifft den Wirt, Rioting Village + Attack-Limit schon erreicht)
      const t = await szene(me, op);
      t.putArea(me, 'Rioting Village'); t.gs.players[me].attacksPlayedThisTurn = 1;
      t.putSurprise(me, 0, 'Bluff'); t.grantFor(me, 0, 'Bluff'); t.addHand(op, 'Fireball'); t.targetFn = waehleHeld(me, 0);
      await t.play(op, 'Fireball', { hero: 0 });
      R.check('Rioting Village mit erreichtem Limit: Bluff aktiviert trotzdem (zieht 3), zählt dann 2', surprise(t, me, 'Bluff') && t.gs.players[me].attacksPlayedThisTurn === 2 && t.pile(me, 'hand').length === 3, { akt: surprise(t, me, 'Bluff'), at: t.gs.players[me].attacksPlayedThisTurn, hand: t.pile(me, 'hand').length });
    }
    R.section(`Sitz ${me}: Teleportal („first Spell"), Fire Bolts („first Destruction Magic Spell"), Silence-Bonus, Eraser Beam`);
    for (const [name, art, schule] of [['Booby Trap', 'Spell', 'Destruction Magic'], ['Gold Trap', 'Spell', 'Decay Magic'], ['Bluff', 'Attack', null], ['Water Golem', 'Creature', null]]) {
      const t = await szene(me, op, { active: me });
      t.putSurprise(me, 1, name); t.grantFor(me, 1, name); t.setAbilities(me, 0, DM3); phase2(t);
      const tele = () => loadCardEffect('Teleportal').inherentAction(t.gs, me, 0, t.engine);
      const bolts = () => loadCardEffect('Fire Bolts').inherentAction(t.gs, me, 0, t.engine);
      const eraser = () => loadCardEffect('Eraser Beam').spellPlayCondition(t.gs, me, t.engine);
      const ps = t.gs.players[me];
      const v = { tele: tele(), bolts: bolts(), eraser: eraser() };
      ps._spellLockTurn = t.gs.turn; ps._silenceBonusSpell = t.gs.turn;   // Silence: Sperre + Bonus-Spell des Zuges
      await aktiviere(t, me, op, name);
      const n = { tele: tele(), bolts: bolts(), bonus: ps._silenceBonusSpell === t.gs.turn };
      ps._spellLockTurn = -1; ps._silenceBonusSpell = -1; n.eraser = eraser();
      R.check(`${name} (${art}${schule ? ', ' + schule : ''}): Teleportal „first Spell" ${art === 'Spell' ? 'nicht mehr' : 'weiter'} eine Zusatzaktion`, v.tele === true && n.tele === (art !== 'Spell'), { v, n });
      R.check(`${name}: Fire Bolts „first Destruction Magic Spell" ${schule === 'Destruction Magic' ? 'verbraucht' : 'weiter erfüllt'} (nur Destruction Magic zählt)`, v.bolts === true && n.bolts === (schule !== 'Destruction Magic'), { v, n });
      R.check(`${name}: Silence-Bonus-Spell ${art === 'Spell' ? 'verbraucht (zählte als gewirkter Spell)' : 'bleibt stehen'}`, n.bonus === (art !== 'Spell'), { n });
      R.check(`${name}: Eraser Beam „only Spell this turn" ${art === 'Spell' ? 'gesperrt (stempelt)' : 'weiter spielbar'}`, n.eraser === (art !== 'Spell'), { v, n });
    }
    R.section(`Sitz ${me}: Quick Attack / Amazing Finding („first Attack"), Muscle Training („hero has not attacked yet")`);
    for (const [name, art] of [['Bluff', 'Attack'], ['Booby Trap', 'Spell']]) {
      const t = await szene(me, op, { active: me });
      t.putSurprise(me, 1, name); t.grantFor(me, 1, name); phase2(t);
      const qa = () => loadCardEffect('Quick Attack').inherentAction(t.gs, me, 1, t.engine), af = () => loadCardEffect('Amazing Finding').inherentAction(t.gs, me, 1, t.engine);
      const vor = { qa: qa(), af: af(), hat: (t.gs.players[me].heroesAttackedThisTurn || []).includes(1) };
      await aktiviere(t, me, op, name);
      R.check(`${name} (${art}): Quick Attack und Amazing Finding „first Attack" ${art === 'Attack' ? 'nicht mehr erfüllt' : 'weiter erfüllt'}; Wirt-Held in heroesAttackedThisTurn: ${art === 'Attack' ? 'ja' : 'nein'}`,
        vor.qa === true && vor.af === true && qa() === (art !== 'Attack') && af() === (art !== 'Attack') && (t.gs.players[me].heroesAttackedThisTurn || []).includes(1) === (art === 'Attack'), { vor, qa: qa(), af: af() });
    }
    R.section(`Sitz ${me}: Güldefaber („when this Hero performs an Attack or Spell, gain 10 Gold") und The Brewer's Blade`);
    for (const [name, art] of [['Booby Trap', 'Spell'], ['Bluff', 'Attack']]) {
      const t = await szene(me, op, { active: me });
      t.setHero(me, 1, GULDE, 800); t.putSurprise(me, 1, name); t.grantFor(me, 1, name);
      const g0 = t.gs.players[me].gold;
      await aktiviere(t, me, op, name);
      R.check(`Güldefaber × ${name} (${art}): +10 Gold (einmal)`, t.gs.players[me].gold - g0 === 10, t.gs.players[me].gold - g0);
    }
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 200, potionDeck: me === 0 ? [['Healing Potion', 'Healing Potion'], []] : [[], ['Healing Potion', 'Healing Potion']] });
      t.put(me, 1, 0, "The Brewer's Blade"); t.putSurprise(me, 1, 'Bluff'); t.grantFor(me, 1, 'Bluff');
      const h0 = t.gs.players[me].potionDeck.length;
      await aktiviere(t, me, op, 'Bluff');
      R.check("The Brewer's Blade × Bluff (Attack des Trägers): 1 Karte aus dem Potion Deck gezogen", h0 - t.gs.players[me].potionDeck.length === 1, { h0, nach: t.gs.players[me].potionDeck.length });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
