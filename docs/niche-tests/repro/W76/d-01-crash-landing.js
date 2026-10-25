'use strict';
// W76d-01 · Crash Landing (Artifact Reaction, Cost 4)
// „Play this card immediately when an Artifact is equipped to a Hero. Negate that Artifact and send it to the discard pile."
const H = require('../../lib/h.js');
const CARD = 'Crash Landing', CLUB = 'Club of Gobbo';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const angebot = (t, pi) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD && (pi == null || p.pi === pi)).length;
const ja = (t) => t.script.push({ match: (d) => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });

(async () => {
  const R = H.runner();

  R.section('A · Der Gegner rüstet aus: Angebot, 4 Gold, Artifact wird besiegt (Ablage seines Besitzers), Animation');
  {
    const t = await H.fresh({ hand: [[CLUB], [CARD, 'ZZ Filler']], deckSize: 20, gold: [100, 100], active: 0 });
    ja(t);
    const g1 = t.gs.players[1].gold;
    const r = await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('Sitz 1 bekommt das Angebot', angebot(t, 1) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Club liegt nicht mehr am Helden', !t.engine.cardInstances.some(c => c.name === CLUB && c.zone === 'support'), t.engine.cardInstances.filter(c => c.name === CLUB).map(c => c.zone));
    R.check('… sondern in der Ablage von Sitz 0 (seinem Besitzer)', t.pile(0, 'discardPile').includes(CLUB), t.pile(0, 'discardPile'));
    R.check('Crash Landing in der Ablage von Sitz 1, 4 Gold bezahlt', t.pile(1, 'discardPile').includes(CARD) && g1 - t.gs.players[1].gold === 4, [t.pile(1, 'discardPile'), g1, t.gs.players[1].gold]);
    const a = t.evs('play_card_throw').find(e => e.mode === 'crash');
    R.check('Animation play_card_throw (crash) für den Club an der Zone, Ziel: Ablage von Sitz 0', !!a && a.cardName === CLUB && a.fromOwner === 0 && a.fromHeroIdx === 0 && a.discardOwner === 0 && a.suppressDiscard === true, a);
    const up = t.evs('reaction_chain_update');
    R.check('Kettenanzeige: Vorlauf = ausgerüsteter Club, Glied = Crash Landing', up.length === 1 && up[0].vorlauf && up[0].vorlauf.cardName === CLUB && up[0].links.length === 1 && up[0].links[0].cardName === CARD, up);
    const ng = t.evs('reaction_chain_link_negated');
    R.check('Kettenanzeige: das Vorlauf-Glied (Club) wird als NEGIERT animiert (Index −1)', ng.length === 1 && ng[0].linkIndex === -1 && ng[0].cardName === CLUB, ng);
    R.check('… Glied löst auf, Kette endet', t.evs('reaction_chain_link_resolved').length === 1 && t.evs('reaction_chain_done').length === 1, [t.evs('reaction_chain_link_resolved').length, t.evs('reaction_chain_done').length]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Ohne Gold / abgelehnt / Anhängsel / Kreatur: nichts');
  {
    const t = await H.fresh({ hand: [[CLUB], [CARD]], deckSize: 20, gold: [100, 3], active: 0 });
    ja(t);
    await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('nur 3 Gold: nicht angeboten, Club bleibt liegen', angebot(t) === 0 && t.engine.cardInstances.some(c => c.name === CLUB && c.zone === 'support'), t.prompts.length);
  }
  {
    const t = await H.fresh({ hand: [[CLUB], [CARD]], deckSize: 20, gold: [100, 100], active: 0 });
    t.script.push({ match: (d) => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: false }) });
    await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('abgelehnt: Club bleibt liegen, Karte auf der Hand, kein Gold weg', angebot(t) === 1 && t.engine.cardInstances.some(c => c.name === CLUB && c.zone === 'support') && t.pile(1, 'hand').includes(CARD) && t.gs.players[1].gold === 100, t.pile(1, 'hand'));
  }
  {
    const t = await H.fresh({ hand: [['Cute Bird'], [CARD]], deckSize: 20, gold: [100, 100], active: 0 });
    ja(t);
    await t.play(0, 'Cute Bird', { hero: 0, zone: 0 });
    R.check('Kreatur beschworen: kein Angebot', angebot(t) === 0, t.prompts.length);
  }

  R.section('C · Der Anleger selbst darf auch (eigene Ausrüstung), und Beide Seiten');
  {
    const t = await H.fresh({ hand: [[CLUB, CARD], []], deckSize: 20, gold: [100, 100], active: 0 });
    ja(t);
    await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('Sitz 0 legt an und besitzt Crash Landing: angeboten und gespielt (Club weg)', angebot(t, 0) === 1 && !t.engine.cardInstances.some(c => c.name === CLUB && c.zone === 'support'), t.prompts.map(p => [p.pi, p.d && p.d.title]));
  }
  {
    const t = await H.fresh({ hand: [[CARD], [CLUB]], deckSize: 20, gold: [100, 100], active: 1 });
    ja(t);
    await t.play(1, CLUB, { hero: 0, slot: 0 });
    R.check('gespiegelt: Sitz 1 legt an, Sitz 0 reagiert', angebot(t, 0) === 1 && t.pile(1, 'discardPile').includes(CLUB), t.pile(1, 'discardPile'));
  }

  R.section('D · Reverse Trap („Reaction Attack, Spell or Creature or a Surprise") reagiert NICHT auf eine Reaction-ARTIFACT');
  {
    const t = await H.fresh({ hand: [[CLUB], [CARD]], deckSize: 20, gold: [100, 100], active: 0 });
    ja(t);
    t.putSurprise(0, 1, 'Reverse Trap'); t.grantFor(0, 1, 'Reverse Trap');
    t.setAbilities(0, 1, [['Decay Magic'], [], []]);
    t.script.push({ match: (d) => d.type === 'confirm' && d.title === 'Reverse Trap', answer: () => ({ confirmed: true }) });
    await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('Reverse Trap wird nicht angeboten', !t.prompts.some(p => p.d && p.d.title === 'Reverse Trap'), t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Crash Landing wirkt normal (Club in der Ablage)', t.pile(0, 'discardPile').includes(CLUB), t.pile(0, 'discardPile'));
  }

  R.section('E · Die Aktivierung öffnet eine KETTE: der Gegner darf antworten (Tool Freezer negiert Crash Landing → das Equip bleibt)');
  {
    const t = await H.fresh({ hand: [[CLUB, 'Tool Freezer'], [CARD]], deckSize: 20, gold: [100, 100], active: 0 });
    ja(t);
    t.script.push({ match: (d) => d.title === 'Tool Freezer' || (d.options || []).some(o => /Tool Freezer/.test(o.label || o.name || '')), answer: (d) => d.type === 'confirm' ? { confirmed: true } : { selectedId: ((d.options || []).find(o => /Tool Freezer/.test(o.label || o.name || '')) || {}).id } });
    await t.play(0, CLUB, { hero: 0, slot: 0 });
    R.check('Sitz 0 bekam ein Kettenangebot auf Crash Landing', t.prompts.some(p => p.pi === 0 && p.d && JSON.stringify(p.d).includes('Tool Freezer') && JSON.stringify(p.d).includes(CARD)), t.prompts.map(p => [p.pi, p.d && p.d.type, p.d && p.d.title]));
    R.check('Crash Landing wurde negiert: der Club liegt noch am Helden', t.engine.cardInstances.some(c => c.name === CLUB && c.zone === 'support'), t.engine.cardInstances.filter(c => c.name === CLUB).map(c => c.zone));
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
