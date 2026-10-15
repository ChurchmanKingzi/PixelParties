'use strict';
// W9a · Q12 (A02-deepsea-17) · Al, 15.10.2026: „Gut. Subtype soll aber nicht Normal sein, sondern Reaction, falls nicht schon gesetzt.“ (und: im eigenen Zug normal spielbar)
// Erwartet: (1) data/cards.json: Deepsea Spores ist Spell/Reaction. (2) Zu Beginn des GEGNERzugs ist sie als Reaktion aktivierbar (Fenster „The turn has just started“),
//   danach gelten alle Kreaturen als Deepsea. (3) Im eigenen Zug bleibt sie (proactivePlay, Reaction-Unterart = ohne Aktionskosten) spielbar.
const H = require('../../lib/h.js');
const DS = require('../../../../cards/effects/_deepsea-shared.js');
(async () => {
  const R = H.runner();
  const cards = require('../../../../data/cards.json');
  const sp = cards.find(c => c.name === 'Deepsea Spores');
  R.check('(1) Subtyp Reaction in data/cards.json', sp && sp.cardType === 'Spell' && sp.subtype === 'Reaction', sp && sp.subtype);
  // (2) Reaktion zu Beginn des Gegnerzugs: Sitz 0 hält Spores, Sitz 1 ist am Zug (Zugwechsel von Sitz 0 → Sitz 1)
  {
    const t = await H.fresh({ hand: [['Deepsea Spores'], []] });
    const k = t.put(1, 0, 0, H.INERT.creature); k.turnPlayed = 1;
    t.policy.confirm = true; t.grantFor(0, 0, 'Deepsea Spores');
    t.script.push({ match: d => d.type === 'optionPicker' && /Pick which Hero casts/.test(d.description || ''), answer: () => ({ optionId: 'hero-0' }) });
    await t.endTurn();
    const angebot = t.prompts.some(p => p.pi === 0 && /Spores/.test(JSON.stringify(p.d)));
    R.check('(2) Reaktionsangebot an Sitz 0 zu Beginn des Gegnerzugs', angebot, t.prompts.map(p => [p.pi, p.d.type, p.d.title]));
    R.check('(2) Spores aktiv: Gegnerkreatur gilt als Deepsea', DS.isDeepseaCreature(k.name, t.engine, k) === true, t.gs._deepseaSporesActiveTurn);
    R.check('(2) Karte in der Ablage von Sitz 0', t.pile(0, 'discardPile').includes('Deepsea Spores'), t.pile(0, 'discardPile'));
    R.check('(2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (3) eigener Zug
  {
    const t = await H.fresh({ hand: [['Deepsea Spores'], []] });
    const e = t.put(0, 0, 0, H.INERT.creature); e.turnPlayed = 1;
    const r = await t.play(0, 'Deepsea Spores', { hero: 0 });
    R.check('(3) im eigenen Zug spielbar, ohne die Hauptaktion zu verbrauchen', r === true && (t.gs.players[0].heroesActedThisTurn || []).length === 0, { r, acted: t.gs.players[0].heroesActedThisTurn, phase: t.gs.currentPhase });
    R.check('(3) Spores aktiv', DS.isDeepseaCreature(e.name, t.engine, e) === true, 'inaktiv');
    R.check('(3) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
