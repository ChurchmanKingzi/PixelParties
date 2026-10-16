'use strict';
// W14a · Zi-Rückfrage 4 (Welle 13 / W13a; H04-17 Timeless King Zi) · Al, 16.10.2026:
//   „Zis Spell soll unabbrechbar sein! Der Spell MUSS ausgeführt werden, falls möglich. Und ist das nicht möglich, wandert er in den Discard."
// Erwartet: Zielwahlen/Abfragen des von Zi gewirkten Zaubers sind Pflichtwahlen (`cancellable: false`, ein „Abbruch" ändert nichts); der Zauber
//   wird ausgeführt (Ziel getroffen, „Einmal pro Spiel" gestempelt, Karte in der Ablage). Ist der Guss nicht möglich (Bedingung, Limit), fizzelt er
//   sichtbar und wandert in die Ablage, das Einmal-Limit bleibt frei. Gegenprobe: ein normal gewirkter Fireball bleibt abbrechbar.
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
  const go = (t) => t.activateHero(0, 0, { effect: ZI, phase: 3 });
  const fizzle = (t, name) => t.events.some(e => e.ev === 'card_reveal' && e.data && e.data.fizzled === true && e.data.cardName === name);

  R.section('(a) Fireball per Zi: die Zielwahl ist Pflicht (kein Abbruch möglich), der Zauber trifft');
  {
    const t = await mk('Fireball');
    let angeboten = 0;
    t.targetFn = (valid, config) => { angeboten++; if (config && config.cancellable === false) { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; } return null; };   // Abbruch-Knopf, falls er existierte
    await go(t);
    R.check('Zielwahl wurde angeboten', angeboten >= 1, angeboten);
    R.check('alle Zielwahlen des Gusses ohne Abbruch-Knopf (cancellable: false)', t.targets.length > 0 && t.targets.every(x => x.config && x.config.cancellable === false), t.targets.map(x => x.config && x.config.cancellable));
    R.check('Fireball wurde ausgeführt (Gegner-Held 0 verliert HP)', t.hp(1, 0) < 800, t.hp(1, 0));
    R.check('Fireball liegt in der Ablage, Haste/Heal gelöscht', t.pile(0, 'discardPile').includes('Fireball') && t.pile(0, 'deletedPile').includes('Haste'), { abl: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile') });
    R.check('der Pflichtzwang ist nach dem Guss wieder aufgehoben', t.gs._forcedCommitPlayer == null, t.gs._forcedCommitPlayer);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(b) Gegenprobe: ein normal gewirkter Fireball bleibt abbrechbar');
  {
    const t = await H.fresh({ hand: [['Fireball'], []] });
    let cancellable = null;
    t.targetFn = (valid, config) => { cancellable = config && config.cancellable; return null; };
    await t.play(0, 'Fireball', { hero: 0 });
    R.check('normaler Fireball: Zielwahl abbrechbar, Abbruch kostet nichts', cancellable !== false && t.hp(1, 0) === 800 && t.pile(0, 'hand').includes('Fireball'), { cancellable, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
  }

  R.section('(c) Divine Gift per Zi: die Suchgalerie ist Pflicht (cancellable: false), „Einmal pro Spiel" wird gestempelt');
  {
    const t = await mk('Divine Gift of Creation');
    let abbruchVersucht = 0;
    // Die Harness fängt `promptGeneric` VOR der Engine ab; ob die Engine den Abbruch-Knopf streicht, zeigt der Zwangs-Prädikat `_promptsForceCommit`.
    t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Divine Gift of Creation', answer: (d, pi, tt) => { if (!tt.engine._promptsForceCommit(pi)) { abbruchVersucht++; return null; } return { selectedCards: [(d.cards[0].name || d.cards[0])] }; }, once: true });
    await go(t);
    R.check('Suchgalerie ohne Abbruch-Knopf (Zwang gilt für den Zi-Spieler)', abbruchVersucht === 0, abbruchVersucht);
    R.check('Divine Gift wurde gewirkt: Stempel gesetzt', t.gs.players[0]._oncePerGameUsed?.has('divineGift'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(d) nicht möglich: fizzelt sichtbar und wandert in die Ablage (verbrauchtes Limit bzw. Bedingung)');
  {
    const t = await mk('Divine Gift of Creation');
    t.gs.players[0]._oncePerGameUsed = new Set(['divineGift']);
    await go(t);
    R.check('Divine Gift (Limit verbraucht): Fizzle-Anzeige, Ablage', fizzle(t, 'Divine Gift of Creation') && t.pile(0, 'discardPile').includes('Divine Gift of Creation'), { fz: fizzle(t, 'Divine Gift of Creation'), abl: t.pile(0, 'discardPile') });
    R.check('kein Zwang bleibt hängen', t.gs._forcedCommitPlayer == null, t.gs._forcedCommitPlayer);
  }
  {
    const t = await mk('Call for Help');
    await go(t);
    R.check('Call for Help (Bedingung unerfüllt): Fizzle-Anzeige, Ablage', fizzle(t, 'Call for Help') && t.pile(0, 'discardPile').includes('Call for Help'), { fz: fizzle(t, 'Call for Help'), abl: t.pile(0, 'discardPile') });
  }
  {
    // Keine legalen Ziele: Gegner-Brett ohne Held (alle Gegnerhelden tot) → Zi's Fireball hätte nur eigene Ziele; Zwang bleibt trotzdem sauber
    const t = await mk('Fireball');
    t.targetFn = (valid) => { const v = valid[0]; return v ? [v.id] : []; };
    await go(t);
    R.check('Fireball: Guss lief, kein Hänger, keine Fehler', !t.hung && t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
