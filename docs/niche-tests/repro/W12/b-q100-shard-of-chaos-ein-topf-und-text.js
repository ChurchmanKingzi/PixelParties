// W12b · Q100 (F02-21) + Q97 (F02-13 Teil b) · Shard of Chaos
// Q100, Al: „Ergänze Attack/Spell/Creature im Text. Ein Topf." → der Kartentext (data/cards.json) nennt „Attack/Spell/Creature"; Kreaturen bleiben im selben Topf wie Attack/Spell
//   (Kreatur ↔ Kreatur, Kreatur ↔ Spell, Attack ↔ Creature); Artifact/Potion/Ability/Hero bleiben eigene Typen (keine Kreatur gegen ein Artefakt).
// Q97, Al: „Nicht spielbar." → unter der harten Ablage-Ausgangssperre (Stäbe) ist Shard of Chaos nicht spielbar: Shard bleibt auf der Hand, nichts gelöscht, Gold unverändert. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const text = H.DB['Shard of Chaos'].effect;
  R.check('Kartentext nennt „(Ability, Attack/Spell/Creature, Artifact, Potion, Hero)"', /\(Ability, Attack\/Spell\/Creature, Artifact, Potion, Hero\)/.test(text), text);

  async function tausch(handKarte, ablageKarte) {
    const t = await H.fresh({ hand: [['Shard of Chaos', handKarte], []], gold: [100, 100], discard: [[ablageKarte], []] });
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf(handKarte) }] }), once: true });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: [ablageKarte], cardName: ablageKarte }) });
    const r = await t.play(0, 'Shard of Chaos');
    return { t, r, ok: t.pile(0, 'deletedPile').includes(handKarte) && t.pile(0, 'hand').includes(ablageKarte) };
  }
  for (const [h, a] of [['Bird', 'Fireball'], ['Bird', 'Bird'], ['Fireball', 'Bird'], ['Attack', 'Bird']]) {
    const { t, r, ok } = await tausch(h, a);
    R.check(`Topf: ${h} (${H.DB[h].cardType}) gegen ${a} (${H.DB[a].cardType}) tauschbar`, ok && t.errors.length === 0, { r, hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
  }
  { // Gegenprobe: Kreatur ↔ Artefakt ist kein gleicher Typ → Shard nicht spielbar (kein Typ gemeinsam)
    const t = await H.fresh({ hand: [['Shard of Chaos', 'Bird'], []], gold: [100, 100], discard: [['Treasure Chest'], []] });
    const r = await t.play(0, 'Shard of Chaos');
    R.check('Gegenprobe: Kreatur gegen Artefakt nicht tauschbar (Shard bleibt auf der Hand)', t.pile(0, 'hand').includes('Shard of Chaos') && t.pile(0, 'deletedPile').length === 0, { r, hand: t.pile(0, 'hand') });
  }
  { // Q97: harte Ablage-Sperre
    const t = await H.fresh({ hand: [['Shard of Chaos', 'Fireball', 'Attack'], []], gold: [100, 100], discard: [['Fireball', 'Attack', 'Fireball'], []] });
    t.gs.players[0]._discardLockedTurn = t.gs.turn;   // Stab-Sperre ohne Freikauf
    const g0 = t.gs.players[0].gold;
    const r = await t.play(0, 'Shard of Chaos');
    R.check('Q97: harte Ablage-Sperre → Shard of Chaos nicht spielbar (bleibt auf der Hand)', t.pile(0, 'hand').includes('Shard of Chaos') && r === false, { r, hand: t.pile(0, 'hand') });
    R.check('Q97: nichts gelöscht, Ablage und Gold unverändert', t.pile(0, 'deletedPile').length === 0 && t.pile(0, 'discardPile').length === 3 && t.gs.players[0].gold === g0, { del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile'), gold: t.gs.players[0].gold });
    R.check('Q97: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // Gegenprobe ohne Sperre: spielbar
    const t = await H.fresh({ hand: [['Shard of Chaos', 'Fireball', 'Attack'], []], gold: [100, 100], discard: [['Fireball', 'Attack', 'Fireball'], []] });
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf('Fireball') }] }), once: true });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: ['Fireball'], cardName: 'Fireball' }) });
    const r = await t.play(0, 'Shard of Chaos');
    R.check('Gegenprobe ohne Sperre: Shard spielbar und verbraucht', r === true && !t.pile(0, 'hand').includes('Shard of Chaos') && t.pile(0, 'deletedPile').includes('Shard of Chaos'), { r, hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
  }
  { // Q92-Berührung: Item Lock + Shard — Abbruch der Handwahl kostet nichts; Erfolg zahlt genau eine Karte VOR dem Löschen
    const mk = async () => { const t = await H.fresh({ hand: [['Shard of Chaos', 'Fireball', 'ZZ Filler'], []], gold: [100, 100], discard: [['Fireball', 'Attack'], []] }); t.gs.players[0].itemLocked = true; return t; };
    const t1 = await mk();
    t1.script.push({ match: d => d.type === 'handPick', answer: () => null });
    await t1.play(0, 'Shard of Chaos');
    R.check('Item Lock + Shard: Abbruch der Handwahl → nichts gelöscht, Shard auf der Hand', t1.pile(0, 'deletedPile').length === 0 && t1.pile(0, 'hand').includes('Shard of Chaos'), { del: t1.pile(0, 'deletedPile'), hand: t1.pile(0, 'hand') });
    const t2 = await mk();
    t2.script.push({ match: d => d.type === 'forceDiscard' && d.title === 'Item Lock Cost', answer: () => { const i = t2.gs.players[0].hand.indexOf('ZZ Filler'); return { cardName: 'ZZ Filler', handIndex: i, cardIdx: i, index: i }; }, once: false });
    t2.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t2.pile(0, 'hand').indexOf('Fireball') }] }), once: true });
    t2.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: ['Fireball'], cardName: 'Fireball' }) });
    await t2.play(0, 'Shard of Chaos');
    R.check('Item Lock + Shard: Kosten (Füller) und gewählte Karte gelöscht, Fireball zurück', t2.pile(0, 'deletedPile').includes('ZZ Filler') && t2.pile(0, 'deletedPile').includes('Fireball') && t2.pile(0, 'hand').includes('Fireball'), { del: t2.pile(0, 'deletedPile'), hand: t2.pile(0, 'hand') });
    R.check('Item Lock + Shard: keine Engine-Fehler', t1.errors.length === 0 && t2.errors.length === 0 && t2.audit().length === 0, { e: t1.errors.concat(t2.errors), a: t2.audit() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
