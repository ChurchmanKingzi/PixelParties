'use strict';
// W13a · Q132 (H04-17, Timeless King Zi; Text: Sofort-Guss eines Zaubers „regardless of its level") · Al, 15.10.2026:
//   „Das Level wird ignoriert, alle anderen Bedingungen, etwa schon verbrauchte once-per-games oder notwendige und unbezahlbare Ressourcen,
//    führen dazu, dass der Zauber einfach fizzelt."
// Erwartet: Zi ignoriert NUR die Stufe (und damit Schule/Wisdom). Jede andere Bedingung — verbrauchtes „once per game/turn" (Divine Gift,
//   Guard Duty), Spielbedingung (Call for Help, Reunion), Heldensperren — lässt den Zauber sichtbar fizzeln (Fizzle-Anzeige, kein Effekt,
//   keine Kosten ohne Wirkung); die Karte geht in die Ablage, die anderen zwei werden wie bisher gelöscht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ZI = 'Timeless King Zi';
  const mk = async (picked, extra = {}) => {
    const deck = [picked, 'Haste', 'Heal', ...Array(12).fill(H.INERT.filler)];
    const t = await H.fresh({ heroes: [[ZI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [[], []], deck: [deck, Array(10).fill(H.INERT.filler)], ...extra });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === ZI, answer: () => ({ selectedCards: [picked, 'Haste', 'Heal'] }), once: true });
    t.script.push({ match: d => d.type === 'birthdayPresentPick', answer: () => ({ cardName: picked }), once: true });
    return t;
  };
  const go = (t) => { t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; }; return t.activateHero(0, 0, { effect: ZI, phase: 3 }); };
  const fizzle = (t, name) => t.events.some(e => e.ev === 'card_reveal' && e.data && e.data.fizzled === true && e.data.cardName === name);
  const gespielt = (t, name) => t.lg('timeless_king_zi_perform').some(l => JSON.stringify(l).includes(name));

  R.section('(a) die Stufe wird ignoriert: Fireball (Destruction Magic, Zi hat die Schule nicht) wirkt');
  {
    const t = await mk('Fireball');
    await go(t);
    R.check('Fireball wurde gewirkt (Gegner-Held 0 verliert HP)', t.hp(1, 0) < 800, t.hp(1, 0));
    R.check('Fireball liegt in der Ablage, Haste/Heal sind gelöscht', t.pile(0, 'discardPile').includes('Fireball') && t.pile(0, 'deletedPile').includes('Haste') && t.pile(0, 'deletedPile').includes('Heal'), { abl: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile') });
    R.check('kein Fizzeln', !fizzle(t, 'Fireball'));
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(b) „Einmal pro Spiel" verbraucht (Divine Gift): fizzelt sichtbar, Stempel bleibt, keine Suchgalerie');
  {
    const t = await mk('Divine Gift of Creation');
    t.gs.players[0]._oncePerGameUsed = new Set(['divineGift']);
    await go(t);
    R.check('Fizzle-Anzeige für Divine Gift of Creation', fizzle(t, 'Divine Gift of Creation'), t.events.filter(e => JSON.stringify(e).includes('Divine')).length);
    R.check('kein Wirken (keine zweite Galerie)', t.prompts.filter(p => p.d.type === 'cardGalleryMulti').length < 2 && !gespielt(t, 'Divine Gift'));
    R.check('Divine Gift of Creation liegt in der Ablage (verpufft)', t.pile(0, 'discardPile').includes('Divine Gift of Creation'), t.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(c) „Einmal pro Spiel" frei (Divine Gift): wirkt und stempelt — erst nach dem Commit, ein Abbruch lässt den Stempel frei (Q129)');
  {
    const t = await mk('Divine Gift of Creation');
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: d => ({ selectedCards: [(d.cards[0].name || d.cards[0])] }), once: true });
    await go(t);
    R.check('Divine Gift wirkt (Suchgalerie erschien)', t.prompts.filter(p => p.d.type === 'cardGalleryMulti').length >= 2, t.prompts.length);
    R.check('Stempel gesetzt', t.gs.players[0]._oncePerGameUsed?.has('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await mk('Divine Gift of Creation');
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: () => null, once: true });
    await go(t);
    R.check('Abbruch der Divine-Gift-Galerie: Stempel bleibt FREI', !t.gs.players[0]._oncePerGameUsed?.has('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
    R.check('Abbruch: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(d) Spielbedingung nicht erfüllt: Call for Help (keine eigene Kreatur besiegt) und Guard Duty (Partie-Limit verbraucht) fizzeln');
  {
    const t = await mk('Call for Help');
    await go(t);
    R.check('Call for Help: Fizzle-Anzeige', fizzle(t, 'Call for Help'));
    R.check('Call for Help spielt keinen weiteren Zauber aus dem Deck', !t.pile(0, 'discardPile').includes(H.INERT.filler), t.pile(0, 'discardPile'));
    R.check('Call for Help liegt in der Ablage', t.pile(0, 'discardPile').includes('Call for Help'), t.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await mk('Guard Duty', { discard: [['Fireball', 'Heal'], []] });
    t.gs._guardDutyUsed = { 0: true };
    await go(t);
    R.check('Guard Duty (verbrauchtes Limit): Fizzle-Anzeige', fizzle(t, 'Guard Duty'));
    R.check('Guard Duty: Ablage wird nicht ins Deck gemischt (Fireball/Heal bleiben in der Ablage)', t.pile(0, 'discardPile').includes('Fireball') && t.pile(0, 'discardPile').includes('Heal'), t.pile(0, 'discardPile'));
    R.check('Guard Duty: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await mk('Guard Duty', { discard: [['Fireball', 'Heal'], []] });
    await go(t);
    R.check('Guard Duty (Bedingung erfüllt): kein Fizzeln, Ablage wurde ins Deck gemischt', !fizzle(t, 'Guard Duty') && !t.pile(0, 'discardPile').includes('Fireball'), { abl: t.pile(0, 'discardPile') });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
