'use strict';
// NK-02 · Black-Thorn Dragon (neue Karte, 23.10.2026)
// Kartentext: „You can only summon this Creature by sacrificing 1 "Drago" Creature you control that was not summoned this turn OR two "Drago" Creatures.
//   You may once per turn deal 200 damage to a target. This Creature and the corresponding Hero are unaffected by all Spells."
// Teile: A Beschwörungskosten (beide Wege) · B Aktiv-Effekt (200 Schaden, HOPT) · C Spell-Immunität von Kreatur UND Held (Batterie echter Spells,
//   je mit Kontrollziel, damit „nichts passiert" nie leer ist) · D Nicht-Spells wirken weiter · E Ruhen (negiert/gefroren) · F Piercing (Ida) · G Randfälle.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const BT = 'Black-Thorn Dragon';
  const EGG = 'Icy Dragonegg';          // Drago, 1 HP, Lv0 — billiger Tribut
  const TURN = 5;                         // `fresh()` startet bei Zug 5
  const frisch = (inst) => { inst.turnPlayed = TURN; return inst; };
  const alt = (inst) => { inst.turnPlayed = 1; return inst; };
  const ids = (valid, pred) => valid.filter(pred).map(v => v.id);

  // ───────────────────────── A · Beschwörungskosten ─────────────────────────
  R.section('A · Beschwörungskosten: 1 „Drago" (nicht in diesem Zug beschworen) ODER 2 „Drago"');
  const route = (t) => t.prompts.filter(p => p.d.type === 'optionPicker' && p.d.title === BT);
  async function summon(setup, { choose, slot = 2, hand = [BT], pick = null } = {}) {
    const t = await H.fresh({ hand: [hand, []], gold: 100 });
    const objs = setup(t) || {};
    if (choose) t.script.push({ match: d => d.type === 'optionPicker' && d.title === BT, answer: () => (choose === 'cancel' ? { cancelled: true } : { optionId: choose }) });
    t.targetFn = pick ? (valid) => pick(valid, t) : null;
    const r = await t.play(0, BT, { hero: 0, slot });
    return { t, r, ...objs };
  }
  {
    const x = await summon(() => {});
    R.check('ohne jede Kreatur: nicht spielbar (Server lehnt ab), Karte bleibt in der Hand', x.r === false && x.t.pile(0, 'hand').includes(BT) && !x.t.find(BT, 'support'), { r: x.r });
  }
  {
    const x = await summon(t => { t.put(0, 0, 0, H.INERT.creature).turnPlayed = 1; t.put(0, 0, 1, H.INERT.creature).turnPlayed = 1; });
    R.check('nur Nicht-„Drago"-Kreaturen: nicht spielbar', x.r === false && !x.t.find(BT, 'support'), { r: x.r });
  }
  {
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); });
    R.check('1 Drago, nicht in diesem Zug beschworen: gespielt', x.r === true && x.t.zone(0, 0, 2) === BT, { r: x.r, z: x.t.zone(0, 0, 2) });
    R.check('… ohne Weg-Frage (nur ein Weg offen)', route(x.t).length === 0, route(x.t).length);
    R.check('… das Ei wurde geopfert (Ablage), der Dragon liegt', x.t.pile(0, 'discardPile').includes(EGG) && !x.t.zone(0, 0, 0), { discard: x.t.pile(0, 'discardPile'), z0: x.t.zone(0, 0, 0) });
    R.check('… kostet EINE normale Aktion (keine Zusatzaktion)', (x.t.gs.players[0].heroesActedThisTurn || []).length === 1, x.t.gs.players[0].heroesActedThisTurn);
    R.check('… Dragon: 250 HP-Basis (kein Schaden), Zähler leer', (x.t.find(BT, 'support').counters.currentHp ?? 250) === 250, x.t.find(BT, 'support').counters);
    R.check('… keine Engine-Fehler / Zustand sauber', x.t.errors.length === 0 && x.t.audit().length === 0, { e: x.t.errors, a: x.t.audit() });
  }
  {
    const x = await summon(t => { frisch(t.put(0, 0, 0, EGG)); });
    R.check('1 Drago, ABER in diesem Zug beschworen: nicht spielbar (Weg a verlangt „nicht in diesem Zug", Weg b braucht 2)', x.r === false && !x.t.find(BT, 'support') && x.t.zone(0, 0, 0) === EGG, { r: x.r });
  }
  {
    const x = await summon(t => { frisch(t.put(0, 0, 0, EGG)); frisch(t.put(0, 1, 0, 'Flaming Dragonegg')); });
    R.check('2 Drago, beide in diesem Zug beschworen: gespielt (Weg b gilt ohne „nicht in diesem Zug")', x.r === true && x.t.zone(0, 0, 2) === BT, { r: x.r });
    R.check('… ohne Weg-Frage; beide geopfert', route(x.t).length === 0 && x.t.pile(0, 'discardPile').includes(EGG) && x.t.pile(0, 'discardPile').includes('Flaming Dragonegg'), { discard: x.t.pile(0, 'discardPile'), prompts: route(x.t).length });
  }
  {
    // 1 alt + 1 frisch: beide Wege offen → Wahl
    for (const wahl of ['one', 'two']) {
      const x = await summon(t => { const a = alt(t.put(0, 0, 0, EGG)); const f = frisch(t.put(0, 1, 0, 'Flaming Dragonegg')); return { a, f }; }, {
        choose: wahl,
        pick: (valid, t) => {
          // Weg „one": nur das alte Ei ist wählbar; Weg „two": beide
          const e = valid.filter(v => v.type === 'equip' && !v.ineligible);
          return wahl === 'one' ? ids(e, v => v.cardName === EGG).slice(0, 1) : e.map(v => v.id);
        },
      });
      R.check(`1 altes + 1 frisches Drago: Weg-Frage erscheint (zwei Optionen)`, route(x.t).length === 1 && route(x.t)[0].d.options.map(o => o.id).join() === 'one,two', route(x.t).map(p => p.d.options));
      if (wahl === 'one') {
        R.check('Weg a: nur das alte Ei geopfert, das frische bleibt', x.r === true && x.t.pile(0, 'discardPile').filter(n => n === EGG).length === 1 && x.t.zone(0, 1, 0) === 'Flaming Dragonegg' && x.t.zone(0, 0, 2) === BT, { r: x.r, discard: x.t.pile(0, 'discardPile'), z: x.t.zone(0, 1, 0) });
        const sac = x.t.targets.find(tg => tg.config && /Sacrifice/i.test(tg.config.description || ''));
        R.check('Weg a: das frische Drago ist in der Opferwahl nicht anwählbar (ausgegraut)', sac && !sac.valid.some(v => v.cardName === 'Flaming Dragonegg'), sac && sac.valid.map(v => v.cardName));
      } else {
        R.check('Weg b: beide geopfert', x.r === true && x.t.pile(0, 'discardPile').includes(EGG) && x.t.pile(0, 'discardPile').includes('Flaming Dragonegg') && x.t.zone(0, 0, 2) === BT, { r: x.r, discard: x.t.pile(0, 'discardPile') });
      }
      R.check(`Weg ${wahl}: keine Engine-Fehler`, x.t.errors.length === 0, x.t.errors);
    }
  }
  {
    // 2 alte Drago: beide Wege offen; Weg a opfert nur eines (das andere bleibt)
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(0, 1, 0, 'Flaming Dragonegg')); }, {
      choose: 'one', pick: (valid) => ids(valid.filter(v => v.type === 'equip' && !v.ineligible), () => true).slice(0, 1),
    });
    const geopfert = ['Icy Dragonegg', 'Flaming Dragonegg'].filter(n => x.t.pile(0, 'discardPile').includes(n)).length;
    R.check('2 alte Drago, Weg a: genau EIN Opfer, das andere Ei bleibt stehen', x.r === true && geopfert === 1 && x.t.zone(0, 0, 2) === BT, { r: x.r, geopfert });
  }
  {
    // Abbruch an der Weg-Frage
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(0, 1, 0, 'Flaming Dragonegg')); }, { choose: 'cancel' });
    R.check('Abbruch der Weg-Frage: nichts geopfert, Dragon bleibt in der Hand, Aktion nicht verbraucht', x.t.zone(0, 0, 0) === EGG && x.t.zone(0, 1, 0) === 'Flaming Dragonegg' && x.t.pile(0, 'hand').includes(BT) && (x.t.gs.players[0].heroesActedThisTurn || []).length === 0 && !x.t.find(BT, 'support'), { acted: x.t.gs.players[0].heroesActedThisTurn, hand: x.t.pile(0, 'hand') });
    R.check('Abbruch: keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }
  {
    // Abbruch in der Opferwahl (nur ein Weg offen)
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); }, { pick: () => null });
    R.check('Abbruch der Opferwahl: das Ei bleibt, Dragon in der Hand', x.t.zone(0, 0, 0) === EGG && x.t.pile(0, 'hand').includes(BT) && !x.t.find(BT, 'support'), { z: x.t.zone(0, 0, 0), hand: x.t.pile(0, 'hand') });
  }
  {
    // Black-Thorn Dragon als Tribut (Name enthält „Drago") für einen zweiten Dragon
    const x = await summon(t => { alt(t.put(0, 0, 0, BT)); }, { hand: [BT] });
    R.check('ein Black-Thorn Dragon (Name enthält „Drago") zählt als Tribut für den nächsten', x.r === true && x.t.pile(0, 'discardPile').includes(BT) && x.t.zone(0, 0, 2) === BT, { r: x.r, discard: x.t.pile(0, 'discardPile') });
  }
  {
    // Drago-Kreaturen: auch Sorbereus, Dragolfin, Dragsparov (Beiname), Dragoneer
    for (const n of ['Dragolfin', 'Red Dragoneer', 'Dragsparov, the King of Dragons', 'Sorbereus, the Adapting Dragon']) {
      const x = await summon(t => { alt(t.put(0, 0, 0, n)); });
      R.check(`„${n}" zählt als „Drago"-Tribut`, x.r === true && x.t.zone(0, 0, 2) === BT, { r: x.r });
    }
  }
  {
    // Kreatur eines ANDEREN Helden zählt auch („a Creature you control")
    const x = await summon(t => { alt(t.put(0, 2, 2, EGG)); });
    R.check('Tribut bei einem anderen eigenen Helden zählt', x.r === true && x.t.pile(0, 'discardPile').includes(EGG), { r: x.r });
  }
  {
    // Gegnerisches Drago zählt NICHT (Kontrolle beim Gegner)
    const x = await summon(t => { alt(t.put(1, 0, 0, EGG)); });
    R.check('gegnerisches „Drago" ist kein Tribut', x.r === false, { r: x.r });
    // Vom Gegner kontrolliertes EIGENES Drago zählt nicht, übernommenes Gegner-Drago schon
    const y = await summon(t => { alt(t.put(0, 0, 0, EGG, { controller: 1 })); });
    R.check('eigenes, aber vom Gegner kontrolliertes Drago ist kein Tribut', y.r === false, { r: y.r });
    const z = await summon(t => { alt(t.put(1, 0, 0, EGG, { controller: 0 })); });
    R.check('übernommenes Gegner-Drago (Kontrolle bei mir) ist ein Tribut', z.r === true, { r: z.r });
  }
  {
    // Spielen im Main Phase 1/2 (Kreaturen: Aktionsphase — Normalfall; die Aktion wird verbraucht)
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); });
    // Der Held muss die Schulen haben: ohne Schule nicht spielbar
    const t = await H.fresh({ hand: [[BT], []], gold: 100 });
    alt(t.put(0, 0, 0, EGG));
    const r = await t.play(0, BT, { hero: 0, slot: 2, noGrant: true });
    R.check('Held ohne Destruction/Summoning Magic Lv3: Dragon nicht spielbar', r === false && !t.find(BT, 'support'), { r });
  }
  {
    // Gierige Reihenfolge: das geopferte Shimmering Dragonegg zahlt Gold (eigener Zug) — Zusammenspiel Ei/Dragon
    const x = await summon(t => { frisch(t.put(0, 0, 0, 'Shimmering Dragonegg')); frisch(t.put(0, 1, 0, 'Shimmering Dragonegg')); t.setGold(0, 50); });
    R.check('zwei Shimmering Dragoneggs als Tribut (Weg b): 2 × 8 Gold als Todeseffekt in eigener Runde', x.r === true && x.t.gs.players[0].gold === 66, { r: x.r, gold: x.t.gs.players[0].gold });
  }

  R.section('A3 · Zwei-Opfer-Weg: auch GEGNERISCHE Drago-Kreaturen (Al 23.10.), in jeder Mischung');
  {
    // Je ein eigenes und ein gegnerisches Drago (der gemeldete Fall): Weg b wird angeboten, Weg a nur für das eigene
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(1, 0, 0, 'Flaming Dragonegg')); }, {
      choose: 'two',
      pick: (valid) => valid.filter(v => v.type === 'equip' && !v.ineligible).map(v => v.id),
    });
    R.check('je ein eigenes und ein gegnerisches Drago: beide Wege stehen offen (Weg-Frage mit zwei Optionen)', route(x.t).length === 1 && route(x.t)[0].d.options.map(o => o.id).join() === 'one,two', route(x.t).map(p => p.d.options));
    R.check('Weg b: eigenes UND gegnerisches Drago geopfert, Dragon steht', x.r === true && x.t.zone(0, 0, 2) === BT && !x.t.zone(0, 0, 0) && !x.t.zone(1, 0, 0), { r: x.r, own: x.t.zone(0, 0, 0), opp: x.t.zone(1, 0, 0) });
    R.check('das gegnerische Ei liegt in der Ablage SEINES Besitzers (Sitz 1), das eigene in meiner', x.t.pile(1, 'discardPile').includes('Flaming Dragonegg') && x.t.pile(0, 'discardPile').includes(EGG) && !x.t.pile(0, 'discardPile').includes('Flaming Dragonegg'), { p0: x.t.pile(0, 'discardPile'), p1: x.t.pile(1, 'discardPile') });
    R.check('keine Engine-Fehler / Zustand sauber', x.t.errors.length === 0 && x.t.audit().length === 0, { e: x.t.errors, a: x.t.audit() });
  }
  {
    // Weg a (Pflicht „you control"): gegnerische Kreaturen sind dort NICHT wählbar
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(1, 0, 0, 'Flaming Dragonegg')); }, {
      choose: 'one', pick: (valid) => valid.filter(v => v.type === 'equip' && !v.ineligible).map(v => v.id).slice(0, 1),
    });
    const sac = x.t.targets.find(tg => tg.config && /Sacrifice 1/i.test(tg.config.description || ''));
    R.check('Weg a: in der Opferwahl steht nur das eigene Ei', x.r === true && sac && !sac.valid.some(v => v.owner === 1), sac && sac.valid.map(v => v.owner + ':' + v.cardName));
    R.check('Weg a: das gegnerische Ei bleibt unberührt', x.t.zone(1, 0, 0) === 'Flaming Dragonegg', x.t.zone(1, 0, 0));
  }
  {
    // zwei gegnerische Drago, keine eigenen: Weg b spielbar, Weg a nicht (keine Weg-Frage)
    const x = await summon(t => { frisch(t.put(1, 0, 0, EGG)); frisch(t.put(1, 1, 0, 'Flaming Dragonegg')); }, {
      pick: (valid) => valid.filter(v => v.type === 'equip' && !v.ineligible).map(v => v.id),
    });
    R.check('zwei gegnerische Drago (auch frisch beschworen), kein eigenes: spielbar ohne Weg-Frage', x.r === true && x.t.zone(0, 0, 2) === BT && route(x.t).length === 0, { r: x.r, route: route(x.t).length });
    R.check('beide gegnerischen Eier geopfert (Ablage des Gegners)', x.t.pile(1, 'discardPile').includes(EGG) && x.t.pile(1, 'discardPile').includes('Flaming Dragonegg'), x.t.pile(1, 'discardPile'));
  }
  {
    // Sacrifice-Hooks der gegnerischen Kreatur: sein Todeseffekt (Shimmering Dragonegg zahlt in der Runde des KONTROLLEURS) — der Gegner ist nicht am Zug → kein Gold
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(1, 0, 0, 'Shimmering Dragonegg')); t.setGold(0, 50); t.setGold(1, 50); }, {
      choose: 'two', pick: (valid) => valid.filter(v => v.type === 'equip' && !v.ineligible).map(v => v.id),
    });
    R.check('gegnerisches Shimmering Dragonegg als Opfer in MEINER Runde: kein Gold (Todeseffekt zählt nur in der Runde seines Kontrolleurs)', x.r === true && x.t.gs.players[1].gold === 50 && x.t.gs.players[0].gold === 50, { g0: x.t.gs.players[0].gold, g1: x.t.gs.players[1].gold });
  }
  {
    // Nur EIN Drago insgesamt (eigenes alt) + ein gegnerisches Nicht-Drago: Weg a trägt, Weg b nicht
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); t.put(1, 0, 0, H.INERT.creature); });
    R.check('gegnerische Nicht-Drago-Kreatur ändert nichts: Weg a, ohne Frage', x.r === true && route(x.t).length === 0 && x.t.zone(1, 0, 0) === H.INERT.creature, { r: x.r });
  }
  {
    // Geschützte gegnerische Kreatur (Golden Wings: unaffected by the opponent) ist KEIN Kandidat — sonst zählte der Preis als bezahlt, ohne dass sie stirbt
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); const g = t.put(1, 0, 0, 'Flaming Dragonegg'); g.counters._gwImmune = true; return { g }; });
    R.check('gegnerisches Drago mit Golden-Wings-Schutz zählt NICHT: nur Weg a (ohne Weg-Frage), geschützte Kreatur unberührt', x.r === true && route(x.t).length === 0 && x.t.zone(1, 0, 0) === 'Flaming Dragonegg', { r: x.r, route: route(x.t).length });
    const y = await summon(t => { frisch(t.put(1, 0, 0, EGG)); const g = t.put(1, 1, 0, 'Flaming Dragonegg'); g.counters._gwImmune = true; frisch(g); });
    R.check('ein geschütztes + ein ungeschütztes gegnerisches Drago: Weg b nicht bezahlbar → nicht spielbar', y.r === false && !y.t.find(BT, 'support') && y.t.zone(1, 0, 0) === EGG, { r: y.r });
  }
  {
    // Wurf auf belegten Platz bleibt eigen: die Pflicht-Opfer der Zielzone sind die eigenen Insassen; der zweite Tribut darf gegnerisch sein
    const x = await summon(t => { alt(t.put(0, 0, 0, EGG)); alt(t.put(0, 0, 1, 'Flaming Dragonegg')); alt(t.put(0, 0, 2, 'Dragolfin')); alt(t.put(1, 0, 0, 'Red Dragoneer')); }, {
      choose: 'two',
      pick: (valid) => valid.filter(v => v.type === 'equip' && !v.ineligible && v.owner === 1).map(v => v.id),
    });
    R.check('Wurf auf den belegten Platz: der Insasse (Dragolfin, Pflicht-Opfer) UND das gegnerische Red Dragoneer sind geopfert, der Dragon steht dort, die anderen Eier bleiben', x.r === true && x.t.zone(0, 0, 2) === BT && x.t.pile(0, 'discardPile').includes('Dragolfin') && x.t.pile(1, 'discardPile').includes('Red Dragoneer') && !x.t.zone(1, 0, 0) && x.t.zone(0, 0, 0) === EGG && x.t.zone(0, 0, 1) === 'Flaming Dragonegg', { r: x.r, z2: x.t.zone(0, 0, 2), p0: x.t.pile(0, 'discardPile'), p1: x.t.pile(1, 'discardPile') });
    R.check('… keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }

  // Wurf auf belegten Platz (volle Spalte)
  R.section('A2 · Wurf auf einen belegten Platz (volle Spalte, W19a)');
  {
    // Spalte voll mit 3 alten Eiern: Weg a — Ziel-Zone hat 1 Insassen → der Insasse wird Pflicht-Opfer
    const t = await H.fresh({ hand: [[BT], []], gold: 100 });
    t.grantFor(0, 0, BT);
    for (let s = 0; s < 3; s++) alt(t.put(0, 0, s, s === 1 ? 'Flaming Dragonegg' : EGG));
    const sch = t.engine.cardInstances.find(c => c.name === BT) || null;
    const script = H.loadCardEffect(BT);
    const ziele = script.getBouncePlacementTargets(t.gs, 0, t.engine);
    R.check('volle Spalte aus 3 alten Drago: alle 3 Plätze sind Wurfziele', ziele.length === 3 && ziele.every(z => z.heroIdx === 0), ziele);
    R.check('canBypassFreeZoneRequirement für diesen Helden', script.canBypassFreeZoneRequirement(t.gs, 0, 0, H.DB[BT], t.engine) === true, null);
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === BT, answer: () => ({ optionId: 'one' }) });
    const r = await t.play(0, BT, { hero: 0, slot: 1 });
    R.check('Wurf auf Platz 1 (Weg a): der Insasse ist das Opfer, der Dragon landet DORT', r === true && t.zone(0, 0, 1) === BT && t.pile(0, 'discardPile').includes('Flaming Dragonegg') && t.zone(0, 0, 0) === EGG && t.zone(0, 0, 2) === EGG, { r, z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)] });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    // Volle Spalte, nur FRISCHE Drago: Weg a unmöglich; Weg b: Zielzone leerbar (1 Insasse ≤ 2), 2. Opfer frei
    const t = await H.fresh({ hand: [[BT], []], gold: 100 });
    t.grantFor(0, 0, BT);
    for (let s = 0; s < 3; s++) frisch(t.put(0, 0, s, EGG));
    const script = H.loadCardEffect(BT);
    const ziele = script.getBouncePlacementTargets(t.gs, 0, t.engine);
    R.check('volle Spalte aus 3 FRISCHEN Drago: Wurfziele über Weg b vorhanden', ziele.length === 3, ziele);
    const r = await t.play(0, BT, { hero: 0, slot: 0 });
    R.check('Wurf (nur Weg b möglich): zwei Eier geopfert, Dragon liegt auf Platz 0, ein Ei bleibt', r === true && t.zone(0, 0, 0) === BT && [t.zone(0, 0, 1), t.zone(0, 0, 2)].filter(n => n === EGG).length === 1 && t.pile(0, 'discardPile').filter(n => n === EGG).length === 2, { r, z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)], discard: t.pile(0, 'discardPile') });
  }
  {
    // Volle Spalte, Zielzone mit NICHT-Drago: Wurf dorthin nicht erlaubt
    const t = await H.fresh({ hand: [[BT], []], gold: 100 });
    t.grantFor(0, 0, BT);
    alt(t.put(0, 0, 0, EGG)); alt(t.put(0, 0, 1, H.INERT.creature)); alt(t.put(0, 0, 2, EGG));
    const script = H.loadCardEffect(BT);
    const ziele = script.getBouncePlacementTargets(t.gs, 0, t.engine);
    R.check('Zielzone mit Nicht-Drago ist kein Wurfziel (der Insasse müsste Opfer sein, ist aber kein Drago)', !ziele.some(z => z.slotIdx === 1) && ziele.some(z => z.slotIdx === 0), ziele);
    const r = await t.play(0, BT, { hero: 0, slot: 1 });
    R.check('Wurf auf diese Zone wird abgelehnt', r === false && !t.find(BT, 'support') && t.zone(0, 0, 1) === H.INERT.creature, { r });
  }

  // ───────────────────────── B · Aktiv-Effekt ─────────────────────────
  R.section('B · 200 Schaden, einmal pro Zug');
  {
    const t = await H.fresh({ gold: 100 });
    const dr = alt(t.put(0, 0, 0, BT));
    const gegner = t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => ids(valid, v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    const r1 = await t.activateCreature(0, 0, 0);
    R.check('Held des Gegners: 200 Schaden', r1 === true && t.hp(1, 0) === 600, { r1, hp: t.hp(1, 0) });
    t.targetFn = (valid) => ids(valid, v => v.type === 'equip' && v.owner === 1);
    const r2 = await t.activateCreature(0, 0, 0);
    R.check('zweite Aktivierung im selben Zug: abgelehnt (einmal pro Zug)', r2 !== true || gegner.counters.currentHp === undefined || (gegner.counters.currentHp ?? 1000) === 1000, { r2, hp: gegner.counters.currentHp });
    R.check('Aktivierung kostet keine Aktion', (t.gs.players[0].heroesActedThisTurn || []).length === 0, t.gs.players[0].heroesActedThisTurn);
    await t.endTurn(); await t.endTurn();
    t.targetFn = (valid) => ids(valid, v => v.type === 'equip' && v.owner === 1);
    t.gs.activePlayer = 0; t.phase(2);
    const r3 = await t.activateCreature(0, 0, 0);
    R.check('im nächsten Zug wieder: Kreatur des Gegners 200 Schaden', r3 === true && (gegner.counters.currentHp ?? 1000) === 800, { r3, hp: gegner.counters.currentHp });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Abbruch der Zielwahl gibt die Sperre frei
    const t = await H.fresh({ gold: 100 });
    alt(t.put(0, 0, 0, BT));
    t.policy.cancelTargets = true;
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    await t.activateCreature(0, 0, 0);
    R.check('Abbruch: kein Schaden', t.hp(1, 0) === 800 && t.hp(1, 1) === 800, [t.hp(1, 0), t.hp(1, 1)]);
    t.policy.cancelTargets = false;
    t.targetFn = (valid) => ids(valid, v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
    await t.activateCreature(0, 0, 0);
    R.check('nach dem Abbruch ist der Effekt noch frei (HOPT nicht verbraucht)', t.hp(1, 0) === 600, t.hp(1, 0));
  }
  {
    // Beschwörungsstarre: im Beschwörungszug nicht aktivierbar
    const t = await H.fresh({ hand: [[BT], []], gold: 100 });
    alt(t.put(0, 1, 0, EGG));
    await t.play(0, BT, { hero: 0, slot: 0 });
    t.targetFn = (valid) => ids(valid, v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.activateCreature(0, 0, 0);
    R.check('im Beschwörungszug: Effekt gesperrt (kein Haste)', t.hp(1, 0) === 800, { r, hp: t.hp(1, 0) });
    await t.endTurn(); await t.endTurn();
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    R.check('im Folgezug: 200 Schaden', t.hp(1, 0) === 600, t.hp(1, 0));
  }
  {
    // jedes Ziel: eigener Held, eigene Kreatur, sich selbst („a target")
    const t = await H.fresh({ gold: 100 });
    const dr = alt(t.put(0, 0, 0, BT));
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
    const valide = [];
    t.targetFn = (valid) => { valide.push(...valid.map(v => `${v.type}:${v.owner}:${v.heroIdx}:${v.slotIdx ?? ''}`)); return null; };
    await t.activateCreature(0, 0, 0);
    R.check('Zielliste enthält Helden beider Seiten und den Dragon selbst', valide.includes('hero:0:0:') && valide.includes('hero:1:0:') && valide.includes('equip:0:0:0'), valide);
  }
  {
    // Frozen / negated: kein Aktiveffekt
    for (const [zustand, c] of [['gefroren', { frozen: 1 }], ['negiert', { negated: true }]]) {
      const t = await H.fresh({ gold: 100 });
      alt(t.put(0, 0, 0, BT, { counters: c }));
      t.targetFn = (valid) => ids(valid, v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0);
      t.gs.activePlayer = 0; t.phase(2); t.resetActions(0);
      await t.activateCreature(0, 0, 0);
      R.check(`${zustand}: kein Schaden`, t.hp(1, 0) === 800, t.hp(1, 0));
    }
  }

  // ───────────────────────── C · Spell-Immunität ─────────────────────────
  R.section('C · „Unaffected by all Spells" — Batterie echter Spells (Kreatur UND zugehöriger Held), jeweils mit Kontrollziel');
  // Brett: Sitz 0: Held 0 mit Dragon (immunes Paar), Held 1 mit Kontrollkreatur (Kontrollpaar). Sitz 1 wirkt (Gegner) bzw. Sitz 0 wirkt auf sich selbst.
  async function brett(o = {}) {
    const t = await H.fresh({ hp: 800, gold: 100, deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], ...(o.fresh || {}) });
    const dr = alt(t.put(0, 0, 1, BT, o.dragonOpts));
    const ctl = alt(t.put(0, 1, 0, H.INERT.big));
    if (o.prep) await o.prep(t, dr, ctl);
    return { t, dr, ctl };
  }
  const hpK = (i) => i.counters.currentHp ?? H.DB[i.name].hp;
  const stK = (i) => ['frozen', 'burned', 'poisoned', 'stunned', 'negated', 'nulled'].filter(k => i.counters[k]);
  const stH = (t, hi) => Object.keys(t.hero(0, hi).statuses || {}).filter(k => !['shielded', 'immune'].includes(k));
  const picker = (seite, ...liste) => (valid) => {
    const out = [];
    for (const w of liste) {
      const v = valid.find(x => !out.includes(x.id) && ((w === 'immuneHero' && x.type === 'hero' && x.owner === seite && x.heroIdx === 0)
        || (w === 'ctlHero' && x.type === 'hero' && x.owner === seite && x.heroIdx === 1)
        || (w === 'dragon' && x.type === 'equip' && x.owner === seite && x.heroIdx === 0 && x.slotIdx === 1)
        || (w === 'ctlCreature' && x.type === 'equip' && x.owner === seite && x.heroIdx === 1 && x.slotIdx === 0)));
      if (v) out.push(v.id);
    }
    return out.length ? out : null;
  };

  // — Schaden —
  for (const [spell, extra] of [['Fireball', 2], ['Meteor Crash', 1], ['Icebolt', 1]]) {
    const wahlen = extra === 1 ? [['immuneHero'], ['dragon']] : [['immuneHero', 'dragon']];
    for (const w of wahlen) {
      const b = await brett();
      b.t.targetFn = picker(0, ...w);
      const r = await b.t.play(1, spell, { hero: 0 });
      const verloren = (800 - b.t.hp(0, 0)) + (250 - hpK(b.dr));
      R.check(`${spell} auf ${w.join('+')}: gespielt, KEIN Schaden an Held/Dragon`, r === true && verloren === 0 && b.dr.zone === 'support', { r, held: b.t.hp(0, 0), dragon: hpK(b.dr), errors: b.t.errors.slice(0, 2) });
      R.check(`${spell} auf ${w.join('+')}: Dragon/Held tragen keinen Status`, stK(b.dr).length === 0 && stH(b.t, 0).length === 0, { dragon: stK(b.dr), held: stH(b.t, 0) });
    }
    const k = await brett();
    k.t.targetFn = picker(0, ...(extra === 1 ? ['ctlHero'] : ['ctlHero', 'ctlCreature']));
    const rk = await k.t.play(1, spell, { hero: 0 });
    R.check(`Kontrolle ${spell}: trifft Held 1 / Kontrollkreatur wirklich`, rk === true && ((800 - k.t.hp(0, 1)) + (1000 - hpK(k.ctl))) > 0, { r: rk, held1: k.t.hp(0, 1), ctl: hpK(k.ctl) });
  }
  {
    // Fire Bolts: 100 Schaden an einem Ziel des Gegners, danach 50 Rückstoß an einem EIGENEN Ziel des Wirkers — hier trifft der Wirker (Sitz 0) mit dem Rückstoß seinen eigenen Dragon/Helden
    const b = await brett();
    b.t.targetFn = (valid) => {
      const gegner = valid.filter(v => v.owner === 1);
      const eigene = valid.filter(v => v.owner === 0);
      const w = b.t.targets.length === 1 ? (gegner.find(v => v.type === 'hero') || gegner[0]) : eigene.find(v => v.type === 'equip' && v.slotIdx === 1);
      return w ? [w.id] : null;
    };
    const r = await b.t.play(0, 'Fire Bolts', { hero: 2 });
    R.check('Fire Bolts (eigener Rückstoß auf den eigenen Dragon): kein Schaden, „all Spells" schließt eigene ein', r === true && hpK(b.dr) === 250, { r, dragon: hpK(b.dr), held1: b.t.hp(1, 0), targets: b.t.targets.length, errors: b.t.errors.slice(0, 2) });
    R.check('Fire Bolts trifft das Ziel des Gegners (Kontrolle: 100 Schaden kamen an)', b.t.hp(1, 0) === 700, { hp: b.t.hp(1, 0) });
  }
  {
    // Flächenschaden: Flame Avalanche (150 an allen Zielen des Gegners)
    const b = await brett();
    const r = await b.t.play(1, 'Flame Avalanche', { hero: 0 });
    R.check('Flame Avalanche (Fläche): Dragon und sein Held unversehrt', r === true && b.t.hp(0, 0) === 800 && hpK(b.dr) === 250, { r, held: b.t.hp(0, 0), dragon: hpK(b.dr) });
    R.check('Kontrolle: Held 1 −150, Kontrollkreatur −150', b.t.hp(0, 1) === 650 && hpK(b.ctl) === 850, { held1: b.t.hp(0, 1), ctl: hpK(b.ctl) });
    R.check('Held 2 (ohne Dragon) −150', b.t.hp(0, 2) === 650, b.t.hp(0, 2));
    R.check('keine Engine-Fehler', b.t.errors.length === 0, b.t.errors);
  }
  {
    // Pyroblast: „any number of targets", Pollution-Kosten; Dragon + Held + Kontrolle zugleich
    const b = await brett();
    b.t.targetFn = picker(0, 'immuneHero', 'dragon', 'ctlHero', 'ctlCreature');
    const r = await b.t.play(1, 'Pyroblast', { hero: 0 });
    R.check('Pyroblast (4 Ziele, 100 Schaden): Dragon + Held unversehrt', r === true && b.t.hp(0, 0) === 800 && hpK(b.dr) === 250, { r, held: b.t.hp(0, 0), dragon: hpK(b.dr), errors: b.t.errors.slice(0, 2) });
    R.check('Pyroblast: Kontrollziele −100', b.t.hp(0, 1) === 700 && hpK(b.ctl) === 900, { held1: b.t.hp(0, 1), ctl: hpK(b.ctl) });
  }
  // — Status —
  {
    const b = await brett();
    const r = await b.t.play(1, 'Snowstorm Mischief', { hero: 0 });
    R.check('Snowstorm Mischief (Freeze aller Kreaturen): Dragon nicht gefroren, Kontrollkreatur gefroren', r === true && stK(b.dr).length === 0 && stK(b.ctl).includes('frozen'), { r, dragon: stK(b.dr), ctl: stK(b.ctl) });
  }
  {
    const b = await brett();
    const r = await b.t.play(1, 'Toxic Fumes', { hero: 0 });
    R.check('Toxic Fumes (Gift auf alle Kreaturen): Dragon nicht vergiftet, Kontrollkreatur vergiftet', r === true && !b.dr.counters.poisoned && !!b.ctl.counters.poisoned, { r, dragon: b.dr.counters.poisoned, ctl: b.ctl.counters.poisoned });
  }
  {
    const b = await brett();
    b.t.script.push({ match: d => d.type === 'playerPicker', answer: () => ({ playerIdx: 0 }) });
    const r = await b.t.play(1, 'Divine Gift of Fire', { hero: 0 });
    R.check('Divine Gift of Fire (Burn auf ALLE Ziele von Sitz 0): Dragon nicht verbrannt, zugehöriger Held nicht verbrannt', r === true && !b.dr.counters.burned && !(b.t.hero(0, 0).statuses || {}).burned, { r, dragon: stK(b.dr), held: stH(b.t, 0), errors: b.t.errors.slice(0, 2) });
    R.check('Kontrolle: Held 1, Held 2 und die Kontrollkreatur sind verbrannt', !!(b.t.hero(0, 1).statuses || {}).burned && !!(b.t.hero(0, 2).statuses || {}).burned && !!b.ctl.counters.burned, { h1: stH(b.t, 1), h2: stH(b.t, 2), ctl: stK(b.ctl) });
  }
  {
    // Poison Pollen: stunnt vergiftete Ziele und vergiftet betäubte — Dragon + Held vorab per Nicht-Spell vergiftet
    const b = await brett({ prep: async (t, dr, ctl) => {
      await t.run(() => t.engine.applyCreatureStatus(dr, 'poisoned', { sourceOwner: 1, source: 'Test' }));
      await t.run(() => t.engine.addHeroStatus(0, 0, 'poisoned', { appliedBy: 1 }));
      await t.run(() => t.engine.applyCreatureStatus(ctl, 'poisoned', { sourceOwner: 1, source: 'Test' }));
      await t.run(() => t.engine.addHeroStatus(0, 1, 'poisoned', { appliedBy: 1 }));
    } });
    const vorherDragonGift = !!b.dr.counters.poisoned;
    const r = await b.t.play(1, 'Poison Pollen', { hero: 0 });
    R.check('Poison Pollen: Dragon (vorab vergiftet) wird nicht betäubt', r === true && vorherDragonGift && !b.dr.counters.stunned, { r, vorherDragonGift, st: stK(b.dr) });
    R.check('Poison Pollen: der Held 0 (vorab vergiftet) wird nicht betäubt', !((b.t.hero(0, 0).statuses || {}).stunned), stH(b.t, 0));
    R.check('Kontrolle: die vorab vergiftete Kontrollkreatur und Held 1 werden betäubt', !!b.ctl.counters.stunned && !!(b.t.hero(0, 1).statuses || {}).stunned, { ctl: stK(b.ctl), h1: stH(b.t, 1) });
  }
  // — Heilung (eigene Spells! „all Spells") —
  {
    const b = await brett({ prep: async (t, dr, ctl) => {
      dr.counters.currentHp = 100; ctl.counters.currentHp = 400; t.hero(0, 0).hp = 300; t.hero(0, 1).hp = 300;
    } });
    b.t.targetFn = picker(0, 'immuneHero');
    const r1 = await b.t.play(0, 'Heal', { hero: 2 });
    R.check('Heal (eigener Spell) auf den zugehörigen Helden: keine Heilung', r1 === true && b.t.hp(0, 0) === 300, { r1, hp: b.t.hp(0, 0), errors: b.t.errors.slice(0, 2) });
    b.t.targetFn = picker(0, 'dragon');
    const r2 = await b.t.play(0, 'Heal', { hero: 2 });
    R.check('Heal (eigener Spell) auf den Dragon: keine Heilung', r2 === true && hpK(b.dr) === 100, { r2, hp: hpK(b.dr) });
    b.t.targetFn = picker(0, 'ctlCreature');
    const r3 = await b.t.play(0, 'Heal', { hero: 2 });
    R.check('Kontrolle: Heal heilt die Kontrollkreatur (400 → mehr)', r3 === true && hpK(b.ctl) > 400, { r3, hp: hpK(b.ctl) });
    b.t.targetFn = picker(0, 'ctlHero');
    await b.t.play(0, 'Heal', { hero: 2 });
    R.check('Kontrolle: Heal heilt Held 1', b.t.hp(0, 1) > 300, b.t.hp(0, 1));
  }
  {
    // Healing Melody (alle eigenen Ziele)
    const b = await brett({ prep: async (t, dr, ctl) => { dr.counters.currentHp = 100; ctl.counters.currentHp = 400; t.hero(0, 0).hp = 300; t.hero(0, 1).hp = 300; } });
    const r = await b.t.play(0, 'Healing Melody', { hero: 2 });
    R.check('Healing Melody (alle eigenen Ziele): Dragon und Held 0 bleiben unverändert', r === true && hpK(b.dr) === 100 && b.t.hp(0, 0) === 300, { r, dragon: hpK(b.dr), held: b.t.hp(0, 0), errors: b.t.errors.slice(0, 2) });
    R.check('Kontrolle: Held 1 und Kontrollkreatur geheilt', b.t.hp(0, 1) > 300 && hpK(b.ctl) > 400, { held1: b.t.hp(0, 1), ctl: hpK(b.ctl) });
  }
  // — Zerstören / Negieren —
  {
    const b = await brett();
    b.t.targetFn = picker(0, 'dragon');
    const r = await b.t.play(1, 'Goldify', { hero: 0 });
    R.check('Goldify (besiege eine Kreatur): Dragon bleibt liegen', r === true && b.dr.zone === 'support' && b.t.zone(0, 0, 1) === BT && !b.t.pile(0, 'discardPile').includes(BT), { r, zone: b.dr.zone, discard: b.t.pile(0, 'discardPile') });
    const k = await brett();
    k.t.targetFn = picker(0, 'ctlCreature');
    await k.t.play(1, 'Goldify', { hero: 0 });
    R.check('Kontrolle: Goldify besiegt die Kontrollkreatur', k.ctl.zone !== 'support', { zone: k.ctl.zone });
  }
  {
    const b = await brett({ fresh: { hand: [[], []] } });
    // Null Zone: negiert Kreatureneffekte und sperrt Spells der Helden (Pollution-Kosten: zwei freie Zonen des Wirkers)
    const r = await b.t.play(1, 'Null Zone', { hero: 0 });
    R.check('Null Zone (negiere alle Kreatureneffekte): Dragon nicht negiert, Kontrollkreatur negiert', r === true && !b.dr.counters.negated && !b.dr.counters.nulled && !!(b.ctl.counters.negated || b.ctl.counters.nulled), { r, dragon: stK(b.dr), ctl: stK(b.ctl), errors: b.t.errors.slice(0, 2) });
  }
  // — Spell-Sperren am Helden (Status „frightened" / Null-Zone-Sperre): der zugehörige Held darf weiter Spells wirken —
  {
    const b = await brett();
    const r = await b.t.play(1, 'Howling in the Night', { hero: 0 });
    R.check('Howling in the Night („Heroes cannot use Spells"): zugehöriger Held NICHT betroffen, Kontrollheld betroffen', r === true && !((b.t.hero(0, 0).statuses || {}).frightened) && !!((b.t.hero(0, 1).statuses || {}).frightened), { r, h0: stH(b.t, 0), h1: stH(b.t, 1), errors: b.t.errors.slice(0, 2) });
  }
  {
    const b = await brett();
    await b.t.play(1, 'Null Zone', { hero: 0 });
    const g = b.t.hero(0, 0).statuses || {}, k = b.t.hero(0, 1).statuses || {};
    R.note('Null Zone — Statuslage Held 0 (Dragon) / Held 1 (Kontrolle)', { h0: Object.keys(g), h1: Object.keys(k) });
    R.check('Null Zone: der zugehörige Held trägt keinen Sperrstatus, der Kontrollheld schon', Object.keys(g).length === 0 && Object.keys(k).includes('nulled'), { h0: Object.keys(g), h1: Object.keys(k) });
  }
  // — Spell-Anhänge mit Statuswirkung: Decisive Defeat (Hero's effect negated) —
  {
    const b = await brett();
    b.t.targetFn = picker(0, 'immuneHero');
    const r = await b.t.play(1, 'Decisive Defeat', { hero: 0 });
    R.note('Decisive Defeat auf den Dragon-Helden: gespielt/angelegt', { r, anhang: b.t.inst(i => i.name === 'Decisive Defeat').map(i => i.zone + ':' + i.heroIdx), negiert: !!(b.t.hero(0, 0).statuses || {}).negated });
    R.check('Decisive Defeat (Spell-Anhang: Heldeneffekt negiert): der zugehörige Held ist NICHT negiert', !((b.t.hero(0, 0).statuses || {}).negated), { st: stH(b.t, 0) });
    const k = await brett();
    k.t.targetFn = picker(0, 'ctlHero');
    await k.t.play(1, 'Decisive Defeat', { hero: 0 });
    R.check('Kontrolle: Decisive Defeat negiert Held 1', !!(k.t.hero(0, 1).statuses || {}).negated, { st: stH(k.t, 1) });
  }

  // ───────────────────────── D · Nicht-Spells wirken weiter ─────────────────────────
  R.section('D · Alles, was kein Spell ist, wirkt weiter (Attack, Artefakt, Trank, Kreatureneffekt, Heldeneffekt)');
  {
    // Kreatureneffekt (Red Dragoneer: 50 × andere „Drago"-Kreaturen) auf Dragon + Held
    const b = await brett({ prep: async (t) => { alt(t.put(1, 0, 0, 'Red Dragoneer')); alt(t.put(1, 1, 0, EGG)); alt(t.put(1, 2, 0, EGG)); } });
    b.t.targetFn = picker(0, 'dragon');
    b.t.gs.activePlayer = 1; b.t.phase(2); b.t.resetActions(1);
    const r = await b.t.activateCreature(1, 0, 0);
    R.check('Kreatureneffekt (Red Dragoneer) trifft den Dragon: −100', r === true && hpK(b.dr) === 150, { r, hp: hpK(b.dr) });
    b.t.targetFn = picker(0, 'immuneHero');
    b.t.gs.activePlayer = 1; b.t.phase(2);
    // zweiter Dragoneer-Einsatz im selben Zug nicht möglich → anderes Beispiel unten
  }
  {
    // Attack: Held 1 des Gegners mit ATK 100; „Animal Training"
    const b = await brett({ prep: async (t) => { t.hero(1, 0).atk = 50; t.hero(1, 0).baseAtk = 50; } });
    b.t.targetFn = picker(0, 'dragon');
    const r = await b.t.play(1, 'Critical Strike', { hero: 0 });
    R.check('Attack (Critical Strike, 2 × ATK) trifft den Dragon: −100 (Attacks sind keine Spells)', r === true && hpK(b.dr) === 150, { r, hp: hpK(b.dr), errors: b.t.errors.slice(0, 2) });
    const c = await brett({ prep: async (t) => { t.hero(1, 0).atk = 50; t.hero(1, 0).baseAtk = 50; } });
    c.t.targetFn = picker(0, 'immuneHero');
    const r2 = await c.t.play(1, 'Critical Strike', { hero: 0 });
    R.check('Attack trifft den zugehörigen Helden: −100', r2 === true && c.t.hp(0, 0) === 700, { r2, hp: c.t.hp(0, 0) });
  }
  {
    // Artefakt Snow Cannon: friert einen Helden ein
    const b = await brett();
    b.t.targetFn = picker(0, 'immuneHero');
    const r = await b.t.play(1, 'Snow Cannon', { hero: 1 });
    R.check('Artefakt (Snow Cannon) friert den zugehörigen Helden ein', r === true && !!(b.t.hero(0, 0).statuses || {}).frozen, { r, st: stH(b.t, 0), errors: b.t.errors.slice(0, 2) });
  }
  {
    // Tränke (Nicht-Spells): Bottled Flame (Burn auf Dragon und Helden), Poison Vial auf den Helden, Acid Vial auf den Dragon
    const b = await brett();
    b.t.targetFn = picker(0, 'dragon', 'immuneHero');
    const r = await b.t.play(1, 'Bottled Flame', { hero: 0 });
    R.check('Trank Bottled Flame (kein Spell): verbrennt Dragon UND zugehörigen Helden', r === true && !!b.dr.counters.burned && !!(b.t.hero(0, 0).statuses || {}).burned, { r, dragon: stK(b.dr), held: stH(b.t, 0), targets: b.t.targets.length });
    const c = await brett();
    c.t.targetFn = picker(0, 'immuneHero');
    const r2 = await c.t.play(1, 'Poison Vial', { hero: 0 });
    R.check('Trank Poison Vial (kein Spell): vergiftet den zugehörigen Helden', r2 === true && !!(c.t.hero(0, 0).statuses || {}).poisoned, { r2, held: stH(c.t, 0), targets: c.t.targets.length, errors: c.t.errors.slice(0, 2) });
    const d = await brett();
    d.t.targetFn = picker(0, 'dragon');
    const r3 = await d.t.play(1, 'Acid Vial', { hero: 0 });
    R.check('Trank Acid Vial (kein Spell): wirkt auf den Dragon', r3 === true && (hpK(d.dr) < 250 || stK(d.dr).length > 0 || Object.keys(d.dr.counters.buffs || {}).length > 0), { r3, dragon: hpK(d.dr), st: stK(d.dr), c: d.dr.counters, targets: d.t.targets.length });
  }

  // ───────────────────────── E · Ruhen ─────────────────────────
  R.section('E · Die Immunität ist ein laufender Schutz: sie ruht bei Negierung / Frost / Betäubung des Dragons');
  for (const [zustand, c] of [['negiert', { negated: true }], ['gefroren', { frozen: 1 }], ['betäubt', { stunned: 1 }]]) {
    const b = await brett({ dragonOpts: { counters: c } });
    b.t.targetFn = picker(0, 'immuneHero', 'dragon');
    const r = await b.t.play(1, 'Fireball', { hero: 0 });
    R.check(`Dragon ${zustand}: Fireball trifft Held UND Dragon (−150 je Ziel)`, r === true && b.t.hp(0, 0) === 650 && hpK(b.dr) === 100, { r, held: b.t.hp(0, 0), dragon: hpK(b.dr) });
  }
  {
    // Die Immunität kehrt zurück, wenn der Zustand endet (hier: Zähler entfernt)
    const b = await brett({ dragonOpts: { counters: { negated: true } } });
    delete b.dr.counters.negated;
    b.t.targetFn = picker(0, 'immuneHero', 'dragon');
    await b.t.play(1, 'Fireball', { hero: 0 });
    R.check('nach Ende der Negierung wieder immun', b.t.hp(0, 0) === 800 && hpK(b.dr) === 250, { held: b.t.hp(0, 0), dragon: hpK(b.dr) });
  }
  {
    // Echter Zugwechsel: der Schutz trägt über Zugwechsel
    const b = await brett();
    await b.t.endTurn();                    // Sitz 1 am Zug
    b.t.targetFn = picker(0, 'immuneHero', 'dragon');
    await b.t.play(1, 'Fireball', { hero: 0 });
    R.check('im Zug des Gegners (nach echtem Zugwechsel): weiter immun', b.t.hp(0, 0) === 800 && hpK(b.dr) === 250, { held: b.t.hp(0, 0), dragon: hpK(b.dr) });
  }

  // ───────────────────────── F · Piercing ─────────────────────────
  R.section('F · Ida: „ignore any effects that make a target unaffected by them" — Piercing geht durch');
  {
    const b = await brett({ fresh: { heroes: [undefined, ['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']] } });
    b.t.targetFn = picker(0, 'immuneHero');
    const r = await b.t.play(1, 'Meteor Crash', { hero: 0 });
    R.note('Ida + Meteor Crash auf den zugehörigen Helden (Piercing?)', { r, held: b.t.hp(0, 0) });
    const c = await brett({ fresh: { heroes: [undefined, ['Ida, the Adept of Destruction', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief']] } });
    c.t.targetFn = picker(0, 'dragon');
    const r2 = await c.t.play(1, 'Meteor Crash', { hero: 0 });
    R.note('Ida + Meteor Crash auf den Dragon (Piercing?)', { r2, dragon: hpK(c.dr) });
    R.check('Ida: Spell-Schaden an Held UND Dragon kommt durch (Text: ignoriert „unaffected")', b.t.hp(0, 0) < 800 && hpK(c.dr) < 250, { held: b.t.hp(0, 0), dragon: hpK(c.dr) });
    R.check('Ida: der Dragon stirbt an 300 Piercing-Schaden sauber (Ablage, kein Geisterwesen mit negativen HP auf dem Brett)', c.t.zone(0, 0, 1) === null && c.t.pile(0, 'discardPile').includes(BT) && !c.t.find(BT, 'support') && c.t.audit().length === 0, { z: c.t.zone(0, 0, 1), discard: c.t.pile(0, 'discardPile'), audit: c.t.audit() });
  }

  // ───────────────────────── G · Randfälle ─────────────────────────
  R.section('G · Randfälle');
  {
    // Eigene Opferkosten sind kein Zugriff des Spells: Sacrifice to Divinity (Spell) darf den Dragon als Tribut opfern; ein vom GEGNER erzwungenes Opfer per Spell nicht
    const t = await H.fresh({ hand: [['Sacrifice to Divinity'], []], gold: 100 });
    alt(t.put(0, 0, 1, BT));
    t.targetFn = (valid) => ids(valid, v => v.cardName === BT);
    const r = await t.play(0, 'Sacrifice to Divinity', { hero: 0 });
    R.check('Sacrifice to Divinity (Spell) mit dem Dragon als eigenem Tribut: der Dragon wird wirklich geopfert (Kosten gezahlt, nicht umsonst)', r === true && t.zone(0, 0, 1) === null && t.pile(0, 'discardPile').includes(BT), { r, z: t.zone(0, 0, 1), discard: t.pile(0, 'discardPile') });
    const b = await brett();
    await b.t.run(() => b.t.engine.actionDestroyCard({ name: 'Fireball', owner: 1, heroIdx: 0 }, b.dr, { isSacrifice: true }));
    R.check('vom Gegner per Spell erzwungenes Opfer: der Dragon bleibt', b.t.zone(0, 0, 1) === BT, b.t.zone(0, 0, 1));
    const c = await brett();
    await c.t.run(() => c.t.engine.actionDestroyCard({ name: 'Fireball', owner: 0, heroIdx: 0 }, c.dr, {}));
    R.check('eigener Spell, der den Dragon ZERSTÖRT (kein Kostenopfer): der Dragon bleibt (all Spells)', c.t.zone(0, 0, 1) === BT, c.t.zone(0, 0, 1));
  }
  {
    // Der Schutz gilt nur für DEN Helden der Zone: Held 1 (ohne Dragon) bekommt Schaden
    const b = await brett();
    b.t.targetFn = picker(0, 'ctlHero');
    await b.t.play(1, 'Meteor Crash', { hero: 0 });
    R.check('Held 1 (anderer Held als der Dragon-Held) ist NICHT geschützt', b.t.hp(0, 1) < 800, b.t.hp(0, 1));
  }
  {
    // Zwei Dragons bei zwei Helden: beide Helden geschützt, Held 2 nicht
    const b = await brett({ prep: async (t) => { alt(t.put(0, 1, 2, BT)); } });
    b.t.targetFn = picker(0, 'immuneHero', 'ctlHero');
    await b.t.play(1, 'Fireball', { hero: 0 });
    R.check('zweiter Dragon bei Held 1: Held 1 jetzt auch geschützt', b.t.hp(0, 0) === 800 && b.t.hp(0, 1) === 800, [b.t.hp(0, 0), b.t.hp(0, 1)]);
  }
  {
    // Dragon stirbt (Nicht-Spell: Attack) → Held verliert den Schutz sofort
    const b = await brett({ prep: async (t) => { t.hero(1, 0).atk = 1000; t.hero(1, 0).baseAtk = 1000; } });
    b.t.targetFn = picker(0, 'dragon');
    await b.t.play(1, 'Critical Strike', { hero: 0 });
    R.check('Dragon durch Attack besiegt (2000 Schaden ≥ 250)', b.t.zone(0, 0, 1) === null && b.t.pile(0, 'discardPile').includes(BT), { z: b.t.zone(0, 0, 1), discard: b.t.pile(0, 'discardPile') });
    b.t.targetFn = picker(0, 'immuneHero');
    await b.t.play(1, 'Meteor Crash', { hero: 0 });
    R.check('danach ist der Held nicht mehr geschützt', b.t.hp(0, 0) < 800, b.t.hp(0, 0));
  }
  {
    // Held des Dragons besiegt (Nicht-Spell): Dragon bleibt (Kreaturen sind unabhängig von ihren Helden) und bleibt immun
    const b = await brett();
    await b.t.run(() => b.t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, b.t.hero(0, 0), 9999, 'attack'));
    R.check('Held nach Nicht-Spell-Schaden besiegt, Dragon bleibt liegen', b.t.hp(0, 0) <= 0 && b.dr.zone === 'support', { hp: b.t.hp(0, 0), zone: b.dr.zone });
    b.t.targetFn = picker(0, 'dragon');
    await b.t.play(1, 'Fireball', { hero: 0 });
    R.check('der Dragon eines toten Helden bleibt Spell-immun', hpK(b.dr) === 250, hpK(b.dr));
  }
  {
    // Gestohlen (Kontrolle beim Gegner): bleibt immun; Besitzer-Schutz am Helden bleibt (Held in der Zone)
    const b = await brett();
    await b.t.run(() => b.t.engine.actionStealCreature(1, b.dr, { sourceName: 'Test' }));
    await H.sleep(100);
    b.t.targetFn = picker(0, 'immuneHero', 'dragon');
    await b.t.play(1, 'Fireball', { hero: 0 });
    R.note('gestohlener Dragon (Kontrolle bei Sitz 1) + Fireball von Sitz 1 auf Held/Dragon', { held: b.t.hp(0, 0), dragon: hpK(b.dr), controller: b.dr.controller, stolenBy: b.dr.stolenBy });
    R.check('gestohlener Dragon nimmt keinen Spell-Schaden (auch vom neuen Kontrolleur)', hpK(b.dr) === 250, hpK(b.dr));
  }
  {
    // Diebstahl DURCH einen Spell wirkt nicht: Cute Conversion
    if (H.DB['Cute Conversion']) {
      const b = await brett();
      const r = await b.t.play(1, 'Cute Conversion', { hero: 0 });
      R.check('Cute Conversion (Spell: übernehme alle Kreaturen): Dragon bleibt beim Besitzer, Kontrollkreatur wird übernommen', r === true && (b.dr.controller ?? b.dr.owner) === 0 && (b.ctl.controller ?? b.ctl.owner) === 1, { r, dragonCtl: b.dr.controller ?? b.dr.owner, ctlCtl: b.ctl.controller ?? b.ctl.owner, errors: b.t.errors.slice(0, 2) });
    }
  }
  {
    // Keine Rückfrage-/Hänger-Probleme und Bilanz: mehrere Spells nacheinander
    const b = await brett();
    const v = b.t.census();
    for (const sp of ['Flame Avalanche', 'Snowstorm Mischief', 'Toxic Fumes']) await b.t.play(1, sp, { hero: 0 });
    R.check('Bilanz: kein Dragon/Held verschwunden, keine Hänger/Fehler', b.dr.zone === 'support' && !b.t.hung && b.t.errors.length === 0 && b.t.audit().length === 0, { zone: b.dr.zone, hung: b.t.hung, e: b.t.errors, a: b.t.audit() });
  }

  // ───────────────────────── H · Engine-Eingänge einzeln ─────────────────────────
  R.section('H · Jeder Engine-Eingang einzeln: mit Spell-Quelle wirkungslos, mit Nicht-Spell-Quelle (Kontrolle) wirksam');
  {
    const SPELL = { name: 'Fireball', owner: 1, heroIdx: 0 };          // echte Spell-Karte
    const NICHT = { name: 'Red Dragoneer', owner: 1, heroIdx: 0 };     // Kreatureneffekt
    const E = (b) => b.t.engine;
    const probe = async (label, aktion, wirkt, { vorbereitung } = {}) => {
      for (const [quelle, soll] of [[SPELL, false], [NICHT, true]]) {
        const b = await brett({ prep: vorbereitung });
        await b.t.run(() => aktion(E(b), b, quelle));
        const w = wirkt(b);
        R.check(`${label} — Quelle ${quelle.name} (${soll ? 'kein Spell' : 'Spell'}): ${soll ? 'wirkt' : 'wirkt NICHT'}`, !!w === soll, { w, errors: b.t.errors.slice(0, 2) });
      }
    };
    await probe('Kreatur: Schaden (actionDealCreatureDamage)', (e, b, q) => e.actionDealCreatureDamage(q, b.dr, 100, 'creature', { sourceOwner: 1 }), b => hpK(b.dr) < 250);
    await probe('Held: Schaden (actionDealDamage)', (e, b, q) => e.actionDealDamage(q, b.t.hero(0, 0), 100, 'creature'), b => b.t.hp(0, 0) < 800);
    await probe('Kreatur: Status Frozen (applyCreatureStatus)', (e, b, q) => e.applyCreatureStatus(b.dr, 'frozen', { sourceOwner: 1, source: q }), b => b.dr.counters.frozen);
    await probe('Held: Status Frozen (addHeroStatus mit Quellname)', (e, b, q) => e.addHeroStatus(0, 0, 'frozen', { appliedBy: 1, source: q.name }), b => (b.t.hero(0, 0).statuses || {}).frozen);
    await probe('Kreatur: Heilung (actionHealCreature)', (e, b, q) => e.actionHealCreature(q, b.dr, 100), b => hpK(b.dr) > 100, { vorbereitung: async (t, dr) => { dr.counters.currentHp = 100; } });
    await probe('Held: Heilung (actionHealHero)', (e, b, q) => e.actionHealHero(q, b.t.hero(0, 0), 100), b => b.t.hp(0, 0) > 300, { vorbereitung: async (t) => { t.hero(0, 0).hp = 300; } });
    await probe('Kreatur: Negierung (actionNegateCreature)', (e, b, q) => e.actionNegateCreature(b.dr, q), b => b.dr.counters.negated || b.dr.counters.nulled);
    await probe('Kreatur: Zerstörung (actionDestroyCard)', (e, b, q) => e.actionDestroyCard(q, b.dr), b => b.t.zone(0, 0, 1) === null);
    await probe('Kreatur: in die Ablage schicken (sendBoardCardToDiscard)', (e, b, q) => e.sendBoardCardToDiscard(b.dr, { source: q }), b => b.t.zone(0, 0, 1) === null);
    await probe('Kreatur: Buff (actionAddCreatureBuff)', (e, b, q) => e.actionAddCreatureBuff(b.dr, 'cloudy', { source: q }), b => Object.keys(b.dr.counters.buffs || {}).length > 0);
    await probe('Kreatur: zurück auf die Hand (actionMoveCard)', (e, b, q) => e.actionMoveCard(b.dr, 'hand', -1, -1, { source: q, sourceName: q.name }), b => b.t.zone(0, 0, 1) === null);
    await probe('Kreatur: in eine andere Zone verschieben (actionMoveCard)', (e, b, q) => e.actionMoveCard(b.dr, 'support', 2, 1, { source: q, sourceName: q.name }), b => b.t.zone(0, 2, 1) === BT);
    await probe('Kreatur: Max-HP erhöhen (increaseMaxHp)', (e, b, q) => e.increaseMaxHp(b.dr, 100, { source: q }), b => (b.dr.counters.maxHp ?? 250) > 250);
    await probe('Held: Buff (actionAddBuff)', (e, b, q) => e.actionAddBuff(b.t.hero(0, 0), 0, 0, 'cloudy', { source: q.name }), b => Object.keys(b.t.hero(0, 0).buffs || {}).length > 0);
    await probe('Held: besiegen (actionDefeatHero)', (e, b, q) => e.actionDefeatHero(q, b.t.hero(0, 0), { reason: q.name }), b => b.t.hero(0, 0).hp <= 0);
    await probe('Kreatur: stehlen (actionStealCreature mit sourceName)', async (e, b, q) => { e.actionStealCreature(1, b.dr, { sourceName: q.name }); await H.sleep(60); }, b => (b.dr.controller ?? b.dr.owner) === 1);
    await probe('Held: Nicht-Schaden-Effekt (heroNonDamageEffectBlocked: max_hp)', async (e, b, q) => { b._blocked = await e.heroNonDamageEffectBlocked(0, 0, 'max_hp', { sourceOwner: 1, source: q }); }, b => b._blocked === false);
  }
  {
    // Die Spell-Quelle kann auch NUR der auflösende Spell sein (Konvention der Heldenwege): ohne Quellname gilt der Stapel
    const b = await brett();
    b.t.gs._resolvingSpellStack = ['Fireball'];
    await b.t.run(() => b.t.engine.actionHealCreature(null, b.dr, 100));
    const ohneQuelle = hpK(b.dr);
    await b.t.run(() => b.t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1 }, b.dr, 100, 'creature', { sourceOwner: 1 }));
    R.check('unbekannte Quelle, aber Spell auf dem Stapel: wie ein Spell behandelt (Schaden einer Quelle ohne Kartennamen "Test" wirkt: Quelle ist benannt, kein Spell)', hpK(b.dr) < 250, hpK(b.dr));
    delete b.t.gs._resolvingSpellStack;
  }

  // ───────────────────────── I · Zusammenspiel mit anderen Karten ─────────────────────────
  R.section('I · Zusammenspiel: Green Dragoneer, Chosen Sacrifice, Fremdbeschwörung, Red Dragoneer');
  {
    // Green Dragoneer in der Hand: das geopferte Drago löst „summon from hand into the Support Zone it occupied" aus
    const t = await H.fresh({ hand: [[BT, 'Green Dragoneer'], []], gold: 100 });
    alt(t.put(0, 0, 0, EGG));
    const r = await t.play(0, BT, { hero: 0, slot: 2 });
    R.check('Green Dragoneer + Opfer: Dragon liegt, Zustand sauber, keine Fehler', r === true && t.zone(0, 0, 2) === BT && t.errors.length === 0 && t.audit().length === 0, { r, z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)], e: t.errors, a: t.audit() });
    R.note('Green Dragoneer nach dem Opfer eines Drago', { dragoneerAufBrett: !!t.find('Green Dragoneer', 'support'), hand: t.pile(0, 'hand'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')).slice(0, 6) });
  }
  {
    // volle Spalte: der Wurf auf den Platz des Eis, Green Dragoneer will genau diesen Platz
    const t = await H.fresh({ hand: [[BT, 'Green Dragoneer'], []], gold: 100 });
    t.grantFor(0, 0, BT);
    alt(t.put(0, 0, 0, EGG)); alt(t.put(0, 0, 1, H.INERT.creature)); alt(t.put(0, 0, 2, H.INERT.creature));
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === BT, answer: () => ({ optionId: 'one' }) });
    const r = await t.play(0, BT, { hero: 0, slot: 0 });
    R.check('Wurf auf belegten Platz + Green Dragoneer in der Hand: kein Absturz, kein Hänger, saubere Zonen', !t.hung && t.errors.length === 0 && t.audit().length === 0 && r !== false || r === true, { r, hung: t.hung, e: t.errors, a: t.audit(), z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)] });
    R.note('Zonen nach Wurf + Green Dragoneer (Platz 0 umkämpft)', { z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)], hand: t.pile(0, 'hand'), gespielt: r });
    R.check('der Dragon ist auf dem Brett ODER (Kosten bezahlt, aber Platz weg) die Karte ist nicht verschwunden — Kartenbilanz', t.find(BT, 'support') || t.pile(0, 'hand').includes(BT) || t.pile(0, 'discardPile').includes(BT) || t.pile(0, 'deletedPile').includes(BT), { z: [t.zone(0, 0, 0), t.zone(0, 0, 1), t.zone(0, 0, 2)], hand: t.pile(0, 'hand'), discard: t.pile(0, 'discardPile') });
  }
  {
    // Chosen Sacrifice (Hand-Ersatz): „When you would sacrifice a Creature you control, you may instead sacrifice this Creature in your hand."
    if (H.DB['Chosen Sacrifice']) {
      const t = await H.fresh({ hand: [[BT, 'Chosen Sacrifice'], []], gold: 100 });
      alt(t.put(0, 0, 0, EGG));
      t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hand'); return h ? [h.id] : null; };
      const r = await t.play(0, BT, { hero: 0, slot: 2 });
      R.note('Chosen Sacrifice als Tribut (Hand-Ersatz) für den Dragon', { r, z: [t.zone(0, 0, 0), t.zone(0, 0, 2)], hand: t.pile(0, 'hand'), errors: t.errors.slice(0, 2) });
      R.check('Chosen Sacrifice: kein Absturz/Hänger, Kartenbilanz stimmt (keine Karte verschwindet)', !t.hung && t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  {
    // Fremdbeschwörung ohne Opfer: summonCreatureWithHooks verlangt die Kosten (Gate `canSummon`)
    const t = await H.fresh({ gold: 100 });
    const ok = H.loadCardEffect(BT).canSummon({ _engine: t.engine, cardOwner: 0 });
    R.check('canSummon ohne Drago: false', ok === false, ok);
    alt(t.put(0, 0, 0, EGG));
    R.check('canSummon mit 1 altem Drago: true', H.loadCardEffect(BT).canSummon({ _engine: t.engine, cardOwner: 0 }) === true, null);
    const t2 = await H.fresh({ gold: 100 });
    frisch(t2.put(0, 0, 0, EGG));
    R.check('canSummon mit 1 frischem Drago: false', H.loadCardEffect(BT).canSummon({ _engine: t2.engine, cardOwner: 0 }) === false, null);
    frisch(t2.put(0, 1, 0, EGG));
    R.check('canSummon mit 2 frischen Drago: true', H.loadCardEffect(BT).canSummon({ _engine: t2.engine, cardOwner: 0 }) === true, null);
    const r = await t2.run(() => t2.engine.isCreatureSummonable ? t2.engine.isCreatureSummonable(BT, 0) : 'n/a');
    R.note('engine.isCreatureSummonable(BT, 0) mit 2 frischen Drago', r);
  }
  {
    // Red Dragoneer zählt den Black-Thorn Dragon als „other Drago Creature" (Name enthält „Drago")
    const { countOtherDragoCreatures } = require('../../../../cards/effects/_drago-shared');
    const t = await H.fresh({ gold: 100 });
    const rd = t.put(0, 0, 0, 'Red Dragoneer');
    t.put(0, 1, 0, BT);
    R.check('Red Dragoneer sieht den Black-Thorn Dragon als andere Drago-Kreatur', countOtherDragoCreatures(t.engine, 0, rd.id) === 1, countOtherDragoCreatures(t.engine, 0, rd.id));
  }
  R.finish();
})();
