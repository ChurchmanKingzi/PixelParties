'use strict';
// R02-07 · Die gerade aufgelöste Spielkarte zählt für Handzugriffe der GEGENSEITE als Handkarte (Loot the Leftovers, Spike Trap)
// Kartentexte: Loot the Leftovers – „Play this card immediately when a player defeats a Hero their opponent controls. Choose 2 random cards from your opponent's hand and add them to your hand."
//              Spike Trap – „… Your opponent may discard 2 cards from their hand to negate this effect."
// Engine-Konvention: Während der Auflösung bleibt der Zauber im `ps.hand` (`ps._resolvingCard`, damit der Abbruch ihn zurücklegen kann); Hand-Zugriffe sollen ihn ausnehmen
//   (`engine._handOhneAufloesendeKarte`, v1405; Wisdom-Abwurf `eligibleIndices` schließt ihn aus, server.js ~8573; Reaktionsfenster überspringt ihn, _engine.js ~37793).
// Aufbau A: Sitz 0 (Killer) hat NUR [Fireball, Heal] auf der Hand und spielt Fireball auf den letzten Helden-Slot 0 von Sitz 1 (HP 100). Sitz 1 hält Loot the Leftovers (Held 1 mit Decay Magic).
// Erwartet A: Der Killer hat außer dem gespielten Fireball nur 1 Karte; „2 cards from your opponent's hand" sind nicht verfügbar ⇒ Loot wird nicht angeboten bzw. nimmt höchstens „Heal"
//   (und Fireball landet in der Ablage von Sitz 0). Beobachtet: Loot wird angeboten, nimmt Heal UND den gerade gespielten Fireball; Fireball steht danach auf der Hand von Sitz 1, die Ablage von Sitz 0 bleibt leer.
// Aufbau B: Sitz 0 hat [Fireball, Heal]; Sitz 1 hat Spike Trap (Decay Magic 2) auf Held 0 und wird mit Fireball angegriffen. Gegenzug: „discard 2 cards from your hand".
// Erwartet B: Mit nur 1 weiteren Handkarte (Heal) kann Sitz 0 die 2 Karten nicht zahlen ⇒ keine Gegenzug-Frage, Spike Trap feuert (Fireball negiert, 200 Schaden an Sitz 0).
//   Beobachtet: Die Gegenzug-Frage kommt, Sitz 0 wirft den gerade gespielten Fireball + Heal ab, Spike Trap fällt aus, Fireball trifft trotzdem.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // ── A: Loot the Leftovers ──
  {
    const t = await H.fresh({ hand: [['Fireball', 'Heal'], ['Loot the Leftovers']], hp: 800 });
    t.hero(1, 0).hp = 100;
    t.grantFor(1, 1, 'Loot the Leftovers'); t.grantFor(0, 0, 'Fireball');
    t.script.push({ match: d => d.type === 'blindHandPick', answer: () => ({ selectedIndices: [0, 1] }) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.policy.confirm = true;
    await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('A: Aufbau – Held 0 von Sitz 1 wurde besiegt', t.hp(1, 0) === 0, t.hp(1, 0));
    R.check('A: der gerade gespielte Fireball wird NICHT vom Gegner gestohlen (Sitz 1 hält keinen Fireball)', !t.pile(1, 'hand').includes('Fireball'), { hand1: t.pile(1, 'hand'), disc0: t.pile(0, 'discardPile') });
    R.check('A: der gespielte Fireball liegt in der Ablage von Sitz 0', t.pile(0, 'discardPile').includes('Fireball'), t.pile(0, 'discardPile'));
    R.check('A: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // ── B: Spike Trap ──
  {
    const t = await H.fresh({ hand: [['Fireball', 'Heal'], []], hp: 800 });
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.putSurprise(1, 0, 'Spike Trap');
    t.grantFor(0, 0, 'Fireball');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.policy.confirm = true;
    let n = 0;
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => { const hand = t.pile(0, 'hand'); const idx = 0; n++; return { cardName: hand[idx], handIndex: idx }; } });
    await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    const gegenzug = t.prompts.some(p => p.d.type === 'confirm' && /Discard 2 cards/.test(p.d.message || ''));
    R.check('B: Gegenzug „Discard 2 cards" wird NICHT angeboten (Sitz 0 hat nur 1 Handkarte außer dem gespielten Fireball)', !gegenzug, t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
    R.check('B: Spike Trap feuert – Sitz 0 erleidet 200 Schaden, Held 0 von Sitz 1 bleibt heil', t.hp(0, 0) === 600 && t.hp(1, 0) === 800, { hp0: t.hp(0, 0), hp1: t.hp(1, 0) });
    R.check('B: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
