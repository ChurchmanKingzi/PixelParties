// W12b · Q92 (F01-24) · Item Lock: Kosten erst nach dem Commit, bei Zieh-Artefakten VOR dem Ziehen
// Al: „Soll die Kosten gar nicht erst verlangen. Die Kosten dürfen erst eingefordert werden, NACHDEM die Karte committed ist und nicht mehr abgebrochen werden kann,
//      im Fall von Zieh-Artifacts wie Wheels aber VOR dem eigentlichen Ziehen."
// Erwartung: (1) Abbruch (Boomerang-Galerie, Wheels-Optionswahl) → die Item-Lock-Frage wird gar nicht gestellt, nichts gelöscht, Karte bleibt auf der Hand.
//   (2) Boomerang-Erfolg: Frage kommt NACH der Galerie, aber VOR dem Hinzufügen (die geholte Karte steht noch nicht in der Hand). (3) Wheels: Frage nach der Optionswahl, VOR dem
//   Ziehen (Hand noch unverändert). (4) Artefakt ohne Abbruchpunkt (Treasure Chest) und zielendes Artefakt (Book of Doom): Kosten genau einmal. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const isIL = (d) => d && d.type === 'forceDiscard' && d.title === 'Item Lock Cost';
(async () => {
  const R = H.runner();
  const F = 'ZZ Filler';
  async function aufbau(hand, extra = {}) {
    const t = await H.fresh({ hand: [hand, []], gold: [200, 100], ...extra });
    t.gs.players[0].itemLocked = true;
    t.ilFragen = [];
    t.script.push({ match: isIL, answer: () => {
      const hand = t.gs.players[0].hand.slice();
      const idx = hand.findIndex((c, i) => c === F);
      t.ilFragen.push({ hand, reihenfolge: t.prompts.length });
      return { cardName: F, handIndex: idx, cardIdx: idx, index: idx };
    }, once: false });
    return t;
  }

  { // (1a) Boomerang: Galerie abbrechen
    const t = await aufbau(['Boomerang', F, F], { discard: [['Beer'], []] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => null });
    await t.play(0, 'Boomerang', { hero: 0 });
    R.check('Boomerang-Abbruch: Item-Lock-Frage wurde gar nicht gestellt', t.ilFragen.length === 0 && !t.prompts.some(p => isIL(p.d)), { fragen: t.ilFragen.length });
    R.check('Boomerang-Abbruch: nichts gelöscht, Karte auf der Hand, Gold unverändert', t.pile(0, 'deletedPile').length === 0 && t.pile(0, 'hand').includes('Boomerang') && t.gs.players[0].gold === 200, { del: t.pile(0, 'deletedPile'), gold: t.gs.players[0].gold });
    R.check('Boomerang-Abbruch: keine Engine-Fehler / sauberer Zustand / keine verwaiste Vormerkung', t.errors.length === 0 && t.audit().length === 0 && !t.gs._itemLockOffen, { e: t.errors, a: t.audit(), v: t.gs._itemLockOffen });
  }
  { // (1b) Boomerang: Erfolg → Frage nach der Galerie, VOR dem Hinzufügen
    const t = await aufbau(['Boomerang', F, F], { discard: [['Beer'], []] });
    let galerieVorIL = false; let galerieGesehen = false;
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { galerieGesehen = true; return { cardName: 'Beer' }; } });
    await t.play(0, 'Boomerang', { hero: 0 });
    const q = t.ilFragen[0];
    R.check('Boomerang-Erfolg: genau eine Item-Lock-Frage', t.ilFragen.length === 1, t.ilFragen.length);
    R.check('Boomerang-Erfolg: Frage kam VOR dem Hinzufügen (Beer noch nicht in der Hand)', !!q && !q.hand.includes('Beer'), q);
    R.check('Boomerang-Erfolg: Frage kam NACH der Galerie', galerieGesehen && !!q && t.prompts.findIndex(p => p.d.type === 'cardGallery') < t.prompts.findIndex(p => isIL(p.d)), t.prompts.map(p => p.d.type));
    R.check('Boomerang-Erfolg: ein Füller gelöscht, Beer auf der Hand', t.pile(0, 'deletedPile').filter(c => c === F).length === 1 && t.pile(0, 'hand').includes('Beer'), { del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
    R.check('Boomerang-Erfolg: keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (2a) Wheels: Optionswahl abbrechen
    const t = await aufbau(['Wheels', F, F]);
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => null });
    await t.play(0, 'Wheels', { hero: 0 });
    R.check('Wheels-Abbruch: keine Item-Lock-Frage, nichts gelöscht, Wheels auf der Hand', t.ilFragen.length === 0 && t.pile(0, 'deletedPile').length === 0 && t.pile(0, 'hand').includes('Wheels'), { f: t.ilFragen.length, del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
    R.check('Wheels-Abbruch: keine Engine-Fehler / keine verwaiste Vormerkung', t.errors.length === 0 && !t.gs._itemLockOffen, { e: t.errors });
  }
  { // (2b) Wheels: Draw 3 → Frage VOR dem Ziehen
    const t = await aufbau(['Wheels', F, F], { deck: [Array(10).fill(H.INERT.creature), []] });
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'draw3' }) });
    t.script.push({ match: d => d.type === 'forceDiscard' && d.title !== 'Item Lock Cost', answer: () => { const h = t.gs.players[0].hand; const i = h.findIndex(c => c === H.INERT.creature); return { cardName: h[i], handIndex: i, cardIdx: i, index: i }; }, once: false });
    await t.play(0, 'Wheels', { hero: 0 });
    const q = t.ilFragen[0];
    R.check('Wheels: Item-Lock-Frage VOR dem Ziehen (Hand enthält noch keine gezogene Karte)', t.ilFragen.length === 1 && !!q && !q.hand.includes(H.INERT.creature), q);
    R.check('Wheels: Karten gezogen (3) und 1 abgelegt, Füller als Kosten gelöscht', t.pile(0, 'deletedPile').includes(F) && t.pile(0, 'hand').filter(c => c === H.INERT.creature).length === 2, { hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
    R.check('Wheels: keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (3) Artefakt ohne Abbruchpunkt: genau eine Frage, Löschung erfolgt
    const t = await aufbau(['Treasure Chest', F, F]);
    await t.play(0, 'Treasure Chest', { hero: 0 });
    R.check('Treasure Chest: genau eine Item-Lock-Frage, ein Füller gelöscht, Karte in der Ablage', t.ilFragen.length === 1 && t.pile(0, 'deletedPile').filter(c => c === F).length === 1 && t.pile(0, 'discardPile').includes('Treasure Chest'), { f: t.ilFragen.length, del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile') });
    R.check('Treasure Chest: keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (4) zielendes Artefakt: Zielabbruch kostet nichts, Erfolg genau einmal
    const t1 = await aufbau(['Book of Doom', F, F]);
    t1.policy.cancelTargets = true;
    await t1.play(0, 'Book of Doom', { hero: 0 });
    R.check('Book of Doom, Zielabbruch: keine Frage, nichts gelöscht', t1.ilFragen.length === 0 && t1.pile(0, 'deletedPile').length === 0, { f: t1.ilFragen.length, del: t1.pile(0, 'deletedPile') });
    const t2 = await aufbau(['Book of Doom', F, F]);
    t2.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : [valid[0].id]; };
    await t2.play(0, 'Book of Doom', { hero: 0 });
    R.check('Book of Doom, Erfolg: genau eine Frage, ein Füller gelöscht', t2.ilFragen.length === 1 && t2.pile(0, 'deletedPile').filter(c => c === F).length === 1, { f: t2.ilFragen.length, del: t2.pile(0, 'deletedPile') });
    R.check('Book of Doom: keine Engine-Fehler', t1.errors.length === 0 && t2.errors.length === 0, { e: t1.errors.concat(t2.errors) });
  }
  { // (5) Relic in the Sky (nimmt die unterste Ablagekarte auf die Hand): Kosten genau einmal, VOR dem Hinzufügen; das Artefakt legt sich selbst früh in die Ablage
    const t = await aufbau(['Relic in the Sky', F, F], { discard: [['Beer'], []] });
    await t.play(0, 'Relic in the Sky', { hero: 0 });
    const q = t.ilFragen[0];
    R.check('Relic: genau eine Frage, VOR dem Aufnehmen der Ablagekarte (Beer noch nicht in der Hand)', t.ilFragen.length === 1 && !!q && !q.hand.includes('Beer'), t.ilFragen);
    R.check('Relic: Füller gelöscht, Beer auf der Hand', t.pile(0, 'deletedPile').includes(F) && t.pile(0, 'hand').includes('Beer'), { del: t.pile(0, 'deletedPile'), hand: t.pile(0, 'hand') });
  }
  { // (6) Staff of Uncontrollable Destruction: Kosten VOR dem Abwurf der Hand (kein Abbruchpunkt), danach richtig abgeworfen und nachgezogen
    const t = await aufbau(['Staff of Uncontrollable Destruction', F, 'Fireball', 'Attack'], { deck: [Array(10).fill(H.INERT.creature), []] });
    await t.play(0, 'Staff of Uncontrollable Destruction', { hero: 0 });
    const q = t.ilFragen[0];
    R.check('Staff of Unc. Destruction: genau eine Frage, vor dem Abwurf (Hand noch vollständig)', t.ilFragen.length === 1 && !!q && q.hand.includes('Fireball') && q.hand.includes('Attack'), t.ilFragen);
    R.check('Staff of Unc. Destruction: Füller als Kosten gelöscht, Fireball + Attack abgeworfen, nachgezogen', t.pile(0, 'deletedPile').includes(F) && t.pile(0, 'discardPile').includes('Fireball') && t.pile(0, 'discardPile').includes('Attack') && t.pile(0, 'hand').length === 3, { del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('Staff of Unc. Destruction: keine Engine-Fehler / sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (7) Staff of the Teleporter: Abbruch der Handwahl kostet nichts; Erfolg zahlt VOR dem Zurückmischen, Indizes bleiben richtig
    const t1 = await aufbau(['Staff of the Teleporter', F, 'Fireball']);
    t1.script.push({ match: d => d.type === 'handPick', answer: () => null });
    await t1.play(0, 'Staff of the Teleporter', { hero: 0 });
    R.check('Teleporter-Abbruch: keine Frage, nichts gelöscht, Stab auf der Hand', t1.ilFragen.length === 0 && t1.pile(0, 'deletedPile').length === 0 && t1.pile(0, 'hand').includes('Staff of the Teleporter'), { f: t1.ilFragen.length, del: t1.pile(0, 'deletedPile') });
    const t2 = await aufbau(['Staff of the Teleporter', F, 'Fireball', 'Attack'], { deck: [Array(10).fill(H.INERT.creature), []] });
    t2.script.push({ match: d => d.type === 'handPick', answer: () => { const h = t2.gs.players[0].hand; const i = h.indexOf('Fireball'); return { selectedCards: [{ handIndex: i, cardName: 'Fireball' }] }; }, once: true });
    await t2.play(0, 'Staff of the Teleporter', { hero: 0 });
    R.check('Teleporter-Erfolg: genau eine Kostenfrage, Füller gelöscht, gewählter Fireball zurück ins Deck, 1 nachgezogen', t2.ilFragen.length === 1 && t2.pile(0, 'deletedPile').includes(F) && !t2.pile(0, 'hand').includes('Fireball') && t2.pile(0, 'hand').includes('Attack') && t2.pile(0, 'hand').includes(H.INERT.creature), { f: t2.ilFragen.length, del: t2.pile(0, 'deletedPile'), hand: t2.pile(0, 'hand') });
    R.check('Teleporter: keine Engine-Fehler / sauberer Zustand', t1.errors.length === 0 && t2.errors.length === 0 && t2.audit().length === 0, { e: t1.errors.concat(t2.errors), a: t2.audit() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
