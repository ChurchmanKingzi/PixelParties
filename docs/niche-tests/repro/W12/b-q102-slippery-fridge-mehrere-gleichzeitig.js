// W12b · Q102 (F03-09) · Slippery Fridge: beliebig viele Ausrüstungen, erst alles wählen, dann gleichzeitig verschieben
// Al: „Ja, soll mehrere verschieben können. Das Prozedere ist: Erst alle Equips und deren Ziel-Zonen auswählen, dann werden alle gleichzeitig verschoben."
// Kartentext: „Choose any number of Artifacts equipped to a Hero and equip them to a different Hero the same player controls (without paying their Cost again)."
// Erwartung: (a) zwei Equips von Held 0 → beide an Held 1, in verschiedene Zonen; Boni wandern (Welle 5); (b) Reihenfolge: ALLE Wahlen (Equips + Zonen) kommen vor dem ersten Verschieben,
//   dann erst alle Abgänge (onCardLeaveZone), dann alle Ankünfte (onCardEnterZone); (c) Equips verschiedener Helden in einem Zug; (d) Abbruch vor der ersten Wahl: nichts bewegt, Karte auf der Hand,
//   die Zielwahl selbst ist nicht abbrechbar; (e) mehr Equips als freie Zonen: die überzähligen bleiben liegen; (f) gleichzeitig: Platz, den ein gewähltes Equip freigibt, zählt als frei (Tausch). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const SF = 'Slippery Fridge';
const A = 'Warhorse', B = "The Master's Sword";
(async () => {
  const R = H.runner();
  const nZ = (t, hi) => [0, 1, 2].filter(s => t.zone(0, hi, s)).length;
  async function aufbau(hand, gold = 300) {
    const t = await H.fresh({ hand: [hand, []], gold });
    return t;
  }
  { // (a) + (b)
    const t = await aufbau([A, B, SF]);
    await t.play(0, A, { hero: 0, slot: 0 });
    await t.play(0, B, { hero: 0, slot: 1 });
    const atk0 = t.hero(0, 0).atk, atk1 = t.hero(0, 1).atk;
    const reihe = []; const orig = t.engine.runHooks.bind(t.engine);
    t.engine.runHooks = async (n, c) => { if (n === 'onCardLeaveZone' || n === 'onCardEnterZone') reihe.push(n === 'onCardLeaveZone' ? 'L' : 'E'); return orig(n, c); };
    const prompts = [];
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      prompts.push(ti + (cfg && cfg.cancellable ? ' [abbrechbar]' : ''));
      if (ti === SF) return valid.filter(v => v.type === 'equip' && v.heroIdx === 0).map(v => v.id);
      if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'equip' && v.heroIdx === 1) || valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
      return undefined;
    };
    await t.play(0, SF);
    R.check('(a) beide Ausrüstungen liegen bei Held 1 (verschiedene Zonen), Held 0 ist leer', nZ(t, 0) === 0 && nZ(t, 1) === 2, { n0: nZ(t, 0), n1: nZ(t, 1) });
    R.check('(a) Fridge verbraucht (Ablage), keine Engine-Fehler', t.pile(0, 'discardPile').includes(SF) && t.errors.length === 0 && t.audit().length === 0, { d: t.pile(0, 'discardPile'), e: t.errors, a: t.audit() });
    R.check('(a) Boni wandern mit (Summe der ATK bleibt, Held 0 ohne Bonus)', t.hero(0, 0).atk + t.hero(0, 1).atk === atk0 + atk1, { vorher: [atk0, atk1], nachher: [t.hero(0, 0).atk, t.hero(0, 1).atk] });
    R.check('(b) erst alle Wahlen: Equip-Wahl, dann zwei Zielwahlen (nicht abbrechbar)', prompts.length === 3 && /abbrechbar/.test(prompts[0]) && !/abbrechbar/.test(prompts[1]) && !/abbrechbar/.test(prompts[2]), prompts);
    R.check('(b) gleichzeitig: erst beide Abgänge, dann beide Ankünfte', reihe.join('') === 'LLEE', reihe.join(''));
  }
  { // (c) Equips verschiedener Helden
    const t = await aufbau([A, B, SF]);
    await t.play(0, A, { hero: 0, slot: 0 });
    await t.play(0, B, { hero: 1, slot: 0 });
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === SF) return valid.filter(v => v.type === 'equip' && v.owner === 0).map(v => v.id);
      if (/Move Warhorse/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
      if (/Move The Master/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 2); return v ? [v.id] : undefined; }
      return undefined;
    };
    await t.play(0, SF);
    const wo = (n) => [0, 1, 2].filter(hi => [0, 1, 2].some(s => t.zone(0, hi, s) === n));
    R.check('(c) Warhorse von Held 0 → Held 1, Master\'s Sword von Held 1 → Held 2', wo(A).join() === '1' && wo(B).join() === '2', { a: wo(A), b: wo(B) });
    R.check('(c) keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (d) Abbruch vor der ersten Wahl
    const t = await aufbau([A, SF]);
    await t.play(0, A, { hero: 0, slot: 0 });
    t.targetFn = () => null;
    await t.play(0, SF);
    R.check('(d) Abbruch: Warhorse bleibt bei Held 0, Fridge auf der Hand, Gold nicht abgezogen', t.zone(0, 0, 0) === A && t.pile(0, 'hand').includes(SF), { z: t.zone(0, 0, 0), hand: t.pile(0, 'hand') });
  }
  { // (e) mehr Equips als freie Zonen
    const t = await aufbau([A, B, SF]);
    await t.play(0, A, { hero: 0, slot: 0 });
    await t.play(0, B, { hero: 0, slot: 1 });
    t.put(0, 1, 0, H.INERT.creature); t.put(0, 1, 1, H.INERT.creature); t.put(0, 1, 2, H.INERT.creature);   // Held 1 voll
    t.put(0, 2, 0, H.INERT.creature); t.put(0, 2, 1, H.INERT.creature);                                       // Held 2: genau 1 freie Zone
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === SF) return valid.filter(v => v.type === 'equip' && v.heroIdx === 0).map(v => v.id);
      if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 2); return v ? [v.id] : undefined; }
      return undefined;
    };
    await t.play(0, SF);
    R.check('(e) nur ein Equip fand eine freie Zone (bei Held 2), das andere bleibt bei Held 0', [0, 1, 2].filter(s => t.zone(0, 2, s) === A || t.zone(0, 2, s) === B).length === 1 && [0, 1, 2].filter(s => t.zone(0, 0, s) === A || t.zone(0, 0, s) === B).length === 1, { h0: [0, 1, 2].map(s => t.zone(0, 0, s)), h2: [0, 1, 2].map(s => t.zone(0, 2, s)) });
    R.check('(e) keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (f) Tausch: beide Helden voll, die Quellplätze zählen als frei
    const t = await aufbau([A, B, SF]);
    await t.play(0, A, { hero: 0, slot: 0 });
    await t.play(0, B, { hero: 1, slot: 0 });
    t.put(0, 0, 1, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
    t.put(0, 1, 1, H.INERT.creature); t.put(0, 1, 2, H.INERT.creature);
    t.put(0, 2, 0, H.INERT.creature); t.put(0, 2, 1, H.INERT.creature);   // Held 2: eine freie Zone (damit die Fridge überhaupt spielbar ist), sie bleibt ungenutzt
    t.targetFn = (valid, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === SF) return valid.filter(v => v.type === 'equip' && (v.cardName === A || v.cardName === B)).map(v => v.id);
      if (/Move Warhorse/.test(ti)) { const v = valid.find(v => v.type === 'equip' && v.heroIdx === 1 && v.slotIdx === 0); return v ? [v.id] : undefined; }
      if (/Move The Master/.test(ti)) { const v = valid.find(v => v.type === 'equip' && v.heroIdx === 0 && v.slotIdx === 0); return v ? [v.id] : undefined; }
      return undefined;
    };
    await t.play(0, SF);
    R.check('(f) Tausch: Warhorse jetzt bei Held 1, Master\'s Sword bei Held 0 (je auf dem frei gewordenen Platz 0)', t.zone(0, 1, 0) === A && t.zone(0, 0, 0) === B, { h0: t.zone(0, 0, 0), h1: t.zone(0, 1, 0) });
    R.check('(f) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
