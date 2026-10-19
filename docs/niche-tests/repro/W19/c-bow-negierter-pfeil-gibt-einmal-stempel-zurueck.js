'use strict';
// W19c · F01-17 Bow of the Hunt Goddess — Al (Welle 19): „Soll ein vom Bow gespielter Pfeil, der anschließend negiert wird, das ‚Once per turn' des Bow NICHT verbrauchen?" — „Nicht verbrauchen".
// Erwartet: Wird der vom Bow gespielte Pfeil NEGIERT (Rusty Touch), bleibt das Once-per-turn des Bow frei und er darf im selben Zug erneut genutzt werden. Die Kosten des Pfeils
//   bleiben bezahlt (Rusty Touch bucht sie NICHT ein zweites Mal), der Pfeil liegt in der Ablage. Wirkt der Pfeil, bleibt der Stempel gesetzt (Gegenprobe).
//   Bestätigt (Al, Frage 2): Der Bow wird NICHT angeboten, wenn kein Pfeil im Deck spielbar ist (Deck bleibt unverändert, nichts verbraucht).
//   Beide Seiten (Sitz 0 und Sitz 1 am Zug). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
const istBowPrompt = (p) => /Bow/.test(p.d.title || '');
const wahl = (name) => ({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: name, source: 'deck' }), once: true });
async function aufbau(seite, o = {}) {
  const gegner = 1 - seite;
  const hand = [[], []]; hand[seite] = ['Attack', 'Attack']; hand[gegner] = o.rusty === false ? [] : ['Rusty Touch'];
  const deck = [undefined, undefined]; deck[seite] = o.deck || ['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'];
  const t = await H.fresh({ hand, deck, gold: [100, 100], active: seite });
  t.policy.confirm = true;
  t.put(seite, 0, 0, BOW);
  if (o.rusty !== false) t.grantFor(gegner, 0, 'Rusty Touch');
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === gegner && v.heroIdx === 0).id];
  return { t, seite, gegner };
}
(async () => {
  const R = H.runner();
  for (const seite of [0, 1]) {
    R.section(`Sitz ${seite} am Zug: Pfeil vom Bow gespielt, von Rusty Touch negiert -> Bow bleibt frei`);
    {
      const { t, gegner } = await aufbau(seite);
      const gold0 = t.gs.players[seite].gold;
      t.script.push(wahl('Flame Arrow'));
      t.reset();
      await t.play(seite, 'Attack', { hero: 0 });
      const ph = t.gs.players[gegner].heroes[0];
      R.check(`${seite}: Bow bot an, Pfeil gespielt und von Rusty Touch negiert (kein Brand, Pfeil in der Ablage, Rusty Touch beim Gegner abgelegt)`,
        t.prompts.some(istBowPrompt) && !ph.statuses?.burned && t.pile(seite, 'discardPile').includes('Flame Arrow') && t.pile(gegner, 'discardPile').includes('Rusty Touch'),
        { d: t.pile(seite, 'discardPile'), st: ph.statuses });
      R.check(`${seite}: Kosten bleiben bezahlt – genau 5 Gold, nicht doppelt`, t.gs.players[seite].gold === gold0 - 5, t.gs.players[seite].gold);
      R.check(`${seite}: Einmal-Stempel des Bow zurückgegeben`, !Object.keys(t.gs.hoptUsed || {}).some(k => /^bowHuntGoddess#/.test(k) && t.gs.hoptUsed[k] === t.gs.turn), t.gs.hoptUsed);
      // zweiter Angriff im selben Zug: Bow wieder angeboten, Poisoned Arrow wirkt
      t.reset(); t.script.push(wahl('Poisoned Arrow'));
      await t.play(seite, 'Attack', { hero: 0 });
      R.check(`${seite}: im selben Zug wieder angeboten, zweiter Pfeil (Poisoned Arrow) wirkt: vergiftet`, t.prompts.some(istBowPrompt) && !!t.gs.players[gegner].heroes[0].statuses?.poisoned && t.pile(seite, 'discardPile').includes('Poisoned Arrow'),
        { p: t.prompts.map(p => p.d.title), st: t.gs.players[gegner].heroes[0].statuses });
      R.check(`${seite}: Gold insgesamt 10 bezahlt (5 + 5)`, t.gs.players[seite].gold === gold0 - 10, t.gs.players[seite].gold);
      // jetzt hat ein WIRKENDER Pfeil gestempelt: dritter Angriff -> stumm
      t.addHand(seite, 'Attack'); t.reset();
      await t.play(seite, 'Attack', { hero: 0 });
      R.check(`${seite}: nach dem wirkenden Pfeil bleibt der Stempel (kein drittes Angebot im selben Zug)`, !t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
      R.check(`${seite}: keine Engine-Fehler, Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }

  R.section('Gegenprobe ohne Negation: wirkender Pfeil verbraucht den Einsatz (Sitz 0)');
  {
    const { t } = await aufbau(0, { rusty: false });
    t.script.push(wahl('Flame Arrow'));
    await t.play(0, 'Attack', { hero: 0 });
    t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('wirkender Pfeil: zweiter Angriff im selben Zug ohne Bow-Angebot', !t.prompts.some(istBowPrompt) && !t.errors.length, t.prompts.map(p => p.d.title));
  }

  R.section('Bestätigt (Al, Frage 2): Bow wird NICHT angeboten, wenn kein Pfeil im Deck spielbar ist');
  for (const seite of [0, 1]) {
    const { t } = await aufbau(seite, { rusty: false, deck: ['ZZ Dummy', 'Magic Topaz', 'ZZ Dummy'] });
    const vorher = t.pile(seite, 'mainDeck').slice();
    t.reset();
    await t.play(seite, 'Attack', { hero: 0 });
    R.check(`Sitz ${seite}: kein Pfeil im Deck -> kein Bow-Angebot, Deck unverändert (nicht gemischt), nichts verbraucht`,
      !t.prompts.some(istBowPrompt) && JSON.stringify(t.pile(seite, 'mainDeck')) === JSON.stringify(vorher)
        && !Object.keys(t.gs.hoptUsed || {}).some(k => /^bowHuntGoddess#/.test(k)) && t.errors.length === 0,
      { p: t.prompts.map(p => p.d.title), deck: t.pile(seite, 'mainDeck') });
  }
  {
    // Pfeil im Deck, aber nicht bezahlbar (3 Gold, Pfeile kosten 5): ebenfalls stumm
    const { t } = await aufbau(0, { rusty: false });
    t.setGold(0, 3); t.reset();
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Pfeil im Deck, aber unbezahlbar (3 Gold): ebenfalls stumm, Gold bleibt', !t.prompts.some(istBowPrompt) && t.gs.players[0].gold === 3, t.prompts.map(p => p.d.title));
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
