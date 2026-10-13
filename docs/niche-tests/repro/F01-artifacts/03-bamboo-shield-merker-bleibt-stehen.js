'use strict';
// F01-artifacts-03 · Bamboo Shield wird nach dem ersten Angebot (Einsatz ODER Nein) für den Rest der Partie nicht mehr angeboten
// Kartentext: „Play this card immediately when a Hero would take any damage. Negate that damage to that Hero. … You can only play 1 "Bamboo Shield" per turn."
// Aufbau: Sitz 1 hat zwei Bamboo Shield auf der Hand (300 Gold); Sitz 0 greift mit „Attack" den Helden 0 von Sitz 1 an (Zug 5), dann zwei Zugwechsel, gleicher Angriff in Zug 7.
// Erwartung: Das Einmal-pro-ZUG gilt je Zug – in Zug 7 wird das Schild erneut angeboten und der Schaden negiert.
// Beobachtet: In Zug 7 kommt gar keine Abfrage; der Held verliert die vollen Trefferpunkte. `gs._bsPromptedFor = {1:true}` bleibt seit Zug 5 stehen
//   (Einsatz wie Ablehnung).
// Ursache: `cards/effects/bamboo-shield.js` `_markPrompted` (Z. ~260) setzt den Merker; abgeräumt wird er nur im Hook `onChainResolve` (Z. 247),
//   den die Engine nur in der alten `_resolveChain` feuert (`_engine.js:6193`) – die moderne Reaktionskette ruft ihn nicht.
//   Die Schwesterkarte Spectral Armor hatte denselben Fehler und wurde in v1378 mit `onAnyActionResolved`/`afterSpellResolved`/`onTurnStart`-Aufräumern behoben
//   (spectral-armor.js Z. 268–285); Bamboo Shield ist dabei vergessen worden.
const H = require('../../lib/h.js');
const heroT = (owner, hi) => (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi); return h ? [h.id] : [valid[0].id]; };
(async () => {
  const R = H.runner();
  for (const variante of ['Einsatz', 'Nein']) {
    R.section('Variante: erstes Angebot ' + (variante === 'Einsatz' ? 'angenommen' : 'abgelehnt (Nein)'));
    const t = await H.fresh({ hand: [['Attack'], ['Bamboo Shield', 'Bamboo Shield']], gold: [100, 300] });
    t.targetFn = heroT(1, 0);
    if (variante === 'Nein') t.script.push({ match: d => d.type === 'confirm', answer: () => null, once: true });   // Mensch: Nein → promptGeneric liefert null
    else t.policy.confirm = true;
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Zug 5: Angebot gab es (Schaden negiert bei Ja / durch bei Nein)', variante === 'Einsatz' ? t.hp(1, 0) === 800 : t.hp(1, 0) === 760, t.hp(1, 0));
    await t.endTurn(); await t.endTurn();
    t.policy.confirm = true;
    t.addHand(0, 'Attack'); t.reset();
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('Zug ' + t.gs.turn + ': Bamboo Shield wird erneut angeboten und negiert den Schaden', hp0 - t.hp(1, 0) === 0, { schaden: hp0 - t.hp(1, 0), abfragen: t.prompts.length, merker: t.gs._bsPromptedFor });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
