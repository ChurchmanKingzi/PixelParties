'use strict';
// W18b-2 · Guard Change nach KONTROLLE: Kreaturen, die ich kontrolliere (auch gestohlene/seitenfremde), in freie Zonen der Helden, die ich kontrolliere
//   (auch temporär gestohlener Helden auf der Gegnerseite)
// Kartentext: „Choose any number of Creatures you control (min. 1) and place them into free Support Zones of other Heroes you control. You can also swap Creatures between Heroes you control."
// Al (19.10.2026): „Ja, sie dürfen bewegt werden (und eigene in die Zonen temporär gestohlener Heroes). Es gibt ja bereits Funktionalität für Creatures,
//   die nicht auf der Seite ihres permanenten Kontrolleurs sind."
const H = require('../../lib/h.js');
const warte = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const antwort = (t, regeln) => {
    t.engine.isCpuPlayer = () => false;
    t.offers = [];
    t.script.push({ match: d => d.type === 'guardChangeMove', answer: (d) => { t.offers.push(d); return regeln(d) || { done: true }; } });
  };

  R.section('(A) Eigene Kreatur in die Zone eines temporär gestohlenen Gegnerhelden');
  {
    const t = await H.fresh({ hand: [['Guard Change'], []] });
    const X = t.put(0, 0, 0, H.INERT.big); X.counters.currentHp = 1000; X.counters.maxHp = 1000;
    await t.run(() => t.engine.actionStealHero(0, 1, 1));
    await warte(250);
    R.check('Aufbau: Gegnerheld 1 ist von Sitz 0 kontrolliert', t.engine.heroSideOf(1, t.gs.players[1].heroes[1]) === 0, t.gs.players[1].heroes[1].charmedBy);
    antwort(t, d => {
      const c = d.creatures.find(x => x.instId === X.id);
      const z = c && c.dests.find(x => x.owner === 1 && x.heroIdx === 1);
      return z ? { instId: X.id, destOwner: 1, destHeroIdx: 1, destSlot: z.slotIdx } : null;
    });
    const r = await t.play(0, 'Guard Change', { hero: 0 });
    const c0 = t.offers[0] && t.offers[0].creatures.find(x => x.instId === X.id);
    R.check('Zonen des gestohlenen Helden werden angeboten (Seite 1, Held 1)', !!c0 && c0.dests.some(z => z.owner === 1 && z.heroIdx === 1), c0 && c0.dests);
    R.check('NICHT angeboten: Zonen der nicht kontrollierten Gegnerhelden 0 und 2', !!c0 && !c0.dests.some(z => z.owner === 1 && z.heroIdx !== 1), c0 && c0.dests);
    R.check('Kreatur steht auf der Gegnerseite (Brettseite 1, Held 1)', t.engine.physicalSide(X) === 1 && X.heroIdx === 1 && t.gs.players[1].supportZones[1][X.zoneSlot].includes(X.name), { seite: t.engine.physicalSide(X), hi: X.heroIdx });
    R.check('Kontrolle und Kartenbesitzer bleiben bei Sitz 0, Seitenfremd-Marke gesetzt', X.controller === 0 && X.originalOwner === 0 && X.counters.crossSideControlled === 0, [X.owner, X.controller, X.originalOwner, X.counters.crossSideControlled]);
    R.check('Quellzone ist leer', (t.gs.players[0].supportZones[0][0] || []).length === 0, t.gs.players[0].supportZones[0]);
    R.check('Guard Change gespielt (r=true)', r === true, r);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(B) Gestohlene Kreatur in meine Zone; nach dem Zugwechsel gehört sie wieder dem Besitzer, steht aber seitenfremd bei mir');
  {
    const t = await H.fresh({ hand: [['Guard Change'], []] });
    const Y = t.put(1, 0, 0, H.INERT.big); Y.counters.currentHp = 1000; Y.counters.maxHp = 1000;
    await t.engine.actionStealCreature(0, Y);
    await warte(250);
    antwort(t, d => {
      const c = d.creatures.find(x => x.instId === Y.id);
      const z = c && c.dests.find(x => x.owner === 0 && x.heroIdx === 2);
      return z ? { instId: Y.id, destOwner: 0, destHeroIdx: 2, destSlot: z.slotIdx } : null;
    });
    await t.play(0, 'Guard Change', { hero: 0 });
    R.check('gestohlene Kreatur steht bei Sitz 0, Held 2', t.engine.physicalSide(Y) === 0 && Y.heroIdx === 2, { seite: t.engine.physicalSide(Y), hi: Y.heroIdx });
    R.check('während des Diebstahls: keine Seitenfremd-Marke, Kontrolle 0', Y.controller === 0 && !(Y.counters.crossSideControlled != null), [Y.owner, Y.controller, Y.counters.crossSideControlled]);
    await t.endTurn();
    R.check('nach dem Zugwechsel: Besitzer 1 kontrolliert sie wieder, sie steht seitenfremd auf Brettseite 0', Y.controller === 1 && Y.counters.crossSideControlled === 1 && t.engine.physicalSide(Y) === 0, [Y.owner, Y.controller, Y.counters.crossSideControlled, t.engine.physicalSide(Y)]);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(C) Tausch über die Seiten (eigene Kreatur ↔ meine Kreatur im Gegnerheld-Zone)');
  {
    const t = await H.fresh({ hand: [['Guard Change'], []] });
    const X = t.put(0, 0, 0, H.INERT.big); X.counters.currentHp = 1000; X.counters.maxHp = 1000;
    await t.run(() => t.engine.actionStealHero(0, 1, 1));
    await warte(250);
    const Z = t.put(1, 1, 0, H.INERT.frail, { controller: 0 });
    t.engine.markiereSeitenfremd(Z, 0);
    antwort(t, d => {
      const c = d.creatures.find(x => x.instId === X.id);
      if (!c || !c.swaps.includes(Z.id)) return null;
      return { instId: X.id, swapWithInstId: Z.id };
    });
    await t.play(0, 'Guard Change', { hero: 0 });
    const c0 = t.offers[0] && t.offers[0].creatures.find(x => x.instId === X.id);
    R.check('Tauschpartner über die Seite wird angeboten', !!c0 && c0.swaps.includes(Z.id), c0 && c0.swaps);
    R.check('X steht jetzt bei Sitz 1 Held 1, Z bei Sitz 0 Held 0', t.engine.physicalSide(X) === 1 && X.heroIdx === 1 && t.engine.physicalSide(Z) === 0 && Z.heroIdx === 0, { X: [t.engine.physicalSide(X), X.heroIdx], Z: [t.engine.physicalSide(Z), Z.heroIdx] });
    R.check('Marken stimmen (X seitenfremd, Z nicht mehr)', X.counters.crossSideControlled === 0 && Z.counters.crossSideControlled == null && Z.controller === 0, [X.counters.crossSideControlled, Z.counters.crossSideControlled, Z.controller]);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(D) Gegenprobe: unkontrollierte Gegnerkreatur wird nicht angeboten, normale eigene Bewegung bleibt');
  {
    const t = await H.fresh({ hand: [['Guard Change'], []] });
    const X = t.put(0, 0, 0, H.INERT.big);
    const G = t.put(1, 0, 0, H.INERT.big);
    antwort(t, d => {
      const c = d.creatures.find(x => x.instId === X.id);
      const z = c && c.dests.find(x => x.owner === 0 && x.heroIdx === 1);
      return z ? { instId: X.id, destHeroIdx: 1, destSlot: z.slotIdx } : null;   // ohne destOwner: eigene Seite zuerst
    });
    await t.play(0, 'Guard Change', { hero: 0 });
    const d0 = t.offers[0];
    R.check('Gegnerkreatur nicht in der Liste', !!d0 && !d0.creatures.some(x => x.instId === G.id), d0 && d0.creatures.map(x => x.name));
    R.check('eigene Zielzonen nur auf der eigenen Seite (kein Held gestohlen)', !!d0 && d0.creatures[0].dests.every(z => z.owner === 0), d0 && d0.creatures[0].dests);
    R.check('X ist zu Held 1 gezogen, Besitz unverändert', X.heroIdx === 1 && X.owner === 0 && X.controller === 0 && X.counters.crossSideControlled == null, [X.heroIdx, X.owner, X.controller]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
