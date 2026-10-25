'use strict';
// W75c-02 · Reverse Trap (und jede Surprise mit `isSurprise` + `isReaction`) darf in DERSELBEN Kette nicht zweimal antworten.
// Meldung 25.10.: Gegner spielt eine Reaction → ich ketten Reverse Trap → der Gegner kettet etwas auf die Reverse Trap → die schon in der Kette liegende Reverse Trap war erneut aktivierbar.
// Ursache: die aktivierte Surprise bleibt aufgedeckt in ihrer Zone (`skipPostResolveDiscard`, das Kettenende räumt sie ab) und stand im Kettenfenster weiter zur Wahl.
const H = require('../../lib/h.js');
const CARD = 'Reverse Trap';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const fragen = (t, titel, pi) => t.prompts.filter(p => p.pi === pi && p.d && p.d.type === 'confirm' && p.d.title === titel).length;

(async () => {
  const R = H.runner();

  R.section('A · Fireball → Silence (Gegner) → Reverse Trap (ich) → Shamanic Curse (Gegner, auf die Falle) → die Falle wird NICHT noch einmal angeboten');
  {
    const t = await H.fresh({ hand: [['Fireball'], ['Silence', 'Shamanic Curse']], deckSize: 20, gold: [300, 300], active: 0 });
    t.putSurprise(0, 0, CARD); t.grantFor(0, 0, CARD);
    t.grantFor(1, 0, 'Silence'); t.grantFor(1, 0, 'Shamanic Curse');
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Chain a Reaction?', answer: (d) => { const c = d.cards.find(x => x.name === 'Silence') || d.cards[0]; return { cardName: c.name, source: c.source }; } });
    t.script.push({ match: d => d.type === 'optionPicker' && (d.title === 'Silence' || d.title === 'Shamanic Curse'), answer: (d) => ({ optionId: d.options[0].id }) });
    t.script.push({ match: d => d.type === 'confirm' && (d.title === 'Silence' || d.title === 'Shamanic Curse'), answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => { const x = v.find(q => q.owner === 1 && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('Fireball gespielt', r === true, r);
    R.check('Kette läuft: Gegner wählt Silence, Reverse Trap antwortet, der Gegner kettet Shamanic Curse darauf', t.prompts.some(p => p.pi === 1 && p.d && p.d.type === 'cardGallery') && fragen(t, 'Shamanic Curse', 1) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Reverse Trap wurde GENAU EINMAL angeboten', fragen(t, CARD, 0) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
