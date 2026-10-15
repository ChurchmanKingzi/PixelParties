// H02-heroes-28 · Great Detective Doq: der Spieler klickt die Handkarte selbst an, statt dass sie zufällig bestimmt wird
//
// Kartentext Doq: „When this Hero attacks, choose a random card from your opponent's hand and declare a card type (…). If the card is of the declared type, increase the damage of the Attack by 150 and draw 2 cards."
// Skript (`great-detective-doq.js` `runGuess`): öffnet `pickFromOppHand` mit ALLEN Handindizes; der Spieler wählt die Karte selbst (Kopfkommentar: „the controller clicks any card … cherry-pick a known card for a guaranteed correct declaration").
// Aufbau: Doq als Held 0, Hand Sitz 1 [Fireball, Diver Helmet, Fireball]; Sitz 0 spielt „Attack"; Antworten: Karte Index 1 (Diver Helmet), Typ „artifact".
// Erwartung (Text): keine Kartenwahl durch den Spieler (Zufall) – kein `pickFromOppHand`-Prompt, und eine bewusst gewählte Karte darf den Treffer nicht garantieren.
// Beobachtung: Prompt mit allen drei Karten, die gewählte wird garantiert getroffen (+150, 2 Karten gezogen).
// ★ GESCHÄRFT in Welle 13 (Q118, Al: „Bestimme eine zufällige."): kein Prompt UND die Karte folgt dem Zufall — Math.random fest auf Index 1 (Diver Helmet) bzw. 0 (Fireball) gestellt.
// Aufruf: node docs/niche-tests/repro/H02-heroes/28-doq-waehlt-nicht-zufaellig.js   (✗ = Abweichung vom Text)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Great Detective Doq', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Attack'], ['Fireball', 'Diver Helmet', 'Fireball']] });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  t.script.push({ match: d => d.type === 'pickFromOppHand', answer: () => ({ handIndex: 1 }) });
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'artifact' }) });
  const d0 = t.pile(0, 'mainDeck').length;
  const _rand = Math.random; Math.random = () => 0.4;   // floor(0.4 * 3) = 1 → Diver Helmet (Artifact) → Treffer
  const r = await t.play(0, 'Attack', { hero: 0 });
  Math.random = _rand;
  const pk = t.prompts.filter(p => p.d.type === 'pickFromOppHand');
  R.check('Attack gespielt', r === true, r);
  R.check('kein Auswahl-Prompt für die Handkarte (Zufall laut Text)', pk.length === 0, { prompts: pk.length, eligible: pk[0] && pk[0].d.eligibleIndices });
  R.check('zufällig gezogener Index 1 (Artifact, Deklaration „Artifact") trifft: +150 und 2 Karten gezogen', t.hp(1, 0) === 550 && d0 - t.pile(0, 'mainDeck').length === 2, { hp: t.hp(1, 0), gezogen: d0 - t.pile(0, 'mainDeck').length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
