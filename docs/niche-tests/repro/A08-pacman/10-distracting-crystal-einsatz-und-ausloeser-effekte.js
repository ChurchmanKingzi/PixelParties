// A08-10 · Distracting Crystal vs. Einsatz-/Auslöser-Effekte, die ins Deck mischen (Black Marketeer, Deepsea Stein, The Stormblade, Lunatic Cycle - Crescent Moon) · Regelfrage
//
// Kartentext Distracting Crystal: „While this card is in your hand, you cannot activate effects that include adding cards
//   from your hand or discard pile to your deck."
// Die vier Karten tragen `shufflesFromHandOrDiscardIntoDeck: true` („Distracting Crystal sperrt genau das", black-marketeer.js), aber ihr Mischen hängt an
//   einem Einsatz-Effekt (`hooks.onPlay`) bzw. einem Auslöser (`onAnyActionResolved`) – die Tore in server.js sitzen nur an den Aktivierungs-Handlern
//   (doPlaySpell/doUseArtifactEffect/doActivate*), nicht an der Beschwörung und nicht im Hook.
//
// Erwartung (eine Lesart): Der Effekt wird nicht angeboten/ausgeführt, solange der Kristall auf der Hand liegt (die Kreatur selbst darf kommen).
// Beobachtet: Black Marketeer und Deepsea Stein bieten beim Beschwören die Galerie an und mischen; Stormblade/Crescent Moon öffnen bei der Aktion die Handauswahl.
// Aufruf: node docs/niche-tests/repro/A08-pacman/10-distracting-crystal-einsatz-und-ausloeser-effekte.js   (✗ = Verhalten der „Sperre gilt auch hier"-Lesart verletzt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, A = H.INERT.artifact;
  const neu = async () => {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.engine.handZugangSync(0, 'Distracting Crystal');
    return t;
  };
  for (const kreatur of ['Black Marketeer', 'Deepsea Stein']) {
    const t = await neu();
    t.setDiscard(0, [F, F, A]);
    t.script.push({ match: d => /Gallery/i.test(d.type), answer: () => ({ selectedCards: [F] }) });
    const d0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, kreatur, { hero: 0 });
    R.check(`${kreatur}: Beschwörung ok, aber nichts wird aus der Ablage ins Deck gemischt`, r === true && t.pile(0, 'mainDeck').length === d0, { play: r, deck: [d0, t.pile(0, 'mainDeck').length], prompts: t.prompts.map(p => p.d.type) });
  }
  for (const ausruestung of ['The Stormblade', 'Lunatic Cycle - Crescent Moon']) {
    const t = await neu();
    t.put(0, 0, 0, ausruestung).turnPlayed = 1;
    for (const n of [F, F, F]) t.engine.handZugangSync(0, n);
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: (d.eligibleIndices || []).slice(0, 1).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Fireball', { hero: 0 });
    R.check(`${ausruestung}: bei der Aktion wird keine Handauswahl zum Zurückmischen geöffnet`, !t.prompts.some(p => p.d.type === 'handPick'), t.prompts.map(p => p.d.type));
  }
  R.finish();
})();
