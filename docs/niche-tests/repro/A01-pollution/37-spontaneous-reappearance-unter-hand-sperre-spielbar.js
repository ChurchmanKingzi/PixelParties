'use strict';
// A01-pollution-37 · Spontaneous Reappearance: unter der Hand-Sperre spielbar – die Karte verpufft (kein Add, keine Tokens), die Galerie wird trotzdem gezeigt
// Kartentext: „Choose any number of cards from your discard pile and add them to your hand. …“; Hand-Sperre (`ps.handLocked`): sperrt „ALLES: Draws UND Suchen/Tutoren/Adds“ (`_engine.js` ~10626).
// Vergleich: Mass Multiplication trägt `blockedByHandLock: true` (unspielbar unter der Hand-Sperre, `_engine.js` ~20961); Spontaneous Reappearance trägt nur `blockedBySearchLockDiscard`, das `searchLockLevel` aber nie aus `handLocked` ableitet.
// Aufbau: Sitz 0: Spontaneous Reappearance auf der Hand, Ablage [Fireball, Heal], `ps.handLocked = true`.
// Erwartet: die Karte ist nicht spielbar (`doPlaySpell` → false, bleibt auf der Hand), jedenfalls wird sie nicht verbraucht.
// Beobachtet: `doPlaySpell` → true; Galerie wird angeboten, die gewählten Karten bleiben in der Ablage (Add gesperrt), die Karte liegt in der Ablage – Karte und Aktion verloren.
// Ursache: cards/effects/spontaneous-reappearance.js – kein `blockedByHandLock: true` (manuell nötig, der Lader kennzeichnet Spells nicht automatisch, `_loader.js` ~Z. 420).
// Aufruf: node docs/niche-tests/repro/A01-pollution/37-spontaneous-reappearance-unter-hand-sperre-spielbar.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Spontaneous Reappearance'], []], discard: [['Fireball', 'Heal'], []] });
  t.gs.players[0].handLocked = true;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.map(c => c.name), selectedIndices: d.cards.map((c, i) => i) }) });
  t.policy.confirm = true;
  const r = await t.play(0, 'Spontaneous Reappearance', { hero: 0 });
  R.check('Karte unter der Hand-Sperre nicht gespielt (bleibt auf der Hand)', r === false && t.pile(0, 'hand').includes('Spontaneous Reappearance'),
    { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), prompts: t.prompts.map(p => p.d.type) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
