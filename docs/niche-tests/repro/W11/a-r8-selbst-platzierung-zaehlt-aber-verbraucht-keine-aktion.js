'use strict';
// W11a · R8 (Welle 10, Q47-Folge: Selbst-Platzierungen zählen über `zaehleBeschwoerung`) · Al, 15.10.2026: „Soll das heißen, sie konsumieren die Action der Runde? Denn das wäre falsch.
//   Oder meinst du (bei DDG) das Once-per-Turn und dass es durch Placing konsumiert wird? Das wäre richtig."
// Erwartet:
//   * Selbst-Platzierungen (Blue-Ice Dragon, Foresta, Waitress, Dark Deepsea God) erhöhen den Zähler „Kreaturen beschworen/platziert" GENAU EINMAL
//     (`ps._creaturesSummonedThisTurn === 1`) — das zählt nur für Zählbedingungen („erste Kreatur, die du beschwörst", Harpyformer …).
//   * Der Zähler kostet KEINE Aktion: der Aktionsverbrauch folgt allein dem Kartentext. Blue-Ice Dragon (gewählt „Additional Action") und Waitress
//     („to summon this Creature as an additional Action") lassen die Hauptaktion der Runde frei (danach ist noch eine Kreatur spielbar);
//     Foresta (normale Beschwörung) und DDG („This counts as an Action") verbrauchen die Aktion der Runde.
//   * DDGs Einmal-pro-Zug (Flächenschaden `ddg_aoe`) wird durch das Platzieren verbraucht (zweites DDG im selben Zug: kein Schaden mehr) — das ist richtig.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = [
    ['Blue-Ice Dragon', { n: 2 }, true],
    ['Foresta, the Guard', { n: 2 }, false],
    ['Waitress', { heal: true }, true],
    ['Dark Deepsea God', { ddg: true }, false],
  ];
  for (const [name, o, aktionFrei] of faelle) {
    const t = await H.fresh({ hand: [[name, 'Elven Archer'], []], gold: 100 });
    const ps = t.gs.players[0];
    if (o.n || o.ddg) for (let s = 0; s < 3; s++) { t.put(0, 0, s, o.ddg ? 'Elven Leader' : H.INERT.creature).turnPlayed = 1; }
    if (o.ddg) t.put(0, 1, 0, 'Elven Leader').turnPlayed = 1;
    if (o.heal) t.heroStatus(0, 1, 'burned');
    t.policy.confirm = true;
    t.targetFn = (valid) => { const v = valid.filter(x => x.type === 'equip' && x.owner === 0).slice(0, 2); return v.length ? v.map(x => x.id) : [valid[0].id]; };
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => ({ optionId: d.options[0].id }) });
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await t.play(0, name, { hero: 0, slot: 0, extra: 3 });
    R.check(name + ': gespielt und liegt auf dem Brett', r === true && !!t.find(name, 'support'), { r });
    R.check(name + ': Zähler „beschworen/platziert" = 1 (genau einmal)', ps._creaturesSummonedThisTurn === 1, ps._creaturesSummonedThisTurn);
    // Aktionsverbrauch folgt dem Kartentext, nicht dem Zähler: danach noch eine Kreatur spielbar? (Aktion frei ⇔ ja)
    const frei = (ps.heroesActedThisTurn || []).length === 0;
    R.check(name + (aktionFrei ? ': Hauptaktion der Runde bleibt frei (Zusatzaktion laut Text)' : ': verbraucht die Aktion der Runde (laut Text normale Aktion)'), frei === aktionFrei, { heroesActed: (ps.heroesActedThisTurn || []).length, phase: t.gs.currentPhase });
    if (aktionFrei) {
      const r2 = await t.play(0, 'Elven Archer', { hero: 2, keepActions: true });
      R.check(name + ': danach lässt sich die normale Kreatur der Runde noch spielen', r2 === true && !!t.find('Elven Archer', 'support'), { r2 });
    }
    R.check(name + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // DDG: Einmal-pro-Zug wird durch das Platzieren verbraucht
  {
    const t = await H.fresh({ hand: [['Dark Deepsea God'], []], gold: 100 });
    for (let s = 0; s < 3; s++) t.put(0, 0, s, 'Elven Leader').turnPlayed = 1;
    t.put(0, 1, 0, 'Elven Leader').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
    t.targetFn = (valid) => valid.filter(x => x.type === 'equip' && x.owner === 0).slice(0, 2).map(x => x.id);
    t.policy.confirm = true;
    await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, extra: 3 });
    R.check('DDG: Flächenschaden-Stempel (einmal pro Zug) durch das Platzieren verbraucht', t.gs.hoptUsed && Object.keys(t.gs.hoptUsed).some(k => /ddg_aoe/.test(k) && t.gs.hoptUsed[k] === t.gs.turn), t.gs.hoptUsed);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
