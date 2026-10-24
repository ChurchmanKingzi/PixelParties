'use strict';
// W74b-01 · Wendy, the Shy Girl (Creature Reaction Lv1, 50 HP)
// „You may immediately summon this Creature as an additional Action when you add a card from your side of the board to your hand. You may once per turn add this Creature you control
//  back to your hand. If you do, the next Spell you use this turn has its level reduced by 3. You can only control 1 "Wendy, the Shy Girl"."
const H = require('../../lib/h.js');
const CARD = 'Wendy, the Shy Girl';
const fertig = (t) => t.run(() => t.engine._runPostChainActions());
const ds = () => require('../../../../cards/effects/_deepsea-shared.js');

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[CARD, 'Heat Wave'], []], ...o });
  t.setAbilities(0, 0, [['Summoning Magic'], ['Destruction Magic'], []]);
  t.script.push({ match: (d) => d.type === 'zonePick' && d.title === CARD, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  return t;
}

(async () => {
  const R = H.runner();

  R.section('A · eine eigene Brett-Karte geht auf meine Hand → Angebot, Wendy als Zusatzaktion');
  {
    const t = await aufbau();
    const k = t.put(0, 0, 0, 'Cute Bird'); k.turnPlayed = 0;
    t.resetActions(0); t.gs.players[0]._actionsPlayedThisPhase = 1; t.gs.players[0]._actionsPlayedThisTurn = 1;   // Aktion der Phase schon verbraucht
    await t.run(() => t.engine.actionMoveCard(k, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    await fertig(t);
    const angebot = t.prompts.some(p => p.d && p.d.type === 'confirm' && p.d.title === CARD);
    R.check('Angebot (Ja/Nein) erscheint', angebot, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    const steht = t.engine.cardInstances.some(c => c.name === CARD && c.zone === 'support' && c.owner === 0);
    R.check('Wendy steht auf dem Brett (Zusatzaktion trotz verbrauchter Aktion)', steht, t.pile(0, 'hand'));
    R.check('Wendy nicht mehr auf der Hand, Cute Bird dort', !t.pile(0, 'hand').includes(CARD) && t.pile(0, 'hand').includes('Cute Bird'), t.pile(0, 'hand'));
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('B · Deepsea-Swap (Sonderweg am Move vorbei) löst ebenfalls aus');
  {
    const t = await aufbau({ hand: [[CARD, 'Deepsea Pirate'], []] });
    t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
    const alt = t.put(0, 1, 0, 'Deepsea Witch'); alt.turnPlayed = 1;
    t.grantFor(0, 1, 'Deepsea Pirate');
    await t.play(0, 'Deepsea Pirate', { hero: 1, slot: 0 });
    await fertig(t);
    R.check('Angebot nach dem Swap', t.prompts.some(p => p.d && p.d.type === 'confirm' && p.d.title === CARD), t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('Wendy beschworen', t.engine.cardInstances.some(c => c.name === CARD && c.zone === 'support' && c.owner === 0));
  }

  R.section('C · kein Angebot: Gegenseite, Fremdeffekt, Ablage/Gelöscht, nein gesagt');
  {
    const t = await aufbau();
    const gegner = t.put(1, 0, 0, 'Cute Bird');
    await t.run(() => t.engine.actionMoveCard(gegner, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('Karte der GEGENSEITE auf die Hand: kein Angebot', !t.prompts.some(p => p.d && p.d.title === CARD));
  }
  {
    const t = await aufbau();
    const k = t.put(0, 0, 0, 'Cute Bird');
    await t.run(() => t.engine.actionMoveCard(k, 'hand', -1, -1, { source: 'Gegner-Effekt', sourceOwner: 1 }));
    R.check('Gegner schickt meine Karte zurück („when YOU add"): kein Angebot', !t.prompts.some(p => p.d && p.d.title === CARD));
  }
  {
    const t = await aufbau();
    const k = t.put(0, 0, 0, 'Cute Bird');
    await t.run(() => t.engine.actionMoveCard(k, 'discard', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('Brett → Ablage: kein Angebot', !t.prompts.some(p => p.d && p.d.title === CARD));
  }
  {
    const t = await aufbau({ confirm: false });
    const k = t.put(0, 0, 0, 'Cute Bird');
    await t.run(() => t.engine.actionMoveCard(k, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    await fertig(t);
    R.check('Nein: Wendy bleibt auf der Hand', t.pile(0, 'hand').includes(CARD) && !t.engine.cardInstances.some(c => c.name === CARD && c.zone === 'support'));
  }

  R.section('D · aktive Wirkung: zurück auf die Hand, der nächste Spell des Zuges −3, einmal pro Zug');
  {
    const t = await aufbau({ hand: [['Heat Wave', 'ZZ Filler'], []] });
    const w = t.put(0, 1, 0, CARD); w.turnPlayed = 0;
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);   // Destruction 1: Heat Wave (Lv3) normal nicht wirkbar
    const lv0 = t.engine.heroMeetsLevelReq(0, 0, t.DB['Heat Wave']);
    R.check('vorher: Heat Wave (Lv3) mit Destruction 1 nicht wirkbar', lv0 === false);
    t.gs.activePlayer = 0; t.phase('MAIN1');
    t.script.length = 0; t.script.push({ match: (d) => d.type === 'confirm' && d.title === CARD, answer: { confirmed: false } });   // Wendys eigenes Wiederbeschwör-Angebot ablehnen
    const r = await t.activateCreature(0, 1, 0, {});
    await fertig(t);
    R.check('Wendy ging auf die Hand', r !== false && t.pile(0, 'hand').includes(CARD) && !t.engine.cardInstances.some(c => c.name === CARD && c.zone === 'support'), { r, hand: t.pile(0, 'hand') });
    R.check('der nächste Spell: Stufe um 3 gesenkt → wirkbar', t.engine.heroMeetsLevelReq(0, 0, t.DB['Heat Wave']) === true);
    R.check('Handstufe zeigt Lv0', t.engine.effectiveCardLevel(t.DB['Heat Wave'], 0, { heroIdx: 0, handIdx: 0 }) === 0, t.engine.effectiveCardLevel(t.DB['Heat Wave'], 0, { heroIdx: 0, handIdx: 0 }));
    R.check('Attack bleibt unberührt (nur Spells)', t.engine._naechsterSpellRabattSumme(0, { cardType: 'Attack' }) === 0);
    const res = await t.play(0, 'Heat Wave', { hero: 0, noGrant: true });
    R.check('Heat Wave wird gewirkt', res === true, res);
    R.check('der Rabatt ist verbraucht', t.engine._naechsterSpellRabattSumme(0, t.DB['Heat Wave']) === 0);
    // einmal pro Zug: eine neu beschworene Wendy kann nicht noch einmal zurück
    const w2 = t.put(0, 1, 1, CARD); w2.turnPlayed = 0;
    const sc = H.loadCardEffect(CARD);
    R.check('einmal pro Zug (spielerweit): zweite Wendy darf nicht noch einmal', sc.canActivateCreatureEffect({ _engine: t.engine, card: w2 }) === false);
  }
  {
    // Rabatt gilt nur für den laufenden Zug
    const t = await aufbau({ hand: [['Heat Wave'], []] });
    t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
    t.engine.spellRabattVormerken(0, 3, 'Test');
    R.check('im selben Zug: wirkbar', t.engine.heroMeetsLevelReq(0, 0, t.DB['Heat Wave']) === true);
    t.gs.turn += 2;
    R.check('im späteren Zug: verfallen', t.engine.heroMeetsLevelReq(0, 0, t.DB['Heat Wave']) === false);
  }

  R.section('E · You can only control 1');
  {
    const t = await aufbau({ hand: [[CARD], []] });
    const w = t.put(0, 1, 0, CARD); w.turnPlayed = 0;
    R.check('mit einer Wendy auf dem Brett: nicht beschwörbar', t.engine.isCreatureSummonable(CARD, 0, 0) === false);
  }

  R.section('F · Ankhota: eine gelöschte Karte kam nie auf die Hand → kein Angebot');
  {
    const t = await aufbau();
    t.put(1, 2, 0, 'Ankhota, the Burier');
    const k = t.put(0, 0, 0, 'Cute Bird');
    await t.run(() => t.engine.actionMoveCard(k, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 }));
    R.check('kein Angebot', !t.prompts.some(p => p.d && p.d.title === CARD));
  }

  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
