'use strict';
// W17c · F01-17 Bow of the Hunt Goddess — Stummheit und Sperren der Ausrüstungs-Reaktion, Zusammenspiel mit Hand-Reaktionen und Negation
// Erwartung: Der Bow wird NUR angeboten, wenn der Träger selbst mit einer Attack angreift, der Bow frisch ist und ein Arrow-Artifact im Deck JETZT spielbar ist
//   (Kosten zahlbar, keine Artefakt-/Such-Sperre, „Arrow" im Namen). Sonst bleibt alles wie ohne Bow: kein Prompt, nichts bewegt. Gegnerische Bows reagieren nicht auf meine Angriffe.
const H = require('../../lib/h.js');
const BOW = 'Bow of the Hunt Goddess';
const istBowPrompt = (p) => /Bow/.test(p.d.title || '') || /Bow/.test(p.d.message || '');
const aufbau = async (o = {}) => {
  const t = await H.fresh({ hand: [['Attack'], o.hand1 || []], deck: [o.deck || ['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], o.deck1], gold: o.gold || [100, 100], active: o.active });
  t.policy.confirm = true;
  const angreifer = o.active === 1 ? 1 : 0, gegner = 1 - angreifer;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === gegner && v.heroIdx === 0).id];
  return { t, angreifer, gegner };
};
const angriff = async ({ t, angreifer }) => { t.reset(); return await t.play(angreifer, 'Attack', { hero: 0 }); };
const nichts = (t, deckLen, was) => ({ kein: !t.prompts.some(istBowPrompt), deck: t.pile(0, 'mainDeck').length === deckLen, abl: !t.pile(0, 'discardPile').some(n => /Arrow/.test(n)), errs: t.errors.length === 0 });
(async () => {
  const R = H.runner();

  R.section('stumm: Held ohne Bow, Bow an anderem Helden, Bow beim Gegner');
  {
    const s = await aufbau(); await angriff(s);
    R.check('ohne Bow: kein Prompt, Deck unverändert', s.t.prompts.length === 0 && s.t.pile(0, 'mainDeck').length === 5 && s.t.errors.length === 0, s.t.prompts.map(p => p.d.type));
  }
  {
    const s = await aufbau(); s.t.put(0, 1, 0, BOW); await angriff(s);
    R.check('Bow an Held 1, Held 0 greift an: nichts', !s.t.prompts.some(istBowPrompt) && s.t.pile(0, 'mainDeck').length === 5, s.t.prompts.map(p => p.d.title));
  }
  {
    const s = await aufbau({ deck1: ['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'] }); s.t.put(1, 0, 0, BOW); await angriff(s);
    R.check('Bow des Gegners reagiert nicht auf meinen Angriff', !s.t.prompts.some(istBowPrompt) && s.t.pile(1, 'mainDeck').length === 5 && !s.t.pile(1, 'discardPile').some(n => /Arrow/.test(n)), s.t.prompts.map(p => p.pi + ':' + p.d.title));
  }
  {
    const s = await aufbau({ active: 1, deck: ['ZZ Dummy', 'ZZ Dummy'], deck1: ['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], hand1: ['Attack'] });
    s.t.setHand(0, []); s.t.put(1, 0, 0, BOW);
    s.t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Poisoned Arrow', source: 'deck' }), once: true });
    await angriff(s);
    R.check('beide Seiten: Sitz 1 am Zug mit eigenem Bow spielt Poisoned Arrow', s.t.pile(1, 'discardPile').includes('Poisoned Arrow') && !s.t.pile(1, 'mainDeck').includes('Poisoned Arrow'), { d: s.t.pile(1, 'discardPile'), p: s.t.prompts.map(p => p.pi + ':' + p.d.title) });
    R.check('beide Seiten: keine Engine-Fehler', s.t.errors.length === 0, s.t.errors);
  }

  R.section('stumm: nichts spielbar');
  {
    const s = await aufbau({ deck: ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'] }); s.t.put(0, 0, 0, BOW); await angriff(s);
    R.check('kein Arrow im Deck: stumm', !s.t.prompts.some(istBowPrompt) && s.t.errors.length === 0, s.t.prompts.map(p => p.d.title));
  }
  {
    const s = await aufbau({ deck: ['Magic Topaz', 'Arrow Slit', 'ZZ Dummy'] }); s.t.put(0, 0, 0, BOW); await angriff(s);
    R.check('kein „Arrow" im Sinn des Texts (Magic Topaz; Arrow Slit ohne Pfeil in der Kette unspielbar): stumm', !s.t.prompts.some(istBowPrompt) && s.t.pile(0, 'mainDeck').length === 3, s.t.prompts.map(p => p.d.title));
  }
  {
    const s = await aufbau({ gold: [3, 100] }); s.t.put(0, 0, 0, BOW); await angriff(s);
    R.check('3 Gold (Flame/Poisoned Arrow kosten 5): stumm, Gold bleibt', !s.t.prompts.some(istBowPrompt) && s.t.gs.players[0].gold === 3, s.t.gs.players[0].gold);
  }
  {
    const s = await aufbau(); s.t.put(0, 0, 0, BOW); s.t.gs.players[0]._artifactLockTurn = s.t.gs.turn; await angriff(s);
    R.check('Artefakt-Sperre (Boomerang): stumm', !s.t.prompts.some(istBowPrompt) && s.t.pile(0, 'mainDeck').length === 5, s.t.prompts.map(p => p.d.title));
  }
  {
    const s = await aufbau(); s.t.put(0, 0, 0, BOW); s.t.gs.players[0].searchLocked = true; await angriff(s);
    R.check('Such-Sperre: stumm (der Bow „sucht")', !s.t.prompts.some(istBowPrompt) && s.t.pile(0, 'mainDeck').length === 5, s.t.prompts.map(p => p.d.title));
  }
  {
    const s = await aufbau(); s.t.put(0, 0, 0, BOW); s.t.gs.players[0].searchLocked = true; await angriff(s);
    s.t.gs.players[0].searchLocked = false; s.t.reset(); s.t.addHand(0, 'Attack');
    s.t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'deck' }), once: true });
    await s.t.play(0, 'Attack', { hero: 0 });
    R.check('nach Aufheben der Sperre im selben Zug wieder da (Sperre verbrauchte nichts)', s.t.pile(0, 'discardPile').includes('Flame Arrow'), s.t.pile(0, 'discardPile'));
  }
  {
    const s = await aufbau({ deck: ['Flame Arrow', 'ZZ Dummy'], hand: [] }); s.t.put(0, 0, 0, BOW);
    s.t.setHand(0, ['Fireball']); s.t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    s.t.reset(); await s.t.play(0, 'Fireball', { hero: 0 });
    R.check('Zauber statt Attack: stumm', !s.t.prompts.some(istBowPrompt) && s.t.pile(0, 'mainDeck').length === 2 && s.t.errors.length === 0, s.t.prompts.map(p => p.d.title));
  }

  R.section('Zusammenspiel: Hand-Pfeil + Bow-Pfeil in einer Kette');
  {
    const s = await aufbau({ deck: ['Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy'] }); const { t } = s;
    t.put(0, 0, 0, BOW); t.addHand(0, 'Flame Arrow');
    const hp0 = t.hp(1, 0);
    t.script.push({ match: d => d.type === 'cardGallery' && /Chain a Reaction/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'hand' }), once: true });
    t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Poisoned Arrow', source: 'deck' }), once: true });
    await angriff(s);
    const gal = t.prompts.find(p => p.d.type === 'cardGallery' && /Chain a Reaction/.test(p.d.title || ''));
    R.check('Wahl-Galerie bietet Hand-Pfeil UND Bow an (Bow als BOARD)', !!gal && gal.d.cards.some(c => c.name === 'Flame Arrow') && gal.d.cards.some(c => c.name === BOW && c.label === 'BOARD'), gal && gal.d.cards);
    R.check('beide Pfeile in der Ablage, Hand und Deck leer von Pfeilen', t.pile(0, 'discardPile').includes('Flame Arrow') && t.pile(0, 'discardPile').includes('Poisoned Arrow') && !t.pile(0, 'hand').some(n => /Arrow/.test(n)) && !t.pile(0, 'mainDeck').some(n => /Arrow/.test(n)), { d: t.pile(0, 'discardPile'), h: t.pile(0, 'hand') });
    R.check('beide wirkten: brennt und vergiftet', !!t.gs.players[1].heroes[0].statuses?.burned && !!t.gs.players[1].heroes[0].statuses?.poisoned, t.gs.players[1].heroes[0].statuses);
    R.check('10 Gold Pfeilkosten bezahlt', t.gs.players[0].gold === 90, t.gs.players[0].gold);
    R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }

  R.section('Negation des Bow-Pfeils (Rusty Touch): Pfeil in der Ablage, Stempel zurück (W19c, Al: „Nicht verbrauchen")');
  {
    const s = await aufbau({ hand1: ['Rusty Touch'] }); const { t } = s;
    t.put(0, 0, 0, BOW); t.grantFor(1, 0, 'Rusty Touch');
    t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'deck' }), once: true });
    const hp0 = t.hp(1, 0);
    await angriff(s);
    R.check('Rusty Touch negierte den Pfeil: Pfeil in der Ablage, nicht gebrannt', t.pile(0, 'discardPile').includes('Flame Arrow') && !t.gs.players[1].heroes[0].statuses?.burned, { d: t.pile(0, 'discardPile'), st: t.gs.players[1].heroes[0].statuses });
    t.reset(); t.addHand(0, 'Attack');
    await t.play(0, 'Attack', { hero: 0 });
    // W19c (Al, Welle 19): die ALTE Regel (W17c: negierter Pfeil verbraucht den Einsatz) ist umgestellt — der Bow ist im selben Zug wieder frei.
    R.check('der negierte Pfeil verbraucht den Einsatz NICHT: Bow im selben Zug wieder angeboten (W19c)', t.prompts.some(istBowPrompt), t.prompts.map(p => p.d.title));
    R.check('Zustand sauber, keine Engine-Fehler', t.audit().length === 0 && t.errors.length === 0, { a: t.audit(), e: t.errors });
  }

  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
