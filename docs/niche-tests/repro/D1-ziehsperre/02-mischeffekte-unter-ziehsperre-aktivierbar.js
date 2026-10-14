'use strict';
// D1-02 · Positivproben: Mischeffekte (neben dem Ziehen tut die Aktivierung etwas Eigenständiges) bleiben unter Zieh-Sperre
//         (drawLocked) UND Hand-Sperre (handLocked) aktivierbar - man wirft/mischt/löscht dann nur, gezogen wird nichts.
//
// Regel von Al (verbindlich): Unter einer Zieh-Sperre darf eine Aktivierung weiterhin gespielt werden, solange NICHT der komplette Effekt
// nur Ziehen ist. Beispiel Gigantisaur Triceras ("discard a card to draw 3 cards"): bleibt aktivierbar - man wirft dann nur ab; es gibt
// Decks, die abwerfen wollen. Eigenständig sind: Abwerfen, Zurückmischen, Löschen aus der Ablage, auf die Hand nehmen, Suchen, Opfern ...
// Gegenstück (reine Zieher gesperrt): 01-reine-zieher-unter-ziehsperre-gesperrt.js.
// Messung: nach dem Versuch hat sich der Zustand geändert (Einmal-Stempel gesetzt/Kosten bezahlt) - die Aktivierung lief.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const snap = (t) => JSON.stringify({
  hopt: t.gs.hoptUsed, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile'), del1: t.pile(1, 'deletedPile'),
  gold: t.gs.players[0].gold, deck: t.pile(0, 'mainDeck').length,
});
const putC = (t, hi, slot, name, o) => { const i = t.put(0, hi, slot, name, o); i.turnPlayed = 1; return i; };
const mid = (t) => { t.gs.activePlayer = 0; t.phase(2); };
// Skripte für die Kosten-Abfragen (Abwurf, Handwahl, Galerie)
const erste = (t, d) => { const i = (d.eligibleIndices && d.eligibleIndices.length) ? d.eligibleIndices[0] : 0; return { handIndex: i, cardName: t.pile(0, 'hand')[i] }; };
const antworten = (t) => {
  t.script.push({ match: d => d && (d.type === 'forceDiscardCancellable' || d.type === 'forceDiscard'), answer: (d) => erste(t, d) });
  t.script.push({ match: d => d && d.type === 'handPick', answer: (d) => ({ selectedCards: (d.eligibleIndices || []).slice(0, d.maxSelect || 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => { const idx = [0, 1, 2]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
};
const HERO = (n) => ({ heroes: [[n, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });

// [Name, Aufbau-Optionen, Aufbau, Aktion, nurSperre?]
const FAELLE = [
  ['Gigantisaur Triceras (Abwerfen -> zieh 3)', { hand: [[F, F], []] }, (t) => { putC(t, 0, 0, 'Gigantisaur Triceras'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Gigantisaur Pteranos (Gigantisaurs abwerfen -> zieh)', { hand: [['Gigantisaur Spinor', 'Gigantisaur Triceras'], []] }, (t) => { putC(t, 0, 0, 'Gigantisaur Pteranos'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Guardian Beast Tu (Karten aus den Ablagen löschen -> zieh)', { discard: [Array(6).fill(F), Array(6).fill(F)] }, (t) => { putC(t, 0, 0, 'Guardian Beast Tu'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Techno Harpyformer (Inventing abwerfen -> zieh 2)', { hand: [['Inventing'], []] }, (t) => { putC(t, 0, 0, 'Techno Harpyformer'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Future Tech Drone (abwerfen -> zieh dieselbe Zahl)', { hand: [[F, F], []], discard: [['Future Tech Drone'], []] }, (t) => { putC(t, 0, 0, 'Future Tech Drone'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Elana (ganze Hand zurückmischen -> zieh +1)', { ...HERO('Elana, the Rocky Rebel'), hand: [[F, F, F], []] }, () => {}, (t) => t.activateHero(0, 0, { phase: 2 })],
  ['Champion (bis 5 abwerfen -> zieh; Gegner ebenso)', { ...HERO('Champion, the Stormbringer'), hand: [[F, F, F], [F, F, F]] }, (t) => { t.resetActions(0); }, (t) => t.activateHero(0, 0, { phase: 3 })],
  ['Visionary Genius Heinz (Kopien abwerfen -> zieh)', { ...HERO('Visionary Genius Heinz'), hand: [['Fireball', 'Fireball', 'Icebolt'], []] }, () => {}, (t) => t.activateHero(0, 0, { effect: 'Visionary Genius Heinz', phase: 2 })],
  ['Leadership Lv1 (Karte zurückmischen -> zieh 1)', { hand: [[F, F], []], abilities: { 0: { 0: [['Leadership'], [], []] } } }, () => {}, (t) => { mid(t); return t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 })); }],
  ['Inventing Lv1 (abwerfen -> zieh 1)', { hand: [[F, F], []], abilities: { 0: { 0: [['Inventing'], [], []] } } }, () => {}, (t) => { mid(t); return t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 })); }],
  ['Prayer (Abilities abwerfen -> zieh)', { hand: [['Prayer', 'Fighting', 'Fighting', 'Toughness'], []], hp: 800, phase: 2 }, null, null],
  ['Sparkfly Queen, Hauptmodus (Kartentyp ansagen; Architect-Modus nicht angeboten)', { hand: [[F], [F, F, F, F, F]] }, (t) => { putC(t, 0, 0, 'Sparkfly Queen'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
];

(async () => {
  const R = H.runner();
  for (const sperre of ['drawLocked', 'handLocked']) {
    for (const [name, opts, aufbau, aktion] of FAELLE) {
      if (name.startsWith('Prayer')) {
        const t = await H.fresh(opts);
        t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
        await t.play(0, 'Prayer', { hero: 0, phase: 3 }); t.phase(2);
        t.gs.players[0][sperre] = true;
        t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
        t.policy.confirm = false;
        const abgeworfen0 = t.pile(0, 'discardPile').length;
        const r = await t.activateEquip(0, 0, 0);
        R.check(`${name} unter ${sperre}: aktivierbar (Abilities abgeworfen, nichts gezogen)`, t.pile(0, 'discardPile').length - abgeworfen0 === 3, { r, ablage: t.pile(0, 'discardPile') });
        R.check(`${name} unter ${sperre}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
        continue;
      }
      const t = await H.fresh({ deckSize: 12, ...opts });
      aufbau(t);
      antworten(t);
      t.gs.players[0][sperre] = true;
      const vor = snap(t);
      const r = await aktion(t);
      R.check(`${name} unter ${sperre}: bleibt aktivierbar (Kosten/Stempel fallen an)`, snap(t) !== vor || (name.startsWith('Sparkfly') && t.prompts.length > 0), { r, nach: snap(t).slice(0, 300), prompts: t.prompts.length });
      R.check(`${name} unter ${sperre}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  // Sparkfly Queen: Hauptmodus UND Architect-Geschenk vorhanden, aber Architect gesperrt -> nur ein Modus, Picker entfällt
  {
    const t = await H.fresh({ deckSize: 12, hand: [[F], [F, F, F, F, F]] });
    const q = putC(t, 0, 0, 'Sparkfly Queen'); q.counters._sparkflyGifts = { architect: true };
    t.gs.players[0].drawLocked = true;
    mid(t); t.script.push({ match: d => d && d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
    await t.activateCreature(0, 0, 0);
    const picker = t.prompts.find(p => p.d.type === 'optionPicker');
    R.check('Sparkfly Queen unter drawLocked: Architect-Modus (reiner Zug) wird nicht angeboten', !picker || !(picker.d.options || []).some(o => o.id === 'architect'), { optionen: picker?.d.options });
  }
  // Staff of the Teleporter / Staff of Uncontrollable Destruction (Antwort von Al): Mischen bzw. Abwerfen ist eigenständig, nur der Nachzug entfällt
  for (const sperre of ['drawLocked', 'handLocked']) {
    for (const staff of ['Staff of the Teleporter', 'Staff of Uncontrollable Destruction']) {
      const t = await H.fresh({ hand: [[staff, 'Bird', 'Bird', 'Bird'], []], deckSize: 20, gold: 100 });
      t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: (d.eligibleIndices || []).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
      t.gs.players[0][sperre] = true;
      const r = await t.play(0, staff);
      R.check(`${staff} unter ${sperre}: bleibt spielbar (Hand wird gemischt/abgeworfen, nichts nachgezogen)`, r === true && !t.pile(0, 'hand').includes(staff) && t.pile(0, 'hand').length === 0, { r, hand: t.pile(0, 'hand') });
      R.check(`${staff} unter ${sperre}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  // Crystal Well (Antwort von Al): Karte-geben ist eigenständig, nur das Ziehen verpufft
  for (const sperre of ['drawLocked', 'handLocked']) {
    const t = await H.fresh({ hand: [[F, F], []], deck: [Array(4).fill(F), Array(3).fill(F)] });
    t.putArea(0, 'Crystal Well');
    t.gs.players[0][sperre] = true;
    t.gs.activePlayer = 0; t.phase(2); t.reset();
    t.script.push({ match: d => d && d.type === 'pickHandCard', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
    await t.run(() => t.engine.activateAreaEffect(0, 0, 'Crystal Well'));
    R.check(`Crystal Well unter ${sperre}: bleibt aktivierbar (Karte gegeben, nichts gezogen)`, t.pile(0, 'hand').length === 1 && t.pile(1, 'hand').length === 1, { hand0: t.pile(0, 'hand').length, hand1: t.pile(1, 'hand').length });
    R.check(`Crystal Well unter ${sperre}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // Horn in a Bottle (Trank: zurückmischen -> zieh +1): unter drawLocked spielbar (unter handLocked sperrt der Loader-Auto-Tagger sie seit jeher)
  {
    const t = await H.fresh({ hand: [['Horn in a Bottle', 'Fireball', 'Heal'], []], deckSize: 20 });
    t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ cardName: 'Fireball', handIndex: 1 }, { cardName: 'Heal', handIndex: 2 }] }) });
    const r = await t.play(0, 'Horn in a Bottle');
    R.check('Horn in a Bottle unter drawLocked: spielbar (zurückgemischt, nichts gezogen)', r === true && !t.pile(0, 'hand').includes('Horn in a Bottle') && t.pile(0, 'mainDeck').length === 22, { r, hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck').length });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
