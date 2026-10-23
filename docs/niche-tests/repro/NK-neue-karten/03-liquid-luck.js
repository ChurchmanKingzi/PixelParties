'use strict';
// NK-03 · Liquid Luck (neuer Trank, 23.10.2026)
// Kartentext: „Declare a card name. Whenever your opponent plays a card of that name until the beginning of your next turn,
//   search your deck for any card, reveal it and add it to your hand."
// Aufbau wie M02-13/14 (Luck): Sitz 0 spielt den Trank (Main Phase), deklariert per Wähler-Skript, `t.endTurn()`, Sitz 1 spielt die deklarierte Karte.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const LL = 'Liquid Luck';
  // Lingering Effect (Al 23.10.): nichts liegt auf dem Brett; der Zuhörer ist eine Marker-Instanz in der Zone 'deleted'.
  const marker = (t, seat) => t.engine.cardInstances.filter(c => c.name === LL && c.zone === 'deleted' && c.owner === seat);
  // Deck von Sitz 0: Fireball + Füllung; die Galerie-Antwort wählt "Fireball" (Antwortform: { cardName }).
  const deck0 = ['Fireball', 'Healing Potion', 'Treasure Chest', ...Array(9).fill('ZZ Dummy')];
  async function szene(deklariere, hand1 = [deklariere], extra = {}) {
    const t = await H.fresh({ hand: [[LL], hand1], deck: [deck0.slice(), Array(10).fill('ZZ Dummy')], gold: 100, ...extra });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: deklariere }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LL, answer: (d) => ({ cardName: (t._suchwahl || 'Fireball') }) });
    return t;
  }
  const gespielt = async (t) => { const r = await t.play(0, LL); return r; };

  R.section('A · Deklarieren und Löschen (Lingering Effect)');
  {
    const t = await szene('Fireball');
    const reveals = [];
    const emits = [];   // was wirklich an die Sockets geht (Sitz 0 = „S0", Sitz 1 = „S1")
    t.gs.players[0].socketId = 'S0'; t.gs.players[1].socketId = 'S1';
    t.engine.io = { to: sid => ({ emit: (ev, data) => { if (ev === 'card_reveal') emits.push({ sid, data }); } }) };
    const urspr = t.engine._broadcastEvent.bind(t.engine);
    t.engine._broadcastEvent = (ev, data, opts) => { if (ev === 'card_reveal' && data.cardName === 'Fireball') reveals.push({ data, toPlayers: opts && opts.toPlayers }); return urspr(ev, data, opts); };
    const r = await gespielt(t);
    const ps = t.gs.players[0];
    R.check('Trank gespielt (doUsePotion → true)', r === true, r);
    R.check('nichts liegt auf dem Brett (keine permanents), aber ein Marker mit dem deklarierten Namen hört zu', ps.permanents.length === 0 && marker(t, 0).length === 1 && marker(t, 0)[0].counters.liquidLuckZiel === 'Fireball', { perm: ps.permanents, marker: marker(t, 0).length });
    R.check('Trank nicht mehr in der Hand', !ps.hand.includes(LL), ps.hand);
    R.check('… der Trank selbst liegt wie jede Normal Potion im Gelöscht-Stapel (genau 1×), nicht in der Ablage', ps.deletedPile.filter(n => n === LL).length === 1 && !ps.discardPile.includes(LL), { del: ps.deletedPile, disc: ps.discardPile });
    R.check('Marker trägt Ziel und Spieler', (() => { const i = marker(t, 0)[0]; return i && i.counters.liquidLuckZiel === 'Fireball' && i.counters.liquidLuckSpieler === 0; })(), marker(t, 0)[0]?.counters);
    R.check('das Bild der deklarierten Karte wird gestreamt (card_reveal, einmal, an beide Sitze inkl. Gegner)', reveals.length === 1 && reveals[0].data.cardName === 'Fireball' && !reveals[0].toPlayers && emits.some(e => e.sid === 'S1' && e.data.cardName === 'Fireball') && emits.some(e => e.sid === 'S0' && e.data.cardName === 'Fireball'), { reveals, emits });
    R.check('Log liquid_luck_declare', t.lg('liquid_luck_declare').length === 1 && t.lg('liquid_luck_declare')[0].card === 'Fireball', t.lg('liquid_luck_declare'));
    const pn = t.prompts.find(p => p.d.type === 'cardNamePicker')?.d;
    R.check('Wähler bietet Kartennamen an (auch Reactions und Surprises, Al 23.10.), aber keine Tokens', pn && pn.cardNames.includes('Fireball') && pn.cardNames.includes('Gold Trap') && pn.cardNames.includes('Anti-Magnet') && !pn.cardNames.some(n => H.DB[n].cardType === 'Token'), pn && pn.cardNames.length);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // Abbruch der Deklaration: nichts passiert, der Trank bleibt in der Hand
    const t = await H.fresh({ hand: [[LL], []], gold: 100 });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cancelled: true }) });
    const r = await t.play(0, LL);
    const ps = t.gs.players[0];
    R.check('Abbruch: Trank bleibt in der Hand', ps.hand.includes(LL) && marker(t, 0).length === 0, { hand: ps.hand, marker: marker(t, 0).length });
    R.check('Abbruch: nicht gelöscht, kein Permanent, keine Instanz', !ps.deletedPile.includes(LL) && marker(t, 0).length === 0, { del: ps.deletedPile });
    R.check('Abbruch: kein Log, kein Kartenbild für den Gegner', t.lg('liquid_luck_declare').length === 0 && t.evs('card_reveal').length === 0, { logs: t.lg('liquid_luck_declare'), rev: t.evs('card_reveal') });
    R.check('Abbruch: keine Engine-Fehler', t.errors.length === 0, t.errors);
    // danach erneut spielbar
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    const r2 = await t.play(0, LL);
    R.check('nach dem Abbruch erneut spielbar', r2 === true && marker(t, 0).length === 1, { r2, marker: marker(t, 0).length });
  }
  {
    // unbekannter / leerer Name (manipulierter Client): kein Permanent
    for (const antwort of [{ cardName: 'Gibt es nicht' }, { cardName: '' }, {}, null]) {
      const t = await H.fresh({ hand: [[LL], []], gold: 100 });
      t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => antwort });
      await t.play(0, LL);
      const ps = t.gs.players[0];
      R.check(`ungültige Antwort ${JSON.stringify(antwort)}: kein Marker, Trank in der Hand`, marker(t, 0).length === 0 && ps.hand.includes(LL), { marker: marker(t, 0).length, hand: ps.hand });
    }
  }

  R.section('B · Auslösen: Gegner spielt die deklarierte Karte');
  const kartenArt = {
    'Fireball': 'Normal-Zauber', 'Elixir of Quickness': 'Trank', 'Treasure Chest': 'Normal-Artefakt',
    'Slippery Ice': 'Area-Zauber', 'Invisibility': 'Attachment-Zauber', 'Alliance': 'Attack mit Area-Untertyp',
  };
  for (const name of ['Fireball', 'Elixir of Quickness', 'Slippery Ice', 'Invisibility', 'Treasure Chest']) {
    const t = await szene(name);
    await gespielt(t);
    const vor = t.pile(0, 'hand').length;
    await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0 && x.heroIdx !== 0) || valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const handNachZug = t.pile(0, 'hand').length;           // Sitz 1 am Zug, Sitz 0 wurde beim Wechsel ggf. nicht beschenkt
    const deckVor = t.pile(0, 'mainDeck').length;
    const r = await t.play(1, name, { hero: 0 });
    const hat = t.pile(0, 'hand').includes('Fireball') || t.pile(0, 'hand').length > handNachZug;
    R.check(`${kartenArt[name] || name} „${name}": Gegner spielt sie → Sitz 0 sucht (Hand +1, Deck −1)`, r === true && t.pile(0, 'hand').length === handNachZug + 1 && t.pile(0, 'mainDeck').length === deckVor - 1, { r, hand: t.pile(0, 'hand').length - handNachZug, deck: t.pile(0, 'mainDeck').length - deckVor });
    R.check(`${name}: die gesuchte Karte (Fireball) liegt auf der Hand`, t.pile(0, 'hand').includes('Fireball'), t.pile(0, 'hand'));
    R.check(`${name}: Log liquid_luck_trigger`, t.lg('liquid_luck_trigger').length === 1, t.lg('liquid_luck_trigger'));
    R.check(`${name}: genau eine Suche (Galerie 1×)`, t.prompts.filter(p => p.d.type === 'cardGallery' && p.d.title === LL).length === 1, t.prompts.map(p => p.d.type + ':' + p.d.title));
    R.check(`${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  {
    // Creature + Ability + Equipment: andere Eintrittswege
    for (const [name, label] of [['Cute Bird', 'Kreatur'], ['Fighting', 'Ability'], ['Mana-Consuming Blade', 'Ausrüstung']]) {
      if (!H.DB[name]) { R.note(`${name} unbekannt`, null); continue; }
      const t = await szene(name);
      await gespielt(t);
      await t.endTurn();
      const vor = t.pile(0, 'hand').length;
      const r = await t.play(1, name, { hero: 0 });
      R.check(`${label} „${name}": Gegner spielt sie → Suche (Hand +1)`, r === true && t.pile(0, 'hand').length === vor + 1, { r, d: t.pile(0, 'hand').length - vor, errors: t.errors });
    }
  }

  R.section('C · Nicht auslösen');
  {
    // eigene Karte desselben Namens (Sitz 0 spielt selbst die deklarierte Karte) → nichts
    const t = await szene('Fireball', []);
    t.setHand(0, [LL, 'Fireball']);
    await gespielt(t);
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 1) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length; const dvor = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('eigenes Spielen der deklarierten Karte löst NICHT aus', r === true && t.pile(0, 'hand').length === vor - 1 && t.pile(0, 'mainDeck').length === dvor && t.lg('liquid_luck_trigger').length === 0, { r, d: t.pile(0, 'hand').length - vor, logs: t.lg('liquid_luck_trigger') });
  }
  {
    // andere Karte
    const t = await szene('Fireball', ['Elixir of Quickness']);
    await gespielt(t);
    await t.endTurn();
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Elixir of Quickness', { hero: 0 });
    R.check('andere Karte des Gegners löst nicht aus', t.pile(0, 'hand').length === vor && t.lg('liquid_luck_trigger').length === 0, { d: t.pile(0, 'hand').length - vor });
  }
  {
    // Namensähnlichkeit: „Fire" vs „Fireball" → nur exakter Basisname
    const t = await szene('Fireball', ['Firewall']);
    if (H.DB['Firewall']) {
      await gespielt(t); await t.endTurn();
      const vor = t.pile(0, 'hand').length;
      await t.play(1, 'Firewall', { hero: 0 });
      R.check('ähnlicher Name („Firewall" ≠ „Fireball") löst nicht aus', t.pile(0, 'hand').length === vor, { d: t.pile(0, 'hand').length - vor });
    }
  }

  R.section('D · Ablauf „until the beginning of your next turn"');
  {
    const t = await szene('Fireball');
    await gespielt(t);
    await t.endTurn();                         // Sitz 1 am Zug
    R.check('im Zug des Gegners: Marker besteht noch', marker(t, 0).length === 1, marker(t, 0).length);
    await t.endTurn();                         // Sitz 0 beginnt seinen nächsten Zug → Ablauf
    const ps = t.gs.players[0];
    R.check('zu Beginn des eigenen nächsten Zuges: Marker weg', marker(t, 0).length === 0, marker(t, 0).length);
    R.check('Trank im Gelöscht-Stapel (genau 1×)', ps.deletedPile.filter(n => n === LL).length === 1 && !ps.discardPile.includes(LL), { del: ps.deletedPile, disc: ps.discardPile });
    // Nach Ablauf spielt der Gegner die Karte in SEINEM nächsten Zug: nichts
    await t.endTurn();                         // Sitz 1 am Zug
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    t.addHand(1, 'Fireball');
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('nach Ablauf löst die Karte nicht mehr aus', t.pile(0, 'hand').length === vor, { d: t.pile(0, 'hand').length - vor });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    // Der Zugwechsel des GEGNERS beendet den Effekt nicht: Gegner spielt in seinem Zug zweimal die Karte → zweimal suchen
    const t = await szene('Fireball', ['Fireball', 'Fireball']);
    await gespielt(t); await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Fireball', { hero: 0 });
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('zwei Spiele der Karte in einem Zug → zwei Suchen (Hand +2)', t.pile(0, 'hand').length === vor + 2, { d: t.pile(0, 'hand').length - vor });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Suche: Deck, Sperren, Zufall');
  {
    // leeres Deck: nichts, kein Fehler
    const t = await szene('Fireball');
    t.setDeck(0, []);
    await gespielt(t); await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('leeres Deck: keine Karte, kein Absturz', t.pile(0, 'hand').length === vor && t.errors.length === 0 && !t.hung, { d: t.pile(0, 'hand').length - vor, errors: t.errors });
    R.check('leeres Deck: Log liquid_luck_search_skipped', t.lg('liquid_luck_search_skipped').length === 1, t.lg('liquid_luck_search_skipped'));
  }
  {
    // Such-Sperre
    const t = await szene('Fireball');
    await gespielt(t); await t.endTurn();
    t.gs.players[0].searchLocked = true;
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length; const dvor = t.pile(0, 'mainDeck').length;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Such-Sperre: kein Hand-Zuwachs, Deck unverändert, kein Dialog', t.pile(0, 'hand').length === vor && t.pile(0, 'mainDeck').length === dvor && !t.prompts.some(p => p.d.type === 'cardGallery' && p.d.title === LL), { d: t.pile(0, 'hand').length - vor });
    R.check('Such-Sperre: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Hand-Sperre
    const t = await szene('Fireball');
    await gespielt(t); await t.endTurn();
    t.gs.players[0].handLocked = true;
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('Hand-Sperre: nichts auf der Hand, keine Fehler', t.pile(0, 'hand').length === vor && t.errors.length === 0, { d: t.pile(0, 'hand').length - vor, e: t.errors });
  }
  {
    // Aufdecken: die gesuchte Karte wird dem Gegner gezeigt; danach Deck gemischt (Reihenfolge ändert sich), Bilanz stimmt
    const t = await szene('Fireball');
    await gespielt(t); await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const v0 = t.census(); const deckVor = t.pile(0, 'mainDeck').slice();
    await t.play(1, 'Fireball', { hero: 0 });
    const d = t.censusDiff(v0, t.census()).filter(x => !/^Fireball: -1$/.test(x) && !/Magic: \+\d+$/.test(x));   // `t.play` gibt dem Helden die Schule (Harness)
    R.check('Bilanz: nur Fireball (Sitz 1 → Ablage) und die gesuchte Karte Deck→Hand verschoben', d.length === 0 || d.every(x => /Fireball|ZZ/.test(x)), d);
    R.check('gesuchte Karte offen gezeigt (Reveal-Ereignis)', t.events.some(e => /reveal|deck_search/i.test(e.ev)), t.events.map(e => e.ev));
    R.check('Deck um genau 1 Karte kleiner, Rest dieselbe Menge', t.pile(0, 'mainDeck').length === deckVor.length - 1 && [...deckVor].sort().join() === [...t.pile(0, 'mainDeck'), 'Fireball'].sort().join(), { vor: deckVor.length, nach: t.pile(0, 'mainDeck').length });
  }
  {
    // zwei Kopien im Deck derselben Karte: gesucht wird genau eine
    const t = await szene('Fireball');
    t.setDeck(0, ['Fireball', 'Fireball', 'ZZ Dummy', 'ZZ Dummy']);
    await gespielt(t); await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('zwei gleiche Karten im Deck: genau eine wandert auf die Hand', t.pile(0, 'hand').filter(n => n === 'Fireball').length === 1 && t.pile(0, 'mainDeck').filter(n => n === 'Fireball').length === 1, { hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck') });
  }
  {
    // Galerie nur mit den im Deck vorhandenen Karten, mit Anzahl
    const t = await szene('Fireball');
    t.setDeck(0, ['Fireball', 'Fireball', 'Healing Potion']);
    await gespielt(t); await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    await t.play(1, 'Fireball', { hero: 0 });
    const g = t.prompts.find(p => p.d.type === 'cardGallery' && p.d.title === LL)?.d;
    R.check('Galerie: Einträge {name, source:deck, count}, searchToHand gekennzeichnet, nicht abbrechbar', g && g.cards.length === 2 && g.cards.find(c => c.name === 'Fireball').count === 2 && g.searchToHand === true && g.cancellable === false, g && { cards: g.cards, sth: g.searchToHand, canc: g.cancellable });
  }

  R.section('F · Mehrere Tränke / mehrere Namen');
  {
    // Zwei Liquid Luck mit verschiedenen Namen: jede Karte löst ihren eigenen Trank aus
    const t = await H.fresh({ hand: [[LL, LL], ['Fireball', 'Elixir of Quickness']], deck: [deck0.slice(), Array(10).fill('ZZ Dummy')], gold: 100 });
    const namen = ['Fireball', 'Elixir of Quickness']; let n = 0;
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: namen[n++] }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LL, answer: () => ({ cardName: 'Treasure Chest' }) });
    await t.play(0, LL);
    await t.play(0, LL, { keepActions: true });
    R.check('zwei Marker (je Trank einer) mit den beiden Namen', marker(t, 0).length === 2 && marker(t, 0).map(m => m.counters.liquidLuckZiel).join() === 'Fireball,Elixir of Quickness', marker(t, 0).map(m => m.counters.liquidLuckZiel));
    await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Elixir of Quickness', { hero: 0 });
    R.check('„Elixir of Quickness" löst nur den zweiten Trank aus (+1)', t.pile(0, 'hand').length === vor + 1 && t.lg('liquid_luck_trigger').length === 1, { d: t.pile(0, 'hand').length - vor });
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('„Fireball" löst den ersten aus (insgesamt +2)', t.pile(0, 'hand').length === vor + 2, { d: t.pile(0, 'hand').length - vor });
    await t.endTurn();
    R.check('beide Marker laufen zu Beginn von Sitz 0 ab, beide Tränke bleiben gelöscht', marker(t, 0).length === 0 && t.gs.players[0].deletedPile.filter(x => x === LL).length === 2, { marker: marker(t, 0).length, del: t.gs.players[0].deletedPile });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Zweimal derselbe Name: jeder Trank sucht (zwei Suchen je Spiel der Karte)
    const t = await H.fresh({ hand: [[LL, LL], ['Fireball']], deck: [deck0.slice(), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LL, answer: () => ({ cardName: 'Treasure Chest' }) });
    await t.play(0, LL); await t.play(0, LL, { keepActions: true });
    await t.endTurn();
    t.targetFn = (valid) => { const v = valid.find(x => x.owner === 0) || valid[0]; return v ? [v.id] : null; };
    t.setDeck(0, ['Fireball', 'Healing Potion', 'Treasure Chest', 'ZZ Dummy', 'ZZ Dummy']);
    const vor = t.pile(0, 'hand').length;
    await t.play(1, 'Fireball', { hero: 0 });
    R.check('zweimal derselbe Name: zwei Suchen (Hand +2)', t.pile(0, 'hand').length === vor + 2, { d: t.pile(0, 'hand').length - vor, e: t.errors });
  }

  R.section('G · Gegenspieler hat selbst Luck / Liquid Luck auf „Liquid Luck"');
  {
    // Sitz 1 deklariert mit Luck „Liquid Luck"; Sitz 0 spielt den Trank → Luck des Gegners müsste ziehen
    const t = await H.fresh({ hand: [[LL], []], deck: [deck0.slice(), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.setAbilities(1, 0, [['Luck'], [], []]);
    t.gs.activePlayer = 1; t.phase(2);
    t.script.push({ match: d => d.type === 'cardNamePicker' && d.title === 'Luck', answer: () => ({ cardName: LL }) });
    await t.run(() => t.host.doActivateFreeAbility(t.room, 1, { heroIdx: 0, zoneIdx: 0 }));
    t.script.push({ match: d => d.type === 'cardNamePicker' && d.title === LL, answer: () => ({ cardName: 'Fireball' }) });
    await t.endTurn();       // Sitz 0 am Zug
    const vor = t.pile(1, 'hand').length;
    await t.play(0, LL);
    R.note('Opponent-Luck auf „Liquid Luck": Karten gezogen (erwartet 2; platzierte Tränke melden afterPotionUsed nicht?)', t.pile(1, 'hand').length - vor);
    R.check('Gegner-Luck auf „Liquid Luck" zieht 2 (der Trank wurde gespielt)', t.pile(1, 'hand').length - vor === 2, { d: t.pile(1, 'hand').length - vor });
  }

  R.section('H · Zustandsprobleme');
  {
    // Trank-Sperre: Tuscan Mystic etc. → nicht spielbar
    const t = await H.fresh({ hand: [[LL], []], gold: 100 });
    t.gs.players[0].potionLocked = true;
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    const r = await t.play(0, LL);
    R.check('Trank-Sperre: nicht spielbar (Server lehnt ab)', r === false && marker(t, 0).length === 0, { r });
  }
  {
    // Negation des Tranks (Ambush the Scout? / Anti Magic): nichts liegt, Karte verbraucht — hier: Chain-Negation über engine-Wahl nicht trivial → Pfad: executeCardWithChain negated simulieren
    const t = await H.fresh({ hand: [[LL], []], gold: 100 });
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
    const orig = t.engine.executeCardWithChain.bind(t.engine);
    t.engine.executeCardWithChain = async (opts) => { if (opts.cardName === LL) return { negated: true, chainFormed: true }; return orig(opts); };
    const r = await t.play(0, LL);
    R.check('negierter Trank: kein Marker, kein Dialog', marker(t, 0).length === 0 && !t.prompts.some(p => p.d.type === 'cardNamePicker'), { marker: marker(t, 0).length, prompts: t.prompts.length });
    R.check('negierter Trank: Karte nicht doppelt/verloren (Hand+Ablage+Gelöscht = 1)', [t.pile(0, 'hand'), t.pile(0, 'discardPile'), t.pile(0, 'deletedPile')].flat().filter(n => n === LL).length === 1, { hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile') });
    R.check('negierter Trank: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('I · Weitere Wechselwirkungen');
  {
    // Elixir of Immortality (legt sich offen hin, eigener `placed`-Weg) wird vom Beobachter gesehen (der Trank selbst von Sitz 0 liegt nicht mehr auf dem Brett)
    const t = await szene('Elixir of Immortality', ['Elixir of Immortality']);
    await gespielt(t); await t.endTurn();
    const vor = t.pile(0, 'hand').length;
    const r = await t.play(1, 'Elixir of Immortality');
    R.check('deklariertes Elixir of Immortality (platziert sich offen) löst aus (Hand +1)', r === true && t.pile(0, 'hand').length === vor + 1, { r, d: t.pile(0, 'hand').length - vor, e: t.errors });
  }
  {
    // Der Gegner spielt SEIN Liquid Luck; ich hatte „Liquid Luck" deklariert → meine Suche; sein Trank deklariert etwas anderes
    const t = await H.fresh({ hand: [[LL], [LL]], deck: [deck0.slice(), Array(10).fill('ZZ Dummy')], gold: 100 });
    t.script.push({ match: d => d.type === 'cardNamePicker' && t.gs.activePlayer === 0, answer: () => ({ cardName: LL }) });
    t.script.push({ match: d => d.type === 'cardNamePicker' && t.gs.activePlayer === 1, answer: () => ({ cardName: 'Fireball' }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === LL, answer: () => ({ cardName: 'Treasure Chest' }) });
    await t.play(0, LL);
    await t.endTurn();
    const vor = t.pile(0, 'hand').length;
    const r = await t.play(1, LL);
    R.check('Gegner spielt Liquid Luck, ich habe „Liquid Luck" deklariert → ich suche', r === true && t.pile(0, 'hand').includes('Treasure Chest') && t.pile(0, 'hand').length === vor + 1, { r, d: t.pile(0, 'hand').length - vor });
    R.check('je Spieler ein Marker', marker(t, 0).length === 1 && marker(t, 1).length === 1, [marker(t, 0).length, marker(t, 1).length]);
    // Sitz 1 beendet; Sitz 0 beginnt → nur der Trank von Sitz 0 läuft ab
    await t.endTurn();
    R.check('Zugbeginn von Sitz 0: sein Marker weg, der des Gegners bleibt', marker(t, 0).length === 0 && marker(t, 1).length === 1, [marker(t, 0).length, marker(t, 1).length]);
    await t.endTurn();
    R.check('Zugbeginn von Sitz 1: sein Marker weg, sein Trank bleibt gelöscht', marker(t, 1).length === 0 && t.gs.players[1].deletedPile.includes(LL), marker(t, 1).length);
    R.check('keine Engine-Fehler / sauberer Zustand', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    // Wiederbelebung der deklarierten Kreatur (kein Ausspielen): Luck-Konvention (`onCardEnterZone`) zählt sie — hier nur festhalten
    const t = await szene('Cute Bird', []);
    await gespielt(t);
    await t.endTurn();
    t.gs.players[1].discardPile = ['Cute Bird'];
    const vor = t.pile(0, 'hand').length;
    const eins = t.gs.players[1];
    await t.run(() => t.engine.actionPlaceCreature('Cute Bird', 1, 0, 0, { source: 'discard', sourceName: 'Test', fireHooks: true }));
    R.note('Wiederbelebung der deklarierten Kreatur durch Effekt: Suche ausgelöst? (Luck-Konvention: ja)', t.pile(0, 'hand').length - vor);
  }
  {
    // Gold/Aktionen: der Trank kostet nichts und verbraucht die Aktion nicht (Tränke sind Main-Phase-Plays)
    const t = await szene('Fireball');
    const g0 = t.gs.players[0].gold;
    await gespielt(t);
    R.check('Trank kostet kein Gold', t.gs.players[0].gold === g0, [g0, t.gs.players[0].gold]);
    R.check('Trank verbraucht keine Aktion (heroesActedThisTurn leer)', (t.gs.players[0].heroesActedThisTurn || []).length === 0, t.gs.players[0].heroesActedThisTurn);
  }
  {
    // Trank in Main 2 (Phase 4) spielbar; Deklaration wirkt bis zum nächsten Zug
    const t = await szene('Fireball');
    const r = await t.play(0, LL, { phase: 4 });
    R.check('in Main Phase 2 spielbar', r === true && marker(t, 0).length === 1, { r });
    // In Aktionsphase nicht spielbar (Server: nur Main-Phasen)
    const t2 = await szene('Fireball');
    const r2 = await t2.play(0, LL, { phase: 3 });
    R.check('in der Aktionsphase nicht spielbar', r2 === false && marker(t2, 0).length === 0, { r2 });
  }
  {
    // Spiel endet während des Effekts / Spieler hat keinen Held mehr — nur Absturzprobe: letzter Held des Besitzers stirbt, danach Zugwechsel
    const t = await szene('Fireball');
    await gespielt(t);
    for (let hi = 0; hi < 3; hi++) await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, t.gs.players[0].heroes[hi], 9999, 'spell'));
    R.note('alle Helden des Besitzers tot: Spielende gemeldet', t.engine.over?.called);
    R.check('keine Engine-Fehler bei Spielende mit offenem Trank', t.errors.length === 0, t.errors);
  }
  {
    // Fremder Trank (Herkunft: Sitz 1, liegt auf der Hand von Sitz 0): nach dem Ablauf im Gelöscht-Stapel seines BESITZERS
    const t = await szene('Fireball');
    t.setHand(0, [LL]);
    const hinst = t.inst(i => i.zone === 'hand' && i.owner === 0 && i.name === LL)[0];
    if (hinst) hinst.originalOwner = 1;
    t.gs.players[0]._handOriginals = { 0: { n: LL, o: 1 } };
    await t.play(0, LL, { handIndex: 0 });
    R.check('fremder Trank landet sofort im Gelöscht-Stapel seines BESITZERS (Sitz 1), nicht des Spielers; der Marker gehört dem Spieler', t.gs.players[1].deletedPile.includes(LL) && !t.gs.players[0].deletedPile.includes(LL) && marker(t, 0).length === 1, { p0: t.gs.players[0].deletedPile, p1: t.gs.players[1].deletedPile, errors: t.errors.slice(0, 2) });
    await t.endTurn(); await t.endTurn();
    R.check('nach dem Ablauf: Marker weg, der Trank bleibt im Stapel seines Besitzers', marker(t, 0).length === 0 && t.gs.players[1].deletedPile.includes(LL), { p1: t.gs.players[1].deletedPile });
  }
  R.finish();
})();
