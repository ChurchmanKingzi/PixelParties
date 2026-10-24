'use strict';
// W75c-01 · Reverse Trap (Spell Surprise Lv1, Decay Magic + Magic Arts)
// „Activate this Surprise when your opponent activates a Reaction Attack, Spell or Creature or a Surprise. Negate it and add it to your hand. Its level becomes 0 while it remains in your hand or on the board."
const H = require('../../lib/h.js');
const CARD = 'Reverse Trap';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const fragen = (t, titel) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === titel).length;
const handInst = (t, seat, name) => t.engine.cardInstances.filter(c => c.zone === 'hand' && c.owner === seat && c.name === name);

(async () => {
  const R = H.runner();

  R.section('A · Kettenfenster: gegnerische Reaction-SPELL (Silence) wird negiert, wandert auf MEINE Hand, Stufe 0');
  {
    const t = await H.fresh({ hand: [['Fireball'], ['Silence']], deckSize: 20, gold: [300, 300], active: 0 });
    t.putSurprise(0, 0, CARD); t.grantFor(0, 0, CARD);
    t.grantFor(1, 0, 'Silence');
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) });
    t.targetFn = (v) => { const x = v.find(q => q.owner === 1 && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('Angebot an die Surprise-Besitzerin', fragen(t, CARD) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Silence ist NEGIERT: der Fireball hat getroffen', t.hp(1, 0) < hp0, [hp0, t.hp(1, 0)]);
    R.check('Silence liegt auf der HAND von Sitz 0 (nicht in der Ablage von Sitz 1)', t.pile(0, 'hand').includes('Silence') && !t.pile(1, 'discardPile').includes('Silence'), [t.pile(0, 'hand'), t.pile(1, 'discardPile')]);
    const hi = handInst(t, 0, 'Silence')[0];
    R.check('Stufe 0 an der Handinstanz', !!hi && hi.counters.levelSet === 0 && hi.counters._rtLevel0 === true, hi && hi.counters);
    // ein Held ohne Decay Magic kann Silence (Lv2) mit Stufe 0 jetzt wirken, ohne die Marke nicht
    const cd = t.DB['Silence'];
    t.setAbilities(0, 1, [[], [], []]);
    R.check('Held 0:1 ohne Schule erfüllt die Stufe der gestohlenen Silence (Lv0)', t.engine.heroMeetsLevelReq(0, 1, cd) === true, t.engine.heroMeetsLevelReq(0, 1, cd));
    R.check('Reverse Trap selbst liegt in der Ablage (verbraucht)', t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
    // Abwerfen → Marke weg: die Karte gehört weiter Sitz 1 (Ablage des Besitzers)
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Silence', t.pile(0, 'hand').indexOf('Silence')));
    R.check('abgeworfen: keine Handinstanz mehr, die Karte liegt in der Ablage ihres Besitzers (Sitz 1)', handInst(t, 0, 'Silence').length === 0 && t.pile(1, 'discardPile').includes('Silence'), [handInst(t, 0, 'Silence').length, t.pile(1, 'discardPile')]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · Hand-Reaktionsfenster ohne Kette (Post-Target): Anti Magic Shield wird negiert und gestohlen');
  {
    const t = await H.fresh({ hand: [['Burning Finger'], ['Anti Magic Shield']], deckSize: 20, gold: [300, 300], active: 0 });
    t.putSurprise(0, 0, CARD); t.grantFor(0, 0, CARD); t.grantFor(0, 0, 'Burning Finger');
    t.setAbilities(0, 0, [['Decay Magic', 'Destruction Magic'], [], []]);
    t.setAbilities(1, 0, [['Magic Arts'], [], []]);
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Anti Magic Shield', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => { const x = v.find(q => q.owner === 1 && q.type === 'hero' && q.heroIdx === 0); return x ? [x.id] : undefined; };
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Reverse Trap angeboten (Fenster ohne Kette)', fragen(t, CARD) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Anti Magic Shield liegt auf der Hand von Sitz 0, nicht in der Ablage von Sitz 1', t.pile(0, 'hand').includes('Anti Magic Shield') && !t.pile(1, 'discardPile').includes('Anti Magic Shield'), [t.pile(0, 'hand'), t.pile(1, 'discardPile')]);
    R.check('der Treffer geht durch (Schild negiert)', t.hp(1, 0) < hp0, [hp0, t.hp(1, 0)]);
    const hi = handInst(t, 0, 'Anti Magic Shield')[0];
    R.check('Stufe 0 gesetzt', !!hi && hi.counters.levelSet === 0, hi && hi.counters);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · Aktivierung einer gegnerischen Surprise wird negiert und wandert auf meine Hand');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 20, gold: [300, 300], active: 0 });
    t.putSurprise(0, 0, CARD); t.grantFor(0, 0, CARD);
    t.setAbilities(0, 0, [['Decay Magic'], [], []]);
    t.putSurprise(1, 0, 'Glass Wall'); t.grantFor(1, 0, 'Glass Wall');
    t.setAbilities(1, 0, [['Magic Arts'], [], []]);
    const script = require('../../../../cards/effects/_loader.js').loadCardEffect('Glass Wall');
    const sourceInfo = { cardName: 'Fireball', owner: 0, heroIdx: 0 };
    await t.run(() => t.engine._activateSurprise(1, 0, 'Glass Wall', sourceInfo, script));
    R.check('Reverse Trap angeboten (Kettenfenster der Aktivierung)', fragen(t, CARD) === 1, t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Glass Wall liegt auf der Hand von Sitz 0 (nicht in der Ablage von Sitz 1)', t.pile(0, 'hand').includes('Glass Wall') && !t.pile(1, 'discardPile').includes('Glass Wall'), [t.pile(0, 'hand'), t.pile(1, 'discardPile')]);
    const hi = handInst(t, 0, 'Glass Wall')[0];
    R.check('Stufe 0 gesetzt', !!hi && hi.counters.levelSet === 0, hi && hi.counters);
    R.check('die Surprise-Zone von Sitz 1 ist leer', (t.gs.players[1].surpriseZones[0] || []).length === 0, t.gs.players[1].surpriseZones[0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('D · Gegenproben: Reaction-ARTIFACT zählt nicht; eigene Reaction löst nichts aus');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 20, gold: [300, 300], active: 0 });
    const s = require('../../../../cards/effects/_loader.js').loadCardEffect(CARD);
    const cc = (link) => ({ chain: [link] });
    const mk = (o) => ({ owner: 1, cardName: 'X', cardType: 'Artifact', isInitialCard: false, negated: false, ...o });
    R.check('Reaction-Artifact des Gegners: keine Bedingung', s.reactionCondition(t.gs, 0, t.engine, cc(mk({ cardType: 'Artifact' }))) === false);
    R.check('Reaction-Spell des Gegners (späteres Glied): Bedingung erfüllt', s.reactionCondition(t.gs, 0, t.engine, cc(mk({ cardType: 'Spell' }))) === true);
    R.check('eigene Reaction: keine Bedingung', s.reactionCondition(t.gs, 0, t.engine, cc(mk({ owner: 0, cardType: 'Spell' }))) === false);
    R.check('Surprise-Aktivierung des Gegners: Bedingung erfüllt', s.reactionCondition(t.gs, 0, t.engine, cc(mk({ cardType: 'Surprise', isSurpriseActivation: true, isInitialCard: true }))) === true);
    R.check('normal gespielter Spell des Gegners (Anfangsglied, kein Reaction-Untertyp): keine Bedingung', s.reactionCondition(t.gs, 0, t.engine, cc(mk({ cardType: 'Spell', cardName: 'Fireball', isInitialCard: true }))) === false);
  }
  R.section('E · Stufe 0 reist aufs Brett: eine gestohlene Creature ist ohne Schule spielbar und steht mit Stufe 0 da');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 20, gold: [300, 300], active: 0 });
    t.setAbilities(0, 0, [[], [], []]);                                    // Held ohne jede Schule
    const cd = t.DB['Cute Bird'];
    R.check('Vorprobe: Cute Bird (Lv1) wäre ohne Marke nicht beschwörbar', t.engine.heroMeetsLevelReq(0, 0, cd) === false, t.engine.heroMeetsLevelReq(0, 0, cd));
    await t.run(() => t.engine._reaktionInHandLegen(1, 'Cute Bird', 0, 1, true, 'discard'));
    const hi = handInst(t, 0, 'Cute Bird')[0];
    R.check('gestohlen: Handinstanz mit Stufe 0', !!hi && hi.counters.levelSet === 0 && hi.counters._rtLevel0, hi && hi.counters);
    const r = await t.play(0, 'Cute Bird', { hero: 0, noGrant: true });
    const bird = t.engine.cardInstances.find(c => c.name === 'Cute Bird' && c.zone === 'support');
    R.check('Cute Bird wird beschworen', r === true && !!bird, [r, !!bird]);
    R.check('auf dem Brett: Stufe 0 im Kartenwert + Marke', !!bird && (t.engine.getEffectiveCardData(bird) || {}).level === 0 && bird.counters._rtLevel0 === true, bird && [(t.engine.getEffectiveCardData(bird) || {}).level, bird.counters]);
    R.check('die Karte gehört weiter ihrem Besitzer (Sitz 1)', !!bird && bird.originalOwner === 1, bird && bird.originalOwner);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('F · eine gestohlene Surprise liegt verdeckt mit Stufe 0 — der schulenlose Held kann sie aktivieren');
  {
    const t = await H.fresh({ hand: [[], []], deckSize: 20, gold: [300, 300], active: 0 });
    t.setAbilities(0, 0, [[], [], []]);
    R.check('Vorprobe: ohne Marke kann der Held Glass Wall (Lv1) nicht aktivieren', t.engine._canHeroActivateSurprise(0, 0, 'Glass Wall', { spellInHand: true }) === false);
    await t.run(() => t.engine._reaktionInHandLegen(1, 'Glass Wall', 0, 1, true, 'discard'));
    const r = await t.play(0, 'Glass Wall', { hero: 0, noGrant: true });
    const inst = t.engine.cardInstances.find(c => c.name === 'Glass Wall' && c.zone === 'surprise');
    R.check('die Surprise wird verdeckt gelegt (Stufe 0 genügt)', r === true && !!inst, [r, !!inst]);
    R.check('Marke an der Brettinstanz', !!inst && inst.counters._rtLevel0 === true, inst && inst.counters);
    R.check('der schulenlose Held kann sie aktivieren (Stufe 0 auf dem Brett)', t.engine._canHeroActivateSurprise(0, 0, 'Glass Wall', {}) === true, t.engine._canHeroActivateSurprise(0, 0, 'Glass Wall', {}));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
