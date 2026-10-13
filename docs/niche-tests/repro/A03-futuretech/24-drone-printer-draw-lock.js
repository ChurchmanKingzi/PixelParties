'use strict';
// A03-futuretech-24 · Future Tech Drone / Money Printer unter Zieh-Sperre: Karten werden abgeworfen bzw. die Ladung verbraucht, gezogen wird nichts
//
// Kartentexte: Drone „You may once per turn discard up to as many cards as there are "Future Tech Drone" cards in your discard pile **and draw the same number of cards**.“
//              Money Printer „… you may **draw 1 card** for every 10 Gold you spent in excess …“
// Konvention (CARD_API.md Z. ~19118 Tuscan/Potion-Deck-Kreatur: „`canActivateCreatureEffect` sperrt, wenn das Ziehen nicht ginge (handLocked/drawLocked …) – sonst würde man zwei löschen, ohne zu ziehen“;
//   Golden Ladybug `kannZiehen`, Chuck, `_potion-draw-trigger-shared`: Zieh-Effekte prüfen `handLocked || drawLocked`; gegenläufig: Leadership lässt den Menschenpfad „bewusst unangetastet").
// Beobachtet: Mit `ps.drawLocked` darf man die Drone aktivieren, wirft 1 Karte ab und zieht nichts (Handverlust ohne Gegenwert); der Money Printer fragt „Draw 1 card?", verbraucht die Ladung und zieht nichts.
// Ursache: future-tech-drone.js (`onCreatureEffect`, kein `canActivateCreatureEffect`, keine Sperrprüfung) und debt-o-tron-model-money-printer.js (`afterResourceSpend`: Prüfung nur `mainDeck.length`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // ── Drone ──
  {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball'], []], discard: [['Future Tech Drone'], []], deck: [Array(10).fill('Fireball'), []] });
    t.put(0, 0, 0, 'Future Tech Drone').turnPlayed = 1;
    t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'Fireball', handIndex: 0 }), once: true });
    t.phase(2);
    const hand0 = t.pile(0, 'hand').length;
    const r = await t.activateCreature(0, 0, 0);
    const abgeworfen = hand0 - t.pile(0, 'hand').length;
    R.check('Drone unter Zieh-Sperre: nicht aktivierbar oder kein Kartenverlust ohne Nachziehen', !(r === true && abgeworfen > 0), { r, abgeworfen, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // ── Money Printer ──
  {
    const KENT = 'Kent, the Indebted Apprentice', MP = 'Debt-O-Tron Model Money Printer';
    const t = await H.fresh({ hand: [['Future Tech Gun'], []], gold: [0, 100], deck: [Array(10).fill(H.INERT.creature), []] });
    t.setHero(0, 0, KENT, 400);
    const mp = t.put(0, 2, 1, MP); mp.turnPlayed = 1;
    t.gs.players[0].drawLocked = true;
    await t.play(0, 'Future Tech Gun', { hero: 0 });                 // 10 Gold bei 0 -> -10, Überziehung 10
    const gefragt = t.prompts.some(p => /Draw 1 card/.test(p.d.message || ''));
    const ladung = H.loadCardEffect(MP).remainingCharges(mp, t.gs);
    R.check('Money Printer unter Zieh-Sperre: keine Abfrage', !gefragt, { gefragt });
    R.check('Money Printer unter Zieh-Sperre: Ladung bleibt (3)', ladung.remaining === 3, ladung);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
